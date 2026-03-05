import { NextResponse } from "next/server";
import { execSync } from "child_process";
import * as os from "os";
import { validateMonitorRequest } from "../../lib/validate-monitor-request";

/**
 * GET /api/health — Health check endpoint for HealthPanel monitoring.
 *
 * Returns system status, uptime, disk, memory, and optional DB info.
 * Protected by HMAC-SHA256 authentication.
 *
 * To add database checks, inject your DB client (e.g. Prisma):
 *   const prisma = new PrismaClient();
 *   let dbConnected = false;
 *   try { await prisma.$queryRaw`SELECT 1`; dbConnected = true; } catch {}
 *   db: { connected: dbConnected, type: 'postgresql' }
 */
export async function GET(request: Request): Promise<NextResponse> {
  const url = new URL(request.url);
  const fullPath = url.pathname + url.search;
  const auth = validateMonitorRequest(
    request.headers,
    request.method,
    fullPath,
  );

  if (!auth.valid) {
    return NextResponse.json({ error: auth.error }, { status: 401 });
  }

  const memory = getMemoryInfo();
  const disk = getDiskInfo();

  return NextResponse.json({
    status: "ok",
    uptime: Math.floor(process.uptime()),
    timestamp: new Date().toISOString(),
    memory,
    disk,
    db: { connected: false },
    nodeVersion: process.version,
    framework: "nextjs",
  });
}

function getMemoryInfo(): {
  total_mb: number;
  used_mb: number;
  free_mb: number;
  used_percent: number;
} {
  const totalMem = os.totalmem();
  const freeMem = os.freemem();
  const usedMem = totalMem - freeMem;
  return {
    total_mb: Math.round(totalMem / 1024 / 1024),
    used_mb: Math.round(usedMem / 1024 / 1024),
    free_mb: Math.round(freeMem / 1024 / 1024),
    used_percent: Math.round((usedMem / totalMem) * 1000) / 10,
  };
}

function getDiskInfo(): {
  total_gb: number;
  free_gb: number;
  used_gb: number;
  used_percent: number;
} {
  try {
    const output = execSync("df -k / | tail -1").toString().trim();
    const parts = output.split(/\s+/);
    const totalKb = parseInt(parts[1], 10);
    const usedKb = parseInt(parts[2], 10);
    const freeKb = parseInt(parts[3], 10);
    return {
      total_gb: Math.round((totalKb / 1024 / 1024) * 100) / 100,
      used_gb: Math.round((usedKb / 1024 / 1024) * 100) / 100,
      free_gb: Math.round((freeKb / 1024 / 1024) * 100) / 100,
      used_percent: Math.round((usedKb / totalKb) * 1000) / 10,
    };
  } catch {
    return { total_gb: 0, free_gb: 0, used_gb: 0, used_percent: 0 };
  }
}
