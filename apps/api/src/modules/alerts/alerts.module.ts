import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";

import { CommonModule } from "../../common/common.module";
import { Incident } from "../../database/entities/incident.entity";
import { Setting } from "../../database/entities/setting.entity";
import { AlertEventListener } from "./alert-event-listener";
import { AlertOrchestratorService } from "./alert-orchestrator.service";
import { AlertsService } from "./alerts.service";
import { LogCollectorService } from "./log-collector.service";
import { ScreenshotService } from "./screenshot.service";
import { SettingsController } from "./settings.controller";

@Module({
  imports: [TypeOrmModule.forFeature([Incident, Setting]), CommonModule],
  controllers: [SettingsController],
  providers: [
    AlertsService,
    ScreenshotService,
    LogCollectorService,
    AlertOrchestratorService,
    AlertEventListener,
  ],
  exports: [AlertOrchestratorService, AlertsService],
})
export class AlertsModule {}
