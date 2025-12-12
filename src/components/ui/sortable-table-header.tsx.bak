import { TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import { TableHeaderCell } from "@/components/ui/table-header-cell";
import { TABLE_LAYOUT } from "@/components/ui/table-constants";
import { cn } from "@/lib/utils";

export interface SortableColumnConfig {
  key: string;
  header: string;
  sortable?: boolean;
  className?: string;
  align?: "left" | "center" | "right";
}

interface SortableTableHeaderProps {
  columns: SortableColumnConfig[];
  visibleColumns: Set<string>;
  showCheckbox?: boolean;
  allSelected?: boolean;
  partiallySelected?: boolean;
  onSelectAll?: () => void;
  onSort?: (columnKey: string) => void;
  getSortDirection?: (columnKey: string) => "asc" | "desc" | null;
  getSortOrder?: (columnKey: string) => number | null;
  showMultipleSortOrder?: boolean;
  scrollbarWidth?: number;
  isOverlayScrollbar?: boolean;
  className?: string;
}

/**
 * Standardized sortable table header component
 * Provides consistent header styling, uppercase titles, and sort functionality
 */
export function SortableTableHeader({
  columns,
  visibleColumns,
  showCheckbox = true,
  allSelected = false,
  partiallySelected = false,
  onSelectAll,
  onSort,
  getSortDirection,
  getSortOrder,
  showMultipleSortOrder = false,
  scrollbarWidth = 0,
  isOverlayScrollbar = true,
  className,
}: SortableTableHeaderProps) {
  // Filter columns based on visibility
  const filteredColumns = columns.filter((col) => visibleColumns.has(col.key));

  // Determine if we have multiple sorts active
  const hasMultipleSorts = getSortOrder ? columns.some((col) => getSortOrder(col.key) !== null && getSortOrder(col.key)! > 0) : false;

  return (
    <TableHeader className={cn("[&_tr]:border-b-0 [&_tr]:hover:bg-muted", className)}>
      <TableRow className="bg-muted hover:bg-muted even:bg-muted">
        {/* Selection checkbox column */}
        {showCheckbox && (
          <TableHead className={cn(TABLE_LAYOUT.checkbox.className, "whitespace-nowrap text-foreground font-bold uppercase text-xs bg-muted !border-r-0 p-0")}>
            <div className="flex items-center justify-center h-full w-full px-2">
              <Checkbox checked={allSelected} indeterminate={partiallySelected} onCheckedChange={onSelectAll} aria-label="Selecionar todos" />
            </div>
          </TableHead>
        )}

        {/* Data columns */}
        {filteredColumns.map((column) => (
          <TableHeaderCell
            key={column.key}
            className={cn("border-r border-border last:border-r-0", column.className)}
            sortable={column.sortable}
            sortDirection={getSortDirection ? getSortDirection(column.key) : null}
            sortOrder={getSortOrder ? getSortOrder(column.key) : null}
            showMultipleSortOrder={showMultipleSortOrder && hasMultipleSorts}
            align={column.align}
            onSort={() => onSort && onSort(column.key)}
          >
            {column.header}
          </TableHeaderCell>
        ))}

        {/* Scrollbar spacer - only show if not overlay scrollbar */}
        {!isOverlayScrollbar && scrollbarWidth > 0 && (
          <TableHead
            style={{
              width: `${scrollbarWidth}px`,
              minWidth: `${scrollbarWidth}px`,
            }}
            className="bg-muted p-0 border-0 !border-r-0 shrink-0"
          />
        )}
      </TableRow>
    </TableHeader>
  );
}
