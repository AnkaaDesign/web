/**
 * AS AÇÕES DE ESTADO DO ORÇAMENTO — no ÚLTIMO passo, junto do "Salvar".
 *
 * ⚠️ POR QUE SAÍRAM DA REQUISIÇÃO. Os dois botões ("Enviar para pré-aprovação"
 * e "Enviar para assinatura") moravam no card da requisição, que fica ACIMA do
 * assistente e portanto aparecia em TODOS os passos — na prática, no passo 3
 * (Serviços), que é onde o comercial passa o tempo. O card precisava avisar,
 * logo abaixo dos botões, que "o estado só muda quando você salvar — monte os
 * serviços e os preços antes": o aviso existia porque o botão estava no lugar
 * errado. Um botão que pede para ser clicado depois não é um botão, é uma nota.
 *
 * Aqui não há nota a dar: o Resumo é o passo em que o orçamento está montado, é
 * onde o "Salvar" do cabeçalho aparece, e o clique daqui é a última coisa que
 * acontece antes dele. A REQUISIÇÃO ficou onde ela decide alguma coisa (passo 1,
 * faixa no passo 3, Resumo — ver `budget-request-card.tsx`), e sem nada que mude
 * estado.
 *
 * ⚠️ NÃO CHAMA A API. Escreve no formulário (`setValue("status", …)`) e o
 * assistente grava tudo de uma vez no Salvar — o mesmo contrato de antes. Um
 * botão que disparasse a transição na hora correria com os preços ainda na tela.
 *
 * ⛔ O `status` NÃO É A ÚNICA FONTE — e sozinho ele mente. Existem orçamentos
 * em `REQUESTED` com coleta de assinaturas `RUNNING` e assinaturas já colhidas
 * (a emissão do envelope não movia o estado no servidor). Decidindo só pelo
 * `status`, esta tela oferecia "Enviar para pré-aprovação" num orçamento que o
 * cliente JÁ tinha assinado — pedir de volta uma aprovação que já existe, e num
 * clique reabrir um documento selado. Por isso a COLETA entra na decisão: viva
 * a coleta (`RUNNING`/`COMPLETED`), nenhum encaminhamento é oferecido e o card
 * diz o que está acontecendo, apontando para a Assinatura eletrônica logo
 * abaixo. Ver `use-quote-envelopes.ts`.
 */

import { IconArrowRight, IconClock, IconSignature } from "@tabler/icons-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { TASK_QUOTE_STATUS, TASK_QUOTE_STATUS_LABELS } from "@/constants";
import type { TASK_QUOTE_STATUS as QuoteStatus } from "@/types/budget";
import { getAvailableQuoteStatusTransitions } from "@/utils/permissions/quote-permissions";
import type { QuoteEnvelopeGlance } from "./use-quote-envelopes";

interface Advance {
  to: QuoteStatus;
  label: string;
  hint: string;
  primary?: boolean;
}

/**
 * O QUE CADA ESTADO DO PORTAL OFERECE AQUI.
 *
 * ⚠️ `PRE_APPROVED` NÃO TEM BOTÃO DE ESTADO, e isso é regra e não esquecimento:
 * a aresta `PRE_APPROVED → PENDING` é escrita pela EMISSÃO DO ENVELOPE (ver
 * `validateStatusTransition` na api). Um botão que escrevesse "Aguardando
 * Assinatura" sem emitir coleta nenhuma anunciaria um documento que não existe.
 * O que esse estado oferece é o caminho até a coleta, logo abaixo nesta mesma
 * tela — ver `SIGNATURE_HINT`.
 *
 * `IN_NEGOTIATION` também não tem: quem decide dali é o vendedor do cliente, no
 * portal. Voltar atrás continua possível pelo seletor de status do Resumo, que
 * é o caminho geral e oferece todas as arestas legais.
 */
