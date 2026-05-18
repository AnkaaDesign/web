import { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  IconFileSpreadsheet,
  IconArrowsExchange2,
  IconRefresh,
  IconUpload,
  IconFilter,
} from "@tabler/icons-react";
import {
  StatementsFilterSheet,
  defaultStatementsFilters,
} from "@/components/financial/reconciliation/statements-filter-sheet";
import { PrivilegeRoute } from "@/components/navigation/privilege-route";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardContent } from "@/components/ui/card";
import {
  StandardizedTable,
  type StandardizedColumn,
} from "@/components/ui/standardized-table";
import { Badge } from "@/components/ui/badge";
import { OfxImportDialog } from "@/components/financial/reconciliation/ofx-import-dialog";
import { getConfidenceBadgeVariant } from "@/components/financial/reconciliation/match-status-badge";
import { useTableState } from "@/hooks/common/use-table-state";
import { useBankStatements } from "@/hooks/financial/use-reconciliation";
import { usePageTracker } from "@/hooks/common/use-page-tracker";
import { SECTOR_PRIVILEGES, FAVORITE_PAGES, routes } from "@/constants";
import { formatAccountNumber, formatCurrency, formatDate } from "@/utils";
import type { BankStatement } from "@/types/reconciliation";

const STATUS_MAP: Record<
  string,
  { label: string; variant: "completed" | "pending" | "inProgress" | "cancelled" | "muted" }
> = {
  PENDING: { label: "Aguardando", variant: "muted" },
  PARSING: { label: "Processando", variant: "inProgress" },
  MATCHING: { label: "Pareando", variant: "inProgress" },
  COMPLETED: { label: "Concluído", variant: "completed" },
  FAILED: { label: "Erro", variant: "cancelled" },
};

export const ReconciliationStatementsListPage = () => {
  usePageTracker({ title: "Extratos - Conciliação", icon: "file-spreadsheet" });
  const navigate = useNavigate();
  const { page, pageSize, setPage, setPageSize } = useTableState({ defaultPageSize: 20 });
  const [importOpen, setImportOpen] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState(defaultStatementsFilters);

  const activeFilterCount =
    (filters.status ? 1 : 0) +
    (filters.source ? 1 : 0) +
    (filters.dateFrom ? 1 : 0) +
    (filters.dateTo ? 1 : 0);

  const { data, isLoading, isFetching, refetch } = useBankStatements({
    page: page + 1,
    pageSize,
    sortBy: "importedAt",
    sortDir: "desc",
    ...filters,
  });

  const columns: StandardizedColumn<BankStatement>[] = [
    {
      key: "period",
      header: "Período",
      render: s => (
        <span className="whitespace-nowrap font-medium">
          {formatDate(s.periodStart)} – {formatDate(s.periodEnd)}
        </span>
      ),
    },
    {
      key: "bank",
      header: "Banco",
      render: s => <span className="font-medium">{s.bankName}</span>,
    },
    {
      key: "agency",
      header: "Agência",
      render: s => <span className="tabular-nums">{s.agency || "—"}</span>,
    },
    {
      key: "account",
      header: "Conta",
      render: s => (
        <span className="tabular-nums">{formatAccountNumber(s.accountNumber)}</span>
      ),
    },
    {
      key: "transactionCount",
      header: "Transações",
      align: "right",
      render: s => <span className="tabular-nums">{s.transactionCount}</span>,
    },
    {
      key: "totalCredits",
      header: "Créditos",
      align: "right",
      render: s => (
        <span className="text-emerald-700 tabular-nums font-medium">
          {formatCurrency(s.totalCredits)}
        </span>
      ),
    },
    {
      key: "totalDebits",
      header: "Débitos",
      align: "right",
      render: s => (
        <span className="text-red-700 tabular-nums font-medium">
          {formatCurrency(s.totalDebits)}
        </span>
      ),
    },
    {
      key: "matchedPercent",
      header: "Conciliado",
      align: "right",
      render: s => {
        const pct =
          s.debitTransactionCount > 0
            ? Math.round((s.matchedCount / s.debitTransactionCount) * 100)
            : 0;
        return (
          <Badge variant={getConfidenceBadgeVariant(pct)} className="font-medium">
            {pct}%
          </Badge>
        );
      },
    },
    {
      key: "status",
      header: "Status",
      render: s => {
        const cfg = STATUS_MAP[s.status] || { label: s.status, variant: "muted" as const };
        return (
          <Badge variant={cfg.variant} className="font-medium whitespace-nowrap">
            {cfg.label}
          </Badge>
        );
      },
    },
    {
      key: "importedAt",
      header: "Importado em",
      render: s => (
        <span className="whitespace-nowrap text-muted-foreground">
          {formatDate(s.importedAt)}
        </span>
      ),
    },
  ];

  const total = data?.meta.total ?? 0;
  const totalPages = data?.meta.totalPages ?? 1;

  return (
    <PrivilegeRoute requiredPrivilege={[SECTOR_PRIVILEGES.ADMIN, SECTOR_PRIVILEGES.FINANCIAL]}>
      <div className="h-full flex flex-col gap-4 bg-background px-4 pt-4">
        <PageHeader
          variant="list"
          title="Extratos Bancários"
          icon={IconArrowsExchange2}
          favoritePage={FAVORITE_PAGES.FINANCEIRO_CONCILIACAO_EXTRATOS}
          breadcrumbs={[
            { label: "Início", href: routes.home },
            { label: "Financeiro", href: routes.financial.root },
            { label: "Conciliação Bancária" },
            { label: "Extratos" },
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

        <div className="flex-1 min-h-0 pb-6 flex flex-col">
          <Card className="flex flex-col shadow-sm border border-border h-full">
            <CardContent className="flex-1 flex flex-col p-4 space-y-4 overflow-hidden">
              <div className="flex-1 min-h-0 overflow-auto">
                <StandardizedTable<BankStatement>
                  columns={columns}
                  data={data?.data ?? []}
                  getItemKey={s => s.id}
                  onRowClick={s =>
                    navigate(routes.financial.reconciliation.statementDetail(s.id))
                  }
                  isLoading={isLoading}
                  emptyMessage="Nenhum extrato importado. Clique em 'Importar OFX' para começar."
                  emptyIcon={IconFileSpreadsheet}
                  currentPage={page}
                  totalPages={totalPages}
                  pageSize={pageSize}
                  totalRecords={total}
                  onPageChange={setPage}
                  onPageSizeChange={size => {
                    setPageSize(size);
                    setPage(0);
                  }}
                  pageSizeOptions={[20, 50]}
                  showPageSizeSelector
                  showGoToPage
                  showPageInfo
                />
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      <StatementsFilterSheet
        open={showFilters}
        onOpenChange={setShowFilters}
        filters={filters}
        onApply={f => {
          setFilters(f);
          setPage(0);
        }}
      />

      <OfxImportDialog
        open={importOpen}
        onOpenChange={setImportOpen}
        onImported={summary =>
          navigate(routes.financial.reconciliation.statementDetail(summary.statementId))
        }
      />
    </PrivilegeRoute>
  );
};

export default ReconciliationStatementsListPage;
