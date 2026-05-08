// Daily time-clock summary widget — mirrors the production /controle-ponto Day
// view, but each instance owns its own column set, filters, density, sort, and
// runtime search. Built to the same architecture as the task-table widget so
// the two feel uniform.
//
// Data source: useSecullumTimeEntriesByDay(yyyy-MM-dd) → rows of
//   { user: { id, name, sectorName?, positionName? }, entry: SecullumEntry | null }
// The Secullum entry's slot fields (Entrada1, Saida1, …) hold either an HH:MM
// string OR a justification token like "FÉRIAS"/"FOLGA"/"ATESTAD" — the
// shared renderTimeValue handles the polarity and color.

import {
  useCallback,
  useDeferredValue,
  useMemo,
  useRef,
  useState,
} from "react";
import { useNavigate } from "react-router-dom";
import { z } from "zod";
import {
  IconAdjustments,
  IconCalendar,
  IconChevronLeft,
  IconChevronRight,
  IconClock24,
  IconColumns,
  IconFilter,
  IconLayout,
  IconSearch,
} from "@tabler/icons-react";

import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";
import { Combobox } from "../../components/ui/combobox";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "../../components/ui/tabs";
import { routes } from "../../constants/routes";
import { SECTOR_PRIVILEGES } from "../../constants";
import { useSecullumTimeEntriesByDay } from "../../hooks/integrations/use-secullum";
import {
  renderHourValue,
  renderTimeValue,
} from "../../components/integrations/secullum/cell-renderers";

import { WidgetCard } from "../components/widget-card";
import { ColumnPicker } from "../components/column-picker";
import { AccentPicker, makeAccentSchema, resolveAccent } from "../components/widget-accent";
import type {
  WidgetAccentColor,
  WidgetAccentIcon,
  WidgetBorderColor,
} from "../components/widget-accent";
import type {
  WidgetConfigProps,
  WidgetDefinition,
  WidgetRenderProps,
} from "../types";
import {
  Section,
  ToggleRow,
  LimitInput,
  SORT_DIRECTION_OPTIONS,
  DENSITY_VALUES,
  DENSITY_OPTIONS,
  densityClasses,
  type Density,
} from "./_shared";

// ============================================================================
// Column catalog
// ============================================================================

type ColumnKey =
  // identity / context
  | "userName"
  | "sectorName"
  | "positionName"
  | "justification"
  // punches
  | "entrada1"
  | "saida1"
  | "entrada2"
  | "saida2"
  | "entrada3"
  | "saida3"
  | "entrada4"
  | "saida4"
  | "entrada5"
  | "saida5"
  // aggregates
  | "normais"
  | "faltas"
  | "ex50"
  | "ex100"
  | "ex150"
  | "dsr"
  | "dsrDeb"
  | "ajuste"
  | "atras"
  | "adian"
  // booleans
  | "compensated"
  | "neutral"
  | "dayOff"
  | "freeLunch";

const COLUMN_KEY_VALUES: readonly ColumnKey[] = [
  "userName",
  "sectorName",
  "positionName",
  "justification",
  "entrada1",
  "saida1",
  "entrada2",
  "saida2",
  "entrada3",
  "saida3",
  "entrada4",
  "saida4",
  "entrada5",
  "saida5",
  "normais",
  "faltas",
  "ex50",
  "ex100",
  "ex150",
  "dsr",
  "dsrDeb",
  "ajuste",
  "atras",
  "adian",
  "compensated",
  "neutral",
  "dayOff",
  "freeLunch",
] as const;

interface DayColumnDef {
  key: ColumnKey;
  label: string;
  /** CSS Grid track default; per-column drag overrides via localStorage. */
  track: string;
  align?: "left" | "center";
  render: (row: DayRow) => React.ReactNode;
}

// Map our column key → Secullum response field name (matches the page).
const SECULLUM_FIELD_MAP: Partial<Record<ColumnKey, string>> = {
  entrada1: "Entrada1",
  saida1: "Saida1",
  entrada2: "Entrada2",
  saida2: "Saida2",
  entrada3: "Entrada3",
  saida3: "Saida3",
  entrada4: "Entrada4",
  saida4: "Saida4",
  entrada5: "Entrada5",
  saida5: "Saida5",
  normais: "Normais",
  faltas: "Faltas",
  ex50: "Ex50",
  ex100: "Ex100",
  ex150: "Ex150",
  dsr: "DSR",
  dsrDeb: "DSRDebito",
  ajuste: "Ajuste",
  atras: "Atraso",
  adian: "Adiantamento",
  compensated: "Compensado",
  neutral: "Neutro",
  dayOff: "Folga",
  freeLunch: "AlmocoLivre",
};

const PUNCH_KEYS: readonly ColumnKey[] = [
  "entrada1",
  "saida1",
  "entrada2",
  "saida2",
  "entrada3",
  "saida3",
  "entrada4",
  "saida4",
  "entrada5",
  "saida5",
];
const HOUR_KEYS = new Set<ColumnKey>([
  "normais",
  "faltas",
  "ex50",
  "ex100",
  "ex150",
  "dsr",
  "dsrDeb",
  "ajuste",
  "atras",
  "adian",
]);
const BAD_KEYS = new Set<ColumnKey>(["faltas", "atras", "adian"]);
const BOOL_KEYS = new Set<ColumnKey>([
  "compensated",
  "neutral",
  "dayOff",
  "freeLunch",
]);

