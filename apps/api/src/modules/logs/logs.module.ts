import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";

import { CommonModule } from "../../common/common.module";
import { Service } from "../../database/entities/service.entity";
import { LogsController } from "./logs.controller";
import { LogsService } from "./logs.service";

@Module({
  imports: [TypeOrmModule.forFeature([Service]), CommonModule],
  controllers: [LogsController],
  providers: [LogsService],
  exports: [LogsService],
})
export class LogsModule {}
