import { createHmac, timingSafeEqual } from "crypto";

/**
 * Validates an incoming HealthPanel HMAC-SHA256 signed request.
 *
 * Expected headers:
 *   x-monitor-key        — API key identifying the monitor
 *   x-monitor-timestamp   — Unix timestamp in milliseconds
 *   x-monitor-signature   — HMAC-SHA256 hex of "{timestamp}:{METHOD}:{path}"
 *
 * @returns `{ valid: true }` or `{ valid: false, error: string }`
 */
export function validateMonitorRequest(
  headers: Headers,
  method: string,
  pathname: string,
): { valid: true } | { valid: false; error: string } {
  const TIMESTAMP_WINDOW_MS = 5 * 60 * 1000; // 5 minutes

  const apiKey = headers.get("x-monitor-key");
  const timestamp = headers.get("x-monitor-timestamp");
  const signature = headers.get("x-monitor-signature");

  // 1. Check required headers
  if (!apiKey || !timestamp || !signature) {
    return { valid: false, error: "Missing monitor authentication headers" };
  }

  const expectedApiKey = process.env["MONITOR_API_KEY"];
  const secret = process.env["MONITOR_SECRET"];

  if (!expectedApiKey || !secret) {
    return {
      valid: false,
      error: "Monitor credentials not configured on this service",
    };
  }

  // 2. Verify API key
  if (apiKey !== expectedApiKey) {
    return { valid: false, error: "Invalid monitor API key" };
  }

  // 3. Verify timestamp window (prevent replay attacks)
  const ts = parseInt(timestamp, 10);
  const now = Date.now();

  if (isNaN(ts) || Math.abs(now - ts) > TIMESTAMP_WINDOW_MS) {
    return {
      valid: false,
      error: "Request timestamp expired or invalid (5 min window)",
    };
  }

  // 4. Recalculate the HMAC signature
  const payload = `${timestamp}:${method.toUpperCase()}:${pathname}`;
  const expected = createHmac("sha256", secret).update(payload).digest("hex");

  // 5. Timing-safe comparison
  try {
    const sigBuffer = Buffer.from(signature, "hex");
    const expectedBuffer = Buffer.from(expected, "hex");

    if (
      sigBuffer.length !== expectedBuffer.length ||
      !timingSafeEqual(sigBuffer, expectedBuffer)
    ) {
      return { valid: false, error: "Invalid monitor signature" };
    }
  } catch {
    return { valid: false, error: "Invalid monitor signature format" };
  }

  return { valid: true };
}
