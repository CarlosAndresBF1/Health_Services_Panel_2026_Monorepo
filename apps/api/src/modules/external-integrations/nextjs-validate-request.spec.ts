import { createHmac } from "crypto";
import { validateMonitorRequest } from "../../../../../external-integrations/nextjs/lib/validate-monitor-request";

/**
 * Tests for the Next.js validateMonitorRequest helper (external-integrations/nextjs).
 * Validates HMAC-SHA256 authentication, replay protection, and error handling.
 */
describe("validateMonitorRequest (Next.js external integration)", () => {
  const TEST_API_KEY = "nextjs-api-key-456";
  const TEST_SECRET = "nextjs-hmac-secret";

  function makeHeaders(overrides: Record<string, string> = {}): Headers {
    const timestamp = String(Date.now());
    const method = "GET";
    const path = "/api/health";
    const payload = `${timestamp}:${method}:${path}`;
    const signature = createHmac("sha256", TEST_SECRET)
      .update(payload)
      .digest("hex");

    const h = new Headers();
    h.set("x-monitor-key", overrides["x-monitor-key"] ?? TEST_API_KEY);
    h.set("x-monitor-timestamp", overrides["x-monitor-timestamp"] ?? timestamp);
    h.set("x-monitor-signature", overrides["x-monitor-signature"] ?? signature);

    // Handle deletions
    if ("x-monitor-key" in overrides && overrides["x-monitor-key"] === "") {
      h.delete("x-monitor-key");
    }
    if (
      "x-monitor-timestamp" in overrides &&
      overrides["x-monitor-timestamp"] === ""
    ) {
      h.delete("x-monitor-timestamp");
    }
    if (
      "x-monitor-signature" in overrides &&
      overrides["x-monitor-signature"] === ""
    ) {
      h.delete("x-monitor-signature");
    }

    return h;
  }

  beforeEach(() => {
    process.env["MONITOR_API_KEY"] = TEST_API_KEY;
    process.env["MONITOR_SECRET"] = TEST_SECRET;
  });

  afterEach(() => {
    delete process.env["MONITOR_API_KEY"];
    delete process.env["MONITOR_SECRET"];
  });

  it("should accept a correctly signed request", () => {
    const headers = makeHeaders();
    const result = validateMonitorRequest(headers, "GET", "/api/health");
    expect(result).toEqual({ valid: true });
  });

  it("should reject when headers are missing", () => {
    const headers = new Headers();
    const result = validateMonitorRequest(headers, "GET", "/api/health");
    expect(result).toEqual({
      valid: false,
      error: "Missing monitor authentication headers",
    });
  });

  it("should reject an invalid API key", () => {
    const headers = makeHeaders({ "x-monitor-key": "wrong-key" });
    const result = validateMonitorRequest(headers, "GET", "/api/health");
    expect(result).toEqual({
      valid: false,
      error: "Invalid monitor API key",
    });
  });

  it("should reject an expired timestamp (replay attack)", () => {
    const oldTimestamp = String(Date.now() - 6 * 60 * 1000);
    const payload = `${oldTimestamp}:GET:/api/health`;
    const signature = createHmac("sha256", TEST_SECRET)
      .update(payload)
      .digest("hex");

    const headers = new Headers();
    headers.set("x-monitor-key", TEST_API_KEY);
    headers.set("x-monitor-timestamp", oldTimestamp);
    headers.set("x-monitor-signature", signature);

    const result = validateMonitorRequest(headers, "GET", "/api/health");
    expect(result).toEqual({
      valid: false,
      error: "Request timestamp expired or invalid (5 min window)",
    });
  });

  it("should reject an invalid signature", () => {
    const headers = makeHeaders({ "x-monitor-signature": "a".repeat(64) });
    const result = validateMonitorRequest(headers, "GET", "/api/health");
    expect(result).toEqual({
      valid: false,
      error: "Invalid monitor signature",
    });
  });

  it("should reject when env vars are not configured", () => {
    delete process.env["MONITOR_API_KEY"];
    delete process.env["MONITOR_SECRET"];
    const headers = makeHeaders();
    const result = validateMonitorRequest(headers, "GET", "/api/health");
    expect(result).toEqual({
      valid: false,
      error: "Monitor credentials not configured on this service",
    });
  });

  it("should reject path tampering (signed for /api/health, requested /api/logs)", () => {
    const timestamp = String(Date.now());
    const payload = `${timestamp}:GET:/api/health`;
    const signature = createHmac("sha256", TEST_SECRET)
      .update(payload)
      .digest("hex");

    const headers = new Headers();
    headers.set("x-monitor-key", TEST_API_KEY);
    headers.set("x-monitor-timestamp", timestamp);
    headers.set("x-monitor-signature", signature);

    const result = validateMonitorRequest(headers, "GET", "/api/logs");
    expect(result).toEqual({
      valid: false,
      error: "Invalid monitor signature",
    });
  });

  it("should be consistent with HmacSignerService from the main API", () => {
    // This test verifies the external integration is compatible with the
    // signing logic used by HealthPanel API (HmacSignerService).
    const timestamp = String(Date.now());
    const method = "GET";
    const path = "/api/health";

    // Replicate what HmacSignerService.sign() does
    const payload = `${timestamp}:${method.toUpperCase()}:${path}`;
    const signature = createHmac("sha256", TEST_SECRET)
      .update(payload)
      .digest("hex");

    const headers = new Headers();
    headers.set("x-monitor-key", TEST_API_KEY);
    headers.set("x-monitor-timestamp", timestamp);
    headers.set("x-monitor-signature", signature);

    const result = validateMonitorRequest(headers, method, path);
    expect(result).toEqual({ valid: true });
  });
});
