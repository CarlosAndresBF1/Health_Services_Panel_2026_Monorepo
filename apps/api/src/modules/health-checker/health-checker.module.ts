import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";

import { CommonModule } from "../../common/common.module";
import { HealthCheck } from "../../database/entities/health-check.entity";
import { Incident } from "../../database/entities/incident.entity";
import { Service } from "../../database/entities/service.entity";
import { CleanupService } from "./cleanup.service";
import { HealthCheckerController } from "./health-checker.controller";
import { HealthCheckerService } from "./health-checker.service";
import { IncidentService } from "./incident.service";
import { MonitorGateway } from "./monitor.gateway";

@Module({
  imports: [
    TypeOrmModule.forFeature([Service, HealthCheck, Incident]),
    CommonModule,
  ],
  controllers: [HealthCheckerController],
  providers: [
    HealthCheckerService,
    IncidentService,
    MonitorGateway,
    CleanupService,
  ],
  exports: [HealthCheckerService, IncidentService, MonitorGateway],
})
export class HealthCheckerModule {}
