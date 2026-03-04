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

  private resolveLogPath(): string {
    // Allow overriding with env var
    const envPath = process.env["MONITOR_LOG_FILE"];
    if (envPath) {
      return path.isAbsolute(envPath)
        ? envPath
        : path.resolve(process.cwd(), envPath);
    }

    // Default: logs/app.log relative to project root
    return path.resolve(process.cwd(), "logs", "app.log");
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
