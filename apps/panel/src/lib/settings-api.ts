import { apiClient } from "./api";

export interface SettingsResponse {
  alert_email_to: string;
  alert_email_from: string;
  alerts_enabled: boolean;
  alert_min_interval_ms: number;
}

export interface UpdateSettingsDto {
  alert_email_to?: string;
  alert_email_from?: string;
  alerts_enabled?: boolean;
  alert_min_interval_ms?: number;
}

export const settingsApi = {
  get(): Promise<SettingsResponse> {
    return apiClient.get<SettingsResponse>("/api/settings");
  },

  update(data: UpdateSettingsDto): Promise<SettingsResponse> {
    return apiClient.put<SettingsResponse>("/api/settings", data);
  },
};
