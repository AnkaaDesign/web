// use-notes.ts
// Notas — feature unificada (antigo "Post-it" + rascunho "Anotações"). O escopo
// de visibilidade (owner OU compartilhado) é aplicado no servidor. Inclui
// mutations de reordenação (drag-and-drop), compartilhamento e arquivamento.

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  getNotes,
  createNote,
  updateNote,
  deleteNote,
  reorderNotes,
  shareNote,
  removeNoteShare,
  archiveNote,
  unarchiveNote,
} from "../../api-client/note";
import type {
  NoteGetManyFormData,
  NoteCreateFormData,
  NoteUpdateFormData,
  NoteReorderFormData,
  NoteShareInput,
} from "../../schemas/note";
import { noteKeys } from "./query-keys";

// =====================================================
// Query Hooks
// =====================================================

export function useNotes(params?: NoteGetManyFormData) {
  return useQuery({
    queryKey: noteKeys.list(params as any),
    queryFn: () => getNotes(params),
    staleTime: 1000 * 60, // 1 minute — quadro pessoal, atualiza com frequência
  });
}

// =====================================================
// Mutation Hooks (sem toasts — o interceptor do api-client já notifica)
// =====================================================

export function useNoteMutations() {
  const queryClient = useQueryClient();
  const invalidate = () => queryClient.invalidateQueries({ queryKey: noteKeys.all });

  const createMutation = useMutation({
    mutationFn: (data: NoteCreateFormData) => createNote(data),
    onSuccess: invalidate,
  });

  // Edits (título, cor, conteúdo, arquivar, ordem) NÃO disparam toast — o
  // api-client toasta toda escrita por padrão, mas para notas isso é ruído.
  // Mantemos a invalidação para refletir arquivar/restaurar nas listas.
  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: NoteUpdateFormData }) =>
      updateNote(id, data, undefined, { suppressToast: true }),
    onSuccess: invalidate,
  });

  // Canvas livre: saves de posição/tamanho. Otimista (atualiza o cache na hora),
  // sem toast (frequentes) e SEM invalidar — invalidar refetcharia e atropelaria
  // um arraste/redimensionamento em andamento. A persistência fica garantida no
  // servidor; o cache já reflete o valor final.
  const quietUpdateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: NoteUpdateFormData }) =>
      updateNote(id, data, undefined, { suppressToast: true }),
    onMutate: async ({ id, data }) => {
      await queryClient.cancelQueries({ queryKey: noteKeys.all });
      const snapshots = queryClient.getQueriesData<any>({ queryKey: noteKeys.all });
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
    mutationFn: (id: string) => deleteNote(id),
    onSuccess: invalidate,
  });

  const reorderMutation = useMutation({
    mutationFn: (data: NoteReorderFormData) => reorderNotes(data),
    onSuccess: invalidate,
  });

  const shareMutation = useMutation({
    mutationFn: ({ id, shares }: { id: string; shares: NoteShareInput[] }) => shareNote(id, { shares }),
    onSuccess: invalidate,
  });

  const removeShareMutation = useMutation({
    mutationFn: ({ id, userId }: { id: string; userId: string }) => removeNoteShare(id, userId),
    onSuccess: invalidate,
  });

  const archiveMutation = useMutation({
    mutationFn: (id: string) => archiveNote(id),
    onSuccess: invalidate,
  });

  const unarchiveMutation = useMutation({
    mutationFn: (id: string) => unarchiveNote(id),
    onSuccess: invalidate,
  });

  return {
    create: createMutation,
    update: updateMutation,
    quietUpdate: quietUpdateMutation,
    delete: deleteMutation,
    reorder: reorderMutation,
    share: shareMutation,
    removeShare: removeShareMutation,
    archive: archiveMutation,
    unarchive: unarchiveMutation,
  };
}
