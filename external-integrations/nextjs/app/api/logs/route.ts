import { NextResponse } from "next/server";
import { readFileSync, existsSync } from "fs";
import { resolve, isAbsolute } from "path";
import { validateMonitorRequest } from "../../lib/validate-monitor-request";

const DEFAULT_LINES = 100;
const MAX_LINES = 500;

/**
 * GET /api/logs?lines=100 — Logs endpoint for HealthPanel monitoring.
 *
 * Returns the last N lines from the application log file.
 * Protected by HMAC-SHA256 authentication.
 *
 * Configure the log file path via the MONITOR_LOG_FILE env var.
 * Defaults to logs/app.log relative to the project root.
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

  // Parse lines parameter
  let lines = DEFAULT_LINES;
  const linesParam = url.searchParams.get("lines");

  if (linesParam) {
    const parsed = parseInt(linesParam, 10);
    if (!isNaN(parsed) && parsed > 0) {
      lines = Math.min(parsed, MAX_LINES);
    }
  }

  // Resolve log file path
  const logPath = resolveLogPath();
  const logLines = readLastLines(logPath, lines);

  return NextResponse.json({
    logs: logLines,
    total: logLines.length,
  });
}

function resolveLogPath(): string {
  const envPath = process.env["MONITOR_LOG_FILE"];

  if (envPath) {
    return isAbsolute(envPath) ? envPath : resolve(process.cwd(), envPath);
  }

  return resolve(process.cwd(), "logs", "app.log");
}

function readLastLines(filePath: string, count: number): string[] {
  try {
    if (!existsSync(filePath)) {
      return [`[HealthPanel] Log file not found: ${filePath}`];
    }

    const content = readFileSync(filePath, "utf-8");
    const allLines = content.split("\n").filter((line) => line.length > 0);

    return allLines.slice(-count);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return [`[HealthPanel] Error reading logs: ${message}`];
  }
}
