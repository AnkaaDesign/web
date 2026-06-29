import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
  installService,
  type InstallHistoryEntry,
  type InstallVersionResponse,
  type PublishInstallInput,
} from "@/api-client/install";
import { toast } from "@/components/ui/sonner";

const installKeys = {
  version: ["install", "version"] as const,
  history: ["install", "history"] as const,
};

export function useInstallVersion() {
  return useQuery<InstallVersionResponse>({
    queryKey: installKeys.version,
    queryFn: installService.getVersion,
    staleTime: 0,
  });
}

export function useInstallHistory() {
  return useQuery<InstallHistoryEntry[]>({
    queryKey: installKeys.history,
    queryFn: installService.getHistory,
    staleTime: 30_000,
  });
}

export function usePublishInstall() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: PublishInstallInput) => installService.publish(input),
    onSuccess: (_data, variables) => {
      const label = variables.platform === "ios" ? "iOS (.ipa)" : "Android (.apk)";
      toast.success(`Binário ${label} publicado`, {
        description: `Versão ${variables.version} (${variables.build}) já está disponível para instalação.`,
      });
      queryClient.invalidateQueries({ queryKey: installKeys.version });
      queryClient.invalidateQueries({ queryKey: installKeys.history });
    },
    onError: (error: any) => {
      toast.error("Falha ao publicar binário", {
        description: error?.response?.data?.message || error?.message || "Tente novamente.",
      });
    },
  });
}
