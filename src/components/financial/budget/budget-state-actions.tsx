/**
 * OS ATOS DO EIXO DO VALOR — no ÚLTIMO passo, junto do "Salvar".
 *
 * O orçamento tem quatro eixos independentes (valor, arte de cada implemento,
 * assinatura, cobrança). Este card cuida do VALOR, e cada botão é um ATO que
 * chama a rota NA HORA (Modelo C, P14):
 *
 *  · "Enviar para aprovação do cliente" — `PUT /budgets/:id/send-to-customer`
 *    (de Requisição, Pendente ou Aguardando Reanálise). Exige valor.
 *  · "Retirar do cliente" — `PUT …/withdraw-from-customer` (motivo opcional).
 *  · "Aprovar valor em nome do cliente" — `PUT …/value-approval`, com NOTA
 *    obrigatória (como o cliente aprovou: e-mail, telefone, reunião).
 *  · "Reprovar valor" — `DELETE …/value-approval`, com MOTIVO obrigatório.
 *
 * Era um seletor que escrevia o estado no FORMULÁRIO para o Salvar replicar
 * salto a salto — e a API passou a recusar `APPROVED` sem nota, o que deixava
 * a aprovação em 400. Ato tem autor, origem e nota; campo não tem.
 *
 * ⚠️ O ATO VALE SOBRE O QUE ESTÁ GRAVADO. Com alterações por salvar, os botões
 * ficam desabilitados e o card pede para salvar antes — senão o cliente
 * aprovaria um valor que não é o que está na tela.
 *
 * ⛔ COLETA VIVA CALA OS ATOS. Com a coleta de assinaturas em andamento ou
 * concluída, o documento já saiu; o card diz onde ela está e leva até ela.
 */

import { useState } from "react";
import { IconArrowRight, IconClock, IconSignature } from "@tabler/icons-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { TASK_QUOTE_STATUS } from "@/constants";
import {
  useApproveBudgetValue,
  useRevokeBudgetValueApproval,
  useSendBudgetToCustomer,
  useWithdrawBudgetFromCustomer,
} from "@/hooks/production/use-budget";
import type { TASK_QUOTE_STATUS as QuoteStatus } from "@/types/budget";
import { getAvailableQuoteStatusTransitions } from "@/utils/permissions/quote-permissions";
import type { QuoteEnvelopeGlance } from "./use-quote-envelopes";

type ActKind = "send" | "withdraw" | "approve" | "revoke";

interface ActConfig {
  label: string;
  hint: string;
  /** O destino no grafo — é ele que o papel e as arestas do contrato liberam. */
  to: QuoteStatus;
  primary?: boolean;
  /** O texto pedido no diálogo; ausente = o ato não abre diálogo. */
  text?: { title: string; description: string; placeholder: string; required: boolean; confirm: string };
}

const ACTS: Record<ActKind, ActConfig> = {
  send: {
    label: "Enviar para aprovação do cliente",
    hint: "Os valores aparecem no portal para o contato do cliente aprovar ou recusar.",
    to: TASK_QUOTE_STATUS.IN_NEGOTIATION as QuoteStatus,
    primary: true,
  },
  withdraw: {
    label: "Retirar do cliente",
    hint: "O orçamento volta para a sua mesa; o cliente deixa de ver os valores para aprovar.",
    to: TASK_QUOTE_STATUS.PENDING as QuoteStatus,
    text: {
      title: "Retirar do cliente",
      description: "O orçamento volta para Pendente. Se quiser, diga o motivo (fica no histórico).",
      placeholder: "Motivo (opcional)",
      required: false,
      confirm: "Retirar",
    },
  },
  approve: {
    label: "Aprovar valor em nome do cliente",
    hint: "Quando o cliente aprovou fora do portal. Exige a nota de como ele aprovou.",
    to: TASK_QUOTE_STATUS.APPROVED as QuoteStatus,
    text: {
      title: "Aprovar valor em nome do cliente",
      description:
        "Escreva como o cliente aprovou o valor — por onde, quem e quando (ex.: \"aprovado por e-mail em 02/10, Fulano, Compras\").",
      placeholder: "Como o cliente aprovou",
      required: true,
      confirm: "Aprovar valor",
    },
  },
  revoke: {
    label: "Reprovar valor",
    hint: "Desfaz a aprovação do valor e devolve o orçamento a Pendente.",
    to: TASK_QUOTE_STATUS.PENDING as QuoteStatus,
    text: {
      title: "Reprovar valor",
      description: "O orçamento volta para Pendente e a aprovação do valor é encerrada. O motivo é obrigatório.",
      placeholder: "Motivo da reprovação",
      required: true,
      confirm: "Reprovar",
    },
  },
};

