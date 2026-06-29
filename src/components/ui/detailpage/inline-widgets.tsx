import type { ReactNode } from "react";
import { Badge, getBadgeVariantFromStatus } from "@/components/ui/badge";
import type { ComboboxOption } from "@/components/ui/combobox";
import { getBadgeColors } from "@/constants";
import { cn } from "@/lib/utils";
import { formatCurrency } from "@/utils/number";
import { formatDate, formatDateTime } from "@/utils/date";
import type { EnumEditConfig, FieldDataType, InlineEditDef } from "./detail-page-types";

// Display helpers accept the enum config structurally (just the bits they read) so they
// stay variance-free across any `EnumEditConfig<TData>`.
type EnumLabelConfig = { labels?: Record<string, string> };
type EnumColorConfig = { badgeEntity?: string; variants?: Record<string, string> };
type EnumBadgeConfig = EnumLabelConfig & EnumColorConfig;

/** value → human label for an enum field. */
export function enumLabel(value: string, cfg?: EnumLabelConfig): string {
  if (!value) return "";
  return cfg?.labels?.[value] ?? value;
}

/** value → Badge variant: a per-value `variants` override wins, else the registry by `badgeEntity`. */
export function enumVariant(value: string, cfg?: EnumColorConfig): ReturnType<typeof getBadgeVariantFromStatus> {
  return (cfg?.variants?.[value] as ReturnType<typeof getBadgeVariantFromStatus> | undefined) ?? getBadgeVariantFromStatus(value, cfg?.badgeEntity);
}

/** Mark every class token `!important` (after its variant prefix) so it beats the combobox's
 *  own `data-[state=open]:bg-accent` while the dropdown is open. */
function important(classes: string): string {
  return classes
    .split(/\s+/)
    .filter(Boolean)
    .map((c) => {
      const i = c.lastIndexOf(":");
      return i === -1 ? `!${c}` : `${c.slice(0, i + 1)}!${c.slice(i + 1)}`;
    })
    .join(" ");
}

/**
 * Full colored TRIGGER classes for an enum combobox — the entirely-filled look of the
 * service-order status selector (colored background + white text), not a badge-in-a-box.
 * bg/text are forced `!important` so the trigger stays colored even while the dropdown is open
 * (the combobox applies `data-[state=open]:bg-accent` otherwise).
 */
export function enumTriggerClass(value: string | null | undefined, cfg?: EnumColorConfig): string {
  if (value == null || value === "") return "";
  const c = getBadgeColors((enumVariant(value, cfg) ?? "default") as Parameters<typeof getBadgeColors>[0]);
  // `px-2.5` matches the read-only badge's horizontal padding (Badge default px-2.5) so the text
  // doesn't shift when swapping the badge ↔ the combobox trigger on edit.
  return cn("px-2.5 font-medium", important(c.bg), important(c.text), c.hover, c.border);
}

/** Render an enum value as the app's standard colored Badge. */
export function enumBadge(value: string | null | undefined, cfg?: EnumBadgeConfig, size?: "sm" | "default" | "lg"): ReactNode {
  if (value == null || value === "") return null;
  // Status badges share ONE fixed box (h-7 × 12rem) — the same as the inline-edit enum combobox —
  // so the badge↔combobox swap is seamless and badges line up in columns/lists. Truncates if needed.
  return (
    <Badge variant={enumVariant(value, cfg)} size={size} className="h-7 w-[12rem] justify-start">
      <span className="min-w-0 truncate">{enumLabel(value, cfg)}</span>
    </Badge>
  );
}

/** The combobox option list for an enum field (respecting an optional state machine). */
export function enumOptions<T>(cfg: EnumEditConfig<T>, current?: string | null, row?: T): ComboboxOption[] {
  let values = cfg.values;
  if (cfg.transitions && current != null) {
    const allowed = new Set<string>([current, ...cfg.transitions(current, row as T)]);
    values = cfg.values.filter((v) => allowed.has(v));
  }
  return values.map((v) => ({ value: v, label: enumLabel(v, cfg) }));
}

/**
 * Default read-only display for a value, by data type. Returns `undefined` for an
 * empty value so the host `DetailRow` shows its em-dash. `enum`/`boolean` always
 * render a Badge; `multiselect` renders chips.
 */
export function renderFieldValue<TData>(dataType: FieldDataType, value: unknown, edit?: InlineEditDef<TData>): ReactNode {
  const empty = value == null || value === "";
  switch (dataType) {
    case "money":
      return typeof value === "number" ? formatCurrency(value) : empty ? undefined : String(value);
    case "number":
    case "integer":
    case "decimal":
      return empty ? undefined : String(value);
    case "percentage":
      return empty ? undefined : `${value}%`;
    case "date":
      return empty ? undefined : formatDate(new Date(value as string | number | Date));
    case "datetime":
    case "time":
      return empty ? undefined : formatDateTime(new Date(value as string | number | Date));
    case "boolean":
      return <Badge variant={value ? "completed" : "secondary"}>{value ? "Sim" : "Não"}</Badge>;
    case "enum":
      return enumBadge(value as string, edit?.enum);
    case "multiselect": {
      const arr = Array.isArray(value) ? (value as unknown[]) : [];
      if (!arr.length) return undefined;
      const opts = edit?.options ?? [];
      const labelFor = (v: string) => opts.find((o) => o.value === v)?.label ?? v;
      return (
        <div className="flex flex-wrap justify-end gap-1">
          {arr.map((v) => (
            <Badge key={String(v)} variant="outline">
              {labelFor(String(v))}
            </Badge>
          ))}
        </div>
      );
    }
    case "relation": {
      const opts = edit?.options ?? [];
      const found = opts.find((o) => o.value === value);
      return found ? found.label : empty ? undefined : String(value);
    }
    case "textarea":
    case "text":
    case "custom":
    default:
      return empty ? undefined : String(value);
  }
}
