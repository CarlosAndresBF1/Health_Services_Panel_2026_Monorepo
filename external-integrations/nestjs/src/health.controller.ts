import { Controller, Get, UseGuards } from "@nestjs/common";
import { execSync } from "child_process";
import { MonitorGuard } from "./monitor.guard";

interface DiskInfo {
  totalGb: number;
  freeGb: number;
  usedGb: number;
  usedPercent: number;
}

interface HealthResponse {
  status: "ok" | "error";
  uptime: number;
  timestamp: string;
  memory: {
    rss: number;
    heapUsed: number;
    heapTotal: number;
  };
  disk: DiskInfo;
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
    const mem = process.memoryUsage();
    const disk = this.getDiskInfo();

    return {
      status: "ok",
      uptime: Math.floor(process.uptime()),
      timestamp: new Date().toISOString(),
      memory: {
        rss: Math.round(mem.rss / 1024 / 1024),
        heapUsed: Math.round(mem.heapUsed / 1024 / 1024),
        heapTotal: Math.round(mem.heapTotal / 1024 / 1024),
      },
      disk,
      nodeVersion: process.version,
    };
  }

  private getDiskInfo(): DiskInfo {
    try {
      const output = execSync("df -k / | tail -1").toString().trim();
      const parts = output.split(/\s+/);
      const totalKb = parseInt(parts[1], 10);
      const usedKb = parseInt(parts[2], 10);
      const freeKb = parseInt(parts[3], 10);
      const totalGb = Math.round((totalKb / 1024 / 1024) * 100) / 100;
      const usedGb = Math.round((usedKb / 1024 / 1024) * 100) / 100;
      const freeGb = Math.round((freeKb / 1024 / 1024) * 100) / 100;
      const usedPercent = Math.round((usedKb / totalKb) * 1000) / 10;
      return { totalGb, freeGb, usedGb, usedPercent };
    } catch {
      return { totalGb: 0, freeGb: 0, usedGb: 0, usedPercent: 0 };
    }
  }
}
