// Shared helpers for widgets that wrap an existing home-dashboard list component.
// All these widgets pull from the same `useHomeDashboard` query — react-query
// dedupes the request so the call cost is one network round-trip regardless of
// how many widgets the user has configured.

import { createContext, useContext, useId, useMemo, useState, type ReactNode } from "react";
import { z } from "zod";
import { IconChevronDown } from "@tabler/icons-react";
import { useHomeDashboard } from "../../hooks/common/use-dashboard";
import type { HomeDashboardData } from "../../types";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "../../components/ui/collapsible";
import { Label } from "../../components/ui/label";
import { Input } from "../../components/ui/input";
import { Checkbox } from "../../components/ui/checkbox";
import { cn } from "../../lib/utils";

interface HomeDashboardWidgetBodyProps<TSlice> {
  selector: (data: HomeDashboardData) => TSlice;
  /** Render the slice. Slice may be empty/missing — let the wrapped component handle that. */
  children: (slice: TSlice) => ReactNode;
}

/**
 * Common loading + error skeleton for widgets driven by the home-dashboard query.
 * Existing list components handle their own empty state, so we don't need to
 * special-case "data is empty" here.
 */
export function HomeDashboardWidgetBody<TSlice>({
  selector,
  children,
}: HomeDashboardWidgetBodyProps<TSlice>) {
  const { data, isLoading, isError } = useHomeDashboard({ platform: "web" });

  if (isLoading) {
    return <div className="h-full w-full animate-pulse rounded-lg bg-muted/30" />;
  }
  if (isError || !data?.data) {
    return (
      <div className="h-full flex items-center justify-center text-sm text-muted-foreground">
        Não foi possível carregar este widget.
      </div>
    );
  }

  return <>{children(selector(data.data))}</>;
}

// ---------------------------------------------------------------------------
// Canonical config-modal primitives
//
// Every dashboard widget config modal renders the same vocabulary: collapsible
// sections, yes/no toggles, density pickers, sort direction, refresh interval,
// row limit. Centralising them here keeps the four modals visually and
// behaviourally identical.
// ---------------------------------------------------------------------------

// Coordinates which `Section` is open inside a single config form.
// When a SectionGroup wraps a tree of Sections, only one Section can be open
// at a time — opening another auto-closes the previous one. Without a wrapper,
// each Section behaves independently (backward-compatible with old configs).
interface SectionGroupContextValue {
  openId: string | null;
  setOpenId: (id: string | null) => void;
}
const SectionGroupContext = createContext<SectionGroupContextValue | null>(null);

export function SectionGroup({
  defaultOpenId,
  children,
}: {
  defaultOpenId?: string | null;
  children: ReactNode;
}) {
  const [openId, setOpenId] = useState<string | null>(defaultOpenId ?? null);
  const value = useMemo(() => ({ openId, setOpenId }), [openId]);
  return <SectionGroupContext.Provider value={value}>{children}</SectionGroupContext.Provider>;
}

/** Collapsible bordered section used as the building block of every config tab. */
export function Section({
  title,
  defaultOpen = false,
  icon,
  children,
}: {
  title: string;
  defaultOpen?: boolean;
  icon?: ReactNode;
  children: ReactNode;
}) {
  const ctx = useContext(SectionGroupContext);
  const id = useId();
  const [localOpen, setLocalOpen] = useState(defaultOpen);

  const open = ctx ? ctx.openId === id : localOpen;
  const setOpen = (next: boolean) => {
    if (ctx) {
      ctx.setOpenId(next ? id : null);
    } else {
      setLocalOpen(next);
    }
  };

  return (
    <Collapsible
      open={open}
      onOpenChange={setOpen}
      className="border border-border rounded-md"
    >
      <CollapsibleTrigger className="w-full flex items-center justify-between px-3 py-2 text-sm font-medium hover:bg-accent/50 [&[data-state=open]>svg]:rotate-180">
        <span className="flex items-center gap-2">
          {icon}
          {title}
        </span>
        <IconChevronDown className="h-4 w-4 transition-transform" />
      </CollapsibleTrigger>
      <CollapsibleContent className="px-3 pb-3 pt-1 space-y-3">{children}</CollapsibleContent>
    </Collapsible>
  );
}

