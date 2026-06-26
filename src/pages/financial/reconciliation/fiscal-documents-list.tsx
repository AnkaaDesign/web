import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
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
import {
  buildDatesForPeriod,
  deriveDateRange,
  effectivePeriodDates,
} from "@/components/financial/reconciliation/date-utils";
import { PrivilegeRoute } from "@/components/navigation/privilege-route";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { TableSearchInput } from "@/components/ui/table-search-input";
import { XmlImportDialog } from "@/components/financial/reconciliation/xml-import-dialog";
import {
  useFiscalDocuments,
  useSiegFetch,
  useSiegStatus,
} from "@/hooks/financial/use-reconciliation";
import { useDebouncedValue } from "@/hooks/common/use-debounced-value";
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

export const FiscalDocumentsListContent = () => {
  usePageTracker({ title: "Notas Fiscais", icon: "receipt" });
  const { toast } = useToast();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [searchText, setSearchText] = useState(searchParams.get("search") || "");
  // Debounced value drives the server query + the matching-dates collapse so we
  // don't refetch (pageSize=1000) on every keystroke.
  const debouncedSearch = useDebouncedValue(searchText.trim(), 300);
  const [showFilters, setShowFilters] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [filters, setFilters] = useState<FiscalDocumentsFiltersUi>(() =>
    parseFiltersFromUrl(searchParams),
  );

  // Backward-compat: a legacy `?nfId=` deeplink (old detail sheet) now routes to
  // the standalone detail page.
  useEffect(() => {
    const nfId = searchParams.get("nfId");
    // Guard the raw param: a malformed ?nfId= would navigate to a bad detail
    // route and trigger an error fetch. Only redirect on a valid UUID.
    if (nfId && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(nfId)) {
      navigate(routes.financial.reconciliation.fiscalDocumentDetail(nfId), { replace: true });
    }
  }, [searchParams, navigate]);

  const dateRange = useMemo(() => {
    if (!filters.year || !filters.months?.length) return null;
    return deriveDateRange(filters.year, filters.months);
  }, [filters.year, filters.months]);

  const periodDates = useMemo(() => {
    if (!filters.year || !filters.months?.length) return [];
    return buildDatesForPeriod(filters.year, filters.months);
  }, [filters.year, filters.months]);

  const { data, isLoading, refetch } = useFiscalDocuments({
    page: 1,
    pageSize: PERIOD_PAGE_SIZE,
    sortBy: "issueDate",
    sortDir: "desc",
    search: debouncedSearch || undefined,
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

  // Collapse the calendar to only the days that contain a matching document
  // (and auto-expand them) whenever a search OR any content filter narrows the
  // result set; the default browse view keeps the full period calendar.
  const narrowing = useMemo(
    () =>
      debouncedSearch.length > 0 ||
      !!filters.docType ||
      !!filters.operationType ||
      !!filters.status ||
      filters.valueMin !== undefined ||
      filters.valueMax !== undefined ||
      !!filters.emitCnpj ||
      !!filters.destCnpj ||
      filters.hasMatch !== undefined,
    [debouncedSearch, filters],
  );
  const dates = useMemo(
    () => effectivePeriodDates(periodDates, (data?.data ?? []).map(d => d.issueDate), narrowing),
    [periodDates, data, narrowing],
  );

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
    <>
      <div className="h-full flex flex-col gap-4 bg-background px-4 pt-4">
        <PageHeader
          variant="list"
          title={periodTitle}
          icon={IconReceipt}
          favoritePage={FAVORITE_PAGES.FINANCEIRO_NOTAS_FISCAIS_LISTAR}
          breadcrumbs={[
            { label: "Início", href: routes.home },
            { label: "Financeiro", href: routes.financial.root },
            // This "Recebidas" content is hosted by the unified Notas Fiscais
            // surface (/financeiro/notas-fiscais), which sits directly under
            // Financeiro — not under Conciliação Bancária.
            { label: "Notas Fiscais", href: routes.financial.nfse.root },
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
                  <IconFilter
                    className={
                      activeFilterCount > 0
                        ? "h-4 w-4"
                        : "h-4 w-4 text-muted-foreground group-hover:text-foreground transition-colors"
                    }
                  />
                  <span>Filtros{activeFilterCount > 0 ? ` (${activeFilterCount})` : ""}</span>
                </Button>
              </div>

              <div className="flex-1 min-h-0 overflow-auto">
                <FiscalDocumentsByDateAccordion
                  data={data?.data ?? []}
                  dates={dates}
                  isLoading={isLoading}
                  autoExpand={narrowing}
                  onViewDetails={doc =>
                    navigate(routes.financial.reconciliation.fiscalDocumentDetail(doc.id))
                  }
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

      <XmlImportDialog open={importOpen} onOpenChange={setImportOpen} />
    </>
  );
};

export const ReconciliationFiscalDocumentsListPage = () => (
  <PrivilegeRoute
    requiredPrivilege={[SECTOR_PRIVILEGES.ADMIN, SECTOR_PRIVILEGES.FINANCIAL, SECTOR_PRIVILEGES.ACCOUNTING]}
  >
    <FiscalDocumentsListContent />
  </PrivilegeRoute>
);

export default ReconciliationFiscalDocumentsListPage;
