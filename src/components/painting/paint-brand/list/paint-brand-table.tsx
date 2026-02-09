import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import type { PaintBrand } from "../../../../types";
import { routes } from "../../../../constants";
import { useAuth } from "../../../../hooks/common/use-auth";
import { canEditPaints, canDeletePaints, shouldShowInteractiveElements } from "@/utils/permissions/entity-permissions";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import { IconChevronUp, IconChevronDown, IconSelector, IconEdit, IconTrash, IconEye, IconAlertTriangle, IconTag } from "@tabler/icons-react";
import { cn } from "@/lib/utils";
import { DropdownMenu, DropdownMenuItem, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import { PositionedDropdownMenuContent } from "@/components/ui/positioned-dropdown-menu";
import { usePaintBrandMutations, usePaintBrandBatchMutations, usePaintBrands } from "../../../../hooks";
import { SimplePaginationAdvanced } from "@/components/ui/pagination-advanced";
import type { PaintBrandGetManyFormData } from "../../../../schemas";
import { useScrollbarWidth } from "@/hooks/common/use-scrollbar-width";
import { PaintBrandTableSkeleton } from "./paint-brand-table-skeleton";
import { TABLE_LAYOUT } from "@/components/ui/table-constants";
import { TruncatedTextWithTooltip } from "@/components/ui/truncated-text-with-tooltip";
import { useTableState, convertSortConfigsToOrderBy } from "@/hooks/common/use-table-state";
import { createPaintBrandColumns } from "./paint-brand-table-columns";
import type { PaintBrandColumn } from "./paint-brand-table-columns";
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

interface PaintBrandTableProps {
  visibleColumns: Set<string>;
  className?: string;
  onEdit?: (paintBrands: PaintBrand[]) => void;
  onDelete?: (paintBrands: PaintBrand[]) => void;
  filters?: Partial<PaintBrandGetManyFormData>;
  onDataChange?: (data: { paintBrands: PaintBrand[]; totalRecords: number }) => void;
}

export function PaintBrandTable({ visibleColumns, className, onEdit, onDelete, filters = {}, onDataChange }: PaintBrandTableProps) {
  const navigate = useNavigate();
  const { delete: deletePaintBrand } = usePaintBrandMutations();
  const { batchDelete } = usePaintBrandBatchMutations();

  // Permission checks
  const { user } = useAuth();
  const canEdit = user ? canEditPaints(user) : false;
  const canDelete = user ? canDeletePaints(user) : false;
  const showInteractive = user ? shouldShowInteractiveElements(user, 'paintBrand') : false;

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
  });

  // Context menu state
  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    paintBrands: PaintBrand[];
    isBulk: boolean;
  } | null>(null);

  // Use viewport boundary checking hook
  
  // Delete confirmation dialog state
  const [deleteDialog, setDeleteDialog] = useState<{ items: PaintBrand[]; isBulk: boolean } | null>(null);

  // Memoize include configuration with correct syntax for counts
  const includeConfig = React.useMemo(
    () => ({
      _count: {
        select: {
          paints: true,
          componentItems: true,
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

  // Use the paint brands hook
  const { data: response, isLoading, error } = usePaintBrands(queryParams);

  const paintBrands = response?.data || [];
  const totalPages = response?.meta ? Math.ceil(response.meta.totalRecords / pageSize) : 1;
  const totalRecords = response?.meta?.totalRecords || 0;

  // Notify parent component of data changes
  // Use a ref to track if we've already notified for this exact data
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
      const dataKey = paintBrands.length > 0 ? `${totalRecords}-${paintBrands.map((pb) => pb.id).join(",")}` : `empty-${totalRecords}`;

      // Only notify if this exact data hasn't been notified yet
      if (dataKey !== lastNotifiedDataRef.current) {
        lastNotifiedDataRef.current = dataKey;
        onDataChange({ paintBrands, totalRecords });
      }
    }
  }, [paintBrands, totalRecords, onDataChange]);

  // Define all available columns
  const allColumns: PaintBrandColumn[] = createPaintBrandColumns();

  // Filter columns based on visibility
  const columns = allColumns.filter((col) => visibleColumns.has(col.key));

  // Get current page paint brand IDs for selection
  const currentPagePaintBrandIds = React.useMemo(() => {
    return paintBrands.map((pb) => pb.id);
  }, [paintBrands]);

  // Selection handlers
  const allSelected = isAllSelected(currentPagePaintBrandIds);
  const partiallySelected = isPartiallySelected(currentPagePaintBrandIds);

  const handleSelectAll = () => {
    toggleSelectAll(currentPagePaintBrandIds);
  };

  const handleSelectPaintBrand = (paintBrandId: string, event?: React.MouseEvent) => {
    handleRowClickSelection(paintBrandId, currentPagePaintBrandIds, event?.shiftKey || false);
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
  const handleContextMenu = (e: React.MouseEvent, paintBrand: PaintBrand) => {
    e.preventDefault();
    e.stopPropagation();

    // Check if clicked paint brand is part of selection
    const isPaintBrandSelected = isSelected(paintBrand.id);
    const hasSelection = selectionCount > 0;

    if (hasSelection && isPaintBrandSelected) {
      // Show bulk actions for all selected paint brands
      const selectedPaintBrandsList = paintBrands.filter((pb) => isSelected(pb.id));
      setContextMenu({
        x: e.clientX,
        y: e.clientY,
        paintBrands: selectedPaintBrandsList,
        isBulk: true,
      });
    } else {
      // Show actions for just the clicked paint brand
      setContextMenu({
        x: e.clientX,
        y: e.clientY,
        paintBrands: [paintBrand],
        isBulk: false,
      });
    }
  };

  const handleViewDetails = () => {
    if (contextMenu && !contextMenu.isBulk) {
      navigate(routes.painting.paintBrands.details(contextMenu.paintBrands[0].id));
      setContextMenu(null);
    }
  };

  const handleEdit = () => {
    if (contextMenu) {
      if (contextMenu.isBulk && contextMenu.paintBrands.length > 1) {
        // Bulk edit
        if (onEdit) {
          onEdit(contextMenu.paintBrands);
        }
      } else {
        // Single edit
        navigate(routes.painting.paintBrands.edit(contextMenu.paintBrands[0].id));
      }
      setContextMenu(null);
    }
  };

  const handleDelete = async () => {
    if (contextMenu) {
      // Check for linked paints before opening dialog
      const hasLinkedPaints = contextMenu.paintBrands.some((pb) => pb._count?.paints && pb._count.paints > 0);
      if (hasLinkedPaints) {
        return;
      }

      setDeleteDialog({ items: contextMenu.paintBrands, isBulk: contextMenu.isBulk && contextMenu.paintBrands.length > 1 });
      setContextMenu(null);
    }
  };

  const confirmDelete = async () => {
    if (deleteDialog) {
      try {
        if (deleteDialog.isBulk) {
          // Get IDs to remove from selection
          const idsToRemove = deleteDialog.items.map((pb) => pb.id);

          // Bulk delete
          if (onDelete) {
            onDelete(deleteDialog.items);
            // Remove deleted items from selection
            removeFromSelection(idsToRemove);
          } else {
            // Fallback to batch API
            await batchDelete({ paintBrandIds: idsToRemove });
            // Remove deleted items from selection
            removeFromSelection(idsToRemove);
          }
        } else {
          // Single delete
          const paintBrand = deleteDialog.items[0];

          if (onDelete) {
            onDelete(deleteDialog.items);
            // Remove deleted item from selection
            removeFromSelection([paintBrand.id]);
          } else {
            await deletePaintBrand(paintBrand.id);
            // Remove deleted item from selection
            removeFromSelection([paintBrand.id]);
          }
        }
      } catch (error) {
        // Error is handled by the API client with detailed message
        if (process.env.NODE_ENV !== 'production') {
          console.error("Error deleting paint brand(s):", error);
        }
      }
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
    return <PaintBrandTableSkeleton />;
  }

  if (error) {
    return (
      <div className="border border-border rounded-lg p-8 text-center text-destructive bg-card">
        <IconAlertTriangle className="h-8 w-8 mx-auto mb-4" />
        <div className="text-lg font-medium mb-2">Erro ao carregar marcas de tinta</div>
        <div className="text-sm">Tente novamente mais tarde.</div>
      </div>
    );
  }

  // Remove the early return for empty data - always show table structure

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
                      onCheckedChange={handleSelectAll}
                      aria-label="Select all paint brands"
                      disabled={isLoading || paintBrands.length === 0}
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
                    >
                      {typeof column.header === "string" ? <TruncatedTextWithTooltip text={column.header} /> : column.header}
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
                      {typeof column.header === "string" ? <TruncatedTextWithTooltip text={column.header} /> : column.header}
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
            {paintBrands.length === 0 ? (
              <TableRow>
                <TableCell colSpan={columns.length + 1} className="p-0">
                  <div className="flex flex-col items-center justify-center p-8 text-center text-muted-foreground">
                    <IconTag className="h-12 w-12 text-muted-foreground/50 mb-4" />
                    <div className="text-lg font-medium mb-2">Nenhuma marca de tinta encontrada</div>
                    <div className="text-sm">Ajuste os filtros para ver mais resultados.</div>
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              paintBrands.map((paintBrand, index) => {
                const paintBrandIsSelected = isSelected(paintBrand.id);

                return (
                  <TableRow
                    key={paintBrand.id}
                    data-state={paintBrandIsSelected ? "selected" : undefined}
                    className={cn(
                      "cursor-pointer transition-colors border-b border-border",
                      // Alternating row colors
                      index % 2 === 1 && "bg-muted/10",
                      // Hover state that works with alternating colors
                      "hover:bg-muted/20",
                      // Selected state overrides alternating colors
                      paintBrandIsSelected && "bg-muted/30 hover:bg-muted/40",
                    )}
                    onClick={() => navigate(routes.painting.paintBrands.details(paintBrand.id))}
                    onContextMenu={(e) => handleContextMenu(e, paintBrand)}
                  >
                    {/* Selection checkbox */}
                    {showInteractive && (
                      <TableCell className={cn(TABLE_LAYOUT.checkbox.className, "p-0 !border-r-0")}>
                        <div
                          className="flex items-center justify-center h-full w-full px-2 py-2"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleSelectPaintBrand(paintBrand.id, e);
                          }}
                        >
                          <Checkbox
                            checked={paintBrandIsSelected}
                            aria-label={`Select ${paintBrand.name}`}
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
                        <div className="px-4 py-2">{column.accessor(paintBrand)}</div>
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
          {contextMenu?.isBulk && <div className="px-2 py-1.5 text-sm font-semibold text-muted-foreground">{contextMenu.paintBrands.length} marcas de tinta selecionadas</div>}

          {!contextMenu?.isBulk && (
            <DropdownMenuItem onClick={handleViewDetails}>
              <IconEye className="mr-2 h-4 w-4" />
              Ver Detalhes
            </DropdownMenuItem>
          )}

          {canEdit && (
            <DropdownMenuItem onClick={handleEdit}>
              <IconEdit className="mr-2 h-4 w-4" />
              {contextMenu?.isBulk && contextMenu.paintBrands.length > 1 ? "Editar em lote" : "Editar"}
            </DropdownMenuItem>
          )}

          {(canEdit || canDelete) && <DropdownMenuSeparator />}

          {canDelete && (
            <DropdownMenuItem onClick={handleDelete} className="text-destructive">
              <IconTrash className="mr-2 h-4 w-4" />
              {contextMenu?.isBulk && contextMenu.paintBrands.length > 1 ? "Excluir selecionados" : "Excluir"}
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
              {deleteDialog?.isBulk
                ? `Tem certeza que deseja deletar ${deleteDialog.items.length} marca${deleteDialog.items.length > 1 ? "s" : ""} de tinta? Esta ação não pode ser desfeita.`
                : `Tem certeza que deseja deletar a marca "${deleteDialog?.items[0]?.name}"? Esta ação não pode ser desfeita.`}
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
