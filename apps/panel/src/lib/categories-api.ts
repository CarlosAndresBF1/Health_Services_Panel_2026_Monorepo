import { apiClient } from "./api";

export interface CategoryRecord {
  id: number;
  name: string;
  color: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateCategoryPayload {
  name: string;
  color?: string;
}

export interface UpdateCategoryPayload {
  name?: string;
  color?: string;
}

export const categoriesApi = {
  list(): Promise<CategoryRecord[]> {
    return apiClient.get<CategoryRecord[]>("/api/categories");
  },

  get(id: number): Promise<CategoryRecord> {
    return apiClient.get<CategoryRecord>(`/api/categories/${id}`);
  },

  create(payload: CreateCategoryPayload): Promise<CategoryRecord> {
    return apiClient.post<CategoryRecord>("/api/categories", payload);
  },

  update(id: number, payload: UpdateCategoryPayload): Promise<CategoryRecord> {
    return apiClient.put<CategoryRecord>(`/api/categories/${id}`, payload);
  },

  delete(id: number): Promise<{ message: string }> {
    return apiClient.delete<{ message: string }>(`/api/categories/${id}`);
  },
};
