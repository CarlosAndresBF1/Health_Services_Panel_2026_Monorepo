import { Controller, Get, UseGuards } from "@nestjs/common";
import { execSync } from "child_process";
import * as os from "os";
import { MonitorGuard } from "./monitor.guard";

/*
 * ═══════════════════════════════════════════════════════════════════════════
 * HEALTHPANEL RESPONSE CONTRACT — DO NOT CHANGE FIELD NAMES OR TYPES
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * The HealthPanel dashboard expects EXACTLY this JSON structure from /health:
 *
 * {
 *   "status": "ok" | "error",
 *   "uptime": <number>,
 *   "timestamp": "<ISO 8601>",
 *   "disk": {
 *     "total_gb":     <number>,   ← MUST be snake_case, NOT camelCase
 *     "used_gb":      <number>,
 *     "free_gb":      <number>,
 *     "used_percent": <number>    ← 0-100, one decimal (e.g. 85.3)
 *   },
 *   "memory": {
 *     "total_mb":     <number>,   ← System RAM, NOT Node.js heap
 *     "used_mb":      <number>,   ← Use os.totalmem()/os.freemem()
 *     "free_mb":      <number>,   ← Do NOT use process.memoryUsage()
 *     "used_percent": <number>    ← 0-100, one decimal
 *   },
 *   "db": {                       ← MUST be an object, NOT a string
 *     "connected": <boolean>,     ← true/false, NOT "connected"/"disconnected"
 *     "type":      <string>       ← Optional: "postgres", "mysql", etc.
 *   }
 * }
 *
 * COMMON MISTAKES TO AVOID:
 * - Using camelCase (totalGb, usedPercent) instead of snake_case (total_gb, used_percent)
 * - Using process.memoryUsage() (Node.js heap only ~100MB) instead of os module (system RAM)
 * - Returning db as a string "connected" instead of { connected: true }
 * - Omitting the db field entirely — always include it even if { connected: false }
 *
 * ═══════════════════════════════════════════════════════════════════════════
 */

interface DiskInfo {
  total_gb: number;
  free_gb: number;
  used_gb: number;
  used_percent: number;
}

interface MemoryInfo {
  total_mb: number;
  used_mb: number;
  free_mb: number;
  used_percent: number;
}

interface HealthResponse {
  status: "ok" | "error";
  uptime: number;
  timestamp: string;
  memory: MemoryInfo;
  disk: DiskInfo;
  db: { connected: boolean; type?: string };
  nodeVersion: string;
}

/**
 * Health endpoint for HealthPanel monitoring.
 *
 * GET /health — Returns system status, uptime, disk, memory, and DB info.
 * Protected by MonitorGuard (HMAC-SHA256 authentication).
 *
 * IMPORTANT: See response contract comment at the top of this file.
 * All field names MUST use snake_case. db MUST be an object with `connected: boolean`.
 * Memory MUST report system RAM (os.totalmem), NOT Node.js heap (process.memoryUsage).
 */
@Controller()
@UseGuards(MonitorGuard)
export class HealthController {
  @Get("health")
  getHealth(): HealthResponse {
    const memory = this.getMemoryInfo();
    const disk = this.getDiskInfo();
    const db = this.getDbStatus();

    return {
      status: "ok",
      uptime: Math.floor(process.uptime()),
      timestamp: new Date().toISOString(),
      memory,
      disk,
      db,
      nodeVersion: process.version,
    };
  }

  /**
   * Override this method to check your actual database connection.
   * Example with TypeORM:
   *   constructor(private dataSource: DataSource) {}
   *   private getDbStatus() {
   *     try {
   *       return { connected: this.dataSource.isInitialized, type: this.dataSource.options.type };
   *     } catch { return { connected: false }; }
   *   }
   */
  private getDbStatus(): { connected: boolean; type?: string } {
    return { connected: false };
  }

  private getMemoryInfo(): MemoryInfo {
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

  private getDiskInfo(): DiskInfo {
    try {
      const output = execSync("df -k / | tail -1").toString().trim();
      const parts = output.split(/\s+/);
      const totalKb = parseInt(parts[1], 10);
      const usedKb = parseInt(parts[2], 10);
      const freeKb = parseInt(parts[3], 10);
      const total_gb = Math.round((totalKb / 1024 / 1024) * 100) / 100;
      const used_gb = Math.round((usedKb / 1024 / 1024) * 100) / 100;
      const free_gb = Math.round((freeKb / 1024 / 1024) * 100) / 100;
      const used_percent = Math.round((usedKb / totalKb) * 1000) / 10;
      return { total_gb, free_gb, used_gb, used_percent };
    } catch {
      return { total_gb: 0, free_gb: 0, used_gb: 0, used_percent: 0 };
    }
  }
}
