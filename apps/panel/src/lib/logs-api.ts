import { apiClient } from "./api";

export interface LogsResponse {
  logs: string;
  serviceId: number;
  lines: number;
}

export const logsApi = {
  fetch(serviceId: number, lines = 100): Promise<LogsResponse> {
    return apiClient.get<LogsResponse>(
      `/api/services/${serviceId}/logs?lines=${lines}`,
    );
  },
};
