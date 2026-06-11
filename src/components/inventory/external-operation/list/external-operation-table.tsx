import React from "react";
import { useNavigate } from "react-router-dom";
import type { ExternalOperation } from "../../../../types";
import { routes, EXTERNAL_OPERATION_STATUS, EXTERNAL_OPERATION_TYPE, EXTERNAL_OPERATION_TYPE_LABELS } from "../../../../constants";
import { useAuth } from "../../../../hooks/common/use-auth";
import { canEditExternalOperations, canDeleteExternalOperations, shouldShowInteractiveElements } from "@/utils/permissions/entity-permissions";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { IconChevronUp, IconChevronDown, IconEdit, IconTrash, IconSelector, IconExternalLink, IconAlertTriangle, IconPackageExport, IconCheck, IconPlus, IconCurrencyReal } from "@tabler/icons-react";
import { cn } from "@/lib/utils";
import { DropdownMenu, DropdownMenuItem, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import { PositionedDropdownMenuContent } from "@/components/ui/positioned-dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useExternalOperations, useExternalOperationMutations, useExternalOperationStatusMutations, useCanViewPrices } from "../../../../hooks";
import { SimplePaginationAdvanced } from "@/components/ui/pagination-advanced";
import type { ExternalOperationGetManyFormData } from "../../../../schemas";
import { useScrollbarWidth } from "@/hooks/common/use-scrollbar-width";
import { TABLE_LAYOUT } from "@/components/ui/table-constants";
import { TruncatedTextWithTooltip } from "@/components/ui/truncated-text-with-tooltip";
import { useTableState, convertSortConfigsToOrderBy } from "@/hooks/common/use-table-state";
import { formatCurrency, formatDate } from "../../../../utils";
import { ExternalOperationStatusBadge } from "../common/external-operation-status-badge";
import { Badge } from "@/components/ui/badge";
import { ExternalOperationTableSkeleton } from "./external-operation-table-skeleton";

interface ExternalOperationTableProps {
  visibleColumns: Set<string>;
  className?: string;
  filters?: Partial<ExternalOperationGetManyFormData>;
  onDataChange?: (data: { externalOperations: ExternalOperation[]; totalRecords: number }) => void;
}

// Table column definitions
interface ExternalOperationColumn {
  key: string;
  header: string;
  accessor: (withdrawal: ExternalOperation) => React.ReactNode;
  sortable: boolean;
  className?: string;
  align?: "left" | "center" | "right";
}

const createExternalOperationColumns = (canViewPrices: boolean = true): ExternalOperationColumn[] => {
  const columns: ExternalOperationColumn[] = [
  {
    key: "withdrawerName",
    header: "RESPONSÁVEL",
    accessor: (withdrawal) => (
      <div className="space-y-1">
        <TruncatedTextWithTooltip text={withdrawal.withdrawerName} className="text-sm font-medium" />
        {withdrawal.notes && <TruncatedTextWithTooltip text={withdrawal.notes} className="text-xs text-muted-foreground" />}
      </div>
    ),
    sortable: true,
    className: "w-64 min-w-[16rem]",
  },
  {
    key: "customer",
    header: "CLIENTE",
    accessor: (withdrawal) => <TruncatedTextWithTooltip text={withdrawal.customer?.fantasyName ?? withdrawal.withdrawerName} className="text-sm" />,
    sortable: false,
    align: "left",
    className: "w-48 min-w-[12rem]",
  },
  {
    key: "status",
    header: "STATUS",
    accessor: (withdrawal) => <ExternalOperationStatusBadge status={withdrawal.status} />,
    sortable: true,
    align: "left",
    className: "w-40",
  },
  {
    key: "type",
    header: "TIPO",
    accessor: (withdrawal) => (
      <Badge variant={withdrawal.type === EXTERNAL_OPERATION_TYPE.RETURNABLE ? "default" :
                     withdrawal.type === EXTERNAL_OPERATION_TYPE.CHARGEABLE ? "destructive" : "secondary"}>
        {EXTERNAL_OPERATION_TYPE_LABELS[withdrawal.type]}
      </Badge>
    ),
    sortable: true,
    align: "left",
    className: "w-36",
  },
  // Fields not available in ExternalOperation type - commented out to fix TypeScript errors
  // {
  //   key: "withdrawerDocument",
  //   header: "CPF/CNPJ",
  //   accessor: (withdrawal) => (
  //     <span className="text-sm">{withdrawal.withdrawerDocument || "-"}</span>
  //   ),
  //   sortable: true,
  //   className: "min-w-[140px]",
  // },
  // {
  //   key: "withdrawerPhone",
  //   header: "Telefone",
  //   accessor: (withdrawal) => (
  //     <span className="text-sm">{withdrawal.withdrawerPhone || "-"}</span>
  //   ),
  //   sortable: true,
  //   className: "min-w-[120px]",
  // },
  // {
  //   key: "withdrawerEmail",
  //   header: "Email",
  //   accessor: (withdrawal) => (
  //     <span className="text-sm">{withdrawal.withdrawerEmail || "-"}</span>
  //   ),
  //   sortable: true,
  //   className: "min-w-[180px]",
  // },
  {
    key: "notes",
    header: "OBSERVAÇÕES",
    accessor: (withdrawal) => <TruncatedTextWithTooltip text={withdrawal.notes || "-"} className="text-sm" />,
    sortable: true,
    className: "w-48 min-w-[12rem]",
  },
  // Fields not available in ExternalOperation type - commented out to fix TypeScript errors
  // {
  //   key: "purpose",
  //   header: "Finalidade",
  //   accessor: (withdrawal) => (
  //     <TruncatedTextWithTooltip text={withdrawal.purpose || "-"} className="text-sm" />
  //   ),
  //   sortable: true,
  //   className: "min-w-[180px]",
  // },
  // {
  //   key: "destination",
  //   header: "Destino",
  //   accessor: (withdrawal) => (
  //     <TruncatedTextWithTooltip text={withdrawal.destination || "-"} className="text-sm" />
  //   ),
  //   sortable: true,
  //   className: "min-w-[180px]",
  // },
  {
    key: "itemCount",
    header: "ITENS",
    accessor: (withdrawal) => <span className="text-sm font-medium tabular-nums">{withdrawal.items?.length || 0}</span>,
    sortable: false,
    align: "center",
    className: "w-24",
  },
  {
    key: "total",
    header: "VALOR TOTAL",
    accessor: (withdrawal) => {
      if (withdrawal.type === EXTERNAL_OPERATION_TYPE.CHARGEABLE) {
        const itemsTotal = (withdrawal.items || []).reduce((sum, item) => {
          const price = item.price || item.unitPrice || 0;
          return sum + item.withdrawedQuantity * price;
        }, 0);
        const servicesTotal = (withdrawal.services || []).reduce((sum, service) => sum + (Number(service.amount) || 0), 0);
        return <span className="text-sm font-semibold tabular-nums">{formatCurrency(itemsTotal + servicesTotal)}</span>;
      }
      return <span className="text-sm text-muted-foreground tabular-nums">-</span>;
    },
    sortable: false,
    align: "left",
    className: "w-36",
  },
  {
    key: "totalQuantity",
    header: "QUANTIDADE TOTAL",
    accessor: (withdrawal) => {
      if (withdrawal.items) {
        const totalQuantity = withdrawal.items.reduce((sum, item) => sum + item.withdrawedQuantity, 0);
        return <span className="text-sm font-medium tabular-nums">{totalQuantity}</span>;
      }
      return <span className="text-sm text-muted-foreground">-</span>;
    },
    sortable: false,
    align: "center",
    className: "w-36",
  },
  {
    key: "createdAt",
    header: "DATA DE CRIAÇÃO",
    accessor: (withdrawal) => <span className="text-sm text-muted-foreground">{formatDate(withdrawal.createdAt)}</span>,
    sortable: true,
    className: "w-40",
  },
  {
    key: "updatedAt",
    header: "DATA DE ATUALIZAÇÃO",
    accessor: (withdrawal) => <span className="text-sm text-muted-foreground">{formatDate(withdrawal.updatedAt)}</span>,
    sortable: true,
    className: "w-44",
  },
  ];
  return columns.filter((column) => canViewPrices || column.key !== "total");
};

export function getDefaultVisibleColumns(canViewPrices: boolean = true): Set<string> {
  const base = ["withdrawerName", "customer", "status", "type", "total", "createdAt"];
  return new Set(base.filter((key) => canViewPrices || key !== "total"));
}

export function getAllColumns(canViewPrices: boolean = true): ExternalOperationColumn[] {
  return createExternalOperationColumns(canViewPrices);
}

// Statuses in which an external operation can no longer be deleted (already billed/settled/finished)
const NON_DELETABLE_STATUSES: EXTERNAL_OPERATION_STATUS[] = [
  EXTERNAL_OPERATION_STATUS.CHARGED,
  EXTERNAL_OPERATION_STATUS.LIQUIDATED,
  EXTERNAL_OPERATION_STATUS.DELIVERED,
  EXTERNAL_OPERATION_STATUS.FULLY_RETURNED,
];

export function ExternalOperationTable({ visibleColumns, className, filters = {}, onDataChange }: ExternalOperationTableProps) {
  const navigate = useNavigate();
  const canViewPrices = useCanViewPrices();
  const { delete: deleteWithdrawal } = useExternalOperationMutations();
  const { markAsFullyReturned, markAsCharged, markAsLiquidated, markAsDelivered } = useExternalOperationStatusMutations();

  // Permission checks
  const { user, isLoading: _isAuthLoading } = useAuth();
  const canEdit = user ? canEditExternalOperations(user) : false;
  const canDelete = user ? canDeleteExternalOperations(user) : false;
  const showInteractive = user ? shouldShowInteractiveElements(user, 'externalOperation') : false;

  // Context menu state
  const [contextMenu, setContextMenu] = React.useState<{
    x: number;
    y: number;
    withdrawal: ExternalOperation;
  } | null>(null);

  // Delete confirmation dialog state
  const [deleteDialog, setDeleteDialog] = React.useState<{
    withdrawal: ExternalOperation;
  } | null>(null);

  // Charge confirmation dialog state (charging may trigger NFS-e/boleto generation)
  const [chargeDialog, setChargeDialog] = React.useState<{
    withdrawal: ExternalOperation;
  } | null>(null);

  // Get scrollbar width info
  const { width: scrollbarWidth, isOverlay } = useScrollbarWidth();

  // Use URL state management for pagination and selection
  const {
    page,
    pageSize,
    selectedIds,
    sortConfigs,
    showSelectedOnly,
    setPage,
    setPageSize,
    toggleSelection,
    toggleSelectAll,
    toggleSort,
    getSortDirection,
    getSortOrder,
    isSelected,
    isAllSelected,
    isPartiallySelected,
    selectionCount: _selectionCount,
    resetSelection: _resetSelection,
    removeFromSelection: _removeFromSelection,
  } = useTableState({
    defaultPageSize: 40,
    resetSelectionOnPageChange: false,
  });

  // Memoize include configuration to prevent re-renders
  const includeConfig = React.useMemo(
    () => ({
      items: {
        include: {
          item: true,
        },
      },
      customer: true,
      services: true,
      count: {
        select: {
          items: true,
        },
      },
    }),
    [],
  );

  // Memoize query parameters to prevent infinite re-renders
  const queryParams = React.useMemo(
    () => ({
      // Always apply base filters to prevent showing unintended records
      ...filters,
      page: page + 1, // Convert 0-based to 1-based for API
      limit: pageSize,
      include: includeConfig,
      // Convert sortConfigs to orderBy format for API
      ...(sortConfigs.length > 0 && {
        orderBy: convertSortConfigsToOrderBy(sortConfigs),
      }),
      // Filter by selected IDs when showSelectedOnly is true
      ...(showSelectedOnly &&
        selectedIds.length > 0 && {
          where: {
            id: { in: selectedIds },
          },
        }),
    }),
    [filters, page, pageSize, includeConfig, sortConfigs, showSelectedOnly, selectedIds],
  );

  // Fetch data in the table component
  const { data: response, isLoading, error, refetch } = useExternalOperations(queryParams);

  const withdrawals = response?.data || [];
  const totalRecords = response?.meta?.totalRecords || 0;
  const totalPages = response?.meta ? Math.ceil(response.meta.totalRecords / pageSize) : 1;

  // Notify parent component of data changes
  const lastNotifiedDataRef = React.useRef<string>("");
  const isMountedRef = React.useRef(true);

  React.useEffect(() => {
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  React.useEffect(() => {
    if (onDataChange && isMountedRef.current) {
      const dataKey = withdrawals.length > 0 ? `${totalRecords}-${withdrawals.map((withdrawal) => withdrawal.id).join(",")}` : `empty-${totalRecords}`;

      if (dataKey !== lastNotifiedDataRef.current) {
        lastNotifiedDataRef.current = dataKey;
        onDataChange({ externalOperations: withdrawals, totalRecords });
      }
    }
  }, [withdrawals, totalRecords, onDataChange]);

  // Get columns
  const columns = React.useMemo(() => createExternalOperationColumns(canViewPrices), [canViewPrices]);
  const filteredColumns = React.useMemo(() => columns.filter((col) => visibleColumns.has(col.key)), [columns, visibleColumns]);

  // Handle selection
  const currentPageWithdrawalIds = React.useMemo(() => {
    return withdrawals.map((withdrawal) => withdrawal.id);
  }, [withdrawals]);

  const handleSelectAll = React.useCallback(() => {
    toggleSelectAll(currentPageWithdrawalIds);
  }, [toggleSelectAll, currentPageWithdrawalIds]);

  // Handle row click
  const handleRowClick = React.useCallback(
    (withdrawal: ExternalOperation, event: React.MouseEvent) => {
      // Don't navigate if clicking checkbox or context menu
      if ((event.target as HTMLElement).closest('[role="checkbox"]') || (event.target as HTMLElement).closest('[role="menu"]')) {
        return;
      }
      navigate(routes.inventory.externalOperations?.details?.(withdrawal.id) || `/inventory/external-operations/details/${withdrawal.id}`);
    },
    [navigate],
  );

  // Context menu handlers
  const handleContextMenu = React.useCallback(
    (e: React.MouseEvent, withdrawal: ExternalOperation) => {
      e.preventDefault();
      e.stopPropagation();

      setContextMenu({
        x: e.clientX,
        y: e.clientY,
        withdrawal,
      });
    },
    [],
  );

  const handleViewDetails = React.useCallback(() => {
    if (contextMenu) {
      window.open(routes.inventory.externalOperations?.details?.(contextMenu.withdrawal.id) || `/inventory/external-operations/details/${contextMenu.withdrawal.id}`, '_blank');
    }
  }, [contextMenu]);

  const handleEditWithdrawal = React.useCallback(() => {
    if (contextMenu) {
      navigate(routes.inventory.externalOperations?.edit?.(contextMenu.withdrawal.id) || `/inventory/external-operations/edit/${contextMenu.withdrawal.id}`);
      setContextMenu(null);
    }
  }, [contextMenu, navigate]);

  const handleMarkAsReturnedFromMenu = React.useCallback(async () => {
    if (contextMenu && contextMenu.withdrawal.type === EXTERNAL_OPERATION_TYPE.RETURNABLE) {
      try {
        await markAsFullyReturned.mutateAsync({ id: contextMenu.withdrawal.id });
        refetch();
        setContextMenu(null);
      } catch (error) {
        // Error handled by API client
      }
    }
  }, [contextMenu, markAsFullyReturned, refetch]);

  const handleMarkAsChargedFromMenu = React.useCallback(() => {
    if (contextMenu && contextMenu.withdrawal.type === EXTERNAL_OPERATION_TYPE.CHARGEABLE) {
      setChargeDialog({ withdrawal: contextMenu.withdrawal });
      setContextMenu(null);
    }
  }, [contextMenu]);

  const confirmCharge = React.useCallback(async () => {
    if (!chargeDialog) return;

    try {
      await markAsCharged.mutateAsync({ id: chargeDialog.withdrawal.id });
      setChargeDialog(null);
      refetch();
    } catch (error) {
      // Error handled by API client
    }
  }, [chargeDialog, markAsCharged, refetch]);

  const handleMarkAsLiquidatedFromMenu = React.useCallback(async () => {
    if (contextMenu && contextMenu.withdrawal.type === EXTERNAL_OPERATION_TYPE.CHARGEABLE) {
      try {
        await markAsLiquidated.mutateAsync({ id: contextMenu.withdrawal.id });
        refetch();
        setContextMenu(null);
      } catch (error) {
        // Error handled by API client
      }
    }
  }, [contextMenu, markAsLiquidated, refetch]);

  const handleMarkAsDeliveredFromMenu = React.useCallback(async () => {
    if (contextMenu && contextMenu.withdrawal.type === EXTERNAL_OPERATION_TYPE.COMPLIMENTARY) {
      try {
        await markAsDelivered.mutateAsync({ id: contextMenu.withdrawal.id });
        refetch();
        setContextMenu(null);
      } catch (error) {
        // Error handled by API client
      }
    }
  }, [contextMenu, markAsDelivered, refetch]);

  const handleDeleteFromMenu = React.useCallback(async () => {
    if (contextMenu) {
      setDeleteDialog({ withdrawal: contextMenu.withdrawal });
      setContextMenu(null);
    }
  }, [contextMenu]);

  const confirmDelete = React.useCallback(async () => {
    if (!deleteDialog) return;

    try {
      deleteWithdrawal(deleteDialog.withdrawal.id);
      setDeleteDialog(null);
      refetch();
    } catch (error) {
      // Error handled by API client
    }
  }, [deleteDialog, deleteWithdrawal, refetch]);

  // Close context menu when clicking outside
  React.useEffect(() => {
    const handleClick = () => setContextMenu(null);
    document.addEventListener("click", handleClick);
    return () => document.removeEventListener("click", handleClick);
  }, []);

  const renderSortIndicator = (columnKey: string) => {
    const sortDirection = getSortDirection(columnKey);
    const sortOrder = getSortOrder(columnKey);

    return (
      <div className="inline-flex items-center ml-1">
        {sortDirection === null && <IconSelector className="h-4 w-4 text-muted-foreground" />}
        {sortDirection === "asc" && <IconChevronUp className="h-4 w-4 text-foreground" />}
        {sortDirection === "desc" && <IconChevronDown className="h-4 w-4 text-foreground" />}
        {sortOrder !== null && sortConfigs.length > 1 && <span className="text-xs ml-0.5">{sortOrder + 1}</span>}
      </div>
    );
  };

  if (isLoading) {
    return <ExternalOperationTableSkeleton visibleColumns={visibleColumns} className={className} />;
  }

  const allSelected = isAllSelected(currentPageWithdrawalIds);
  const someSelected = isPartiallySelected(currentPageWithdrawalIds);

  return (
    <div className={cn("rounded-lg flex flex-col overflow-hidden", className)}>
      {/* Fixed Header */}
      <div className="border-l border-r border-t border-border rounded-t-lg overflow-hidden">
        <Table className={cn("w-full [&>div]:border-0 [&>div]:rounded-none", TABLE_LAYOUT.tableLayout)}>
          <TableHeader className="[&_tr]:border-b-0 [&_tr]:hover:bg-muted">
            <TableRow className="bg-muted hover:bg-muted even:bg-muted">
              {showInteractive && (
                <TableHead className={cn(TABLE_LAYOUT.checkbox.className, "whitespace-nowrap text-foreground font-bold uppercase text-xs bg-muted !border-r-0 p-0")}>
                  <div className="flex items-center justify-center h-full w-full px-2">
                    <Checkbox
                      checked={allSelected}
                      indeterminate={someSelected}
                      onCheckedChange={handleSelectAll}
                      aria-label="Selecionar todos"
                      disabled={isLoading || withdrawals.length === 0}
                      data-checkbox
                    />
                  </div>
                </TableHead>
              )}
              {filteredColumns.map((column) => (
                <TableHead
                  key={column.key}
                  className={cn(
                    "whitespace-nowrap text-foreground font-bold uppercase text-xs bg-muted !border-r-0 p-0",
                    column.className,
                    column.align === "center" && "text-center",
                    column.align === "right" && "text-right",
                    "border-r border-border last:border-r-0",
                  )}
                >
                  {column.sortable ? (
                    <button
                      onClick={() => toggleSort(column.key)}
                      className={cn(
                        "flex items-center gap-1 w-full h-full min-h-[2.5rem] px-4 py-2 hover:bg-muted/80 transition-colors cursor-pointer border-0 bg-transparent",
                        column.align === "center" && "justify-center",
                        column.align === "right" && "justify-end",
                        column.align !== "center" && column.align !== "right" && "justify-start",
                      )}
                      disabled={isLoading || withdrawals.length === 0}
                    >
                      <span className="truncate">{column.header}</span>
                      {renderSortIndicator(column.key)}
                    </button>
                  ) : (
                    <div className="flex items-center h-full min-h-[2.5rem] px-4 py-2">
                      <span className="truncate">{column.header}</span>
                    </div>
                  )}
                </TableHead>
              ))}
              {/* Scrollbar spacer - only show if not overlay scrollbar */}
              {!isOverlay && (
                <TableHead style={{ width: `${scrollbarWidth}px`, minWidth: `${scrollbarWidth}px` }} className="bg-muted p-0 border-0 !border-r-0 shrink-0"></TableHead>
              )}
            </TableRow>
          </TableHeader>
        </Table>
      </div>

      {/* Scrollable Body */}
      <div className="flex-1 overflow-y-auto overflow-x-hidden border-l border-r border-border">
        <Table className={cn("w-full [&>div]:border-0 [&>div]:rounded-none", TABLE_LAYOUT.tableLayout)}>
          <TableBody>
            {error ? (
              <TableRow>
                <TableCell colSpan={filteredColumns.length + 1} className="p-0">
                  <div className="flex flex-col items-center justify-center p-8 text-center text-destructive">
                    <IconAlertTriangle className="h-8 w-8 mb-4" />
                    <div className="text-lg font-medium mb-2">Não foi possível carregar as operações externas</div>
                    <div className="text-sm text-muted-foreground">Tente novamente mais tarde.</div>
                  </div>
                </TableCell>
              </TableRow>
            ) : withdrawals.length === 0 ? (
              <TableRow>
                <TableCell colSpan={filteredColumns.length + 1} className="p-0">
                  <div className="flex flex-col items-center justify-center p-8 text-center text-muted-foreground">
                    <IconPackageExport className="h-12 w-12 text-muted-foreground/50 mb-4" />
                    <div className="text-lg font-medium mb-2">Nenhuma operação externa encontrada</div>
                    {filters && Object.keys(filters).length > 1 ? (
                      <div className="text-sm">Ajuste os filtros para ver mais resultados.</div>
                    ) : (
                      <>
                        <div className="text-sm mb-4">Comece registrando a primeira operação externa.</div>
                        <Button onClick={() => navigate(routes.inventory.externalOperations.create)} variant="outline">
                          <IconPlus className="h-4 w-4 mr-2" />
                          Nova Operação
                        </Button>
                      </>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              withdrawals.map((withdrawal, index) => {
                const isWithdrawalSelected = isSelected(withdrawal.id);

                return (
                  <TableRow
                    key={withdrawal.id}
                    className={cn(
                      "cursor-pointer transition-colors border-b border-border",
                      // Alternating row colors
                      index % 2 === 1 && "bg-muted/10",
                      // Hover state that works with alternating colors
                      "hover:bg-muted/20",
                      // Selected state overrides alternating colors
                      isWithdrawalSelected && "bg-muted/30 hover:bg-muted/40",
                    )}
                    onClick={(e) => handleRowClick(withdrawal, e)}
                    onContextMenu={(e) => handleContextMenu(e, withdrawal)}
                  >
                    {showInteractive && (
                      <TableCell className={cn(TABLE_LAYOUT.checkbox.className, "p-0 !border-r-0")}>
                        <div className="flex items-center justify-center h-full w-full px-2 py-2" onClick={(e) => e.stopPropagation()}>
                          <Checkbox
                            checked={isWithdrawalSelected}
                            onCheckedChange={() => toggleSelection(withdrawal.id)}
                            aria-label={`Selecionar operação de ${withdrawal.withdrawerName}`}
                            data-checkbox
                          />
                        </div>
                      </TableCell>
                    )}
                    {filteredColumns.map((column) => (
                      <TableCell key={column.key} className={cn("p-0 !border-r-0", column.className)}>
                        <div className={cn("px-4 py-2 text-sm", column.align === "center" && "text-center", column.align === "right" && "text-right")}>
                          {column.accessor(withdrawal)}
                        </div>
                      </TableCell>
                    ))}
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pagination Footer */}
      <div className="px-4 border-l border-r border-b border-border rounded-b-lg bg-muted/50">
        <SimplePaginationAdvanced currentPage={page} totalPages={totalPages} pageSize={pageSize} totalItems={totalRecords} onPageChange={setPage} onPageSizeChange={setPageSize} />
      </div>

      {/* Context Menu */}
      <DropdownMenu open={!!contextMenu} onOpenChange={(open) => !open && setContextMenu(null)}>
        <PositionedDropdownMenuContent
          position={contextMenu}
          isOpen={!!contextMenu}
          className="w-56 ![position:fixed]"
          onCloseAutoFocus={(e) => e.preventDefault()}
        >
          <DropdownMenuItem onClick={handleViewDetails}>
            <IconExternalLink className="mr-2 h-4 w-4" />
            Abrir em nova guia
          </DropdownMenuItem>
          {canEdit && (
            <DropdownMenuItem onClick={handleEditWithdrawal}>
              <IconEdit className="mr-2 h-4 w-4" />
              Editar
            </DropdownMenuItem>
          )}

          {/* Conditional actions based on type and status */}
          {canEdit && contextMenu?.withdrawal.type === EXTERNAL_OPERATION_TYPE.RETURNABLE &&
           contextMenu.withdrawal.status !== EXTERNAL_OPERATION_STATUS.FULLY_RETURNED && (
            <DropdownMenuItem onClick={handleMarkAsReturnedFromMenu} className="text-green-700 dark:text-green-400">
              <IconCheck className="mr-2 h-4 w-4" />
              Devolução Total
            </DropdownMenuItem>
          )}

          {canEdit && contextMenu?.withdrawal.type === EXTERNAL_OPERATION_TYPE.CHARGEABLE &&
           contextMenu.withdrawal.status === EXTERNAL_OPERATION_STATUS.PENDING && (
            <DropdownMenuItem onClick={handleMarkAsChargedFromMenu} className="text-purple-700 dark:text-purple-400">
              <IconCurrencyReal className="mr-2 h-4 w-4" />
              Marcar como Cobrado
            </DropdownMenuItem>
          )}

          {canEdit && contextMenu?.withdrawal.type === EXTERNAL_OPERATION_TYPE.CHARGEABLE &&
           contextMenu.withdrawal.status === EXTERNAL_OPERATION_STATUS.CHARGED && (
            <DropdownMenuItem onClick={handleMarkAsLiquidatedFromMenu} className="text-green-700 dark:text-green-400">
              <IconCheck className="mr-2 h-4 w-4" />
              Liquidar
            </DropdownMenuItem>
          )}

          {canEdit && contextMenu?.withdrawal.type === EXTERNAL_OPERATION_TYPE.COMPLIMENTARY &&
           contextMenu.withdrawal.status === EXTERNAL_OPERATION_STATUS.PENDING && (
            <DropdownMenuItem onClick={handleMarkAsDeliveredFromMenu} className="text-blue-700 dark:text-blue-400">
              <IconPackageExport className="mr-2 h-4 w-4" />
              Entregar
            </DropdownMenuItem>
          )}

          {canDelete && contextMenu && !NON_DELETABLE_STATUSES.includes(contextMenu.withdrawal.status) && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={handleDeleteFromMenu} className="text-destructive">
                <IconTrash className="mr-2 h-4 w-4" />
                Excluir
              </DropdownMenuItem>
            </>
          )}
        </PositionedDropdownMenuContent>
      </DropdownMenu>

      {/* Charge Confirmation Dialog */}
      <AlertDialog open={!!chargeDialog} onOpenChange={(open) => !open && setChargeDialog(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar Cobrança</AlertDialogTitle>
            <AlertDialogDescription>
              Marcar a operação de "{chargeDialog?.withdrawal.withdrawerName}" como cobrada? Se o faturamento estiver configurado (cliente + NFS-e/boleto), os documentos de
              cobrança (NFS-e e boletos) serão gerados automaticamente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={confirmCharge}>Confirmar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!deleteDialog} onOpenChange={(open) => !open && setDeleteDialog(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar exclusão</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir a operação de "{deleteDialog?.withdrawal.withdrawerName}"? Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
