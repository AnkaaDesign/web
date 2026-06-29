import type { ColumnDef, RowData, Table, Row } from "@tanstack/react-table";
import type { ReactNode } from "react";
import type { SECTOR_PRIVILEGES } from "@/constants";

/**
 * Privilege gate for a column / filter / row-action: a single privilege or an OR-list.
 * Semantics match the app everywhere — ADMIN always passes; everyone else needs an exact
 * match (membership). A gated item is removed entirely for a user who lacks the privilege.
 */
export type PrivilegeGate = SECTOR_PRIVILEGES | SECTOR_PRIVILEGES[];

/**
 * A single plain value (or list of values) extracted from a row for export.
 * Columns can hold arrays of heterogeneous data, so exports support multi-values.
 */
export type ExportCellValue =
  | string
  | number
  | boolean
  | Date
  | null
  | undefined
  | Array<string | number | boolean | Date | null | undefined>;

// ---------------------------------------------------------------------------
// Typed column metadata — augment TanStack's ColumnMeta so `columnDef.meta` is
// strongly typed everywhere (the idiomatic v8 approach). This carries the
// export-only concerns (plain value, header label, alignment) that the display
// `cell`/`header` renderers don't expose.
// ---------------------------------------------------------------------------
declare module "@tanstack/react-table" {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  interface ColumnMeta<TData extends RowData, TValue> {
    /** Plain value(s) for export. Falls back to the cell's string value when omitted. */
    exportValue?: (row: TData) => ExportCellValue;
    /** Header label used in exports + the share/column pickers (when `header` is JSX). */
    exportHeader?: string;
    /** Horizontal alignment of the cell + header content. */
    align?: "left" | "center" | "right";
    /** Whether the column is visible by default (defaults to true). */
    defaultVisible?: boolean;
    /** Short text header for the column-visibility / share pickers when `header` is JSX. */
    headerLabel?: string;
    /** Exclude this column entirely from export (e.g. a pure "actions" column). */
    excludeFromExport?: boolean;
    /**
     * Privilege gate — hide this column ENTIRELY (header, cells, the column-visibility
     * option, AND export) unless the current user holds one of the privilege(s). ADMIN
     * always passes. For a monetary column, just list the sectors allowed to see it (omit
     * WAREHOUSE). The column never reaches the table/picker/export for a user who lacks it.
     */
    requiredPrivilege?: PrivilegeGate;
  }
}

/**
 * Column definition consumed by `<DataTable>`. It is a TanStack `ColumnDef` with
 * a required, stable `id` (the persistence + reorder + sizing keys all derive
 * from it) plus the augmented `meta` above.
 */
export type DataTableColumnDef<TData> = ColumnDef<TData, unknown> & { id: string };

/**
 * The serializable per-user layout persisted server-side (Preferences.tableConfigsWeb[tableId])
 * with a localStorage mirror. NOTE: never includes ephemeral resize-drag state
 * (`columnSizingInfo`) — only the resolved `columnSizing`.
 */
export type ColumnAlign = "left" | "center" | "right";

export interface PersistedTableConfig {
  columnOrder?: string[];
  columnSizing?: Record<string, number>;
  columnVisibility?: Record<string, boolean>;
  /** Per-column horizontal alignment chosen by the user (overrides the column's `meta.align`). */
  columnAlignment?: Record<string, ColumnAlign>;
  rowPinning?: { top?: string[] };
  pageSize?: number;
  /** Saved default sort — the URL overrides this when present. */
  sorting?: Array<{ id: string; desc: boolean }>;
  /** Per-row expanded state (rowId → true), persisted only when `persistExpansion` is on. */
  expanded?: Record<string, boolean>;
}

/**
 * Per-sector default layout overrides, applied ONLY when the user has no saved config
 * (no server config, no localStorage, no interaction). Keyed by the user's single sector
 * privilege; the resolved entry sits in the precedence chain just below server config and
 * above the hardcoded `meta.defaultVisible` defaults. Omit a key (e.g. ADMIN) to fall back
 * to the hardcoded defaults for that sector.
 */
export type SectorDefaults = Partial<Record<SECTOR_PRIVILEGES, Partial<PersistedTableConfig>>>;

export type DataTableMode = "client" | "server";

/** A right-click context-menu action. Receives the rows it applies to (single or bulk selection). */
export interface DataTableRowAction<TData> {
  key: string;
  label: ReactNode;
  icon?: ReactNode;
  onClick: (rows: TData[]) => void;
  variant?: "default" | "destructive";
  disabled?: (rows: TData[]) => boolean;
  hidden?: (rows: TData[]) => boolean;
  /** Render a separator above this item. */
  separatorBefore?: boolean;
  /**
   * Collapse this action into a labeled SUBMENU (e.g. "Avançados"). Every action that shares the
   * same `group.id` is rendered inside one nested submenu, placed at the position of the group's
   * FIRST action in the list. Ungrouped actions render at the top level. Lets a page keep its
   * primary actions short while tucking occasional/per-sector ones into a submenu.
   */
  group?: { id: string; label: ReactNode; icon?: ReactNode };
  /**
   * Privilege gate — omit this action from the context menu unless the current user holds
   * one of the privilege(s). ADMIN always passes; array = OR. (Static per-user, unlike
   * `hidden` which is per-row/dynamic.) The built-in pin/unpin actions are never gated.
   */
  requiredPrivilege?: PrivilegeGate;
}

// ---------------------------------------------------------------------------
// Declarative filters — pages describe filters as data; the generic filter
// sheet renders them and (in client mode) applies them.
// ---------------------------------------------------------------------------
export type DataTableFilterType =
  | "select"
  | "multiselect"
  | "boolean"
  | "text"
  | "number-range"
  | "date-range";

export interface DataTableFilterOption {
  value: string;
  label: string;
}

export interface DataTableFilterDef<TData = unknown> {
  /** Unique key; also the property read from a row in client mode unless `accessor` is given. */
  key: string;
  label: string;
  type: DataTableFilterType;
  icon?: ReactNode;
  /** Options for select / multiselect. */
  options?: DataTableFilterOption[];
  placeholder?: string;
  /** For `number-range`: render currency (R$) inputs and format the chip as currency. */
  currency?: boolean;
  /** Client-mode value extractor; defaults to `row[key]`. Ignored in server mode. */
  accessor?: (row: TData) => unknown;
  /** Pretty-print a filter's active value for the filter chips. */
  formatValue?: (value: unknown) => string;
  /**
   * Privilege gate — hide this filter (and its chip) unless the current user holds one of
   * the privilege(s). ADMIN always passes; array = OR.
   */
  requiredPrivilege?: PrivilegeGate;
}

/** The opaque, URL-serializable filter state: `{ [filterKey]: value }`. */
export type DataTableFilterValues = Record<string, unknown>;

export interface DataTableExportColumn {
  id: string;
  header: string;
  /** Display order chosen in the share dialog. */
}

/** Re-exports so consumers don't need to import from @tanstack directly. */
export type { Table, Row };
