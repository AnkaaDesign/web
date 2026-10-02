// web/src/components/cliente/orcamento/orcamento-proposta-card.tsx
//
// A PROPOSTA — o cabeçalho do contrato, e os três blocos que saíram de dentro
// dele.
//
// ⛔ ERA UM CARD SÓ COM CINCO MICRO-GRUPOS HETEROGÊNEOS DENTRO. Identidade do
// documento, briefing da requisição, a decisão já tomada, o prazo, os valores e
// a garantia moravam no mesmo card, separados por molduras `rounded-lg border`
// inventadas ali — um desenho que esta casa não usa em lugar nenhum. O sistema
// separa assunto em CARD, não em moldura interna (`ui/detailpage/detail-section`
// é literalmente um card por seção), e é o que este arquivo faz agora:
//
//   • `OrcamentoPropostaCard`  — a identidade: número, cliente, datas, prazo —
//     E O QUE O CLIENTE PEDIU (logomarca e briefing);
//   • `OrcamentoValoresCard`   — subtotal e total, para o recorte RARO que vê
//     `PRICING` e não vê `SERVICES` (com os dois, os valores vivem no rodapé da
//     tabela de serviços, ao lado das linhas que os produzem);
//   • `OrcamentoGarantiaCard`  — a garantia;
//   • `OrcamentoDecisaoCard`   — a decisão JÁ TOMADA, e só ela.
//
// ⛔ O BRIEFING MUDOU DE CARD, e o dono nomeou o defeito: num orçamento em
// REQUISIÇÃO o card "A requisição" tinha UMA linha — o briefing —, porque
// logomarca, "Valor aprovado em", "Por" e "Observação" só existem depois de uma
// decisão. Um card inteiro, com cabeçalho e descrição, para uma linha de texto,
// logo abaixo de "Proposta", que é o card do mesmo assunto.
//
// Agora o que o cliente PEDIU (briefing, logomarca) mora na Proposta, que é o
// cabeçalho do documento, e o card de decisão só nasce QUANDO HÁ DECISÃO — com
// um título que a nomeia ("Aprovação do valor" / "Devolvido para refazer"), em vez
// de um rótulo genérico que valia para os dois e para nenhum.
//
// ⚠️ NENHUM `DetailRow` DAQUI TEM ÍCONE — ver a regra completa no cabeçalho de
// `components/cliente/portal-detail.tsx`. O ícone é do CARD; a linha
// rótulo/valor não tem. "Emitido em" tinha um calendário e as cinco linhas ao
// redor não tinham nada, e era exatamente isso que o dono estava vendo.
//
// ⛔ E O ESTADO SAIU DAQUI. Ele era um campo no meio da grade — a informação que
// o contato procura primeiro, escondida na sexta linha de um card. Agora é o
// badge ao lado do título da PÁGINA, que é onde o `DetailPage` da casa o põe.
//
// ⚠️ OS GRUPOS SÃO O RECORTE. `budget.pricing`, `budget.guarantee` e
// `budget.delivery` são `undefined` quando a seção não veio — não objetos de
// campos nulos. Por isso a checagem é a EXISTÊNCIA do grupo, e não
// `hasPortalSection` seguido de `typeof === "number"`: o segundo desenhava um
// bloco de valores vazio sempre que o orçamento ainda não tinha preço.
//
// ⚠️ E não existe desconto no orçamento. O desconto é do PAGADOR
// (`BudgetPayer.discountType`/`discountValue`) e aparece na tela de Cobranças. O
// tipo antigo declarava `discountValue` no topo, a linha era desenhada sob
// `typeof === "number"` — e nunca apareceu, porque o servidor nunca mandou.
import type { ReactNode } from "react";
import {
  IconArrowBackUp,
  IconCash,
  IconFileDescription,
  IconShieldCheck,
  IconThumbUp,
} from "@tabler/icons-react";

