import { useState, useMemo, useCallback, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { PageHeader } from "@/components/ui/page-header";
import { PrivilegeRoute } from "@/components/navigation/privilege-route";
import { SECTOR_PRIVILEGES, routes } from "../../../constants";
import { usePageTracker } from "@/hooks/common/use-page-tracker";
import { useNfseList } from "@/hooks/financial/use-nfse";
import { useCancelNfse } from "@/hooks/production/use-invoice";
import type { ElotechNfseListItem } from "@/types/invoice";
import { formatCurrency, formatDate } from "@/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Combobox } from "@/components/ui/combobox";
import { StandardizedTable, type StandardizedColumn } from "@/components/ui/standardized-table";
import { TableSearchInput } from "@/components/ui/table-search-input";
import { useTableState } from "@/hooks/common/use-table-state";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { DropdownMenu, DropdownMenuItem, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import { PositionedDropdownMenuContent } from "@/components/ui/positioned-dropdown-menu";
import { toast } from "@/components/ui/sonner";
import {
  IconRefresh,
  IconFileInvoice,
  IconFilter,
  IconX,
  IconCalendar,
  IconHash,
  IconExternalLink,
  IconBan,
} from "@tabler/icons-react";

// ── Helpers ────────────────────────────────────────────────

const DEFAULT_PAGE_SIZE = 50;

function getCurrentMonthRange() {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  const fmt = (d: Date) => d.toISOString().slice(0, 10);
  return { start: fmt(start), end: fmt(end) };
}

const { start: defaultStart, end: defaultEnd } = getCurrentMonthRange();

const CANCEL_REASONS = [
  { code: "1", label: "Erro na emissão" },
  { code: "2", label: "Serviço não prestado" },
  { code: "4", label: "Duplicidade da nota" },
];

const SITUACAO_OPTIONS = [
  { value: "all", label: "Todas" },
  { value: "1", label: "Emitidas" },
  { value: "4", label: "Canceladas" },
];

// ── Types ──────────────────────────────────────────────────

interface NfseFilters {
  dataEmissaoInicial: string;
  dataEmissaoFinal: string;
  situacao: string;
  numeroDocumentoInicial: string;
  numeroDocumentoFinal: string;
}

const defaultFilters: NfseFilters = {
  dataEmissaoInicial: defaultStart,
  dataEmissaoFinal: defaultEnd,
  situacao: "all",
  numeroDocumentoInicial: "",
  numeroDocumentoFinal: "",
};

// ── Badge ──────────────────────────────────────────────────

function NfseSituacaoBadge({ item }: { item: ElotechNfseListItem }) {
  if (item.cancelada) {
    return (
      <Badge variant="cancelled" className="font-medium whitespace-nowrap">
        Cancelada
      </Badge>
    );
  }
  if (item.emitida) {
    return (
      <Badge variant="green" className="font-medium whitespace-nowrap">
        Emitida
      </Badge>
    );
  }
  return (
    <Badge variant="default" className="font-medium whitespace-nowrap">
      {item.descricaoSituacao || String(item.situacao)}
    </Badge>
  );
}

// ── Columns ────────────────────────────────────────────────

const nfseColumns: StandardizedColumn<ElotechNfseListItem>[] = [
  {
    key: "numeroNotaFiscal",
    header: "Número",
    accessor: (item) => (
      <span className="font-medium">{item.numeroNotaFiscal}</span>
    ),
  },
  {
    key: "dataEmissao",
    header: "Data Emissão",
    accessor: (item) => (
      <span className="text-muted-foreground">
        {item.dataEmissao ? formatDate(item.dataEmissao) : "-"}
      </span>
    ),
  },
  {
    key: "task",
    header: "Tarefa",
    render: (item) =>
      item.taskName ? (
        <p className="text-sm truncate max-w-[200px]">{item.taskName}</p>
      ) : (
        <span className="text-muted-foreground">-</span>
      ),
  },
  {
    key: "tomador",
    header: "Tomador",
    render: (item) => (
      <div>
        <p className="font-medium truncate max-w-xs">
          {item.tomadorRazaoNome}
        </p>
        {item.customerName &&
          item.customerName !== item.tomadorRazaoNome && (
            <p className="text-xs text-muted-foreground truncate max-w-xs">
              {item.customerName}
            </p>
          )}
      </div>
    ),
  },
  {
    key: "valorDoc",
    header: "Valor",
    accessor: (item) => (
      <span className="font-medium">{formatCurrency(item.valorDoc)}</span>
    ),
    align: "right",
  },
  {
    key: "valorISS",
    header: "ISS",
    accessor: (item) => (
      <span className="text-muted-foreground">
        {formatCurrency(item.valorISS)}
      </span>
    ),
    align: "right",
  },
  {
    key: "situacao",
    header: "Situação",
    render: (item) => <NfseSituacaoBadge item={item} />,
  },
];

// ── Filter Sheet ───────────────────────────────────────────

interface NfseFilterSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  filters: NfseFilters;
  onApply: (filters: NfseFilters) => void;
}

function NfseFilterSheet({
  open,
  onOpenChange,
  filters,
  onApply,
}: NfseFilterSheetProps) {
  const [local, setLocal] = useState<NfseFilters>(filters);

  useEffect(() => {
    if (open) setLocal(filters);
  }, [open, filters]);

  const activeCount = useMemo(() => {
    let c = 0;
    if (local.situacao && local.situacao !== "all") c++;
    if (local.numeroDocumentoInicial) c++;
    if (local.numeroDocumentoFinal) c++;
    return c;
  }, [local]);

  const handleApply = () => {
    onApply(local);
    onOpenChange(false);
  };

  const handleReset = () => {
    onApply(defaultFilters);
    onOpenChange(false);
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <IconFilter className="h-5 w-5" />
            NFS-e - Filtros
            {activeCount > 0 && (
              <Badge variant="secondary" className="ml-2">
                {activeCount}
              </Badge>
            )}
          </SheetTitle>
          <SheetDescription>
            Configure filtros para refinar a consulta de notas fiscais
          </SheetDescription>
        </SheetHeader>

        <div className="mt-6 space-y-6">
          {/* Situação - first filter */}
          <div className="space-y-2">
            <Label className="text-sm font-medium">Situação</Label>
            <Combobox
              value={local.situacao}
              onValueChange={(v) =>
                setLocal((prev) => ({
                  ...prev,
                  situacao: String(v ?? "all"),
                }))
              }
              options={SITUACAO_OPTIONS}
              placeholder="Selecione a situação..."
              searchable={false}
              clearable={false}
            />
          </div>

          {/* Date Range */}
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-sm font-medium">
              <IconCalendar className="h-4 w-4" />
              Período de Emissão
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs text-muted-foreground mb-1 block">
                  De
                </Label>
                <Input
                  type="date"
                  value={local.dataEmissaoInicial}
                  onChange={(val) =>
                    setLocal((prev) => ({
                      ...prev,
                      dataEmissaoInicial: String(val ?? ""),
                    }))
                  }
                />
              </div>
              <div>
                <Label className="text-xs text-muted-foreground mb-1 block">
                  Até
                </Label>
                <Input
                  type="date"
                  value={local.dataEmissaoFinal}
                  onChange={(val) =>
                    setLocal((prev) => ({
                      ...prev,
                      dataEmissaoFinal: String(val ?? ""),
                    }))
                  }
                />
              </div>
            </div>
          </div>

          {/* Document Number Range */}
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-sm font-medium">
              <IconHash className="h-4 w-4" />
              Número do Documento
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs text-muted-foreground mb-1 block">
                  De
                </Label>
                <Input
                  type="number"
                  placeholder="Número inicial"
                  value={local.numeroDocumentoInicial}
                  onChange={(val) =>
                    setLocal((prev) => ({
                      ...prev,
                      numeroDocumentoInicial: String(val ?? ""),
                    }))
                  }
                />
              </div>
              <div>
                <Label className="text-xs text-muted-foreground mb-1 block">
                  Até
                </Label>
                <Input
                  type="number"
                  placeholder="Número final"
                  value={local.numeroDocumentoFinal}
                  onChange={(val) =>
                    setLocal((prev) => ({
                      ...prev,
                      numeroDocumentoFinal: String(val ?? ""),
                    }))
                  }
                />
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-2 mt-6 pt-4 border-t">
            <Button
              variant="outline"
              onClick={handleReset}
              className="flex-1"
            >
              <IconX className="h-4 w-4 mr-2" />
              Limpar Filtros
            </Button>
            <Button onClick={handleApply} className="flex-1">
              Aplicar Filtros
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}

// ── Page ───────────────────────────────────────────────────

export function NfseListPage() {
  const navigate = useNavigate();
  const [filters, setFilters] = useState<NfseFilters>(defaultFilters);
  const [searchText, setSearchText] = useState("");
  const [showFilters, setShowFilters] = useState(false);

  // Context menu state
  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    item: ElotechNfseListItem;
  } | null>(null);

  // Cancel dialog state
  const [cancelTarget, setCancelTarget] = useState<ElotechNfseListItem | null>(null);
  const [cancelReason, setCancelReason] = useState("");
  const [cancelReasonCode, setCancelReasonCode] = useState("1");
  const cancelNfse = useCancelNfse();

  // Close context menu on outside click
  useEffect(() => {
    const handleClick = () => setContextMenu(null);
    document.addEventListener("click", handleClick);
    return () => document.removeEventListener("click", handleClick);
  }, []);

  usePageTracker({ title: "Notas Fiscais - Financeiro", icon: "receipt" });

  // Pagination via URL state (0-based page)
  const { page, pageSize, setPage, setPageSize } = useTableState({
    defaultPageSize: DEFAULT_PAGE_SIZE,
  });

  // Build API params (page is 0-based in state, API expects 1-based)
  const apiParams = useMemo(
    () => ({
      dataEmissaoInicial: filters.dataEmissaoInicial || undefined,
      dataEmissaoFinal: filters.dataEmissaoFinal || undefined,
      situacao:
        filters.situacao && filters.situacao !== "all"
          ? Number(filters.situacao)
          : undefined,
      numeroDocumentoInicial: filters.numeroDocumentoInicial
        ? Number(filters.numeroDocumentoInicial)
        : undefined,
      numeroDocumentoFinal: filters.numeroDocumentoFinal
        ? Number(filters.numeroDocumentoFinal)
        : undefined,
      page: page + 1,
      limit: pageSize,
    }),
    [filters, page, pageSize],
  );

  const {
    data: response,
    isLoading,
    isError,
    refetch,
    isFetching,
  } = useNfseList(apiParams);

  // Parse response: { data: [...], total: N, page: N, limit: N }
  const rawItems: ElotechNfseListItem[] = response?.data?.data || [];
  const total = response?.data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  // Local search filtering (Elotech doesn't support text search)
  const items = useMemo(() => {
    if (!searchText.trim()) return rawItems;
    const q = searchText.toLowerCase().trim();
    return rawItems.filter(
      (item) =>
        item.tomadorRazaoNome?.toLowerCase().includes(q) ||
        item.tomadorCnpjCpf?.includes(q) ||
        item.customerName?.toLowerCase().includes(q) ||
        item.taskName?.toLowerCase().includes(q) ||
        String(item.taskSerialNumber ?? "").includes(q) ||
        String(item.numeroNotaFiscal).includes(q),
    );
  }, [rawItems, searchText]);

  // Reset page when filters change
  const handleFilterApply = useCallback(
    (newFilters: NfseFilters) => {
      setFilters(newFilters);
      setPage(0);
    },
    [setPage],
  );

  // Count active non-default filters
  const activeFilterCount = useMemo(() => {
    let c = 0;
    if (filters.situacao && filters.situacao !== "all") c++;
    if (filters.numeroDocumentoInicial) c++;
    if (filters.numeroDocumentoFinal) c++;
    if (filters.dataEmissaoInicial !== defaultStart) c++;
    if (filters.dataEmissaoFinal !== defaultEnd) c++;
    return c;
  }, [filters]);

  // Context menu handler
  const handleContextMenu = useCallback(
    (e: React.MouseEvent, item: ElotechNfseListItem) => {
      e.preventDefault();
      e.stopPropagation();
      setContextMenu({ x: e.clientX, y: e.clientY, item });
    },
    [],
  );

  // Open in new tab
  const handleOpenNewTab = useCallback(() => {
    if (contextMenu) {
      window.open(routes.financial.nfse.detail(contextMenu.item.id), "_blank");
      setContextMenu(null);
    }
  }, [contextMenu]);

  // Open cancel dialog
  const handleOpenCancelDialog = useCallback(() => {
    if (contextMenu) {
      setCancelTarget(contextMenu.item);
      setCancelReason("");
      setCancelReasonCode("1");
      setContextMenu(null);
    }
  }, [contextMenu]);

  // Submit cancel
  const handleConfirmCancel = useCallback(() => {
    if (!cancelTarget) return;
    if (!cancelReason.trim() || cancelReason.trim().length < 15) {
      toast.error(
        "Motivo do cancelamento é obrigatório e deve ter no mínimo 15 caracteres.",
      );
      return;
    }
    if (!cancelTarget.invoiceId || !cancelTarget.nfseDocumentId) return;

    cancelNfse.mutate(
      {
        invoiceId: cancelTarget.invoiceId,
        nfseDocumentId: cancelTarget.nfseDocumentId,
        data: {
          reason: cancelReason,
          reasonCode: Number(cancelReasonCode),
        },
      },
      {
        onSuccess: () => {
          setCancelTarget(null);
          setCancelReason("");
          setCancelReasonCode("1");
          refetch();
        },
      },
    );
  }, [cancelTarget, cancelReason, cancelReasonCode, cancelNfse, refetch]);

  // Can cancel: not already cancelled, has invoiceId and nfseDocumentId
  const canCancelItem = (item: ElotechNfseListItem) =>
    item.emitida && !item.cancelada && !!item.invoiceId && !!item.nfseDocumentId;

  return (
    <PrivilegeRoute
      requiredPrivilege={[SECTOR_PRIVILEGES.FINANCIAL, SECTOR_PRIVILEGES.ADMIN]}
    >
      <div className="h-full flex flex-col gap-4 bg-background px-4 pt-4">
        <PageHeader
          variant="list"
          title="Notas Fiscais"
          breadcrumbs={[
            { label: "Início", href: routes.home },
            { label: "Financeiro", href: routes.financial.root },
            { label: "Notas Fiscais" },
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
              {/* Search and controls */}
              <div className="flex flex-col gap-3 sm:flex-row">
                <TableSearchInput
                  value={searchText}
                  onChange={setSearchText}
                  placeholder="Buscar por tomador, CNPJ, nº documento, tarefa..."
                />
                <div className="flex gap-2">
                  <Button
                    variant={activeFilterCount > 0 ? "default" : "outline"}
                    size="default"
                    onClick={() => setShowFilters(true)}
                    className="group"
                  >
                    <IconFilter className="h-4 w-4 text-muted-foreground group-hover:text-foreground transition-colors" />
                    <span className="text-foreground">
                      Filtros
                      {activeFilterCount > 0
                        ? ` (${activeFilterCount})`
                        : ""}
                    </span>
                  </Button>
                </div>
              </div>

              {/* Table */}
              <div className="flex-1 min-h-0 overflow-auto">
                <StandardizedTable
                  columns={nfseColumns}
                  data={items}
                  getItemKey={(item) => String(item.id)}
                  onRowClick={(item) => navigate(routes.financial.nfse.detail(item.id))}
                  onContextMenu={handleContextMenu}
                  isLoading={isLoading}
                  error={isError ? true : undefined}
                  emptyMessage="Nenhuma nota fiscal encontrada"
                  emptyIcon={IconFileInvoice}
                  currentPage={page}
                  totalPages={totalPages}
                  pageSize={pageSize}
                  totalRecords={total}
                  onPageChange={setPage}
                  onPageSizeChange={(size) => {
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

      {/* Filter Sheet */}
      <NfseFilterSheet
        open={showFilters}
        onOpenChange={setShowFilters}
        filters={filters}
        onApply={handleFilterApply}
      />

      {/* Context Menu */}
      <DropdownMenu
        open={!!contextMenu}
        onOpenChange={(open) => !open && setContextMenu(null)}
      >
        <PositionedDropdownMenuContent
          position={contextMenu}
          isOpen={!!contextMenu}
          className="w-56 ![position:fixed]"
          onCloseAutoFocus={(e) => e.preventDefault()}
        >
          <DropdownMenuItem onClick={handleOpenNewTab}>
            <IconExternalLink className="mr-2 h-4 w-4" />
            Abrir em nova aba
          </DropdownMenuItem>

          {contextMenu && canCancelItem(contextMenu.item) && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={handleOpenCancelDialog}
                className="text-destructive"
              >
                <IconBan className="mr-2 h-4 w-4" />
                Cancelar NFS-e
              </DropdownMenuItem>
            </>
          )}
        </PositionedDropdownMenuContent>
      </DropdownMenu>

      {/* Cancel NFS-e Dialog */}
      <Dialog
        open={!!cancelTarget}
        onOpenChange={(open) => !open && setCancelTarget(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Cancelar NFS-e</DialogTitle>
            <DialogDescription>
              Informe o motivo do cancelamento da NFS-e nº{" "}
              {cancelTarget?.numeroNotaFiscal}. Esta ação não pode ser desfeita.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-4">
            <div>
              <label className="text-sm font-medium mb-1.5 block">Motivo</label>
              <Select
                value={cancelReasonCode}
                onValueChange={setCancelReasonCode}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CANCEL_REASONS.map((r) => (
                    <SelectItem key={r.code} value={r.code}>
                      {r.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium mb-1.5 block">
                Justificativa
              </label>
              <Input
                value={cancelReason}
                onChange={(value) => setCancelReason(String(value ?? ""))}
                placeholder="Descreva o motivo do cancelamento..."
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setCancelTarget(null)}
            >
              Voltar
            </Button>
            <Button
              variant="destructive"
              onClick={handleConfirmCancel}
              disabled={cancelNfse.isPending}
            >
              {cancelNfse.isPending ? "Cancelando..." : "Confirmar Cancelamento"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </PrivilegeRoute>
  );
}

export default NfseListPage;
