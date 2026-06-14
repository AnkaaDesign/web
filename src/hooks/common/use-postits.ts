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

  // Postit edits (cor, conteúdo, arquivar, ordem) NÃO disparam toast — o
  // api-client toasta toda escrita por padrão, mas para post-its isso é ruído.
  // Mantemos a invalidação para refletir arquivar/restaurar nas listas.
  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: PostitUpdateFormData }) =>
      updatePostit(id, data, undefined, { suppressToast: true }),
    onSuccess: invalidate,
  });

  // Canvas livre: saves de posição/tamanho. Otimista (atualiza o cache na hora),
  // sem toast (frequentes) e SEM invalidar — invalidar refetcharia e atropelaria
  // um arraste/redimensionamento em andamento. A persistência fica garantida no
  // servidor; o cache já reflete o valor final.
  const quietUpdateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: PostitUpdateFormData }) =>
      updatePostit(id, data, undefined, { suppressToast: true }),
    onMutate: async ({ id, data }) => {
      await queryClient.cancelQueries({ queryKey: postitKeys.all });
      const snapshots = queryClient.getQueriesData<any>({ queryKey: postitKeys.all });
      for (const [key, value] of snapshots) {
        if (!value?.data) continue;
        queryClient.setQueryData(key, {
          ...value,
          data: value.data.map((p: any) => (p.id === id ? { ...p, ...data } : p)),
        });
      }
      return { snapshots };
    },
    onError: (_err, _vars, context) => {
      // Reverte o cache otimista em caso de falha.
      context?.snapshots?.forEach(([key, value]: [any, any]) => {
        queryClient.setQueryData(key, value);
      });
    },
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
    quietUpdate: quietUpdateMutation,
    delete: deleteMutation,
    reorder: reorderMutation,
  };
}