export const YES_NO_OPTIONS: Array<{ value: "yes" | "no"; label: string }> = [
  { value: "yes", label: "Sim" },
  { value: "no", label: "Não" },
];

/**
 * Boolean field rendered as a full-width, clickable checkbox row. Canonical
 * control for any boolean config across every widget. The whole row is the hit
 * target (checkbox + label + hint), the checkbox sits on the left aligned to
 * the first text line, and selection state matches the column picker so the
 * config UI speaks one visual language. `role="switch"` + `aria-checked` carry
 * the state and the inner Checkbox is purely presentational (pointer-events-none
 * + aria-hidden + tabIndex=-1) to avoid double-toggling.
 */
export function ToggleRow({
  label,
  hint,
  checked,
  onCheckedChange,
  disabled = false,
}: {
  label: string;
  hint?: string;
  checked: boolean;
  onCheckedChange: (v: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onCheckedChange(!checked)}
      className={cn(
        "flex w-full gap-2.5 rounded-md px-2 py-1.5 text-left transition-colors",
        // Center the checkbox with a single-line label; only top-align when a
        // multi-line hint is present so it tracks the first line.
        hint ? "items-start" : "items-center",
        "hover:bg-accent/40 disabled:opacity-50 disabled:cursor-not-allowed",
      )}
    >
      <Checkbox
        checked={checked}
        disabled={disabled}
        tabIndex={-1}
        aria-hidden="true"
        className={cn("shrink-0 pointer-events-none", hint && "mt-0.5")}
      />
      <span className="min-w-0">
        <span className="block text-xs font-medium leading-tight text-foreground">{label}</span>
        {hint && (
          <span className="mt-0.5 block text-[11px] leading-snug text-muted-foreground">
            {hint}
          </span>
        )}
      </span>
    </button>
  );
}

// ---------------------------------------------------------------------------
// Segmented controls — the gold-standard "[1][2]" pill group.
//
// Canonical control for small enums (≤5 options) and bounded small integers.
// See WIDGET_CONFIG_SPEC.md §2.1. This is the single shared primitive; widgets
// MUST import these instead of redefining local NumberPill/DensityPill copies.
// ---------------------------------------------------------------------------

const PILL_BASE =
  "h-9 rounded-md border-[1.5px] text-sm font-bold transition-colors";
const PILL_ACTIVE =
  "border-primary bg-primary text-primary-foreground";
const PILL_INACTIVE =
  "border-border bg-muted/30 text-foreground hover:bg-muted/50";

/** Pick one of N options, rendered as a row of segmented pills. */
export function SegmentedControl<T extends string | number>({
  label,
  hint,
  options,
  value,
  onChange,
  fill = true,
}: {
  label?: string;
  hint?: string;
  options: ReadonlyArray<{ value: T; label: string }>;
  value: T;
  onChange: (v: T) => void;
  /** Equal-width segments (default) vs min-width pills. */
  fill?: boolean;
}) {
  return (
    <div className="space-y-1.5">
      {label && <Label className="text-xs">{label}</Label>}
      <div className="flex gap-2 flex-wrap">
        {options.map((opt) => {
          const active = opt.value === value;
          return (
            <button
              key={String(opt.value)}
              type="button"
              onClick={() => onChange(opt.value)}
              aria-pressed={active}
              className={cn(
                PILL_BASE,
                fill ? "flex-1 px-2" : "min-w-[44px] px-3",
                active ? PILL_ACTIVE : PILL_INACTIVE,
              )}
            >
              {opt.label}
            </button>
          );
        })}
      </div>
      {hint && <p className="text-[11px] text-muted-foreground">{hint}</p>}
    </div>
  );
}

/** Pick an integer in [min, max], rendered as a row of numbered pills. */
export function NumberPills({
  label,
  hint,
  min,
  max,
  value,
  onChange,
  fill = true,
}: {
  label?: string;
  hint?: string;
  min: number;
  max: number;
  value: number;
  onChange: (n: number) => void;
  fill?: boolean;
}) {
  const nums: number[] = [];
  for (let n = min; n <= max; n += 1) nums.push(n);
  return (
    <div className="space-y-1.5">
      {label && <Label className="text-xs">{label}</Label>}
      <div className="flex gap-2 flex-wrap">
        {nums.map((n) => {
          const active = n === value;
          return (
            <button
              key={n}
              type="button"
              onClick={() => onChange(n)}
              aria-pressed={active}
              className={cn(
                PILL_BASE,
                fill ? "flex-1" : "min-w-[44px] px-3",
                active ? PILL_ACTIVE : PILL_INACTIVE,
              )}
            >
              {n}
            </button>
          );
        })}
      </div>
      {hint && <p className="text-[11px] text-muted-foreground">{hint}</p>}
    </div>
  );
}