const ADVANCES: Partial<Record<QuoteStatus, Advance[]>> = {
  [TASK_QUOTE_STATUS.REQUESTED]: [
    {
      to: TASK_QUOTE_STATUS.IN_NEGOTIATION as QuoteStatus,
      label: "Enviar para pré-aprovação",
      hint: "O vendedor do cliente passa a ver os valores e decide aprovar ou recusar.",
      primary: true,
    },
    // ⛔ AQUI HAVIA UM SEGUNDO BOTÃO, "Enviar para assinatura", E ELE SAIU.
    //
    // Havia DOIS "Enviar para assinatura" nesta mesma tela, com o mesmo rótulo
    // e atos DIFERENTES: este só trocava o ESTADO para Aguardando Assinatura; o
    // da "Assinatura eletrônica", logo abaixo, EMITE o documento. Quem clicasse
    // no de cima anunciava uma coleta que não existia.
    //
    // E desde que a EMISSÃO passou a escrever o estado no mesmo commit do
    // envelope (`createEnvelope`, na api), este botão deixou de ter função:
    // emitir já leva o orçamento para Aguardando Assinatura. O que ele produzia
    // era a deriva INVERSA da que acabamos de consertar — estado dizendo
    // "aguardando assinatura" sem documento nenhum emitido.
    //
    // A porta passa a ser uma só: a coleta. `SIGNATURE_HINT` leva até ela.
  ],
};

/** O que dizer quando não há botão de estado a oferecer. */
const WAITING_HINT: Partial<Record<QuoteStatus, string>> = {
  [TASK_QUOTE_STATUS.IN_NEGOTIATION]:
    "Com o vendedor do cliente. Ele aprova ou recusa no portal — e recusar devolve o orçamento para você refazer, com o motivo escrito.",
};

const SIGNATURE_HINT: Partial<Record<QuoteStatus, string>> = {
  [TASK_QUOTE_STATUS.PRE_APPROVED]:
    "O cliente pré-aprovou os valores. Falta lançar as assinaturas: a coleta é emitida na Assinatura eletrônica, logo abaixo, e é ela que leva o orçamento para Aguardando Assinatura.",
  // Requisição também aponta para a coleta — é o caminho de quem NÃO vai passar
  // pelo vendedor do cliente (o botão de pré-aprovação, acima, é o outro).
  [TASK_QUOTE_STATUS.REQUESTED]:
    "Sem vendedor intermediário a consultar, vá direto ao documento: a coleta é emitida na Assinatura eletrônica, logo abaixo, e é ela que leva o orçamento para Aguardando Assinatura.",
};

interface BudgetStateActionsProps {
  /** O estado do FORMULÁRIO — pode ter avanço escolhido e não salvo. */
  status?: QuoteStatus | string | null;
  /** O estado GRAVADO, para dizer em uma linha o que o Salvar vai fazer. */
  serverStatus?: QuoteStatus | string | null;
  /**
   * A COLETA DE ASSINATURAS, quando existe — o segundo eixo da decisão.
   *
   * Vem da consulta compartilhada (`useQuoteEnvelopes` + `envelopeGlanceOf`),
   * a mesma que alimenta o card da Assinatura eletrônica abaixo. `null`
   * enquanto carrega ou quando nunca houve coleta.
   */
  envelope?: QuoteEnvelopeGlance | null;
  userRole?: string;
  disabled?: boolean;
  /** Escreve o estado NO FORMULÁRIO. Nada aqui chama a API. */
  onAdvance?: (next: QuoteStatus) => void;
  /** Leva até o card de assinatura eletrônica, nesta mesma tela. */
  onGoToSignature?: () => void;
}

