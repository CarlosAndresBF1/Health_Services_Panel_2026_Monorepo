import { Controller, Get, Query, UseGuards } from "@nestjs/common";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import { MonitorGuard } from "./monitor.guard";

interface LogsResponse {
  logs: string[];
  total: number;
}

/**
 * Logs endpoint for HealthPanel monitoring.
 *
 * GET /logs?lines=100 — Returns the last N lines from the application log file.
 * Protected by MonitorGuard (HMAC-SHA256 authentication).
 *
 * Configure the log file path via the MONITOR_LOG_FILE env var.
 * Defaults to `logs/app.log` relative to the project root.
 *
 * Supports log rotation:
 * - Set MONITOR_LOG_FILE to a pattern like "logs/app-*.log" (finds latest)
 * - Set MONITOR_LOG_ROTATION=daily for auto-detection of YYYY-MM-DD patterns
 */
@Controller()
@UseGuards(MonitorGuard)
export class LogsController {
  private static readonly DEFAULT_LINES = 100;
  private static readonly MAX_LINES = 500;

  @Get("logs")
  getLogs(@Query("lines") linesParam?: string): LogsResponse {
    let lines = LogsController.DEFAULT_LINES;

    if (linesParam) {
      const parsed = parseInt(linesParam, 10);
      if (!isNaN(parsed) && parsed > 0) {
        lines = Math.min(parsed, LogsController.MAX_LINES);
      }
    }

    const logFilePath = this.resolveLogPath();
    const logLines = this.readLastLines(logFilePath, lines);

    return {
      logs: logLines,
      total: logLines.length,
    };
  }

  /**
   * Resolve the log file path.
   * Supports:
   * - Static file: logs/app.log
   * - Pattern with wildcard: logs/app-*.log (finds latest by mtime)
   * - Auto-detection with MONITOR_LOG_ROTATION=daily
   */
  private resolveLogPath(): string {
    const envPath = process.env["MONITOR_LOG_FILE"];
    const rotation = process.env["MONITOR_LOG_ROTATION"];

    // Auto-detect daily rotation
    if (rotation === "daily") {
      return this.findLatestDailyLog();
    }

    if (envPath) {
      // Check if it's a glob pattern
      if (envPath.includes("*")) {
        return this.findLatestLogByPattern(envPath);
      }

      return path.isAbsolute(envPath)
        ? envPath
        : path.resolve(process.cwd(), envPath);
    }

    // Check if default exists, otherwise try to find rotated logs
    const defaultPath = path.resolve(process.cwd(), "logs", "app.log");
    if (fs.existsSync(defaultPath)) {
      return defaultPath;
    }

    // Fallback: try to find daily rotated log
    return this.findLatestDailyLog();
  }

  /**
   * Find the latest daily rotated log file (app-YYYY-MM-DD.log format).
   */
  private findLatestDailyLog(): string {
    const logsDir = path.resolve(process.cwd(), "logs");
    const pattern = path.join(logsDir, "app-*.log");
    return this.findLatestLogByPattern(pattern);
  }

  /**
   * Find the latest log file matching a glob pattern.
   * Returns the most recently modified file.
   */
  private findLatestLogByPattern(pattern: string): string {
    // Resolve relative patterns
    const resolvedPattern = path.isAbsolute(pattern)
      ? pattern
      : path.resolve(process.cwd(), pattern);

    try {
      const dir = path.dirname(resolvedPattern);
      const filePattern = path.basename(resolvedPattern);

      if (!fs.existsSync(dir)) {
        return resolvedPattern;
      }

      // Convert glob pattern to regex
      const regexPattern = filePattern
        .replace(/\./g, "\\.")
        .replace(/\*/g, ".*");
      const regex = new RegExp(`^${regexPattern}$`);

      const files = fs
        .readdirSync(dir)
        .filter((file) => regex.test(file))
        .map((file) => path.join(dir, file));

      if (files.length === 0) {
        return resolvedPattern; // Return pattern for error message
      }

      // Sort by modification time (newest first)
      const sorted = files
        .map((file) => ({
          file,
          mtime: fs.statSync(file).mtimeMs,
        }))
        .sort((a, b) => b.mtime - a.mtime);

      return sorted[0].file;
    } catch (error) {
      return resolvedPattern;
    }
  }

  private readLastLines(filePath: string, count: number): string[] {
    try {
      if (!fs.existsSync(filePath)) {
        return [`[HealthPanel] Log file not found: ${filePath}`];
      }

      const content = fs.readFileSync(filePath, "utf-8");
      const allLines = content.split("\n").filter((line) => line.length > 0);

      return allLines.slice(-count);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return [`[HealthPanel] Error reading logs: ${message}`];
    }
  }
}
