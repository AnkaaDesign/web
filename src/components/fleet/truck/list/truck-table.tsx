import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import type { Truck } from "../../../../types";
import { routes } from "../../../../constants";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { IconChevronUp, IconChevronDown, IconEdit, IconTrash, IconSelector, IconEye } from "@tabler/icons-react";
import { TruckListSkeleton } from "./truck-list-skeleton";
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
import { useTruckMutations, useTruckBatchMutations, useTrucks } from "../../../../hooks";
import { SimplePaginationAdvanced } from "@/components/ui/pagination-advanced";
import type { TruckGetManyFormData } from "../../../../schemas";
import { useScrollbarWidth } from "@/hooks/use-scrollbar-width";
import { TABLE_LAYOUT } from "@/components/ui/table-constants";
import { TruncatedTextWithTooltip } from "@/components/ui/truncated-text-with-tooltip";
import { createTruckColumns } from "./truck-table-columns";
import type { TruckColumn } from "./types";
import { useTableState, convertSortConfigsToOrderBy } from "@/hooks/use-table-state";

interface TruckTableProps {
  visibleColumns: Set<string>;
  className?: string;
  onEdit?: (trucks: Truck[]) => void;
  onDelete?: (trucks: Truck[]) => void;
  filters?: Partial<TruckGetManyFormData>;
  onDataChange?: (data: { trucks: Truck[]; totalRecords: number }) => void;
}

