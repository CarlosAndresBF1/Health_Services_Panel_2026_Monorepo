import { Injectable, Logger } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import sgMail from "@sendgrid/mail";

import { ALERT_RATE_LIMIT_MS } from "@healthpanel/shared";

import { Incident } from "../../database/entities/incident.entity";
import { Service } from "../../database/entities/service.entity";
import { Setting } from "../../database/entities/setting.entity";

export interface AlertPayload {
  incident: Incident;
  service: Service;
  screenshotBuffer?: Buffer | undefined;
  logsSnapshot?: string | undefined;
}

export interface ResourceAlertPayload {
  service: Service;
  warnings: Array<{
    type: "disk" | "memory";
    usedPercent: number;
    threshold: number;
    detail: string;
  }>;
}

@Injectable()
export class AlertsService {
  private readonly logger = new Logger(AlertsService.name);
  private configured = false;

  constructor(
    @InjectRepository(Incident)
    private readonly incidentRepository: Repository<Incident>,
    @InjectRepository(Setting)
    private readonly settingRepository: Repository<Setting>,
  ) {
    const apiKey = process.env["SENDGRID_API_KEY"];
    if (apiKey) {
      sgMail.setApiKey(apiKey);
      this.configured = true;
      this.logger.log("SendGrid configured");
    } else {
      this.logger.warn("SENDGRID_API_KEY not set — email alerts disabled");
    }
  }

  // ── Settings helpers ──────────────────────────────────────────────────────

  async getSetting(key: string, fallback: string): Promise<string> {
    const setting = await this.settingRepository.findOne({ where: { key } });
    return setting?.value ?? fallback;
  }

  async isGloballyEnabled(): Promise<boolean> {
    const val = await this.getSetting("alerts_enabled", "true");
    return val === "true";
  }

  async getEmailTo(): Promise<string> {
    return this.getSetting("alert_email_to", "admin@example.com");
  }

  async getEmailFrom(): Promise<string> {
    return this.getSetting("alert_email_from", "monitor@example.com");
  }

  async getMinInterval(): Promise<number> {
    const raw = await this.getSetting(
      "alert_min_interval_ms",
      String(ALERT_RATE_LIMIT_MS),
    );
    return parseInt(raw, 10) || ALERT_RATE_LIMIT_MS;
  }

  // ── Rate limiting ─────────────────────────────────────────────────────────

  /**
   * Check if we can send an alert for this service, based on the most recent
   * email_sent_at for that service's incidents.
   */
  async isRateLimited(serviceId: number): Promise<boolean> {
    const minInterval = await this.getMinInterval();

    const lastSentIncident = await this.incidentRepository.findOne({
      where: { serviceId, emailSent: true },
      order: { emailSentAt: "DESC" },
    });

    if (!lastSentIncident?.emailSentAt) return false;

    const elapsed = Date.now() - lastSentIncident.emailSentAt.getTime();
    return elapsed < minInterval;
  }

  // ── Send alert email ──────────────────────────────────────────────────────

  async sendDownAlert(payload: AlertPayload): Promise<boolean> {
    const { incident, service, screenshotBuffer, logsSnapshot } = payload;

    // Pre-flight checks
    if (!this.configured) {
      this.logger.warn("SendGrid not configured, skipping alert email");
      return false;
    }

    if (!service.alertsEnabled) {
      this.logger.debug(`Alerts disabled for service "${service.name}"`);
      return false;
    }

    const globalEnabled = await this.isGloballyEnabled();
    if (!globalEnabled) {
      this.logger.debug("Alerts globally disabled");
      return false;
    }

    const rateLimited = await this.isRateLimited(service.id);
    if (rateLimited) {
      this.logger.debug(`Rate-limited: skipping alert for "${service.name}"`);
      return false;
    }

    const emailTo = await this.getEmailTo();
    const emailFrom = await this.getEmailFrom();
    const dashboardUrl = process.env["PANEL_URL"] ?? "http://localhost:3000";

    // Build email
    const html = this.buildDownAlertHtml({
      serviceName: service.name,
      serviceUrl: service.url,
      serviceType: service.type,
      timestamp: incident.startedAt.toISOString(),
      logsSnapshot,
      dashboardUrl: `${dashboardUrl}/services/${service.id}`,
    });

    const attachments: Array<{
      content: string;
      filename: string;
      type: string;
      disposition: string;
    }> = [];
    if (screenshotBuffer) {
      attachments.push({
        content: screenshotBuffer.toString("base64"),
        filename: `screenshot_${service.id}_${Date.now()}.png`,
        type: "image/png",
        disposition: "attachment",
      });
    }

    try {
      const msg: Parameters<typeof sgMail.send>[0] = {
        to: emailTo,
        from: emailFrom,
        subject: `🚨 Service DOWN: ${service.name}`,
        html,
      };
      if (attachments.length > 0) {
        msg.attachments = attachments;
      }
      await sgMail.send(msg);

      // Mark incident as email sent
      incident.emailSent = true;
      incident.emailSentAt = new Date();
      await this.incidentRepository.save(incident);

      this.logger.log(`Alert email sent for "${service.name}" to ${emailTo}`);
      return true;
    } catch (error) {
      this.logger.error(`Failed to send alert for "${service.name}":`, error);
      return false;
    }
  }

