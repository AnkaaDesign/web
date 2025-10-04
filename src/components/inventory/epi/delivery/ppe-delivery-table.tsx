import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import type { PpeDelivery } from "../../../../types";
import { PPE_DELIVERY_STATUS } from "../../../../constants";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import { IconChevronUp, IconChevronDown, IconRefresh, IconEdit, IconTrash, IconSelector, IconAlertTriangle, IconTruck, IconCheck, IconX } from "@tabler/icons-react";
import { cn } from "@/lib/utils";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import { usePpeDeliveries } from "../../../../hooks";
import { SimplePaginationAdvanced } from "@/components/ui/pagination-advanced";
import type { PpeDeliveryGetManyFormData } from "../../../../schemas";
import { useScrollbarWidth } from "@/hooks/use-scrollbar-width";
import { TABLE_LAYOUT } from "@/components/ui/table-constants";
import { createPpeDeliveryColumns } from "./ppe-delivery-table-columns";
import { useTableState, convertSortConfigsToOrderBy } from "@/hooks/use-table-state";
import { TruncatedTextWithTooltip } from "@/components/ui/truncated-text-with-tooltip";

interface PpeDeliveryTableProps {
  visibleColumns: Set<string>;
  className?: string;
  onEdit?: (deliveries: PpeDelivery[]) => void;
  onApprove?: (deliveries: PpeDelivery[]) => void;
  onReject?: (deliveries: PpeDelivery[]) => void;
  onDeliver?: (deliveries: PpeDelivery[]) => void;
  onDelete?: (deliveries: PpeDelivery[]) => void;
  filters?: Partial<PpeDeliveryGetManyFormData>;
  onDataChange?: (data: { items: PpeDelivery[]; totalRecords: number; selectionCount: number; showSelectedOnly: boolean; toggleShowSelectedOnly: () => void }) => void;
}

