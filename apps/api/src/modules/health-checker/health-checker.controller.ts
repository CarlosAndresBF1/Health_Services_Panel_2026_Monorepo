import {
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Query,
  UseGuards,
} from "@nestjs/common";

import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { HealthCheckerService } from "./health-checker.service";
import { IncidentService } from "./incident.service";

@Controller("api")
@UseGuards(JwtAuthGuard)
export class HealthCheckerController {
  constructor(
    private readonly healthCheckerService: HealthCheckerService,
    private readonly incidentService: IncidentService,
  ) {}

  /**
   * POST /api/services/:id/check
   * Execute an immediate health check for a service.
   */
  @Post("services/:id/check")
  async manualCheck(@Param("id", ParseIntPipe) id: number) {
    const result = await this.healthCheckerService.executeCheck(id);
    return result;
  }

  /**
   * GET /api/services/:id/health-checks
   * Get paginated health check history for a service.
   */
  @Get("services/:id/health-checks")
  async getHealthChecks(
    @Param("id", ParseIntPipe) id: number,
    @Query("page") page?: string,
    @Query("limit") limit?: string,
  ) {
    const p = Math.max(1, parseInt(page ?? "1", 10) || 1);
    const l = Math.min(100, Math.max(1, parseInt(limit ?? "20", 10) || 20));

    const { data, total } = await this.healthCheckerService.getHistory(
      id,
      p,
      l,
    );
    return { data, total, page: p, limit: l };
  }

  /**
   * GET /api/services/:id/incidents
   * Get paginated incident history for a service.
   */
  @Get("services/:id/incidents")
  async getIncidents(
    @Param("id", ParseIntPipe) id: number,
    @Query("page") page?: string,
    @Query("limit") limit?: string,
  ) {
    const p = Math.max(1, parseInt(page ?? "1", 10) || 1);
    const l = Math.min(100, Math.max(1, parseInt(limit ?? "20", 10) || 20));

    const { data, total } = await this.incidentService.findByService(id, p, l);
    return { data, total, page: p, limit: l };
  }
}
