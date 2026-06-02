import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  wasteCertificateService,
  type WasteCertificateCreatePayload,
} from "@/api-client/waste-certificate";

export interface WasteCertificateListParams {
  page?: number;
  limit?: number;
  searchingFor?: string;
  status?: string;
  orderBy?: Record<string, "asc" | "desc">;
}

const wasteCertificateKeys = {
  all: ["waste-certificates"] as const,
  list: (params?: WasteCertificateListParams) => ["waste-certificates", "list", params] as const,
};

export function useWasteCertificates(params?: WasteCertificateListParams) {
  return useQuery({
    queryKey: wasteCertificateKeys.list(params),
    queryFn: async () => {
      const res = await wasteCertificateService.getAll(params);
      return res.data;
    },
    staleTime: 30_000,
  });
}

export function useCreateWasteCertificate() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: WasteCertificateCreatePayload) => {
      const res = await wasteCertificateService.create(payload);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: wasteCertificateKeys.all });
    },
  });
}

export function useDeleteWasteCertificate() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await wasteCertificateService.delete(id);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: wasteCertificateKeys.all });
    },
  });
}
