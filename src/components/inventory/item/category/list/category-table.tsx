import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import type { ItemCategory } from "../../../../../types";
import { routes } from "../../../../../constants";
import { useAuth } from "../../../../../hooks/common/use-auth";
import { canEditItems, canDeleteItems, shouldShowInteractiveElements } from "@/utils/permissions/entity-permissions";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import { IconChevronUp, IconChevronDown, IconSelector, IconAlertTriangle, IconEdit, IconTrash, IconCategory } from "@tabler/icons-react";
import { cn } from "@/lib/utils";
import { useItemCategoryMutations, useItemCategoryBatchMutations, useItemCategories } from "../../../../../hooks";
import { toast } from "sonner";
import { SimplePaginationAdvanced } from "@/components/ui/pagination-advanced";
import type { ItemCategoryGetManyFormData } from "../../../../../schemas";
import { useScrollbarWidth } from "@/hooks/common/use-scrollbar-width";
import { useTableState, convertSortConfigsToOrderBy } from "@/hooks/common/use-table-state";
import { CategoryListSkeleton } from "./category-list-skeleton";
import { TABLE_LAYOUT } from "@/components/ui/table-constants";
import { TruncatedTextWithTooltip } from "@/components/ui/truncated-text-with-tooltip";
import { useCategoryTableColumns } from "./category-table-columns";

interface CategoryTableProps {
  visibleColumns: Set<string>;
  className?: string;
  onEdit?: (categories: ItemCategory[]) => void;
  onDelete?: (categories: ItemCategory[]) => void;
  filters?: Partial<ItemCategoryGetManyFormData>;
  onDataChange?: (data: { categories: ItemCategory[]; totalRecords: number }) => void;
}

