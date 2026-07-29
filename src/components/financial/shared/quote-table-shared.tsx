import { useMemo, type ReactNode } from "react";
import { IconBuilding } from "@tabler/icons-react";

import { TruncatedTextWithTooltip } from "@/components/ui/truncated-text-with-tooltip";
import { CustomerLogoDisplay } from "@/components/ui/avatar-display";
import type { DataTableFilterDef } from "@/components/ui/datatable";
import { getCustomers } from "@/api-client/customer";
import { useCustomers } from "@/hooks";
import { NFSE_DOCUMENT_FIELDS, NFSE_REQUIRED_CUSTOMER_FIELDS } from "@/lib/billing-customer-data";
import { PAYMENT_TYPE_OPTIONS, configToTypeValue, legacyToConfig } from "@/components/financial/payment-config-field";
import { formatDate } from "@/utils";
import type { PaymentConfig } from "@/schemas/task-quote";
import type { Task } from "@/types";
import type { Customer } from "@/types";

/**
 * Cells, value extractors and the customer picker shared by the two financial task tables
 * (Orçamentos and Faturamento). Both list the SAME entity (Task, joined to its TaskQuote) with
 * the same identifier/customer/date semantics, and the two hand-rolled tables they replaced had
 * already drifted apart in small ways (one showed `-` for a zero total, the other didn't). One
 * copy keeps them honest.
 */

/**
 * The customer columns `task-quote.billing-customer-incomplete` evaluates, plus the two names the
 * "Faturar Para" cell renders.
 *
 * It has to be in the LIST's include, not just the detail page's: the engine evaluates a locally
 * registered record locally and ignores the server's match for it (engine.ts step 1b), so a quote
 * fetched without these columns reads as "customer complete" and the row silently refuses to blink
 * for the very rule the nav is counting it under.
 *
 * Built from the shared requirement list so adding a required field can never leave the query
 * behind — that is the one failure this whole indirection exists to prevent.
 */
export const ATTENTION_CUSTOMER_SELECT = {
  fantasyName: true,
  corporateName: true,
  ...Object.fromEntries(NFSE_DOCUMENT_FIELDS.map((k) => [k, true])),
  ...Object.fromEntries(NFSE_REQUIRED_CUSTOMER_FIELDS.map((f) => [f.key, true])),
} as const;

export const MutedDash = () => <span className="text-muted-foreground">-</span>;

/** Date cell used by every date column here — dash when absent, never wrapped. */
export const renderDateCell = (date: Date | string | null | undefined) =>
  date ? <span className="whitespace-nowrap tabular-nums">{formatDate(date)}</span> : <MutedDash />;

export const dateExportValue = (date: Date | string | null | undefined) => (date ? formatDate(date) : "");

/**
 * How a truck is identified on the shop floor: the serial number when it has one, otherwise the
 * plate. Sorting falls back to `serialNumber` alone (see the SORT_FIELD_MAPs) because that is the
 * only scalar the API can order by.
 */
export const taskIdentifier = (task: Task): string => task.serialNumber || task.truck?.plate || "";

/** Invoice-to customers of a task's quote, in config order, blanks dropped. */
export function invoiceToCustomerNames(task: Task): string[] {
  const configs = task.quote?.customerConfigs;
  if (!configs || configs.length === 0) return [];
  return configs.map((c) => c.customer?.corporateName || c.customer?.fantasyName || "").filter(Boolean);
}

/**
 * A quote can be billed to several customers, so this cell shows the first two side by side plus
 * a `+N` overflow marker — the same shape both legacy tables used.
 */
export function InvoiceToCustomersCell({ task }: { task: Task }) {
  const names = invoiceToCustomerNames(task);
  if (names.length === 0) return <MutedDash />;
  if (names.length === 1) return <TruncatedTextWithTooltip text={names[0]} className="text-sm" />;
  return (
    <div className="flex items-center gap-1 min-w-0" title={names.join(", ")}>
      <span className="text-sm truncate max-w-[45%]">{names[0]}</span>
      <span className="text-muted-foreground text-sm shrink-0">/</span>
      <span className="text-sm truncate max-w-[45%]">{names[1]}</span>
      {names.length > 2 && <span className="text-muted-foreground text-xs shrink-0">+{names.length - 2}</span>}
    </div>
  );
}

/** The task's OWN customer (who the work is for) — distinct from the invoice-to customers. */
export function taskCustomerName(task: Task): string {
  return task.customer?.corporateName || task.customer?.fantasyName || "";
}

/**
 * Purchase-order numbers across the quote's customer configs. Multi-customer quotes can carry one
 * per customer, so this is a list — and an empty entry is dropped rather than shown as a gap
 * (the attention rule is what points at a MISSING one, on the field itself).
 */
export function quoteOrderNumbers(task: Task): string[] {
  const configs = task.quote?.customerConfigs;
  if (!configs || configs.length === 0) return [];
  return configs.map((c) => (c.orderNumber ?? "").trim()).filter(Boolean);
}

export function OrderNumbersCell({ task }: { task: Task }) {
  const numbers = quoteOrderNumbers(task);
  if (numbers.length === 0) return <MutedDash />;
  return <TruncatedTextWithTooltip text={numbers.join(", ")} className="text-sm tabular-nums" />;
}