  async sendRecoveryAlert(
    incident: Incident,
    service: Service,
  ): Promise<boolean> {
    if (!this.configured || !service.alertsEnabled) return false;

    const globalEnabled = await this.isGloballyEnabled();
    if (!globalEnabled) return false;

    // Only send recovery for incidents that had an alert sent
    if (!incident.emailSent) return false;

    const emailTo = await this.getEmailTo();
    const emailFrom = await this.getEmailFrom();
    const dashboardUrl = process.env["PANEL_URL"] ?? "http://localhost:3000";

    const duration = incident.resolvedAt
      ? this.formatDuration(incident.startedAt, incident.resolvedAt)
      : "unknown";

    const html = this.buildRecoveryAlertHtml({
      serviceName: service.name,
      serviceUrl: service.url,
      resolvedAt:
        incident.resolvedAt?.toISOString() ?? new Date().toISOString(),
      duration,
      dashboardUrl: `${dashboardUrl}/services/${service.id}`,
    });

    try {
      await sgMail.send({
        to: emailTo,
        from: emailFrom,
        subject: `✅ Service RECOVERED: ${service.name}`,
        html,
      });

      this.logger.log(
        `Recovery email sent for "${service.name}" to ${emailTo}`,
      );
      return true;
    } catch (error) {
      this.logger.error(
        `Failed to send recovery email for "${service.name}":`,
        error,
      );
      return false;
    }
  }

  // ── HTML templates ────────────────────────────────────────────────────────

  async sendResourceAlert(payload: ResourceAlertPayload): Promise<boolean> {
    const { service, warnings } = payload;

    if (!this.configured) {
      this.logger.warn("SendGrid not configured, skipping resource alert");
      return false;
    }

    if (!service.alertsEnabled) {
      this.logger.debug(`Alerts disabled for service "${service.name}"`);
      return false;
    }

    const globalEnabled = await this.isGloballyEnabled();
    if (!globalEnabled) return false;

    const emailTo = await this.getEmailTo();
    const emailFrom = await this.getEmailFrom();
    const dashboardUrl = process.env["PANEL_URL"] ?? "http://localhost:3000";

    const warningTypes = warnings.map((w) => w.type.toUpperCase()).join(" & ");
    const subject = `⚠️ Resource Warning (${warningTypes}): ${service.name}`;

    const html = this.buildResourceAlertHtml({
      serviceName: service.name,
      serviceUrl: service.url,
      warnings,
      dashboardUrl: `${dashboardUrl}/services/${service.id}`,
    });

    try {
      await sgMail.send({ to: emailTo, from: emailFrom, subject, html });
      this.logger.log(
        `Resource alert sent for "${service.name}" (${warningTypes}) to ${emailTo}`,
      );
      return true;
    } catch (error) {
      this.logger.error(
        `Failed to send resource alert for "${service.name}":`,
        error,
      );
      return false;
    }
  }