export function CategoryTable({ visibleColumns, className, onEdit, onDelete, filters = {}, onDataChange }: CategoryTableProps) {
  const navigate = useNavigate();
  const { delete: _deleteCategory } = useItemCategoryMutations();
  const { batchDelete: _batchDelete } = useItemCategoryBatchMutations();

  // Permission checks
  const { user, isLoading: _isAuthLoading } = useAuth();
  const canEdit = user ? canEditItems(user) : false;
  const canDelete = user ? canDeleteItems(user) : false;
  const showInteractive = user ? shouldShowInteractiveElements(user, 'item') : false;

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
    toggleSelection: _toggleSelection,
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
  });

  // Memoize include configuration
  const includeConfig = React.useMemo(
    () => ({
      _count: {
        select: {
          items: true,
        },
      },
    }),
    [],
  );

  // Memoize query parameters
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

  // Use the categories hook
  const { data: response, isLoading, error } = useItemCategories(queryParams);

  const categories = response?.data || [];
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
      const dataKey = categories.length > 0 ? `${totalRecords}-${categories.map((cat) => cat.id).join(",")}` : `empty-${totalRecords}`;

      if (dataKey !== lastNotifiedDataRef.current) {
        lastNotifiedDataRef.current = dataKey;
        onDataChange({ categories, totalRecords });
      }
    }
  }, [categories, totalRecords, onDataChange]);

  // Context menu state
  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    categories: ItemCategory[];
    isBulk: boolean;
  } | null>(null);

  // Get all available columns
  const allColumns = useCategoryTableColumns();

  // Filter columns based on visibility
  const columns = allColumns.filter((col) => visibleColumns.has(col.key));

  // Get current page category IDs for selection
  const currentPageCategoryIds = React.useMemo(() => {
    return categories.map((category) => category.id);
  }, [categories]);

  // Selection handlers
  const allSelected = isAllSelected(currentPageCategoryIds);
  const partiallySelected = isPartiallySelected(currentPageCategoryIds);

  const handleSelectAll = () => {
    toggleSelectAll(currentPageCategoryIds);
  };

  const handleSelectCategory = (categoryId: string, event?: React.MouseEvent) => {
    handleRowClickSelection(categoryId, currentPageCategoryIds, event?.shiftKey || false);
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
  const handleContextMenu = (e: React.MouseEvent, category: ItemCategory) => {
    e.preventDefault();
    e.stopPropagation();

    const isCategorySelected = isSelected(category.id);
    const hasSelection = selectionCount > 0;

    if (hasSelection && isCategorySelected) {
      const selectedCategoriesList = categories.filter((c) => isSelected(c.id));
      setContextMenu({
        x: e.clientX,
        y: e.clientY,
        categories: selectedCategoriesList,
        isBulk: true,
      });
    } else {
      setContextMenu({
        x: e.clientX,
        y: e.clientY,
        categories: [category],
        isBulk: false,
      });
    }
  };

  const handleEdit = () => {
    if (contextMenu) {
      if (contextMenu.isBulk && contextMenu.categories.length > 1) {
        if (onEdit) {
          onEdit(contextMenu.categories);
        } else {
          toast.error("Edição em lote não implementada");
        }
      } else {
        navigate(routes.inventory.products.categories.edit(contextMenu.categories[0].id));
      }
      setContextMenu(null);
    }
  };

  const handleDelete = () => {
    if (contextMenu && onDelete) {
      onDelete(contextMenu.categories);
      setContextMenu(null);
    }
  };

  // Close context menu when clicking outside
  React.useEffect(() => {
    const handleClick = () => setContextMenu(null);
    document.addEventListener("click", handleClick);
    return () => document.removeEventListener("click", handleClick);
  }, []);

  if (isLoading) {
    return <CategoryListSkeleton />;
  }

  return (
    <div className={cn("rounded-lg flex flex-col", className)}>
      {/* Fixed Header Table */}
      <div className="border-l border-r border-t border-border rounded-t-lg overflow-x-auto">
        <Table className={cn("min-w-[800px] [&>div]:border-0 [&>div]:rounded-none", TABLE_LAYOUT.tableLayout)}>
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
                      aria-label="Select all categories"
                      disabled={isLoading || categories.length === 0}
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
                        column.align === "left" && "justify-start",
                        !column.align && "justify-start",
                      )}
                      disabled={isLoading || categories.length === 0}
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
            {error ? (
              <TableRow>
                <TableCell colSpan={columns.length + 1} className="p-0">
                  <div className="flex flex-col items-center justify-center p-8 text-center text-destructive">
                    <IconAlertTriangle className="h-8 w-8 mb-4" />
                    <div className="text-lg font-medium mb-2">Não foi possível carregar as categorias</div>
                    <div className="text-sm text-muted-foreground">Tente novamente mais tarde.</div>
                  </div>
                </TableCell>
              </TableRow>
            ) : categories.length === 0 ? (
              <TableRow>
                <TableCell colSpan={columns.length + 1} className="p-0">
                  <div className="flex flex-col items-center justify-center p-8 text-center text-muted-foreground">
                    <IconCategory className="h-12 w-12 text-muted-foreground/50 mb-4" />
                    <div className="text-lg font-medium mb-2">Nenhuma categoria encontrada</div>
                    {filters && Object.keys(filters).length > 1 && <div className="text-sm">Ajuste os filtros para ver mais resultados.</div>}
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              categories.map((category, index) => {
                const categoryIsSelected = isSelected(category.id);

                return (
                  <TableRow
                    key={category.id}
                    data-state={categoryIsSelected ? "selected" : undefined}
                    className={cn(
                      "cursor-pointer transition-colors border-b border-border",
                      index % 2 === 1 && "bg-muted/10",
                      "hover:bg-muted/20",
                      categoryIsSelected && "bg-muted/30 hover:bg-muted/40",
                    )}
                    onClick={() => navigate(routes.inventory.products.categories.details(category.id))}
                    onContextMenu={(e) => handleContextMenu(e, category)}
                  >
                    {/* Selection checkbox */}
                    {showInteractive && (
                      <TableCell className={cn(TABLE_LAYOUT.checkbox.className, "p-0 !border-r-0")}>
                        <div className="flex items-center justify-center h-full w-full px-2 py-2" onClick={(e) => { e.stopPropagation(); handleSelectCategory(category.id, e); }}>
                          <Checkbox checked={categoryIsSelected} onCheckedChange={() => handleSelectCategory(category.id)} aria-label={`Select ${category.name}`} />
                        </div>
                      </TableCell>
                    )}

                    {/* Data columns */}
                    {columns.map((column) => (
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
                          {column.accessor(category)}
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
        <DropdownMenuContent
          style={{
            position: "fixed",
            left: contextMenu?.x,
            top: contextMenu?.y,
          }}
          className="w-56"
          onCloseAutoFocus={(e) => e.preventDefault()}
        >
          {contextMenu?.isBulk && <div className="px-2 py-1.5 text-sm font-semibold text-muted-foreground">{contextMenu.categories.length} categorias selecionadas</div>}

          {canEdit && (
            <DropdownMenuItem onClick={handleEdit}>
              <IconEdit className="mr-2 h-4 w-4" />
              {contextMenu?.isBulk && contextMenu.categories.length > 1 ? "Editar em lote" : "Editar"}
            </DropdownMenuItem>
          )}

          {(canEdit || canDelete) && <DropdownMenuSeparator />}

          {canDelete && (
            <DropdownMenuItem onClick={handleDelete} className="text-destructive">
              <IconTrash className="mr-2 h-4 w-4" />
              {contextMenu?.isBulk && contextMenu.categories.length > 1 ? "Deletar selecionadas" : "Deletar"}
            </DropdownMenuItem>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
