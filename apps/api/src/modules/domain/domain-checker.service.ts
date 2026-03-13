import * as net from "net";

import { Injectable, Logger } from "@nestjs/common";
import { EventEmitter2 } from "@nestjs/event-emitter";
import { InjectRepository } from "@nestjs/typeorm";
import { IsNull, Repository } from "typeorm";

import {
  DomainCheck,
  DomainCheckStatus,
} from "../../database/entities/domain-check.entity";
import { Service } from "../../database/entities/service.entity";
import { Setting } from "../../database/entities/setting.entity";
import { MonitorGateway } from "../health-checker/monitor.gateway";

export const DOMAIN_EXPIRY_WARNING_EVENT = "domain.expiry.warning";

export interface DomainExpiryWarningEvent {
  service: Service;
  domainCheck: DomainCheck;
}

// ─── WHOIS server map by TLD ────────────────────────────────────────────────
const WHOIS_SERVERS: Record<string, string> = {
  com: "whois.verisign-grs.com",
  net: "whois.verisign-grs.com",
  org: "whois.pir.org",
  io: "whois.nic.io",
  co: "whois.nic.co",
  dev: "whois.nic.google",
  app: "whois.nic.google",
  page: "whois.nic.google",
  cloud: "whois.nic.cloud",
  online: "whois.nic.online",
  site: "whois.nic.site",
  info: "whois.afilias.net",
  biz: "whois.biz",
  us: "whois.nic.us",
  uk: "whois.nic.uk",
  ca: "whois.cira.ca",
  au: "whois.auda.org.au",
  de: "whois.denic.de",
  fr: "whois.afnic.fr",
  nl: "whois.sidn.nl",
  es: "whois.nic.es",
  eu: "whois.eu",
  mx: "whois.mx",
  br: "whois.registro.br",
  ar: "whois.nic.ar",
  cl: "whois.nic.cl",
  tech: "whois.nic.tech",
  studio: "whois.nic.studio",
  design: "whois.nic.design",
  digital: "whois.nic.digital",
};

const WHOIS_PORT = 43;
const WHOIS_TIMEOUT_MS = 15_000;
const DEFAULT_ALERT_DAYS = 30;

// ─── Regex patterns to extract expiry date from WHOIS raw text ────────────
const EXPIRY_PATTERNS = [
  /Registry Expiry Date:\s*(.+)/i,
  /Expiry Date:\s*(.+)/i,
  /Expiration Date:\s*(.+)/i,
  /Expires On:\s*(.+)/i,
  /Expires:\s*(.+)/i,
  /expire:\s*(.+)/i,
  /paid-till:\s*(.+)/i,
  /valid-date:\s*(.+)/i,
  /Valid Until:\s*(.+)/i,
  /Expiral Date:\s*(.+)/i,
];

const REGISTRAR_PATTERNS = [/Registrar:\s*(.+)/i, /Registrar Name:\s*(.+)/i];

// ─── Service ────────────────────────────────────────────────────────────────

@Injectable()
export class DomainCheckerService {
  private readonly logger = new Logger(DomainCheckerService.name);