export function TruckTable({ visibleColumns, className, onEdit, onDelete, filters = {}, onDataChange }: TruckTableProps) {
  const navigate = useNavigate();
  const { delete: deleteTruck } = useTruckMutations();
  const { batchDelete } = useTruckBatchMutations();

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
        },
      },
      garage: true,
      _count: {
        select: {
          task: true,
        },
      },
    }),
    [],
  );

  // Memoize query parameters to prevent infinite re-renders
  const queryParams = React.useMemo(() => {
    console.log("[TruckTable] Building queryParams with filters:", filters);

    const params = {
      // When showSelectedOnly is true, don't apply filters
      ...(showSelectedOnly ? {} : filters),
      page: page + 1, // Convert 0-based to 1-based for API
      limit: pageSize,
      include: includeConfig,
      // Convert sortConfigs to orderBy format for API
      ...(sortConfigs.length > 0 && {
        orderBy: convertSortConfigsToOrderBy(sortConfigs),
      }),
      // When showSelectedOnly is true, only show selected items
      ...(showSelectedOnly &&
        selectedIds.length > 0 && {
          where: {
            id: { in: selectedIds },
          },
        }),
    };

    console.log("[TruckTable] Final queryParams:", params);
    return params;
  }, [filters, page, pageSize, includeConfig, sortConfigs, showSelectedOnly, selectedIds]);

  // Use the trucks hook with memoized parameters
  const { data: response, isLoading, error } = useTrucks(queryParams);

  const trucks = response?.data || [];
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
      const dataKey = trucks.length > 0 ? `${totalRecords}-${trucks.map((truck) => truck.id).join(",")}` : `empty-${totalRecords}`;

      // Only notify if this exact data hasn't been notified yet
      if (dataKey !== lastNotifiedDataRef.current) {
        lastNotifiedDataRef.current = dataKey;
        onDataChange({ trucks, totalRecords });
      }
    }
  }, [trucks, totalRecords, onDataChange]);

  // Context menu state
  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    trucks: Truck[];
    isBulk: boolean;
  } | null>(null);

  // Delete confirmation dialog state
  const [deleteDialog, setDeleteDialog] = useState<{
    items: Truck[];
    isBulk: boolean;
  } | null>(null);

  // Define all available columns
  const allColumns: TruckColumn[] = createTruckColumns();

  // Close context menu on outside click
  React.useEffect(() => {
    const handleClickOutside = () => setContextMenu(null);
    if (contextMenu) {
      document.addEventListener("click", handleClickOutside);
      return () => document.removeEventListener("click", handleClickOutside);
    }
  }, [contextMenu]);

  // Filter columns based on visibility
  const displayColumns = allColumns.filter((column) => visibleColumns.has(column.id));

  // Handle single truck row right-click
  const handleRowContextMenu = (e: React.MouseEvent, truck: Truck) => {
    e.preventDefault();
    setContextMenu({
      x: e.clientX,
      y: e.clientY,
      trucks: [truck],
      isBulk: false,
    });
  };

  // Handle bulk action context menu (from header selection)
  const handleBulkContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    if (selectedIds.length === 0) return;

    const selectedTrucks = trucks.filter((truck) => selectedIds.includes(truck.id));
    setContextMenu({
      x: e.clientX,
      y: e.clientY,
      trucks: selectedTrucks,
      isBulk: true,
    });
  };

  // Single truck deletion
  const handleSingleDelete = (truck: Truck) => {
    setDeleteDialog({
      items: [truck],
      isBulk: false,
    });
    setContextMenu(null);
  };

  // Bulk deletion handler
  const handleBulkDelete = (trucks: Truck[]) => {
    setDeleteDialog({
      items: trucks,
      isBulk: true,
    });
    setContextMenu(null);
  };

  // Confirm delete
  const confirmDelete = async () => {
    if (!deleteDialog) return;

    try {
      if (deleteDialog.isBulk && deleteDialog.items.length > 1) {
        // Bulk delete
        if (onDelete) {
          onDelete(deleteDialog.items);
        } else {
          const ids = deleteDialog.items.map((truck) => truck.id);
          await batchDelete({ truckIds: ids });
          removeFromSelection(ids);
        }
      } else {
        // Single delete
        const truck = deleteDialog.items[0];
        await deleteTruck({ id: truck.id });
        removeFromSelection(truck.id);
      }
    } catch (error) {
      console.error("Error deleting truck(s):", error);
    } finally {
      setDeleteDialog(null);
    }
  };

  // Sort header renderer
  const renderSortHeader = (column: TruckColumn) => {
    if (!column.sortable) {
      return <span>{column.label}</span>;
    }

    const sortDirection = getSortDirection(column.id);
    const sortOrder = getSortOrder(column.id);

    return (
      <Button variant="ghost" className="h-auto p-0 font-medium hover:bg-transparent flex items-center gap-1 justify-start w-full" onClick={() => toggleSort(column.id)}>
        <span className="truncate">{column.label}</span>
        <div className="flex items-center">
          {sortDirection === "asc" ? (
            <IconChevronUp className="h-3 w-3 text-muted-foreground" />
          ) : sortDirection === "desc" ? (
            <IconChevronDown className="h-3 w-3 text-muted-foreground" />
          ) : (
            <IconSelector className="h-3 w-3 text-muted-foreground" />
          )}
          {sortOrder !== undefined && <span className="text-xs text-muted-foreground ml-1 min-w-[1ch]">{sortOrder + 1}</span>}
        </div>
      </Button>
    );
  };

  if (isLoading) {
    return <TruckListSkeleton />;
  }

  if (error) {
    return (
      <div className="p-8 text-center">
        <p className="text-destructive">Erro ao carregar caminhões: {error.message}</p>
        <Button variant="outline" className="mt-4" onClick={() => window.location.reload()}>
          Tentar Novamente
        </Button>
      </div>
    );
  }

  return (
    <div className={cn("flex flex-col h-full bg-background", className)}>
      {/* Table container with custom scrollbars */}
      <div className="flex-1 overflow-auto border rounded-md bg-background">
        <Table>
          <TableHeader className="sticky top-0 z-10 bg-background">
            <TableRow className="hover:bg-transparent border-b">
              {/* Selection column */}
              <TableHead className={cn(TABLE_LAYOUT.firstColumn.className, "pr-0")}>
                <div className="flex items-center justify-center">
                  <Checkbox
                    checked={isAllSelected(trucks.map((t) => t.id))}
                    indeterminate={isPartiallySelected(trucks.map((t) => t.id))}
                    onCheckedChange={() => toggleSelectAll(trucks.map((t) => t.id))}
                    onContextMenu={handleBulkContextMenu}
                    aria-label="Selecionar todos os caminhões"
                  />
                </div>
              </TableHead>
              {/* Data columns */}
              {displayColumns.map((column, index) => (
                <TableHead
                  key={column.id}
                  className={cn(
                    "text-left font-medium border-l border-border/40",
                    column.width && `w-[${column.width}]`,
                    column.minWidth && `min-w-[${column.minWidth}]`,
                    column.maxWidth && `max-w-[${column.maxWidth}]`,
                    index === displayColumns.length - 1 && !isOverlay && `pr-[${scrollbarWidth}px]`,
                  )}
                  style={{
                    width: column.width,
                    minWidth: column.minWidth,
                    maxWidth: column.maxWidth,
                  }}
                >
                  {renderSortHeader(column)}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {trucks.length === 0 ? (
              <TableRow>
                <TableCell colSpan={displayColumns.length + 1} className="h-24 text-center text-muted-foreground">
                  {showSelectedOnly ? "Nenhum caminhão selecionado" : "Nenhum caminhão encontrado"}
                </TableCell>
              </TableRow>
            ) : (
              trucks.map((truck) => (
                <TableRow
                  key={truck.id}
                  className={cn("hover:bg-muted/50 cursor-pointer transition-colors", isSelected(truck.id) && "bg-muted/30")}
                  onContextMenu={(e) => handleRowContextMenu(e, truck)}
                  onClick={() => navigate(routes.production.trucks?.details?.(truck.id) || `/production/trucks/details/${truck.id}`)}
                >
                  {/* Selection column */}
                  <TableCell className={cn(TABLE_LAYOUT.firstColumn.className, "pr-0")}>
                    <div className="flex items-center justify-center">
                      <Checkbox
                        checked={isSelected(truck.id)}
                        onCheckedChange={(checked) => {
                          toggleSelection(truck.id, checked as boolean);
                        }}
                        onClick={(e) => e.stopPropagation()}
                        aria-label={`Selecionar caminhão ${truck.task?.plate || truck.plate}`}
                      />
                    </div>
                  </TableCell>
                  {/* Data columns */}
                  {displayColumns.map((column, index) => (
                    <TableCell
                      key={column.id}
                      className={cn(
                        "border-l border-border/40 text-sm",
                        column.align === "center" && "text-center",
                        column.align === "right" && "text-right",
                        index === displayColumns.length - 1 && !isOverlay && `pr-[${scrollbarWidth}px]`,
                      )}
                      style={{
                        width: column.width,
                        minWidth: column.minWidth,
                        maxWidth: column.maxWidth,
                      }}
                    >
                      {column.render(truck)}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Context Menu */}
      {contextMenu && (
        <DropdownMenu open={true} onOpenChange={() => setContextMenu(null)}>
          <DropdownMenuContent
            className="w-48"
            style={{
              position: "fixed",
              left: contextMenu.x,
              top: contextMenu.y,
              zIndex: 50,
            }}
          >
            {contextMenu.trucks.length === 1 && (
              <>
                <DropdownMenuItem
                  onClick={() => {
                    navigate(routes.production.trucks?.details?.(contextMenu.trucks[0].id) || `/production/trucks/details/${contextMenu.trucks[0].id}`);
                    setContextMenu(null);
                  }}
                  className="flex items-center gap-2"
                >
                  <IconEye className="h-4 w-4" />
                  Ver Detalhes
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => {
                    if (onEdit) onEdit(contextMenu.trucks);
                    setContextMenu(null);
                  }}
                  className="flex items-center gap-2"
                >
                  <IconEdit className="h-4 w-4" />
                  Editar
                </DropdownMenuItem>
                <DropdownMenuSeparator />
              </>
            )}
            {contextMenu.trucks.length > 1 && (
              <>
                <DropdownMenuItem
                  onClick={() => {
                    if (onEdit) onEdit(contextMenu.trucks);
                    setContextMenu(null);
                  }}
                  className="flex items-center gap-2"
                >
                  <IconEdit className="h-4 w-4" />
                  Editar em Lote ({contextMenu.trucks.length})
                </DropdownMenuItem>
                <DropdownMenuSeparator />
              </>
            )}
            <DropdownMenuItem
              onClick={() => {
                if (contextMenu.trucks.length === 1) {
                  handleSingleDelete(contextMenu.trucks[0]);
                } else {
                  handleBulkDelete(contextMenu.trucks);
                }
              }}
              className="flex items-center gap-2 text-destructive focus:text-destructive"
            >
              <IconTrash className="h-4 w-4" />
              {contextMenu.trucks.length === 1 ? "Deletar" : `Deletar (${contextMenu.trucks.length})`}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      )}

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!deleteDialog} onOpenChange={(open) => !open && setDeleteDialog(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar exclusão</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteDialog?.isBulk && deleteDialog.items.length > 1
                ? `Tem certeza que deseja deletar ${deleteDialog.items.length} caminhões? Esta ação não pode ser desfeita.`
                : `Tem certeza que deseja deletar o caminhão "${deleteDialog?.items[0]?.plate || deleteDialog?.items[0]?.task?.plate}"? Esta ação não pode ser desfeita.`}
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

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex justify-between items-center pt-4 border-t bg-background">
          <div className="text-sm text-muted-foreground">
            {selectionCount > 0 ? (
              <span>
                {selectionCount} de {totalRecords} caminhões selecionados
              </span>
            ) : (
              <span>
                {totalRecords} caminhão{totalRecords !== 1 ? "ões" : ""} encontrado{totalRecords !== 1 ? "s" : ""}
              </span>
            )}
          </div>
          <SimplePaginationAdvanced
            currentPage={page}
            totalPages={totalPages}
            onPageChange={setPage}
            pageSize={pageSize}
            onPageSizeChange={setPageSize}
            totalItems={totalRecords}
          />
        </div>
      )}
    </div>
  );
}
