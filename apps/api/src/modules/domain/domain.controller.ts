import {
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Post,
  UseGuards,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { IsNull, Repository } from "typeorm";

import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { Service } from "../../database/entities/service.entity";
import { DomainCheckerService } from "./domain-checker.service";

@Controller("api")
@UseGuards(JwtAuthGuard)
export class DomainController {
  constructor(
    @InjectRepository(Service)
    private readonly serviceRepository: Repository<Service>,
    private readonly domainCheckerService: DomainCheckerService,
  ) {}

  /**
   * GET /api/services/:id/domain-check
   * Returns the latest domain expiry check result for a service.
   */
  @Get("services/:id/domain-check")
  async getLatest(@Param("id", ParseIntPipe) id: number) {
    return this.domainCheckerService.getLatestForService(id);
  }

  /**
   * POST /api/services/:id/domain-check
   * Trigger a manual domain expiry check for a service.
   */
  @Post("services/:id/domain-check")
  async triggerCheck(@Param("id", ParseIntPipe) id: number) {
    const service = await this.serviceRepository.findOneOrFail({
      where: { id, deletedAt: IsNull() },
    });
    return this.domainCheckerService.checkService(service);
  }
}
