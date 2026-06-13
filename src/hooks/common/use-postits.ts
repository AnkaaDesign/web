// use-postits.ts
// Post-its pessoais — cada usuário vê e gerencia somente os próprios
// (escopo aplicado no servidor). Inclui mutation de reordenação (drag-and-drop).

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  getPostits,
  createPostit,
  updatePostit,
  deletePostit,
  reorderPostits,
} from "../../api-client/postit";
import type {
  PostitGetManyFormData,
  PostitCreateFormData,
  PostitUpdateFormData,
  PostitReorderFormData,
} from "../../schemas/postit";
import { postitKeys } from "./query-keys";

// =====================================================
// Query Hooks
// =====================================================

export function usePostits(params?: PostitGetManyFormData) {
  return useQuery({
    queryKey: postitKeys.list(params as any),
    queryFn: () => getPostits(params),
    staleTime: 1000 * 60, // 1 minute — quadro pessoal, atualiza com frequência
  });
}

// =====================================================
// Mutation Hooks (sem toasts — o interceptor do api-client já notifica)
// =====================================================

export function usePostitMutations() {
  const queryClient = useQueryClient();
  const invalidate = () => queryClient.invalidateQueries({ queryKey: postitKeys.all });

  const createMutation = useMutation({
    mutationFn: (data: PostitCreateFormData) => createPostit(data),
    onSuccess: invalidate,
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: PostitUpdateFormData }) =>
      updatePostit(id, data),
    onSuccess: invalidate,
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deletePostit(id),
    onSuccess: invalidate,
  });

  const reorderMutation = useMutation({
    mutationFn: (data: PostitReorderFormData) => reorderPostits(data),
    onSuccess: invalidate,
  });

  return {
    create: createMutation,
    update: updateMutation,
    delete: deleteMutation,
    reorder: reorderMutation,
  };
}
