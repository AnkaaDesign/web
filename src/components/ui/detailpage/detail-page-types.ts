import type { ComponentType, ReactNode } from "react";
import type { ComboboxOption } from "@/components/ui/combobox";
import type { ExportCellValue, PrivilegeGate } from "@/components/ui/datatable/data-table-types";

/**
 * Generic, performant, server-persisted detail-page system — the detail-page
 * analog of the DataTable system (components/ui/datatable). A page describes its
 * record as a list of SECTIONS, each holding key→value FIELDS. The engine
 * (use-detail-layout) owns section/field visibility + order + width + column with
 * precedence localStorage > server > defaults, persisting per-user to
 * Preferences.detailConfigsWeb[detailKey]. Fields can be inline-edited
 * (double-click) and gated by privilege — exactly the same `requiredPrivilege`
 * language the DataTable columns use.
 */

// Re-export the shared privilege/export primitives so consumers speak one language.
export type { PrivilegeGate, ExportCellValue };

/** The kind of value a field holds — drives both default display and the inline-edit widget. */
export type FieldDataType =
  | "text"
  | "textarea"
  | "number"
  | "integer"
  | "decimal"
  | "money"
  | "percentage"
  // Brazilian masked document/contact types — the editor renders the matching masked
  // `<Input type=...>` (formats while typing) and read-mode display formats the raw value.
  // The value persisted/read is ALWAYS the raw digits (the masked Input emits cleaned digits).
  | "cpf"
  | "cnpj"
  | "phone"
  | "pis"
  | "cep"
  | "date"
  | "datetime"
  | "time"
  | "boolean"
  | "enum"
  | "relation"
  | "multiselect"
  | "custom";

/** Enum field configuration: the option set, labels, badge colors, and optional state machine. */
export interface EnumEditConfig<TData = unknown> {
  /** Every possible value (the full option set). */
  values: readonly string[];
  /** value → human label. */
  labels: Record<string, string>;
  /** Badge entity key for color mapping — `getBadgeVariant(value, badgeEntity)`. */
  badgeEntity?: string;
  /**
   * Per-value Badge variant override (value → variant name), for enums NOT in the app's
   * ENTITY_BADGE_CONFIG registry. Takes precedence over `badgeEntity`.
   */
  variants?: Record<string, string>;
  /**
   * Optional state machine: restrict which values are selectable given the current
   * value/row (e.g. service-order transitions). The current value is always kept.
   */
  transitions?: (current: string, row: TData) => readonly string[];
}

/**
 * Inline-edit definition for a field. Omit on a field to make it read-only.
 * `onCommit` returns a promise; the field shows a pending state and reverts (with a
 * toast) if it rejects — so the consumer just wires it to a mutation.
 */
export interface InlineEditDef<TData = any, TValue = any> {
  /** Read the editable value from the record. */
  get: (row: TData) => TValue;
  /** Persist a new value. Return a promise to get pending UI + auto-revert on failure. */
  onCommit: (value: TValue, row: TData) => void | Promise<void>;
  /**
   * Optional async gate run AFTER validation (and the no-op check) but BEFORE `onCommit` —
   * e.g. open a confirm dialog or capture a reason for the change. Resolve `true` to proceed
   * to `onCommit`; resolve `false` to ABORT (the field reverts to its previous value with no
   * toast and no mutation). Throwing is treated as an abort.
   */
  beforeCommit?: (value: TValue, row: TData) => boolean | Promise<boolean>;
  /** enum fields: the option set + labels + colors (+ optional transitions). */
  enum?: EnumEditConfig<TData>;
  /** relation / multiselect: a static option list. */
  options?: ComboboxOption[];
  /** relation / multiselect: an async option loader (the Combobox `queryFn`). */
  loadOptions?: (search: string, page?: number) => Promise<{ data: ComboboxOption[]; hasMore?: boolean }>;
  /** number / money bounds. */
  min?: number;
  max?: number;
  step?: number;
  placeholder?: string;
  /** Optional client validation — return an error message to block the commit. */
  validate?: (value: TValue) => string | null;
}

