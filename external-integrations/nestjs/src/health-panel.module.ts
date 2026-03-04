import { Module } from "@nestjs/common";
import { HealthController } from "./health.controller";
import { LogsController } from "./logs.controller";
import { MonitorGuard } from "./monitor.guard";

/**
 * HealthPanel Monitor Module
 *
 * Import this module into your NestJS application to expose
 * /health and /logs endpoints for HealthPanel monitoring.
 *
 * Required env vars:
 *   MONITOR_API_KEY  — API key from HealthPanel service registration
 *   MONITOR_SECRET   — HMAC secret from HealthPanel service registration
 *
 * Optional env vars:
 *   MONITOR_LOG_FILE — Path to log file (default: logs/app.log)
 *
 * Usage:
 *   @Module({
 *     imports: [HealthPanelModule],
 *     // ...
 *   })
 *   export class AppModule {}
 */
@Module({
  controllers: [HealthController, LogsController],
  providers: [MonitorGuard],
  exports: [MonitorGuard],
})
export class HealthPanelModule {}
