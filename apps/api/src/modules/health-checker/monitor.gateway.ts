import { Logger } from "@nestjs/common";
import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayInit,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from "@nestjs/websockets";
import { Server, Socket } from "socket.io";

import {
  WsDomainExpiryWarning,
  WsEvent,
  WsHealthUpdate,
  WsIncidentNew,
  WsIncidentResolved,
  WsResourceWarning,
} from "@healthpanel/shared";

@WebSocketGateway({
  cors: { origin: "*" },
  namespace: "/monitor",
})
export class MonitorGateway
  implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect
{
  private readonly logger = new Logger(MonitorGateway.name);

  @WebSocketServer()
  server!: Server;

  afterInit(): void {
    this.logger.log("Monitor WebSocket gateway initialized");
  }

  handleConnection(client: Socket): void {
    this.logger.debug(`Client connected: ${client.id}`);
  }

  handleDisconnect(client: Socket): void {
    this.logger.debug(`Client disconnected: ${client.id}`);
  }

  // ─── Emitters ──────────────────────────────────────────────────────────

  emitHealthUpdate(payload: WsHealthUpdate): void {
    this.server.emit(WsEvent.HEALTH_UPDATE, payload);
  }

  emitIncidentNew(payload: WsIncidentNew): void {
    this.server.emit(WsEvent.INCIDENT_NEW, payload);
  }

  emitIncidentResolved(payload: WsIncidentResolved): void {
    this.server.emit(WsEvent.INCIDENT_RESOLVED, payload);
  }

  emitServiceUpdate(serviceId: number): void {
    this.server.emit(WsEvent.SERVICE_UPDATE, { serviceId });
  }

  emitResourceWarning(payload: WsResourceWarning): void {
    this.server.emit(WsEvent.RESOURCE_WARNING, payload);
  }

  emitDomainExpiryWarning(payload: WsDomainExpiryWarning): void {
    this.server.emit(WsEvent.DOMAIN_EXPIRY_WARNING, payload);
  }
}
