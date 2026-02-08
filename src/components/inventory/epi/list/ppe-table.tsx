import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import type { Item } from "../../../../types";
import { routes } from "../../../../constants";
import { useAuth } from "../../../../hooks/common/use-auth";
import { canEditPpeDeliveries, canDeletePpeDeliveries, shouldShowInteractiveElements } from "@/utils/permissions/entity-permissions";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import { IconChevronUp, IconChevronDown, IconRefresh, IconEdit, IconTrash, IconSelector, IconAlertTriangle, IconShield, IconEye, IconCheck, IconX } from "@tabler/icons-react";
import { cn } from "@/lib/utils";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
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
import { useItems } from "../../../../hooks";
import { toast } from "sonner";
import { SimplePaginationAdvanced } from "@/components/ui/pagination-advanced";
import type { ItemGetManyFormData } from "../../../../schemas";
import { useScrollbarWidth } from "@/hooks/common/use-scrollbar-width";
import { TABLE_LAYOUT } from "@/components/ui/table-constants";
import { createPpeColumns } from "./ppe-table-columns";
import { useTableState, convertSortConfigsToOrderBy } from "@/hooks/common/use-table-state";
import { TruncatedTextWithTooltip } from "@/components/ui/truncated-text-with-tooltip";

interface PpeTableProps {
  visibleColumns: Set<string>;
  className?: string;
  onEdit?: (items: Item[]) => void;
  onActivate?: (items: Item[]) => void;
  onDeactivate?: (items: Item[]) => void;
  filters?: Partial<ItemGetManyFormData>;
  onDataChange?: (data: { items: Item[]; totalRecords: number }) => void;
}