// True when a slot value isn't HH:MM and isn't blank — those are the
// justification tokens (FÉRIAS / FOLGA / ATESTAD / FALTA / FERIADO / …).
function looksLikeJustification(v: unknown): boolean {
  if (typeof v !== "string") return false;
  const t = v.trim();
  if (!t || t === "-" || t === "null") return false;
  if (/^\d{1,2}:\d{2}$/.test(t)) return false;
  return true;
}

// First non-time token across the slot fields — that's the user-visible
// justification ("FÉRIAS", "ATESTAD", "FOLGA", "FALTA I", "FERIADO", …).
function firstJustificationToken(entry: any | null): string | null {
  if (!entry) return null;
  for (const k of PUNCH_KEYS) {
    const field = SECULLUM_FIELD_MAP[k];
    if (!field) continue;
    const val = entry[field];
    if (looksLikeJustification(val)) return String(val).trim();
  }
  // Some Secullum responses also expose Justificativa / Observacao.
  for (const f of ["Justificativa", "Observacao", "Tipo"]) {
    if (typeof entry[f] === "string" && entry[f].trim()) return String(entry[f]).trim();
  }
  return null;
}

function hasAnyPunch(entry: any | null): boolean {
  if (!entry) return false;
  for (const k of PUNCH_KEYS) {
    const field = SECULLUM_FIELD_MAP[k];
    if (!field) continue;
    const v = entry[field];
    if (typeof v === "string" && /^\d{1,2}:\d{2}$/.test(v.trim())) return true;
  }
  return false;
}

function hourGreater(value: unknown, threshold = "00:00"): boolean {
  if (typeof value !== "string") return false;
  const t = value.trim();
  if (!t || !/^-?\d{1,2}:\d{2}$/.test(t)) return false;
  // Treat anything other than 00:00 / -00:00 / blank as greater.
  return t !== threshold && t !== "-00:00";
}

function getEntryField(entry: any | null, key: ColumnKey): unknown {
  if (!entry) return undefined;
  const field = SECULLUM_FIELD_MAP[key];
  if (!field) return undefined;
  return entry[field];
}

const COLUMN_CATALOG: DayColumnDef[] = [
  {
    key: "userName",
    label: "Colaborador",
    track: "minmax(0, 1.4fr)",
    render: (r) => <span className="text-sm truncate">{r.user.name}</span>,
  },
  {
    key: "sectorName",
    label: "Setor",
    track: "minmax(0, 1fr)",
    render: (r) => (
      <span className="text-sm text-muted-foreground truncate">
        {r.user.sectorName ?? "—"}
      </span>
    ),
  },
  {
    key: "positionName",
    label: "Cargo",
    track: "minmax(0, 1fr)",
    render: (r) => (
      <span className="text-sm text-muted-foreground truncate">
        {r.user.positionName ?? "—"}
      </span>
    ),
  },
  {
    key: "justification",
    label: "Justificativa",
    track: "minmax(0, 1fr)",
    render: (r) => {
      const token = firstJustificationToken(r.entry);
      if (!token) return <span className="text-muted-foreground text-xs">—</span>;
      return renderTimeValue(token);
    },
  },
  // ---- punches ----
  ...PUNCH_KEYS.map(
    (key): DayColumnDef => ({
      key,
      label: key.startsWith("entrada")
        ? `Entrada ${key.slice(7)}`
        : `Saída ${key.slice(5)}`,
      track: "minmax(0, 0.7fr)",
      align: "center",
      render: (r) => renderTimeValue(getEntryField(r.entry, key) as string | undefined),
    }),
  ),
  // ---- aggregates ----
  ...(
    [
      ["normais", "Normais"],
      ["faltas", "Faltas"],
      ["ex50", "EX 50%"],
      ["ex100", "EX 100%"],
      ["ex150", "EX 150%"],
      ["dsr", "DSR"],
      ["dsrDeb", "DSR débito"],
      ["ajuste", "Ajuste"],
      ["atras", "Atraso"],
      ["adian", "Adiantamento"],
    ] as Array<[ColumnKey, string]>
  ).map(([key, label]) => ({
    key,
    label,
    track: "minmax(0, 0.8fr)",
    align: "center" as const,
    render: (r: DayRow) =>
      renderHourValue(
        getEntryField(r.entry, key) as string | undefined,
        BAD_KEYS.has(key) ? "bad" : "good",
      ),
  })),
  // ---- booleans ----
  ...(
    [
      ["compensated", "Compensado"],
      ["neutral", "Neutro"],
      ["dayOff", "Folga"],
      ["freeLunch", "Almoço livre"],
    ] as Array<[ColumnKey, string]>
  ).map(([key, label]) => ({
    key,
    label,
    track: "minmax(0, 0.8fr)",
    align: "center" as const,
    render: (r: DayRow) => {
      const v = getEntryField(r.entry, key);
      return v ? (
        <span className="text-sm">Sim</span>
      ) : (
        <span className="text-muted-foreground text-xs">—</span>
      );
    },
  })),
];

