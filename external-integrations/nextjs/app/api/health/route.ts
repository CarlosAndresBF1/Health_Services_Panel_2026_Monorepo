import { NextResponse } from "next/server";
import { validateMonitorRequest } from "../../lib/validate-monitor-request";

/**
 * GET /api/health — Health check endpoint for HealthPanel monitoring.
 *
 * Returns system status, uptime, and memory information.
 * Protected by HMAC-SHA256 authentication.
 */
export async function GET(request: Request): Promise<NextResponse> {
  const url = new URL(request.url);
  const auth = validateMonitorRequest(
    request.headers,
    request.method,
    url.pathname,
  );

  if (!auth.valid) {
    return NextResponse.json({ error: auth.error }, { status: 401 });
  }

  const mem = process.memoryUsage();

  return NextResponse.json({
    status: "ok",
    uptime: Math.floor(process.uptime()),
    timestamp: new Date().toISOString(),
    memory: {
      rss: Math.round(mem.rss / 1024 / 1024),
      heapUsed: Math.round(mem.heapUsed / 1024 / 1024),
      heapTotal: Math.round(mem.heapTotal / 1024 / 1024),
    },
    nodeVersion: process.version,
    framework: "nextjs",
  });
}
