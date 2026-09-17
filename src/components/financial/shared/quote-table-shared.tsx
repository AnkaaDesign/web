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
import {
  coveredTaskCount,
  perVehicleAmount,
  quotePerVehicleTotal,
  quoteVehicleCount,
} from "@/utils/quote-tasks";
import type { PaymentConfig } from "@/schemas/task-quote";
import type { Task } from "@/types";
import type { Billing, TaskQuoteCustomerConfig } from "@/types/task-quote";
import type { Customer } from "@/types";

/**
 * Cells, value extractors and the customer picker shared by the two financial tables
 * (Orçamentos e Faturamento).
 *
 * ⚠️ AS DUAS LISTAS DEIXARAM DE LISTAR A MESMA COISA. Orçamentos tem uma linha por
 * CONTRATO (`TaskQuote`) e Faturamento uma linha por COBRANÇA (`Billing`); nenhuma
 * das duas lista tarefas. O que sobrou aqui é o que independe da unidade da linha —
 * as datas, o travessão, os conversores de filtro, o seletor de cliente — mais os
 * extratores que recebem uma LISTA DE PAGADORES e por isso servem às duas sem saber
 * de onde ela veio. O que era típico da linha-veículo (`taskQuoteTotal`,
 * `taskBillingConfigs`, `taskIdentifier`…) saiu: Orçamentos agrega os seus em
 * `budget/table/quote-row-shared.tsx` e Faturamento lê escalares da cobrança.
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

// ---------------------------------------------------------------------------
// O QUE UMA COBRANÇA COBRA
//
// A lista de Faturamento passou a ter UMA LINHA POR `Billing`. Um orçamento
// `JOINT` de quatro caminhões é UMA linha; um `PER_TASK` de quatro são quatro.
// Com isso some a divisão `quote.total ÷ N`, que existia só para EXPLICAR por que
// o mesmo contrato aparecia N vezes: a linha não é mais uma fatia de um contrato,
// é a cobrança inteira de um recorte, e o número que ela mostra é o que essa
// cobrança cobra.
//
// A propriedade que fecha a conta, e que dá para conferir na tela: num orçamento,
// Σ(valores das linhas de Faturamento) = `quote.total`. Valia antes por acidente
// (`total ÷ N × N`); agora vale por construção.
// ---------------------------------------------------------------------------

/** Duas casas — a mesma precisão em que o valor foi gravado (`Decimal(10,2)`). */
const round2 = (n: number): number => Math.round((n + Number.EPSILON) * 100) / 100;

/**
 * Σ de uma coluna de dinheiro dos pagadores. `null` quando não há pagador
 * carregado — que é "a consulta não trouxe a relação", nunca "vale zero".
 */
function sumConfigMoney(
  configs: readonly TaskQuoteCustomerConfig[] | null | undefined,
  key: "total" | "subtotal",
): number | null {
  if (!configs || configs.length === 0) return null;
  let sum = 0;
  let sawNumber = false;
  for (const config of configs) {
    const n = Number(config?.[key]);
    if (!Number.isFinite(n)) continue;
    sawNumber = true;
    sum += n;
  }
  return sawNumber ? round2(sum) : null;
}

/**
 * QUANTOS VEÍCULOS ESTA COBRANÇA COBRA.
 *
 * Cobertura vazia cai em "cobre o orçamento inteiro", e é deliberado que caia aí
 * e não em um: uma lista vazia significa "a consulta não pediu a relação" ou "a
 * fatia acabou de nascer", nunca "esta cobrança é de um veículo" — responder um
 * faria uma cobrança de sessenta caminhões ser lida como de um. É a mesma regra
 * de `computeQuoteMoney.coveredTaskCount`.
 */
export function billingCoveredVehicles(billing: Billing): number {
  const covered = coveredTaskCount(billing);
  if (covered > 0) return covered;
  return billing.quote ? quoteVehicleCount(billing.quote) : 1;
}