const COLUMN_BY_KEY: Record<ColumnKey, DayColumnDef> = COLUMN_CATALOG.reduce(
  (acc, c) => {
    acc[c.key] = c;
    return acc;
  },
  {} as Record<ColumnKey, DayColumnDef>,
);

// ============================================================================
// Schema
// ============================================================================

const FILTER_MODES = [
  "all",
  "with-entries",
  "without-entries",
  "justified",
  "late",
  "overtime",
  "day-off",
  "compensated",
] as const;
const LAYOUT_MODES = ["flat", "grouped-by-sector"] as const;
const SORT_KEYS = [
  "userName",
  "sectorName",
  "positionName",
  "faltas",
  "atras",
  "normais",
] as const;

export const dailyPontoConfigSchema = z.object({
  title: z.string().min(1).max(80).default("Ponto do Dia"),
  accent: makeAccentSchema({
    color: "teal",
    icon: "Clock24",
    borderColor: "none",
  }),
  showHeader: z.boolean().default(true),

  display: z
    .object({
      density: z.enum(DENSITY_VALUES).default("comfortable"),
      striping: z.boolean().default(true),
      gridLines: z.boolean().default(true),
      hoverHighlight: z.boolean().default(true),
      stickyHeader: z.boolean().default(true),
      showSearchBox: z.boolean().default(true),
      showDayNavigator: z.boolean().default(true),
      showViewAllLink: z.boolean().default(true),
      emptyStateMessage: z.string().max(160).default(""),
      layoutMode: z.enum(LAYOUT_MODES).default("flat"),
    })
    .default({
      density: "comfortable",
      striping: true,
      gridLines: true,
      hoverHighlight: true,
      stickyHeader: true,
      showSearchBox: true,
      showDayNavigator: true,
      showViewAllLink: true,
      emptyStateMessage: "",
      layoutMode: "flat",
    }),

  columns: z
    .array(z.enum(COLUMN_KEY_VALUES))
    .min(1)
    .default([
      "userName",
      "sectorName",
      "entrada1",
      "saida1",
      "entrada2",
      "saida2",
      "normais",
      "faltas",
    ]),

  filters: z
    .object({
      mode: z.enum(FILTER_MODES).default("all"),
      sectorNames: z.array(z.string()).default([]),
      positionNames: z.array(z.string()).default([]),
      defaultSearch: z.string().default(""),
    })
    .default({ mode: "all", sectorNames: [], positionNames: [], defaultSearch: "" }),

  sort: z
    .object({
      key: z.enum(SORT_KEYS).default("userName"),
      direction: z.enum(["asc", "desc"]).default("asc"),
    })
    .default({ key: "userName", direction: "asc" }),

  limit: z.number().int().min(5).max(200).default(50),
});

export type DailyPontoConfig = z.infer<typeof dailyPontoConfigSchema>;

// ============================================================================
// Helpers
// ============================================================================

function todayDate(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}
function formatYMD(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}
function formatBR(d: Date): string {
  return d.toLocaleDateString("pt-BR", {
    weekday: "short",
    day: "2-digit",
    month: "2-digit",
  });
}
function addDays(d: Date, n: number): Date {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}

function normalizeConfig(raw: unknown): DailyPontoConfig {
  const result = dailyPontoConfigSchema.safeParse(raw);
  return result.success ? result.data : dailyPontoConfigSchema.parse({});
}

interface DayRow {
  user: {
    id: string;
    name: string;
    sectorName?: string | null;
    positionName?: string | null;
  };
  entry: any | null;
}

// ============================================================================
// Per-instance column width persistence
// ============================================================================

const COLUMN_WIDTHS_STORAGE_PREFIX = "daily-ponto-widget:column-widths:";

function readStoredWidths(instanceId: string): Record<string, string> {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(COLUMN_WIDTHS_STORAGE_PREFIX + instanceId);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === "object") return parsed as Record<string, string>;
    }
  } catch {
    /* ignore */
  }
  return {};
}
function writeStoredWidths(instanceId: string, widths: Record<string, string>) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(
      COLUMN_WIDTHS_STORAGE_PREFIX + instanceId,
      JSON.stringify(widths),
    );
  } catch {
    /* ignore */
  }
}

// ============================================================================
// Render
// ============================================================================

function applyFilters(rows: DayRow[], config: DailyPontoConfig, search: string): DayRow[] {
  const f = config.filters;
  const term = search.trim().toLowerCase();
  const sectorSet = new Set(f.sectorNames);
  const positionSet = new Set(f.positionNames);

  return rows.filter((r) => {
    if (sectorSet.size > 0 && !(r.user.sectorName && sectorSet.has(r.user.sectorName))) {
      return false;
    }
    if (
      positionSet.size > 0 &&
      !(r.user.positionName && positionSet.has(r.user.positionName))
    ) {
      return false;
    }

    if (term) {
      const haystack = [
        r.user.name,
        r.user.sectorName ?? "",
        r.user.positionName ?? "",
      ]
        .join("|")
        .toLowerCase();
      if (!haystack.includes(term)) return false;
    }

    switch (f.mode) {
      case "all":
        return true;
      case "with-entries":
        return hasAnyPunch(r.entry);
      case "without-entries":
        return !hasAnyPunch(r.entry);
      case "justified":
        return firstJustificationToken(r.entry) !== null;
      case "late":
        return hourGreater(getEntryField(r.entry, "atras"));
      case "overtime":
        return (
          hourGreater(getEntryField(r.entry, "ex50")) ||
          hourGreater(getEntryField(r.entry, "ex100")) ||
          hourGreater(getEntryField(r.entry, "ex150"))
        );
      case "day-off":
        return Boolean(getEntryField(r.entry, "dayOff"));
      case "compensated":
        return Boolean(getEntryField(r.entry, "compensated"));
      default:
        return true;
    }
  });
}

