import { apiClient } from "./api";

// ─── Types ────────────────────────────────────────────────────────────────────

export type DomainCheckStatus = "ok" | "expiring_soon" | "expired" | "unknown";

export interface DomainCheckRecord {
  id: number;
  serviceId: number;
  domain: string;
  expiresAt: string | null;
  daysUntilExpiry: number | null;
  status: DomainCheckStatus;
  registrar: string | null;
  error: string | null;
  alertSent: boolean;
  checkedAt: string;
}

// ─── API client ───────────────────────────────────────────────────────────────

export const domainApi = {
  /** Get the latest domain check result for a service (returns null if none exists yet) */
  async getLatest(serviceId: number): Promise<DomainCheckRecord | null> {
    try {
      const result = await apiClient.get<DomainCheckRecord>(
        `/api/services/${serviceId}/domain-check`,
      );
      return result;
    } catch {
      return null;
    }
  },

  /** Trigger an immediate domain check for a service */
  async checkNow(serviceId: number): Promise<DomainCheckRecord> {
    return apiClient.post<DomainCheckRecord>(
      `/api/services/${serviceId}/domain-check`,
    );
  },
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

export function domainStatusLabel(status: DomainCheckStatus): string {
  switch (status) {
    case "ok":
      return "Active";
    case "expiring_soon":
      return "Expiring Soon";
    case "expired":
      return "Expired";
    default:
      return "Unknown";
  }
}

export function domainStatusColor(
  status: DomainCheckStatus,
): "green" | "yellow" | "red" | "gray" {
  switch (status) {
    case "ok":
      return "green";
    case "expiring_soon":
      return "yellow";
    case "expired":
      return "red";
    default:
      return "gray";
  }
}
