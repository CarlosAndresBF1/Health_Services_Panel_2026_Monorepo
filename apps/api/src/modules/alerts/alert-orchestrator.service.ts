import { Injectable, Logger } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";

import { ServiceType } from "@healthpanel/shared";

import { Incident } from "../../database/entities/incident.entity";
import { Service } from "../../database/entities/service.entity";
import { AlertsService } from "./alerts.service";
import { LogCollectorService } from "./log-collector.service";
import { ScreenshotService } from "./screenshot.service";

@Injectable()
export class AlertOrchestratorService {
  private readonly logger = new Logger(AlertOrchestratorService.name);

  constructor(
    @InjectRepository(Incident)
    private readonly incidentRepository: Repository<Incident>,
    private readonly alertsService: AlertsService,
    private readonly screenshotService: ScreenshotService,
    private readonly logCollectorService: LogCollectorService,
  ) {}

  /**
   * Orchestrate the full alert flow when a new incident is created:
   *   1. Collect screenshot (if web type) + logs (in parallel)
   *   2. Update incident with logs snapshot
   *   3. Send alert email with collected data
   */
  async onNewIncident(incident: Incident, service: Service): Promise<void> {
    this.logger.log(
      `Orchestrating alert for incident #${incident.id} (${service.name})`,
    );

    try {
      // Parallel: screenshot + logs collection
      const [screenshotResult, logsSnapshot] = await Promise.all([
        this.screenshotService.capture(service.url, service.id),
        this.logCollectorService.collect(service),
      ]);

      // Update incident with logs snapshot and screenshot path
      if (logsSnapshot) {
        incident.lastLogsSnapshot = logsSnapshot;
      }
      if (screenshotResult) {
        incident.screenshotPath = screenshotResult.filePath;
      }
      await this.incidentRepository.save(incident);

      // Send alert email
      await this.alertsService.sendDownAlert({
        incident,
        service,
        screenshotBuffer: screenshotResult?.buffer,
        logsSnapshot: logsSnapshot || undefined,
      });
    } catch (error) {
      this.logger.error(
        `Alert orchestration failed for incident #${incident.id}: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  /**
   * Handle incident resolution: optionally send recovery email.
   */
  async onIncidentResolved(
    incident: Incident,
    service: Service,
  ): Promise<void> {
    try {
      await this.alertsService.sendRecoveryAlert(incident, service);
    } catch (error) {
      this.logger.error(
        `Recovery alert failed for incident #${incident.id}: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }
}
