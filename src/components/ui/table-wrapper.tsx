import * as React from "react";
import { cn } from "@/lib/utils";
import { Table, TableHeader, TableBody, TableHead, TableRow, TableCell } from "./table";
import { TABLE_LAYOUT } from "./table-constants";
import { useScrollbarWidth } from "@/hooks/use-scrollbar-width";
import { Checkbox } from "./checkbox";

interface TableWrapperProps {
  className?: string;
  headerContent: React.ReactNode;
  bodyContent: React.ReactNode;
  footerContent?: React.ReactNode;
}

/**
 * TableWrapper provides a consistent layout for tables with fixed header and scrollable body
 *
 * @example
 * ```tsx
 * <TableWrapper
 *   headerContent={
 *     <Table>
 *       <TableHeader>
 *         <TableRow>
 *           <TableHead>Column 1</TableHead>
 *           <TableHead>Column 2</TableHead>
 *         </TableRow>
 *       </TableHeader>
 *     </Table>
 *   }
 *   bodyContent={
 *     <Table>
 *       <TableBody>
 *         {items.map((item) => (
 *           <TableRow key={item.id}>
 *             <TableCell>{item.field1}</TableCell>
 *             <TableCell>{item.field2}</TableCell>
 *           </TableRow>
 *         ))}
 *       </TableBody>
 *     </Table>
 *   }
 *   footerContent={
 *     <div className="p-4">
 *       <Pagination />
 *     </div>
 *   }
 * />
 * ```
 */
export function TableWrapper({ className, headerContent, bodyContent, footerContent }: TableWrapperProps) {
  return (
    <div className={cn("rounded-lg flex flex-col overflow-hidden", className)}>
      {/* Fixed Header */}
      <div className="border-l border-r border-t border-border rounded-t-lg overflow-hidden">{headerContent}</div>

      {/* Scrollable Body */}
      <div className="flex-1 overflow-y-auto overflow-x-hidden border-l border-r border-border">{bodyContent}</div>

      {/* Footer */}
      {footerContent && <div className="border-l border-r border-b border-border rounded-b-lg bg-muted/50">{footerContent}</div>}
    </div>
  );
}

interface DataTableProps<T> {
  columns: {
    key: string;
    header: string | React.ReactNode;
    accessor: (item: T) => React.ReactNode;
    className?: string;
    align?: "left" | "center" | "right";
    sortable?: boolean;
  }[];
  data: T[];
  getItemKey: (item: T) => string;
  onRowClick?: (item: T) => void;
  isSelected?: (item: T) => boolean;
  onSelectionChange?: (item: T) => void;
  className?: string;
  emptyMessage?: string;
  footerContent?: React.ReactNode;
  showCheckbox?: boolean;
  onSelectAll?: () => void;
  allSelected?: boolean;
  someSelected?: boolean;
}

/**
 * DataTable provides a complete table implementation with consistent styling
 *
 * @example
 * ```tsx
 * <DataTable
 *   columns={[
 *     { key: "name", header: "Name", accessor: (item) => item.name },
 *     { key: "email", header: "Email", accessor: (item) => item.email },
 *   ]}
 *   data={users}
 *   getItemKey={(user) => user.id}
 *   onRowClick={(user) => navigate(`/users/${user.id}`)}
 * />
 * ```
 */
export function ScrollableDataTable<T>({
  columns,
  data,
  getItemKey,
  onRowClick,
  isSelected,
  onSelectionChange,
  className,
  emptyMessage = "Nenhum item encontrado",
  footerContent,
  showCheckbox = false,
  onSelectAll,
  allSelected = false,
  someSelected = false,
}: DataTableProps<T>) {
  const { width: scrollbarWidth, isOverlay } = useScrollbarWidth();

  if (data.length === 0) {
    return (
      <div className="border border-border rounded-lg p-8 text-center text-muted-foreground bg-card">
        <div className="text-lg font-medium">{emptyMessage}</div>
      </div>
    );
  }

  return (
    <TableWrapper
      className={className}
      headerContent={
        <Table className={cn("w-full [&>div]:border-0 [&>div]:rounded-none", TABLE_LAYOUT.tableLayout)}>
          <TableHeader>
            <TableRow>
              {showCheckbox && (
                <TableHead className={cn(TABLE_LAYOUT.checkbox.className, "p-0")}>
                  <div className="flex items-center justify-center h-full w-full px-2 py-2">
                    <Checkbox checked={allSelected} indeterminate={someSelected} onCheckedChange={onSelectAll} disabled={data.length === 0} />
                  </div>
                </TableHead>
              )}
              {columns.map((column) => (
                <TableHead key={column.key} className={cn("p-0", column.className, column.align === "center" && "text-center", column.align === "right" && "text-right")}>
                  <div
                    className={cn("flex items-center h-full min-h-[2.5rem] px-4 py-2", column.align === "center" && "justify-center", column.align === "right" && "justify-end")}
                  >
                    {column.header}
                  </div>
                </TableHead>
              ))}
              {!isOverlay && <TableHead style={{ width: `${scrollbarWidth}px`, minWidth: `${scrollbarWidth}px` }} className="p-0 border-0 shrink-0" />}
            </TableRow>
          </TableHeader>
        </Table>
      }
      bodyContent={
        <Table className={cn("w-full [&>div]:border-0 [&>div]:rounded-none", TABLE_LAYOUT.tableLayout)}>
          <TableBody>
            {data.map((item, _index) => {
              const key = getItemKey(item);
              const selected = isSelected?.(item) ?? false;

              return (
                <TableRow key={key} data-state={selected ? "selected" : undefined} className={cn(onRowClick && "cursor-pointer")} onClick={() => onRowClick?.(item)}>
                  {showCheckbox && (
                    <TableCell className={cn(TABLE_LAYOUT.checkbox.className, "p-0")}>
                      <div
                        className="flex items-center justify-center h-full w-full px-2 py-2"
                        onClick={(e) => {
                          e.stopPropagation();
                          onSelectionChange?.(item);
                        }}
                      >
                        <Checkbox checked={selected} onCheckedChange={() => onSelectionChange?.(item)} />
                      </div>
                    </TableCell>
                  )}
                  {columns.map((column) => (
                    <TableCell key={column.key} className={cn("p-0", column.className, column.align === "center" && "text-center", column.align === "right" && "text-right")}>
                      <div className="px-4 py-2">{column.accessor(item)}</div>
                    </TableCell>
                  ))}
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      }
      footerContent={footerContent}
    />
  );
}