/**
 * O VALOR DESTA COBRANÇA — `Σ customerConfigs[].total`.
 *
 * ⚠️ NÃO se recalcula. A conta já foi feita e GRAVADA: `computeQuoteMoney`
 * produz `configTotal`, que é o mesmo número em `TaskQuoteCustomerConfig.total`,
 * em `Invoice.totalAmount` e na soma das parcelas. Refazê-la na célula criaria
 * uma segunda aritmética de dinheiro, que diverge da primeira no primeiro
 * arredondamento e faz a tela e o boleto discordarem em centavos.
 *
 * SOMA os pagadores em vez de ler o primeiro: dois clientes dividindo os serviços
 * do MESMO recorte são DOIS `customerConfigs` dentro de UMA cobrança, e o que a
 * cobrança cobra é a soma dos dois.
 *
 * O recuo, e o que ele é: sem pagador carregado, `por veículo × veículos
 * cobertos` — os dois presentes no payload da lista. Não é uma segunda fórmula,
 * é exatamente a que gerou o número gravado.
 */
export function billingChargedTotal(billing: Billing): number | null {
  const summed = sumConfigMoney(billing.customerConfigs, "total");
  if (summed !== null) return summed > 0 ? summed : null;
  const perVehicle = quotePerVehicleTotal(billing.quote);
  if (perVehicle == null) return null;
  const value = round2(perVehicle * billingCoveredVehicles(billing));
  return value > 0 ? value : null;
}

/** O subtotal desta cobrança, pela mesma regra do total. */
export function billingChargedSubtotal(billing: Billing): number | null {
  const summed = sumConfigMoney(billing.customerConfigs, "subtotal");
  if (summed !== null) return summed > 0 ? summed : null;
  const grand = Number(billing.quote?.subtotal ?? 0);
  if (!billing.quote || !Number.isFinite(grand) || grand === 0) return null;
  const perVehicle = perVehicleAmount(grand, quoteVehicleCount(billing.quote));
  const value = round2(perVehicle * billingCoveredVehicles(billing));
  return value > 0 ? value : null;
}

/** Date cell used by every date column here — dash when absent, never wrapped. */
export const renderDateCell = (date: Date | string | null | undefined) =>
  date ? <span className="whitespace-nowrap tabular-nums">{formatDate(date)}</span> : <MutedDash />;

export const dateExportValue = (date: Date | string | null | undefined) => (date ? formatDate(date) : "");

/**
 * Invoice-to customers de uma lista de PAGADORES, na ordem deles, brancos fora.
 *
 * ⚠️ Recebe os pagadores, não a linha. Enquanto a lista era de veículos, a
 * função tinha de RECORTAR: num orçamento `PER_TASK` de sessenta caminhões há
 * sessenta configurações do MESMO cliente, e a lista crua fazia a célula
 * anunciar "Marquespan / Marquespan +58" — um tomador lido como sessenta. Com a
 * linha sendo a COBRANÇA o recorte já veio pronto (`billing.customerConfigs` é,
 * por definição, o recorte desta cobrança) e só a deduplicação sobrevive.
 */
export function invoiceToCustomerNames(
  configs: readonly TaskQuoteCustomerConfig[] | null | undefined,
): string[] {
  if (!configs || configs.length === 0) return [];
  const names = configs
    .map((c) => c.customer?.corporateName || c.customer?.fantasyName || "")
    .filter(Boolean);
  return [...new Set(names)];
}

/**
 * Uma cobrança pode ser dividida entre clientes, então a célula mostra os dois
 * primeiros lado a lado e um `+N` — o mesmo formato que as tabelas antigas usavam.
 */
