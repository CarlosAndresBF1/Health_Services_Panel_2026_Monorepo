import { Injectable, Logger, NotFoundException } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { IsNull, Repository } from "typeorm";
import axios from "axios";

import { CryptoService } from "../../common/crypto.service";
import { HmacSignerService } from "../../common/hmac-signer.service";
import { Service } from "../../database/entities/service.entity";

const LOG_PROXY_TIMEOUT_MS = 15_000;
const CACHE_TTL_MS = 30_000;
const DEFAULT_LINES = 100;

interface CacheEntry {
  logs: string;
  fetchedAt: number;
}

@Injectable()
export class LogsService {
  private readonly logger = new Logger(LogsService.name);
  private readonly cache = new Map<string, CacheEntry>();

  constructor(
    @InjectRepository(Service)
    private readonly serviceRepository: Repository<Service>,
    private readonly cryptoService: CryptoService,
    private readonly hmacSigner: HmacSignerService,
  ) {}

  /**
   * Fetch logs from a service's logs endpoint, with 30-second cache.
   */
  async fetchLogs(serviceId: number, lines = DEFAULT_LINES): Promise<string> {
    const service = await this.serviceRepository.findOne({
      where: { id: serviceId, deletedAt: IsNull() },
    });

    if (!service) {
      throw new NotFoundException(`Service ${serviceId} not found`);
    }

    if (!service.logsEndpoint) {
      return "Logs endpoint not configured for this service.";
    }

    // Check cache
    const cacheKey = `${serviceId}:${lines}`;
    const cached = this.cache.get(cacheKey);
    if (cached && Date.now() - cached.fetchedAt < CACHE_TTL_MS) {
      return cached.logs;
    }

    // Fetch from remote service
    const logs = await this.fetchRemoteLogs(service, lines);

    // Update cache
    this.cache.set(cacheKey, { logs, fetchedAt: Date.now() });

    return logs;
  }

  /**
   * Invalidate cache for a specific service.
   */
  invalidateCache(serviceId: number): void {
    for (const key of this.cache.keys()) {
      if (key.startsWith(`${serviceId}:`)) {
        this.cache.delete(key);
      }
    }
  }

  /**
   * Fetch logs from the remote service, using HMAC-signed headers.
   */
  private async fetchRemoteLogs(
    service: Service,
    lines: number,
  ): Promise<string> {
    const logsUrl = this.buildLogsUrl(service, lines);

    try {
      const secret = this.cryptoService.decrypt(service.monitorSecret);
      const urlObj = new URL(logsUrl);
      const headers = this.hmacSigner.sign(
        service.monitorApiKey,
        secret,
        "GET",
        urlObj.pathname + urlObj.search,
      );

      const response = await axios.get(logsUrl, {
        headers: headers as unknown as Record<string, string>,
        timeout: LOG_PROXY_TIMEOUT_MS,
        validateStatus: () => true,
      });

      if (response.status === 200) {
        return this.extractLogsFromResponse(response.data);
      }

      return `Logs unavailable (HTTP ${response.status})`;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.warn(
        `Failed to fetch logs for service ${service.id}: ${message}`,
      );
      return "Logs not available — connection failed or timed out.";
    }
  }

  /**
   * Extract log text from various response formats.
   */
  private extractLogsFromResponse(data: unknown): string {
    if (typeof data === "string") {
      return data;
    }
    if (typeof data === "object" && data !== null) {
      const obj = data as Record<string, unknown>;
      if (typeof obj["logs"] === "string") return obj["logs"];
      if (Array.isArray(obj["logs"]))
        return (obj["logs"] as string[]).join("\n");
      if (typeof obj["data"] === "string") return obj["data"];
      return JSON.stringify(data, null, 2);
    }
    return String(data);
  }

  /**
   * Build the full URL for the logs endpoint.
   */
  buildLogsUrl(service: Service, lines = DEFAULT_LINES): string {
    const base = service.url.replace(/\/+$/, "");
    const endpoint = service.logsEndpoint.replace(/^\/+/, "");
    const separator = endpoint.includes("?") ? "&" : "?";
    return `${base}/${endpoint}${separator}lines=${lines}`;
  }
}
