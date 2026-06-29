import { formatDate } from "@/utils/date";
import { formatCurrency } from "@/utils/number";
import type {
  DataTableColumnDef,
  DataTableFilterDef,
  DataTableFilterValues,
  ExportCellValue,
} from "./data-table-types";

type Primitive = string | number | boolean | Date | null | undefined;

/** Read a possibly-dotted path (e.g. "supplier.fantasyName") off a row. */
export function getByPath(obj: unknown, path: string): unknown {
  return path.split(".").reduce<unknown>((acc, key) => {
    if (acc == null || typeof acc !== "object") return undefined;
    return (acc as Record<string, unknown>)[key];
  }, obj);
}

/** Strip accents + lowercase for accent-insensitive matching. */
export function normalizeText(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();
}

/** Render a primitive as plain text (for search + PDF). */
export function valueToString(v: Primitive): string {
  if (v === null || v === undefined) return "";
  if (v instanceof Date) return formatDate(v);
  if (typeof v === "boolean") return v ? "Sim" : "Não";
  return String(v);
}

/**
 * The plain value(s) of a column for a row — `meta.exportValue` when provided,
 * else the column's `accessorKey` path. Used by both client search/filter and export.
 */
export function rawColumnValue<TData>(col: DataTableColumnDef<TData>, row: TData): ExportCellValue {
  if (col.meta?.exportValue) return col.meta.exportValue(row);
  const accessorKey = (col as { accessorKey?: string }).accessorKey;
  if (typeof accessorKey === "string") return getByPath(row, accessorKey) as ExportCellValue;
  return undefined;
}

/** Whether a row matches the global search query across all searchable columns. */
export function rowMatchesSearch<TData>(
  row: TData,
  columns: DataTableColumnDef<TData>[],
  query: string,
): boolean {
  if (!query) return true;
  const q = normalizeText(query);
  return columns.some((col) => {
    const v = rawColumnValue(col, row);
    if (Array.isArray(v)) return v.some((x) => normalizeText(valueToString(x)).includes(q));
    return normalizeText(valueToString(v)).includes(q);
  });
}

function filterFieldValue<TData>(def: DataTableFilterDef<TData>, row: TData): unknown {
  return def.accessor ? def.accessor(row) : getByPath(row, def.key);
}

export function isEmptyFilter(value: unknown): boolean {
  if (value == null || value === "") return true;
  if (Array.isArray(value)) return value.length === 0;
  if (typeof value === "object") {
    const v = value as Record<string, unknown>;
    return Object.values(v).every((x) => x == null || x === "");
  }
  return false;
}

/** Client-mode filtering: every active filter must pass. */
export function rowMatchesFilters<TData>(
  row: TData,
  defs: DataTableFilterDef<TData>[],
  values: DataTableFilterValues,
): boolean {
  return defs.every((def) => {
    const fv = values[def.key];
    if (isEmptyFilter(fv)) return true;
    const rv = filterFieldValue(def, row);
    switch (def.type) {
      case "select":
        return String(rv) === String(fv);
      case "multiselect":
        return Array.isArray(fv) && fv.map(String).includes(String(rv ?? ""));
      case "boolean":
        return Boolean(rv) === (fv === true || fv === "true");
      case "text":
        return normalizeText(valueToString(rv as Primitive)).includes(normalizeText(String(fv)));
      case "number-range": {
        const { min, max } = fv as { min?: number; max?: number };
        const n = Number(rv);
        if (Number.isNaN(n)) return false;
        return (min == null || n >= min) && (max == null || n <= max);
      }
      case "date-range": {
        const { from, to } = fv as { from?: string | Date; to?: string | Date };
        const t = rv ? new Date(rv as string | Date).getTime() : NaN;
        if (Number.isNaN(t)) return false;
        return (!from || t >= new Date(from).getTime()) && (!to || t <= new Date(to).getTime());
      }
      default:
        return true;
    }
  });
}

/** Count of non-empty active filters (for the toolbar badge). */
export function countActiveFilters(values: DataTableFilterValues): number {
  return Object.values(values).filter((v) => !isEmptyFilter(v)).length;
}

/** Short text header for a column, for the column/share pickers. */
export function columnHeaderText<TData>(col: DataTableColumnDef<TData>): string {
  return col.meta?.headerLabel ?? col.meta?.exportHeader ?? (typeof col.header === "string" ? col.header : col.id);
}

/** Human-readable rendering of an active filter value, for the filter chips. */
export function formatFilterChipValue<TData>(def: DataTableFilterDef<TData>, value: unknown): string {
  if (def.formatValue) return def.formatValue(value);
  switch (def.type) {
    case "select":
      return def.options?.find((o) => o.value === String(value))?.label ?? String(value);
    case "multiselect": {
      const arr = Array.isArray(value) ? value : [];
      return arr.map((v) => def.options?.find((o) => o.value === String(v))?.label ?? String(v)).join(", ");
    }
    case "boolean":
      return value === true || value === "true" ? "Sim" : "Não";
    case "text":
      return String(value ?? "");
    case "number-range": {
      const { min, max } = (value as { min?: number; max?: number }) ?? {};
      const fmt = (n: number) => (def.currency ? formatCurrency(n) : String(n));
      if (min != null && max != null) return `${fmt(min)} – ${fmt(max)}`;
      if (min != null) return `a partir de ${fmt(min)}`;
      if (max != null) return `até ${fmt(max)}`;
      return "";
    }
    case "date-range": {
      const { from, to } = (value as { from?: string; to?: string }) ?? {};
      const f = from ? formatDate(new Date(from)) : null;
      const t = to ? formatDate(new Date(to)) : null;
      if (f && t) return `${f} – ${t}`;
      if (f) return `a partir de ${f}`;
      if (t) return `até ${t}`;
      return "";
    }
    default:
      return String(value ?? "");
  }
}
