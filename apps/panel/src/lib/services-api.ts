import { apiClient } from "./api";

export interface ServiceRecord {
  id: number;
  name: string;
  url: string;
  type: string;
  healthEndpoint: string;
  logsEndpoint: string;
  monitorApiKey: string;
  checkIntervalSeconds: number;
  isActive: boolean;
  alertsEnabled: boolean;
  categoryId: number | null;
  categoryName: string | null;
  categoryColor: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ServiceWithSecret extends ServiceRecord {
  monitorSecret: string;
}

export interface PaginatedServices {
  data: ServiceRecord[];
  total: number;
}

export interface CreateServicePayload {
  name: string;
  url: string;
  type: string;
  healthEndpoint?: string;
  logsEndpoint?: string;
  checkIntervalSeconds?: number;
  isActive?: boolean;
  alertsEnabled?: boolean;
  categoryId?: number | null;
}

export const servicesApi = {
  list(page = 1, limit = 50, categoryId?: number): Promise<PaginatedServices> {
    let url = `/api/services?page=${page}&limit=${limit}`;
    if (categoryId !== undefined) url += `&categoryId=${categoryId}`;
    return apiClient.get<PaginatedServices>(url);
  },

  get(id: number): Promise<ServiceRecord> {
    return apiClient.get<ServiceRecord>(`/api/services/${id}`);
  },

  create(payload: CreateServicePayload): Promise<ServiceWithSecret> {
    return apiClient.post<ServiceWithSecret>("/api/services", payload);
  },

  update(
    id: number,
    payload: Partial<CreateServicePayload>,
  ): Promise<ServiceRecord> {
    return apiClient.put<ServiceRecord>(`/api/services/${id}`, payload);
  },

  delete(id: number): Promise<{ message: string }> {
    return apiClient.delete<{ message: string }>(`/api/services/${id}`);
  },

  regenerateKeys(id: number): Promise<ServiceWithSecret> {
    return apiClient.post<ServiceWithSecret>(
      `/api/services/${id}/regenerate-keys`,
    );
  },
};

export const SERVICE_TYPE_LABELS: Record<string, string> = {
  api_nestjs: "NestJS API",
  api_laravel: "Laravel API",
  web_nextjs: "Next.js Web",
};

export const SERVICE_TYPE_COLORS: Record<string, string> = {
  api_nestjs: "#EF4444",
  api_laravel: "#F97316",
  web_nextjs: "#F3F4F6",
};

export const INTERVAL_OPTIONS = [
  { value: 30, label: "30 sec" },
  { value: 60, label: "1 min" },
  { value: 300, label: "5 min" },
  { value: 600, label: "10 min" },
];