/**
 * How this quote gets paid, worded exactly as the wizard's "Condição de Pagamento" picker words it
 * ("À Vista - Boleto", "Parcelado 3x") — the list has to say the same thing as the form, or the two
 * become separate vocabularies for one field.
 *
 * `paymentConfig` is the current shape; `paymentCondition` is the legacy string, converted through
 * the same `legacyToConfig` the wizard uses so an old record reads the same as a new one. Distinct
 * conditions across a multi-customer quote are listed, deduped.
 */
export function paymentMethodLabels(task: Task): string[] {
  const seen = new Set<string>();
  for (const config of task.quote?.customerConfigs ?? []) {
    const cfg = (config as { paymentConfig?: PaymentConfig | null }).paymentConfig ?? legacyToConfig((config as { paymentCondition?: string | null }).paymentCondition);
    const label = PAYMENT_TYPE_OPTIONS.find((o) => o.value === configToTypeValue(cfg))?.label;
    if (label) seen.add(label);
  }
  return [...seen];
}

export function PaymentMethodCell({ task }: { task: Task }) {
  const labels = paymentMethodLabels(task);
  if (labels.length === 0) return <MutedDash />;
  return <TruncatedTextWithTooltip text={labels.join(", ")} className="text-sm" />;
}

/** Paid / total installments across every customer config — the collections progress at a glance. */
export function installmentProgress(task: Task): { paid: number; total: number } {
  let paid = 0;
  let total = 0;
  for (const config of task.quote?.customerConfigs ?? []) {
    for (const installment of config.installments ?? []) {
      total += 1;
      if (installment.status === "PAID") paid += 1;
    }
  }
  return { paid, total };
}

// ---------------------------------------------------------------------------
// Customer filter (async — the customer endpoint caps `limit` at 100 and there
// are ~400 customers, so a static option list would silently hide most of them)
// ---------------------------------------------------------------------------

const CUSTOMER_PAGE_SIZE = 50;

/** Paginated customer search feeding the `entity-*` filter kind. */
export async function searchCustomersForFilter(search: string, page = 1): Promise<{ data: Customer[]; hasMore: boolean }> {
  try {
    const response = await getCustomers({
      orderBy: { fantasyName: "asc" },
      page,
      take: CUSTOMER_PAGE_SIZE,
      include: { logo: true },
      ...(search?.trim() ? { searchingFor: search.trim() } : {}),
    } as never);
    return { data: (response.data ?? []) as Customer[], hasMore: response.meta?.hasNextPage ?? false };
  } catch (error) {
    // Deliberately RETHROWN rather than swallowed into an empty page. Returning `[]` renders
    // "Nenhum cliente encontrado", which tells the user the customer does not exist — for what is
    // actually a failed request. Letting it reject leaves react-query in an error state and the
    // api client's interceptor has already toasted the real reason.
    throw error;
  }
}

export const customerFilterLabel = (c: Customer) => c.corporateName || c.fantasyName;

/**
 * Resolve the customers currently selected in the filter so the chip and the closed combobox read
 * as names instead of uuids. The ids come back from the URL on a cold load, before any search has
 * run, so this is the only thing that can name them.
 */
export function useSelectedCustomers(ids: string[]): Customer[] {
  const enabled = ids.length > 0;
  // `useCustomers` is a `createEntityHooks().useList`, whose signature is (params, options) and
  // which — unlike `useTasks` — does NOT strip react-query keys out of `params`. Passing `enabled`
  // in the first argument therefore never disabled anything: every list mount fired a
  // `GET /customers?where={"id":{"in":[]}}` and `staleTime` was likewise ignored.
  const { data } = useCustomers(
    { where: { id: { in: ids } }, include: { logo: true }, limit: 100 } as never,
    { enabled, staleTime: 5 * 60 * 1000 } as never,
  );
  return useMemo(() => ((data as { data?: Customer[] } | undefined)?.data ?? []) as Customer[], [data]);
}

export function renderCustomerFilterOption(customer: Customer) {
  return (
    <div className="flex items-center gap-3 w-full">
      <CustomerLogoDisplay
        logo={customer.logo}
        customerName={customer.fantasyName || customer.corporateName || ""}
        size="sm"
        shape="rounded"
        className="flex-shrink-0"
      />
      <div className="flex flex-col gap-1 min-w-0 flex-1">
        <div className="font-medium truncate">{customerFilterLabel(customer)}</div>
      </div>
    </div>
  );
}

/**
 * The "faturar para" customer filter, shared by both tables. `queryKey` is per-table so the two
 * pages don't share a react-query cache entry for a search typed on the other one.
 */
