/**
 * Message Hooks
 *
 * React Query hooks for managing in-app messages
 */

import { useMutation, useQuery, useQueryClient, type UseQueryOptions } from "@tanstack/react-query";
import { messageService } from "@/api-client/message";
import type {
  MessageGetManyResponse,
  MessageGetUniqueResponse,
} from "@/types/message";
import type {
  MessageGetManyFormData,
  MessageCreateFormData,
  MessageUpdateFormData,
  MessageBatchDeleteFormData,
} from "@/schemas/message";

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

  return useMutation({
    mutationFn: (data: MessageCreateFormData) => messageService.createMessage(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: messageKeys.lists() });
    },
  });
}

/**
 * Update an existing message
 */
export function useUpdateMessage() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: MessageUpdateFormData }) =>
      messageService.updateMessage(id, data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: messageKeys.lists() });
      queryClient.invalidateQueries({ queryKey: messageKeys.detail(variables.id) });
    },
  });
}

/**
 * Delete a message
 */
export function useDeleteMessage() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => messageService.deleteMessage(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: messageKeys.lists() });
    },
  });
}

/**
 * Batch delete messages
 */
export function useBatchDeleteMessages() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: MessageBatchDeleteFormData) => messageService.batchDeleteMessages(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: messageKeys.lists() });
    },
  });
}

/**
 * Archive a message
 */
export function useArchiveMessage() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => messageService.archiveMessage(id),
    onSuccess: (_, id) => {
      queryClient.invalidateQueries({ queryKey: messageKeys.lists() });
      queryClient.invalidateQueries({ queryKey: messageKeys.detail(id) });
    },
  });
}

/**
 * Activate a message
 */
export function useActivateMessage() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => messageService.activateMessage(id),
    onSuccess: (_, id) => {
      queryClient.invalidateQueries({ queryKey: messageKeys.lists() });
      queryClient.invalidateQueries({ queryKey: messageKeys.detail(id) });
    },
  });
}

/**
 * Mark message as viewed (automatic tracking)
 */
export function useMarkAsViewed() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => messageService.markAsViewed(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: messageKeys.lists() });
      // Silent - no toast for automatic view tracking
    },
    onError: (error) => {
      console.error('[useMarkAsViewed] Failed to mark as viewed:', error);
      // Silent failure - don't interrupt user experience
    },
  });
}

/**
 * Dismiss a message (don't show again)
 */
export function useDismissMessage() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => messageService.dismissMessage(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: messageKeys.lists() });
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
    dismiss: useDismissMessage(),
  };
}
