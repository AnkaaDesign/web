/**
 * A REQUISIÇÃO DO CLIENTE, dentro da tela em que ela vira orçamento.
 *
 * Um orçamento em `REQUESTED` é um pedido: tem briefing, arquivos-base e
 * veículos, e NÃO tem serviço nem valor. O que o comercial precisa para
 * transformá-lo em orçamento já está todo no assistente ao lado — veículo no
 * passo 1, tinta no passo 1, arquivos-base no passo 1, serviços e preços no
 * passo 3. O que NÃO existia em tela nenhuma é o que o cliente ESCREVEU, e é só
 * isso que este painel acrescenta.
 *
 * ⚠️ POR QUE AQUI E NÃO NUMA TELA NOVA. "Caixa de entrada de requisições" é
 * tentador como página própria, e seria uma segunda arquitetura para a mesma
 * coisa: a lista de Orçamentos já traz as requisições — `BUDGET_QUOTE_STATUSES`
 * inclui `REQUESTED`, o `where` padrão é a lista inteira, e `statusOrder` 1
 * coloca toda requisição no TOPO da ordenação padrão —, o clique na linha já
 * abre o assistente, e o assistente já é "montar o orçamento a partir disto".
 * Uma tela paralela duplicaria o cadastro do veículo, o seletor de tinta, o
 * upload de arquivo-base e o seletor de status, e as duas divergiriam.
 *
 * O painel fica ACIMA dos passos, e não dentro de um deles, porque não é campo
 * de passo nenhum — é leitura. MAS ele não aparece em todos: ver `variant`.
 *
 * ⚠️ ONDE ELE APARECE, E POR QUÊ (20/09/2026). Ele era desenhado inteiro nos
 * CINCO passos, e virou moldura: quem está preenchendo prazos ou condição de
 * pagamento relia pela quinta vez quem pediu, quando pediu e a tabela de placas.
 * Agora:
 *
 *   · passo 1 (Tarefa) — INTEIRO. É o insumo para montar a tarefa: a tinta que o
 *     cliente pediu, os arquivos-base que ele mandou e as placas/séries que vão
 *     ser digitadas ao lado estão todos aqui, e conferi-los é o trabalho do passo.
 *   · passo 3 (Serviços) — RESUMO. O briefing é o que diz QUE serviços cobrar, e
 *     tirá-lo daqui seria perder o insumo; mas quem digita preço não precisa da
 *     ficha inteira. Fica uma faixa de uma linha, que abre o briefing no lugar.
 *   · último passo (Resumo) — INTEIRO. É a conferência final do que foi montado
 *     contra o que o cliente pediu, e é onde a RECUSA precisa estar à mão.
 *   · passos 2 e de Cliente — NADA. Prazos, garantia, layout aprovado, cadastro
 *     e condição de pagamento não se decidem pelo briefing.
 *
 * ⚠️ SEM AÇÃO DE ESTADO AQUI (20/09/2026). Os botões de avanço viviam neste
 * card, e como ele fica ACIMA do assistente eles apareciam em TODOS os passos —
 * na prática, no passo 3, onde o comercial digita preço. Tanto que precisavam
 * de uma nota logo abaixo ("o estado só muda quando você salvar — monte os
 * serviços e os preços antes"): o aviso existia porque o botão estava longe da
 * decisão. Foram para o ÚLTIMO passo, junto do Salvar, em
 * `budget-state-actions.tsx`. O que sobra aqui é leitura — e leitura também tem
 * hora, que é o que `variant` acima resolve.
 *
 * ⚠️ A RECUSA é a informação mais importante desta tela. Recusa não é
 * cancelamento: o orçamento VOLTA para o comercial refazer, e o motivo é a única
 * instrução que ele recebe. Por isso ela abre o painel sozinha, vem antes do
 * briefing e é a única coisa aqui pintada em destructive.
 */

