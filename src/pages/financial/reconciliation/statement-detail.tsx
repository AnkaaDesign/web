import { useMemo, useState } from "react";
import { Navigate, useParams } from "react-router-dom";
import {
  IconArrowsExchange2,
  IconArrowDownRight,
  IconArrowUpRight,
  IconBuildingBank,
  IconCalendarEvent,
  IconCash,
  IconList,
  IconPercentage,
  IconRefresh,
  IconFilter,
} from "@tabler/icons-react";
import {
  ReconciliationFilterSheet,
  defaultReconciliationFilters,
  type ReconciliationFilters,
} from "@/components/financial/reconciliation/reconciliation-filter-sheet";
import { PrivilegeRoute } from "@/components/navigation/privilege-route";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { BankTransactionTable } from "@/components/financial/reconciliation/bank-transaction-table";
import { ManualMatchDialog } from "@/components/financial/reconciliation/manual-match-dialog";
import { UnmatchConfirmDialog } from "@/components/financial/reconciliation/unmatch-confirm-dialog";
import { IgnoreTransactionDialog } from "@/components/financial/reconciliation/ignore-transaction-dialog";
import { useTableState } from "@/hooks/common/use-table-state";
import { useUrlDialog } from "@/hooks/common/use-url-dialog";
import {
  useBankStatement,
  useBankTransaction,
  useBankTransactions,
  useIgnoreTransaction,
  useMatchTransaction,
  useRunAutoMatch,
  useUnmatchTransaction,
} from "@/hooks/financial/use-reconciliation";
import { useToast } from "@/hooks/common/use-toast";
import { usePageTracker } from "@/hooks/common/use-page-tracker";
import { SECTOR_PRIVILEGES, routes } from "@/constants";
import { formatAccountNumber, formatCurrency, formatDate } from "@/utils";
import { cn } from "@/lib/utils";
import type { BankTransaction } from "@/types/reconciliation";

