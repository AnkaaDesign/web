import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import {
  IconCloudDownload,
  IconFilter,
  IconReceipt,
  IconRefresh,
  IconUpload,
} from "@tabler/icons-react";
import {
  FiscalDocumentsFilterSheet,
  getDefaultFiscalDocumentsFilters,
  type FiscalDocumentsFiltersUi,
} from "@/components/financial/reconciliation/fiscal-documents-filter-sheet";
import { FiscalDocumentsByDateAccordion } from "@/components/financial/reconciliation/fiscal-documents-by-date-accordion";
import { PrivilegeRoute } from "@/components/navigation/privilege-route";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { TableSearchInput } from "@/components/ui/table-search-input";
import { FiscalDocumentDetailSheet } from "@/components/financial/reconciliation/fiscal-document-detail-sheet";
import { XmlImportDialog } from "@/components/financial/reconciliation/xml-import-dialog";
import {
  useFiscalDocument,
  useFiscalDocuments,
  useSiegFetch,
  useSiegStatus,
} from "@/hooks/financial/use-reconciliation";
import { useUrlDialog } from "@/hooks/common/use-url-dialog";
import { useToast } from "@/hooks/common/use-toast";
import { usePageTracker } from "@/hooks/common/use-page-tracker";
import { SECTOR_PRIVILEGES, FAVORITE_PAGES, routes } from "@/constants";
import type { FiscalDocType, FiscalDocumentStatus, OperationType } from "@/types/reconciliation";

// Upper bound passed to the API when in period mode. Matches the transactions
// list — a busy month/year still fits in a single fetch.
const PERIOD_PAGE_SIZE = 1000;

function parseMonthsParam(raw: string | null): string[] | undefined {
  if (!raw) return undefined;
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) return parsed.map(String);
  } catch {
    // ignore
  }
  return undefined;
}

function parseFiltersFromUrl(params: URLSearchParams): FiscalDocumentsFiltersUi {
  const def = getDefaultFiscalDocumentsFilters();
  const yearParam = params.get("year");
  const monthsParam = parseMonthsParam(params.get("months"));
  return {
    docType: (params.get("docType") as FiscalDocType | null) || undefined,
    operationType: (params.get("operationType") as OperationType | null) || undefined,
    status: (params.get("status") as FiscalDocumentStatus | null) || undefined,
    year: yearParam ? Number(yearParam) : def.year,
    months: monthsParam ?? def.months,
    valueMin: params.get("valueMin") ? Number(params.get("valueMin")) : undefined,
    valueMax: params.get("valueMax") ? Number(params.get("valueMax")) : undefined,
    emitCnpj: params.get("emitCnpj") || undefined,
    destCnpj: params.get("destCnpj") || undefined,
    hasMatch:
      params.get("hasMatch") === "true"
        ? true
        : params.get("hasMatch") === "false"
          ? false
          : undefined,
  };
}

