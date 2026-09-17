import {
  IconCalendar,
  IconCalendarDollar,
  IconCurrencyReal,
  IconFileInvoice,
  IconFileText,
  IconHash,
  IconReceipt2,
  IconTruckDelivery,
  IconUserDollar,
} from "@tabler/icons-react";

import type { DataTableFilterDef, DataTableFilterValues } from "@/components/ui/datatable";
import type { Customer } from "@/types";
import type { Billing } from "@/types/task-quote";
import type { BillingListParams } from "@/api-client/billing";
import {
  BILLING_STATUS,
  BILLING_STATUS_LABELS,
  BILLING_STATUS_ORDER,
  TASK_QUOTE_STATUS,
  TASK_QUOTE_STATUS_LABELS,
} from "@/constants";
import { MONEY_PRIVILEGES } from "@/utils/privilege";
import {
  createCustomerFilterDef,
  customerIdsFromFilter,
  toNumberRange,
  toPositiveInt,
  toPrismaDateRange,
} from "@/components/financial/shared/quote-table-shared";
import { buildBillingOrderBy } from "./billing-table-columns";

export const BILLING_DEFAULT_PAGE_SIZE = 40;

/**
 * O ESTADO DA COBRANÇA — os seis de `BILLING_STATUS`, na ordem da ação pendente.
 *
 * ⚠️ Eram estados do ORÇAMENTO. A lista perguntava `quote.status in [...]`, o que só funcionava
 * porque o enum do orçamento carregava o ciclo do pagamento dentro dele; depois do encolhimento
 * restariam APPROVED e CANCELLED, e o filtro que o financeiro mais usa ("o que está vencido?")
 * deixaria de existir. Agora a pergunta é sobre o `Billing`, que é a própria linha.
 *
 * ⚠️ NÃO há "A Vencer": aprovada é `APPROVED`, que já quer dizer "cobrado, esperando pagar".
 */
const BILLING_STATUS_OPTIONS = (Object.values(BILLING_STATUS) as BILLING_STATUS[])
  // Ordenado por `BILLING_STATUS_ORDER` e não pela ordem de declaração: é a MESMA ordem em que as
  // linhas chegam da lista, e é o que a coluna Status ordena. Derivar evita a terceira cópia.
  .sort((a, b) => BILLING_STATUS_ORDER[a] - BILLING_STATUS_ORDER[b])
  .map((value) => ({ value, label: BILLING_STATUS_LABELS[value] }));

/**
 * 🔴 O ESTADO DO ORÇAMENTO — o filtro SEM O QUAL ESTA LISTA MENTE.
 *
 * `Billing` nasce na MESMA transação que cria o orçamento, não na aprovação: um
 * orçamento PENDING que ninguém assinou JÁ TEM cobrança. A lista antiga nunca
 * mostrou isso porque consultava tarefas com `shouldDisplayForFinancial`, que
 * exige `quote.status notIn [PENDING, SIGNED, EXPIRED]`.
 *
 * `GET /billings` NÃO tem padrão para este parâmetro — quem não o manda vê tudo.
 * Estes dois estados reproduzem exatamente o escopo antigo:
 *
 *  · `APPROVED` — vendido; é o que se fatura.
 *  · `CANCELLED` — um orçamento cancelado com cobrança viva é justamente o que
 *    alguém precisa achar e encerrar. Escondê-lo faria o passivo sumir da tela
 *    sem sumir do banco.
 *
 * Ficam de fora `PENDING`, `SIGNED` e `EXPIRED`. O motivo está no schema antigo,
 * e continua valendo: "um orçamento vencido, à espera de reanálise do valor,
 * aparecendo na fila de faturar é pedir para alguém faturar um preço que o
 * comercial acabou de decidir rever".
 *
 * O filtro é VISÍVEL para que dê para ampliar o escopo à mão quando a pergunta
 * for outra — mas vazio quer dizer estes dois, e não "todos".
 */
export const BILLING_DEFAULT_QUOTE_STATUSES: string[] = [
  TASK_QUOTE_STATUS.APPROVED,
  TASK_QUOTE_STATUS.CANCELLED,
];

const QUOTE_STATUS_OPTIONS = (Object.values(TASK_QUOTE_STATUS) as TASK_QUOTE_STATUS[]).map((value) => ({
  value,
  label: TASK_QUOTE_STATUS_LABELS[value] ?? value,
}));

/**
 * ENTREGA — a pergunta certa para uma linha que cobre N veículos.
 *
 * ⚠️ SUBSTITUI "Status da Tarefa". Uma cobrança tem N tarefas, então "a tarefa
 * está finalizada?" não tem resposta única: num lote de vinte com dezenove
 * prontos, tanto "sim" quanto "não" mentem. `deliveredOnly` do servidor pergunta
 * o que importa — `none: { task: { finishedAt: null } }`, ou seja TODOS os
 * veículos saíram —, que é a condição para cobrar sem cobrar trabalho que ainda
 * não foi entregue.
 *
 * Só há duas opções porque só há dois estados que a rota sabe responder: o
 * parâmetro é booleano e `false` não filtra nada. Vazio = "Todas".
 */
