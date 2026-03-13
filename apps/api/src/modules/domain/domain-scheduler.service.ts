import { Injectable, Logger } from "@nestjs/common";
import { Cron } from "@nestjs/schedule";
import { InjectRepository } from "@nestjs/typeorm";
import { IsNull, Repository } from "typeorm";

import { Service } from "../../database/entities/service.entity";
import { DomainCheckerService } from "./domain-checker.service";

/**
 * Runs a WHOIS domain expiry check for all active services once per day at 8:00 AM.
 * Results are stored in domain_checks and warnings are emitted via WebSocket/email.
 */
@Injectable()
export class DomainSchedulerService {
  private readonly logger = new Logger(DomainSchedulerService.name);

  constructor(
    @InjectRepository(Service)
    private readonly serviceRepository: Repository<Service>,
    private readonly domainCheckerService: DomainCheckerService,
  ) {}

  @Cron("0 8 * * *")
  async checkAll(): Promise<{ checked: number; errors: number }> {
    this.logger.log("Starting daily domain expiry check…");

    const services = await this.serviceRepository.find({
      where: { isActive: true, deletedAt: IsNull() },
    });

    if (services.length === 0) {
      this.logger.log("No active services to check");
      return { checked: 0, errors: 0 };
    }

    let checked = 0;
    let errors = 0;

    for (const service of services) {
      try {
        await this.domainCheckerService.checkService(service);
        checked++;
      } catch (error) {
        this.logger.error(
          `Domain check failed for "${service.name}": ${error instanceof Error ? error.message : String(error)}`,
        );
        errors++;
      }
    }

    this.logger.log(
      `Domain check complete: ${checked} checked, ${errors} errors`,
    );
    return { checked, errors };
  }
}
