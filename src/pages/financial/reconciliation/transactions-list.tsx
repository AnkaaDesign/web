import { useState, useMemo, useCallback, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import {
  IconArrowsExchange2,
  IconCash,
  IconFilter,
  IconRefresh,
} from "@tabler/icons-react";
import { PrivilegeRoute } from "@/components/navigation/privilege-route";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { TableSearchInput } from "@/components/ui/table-search-input";
import { BankTransactionTable } from "@/components/financial/reconciliation/bank-transaction-table";
import { ManualMatchDialog } from "@/components/financial/reconciliation/manual-match-dialog";
import { UnmatchConfirmDialog } from "@/components/financial/reconciliation/unmatch-confirm-dialog";
import { IgnoreTransactionDialog } from "@/components/financial/reconciliation/ignore-transaction-dialog";
import {
  ReconciliationFilterSheet,
  type ReconciliationFilters,
} from "@/components/financial/reconciliation/reconciliation-filter-sheet";
import { useTableState } from "@/hooks/common/use-table-state";
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

export const ReconciliationTransactionsListPage = () => {
  usePageTracker({ title: "Transações - Conciliação", icon: "list" });
  const { toast } = useToast();
  const { page, pageSize, setPage, setPageSize } = useTableState({ defaultPageSize: 50 });
  const [searchParams, setSearchParams] = useSearchParams();
  const [searchText, setSearchText] = useState(searchParams.get("search") || "");
  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState<ReconciliationFilters>(() => ({
    matchStatus:
      (searchParams.get("matchStatus") as ReconciliationFilters["matchStatus"]) || undefined,
    matchType: (searchParams.get("matchType") as MatchType | null) || undefined,
    type: (searchParams.get("type") as ReconciliationFilters["type"]) || "DEBIT",
    subtype: (searchParams.get("subtype") as BankTransactionSubtype | null) || undefined,
    dateFrom: searchParams.get("dateFrom") || undefined,
    dateTo: searchParams.get("dateTo") || undefined,
    amountMin: searchParams.get("amountMin") ? Number(searchParams.get("amountMin")) : undefined,
    amountMax: searchParams.get("amountMax") ? Number(searchParams.get("amountMax")) : undefined,
    counterparty: searchParams.get("counterparty") || undefined,
  }));

  const { data, isLoading, isFetching, refetch } = useBankTransactions({
    page: page + 1,
    pageSize,
    sortBy: "postedAt",
    sortDir: "desc",
    search: searchText || undefined,
    ...filters,
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

  // If the user lands with ?txId=… we want the search/filter inputs to reflect
  // the current URL state — that's already covered by the initial state above.
  // But if the search text changes, we keep it in the URL too for shareability.
  useEffect(() => {
    const params = new URLSearchParams(searchParams);
    if (searchText) params.set("search", searchText);
    else params.delete("search");
    // Avoid a write when nothing changed (prevents render loops).
    if (params.toString() !== searchParams.toString()) {
      setSearchParams(params, { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchText]);

  const handleFilterApply = useCallback(
    (next: ReconciliationFilters) => {
      setFilters(next);
      setPage(0);
      const params = new URLSearchParams(searchParams);
      // Strip prior filter keys, preserve modal/search params.
      [
        "matchStatus",
        "matchType",
        "type",
        "subtype",
        "dateFrom",
        "dateTo",
        "amountMin",
        "amountMax",
        "counterparty",
      ].forEach(k => params.delete(k));
      Object.entries(next).forEach(([k, v]) => {
        if (v !== undefined && v !== null && v !== "") params.set(k, String(v));
      });
      setSearchParams(params);
    },
    [searchParams, setPage, setSearchParams],
  );

  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (filters.matchStatus) count++;
    if (filters.matchType) count++;
    if (filters.type !== "DEBIT") count++;
    if (filters.subtype) count++;
    if (filters.dateFrom) count++;
    if (filters.dateTo) count++;
    if (filters.amountMin !== undefined) count++;
    if (filters.amountMax !== undefined) count++;
    if (filters.counterparty) count++;
    return count;
  }, [filters]);

  const total = data?.meta.total ?? 0;
  const totalPages = data?.meta.totalPages ?? 1;

  return (
    <PrivilegeRoute requiredPrivilege={[SECTOR_PRIVILEGES.ADMIN, SECTOR_PRIVILEGES.FINANCIAL]}>
      <div className="h-full flex flex-col gap-4 bg-background px-4 pt-4">
        <PageHeader
          variant="list"
          title="Transações Bancárias"
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
                  onChange={v => {
                    setSearchText(v);
                    setPage(0);
                  }}
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
                <BankTransactionTable
                  data={data?.data ?? []}
                  isLoading={isLoading}
                  page={page}
                  pageSize={pageSize}
                  totalPages={totalPages}
                  totalRecords={total}
                  onPageChange={setPage}
                  onPageSizeChange={size => {
                    setPageSize(size);
                    setPage(0);
                  }}
                  emptyIcon={IconCash}
                  emptyMessage="Nenhuma transação corresponde aos filtros aplicados"
                  showStatementColumn
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
