import { Injectable, Logger } from "@nestjs/common";
import axios from "axios";

import { CryptoService } from "../../common/crypto.service";
import { HmacSignerService } from "../../common/hmac-signer.service";
import { Service } from "../../database/entities/service.entity";

const LOG_COLLECTION_TIMEOUT_MS = 10_000;
const LOG_LINES = 100;

@Injectable()
export class LogCollectorService {
  private readonly logger = new Logger(LogCollectorService.name);

  constructor(
    private readonly cryptoService: CryptoService,
    private readonly hmacSigner: HmacSignerService,
  ) {}

  /**
   * Collect the last N log lines from a remote service's logs endpoint.
   * Uses HMAC-SHA256 signed headers for authentication.
   *
   * Returns the logs as a string, or a fallback message on failure.
   */
  async collect(service: Service, lines = LOG_LINES): Promise<string> {
    if (!service.logsEndpoint) {
      return "Logs endpoint not configured for this service.";
    }

    const logsUrl = this.buildLogsUrl(service, lines);

    try {
      // Decrypt secret and sign the request
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
        timeout: LOG_COLLECTION_TIMEOUT_MS,
        validateStatus: () => true,
      });

      if (response.status === 200) {
        // Response could be JSON with a "logs" field, or plain text
        if (typeof response.data === "string") {
          return response.data;
        }
        if (typeof response.data === "object" && response.data !== null) {
          const data = response.data as Record<string, unknown>;
          if (typeof data["logs"] === "string") return data["logs"];
          if (Array.isArray(data["logs"]))
            return (data["logs"] as string[]).join("\n");
          if (typeof data["data"] === "string") return data["data"];
          return JSON.stringify(response.data, null, 2);
        }
        return String(response.data);
      }

      return `Logs unavailable (HTTP ${response.status})`;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.warn(
        `Failed to collect logs for service ${service.id}: ${message}`,
      );
      return "Logs not available — connection failed or timed out.";
    }
  }

  /**
   * Build the full URL for the logs endpoint.
   */
  buildLogsUrl(service: Service, lines = LOG_LINES): string {
    const base = service.url.replace(/\/+$/, "");
    const endpoint = service.logsEndpoint.replace(/^\/+/, "");
    const separator = endpoint.includes("?") ? "&" : "?";
    return `${base}/${endpoint}${separator}lines=${lines}`;
  }
}
