import { Injectable, Logger } from "@nestjs/common";
import { Cron } from "@nestjs/schedule";
import { InjectRepository } from "@nestjs/typeorm";
import { IsNull, Repository } from "typeorm";

import { ServiceType, HealthStatus } from "@healthpanel/shared";

import { HealthCheck } from "../../database/entities/health-check.entity";
import { Service } from "../../database/entities/service.entity";
import { ScreenshotService } from "./screenshot.service";

/**
 * Captures a daily preview screenshot of each active web service that is UP.
 * Runs once per day at 6:00 AM.
 *
 * Preview files are saved as `preview_{serviceId}.png` and overwritten each run.
 * These can be displayed in the dashboard to show the current visual state.
 */
@Injectable()
export class ScreenshotSchedulerService {
  private readonly logger = new Logger(ScreenshotSchedulerService.name);

  constructor(
    @InjectRepository(Service)
    private readonly serviceRepository: Repository<Service>,
    @InjectRepository(HealthCheck)
    private readonly healthCheckRepository: Repository<HealthCheck>,
    private readonly screenshotService: ScreenshotService,
  ) {}

  @Cron("0 6 * * *")
  async captureDaily(): Promise<void> {
    this.logger.log("Starting daily preview screenshot capture…");

    const services = await this.serviceRepository.find({
      where: {
        isActive: true,
        deletedAt: IsNull(),
        type: ServiceType.WEB_NEXTJS,
      },
    });

    if (services.length === 0) {
      this.logger.log("No active web services found, skipping");
      return;
    }

    let captured = 0;
    let skipped = 0;

    for (const service of services) {
      // Check if the service is currently UP
      const latestCheck = await this.healthCheckRepository.findOne({
        where: { serviceId: service.id },
        order: { checkedAt: "DESC" },
      });

      if (!latestCheck || latestCheck.status !== HealthStatus.UP) {
        this.logger.debug(
          `Skipping "${service.name}" — not currently UP (status: ${latestCheck?.status ?? "no checks"})`,
        );
        skipped++;
        continue;
      }

      const result = await this.screenshotService.capturePreview(
        service.url,
        service.id,
      );

      if (result) {
        captured++;
      } else {
        skipped++;
      }
    }

    this.logger.log(
      `Daily preview capture complete: ${captured} captured, ${skipped} skipped`,
    );
  }
}
