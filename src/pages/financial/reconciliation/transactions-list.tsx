import { useState, useMemo, useCallback, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import {
  IconArrowsExchange2,
  IconFilter,
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
import { UnmatchConfirmDialog } from "@/components/financial/reconciliation/unmatch-confirm-dialog";
import { IgnoreTransactionDialog } from "@/components/financial/reconciliation/ignore-transaction-dialog";
import {
  ReconciliationFilterSheet,
  getDefaultReconciliationFilters,
  type ReconciliationFilters,
} from "@/components/financial/reconciliation/reconciliation-filter-sheet";
import {
  useBankTransaction,
  useBankTransactions,
  useIgnoreTransaction,
  useMatchTransaction,
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
  return {
    matchStatus:
      (params.get("matchStatus") as ReconciliationFilters["matchStatus"]) || undefined,
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
 */
function buildDatesForPeriod(year: number, months: string[]): string[] {
  const dates: string[] = [];
  // Sort months ascending so the accordion is chronological from top to bottom.
  const sortedMonths = [...months].sort();
  for (const m of sortedMonths) {
    const monthNum = parseInt(m, 10);
    if (!monthNum || monthNum < 1 || monthNum > 12) continue;
    // new Date(y, m, 0) = last day of month `m-1`. Used to enumerate days.
    const daysInMonth = new Date(year, monthNum, 0).getDate();
    for (let d = 1; d <= daysInMonth; d++) {
      const dd = String(d).padStart(2, "0");
      const mm = String(monthNum).padStart(2, "0");
      dates.push(`${year}-${mm}-${dd}`);
    }
  }
  // Display newest-first by default — matches the previous sort order and
  // mirrors how the table used to render.
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

  const { data, isLoading, isFetching, refetch } = useBankTransactions({
    page: 1,
    pageSize: PERIOD_PAGE_SIZE,
    sortBy: "postedAt",
    sortDir: "desc",
    search: searchText || undefined,
    matchStatus: filters.matchStatus,
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

  // Prefer the already-loaded list row; fall back to fetching the single tx
  // by id when the deep link arrives before the list contains it (e.g., the
  // user shared a link to a tx that's on a different page).
  const txFromList = useMemo<BankTransaction | null>(() => {
    if (!txDialog.value || !data) return null;
    return data.data.find(t => t.id === txDialog.value) ?? null;
  }, [txDialog.value, data]);
  const { data: fetchedTx } = useBankTransaction(
    txDialog.value && !txFromList ? txDialog.value : undefined,
  );
  const matchTx = txFromList ?? fetchedTx ?? null;

  const unmatchTxFromList = useMemo<BankTransaction | null>(() => {
    if (!unmatchDialog.value || !data) return null;
    return data.data.find(t => t.id === unmatchDialog.value) ?? null;
  }, [unmatchDialog.value, data]);
  const { data: fetchedUnmatchTx } = useBankTransaction(
    unmatchDialog.value && !unmatchTxFromList ? unmatchDialog.value : undefined,
  );
  const unmatchTx = unmatchTxFromList ?? fetchedUnmatchTx ?? null;

  const ignoreTxFromList = useMemo<BankTransaction | null>(() => {
    if (!ignoreDialog.value || !data) return null;
    return data.data.find(t => t.id === ignoreDialog.value) ?? null;
  }, [ignoreDialog.value, data]);
  const { data: fetchedIgnoreTx } = useBankTransaction(
    ignoreDialog.value && !ignoreTxFromList ? ignoreDialog.value : undefined,
  );
  const ignoreTx = ignoreTxFromList ?? fetchedIgnoreTx ?? null;

  const matchMut = useMatchTransaction();
  const unmatchMut = useUnmatchTransaction();
  const ignoreMut = useIgnoreTransaction();

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
        "matchStatus",
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
      if (next.matchStatus) params.set("matchStatus", next.matchStatus);
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
    if (filters.matchStatus) count++;
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
              key: "import",
              label: "Importar OFX",
              icon: IconUpload,
              onClick: () => setImportOpen(true),
              variant: "default" as const,
            },
            {
              key: "refresh",
              label: "Atualizar",
              icon: IconRefresh,
              onClick: () => refetch(),
              variant: "outline" as const,
              loading: isFetching,
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
              onSuccess: () => {
                toast({ title: "Conciliação salva", variant: "success" });
                txDialog.clear();
              },
              onError: err =>
                toast({
                  title: "Falha ao salvar conciliação",
                  description: (err as Error).message,
                  variant: "error",
                }),
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
            onSuccess: () => {
              toast({ title: "Conciliação desfeita", variant: "success" });
              unmatchDialog.clear();
            },
            onError: err =>
              toast({
                title: "Falha ao desfazer conciliação",
                description: (err as Error).message,
                variant: "error",
              }),
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
              onSuccess: () => {
                toast({ title: "Transação ignorada", variant: "success" });
                ignoreDialog.clear();
              },
              onError: err =>
                toast({
                  title: "Falha ao ignorar transação",
                  description: (err as Error).message,
                  variant: "error",
                }),
            },
          );
        }}
      />
    </PrivilegeRoute>
  );
};

export default ReconciliationTransactionsListPage;
