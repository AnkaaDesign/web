import { useState, useMemo, useCallback, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import {
  IconArrowsExchange2,
  IconFilter,
  IconHelpCircle,
  IconRefresh,
  IconUpload,
} from "@tabler/icons-react";
import { PrivilegeRoute } from "@/components/navigation/privilege-route";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { TableSearchInput } from "@/components/ui/table-search-input";
import {
  TransactionsByDateAccordion,
  getReconciliationColumnsMeta,
  getDefaultVisibleReconciliationColumns,
} from "@/components/financial/reconciliation/transactions-by-date-accordion";
import { ColumnVisibilityManager } from "@/components/financial/reconciliation/transactions-column-visibility-manager";
import { useColumnVisibility } from "@/hooks/common/use-column-visibility";
import { OfxImportDialog } from "@/components/financial/reconciliation/ofx-import-dialog";
import { ManualMatchDialog } from "@/components/financial/reconciliation/manual-match-dialog";
import { ScoringWorkflowDialog } from "@/components/financial/reconciliation/scoring-workflow-dialog";
import { UnmatchConfirmDialog } from "@/components/financial/reconciliation/unmatch-confirm-dialog";
import { IgnoreTransactionDialog } from "@/components/financial/reconciliation/ignore-transaction-dialog";
import { CategoryPickerDialog } from "@/components/financial/reconciliation/category-picker-dialog";
import {
  ReconciliationFilterSheet,
  getDefaultReconciliationFilters,
  type ReconciliationFilters,
} from "@/components/financial/reconciliation/reconciliation-filter-sheet";
import {
  useBankTransaction,
  useBankTransactions,
  useChangeCategory,
  useIgnoreTransaction,
  useMatchTransaction,
  useRunAutoMatch,
  useUnmatchTransaction,
} from "@/hooks/financial/use-reconciliation";
import { useUrlDialog } from "@/hooks/common/use-url-dialog";
import { useToast } from "@/hooks/common/use-toast";
import { usePageTracker } from "@/hooks/common/use-page-tracker";
import { SECTOR_PRIVILEGES, FAVORITE_PAGES, routes } from "@/constants";
import type {
  BankTransaction,
  BankTransactionSubtype,
  MatchType,
} from "@/types/reconciliation";

// Upper bound passed to the API when the user is in period mode. Matches the
// API DTO cap so a busy month/year still fits in a single fetch.
const PERIOD_PAGE_SIZE = 1000;

// Defensive guard: dialog URL state should hold a BankTransaction UUID. If a
// non-UUID slips in (e.g. because a future URL key collision aliases a filter
// value into a dialog hook), skip the fetch rather than triggering a 404.
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const asUuid = (v: string | null | undefined): string | undefined =>
  v && UUID_RE.test(v) ? v : undefined;

function parseMonthsParam(raw: string | null): string[] | undefined {
  if (!raw) return undefined;
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) return parsed.map(String);
  } catch {
    // ignore — fall through
  }
  return undefined;
}

/**
 * Parse a `YYYY-MM-DD` (or ISO) date string into { year, month } with month as
 * a zero-padded "01".."12". Returns null for anything we can't read so callers
 * fall back to defaults instead of producing a NaN period.
 */
function parseYmd(raw: string | null): { year: number; month: string } | null {
  if (!raw) return null;
  const m = /^(\d{4})-(\d{2})/.exec(raw.trim());
  if (!m) return null;
  const year = Number(m[1]);
  const monthNum = Number(m[2]);
  if (!year || monthNum < 1 || monthNum > 12) return null;
  return { year, month: String(monthNum).padStart(2, "0") };
}

