import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";

import { DomainCheck } from "../../database/entities/domain-check.entity";
import { Service } from "../../database/entities/service.entity";
import { Setting } from "../../database/entities/setting.entity";
import { HealthCheckerModule } from "../health-checker/health-checker.module";
import { DomainCheckerService } from "./domain-checker.service";
import { DomainController } from "./domain.controller";
import { DomainSchedulerService } from "./domain-scheduler.service";

@Module({
  imports: [
    TypeOrmModule.forFeature([DomainCheck, Service, Setting]),
    HealthCheckerModule,
  ],
  controllers: [DomainController],
  providers: [DomainCheckerService, DomainSchedulerService],
  exports: [DomainCheckerService],
})
export class DomainModule {}
