import React, { useState, useMemo } from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import { IconChevronUp, IconChevronDown, IconSelector, IconAlertTriangle, IconPackage } from "@tabler/icons-react";
import { CalculationListSkeleton } from "./calculation-list-skeleton";
import { cn } from "@/lib/utils";
import { useScrollbarWidth } from "@/hooks/common/use-scrollbar-width";
import { TABLE_LAYOUT } from "@/components/ui/table-constants";
import { TruncatedTextWithTooltip } from "@/components/ui/truncated-text-with-tooltip";
import { createCalculationColumns } from "./calculation-table-columns";
import type { CalculationColumn } from "./calculation-table-columns";
import { useTableState, convertSortConfigsToOrderBy } from "@/hooks/common/use-table-state";
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
// Removed pagination import - not needed for Secullum

interface CalculationRow {
  id: string;
  date: string;
  entrada1?: string;
  saida1?: string;
  entrada2?: string;
  saida2?: string;
  entrada3?: string;
  saida3?: string;
  normais?: string;
  faltas?: string;
  ex50?: string;
  ex100?: string;
  ex150?: string;
  dsr?: string;
  dsrDeb?: string;
  not?: string;
  exNot?: string;
  ajuste?: string;
  abono2?: string;
  abono3?: string;
  abono4?: string;
  atras?: string;
  adian?: string;
  folga?: string;
  carga?: string;
  justPa?: string;
  tPlusMinus?: string;
  exInt?: string;
  notTot?: string;
  refeicao?: string;
}

interface CalculationTableProps {
  visibleColumns: Set<string>;
  className?: string;
  data: CalculationRow[];
  totalsRow?: CalculationRow | null;
  isLoading?: boolean;
}

