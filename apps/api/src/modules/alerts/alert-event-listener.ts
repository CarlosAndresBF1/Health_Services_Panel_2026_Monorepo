import { Injectable } from "@nestjs/common";
import { OnEvent } from "@nestjs/event-emitter";

import {
  INCIDENT_CREATED_EVENT,
  INCIDENT_RESOLVED_EVENT,
  type IncidentEvent,
} from "../health-checker/incident.service";
import { AlertOrchestratorService } from "./alert-orchestrator.service";

@Injectable()
export class AlertEventListener {
  constructor(private readonly orchestrator: AlertOrchestratorService) {}

  @OnEvent(INCIDENT_CREATED_EVENT, { async: true })
  async handleIncidentCreated(event: IncidentEvent): Promise<void> {
    await this.orchestrator.onNewIncident(event.incident, event.service);
  }

  @OnEvent(INCIDENT_RESOLVED_EVENT, { async: true })
  async handleIncidentResolved(event: IncidentEvent): Promise<void> {
    await this.orchestrator.onIncidentResolved(event.incident, event.service);
  }
}
