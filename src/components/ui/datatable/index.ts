// Generic, performant, server-persisted table-page system (TanStack Table v8 +
// TanStack Virtual). See table-page.tsx / data-table.tsx for the entry points.

export { DataTable } from "./data-table";
export type { DataTableProps, DataTableRowClickMeta } from "./data-table";
export { DataTablePage } from "./table-page";
export type { DataTablePageProps } from "./table-page";
export { useDataTable } from "./use-data-table";
export { useScrollHideHeader } from "./use-scroll-hide-header";
export { DataTableContextMenu } from "./data-table-context-menu";
export type { DataTableContextMenuState } from "./data-table-context-menu";
export { exportToXlsx, exportToPdf, copyShareLink } from "./data-table-export";
export {
  rawColumnValue,
  valueToString,
  columnHeaderText,
  countActiveFilters,
  formatFilterChipValue,
} from "./data-table-utils";

export type {
  DataTableColumnDef,
  DataTableMode,
  DataTableRowAction,
  DataTableFilterDef,
  DataTableFilterType,
  DataTableFilterOption,
  DataTableFilterValues,
  PersistedTableConfig,
  ExportCellValue,
} from "./data-table-types";