  constructor(
    @InjectRepository(DomainCheck)
    private readonly domainCheckRepository: Repository<DomainCheck>,
    @InjectRepository(Setting)
    private readonly settingRepository: Repository<Setting>,
    private readonly monitorGateway: MonitorGateway,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  // ── Public API ────────────────────────────────────────────────────────────

  /**
   * Run a domain expiry check for a single service.
   * Stores the result and emits a warning if close to expiry.
   */
  async checkService(service: Service): Promise<DomainCheck> {
    const domain = this.extractDomain(service.url);

    if (!domain) {
      const result = this.domainCheckRepository.create({
        serviceId: service.id,
        domain: service.url,
        expiresAt: null,
        daysUntilExpiry: null,
        status: DomainCheckStatus.UNKNOWN,
        error: "Could not extract domain from URL",
        alertSent: false,
        checkedAt: new Date(),
      });
      return this.domainCheckRepository.save(result);
    }

    try {
      const { expiresAt, registrar } = await this.fetchWhoisExpiry(domain);

      const now = new Date();
      let daysUntilExpiry: number | null = null;
      let status: DomainCheckStatus = DomainCheckStatus.UNKNOWN;

      if (expiresAt) {
        daysUntilExpiry = Math.ceil(
          (expiresAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24),
        );

        const alertThreshold = await this.getAlertDays();

        if (daysUntilExpiry <= 0) {
          status = DomainCheckStatus.EXPIRED;
        } else if (daysUntilExpiry <= alertThreshold) {
          status = DomainCheckStatus.EXPIRING_SOON;
        } else {
          status = DomainCheckStatus.OK;
        }
      }

      const prevCheck = await this.getLatestForService(service.id);
      const alertSent = prevCheck?.alertSent ?? false;

      const result = this.domainCheckRepository.create({
        serviceId: service.id,
        domain,
        expiresAt,
        daysUntilExpiry,
        status,
        registrar: registrar ?? null,
        error: null,
        // Reset alertSent if domain was renewed (status back to OK)
        alertSent: status === DomainCheckStatus.OK ? false : alertSent,
        checkedAt: new Date(),
      });

      const saved = await this.domainCheckRepository.save(result);

      // Emit alert if expiring/expired and not already alerted
      if (
        (status === DomainCheckStatus.EXPIRING_SOON ||
          status === DomainCheckStatus.EXPIRED) &&
        !saved.alertSent
      ) {
        this.emitWarning(service, saved);
        this.eventEmitter.emit(DOMAIN_EXPIRY_WARNING_EVENT, {
          service,
          domainCheck: saved,
        } satisfies DomainExpiryWarningEvent);
      }

      this.logger.debug(
        `Domain check for ${service.name} (${domain}): ${status}, expires in ${daysUntilExpiry ?? "?"} days`,
      );

      return saved;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.warn(`WHOIS lookup failed for ${domain}: ${message}`);

      const result = this.domainCheckRepository.create({
        serviceId: service.id,
        domain,
        expiresAt: null,
        daysUntilExpiry: null,
        status: DomainCheckStatus.UNKNOWN,
        error: message,
        alertSent: false,
        checkedAt: new Date(),
      });
      return this.domainCheckRepository.save(result);
    }
  }

  /** Mark alert as sent for the latest domain check of a service. */
  async markAlertSent(domainCheckId: number): Promise<void> {
    await this.domainCheckRepository.update(domainCheckId, { alertSent: true });
  }

  /** Get the latest domain check for a service. */
  async getLatestForService(serviceId: number): Promise<DomainCheck | null> {
    return this.domainCheckRepository.findOne({
      where: { serviceId },
      order: { checkedAt: "DESC" },
    });
  }

  // ── WHOIS lookup ──────────────────────────────────────────────────────────

  private async fetchWhoisExpiry(
    domain: string,
  ): Promise<{ expiresAt: Date | null; registrar: string | null }> {
    const tld = this.getTld(domain);
    const whoisServer = WHOIS_SERVERS[tld] ?? "whois.iana.org";

    const raw = await this.tcpWhois(domain, whoisServer);

    // For IANA referrals, follow to actual registrar WHOIS
    const referMatch = raw.match(/refer:\s*(\S+)/i);
    let finalRaw = raw;
    if (referMatch?.[1] && whoisServer === "whois.iana.org") {
      try {
        finalRaw = await this.tcpWhois(domain, referMatch[1]);
      } catch {
        finalRaw = raw;
      }
    }

    const expiresAt = this.parseExpiryDate(finalRaw);
    const registrar = this.parseRegistrar(finalRaw);

    return { expiresAt, registrar };
  }

  private tcpWhois(domain: string, server: string): Promise<string> {
    return new Promise((resolve, reject) => {
      let data = "";
      const socket = net.createConnection(WHOIS_PORT, server);

      const timeout = setTimeout(() => {
        socket.destroy();
        reject(new Error(`WHOIS timeout connecting to ${server}`));
      }, WHOIS_TIMEOUT_MS);

      socket.on("connect", () => {
        socket.write(`${domain}\r\n`);
      });

      socket.on("data", (chunk) => {
        data += chunk.toString("utf8");
      });

      socket.on("end", () => {
        clearTimeout(timeout);
        resolve(data);
      });

      socket.on("error", (err) => {
        clearTimeout(timeout);
        reject(err);
      });
    });
  }

  private parseExpiryDate(raw: string): Date | null {
    for (const pattern of EXPIRY_PATTERNS) {
      const match = raw.match(pattern);
      if (match?.[1]) {
        const dateStr = match[1].trim();
        const parsed = new Date(dateStr);
        if (!isNaN(parsed.getTime())) {
          return parsed;
        }
        // Try alternative date formats
        const ddmmyyyy = dateStr.match(/(\d{2})\.(\d{2})\.(\d{4})/);
        if (ddmmyyyy) {
          const d = new Date(`${ddmmyyyy[3]}-${ddmmyyyy[2]}-${ddmmyyyy[1]}`);
          if (!isNaN(d.getTime())) return d;
        }
      }
    }
    return null;
  }

  private parseRegistrar(raw: string): string | null {
    for (const pattern of REGISTRAR_PATTERNS) {
      const match = raw.match(pattern);
      if (match?.[1]) {
        return match[1].trim().slice(0, 255);
      }
    }
    return null;
  }

  // ── Helpers ───────────────────────────────────────────────────────────────

  extractDomain(rawUrl: string): string | null {
    try {
      const urlStr = rawUrl.startsWith("http") ? rawUrl : `https://${rawUrl}`;
      const url = new URL(urlStr);
      let hostname = url.hostname;
      // Remove 'www.' prefix
      if (hostname.startsWith("www.")) hostname = hostname.slice(4);
      // Validate it's a real domain
      if (!hostname.includes(".")) return null;
      return hostname.toLowerCase();
    } catch {
      return null;
    }
  }

  private getTld(domain: string): string {
    const parts = domain.split(".");
    if (parts.length >= 3) {
      const sld = parts.slice(-2).join(".");
      // Known second-level TLDs (co.uk, com.br, etc.)
      const knownSlds = [
        "co.uk",
        "com.br",
        "com.ar",
        "com.mx",
        "com.au",
        "org.uk",
        "net.uk",
      ];
      if (knownSlds.includes(sld)) return sld.replace(".", "_");
    }
    return parts[parts.length - 1].toLowerCase();
  }

  private emitWarning(service: Service, domainCheck: DomainCheck): void {
    this.monitorGateway.emitDomainExpiryWarning({
      serviceId: service.id,
      serviceName: service.name,
      domain: domainCheck.domain,
      expiresAt: domainCheck.expiresAt?.toISOString() ?? null,
      daysUntilExpiry: domainCheck.daysUntilExpiry,
      status: domainCheck.status as "expiring_soon" | "expired",
    });
  }

  private async getAlertDays(): Promise<number> {
    const setting = await this.settingRepository.findOne({
      where: { key: "domain_alert_days_before" },
    });
    return (
      parseInt(setting?.value ?? String(DEFAULT_ALERT_DAYS), 10) ||
      DEFAULT_ALERT_DAYS
    );
  }
}