export function InvoiceToCustomersCell({ configs }: { configs?: readonly TaskQuoteCustomerConfig[] | null }) {
  const names = invoiceToCustomerNames(configs);
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

/**
 * How this quote gets paid, worded exactly as the wizard's "Condição de Pagamento" picker words it
 * ("À Vista - Boleto", "Parcelado 3x") — the list has to say the same thing as the form, or the two
 * become separate vocabularies for one field.
 *
 * `paymentConfig` is the current shape; `paymentCondition` is the legacy string, converted through
 * the same `legacyToConfig` the wizard uses so an old record reads the same as a new one. Distinct
 * conditions across a multi-customer quote are listed, deduped.
 */
export function paymentMethodLabels(
  configs: readonly TaskQuoteCustomerConfig[] | null | undefined,
): string[] {
  const seen = new Set<string>();
  for (const config of configs ?? []) {
    const cfg = (config as { paymentConfig?: PaymentConfig | null }).paymentConfig ?? legacyToConfig((config as { paymentCondition?: string | null }).paymentCondition);
    const label = PAYMENT_TYPE_OPTIONS.find((o) => o.value === configToTypeValue(cfg))?.label;
    if (label) {
      seen.add(label);
      continue;
    }
    // No payment shape recorded on the config — but the parcelas exist and can be
    // counted, and a quote that already has parcelas is not "unknown", it is
    // "unlabelled". 21 configs are in this state, and they read "-" here while the
    // detail page shows the parcela as Boleto (which it infers from the slip),
    // so the two screens contradicted each other over the same quote.
    //
    // Only the COUNT is claimed. The list does not load the parcelas' bank slips,
    // so "À Vista - Boleto" vs "- Pix" is not knowable here; saying just "À Vista"
    // states what can be counted and stays silent on the method — which also keeps
    // these visibly distinct from configured rows, which always carry a method.
    const parcelas = (config as { installments?: unknown[] }).installments?.length ?? 0;
    if (parcelas > 1) seen.add(`Parcelado ${parcelas}x`);
    else if (parcelas === 1) seen.add("À Vista");
  }
  return [...seen];
}

export function PaymentMethodCell({ configs }: { configs?: readonly TaskQuoteCustomerConfig[] | null }) {
  const labels = paymentMethodLabels(configs);
  if (labels.length === 0) return <MutedDash />;
  return <TruncatedTextWithTooltip text={labels.join(", ")} className="text-sm" />;
}

/**
 * Parcelas pagas / total, somando TODOS os pagadores recebidos — o andamento da
 * cobrança num relance.
 *
 * ⚠️ Recebe os pagadores, não a linha, pelo mesmo motivo de
 * `invoiceToCustomerNames`: enquanto a linha era um veículo, somar os sessenta
 * planos de um `PER_TASK` fazia a linha do caminhão 12 anunciar "3/180". A
 * cobrança já é o recorte, então a soma dela é exata.
 */
export function installmentProgress(
  configs: readonly TaskQuoteCustomerConfig[] | null | undefined,
): { paid: number; total: number } {
  let paid = 0;
  let total = 0;
  for (const config of configs ?? []) {
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
  // O NÚMERO DO PEDIDO É DA TAREFA (`Task.customerOrderNumber`) desde que um
  // orçamento passou a cobrir N caminhões — o pedido é por ENTREGA. As condições
  // aqui são sobre o registro da TAREFA, e não mais um `some` sobre as
  // configurações de faturamento do orçamento (a coluna antiga foi removida:
  // mandá-la agora derruba a consulta inteira).
  //
  // ⚠️ Quem chama pendura isto onde as tarefas estiverem: a lista de Orçamentos
  // em `tasks: { some: … }` do contrato. O Faturamento NÃO usa mais esta função —
  // `GET /billings` não aceita `where`, e o `hasOrderNumber` de lá é um parâmetro
  // plano que o servidor traduz sobre a cobertura da cobrança.
  return has
    ? // AND de dois `not` em vez de `NOT: [a, b]`, que o Prisma lê como NOT(a AND b).
      { AND: [{ customerOrderNumber: { not: null } }, { customerOrderNumber: { not: "" } }] }
    : { OR: [{ customerOrderNumber: null }, { customerOrderNumber: "" }] };
}