/** Que atos cada estado oferece, na ordem em que aparecem. */
const ACTS_BY_STATUS: Partial<Record<QuoteStatus, ActKind[]>> = {
  [TASK_QUOTE_STATUS.REQUESTED]: ["send", "approve"],
  [TASK_QUOTE_STATUS.PENDING]: ["send", "approve"],
  [TASK_QUOTE_STATUS.EXPIRED]: ["send"],
  [TASK_QUOTE_STATUS.IN_NEGOTIATION]: ["approve", "withdraw"],
  [TASK_QUOTE_STATUS.APPROVED]: ["revoke"],
};

const WAITING_HINT: Partial<Record<QuoteStatus, string>> = {
  [TASK_QUOTE_STATUS.IN_NEGOTIATION]:
    "Com o cliente. O contato aprova ou recusa no portal — recusar devolve o orçamento para você refazer, com o motivo escrito.",
  [TASK_QUOTE_STATUS.APPROVED]:
    "Valor aprovado. O próximo passo é a assinatura: a coleta é emitida na Assinatura eletrônica, logo abaixo, quando a arte de todos os veículos estiver aprovada.",
};

interface BudgetStateActionsProps {
  budgetId?: string | null;
  /** O estado GRAVADO do eixo do valor. */
  status?: QuoteStatus | string | null;
  /**
   * A COLETA DE ASSINATURAS, quando existe. Vem da consulta compartilhada
   * (`useQuoteEnvelopes` + `envelopeGlanceOf`), a mesma do card da Assinatura
   * eletrônica abaixo. `null` enquanto carrega ou quando nunca houve coleta.
   */
  envelope?: QuoteEnvelopeGlance | null;
  userRole?: string;
  disabled?: boolean;
  /** Há alterações não salvas: os atos valem sobre o gravado, então pedem para salvar antes. */
  hasUnsavedChanges?: boolean;
  /** Leva até o card de assinatura eletrônica, nesta mesma tela. */
  onGoToSignature?: () => void;
}