export const ReconciliationStatementDetailPage = () => {
  usePageTracker({ title: "Detalhes do Extrato", icon: "file-spreadsheet" });
  const { id } = useParams<{ id: string }>();
  const { toast } = useToast();
  const { page, pageSize, setPage, setPageSize } = useTableState({ defaultPageSize: 50 });

  // Guard: redirect if route was navigated with the literal `:id` placeholder.
  if (!id || id === ":id") {
    return <Navigate to={routes.financial.reconciliation.statements} replace />;
  }
  const validId = id;

  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState<ReconciliationFilters>(defaultReconciliationFilters);

  const activeFilterCount =
    (filters.matchStatus ? 1 : 0) +
    (filters.matchType ? 1 : 0) +
    (filters.type && filters.type !== "DEBIT" ? 1 : 0) +
    (filters.subtype ? 1 : 0) +
    (filters.dateFrom ? 1 : 0) +
    (filters.dateTo ? 1 : 0) +
    (filters.amountMin !== undefined ? 1 : 0) +
    (filters.amountMax !== undefined ? 1 : 0) +
    (filters.counterparty ? 1 : 0);

  const { data: statement, isLoading: stLoading } = useBankStatement(validId);
  const {
    data: txData,
    isLoading: txLoading,
    isFetching,
    refetch,
  } = useBankTransactions({
    statementId: validId,
    ...filters,
    page: page + 1,
    pageSize,
    sortBy: "postedAt",
    sortDir: "desc",
  });

  // Same URL-driven modal pattern as the global transactions list page so a
  // ?txId=… link works whether the user arrived at the statement view or the
  // global view.
  const txDialog = useUrlDialog("txId");
  const unmatchDialog = useUrlDialog("unmatch");
  const ignoreDialog = useUrlDialog("ignore");

  const findInList = (id: string | null): BankTransaction | null => {
    if (!id || !txData) return null;
    return txData.data.find(t => t.id === id) ?? null;
  };
  const matchTxFromList = useMemo(() => findInList(txDialog.value), [txDialog.value, txData]);
  const { data: fetchedMatchTx } = useBankTransaction(
    txDialog.value && !matchTxFromList ? txDialog.value : undefined,
  );
  const matchTx = matchTxFromList ?? fetchedMatchTx ?? null;

  const unmatchTxFromList = useMemo(() => findInList(unmatchDialog.value), [unmatchDialog.value, txData]);
  const { data: fetchedUnmatchTx } = useBankTransaction(
    unmatchDialog.value && !unmatchTxFromList ? unmatchDialog.value : undefined,
  );
  const unmatchTx = unmatchTxFromList ?? fetchedUnmatchTx ?? null;

  const ignoreTxFromList = useMemo(() => findInList(ignoreDialog.value), [ignoreDialog.value, txData]);
  const { data: fetchedIgnoreTx } = useBankTransaction(
    ignoreDialog.value && !ignoreTxFromList ? ignoreDialog.value : undefined,
  );
  const ignoreTx = ignoreTxFromList ?? fetchedIgnoreTx ?? null;

  const matchMut = useMatchTransaction();
  const unmatchMut = useUnmatchTransaction();
  const ignoreMut = useIgnoreTransaction();
  const runMut = useRunAutoMatch();

  const matchedPct =
    statement && statement.debitTransactionCount > 0
      ? Math.round((statement.matchedCount / statement.debitTransactionCount) * 100)
      : 0;

  const total = txData?.meta.total ?? 0;
  const totalPages = txData?.meta.totalPages ?? 1;

  return (
    <PrivilegeRoute requiredPrivilege={[SECTOR_PRIVILEGES.ADMIN, SECTOR_PRIVILEGES.FINANCIAL]}>
      <div className="h-full flex flex-col gap-4 bg-background px-4 pt-4">
        <PageHeader
          variant="detail"
          title={
            statement
              ? `Extrato ${formatDate(statement.periodStart)} – ${formatDate(statement.periodEnd)}`
              : "Carregando..."
          }
          icon={IconArrowsExchange2}
          breadcrumbs={[
            { label: "Início", href: routes.home },
            { label: "Financeiro", href: routes.financial.root },
            { label: "Conciliação Bancária" },
            { label: "Extratos", href: routes.financial.reconciliation.statements },
            { label: "Detalhes" },
          ]}
          actions={[
            {
              key: "rematch",
              label: "Re-executar Conciliação",
              icon: IconRefresh,
              onClick: () => {
                if (!id) return;
                runMut.mutate(
                  { statementId: id },
                  {
                    onSuccess: r => {
                      toast({
                        title: "Conciliação reexecutada",
                        description: `${r.matched} transação(ões) conciliada(s)`,
                        variant: "success",
                      });
                      refetch();
                    },
                    onError: err =>
                      toast({
                        title: "Falha ao reexecutar conciliação",
                        description: (err as Error).message,
                        variant: "error",
                      }),
                  },
                );
              },
              variant: "default" as const,
              loading: runMut.isPending,
            },
            {
              key: "filters",
              label:
                activeFilterCount > 0
                  ? `Filtros (${activeFilterCount})`
                  : "Filtros",
              icon: IconFilter,
              onClick: () => setShowFilters(true),
              variant: "outline" as const,
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

        {stLoading ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4 flex-shrink-0">
            {[0, 1, 2, 3, 4, 5].map(i => (
              <Card key={i}>
                <CardContent className="p-4 space-y-2">
                  <Skeleton className="h-5 w-2/3" />
                  <Skeleton className="h-8 w-3/4" />
                </CardContent>
              </Card>
            ))}
          </div>
        ) : statement ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4 flex-shrink-0">
            <SummaryCard
              icon={IconList}
              title="Transações"
              value={String(statement.transactionCount)}
            />
            <SummaryCard
              icon={IconArrowUpRight}
              title="Créditos"
              value={formatCurrency(Number(statement.totalCredits))}
              valueClassName="text-green-600"
            />
            <SummaryCard
              icon={IconArrowDownRight}
              title="Débitos"
              value={formatCurrency(Number(statement.totalDebits))}
              valueClassName="text-red-600"
            />
            <SummaryCard
              icon={IconPercentage}
              title="Conciliado"
              value={`${matchedPct}%`}
              valueClassName={confidenceTextColor(matchedPct)}
            />
            <SummaryCard
              icon={IconBuildingBank}
              title="Conta"
              value={statement.bankName}
              description={`Ag ${statement.agency || "—"} / CC ${formatAccountNumber(statement.accountNumber)}`}
            />
            <SummaryCard
              icon={IconCalendarEvent}
              title="Importado em"
              value={formatDate(statement.importedAt)}
            />
          </div>
        ) : null}

        <div className="flex-1 min-h-0 pb-6 flex flex-col">
          <Card className="flex flex-col shadow-sm border border-border h-full">
            <CardContent className="flex-1 flex flex-col p-4 space-y-4 overflow-hidden">
              <div className="flex-1 min-h-0 overflow-auto">
                <BankTransactionTable
                  data={txData?.data ?? []}
                  isLoading={txLoading}
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
                  emptyMessage="Este extrato não possui transações"
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
        onApply={f => {
          setFilters(f);
          setPage(0);
        }}
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

interface SummaryCardProps {
  icon: typeof IconList;
  title: string;
  value: string;
  description?: string;
  valueClassName?: string;
}

function SummaryCard({ icon: Icon, title, value, description, valueClassName }: SummaryCardProps) {
  return (
    <Card className="overflow-hidden">
      <CardContent className="p-4 space-y-3">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-muted rounded-lg">
            <Icon className="h-5 w-5 text-muted-foreground" />
          </div>
          <h3 className="text-sm font-medium text-muted-foreground truncate">{title}</h3>
        </div>
        <div>
          <p
            className={cn("text-2xl font-bold leading-tight truncate", valueClassName)}
            title={value}
          >
            {value}
          </p>
          {description && (
            <p className="text-xs text-muted-foreground mt-1 truncate" title={description}>
              {description}
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

/** 5-tier color tied to the same scale as match confidence. */
function confidenceTextColor(pct: number): string {
  if (pct >= 100) return "text-green-600";
  if (pct >= 90) return "text-blue-600";
  if (pct >= 60) return "text-yellow-600";
  if (pct >= 30) return "text-orange-600";
  return "text-red-600";
}

export default ReconciliationStatementDetailPage;