export function createCustomerFilterDef(opts: {
  key: string;
  label: string;
  queryKey: string;
  selectedOptions: Customer[];
  icon?: ReactNode;
}): DataTableFilterDef<Task> {
  return {
    key: opts.key,
    label: opts.label,
    type: "entity-multiselect",
    icon: opts.icon ?? <IconBuilding className="h-4 w-4" />,
    placeholder: "Buscar cliente...",
    async: {
      queryKey: [opts.queryKey],
      queryFn: searchCustomersForFilter as never,
      getOptionValue: (c: Customer) => c.id,
      getOptionLabel: customerFilterLabel,
      renderOption: (c: Customer) => renderCustomerFilterOption(c),
      selectedOptions: opts.selectedOptions,
      minSearchLength: 0,
      emptyText: "Nenhum cliente encontrado",
    },
  };
}

/**
 * The `{ search, filters }` a table should START from, read straight off the URL.
 *
 * The DataTable parses `?q=`/`?filters=` into its own state synchronously but only publishes them
 * to the page through an effect, i.e. AFTER the first render. Seeding the page's state with an
 * empty object therefore fired one fully UNFILTERED request on every load of a bookmarked or
 * shared link — painting the wrong rows, and registering the wrong quotes with the attention
 * engine — before the real query replaced it.
 *
 * Deliberately tolerant: a hand-edited or stale `filters` param falls back to no filters rather
 * than throwing during render.
 */
export function initialTableParams(searchParams: URLSearchParams): { search: string; filters: Record<string, unknown> } {
  let filters: Record<string, unknown> = {};
  const raw = searchParams.get("filters");
  if (raw) {
    try {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) filters = parsed as Record<string, unknown>;
    } catch {
      // Malformed param — the table's own parser will reach the same conclusion a tick later.
    }
  }
  return { search: searchParams.get("q") ?? "", filters };
}

/** Read the customer-filter value as a clean id array (URL values are untyped). */
export function customerIdsFromFilter(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((v): v is string => typeof v === "string" && v.length > 0) : [];
}

/** `date-range` filter value → the API's `{ from, to }` date-range shape. */
export function toApiDateRange(value: unknown): { from?: Date; to?: Date } | undefined {
  if (!value || typeof value !== "object") return undefined;
  const { from, to } = value as { from?: string; to?: string };
  if (!from && !to) return undefined;
  return { ...(from ? { from: new Date(from) } : {}), ...(to ? { to: new Date(to) } : {}) };
}

// ---------------------------------------------------------------------------
// Shared query fragments for the two financial task tables
// ---------------------------------------------------------------------------

/** `number-range` filter value → a Prisma `{ gte, lte }`. Ignores an all-empty range. */
export function toNumberRange(value: unknown): { gte?: number; lte?: number } | undefined {
  if (!value || typeof value !== "object") return undefined;
  const { min, max } = value as { min?: number; max?: number };
  if (min == null && max == null) return undefined;
  return { ...(min != null ? { gte: min } : {}), ...(max != null ? { lte: max } : {}) };
}

/** `date-range` filter value → a Prisma `{ gte, lte }`, widened to cover the whole day at both ends. */
export function toPrismaDateRange(value: unknown): { gte?: Date; lte?: Date } | undefined {
  const range = toApiDateRange(value);
  if (!range) return undefined;
  // BOTH ends have to be widened. `DateTimeInput mode="date"` stamps a picked day at 13:00 local,
  // so an unfloored `gte` silently drops everything that happened earlier that day — and most
  // installments are stored at 12:00, i.e. every parcela due ON the "De" day. The API floors this
  // for first-class date params, but a `where` built here never passes through that code.
  const gte = range.from ? new Date(range.from) : undefined;
  if (gte) gte.setHours(0, 0, 0, 0);
  const lte = range.to ? new Date(range.to) : undefined;
  // A date-only "até 20/07" must include everything that happened ON the 20th.
  if (lte) lte.setHours(23, 59, 59, 999);
  return { ...(gte ? { gte } : {}), ...(lte ? { lte } : {}) };
}

/** Read a text filter as a positive integer (Nº do Orçamento is an `Int`). */
export function toPositiveInt(value: unknown): number | undefined {
  const digits = String(value ?? "").replace(/\D/g, "");
  if (!digits) return undefined;
  const n = Number.parseInt(digits, 10);
  return Number.isFinite(n) && n > 0 ? n : undefined;
}

/**
 * "Com / Sem N° do Pedido" as a Prisma condition on the quote.
 *
 * `Sem` deliberately uses `some` over an empty-or-null orderNumber rather than `none` over a
 * filled one: a quote billed to two customers where only ONE is missing its number is still a
 * quote someone has to chase, and `none` would hide exactly those.
 */
export function orderNumberPresenceWhere(value: unknown): Record<string, unknown> | undefined {
  const has = value === true || value === "true";
  const lacks = value === false || value === "false";
  if (!has && !lacks) return undefined;
  return has
    ? // AND of two `not`s rather than `NOT: [a, b]`, which Prisma reads as NOT(a AND b).
      { customerConfigs: { some: { AND: [{ orderNumber: { not: null } }, { orderNumber: { not: "" } }] } } }
    : {
        // A quote with NO customer configs at all has no number either, and `some` alone is false
        // for it — so it used to fall through BOTH filters and be reachable under neither.
        OR: [
          { customerConfigs: { some: { OR: [{ orderNumber: null }, { orderNumber: "" }] } } },
          { customerConfigs: { none: {} } },
        ],
      };
}
