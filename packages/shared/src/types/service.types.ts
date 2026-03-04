export enum ServiceType {
  API_NESTJS = 'api_nestjs',
  API_LARAVEL = 'api_laravel',
  WEB_NEXTJS = 'web_nextjs',
}

export enum HealthStatus {
  UP = 'up',
  DOWN = 'down',
  DEGRADED = 'degraded',
  UNKNOWN = 'unknown',
}

export interface IService {
  id: number;
  name: string;
  url: string;
  type: ServiceType;
  healthEndpoint: string;
  logsEndpoint: string;
  monitorApiKey: string;
  checkIntervalSeconds: number;
  isActive: boolean;
  alertsEnabled: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface IHealthCheck {
  id: number;
  serviceId: number;
  status: HealthStatus;
  responseTimeMs: number;
  statusCode: number;
  errorMessage: string | null;
  checkedAt: Date;
}

export interface IIncident {
  id: number;
  serviceId: number;
  startedAt: Date;
  resolvedAt: Date | null;
  screenshotPath: string | null;
  lastLogsSnapshot: string | null;
  emailSent: boolean;
  emailSentAt: Date | null;
}

export interface ISetting {
  id: number;
  key: string;
  value: string;
}

export interface IUser {
  id: number;
  username: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}
