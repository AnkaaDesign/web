import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import type { Supplier } from "../../../../types";
import { routes } from "../../../../constants";
import { useAuth } from "../../../../hooks/common/use-auth";
import { canEditSuppliers, canDeleteSuppliers, shouldShowInteractiveElements } from "@/utils/permissions/entity-permissions";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { IconChevronUp, IconChevronDown, IconEdit, IconTrash, IconSelector, IconEye, IconAlertTriangle, IconBuildingStore, IconPlus } from "@tabler/icons-react";
import { cn } from "@/lib/utils";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import { useSuppliers, useSupplierMutations, useSupplierBatchMutations } from "../../../../hooks";
import { toast } from "sonner";
import { SimplePaginationAdvanced } from "@/components/ui/pagination-advanced";
import type { SupplierGetManyFormData } from "../../../../schemas";
import { useScrollbarWidth } from "@/hooks/common/use-scrollbar-width";
import { TABLE_LAYOUT } from "@/components/ui/table-constants";
import { TruncatedTextWithTooltip } from "@/components/ui/truncated-text-with-tooltip";
import { createSupplierColumns } from "./supplier-table-columns";
import type { SupplierColumn } from "./types";
import { useTableState, convertSortConfigsToOrderBy } from "@/hooks/common/use-table-state";
import { SupplierListSkeleton } from "./supplier-list-skeleton";

interface SupplierTableProps {
  visibleColumns: Set<string>;
  className?: string;
  onEdit?: (suppliers: Supplier[]) => void;
  onDelete?: (suppliers: Supplier[]) => void;
  filters?: Partial<SupplierGetManyFormData>;
  onDataChange?: (data: { suppliers: Supplier[]; totalRecords: number }) => void;
}

