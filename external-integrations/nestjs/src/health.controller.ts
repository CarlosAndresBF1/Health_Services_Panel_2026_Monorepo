import { Controller, Get, UseGuards } from "@nestjs/common";
import { execSync } from "child_process";
import * as os from "os";
import { MonitorGuard } from "./monitor.guard";

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
 * GET /health — Returns system status, uptime, and memory info.
 * Protected by MonitorGuard (HMAC-SHA256 authentication).
 *
 * To add database connectivity checks, inject your DB connection
 * and extend the response (see README).
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