const DELIVERY_OPTIONS = [
  { value: "delivered", label: "Entregues" },
  { value: "all", label: "Todas" },
];

/**
 * JÁ FATURADA? — `approved` do servidor, um filtro que a tela nunca teve.
 *
 * `approved=false` + `deliveredOnly=true` é a fila que o financeiro pedia e não
 * tinha como expressar: o que já foi entregue e ainda não foi cobrado.
 */
const APPROVED_OPTIONS = [
  { value: "approved", label: "Faturadas" },
  { value: "pending", label: "A faturar" },
];

/**
 * Faixa de datas para `/billings`: `{ from, to }`, com as pontas abertas ao DIA
 * inteiro.
 *
 * As duas pontas têm de ser alargadas. `DateTimeInput mode="date"` carimba o dia
 * escolhido às 13:00 locais, então um `from` sem piso descarta tudo que aconteceu
 * mais cedo naquele dia — e a maioria das parcelas está gravada ao meio-dia, ou
 * seja, toda parcela que vence NO dia "De". A API compara a data crua
 * (`dateBounds` faz `{ gte, lte }` sem tocar nas horas), então o alargamento é
 * daqui. `toPrismaDateRange` já faz exatamente isso; só o vocabulário muda.
 */
function toBillingDateRange(value: unknown): { from?: Date; to?: Date } | undefined {
  const range = toPrismaDateRange(value);
  if (!range) return undefined;
  return { ...(range.gte ? { from: range.gte } : {}), ...(range.lte ? { to: range.lte } : {}) };
}

export function createBillingFilterDefs(opts: { invoiceCustomers: Customer[]; taskCustomers: Customer[] }): DataTableFilterDef<Billing>[] {
  return [
    {
      key: "delivery",
      label: "Entrega",
      type: "select",
      icon: <IconTruckDelivery className="h-4 w-4" />,
      placeholder: "Todas",
      options: DELIVERY_OPTIONS,
    },
    {
      key: "billingStatuses",
      label: "Status Faturamento",
      type: "multiselect",
      icon: <IconReceipt2 className="h-4 w-4" />,
      placeholder: "Selecione o status...",
      options: BILLING_STATUS_OPTIONS,
    },
    {
      key: "quoteStatuses",
      label: "Status do Orçamento",
      type: "multiselect",
      icon: <IconFileInvoice className="h-4 w-4" />,
      // O texto do campo vazio DIZ o padrão, em vez de sugerir "todos": é o que
      // impede alguém de concluir que a lista já mostra orçamento pendente.
      placeholder: "Aprovados e cancelados",
      options: QUOTE_STATUS_OPTIONS,
    },
    {
      key: "approved",
      label: "Faturada",
      type: "select",
      icon: <IconFileText className="h-4 w-4" />,
      placeholder: "Todas",
      options: APPROVED_OPTIONS,
    },
    {
      key: "budgetNumber",
      label: "Nº do Orçamento",
      type: "text",
      icon: <IconHash className="h-4 w-4" />,
      placeholder: "Ex: 557",
    },
    createCustomerFilterDef({
      key: "customerIds",
      label: "Faturar Para (Cliente)",
      queryKey: "customers-billing-invoice-filter",
      selectedOptions: opts.invoiceCustomers,
    }) as unknown as DataTableFilterDef<Billing>,
    createCustomerFilterDef({
      key: "taskCustomerIds",
      label: "Cliente da Tarefa",
      queryKey: "customers-billing-task-filter",
      selectedOptions: opts.taskCustomers,
      icon: <IconUserDollar className="h-4 w-4" />,
    }) as unknown as DataTableFilterDef<Billing>,
    {
      key: "totalRange",
      label: "Faixa de Valor",
      type: "number-range",
      currency: true,
      icon: <IconCurrencyReal className="h-4 w-4" />,
      // The value itself is money — a user who cannot see the column must not be able to
      // binary-search it with a range filter either.
      requiredPrivilege: MONEY_PRIVILEGES,
    },
    {
      key: "hasOrderNumber",
      label: "N° do Pedido",
      type: "boolean",
      icon: <IconFileText className="h-4 w-4" />,
      placeholder: "Todos",
      formatValue: (v) => (v === true || v === "true" ? "Com N° do Pedido" : "Sem N° do Pedido"),
    },
    {
      key: "dueDateRange",
      label: "Período de Vencimento",
      type: "date-range",
      icon: <IconCalendarDollar className="h-4 w-4" />,
    },
    {
      key: "finishedDateRange",
      label: "Período de Finalização",
      type: "date-range",
      icon: <IconCalendar className="h-4 w-4" />,
    },
    {
      key: "billingApprovedRange",
      label: "Período de Faturamento",
      type: "date-range",
      icon: <IconCalendar className="h-4 w-4" />,
    },
    {
      key: "createdAtRange",
      label: "Período de Criação",
      type: "date-range",
      icon: <IconCalendar className="h-4 w-4" />,
    },
  ];
}

