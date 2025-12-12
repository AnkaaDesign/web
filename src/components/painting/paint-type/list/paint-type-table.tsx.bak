import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import type { PaintType } from "../../../../types";
import { routes } from "../../../../constants";
import { useAuth } from "../../../../hooks/useAuth";
import { canEditPaints, canDeletePaints, shouldShowInteractiveElements } from "@/utils/permissions/entity-permissions";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import { IconChevronUp, IconChevronDown, IconSelector, IconEdit, IconTrash, IconEye, IconAlertTriangle, IconPaint } from "@tabler/icons-react";
import { cn } from "@/lib/utils";
import { DropdownMenu, DropdownMenuItem, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import { PositionedDropdownMenuContent } from "@/components/ui/positioned-dropdown-menu";
import { usePaintTypeMutations, usePaintTypeBatchMutations, usePaintTypes } from "../../../../hooks";
import { SimplePaginationAdvanced } from "@/components/ui/pagination-advanced";
import type { PaintTypeGetManyFormData } from "../../../../schemas";
import { useScrollbarWidth } from "@/hooks/use-scrollbar-width";
import { PaintTypeTableSkeleton } from "./paint-type-table-skeleton";
import { TABLE_LAYOUT } from "@/components/ui/table-constants";
import { TruncatedTextWithTooltip } from "@/components/ui/truncated-text-with-tooltip";
import { useTableState, convertSortConfigsToOrderBy } from "@/hooks/use-table-state";
import { createPaintTypeColumns } from "./paint-type-table-columns";
import type { PaintTypeColumn } from "./paint-type-table-columns";
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

interface PaintTypeTableProps {
  visibleColumns: Set<string>;
  className?: string;
  onEdit?: (paintTypes: PaintType[]) => void;
  onDelete?: (paintTypes: PaintType[]) => void;
  filters?: Partial<PaintTypeGetManyFormData>;
  onDataChange?: (data: { paintTypes: PaintType[]; totalRecords: number }) => void;
}

export function PaintTypeTable({ visibleColumns, className, onEdit, onDelete, filters = {}, onDataChange }: PaintTypeTableProps) {
  const navigate = useNavigate();
  const { delete: deletePaintType } = usePaintTypeMutations();
  const { batchDelete } = usePaintTypeBatchMutations();

  // Permission checks
  const { user, isLoading: isAuthLoading } = useAuth();
  const canEdit = user ? canEditPaints(user) : false;
  const canDelete = user ? canDeletePaints(user) : false;
  const showInteractive = user ? shouldShowInteractiveElements(user, 'paintType') : false;

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
  } = useTableState({
    defaultPageSize: 40,
    resetSelectionOnPageChange: false,
  });

  // Context menu state
  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    paintTypes: PaintType[];
    isBulk: boolean;
  } | null>(null);

  // Use viewport boundary checking hook
  
  // Delete confirmation dialog state
  const [deleteDialog, setDeleteDialog] = useState<{ items: PaintType[]; isBulk: boolean } | null>(null);

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

  // Use the paint types hook
  const { data: response, isLoading, error } = usePaintTypes(queryParams);

  const paintTypes = response?.data || [];
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
      const dataKey = paintTypes.length > 0 ? `${totalRecords}-${paintTypes.map((pt) => pt.id).join(",")}` : `empty-${totalRecords}`;

      // Only notify if this exact data hasn't been notified yet
      if (dataKey !== lastNotifiedDataRef.current) {
        lastNotifiedDataRef.current = dataKey;
        onDataChange({ paintTypes, totalRecords });
      }
    }
  }, [paintTypes, totalRecords, onDataChange]);

  // Define all available columns (memoized to prevent re-creation)
  const allColumns: PaintTypeColumn[] = React.useMemo(() => createPaintTypeColumns(), []);

  // Filter columns based on visibility (memoized)
  const columns = React.useMemo(() => allColumns.filter((col) => visibleColumns.has(col.key)), [allColumns, visibleColumns]);

  // Get current page paint type IDs for selection
  const currentPagePaintTypeIds = React.useMemo(() => {
    return paintTypes.map((pt) => pt.id);
  }, [paintTypes]);

  // Selection handlers
  const allSelected = isAllSelected(currentPagePaintTypeIds);
  const partiallySelected = isPartiallySelected(currentPagePaintTypeIds);

  const handleSelectAll = () => {
    toggleSelectAll(currentPagePaintTypeIds);
  };

  const handleSelectPaintType = (paintTypeId: string) => {
    toggleSelection(paintTypeId);
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
  const handleContextMenu = (e: React.MouseEvent, paintType: PaintType) => {
    e.preventDefault();
    e.stopPropagation();

    // Check if clicked paint type is part of selection
    const isPaintTypeSelected = isSelected(paintType.id);
    const hasSelection = selectionCount > 0;

    if (hasSelection && isPaintTypeSelected) {
      // Show bulk actions for all selected paint types
      const selectedPaintTypesList = paintTypes.filter((pt) => isSelected(pt.id));
      setContextMenu({
        x: e.clientX,
        y: e.clientY,
        paintTypes: selectedPaintTypesList,
        isBulk: true,
      });
    } else {
      // Show actions for just the clicked paint type
      setContextMenu({
        x: e.clientX,
        y: e.clientY,
        paintTypes: [paintType],
        isBulk: false,
      });
    }
  };

  const handleViewDetails = () => {
    if (contextMenu && !contextMenu.isBulk) {
      navigate(routes.painting.paintTypes.details(contextMenu.paintTypes[0].id));
      setContextMenu(null);
    }
  };

  const handleEdit = () => {
    if (contextMenu) {
      if (contextMenu.isBulk && contextMenu.paintTypes.length > 1) {
        // Bulk edit
        if (onEdit) {
          onEdit(contextMenu.paintTypes);
        }
      } else {
        // Single edit
        navigate(routes.painting.paintTypes.edit(contextMenu.paintTypes[0].id));
      }
      setContextMenu(null);
    }
  };

  const handleDelete = async () => {
    if (contextMenu) {
      // Check for linked paints before opening dialog
      const hasLinkedPaints = contextMenu.paintTypes.some((pt) => pt._count?.paints && pt._count.paints > 0);
      if (hasLinkedPaints) {
        return;
      }

      setDeleteDialog({ items: contextMenu.paintTypes, isBulk: contextMenu.isBulk && contextMenu.paintTypes.length > 1 });
      setContextMenu(null);
    }
  };

  const confirmDelete = async () => {
    if (deleteDialog) {
      try {
        if (deleteDialog.isBulk) {
          // Get IDs to remove from selection
          const idsToRemove = deleteDialog.items.map((pt) => pt.id);

          // Bulk delete
          if (onDelete) {
            onDelete(deleteDialog.items);
            // Remove deleted items from selection
            removeFromSelection(idsToRemove);
          } else {
            // Fallback to batch API
            await batchDelete({ paintTypeIds: idsToRemove });
            // Remove deleted items from selection
            removeFromSelection(idsToRemove);
          }
        } else {
          // Single delete
          const paintType = deleteDialog.items[0];

          if (onDelete) {
            onDelete(deleteDialog.items);
            // Remove deleted item from selection
            removeFromSelection([paintType.id]);
          } else {
            await deletePaintType(paintType.id);
            // Remove deleted item from selection
            removeFromSelection([paintType.id]);
          }
        }
      } catch (error) {
        // Error is handled by the API client with detailed message
        console.error("Error deleting paint type(s):", error);
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
    return <PaintTypeTableSkeleton />;
  }

  if (error) {
    return (
      <div className="border border-border rounded-lg p-8 text-center text-destructive bg-card">
        <IconAlertTriangle className="h-8 w-8 mx-auto mb-4" />
        <div className="text-lg font-medium mb-2">Erro ao carregar tipos de tinta</div>
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
                      aria-label="Select all paint types"
                      disabled={isLoading || paintTypes.length === 0}
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
            {paintTypes.length === 0 ? (
              <TableRow>
                <TableCell colSpan={columns.length + 1} className="p-0">
                  <div className="flex flex-col items-center justify-center p-8 text-center text-muted-foreground">
                    <IconPaint className="h-12 w-12 text-muted-foreground/50 mb-4" />
                    <div className="text-lg font-medium mb-2">Nenhum tipo de tinta encontrado</div>
                    <div className="text-sm">Ajuste os filtros para ver mais resultados.</div>
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              paintTypes.map((paintType, index) => {
                const paintTypeIsSelected = isSelected(paintType.id);

                return (
                  <TableRow
                    key={paintType.id}
                    data-state={paintTypeIsSelected ? "selected" : undefined}
                    className={cn(
                      "cursor-pointer transition-colors border-b border-border",
                      // Alternating row colors
                      index % 2 === 1 && "bg-muted/10",
                      // Hover state that works with alternating colors
                      "hover:bg-muted/20",
                      // Selected state overrides alternating colors
                      paintTypeIsSelected && "bg-muted/30 hover:bg-muted/40",
                    )}
                    onClick={() => navigate(routes.painting.paintTypes.details(paintType.id))}
                    onContextMenu={(e) => handleContextMenu(e, paintType)}
                  >
                    {/* Selection checkbox */}
                    {showInteractive && (
                      <TableCell className={cn(TABLE_LAYOUT.checkbox.className, "p-0 !border-r-0")}>
                        <div className="flex items-center justify-center h-full w-full px-2 py-2" onClick={(e) => e.stopPropagation()}>
                          <Checkbox checked={paintTypeIsSelected} onCheckedChange={() => handleSelectPaintType(paintType.id)} aria-label={`Select ${paintType.name}`} data-checkbox />
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
                        <div className="px-4 py-2">{column.accessor(paintType)}</div>
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
          {contextMenu?.isBulk && <div className="px-2 py-1.5 text-sm font-semibold text-muted-foreground">{contextMenu.paintTypes.length} tipos de tinta selecionados</div>}

          {!contextMenu?.isBulk && (
            <DropdownMenuItem onClick={handleViewDetails}>
              <IconEye className="mr-2 h-4 w-4" />
              Ver Detalhes
            </DropdownMenuItem>
          )}

          {canEdit && (
            <DropdownMenuItem onClick={handleEdit}>
              <IconEdit className="mr-2 h-4 w-4" />
              {contextMenu?.isBulk && contextMenu.paintTypes.length > 1 ? "Editar em lote" : "Editar"}
            </DropdownMenuItem>
          )}

          {(canEdit || canDelete) && <DropdownMenuSeparator />}

          {canDelete && (
            <DropdownMenuItem onClick={handleDelete} className="text-destructive">
              <IconTrash className="mr-2 h-4 w-4" />
              {contextMenu?.isBulk && contextMenu.paintTypes.length > 1 ? "Excluir selecionados" : "Excluir"}
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
                ? `Tem certeza que deseja deletar ${deleteDialog.items.length} tipo${deleteDialog.items.length > 1 ? "s" : ""} de tinta? Esta ação não pode ser desfeita.`
                : `Tem certeza que deseja deletar o tipo "${deleteDialog?.items[0]?.name}"? Esta ação não pode ser desfeita.`}
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
