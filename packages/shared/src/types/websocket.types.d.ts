export declare enum WsEvent {
    HEALTH_UPDATE = "health:update",
    INCIDENT_NEW = "incident:new",
    INCIDENT_RESOLVED = "incident:resolved",
    SERVICE_UPDATE = "service:update"
}
export interface WsHealthUpdate {
    serviceId: number;
    status: string;
    responseTimeMs: number;
    statusCode: number;
    checkedAt: string;
}
export interface WsIncidentNew {
    id: number;
    serviceId: number;
    serviceName: string;
    startedAt: string;
}
export interface WsIncidentResolved {
    id: number;
    serviceId: number;
    serviceName: string;
    resolvedAt: string;
}
//# sourceMappingURL=websocket.types.d.ts.map