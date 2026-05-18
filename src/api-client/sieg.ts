import { apiClient } from "./axiosClient";
import type { SiegStatus } from "@/types/reconciliation";
import type { SiegFetchPayload } from "@/schemas/reconciliation";

export const siegService = {
  getStatus: () => apiClient.get<SiegStatus>("/integrations/sieg/status"),

  triggerFetch: (payload: SiegFetchPayload) =>
    apiClient.post<{ runId: string; created: number; skipped: number }>(
      "/integrations/sieg/fetch",
      payload,
    ),
};