function applySort(rows: DayRow[], config: DailyPontoConfig): DayRow[] {
  const { key, direction } = config.sort;
  const sign = direction === "asc" ? 1 : -1;
  const out = rows.slice();
  out.sort((a, b) => {
    let av: string | number = "";
    let bv: string | number = "";
    if (key === "userName") {
      av = a.user.name ?? "";
      bv = b.user.name ?? "";
    } else if (key === "sectorName") {
      av = a.user.sectorName ?? "";
      bv = b.user.sectorName ?? "";
    } else if (key === "positionName") {
      av = a.user.positionName ?? "";
      bv = b.user.positionName ?? "";
    } else {
      av = String(getEntryField(a.entry, key) ?? "");
      bv = String(getEntryField(b.entry, key) ?? "");
    }
    if (av < bv) return -1 * sign;
    if (av > bv) return 1 * sign;
    return 0;
  });
  return out;
}

function DailyPontoRender({
  config: rawConfig,
  instanceId,
}: WidgetRenderProps<DailyPontoConfig>) {
  const config = useMemo(() => normalizeConfig(rawConfig), [rawConfig]);
  const navigate = useNavigate();
  const [date, setDate] = useState<Date>(() => todayDate());
  const [searchInput, setSearchInput] = useState("");
  const debouncedSearch = useDeferredValue(searchInput);

  const dateStr = useMemo(() => formatYMD(date), [date]);
  const { data, isLoading, isError } = useSecullumTimeEntriesByDay(dateStr);

  const rawRows: DayRow[] = ((data?.data as any)?.data ?? []) as DayRow[];

  const search = debouncedSearch || config.filters.defaultSearch;
  const rows = useMemo(
    () =>
      applySort(applyFilters(rawRows, config, search), config).slice(
        0,
        config.limit,
      ),
    [rawRows, config, search],
  );

  // ---- column resolution + widths ----
  const cols = useMemo(
    () => config.columns.map((k) => COLUMN_BY_KEY[k]).filter(Boolean) as DayColumnDef[],
    [config.columns],
  );

  const [liveWidths, setLiveWidths] = useState<Record<string, string>>(() =>
    readStoredWidths(instanceId),
  );
  const headerRef = useRef<HTMLDivElement>(null);

  const setColumnWidthPx = useCallback(
    (key: string, px: number) => {
      const next = { ...liveWidths, [key]: `${Math.max(40, Math.round(px))}px` };
      setLiveWidths(next);
      writeStoredWidths(instanceId, next);
    },
    [instanceId, liveWidths],
  );

  const onResizeStart = useCallback(
    (e: React.PointerEvent<HTMLDivElement>, columnKey: string) => {
      e.preventDefault();
      e.stopPropagation();
      const headerEl = headerRef.current;
      if (!headerEl) return;
      const cell = headerEl.querySelector<HTMLElement>(
        `[data-col-key="${columnKey}"]`,
      );
      if (!cell) return;
      const startX = e.clientX;
      const startWidth = cell.getBoundingClientRect().width;

      const onMove = (ev: PointerEvent) => {
        const dx = ev.clientX - startX;
        setColumnWidthPx(columnKey, startWidth + dx);
      };
      const onUp = () => {
        window.removeEventListener("pointermove", onMove);
        window.removeEventListener("pointerup", onUp);
        document.body.style.userSelect = "";
        document.body.style.cursor = "";
      };
      window.addEventListener("pointermove", onMove);
      window.addEventListener("pointerup", onUp);
      document.body.style.userSelect = "none";
      document.body.style.cursor = "col-resize";
    },
    [setColumnWidthPx],
  );

  const gridTemplate = useMemo(
    () => cols.map((c) => liveWidths[c.key] ?? c.track).join(" "),
    [cols, liveWidths],
  );

  // ---- visual settings ----
  const accent = resolveAccent({
    color: config.accent?.color as WidgetAccentColor,
    icon: config.accent?.icon as WidgetAccentIcon,
  });
  const AccentIcon = accent.Icon;
  const display = config.display;
  const dens = densityClasses(display.density as Density);
  const stickyClass = display.stickyHeader ? "sticky top-0 z-20" : "";
  const rowBorder = display.gridLines ? "border-b border-border last:border-b-0" : "";
  const rowHover = display.hoverHighlight ? "hover:bg-secondary/50" : "";
  const emptyMsg =
    display.emptyStateMessage?.trim() || "Nenhum registro de ponto neste dia.";

  const isToday = formatYMD(date) === formatYMD(todayDate());
  const layoutMode = display.layoutMode;

  const headerExtra = (
    <div className="flex items-center gap-2">
      {display.showSearchBox && (
        <div className="relative">
          <IconSearch className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground pointer-events-none" />
          <input
            type="text"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Buscar..."
            className="h-7 w-32 rounded-md border border-border bg-background pl-7 pr-2 text-xs focus:outline-none focus:ring-1 focus:ring-ring"
          />
        </div>
      )}
      {display.showDayNavigator && (
        <div className="flex items-center h-7 rounded-md border border-border bg-background overflow-hidden">
          <button
            type="button"
            onClick={() => setDate((d) => addDays(d, -1))}
            className="h-full px-1.5 flex items-center text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
            title="Dia anterior"
          >
            <IconChevronLeft className="h-3.5 w-3.5" />
          </button>
          <div
            title={isToday ? "Hoje" : formatBR(date)}
            className="h-full w-[110px] px-2 flex items-center justify-center gap-1.5 text-[11px] font-medium tabular-nums border-x border-border text-foreground select-none"
          >
            <IconCalendar className="h-3 w-3 opacity-60 shrink-0" />
            <span>{isToday ? "Hoje" : formatBR(date)}</span>
          </div>
          <button
            type="button"
            onClick={() => setDate((d) => addDays(d, 1))}
            className="h-full px-1.5 flex items-center text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
            title="Próximo dia"
          >
            <IconChevronRight className="h-3.5 w-3.5" />
          </button>
        </div>
      )}
    </div>
  );

  // ---- row rendering ----
  const renderRow = (row: DayRow, i: number) => (
    <div
      key={row.user.id}
      role="button"
      tabIndex={0}
      onClick={() =>
        navigate(
          `${routes.humanResources.timeClock.root}?view=colaborador-unico&userId=${row.user.id}`,
        )
      }
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          navigate(
            `${routes.humanResources.timeClock.root}?view=colaborador-unico&userId=${row.user.id}`,
          );
        }
      }}
      className={`grid gap-x-3 items-center cursor-pointer transition-colors ${dens.row} ${rowBorder} ${rowHover} ${
        display.striping && i % 2 === 1 ? "bg-muted/20" : ""
      }`}
      style={{ gridTemplateColumns: gridTemplate }}
    >
      {cols.map((c) => (
        <div
          key={c.key}
          className={`min-w-0 truncate ${
            c.align === "center" ? "text-center" : ""
          }`}
        >
          {c.render(row)}
        </div>
      ))}
    </div>
  );

  const renderRows = () => {
    if (isLoading) {
      return (
        <SkeletonRows columns={cols.length} count={6} gridTemplate={gridTemplate} dens={dens} />
      );
    }
    if (isError) {
      return (
        <div className="p-6 text-center text-sm text-muted-foreground">
          Erro ao carregar registros de ponto.
        </div>
      );
    }
    if (rows.length === 0) {
      return <div className="p-6 text-center text-sm text-muted-foreground">{emptyMsg}</div>;
    }

    if (layoutMode === "grouped-by-sector") {
      const out: React.ReactNode[] = [];
      let prev: string | null | undefined = "__init__";
      rows.forEach((r, i) => {
        const sec = r.user.sectorName ?? "Sem setor";
        if (sec !== prev) {
          out.push(
            <div
              key={`group-${sec}-${i}`}
              className="px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider border-b border-border bg-muted/40 text-muted-foreground"
            >
              {sec}
            </div>,
          );
          prev = sec;
        }
        out.push(renderRow(r, i));
      });
      return out;
    }

    return rows.map((r, i) => renderRow(r, i));
  };

  return (
    <WidgetCard
      showHeader={config.showHeader}
      title={
        <span className={accent.classes.text}>{config.title || "Ponto do Dia"}</span>
      }
      icon={<AccentIcon className={`h-4 w-4 ${accent.classes.icon}`} />}
      viewAllHref={
        display.showViewAllLink ? `/recursos-humanos/controle-ponto?date=${dateStr}` : undefined
      }
      borderColor={config.accent?.borderColor as WidgetBorderColor | undefined}
      headerExtra={headerExtra}
      count={!isLoading ? rows.length : null}
    >
      <>
        <div
          ref={headerRef}
          className={`grid gap-x-3 ${dens.header} ${stickyClass} bg-muted/95 backdrop-blur-sm border-b border-border font-semibold uppercase tracking-wider text-muted-foreground`}
          style={{ gridTemplateColumns: gridTemplate }}
        >
          {cols.map((c, i) => (
            <div
              key={c.key}
              data-col-key={c.key}
              className={`relative truncate select-none ${c.align === "center" ? "text-center" : ""}`}
            >
              {c.label}
              {i < cols.length - 1 && (
                <div
                  role="separator"
                  aria-orientation="vertical"
                  aria-label={`Redimensionar coluna ${c.label}`}
                  onPointerDown={(e) => onResizeStart(e, c.key)}
                  onClick={(e) => e.stopPropagation()}
                  onDoubleClick={(e) => {
                    e.stopPropagation();
                    if (!liveWidths[c.key]) return;
                    const next = { ...liveWidths };
                    delete next[c.key];
                    setLiveWidths(next);
                    writeStoredWidths(instanceId, next);
                  }}
                  className="absolute top-0 bottom-0 right-0 w-1.5 -mr-[3px] z-30 cursor-col-resize hover:bg-primary/40 active:bg-primary/60 transition-colors"
                />
              )}
            </div>
          ))}
        </div>
        {renderRows()}
      </>
    </WidgetCard>
  );
}

