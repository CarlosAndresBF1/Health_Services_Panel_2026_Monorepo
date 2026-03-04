import * as crypto from "crypto";

import { Injectable } from "@nestjs/common";

import {
  MONITOR_HEADER_KEY,
  MONITOR_HEADER_SIGNATURE,
  MONITOR_HEADER_TIMESTAMP,
} from "@healthpanel/shared";

export interface MonitorHeaders {
  [MONITOR_HEADER_KEY]: string;
  [MONITOR_HEADER_TIMESTAMP]: string;
  [MONITOR_HEADER_SIGNATURE]: string;
}

/**
 * Signs outgoing monitor requests with HMAC-SHA256.
 *
 * Signature payload: `${timestamp}:${method}:${path}`
 * Headers added to requests:
 *   x-monitor-key: {service_api_key}
 *   x-monitor-timestamp: {unix_ms}
 *   x-monitor-signature: {hmac_hex}
 */
@Injectable()
export class HmacSignerService {
  /**
   * Generate HMAC-SHA256 signed headers for a request.
   */
  sign(
    apiKey: string,
    secret: string,
    method: string,
    path: string,
  ): MonitorHeaders {
    const timestamp = String(Date.now());
    const payload = `${timestamp}:${method.toUpperCase()}:${path}`;
    const signature = crypto
      .createHmac("sha256", secret)
      .update(payload)
      .digest("hex");

    return {
      [MONITOR_HEADER_KEY]: apiKey,
      [MONITOR_HEADER_TIMESTAMP]: timestamp,
      [MONITOR_HEADER_SIGNATURE]: signature,
    };
  }

  /**
   * Verify an incoming signed request (used in tests / external service integration).
   */
  verify(
    secret: string,
    method: string,
    path: string,
    timestamp: string,
    signature: string,
    windowMs = 5 * 60 * 1000,
  ): boolean {
    const now = Date.now();
    const ts = parseInt(timestamp, 10);

    if (isNaN(ts) || Math.abs(now - ts) > windowMs) {
      return false;
    }

    const payload = `${timestamp}:${method.toUpperCase()}:${path}`;
    const expected = crypto
      .createHmac("sha256", secret)
      .update(payload)
      .digest("hex");

    return crypto.timingSafeEqual(
      Buffer.from(signature, "hex"),
      Buffer.from(expected, "hex"),
    );
  }
}
