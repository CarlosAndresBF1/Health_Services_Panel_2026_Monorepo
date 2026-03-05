import { apiClient } from "./api";

export interface SettingsResponse {
  alert_email_to: string;
  alert_email_from: string;
  alerts_enabled: boolean;
  alert_min_interval_ms: number;
  resource_disk_threshold_percent: number;
  resource_memory_threshold_percent: number;
}

export interface UpdateSettingsDto {
  alert_email_to?: string;
  alert_email_from?: string;
  alerts_enabled?: boolean;
  alert_min_interval_ms?: number;
  resource_disk_threshold_percent?: number;
  resource_memory_threshold_percent?: number;
}

export interface ChangePasswordDto {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
}

export const settingsApi = {
  get(): Promise<SettingsResponse> {
    return apiClient.get<SettingsResponse>("/api/settings");
  },

  update(data: UpdateSettingsDto): Promise<SettingsResponse> {
    return apiClient.put<SettingsResponse>("/api/settings", data);
  },

  changePassword(data: ChangePasswordDto): Promise<{ message: string }> {
    return apiClient.put<{ message: string }>(
      "/api/auth/change-password",
      data,
    );
  },
};
