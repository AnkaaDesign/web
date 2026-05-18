import { useMemo, useState } from "react";
import {
  IconReceipt,
  IconCloudDownload,
  IconRefresh,
  IconUpload,
  IconFilter,
} from "@tabler/icons-react";
import {
  FiscalDocumentsFilterSheet,
  defaultFiscalDocumentsFilters,
} from "@/components/financial/reconciliation/fiscal-documents-filter-sheet";
import { PrivilegeRoute } from "@/components/navigation/privilege-route";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { TableSearchInput } from "@/components/ui/table-search-input";
import { FiscalDocumentTable } from "@/components/financial/reconciliation/fiscal-document-table";
import { FiscalDocumentDetailSheet } from "@/components/financial/reconciliation/fiscal-document-detail-sheet";
import { XmlImportDialog } from "@/components/financial/reconciliation/xml-import-dialog";
import { useTableState } from "@/hooks/common/use-table-state";
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

export const ReconciliationFiscalDocumentsListPage = () => {
  usePageTracker({ title: "Notas Fiscais (SIEG)", icon: "receipt" });
  const { toast } = useToast();
  const { page, pageSize, setPage, setPageSize } = useTableState({ defaultPageSize: 50 });
  const [searchText, setSearchText] = useState("");
  const [importOpen, setImportOpen] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState(defaultFiscalDocumentsFilters);

  // URL-driven detail modal: ?nfId=<id> opens the NF detail dialog. Lets the
  // TX page deep-link to a specific NF without us having to load the right
  // list page first.
  const nfDialog = useUrlDialog("nfId");

  const activeFilterCount =
    (filters.docType ? 1 : 0) +
    (filters.operationType ? 1 : 0) +
    (filters.status ? 1 : 0) +
    (filters.dateFrom ? 1 : 0) +
    (filters.dateTo ? 1 : 0) +
    (filters.valueMin !== undefined ? 1 : 0) +
    (filters.valueMax !== undefined ? 1 : 0) +
    (filters.emitCnpj ? 1 : 0) +
    (filters.destCnpj ? 1 : 0) +
    (filters.hasMatch !== undefined ? 1 : 0);

  const { data, isLoading, isFetching, refetch } = useFiscalDocuments({
    page: page + 1,
    pageSize,
    sortBy: "issueDate",
    sortDir: "desc",
    search: searchText || undefined,
    docType: filters.docType,
    operationType: filters.operationType,
    status: filters.status,
    dateFrom: filters.dateFrom,
    dateTo: filters.dateTo,
    valueMin: filters.valueMin,
    valueMax: filters.valueMax,
    emitCnpj: filters.emitCnpj,
    destCnpj: filters.destCnpj,
    hasMatch: filters.hasMatch,
  });

  // Always fetch the single doc by id when the modal opens: the list endpoint
  // doesn't include `items` (services breakdown). The list row is used as an
  // instant placeholder while the full doc is loading, then we swap in the
  // fetched version once items + matches are available.
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
        onError: err =>
          toast({
            title: "Erro na sincronização SIEG",
            description: (err as Error).message,
            variant: "error",
          }),
      },
    );
  };

  const total = data?.meta.total ?? 0;
  const totalPages = data?.meta.totalPages ?? 1;

  const actions = [
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
      loading: isFetching,
    },
  ];

  return (
    <PrivilegeRoute requiredPrivilege={[SECTOR_PRIVILEGES.ADMIN, SECTOR_PRIVILEGES.FINANCIAL]}>
      <div className="h-full flex flex-col gap-4 bg-background px-4 pt-4">
        <PageHeader
          variant="list"
          title="Notas Fiscais"
          icon={IconReceipt}
          favoritePage={FAVORITE_PAGES.FINANCEIRO_CONCILIACAO_NOTAS}
          breadcrumbs={[
            { label: "Início", href: routes.home },
            { label: "Financeiro", href: routes.financial.root },
            { label: "Conciliação Bancária" },
            { label: "Notas Fiscais" },
          ]}
          actions={actions}
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
                <FiscalDocumentTable
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
                  onRowClick={doc => nfDialog.set(doc.id)}
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
        onApply={f => {
          setFilters(f);
          setPage(0);
        }}
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
