import { Injectable, Logger, OnModuleInit } from "@nestjs/common";
import { EventEmitter2 } from "@nestjs/event-emitter";
import { InjectRepository } from "@nestjs/typeorm";
import { IsNull, Repository } from "typeorm";
import axios, { AxiosError } from "axios";

import {
  HealthStatus,
  DEFAULT_DISK_THRESHOLD_PERCENT,
  DEFAULT_MEMORY_THRESHOLD_PERCENT,
  RESOURCE_ALERT_COOLDOWN_MS,
} from "@healthpanel/shared";

import { CryptoService } from "../../common/crypto.service";
import { HmacSignerService } from "../../common/hmac-signer.service";
import { HealthCheck } from "../../database/entities/health-check.entity";
import { Service } from "../../database/entities/service.entity";
import { Setting } from "../../database/entities/setting.entity";
import { IncidentService } from "./incident.service";
import { MonitorGateway } from "./monitor.gateway";

export const RESOURCE_WARNING_EVENT = "resource.warning";

export interface ResourceWarningEvent {
  service: Service;
  warnings: Array<{
    type: "disk" | "memory";
    usedPercent: number;
    threshold: number;
    detail: string;
  }>;
}

const DEGRADED_THRESHOLD_MS = 3000;
const DEFAULT_TIMEOUT_MS = 10_000;
const SSRF_BLOCKED_HOSTS = [
  "localhost",
  "127.0.0.1",
  "0.0.0.0",
  "::1",
  "[::1]",
];

export interface CheckResult {
  status: HealthStatus;
  responseTimeMs: number;
  statusCode: number | null;
  errorMessage: string | null;
  responseData: Record<string, unknown> | null;
}

@Injectable()
export class HealthCheckerService implements OnModuleInit {
  private readonly logger = new Logger(HealthCheckerService.name);
  private timers = new Map<number, NodeJS.Timeout>();
  /** Tracks last resource alert time per service to enforce cooldown */
  private resourceAlertCooldowns = new Map<number, number>();

  constructor(
    @InjectRepository(Service)
    private readonly serviceRepository: Repository<Service>,
    @InjectRepository(HealthCheck)
    private readonly healthCheckRepository: Repository<HealthCheck>,
    @InjectRepository(Setting)
    private readonly settingRepository: Repository<Setting>,
    private readonly cryptoService: CryptoService,
    private readonly hmacSigner: HmacSignerService,
    private readonly incidentService: IncidentService,
    private readonly monitorGateway: MonitorGateway,
    private readonly eventEmitter: EventEmitter2,
  ) {
    // SchedulerRegistry injected to ensure @nestjs/schedule module is active
  }

  // ─── Bootstrap ──────────────────────────────────────────────────────────

  async onModuleInit(): Promise<void> {
    this.logger.log("Scheduling health checks for active services…");
    await this.scheduleAll();
  }

  /** Load all active services and create interval timers. */
  async scheduleAll(): Promise<void> {
    // Clear existing timers
    for (const [id, timer] of this.timers) {
      clearInterval(timer);
      this.timers.delete(id);
    }

    const services = await this.serviceRepository.find({
      where: { isActive: true, deletedAt: IsNull() },
    });

    for (const svc of services) {
      this.scheduleOne(svc);
    }

    this.logger.log(`Scheduled ${services.length} service(s)`);
  }

  /** Schedule periodic checks for a single service. */
  scheduleOne(svc: Service): void {
    // Clear previous if exists
    const existing = this.timers.get(svc.id);
    if (existing) clearInterval(existing);

    const intervalMs = svc.checkIntervalSeconds * 1000;
    const timer = setInterval(() => {
      void this.executeCheck(svc.id);
    }, intervalMs);

    this.timers.set(svc.id, timer);
  }

  /** Remove timer for a service (e.g. on deactivation or deletion). */
  unschedule(serviceId: number): void {
    const timer = this.timers.get(serviceId);
    if (timer) {
      clearInterval(timer);
      this.timers.delete(serviceId);
    }
  }

  // ─── Execute check ────────────────────────────────────────────────────

