import { Injectable, Logger, OnModuleInit } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { IsNull, Repository } from "typeorm";
import axios, { AxiosError } from "axios";

import { HealthStatus } from "@healthpanel/shared";

import { CryptoService } from "../../common/crypto.service";
import { HmacSignerService } from "../../common/hmac-signer.service";
import { HealthCheck } from "../../database/entities/health-check.entity";
import { Service } from "../../database/entities/service.entity";
import { IncidentService } from "./incident.service";
import { MonitorGateway } from "./monitor.gateway";

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
}

@Injectable()
export class HealthCheckerService implements OnModuleInit {
  private readonly logger = new Logger(HealthCheckerService.name);
  private timers = new Map<number, NodeJS.Timeout>();

  constructor(
    @InjectRepository(Service)
    private readonly serviceRepository: Repository<Service>,
    @InjectRepository(HealthCheck)
    private readonly healthCheckRepository: Repository<HealthCheck>,
    private readonly cryptoService: CryptoService,
    private readonly hmacSigner: HmacSignerService,
    private readonly incidentService: IncidentService,
    private readonly monitorGateway: MonitorGateway,
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
    });

    // Incident detection
    await this.incidentService.evaluate(svc, result.status);

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

      if (statusCode >= 200 && statusCode < 300) {
        return {
          status:
            elapsed > DEGRADED_THRESHOLD_MS
              ? HealthStatus.DEGRADED
              : HealthStatus.UP,
          responseTimeMs: elapsed,
          statusCode,
          errorMessage: null,
        };
      }

      return {
        status: HealthStatus.DOWN,
        responseTimeMs: elapsed,
        statusCode,
        errorMessage: `HTTP ${statusCode}`,
      };
    } catch (err) {
      const elapsed = Date.now() - start;
      const axiosError = err as AxiosError;

      return {
        status: HealthStatus.DOWN,
        responseTimeMs: elapsed,
        statusCode: null,
        errorMessage: axiosError.message ?? "Unknown error",
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
}