/** Density picker rendered as the canonical segmented control. */
export function DensitySegmented({
  value,
  onChange,
  label = "Densidade",
}: {
  value: Density;
  onChange: (d: Density) => void;
  label?: string;
}) {
  return (
    <SegmentedControl
      label={label}
      options={DENSITY_OPTIONS as ReadonlyArray<{ value: Density; label: string }>}
      value={value}
      onChange={onChange}
    />
  );
}

export const DENSITY_VALUES = ["compact", "comfortable", "spacious"] as const;
export type Density = (typeof DENSITY_VALUES)[number];

export const DENSITY_OPTIONS = [
  { value: "compact", label: "Compacta" },
  { value: "comfortable", label: "Confortável" },
  { value: "spacious", label: "Espaçosa" },
];

/**
 * Canonical density → row/header padding mapping. Mirrors the values used by
 * the Boletos widget so every table widget on the dashboard breathes the same.
 */
export function densityClasses(d: Density): { row: string; header: string } {
  if (d === "compact") {
    return { row: "px-2 py-1 text-xs", header: "px-2 py-1 text-[10px]" };
  }
  if (d === "spacious") {
    return { row: "px-3 py-3 text-sm", header: "px-3 py-2 text-[10px]" };
  }
  return { row: "px-3 py-2 text-sm", header: "px-3 py-1.5 text-[10px]" };
}

/**
 * Card-list density → padding + text sizes. Sibling to `densityClasses` for
 * widgets that render selectable card lists (HR requests, PPE schedules, etc.)
 * instead of grid tables. Returns shape `{ card, primary, meta }`:
 *   - card:    padding for the card container
 *   - primary: text size for primary content (employee name, request title)
 *   - meta:    text size for metadata (date, status)
 */
export function cardDensityClasses(d: Density): {
  card: string;
  primary: string;
  meta: string;
} {
  if (d === "compact") {
    return { card: "px-2.5 py-1.5", primary: "text-xs", meta: "text-[10px]" };
  }
  if (d === "spacious") {
    return { card: "px-3 py-2.5", primary: "text-sm", meta: "text-xs" };
  }
  return { card: "px-3 py-2", primary: "text-sm", meta: "text-[11px]" };
}

export const SORT_DIRECTION_OPTIONS = [
  { value: "asc", label: "Crescente" },
  { value: "desc", label: "Decrescente" },
];

/** Refresh-interval values are stored as milliseconds; "0" = disabled. */
export const REFETCH_INTERVAL_OPTIONS = [
  { value: "0", label: "Desativado" },
  { value: "30000", label: "30 segundos" },
  { value: "60000", label: "1 minuto" },
  { value: "300000", label: "5 minutos" },
  { value: "600000", label: "10 minutos" },
];

/**
 * Row-limit input shared by every table widget. Lives next to the sort
 * controls inside the Columns tab.
 */