export function PpeTable({ visibleColumns, className, onEdit, onActivate, onDeactivate, filters = {}, onDataChange }: PpeTableProps) {
  const navigate = useNavigate();

  // Permission checks
  const { user, isLoading: isAuthLoading } = useAuth();
  const canEdit = user ? canEditPpeDeliveries(user) : false;
  const canDelete = user ? canDeletePpeDeliveries(user) : false;
  const showInteractive = user ? shouldShowInteractiveElements(user, 'ppe') : false;

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
    removeFromSelection: _removeFromSelection,
    handleRowClick: handleRowClickSelection,
  } = useTableState({
    defaultPageSize: 40,
    resetSelectionOnPageChange: false,
    defaultSort: [
      { column: "name", direction: "asc" }, // Default sort by name
    ],
  });

  // Prepare query parameters - explicitly remove page/limit from filters to avoid conflicts
  const { page: _removePage, limit: _removeLimit, ...cleanFilters } = filters;
  const queryFilters: Partial<ItemGetManyFormData> = {
    // Always apply base filters to prevent showing unintended records
    ...(showSelectedOnly ? {} : cleanFilters),
    page: Math.max(1, page + 1), // Convert from 0-based (useTableState) to 1-based (API), ensure never 0
    limit: pageSize,
    orderBy: convertSortConfigsToOrderBy(sortConfigs),
    include: {
      brand: true,
      category: true,
      measures: true,
      prices: {
        where: {
          current: true,
        },
        orderBy: {
          createdAt: "desc",
        },
        take: 1,
      },
    },
  };

  // Map showInactive to isActive at root level
  if (!showSelectedOnly && typeof cleanFilters.showInactive === "boolean") {
    queryFilters.isActive = !cleanFilters.showInactive;
  }

  // Filter to show only selected items if enabled
  if (showSelectedOnly && selectedIds.length > 0) {
    queryFilters.where = {
      id: { in: selectedIds },
    };
  }

  // Fetch data
  const { data, isLoading, error } = useItems(queryFilters, {
    placeholderData: (previousData) => previousData,
  });

  // Update parent component with current data
  React.useEffect(() => {
    if (data?.data && onDataChange) {
      onDataChange({
        items: data.data,
        totalRecords: data.meta?.totalRecords || 0,
      });
    }
  }, [data, onDataChange]);

  const items = data?.data || [];
  const totalPages = data?.meta ? Math.ceil(data.meta.totalRecords / pageSize) : 1;
  const totalRecords = data?.meta?.totalRecords || 0;

  // Get visible columns based on selection
  const columns = createPpeColumns();
  const visibleColumnConfigs = columns.filter((col) => visibleColumns.has(col.key));

  // Row actions
  const handleRowClick = (item: Item) => {
    navigate(routes.inventory.ppe.details(item.id));
  };

  // Get current page item IDs for selection
  const currentPageItemIds = React.useMemo(() => {
    return items.map((item) => item.id);
  }, [items]);

  // Selection handlers
  const allSelected = isAllSelected(currentPageItemIds);
  const partiallySelected = isPartiallySelected(currentPageItemIds);

  const handleSelectAll = () => {
    toggleSelectAll(currentPageItemIds);
  };

  const handleSelectItem = (itemId: string, event?: React.MouseEvent) => {
    handleRowClickSelection(itemId, currentPageItemIds, event?.shiftKey || false);
  };

  // Context menu state
  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    items: Item[];
    isBulk: boolean;
  } | null>(null);

  // Delete confirmation dialog state
  const [deleteDialog, setDeleteDialog] = useState<{
    items: Item[];
    isBulk: boolean;
  } | null>(null);

  // Context menu handlers
  const handleContextMenu = (e: React.MouseEvent, item: Item) => {
    e.preventDefault();
    e.stopPropagation();

    const isItemSelected = isSelected(item.id);
    const hasSelection = selectionCount > 0;

    if (hasSelection && isItemSelected) {
      const selectedItemsList = items.filter((i) => isSelected(i.id));
      setContextMenu({
        x: e.clientX,
        y: e.clientY,
        items: selectedItemsList,
        isBulk: true,
      });
    } else {
      setContextMenu({
        x: e.clientX,
        y: e.clientY,
        items: [item],
        isBulk: false,
      });
    }
  };

  const handleEdit = () => {
    if (contextMenu && onEdit) {
      onEdit(contextMenu.items);
      setContextMenu(null);
    }
  };

  const handleActivate = () => {
    if (contextMenu && onActivate) {
      onActivate(contextMenu.items);
      setContextMenu(null);
    }
  };

  const handleDeactivate = () => {
    if (contextMenu && onDeactivate) {
      onDeactivate(contextMenu.items);
      setContextMenu(null);
    }
  };

  // Close context menu when clicking outside
  React.useEffect(() => {
    const handleClick = () => setContextMenu(null);
    document.addEventListener("click", handleClick);
    return () => document.removeEventListener("click", handleClick);
  }, []);

  return (
    <div className={cn("rounded-lg flex flex-col", className)}>
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
                      onCheckedChange={handleSelectAll}
                      aria-label="Select all items"
                      disabled={isLoading || items.length === 0}
                    />
                  </div>
                </TableHead>
              )}

              {/* Data columns */}
              {visibleColumnConfigs.map((column) => (
                <TableHead key={column.key} className={cn("whitespace-nowrap text-foreground font-bold uppercase text-xs p-0 bg-muted !border-r-0", column.className)}>
                  {column.sortable ? (
                    <button
                      onClick={() => toggleSort(column.key)}
                      className={cn(
                        "flex items-center gap-1 w-full h-full min-h-[2.5rem] px-4 py-2 hover:bg-muted/80 transition-colors cursor-pointer text-left border-0 bg-transparent",
                        column.align === "center" && "justify-center",
                        column.align === "right" && "justify-end",
                        column.align === "left" && "justify-start",
                        !column.align && "justify-start",
                      )}
                      disabled={isLoading || items.length === 0}
                    >
                      <TruncatedTextWithTooltip text={column.header} />
                      <div className="inline-flex items-center ml-1">
                        {getSortDirection(column.key) === null && <IconSelector className="h-4 w-4 text-muted-foreground" />}
                        {getSortDirection(column.key) === "asc" && <IconChevronUp className="h-4 w-4 text-foreground" />}
                        {getSortDirection(column.key) === "desc" && <IconChevronDown className="h-4 w-4 text-foreground" />}
                        {getSortOrder(column.key) !== null && sortConfigs.length > 1 && <span className="text-xs ml-0.5">{getSortOrder(column.key)! + 1}</span>}
                      </div>
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

              {/* Scrollbar spacer */}
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
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={visibleColumnConfigs.length + 1} className="text-center py-8">
                  <div className="flex items-center justify-center">
                    <IconRefresh className="h-4 w-4 mr-2 animate-spin" />
                    Carregando...
                  </div>
                </TableCell>
              </TableRow>
            ) : error ? (
              <TableRow>
                <TableCell colSpan={visibleColumnConfigs.length + 1} className="p-0">
                  <div className="flex flex-col items-center justify-center p-8 text-center text-destructive">
                    <IconAlertTriangle className="h-8 w-8 mb-4" />
                    <div className="text-lg font-medium mb-2">Não foi possível carregar os EPIs</div>
                    <div className="text-sm text-muted-foreground">Tente novamente mais tarde.</div>
                  </div>
                </TableCell>
              </TableRow>
            ) : items.length === 0 ? (
              <TableRow>
                <TableCell colSpan={visibleColumnConfigs.length + 1} className="p-0">
                  <div className="flex flex-col items-center justify-center p-8 text-center text-muted-foreground">
                    <IconShield className="h-12 w-12 text-muted-foreground/50 mb-4" />
                    <div className="text-lg font-medium mb-2">Nenhum EPI encontrado</div>
                    {filters && Object.keys(filters).length > 1 && <div className="text-sm">Ajuste os filtros para ver mais resultados.</div>}
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              items.map((item, index) => {
                const itemIsSelected = isSelected(item.id);

                return (
                  <TableRow
                    key={item.id}
                    data-state={itemIsSelected ? "selected" : undefined}
                    className={cn(
                      "cursor-pointer transition-colors border-b border-border",
                      index % 2 === 1 && "bg-muted/10",
                      "hover:bg-muted/20",
                      itemIsSelected && "bg-muted/30 hover:bg-muted/40",
                    )}
                    onClick={() => handleRowClick(item)}
                    onContextMenu={(e) => handleContextMenu(e, item)}
                  >
                    {/* Selection checkbox */}
                    {showInteractive && (
                      <TableCell className={cn(TABLE_LAYOUT.checkbox.className, "p-0 !border-r-0")}>
                        <div className="flex items-center justify-center h-full w-full px-2 py-2" onClick={(e) => { e.stopPropagation(); handleSelectItem(item.id, e); }}>
                          <Checkbox checked={itemIsSelected} onCheckedChange={() => handleSelectItem(item.id)} aria-label={`Select ${item.name}`} data-checkbox />
                        </div>
                      </TableCell>
                    )}

                    {/* Data columns */}
                    {visibleColumnConfigs.map((column) => (
                      <TableCell key={column.key} className={cn(column.className, "p-0 !border-r-0")}>
                        <div
                          className={cn(
                            "px-4 py-2",
                            column.align === "center" && "flex justify-center",
                            column.align === "right" && "text-right flex justify-end",
                            column.align === "left" && "text-left",
                            !column.align && "text-left",
                          )}
                        >
                          {column.accessor(item)}
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
        <SimplePaginationAdvanced
          currentPage={page} // SimplePaginationAdvanced expects 0-based, page is 1-based
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
        <DropdownMenuContent
          style={{
            position: "fixed",
            left: contextMenu?.x,
            top: contextMenu?.y,
          }}
          className="w-56"
          onCloseAutoFocus={(e) => e.preventDefault()}
        >
          {contextMenu?.isBulk && <div className="px-2 py-1.5 text-sm font-semibold text-muted-foreground">{contextMenu.items.length} EPIs selecionados</div>}

          <DropdownMenuItem
            onClick={() => {
              if (contextMenu?.items && !contextMenu.isBulk) {
                navigate(routes.inventory.ppe.details(contextMenu.items[0].id));
              }
              setContextMenu(null);
            }}
            disabled={contextMenu?.isBulk}
          >
            <IconEye className="mr-2 h-4 w-4" />
            Visualizar
          </DropdownMenuItem>

          {canEdit && (
            <DropdownMenuItem onClick={handleEdit}>
              <IconEdit className="mr-2 h-4 w-4" />
              {contextMenu?.isBulk && contextMenu.items.length > 1 ? "Editar em lote" : "Editar"}
            </DropdownMenuItem>
          )}

          {canEdit && contextMenu?.items.some((item) => !item.isActive) && (
            <DropdownMenuItem onClick={handleActivate} className="text-green-700">
              <IconCheck className="mr-2 h-4 w-4" />
              {contextMenu?.isBulk && contextMenu.items.length > 1 ? "Ativar selecionados" : "Ativar"}
            </DropdownMenuItem>
          )}

          {canEdit && contextMenu?.items.some((item) => item.isActive) && (
            <DropdownMenuItem onClick={handleDeactivate} className="text-destructive">
              <IconX className="mr-2 h-4 w-4" />
              {contextMenu?.isBulk && contextMenu.items.length > 1 ? "Desativar selecionados" : "Desativar"}
            </DropdownMenuItem>
          )}

          {(canEdit || canDelete) && <DropdownMenuSeparator />}

          {canDelete && (
            <DropdownMenuItem
              onClick={() => {
                if (contextMenu?.items) {
                  setDeleteDialog({
                    items: contextMenu.items,
                    isBulk: contextMenu.isBulk,
                  });
                }
                setContextMenu(null);
              }}
              className="text-destructive focus:text-destructive"
            >
              <IconTrash className="mr-2 h-4 w-4" />
              {contextMenu?.isBulk && contextMenu.items.length > 1 ? "Excluir em lote" : "Excluir"}
            </DropdownMenuItem>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!deleteDialog} onOpenChange={(open) => !open && setDeleteDialog(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar exclusão</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteDialog?.isBulk
                ? `Tem certeza que deseja excluir ${deleteDialog.items.length} EPIs? Esta ação não pode ser desfeita.`
                : `Tem certeza que deseja excluir "${deleteDialog?.items[0]?.name}"? Esta ação não pode ser desfeita.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                // TODO: Implement delete functionality
                setDeleteDialog(null);
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
