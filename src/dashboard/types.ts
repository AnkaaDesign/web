// Widget dashboard types — shared across the dashboard module.
//
// Layout model: an ordered list of widget instances. Each instance has a discrete
// size (cols × rows). The grid uses CSS auto-flow to place items, so x/y are
// derived from order — no absolute positioning. This keeps the data model trivial
// to serialize, drag-reorder, and validate.

import type { ComponentType } from "react";
import type { z } from "zod";
import { SECTOR_PRIVILEGES } from "../constants";

// ---------- Size ----------

export type WidgetCols = 1 | 2 | 3 | 4;
export type WidgetRows = 1 | 2 | 3 | 4;

export interface WidgetSize {
  cols: WidgetCols;
  rows: WidgetRows;
}

export const WIDGET_COL_VALUES: readonly WidgetCols[] = [1, 2, 3, 4] as const;
export const WIDGET_ROW_VALUES: readonly WidgetRows[] = [1, 2, 3, 4] as const;

// ---------- Categories ----------

export type WidgetCategory =
  | "inventory"
  | "hr"
  | "production"
  | "financial"
  | "other";

// Order here = order shown in the gallery tabs.
export const WIDGET_CATEGORY_LABELS: Record<WidgetCategory, string> = {
  inventory: "Estoque",
  hr: "Departamento Pessoal",
  production: "Produção",
  financial: "Financeiro",
  other: "Outros",
};

// ---------- Widget definition ----------

export interface WidgetRenderProps<TConfig = unknown> {
  instanceId: string;
  config: TConfig;
  size: WidgetSize;
  isEditing: boolean;
}

export interface WidgetConfigProps<TConfig = unknown> {
  config: TConfig;
  onChange: (next: TConfig) => void;
}

export interface WidgetDefinition<TConfig = unknown> {
  /** Stable identifier — used as FK from layout instances. Format: "namespace.name" */
  id: string;
  /** Short display name shown in the picker and as widget header. */
  name: string;
  /** One-line description for the picker. */
  description: string;
  /** Icon component (lucide-react or @tabler/icons-react accept the same prop shape). */
  icon: ComponentType<{ className?: string; size?: number }>;
  /** Category — used to group widgets in the picker. */
  category: WidgetCategory;
  /** Sectors that can use this widget. Use `"*"` to allow everyone. ADMIN always bypasses. */
  allowedSectors: SECTOR_PRIVILEGES[] | "*";
  /** Sectors explicitly blocked from this widget — takes precedence over allowedSectors and the ADMIN bypass. */
  blockedSectors?: SECTOR_PRIVILEGES[];
  /** Default size when first added. */
  defaultSize: WidgetSize;
  /** Minimum size constraint (user can't shrink below this). */
  minSize: WidgetSize;
  /** Maximum size constraint (user can't grow beyond this). */
  maxSize: WidgetSize;
  /**
   * Zod schema validating the config payload. Use `z.object({})` if no config.
   * Typed with `any` for input/def so widgets can use `.default()` without
   * having to fight the Output ≠ Input variance of ZodType.
   */
  configSchema: z.ZodType<TConfig, z.ZodTypeDef, any>;
  /** Default config used for new instances and as a fallback when validation fails. */
  defaultConfig: TConfig;
  /** Lazy-loaded render component. The widget body. */
  RenderComponent: ComponentType<WidgetRenderProps<TConfig>>;
  /** Optional custom config component. If omitted, a DynamicFormField is auto-generated from configSchema. */
  ConfigComponent?: ComponentType<WidgetConfigProps<TConfig>>;
}

// ---------- Layout instance ----------

export interface WidgetInstance {
  /** UUID — unique per instance. Allows the same widget twice with different configs. */
  instanceId: string;
  /** FK to WidgetDefinition.id */
  widgetId: string;
  /** Discrete size (cols × rows). */
  size: WidgetSize;
  /** Widget-specific config (validated against widget.configSchema). */
  config: unknown;
}

// ---------- Layout document ----------

export const DASHBOARD_LAYOUT_VERSION = 1;

export interface DashboardLayout {
  /** Schema version — bumped when the shape changes. Old layouts are migrated lazily. */
  version: number;
  /** ISO timestamp of last save. Used for last-write-wins conflict resolution. */
  updatedAt: string;
  /** Ordered list of widgets. Order determines render position (CSS auto-flow). */
  items: WidgetInstance[];
}
