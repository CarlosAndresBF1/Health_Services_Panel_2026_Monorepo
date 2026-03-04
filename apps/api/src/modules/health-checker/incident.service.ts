import { Injectable, Logger } from "@nestjs/common";
import { EventEmitter2 } from "@nestjs/event-emitter";
import { InjectRepository } from "@nestjs/typeorm";
import { IsNull, Repository } from "typeorm";

import { HealthStatus } from "@healthpanel/shared";

import { Incident } from "../../database/entities/incident.entity";
import { Service } from "../../database/entities/service.entity";
import { MonitorGateway } from "./monitor.gateway";

export const INCIDENT_CREATED_EVENT = "incident.created";
export const INCIDENT_RESOLVED_EVENT = "incident.resolved";

export interface IncidentEvent {
  incident: Incident;
  service: Service;
}

@Injectable()
export class IncidentService {
  private readonly logger = new Logger(IncidentService.name);

  constructor(
    @InjectRepository(Incident)
    private readonly incidentRepository: Repository<Incident>,
    private readonly monitorGateway: MonitorGateway,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  /**
   * Evaluate a health check result and manage incidents accordingly.
   *
   * - If status is DOWN and no open incident exists → create one
   * - If status is UP and an open incident exists → resolve it
   */
  async evaluate(service: Service, status: HealthStatus): Promise<void> {
    const openIncident = await this.findOpen(service.id);

    if (status === HealthStatus.DOWN) {
      if (!openIncident) {
        await this.create(service);
      }
      // If incident already exists, do nothing (already tracked)
    } else if (status === HealthStatus.UP || status === HealthStatus.DEGRADED) {
      // Only resolve on UP; keep incident open if degraded
      if (openIncident && status === HealthStatus.UP) {
        await this.resolve(openIncident, service);
      }
    }
  }

  /** Find the open (unresolved) incident for a service, if any. */
  async findOpen(serviceId: number): Promise<Incident | null> {
    return this.incidentRepository.findOne({
      where: { serviceId, resolvedAt: IsNull() },
      order: { startedAt: "DESC" },
    });
  }

  /** Create a new incident and emit WebSocket event. */
  async create(service: Service): Promise<Incident> {
    this.logger.warn(`🚨 New incident for "${service.name}" (${service.id})`);

    const incident = this.incidentRepository.create({
      serviceId: service.id,
      startedAt: new Date(),
      resolvedAt: null,
      emailSent: false,
    });

    const saved = await this.incidentRepository.save(incident);

    this.monitorGateway.emitIncidentNew({
      id: saved.id,
      serviceId: service.id,
      serviceName: service.name,
      startedAt: saved.startedAt.toISOString(),
    });

    // Emit event for alert orchestration (async, non-blocking)
    this.eventEmitter.emit(INCIDENT_CREATED_EVENT, {
      incident: saved,
      service,
    } satisfies IncidentEvent);

    return saved;
  }

  /** Resolve an existing incident and emit WebSocket event. */
  async resolve(incident: Incident, service: Service): Promise<Incident> {
    this.logger.log(
      `✅ Incident resolved for "${service.name}" (${service.id})`,
    );

    incident.resolvedAt = new Date();
    const saved = await this.incidentRepository.save(incident);

    this.monitorGateway.emitIncidentResolved({
      id: saved.id,
      serviceId: service.id,
      serviceName: service.name,
      resolvedAt: saved.resolvedAt!.toISOString(),
    });

    // Emit event for recovery alert (async, non-blocking)
    this.eventEmitter.emit(INCIDENT_RESOLVED_EVENT, {
      incident: saved,
      service,
    } satisfies IncidentEvent);

    return saved;
  }

  /** Get incidents for a service (paginated). */
  async findByService(
    serviceId: number,
    page = 1,
    limit = 20,
  ): Promise<{ data: Incident[]; total: number }> {
    const [data, total] = await this.incidentRepository.findAndCount({
      where: { serviceId },
      order: { startedAt: "DESC" },
      skip: (page - 1) * limit,
      take: limit,
    });
    return { data, total };
  }
}