export function BudgetStateActions({
  status,
  serverStatus,
  envelope,
  userRole = "",
  disabled,
  onAdvance,
  onGoToSignature,
}: BudgetStateActionsProps) {
  const current = (status || "") as QuoteStatus;

  // ⛔ A COLETA VIVA CALA TODO O RESTO. Ela é um fato do mundo (o documento já
  // saiu, e pode já estar assinado); o `status` é, nesses casos, apenas o que
  // ficou para trás. Ver o cabeçalho do arquivo.
  const liveEnvelope = envelope?.live ? envelope : null;

  // Só os avanços que o GRAFO e o PAPEL permitem a partir de onde o orçamento
  // está agora — a mesma fonte que o seletor de status do Resumo consulta.
  const allowed = current ? getAvailableQuoteStatusTransitions(current, userRole) : [];
  const advances = liveEnvelope ? [] : (ADVANCES[current] ?? []).filter((a) => allowed.includes(a.to));
  const waiting = liveEnvelope ? undefined : WAITING_HINT[current];
  const signature = liveEnvelope ? undefined : SIGNATURE_HINT[current];

  // O que o Salvar vai fazer, quando o formulário já carrega um estado
  // diferente do gravado. Sem esta linha o clique no botão não devolve sinal
  // nenhum: os botões somem (a condição deixou de valer) e o único outro lugar
  // que mostra o estado escolhido é o seletor lá em cima.
  const pendingAdvance =
    serverStatus && status && status !== serverStatus
      ? (TASK_QUOTE_STATUS_LABELS[status as QuoteStatus] ?? status)
      : null;

  if (advances.length === 0 && !waiting && !signature && !pendingAdvance && !liveEnvelope) return null;

  return (
    <Card className="mb-4 border border-border">
      <CardContent className="space-y-3 p-4">
        {/* ── A COLETA JÁ EM CURSO ────────────────────────────────────────────
            Ocupa o lugar dos botões, e não uma linha ao lado deles: o operador
            que lê "já está assinado" com um "Enviar para pré-aprovação" logo
            acima acredita no botão. Diz onde a coleta está e leva até ela. */}
        {liveEnvelope && (
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <p className="text-sm font-semibold">
                {liveEnvelope.status === "COMPLETED"
                  ? "Orçamento assinado"
                  : "Coleta de assinaturas em andamento"}
              </p>
              <p className="flex items-start gap-2 text-sm text-muted-foreground">
                <IconSignature className="mt-0.5 h-4 w-4 shrink-0" />
                {liveEnvelope.status === "COMPLETED"
                  ? `Todas as ${liveEnvelope.total} assinaturas foram colhidas. Não há encaminhamento a fazer: o documento está selado, e mexer no orçamento agora invalida a coleta.`
                  : `${liveEnvelope.signed} de ${liveEnvelope.total} já assinaram. Não há o que encaminhar — o documento já está com o cliente. Acompanhe (ou cancele) na Assinatura eletrônica, logo abaixo.`}
              </p>
            </div>
            {onGoToSignature && (
              <Button
                type="button"
                variant="outline"
                className="shrink-0 gap-1.5"
                onClick={onGoToSignature}
              >
                Ir para a assinatura
                <IconArrowRight className="h-4 w-4" />
              </Button>
            )}
          </div>
        )}

        {advances.length > 0 && (
          <>
            <p className="text-sm font-semibold">Encaminhar este orçamento</p>
            <div className="flex flex-col gap-3 sm:flex-row">
              {advances.map((advance) => (
                <div key={advance.to} className="flex-1 space-y-1">
                  <Button
                    type="button"
                    variant={advance.primary ? "default" : "outline"}
                    className="w-full"
                    disabled={disabled || !onAdvance}
                    onClick={() => onAdvance?.(advance.to)}
                  >
                    {advance.label}
                  </Button>
                  {/* A CONSEQUÊNCIA escrita embaixo: a diferença entre os dois é
                      quem passa a ver o valor, e ela não cabe num rótulo. */}
                  <p className="text-sm text-muted-foreground">{advance.hint}</p>
                </div>
              ))}
            </div>
          </>
        )}

        {waiting && (
          <p className="flex items-start gap-2 text-sm text-muted-foreground">
            <IconClock className="mt-0.5 h-4 w-4 shrink-0" />
            {waiting}
          </p>
        )}

        {signature && (
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <p className="flex items-start gap-2 text-sm text-muted-foreground">
              <IconSignature className="mt-0.5 h-4 w-4 shrink-0" />
              {signature}
            </p>
            {onGoToSignature && (
              <Button
                type="button"
                variant="outline"
                className="shrink-0 gap-1.5"
                onClick={onGoToSignature}
              >
                Ir para a assinatura
                <IconArrowRight className="h-4 w-4" />
              </Button>
            )}
          </div>
        )}

        {pendingAdvance && (
          <p className="rounded-lg bg-muted/50 px-4 py-2.5 text-sm">
            Ao <strong>salvar</strong>, o orçamento vai para <strong>{pendingAdvance}</strong>.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