/**
 * Map URL `dateFrom`/`dateTo` (sent by the Recurring/Statistics drill-downs as
 * `YYYY-MM-DD`) onto this page's period model (year + months). The list always
 * drives both the API range and the accordion's day enumeration off year+months,
 * so collapsing a raw date range into the months it spans keeps a single source
 * of truth instead of bolting on parallel date plumbing.
 *
 * Only handles ranges inside a single calendar year (which is all the referrers
 * emit). When `dateTo` is absent we span from `dateFrom`'s month to December so
 * the linked rows after that date still appear.
 */
function periodFromDateParams(
  params: URLSearchParams,
): { year: number; months: string[] } | null {
  const from = parseYmd(params.get("dateFrom"));
  const to = parseYmd(params.get("dateTo"));
  if (!from && !to) return null;
  // Anchor on whichever bound we have; prefer `from`.
  const anchor = from ?? to!;
  const year = anchor.year;
  const startMonth = from ? parseInt(from.month, 10) : 1;
  // No explicit end → run to December so post-anchor rows remain visible.
  const endMonth = to && to.year === year ? parseInt(to.month, 10) : 12;
  const lo = Math.min(startMonth, endMonth);
  const hi = Math.max(startMonth, endMonth);
  const months: string[] = [];
  for (let m = lo; m <= hi; m++) months.push(String(m).padStart(2, "0"));
  return { year, months };
}

/**
 * Build the filter state from the URL.
 *
 * Two entry modes:
 *  - "Clean" entry (no narrowing param) → apply the page defaults: type=DEBIT
 *    and the current month, so the accordion opens on a sensible recent view.
 *  - Deep link (any narrowing param present: categoryIds, counterparty,
 *    matchType, reconciliationStatus, reconciliationSource, subtype, amount
 *    bounds, dateFrom/dateTo, or search) → honor the URL verbatim. We must NOT
 *    force type=DEBIT (the linked row may be a CREDIT) nor clamp to the current
 *    month (it may be older), or the deep-linked rows get filtered out of view.
 */
function parseFiltersFromUrl(params: URLSearchParams): ReconciliationFilters {
  const def = getDefaultReconciliationFilters();
  const yearParam = params.get("year");
  const monthsParam = parseMonthsParam(params.get("months"));
  const datePeriod = periodFromDateParams(params);
  const categoryIdsParam = params.get("categoryIds");
  // Comma-separated category-id multi-select: `?categoryIds=<id1>,<id2>`.
  const categoryIds = categoryIdsParam
    ? categoryIdsParam.split(",").filter(Boolean)
    : [];
  const reconciliationStatus =
    (params.get("reconciliationStatus") as ReconciliationFilters["reconciliationStatus"]) ||
    undefined;
  const reconciliationSource =
    (params.get("reconciliationSource") as ReconciliationFilters["reconciliationSource"]) ||
    undefined;
  const matchType = (params.get("matchType") as MatchType | null) || undefined;
  const subtype = (params.get("subtype") as BankTransactionSubtype | null) || undefined;
  const amountMin = params.get("amountMin") ? Number(params.get("amountMin")) : undefined;
  const amountMax = params.get("amountMax") ? Number(params.get("amountMax")) : undefined;
  const counterparty = params.get("counterparty") || undefined;
  const search = params.get("search") || undefined;
  const typeParam = params.get("type") as ReconciliationFilters["type"] | null;

  // A deep link is any param that narrows the result set below the defaults.
  // When one is present we must not silently re-apply the DEBIT + current-month
  // defaults, or the linked rows can fall outside the visible window.
  const isDeepLink =
    categoryIds.length > 0 ||
    !!reconciliationStatus ||
    !!reconciliationSource ||
    !!matchType ||
    !!subtype ||
    amountMin !== undefined ||
    amountMax !== undefined ||
    !!counterparty ||
    !!search ||
    !!datePeriod ||
    !!typeParam ||
    !!yearParam ||
    !!monthsParam;

  // Period precedence: explicit year/months win, then a dateFrom/dateTo range,
  // then (clean entry) the current-month default. On a deep link that carries
  // no period at all, fall back to the full current year so an older linked row
  // is not clamped out by the single-month default.
  const year = yearParam
    ? Number(yearParam)
    : datePeriod?.year ?? def.year;
  const months =
    monthsParam ??
    datePeriod?.months ??
    (isDeepLink && !typeParam && !yearParam
      ? Array.from({ length: 12 }, (_, i) => String(i + 1).padStart(2, "0"))
      : def.months);

  return {
    reconciliationStatus,
    categoryIds: categoryIds.length > 0 ? categoryIds : undefined,
    reconciliationSource,
    matchType,
    // Honor an explicit ?type=; on a deep link without one, leave undefined
    // ("Todos") so CREDIT rows aren't hidden. Only a clean entry gets DEBIT.
    type: typeParam ?? (isDeepLink ? undefined : def.type),
    subtype,
    year,
    months,
    amountMin,
    amountMax,
  };
  // NOTE: `counterparty` is intentionally NOT carried in the filter model. A URL
  // `?counterparty=` is folded into the visible search box on mount (server
  // `search` already matches the counterparty), so it surfaces as a real,
  // clearable control instead of an invisible phantom filter.
}