import type { PortalBudget } from "@/api-client/portal";
import { DetailRow } from "@/components/ui/detail-row";
import { formatCurrency, formatDate } from "@/utils";
import { PortalCard, PortalRows } from "../portal-detail";

/** Data em `tabular-nums`; sem data, o `DetailRow` desenha o traço itálico. */
/**
 * ⛔ FUNÇÃO, NUNCA COMPONENTE — e a diferença apaga o traço de vazio.
 *
 * Escrito como componente e usado em `value={<Data value={x} />}`, o que chega
 * ao `DetailRow` é um ELEMENTO JSX, e um elemento nunca é `undefined`. O
 * `value ?? <traço>` de `detail-row.tsx:94` não dispara, e a linha fica EM
 * BRANCO exatamente quando o dado falta — que é o único momento em que o traço
 * importa. Passa no `tsc`, passa na revisão, e só aparece com dado ausente.
 *
 * Chamada como função (`value={data(x)}`), ela devolve `undefined` de verdade e
 * o `DetailRow` desenha o traço.
 */
function data(value: string | null | undefined): ReactNode {
  return value ? <span className="tabular-nums">{formatDate(value)}</span> : undefined;
}

export function OrcamentoPropostaCard({
  budget,
  actions,
}: {
  budget: PortalBudget;
  /**
   * Os botões de decisão, quando houver.
   *
   * ⛔ FICAM AQUI, E NÃO NO CABEÇALHO DA PÁGINA. O `headerExtra` do `PageHeader`
   * mora dentro de um `hidden sm:flex` — no celular ele simplesmente não é
   * desenhado, e metade das visitas do portal é de celular. Aprovar o valor é a
   * razão de o contato ter aberto a tela; sumir com o botão no telefone dele
   * seria o pior lugar possível para economizar uma linha.
   */
  actions?: ReactNode;
}) {
  const delivery = budget.delivery;
  const request = budget.request;

  // O CLIENTE não é campo do orçamento: o `select` o pendura em cada TAREFA
  // (`identity.customer`), porque o escopo do veículo vale dentro do orçamento e
  // um contato pode receber só os implementos que lhe dizem respeito. O primeiro
  // veículo com identidade responde a pergunta "de quem é este documento?".
  const cliente = budget.vehicles?.map((v) => v.identity?.customer).find((c) => !!c)?.name ?? null;

  return (
    <PortalCard icon={IconFileDescription} title="Proposta" actions={actions}>
      <PortalRows>
        <DetailRow
          label="Número"
          value={
            budget.budgetNumber ? <span className="tabular-nums">{budget.budgetNumber}</span> : undefined
          }
        />
        <DetailRow label="Cliente" value={cliente ?? undefined} />
        <DetailRow label="Emitido em" value={data(budget.createdAt)} />
        <DetailRow label="Validade" value={data(budget.expiresAt)} />
        <DetailRow
          label="Veículos"
          value={<span className="tabular-nums">{budget.vehicleCount ?? 0}</span>}
        />

        {/* ── ANDAMENTO DO CONTRATO — seção `DELIVERY` ──────────────────────
            O marco do orçamento é o MENOR entre os veículos vivos: o contrato
            só está concluído quando o último implemento saiu. Vem pronto do
            servidor e é PROJEÇÃO MONOTÔNICA — a tela nunca o recalcula. */}
        {budget.milestoneLabel ? (
          <DetailRow label="Andamento" value={budget.milestoneLabel} />
        ) : null}

        {/* ── O EIXO DA ASSINATURA — cabeçalho, sem seção ────────────────────
            "Não emitido" não é notícia: a linha só aparece quando já existe
            documento (aguardando, assinado, assinado fora do sistema, recusado…). */}
        {budget.signatureStatusLabel && budget.signatureStatus && budget.signatureStatus !== "NOT_ISSUED" ? (
          <DetailRow label="Assinatura" value={budget.signatureStatusLabel} />
        ) : null}

        {/* ── PRAZO — seção `DELIVERY` ───────────────────────────────────── */}
        {delivery && delivery.customForecastDays !== null ? (
          <DetailRow
            label="Prazo acordado"
            value={
              <span className="tabular-nums">
                {delivery.customForecastDays}{" "}
                {delivery.customForecastDays === 1 ? "dia útil" : "dias úteis"}
              </span>
            }
          />
        ) : null}
        {delivery && delivery.simultaneousTasks !== null ? (
          <DetailRow
            label="Veículos em paralelo"
            value={<span className="tabular-nums">{delivery.simultaneousTasks}</span>}
          />
        ) : null}

        {/* ── O QUE O CLIENTE PEDIU ─────────────────────────────────────────
            Não é seção de recorte nenhuma: é texto DELE, e esconder do contato
            o que ele mesmo digitou seria recorte sem razão. Só existe quando o
            orçamento nasceu de uma requisição do portal.

            ⚠️ AS LINHAS LONGAS FICAM POR ÚLTIMO, que é a ordem da casa: em
            `task-detail-page.tsx` a "Observação" é a última seção, e em todo
            card rótulo/valor do DP o campo `block` fecha a pilha. Um texto de
            cinco linhas no meio da grade quebra a varredura das linhas curtas
            que vêm depois dele. */}
        {request?.requestedAt ? (
          <DetailRow label="Solicitado em" value={data(request.requestedAt)} />
        ) : null}
        {request?.logoName ? <DetailRow label="Logomarca" value={request.logoName} /> : null}
        {request?.briefing ? (
          <DetailRow label="Briefing" value={request.briefing} block />
        ) : null}
      </PortalRows>
    </PortalCard>
  );
}

