/**
 * A ARTE DO IMPLEMENTO — leitura e atos (`/implements/:id/layouts/*`).
 *
 * Cada ato chama a rota NA HORA e atualiza o que embute a arte: a lista de arte
 * do implemento, as tarefas (que trazem `implement.layouts`) e os orçamentos
 * (o portão de emissão e a faixa dos eixos dependem dela).
 */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
  approveImplementLayoutOnBehalf,
  deleteImplementLayout,
  getImplementLayouts,
  newImplementLayoutVersion,
  reproveImplementLayout,
  sendImplementLayout,
  setImplementProjectFiles,
  uploadImplementLayouts,
} from "@/api-client/implement";
import { applyArtToImplements } from "@/utils/implement-art-upload";
import { taskKeys } from "../common/query-keys";
import { budgetKeys } from "./use-budget";

export const implementArtKeys = {
  all: ["implement-art"] as const,
  of: (implementId: string) => ["implement-art", implementId] as const,
};

/** A arte do implemento como a API a devolve ao papel de quem pede (o comercial vê todos os estados). */
export function useImplementArt(implementId: string | null | undefined) {
  return useQuery({
    queryKey: implementArtKeys.of(implementId ?? ""),
    queryFn: async () => (await getImplementLayouts(implementId as string)).data ?? [],
    enabled: !!implementId,
  });
}

function useArtAct<TArgs>(mutationFn: (args: TArgs) => Promise<unknown>) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn,
    onSuccess: () => {
      // Success/error toasts are emitted by the axios interceptor.
      queryClient.invalidateQueries({ queryKey: implementArtKeys.all });
      queryClient.invalidateQueries({ queryKey: taskKeys.all });
      queryClient.invalidateQueries({ queryKey: budgetKeys.all });
    },
  });
}

/** Sobe arte nova (nasce RASCUNHO). */
export function useUploadImplementArt() {
  return useArtAct(({ implementId, files }: { implementId: string; files: File[] }) =>
    uploadImplementLayouts(implementId, files),
  );
}

/** Rascunho → aguardando o cliente. */
export function useSendImplementArt() {
  return useArtAct(({ implementId, layoutId }: { implementId: string; layoutId: string }) =>
    sendImplementLayout(implementId, layoutId),
  );
}

/** "Aprovar em nome do cliente" — nota obrigatória. */
export function useApproveImplementArtOnBehalf() {
  return useArtAct(({ implementId, layoutId, note }: { implementId: string; layoutId: string; note: string }) =>
    approveImplementLayoutOnBehalf(implementId, layoutId, note),
  );
}

/** Reprovar — motivo obrigatório; volta só por versão nova. */
export function useReproveImplementArt() {
  return useArtAct(({ implementId, layoutId, note }: { implementId: string; layoutId: string; note: string }) =>
    reproveImplementLayout(implementId, layoutId, note),
  );
}

/** Versão nova de uma arte (a anterior vira SUBSTITUÍDA). */
export function useNewImplementArtVersion() {
  return useArtAct(({ implementId, layoutId, file }: { implementId: string; layoutId: string; file: File }) =>
    newImplementLayoutVersion(implementId, layoutId, file),
  );
}

/** Apaga um rascunho. */
export function useDeleteImplementArt() {
  return useArtAct(({ implementId, layoutId }: { implementId: string; layoutId: string }) =>
    deleteImplementLayout(implementId, layoutId),
  );
}

/** "Uma imagem para todos": a mesma arte, como rascunho, em todos os implementos dados. */
export function useApplyArtToImplements() {
  return useArtAct(({ implementIds, files }: { implementIds: string[]; files: File[] }) =>
    applyArtToImplements(implementIds, files),
  );
}

/** O projeto do implemento (PDFs do fabricante): `fileIds` ficam, `files` entram. */
export function useSetImplementProjectFiles() {
  return useArtAct(({ implementId, fileIds, files }: { implementId: string; fileIds: string[]; files?: File[] }) =>
    setImplementProjectFiles(implementId, fileIds, files ?? []),
  );
}