  /** Run one health check for a service, save result, handle incidents. */
  async executeCheck(serviceId: number): Promise<HealthCheck> {
    const svc = await this.serviceRepository.findOne({
      where: { id: serviceId, deletedAt: IsNull() },
    });

    if (!svc || !svc.isActive) {
      this.unschedule(serviceId);
      throw new Error(`Service ${serviceId} not found or inactive`);
    }

    // SSRF prevention
    const url = this.buildCheckUrl(svc);
    this.validateUrl(url);

    // Decrypt secret for HMAC signing
    const secret = this.cryptoService.decrypt(svc.monitorSecret);
    const healthPath = svc.healthEndpoint || "/health";
    const headers: Record<string, string> = this.hmacSigner.sign(
      svc.monitorApiKey,
      secret,
      "GET",
      healthPath,
    ) as unknown as Record<string, string>;

    // First attempt
    let result = await this.performRequest(url, headers);

    // Retry once before marking as down
    if (result.status === HealthStatus.DOWN) {
      this.logger.warn(
        `Service ${svc.name} (${svc.id}): first check failed, retrying…`,
      );
      result = await this.performRequest(url, headers);
    }

    // Persist
    const healthCheck = this.healthCheckRepository.create({
      serviceId: svc.id,
      status: result.status,
      responseTimeMs: result.responseTimeMs,
      statusCode: result.statusCode,
      errorMessage: result.errorMessage,
      responseData: result.responseData,
      checkedAt: new Date(),
    });

    const saved = await this.healthCheckRepository.save(healthCheck);

    // WebSocket broadcast
    this.monitorGateway.emitHealthUpdate({
      serviceId: svc.id,
      status: result.status,
      responseTimeMs: result.responseTimeMs,
      statusCode: result.statusCode ?? 0,
      checkedAt: saved.checkedAt.toISOString(),
      responseData: result.responseData,
    });

    // Incident detection
    await this.incidentService.evaluate(svc, result.status);

    // Resource threshold evaluation (disk/memory)
    if (result.responseData) {
      await this.evaluateResources(svc, result.responseData);
    }

    this.logger.debug(
      `Service ${svc.name}: ${result.status} (${result.responseTimeMs}ms)`,
    );

    return saved;
  }

  // ─── HTTP request ──────────────────────────────────────────────────────

  /** Perform the actual HTTP GET and classify the result. */
  async performRequest(
    url: string,
    headers: Record<string, string>,
  ): Promise<CheckResult> {
    const start = Date.now();

    try {
      const response = await axios.get(url, {
        headers,
        timeout: DEFAULT_TIMEOUT_MS,
        validateStatus: () => true, // don't throw on non-2xx
      });

      const elapsed = Date.now() - start;
      const statusCode = response.status;

      const responseData =
        typeof response.data === "object" && response.data !== null
          ? (response.data as Record<string, unknown>)
          : null;

      if (statusCode >= 200 && statusCode < 300) {
        return {
          status:
            elapsed > DEGRADED_THRESHOLD_MS
              ? HealthStatus.DEGRADED
              : HealthStatus.UP,
          responseTimeMs: elapsed,
          statusCode,
          errorMessage: null,
          responseData,
        };
      }

      return {
        status: HealthStatus.DOWN,
        responseTimeMs: elapsed,
        statusCode,
        errorMessage: `HTTP ${statusCode}`,
        responseData,
      };
    } catch (err) {
      const elapsed = Date.now() - start;
      const axiosError = err as AxiosError;

      return {
        status: HealthStatus.DOWN,
        responseTimeMs: elapsed,
        statusCode: null,
        errorMessage: axiosError.message ?? "Unknown error",
        responseData: null,
      };
    }
  }

  // ─── History ───────────────────────────────────────────────────────────

  /** Get paginated health check history for a service. */
  async getHistory(
    serviceId: number,
    page = 1,
    limit = 20,
  ): Promise<{ data: HealthCheck[]; total: number }> {
    const [data, total] = await this.healthCheckRepository.findAndCount({
      where: { serviceId },
      order: { checkedAt: "DESC" },
      skip: (page - 1) * limit,
      take: limit,
    });
    return { data, total };
  }

  // ─── Helpers ───────────────────────────────────────────────────────────

  /** Build full URL: service.url + healthEndpoint */
  buildCheckUrl(svc: Service): string {
    const base = svc.url.replace(/\/+$/, "");
    const path = (svc.healthEndpoint || "/health").replace(/^\/+/, "/");
    return `${base}${path}`;
  }