export function SupplierTable({ visibleColumns, className, onEdit, onDelete, filters = {}, onDataChange }: SupplierTableProps) {
  const navigate = useNavigate();
  const { user, isLoading: _isAuthLoading } = useAuth();
  const { delete: _deleteSupplier } = useSupplierMutations();
  const { delete: _batchDelete } = useSupplierBatchMutations();

  // Permission checks
  const canEdit = user ? canEditSuppliers(user) : false;
  const canDelete = user ? canDeleteSuppliers(user) : false;
  const showInteractive = user ? shouldShowInteractiveElements(user, 'supplier') : false;

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

  // Memoize include configuration to prevent re-renders
  const includeConfig = React.useMemo(
    () => ({
      logo: true,
      _count: {
        select: {
          items: true,
          orders: true,
          orderRules: true,
        },
      },
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
      // Filter by selected IDs when showSelectedOnly is true
      ...(showSelectedOnly &&
        selectedIds.length > 0 && {
          where: {
            id: { in: selectedIds },
          },
        }),
    };

    return params;
  }, [filters, page, pageSize, includeConfig, sortConfigs, showSelectedOnly, selectedIds]);

  // Use the suppliers hook with memoized parameters
  const { data: response, isLoading, error } = useSuppliers(queryParams);

  const suppliers = response?.data || [];
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
      const dataKey = suppliers.length > 0 ? `${totalRecords}-${suppliers.map((supplier) => supplier.id).join(",")}` : `empty-${totalRecords}`;

      // Only notify if this exact data hasn't been notified yet
      if (dataKey !== lastNotifiedDataRef.current) {
        lastNotifiedDataRef.current = dataKey;
        onDataChange({ suppliers, totalRecords });
      }
    }
  }, [suppliers, totalRecords, onDataChange]);

  // Context menu state
  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    suppliers: Supplier[];
    isBulk: boolean;
  } | null>(null);

  // Define all available columns
  const allColumns: SupplierColumn[] = createSupplierColumns();

  // Filter columns based on visibility
  const columns = allColumns.filter((col) => visibleColumns.has(col.key));

  // Get current page supplier IDs for selection
  const currentPageSupplierIds = React.useMemo(() => {
    return suppliers.map((supplier) => supplier.id);
  }, [suppliers]);

  // Selection handlers
  const allSelected = isAllSelected(currentPageSupplierIds);
  const partiallySelected = isPartiallySelected(currentPageSupplierIds);

  const handleSelectAll = () => {
    toggleSelectAll(currentPageSupplierIds);
  };

  const handleSelectSupplier = (supplierId: string, event?: React.MouseEvent) => {
    handleRowClickSelection(supplierId, currentPageSupplierIds, event?.shiftKey || false);
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
  const handleContextMenu = (e: React.MouseEvent, supplier: Supplier) => {
    e.preventDefault();
    e.stopPropagation();

    // Check if clicked supplier is part of selection
    const isSupplierSelected = isSelected(supplier.id);
    const hasSelection = selectionCount > 0;

    if (hasSelection && isSupplierSelected) {
      // Show bulk actions for all selected suppliers
      const selectedSuppliersList = suppliers.filter((s) => isSelected(s.id));
      setContextMenu({
        x: e.clientX,
        y: e.clientY,
        suppliers: selectedSuppliersList,
        isBulk: true,
      });
    } else {
      // Show actions for just the clicked supplier
      setContextMenu({
        x: e.clientX,
        y: e.clientY,
        suppliers: [supplier],
        isBulk: false,
      });
    }
  };

  const handleViewDetails = () => {
    if (contextMenu && !contextMenu.isBulk) {
      navigate(routes.inventory.suppliers.details(contextMenu.suppliers[0].id));
      setContextMenu(null);
    }
  };

  const handleEdit = () => {
    if (contextMenu) {
      if (contextMenu.isBulk && contextMenu.suppliers.length > 1) {
        // Bulk edit
        if (onEdit) {
          onEdit(contextMenu.suppliers);
        } else {
          toast.error("Edição em lote não implementada");
        }
      } else {
        // Single edit
        navigate(routes.inventory.suppliers.edit(contextMenu.suppliers[0].id));
      }
      setContextMenu(null);
    }
  };

  const handleDelete = () => {
    if (contextMenu && onDelete) {
      onDelete(contextMenu.suppliers);
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
    return <SupplierListSkeleton />;
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
                      onCheckedChange={handleSelectAll}
                      aria-label="Select all suppliers"
                      disabled={isLoading || suppliers.length === 0}
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
                      disabled={isLoading || suppliers.length === 0}
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
                    <div className="text-lg font-medium mb-2">Não foi possível carregar os fornecedores</div>
                    <div className="text-sm text-muted-foreground">Tente novamente mais tarde.</div>
                  </div>
                </TableCell>
              </TableRow>
            ) : suppliers.length === 0 ? (
              <TableRow>
                <TableCell colSpan={columns.length + 1} className="p-0">
                  <div className="flex flex-col items-center justify-center p-8 text-center text-muted-foreground">
                    <IconBuildingStore className="h-12 w-12 text-muted-foreground/50 mb-4" />
                    <div className="text-lg font-medium mb-2">Nenhum fornecedor encontrado</div>
                    {filters && Object.keys(filters).length > 1 ? (
                      <div className="text-sm">Ajuste os filtros para ver mais resultados.</div>
                    ) : (
                      <>
                        <div className="text-sm mb-4">Comece cadastrando o primeiro fornecedor.</div>
                        <Button onClick={() => navigate(routes.inventory.suppliers.create)} variant="outline">
                          <IconPlus className="h-4 w-4 mr-2" />
                          Novo Fornecedor
                        </Button>
                      </>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              suppliers.map((supplier, index) => {
                const supplierIsSelected = isSelected(supplier.id);

                return (
                  <TableRow
                    key={supplier.id}
                    data-state={supplierIsSelected ? "selected" : undefined}
                    className={cn(
                      "cursor-pointer transition-colors border-b border-border",
                      // Alternating row colors
                      index % 2 === 1 && "bg-muted/10",
                      // Hover state that works with alternating colors
                      "hover:bg-muted/20",
                      // Selected state overrides alternating colors
                      supplierIsSelected && "bg-muted/30 hover:bg-muted/40",
                    )}
                    onClick={() => navigate(routes.inventory.suppliers.details(supplier.id))}
                    onContextMenu={(e) => handleContextMenu(e, supplier)}
                  >
                    {/* Selection checkbox */}
                    {showInteractive && (
                      <TableCell className={cn(TABLE_LAYOUT.checkbox.className, "p-0 !border-r-0")}>
                        <div
                          className="flex items-center justify-center h-full w-full px-2 py-2"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleSelectSupplier(supplier.id, e);
                          }}
                        >
                          <Checkbox
                            checked={supplierIsSelected}
                            aria-label={`Select ${supplier.fantasyName}`}
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
                        <div className="px-4 py-2">{column.accessor(supplier)}</div>
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
          {contextMenu?.isBulk && <div className="px-2 py-1.5 text-sm font-semibold text-muted-foreground">{contextMenu.suppliers.length} fornecedores selecionados</div>}

          {!contextMenu?.isBulk && (
            <DropdownMenuItem onClick={handleViewDetails}>
              <IconEye className="mr-2 h-4 w-4" />
              Ver Detalhes
            </DropdownMenuItem>
          )}

          {canEdit && (
            <DropdownMenuItem onClick={handleEdit}>
              <IconEdit className="mr-2 h-4 w-4" />
              {contextMenu?.isBulk && contextMenu.suppliers.length > 1 ? "Editar em lote" : "Editar"}
            </DropdownMenuItem>
          )}

          {(canEdit || canDelete) && <DropdownMenuSeparator />}

          {canDelete && (
            <DropdownMenuItem onClick={handleDelete} className="text-destructive">
              <IconTrash className="mr-2 h-4 w-4" />
              {contextMenu?.isBulk && contextMenu.suppliers.length > 1 ? "Deletar selecionados" : "Deletar"}
            </DropdownMenuItem>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
