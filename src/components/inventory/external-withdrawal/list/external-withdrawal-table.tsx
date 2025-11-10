import React from "react";
import { useNavigate } from "react-router-dom";
import type { ExternalWithdrawal } from "../../../../types";
import { routes, EXTERNAL_WITHDRAWAL_STATUS, EXTERNAL_WITHDRAWAL_TYPE, EXTERNAL_WITHDRAWAL_TYPE_LABELS } from "../../../../constants";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { IconChevronUp, IconChevronDown, IconEdit, IconTrash, IconSelector, IconEye, IconAlertTriangle, IconPackageExport, IconCheck, IconPlus } from "@tabler/icons-react";
import { cn } from "@/lib/utils";
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
import { useExternalWithdrawals, useExternalWithdrawalMutations, useExternalWithdrawalStatusMutations } from "../../../../hooks";
import { toast } from "sonner";
import { SimplePaginationAdvanced } from "@/components/ui/pagination-advanced";
import type { ExternalWithdrawalGetManyFormData } from "../../../../schemas";
import { useScrollbarWidth } from "@/hooks/use-scrollbar-width";
import { TABLE_LAYOUT } from "@/components/ui/table-constants";
import { TruncatedTextWithTooltip } from "@/components/ui/truncated-text-with-tooltip";
import { useTableState, convertSortConfigsToOrderBy } from "@/hooks/use-table-state";
import { formatCurrency, formatDate } from "../../../../utils";
import { ExternalWithdrawalStatusBadge } from "../common/external-withdrawal-status-badge";
import { Badge } from "@/components/ui/badge";
import { ExternalWithdrawalTableSkeleton } from "./external-withdrawal-table-skeleton";
import { ContextMenuTrigger, type ContextMenuItem } from "@/components/ui/context-menu";

interface ExternalWithdrawalTableProps {
  visibleColumns: Set<string>;
  className?: string;
  onEdit?: (withdrawals: ExternalWithdrawal[]) => void;
  onDelete?: (withdrawals: ExternalWithdrawal[]) => void;
  filters?: Partial<ExternalWithdrawalGetManyFormData>;
  onDataChange?: (data: { externalWithdrawals: ExternalWithdrawal[]; totalRecords: number }) => void;
}

// Table column definitions
interface ExternalWithdrawalColumn {
  key: string;
  header: string;
  accessor: (withdrawal: ExternalWithdrawal) => React.ReactNode;
  sortable: boolean;
  className?: string;
  align?: "left" | "center" | "right";
}

const createExternalWithdrawalColumns = (): ExternalWithdrawalColumn[] => [
  {
    key: "withdrawerName",
    header: "RETIRADO POR",
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
    key: "status",
    header: "STATUS",
    accessor: (withdrawal) => <ExternalWithdrawalStatusBadge status={withdrawal.status} />,
    sortable: true,
    align: "left",
    className: "w-40",
  },
  {
    key: "type",
    header: "TIPO",
    accessor: (withdrawal) => (
      <Badge variant={withdrawal.type === EXTERNAL_WITHDRAWAL_TYPE.RETURNABLE ? "default" :
                     withdrawal.type === EXTERNAL_WITHDRAWAL_TYPE.CHARGEABLE ? "destructive" : "secondary"}>
        {EXTERNAL_WITHDRAWAL_TYPE_LABELS[withdrawal.type]}
      </Badge>
    ),
    sortable: true,
    align: "left",
    className: "w-36",
  },
  // Fields not available in ExternalWithdrawal type - commented out to fix TypeScript errors
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
  // Fields not available in ExternalWithdrawal type - commented out to fix TypeScript errors
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
      if (withdrawal.type === EXTERNAL_WITHDRAWAL_TYPE.CHARGEABLE && withdrawal.items) {
        const total = withdrawal.items.reduce((sum, item) => {
          const price = item.price || item.unitPrice || 0;
          return sum + item.withdrawedQuantity * price;
        }, 0);
        return <span className="text-sm font-semibold tabular-nums">{formatCurrency(total)}</span>;
      }
      return <span className="text-sm text-muted-foreground tabular-nums text-right w-full inline-block">-</span>;
    },
    sortable: false,
    align: "right",
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
  // Fields not available in ExternalWithdrawal type - commented out to fix TypeScript errors
  // {
  //   key: "expectedReturnDate",
  //   header: "Data Prevista Devolução",
  //   accessor: (withdrawal) => (
  //     <span className="text-sm text-muted-foreground">
  //       {withdrawal.expectedReturnDate ? formatDate(withdrawal.expectedReturnDate) : "-"}
  //     </span>
  //   ),
  //   sortable: true,
  //   className: "min-w-[160px]",
  // },
  // {
  //   key: "actualReturnDate",
  //   header: "Data Real Devolução",
  //   accessor: (withdrawal) => (
  //     <span className="text-sm text-muted-foreground">
  //       {withdrawal.actualReturnDate ? formatDate(withdrawal.actualReturnDate) : "-"}
  //     </span>
  //   ),
  //   sortable: true,
  //   className: "min-w-[160px]",
  // },
  // {
  //   key: "withdrawalDate",
  //   header: "Data da Retirada",
  //   accessor: (withdrawal) => (
  //     <span className="text-sm text-muted-foreground">
  //       {withdrawal.withdrawalDate ? formatDate(withdrawal.withdrawalDate) : "-"}
  //     </span>
  //   ),
  //   sortable: true,
  //   className: "min-w-[140px]",
  // },
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