  /** Block SSRF: reject requests to localhost / private IPs. */
  validateUrl(url: string): void {
    let hostname: string;
    try {
      hostname = new URL(url).hostname;
    } catch {
      throw new Error(`Invalid URL: ${url}`);
    }

    if (SSRF_BLOCKED_HOSTS.includes(hostname)) {
      throw new Error(`SSRF blocked: requests to ${hostname} are not allowed`);
    }

    // Block private IP ranges
    if (
      hostname.startsWith("10.") ||
      hostname.startsWith("192.168.") ||
      /^172\.(1[6-9]|2\d|3[01])\./.test(hostname)
    ) {
      throw new Error(`SSRF blocked: requests to private IPs are not allowed`);
    }
  }

  // ─── Resource threshold evaluation ─────────────────────────────────────

  private async getThreshold(key: string, fallback: number): Promise<number> {
    const setting = await this.settingRepository.findOne({ where: { key } });
    if (!setting) return fallback;
    const parsed = parseInt(setting.value, 10);
    return Number.isNaN(parsed) ? fallback : parsed;
  }

  /**
   * Evaluate disk and memory from responseData against configured thresholds.
   * If any threshold is exceeded and cooldown has passed, emit a resource warning.
   */
  async evaluateResources(
    service: Service,
    responseData: Record<string, unknown>,
  ): Promise<void> {
    if (!service.alertsEnabled) return;

    const disk = responseData["disk"] as
      | {
          used_percent?: number;
          used_gb?: number;
          total_gb?: number;
          free_gb?: number;
        }
      | undefined;
    const memory = responseData["memory"] as
      | {
          used_percent?: number;
          used_mb?: number;
          total_mb?: number;
          free_mb?: number;
        }
      | undefined;

    if (!disk && !memory) return;

    const diskThreshold = await this.getThreshold(
      "resource_disk_threshold_percent",
      DEFAULT_DISK_THRESHOLD_PERCENT,
    );
    const memoryThreshold = await this.getThreshold(
      "resource_memory_threshold_percent",
      DEFAULT_MEMORY_THRESHOLD_PERCENT,
    );

    const warnings: ResourceWarningEvent["warnings"] = [];

    if (disk?.used_percent != null && disk.used_percent >= diskThreshold) {
      warnings.push({
        type: "disk",
        usedPercent: disk.used_percent,
        threshold: diskThreshold,
        detail: `${disk.used_gb?.toFixed(1) ?? "?"} GB used / ${disk.total_gb?.toFixed(1) ?? "?"} GB total (${disk.free_gb?.toFixed(1) ?? "?"} GB free)`,
      });
    }

    if (
      memory?.used_percent != null &&
      memory.used_percent >= memoryThreshold
    ) {
      warnings.push({
        type: "memory",
        usedPercent: memory.used_percent,
        threshold: memoryThreshold,
        detail: `${memory.used_mb?.toFixed(0) ?? "?"} MB used / ${memory.total_mb?.toFixed(0) ?? "?"} MB total (${memory.free_mb?.toFixed(0) ?? "?"} MB free)`,
      });
    }

    if (warnings.length === 0) return;

    // Cooldown check — avoid spamming alerts
    const lastAlert = this.resourceAlertCooldowns.get(service.id) ?? 0;
    const now = Date.now();
    const cooldownMs = RESOURCE_ALERT_COOLDOWN_MS;

    // Always emit WebSocket warning (real-time UI)
    this.monitorGateway.emitResourceWarning({
      serviceId: service.id,
      serviceName: service.name,
      warnings,
      timestamp: new Date().toISOString(),
    });

    // Only emit email event if cooldown has passed
    if (now - lastAlert >= cooldownMs) {
      this.resourceAlertCooldowns.set(service.id, now);

      this.logger.warn(
        `⚠️ Resource warning for "${service.name}": ${warnings.map((w) => `${w.type} at ${w.usedPercent.toFixed(1)}%`).join(", ")}`,
      );

      this.eventEmitter.emit(RESOURCE_WARNING_EVENT, {
        service,
        warnings,
      } satisfies ResourceWarningEvent);
    }
  }
}
