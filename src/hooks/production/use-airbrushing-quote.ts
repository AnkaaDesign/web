// hooks/production/use-airbrushing-quote.ts
//
// Hooks da cotação da aerografia (lado do comercial). Ad-hoc (sem
// `createEntityHooks`): a cotação é lida por aerografia e as ações são verbos
// (contrapropor, selecionar, reabrir), não CRUD — mesmo estilo de
// `use-airbrushing-nfse.ts`. O toast de sucesso/erro vem do interceptor global,
// que usa a `message` da resposta.

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { airbrushingQuoteService } from "@/api-client/airbrushing-quote";
import type { AirbrushingQuoteCounterAllData, AirbrushingQuoteCounterData, AirbrushingQuoteSelectData } from "@/api-client/airbrushing-quote";
import { airbrushingKeys, taskKeys } from "../common/query-keys";

export const airbrushingQuoteKeys = {
  all: ["airbrushing-quotes"] as const,
  byAirbrushing: (airbrushingId: string) => ["airbrushing-quotes", "airbrushing", airbrushingId] as const,
};

/** Enquanto a aerografia está em cotação, propostas chegam a qualquer momento. */
const QUOTING_POLL_INTERVAL = 20 * 1000;

/**
 * Negociações da aerografia + aerografistas que ainda não responderam.
 * `polling` liga o refetch periódico — use enquanto o status é QUOTING.
 */
export function useAirbrushingQuotes(airbrushingId: string, options?: { enabled?: boolean; polling?: boolean }) {
  return useQuery({
    queryKey: airbrushingQuoteKeys.byAirbrushing(airbrushingId),
    queryFn: () => airbrushingQuoteService.getAirbrushingQuotes(airbrushingId),
    enabled: (options?.enabled ?? true) && !!airbrushingId,
    staleTime: 10 * 1000,
    refetchInterval: options?.polling ? QUOTING_POLL_INTERVAL : false,
    refetchIntervalInBackground: false,
  });
}

function useInvalidateAirbrushingQuotes() {
  const queryClient = useQueryClient();
  return () => {
    queryClient.invalidateQueries({ queryKey: airbrushingQuoteKeys.all });
    // Selecionar/reabrir gravam aerografista, valor e status na aerografia — o
    // detalhe, a lista e a seção de aerografias da tarefa envelhecem juntos.
    queryClient.invalidateQueries({ queryKey: airbrushingKeys.all });
    queryClient.invalidateQueries({ queryKey: taskKeys.all });
  };
}

export function useCounterAirbrushingQuote() {
  const invalidate = useInvalidateAirbrushingQuotes();
  return useMutation({
    mutationFn: ({ quoteId, data }: { quoteId: string; data: AirbrushingQuoteCounterData }) => airbrushingQuoteService.counterAirbrushingQuote(quoteId, data),
    onSuccess: () => invalidate(),
  });
}

/** Contraproposta para todos os aerografistas com proposta aguardando resposta. */
export function useCounterAllAirbrushingQuotes() {
  const invalidate = useInvalidateAirbrushingQuotes();
  return useMutation({
    mutationFn: ({ airbrushingId, data }: { airbrushingId: string; data: AirbrushingQuoteCounterAllData }) =>
      airbrushingQuoteService.counterAllAirbrushingQuotes(airbrushingId, data),
    onSuccess: () => invalidate(),
  });
}

export function useSelectAirbrushingQuote() {
  const invalidate = useInvalidateAirbrushingQuotes();
  return useMutation({
    mutationFn: ({ quoteId, data }: { quoteId: string; data?: AirbrushingQuoteSelectData }) => airbrushingQuoteService.selectAirbrushingQuote(quoteId, data),
    onSuccess: () => invalidate(),
  });
}

export function useReopenAirbrushingQuotation() {
  const invalidate = useInvalidateAirbrushingQuotes();
  return useMutation({
    mutationFn: ({ airbrushingId }: { airbrushingId: string }) => airbrushingQuoteService.reopenAirbrushingQuotation(airbrushingId),
    onSuccess: () => invalidate(),
  });
}
