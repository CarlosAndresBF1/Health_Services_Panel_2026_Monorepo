import {
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Query,
  UseGuards,
} from "@nestjs/common";

import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { LogsService } from "./logs.service";

@Controller("api/services")
@UseGuards(JwtAuthGuard)
export class LogsController {
  constructor(private readonly logsService: LogsService) {}

  /**
   * GET /api/services/:id/logs?lines=100
   * Proxy logs from the monitored service's endpoint.
   */
  @Get(":id/logs")
  async getLogs(
    @Param("id", ParseIntPipe) id: number,
    @Query("lines") linesParam?: string,
  ): Promise<{ logs: string; serviceId: number; lines: number }> {
    const lines = Math.min(
      500,
      Math.max(1, parseInt(linesParam ?? "100", 10) || 100),
    );

    const logs = await this.logsService.fetchLogs(id, lines);

    return { logs, serviceId: id, lines };
  }
}
