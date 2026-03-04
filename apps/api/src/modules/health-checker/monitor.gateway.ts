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
  WsEvent,
  WsHealthUpdate,
  WsIncidentNew,
  WsIncidentResolved,
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
}
