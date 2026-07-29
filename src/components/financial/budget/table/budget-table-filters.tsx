import { IconCalendar, IconCalendarCheck, IconCalendarClock, IconCurrencyReal, IconFileText, IconHash, IconProgressCheck, IconReceipt2, IconUserDollar } from "@tabler/icons-react";

import type { DataTableFilterDef, DataTableFilterValues } from "@/components/ui/datatable";
import type { Customer, Task } from "@/types";
import { TASK_QUOTE_STATUS, TASK_QUOTE_STATUS_LABELS, TASK_STATUS, TASK_STATUS_LABELS } from "@/constants";
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
import { buildBudgetOrderBy } from "./budget-table-columns";

export const BUDGET_DEFAULT_PAGE_SIZE = 40;

/** The list is the BUDGET half of a quote's lifecycle — everything past approval belongs to Faturamento. */
export const BUDGET_QUOTE_STATUSES = [TASK_QUOTE_STATUS.PENDING, TASK_QUOTE_STATUS.BUDGET_APPROVED];

const BUDGET_QUOTE_STATUS_OPTIONS = BUDGET_QUOTE_STATUSES.map((value) => ({ value, label: TASK_QUOTE_STATUS_LABELS[value] }));

/** Task statuses a budget can legitimately sit on. CANCELLED is included — a cancelled task with a
 * live quote is exactly the kind of thing someone needs to find and close out. */
const TASK_STATUS_OPTIONS = (Object.values(TASK_STATUS) as TASK_STATUS[]).map((value) => ({
  value,
  label: TASK_STATUS_LABELS[value] ?? value,
}));

/**
 * Only what the columns render. Kept as a top-level `include` (not a bare `select`) so the API's
 * Decimal → number mapping runs and `quote.total` arrives as a number.
 *
 * `quote.id` + `customerConfigs.customerId/orderNumber` are here for the attention engine, not for
 * a column: registering the quotes is what lets a rule blink the row (see `rules.ts`).
 */
export const BUDGET_LIST_INCLUDE = {
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
      guaranteeYears: true,
      customerConfigs: {
        select: {
          id: true,
          customerId: true,
          orderNumber: true,
          // See BILLING_LIST_INCLUDE — the attention rules read both of these.
          generateInvoice: true,
          customer: { select: { id: true, ...ATTENTION_CUSTOMER_SELECT } },
        },
      },
    },
  },
} as const;