function SkeletonRows({
  columns,
  count,
  gridTemplate,
  dens,
}: {
  columns: number;
  count: number;
  gridTemplate: string;
  dens: { row: string };
}) {
  return (
    <>
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className={`grid gap-x-3 items-center border-b border-border last:border-b-0 ${dens.row}`}
          style={{ gridTemplateColumns: gridTemplate }}
        >
          {Array.from({ length: columns }).map((__, j) => (
            <div
              key={j}
              className="h-3 rounded bg-muted/60 animate-pulse"
              style={{ animationDelay: `${i * 60}ms` }}
            />
          ))}
        </div>
      ))}
    </>
  );
}

// ============================================================================
// Configure UI
// ============================================================================

const FILTER_MODE_LABELS: Record<(typeof FILTER_MODES)[number], string> = {
  all: "Todos os colaboradores",
  "with-entries": "Apenas com batidas",
  "without-entries": "Apenas sem batidas (ausentes)",
  justified: "Apenas com justificativa",
  late: "Apenas com atraso",
  overtime: "Apenas com horas extras",
  "day-off": "Apenas em folga",
  compensated: "Apenas compensados",
};
const LAYOUT_LABELS: Record<(typeof LAYOUT_MODES)[number], string> = {
  flat: "Lista única",
  "grouped-by-sector": "Agrupado por setor",
};
const SORT_LABELS: Record<(typeof SORT_KEYS)[number], string> = {
  userName: "Colaborador",
  sectorName: "Setor",
  positionName: "Cargo",
  faltas: "Faltas",
  atras: "Atraso",
  normais: "Horas normais",
};
function asArray(v: unknown): string[] {
  if (Array.isArray(v)) return v;
  if (typeof v === "string" && v) return [v];
  return [];
}

