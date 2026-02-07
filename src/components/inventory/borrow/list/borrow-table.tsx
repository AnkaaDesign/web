import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import type { Borrow } from "../../../../types";
import { routes, BORROW_STATUS, BORROW_STATUS_LABELS, getBadgeVariant } from "../../../../constants";
import type { BORROW_STATUS as BorrowStatusType } from "../../../../constants";
import { formatDate, formatRelativeTime } from "../../../../utils";
import { useAuth } from "../../../../hooks/use-auth";
import { canEditBorrows, canDeleteBorrows, shouldShowInteractiveElements } from "@/utils/permissions/entity-permissions";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { IconChevronUp, IconChevronDown, IconEdit, IconPackageImport, IconTrash, IconSelector, IconEye, IconAlertTriangle, IconPackageExport, IconX } from "@tabler/icons-react";
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
import { useBorrowMutations, useBorrowBatchMutations, useBorrows } from "../../../../hooks";
import { useBatchResultDialog } from "@/hooks/use-batch-result-dialog";
import { BorrowBatchResultDialog } from "@/components/ui/batch-operation-result-dialog";
import { SimplePaginationAdvanced } from "@/components/ui/pagination-advanced";
import type { BorrowGetManyFormData } from "../../../../schemas";
import { useScrollbarWidth } from "@/hooks/use-scrollbar-width";
import { TABLE_LAYOUT } from "@/components/ui/table-constants";
import { TruncatedTextWithTooltip } from "@/components/ui/truncated-text-with-tooltip";
import { useTableState, convertSortConfigsToOrderBy } from "@/hooks/use-table-state";
import { BorrowTableSkeleton } from "../common/borrow-skeleton";

interface BorrowTableProps {
  visibleColumns: Set<string>;
  className?: string;
  onEdit?: (items: Borrow[]) => void;
  onReturn?: (items: Borrow[]) => void;
  onDelete?: (items: Borrow[]) => void;
  filters?: Partial<BorrowGetManyFormData>;
  onDataChange?: (data: { items: Borrow[]; totalRecords: number }) => void;
}

interface BorrowColumn {
  key: string;
  header: string;
  accessor: (item: Borrow) => React.ReactNode;
  sortable: boolean;
  className?: string;
  align?: "left" | "center" | "right";
}

// Use centralized badge configuration instead of hardcoded variants

// Helper function to format date with relative time
const formatDateWithRelative = (date: Date | string) => {
  const dateObj = typeof date === "string" ? new Date(date) : date;

  // If less than 24 hours ago, show relative time
  const now = new Date();
  const diffMs = now.getTime() - dateObj.getTime();
  const diffHours = diffMs / (1000 * 60 * 60);

  if (diffHours < 24) {
    return formatRelativeTime(dateObj);
  }

  // Otherwise show date
  return formatDate(dateObj);
};

