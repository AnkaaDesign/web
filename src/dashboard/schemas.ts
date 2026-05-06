// Zod schemas for dashboard layout persistence.
//
// These validate the layout JSON read from / written to Preferences.dashboardLayoutWeb.
// They are intentionally permissive on `config` (z.unknown) — each widget's own
// config schema validates that field separately at the boundary.

import { z } from "zod";
import { DASHBOARD_LAYOUT_VERSION, WIDGET_COL_VALUES, WIDGET_ROW_VALUES } from "./types";
import type { DashboardLayout, WidgetInstance } from "./types";

export const widgetSizeSchema = z.object({
  cols: z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4)]),
  rows: z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4)]),
});

export const widgetInstanceSchema = z.object({
  instanceId: z.string().min(1),
  widgetId: z.string().min(1),
  size: widgetSizeSchema,
  config: z.unknown(),
});

// NOTE: Don't annotate with `z.ZodType<DashboardLayout>` — the inferred shape
// includes WidgetInstance.config typed as `unknown` from `z.unknown()`, which
// fails to match the explicit type's invariance. The runtime parse + type
// assertion in `parseLayout` is what guarantees DashboardLayout shape.
export const dashboardLayoutSchema = z.object({
  version: z.number().int().min(1),
  updatedAt: z.string().min(1),
  items: z.array(widgetInstanceSchema),
});

/**
 * Best-effort parse of an unknown value into a DashboardLayout.
 * Returns null when the input doesn't match — caller falls back to a preset.
 */
export function parseLayout(value: unknown): DashboardLayout | null {
  if (value == null) return null;
  const result = dashboardLayoutSchema.safeParse(value);
  if (!result.success) return null;
  return result.data as DashboardLayout;
}

/**
 * Build an empty layout (no widgets). Useful as a starting state when no preset matches.
 */
export function emptyLayout(): DashboardLayout {
  return {
    version: DASHBOARD_LAYOUT_VERSION,
    updatedAt: new Date().toISOString(),
    items: [],
  };
}

/**
 * Re-export the literal arrays so other modules can iterate sizes consistently.
 */
export { WIDGET_COL_VALUES, WIDGET_ROW_VALUES };

export type { WidgetInstance };