/**
 * OS VALORES, quando eles não têm onde morar.
 *
 * ⚠️ Com `SERVICES` no recorte, subtotal e total são o RODAPÉ da tabela de
 * serviços — ao lado das linhas que os somam, que é onde uma pessoa confere
 * conta. Este card existe para o recorte que traz `PRICING` sem `SERVICES`
 * (`WRITE_PURCHASE_ORDER` implica `PAYMENT`, e nem todo caminho traz a lista):
 * sem ele o dinheiro sumiria da tela inteira.
 */
export function OrcamentoValoresCard({ budget }: { budget: PortalBudget }) {
  const pricing = budget.pricing;
  if (!pricing) return null;

  return (
    <PortalCard icon={IconCash} title="Valores">
      <PortalRows>
        <DetailRow
          label="Subtotal"
          value={
            typeof pricing.subtotal === "number" ? (
              <span className="tabular-nums">{formatCurrency(pricing.subtotal)}</span>
            ) : undefined
          }
        />
        <DetailRow
          label="Total"
          value={
            typeof pricing.total === "number" ? (
              <span className="text-base tabular-nums">{formatCurrency(pricing.total)}</span>
            ) : undefined
          }
        />
      </PortalRows>
    </PortalCard>
  );
}

/** A GARANTIA — seção `GUARANTEE`. Sem anos e sem texto, não há card. */
export function OrcamentoGarantiaCard({ budget }: { budget: PortalBudget }) {
  const guarantee = budget.guarantee;
  if (!guarantee || (guarantee.years === null && !guarantee.text)) return null;

  return (
    <PortalCard icon={IconShieldCheck} title="Garantia">
      <PortalRows>
        {guarantee.years !== null ? (
          <DetailRow
            label="Prazo"
            value={
              <span className="tabular-nums">
                {guarantee.years} {guarantee.years === 1 ? "ano" : "anos"}
              </span>
            }
          />
        ) : null}
        {guarantee.text ? <DetailRow label="Condições" value={guarantee.text} block /> : null}
      </PortalRows>
    </PortalCard>
  );
}