export function PpeDeliveryTable({ visibleColumns, className, onEdit, onApprove, onReject, onDeliver, onDelete, filters = {}, onDataChange }: PpeDeliveryTableProps) {
  const navigate = useNavigate();

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
    toggleShowSelectedOnly,
  } = useTableState({
    defaultPageSize: 40,
    resetSelectionOnPageChange: false,
    defaultSort: [
      { column: "status", direction: "asc" },
      { column: "scheduledDate", direction: "desc" },
    ],
  });

  // Prepare query parameters
  const queryFilters: Partial<PpeDeliveryGetManyFormData> = {
    // When showSelectedOnly is true, don't apply filters
    ...(showSelectedOnly ? {} : filters),
    page: page + 1, // Convert 0-based to 1-based for API
    limit: pageSize,
    orderBy: convertSortConfigsToOrderBy(sortConfigs),
    include: {
      item: {
        include: {
          brand: true,
          category: true,
        },
      },
      user: true,
      reviewedByUser: true,
      ppeSchedule: true,
    },
  };

  // Filter to show only selected items if enabled
  if (showSelectedOnly && selectedIds.length > 0) {
    queryFilters.where = {
      id: { in: selectedIds },
    };
  }

  // Fetch data
  const { data, isLoading, error } = usePpeDeliveries(queryFilters);

  // Update parent component with current data
  React.useEffect(() => {
    if (data?.data && onDataChange) {
      onDataChange({
        items: data.data,
        totalRecords: data.meta?.totalRecords || 0,
        selectionCount,
        showSelectedOnly,
        toggleShowSelectedOnly,
      });
    }
  }, [data, onDataChange, selectionCount, showSelectedOnly, toggleShowSelectedOnly]);

  const deliveries = data?.data || [];
  const totalPages = data?.meta ? Math.ceil(data.meta.totalRecords / pageSize) : 1;
  const totalRecords = data?.meta?.totalRecords || 0;

  // Get visible columns based on selection
  const columns = createPpeDeliveryColumns();
  const visibleColumnConfigs = columns.filter((col) => visibleColumns.has(col.key));

  // Row actions
  const handleRowClick = (delivery: PpeDelivery) => {
    navigate(`/estoque/epi/entregas/detalhes/${delivery.id}`);
  };

  // Get current page delivery IDs for selection
  const currentPageDeliveryIds = React.useMemo(() => {
    return deliveries.map((delivery) => delivery.id);
  }, [deliveries]);

  // Selection handlers - must be declared before usage
  const allSelected = isAllSelected(currentPageDeliveryIds);
  const partiallySelected = isPartiallySelected(currentPageDeliveryIds);

  const handleSelectAll = () => {
    toggleSelectAll(currentPageDeliveryIds);
  };

  const handleSelectDelivery = (deliveryId: string) => {
    toggleSelection(deliveryId);
  };

  // Context menu state
  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    deliveries: PpeDelivery[];
    isBulk: boolean;
  } | null>(null);

  // Context menu handlers
  const handleContextMenu = (e: React.MouseEvent, delivery: PpeDelivery) => {
    e.preventDefault();
    e.stopPropagation();

    const isDeliverySelected = isSelected(delivery.id);
    const hasSelection = selectionCount > 0;

    if (hasSelection && isDeliverySelected) {
      const selectedDeliveriesList = deliveries.filter((d) => isSelected(d.id));
      setContextMenu({
        x: e.clientX,
        y: e.clientY,
        deliveries: selectedDeliveriesList,
        isBulk: true,
      });
    } else {
      setContextMenu({
        x: e.clientX,
        y: e.clientY,
        deliveries: [delivery],
        isBulk: false,
      });
    }
  };

  const handleEdit = () => {
    if (contextMenu && onEdit) {
      onEdit(contextMenu.deliveries);
      setContextMenu(null);
    }
  };

  const handleApprove = () => {
    if (contextMenu && onApprove) {
      onApprove(contextMenu.deliveries);
      setContextMenu(null);
    }
  };

  const handleReject = () => {
    if (contextMenu && onReject) {
      onReject(contextMenu.deliveries);
      setContextMenu(null);
    }
  };

  const handleDeliver = () => {
    if (contextMenu && onDeliver) {
      onDeliver(contextMenu.deliveries);
      setContextMenu(null);
    }
  };

  const handleDelete = async () => {
    if (contextMenu && onDelete) {
      onDelete(contextMenu.deliveries);
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
      <div className="border-l border-r border-t border-border rounded-t-lg overflow-x-auto">
        <Table className={cn("min-w-[800px] [&>div]:border-0 [&>div]:rounded-none", TABLE_LAYOUT.tableLayout)}>
          <TableHeader className="[&_tr]:border-b-0 [&_tr]:hover:bg-muted">
            <TableRow className="bg-muted hover:bg-muted even:bg-muted h-10">
              {/* Selection column */}
              <TableHead className={cn(TABLE_LAYOUT.checkbox.className, "whitespace-nowrap text-foreground font-bold uppercase text-xs bg-muted !border-r-0 p-0")}>
                <div className="flex items-center justify-center h-full w-full px-2 min-h-[2.5rem]">
                  <Checkbox
                    checked={allSelected}
                    indeterminate={partiallySelected}
                    onCheckedChange={handleSelectAll}
                    aria-label="Select all deliveries"
                    className={cn("border-2 bg-background", partiallySelected && "data-[state=checked]:bg-muted data-[state=checked]:text-muted-foreground")}
                    disabled={isLoading || deliveries.length === 0}
                    data-checkbox
                  />
                </div>
              </TableHead>

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
                      disabled={isLoading || deliveries.length === 0}
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
      <div className="flex-1 overflow-auto border-l border-r border-border">
        <Table className={cn("min-w-[800px] [&>div]:border-0 [&>div]:rounded-none", TABLE_LAYOUT.tableLayout)}>
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
                    <div className="text-lg font-medium mb-2">Não foi possível carregar as entregas</div>
                    <div className="text-sm text-muted-foreground">Tente novamente mais tarde.</div>
                  </div>
                </TableCell>
              </TableRow>
            ) : deliveries.length === 0 ? (
              <TableRow>
                <TableCell colSpan={visibleColumnConfigs.length + 1} className="p-0">
                  <div className="flex flex-col items-center justify-center p-8 text-center text-muted-foreground">
                    <IconTruck className="h-12 w-12 text-muted-foreground/50 mb-4" />
                    <div className="text-lg font-medium mb-2">Nenhuma entrega encontrada</div>
                    {filters && Object.keys(filters).length > 1 && <div className="text-sm">Ajuste os filtros para ver mais resultados.</div>}
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              deliveries.map((delivery, index) => {
                const deliveryIsSelected = isSelected(delivery.id);

                return (
                  <TableRow
                    key={delivery.id}
                    data-state={deliveryIsSelected ? "selected" : undefined}
                    className={cn(
                      "cursor-pointer transition-colors border-b border-border",
                      index % 2 === 1 && "bg-muted/10",
                      "hover:bg-muted/20",
                      deliveryIsSelected && "bg-muted/30 hover:bg-muted/40",
                    )}
                    onClick={() => handleRowClick(delivery)}
                    onContextMenu={(e) => handleContextMenu(e, delivery)}
                  >
                    {/* Selection checkbox */}
                    <TableCell className={cn(TABLE_LAYOUT.checkbox.className, "p-0 !border-r-0")}>
                      <div className="flex items-center justify-center h-full w-full px-2 py-2 min-h-[2.5rem]" onClick={(e) => e.stopPropagation()}>
                        <Checkbox
                          checked={deliveryIsSelected}
                          onCheckedChange={() => handleSelectDelivery(delivery.id)}
                          aria-label={`Select delivery ${delivery.id}`}
                          className="border-2"
                          data-checkbox
                        />
                      </div>
                    </TableCell>

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
                          {column.accessor(delivery)}
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
          {contextMenu?.isBulk && <div className="px-2 py-1.5 text-sm font-semibold text-muted-foreground">{contextMenu.deliveries.length} entregas selecionadas</div>}

          <DropdownMenuItem onClick={handleEdit}>
            <IconEdit className="mr-2 h-4 w-4" />
            {contextMenu?.isBulk && contextMenu.deliveries.length > 1 ? "Editar em lote" : "Editar"}
          </DropdownMenuItem>

          {/* Only show approve option if at least one delivery is not approved */}
          {contextMenu?.deliveries.some((d) => d.status !== PPE_DELIVERY_STATUS.APPROVED && d.status !== PPE_DELIVERY_STATUS.DELIVERED) && (
            <DropdownMenuItem onClick={handleApprove}>
              <IconCheck className="mr-2 h-4 w-4" />
              {contextMenu?.isBulk && contextMenu.deliveries.length > 1 ? "Aprovar entregas" : "Aprovar entrega"}
            </DropdownMenuItem>
          )}

          {/* Only show reject option if at least one delivery can be rejected */}
          {contextMenu?.deliveries.some((d) => d.status !== PPE_DELIVERY_STATUS.DELIVERED && d.status !== PPE_DELIVERY_STATUS.REPROVED) && (
            <DropdownMenuItem onClick={handleReject}>
              <IconX className="mr-2 h-4 w-4" />
              {contextMenu?.isBulk && contextMenu.deliveries.length > 1 ? "Reprovar entregas" : "Reprovar entrega"}
            </DropdownMenuItem>
          )}

          {/* Only show deliver option if at least one delivery is approved but not delivered */}
          {contextMenu?.deliveries.some((d) => d.status === PPE_DELIVERY_STATUS.APPROVED) && (
            <DropdownMenuItem onClick={handleDeliver}>
              <IconTruck className="mr-2 h-4 w-4" />
              {contextMenu?.isBulk && contextMenu.deliveries.length > 1 ? "Marcar como entregues" : "Marcar como entregue"}
            </DropdownMenuItem>
          )}

          <DropdownMenuSeparator />

          <DropdownMenuItem onClick={handleDelete} className="text-destructive">
            <IconTrash className="mr-2 h-4 w-4" />
            {contextMenu?.isBulk && contextMenu.deliveries.length > 1 ? "Deletar selecionadas" : "Deletar"}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