export function createBudgetFilterDefs(opts: { invoiceCustomers: Customer[]; taskCustomers: Customer[] }): DataTableFilterDef<Task>[] {
  return [
    {
      key: "budgetNumber",
      label: "Nº do Orçamento",
      type: "text",
      icon: <IconHash className="h-4 w-4" />,
      placeholder: "Ex: 557",
    },
    {
      key: "quoteStatuses",
      label: "Status do Orçamento",
      type: "multiselect",
      icon: <IconReceipt2 className="h-4 w-4" />,
      placeholder: "Selecione o status...",
      options: BUDGET_QUOTE_STATUS_OPTIONS,
    },
    {
      key: "taskStatuses",
      label: "Status da Tarefa",
      type: "multiselect",
      icon: <IconProgressCheck className="h-4 w-4" />,
      placeholder: "Selecione o status...",
      options: TASK_STATUS_OPTIONS,
    },
    createCustomerFilterDef({
      key: "customerIds",
      label: "Faturar Para (Cliente)",
      queryKey: "customers-budget-invoice-filter",
      selectedOptions: opts.invoiceCustomers,
    }),
    createCustomerFilterDef({
      key: "taskCustomerIds",
      label: "Cliente da Tarefa",
      queryKey: "customers-budget-task-filter",
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
      key: "expiresAtRange",
      label: "Período de Validade",
      type: "date-range",
      icon: <IconCalendarClock className="h-4 w-4" />,
    },
    {
      key: "termRange",
      label: "Prazo de Entrega",
      type: "date-range",
      icon: <IconCalendarCheck className="h-4 w-4" />,
    },
    {
      key: "forecastDateRange",
      label: "Previsão de Liberação",
      type: "date-range",
      icon: <IconCalendar className="h-4 w-4" />,
    },
    {
      key: "entryDateRange",
      label: "Período de Entrada",
      type: "date-range",
      icon: <IconCalendar className="h-4 w-4" />,
    },
    {
      key: "finishedDateRange",
      label: "Período de Finalização",
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
export function buildBudgetQuery(filters: DataTableFilterValues, search: string): Record<string, unknown> {
  const q: Record<string, unknown> = {};

  // `quote` is a to-one relation, so EVERY condition on it must sit inside `is`. The table this
  // replaces put `customerConfigs` as a sibling of `is`, which is not a valid to-one operator —
  // the customer filter was silently doing nothing.
  const quoteStatuses = Array.isArray(filters.quoteStatuses) ? filters.quoteStatuses.filter((s): s is string => typeof s === "string") : [];
  const quoteWhere: Record<string, unknown> = {
    // Narrowing WITHIN the list's own scope: an explicit status pick can only ever be a subset of
    // [PENDING, BUDGET_APPROVED], never a way out of it.
    status: { in: quoteStatuses.length > 0 ? quoteStatuses : BUDGET_QUOTE_STATUSES },
  };

  const budgetNumber = toPositiveInt(filters.budgetNumber);
  if (budgetNumber != null) quoteWhere.budgetNumber = budgetNumber;

  const customerIds = customerIdsFromFilter(filters.customerIds);
  if (customerIds.length > 0) quoteWhere.customerConfigs = { some: { customerId: { in: customerIds } } };

  const totalRange = toNumberRange(filters.totalRange);
  if (totalRange) quoteWhere.total = totalRange;

  const expiresAt = toPrismaDateRange(filters.expiresAtRange);
  if (expiresAt) quoteWhere.expiresAt = expiresAt;

  // "Sem N° do Pedido" and a customer filter both land on `customerConfigs`; merging them into one
  // `some` would mean "a config that matches BOTH", which is the stricter and more useful reading,
  // but it silently changes what the customer filter means. Keep them as separate AND branches.
  const orderNumberWhere = orderNumberPresenceWhere(filters.hasOrderNumber);

  const where: Record<string, unknown> = { quote: { is: quoteWhere } };
  if (orderNumberWhere) where.AND = [{ quote: { is: orderNumberWhere } }];
  q.where = where;

  const taskStatuses = Array.isArray(filters.taskStatuses) ? filters.taskStatuses.filter((s): s is string => typeof s === "string") : [];
  if (taskStatuses.length > 0) q.status = taskStatuses;

  const taskCustomerIds = customerIdsFromFilter(filters.taskCustomerIds);
  if (taskCustomerIds.length > 0) q.customerIds = taskCustomerIds;

  // These four have first-class range params on the API (they build their own `AND` conditions),
  // so they must NOT be folded into `where`.
  const finished = toApiDateRange(filters.finishedDateRange);
  if (finished) q.finishedDateRange = finished;
  const term = toApiDateRange(filters.termRange);
  if (term) q.termRange = term;
  const forecast = toApiDateRange(filters.forecastDateRange);
  if (forecast) q.forecastDateRange = forecast;
  const entry = toApiDateRange(filters.entryDateRange);
  if (entry) q.entryDateRange = entry;
  const created = toApiDateRange(filters.createdAtRange);
  if (created) q.createdAtRange = created;

  if (search) q.searchingFor = search;

  return q;
}

/**
 * The list with no filters, no search and its default sort — what the detail page's prev/next
 * pager falls back to when the user did not arrive from the list (a notification, a deep link, a
 * refresh, "abrir em nova guia"). It MUST stay a faithful mirror of the list's own defaults: a
 * divergence does not error, it just makes "próximo" land on a record that was not the next row.
 */
export const BUDGET_FALLBACK_LIST_QUERY: Record<string, unknown> = {
  ...buildBudgetQuery({}, ""),
  orderBy: buildBudgetOrderBy([]),
};
