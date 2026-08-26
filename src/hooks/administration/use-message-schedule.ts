/**
 * Message Schedule Hooks
 *
 * React Query para os agendamentos de comunicado recorrente.
 *
 * Em uso hoje: `useCreateMessageSchedule` (o compositor grava a regra) e
 * `useMessageSchedulePreview` (a prévia das próximas datas).
 *
 * Os demais — listar, pausar, retomar, publicar agora, excluir — cobrem
 * endpoints que EXISTEM e funcionam, mas por ora não têm tela: por decisão do
 * dono a recorrência é só uma configuração a mais no formulário da mensagem, sem
 * página própria de agendamentos. Ficam aqui espelhando a API (mesmo critério de
 * `api-client/message.ts`) para quando houver onde pendurá-los.
 */

import { useMutation, useQuery, useQueryClient, type UseQueryOptions } from "@tanstack/react-query";
import { messageScheduleService } from "@/api-client/message-schedule";
import { messageKeys } from "./use-message";
import type {
  MessageScheduleCreateFormData,
  MessageScheduleUpdateFormData,
  MessageScheduleGetManyFormData,
  MessageScheduleGetManyResponse,
  MessageScheduleGetUniqueResponse,
} from "@/schemas/message-schedule";

export const messageScheduleKeys = {
  all: ["message-schedules"] as const,
  lists: () => [...messageScheduleKeys.all, "list"] as const,
  list: (filters: MessageScheduleGetManyFormData) => [...messageScheduleKeys.lists(), filters] as const,
  details: () => [...messageScheduleKeys.all, "detail"] as const,
  detail: (id: string) => [...messageScheduleKeys.details(), id] as const,
};

// =====================
// Queries
// =====================

export function useMessageSchedules(
  params: MessageScheduleGetManyFormData = {},
  options?: Omit<UseQueryOptions<MessageScheduleGetManyResponse>, "queryKey" | "queryFn">,
) {
  return useQuery({
    queryKey: messageScheduleKeys.list(params),
    queryFn: () => messageScheduleService.getSchedules(params),
    ...options,
  });
}

export function useMessageSchedule(
  id: string,
  options?: Omit<UseQueryOptions<MessageScheduleGetUniqueResponse>, "queryKey" | "queryFn">,
) {
  return useQuery({
    queryKey: messageScheduleKeys.detail(id),
    queryFn: () => messageScheduleService.getScheduleById(id),
    enabled: !!id,
    ...options,
  });
}

/**
 * Prévia das próximas datas de disparo.
 *
 * `enabled` fica a cargo de quem chama: só faz sentido consultar quando a
 * recorrência já está completa o bastante para produzir data (o servidor
 * devolve 400 numa configuração pela metade, e um 400 por tecla digitada seria
 * ruído).
 */
export function useMessageSchedulePreview(
  data: MessageScheduleCreateFormData | null,
  count = 5,
  enabled = true,
) {
  return useQuery({
    queryKey: [...messageScheduleKeys.all, "preview", data, count],
    queryFn: () => messageScheduleService.previewOccurrences(data!, count),
    enabled: enabled && !!data,
    retry: false,
    staleTime: 30_000,
  });
}

// =====================
// Mutations
// =====================

export function useCreateMessageSchedule() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: MessageScheduleCreateFormData) => messageScheduleService.createSchedule(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: messageScheduleKeys.lists() });
    },
  });
}

export function useUpdateMessageSchedule() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: MessageScheduleUpdateFormData }) =>
      messageScheduleService.updateSchedule(id, data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: messageScheduleKeys.lists() });
      queryClient.invalidateQueries({ queryKey: messageScheduleKeys.detail(variables.id) });
    },
  });
}

export function useDeleteMessageSchedule() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => messageScheduleService.deleteSchedule(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: messageScheduleKeys.lists() });
      // As ocorrências NÃO são apagadas (FK SET NULL) — elas viram mensagens
      // avulsas, então a lista de mensagens muda de conteúdo e precisa recarregar.
      queryClient.invalidateQueries({ queryKey: messageKeys.lists() });
    },
  });
}

export function usePauseMessageSchedule() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => messageScheduleService.pauseSchedule(id),
    onSuccess: (_, id) => {
      queryClient.invalidateQueries({ queryKey: messageScheduleKeys.lists() });
      queryClient.invalidateQueries({ queryKey: messageScheduleKeys.detail(id) });
    },
  });
}

export function useResumeMessageSchedule() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => messageScheduleService.resumeSchedule(id),
    onSuccess: (_, id) => {
      queryClient.invalidateQueries({ queryKey: messageScheduleKeys.lists() });
      queryClient.invalidateQueries({ queryKey: messageScheduleKeys.detail(id) });
    },
  });
}

/** Publica a ocorrência de hoje. A lista de MENSAGENS também muda. */
export function useRunMessageScheduleNow() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => messageScheduleService.runNow(id),
    onSuccess: (_, id) => {
      queryClient.invalidateQueries({ queryKey: messageScheduleKeys.detail(id) });
      queryClient.invalidateQueries({ queryKey: messageScheduleKeys.lists() });
      queryClient.invalidateQueries({ queryKey: messageKeys.lists() });
    },
  });
}
