// Shared helpers for widgets that wrap an existing home-dashboard list component.
// All these widgets pull from the same `useHomeDashboard` query — react-query
// dedupes the request so the call cost is one network round-trip regardless of
// how many widgets the user has configured.

import { createContext, useContext, useId, useMemo, useState, type ReactNode } from "react";
import { IconChevronDown } from "@tabler/icons-react";
import { useHomeDashboard } from "../../hooks/common/use-dashboard";
import type { HomeDashboardData } from "../../types";
import { Combobox } from "../../components/ui/combobox";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "../../components/ui/collapsible";
import { Label } from "../../components/ui/label";
import { Input } from "../../components/ui/input";

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
 * Boolean field rendered as a Sim/Não Combobox so every config control on the
 * page shares the same dropdown look. This is the canonical replacement for
 * raw Checkbox / native input checkboxes inside config modals.
 */
export function ToggleRow({
  label,
  hint,
  checked,
  onCheckedChange,
}: {
  label: string;
  hint?: string;
  checked: boolean;
  onCheckedChange: (v: boolean) => void;
}) {
  return (
    <div className="space-y-1">
      <Label className="text-xs">{label}</Label>
      <Combobox
        mode="single"
        value={checked ? "yes" : "no"}
        onValueChange={(v) => onCheckedChange(v === "yes")}
        options={YES_NO_OPTIONS}
        clearable={false}
      />
      {hint && <p className="text-[11px] text-muted-foreground">{hint}</p>}
    </div>
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
