import { cn } from "@/lib/utils";

// CSS utility classes for consistent table styling — aligned with the
// app-wide pattern (see paint-type-table, order-table, warning-table).
export const tableStyles = {
  // Container styles
  container: "flex flex-col h-full overflow-hidden",
  scrollContainer: "flex-1 overflow-auto border border-border rounded-lg",

  // Table structure
  table: "w-full border-collapse",

  // Header styles
  thead: "sticky top-0 z-20 bg-muted",
  theadRow: "border-b border-border",
  th: "text-left text-foreground font-bold uppercase text-xs px-4 py-2 border-r border-border bg-muted",
  thSticky: "sticky left-0 bg-muted z-30",
  thCenter: "text-center text-foreground font-bold uppercase text-xs px-4 py-2 border-r border-border bg-muted",

  // Body styles
  tbody: "",
  tr: "border-b border-border transition-colors",
  td: "p-1 border-r border-border",
  tdSticky: "sticky left-0 bg-inherit z-10",
  tdCenter: "text-center p-1 border-r border-border",

  // Column widths
  dateColumn: "w-[150px] min-w-[150px] max-w-[150px]",
  timeColumn: "w-32 min-w-32 max-w-32",
  checkboxColumn: "w-28 min-w-28 max-w-28",

  // Row states
  rowModified: "bg-yellow-50 dark:bg-yellow-900/20",
  rowWeekend: "bg-red-50/60 dark:bg-red-900/10",
  rowEven: "bg-muted/10",

  // Cell states
  cellModified: "bg-yellow-100 dark:bg-yellow-900/30",
  cellHighlight: "bg-muted/20",

  // Form elements
  inputContainer: "flex items-center gap-0.5 justify-center min-w-[100px]",
  timeInput: "h-8 w-14 text-center px-1 flex-shrink-0",
  arrowButton: "h-6 w-6 p-0",
  arrowButtonContainer: "w-6 flex justify-center",
  checkboxContainer: "flex justify-center",
};

// Highlighting utilities
export const highlightingClasses = {
  // Modification highlighting
  modified: "bg-yellow-50 dark:bg-yellow-900/20",
  modifiedCell: "bg-yellow-100 dark:bg-yellow-900/30",

  // Weekend highlighting
  weekend: "bg-red-50/60 dark:bg-red-900/10",

  // Selection highlighting
  selected: "bg-muted/30",

  // Hover states
  hoverRow: "hover:bg-muted/20",
  hoverCell: "hover:bg-muted/20",

  // Focus states
  focusCell: "focus-within:ring-2 focus-within:ring-ring/30",
};

// Responsive utilities
export const responsiveClasses = {
  // Mobile adjustments
  mobile: {
    hideOnMobile: "hidden sm:table-cell",
    showOnMobile: "table-cell sm:hidden",
    mobileStack: "sm:flex sm:flex-col",
  },

  // Tablet adjustments
  tablet: {
    hideOnTablet: "hidden md:table-cell",
    showOnTablet: "table-cell md:hidden",
  },
};

// Animation utilities
export const animationClasses = {
  // Smooth transitions
  transition: "transition-all duration-200 ease-in-out",
  fadeIn: "animate-in fade-in duration-300",
  slideIn: "animate-in slide-in-from-top duration-300",

  // Loading states
  pulse: "animate-pulse",
  spin: "animate-spin",

  // Highlight animations
  flash: "animate-pulse duration-1000",
  bounce: "animate-bounce",
};

// Helper component for consistent table cell rendering
interface TableCellProps {
  children: React.ReactNode;
  className?: string;
  isModified?: boolean;
  isSticky?: boolean;
  isCenter?: boolean;
  onContextMenu?: (e: React.MouseEvent) => void;
}

export function TableCell({ children, className, isModified = false, isSticky = false, isCenter = false, onContextMenu }: TableCellProps) {
  return (
    <td
      className={cn(
        isCenter ? tableStyles.tdCenter : tableStyles.td,
        isSticky && tableStyles.tdSticky,
        isModified && highlightingClasses.modifiedCell,
        highlightingClasses.hoverCell,
        highlightingClasses.focusCell,
        className,
      )}
      onContextMenu={onContextMenu}
    >
      {children}
    </td>
  );
}

// Helper component for consistent table row rendering
interface TableRowProps {
  children: React.ReactNode;
  className?: string;
  isModified?: boolean;
  isWeekend?: boolean;
  isEven?: boolean;
  onContextMenu?: (e: React.MouseEvent) => void;
}

export function TableRow({ children, className, isModified = false, isWeekend = false, isEven = false, onContextMenu }: TableRowProps) {
  return (
    <tr
      className={cn(
        tableStyles.tr,
        isModified && highlightingClasses.modified,
        isWeekend && highlightingClasses.weekend,
        !isModified && !isWeekend && isEven && tableStyles.rowEven,
        highlightingClasses.hoverRow,
        animationClasses.transition,
        className,
      )}
      onContextMenu={onContextMenu}
    >
      {children}
    </tr>
  );
}
