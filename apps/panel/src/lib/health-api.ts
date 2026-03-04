import { apiClient } from "./api";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface HealthCheckRecord {
  id: number;
  serviceId: number;
  status: "up" | "down" | "degraded";
  responseTimeMs: number | null;
  statusCode: number | null;
  errorMessage: string | null;
  checkedAt: string;
}

export interface IncidentRecord {
  id: number;
  serviceId: number;
  startedAt: string;
  resolvedAt: string | null;
  screenshotPath: string | null;
  lastLogsSnapshot: string | null;
  emailSent: boolean;
  emailSentAt: string | null;
}

export interface PaginatedHealthChecks {
  data: HealthCheckRecord[];
  total: number;
  page: number;
  limit: number;
}

export interface PaginatedIncidents {
  data: IncidentRecord[];
  total: number;
  page: number;
  limit: number;
}

// ─── API client ───────────────────────────────────────────────────────────────

export const healthApi = {
  /**
   * Execute an immediate health check for a service
   */
  check(serviceId: number): Promise<HealthCheckRecord> {
    return apiClient.post<HealthCheckRecord>(
      `/api/services/${serviceId}/check`,
    );
  },

  /**
   * Get paginated health check history
   */
  getChecks(
    serviceId: number,
    page = 1,
    limit = 20,
  ): Promise<PaginatedHealthChecks> {
    return apiClient.get<PaginatedHealthChecks>(
      `/api/services/${serviceId}/health-checks?page=${page}&limit=${limit}`,
    );
  },

  /**
   * Get paginated incident history
   */
  getIncidents(
    serviceId: number,
    page = 1,
    limit = 20,
  ): Promise<PaginatedIncidents> {
    return apiClient.get<PaginatedIncidents>(
      `/api/services/${serviceId}/incidents?page=${page}&limit=${limit}`,
    );
  },
};
