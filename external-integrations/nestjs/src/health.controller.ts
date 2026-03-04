import { Controller, Get, UseGuards } from "@nestjs/common";
import * as os from "os";
import { MonitorGuard } from "./monitor.guard";

interface HealthResponse {
  status: "ok" | "error";
  uptime: number;
  timestamp: string;
  memory: {
    rss: number;
    heapUsed: number;
    heapTotal: number;
  };
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

    return {
      status: "ok",
      uptime: Math.floor(process.uptime()),
      timestamp: new Date().toISOString(),
      memory: {
        rss: Math.round(mem.rss / 1024 / 1024),
        heapUsed: Math.round(mem.heapUsed / 1024 / 1024),
        heapTotal: Math.round(mem.heapTotal / 1024 / 1024),
      },
      nodeVersion: process.version,
    };
  }
}