import { useContext, useEffect, useRef, useState } from "react";
import {
  IconAlertTriangle,
  IconChevronDown,
  IconCircleCheck,
  IconClipboardText,
  IconPalette,
  IconPaperclip,
  IconUser,
} from "@tabler/icons-react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { FileThumbnail, FileViewerContext } from "@/components/common/file";
import { TASK_QUOTE_STATUS } from "@/constants";
import { formatDateTime } from "@/utils";
import { cn } from "@/lib/utils";
import type { File as AnkaaFile } from "@/types";
import type { Task } from "@/types/task";
import type { TASK_QUOTE_STATUS as QuoteStatus } from "@/types/budget";
import { budgetRequestDecision, type BudgetRequest } from "@/types/budget-request";

interface BudgetRequestCardProps {
  request: BudgetRequest;
  /** O estado ATUAL do orçamento — o do FORMULÁRIO, que pode ter avanço escolhido e não salvo. */
  status?: QuoteStatus | string | null;
  /** O veículo por onde a tela foi aberta; é dele que saem tinta e arquivos-base. */
  task?: Task | null;
  /**
   * TODOS os veículos do orçamento — a requisição os manda em lote (um par
   * série/placa explícito por linha, nunca um produto cartesiano).
   *
   * ⚠️ Vem do ORÇAMENTO (`Budget.tasks`), não de `task`: a tela é aberta pelo id
   * de UM veículo e o orçamento cobre N. Listá-los aqui evita que o comercial
   * tenha de andar até o passo de Revisão só para saber de quantos caminhões o
   * cliente está falando enquanto lê o briefing.
   */
  vehicles?: RequestVehicle[];
  /**
   * QUANTO da requisição desenhar. Ver o cabeçalho do arquivo.
   *
   * `full` é a ficha inteira (quem pediu, quando, tinta, briefing, veículos,
   * arquivos-base). `summary` é uma faixa de UMA linha com o começo do briefing,
   * que abre o briefing inteiro — e mais nada. A decisão do cliente (recusa ou
   * pré-aprovação) aparece nas DUAS: ela é a informação que não pode sumir de
   * lugar nenhum.
   */
  variant?: "full" | "summary";
}

/** A primeira linha do briefing, para caber ao lado do título na faixa. */
function briefingPreview(briefing: string | null | undefined): string {
  const first = (briefing ?? "").split("\n").map((l) => l.trim()).find(Boolean) ?? "";
  return first.length > 160 ? `${first.slice(0, 159)}…` : first;
}

/** O recorte de veículo que a listagem usa — o mesmo trio do documento. */
export interface RequestVehicle {
  id: string;
  serialNumber?: string | null;
  implement?: { plate?: string | null; chassisNumber?: string | null } | null;
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-lg bg-muted/50 px-4 py-2.5">
      {/* Rótulo NÃO menor que o conteúdo ao lado — os dois em `text-sm`. */}
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className="text-sm font-medium text-right">{children}</span>
    </div>
  );
}

