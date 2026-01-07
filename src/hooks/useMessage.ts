/**
 * Message Hooks
 *
 * React Query hooks for managing in-app messages
 */

import { useMutation, useQuery, useQueryClient, type UseQueryOptions } from "@tanstack/react-query";
import { messageService } from "@/api-client/message";
import type {
  Message,
  MessageGetManyResponse,
  MessageGetUniqueResponse,
} from "@/types/message";
import type {
  MessageGetManyFormData,
  MessageCreateFormData,
  MessageUpdateFormData,
  MessageBatchDeleteFormData,
} from "@/schemas/message";
import { useToast } from "./use-toast";

// Query Keys
export const messageKeys = {
  all: ["messages"] as const,
  lists: () => [...messageKeys.all, "list"] as const,
  list: (filters: MessageGetManyFormData) => [...messageKeys.lists(), filters] as const,
  details: () => [...messageKeys.all, "detail"] as const,
  detail: (id: string) => [...messageKeys.details(), id] as const,
  stats: (id: string) => [...messageKeys.detail(id), "stats"] as const,
};

// =====================
// Query Hooks
// =====================

/**
 * Fetch paginated list of messages
 */
export function useMessages(
  params: MessageGetManyFormData = {},
  options?: Omit<UseQueryOptions<MessageGetManyResponse>, "queryKey" | "queryFn">
) {
  return useQuery({
    queryKey: messageKeys.list(params),
    queryFn: () => messageService.getMessages(params),
    ...options,
  });
}

/**
 * Fetch single message by ID
 */
export function useMessage(
  id: string,
  options?: Omit<UseQueryOptions<MessageGetUniqueResponse>, "queryKey" | "queryFn">
) {
  return useQuery({
    queryKey: messageKeys.detail(id),
    queryFn: () => messageService.getMessageById(id),
    enabled: !!id,
    ...options,
  });
}

/**
 * Fetch message stats
 */
export function useMessageStats(
  id: string,
  options?: Omit<UseQueryOptions<any>, "queryKey" | "queryFn">
) {
  return useQuery({
    queryKey: messageKeys.stats(id),
    queryFn: () => messageService.getMessageStats(id),
    enabled: !!id,
    ...options,
  });
}

// =====================
// Mutation Hooks
// =====================

/**
 * Create a new message
 */
export function useCreateMessage() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: (data: MessageCreateFormData) => messageService.createMessage(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: messageKeys.lists() });
      toast({
        title: "Mensagem criada",
        description: "A mensagem foi criada com sucesso.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Erro ao criar mensagem",
        description: error?.response?.data?.message || "Ocorreu um erro ao criar a mensagem.",
        variant: "destructive",
      });
    },
  });
}

/**
 * Update an existing message
 */
export function useUpdateMessage() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: MessageUpdateFormData }) =>
      messageService.updateMessage(id, data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: messageKeys.lists() });
      queryClient.invalidateQueries({ queryKey: messageKeys.detail(variables.id) });
      toast({
        title: "Mensagem atualizada",
        description: "A mensagem foi atualizada com sucesso.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Erro ao atualizar mensagem",
        description: error?.response?.data?.message || "Ocorreu um erro ao atualizar a mensagem.",
        variant: "destructive",
      });
    },
  });
}

/**
 * Delete a message
 */
export function useDeleteMessage() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: (id: string) => messageService.deleteMessage(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: messageKeys.lists() });
      toast({
        title: "Mensagem excluída",
        description: "A mensagem foi excluída com sucesso.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Erro ao excluir mensagem",
        description: error?.response?.data?.message || "Ocorreu um erro ao excluir a mensagem.",
        variant: "destructive",
      });
    },
  });
}

/**
 * Batch delete messages
 */
export function useBatchDeleteMessages() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: (data: MessageBatchDeleteFormData) => messageService.batchDeleteMessages(data),
    onSuccess: (response) => {
      queryClient.invalidateQueries({ queryKey: messageKeys.lists() });
      toast({
        title: "Mensagens excluídas",
        description: `${response.data.count} mensagem(ns) excluída(s) com sucesso.`,
      });
    },
    onError: (error: any) => {
      toast({
        title: "Erro ao excluir mensagens",
        description: error?.response?.data?.message || "Ocorreu um erro ao excluir as mensagens.",
        variant: "destructive",
      });
    },
  });
}

/**
 * Archive a message
 */
export function useArchiveMessage() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: (id: string) => messageService.archiveMessage(id),
    onSuccess: (_, id) => {
      queryClient.invalidateQueries({ queryKey: messageKeys.lists() });
      queryClient.invalidateQueries({ queryKey: messageKeys.detail(id) });
      toast({
        title: "Mensagem arquivada",
        description: "A mensagem foi arquivada com sucesso.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Erro ao arquivar mensagem",
        description: error?.response?.data?.message || "Ocorreu um erro ao arquivar a mensagem.",
        variant: "destructive",
      });
    },
  });
}

/**
 * Activate a message
 */
export function useActivateMessage() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: (id: string) => messageService.activateMessage(id),
    onSuccess: (_, id) => {
      queryClient.invalidateQueries({ queryKey: messageKeys.lists() });
      queryClient.invalidateQueries({ queryKey: messageKeys.detail(id) });
      toast({
        title: "Mensagem ativada",
        description: "A mensagem foi ativada com sucesso.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Erro ao ativar mensagem",
        description: error?.response?.data?.message || "Ocorreu um erro ao ativar a mensagem.",
        variant: "destructive",
      });
    },
  });
}

/**
 * Combined mutations hook for convenience
 */
export function useMessageMutations() {
  return {
    create: useCreateMessage(),
    update: useUpdateMessage(),
    delete: useDeleteMessage(),
    batchDelete: useBatchDeleteMessages(),
    archive: useArchiveMessage(),
    activate: useActivateMessage(),
  };
}
