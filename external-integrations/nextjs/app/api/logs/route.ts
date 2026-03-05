import { NextResponse } from "next/server";
import { readFileSync, existsSync, statSync, readdirSync } from "fs";
import { resolve, isAbsolute, join, dirname, basename } from "path";
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
 *
 * Supports log rotation:
 * - Set MONITOR_LOG_FILE to a pattern like "logs/app-*.log" (finds latest)
 * - Set MONITOR_LOG_ROTATION=daily for auto-detection of YYYY-MM-DD patterns
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

/**
 * Resolve the log file path.
 * Supports:
 * - Static file: logs/app.log
 * - Pattern with wildcard: logs/app-*.log (finds latest by mtime)
 * - Auto-detection with MONITOR_LOG_ROTATION=daily
 */
function resolveLogPath(): string {
  const envPath = process.env["MONITOR_LOG_FILE"];
  const rotation = process.env["MONITOR_LOG_ROTATION"];

  // Auto-detect daily rotation
  if (rotation === "daily") {
    return findLatestDailyLog();
  }

  if (envPath) {
    // Check if it's a glob pattern
    if (envPath.includes("*")) {
      return findLatestLogByPattern(envPath);
    }

    return isAbsolute(envPath) ? envPath : resolve(process.cwd(), envPath);
  }

  // Check if default exists, otherwise try to find rotated logs
  const defaultPath = resolve(process.cwd(), "logs", "app.log");
  if (existsSync(defaultPath)) {
    return defaultPath;
  }

  // Fallback: try to find daily rotated log
  return findLatestDailyLog();
}

/**
 * Find the latest daily rotated log file (app-YYYY-MM-DD.log format).
 */
function findLatestDailyLog(): string {
  const logsDir = resolve(process.cwd(), "logs");
  const pattern = join(logsDir, "app-*.log");
  return findLatestLogByPattern(pattern);
}

/**
 * Find the latest log file matching a glob pattern (simple implementation).
 * Returns the most recently modified file.
 */
function findLatestLogByPattern(pattern: string): string {
  // Resolve relative patterns
  const resolvedPattern = isAbsolute(pattern)
    ? pattern
    : resolve(process.cwd(), pattern);

  try {
    const dir = dirname(resolvedPattern);
    const filePattern = basename(resolvedPattern);

    if (!existsSync(dir)) {
      return resolvedPattern;
    }

    // Convert glob pattern to regex
    const regexPattern = filePattern.replace(/\./g, "\\.").replace(/\*/g, ".*");
    const regex = new RegExp(`^${regexPattern}$`);

    const files = readdirSync(dir)
      .filter((file) => regex.test(file))
      .map((file) => join(dir, file));

    if (files.length === 0) {
      return resolvedPattern;
    }

    // Sort by modification time (newest first)
    const sorted = files
      .map((file) => ({
        file,
        mtime: statSync(file).mtimeMs,
      }))
      .sort((a, b) => b.mtime - a.mtime);

    return sorted[0].file;
  } catch (error) {
    return resolvedPattern;
  }
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
