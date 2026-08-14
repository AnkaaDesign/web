// hooks/administration/use-fiscal-emitter.ts
//
// Hooks do emissor fiscal (identidade MEI do prestador + certificado A1). Escritos à
// mão em vez de via `createEntityHooks`: o recurso não é um CRUD paginado — é um
// singleton por usuário com um upload multipart pendurado. Mesmo estilo ad-hoc de
// `hooks/financial/use-nfse.ts`.

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { fiscalEmitterService } from "@/api-client/fiscal-emitter";
import type { FiscalEmitterUpsertData } from "@/api-client/fiscal-emitter";
import { userKeys } from "../common/query-keys";

export const fiscalEmitterKeys = {
  all: ["fiscal-emitters"] as const,
  detail: (userId: string) => ["fiscal-emitters", "detail", userId] as const,
  certificates: (userId: string) => ["fiscal-emitters", "certificates", userId] as const,
};

/** Perfil fiscal + certificado ativo + sugestão de preenchimento do colaborador. */
export function useFiscalEmitter(userId: string, options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: fiscalEmitterKeys.detail(userId),
    queryFn: () => fiscalEmitterService.getFiscalEmitter(userId),
    enabled: (options?.enabled ?? true) && !!userId,
    staleTime: 5 * 60 * 1000,
  });
}

/** Histórico completo de certificados (inclui revogados/vencidos). */
export function useFiscalCertificates(userId: string, options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: fiscalEmitterKeys.certificates(userId),
    queryFn: () => fiscalEmitterService.getFiscalCertificates(userId),
    enabled: (options?.enabled ?? true) && !!userId,
    staleTime: 5 * 60 * 1000,
  });
}

/**
 * Invalida tudo que reflete o emissor fiscal do colaborador — inclusive o detalhe do
 * usuário, que é onde os dois cards vivem.
 */
function useInvalidateFiscalEmitter() {
  const queryClient = useQueryClient();
  return (userId: string) => {
    queryClient.invalidateQueries({ queryKey: fiscalEmitterKeys.detail(userId) });
    queryClient.invalidateQueries({ queryKey: fiscalEmitterKeys.certificates(userId) });
    queryClient.invalidateQueries({ queryKey: userKeys.details() });
  };
}

export function useUpsertFiscalEmitter() {
  const invalidate = useInvalidateFiscalEmitter();
  return useMutation({
    mutationFn: ({ userId, data }: { userId: string; data: FiscalEmitterUpsertData }) => fiscalEmitterService.upsertFiscalEmitter(userId, data),
    onSuccess: (_result, variables) => invalidate(variables.userId),
  });
}

export function useToggleFiscalEmission() {
  const invalidate = useInvalidateFiscalEmitter();
  return useMutation({
    mutationFn: ({ userId, enabled }: { userId: string; enabled: boolean }) => fiscalEmitterService.setEmissionEnabled(userId, enabled),
    onSuccess: (_result, variables) => invalidate(variables.userId),
  });
}

export function useUploadFiscalCertificate() {
  const invalidate = useInvalidateFiscalEmitter();
  return useMutation({
    mutationFn: ({ userId, file, password }: { userId: string; file: File; password: string }) => fiscalEmitterService.uploadFiscalCertificate(userId, file, password),
    onSuccess: (_result, variables) => invalidate(variables.userId),
  });
}

/**
 * Revoga o certificado. A rota é do CERTIFICADO (não do usuário), então o `userId`
 * vem junto só para saber o que invalidar depois.
 */
export function useRevokeFiscalCertificate() {
  const invalidate = useInvalidateFiscalEmitter();
  return useMutation({
    mutationFn: ({ certificateId }: { certificateId: string; userId: string }) => fiscalEmitterService.revokeFiscalCertificate(certificateId),
    onSuccess: (_result, variables) => invalidate(variables.userId),
  });
}