/**
 * Build the inclusive list of YYYY-MM-DD strings for every day in every
 * selected month. The accordion uses this to render *all* days in the period,
 * not only those that contain transactions.
 *
 * For the current month, the list stops at today — future days carry no
 * transactions and just create empty noise above the meaningful rows.
 */
function buildDatesForPeriod(year: number, months: string[]): string[] {
  const dates: string[] = [];
  const today = new Date();
  const todayYear = today.getFullYear();
  const todayMonth = today.getMonth() + 1;
  const todayDay = today.getDate();
  const sortedMonths = [...months].sort();
  for (const m of sortedMonths) {
    const monthNum = parseInt(m, 10);
    if (!monthNum || monthNum < 1 || monthNum > 12) continue;
    // new Date(y, m, 0) = last day of month `m-1`. Used to enumerate days.
    let lastDay = new Date(year, monthNum, 0).getDate();
    // Cap at today when iterating the current month so we don't render an
    // empty stack of future days above the latest real activity.
    if (year === todayYear && monthNum === todayMonth) {
      lastDay = Math.min(lastDay, todayDay);
    } else if (year > todayYear || (year === todayYear && monthNum > todayMonth)) {
      // Future month: skip entirely.
      continue;
    }
    for (let d = 1; d <= lastDay; d++) {
      const dd = String(d).padStart(2, "0");
      const mm = String(monthNum).padStart(2, "0");
      dates.push(`${year}-${mm}-${dd}`);
    }
  }
  // Newest-first to match how the accordion has always rendered.
  return dates.reverse();
}

/**
 * Derive an inclusive [dateFrom, dateTo] range from the selected year+months
 * so the API can filter transactions. Server `postedAt` is a timestamp, so we
 * set dateFrom to the first millisecond and dateTo to the last millisecond of
 * the day to avoid losing the last day in the range.
 */
function deriveDateRange(year: number, months: string[]): { dateFrom: string; dateTo: string } | null {
  if (!months.length) return null;
  const sorted = [...months].map(m => parseInt(m, 10)).filter(n => n >= 1 && n <= 12).sort((a, b) => a - b);
  if (!sorted.length) return null;
  const firstMonth = sorted[0];
  const lastMonth = sorted[sorted.length - 1];
  const dateFrom = new Date(year, firstMonth - 1, 1, 0, 0, 0, 0).toISOString();
  // Day 0 of the next month = last day of `lastMonth`.
  const dateTo = new Date(year, lastMonth, 0, 23, 59, 59, 999).toISOString();
  return { dateFrom, dateTo };
}