export function BorrowTable({ visibleColumns, className, onEdit, onReturn, onDelete, filters = {}, onDataChange }: BorrowTableProps) {
  const navigate = useNavigate();
  const { user, isLoading: isAuthLoading } = useAuth();
  const { deleteMutation } = useBorrowMutations();
  const { batchDelete, batchUpdateAsync } = useBorrowBatchMutations();

  // Batch result dialogs
  const returnResultDialog = useBatchResultDialog();
  const markAsLostResultDialog = useBatchResultDialog();

  // Permission checks
  const canEdit = user ? canEditBorrows(user) : false;
  const canDelete = user ? canDeleteBorrows(user) : false;
  const showInteractive = user ? shouldShowInteractiveElements(user, 'borrow') : false;

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
    selectionCount,
    resetSelection: _resetSelection,
    removeFromSelection,
    handleRowClick: handleRowClickSelection,
  } = useTableState({
    defaultPageSize: 40,
    resetSelectionOnPageChange: false,
    defaultSort: [
      { column: "status", direction: "asc" }, // Active items first (ACTIVE < RETURNED < LOST)
      { column: "createdAt", direction: "desc" }, // Then by most recent
    ],
  });

  // Memoize include configuration to prevent re-renders
  const includeConfig = React.useMemo(
    () => ({
      item: {
        include: {
          brand: true,
          category: true,
        },
      },
      user: {
        include: {
          position: true,
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

  // Use the borrows hook with memoized parameters
  const { data: response, isLoading, error } = useBorrows(queryParams);

  const borrows = response?.data || [];
  const totalPages = response?.meta ? Math.ceil(response.meta.totalRecords / pageSize) : 1;
  const totalRecords = response?.meta?.totalRecords || 0;

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
      // Create a unique key for the current data to detect real changes
      const dataKey = borrows.length > 0 ? `${totalRecords}-${borrows.map((item) => item.id).join(",")}` : `empty-${totalRecords}`;

      // Only notify if this exact data hasn't been notified yet
      if (dataKey !== lastNotifiedDataRef.current) {
        lastNotifiedDataRef.current = dataKey;
        onDataChange({ items: borrows, totalRecords });
      }
    }
  }, [borrows, totalRecords, onDataChange]);

  // Context menu state
  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    items: Borrow[];
    isBulk: boolean;
  } | null>(null);

  // Confirmation dialog state
  const [markAsLostDialog, setMarkAsLostDialog] = useState<{
    items: Borrow[];
    isBulk: boolean;
  } | null>(null);

  // Define all available columns
  const allColumns: BorrowColumn[] = [
    {
      key: "item.uniCode",
      header: "CÓDIGO",
      accessor: (borrow: Borrow) => <div className="font-mono text-sm truncate">{borrow.item?.uniCode || "-"}</div>,
      sortable: true,
      className: "w-32",
      align: "left",
    },
    {
      key: "item.name",
      header: "ITEM",
      accessor: (borrow: Borrow) => <TruncatedTextWithTooltip text={borrow.item?.name || "-"} className="font-medium" />,
      sortable: true,
      className: "w-64",
      align: "left",
    },
    {
      key: "user.name",
      header: "USUÁRIO",
      accessor: (borrow: Borrow) => (
        <div>
          <TruncatedTextWithTooltip text={borrow.user?.name || "-"} className="font-medium" />
        </div>
      ),
      sortable: true,
      className: "w-48",
      align: "left",
    },
    {
      key: "quantity",
      header: "QNT",
      accessor: (borrow: Borrow) => <div className="font-mono text-sm text-center">{borrow.quantity}</div>,
      sortable: true,
      className: "w-40",
      align: "center",
    },
    {
      key: "status",
      header: "STATUS",
      accessor: (borrow: Borrow) => {
        // Check if status exists
        if (!borrow.status) {
          if (process.env.NODE_ENV !== 'production') {
            console.error("Borrow status is undefined:", borrow);
          }
          return <div className="text-muted-foreground">-</div>;
        }

        const status = borrow.status as BorrowStatusType;
        const label = BORROW_STATUS_LABELS[status];

        if (!label) {
          if (process.env.NODE_ENV !== 'production') {
            console.error("Unknown status:", status);
          }
          return <Badge variant="default">{status}</Badge>;
        }

        return (
          <div className="flex">
            <Badge variant={getBadgeVariant(status, "BORROW")}>{label}</Badge>
          </div>
        );
      },
      sortable: true,
      className: "w-32",
      align: "left",
    },
    {
      key: "createdAt",
      header: "EMPRESTADO",
      accessor: (borrow: Borrow) => <div className="text-sm text-muted-foreground">{formatDateWithRelative(borrow.createdAt)}</div>,
      sortable: true,
      className: "w-40",
      align: "left",
    },
    {
      key: "returnedAt",
      header: "DEVOLVIDO",
      accessor: (borrow: Borrow) => <div className="text-sm text-muted-foreground">{borrow.returnedAt ? formatDateWithRelative(borrow.returnedAt) : "-"}</div>,
      sortable: true,
      className: "w-36",
      align: "left",
    },
    {
      key: "item.category.name",
      header: "CATEGORIA",
      accessor: (borrow: Borrow) => <div className="truncate">{borrow.item?.category?.name || "-"}</div>,
      sortable: false,
      className: "w-40",
      align: "left",
    },
    {
      key: "updatedAt",
      header: "ATUALIZADO EM",
      accessor: (borrow: Borrow) => <div className="text-sm text-muted-foreground">{formatDateWithRelative(borrow.updatedAt)}</div>,
      sortable: true,
      className: "w-40",
      align: "left",
    },
  ];

  // Filter columns based on visibility
  const columns = allColumns.filter((col) => visibleColumns.has(col.key));

  // Get current page item IDs for selection
  const currentPageBorrowIds = React.useMemo(() => {
    return borrows.map((borrow) => borrow.id);
  }, [borrows]);

  // Selection handlers
  const allSelected = isAllSelected(currentPageBorrowIds);
  const partiallySelected = isPartiallySelected(currentPageBorrowIds);

  const handleSelectAll = () => {
    toggleSelectAll(currentPageBorrowIds);
  };

  const handleSelectBorrow = (borrowId: string, event?: React.MouseEvent) => {
    handleRowClickSelection(borrowId, currentPageBorrowIds, event?.shiftKey || false);
  };

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

  // Context menu handlers
  const handleContextMenu = (e: React.MouseEvent, borrow: Borrow) => {
    e.preventDefault();
    e.stopPropagation();

    // Check if clicked item is part of selection
    const isBorrowSelected = isSelected(borrow.id);
    const hasSelection = selectionCount > 0;

    if (hasSelection && isBorrowSelected) {
      // Show bulk actions for all selected items
      const selectedBorrowsList = borrows.filter((b) => isSelected(b.id));
      setContextMenu({
        x: e.clientX,
        y: e.clientY,
        items: selectedBorrowsList,
        isBulk: true,
      });
    } else {
      // Show actions for just the clicked item
      setContextMenu({
        x: e.clientX,
        y: e.clientY,
        items: [borrow],
        isBulk: false,
      });
    }
  };

  const handleView = () => {
    if (contextMenu && !contextMenu.isBulk) {
      navigate(routes.inventory.loans.details(contextMenu.items[0].id));
      setContextMenu(null);
    }
  };

  const handleEdit = () => {
    if (contextMenu) {
      // Always use batch edit (even for single items)
      if (onEdit) {
        onEdit(contextMenu.items);
      } else {
        // Edit functionality not implemented
      }
      setContextMenu(null);
    }
  };

  const handleReturn = async () => {
    if (contextMenu) {
      if (onReturn) {
        onReturn(contextMenu.items);
      } else {
        try {
          // Filter active items and prepare batch update
          const itemsToReturn = contextMenu.items.filter((item) => item.status === BORROW_STATUS.ACTIVE);

          if (itemsToReturn.length > 0) {
            const updates = itemsToReturn.map((item) => ({
              id: item.id,
              data: {
                status: BORROW_STATUS.RETURNED,
                returnedAt: new Date(),
              },
            }));

            // Request item and user data to be included in the response for the result dialog
            const result = await batchUpdateAsync(
              { borrows: updates },
              { item: true, user: true },
            );

            if (result.data) {
              // Open result dialog to show detailed results
              returnResultDialog.openDialog(result.data);

              // Remove returned items from selection
              const returnedIds = updates.map((update) => update.id);
              removeFromSelection(returnedIds);
            }
          }
        } catch (error) {
          // Error handled by API client
        }
      }
      setContextMenu(null);
    }
  };

  const handleDelete = async () => {
    if (contextMenu) {
      try {
        if (contextMenu.isBulk && contextMenu.items.length > 1) {
          // Bulk delete
          if (onDelete) {
            onDelete(contextMenu.items);
          } else {
            // Fallback to batch API
            const ids = contextMenu.items.map((item) => item.id);
            await batchDelete({ borrowIds: ids });
            // Remove deleted items from selection
            removeFromSelection(ids);
          }
        } else {
          // Single delete
          if (onDelete) {
            onDelete(contextMenu.items);
          } else {
            const itemId = contextMenu.items[0].id;
            await deleteMutation.mutateAsync(itemId);
            // Remove deleted item from selection
            removeFromSelection([itemId]);
          }
        }
        setContextMenu(null);
      } catch (error) {
        // Error handled by API client
      }
    }
  };

  const handleMarkAsLost = () => {
    if (contextMenu) {
      setMarkAsLostDialog({
        items: contextMenu.items,
        isBulk: contextMenu.isBulk,
      });
      setContextMenu(null);
    }
  };

  const confirmMarkAsLost = async () => {
    if (markAsLostDialog) {
      try {
        // Filter items that are not already lost and prepare batch update
        const itemsToMark = markAsLostDialog.items.filter((item) => item.status !== BORROW_STATUS.LOST);

        if (itemsToMark.length > 0) {
          const updates = itemsToMark.map((item) => ({
            id: item.id,
            data: {
              status: BORROW_STATUS.LOST,
            },
          }));

          // Request item and user data to be included in the response for the result dialog
          const result = await batchUpdateAsync(
            { borrows: updates },
            { item: true, user: true },
          );

          if (result.data) {
            // Open result dialog to show detailed results
            markAsLostResultDialog.openDialog(result.data);

            // Remove marked items from selection
            const markedIds = updates.map((update) => update.id);
            removeFromSelection(markedIds);
          }
        }
      } catch (error) {
        // Error handled by API client
      }
      setMarkAsLostDialog(null);
    }
  };

  // Close context menu when clicking outside
  React.useEffect(() => {
    const handleClick = () => setContextMenu(null);
    document.addEventListener("click", handleClick);
    return () => document.removeEventListener("click", handleClick);
  }, []);

  if (isLoading) {
    return <BorrowTableSkeleton />;
  }

  return (
    <div className={cn("h-full flex flex-col overflow-hidden rounded-lg", className)}>
      {/* Fixed Header Table */}
      <div className="border-l border-r border-t border-border rounded-t-lg overflow-hidden flex-shrink-0">
        <Table className={cn("w-full [&>div]:border-0 [&>div]:rounded-none", TABLE_LAYOUT.tableLayout)}>
          <TableHeader className="[&_tr]:border-b-0 [&_tr]:hover:bg-muted">
            <TableRow className="bg-muted hover:bg-muted even:bg-muted">
              {/* Selection column */}
              {showInteractive && (
                <TableHead className={cn(TABLE_LAYOUT.checkbox.className, "whitespace-nowrap text-foreground font-bold uppercase text-xs bg-muted !border-r-0 p-0")}>
                  <div className="flex items-center justify-center h-full w-full px-2">
                    <Checkbox
                      checked={allSelected}
                      indeterminate={partiallySelected}
                      onCheckedChange={handleSelectAll}
                      aria-label="Select all items"
                      disabled={isLoading || borrows.length === 0}
                    />
                  </div>
                </TableHead>
              )}

              {/* Data columns */}
              {columns.map((column) => (
                <TableHead key={column.key} className={cn("whitespace-nowrap text-foreground font-bold uppercase text-xs p-0 bg-muted !border-r-0", column.className)}>
                  {column.sortable ? (
                    <button
                      onClick={() => toggleSort(column.key)}
                      className={cn(
                        "flex items-center gap-1 w-full h-full min-h-[2.5rem] px-4 py-2 hover:bg-muted/80 transition-colors cursor-pointer text-left border-0 bg-transparent",
                        column.align === "center" && "justify-center",
                        column.align === "right" && "justify-end",
                        !column.align && "justify-start",
                      )}
                      disabled={isLoading || borrows.length === 0}
                    >
                      <TruncatedTextWithTooltip text={column.header} />
                      {renderSortIndicator(column.key)}
                    </button>
                  ) : (
                    <div
                      className={cn(
                        "flex items-center h-full min-h-[2.5rem] px-4 py-2",
                        column.align === "center" && "justify-center text-center",
                        column.align === "right" && "justify-end text-right",
                        !column.align && "justify-start text-left",
                      )}
                    >
                      <TruncatedTextWithTooltip text={column.header} />
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

      {/* Scrollable Body Table */}
      <div className="flex-1 overflow-y-auto overflow-x-hidden border-l border-r border-border">
        <Table className={cn("w-full [&>div]:border-0 [&>div]:rounded-none", TABLE_LAYOUT.tableLayout)}>
          <TableBody>
            {error ? (
              <TableRow>
                <TableCell colSpan={columns.length + 1} className="p-0">
                  <div className="flex flex-col items-center justify-center p-8 text-center text-destructive">
                    <IconAlertTriangle className="h-8 w-8 mb-4" />
                    <div className="text-lg font-medium mb-2">Erro ao carregar empréstimos</div>
                    <div className="text-sm text-muted-foreground">Tente novamente mais tarde.</div>
                  </div>
                </TableCell>
              </TableRow>
            ) : borrows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={columns.length + 1} className="p-0">
                  <div className="flex flex-col items-center justify-center p-8 text-center text-muted-foreground">
                    <IconPackageExport className="h-12 w-12 text-muted-foreground/50 mb-4" />
                    <div className="text-lg font-medium mb-2">Nenhum empréstimo encontrado</div>
                    {filters && Object.keys(filters).length > 1 && <div className="text-sm">Tente ajustar os filtros para ver mais resultados.</div>}
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              borrows.map((borrow, index) => {
                const borrowIsSelected = isSelected(borrow.id);

                return (
                  <TableRow
                    key={borrow.id}
                    data-state={borrowIsSelected ? "selected" : undefined}
                    className={cn(
                      "cursor-pointer transition-colors border-b border-border",
                      // Alternating row colors
                      index % 2 === 1 && "bg-muted/10",
                      // Hover state that works with alternating colors
                      "hover:bg-muted/20",
                      // Selected state overrides alternating colors
                      borrowIsSelected && "bg-muted/30 hover:bg-muted/40",
                    )}
                    onClick={() => navigate(routes.inventory.loans.details(borrow.id))}
                    onContextMenu={(e) => handleContextMenu(e, borrow)}
                  >
                    {/* Selection checkbox */}
                    {showInteractive && (
                      <TableCell className={cn(TABLE_LAYOUT.checkbox.className, "p-0 !border-r-0")}>
                        <div
                          className="flex items-center justify-center h-full w-full px-2 py-2"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleSelectBorrow(borrow.id, e);
                          }}
                        >
                          <Checkbox
                            checked={borrowIsSelected}
                            aria-label={`Select ${borrow.item?.name || "borrow"}`}
                            data-checkbox
                          />
                        </div>
                      </TableCell>
                    )}

                    {/* Data columns */}
                    {columns.map((column) => (
                      <TableCell
                        key={column.key}
                        className={cn(
                          column.className,
                          "p-0 !border-r-0",
                          column.align === "center" && "text-center",
                          column.align === "right" && "text-right",
                          column.align === "left" && "text-left",
                          !column.align && "text-left",
                        )}
                      >
                        <div className="px-4 py-2">{column.accessor(borrow)}</div>
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
      <div className="px-4 border-l border-r border-b border-border rounded-b-lg bg-muted/50 flex-shrink-0">
        <SimplePaginationAdvanced
          currentPage={page}
          totalPages={totalPages}
          onPageChange={setPage}
          pageSize={pageSize}
          totalItems={totalRecords}
          pageSizeOptions={[20, 40, 60, 100]}
          onPageSizeChange={setPageSize}
          showPageSizeSelector={true}
          showGoToPage={true}
          showPageInfo={true}
        />
      </div>

      {/* Context Menu */}
      <DropdownMenu open={!!contextMenu} onOpenChange={(open) => !open && setContextMenu(null)}>
        <PositionedDropdownMenuContent
          position={contextMenu}
          isOpen={!!contextMenu}
          className="w-56"
          onCloseAutoFocus={(e) => e.preventDefault()}
        >
          {contextMenu?.isBulk && <div className="px-2 py-1.5 text-sm font-semibold text-muted-foreground">{contextMenu.items.length} itens selecionados</div>}

          {!contextMenu?.isBulk && (
            <DropdownMenuItem onClick={handleView}>
              <IconEye className="mr-2 h-4 w-4" />
              Visualizar
            </DropdownMenuItem>
          )}

          {canEdit && (
            <DropdownMenuItem onClick={handleEdit}>
              <IconEdit className="mr-2 h-4 w-4" />
              {contextMenu?.items.length === 1 ? "Editar" : "Editar em lote"}
            </DropdownMenuItem>
          )}

          {/* Show return option only for active items */}
          {canEdit && contextMenu &&
            (contextMenu.isBulk ? contextMenu.items.some((item) => item.status === BORROW_STATUS.ACTIVE) : contextMenu.items[0].status === BORROW_STATUS.ACTIVE) && (
              <DropdownMenuItem onClick={handleReturn} className="text-green-700 focus:text-white focus:bg-green-700 hover:text-white hover:bg-green-700">
                <IconPackageImport className="mr-2 h-4 w-4" />
                Devolver
              </DropdownMenuItem>
            )}

          {/* Show mark as lost option only for active items */}
          {canEdit && contextMenu && (contextMenu.isBulk ? contextMenu.items.some((item) => item.status === BORROW_STATUS.ACTIVE) : contextMenu.items[0].status === BORROW_STATUS.ACTIVE) && (
            <DropdownMenuItem onClick={handleMarkAsLost} className="text-destructive">
              <IconX className="mr-2 h-4 w-4" />
              Marcar como perdidos
            </DropdownMenuItem>
          )}

          {(canEdit || canDelete) && <DropdownMenuSeparator />}

          {canDelete && (
            <DropdownMenuItem onClick={handleDelete} className="text-destructive">
              <IconTrash className="mr-2 h-4 w-4" />
              {contextMenu?.isBulk && contextMenu.items.length > 1 ? "Deletar selecionados" : "Deletar"}
            </DropdownMenuItem>
          )}
        </PositionedDropdownMenuContent>
      </DropdownMenu>

      {/* Mark as Lost Confirmation Dialog */}
      <AlertDialog open={!!markAsLostDialog} onOpenChange={(open) => !open && setMarkAsLostDialog(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Marcar como perdido</AlertDialogTitle>
            <AlertDialogDescription>
              {markAsLostDialog?.isBulk && markAsLostDialog.items.length > 1
                ? `Tem certeza que deseja marcar ${markAsLostDialog.items.length} itens como perdidos? Esta ação não pode ser desfeita.`
                : `Tem certeza que deseja marcar o item "${markAsLostDialog?.items[0]?.item?.name}" como perdido? Esta ação não pode ser desfeita.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={confirmMarkAsLost} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Marcar como perdido
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Return Result Dialog */}
      <BorrowBatchResultDialog
        open={returnResultDialog.isOpen}
        onOpenChange={returnResultDialog.closeDialog}
        result={returnResultDialog.result}
        operationType="update"
      />

      {/* Mark as Lost Result Dialog */}
      <BorrowBatchResultDialog
        open={markAsLostResultDialog.isOpen}
        onOpenChange={markAsLostResultDialog.closeDialog}
        result={markAsLostResultDialog.result}
        operationType="update"
      />
    </div>
  );
}