export function BudgetRequestCard({
  request,
  status,
  task,
  vehicles = [],
  variant = "full",
}: BudgetRequestCardProps) {
  const decision = budgetRequestDecision(request);
  const fileViewer = useContext(FileViewerContext);
  const isFull = variant === "full";

  // Aberto enquanto o pedido ainda é o assunto — requisição por precificar, ou
  // recusa por ler. Depois disso o painel é história e nasce recolhido.
  //
  // ⚠️ ABRE UMA VEZ, por efeito, e NUNCA por estado inicial. O `status` chega
  // DEPOIS do primeiro render (o formulário é semeado do orçamento num efeito),
  // então um `useState(condição)` avaliaria a condição contra o "PENDING" do
  // valor padrão e deixaria toda requisição recolhida. E abrir por efeito só na
  // PRIMEIRA vez é o que impede o painel de se fechar sozinho no instante em que
  // o usuário escolhe um avanço — a condição deixa de valer e o painel sumiria
  // debaixo do clique.
  //
  // ⚠️ NA FAIXA (`summary`) só a RECUSA abre sozinha. Abrir por "ainda é uma
  // requisição" desfaria justamente o que a faixa resolve no passo dos preços —
  // ela nasceria com o briefing inteiro aberto e seria o card de antes.
  const [open, setOpen] = useState(false);
  const autoOpened = useRef(false);
  const shouldOpen = isFull
    ? status === TASK_QUOTE_STATUS.REQUESTED || decision === "refused"
    : decision === "refused";
  useEffect(() => {
    if (!shouldOpen || autoOpened.current) return;
    autoOpened.current = true;
    setOpen(true);
  }, [shouldOpen]);

  const baseFiles = (task?.baseFiles ?? []) as AnkaaFile[];
  const paint = task?.generalPainting;

  return (
    <Card className="border border-border">
      <Collapsible open={open} onOpenChange={setOpen}>
        <CardHeader className={isFull ? "py-4" : "py-3"}>
          <CollapsibleTrigger className="flex w-full items-center justify-between gap-3 text-left hover:no-underline">
            <CardTitle className="flex min-w-0 flex-1 items-center gap-2 text-sm">
              <IconClipboardText className="h-4 w-4 shrink-0 text-muted-foreground" />
              <span className="shrink-0">
                {isFull ? "Requisição do cliente" : "O que o cliente pediu"}
              </span>
              {decision === "refused" && (
                <Badge variant="cancelled" className="ml-1 shrink-0">
                  Recusada
                </Badge>
              )}
              {decision === "preApproved" && (
                <Badge variant="indigo" className="ml-1 shrink-0">
                  Pré-aprovada
                </Badge>
              )}
              {/* O BRIEFING NA PRÓPRIA FAIXA. É o que faz dela um caminho e não
                  um botão: na maioria dos pedidos a primeira linha já responde
                  "que serviços são esses", e ninguém precisa abrir nada. */}
              {!isFull && !open && (
                <span className="min-w-0 truncate text-sm font-normal text-muted-foreground">
                  {briefingPreview(request.briefing) || "Sem briefing escrito."}
                </span>
              )}
            </CardTitle>
            <IconChevronDown className={cn("h-4 w-4 shrink-0 text-muted-foreground transition-transform", open && "rotate-180")} />
          </CollapsibleTrigger>
        </CardHeader>

        <CollapsibleContent>
          <CardContent className="space-y-4 pt-0">
            {/* ── A DECISÃO DO CLIENTE, antes de tudo ─────────────────────────
                Quem abre esta tela depois de uma recusa abriu por causa dela. */}
            {decision === "refused" && (
              <div className="rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-3">
                <div className="flex items-center gap-2 text-sm font-semibold text-destructive">
                  <IconAlertTriangle className="h-4 w-4 shrink-0" />
                  Recusado por {request.refusedBy?.name ?? "contato do cliente"}
                  {request.refusedAt ? ` em ${formatDateTime(request.refusedAt)}` : ""}
                </div>
                <p className="mt-2 whitespace-pre-wrap text-sm text-foreground">
                  {request.decisionNote?.trim() || "Sem motivo informado."}
                </p>
                <p className="mt-2 text-sm text-muted-foreground">
                  Recusa não cancela: refaça o orçamento e reenvie para pré-aprovação.
                </p>
              </div>
            )}

            {decision === "preApproved" && (
              <div className="rounded-lg border border-indigo-500/40 bg-indigo-500/10 px-4 py-3">
                <div className="flex items-center gap-2 text-sm font-semibold">
                  <IconCircleCheck className="h-4 w-4 shrink-0" />
                  Pré-aprovado por {request.preApprovedBy?.name ?? "contato do cliente"}
                  {request.preApprovedAt ? ` em ${formatDateTime(request.preApprovedAt)}` : ""}
                </div>
                {request.decisionNote?.trim() ? (
                  <p className="mt-2 whitespace-pre-wrap text-sm text-foreground">{request.decisionNote}</p>
                ) : null}
              </div>
            )}

            {/* ── QUEM PEDIU, E O QUE PEDIU ───────────────────────────────────
                Fora da faixa: no passo dos preços o nome do contato e a data do
                pedido não decidem nada. */}
            {isFull && (
            <div className="space-y-1">
              <Row label="Solicitado por">
                <span className="inline-flex items-center gap-1.5">
                  <IconUser className="h-3.5 w-3.5 text-muted-foreground" />
                  {request.requestedBy?.name ?? "—"}
                </span>
              </Row>
              <Row label="Solicitado em">{request.requestedAt ? formatDateTime(request.requestedAt) : "—"}</Row>
              {request.logoName ? <Row label="Logomarca">{request.logoName}</Row> : null}
              {paint ? (
                <Row label="Cor de pintura">
                  <span className="inline-flex items-center gap-2">
                    {paint.hex ? (
                      <span
                        className="inline-block h-3.5 w-3.5 rounded-full border border-border"
                        style={{ backgroundColor: paint.hex }}
                        aria-hidden
                      />
                    ) : (
                      <IconPalette className="h-3.5 w-3.5 text-muted-foreground" />
                    )}
                    {paint.name}
                  </span>
                </Row>
              ) : null}
            </div>
            )}

            {/* ── O BRIEFING — texto livre, preserva as quebras de linha ──────
                O único bloco que a faixa também desenha: é o insumo dos
                serviços. */}
            <div className="rounded-lg bg-muted/50 px-4 py-3">
              <p className="text-sm text-muted-foreground">Briefing</p>
              <p className="mt-1 whitespace-pre-wrap text-sm font-medium">{request.briefing}</p>
            </div>

            {/* Na faixa, os veículos cabem em UMA linha — a lista inteira está
                no passo 1 e no Resumo. */}
            {!isFull && vehicles.length > 0 && (
              <p className="text-sm text-muted-foreground">
                {vehicles.length === 1
                  ? "1 veículo neste orçamento."
                  : `${vehicles.length} veículos neste orçamento — a relação está no passo Tarefa e no Resumo.`}
              </p>
            )}

            {/* ⛔ A TABELA DE VEÍCULOS SAIU DAQUI — o dono pediu, e tem razão:
                logo abaixo, em "Informações Básicas", há o acordeão de veículos
                com série, placa, chassi e o nº do pedido, EDITÁVEIS. Repetir os
                mesmos três campos em leitura, dois dedos acima, só fazia o
                operador conferir duas vezes a mesma coisa — e dava duas fontes
                para o mesmo dado numa tela onde uma delas é a que se altera.
                A CONTAGEM fica: "quantos caminhões este orçamento cobre" é o
                que a requisição declara, e é o que o acordeão abaixo não diz
                num relance. */}

            {/* ── ARQUIVOS-BASE ──────────────────────────────────────────────
                São `Task.baseFiles`, os MESMOS que o passo 1 edita. Aqui eles
                aparecem só para olhar, ao lado do texto que os explica. */}
            {isFull && baseFiles.length > 0 && (
              <div className="rounded-lg bg-muted/50 px-4 py-3">
                <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
                  <IconPaperclip className="h-3.5 w-3.5" />
                  Arquivos-base
                  <Badge variant="secondary" className="ml-1">
                    {baseFiles.length}
                  </Badge>
                </p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {baseFiles.map((file, index) => (
                    <FileThumbnail
                      key={file.id}
                      file={file}
                      size="sm"
                      onClick={() => fileViewer?.actions?.viewFiles?.(baseFiles as never, index)}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* ── SEM AÇÃO DE ESTADO ─────────────────────────────────────────
                "Enviar para pré-aprovação" e "Enviar para assinatura" estão no
                ÚLTIMO passo do assistente (`budget-state-actions.tsx`), ao lado
                do Salvar — este card aparece em todos os passos e ali eles eram
                um convite a decidir antes de haver serviço e preço. */}
          </CardContent>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
}
