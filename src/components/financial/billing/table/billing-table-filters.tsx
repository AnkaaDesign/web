import { IconCalendar, IconCalendarDollar, IconCurrencyReal, IconFileText, IconHash, IconProgressCheck, IconReceipt2, IconUserDollar } from "@tabler/icons-react";

import type { DataTableFilterDef, DataTableFilterValues } from "@/components/ui/datatable";
import type { Customer, Task } from "@/types";
import { TASK_QUOTE_STATUS, TASK_QUOTE_STATUS_LABELS } from "@/constants";
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
 * Billing-relevant quote statuses. PENDING is absent on purpose: the server's
 * `shouldDisplayForFinancial` scope already excludes it (a pending quote is an Orçamento, not a
 * Faturamento), so offering it would be a filter that always returns nothing.
 */
const BILLING_QUOTE_STATUS_OPTIONS = [
  TASK_QUOTE_STATUS.BUDGET_APPROVED,
  TASK_QUOTE_STATUS.BILLING_APPROVED,
  TASK_QUOTE_STATUS.UPCOMING,
  TASK_QUOTE_STATUS.DUE,
  TASK_QUOTE_STATUS.PARTIAL,
  TASK_QUOTE_STATUS.SETTLED,
  TASK_QUOTE_STATUS.CANCELLED,
].map((value) => ({ value, label: TASK_QUOTE_STATUS_LABELS[value] }));

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
 * `quote.id` and `customerConfigs.customerId/orderNumber` are here for the attention engine rather
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
      customerConfigs: {
        select: {
          id: true,
          customerId: true,
          orderNumber: true,
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
      key: "quoteStatuses",
      label: "Status Faturamento",
      type: "multiselect",
      icon: <IconReceipt2 className="h-4 w-4" />,
      placeholder: "Selecione o status...",
      options: BILLING_QUOTE_STATUS_OPTIONS,
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

  const quoteStatuses = Array.isArray(filters.quoteStatuses) ? filters.quoteStatuses.filter((s): s is string => typeof s === "string") : [];
  if (quoteStatuses.length > 0) quoteWhere.status = { in: quoteStatuses };

  const budgetNumber = toPositiveInt(filters.budgetNumber);
  if (budgetNumber != null) quoteWhere.budgetNumber = budgetNumber;

  const customerIds = customerIdsFromFilter(filters.customerIds);
  if (customerIds.length > 0) quoteWhere.customerConfigs = { some: { customerId: { in: customerIds } } };

  const totalRange = toNumberRange(filters.totalRange);
  if (totalRange) quoteWhere.total = totalRange;

  const billingApproved = toPrismaDateRange(filters.billingApprovedRange);
  if (billingApproved) quoteWhere.billingApprovedAt = billingApproved;

  // Extra AND branches rather than more keys on `quoteWhere`: each of these is its own `some` over
  // `customerConfigs`, and collapsing them would silently mean "one config satisfying ALL of them".
  const andBranches: Record<string, unknown>[] = [];

  const orderNumberWhere = orderNumberPresenceWhere(filters.hasOrderNumber);
  if (orderNumberWhere) andBranches.push({ quote: { is: orderNumberWhere } });

  const dueDate = toPrismaDateRange(filters.dueDateRange);
  if (dueDate) {
    andBranches.push({
      // `number: 1` on purpose: the Vencimento COLUMN renders the first installment's due date,
      // and matching ANY installment made a quarter of the results show a date outside the range
      // the user had just typed. Filter and column have to answer about the same date.
      quote: { is: { customerConfigs: { some: { installments: { some: { number: 1, dueDate } } } } } },
    });
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