  buildResourceAlertHtml(params: {
    serviceName: string;
    serviceUrl: string;
    warnings: ResourceAlertPayload["warnings"];
    dashboardUrl: string;
  }): string {
    const warningRows = params.warnings
      .map((w) => {
        const icon = w.type === "disk" ? "💾" : "🧠";
        const label = w.type === "disk" ? "Disk" : "Memory";
        const barColor = w.usedPercent > 95 ? "#EF4444" : "#F59E0B";
        return `
        <tr style="border-top:1px solid rgba(255,255,255,0.06);">
          <td style="color:#9CA3AF;font-size:12px;text-transform:uppercase;padding:12px 0;font-family:monospace;">${icon} ${label}</td>
          <td style="text-align:right;padding:12px 0;">
            <div style="color:${barColor};font-size:18px;font-weight:700;">${w.usedPercent.toFixed(1)}%</div>
            <div style="color:#9CA3AF;font-size:11px;margin-top:2px;">Threshold: ${w.threshold}%</div>
            <div style="color:#D1D5DB;font-size:12px;margin-top:4px;">${this.escapeHtml(w.detail)}</div>
          </td>
        </tr>`;
      })
      .join("");

    return `
<!DOCTYPE html>
<html>
<body style="margin:0;padding:0;background:#0A0F1A;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <div style="max-width:600px;margin:0 auto;padding:32px 24px;">
    <div style="text-align:center;margin-bottom:32px;">
      <h1 style="color:#F59E0B;font-size:24px;margin:0;">⚠️ Resource Warning</h1>
      <p style="color:#9CA3AF;font-size:14px;margin:8px 0 0;">HealthPanel Alert</p>
    </div>

    <div style="background:#111827;border:1px solid rgba(245,158,11,0.3);border-radius:12px;padding:24px;">
      <table style="width:100%;border-collapse:collapse;">
        <tr>
          <td style="color:#9CA3AF;font-size:12px;text-transform:uppercase;padding:8px 0;font-family:monospace;">Service</td>
          <td style="color:#F3F4F6;font-size:14px;text-align:right;padding:8px 0;font-weight:600;">${this.escapeHtml(params.serviceName)}</td>
        </tr>
        <tr style="border-top:1px solid rgba(255,255,255,0.06);">
          <td style="color:#9CA3AF;font-size:12px;text-transform:uppercase;padding:8px 0;font-family:monospace;">URL</td>
          <td style="color:#60A5FA;font-size:14px;text-align:right;padding:8px 0;"><a href="${this.escapeHtml(params.serviceUrl)}" style="color:#60A5FA;text-decoration:none;">${this.escapeHtml(params.serviceUrl)}</a></td>
        </tr>
        ${warningRows}
      </table>
    </div>

    <div style="text-align:center;margin-top:24px;">
      <a href="${this.escapeHtml(params.dashboardUrl)}" style="display:inline-block;background:#C8A951;color:#0A0F1A;text-decoration:none;padding:12px 32px;border-radius:8px;font-weight:600;font-size:14px;">
        View in Dashboard
      </a>
    </div>

    <p style="color:#6B7280;font-size:12px;text-align:center;margin-top:32px;">
      This is an automated resource warning from HealthPanel. Consider freeing up space or scaling resources.
    </p>
  </div>
</body>
</html>`;
  }

  buildDownAlertHtml(params: {
    serviceName: string;
    serviceUrl: string;
    serviceType: string;
    timestamp: string;
    logsSnapshot?: string | undefined;
    dashboardUrl: string;
  }): string {
    const logsSection = params.logsSnapshot
      ? `
      <div style="margin-top:24px;">
        <h3 style="color:#C8A951;font-size:14px;margin:0 0 12px 0;">Last log lines</h3>
        <pre style="background:#0A0F1A;color:#E5E7EB;padding:16px;border-radius:8px;font-size:12px;overflow-x:auto;max-height:400px;border:1px solid rgba(255,255,255,0.1);">${this.escapeHtml(params.logsSnapshot)}</pre>
      </div>`
      : "";

    return `
<!DOCTYPE html>
<html>
<body style="margin:0;padding:0;background:#0A0F1A;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <div style="max-width:600px;margin:0 auto;padding:32px 24px;">
    <!-- Header -->
    <div style="text-align:center;margin-bottom:32px;">
      <h1 style="color:#EF4444;font-size:24px;margin:0;">🚨 Service Down</h1>
      <p style="color:#9CA3AF;font-size:14px;margin:8px 0 0;">HealthPanel Alert</p>
    </div>

    <!-- Alert card -->
    <div style="background:#111827;border:1px solid rgba(239,68,68,0.3);border-radius:12px;padding:24px;">
      <table style="width:100%;border-collapse:collapse;">
        <tr>
          <td style="color:#9CA3AF;font-size:12px;text-transform:uppercase;padding:8px 0;font-family:monospace;">Service</td>
          <td style="color:#F3F4F6;font-size:14px;text-align:right;padding:8px 0;font-weight:600;">${this.escapeHtml(params.serviceName)}</td>
        </tr>
        <tr style="border-top:1px solid rgba(255,255,255,0.06);">
          <td style="color:#9CA3AF;font-size:12px;text-transform:uppercase;padding:8px 0;font-family:monospace;">URL</td>
          <td style="color:#60A5FA;font-size:14px;text-align:right;padding:8px 0;"><a href="${this.escapeHtml(params.serviceUrl)}" style="color:#60A5FA;text-decoration:none;">${this.escapeHtml(params.serviceUrl)}</a></td>
        </tr>
        <tr style="border-top:1px solid rgba(255,255,255,0.06);">
          <td style="color:#9CA3AF;font-size:12px;text-transform:uppercase;padding:8px 0;font-family:monospace;">Type</td>
          <td style="color:#F3F4F6;font-size:14px;text-align:right;padding:8px 0;">${this.escapeHtml(params.serviceType)}</td>
        </tr>
        <tr style="border-top:1px solid rgba(255,255,255,0.06);">
          <td style="color:#9CA3AF;font-size:12px;text-transform:uppercase;padding:8px 0;font-family:monospace;">Detected at</td>
          <td style="color:#F3F4F6;font-size:14px;text-align:right;padding:8px 0;">${this.escapeHtml(params.timestamp)}</td>
        </tr>
      </table>

      ${logsSection}
    </div>

    <!-- CTA button -->
    <div style="text-align:center;margin-top:24px;">
      <a href="${this.escapeHtml(params.dashboardUrl)}" style="display:inline-block;background:#C8A951;color:#0A0F1A;text-decoration:none;padding:12px 32px;border-radius:8px;font-weight:600;font-size:14px;">
        View in Dashboard
      </a>
    </div>

    <!-- Footer -->
    <p style="color:#6B7280;font-size:12px;text-align:center;margin-top:32px;">
      This is an automated alert from HealthPanel. If attached, a screenshot of the service is included.
    </p>
  </div>
</body>
</html>`;
  }

