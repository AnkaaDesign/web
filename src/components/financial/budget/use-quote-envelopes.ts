/**
 * A COLETA DE ASSINATURAS DO ORÇAMENTO — UMA consulta para a tela inteira.
 *
 * ⚠️ POR QUE ISTO EXISTE. O `SignatureEnvelopeCard` guardava os envelopes em
 * `useState` próprio, e era o ÚNICO lugar da página que sabia da coleta. O card
 * de encaminhamento (`budget-state-actions.tsx`), que decide se ainda faz
 * sentido oferecer "Enviar para pré-aprovação", ficava decidindo só pelo
 * `status` do orçamento — e `status` MENTE: há orçamentos em `REQUESTED` com
 * coleta `RUNNING` e assinaturas já colhidas (o servidor não movia o estado ao
 * emitir o envelope). O resultado em tela era convidar a mandar para
 * pré-aprovação um orçamento que o cliente já tinha assinado.
 *
 * Uma consulta compartilhada é o conserto certo, e não um segundo `fetch`: com a
 * MESMA chave o react-query serve os dois consumidores com uma requisição só, e
 * o `refetch` que o card dispara depois de cancelar/reemitir atualiza também o
 * card de ações. Dois `fetch` independentes discordariam na primeira ação.
 */

import { useQuery } from "@tanstack/react-query";

import { signatureService } from "@/api-client/signature";

export const quoteEnvelopeKeys = {
  all: ["signature-envelopes"] as const,
  forQuote: (quoteId: string) => ["signature-envelopes", "quote", quoteId] as const,
};

/**
 * Uma coleta é VIVA quando já saiu para o cliente e não foi derrubada.
 *
 * `COMPLETED` entra junto de `RUNNING` de propósito: um orçamento assinado por
 * todos está ainda MENOS disponível para "enviar para pré-aprovação" do que um
 * em coleta. `INVALIDATED` e `CANCELLED` ficam de fora — ali a coleta morreu e
 * refazer o caminho é exatamente o que se espera.
 */
const LIVE_ENVELOPE_STATUSES = new Set(["RUNNING", "COMPLETED"]);

/** O recorte de que quem só precisa decidir "posso oferecer isto?" vive. */
export interface QuoteEnvelopeGlance {
  id: string;
  /** RUNNING | COMPLETED | INVALIDATED | CANCELLED | … */
  status: string;
  signed: number;
  total: number;
  /** `true` para RUNNING e COMPLETED — ver `LIVE_ENVELOPE_STATUSES`. */
  live: boolean;
}

interface EnvelopeShape {
  id: string;
  status: string;
  signers?: Array<{ status?: string | null }> | null;
}

/**
 * O envelope ATUAL e o essencial dele.
 *
 * ⚠️ `envelopes[0]` é o corrente — é assim que o card lê a lista (o resto é
 * histórico). A ordenação é do servidor; ler outro índice aqui faria as duas
 * partes da mesma tela falarem de envelopes diferentes.
 */
export function envelopeGlanceOf(
  envelopes: readonly EnvelopeShape[] | null | undefined,
): QuoteEnvelopeGlance | null {
  const current = envelopes?.[0];
  if (!current) return null;
  const signers = current.signers ?? [];
  return {
    id: current.id,
    status: current.status,
    signed: signers.filter((s) => s?.status === "SIGNED").length,
    total: signers.length,
    live: LIVE_ENVELOPE_STATUSES.has(current.status),
  };
}

/**
 * Os envelopes do orçamento, do mais novo para o mais antigo.
 *
 * ⚠️ `retry: false` e erro engolido pelo chamador: ausência de coleta não é
 * falha, e uma tela que travasse num erro de leitura de envelope impediria de
 * emitir o primeiro.
 */
export function useQuoteEnvelopes<T = EnvelopeShape>(quoteId?: string | null) {
  return useQuery<T[]>({
    queryKey: quoteEnvelopeKeys.forQuote(quoteId ?? ""),
    queryFn: async () => {
      const res: any = await signatureService.listForQuote(quoteId as string);
      return (res?.data?.data ?? res?.data ?? []) as T[];
    },
    enabled: !!quoteId,
    staleTime: 0,
    retry: false,
    refetchOnWindowFocus: false,
  });
}
