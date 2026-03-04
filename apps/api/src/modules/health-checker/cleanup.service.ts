import { Injectable, Logger } from "@nestjs/common";
import { Cron, CronExpression } from "@nestjs/schedule";
import { InjectRepository } from "@nestjs/typeorm";
import { LessThan, Repository } from "typeorm";
import * as fs from "fs";
import * as path from "path";

import { HealthCheck } from "../../database/entities/health-check.entity";

const RETENTION_DAYS = 30;
const SCREENSHOTS_DIR = path.resolve(process.cwd(), "screenshots");

/**
 * Automatically cleans up old data to prevent unbounded DB/disk growth:
 *   - health_checks older than 30 days
 *   - screenshots older than 30 days
 *
 * Runs daily at 3:00 AM.
 */
@Injectable()
export class CleanupService {
  private readonly logger = new Logger(CleanupService.name);

  constructor(
    @InjectRepository(HealthCheck)
    private readonly healthCheckRepository: Repository<HealthCheck>,
  ) {}

  @Cron(CronExpression.EVERY_DAY_AT_3AM)
  async handleCleanup(): Promise<void> {
    this.logger.log("Starting scheduled data cleanup…");

    const [deletedChecks, deletedScreenshots] = await Promise.all([
      this.cleanupOldHealthChecks(),
      this.cleanupOldScreenshots(),
    ]);

    this.logger.log(
      `Cleanup complete: ${deletedChecks} health check(s), ${deletedScreenshots} screenshot(s) removed`,
    );
  }

  /**
   * Delete health_checks older than RETENTION_DAYS.
   * Uses batched deletes to avoid locking the table for too long.
   */
  async cleanupOldHealthChecks(): Promise<number> {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - RETENTION_DAYS);

    try {
      const result = await this.healthCheckRepository.delete({
        checkedAt: LessThan(cutoff),
      });

      const deleted = result.affected ?? 0;
      if (deleted > 0) {
        this.logger.log(
          `Deleted ${deleted} health check(s) older than ${RETENTION_DAYS} days`,
        );
      }

      return deleted;
    } catch (error) {
      this.logger.error(
        `Failed to cleanup old health checks: ${error instanceof Error ? error.message : String(error)}`,
      );
      return 0;
    }
  }

  /**
   * Delete screenshot files older than RETENTION_DAYS.
   */
  async cleanupOldScreenshots(): Promise<number> {
    try {
      if (!fs.existsSync(SCREENSHOTS_DIR)) {
        return 0;
      }

      const cutoff = Date.now() - RETENTION_DAYS * 24 * 60 * 60 * 1000;
      const files = fs.readdirSync(SCREENSHOTS_DIR);
      let deleted = 0;

      for (const file of files) {
        if (!file.endsWith(".png")) continue;

        const filePath = path.join(SCREENSHOTS_DIR, file);
        const stats = fs.statSync(filePath);

        if (stats.mtimeMs < cutoff) {
          fs.unlinkSync(filePath);
          deleted++;
        }
      }

      if (deleted > 0) {
        this.logger.log(
          `Deleted ${deleted} screenshot(s) older than ${RETENTION_DAYS} days`,
        );
      }

      return deleted;
    } catch (error) {
      this.logger.error(
        `Failed to cleanup old screenshots: ${error instanceof Error ? error.message : String(error)}`,
      );
      return 0;
    }
  }
}