export const ReconciliationTransactionsListPage = () => {
  usePageTracker({ title: "Transações - Conciliação", icon: "list" });
  const { toast } = useToast();
  const [searchParams, setSearchParams] = useSearchParams();
  // Seed the visible search box from `?search=` or a deep-linked `?counterparty=`.
  // The server `search` already matches against the counterparty, so surfacing
  // a counterparty deep link in the search input makes the active filter visible
  // (instead of a phantom, invisible narrowing) while keeping results correct.
  const [searchText, setSearchText] = useState(
    () => searchParams.get("search") || searchParams.get("counterparty") || "",
  );
  const [showFilters, setShowFilters] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [scoringHelpOpen, setScoringHelpOpen] = useState(false);
  const [filters, setFilters] = useState<ReconciliationFilters>(() =>
    parseFiltersFromUrl(searchParams),
  );

  // Column visibility (persisted in localStorage). This view always renders the
  // global account column, so the manager is built for showAccountColumn=true.
  // TIPO and FORMA are hidden by default; DATA is locked (see manager).
  const reconciliationColumns = useMemo(() => getReconciliationColumnsMeta(true), []);
  const defaultVisibleColumns = useMemo(
    () => getDefaultVisibleReconciliationColumns(true),
    [],
  );
  const { visibleColumns, setVisibleColumns } = useColumnVisibility(
    "reconciliation-transactions-columns",
    defaultVisibleColumns,
  );

  const dateRange = useMemo(() => {
    if (!filters.year || !filters.months?.length) return null;
    return deriveDateRange(filters.year, filters.months);
  }, [filters.year, filters.months]);

  const dates = useMemo(() => {
    if (!filters.year || !filters.months?.length) return [];
    return buildDatesForPeriod(filters.year, filters.months);
  }, [filters.year, filters.months]);

  const { data, isLoading, refetch } = useBankTransactions({
    page: 1,
    pageSize: PERIOD_PAGE_SIZE,
    sortBy: "postedAt",
    sortDir: "desc",
    search: searchText || undefined,
    reconciliationStatus: filters.reconciliationStatus,
    categoryIds: filters.categoryIds,
    reconciliationSource: filters.reconciliationSource,
    matchType: filters.matchType,
    type: filters.type,
    subtype: filters.subtype,
    amountMin: filters.amountMin,
    amountMax: filters.amountMax,
    dateFrom: dateRange?.dateFrom,
    dateTo: dateRange?.dateTo,
  });

  // Modal state is driven by URL params so cross-links and refreshes work.
  // ?txId=… opens the match/details dialog; ?unmatch=… and ?ignore=… open
  // their respective confirm dialogs. A single value at a time keeps things
  // unambiguous.
  const txDialog = useUrlDialog("txId");
  const unmatchDialog = useUrlDialog("unmatch");
  const ignoreDialog = useUrlDialog("ignore");
  // Distinct from the ?category= FILTER URL key. If both shared the same key,
  // filtering by category would also open the category-edit dialog with the
  // category enum value (e.g. "TRIBUTO") interpreted as a transaction ID,
  // triggering a phantom GET /transactions/TRIBUTO → 404.
  const categoryDialog = useUrlDialog("editCategory");

  // Prefer the already-loaded list row; fall back to fetching the single tx
  // by id when the deep link arrives before the list contains it (e.g., the
  // user shared a link to a tx that's on a different page).
  const txDialogId = asUuid(txDialog.value);
  const txFromList = useMemo<BankTransaction | null>(() => {
    if (!txDialogId || !data) return null;
    return data.data.find(t => t.id === txDialogId) ?? null;
  }, [txDialogId, data]);
  const { data: fetchedTx } = useBankTransaction(
    txDialogId && !txFromList ? txDialogId : undefined,
  );
  const matchTx = txFromList ?? fetchedTx ?? null;

  const unmatchDialogId = asUuid(unmatchDialog.value);
  const unmatchTxFromList = useMemo<BankTransaction | null>(() => {
    if (!unmatchDialogId || !data) return null;
    return data.data.find(t => t.id === unmatchDialogId) ?? null;
  }, [unmatchDialogId, data]);
  const { data: fetchedUnmatchTx } = useBankTransaction(
    unmatchDialogId && !unmatchTxFromList ? unmatchDialogId : undefined,
  );
  const unmatchTx = unmatchTxFromList ?? fetchedUnmatchTx ?? null;

  const ignoreDialogId = asUuid(ignoreDialog.value);
  const ignoreTxFromList = useMemo<BankTransaction | null>(() => {
    if (!ignoreDialogId || !data) return null;
    return data.data.find(t => t.id === ignoreDialogId) ?? null;
  }, [ignoreDialogId, data]);
  const { data: fetchedIgnoreTx } = useBankTransaction(
    ignoreDialogId && !ignoreTxFromList ? ignoreDialogId : undefined,
  );
  const ignoreTx = ignoreTxFromList ?? fetchedIgnoreTx ?? null;

  const matchMut = useMatchTransaction();
  const unmatchMut = useUnmatchTransaction();
  const ignoreMut = useIgnoreTransaction();
  const runMut = useRunAutoMatch();
  const categoryMut = useChangeCategory();

  const categoryDialogId = asUuid(categoryDialog.value);
  const categoryTxFromList = useMemo<BankTransaction | null>(() => {
    if (!categoryDialogId || !data) return null;
    return data.data.find(t => t.id === categoryDialogId) ?? null;
  }, [categoryDialogId, data]);
  const { data: fetchedCategoryTx } = useBankTransaction(
    categoryDialogId && !categoryTxFromList ? categoryDialogId : undefined,
  );
  const categoryTx = categoryTxFromList ?? fetchedCategoryTx ?? null;

  // Keep the search query in the URL for shareability. Avoid writing when
  // nothing changed to prevent render loops.
  useEffect(() => {
    const params = new URLSearchParams(searchParams);
    if (searchText) params.set("search", searchText);
    else params.delete("search");
    // A deep-linked `?counterparty=` is folded into the search box on mount, so
    // drop the now-redundant param to avoid a stale, invisible duplicate filter.
    params.delete("counterparty");
    if (params.toString() !== searchParams.toString()) {
      setSearchParams(params, { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchText]);

  const handleFilterApply = useCallback(
    (next: ReconciliationFilters) => {
      setFilters(next);
      const params = new URLSearchParams(searchParams);
      // Strip prior filter keys, preserve modal/search params. Also drop the
      // deep-link-only date params (dateFrom/dateTo, counterparty): once the
      // user applies the sheet, year/months + the search box are the canonical
      // period/counterparty controls, so leaving stale date params would let
      // them silently re-narrow the list on the next URL parse.
      [
        "reconciliationStatus",
        "categoryIds",
        "reconciliationSource",
        "matchType",
        "type",
        "subtype",
        "year",
        "months",
        "amountMin",
        "amountMax",
        "counterparty",
        "dateFrom",
        "dateTo",
      ].forEach(k => params.delete(k));
      // Serialize back: months is JSON-encoded; everything else is a plain string.
      if (next.reconciliationStatus) params.set("reconciliationStatus", next.reconciliationStatus);
      if (next.categoryIds && next.categoryIds.length > 0) {
        params.set("categoryIds", next.categoryIds.join(","));
      }
      if (next.reconciliationSource) params.set("reconciliationSource", next.reconciliationSource);
      if (next.matchType) params.set("matchType", next.matchType);
      if (next.type) params.set("type", next.type);
      if (next.subtype) params.set("subtype", next.subtype);
      if (next.year) params.set("year", String(next.year));
      if (next.months && next.months.length > 0)
        params.set("months", JSON.stringify(next.months));
      if (next.amountMin !== undefined) params.set("amountMin", String(next.amountMin));
      if (next.amountMax !== undefined) params.set("amountMax", String(next.amountMax));
      setSearchParams(params);
    },
    [searchParams, setSearchParams],
  );

  const activeFilterCount = useMemo(() => {
    const def = getDefaultReconciliationFilters();
    let count = 0;
    if (filters.reconciliationStatus) count++;
    if (filters.categoryIds && filters.categoryIds.length > 0) count++;
    if (filters.reconciliationSource) count++;
    if (filters.matchType) count++;
    if (filters.type !== def.type) count++;
    if (filters.subtype) count++;
    if (filters.year && filters.year !== def.year) count++;
    if (
      filters.months &&
      (filters.months.length !== 1 || filters.months[0] !== def.months?.[0])
    )
      count++;
    if (filters.amountMin !== undefined) count++;
    if (filters.amountMax !== undefined) count++;
    return count;
  }, [filters]);

  // Build a Portuguese-friendly title that reflects the active period.
  const periodTitle = useMemo(() => {
    if (!filters.year || !filters.months?.length) return "Transações Bancárias";
    if (filters.months.length === 1) {
      const monthName = new Date(filters.year, parseInt(filters.months[0]) - 1)
        .toLocaleDateString("pt-BR", { month: "long" });
      return `Transações - ${monthName.charAt(0).toUpperCase() + monthName.slice(1)} de ${filters.year}`;
    }
    return `Transações - ${filters.months.length} meses de ${filters.year}`;
  }, [filters.year, filters.months]);

  return (
    <PrivilegeRoute requiredPrivilege={[SECTOR_PRIVILEGES.ADMIN, SECTOR_PRIVILEGES.FINANCIAL]}>
      <div className="h-full flex flex-col gap-4 bg-background px-4 pt-4">
        <PageHeader
          variant="list"
          title={periodTitle}
          icon={IconArrowsExchange2}
          favoritePage={FAVORITE_PAGES.FINANCEIRO_CONCILIACAO_TRANSACOES}
          breadcrumbs={[
            { label: "Início", href: routes.home },
            { label: "Financeiro", href: routes.financial.root },
            { label: "Conciliação Bancária", href: routes.financial.reconciliation.root },
            { label: "Transações" },
          ]}
          actions={[
            {
              key: "verify",
              label: "Verificar",
              icon: IconRefresh,
              onClick: () => {
                runMut.mutate(
                  {},
                  {
                    onSuccess: r => {
                      // POST /run is a single pipeline: classify → match → categorize.
                      // Summarize all three stages so the user sees exactly what
                      // happened in one verification pass.
                      const classified = r.classified?.processed ?? 0;
                      toast({
                        title: "Verificação concluída",
                        description: `${classified} classificadas · ${r.matched} conciliadas · ${r.categorized} categorizadas`,
                        variant: "success",
                      });
                      refetch();
                    },
                    // Error toast is emitted by the axios error interceptor.
                  },
                );
              },
              variant: "default" as const,
              loading: runMut.isPending,
            },
            {
              key: "import",
              label: "Importar OFX",
              icon: IconUpload,
              onClick: () => setImportOpen(true),
              variant: "outline" as const,
            },
            {
              key: "scoring-help",
              label: "Como funciona",
              icon: IconHelpCircle,
              onClick: () => setScoringHelpOpen(true),
              variant: "outline" as const,
            },
          ]}
          className="flex-shrink-0"
        />

        <div className="flex-1 min-h-0 pb-6 flex flex-col">
          <Card className="flex flex-col shadow-sm border border-border h-full">
            <CardContent className="flex-1 flex flex-col p-4 space-y-4 overflow-hidden">
              <div className="flex flex-col gap-3 sm:flex-row">
                <TableSearchInput
                  value={searchText}
                  onChange={v => setSearchText(v)}
                  placeholder="Buscar por descrição, contraparte ou FITID..."
                />
                <Button
                  variant={activeFilterCount > 0 ? "default" : "outline"}
                  onClick={() => setShowFilters(true)}
                  className="group"
                >
                  <IconFilter className="h-4 w-4 text-muted-foreground group-hover:text-foreground transition-colors" />
                  <span className="text-foreground">
                    Filtros{activeFilterCount > 0 ? ` (${activeFilterCount})` : ""}
                  </span>
                </Button>
                <ColumnVisibilityManager
                  columns={reconciliationColumns}
                  visibleColumns={visibleColumns}
                  onVisibilityChange={setVisibleColumns}
                  defaultColumns={defaultVisibleColumns}
                />
              </div>

              <div className="flex-1 min-h-0 overflow-auto">
                <TransactionsByDateAccordion
                  data={data?.data ?? []}
                  dates={dates}
                  isLoading={isLoading}
                  showAccountColumn
                  visibleColumns={visibleColumns}
                  onMatch={tx => txDialog.set(tx.id)}
                  onUnmatch={tx => unmatchDialog.set(tx.id)}
                  onIgnore={tx => ignoreDialog.set(tx.id)}
                  onChangeCategory={tx => categoryDialog.set(tx.id)}
                  onViewDetails={tx => txDialog.set(tx.id)}
                />
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      <ReconciliationFilterSheet
        open={showFilters}
        onOpenChange={setShowFilters}
        filters={filters}
        onApply={handleFilterApply}
      />

      <OfxImportDialog
        open={importOpen}
        onOpenChange={setImportOpen}
        onImported={() => refetch()}
      />

      <ScoringWorkflowDialog
        open={scoringHelpOpen}
        onOpenChange={setScoringHelpOpen}
      />

      <ManualMatchDialog
        open={txDialog.open}
        onOpenChange={open => !open && txDialog.clear()}
        transaction={matchTx}
        isLoading={matchMut.isPending}
        onRequestUnmatch={() => {
          if (!matchTx) return;
          unmatchDialog.set(matchTx.id);
          txDialog.clear();
        }}
        onConfirm={payload => {
          if (!matchTx) return;
          matchMut.mutate(
            { transactionId: matchTx.id, payload },
            {
              // Success/error toasts are emitted by the axios interceptors.
              onSuccess: () => {
                txDialog.clear();
              },
            },
          );
        }}
      />

      <UnmatchConfirmDialog
        open={unmatchDialog.open}
        onOpenChange={open => !open && unmatchDialog.clear()}
        matchCount={unmatchTx?.matches?.length ?? 0}
        isLoading={unmatchMut.isPending}
        onConfirm={() => {
          if (!unmatchTx) return;
          unmatchMut.mutate(unmatchTx.id, {
            // Success/error toasts are emitted by the axios interceptors.
            onSuccess: () => {
              unmatchDialog.clear();
            },
          });
        }}
      />

      <IgnoreTransactionDialog
        open={ignoreDialog.open}
        onOpenChange={open => !open && ignoreDialog.clear()}
        isLoading={ignoreMut.isPending}
        onConfirm={reason => {
          if (!ignoreTx) return;
          ignoreMut.mutate(
            { transactionId: ignoreTx.id, payload: { reason } },
            {
              // Success/error toasts are emitted by the axios interceptors.
              onSuccess: () => {
                ignoreDialog.clear();
              },
            },
          );
        }}
      />

      <CategoryPickerDialog
        open={categoryDialog.open}
        onOpenChange={open => !open && categoryDialog.clear()}
        transaction={categoryTx}
        isLoading={categoryMut.isPending}
        onConfirm={payload => {
          if (!categoryTx) return;
          categoryMut.mutate(
            { transactionId: categoryTx.id, payload },
            {
              // Success/error toasts are emitted by the axios interceptors.
              onSuccess: () => {
                categoryDialog.clear();
              },
            },
          );
        }}
      />
    </PrivilegeRoute>
  );
};

export default ReconciliationTransactionsListPage;