export function CalculationTable({
  visibleColumns,
  className,
  data = [],
  totalsRow = null,
  isLoading = false,
}: CalculationTableProps) {
  // Get scrollbar width info
  const { width: scrollbarWidth, isOverlay } = useScrollbarWidth();

  // Use URL state management for selection and sorting only (no pagination)
  const {
    selectedIds,
    sortConfigs,
    showSelectedOnly,
    toggleSelection,
    toggleSelectAll,
    toggleSort,
    getSortDirection,
    getSortOrder,
    isSelected,
    isAllSelected,
    isPartiallySelected,
    selectionCount,
    handleRowClick: handleRowClickSelection,
  } = useTableState({
    defaultPageSize: 999999, // Effectively disable pagination
    resetSelectionOnPageChange: false,
  });

  // Define all available columns
  const allColumns: CalculationColumn[] = createCalculationColumns();

  // Filter columns based on visibility
  const columns = allColumns.filter((col) => visibleColumns.has(col.key));

  // Apply client-side sorting only (no pagination)
  const sortedData = useMemo(() => {
    let processedData = [...data];

    // Apply sorting if sortConfigs exist
    if (sortConfigs.length > 0) {
      processedData.sort((a, b) => {
        for (const sortConfig of sortConfigs) {
          const { key, direction } = sortConfig;

          let aValue = (a as any)[key] || "";
          let bValue = (b as any)[key] || "";

          // Handle empty/null values
          if (!aValue && !bValue) continue;
          if (!aValue) return direction === "asc" ? 1 : -1;
          if (!bValue) return direction === "asc" ? -1 : 1;

          // Convert time values for proper sorting
          if (typeof aValue === "string" && aValue.includes(":")) {
            aValue = aValue.replace(":", "");
            bValue = bValue.replace(":", "");
          }

          let comparison = 0;
          if (aValue < bValue) comparison = -1;
          if (aValue > bValue) comparison = 1;

          if (comparison !== 0) {
            return direction === "asc" ? comparison : -comparison;
          }
        }
        return 0;
      });
    }

    // Filter for selected only if needed
    if (showSelectedOnly && selectedIds.length > 0) {
      processedData = processedData.filter(item => selectedIds.includes(item.id));
    }

    return {
      items: processedData,
      totalRecords: processedData.length,
    };
  }, [data, sortConfigs, showSelectedOnly, selectedIds]);

  const { items, totalRecords } = sortedData;

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

  const renderSortIndicator = (columnKey: string) => {
    const sortDirection = getSortDirection(columnKey);
    const sortOrder = getSortOrder(columnKey);

    return (
      <div className="inline-flex items-center ml-1">
        {sortDirection === null && <IconSelector className="h-4 w-4 text-muted-foreground" />}
        {sortDirection === "asc" && <IconChevronUp className="h-4 w-4 text-foreground" />}
        {sortDirection === "desc" && <IconChevronDown className="h-4 w-4 text-foreground" />}
        {sortOrder !== null && sortConfigs.length > 1 && (
          <span className="text-xs ml-0.5">{sortOrder + 1}</span>
        )}
      </div>
    );
  };

  if (isLoading) {
    return <CalculationListSkeleton />;
  }

  return (
    <div className={cn("rounded-lg flex flex-col h-full", className)}>
      {/* Fixed Header Table */}
      <div className="border-l border-r border-t border-border rounded-t-lg overflow-hidden flex-shrink-0">
        <Table className={cn("w-full [&>div]:border-0 [&>div]:rounded-none", TABLE_LAYOUT.tableLayout)}>
          <TableHeader className="[&_tr]:border-b-0 [&_tr]:hover:bg-muted">
            <TableRow className="bg-muted hover:bg-muted even:bg-muted">
              {/* Selection column */}
              <TableHead className={cn(TABLE_LAYOUT.checkbox.className, "whitespace-nowrap text-foreground font-semibold text-xs bg-muted !border-r-0 p-0")}>
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

              {/* Data columns */}
              {columns.map((column) => (
                <TableHead key={column.key} className={cn("whitespace-nowrap text-foreground font-semibold text-xs p-0 bg-muted !border-r-0", column.className)}>
                  {column.sortable ? (
                    <button
                      onClick={() => toggleSort(column.key)}
                      className={cn(
                        "flex items-center gap-1 w-full h-full min-h-[2.5rem] px-4 py-2 hover:bg-muted/80 transition-colors cursor-pointer text-left border-0 bg-transparent uppercase",
                        column.align === "center" && "justify-center",
                        column.align === "right" && "justify-end",
                        !column.align && "justify-start",
                      )}
                      disabled={isLoading || items.length === 0}
                    >
                      <TruncatedTextWithTooltip text={column.header} />
                      {renderSortIndicator(column.key)}
                    </button>
                  ) : (
                    <div
                      className={cn(
                        "flex items-center h-full min-h-[2.5rem] px-4 py-2 uppercase",
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
      <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden border-l border-r border-border">
        <Table className={cn("w-full [&>div]:border-0 [&>div]:rounded-none", TABLE_LAYOUT.tableLayout)}>
          <TableBody>
            {items.length === 0 ? (
              <TableRow>
                <TableCell colSpan={columns.length + 1} className="p-0">
                  <div className="flex flex-col items-center justify-center p-8 text-center text-muted-foreground">
                    <IconPackage className="h-12 w-12 text-muted-foreground/50 mb-4" />
                    <div className="text-lg font-medium mb-2">Nenhum registro encontrado</div>
                    <div className="text-sm">Selecione um funcionário e mês para ver os cálculos.</div>
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              <>
                {items.map((item, index) => {
                  const itemIsSelected = isSelected(item.id);

                  return (
                    <TableRow
                      key={item.id}
                      data-state={itemIsSelected ? "selected" : undefined}
                      className={cn(
                        "cursor-pointer transition-colors border-b border-border",
                        // Alternating row colors
                        index % 2 === 1 && "bg-muted/10",
                        // Hover state that works with alternating colors
                        "hover:bg-muted/20",
                        // Selected state overrides alternating colors
                        itemIsSelected && "bg-muted/30 hover:bg-muted/40",
                      )}
                    >
                      {/* Selection checkbox */}
                      <TableCell className={cn(TABLE_LAYOUT.checkbox.className, "p-0 !border-r-0")}>
                        <div className="flex items-center justify-center h-full w-full px-2 py-2" onClick={(e) => {
                          e.stopPropagation();
                          handleSelectItem(item.id, e);
                        }}>
                          <Checkbox
                            checked={itemIsSelected}
                            onCheckedChange={() => handleSelectItem(item.id)}
                            aria-label={`Select ${item.date}`}
                            data-checkbox
                          />
                        </div>
                      </TableCell>

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
                          <div className="px-4 py-2">{column.accessor(item)}</div>
                        </TableCell>
                      ))}
                    </TableRow>
                  );
                })}

                {/* Regular rows - remove totals from here */}
              </>
            )}
          </TableBody>
        </Table>
      </div>

      {/* Totals Footer */}
      {totalsRow && (
        <div className="border-l border-r border-b border-border rounded-b-lg overflow-hidden flex-shrink-0 bg-muted">
          <Table className={cn("w-full [&>div]:border-0 [&>div]:rounded-none", TABLE_LAYOUT.tableLayout)}>
            <TableBody>
              <TableRow className="hover:bg-muted bg-muted">
                {/* Totais label aligned with checkbox column */}
                <TableCell className={cn(TABLE_LAYOUT.checkbox.className, "p-0 !border-r-0 bg-muted font-bold")}>
                  <div className="flex items-center justify-center h-full w-full px-4 py-3">
                    <span className="text-sm font-bold uppercase ml-6">TOTAIS</span>
                  </div>
                </TableCell>

                {/* Data columns with totals */}
                {columns.map((column) => (
                  <TableCell
                    key={column.key}
                    className={cn(
                      column.className,
                      "p-0 !border-r-0 bg-muted font-bold",
                      column.align === "center" && "text-center",
                      column.align === "right" && "text-right",
                      column.align === "left" && "text-left",
                      !column.align && "text-left",
                    )}
                  >
                    <div className="px-4 py-3">
                      {column.key === 'date' ? (
                        '' // Empty for date column since TOTAIS is in checkbox column
                      ) : (
                        column.accessor(totalsRow)
                      )}
                    </div>
                  </TableCell>
                ))}

                {/* Scrollbar spacer if needed */}
                {!isOverlay && (
                  <TableCell style={{ width: `${scrollbarWidth}px`, minWidth: `${scrollbarWidth}px` }} className="bg-muted p-0 border-0 !border-r-0 shrink-0"></TableCell>
                )}
              </TableRow>
            </TableBody>
          </Table>
        </div>
      )}

      {/* Bottom border if no totals */}
      {!totalsRow && (
        <div className="border-b border-l border-r border-border rounded-b-lg h-px" />
      )}
    </div>
  );
}