/**
 * A DECISÃO — e SÓ quando ela existe.
 *
 * ⛔ ESTE CARD SE CHAMAVA "A requisição" E CARREGAVA CINCO COISAS DE DOIS
 * ASSUNTOS: o que o cliente pediu (briefing, logomarca) e o que ele decidiu
 * depois. Num orçamento em REQUISIÇÃO — que é o estado em que o contato mais
 * abre esta tela — só o briefing existia, e o resultado era um card completo
 * para uma linha de texto, colado embaixo da Proposta, que é o card do mesmo
 * assunto. O pedido subiu para a Proposta; aqui ficou a decisão.
 *
 * `decidido()` é o portão: sem carimbo de decisão não há card nenhum. Isso é o
 * que a casa faz com toda seção (`ui/detailpage/detail-section.tsx:56` — seção
 * sem conteúdo não vira carcaça), e é o que faz a faixa de duas colunas parar
 * de carregar um card que só tinha cabeçalho.
 *
 * ⚠️ A DECISÃO É UMA SÓ, nunca as duas: o banco tem CHECK contra aprovado E
 * recusado ao mesmo tempo, e toda gravação de decisão APAGA a oposta. Por isso o
 * título é derivado dela — "Aprovação do valor" ou "Devolvido para refazer" — em vez
 * de um rótulo neutro que serviria aos dois e não nomearia nenhum.
 */
export function orcamentoTemDecisao(budget: PortalBudget): boolean {
  // A aprovação do valor vigente vale mesmo sem requisição: o orçamento pode ter
  // nascido por dentro, e o valor aprovado em nome do cliente ou na assinatura.
  if (budget.valueApproval) return true;
  const request = budget.request;
  return !!request && (!!request.valueApprovedAt || !!request.refusedAt || !!request.decisionNote);
}

export function OrcamentoDecisaoCard({ budget }: { budget: PortalBudget }) {
  const request = budget.request;
  const aprovacao = budget.valueApproval;
  if (!orcamentoTemDecisao(budget)) return null;

  // A APROVAÇÃO VIGENTE (`valueApproval`) é a verdade quando existe: ela diz
  // QUEM aprovou — o contato pelo nome, ou "Ankaa" quando foi em nome do
  // cliente — e por qual caminho (`sourceLabel`). A recusa só vale sem ela.
  const recusado = !aprovacao && !!request?.refusedAt;
  // Os autores só vêm no DETALHE — na lista o `select` não os carrega.
  const decisor =
    aprovacao?.decidedBy?.name ?? request?.valueApprovedBy?.name ?? request?.refusedBy?.name ?? null;
  const aprovadoEm = aprovacao?.decidedAt ?? request?.valueApprovedAt ?? null;
  const nota = aprovacao?.note ?? request?.decisionNote ?? null;

  return (
    <PortalCard
      icon={recusado ? IconArrowBackUp : IconThumbUp}
      title={recusado ? "Devolvido para refazer" : "Aprovação do valor"}
      description={
        recusado
          ? "O que você registrou ao devolver este orçamento ao comercial."
          : aprovacao?.source === "PORTAL"
            ? "O que foi registrado ao aprovar o valor pelo portal."
            : "Como o valor deste orçamento foi aprovado."
      }
    >
      <PortalRows>
        {!recusado && aprovadoEm ? <DetailRow label="Valor aprovado em" value={data(aprovadoEm)} /> : null}
        {recusado && request?.refusedAt ? (
          <DetailRow label="Devolvido em" value={data(request.refusedAt)} />
        ) : null}
        {decisor ? <DetailRow label="Por" value={decisor} /> : null}
        {!recusado && aprovacao?.sourceLabel ? <DetailRow label="Como" value={aprovacao.sourceLabel} /> : null}
        {!recusado && aprovacao?.total != null ? (
          <DetailRow
            label="Valor aprovado"
            value={<span className="tabular-nums">{formatCurrency(aprovacao.total)}</span>}
          />
        ) : null}
        {nota ? <DetailRow label="Observação" value={nota} block /> : null}
      </PortalRows>
    </PortalCard>
  );
}