  buildRecoveryAlertHtml(params: {
    serviceName: string;
    serviceUrl: string;
    resolvedAt: string;
    duration: string;
    dashboardUrl: string;
  }): string {
    return `
<!DOCTYPE html>
<html>
<body style="margin:0;padding:0;background:#0A0F1A;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <div style="max-width:600px;margin:0 auto;padding:32px 24px;">
    <!-- Header -->
    <div style="text-align:center;margin-bottom:32px;">
      <h1 style="color:#22C55E;font-size:24px;margin:0;">✅ Service Recovered</h1>
      <p style="color:#9CA3AF;font-size:14px;margin:8px 0 0;">HealthPanel Alert</p>
    </div>

    <!-- Recovery card -->
    <div style="background:#111827;border:1px solid rgba(34,197,94,0.3);border-radius:12px;padding:24px;">
      <table style="width:100%;border-collapse:collapse;">
        <tr>
          <td style="color:#9CA3AF;font-size:12px;text-transform:uppercase;padding:8px 0;font-family:monospace;">Service</td>
          <td style="color:#F3F4F6;font-size:14px;text-align:right;padding:8px 0;font-weight:600;">${this.escapeHtml(params.serviceName)}</td>
        </tr>
        <tr style="border-top:1px solid rgba(255,255,255,0.06);">
          <td style="color:#9CA3AF;font-size:12px;text-transform:uppercase;padding:8px 0;font-family:monospace;">URL</td>
          <td style="color:#60A5FA;font-size:14px;text-align:right;padding:8px 0;">${this.escapeHtml(params.serviceUrl)}</td>
        </tr>
        <tr style="border-top:1px solid rgba(255,255,255,0.06);">
          <td style="color:#9CA3AF;font-size:12px;text-transform:uppercase;padding:8px 0;font-family:monospace;">Recovered at</td>
          <td style="color:#F3F4F6;font-size:14px;text-align:right;padding:8px 0;">${this.escapeHtml(params.resolvedAt)}</td>
        </tr>
        <tr style="border-top:1px solid rgba(255,255,255,0.06);">
          <td style="color:#9CA3AF;font-size:12px;text-transform:uppercase;padding:8px 0;font-family:monospace;">Downtime</td>
          <td style="color:#F59E0B;font-size:14px;text-align:right;padding:8px 0;font-weight:600;">${this.escapeHtml(params.duration)}</td>
        </tr>
      </table>
    </div>

    <!-- CTA button -->
    <div style="text-align:center;margin-top:24px;">
      <a href="${this.escapeHtml(params.dashboardUrl)}" style="display:inline-block;background:#C8A951;color:#0A0F1A;text-decoration:none;padding:12px 32px;border-radius:8px;font-weight:600;font-size:14px;">
        View in Dashboard
      </a>
    </div>

    <p style="color:#6B7280;font-size:12px;text-align:center;margin-top:32px;">
      This is an automated alert from HealthPanel.
    </p>
  </div>
</body>
</html>`;
  }

  // ── Helpers ───────────────────────────────────────────────────────────────

  private escapeHtml(str: string): string {
    return str
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  private formatDuration(start: Date, end: Date): string {
    const ms = end.getTime() - start.getTime();
    const seconds = Math.floor(ms / 1000);
    if (seconds < 60) return `${seconds}s`;
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ${seconds % 60}s`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ${minutes % 60}m`;
    const days = Math.floor(hours / 24);
    return `${days}d ${hours % 24}h`;
  }
}
