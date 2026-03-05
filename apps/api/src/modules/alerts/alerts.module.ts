import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";

import { CommonModule } from "../../common/common.module";
import { HealthCheck } from "../../database/entities/health-check.entity";
import { Incident } from "../../database/entities/incident.entity";
import { Service } from "../../database/entities/service.entity";
import { Setting } from "../../database/entities/setting.entity";
import { AlertEventListener } from "./alert-event-listener";
import { AlertOrchestratorService } from "./alert-orchestrator.service";
import { AlertsService } from "./alerts.service";
import { LogCollectorService } from "./log-collector.service";
import { ScreenshotController } from "./screenshot.controller";
import { ScreenshotSchedulerService } from "./screenshot-scheduler.service";
import { ScreenshotService } from "./screenshot.service";
import { SettingsController } from "./settings.controller";

@Module({
  imports: [
    TypeOrmModule.forFeature([Incident, Setting, Service, HealthCheck]),
    CommonModule,
  ],
  controllers: [SettingsController, ScreenshotController],
  providers: [
    AlertsService,
    ScreenshotService,
    ScreenshotSchedulerService,
    LogCollectorService,
    AlertOrchestratorService,
    AlertEventListener,
  ],
  exports: [AlertOrchestratorService, AlertsService, ScreenshotService],
})
export class AlertsModule {}
