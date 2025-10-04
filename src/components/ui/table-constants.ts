// Standard table layout constants for consistent column positioning
export const TABLE_LAYOUT = {
  // Checkbox column - always 48px (w-12) for consistent narrow width with padding
  checkbox: {
    width: "w-12",
    minWidth: "min-w-12",
    maxWidth: "max-w-12",
    className: "w-12 min-w-12 max-w-12 shrink-0",
    cellPadding: "px-2", // Small horizontal padding for checkbox cells
  },

  // First data column (after checkbox) - standardized width
  firstDataColumn: {
    width: "w-48",
    minWidth: "min-w-48",
    maxWidth: "max-w-48",
    className: "w-48 min-w-48 max-w-48",
  },

  // Table layout class
  tableLayout: "table-fixed",
} as const;

// Helper function to get standardized column classes
export function getColumnClassName(columnIndex: number, customClass?: string): string {
  // First data column (index 0 after checkbox)
  if (columnIndex === 0) {
    return `${TABLE_LAYOUT.firstDataColumn.className} ${customClass || ""}`.trim();
  }

  // Other columns use their custom classes
  return customClass || "";
}