/**
 * Filtros + busca global → os PARÂMETROS PLANOS de `GET /billings`.
 *
 * 🔴 NÃO monta mais um `where` de Prisma. A lista consultava `/tasks`, onde cada
 * filtro virava um caminho aninhado (`billingEntry.is.billing.customerConfigs.
 * some.installments.some…`) porque a linha era um VEÍCULO e a cobrança ficava a
 * três relações de distância. `GET /billings` não aceita `where`: cada filtro é
 * um parâmetro nomeado que o serviço traduz — e mandar `where` aqui não dá erro
 * nenhum, é simplesmente ignorado, e a tela mostra tudo como se nada estivesse
 * marcado.
 *
 * O que encolheu junto: o "Vencimento" precisava de duas cláusulas penduradas na
 * cobrança da linha (existe parcela em aberto na faixa E não existe nenhuma antes
 * do começo); as duas continuam existindo, mas dentro do servidor, onde a
 * cobrança é a própria linha.
 */
export function buildBillingQuery(filters: DataTableFilterValues, search: string): BillingListParams {
  const q: BillingListParams = {};

  // ⚠️ SEMPRE PRESENTE, vazio ou não — ver `BILLING_DEFAULT_QUOTE_STATUSES`. É o
  // que define a lista, do mesmo jeito que `shouldDisplayForFinancial: true`
  // definia a antiga.
  const quoteStatuses = Array.isArray(filters.quoteStatuses)
    ? filters.quoteStatuses.filter((s): s is string => typeof s === "string")
    : [];
  q.quoteStatuses = quoteStatuses.length > 0 ? quoteStatuses : BILLING_DEFAULT_QUOTE_STATUSES;

  // Vazio é "Todas": `deliveredOnly=false` não filtra nada no servidor, então
  // mandá-lo seria ruído na query string e na `queryKey`.
  if (filters.delivery === "delivered") q.deliveredOnly = true;

  if (filters.approved === "approved") q.approved = true;
  else if (filters.approved === "pending") q.approved = false;

  const billingStatuses = Array.isArray(filters.billingStatuses)
    ? filters.billingStatuses.filter((s): s is string => typeof s === "string")
    : [];
  if (billingStatuses.length > 0) q.statuses = billingStatuses;

  const budgetNumber = toPositiveInt(filters.budgetNumber);
  if (budgetNumber != null) q.budgetNumber = budgetNumber;

  const customerIds = customerIdsFromFilter(filters.customerIds);
  if (customerIds.length > 0) q.customerIds = customerIds;

  const taskCustomerIds = customerIdsFromFilter(filters.taskCustomerIds);
  if (taskCustomerIds.length > 0) q.taskCustomerIds = taskCustomerIds;

  const totalRange = toNumberRange(filters.totalRange);
  // `toNumberRange` fala Prisma (`gte`/`lte`); a rota fala `min`/`max`. Traduzir
  // aqui em vez de aceitar os dois nomes mantém UM vocabulário na query string.
  if (totalRange) {
    q.totalRange = {
      ...(totalRange.gte != null ? { min: totalRange.gte } : {}),
      ...(totalRange.lte != null ? { max: totalRange.lte } : {}),
    };
  }

  if (filters.hasOrderNumber === true || filters.hasOrderNumber === "true") q.hasOrderNumber = true;
  else if (filters.hasOrderNumber === false || filters.hasOrderNumber === "false") q.hasOrderNumber = false;

  const dueDate = toBillingDateRange(filters.dueDateRange);
  if (dueDate) q.dueDateRange = dueDate;
  const finished = toBillingDateRange(filters.finishedDateRange);
  if (finished) q.finishedDateRange = finished;
  const billingApproved = toBillingDateRange(filters.billingApprovedRange);
  if (billingApproved) q.billingApprovedRange = billingApproved;
  const created = toBillingDateRange(filters.createdAtRange);
  if (created) q.createdAtRange = created;

  if (search) q.searchingFor = search;

  return q;
}

/**
 * The list with no filters, no search and its default sort — the fallback for the detail page's
 * prev/next pager when the user did not arrive from the list. Must mirror the list's own defaults
 * (including the empty-`quoteStatuses` = "aprovados e cancelados" convention above).
 */
export const BILLING_FALLBACK_LIST_QUERY: Record<string, unknown> = {
  ...buildBillingQuery({}, ""),
  orderBy: buildBillingOrderBy([]),
};
