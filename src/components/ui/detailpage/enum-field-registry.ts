import type { EnumEditConfig } from "./detail-page-types";

/**
 * Tiny helper to declare an enum field's edit config — the option set + labels +
 * badge entity (for colors) + an optional state machine. Pair it with `dataType: "enum"`:
 *
 *   import { TASK_STATUS, TASK_STATUS_LABELS } from "@/constants";
 *   const statusEnum = defineEnum(Object.values(TASK_STATUS), TASK_STATUS_LABELS, "TASK");
 *   // field: { id:"status", dataType:"enum", edit: { get, onCommit, enum: statusEnum } }
 *
 * `badgeEntity` is the key passed to `getBadgeVariant(value, badgeEntity)` so the
 * value renders (and the combobox options/trigger render) with the app's standard colors.
 */
export function defineEnum<TData = unknown>(
  values: readonly string[],
  labels: Record<string, string>,
  badgeEntity?: string,
  transitions?: (current: string, row: TData) => readonly string[],
): EnumEditConfig<TData> {
  return { values, labels, badgeEntity, transitions };
}
