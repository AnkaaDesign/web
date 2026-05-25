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
import { TransactionsByDateAccordion } from "@/components/financial/reconciliation/transactions-by-date-accordion";
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
  ReconciliationCategory,
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

function parseFiltersFromUrl(params: URLSearchParams): ReconciliationFilters {
  const def = getDefaultReconciliationFilters();
  const yearParam = params.get("year");
  const monthsParam = parseMonthsParam(params.get("months"));
  const categoryParam = params.get("category");
  // Comma-separated category multi-select: `?category=NF,TARIFA_BANCARIA`.
  const categories: ReconciliationCategory[] = categoryParam
    ? (categoryParam.split(",").filter(Boolean) as ReconciliationCategory[])
    : [];
  return {
    reconciliationStatus:
      (params.get("reconciliationStatus") as ReconciliationFilters["reconciliationStatus"]) ||
      undefined,
    category:
      categories.length > 1
        ? categories
        : categories.length === 1
          ? categories[0]
          : undefined,
    reconciliationSource:
      (params.get("reconciliationSource") as ReconciliationFilters["reconciliationSource"]) ||
      undefined,
    matchType: (params.get("matchType") as MatchType | null) || undefined,
    type: (params.get("type") as ReconciliationFilters["type"]) || def.type,
    subtype: (params.get("subtype") as BankTransactionSubtype | null) || undefined,
    year: yearParam ? Number(yearParam) : def.year,
    months: monthsParam ?? def.months,
    amountMin: params.get("amountMin") ? Number(params.get("amountMin")) : undefined,
    amountMax: params.get("amountMax") ? Number(params.get("amountMax")) : undefined,
    counterparty: params.get("counterparty") || undefined,
  };
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
  const [searchText, setSearchText] = useState(searchParams.get("search") || "");
  const [showFilters, setShowFilters] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [scoringHelpOpen, setScoringHelpOpen] = useState(false);
  const [filters, setFilters] = useState<ReconciliationFilters>(() =>
    parseFiltersFromUrl(searchParams),
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
    category: filters.category,
    reconciliationSource: filters.reconciliationSource,
    matchType: filters.matchType,
    type: filters.type,
    subtype: filters.subtype,
    amountMin: filters.amountMin,
    amountMax: filters.amountMax,
    counterparty: filters.counterparty,
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
    if (params.toString() !== searchParams.toString()) {
      setSearchParams(params, { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchText]);

  const handleFilterApply = useCallback(
    (next: ReconciliationFilters) => {
      setFilters(next);
      const params = new URLSearchParams(searchParams);
      // Strip prior filter keys, preserve modal/search params.
      [
        "reconciliationStatus",
        "category",
        "reconciliationSource",
        "matchType",
        "type",
        "subtype",
        "year",
        "months",
        "amountMin",
        "amountMax",
        "counterparty",
      ].forEach(k => params.delete(k));
      // Serialize back: months is JSON-encoded; everything else is a plain string.
      if (next.reconciliationStatus) params.set("reconciliationStatus", next.reconciliationStatus);
      if (next.category) {
        params.set(
          "category",
          Array.isArray(next.category) ? next.category.join(",") : next.category,
        );
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
      if (next.counterparty) params.set("counterparty", next.counterparty);
      setSearchParams(params);
    },
    [searchParams, setSearchParams],
  );

  const activeFilterCount = useMemo(() => {
    const def = getDefaultReconciliationFilters();
    let count = 0;
    if (filters.reconciliationStatus) count++;
    if (filters.category) count++;
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
    if (filters.counterparty) count++;
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
            { label: "Conciliação Bancária" },
            { label: "Transações" },
          ]}
          actions={[
            {
              key: "rematch",
              label: "Re-executar Conciliação",
              icon: IconRefresh,
              onClick: () => {
                runMut.mutate(
                  {},
                  {
                    onSuccess: r => {
                      // Pipeline result: classifier ran first, then NF matcher.
                      // Surface the totals from both stages so the user sees
                      // exactly what happened.
                      const classified = r.classified?.reconciled ?? 0;
                      toast({
                        title: "Conciliação concluída",
                        description: `${classified} auto-classificada(s) · ${r.matched} NF(s) conciliada(s)`,
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
              </div>

              <div className="flex-1 min-h-0 overflow-auto">
                <TransactionsByDateAccordion
                  data={data?.data ?? []}
                  dates={dates}
                  isLoading={isLoading}
                  showAccountColumn
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
