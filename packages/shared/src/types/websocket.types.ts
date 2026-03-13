// WebSocket event names
export enum WsEvent {
  HEALTH_UPDATE = "health:update",
  INCIDENT_NEW = "incident:new",
  INCIDENT_RESOLVED = "incident:resolved",
  SERVICE_UPDATE = "service:update",
  RESOURCE_WARNING = "resource:warning",
  DOMAIN_EXPIRY_WARNING = "domain:expiry:warning",
}

// WebSocket payloads
export interface WsHealthUpdate {
  serviceId: number;
  status: string;
  responseTimeMs: number;
  statusCode: number;
  checkedAt: string;
  responseData?: Record<string, unknown> | null;
}

export interface WsResourceWarning {
  serviceId: number;
  serviceName: string;
  warnings: Array<{
    type: "disk" | "memory";
    usedPercent: number;
    threshold: number;
    detail: string;
  }>;
  timestamp: string;
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

export interface WsDomainExpiryWarning {
  serviceId: number;
  serviceName: string;
  domain: string;
  expiresAt: string | null;
  daysUntilExpiry: number | null;
  status: "expiring_soon" | "expired";
}
