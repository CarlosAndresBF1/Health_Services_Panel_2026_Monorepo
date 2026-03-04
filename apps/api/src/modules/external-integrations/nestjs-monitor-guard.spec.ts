import { createHmac } from "crypto";
import { ExecutionContext, UnauthorizedException } from "@nestjs/common";
import { MonitorGuard } from "../../../../../external-integrations/nestjs/src/monitor.guard";

/**
 * Tests for the NestJS MonitorGuard (external-integrations/nestjs).
 * Validates HMAC-SHA256 authentication, replay protection, and error handling.
 */
describe("MonitorGuard (NestJS external integration)", () => {
  const TEST_API_KEY = "test-api-key-123";
  const TEST_SECRET = "super-secret-hmac-key";
  let guard: MonitorGuard;

  function makeHeaders(
    overrides: Record<string, string> = {},
  ): Record<string, string | undefined> {
    const timestamp = String(Date.now());
    const method = "GET";
    const path = "/health";
    const payload = `${timestamp}:${method}:${path}`;
    const signature = createHmac("sha256", TEST_SECRET)
      .update(payload)
      .digest("hex");

    return {
      "x-monitor-key": TEST_API_KEY,
      "x-monitor-timestamp": timestamp,
      "x-monitor-signature": signature,
      ...overrides,
    };
  }

  function mockContext(
    headers: Record<string, string | undefined>,
    method = "GET",
    url = "/health",
  ): ExecutionContext {
    return {
      switchToHttp: () => ({
        getRequest: () => ({
          headers,
          method,
          originalUrl: url,
        }),
      }),
    } as unknown as ExecutionContext;
  }

  beforeEach(() => {
    guard = new MonitorGuard();
    process.env["MONITOR_API_KEY"] = TEST_API_KEY;
    process.env["MONITOR_SECRET"] = TEST_SECRET;
  });

  afterEach(() => {
    delete process.env["MONITOR_API_KEY"];
    delete process.env["MONITOR_SECRET"];
  });

  it("should allow a correctly signed request", () => {
    const headers = makeHeaders();
    const ctx = mockContext(headers);
    expect(guard.canActivate(ctx)).toBe(true);
  });

  it("should reject when x-monitor-key header is missing", () => {
    const headers = makeHeaders();
    delete headers["x-monitor-key"];
    const ctx = mockContext(headers);
    expect(() => guard.canActivate(ctx)).toThrow(UnauthorizedException);
  });

  it("should reject when x-monitor-timestamp header is missing", () => {
    const headers = makeHeaders();
    delete headers["x-monitor-timestamp"];
    const ctx = mockContext(headers);
    expect(() => guard.canActivate(ctx)).toThrow(UnauthorizedException);
  });

  it("should reject when x-monitor-signature header is missing", () => {
    const headers = makeHeaders();
    delete headers["x-monitor-signature"];
    const ctx = mockContext(headers);
    expect(() => guard.canActivate(ctx)).toThrow(UnauthorizedException);
  });

  it("should reject an invalid API key", () => {
    const headers = makeHeaders({ "x-monitor-key": "wrong-key" });
    const ctx = mockContext(headers);
    expect(() => guard.canActivate(ctx)).toThrow(UnauthorizedException);
  });

  it("should reject an expired timestamp (older than 5 min)", () => {
    const oldTimestamp = String(Date.now() - 6 * 60 * 1000);
    const payload = `${oldTimestamp}:GET:/health`;
    const signature = createHmac("sha256", TEST_SECRET)
      .update(payload)
      .digest("hex");

    const headers = {
      "x-monitor-key": TEST_API_KEY,
      "x-monitor-timestamp": oldTimestamp,
      "x-monitor-signature": signature,
    };
    const ctx = mockContext(headers);
    expect(() => guard.canActivate(ctx)).toThrow(UnauthorizedException);
  });

  it("should reject an invalid signature", () => {
    const headers = makeHeaders({
      "x-monitor-signature": "a".repeat(64),
    });
    const ctx = mockContext(headers);
    expect(() => guard.canActivate(ctx)).toThrow(UnauthorizedException);
  });

  it("should reject a signature from a different secret", () => {
    const timestamp = String(Date.now());
    const payload = `${timestamp}:GET:/health`;
    const wrongSignature = createHmac("sha256", "wrong-secret")
      .update(payload)
      .digest("hex");

    const headers = {
      "x-monitor-key": TEST_API_KEY,
      "x-monitor-timestamp": timestamp,
      "x-monitor-signature": wrongSignature,
    };
    const ctx = mockContext(headers);
    expect(() => guard.canActivate(ctx)).toThrow(UnauthorizedException);
  });

  it("should reject when env vars are not configured", () => {
    delete process.env["MONITOR_API_KEY"];
    delete process.env["MONITOR_SECRET"];
    const headers = makeHeaders();
    const ctx = mockContext(headers);
    expect(() => guard.canActivate(ctx)).toThrow(UnauthorizedException);
  });

  it("should validate the path in the signature (prevents path tampering)", () => {
    // Sign for /health but request /logs
    const timestamp = String(Date.now());
    const payload = `${timestamp}:GET:/health`;
    const signature = createHmac("sha256", TEST_SECRET)
      .update(payload)
      .digest("hex");

    const headers = {
      "x-monitor-key": TEST_API_KEY,
      "x-monitor-timestamp": timestamp,
      "x-monitor-signature": signature,
    };
    const ctx = mockContext(headers, "GET", "/logs");
    expect(() => guard.canActivate(ctx)).toThrow(UnauthorizedException);
  });

  it("should strip query params from path for signature verification", () => {
    const timestamp = String(Date.now());
    const payload = `${timestamp}:GET:/logs`;
    const signature = createHmac("sha256", TEST_SECRET)
      .update(payload)
      .digest("hex");

    const headers = {
      "x-monitor-key": TEST_API_KEY,
      "x-monitor-timestamp": timestamp,
      "x-monitor-signature": signature,
    };
    // URL has query params, but signature is for /logs (no query)
    const ctx = mockContext(headers, "GET", "/logs?lines=100");
    expect(guard.canActivate(ctx)).toBe(true);
  });

  it("should reject a malformed signature (non-hex)", () => {
    const headers = makeHeaders({
      "x-monitor-signature": "not-a-valid-hex-signature!!!",
    });
    const ctx = mockContext(headers);
    expect(() => guard.canActivate(ctx)).toThrow(UnauthorizedException);
  });
});