/** A single label→value row inside a section. */
export interface DetailFieldDef<TData = any> {
  /** Stable, unique id (the visibility/persistence key). */
  id: string;
  label: ReactNode;
  /** Owning section id. Optional when the field is nested under `section.fields`. */
  sectionId?: string;
  icon?: ComponentType<{ className?: string }>;
  /** Drives the default display + the inline-edit widget. Defaults to "text". */
  dataType?: FieldDataType;
  /** Read the display value (also used for export). Defaults to `edit.get`. */
  accessor?: (row: TData) => unknown;
  /** Fully custom display — overrides the `dataType` default rendering. */
  render?: (row: TData) => ReactNode;
  /** Stack label above value (long-form text/lists). */
  block?: boolean;
  /** Visible by default (the user can still hide it). Defaults to true. */
  defaultVisible?: boolean;
  /** Cannot be hidden by the user. */
  required?: boolean;
  /**
   * Privilege gate (VIEW): hide this field ENTIRELY — render, the customize picker, AND
   * export — unless the user holds one of the privilege(s). ADMIN always passes; array = OR.
   */
  requiredPrivilege?: PrivilegeGate;
  /**
   * Privilege gate (EDIT): the field is visible per `requiredPrivilege`, but inline-editable
   * only if the user also holds one of these. ADMIN always passes; array = OR.
   */
  editablePrivilege?: PrivilegeGate;
  /** Inline-edit definition. Omit → read-only. */
  edit?: InlineEditDef<TData>;
  /** Export value override; defaults to the accessor value. */
  exportValue?: (row: TData) => ExportCellValue;
  excludeFromExport?: boolean;
}

/** A group of fields (and/or arbitrary content) rendered as a Card in the detail grid. */
export interface DetailSectionDef<TData = any> {
  /** Stable, unique id (the order/visibility/persistence key). */
  id: string;
  label: ReactNode;
  icon?: ComponentType<{ className?: string }>;
  /** Key→value fields. */
  fields?: DetailFieldDef<TData>[];
  /** Arbitrary content (embedded tables, galleries) rendered after the fields. */
  render?: (row: TData) => ReactNode;
  /** Make the section TITLE clickable (e.g. open the quote). Renders the title as a hover-underlined button. */
  onTitleClick?: (row: TData) => void;
  /**
   * Content rendered on the RIGHT of the section's title row (justify-between with the title) — e.g. an
   * item count, a "Baixar Todos"/"PDF"/"Visualizar" button. Use for embedded sections (files, layouts,
   * dossiê, billing) that need a count + actions aligned with the card title instead of inside the body.
   */
  headerActions?: (row: TData) => ReactNode;
  /** Visible by default (the user can still hide it). Defaults to true. */
  defaultVisible?: boolean;
  /** Cannot be hidden by the user. */
  required?: boolean;
  /**
   * Width in the layout: 1 = half, 2 = full. Consecutive half-width sections stack into a
   * 2-column masonry (a tall card sits beside shorter stacked cards); full-width sections
   * span the row. The user can override per-section width in the customize panel. Defaults to 1.
   */
  span?: 1 | 2;
  /**
   * "card" (default) wraps the section in a Card. "plain" renders just the title + content
   * with no card chrome — use when the content provides its own container (e.g. an embedded
   * DataTable) to avoid a card-in-a-card.
   */
  variant?: "card" | "plain";
  /**
   * How the section's rendered content is sized:
   * - `false` (default) → render at NATURAL/full height: the card grows to show EVERYTHING
   *   (use for data you must see fully — items tables, metrics, calculations).
   * - `true` → the content is height-bounded and scrolls INTERNALLY (use for logs/history you
   *   skim — changelog, activity lists). It fills the equal-height band, capped at `scrollHeight`.
   */
  scroll?: boolean;
  /** Max content height (px) when `scroll` is on. Defaults to ~440. */
  scrollHeight?: number;
  /** Privilege gate (VIEW) — see DetailFieldDef.requiredPrivilege. */
  requiredPrivilege?: PrivilegeGate;
  /** Privilege gate (EDIT) — applies to every editable field in the section. */
  editablePrivilege?: PrivilegeGate;
}

/**
 * The serializable per-user layout persisted server-side
 * (Preferences.detailConfigsWeb[detailKey]) with a localStorage mirror.
 */
export interface PersistedDetailConfig {
  sectionOrder?: string[];
  sectionVisibility?: Record<string, boolean>;
  fieldVisibility?: Record<string, boolean>;
  /** Per-section field order (sectionId → ordered field ids). */
  fieldOrder?: Record<string, string[]>;
  /** Per-section width override (1 = half, 2 = full); overrides the section's `span`. */
  widths?: Record<string, 1 | 2>;
  /** Per-section explicit column for half-width sections (1 = left, 2 = right); absent = auto-balance. */
  columns?: Record<string, 1 | 2>;
}
