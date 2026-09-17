import { IconCalendar, IconCalendarDollar, IconCurrencyReal, IconFileText, IconHash, IconProgressCheck, IconReceipt2, IconUserDollar } from "@tabler/icons-react";

import type { DataTableFilterDef, DataTableFilterValues } from "@/components/ui/datatable";
import type { Customer, Task } from "@/types";
import { BILLING_STATUS, BILLING_STATUS_LABELS, BILLING_STATUS_ORDER } from "@/constants";
import { MONEY_PRIVILEGES } from "@/utils/privilege";
import {
  ATTENTION_CUSTOMER_SELECT,
  createCustomerFilterDef,
  customerIdsFromFilter,
  orderNumberPresenceWhere,
  toApiDateRange,
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
 * deixaria de existir. Agora a pergunta é sobre o `Billing`.
 *
 * ⚠️ NÃO há "A Vencer": aprovada é `APPROVED`, que já quer dizer "cobrado, esperando pagar".
 */
const BILLING_STATUS_OPTIONS = (Object.values(BILLING_STATUS) as BILLING_STATUS[])
  // Ordenado por `BILLING_STATUS_ORDER` e não pela ordem de declaração: é a MESMA ordem em que as
  // linhas chegam da lista, e é o que a coluna Status ordena. Derivar evita a terceira cópia.
  .sort((a, b) => BILLING_STATUS_ORDER[a] - BILLING_STATUS_ORDER[b])
  .map((value) => ({ value, label: BILLING_STATUS_LABELS[value] }));

/**
 * Task-status scope. `finished` is the server's own default, so it is sent ONLY when the user
 * picks something else — leaving the filter empty means "Finalizadas" and therefore costs no chip
 * and no active-filter count, exactly as before the migration.
 */
const TASK_STATUS_SCOPE_OPTIONS = [
  { value: "finished", label: "Finalizadas" },
  { value: "unfinished", label: "Ativas" },
  { value: "all", label: "Ambas" },
];

/**
 * Only what the columns render. Top-level `include` (not a bare `select`) so the API's
 * Decimal → number mapping runs and `quote.total` arrives as a number.
 *
 * `quote.id` and `customerConfigs.customerId` are here for the attention engine rather
 * than for a column: the list registers each quote so a rule can blink its row (see `rules.ts`).
 */
export const BILLING_LIST_INCLUDE = {
  customer: { select: { id: true, fantasyName: true, corporateName: true } },
  truck: { select: { chassisNumber: true, plate: true } },
  quote: {
    select: {
      id: true,
      budgetNumber: true,
      subtotal: true,
      total: true,
      status: true,
      statusOrder: true,
      expiresAt: true,
      billingApprovedAt: true,
      // QUANTOS VEÍCULOS o orçamento cobre. `total` é o valor do CONTRATO
      // (`por veículo × N`) e cada linha desta lista é UM veículo: sem o divisor
      // a coluna Valor mostra o total dos sessenta em todas as sessenta linhas.
      vehicleCount: true,
      // Junto ou separado — decide se a fatia desta linha é a do veículo ou a
      // conjunta, e o que o botão de aprovar faturamento faz.
      billingSplit: true,
      customerConfigs: {
        select: {
          id: true,
          customerId: true,
          // O FATURAMENTO, pedido À MÃO — e é a única parte deste include que
          // NÃO se pode deixar para a API pendurar sozinha.
          //
          // `withCoverageInclude` injeta `billing` em todo caminho que devolve
          // `customerConfigs`, mas com um recorte fixo: id, `approvedAt` e a
          // cobertura. O ESTADO (`status`/`statusOrder`) não está nele, e é
          // exatamente o que esta lista mostra e filtra — sem pedi-lo, a coluna
          // Status Faturamento ficaria vazia em todas as linhas.
          //
          // ⚠️ Quem pede `billing` à mão é RESPEITADO INTEIRO: a API não
          // completa o que faltar. Por isso a cobertura (`tasks`) está repetida
          // aqui — sem ela, `configsForTask` não sabe qual fatia é a desta
          // linha e passa a devolver todas, que é a fatura conjunta lida em
          // sessenta linhas de veículo.
          //
          // ⚠️ `billingApprovedAt` já foi pedido no PAGADOR e a coluna saiu dele
          // em `20260916180000_billing_owns_its_state`. Pedi-la ali é 500 do
          // Prisma ("Unknown field ... for select statement"), e derrubava a
          // LISTA inteira — não uma coluna, a tela toda. A data mora no
          // faturamento, abaixo.
          billing: {
            select: {
              id: true,
              approvedAt: true,
              status: true,
              statusOrder: true,
              tasks: { select: { taskId: true } },
            },
          },
          // "Forma de Pagamento" column. `paymentConfig` is the current shape, `paymentCondition`
          // the legacy string the same helper converts — a record saved before the redesign has to
          // read the same as one saved after it.
          paymentConfig: true,
          paymentCondition: true,
          // Read by `task-quote.ibipora-missing-order-number` and
          // `task-quote.billing-customer-incomplete`: a config that will not produce a nota needs
          // neither the pedido number nor a complete cadastro.
          generateInvoice: true,
          customer: { select: { id: true, ...ATTENTION_CUSTOMER_SELECT } },
          installments: { select: { id: true, number: true, dueDate: true, status: true } },
        },
      },
    },
  },
  // A COBRANÇA DESTA LINHA. Sem isto, `findFirstInstallmentDueDate` não consegue
  // recortar os pagadores da cobrança do veículo e volta a olhar o orçamento
  // inteiro — sessenta linhas com o mesmo vencimento.
  billingEntry: { select: { billingId: true } },
} as const;

export function createBillingFilterDefs(opts: { invoiceCustomers: Customer[]; taskCustomers: Customer[] }): DataTableFilterDef<Task>[] {
  return [
    {
      key: "taskStatus",
      label: "Status da Tarefa",
      type: "select",
      icon: <IconProgressCheck className="h-4 w-4" />,
      placeholder: "Finalizadas",
      options: TASK_STATUS_SCOPE_OPTIONS,
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
    }),
    createCustomerFilterDef({
      key: "taskCustomerIds",
      label: "Cliente da Tarefa",
      queryKey: "customers-billing-task-filter",
      selectedOptions: opts.taskCustomers,
      icon: <IconUserDollar className="h-4 w-4" />,
    }),
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

/** Filter values + global search → the tasks GET query (server mode). */
export function buildBillingQuery(filters: DataTableFilterValues, search: string): Record<string, unknown> {
  const q: Record<string, unknown> = {
    // The server-side "belongs to Financeiro" scope: has a quote, quote is past PENDING, and the
    // task-status window below. Must ride EVERY request — it is the list's whole definition.
    shouldDisplayForFinancial: true,
  };

  const taskStatus = typeof filters.taskStatus === "string" ? filters.taskStatus : undefined;
  // `financialTaskStatus` is a companion flag the API deletes after use; 'finished' is its default,
  // so sending it would be a no-op that only adds noise to the request.
  if (taskStatus === "unfinished" || taskStatus === "all") q.financialTaskStatus = taskStatus;

  // `quote` is a to-one relation: every condition on it goes inside `is`, never as a sibling of it.
  const quoteWhere: Record<string, unknown> = {};

  // AS CONDIÇÕES SOBRE A COBRANÇA — todas sobre a COBRANÇA DESTA LINHA.
  //
  // ⚠️ Perguntavam ao ORÇAMENTO (`quote.is.billings.some`), e a coluna mostra a LINHA. Num
  // orçamento de sessenta caminhões com UMA fatia vencida, `some` é verdadeiro para o orçamento
  // inteiro: o filtro "Vencido" trazia os sessenta, cinquenta e nove deles exibindo outro selo.
  // A lista é de VEÍCULOS, e o veículo tem UMA cobrança — `Task.billingEntry`, relação de-um
  // (`BillingTask?`) com `@@unique([taskId])`. É o mesmo caminho que a coluna Status Faturamento
  // ordena e que o filtro de Vencimento já usa, e `taskWhereSchema` o aceita desde 16/09.
  //
  // Continuam reunidas numa condição só, pelo mesmo motivo de antes: "Vencido" + "faturado em
  // setembro" pergunta por uma cobrança que seja as duas coisas.
  //
  // ⚠️ O estado era, antes disso, `quote.status in [...]`. Além de perguntar à entidade errada,
  // aquilo dava uma resposta só para as N cobranças do orçamento — a última cascata que rodasse.
  const billingWhere: Record<string, unknown> = {};

  const billingStatuses = Array.isArray(filters.billingStatuses)
    ? filters.billingStatuses.filter((s): s is string => typeof s === "string")
    : [];
  if (billingStatuses.length > 0) billingWhere.status = { in: billingStatuses };

  const budgetNumber = toPositiveInt(filters.budgetNumber);
  if (budgetNumber != null) quoteWhere.budgetNumber = budgetNumber;

  const customerIds = customerIdsFromFilter(filters.customerIds);
  if (customerIds.length > 0) quoteWhere.customerConfigs = { some: { customerId: { in: customerIds } } };

  const totalRange = toNumberRange(filters.totalRange);
  if (totalRange) quoteWhere.total = totalRange;

  // "Faturado em" também é da COBRANÇA DESTA LINHA: `TaskQuote.billingApprovedAt` só é gravado
  // quando a ÚLTIMA fatia fecha, então um orçamento de sessenta caminhões com cinquenta e nove
  // faturados não entrava em faixa nenhuma. A coluna lê `billing.approvedAt` da linha (ver
  // `taskBillingApprovedAt`); o filtro pergunta o mesmo, senão a faixa e a data mostrada discordam.
  const billingApproved = toPrismaDateRange(filters.billingApprovedRange);
  if (billingApproved) billingWhere.approvedAt = billingApproved;

  // Extra AND branches rather than more keys on `quoteWhere`: each of these is its own `some` over
  // `customerConfigs`, and collapsing them would silently mean "one config satisfying ALL of them".
  const andBranches: Record<string, unknown>[] = [];

  // Relação de-UM: `is`, nunca `some`. Vai num ramo do `AND` e não dentro de `quoteWhere` porque
  // `billingEntry` é da TAREFA, não do orçamento — é irmão de `quote`, não filho.
  if (Object.keys(billingWhere).length > 0) {
    andBranches.push({ billingEntry: { is: { billing: billingWhere } } });
  }

  const orderNumberWhere = orderNumberPresenceWhere(filters.hasOrderNumber);
  // No nível da TAREFA: o número do pedido é dela agora (ver
  // `orderNumberPresenceWhere`), e não do orçamento.
  if (orderNumberWhere) andBranches.push(orderNumberWhere);

  const dueDate = toPrismaDateRange(filters.dueDateRange);
  if (dueDate) {
    // O PRINCÍPIO CONTINUA O MESMO — filtro e coluna têm de responder sobre a MESMA data —, mas a
    // data da coluna mudou: não é mais "a parcela nº 1", é "a parcela EM ABERTO mais antiga da
    // cobrança desta linha". Casar por `number: 1` passou a trazer linha cuja parcela 1 está paga
    // e cujo vencimento exibido é outro.
    //
    // "A mais antiga em aberto cai na faixa" se escreve em duas cláusulas: existe uma em aberto
    // DENTRO da faixa, e não existe nenhuma em aberto ANTES do começo dela. Sem a segunda, uma
    // cobrança com parcelas abertas em setembro e outubro apareceria num filtro de outubro
    // mostrando setembro — exatamente o desencontro que este bloco existe para impedir.
    const emAberto = { status: { notIn: ["PAID", "CANCELLED"] } };
    const escopo = (cond: Record<string, unknown>) => ({
      billingEntry: { is: { billing: { customerConfigs: { some: { installments: { some: cond } } } } } },
    });
    andBranches.push(escopo({ ...emAberto, dueDate }));
    const inicio = (dueDate as Record<string, unknown>)?.gte;
    if (inicio) {
      andBranches.push({
        NOT: escopo({ ...emAberto, dueDate: { lt: inicio } }),
      });
    }
  }

  const where: Record<string, unknown> = {};
  if (Object.keys(quoteWhere).length > 0) where.quote = { is: quoteWhere };
  if (andBranches.length > 0) where.AND = andBranches;
  if (Object.keys(where).length > 0) q.where = where;

  const taskCustomerIds = customerIdsFromFilter(filters.taskCustomerIds);
  if (taskCustomerIds.length > 0) q.customerIds = taskCustomerIds;

  // First-class range params on the API (they build their own `AND` conditions), so they must NOT
  // be folded into `where`.
  const finished = toApiDateRange(filters.finishedDateRange);
  if (finished) q.finishedDateRange = finished;
  const created = toApiDateRange(filters.createdAtRange);
  if (created) q.createdAtRange = created;

  if (search) q.searchingFor = search;

  return q;
}

/**
 * The list with no filters, no search and its default sort — the fallback for the detail page's
 * prev/next pager when the user did not arrive from the list. Must mirror the list's own defaults
 * (including the empty-`taskStatus` = "Finalizadas" convention above).
 */
export const BILLING_FALLBACK_LIST_QUERY: Record<string, unknown> = {
  ...buildBillingQuery({}, ""),
  orderBy: buildBillingOrderBy([]),
};
