import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import type { Observation } from "../../../../types";
import { routes } from "../../../../constants";
import { useAuth } from "../../../../hooks/useAuth";
import { canEditObservations, canDeleteObservations, shouldShowInteractiveElements } from "@/utils/permissions/entity-permissions";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  IconChevronUp,
  IconChevronDown,
  IconAlertTriangle,
  IconEdit,
  IconTrash,
  IconSelector,
  IconNotes,
  IconEye,
} from "@tabler/icons-react";
import { cn } from "@/lib/utils";
import { DropdownMenu, DropdownMenuItem, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import { PositionedDropdownMenuContent } from "@/components/ui/positioned-dropdown-menu";
import { useObservations, useObservationMutations } from "../../../../hooks";
import { SimplePaginationAdvanced } from "@/components/ui/pagination-advanced";
import type { ObservationGetManyFormData } from "../../../../schemas";
import { useScrollbarWidth } from "@/hooks/use-scrollbar-width";
import { TABLE_LAYOUT } from "@/components/ui/table-constants";
import { TruncatedTextWithTooltip } from "@/components/ui/truncated-text-with-tooltip";
import { createObservationColumns } from "./observation-table-columns";
import type { ObservationColumn } from "./observation-table-columns";
import { useTableState, convertSortConfigsToOrderBy } from "@/hooks/use-table-state";
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
import { ObservationTableSkeleton } from "./observation-table-skeleton";

interface ObservationTableProps {
  visibleColumns: Set<string>;
  className?: string;
  filters?: Partial<ObservationGetManyFormData>;
  onDataChange?: (data: { items: Observation[]; totalRecords: number }) => void;
}

export function ObservationTable({ visibleColumns, className, filters = {}, onDataChange }: ObservationTableProps) {
  const navigate = useNavigate();
  const { delete: deleteObservation } = useObservationMutations();

  // Permission checks
  const { user, isLoading: isAuthLoading } = useAuth();
  const canEdit = user ? canEditObservations(user) : false;
  const canDelete = user ? canDeleteObservations(user) : false;
  const showInteractive = user ? shouldShowInteractiveElements(user, 'observation') : false;

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
    resetSelection,
    removeFromSelection,
    handleRowClick: handleRowClickSelection,
  } = useTableState({
    defaultPageSize: 40,
    resetSelectionOnPageChange: false,
  });

  // Memoize include configuration to prevent re-renders
  const includeConfig = React.useMemo(
    () => ({
      task: {
        include: {
          customer: true,
          sector: true,
          createdBy: true,
        },
      },
      files: true,
    }),
    [],
  );

  // Memoize query parameters to prevent infinite re-renders
  const queryParams = React.useMemo(() => {
    const params = {
      // Always apply base filters to prevent showing unintended records
      ...filters,
      page: page + 1, // Convert 0-based to 1-based for API
      limit: pageSize,
      include: includeConfig,
      // Convert sortConfigs to orderBy format for API
      ...(sortConfigs.length > 0 && {
        orderBy: convertSortConfigsToOrderBy(sortConfigs),
      }),
      // When showSelectedOnly is true, add ID filter to restrict to selected items
      ...(showSelectedOnly &&
        selectedIds.length > 0 && {
          where: {
            id: { in: selectedIds },
          },
        }),
    };
    return params;
  }, [filters, page, pageSize, includeConfig, sortConfigs, showSelectedOnly, selectedIds]);

  // Use the observations hook with memoized parameters
  const { data: response, isLoading, error } = useObservations(queryParams);

  const items = response?.data || [];
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
      const dataKey = items.length > 0 ? `${totalRecords}-${items.map((item) => item.id).join(",")}` : `empty-${totalRecords}`;

      // Only notify if this exact data hasn't been notified yet
      if (dataKey !== lastNotifiedDataRef.current) {
        lastNotifiedDataRef.current = dataKey;
        onDataChange({ items, totalRecords });
      }
    }
  }, [items, totalRecords, onDataChange]);

  // Context menu state
  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    items: Observation[];
    isBulk: boolean;
  } | null>(null);

  // Delete confirmation dialog state
  const [deleteDialog, setDeleteDialog] = useState<{
    items: Observation[];
    isBulk: boolean;
  } | null>(null);

  // Use viewport boundary checking hook
  
  // Get column definitions
  const columns = React.useMemo(() => createObservationColumns(), []);

  // Filter visible columns
  const displayColumns = React.useMemo(() => columns.filter((col) => visibleColumns.has(col.key)), [columns, visibleColumns]);

  // Get current page item IDs for selection
  const currentPageItemIds = React.useMemo(() => {
    return items.map((item) => item.id);
  }, [items]);

  // Selection state
  const allSelected = isAllSelected(currentPageItemIds);
  const partiallySelected = isPartiallySelected(currentPageItemIds);

  // Render sort indicator function (matching item table)
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

  // Calculate if a column should be sortable
  const isColumnSortable = (column: ObservationColumn) => {
    return column.sortable !== false;
  };

  // Handle column sort
  const handleSort = (column: ObservationColumn) => {
    if (isColumnSortable(column)) {
      toggleSort(column.key);
    }
  };

  // Handle row selection
  const handleSelectItem = (itemId: string, event?: React.MouseEvent) => {
    handleRowClickSelection(itemId, currentPageItemIds, event?.shiftKey || false);
  };

  // Context menu handlers
  const handleContextMenu = (e: React.MouseEvent, item: Observation) => {
    e.preventDefault();
    e.stopPropagation();

    // Check if clicked item is part of selection
    const isItemSelected = isSelected(item.id);
    const hasSelection = selectionCount > 0;

    if (hasSelection && isItemSelected) {
      // Show bulk actions for all selected items
      const selectedItemsList = items.filter((i) => isSelected(i.id));
      setContextMenu({
        x: e.clientX,
        y: e.clientY,
        items: selectedItemsList,
        isBulk: true,
      });
    } else {
      // Show actions for just the clicked item
      setContextMenu({
        x: e.clientX,
        y: e.clientY,
        items: [item],
        isBulk: false,
      });
    }
  };

  const handleViewDetails = () => {
    if (contextMenu && contextMenu.items.length === 1) {
      navigate(routes.production.observations.details(contextMenu.items[0].id));
      setContextMenu(null);
    }
  };

  const handleEdit = () => {
    if (contextMenu) {
      if (contextMenu.items.length === 1) {
        navigate(routes.production.observations.edit(contextMenu.items[0].id));
      }
      setContextMenu(null);
    }
  };

  const handleDelete = () => {
    if (contextMenu) {
      setDeleteDialog({
        items: contextMenu.items,
        isBulk: contextMenu.isBulk && contextMenu.items.length > 1,
      });
      setContextMenu(null);
    }
  };

  const confirmDelete = async () => {
    if (!deleteDialog) return;

    try {
      if (deleteDialog.isBulk && deleteDialog.items.length > 1) {
        // Bulk delete
        for (const item of deleteDialog.items) {
          await deleteObservation(item.id);
        }
        // Remove deleted IDs from selection
        removeFromSelection(deleteDialog.items.map((item) => item.id));
        // Success toast is handled by the API client
      } else {
        // Single delete
        const deletedId = deleteDialog.items[0].id;
        await deleteObservation(deletedId);
        // Remove deleted ID from selection
        removeFromSelection([deletedId]);
        // Success toast is handled by the API client
      }
    } catch (error) {
      // Error is handled by the API client with detailed message
      if (process.env.NODE_ENV !== 'production') {
        console.error("Error deleting observation(s):", error);
      }
    } finally {
      setDeleteDialog(null);
    }
  };

  // Close context menu when clicking outside
  React.useEffect(() => {
    const handleClick = () => setContextMenu(null);
    document.addEventListener("click", handleClick);
    return () => document.removeEventListener("click", handleClick);
  }, []);

  if (isLoading) {
    return <ObservationTableSkeleton visibleColumns={visibleColumns} className={className} />;
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-full space-y-4">
        <IconAlertTriangle className="h-12 w-12 text-destructive" />
        <p className="text-destructive">Erro ao carregar observações</p>
        <Button onClick={() => window.location.reload()} variant="outline" size="sm">
          Tentar novamente
        </Button>
      </div>
    );
  }

  return (
    <div className={cn("rounded-lg flex flex-col overflow-hidden", className)}>
      {/* Fixed Header Table */}
      <div className="border-l border-r border-t border-border rounded-t-lg overflow-hidden">
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
                      onCheckedChange={() => toggleSelectAll(currentPageItemIds)}
                      aria-label="Select all items"
                      disabled={isLoading || items.length === 0}
                      data-checkbox
                    />
                  </div>
                </TableHead>
              )}

              {/* Data columns */}
              {displayColumns.map((column) => {
                const isSortable = isColumnSortable(column);

                return (
                  <TableHead
                    key={column.key}
                    className={cn("whitespace-nowrap text-foreground font-bold uppercase text-xs p-0 bg-muted !border-r-0", column.className)}
                  >
                    {isSortable ? (
                      <button
                        onClick={() => handleSort(column)}
                        className={cn(
                          "flex items-center gap-1 w-full h-full min-h-[2.5rem] px-4 py-2 hover:bg-muted/80 transition-colors cursor-pointer text-left border-0 bg-transparent",
                          column.align === "center" && "justify-center",
                          column.align === "right" && "justify-end",
                        )}
                        disabled={isLoading || items.length === 0}
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
                );
              })}

              {/* Scrollbar spacer - only show if not overlay scrollbar */}
              {!isOverlay && (
                <TableHead style={{ width: `${scrollbarWidth}px`, minWidth: `${scrollbarWidth}px` }} className="bg-muted p-0 border-0 !border-r-0 shrink-0"></TableHead>
              )}
            </TableRow>
          </TableHeader>
        </Table>
      </div>

      {/* Scrollable Body Table */}
      <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden border-l border-r border-border">
        <Table className={cn("w-full [&>div]:border-0 [&>div]:rounded-none", TABLE_LAYOUT.tableLayout)}>
          <TableBody>
            {error ? (
              <TableRow>
                <TableCell colSpan={displayColumns.length + 1} className="p-0">
                  <div className="flex flex-col items-center justify-center p-8 text-center text-destructive">
                    <IconAlertTriangle className="h-8 w-8 mb-4" />
                    <div className="text-lg font-medium mb-2">Erro ao carregar observações</div>
                    <Button onClick={() => window.location.reload()} variant="outline" size="sm">
                      Tentar novamente
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ) : items.length === 0 ? (
              <TableRow>
                <TableCell colSpan={displayColumns.length + 1} className="p-0">
                  <div className="flex flex-col items-center justify-center p-8 text-center text-muted-foreground">
                    <IconNotes className="h-12 w-12 text-muted-foreground/50 mb-4" />
                    <div className="text-lg font-medium mb-2">Nenhuma observação encontrada</div>
                    {filters && Object.keys(filters).length > 1 && <div className="text-sm">Ajuste os filtros para ver mais resultados.</div>}
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              items.map((item, index) => {
                const itemIsSelected = isSelected(item.id);

                return (
                  <tr
                    key={item.id}
                    data-state={itemIsSelected ? "selected" : undefined}
                    className={cn(
                      "cursor-pointer transition-colors border-b border-border",
                      // Alternating row colors
                      index % 2 === 1 && "bg-muted/10",
                      // Hover state that works with alternating colors
                      "hover:bg-muted/20",
                      // Selected state overrides all
                      itemIsSelected && "bg-muted/30 hover:bg-muted/40",
                    )}
                    onClick={(e) => {
                      // Don't navigate if clicking checkbox
                      if ((e.target as HTMLElement).closest("[data-checkbox]")) {
                        return;
                      }
                      navigate(routes.production.observations.details(item.id));
                    }}
                    onContextMenu={(e) => handleContextMenu(e, item)}
                  >
                    {/* Selection checkbox */}
                    {showInteractive && (
                      <TableCell className={cn(TABLE_LAYOUT.checkbox.className, "p-0 !border-r-0 relative z-20")}>
                        <div className="flex items-center justify-center h-full w-full px-2 py-2" onClick={(e) => { e.stopPropagation(); handleSelectItem(item.id, e); }}>
                          <Checkbox checked={itemIsSelected} onCheckedChange={() => handleSelectItem(item.id)} aria-label={`Select observation`} data-checkbox />
                        </div>
                      </TableCell>
                    )}

                    {/* Data columns */}
                    {displayColumns.map((column) => (
                      <TableCell
                        key={column.key}
                        className={cn(
                          column.className,
                          "p-0 !border-r-0",
                          column.align === "center" && "text-center",
                          column.align === "right" && "text-right",
                          !column.align && "text-left",
                        )}
                      >
                        <div className="px-4 py-2">{column.accessor(item)}</div>
                      </TableCell>
                    ))}
                  </tr>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pagination Footer */}
      <div className="px-4 border-l border-r border-b border-border rounded-b-lg bg-muted/50">
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
        className="w-56 ![position:fixed]"
        onCloseAutoFocus={(e) => e.preventDefault()}
        >
          {contextMenu?.isBulk && <div className="px-2 py-1.5 text-sm font-semibold text-muted-foreground">{contextMenu.items.length} observações selecionadas</div>}

          {!contextMenu?.isBulk && (
            <>
              <DropdownMenuItem onClick={handleViewDetails}>
                <IconEye className="h-4 w-4 mr-2" />
                Ver detalhes
              </DropdownMenuItem>
              <DropdownMenuSeparator />
            </>
          )}

          {canEdit && (
            <DropdownMenuItem onClick={handleEdit}>
              <IconEdit className="h-4 w-4 mr-2" />
              Editar
            </DropdownMenuItem>
          )}

          {(canEdit || canDelete) && <DropdownMenuSeparator />}

          {canDelete && (
            <DropdownMenuItem onClick={handleDelete} className="text-destructive">
              <IconTrash className="h-4 w-4 mr-2" />
              Deletar
            </DropdownMenuItem>
          )}
        </PositionedDropdownMenuContent>
      </DropdownMenu>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!deleteDialog} onOpenChange={(open) => !open && setDeleteDialog(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar exclusão</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja deletar {deleteDialog?.items.length} observação{deleteDialog?.items.length !== 1 ? "ões" : ""}? Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Deletar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