function DailyPontoConfigComponent({
  config: rawConfig,
  onChange,
}: WidgetConfigProps<DailyPontoConfig>) {
  const c = useMemo(() => normalizeConfig(rawConfig), [rawConfig]);
  const set = <K extends keyof DailyPontoConfig>(key: K, value: DailyPontoConfig[K]) =>
    onChange({ ...c, [key]: value });
  const setDisplay = <K extends keyof DailyPontoConfig["display"]>(
    key: K,
    value: DailyPontoConfig["display"][K],
  ) => onChange({ ...c, display: { ...c.display, [key]: value } });
  const setFilter = <K extends keyof DailyPontoConfig["filters"]>(
    key: K,
    value: DailyPontoConfig["filters"][K],
  ) => onChange({ ...c, filters: { ...c.filters, [key]: value } });
  const setSort = <K extends keyof DailyPontoConfig["sort"]>(
    key: K,
    value: DailyPontoConfig["sort"][K],
  ) => onChange({ ...c, sort: { ...c.sort, [key]: value } });

  // Discover unique sector / position names from today's response so the
  // Combobox options aren't hand-typed.
  const today = useMemo(() => formatYMD(todayDate()), []);
  const { data: liveData } = useSecullumTimeEntriesByDay(today);
  const liveRows: DayRow[] = ((liveData?.data as any)?.data ?? []) as DayRow[];
  const sectorOptions = useMemo(() => {
    const set = new Set<string>();
    for (const r of liveRows) if (r.user.sectorName) set.add(r.user.sectorName);
    return Array.from(set)
      .sort((a, b) => a.localeCompare(b, "pt-BR"))
      .map((s) => ({ value: s, label: s }));
  }, [liveRows]);
  const positionOptions = useMemo(() => {
    const set = new Set<string>();
    for (const r of liveRows) if (r.user.positionName) set.add(r.user.positionName);
    return Array.from(set)
      .sort((a, b) => a.localeCompare(b, "pt-BR"))
      .map((p) => ({ value: p, label: p }));
  }, [liveRows]);

  const accentColor = (c.accent?.color ?? "teal") as WidgetAccentColor;
  const accentIcon = (c.accent?.icon ?? "Clock24") as WidgetAccentIcon;
  const borderColor = (c.accent?.borderColor ?? "none") as WidgetBorderColor;

  const resetDisplay = () => set("display", dailyPontoWidget.defaultConfig.display);
  const resetColumns = () => set("columns", dailyPontoWidget.defaultConfig.columns);
  const resetFilters = () => set("filters", dailyPontoWidget.defaultConfig.filters);
  const resetBehavior = () => {
    set("sort", dailyPontoWidget.defaultConfig.sort);
  };

  return (
    <div className="space-y-3 max-h-[70vh] overflow-y-auto pr-1 -mr-1">
      <div className="space-y-1.5">
        <Label className="text-sm">Título</Label>
        <Input
          value={c.title}
          onChange={(v) => set("title", typeof v === "string" ? v : "")}
          placeholder="Ponto do Dia"
        />
      </div>

      <Tabs defaultValue="appearance" className="flex flex-col gap-2">
        <TabsList className="self-start">
          <TabsTrigger value="appearance" className="gap-1">
            <IconAdjustments className="h-3.5 w-3.5" /> Aparência
          </TabsTrigger>
          <TabsTrigger value="columns" className="gap-1">
            <IconColumns className="h-3.5 w-3.5" /> Colunas e ordenação
          </TabsTrigger>
          <TabsTrigger value="filters" className="gap-1">
            <IconFilter className="h-3.5 w-3.5" /> Filtros
          </TabsTrigger>
          <TabsTrigger value="behavior" className="gap-1">
            <IconLayout className="h-3.5 w-3.5" /> Comportamento
          </TabsTrigger>
        </TabsList>

        {/* ---- APPEARANCE ---- */}
        <TabsContent value="appearance" className="space-y-3 mt-0">
          <div className="flex justify-end">
            <button
              type="button"
              onClick={resetDisplay}
              className="text-[11px] text-muted-foreground hover:text-foreground hover:underline"
            >
              Restaurar aparência
            </button>
          </div>
          <Section title="Acento (cor, ícone, borda)" defaultOpen>
            <AccentPicker
              value={{ color: accentColor, icon: accentIcon, borderColor }}
              onChange={(next) =>
                set("accent", {
                  color: next.color,
                  icon: next.icon,
                  borderColor: next.borderColor,
                } as DailyPontoConfig["accent"])
              }
            />
          </Section>
          <Section title="Densidade e linhas" defaultOpen>
            <div>
              <Label className="text-xs">Densidade</Label>
              <Combobox
                mode="single"
                value={c.display.density}
                onValueChange={(v) =>
                  setDisplay(
                    "density",
                    (typeof v === "string" ? v : "comfortable") as Density,
                  )
                }
                options={DENSITY_OPTIONS}
                clearable={false}
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <ToggleRow
                label="Listras alternadas"
                checked={c.display.striping}
                onCheckedChange={(v) => setDisplay("striping", v)}
              />
              <ToggleRow
                label="Linhas divisórias"
                checked={c.display.gridLines}
                onCheckedChange={(v) => setDisplay("gridLines", v)}
              />
              <ToggleRow
                label="Destaque ao passar mouse"
                checked={c.display.hoverHighlight}
                onCheckedChange={(v) => setDisplay("hoverHighlight", v)}
              />
              <ToggleRow
                label="Cabeçalho fixo"
                checked={c.display.stickyHeader}
                onCheckedChange={(v) => setDisplay("stickyHeader", v)}
              />
              <ToggleRow
                label="Caixa de busca"
                checked={c.display.showSearchBox}
                onCheckedChange={(v) => setDisplay("showSearchBox", v)}
              />
              <ToggleRow
                label="Navegador de dia"
                hint="Setas e botão Hoje no cabeçalho."
                checked={c.display.showDayNavigator}
                onCheckedChange={(v) => setDisplay("showDayNavigator", v)}
              />
              <ToggleRow
                label='Link "Ver todos"'
                checked={c.display.showViewAllLink}
                onCheckedChange={(v) => setDisplay("showViewAllLink", v)}
              />
              <ToggleRow
                label="Cabeçalho do widget"
                checked={c.showHeader}
                onCheckedChange={(v) => set("showHeader", v)}
              />
            </div>
          </Section>
          <Section title="Mensagem quando vazio">
            <Input
              value={c.display.emptyStateMessage}
              onChange={(v) =>
                setDisplay("emptyStateMessage", typeof v === "string" ? v : "")
              }
              placeholder="Nenhum registro de ponto neste dia."
            />
          </Section>
        </TabsContent>

        {/* ---- COLUMNS + SORT ---- */}
        <TabsContent value="columns" className="space-y-3 mt-0">
          <div className="flex justify-end">
            <button
              type="button"
              onClick={resetColumns}
              className="text-[11px] text-muted-foreground hover:text-foreground hover:underline"
            >
              Restaurar colunas
            </button>
          </div>
          <Section
            title={`Selecionar e reordenar (${c.columns.length})`}
            defaultOpen
          >
            <ColumnPicker
              catalog={COLUMN_CATALOG.map((col) => ({ key: col.key, label: col.label }))}
              selected={c.columns}
              onChange={(next) => set("columns", next as DailyPontoConfig["columns"])}
            />
            <p className="text-[11px] text-muted-foreground">
              Para ajustar a largura, arraste a borda direita do cabeçalho da coluna
              diretamente na tabela. Duplo clique reseta para o padrão.
            </p>
          </Section>
          <Section title="Ordenação e limite">
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label className="text-xs">Ordenar por</Label>
                <Combobox
                  mode="single"
                  value={c.sort.key}
                  onValueChange={(v) =>
                    setSort(
                      "key",
                      (typeof v === "string"
                        ? v
                        : "userName") as (typeof SORT_KEYS)[number],
                    )
                  }
                  options={SORT_KEYS.map((k) => ({ value: k, label: SORT_LABELS[k] }))}
                  clearable={false}
                />
              </div>
              <div>
                <Label className="text-xs">Direção</Label>
                <Combobox
                  mode="single"
                  value={c.sort.direction}
                  onValueChange={(v) =>
                    setSort(
                      "direction",
                      (typeof v === "string" ? v : "asc") as DailyPontoConfig["sort"]["direction"],
                    )
                  }
                  options={SORT_DIRECTION_OPTIONS}
                  clearable={false}
                />
              </div>
            </div>
            <LimitInput
              value={c.limit}
              onChange={(n) => set("limit", n)}
            />
          </Section>
        </TabsContent>

        {/* ---- FILTERS ---- */}
        <TabsContent value="filters" className="space-y-2.5 mt-0">
          <div className="flex justify-end">
            <button
              type="button"
              onClick={resetFilters}
              className="text-[11px] text-muted-foreground hover:text-foreground hover:underline"
            >
              Limpar filtros
            </button>
          </div>
          <div>
            <Label className="text-xs">Quem mostrar</Label>
            <Combobox
              mode="single"
              value={c.filters.mode}
              onValueChange={(v) =>
                setFilter(
                  "mode",
                  (typeof v === "string" ? v : "all") as (typeof FILTER_MODES)[number],
                )
              }
              options={FILTER_MODES.map((m) => ({ value: m, label: FILTER_MODE_LABELS[m] }))}
              clearable={false}
            />
            <p className="text-[11px] text-muted-foreground mt-1">
              Define o subconjunto de colaboradores: todos, ausentes, justificados,
              em atraso, com horas extras, etc.
            </p>
          </div>
          <div>
            <Label className="text-xs">Setores</Label>
            <Combobox
              mode="multiple"
              value={c.filters.sectorNames}
              onValueChange={(v) => setFilter("sectorNames", asArray(v))}
              options={sectorOptions}
              placeholder="Todos os setores"
              searchPlaceholder="Buscar setor..."
            />
          </div>
          <div>
            <Label className="text-xs">Cargos</Label>
            <Combobox
              mode="multiple"
              value={c.filters.positionNames}
              onValueChange={(v) => setFilter("positionNames", asArray(v))}
              options={positionOptions}
              placeholder="Todos os cargos"
              searchPlaceholder="Buscar cargo..."
            />
          </div>
          <div>
            <Label className="text-xs">Termo de busca padrão</Label>
            <Input
              value={c.filters.defaultSearch}
              onChange={(v) =>
                setFilter("defaultSearch", typeof v === "string" ? v : "")
              }
              placeholder="Ex.: parte do nome do colaborador"
            />
            <p className="text-[11px] text-muted-foreground mt-1">
              Aplicado sempre. A caixa de busca em tempo real (se ativada) prevalece.
            </p>
          </div>
        </TabsContent>

        {/* ---- BEHAVIOR ---- */}
        <TabsContent value="behavior" className="space-y-3 mt-0">
          <div className="flex justify-end">
            <button
              type="button"
              onClick={resetBehavior}
              className="text-[11px] text-muted-foreground hover:text-foreground hover:underline"
            >
              Restaurar comportamento
            </button>
          </div>
          <Section title="Layout" defaultOpen>
            <div>
              <Label className="text-xs">Modo de exibição</Label>
              <Combobox
                mode="single"
                value={c.display.layoutMode}
                onValueChange={(v) =>
                  setDisplay(
                    "layoutMode",
                    (typeof v === "string" ? v : "flat") as (typeof LAYOUT_MODES)[number],
                  )
                }
                options={LAYOUT_MODES.map((m) => ({ value: m, label: LAYOUT_LABELS[m] }))}
                clearable={false}
              />
              <p className="text-[11px] text-muted-foreground mt-1">
                <strong>Lista única</strong>: tudo em sequência.{" "}
                <strong>Agrupado por setor</strong>: insere cabeçalho quando o setor muda.
              </p>
            </div>
          </Section>
        </TabsContent>
      </Tabs>
    </div>
  );
}