/**
 * Build the inclusive list of YYYY-MM-DD strings for every day in every
 * selected month, capped at today for the current month. Mirrors the
 * transactions list helper so both pages render identically.
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
    let lastDay = new Date(year, monthNum, 0).getDate();
    if (year === todayYear && monthNum === todayMonth) {
      lastDay = Math.min(lastDay, todayDay);
    } else if (year > todayYear || (year === todayYear && monthNum > todayMonth)) {
      continue;
    }
    for (let d = 1; d <= lastDay; d++) {
      const dd = String(d).padStart(2, "0");
      const mm = String(monthNum).padStart(2, "0");
      dates.push(`${year}-${mm}-${dd}`);
    }
  }
  return dates.reverse();
}

function deriveDateRange(
  year: number,
  months: string[],
): { dateFrom: string; dateTo: string } | null {
  if (!months.length) return null;
  const sorted = [...months]
    .map(m => parseInt(m, 10))
    .filter(n => n >= 1 && n <= 12)
    .sort((a, b) => a - b);
  if (!sorted.length) return null;
  const firstMonth = sorted[0];
  const lastMonth = sorted[sorted.length - 1];
  const dateFrom = new Date(year, firstMonth - 1, 1, 0, 0, 0, 0).toISOString();
  const dateTo = new Date(year, lastMonth, 0, 23, 59, 59, 999).toISOString();
  return { dateFrom, dateTo };
}

export const ReconciliationFiscalDocumentsListPage = () => {
  usePageTracker({ title: "Notas Fiscais", icon: "receipt" });
  const { toast } = useToast();
  const [searchParams, setSearchParams] = useSearchParams();
  const [searchText, setSearchText] = useState(searchParams.get("search") || "");
  const [showFilters, setShowFilters] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [filters, setFilters] = useState<FiscalDocumentsFiltersUi>(() =>
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

  const { data, isLoading, refetch } = useFiscalDocuments({
    page: 1,
    pageSize: PERIOD_PAGE_SIZE,
    sortBy: "issueDate",
    sortDir: "desc",
    search: searchText || undefined,
    docType: filters.docType,
    operationType: filters.operationType,
    status: filters.status,
    dateFrom: dateRange?.dateFrom,
    dateTo: dateRange?.dateTo,
    valueMin: filters.valueMin,
    valueMax: filters.valueMax,
    emitCnpj: filters.emitCnpj,
    destCnpj: filters.destCnpj,
    hasMatch: filters.hasMatch,
  });

  const nfDialog = useUrlDialog("nfId");

  const selectedFromList = useMemo(() => {
    if (!nfDialog.value || !data) return null;
    return data.data.find(d => d.id === nfDialog.value) ?? null;
  }, [nfDialog.value, data]);
  const { data: fetchedDoc } = useFiscalDocument(nfDialog.value ?? undefined);
  const selectedDoc = fetchedDoc ?? selectedFromList ?? null;

  const siegStatus = useSiegStatus();
  const siegFetch = useSiegFetch();

  const handleSiegFetch = () => {
    const today = new Date();
    const past = new Date(today.getTime() - 30 * 86_400_000);
    siegFetch.mutate(
      {
        dateStart: past.toISOString().slice(0, 10),
        dateEnd: today.toISOString().slice(0, 10),
      },
      {
        onSuccess: r =>
          toast({
            title: "Sincronização SIEG concluída",
            description: `${r.created} criadas, ${r.skipped} duplicadas`,
            variant: "success",
          }),
        // Error toast is emitted by the axios error interceptor.
      },
    );
  };

  // Sync search into URL for shareability.
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
    (next: FiscalDocumentsFiltersUi) => {
      setFilters(next);
      const params = new URLSearchParams(searchParams);
      [
        "docType",
        "operationType",
        "status",
        "year",
        "months",
        "valueMin",
        "valueMax",
        "emitCnpj",
        "destCnpj",
        "hasMatch",
      ].forEach(k => params.delete(k));
      if (next.docType) params.set("docType", next.docType);
      if (next.operationType) params.set("operationType", next.operationType);
      if (next.status) params.set("status", next.status);
      if (next.year) params.set("year", String(next.year));
      if (next.months && next.months.length > 0)
        params.set("months", JSON.stringify(next.months));
      if (next.valueMin !== undefined) params.set("valueMin", String(next.valueMin));
      if (next.valueMax !== undefined) params.set("valueMax", String(next.valueMax));
      if (next.emitCnpj) params.set("emitCnpj", next.emitCnpj);
      if (next.destCnpj) params.set("destCnpj", next.destCnpj);
      if (next.hasMatch !== undefined) params.set("hasMatch", String(next.hasMatch));
      setSearchParams(params);
    },
    [searchParams, setSearchParams],
  );

  const activeFilterCount = useMemo(() => {
    const def = getDefaultFiscalDocumentsFilters();
    let c = 0;
    if (filters.docType) c++;
    if (filters.operationType) c++;
    if (filters.status) c++;
    if (filters.year && filters.year !== def.year) c++;
    if (
      filters.months &&
      (filters.months.length !== 1 || filters.months[0] !== def.months?.[0])
    )
      c++;
    if (filters.valueMin !== undefined) c++;
    if (filters.valueMax !== undefined) c++;
    if (filters.emitCnpj) c++;
    if (filters.destCnpj) c++;
    if (filters.hasMatch !== undefined) c++;
    return c;
  }, [filters]);

  const periodTitle = useMemo(() => {
    if (!filters.year || !filters.months?.length) return "Notas Fiscais";
    if (filters.months.length === 1) {
      const monthName = new Date(filters.year, parseInt(filters.months[0]) - 1)
        .toLocaleDateString("pt-BR", { month: "long" });
      return `Notas Fiscais - ${monthName.charAt(0).toUpperCase() + monthName.slice(1)} de ${filters.year}`;
    }
    return `Notas Fiscais - ${filters.months.length} meses de ${filters.year}`;
  }, [filters.year, filters.months]);

  return (
    <PrivilegeRoute requiredPrivilege={[SECTOR_PRIVILEGES.ADMIN, SECTOR_PRIVILEGES.FINANCIAL]}>
      <div className="h-full flex flex-col gap-4 bg-background px-4 pt-4">
        <PageHeader
          variant="list"
          title={periodTitle}
          icon={IconReceipt}
          favoritePage={FAVORITE_PAGES.FINANCEIRO_CONCILIACAO_NOTAS}
          breadcrumbs={[
            { label: "Início", href: routes.home },
            { label: "Financeiro", href: routes.financial.root },
            { label: "Conciliação Bancária" },
            { label: "Notas Fiscais" },
          ]}
          actions={[
            {
              key: "import",
              label: "Importar Notas",
              icon: IconUpload,
              onClick: () => setImportOpen(true),
              variant: "default" as const,
            },
            ...(siegStatus.data?.enabled
              ? [
                  {
                    key: "sieg",
                    label: "Buscar SIEG",
                    icon: IconCloudDownload,
                    onClick: handleSiegFetch,
                    variant: "outline" as const,
                    loading: siegFetch.isPending,
                  },
                ]
              : []),
            {
              key: "refresh",
              label: "Atualizar",
              icon: IconRefresh,
              onClick: () => refetch(),
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
                  placeholder="Buscar por chave, número, emitente ou destinatário..."
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
                <FiscalDocumentsByDateAccordion
                  data={data?.data ?? []}
                  dates={dates}
                  isLoading={isLoading}
                  onViewDetails={doc => nfDialog.set(doc.id)}
                />
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      <FiscalDocumentsFilterSheet
        open={showFilters}
        onOpenChange={setShowFilters}
        filters={filters}
        onApply={handleFilterApply}
      />

      <FiscalDocumentDetailSheet
        doc={selectedDoc}
        open={nfDialog.open}
        onOpenChange={open => !open && nfDialog.clear()}
      />

      <XmlImportDialog open={importOpen} onOpenChange={setImportOpen} />
    </PrivilegeRoute>
  );
};

export default ReconciliationFiscalDocumentsListPage;
