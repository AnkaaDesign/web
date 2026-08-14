// hooks/production/use-airbrushing-nfse.ts
//
// Hooks da NFS-e do aerografista. Ad-hoc (sem `createEntityHooks`): a nota é um
// singleton por aerografia, sem lista nem batch — mesmo estilo de
// `hooks/financial/use-nfse.ts`.

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { airbrushingNfseService } from "@/api-client/airbrushing-nfse";
import type { AirbrushingNfseCancelData } from "@/api-client/airbrushing-nfse";
import { airbrushingKeys } from "../common/query-keys";

export const airbrushingNfseKeys = {
  all: ["airbrushing-nfse"] as const,
  detail: (airbrushingId: string) => ["airbrushing-nfse", "detail", airbrushingId] as const,
  xml: (airbrushingId: string) => ["airbrushing-nfse", "xml", airbrushingId] as const,
};

/** A nota da aerografia — `data` volta `null` quando ainda não houve emissão. */
export function useAirbrushingNfse(airbrushingId: string, options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: airbrushingNfseKeys.detail(airbrushingId),
    queryFn: () => airbrushingNfseService.getAirbrushingNfse(airbrushingId),
    enabled: (options?.enabled ?? true) && !!airbrushingId,
    staleTime: 60 * 1000,
  });
}

/**
 * O XML é buscado sob demanda (botão "Baixar XML"), não no carregamento da seção —
 * por isso `enabled: false` por padrão: a leitura acontece via `refetch()`.
 */
export function useAirbrushingNfseXml(airbrushingId: string, options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: airbrushingNfseKeys.xml(airbrushingId),
    queryFn: () => airbrushingNfseService.getAirbrushingNfseXml(airbrushingId),
    enabled: options?.enabled ?? false,
    staleTime: 5 * 60 * 1000,
  });
}

function useInvalidateAirbrushingNfse() {
  const queryClient = useQueryClient();
  return (airbrushingId: string) => {
    queryClient.invalidateQueries({ queryKey: airbrushingNfseKeys.detail(airbrushingId) });
    queryClient.invalidateQueries({ queryKey: airbrushingNfseKeys.xml(airbrushingId) });
    // A aerografia carrega a nota no `include` — o detalhe dela também envelhece.
    queryClient.invalidateQueries({ queryKey: airbrushingKeys.all });
  };
}

export function useEmitAirbrushingNfse() {
  const invalidate = useInvalidateAirbrushingNfse();
  return useMutation({
    mutationFn: ({ airbrushingId }: { airbrushingId: string }) => airbrushingNfseService.emitAirbrushingNfse(airbrushingId),
    onSuccess: (_result, variables) => invalidate(variables.airbrushingId),
  });
}

export function useCancelAirbrushingNfse() {
  const invalidate = useInvalidateAirbrushingNfse();
  return useMutation({
    mutationFn: ({ airbrushingId, data }: { airbrushingId: string; data: AirbrushingNfseCancelData }) => airbrushingNfseService.cancelAirbrushingNfse(airbrushingId, data),
    onSuccess: (_result, variables) => invalidate(variables.airbrushingId),
  });
}