export function LimitInput({
  value,
  onChange,
  min = 5,
  max = 200,
}: {
  value: number;
  onChange: (v: number) => void;
  min?: number;
  max?: number;
}) {
  return (
    <div className="space-y-1">
      <Label className="text-xs">Limite de linhas</Label>
      <Input
        type="number"
        min={min}
        max={max}
        value={value}
        onChange={(v) => {
          const n = typeof v === "number" ? v : Number(v);
          if (!Number.isFinite(n)) return;
          onChange(Math.max(min, Math.min(max, Math.floor(n))));
        }}
      />
      <p className="text-[11px] text-muted-foreground">
        Entre {min} e {max} linhas.
      </p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Canonical table `display` schema — the cross-platform contract.
//
// Mirrors mobile's `makeTableDisplaySchema` (mobile/src/dashboard/widgets/
// _shared.tsx) field-for-field so a config's `display` block means the same
// thing on both platforms. See WIDGET_CONFIG_SPEC.md §3.2 / §5.2.
//
// Every field has a `.default(...)`, so older persisted configs that lack a
// field parse cleanly (the field fills from the default). Adding fields here is
// therefore back-compat-safe. Widget-specific extras (layoutMode, showBucketChips,
// ...) are added per widget via `.and(z.object({...}))`.
// ---------------------------------------------------------------------------

export interface TableDisplay {
  showHeader: boolean;
  showColumnHeaders: boolean;
  showCount: boolean;
  showViewAllLink: boolean;
  showSearchBox: boolean;
  showRowDot: boolean;
  density: Density;
  striping: boolean;
  gridLines: boolean;
  hoverHighlight: boolean;
  stickyHeader: boolean;
  emptyStateMessage: string;
  /** Auto-refresh interval in milliseconds; 0 disables. Canonical refresh field
   *  (replaces the old web `behavior.refetchIntervalMs` / top-level
   *  `refetchInterval` and mobile's string `display.refetchInterval`). */
  refreshIntervalMs: number;
}

export const TABLE_DISPLAY_DEFAULTS: TableDisplay = {
  showHeader: true,
  showColumnHeaders: true,
  showCount: true,
  showViewAllLink: true,
  showSearchBox: true,
  showRowDot: false,
  density: "comfortable",
  striping: true,
  gridLines: true,
  hoverHighlight: true,
  stickyHeader: true,
  emptyStateMessage: "",
  refreshIntervalMs: 0,
};

export function makeTableDisplaySchema(overrides?: Partial<TableDisplay>) {
  const merged = { ...TABLE_DISPLAY_DEFAULTS, ...(overrides ?? {}) };
  return z
    .object({
      showHeader: z.boolean().default(merged.showHeader),
      showColumnHeaders: z.boolean().default(merged.showColumnHeaders),
      showCount: z.boolean().default(merged.showCount),
      showViewAllLink: z.boolean().default(merged.showViewAllLink),
      showSearchBox: z.boolean().default(merged.showSearchBox),
      showRowDot: z.boolean().default(merged.showRowDot),
      density: z.enum(DENSITY_VALUES).default(merged.density),
      striping: z.boolean().default(merged.striping),
      gridLines: z.boolean().default(merged.gridLines),
      hoverHighlight: z.boolean().default(merged.hoverHighlight),
      stickyHeader: z.boolean().default(merged.stickyHeader),
      emptyStateMessage: z.string().max(160).default(merged.emptyStateMessage),
      refreshIntervalMs: z.number().int().min(0).default(merged.refreshIntervalMs),
    })
    .default(merged);
}

/**
 * Back-compat shim for the refresh interval. Reads any of the legacy shapes and
 * returns a number of milliseconds. Use inside a widget's `z.preprocess` when
 * folding old configs into the canonical `display.refreshIntervalMs`.
 *   - web task-table:   `behavior.refetchIntervalMs` (number)
 *   - web installment:  top-level `refetchInterval` (number)
 *   - mobile tables:    `display.refetchInterval` (string of ms)
 */
export function coerceRefreshMs(raw: unknown): number {
  if (typeof raw === "number" && Number.isFinite(raw)) return Math.max(0, Math.floor(raw));
  if (typeof raw === "string" && /^\d+$/.test(raw)) return Math.max(0, parseInt(raw, 10));
  return 0;
}

/**
 * Effective CSS `zoom` factor in force on `el` (product of every ancestor's
 * `zoom`). Returns 1 when unsupported or unzoomed — which is the normal case,
 * since the global UI scale is done via root rem font-size, NOT `zoom` (see
 * index.css). This reads the live `currentCSSZoom`, so it stays correct even if
 * a `zoom` is ever applied to an ancestor.
 *
 * Needed by the column-resize handlers: under CSS `zoom`, `getBoundingClientRect`
 * and pointer `clientX` are reported in the *scaled* (post-zoom) coordinate
 * space, but a CSS `px` width we write back is re-scaled by `zoom` at render
 * time. Dividing the measured base width and the pointer delta by this factor
 * converts both into the unzoomed CSS-px space the width is actually authored in,
 * so the column tracks the cursor 1:1 instead of drifting by the zoom factor.
 */
export function getEffectiveZoom(el: Element | null | undefined): number {
  const z = (el as { currentCSSZoom?: number } | null | undefined)?.currentCSSZoom;
  return typeof z === "number" && z > 0 ? z : 1;
}
