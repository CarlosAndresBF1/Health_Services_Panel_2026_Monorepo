import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
import { createHmac, timingSafeEqual } from "crypto";
import { Request } from "express";

/**
 * Guard that validates incoming HealthPanel HMAC-SHA256 signed requests.
 *
 * Expected headers:
 *   x-monitor-key       — the API key identifying the monitor
 *   x-monitor-timestamp  — Unix timestamp in ms
 *   x-monitor-signature  — HMAC-SHA256 hex of `${timestamp}:${METHOD}:${path}`
 *
 * Env vars required:
 *   MONITOR_API_KEY   — the expected API key
 *   MONITOR_SECRET    — the shared HMAC secret
 */
@Injectable()
export class MonitorGuard implements CanActivate {
  private static readonly TIMESTAMP_WINDOW_MS = 5 * 60 * 1000; // 5 minutes

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();

    const apiKey = request.headers["x-monitor-key"] as string | undefined;
    const timestamp = request.headers["x-monitor-timestamp"] as
      | string
      | undefined;
    const signature = request.headers["x-monitor-signature"] as
      | string
      | undefined;

    if (!apiKey || !timestamp || !signature) {
      throw new UnauthorizedException("Missing monitor authentication headers");
    }

    const expectedApiKey = process.env["MONITOR_API_KEY"];
    const secret = process.env["MONITOR_SECRET"];

    if (!expectedApiKey || !secret) {
      throw new UnauthorizedException(
        "Monitor credentials not configured on this service",
      );
    }

    // 1. Verify API key matches
    if (apiKey !== expectedApiKey) {
      throw new UnauthorizedException("Invalid monitor API key");
    }

    // 2. Verify timestamp is within the allowed window (prevent replay attacks)
    const ts = parseInt(timestamp, 10);
    const now = Date.now();

    if (isNaN(ts) || Math.abs(now - ts) > MonitorGuard.TIMESTAMP_WINDOW_MS) {
      throw new UnauthorizedException(
        "Request timestamp expired or invalid (5 min window)",
      );
    }

    // 3. Recalculate the HMAC signature
    const method = request.method.toUpperCase();
    const path = request.originalUrl ?? "/";
    const payload = `${timestamp}:${method}:${path}`;

    const expected = createHmac("sha256", secret).update(payload).digest("hex");

    // 4. Timing-safe comparison
    try {
      const sigBuffer = Buffer.from(signature, "hex");
      const expectedBuffer = Buffer.from(expected, "hex");

      if (
        sigBuffer.length !== expectedBuffer.length ||
        !timingSafeEqual(sigBuffer, expectedBuffer)
      ) {
        throw new UnauthorizedException("Invalid monitor signature");
      }
    } catch (error) {
      if (error instanceof UnauthorizedException) {
        throw error;
      }
      throw new UnauthorizedException("Invalid monitor signature format");
    }

    return true;
  }
}