// ============================================================================
// Definition
// ============================================================================

export const dailyPontoWidget: WidgetDefinition<DailyPontoConfig> = {
  id: "home.daily-ponto",
  name: "Ponto do Dia",
  description:
    "Resumo diário do ponto: colunas configuráveis (incluindo setor, cargo, justificativa), filtros por ausência/justificativa/atraso, busca, agrupamento por setor e largura ajustável arrastando a borda da coluna.",
  icon: IconClock24,
  category: "hr",
  allowedSectors: [
    SECTOR_PRIVILEGES.HUMAN_RESOURCES,
    SECTOR_PRIVILEGES.PRODUCTION_MANAGER,
    SECTOR_PRIVILEGES.ADMIN,
  ],
  defaultSize: { cols: 4, rows: 3 },
  minSize: { cols: 1, rows: 1 },
  maxSize: { cols: 4, rows: 4 },
  configSchema: dailyPontoConfigSchema,
  defaultConfig: {
    title: "Ponto do Dia",
    accent: { color: "teal", icon: "Clock24", borderColor: "none" },
    showHeader: true,
    display: {
      density: "comfortable",
      striping: true,
      gridLines: true,
      hoverHighlight: true,
      stickyHeader: true,
      showSearchBox: true,
      showDayNavigator: true,
      showViewAllLink: true,
      emptyStateMessage: "",
      layoutMode: "flat",
    },
    columns: [
      "userName",
      "sectorName",
      "entrada1",
      "saida1",
      "entrada2",
      "saida2",
      "normais",
      "faltas",
    ],
    filters: { mode: "all", sectorNames: [], positionNames: [], defaultSearch: "" },
    sort: { key: "userName", direction: "asc" },
    limit: 50,
  },
  RenderComponent: DailyPontoRender,
  ConfigComponent: DailyPontoConfigComponent,
};