export function getDefaultVisibleColumns(): Set<string> {
  return new Set(["withdrawerName", "status", "type", "total", "createdAt"]);
}

export function getAllColumns(): ExternalWithdrawalColumn[] {
  return createExternalWithdrawalColumns();
}

export function ExternalWithdrawalTable({ visibleColumns, className, onEdit: _onEdit, onDelete: _onDelete, filters = {}, onDataChange }: ExternalWithdrawalTableProps) {
  const navigate = useNavigate();
  const { delete: deleteWithdrawal } = useExternalWithdrawalMutations();
  const { markAsFullyReturned } = useExternalWithdrawalStatusMutations();

  // Delete confirmation dialog state
  const [deleteDialog, setDeleteDialog] = React.useState<{
    withdrawal: ExternalWithdrawal;
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
      // When showSelectedOnly is true, don't apply filters
      ...(showSelectedOnly ? {} : filters),
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
  const { data: response, isLoading, error, refetch } = useExternalWithdrawals(queryParams);

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
        onDataChange({ externalWithdrawals: withdrawals, totalRecords });
      }
    }
  }, [withdrawals, totalRecords, onDataChange]);

  // Get columns
  const columns = React.useMemo(() => createExternalWithdrawalColumns(), []);
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
    (withdrawal: ExternalWithdrawal, event: React.MouseEvent) => {
      // Don't navigate if clicking checkbox or context menu
      if ((event.target as HTMLElement).closest('[role="checkbox"]') || (event.target as HTMLElement).closest('[role="menu"]')) {
        return;
      }
      navigate(routes.inventory.externalWithdrawals?.details?.(withdrawal.id) || `/inventory/external-withdrawals/details/${withdrawal.id}`);
    },
    [navigate],
  );

  // Handle actions
  const handleView = React.useCallback(
    (withdrawal: ExternalWithdrawal) => {
      navigate(routes.inventory.externalWithdrawals?.details?.(withdrawal.id) || `/inventory/external-withdrawals/details/${withdrawal.id}`);
    },
    [navigate],
  );

  const handleEdit = React.useCallback(
    (withdrawal: ExternalWithdrawal) => {
      navigate(routes.inventory.externalWithdrawals?.edit?.(withdrawal.id) || `/inventory/external-withdrawals/edit/${withdrawal.id}`);
    },
    [navigate],
  );

  const handleMarkAsReturned = React.useCallback(
    async (withdrawal: ExternalWithdrawal) => {
      if (withdrawal.type !== EXTERNAL_WITHDRAWAL_TYPE.RETURNABLE) return;

      try {
        await markAsFullyReturned.mutateAsync({ id: withdrawal.id });
        refetch();
      } catch (error) {
        // Error handled by API client
      }
    },
    [markAsFullyReturned, refetch],
  );

  const handleDelete = React.useCallback(
    async (withdrawal: ExternalWithdrawal) => {
      setDeleteDialog({ withdrawal });
    },
    [],
  );

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
    return <ExternalWithdrawalTableSkeleton visibleColumns={visibleColumns} className={className} />;
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
                    <div className="text-lg font-medium mb-2">Não foi possível carregar as retiradas externas</div>
                    <div className="text-sm text-muted-foreground">Tente novamente mais tarde.</div>
                  </div>
                </TableCell>
              </TableRow>
            ) : withdrawals.length === 0 ? (
              <TableRow>
                <TableCell colSpan={filteredColumns.length + 1} className="p-0">
                  <div className="flex flex-col items-center justify-center p-8 text-center text-muted-foreground">
                    <IconPackageExport className="h-12 w-12 text-muted-foreground/50 mb-4" />
                    <div className="text-lg font-medium mb-2">Nenhuma retirada externa encontrada</div>
                    {filters && Object.keys(filters).length > 1 ? (
                      <div className="text-sm">Ajuste os filtros para ver mais resultados.</div>
                    ) : (
                      <>
                        <div className="text-sm mb-4">Comece registrando a primeira retirada externa.</div>
                        <Button onClick={() => navigate(routes.inventory.externalWithdrawals.create)} variant="outline">
                          <IconPlus className="h-4 w-4 mr-2" />
                          Nova Retirada
                        </Button>
                      </>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              withdrawals.map((withdrawal, index) => {
                const isWithdrawalSelected = isSelected(withdrawal.id);

                // Create context menu items
                const contextMenuItems: ContextMenuItem[] = [
                  {
                    id: "view",
                    label: "Visualizar",
                    icon: <IconEye className="h-4 w-4" />,
                    onClick: () => handleView(withdrawal),
                  },
                  {
                    id: "edit",
                    label: "Editar",
                    icon: <IconEdit className="h-4 w-4" />,
                    onClick: () => handleEdit(withdrawal),
                  },
                ];

                // Add "Marcar como devolvido" if type is RETURNABLE
                if (withdrawal.type === EXTERNAL_WITHDRAWAL_TYPE.RETURNABLE && withdrawal.status !== EXTERNAL_WITHDRAWAL_STATUS.FULLY_RETURNED) {
                  contextMenuItems.push({
                    id: "mark-returned",
                    label: "Marcar como devolvido",
                    icon: <IconCheck className="h-4 w-4" />,
                    onClick: () => handleMarkAsReturned(withdrawal),
                  });
                }

                // Add delete option
                contextMenuItems.push({
                  id: "delete",
                  label: "Excluir",
                  icon: <IconTrash className="h-4 w-4" />,
                  onClick: () => handleDelete(withdrawal),
                  variant: "destructive",
                });

                return (
                  <ContextMenuTrigger key={withdrawal.id} items={contextMenuItems}>
                    <TableRow
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
                    >
                      <TableCell className={cn(TABLE_LAYOUT.checkbox.className, "p-0 !border-r-0")}>
                        <div className="flex items-center justify-center h-full w-full px-2 py-2" onClick={(e) => e.stopPropagation()}>
                          <Checkbox
                            checked={isWithdrawalSelected}
                            onCheckedChange={() => toggleSelection(withdrawal.id)}
                            aria-label={`Selecionar retirada de ${withdrawal.withdrawerName}`}
                            data-checkbox
                          />
                        </div>
                      </TableCell>
                      {filteredColumns.map((column) => (
                        <TableCell key={column.key} className={cn("p-0 !border-r-0", column.className)}>
                          <div className={cn("px-4 py-2 text-sm", column.align === "center" && "text-center", column.align === "right" && "text-right")}>
                            {column.accessor(withdrawal)}
                          </div>
                        </TableCell>
                      ))}
                    </TableRow>
                  </ContextMenuTrigger>
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

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!deleteDialog} onOpenChange={(open) => !open && setDeleteDialog(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar exclusão</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir a retirada de "{deleteDialog?.withdrawal.withdrawerName}"? Esta ação não pode ser desfeita.
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