export function BudgetStateActions({
  budgetId,
  status,
  envelope,
  userRole = "",
  disabled,
  hasUnsavedChanges,
  onGoToSignature,
}: BudgetStateActionsProps) {
  const current = (status || "") as QuoteStatus;
  const [openAct, setOpenAct] = useState<ActKind | null>(null);
  const [text, setText] = useState("");

  const send = useSendBudgetToCustomer();
  const withdraw = useWithdrawBudgetFromCustomer();
  const approve = useApproveBudgetValue();
  const revoke = useRevokeBudgetValueApproval();
  const busy = send.isPending || withdraw.isPending || approve.isPending || revoke.isPending;

  // ⛔ A COLETA VIVA CALA TODO O RESTO: o documento já saiu (e pode já estar
  // assinado); o estado do valor é, nesses casos, só o que ficou para trás.
  const liveEnvelope = envelope?.live ? envelope : null;

  // Só os atos que o GRAFO do contrato e o PAPEL permitem a partir de onde o
  // orçamento está gravado.
  const allowed = current ? getAvailableQuoteStatusTransitions(current, userRole) : [];
  const acts =
    liveEnvelope || !budgetId ? [] : (ACTS_BY_STATUS[current] ?? []).filter((kind) => allowed.includes(ACTS[kind].to));
  const waiting = liveEnvelope ? undefined : WAITING_HINT[current];
  const actsDisabled = disabled || busy || !!hasUnsavedChanges;

  if (acts.length === 0 && !waiting && !liveEnvelope) return null;

  const run = async (kind: ActKind, value: string) => {
    if (!budgetId) return;
    if (kind === "send") await send.mutateAsync(budgetId);
    else if (kind === "withdraw") await withdraw.mutateAsync({ id: budgetId, reason: value });
    else if (kind === "approve") await approve.mutateAsync({ id: budgetId, note: value });
    else await revoke.mutateAsync({ id: budgetId, reason: value });
  };

  const handleClick = (kind: ActKind) => {
    if (ACTS[kind].text) {
      setText("");
      setOpenAct(kind);
      return;
    }
    void run(kind, "").catch(() => undefined);
  };

  const dialog = openAct ? ACTS[openAct] : null;
  const trimmed = text.trim();
  const canConfirm = !!dialog?.text && (!dialog.text.required || trimmed.length > 0) && !busy;

  return (
    <Card className="mb-4 border border-border">
      <CardContent className="space-y-3 p-4">
        {liveEnvelope && (
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <p className="text-sm font-semibold">
                {liveEnvelope.status === "COMPLETED" ? "Orçamento assinado" : "Coleta de assinaturas em andamento"}
              </p>
              <p className="flex items-start gap-2 text-sm text-muted-foreground">
                <IconSignature className="mt-0.5 h-4 w-4 shrink-0" />
                {liveEnvelope.status === "COMPLETED"
                  ? `Todas as ${liveEnvelope.total} assinaturas foram colhidas. O documento está selado, e mexer no orçamento agora invalida a coleta.`
                  : `${liveEnvelope.signed} de ${liveEnvelope.total} já assinaram. O documento já está com o cliente — acompanhe (ou cancele) na Assinatura eletrônica, logo abaixo.`}
              </p>
            </div>
            {onGoToSignature && (
              <Button type="button" variant="outline" className="shrink-0 gap-1.5" onClick={onGoToSignature}>
                Ir para a assinatura
                <IconArrowRight className="h-4 w-4" />
              </Button>
            )}
          </div>
        )}

        {acts.length > 0 && (
          <>
            <p className="text-sm font-semibold">O valor deste orçamento</p>
            <div className="flex flex-col gap-3 sm:flex-row">
              {acts.map((kind) => (
                <div key={kind} className="flex-1 space-y-1">
                  <Button
                    type="button"
                    variant={ACTS[kind].primary ? "default" : "outline"}
                    className="w-full"
                    disabled={actsDisabled}
                    onClick={() => handleClick(kind)}
                  >
                    {ACTS[kind].label}
                  </Button>
                  <p className="text-sm text-muted-foreground">{ACTS[kind].hint}</p>
                </div>
              ))}
            </div>
            {hasUnsavedChanges && (
              <p className="rounded-lg bg-muted/50 px-4 py-2.5 text-sm">
                Há alterações não salvas. <strong>Salve</strong> antes: os atos valem sobre o orçamento gravado.
              </p>
            )}
          </>
        )}

        {waiting && (
          <p className="flex items-start gap-2 text-sm text-muted-foreground">
            <IconClock className="mt-0.5 h-4 w-4 shrink-0" />
            {waiting}
          </p>
        )}
      </CardContent>

      <Dialog open={!!dialog} onOpenChange={(open) => !open && setOpenAct(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{dialog?.text?.title}</DialogTitle>
            <DialogDescription>{dialog?.text?.description}</DialogDescription>
          </DialogHeader>
          <Textarea
            value={text}
            onChange={(event) => setText(event.target.value)}
            placeholder={dialog?.text?.placeholder}
            maxLength={2000}
            rows={4}
            autoFocus
          />
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpenAct(null)} disabled={busy}>
              Cancelar
            </Button>
            <Button
              type="button"
              disabled={!canConfirm}
              onClick={async () => {
                if (!openAct) return;
                try {
                  await run(openAct, trimmed);
                  setOpenAct(null);
                } catch {
                  // O interceptor do axios já mostrou o erro; o diálogo fica aberto
                  // para o operador corrigir a nota.
                }
              }}
            >
              {dialog?.text?.confirm}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
