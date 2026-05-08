// Production Calendar widget — monthly view (26 → 25) of tasks plotted by
// their relevant date events: prazo (term), previsão (forecastDate),
// iniciada (startedAt) and concluída (finishedAt). Each event type is
// colored and toggleable so a user can see at a glance which tasks have
// deadlines or completions falling in the current payroll period.
//
// Implementation: four parallel useTasks calls, each filtered by its own
// date range. React-query caches each independently and the merge is done
// client-side. Tasks that fall in multiple buckets show one bar per event
// type (and one tooltip line per type).

import { useEffect, useMemo, useState } from "react";
import { z } from "zod";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  IconCalendarStats,
  IconAdjustments,
  IconFlag,
  IconCalendarDue,
  IconBolt,
  IconCircleCheck,
} from "@tabler/icons-react";

import { SECTOR_PRIVILEGES, TASK_STATUS, TASK_STATUS_LABELS } from "../../constants";
import { routes } from "../../constants/routes";
import { useTasks } from "../../hooks";
import type { Task } from "../../types";
import { Combobox } from "../../components/ui/combobox";
import type { ComboboxOption } from "../../components/ui/combobox";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";
import { TruckDetailModal } from "../../components/production/garage/truck-detail-modal";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "../../components/ui/tooltip";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "../../components/ui/tabs";
import { cn } from "../../lib/utils";

import { WidgetCard } from "../components/widget-card";
import {
  AccentPicker,
  makeAccentSchema,
  resolveAccent,
} from "../components/widget-accent";
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
import { Section, ToggleRow } from "./_shared";
import {
  CalendarGrid,
  PeriodHeader,
  buildPeriodGrid,
  defaultRefMonth,
  getPayrollPeriod,
  toIsoDay,
} from "./_calendar-shared";

// ============================================================
// Event types
// ============================================================

const EVENT_TYPES = ["term", "forecastDate", "startedAt", "finishedAt"] as const;
type EventType = (typeof EVENT_TYPES)[number];

const EVENT_LABELS: Record<EventType, string> = {
  term: "Prazo",
  forecastDate: "Previsão",
  startedAt: "Iniciada",
  finishedAt: "Concluída",
};

// Each event type owns a unique hue so the legend reads at a glance:
//   purple = prazo (deadline marker), orange = previsão (forecast),
//   blue   = iniciada, green = concluída, red = vencido (escalated overdue —
//   distinct from purple/term so a past-due deadline doesn't visually collide
//   with the deadline itself, which is what the user pointed out previously).
const EVENT_BAR_CLASSES: Record<EventType, string> = {
  term: "bg-purple-600 text-white border border-purple-700",
  forecastDate: "bg-orange-600 text-white border border-orange-700",
  startedAt: "bg-blue-600 text-white border border-blue-700",
  finishedAt: "bg-green-700 text-white border border-green-800",
};

const EVENT_BAR_OVERDUE =
  "bg-red-700 text-white border border-red-800 font-semibold";

const EVENT_DOT_CLASSES: Record<EventType, string> = {
  term: "bg-purple-600",
  forecastDate: "bg-orange-600",
  startedAt: "bg-blue-600",
  finishedAt: "bg-green-700",
};

interface DayEvent {
  type: EventType;
  task: Task;
}

// ============================================================
// Config schema
// ============================================================

const productionCalendarConfigSchema = z.object({
  title: z.string().min(1).max(80).default("Calendário de Produção"),
  accent: makeAccentSchema({
    color: "indigo",
    icon: "Calendar",
    borderColor: "none",
  }),
  display: z
    .object({
      showFilters: z.boolean().default(true),
      showTerm: z.boolean().default(true),
      showForecast: z.boolean().default(true),
      showStarted: z.boolean().default(true),
      showFinished: z.boolean().default(true),
      showSunday: z.boolean().default(true),
      showSaturday: z.boolean().default(true),
    })
    .default({
      showFilters: true,
      showTerm: true,
      showForecast: true,
      showStarted: true,
      showFinished: true,
      showSunday: true,
      showSaturday: true,
    }),
  filters: z
    .object({
      statuses: z
        .array(z.nativeEnum(TASK_STATUS))
        .default([
          TASK_STATUS.PREPARATION,
          TASK_STATUS.WAITING_PRODUCTION,
          TASK_STATUS.IN_PRODUCTION,
          TASK_STATUS.COMPLETED,
        ]),
      includeCancelled: z.boolean().default(false),
    })
    .default({
      statuses: [
        TASK_STATUS.PREPARATION,
        TASK_STATUS.WAITING_PRODUCTION,
        TASK_STATUS.IN_PRODUCTION,
        TASK_STATUS.COMPLETED,
      ],
      includeCancelled: false,
    }),
});
type ProductionCalendarConfig = z.infer<typeof productionCalendarConfigSchema>;

// ============================================================
// Render
// ============================================================

const TASK_INCLUDE = {
  customer: { select: { fantasyName: true, corporateName: true } },
  sector: { select: { id: true, name: true } },
} as const;

function ProductionCalendarRender({
  config,
  size,
}: WidgetRenderProps<ProductionCalendarConfig>) {
  const accent = useMemo(
    () =>
      resolveAccent({
        color: config.accent?.color as WidgetAccentColor,
        icon: config.accent?.icon as WidgetAccentIcon,
      }),
    [config.accent?.color, config.accent?.icon],
  );
  const AccentIcon = accent.Icon;

  const [refMonth, setRefMonth] = useState<Date>(() => defaultRefMonth());

  // Status filter is set in the configure modal's "Filtros" tab — never
  // exposed in the widget header (no removable chips dangling in the title bar).
  const effectiveStatuses = useMemo<TASK_STATUS[]>(() => {
    const list = [...config.filters.statuses];
    if (config.filters.includeCancelled && !list.includes(TASK_STATUS.CANCELLED)) {
      list.push(TASK_STATUS.CANCELLED);
    }
    return list;
  }, [config.filters.statuses, config.filters.includeCancelled]);

  // Local visibility toggles for each event type, seeded from config.display.*.
  // Tile clicks below mutate these — saved config defaults are preserved
  // until the next manual toggle. Re-syncs when the saved config changes.
  const [showTerm, setShowTerm] = useState(config.display.showTerm);
  const [showForecast, setShowForecast] = useState(config.display.showForecast);
  const [showStarted, setShowStarted] = useState(config.display.showStarted);
  const [showFinished, setShowFinished] = useState(config.display.showFinished);
  useEffect(() => setShowTerm(config.display.showTerm), [config.display.showTerm]);
  useEffect(() => setShowForecast(config.display.showForecast), [config.display.showForecast]);
  useEffect(() => setShowStarted(config.display.showStarted), [config.display.showStarted]);
  useEffect(() => setShowFinished(config.display.showFinished), [config.display.showFinished]);

  // Click-to-open task modal — same flow as the production schedule page.
  const [modalTaskId, setModalTaskId] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const openTaskModal = (taskId: string) => {
    setModalTaskId(taskId);
    setModalOpen(true);
  };

  const grid = useMemo(() => buildPeriodGrid(refMonth), [refMonth]);
  const { start: periodStart, end: periodEnd } = useMemo(
    () => getPayrollPeriod(refMonth),
    [refMonth],
  );

  const baseParams = {
    take: 200,
    status: effectiveStatuses.length > 0 ? effectiveStatuses : undefined,
    include: TASK_INCLUDE as any,
    orderBy: { name: "asc" as const },
  };

  // One query per active event type. React-query keeps each cached separately,
  // and the period bound on each `from/to` lets us fetch only what the period
  // can show. enabled=false zeroes-out the request when the user has hidden
  // the category — saves bandwidth on narrow widgets.
  const termQ = useTasks({
    ...baseParams,
    termRange: { from: periodStart, to: periodEnd },
    enabled: showTerm,
  } as any);
  const forecastQ = useTasks({
    ...baseParams,
    forecastDateRange: { from: periodStart, to: periodEnd },
    enabled: showForecast,
  } as any);
  const startedQ = useTasks({
    ...baseParams,
    startedDateRange: { from: periodStart, to: periodEnd },
    enabled: showStarted,
  } as any);
  const finishedQ = useTasks({
    ...baseParams,
    finishedDateRange: { from: periodStart, to: periodEnd },
    enabled: showFinished,
  } as any);

  const isLoading =
    termQ.isLoading ||
    forecastQ.isLoading ||
    startedQ.isLoading ||
    finishedQ.isLoading;
  const isFetching =
    termQ.isFetching ||
    forecastQ.isFetching ||
    startedQ.isFetching ||
    finishedQ.isFetching;

  const onRefresh = () => {
    termQ.refresh();
    forecastQ.refresh();
    startedQ.refresh();
    finishedQ.refresh();
  };

  // Build day → events map. Iterate each query's data, slot by date key.
  const dayEvents = useMemo(() => {
    const map = new Map<string, DayEvent[]>();
    const push = (key: string, ev: DayEvent) => {
      const arr = map.get(key) ?? [];
      arr.push(ev);
      map.set(key, arr);
    };
    const slot = (tasks: Task[] | undefined, type: EventType, picker: (t: Task) => Date | null | undefined) => {
      if (!tasks) return;
      for (const t of tasks) {
        const d = picker(t);
        if (!d) continue;
        const dt = d instanceof Date ? d : new Date(d);
        if (Number.isNaN(dt.getTime())) continue;
        if (dt < periodStart || dt > periodEnd) continue;
        push(toIsoDay(dt), { type, task: t });
      }
    };
    if (showTerm) slot(termQ.data?.data ?? [], "term", (t) => t.term);
    if (showForecast) slot(forecastQ.data?.data ?? [], "forecastDate", (t) => t.forecastDate);
    if (showStarted) slot(startedQ.data?.data ?? [], "startedAt", (t) => t.startedAt);
    if (showFinished) slot(finishedQ.data?.data ?? [], "finishedAt", (t) => t.finishedAt);
    return map;
  }, [
    termQ.data,
    forecastQ.data,
    startedQ.data,
    finishedQ.data,
    periodStart,
    periodEnd,
    showTerm,
    showForecast,
    showStarted,
    showFinished,
  ]);

  // Footer counters — total events of each visible type within the period.
  const stats = useMemo(() => {
    let term = 0;
    let forecast = 0;
    let started = 0;
    let finished = 0;
    for (const evs of dayEvents.values()) {
      for (const e of evs) {
        if (e.type === "term") term++;
        else if (e.type === "forecastDate") forecast++;
        else if (e.type === "startedAt") started++;
        else if (e.type === "finishedAt") finished++;
      }
    }
    return { term, forecast, started, finished };
  }, [dayEvents]);

  // Header — only period nav. Status filtering moved entirely to the
  // configure modal's "Filtros" tab so the title bar stays clean.
  // (Suppress unused-var lint for size since we no longer branch on it.)
  void size;
  const headerExtra = (
    <div className="flex items-center gap-2 flex-wrap justify-end">
      <PeriodHeader
        refMonth={refMonth}
        onChange={setRefMonth}
        onRefresh={onRefresh}
        isFetching={isFetching}
      />
    </div>
  );

  // Today's date for overdue detection (term in the past + task not finished).
  const today = useMemo(() => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), d.getDate());
  }, []);

  // Per-day cell renderer.
  const renderCell = ({ date }: { date: Date }) => {
    const events = dayEvents.get(toIsoDay(date)) ?? [];
    if (events.length === 0) {
      return (
        <div className="h-full flex flex-col">
          <span className="text-xs font-semibold tabular-nums text-foreground">
            {format(date, "d")}
          </span>
        </div>
      );
    }

    // Sort: term first, forecast, started, finished — same column ordering as
    // the legend so a row of bars reads predictably.
    const order: Record<EventType, number> = {
      term: 0,
      forecastDate: 1,
      startedAt: 2,
      finishedAt: 3,
    };
    events.sort((a, b) => order[a.type] - order[b.type]);

    const hasOverflow = events.length > 2;

    const cell = (
      <div className="h-full flex flex-col">
        <div className="flex items-start justify-between">
          <span className="text-xs font-semibold tabular-nums text-foreground">
            {format(date, "d")}
          </span>
          {hasOverflow && (
            <span
              className="text-[8px] font-semibold text-muted-foreground tabular-nums"
              title="Role para ver mais eventos"
            >
              ⇅
            </span>
          )}
        </div>
        {/* Scrollable events list — when the day has more bars than fit, the
            user scrolls inside the cell instead of being capped at +N. */}
        <div
          className="mt-0.5 space-y-0.5 flex-1 min-h-0 overflow-y-auto overscroll-contain pr-0.5 [&::-webkit-scrollbar]:w-1 [&::-webkit-scrollbar-thumb]:bg-border [&::-webkit-scrollbar-thumb]:rounded"
          onWheelCapture={(e) => e.stopPropagation()}
        >
          {events.map((ev, i) => {
            const isOverdueTerm =
              ev.type === "term" && date < today && ev.task.status !== TASK_STATUS.COMPLETED;
            const cls = isOverdueTerm ? EVENT_BAR_OVERDUE : EVENT_BAR_CLASSES[ev.type];
            const customerName = (ev.task as any).customer?.fantasyName ?? null;
            const label = customerName ?? ev.task.name ?? "—";
            return (
              <div
                key={`${ev.type}-${ev.task.id}-${i}`}
                className={cn(
                  "text-[9px] px-1 py-px rounded-sm truncate cursor-pointer",
                  cls,
                )}
                onClick={(e) => {
                  e.stopPropagation();
                  openTaskModal(ev.task.id);
                }}
                title={label}
              >
                {label}
              </div>
            );
          })}
        </div>
      </div>
    );

    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <div className="h-full">{cell}</div>
        </TooltipTrigger>
        <TooltipContent side="top" className="max-w-sm">
          <div className="space-y-1 text-xs">
            <div className="font-semibold">
              {format(date, "EEEE, dd 'de' MMMM", { locale: ptBR })}
            </div>
            {events.map((ev, i) => {
              const customerName = (ev.task as any).customer?.fantasyName ?? null;
              const label = customerName ?? ev.task.name ?? "—";
              const isOverdueTerm =
                ev.type === "term" && date < today && ev.task.status !== TASK_STATUS.COMPLETED;
              return (
                <div key={`tt-${ev.type}-${ev.task.id}-${i}`} className="flex items-start gap-1.5">
                  <span
                    className={cn("inline-block w-1.5 h-1.5 rounded-full mt-1 shrink-0", EVENT_DOT_CLASSES[ev.type])}
                  />
                  <span className="min-w-0">
                    <span className="font-medium">{label}</span>
                    <span className="text-muted-foreground">
                      {" "}
                      · {EVENT_LABELS[ev.type]}
                      {isOverdueTerm && (
                        <span className="ml-1 text-red-500 font-semibold">(vencido)</span>
                      )}
                    </span>
                  </span>
                </div>
              );
            })}
          </div>
        </TooltipContent>
      </Tooltip>
    );
  };

  return (
    <WidgetCard
      title={<span className={accent.classes.text}>{config.title}</span>}
      icon={<AccentIcon className={`h-4 w-4 ${accent.classes.icon}`} />}
      headerExtra={headerExtra}
      viewAllHref={routes.production.schedule.list}
      borderColor={config.accent?.borderColor as WidgetBorderColor | undefined}
    >
      <div className="h-full flex flex-col p-2 gap-2">
        <CalendarGrid
          grid={grid}
          renderCell={renderCell}
          weekDayMode="short"
          showSunday={config.display.showSunday}
          showSaturday={config.display.showSaturday}
        />

        {/* Legend tiles — click to show/hide each event type. Mirrors the
            StatsRow tiles on the full Calendário de Produção page. */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 px-1 flex-shrink-0">
          <LegendTile
            icon={IconFlag}
            label="Prazos"
            value={stats.term}
            tone="purple"
            active={showTerm}
            onClick={() => setShowTerm((v) => !v)}
          />
          <LegendTile
            icon={IconCalendarDue}
            label="Previsões"
            value={stats.forecast}
            tone="orange"
            active={showForecast}
            onClick={() => setShowForecast((v) => !v)}
          />
          <LegendTile
            icon={IconBolt}
            label="Iniciadas"
            value={stats.started}
            tone="blue"
            active={showStarted}
            onClick={() => setShowStarted((v) => !v)}
          />
          <LegendTile
            icon={IconCircleCheck}
            label="Concluídas"
            value={stats.finished}
            tone="green"
            active={showFinished}
            onClick={() => setShowFinished((v) => !v)}
          />
        </div>
        {isLoading && (
          <span className="text-[10px] italic text-muted-foreground px-1">Carregando…</span>
        )}
      </div>

      {/* Click-to-open task modal (reuses the garage feature's task detail modal). */}
      <TruckDetailModal
        taskId={modalTaskId}
        open={modalOpen}
        onOpenChange={(open) => {
          setModalOpen(open);
          if (!open) setModalTaskId(null);
        }}
      />
    </WidgetCard>
  );
}

// ============================================================
// Legend tile — clickable visibility toggle for an event type.
// ============================================================

function LegendTile({
  icon: Icon,
  label,
  value,
  tone,
  active,
  onClick,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: number;
  tone: "purple" | "orange" | "blue" | "green";
  active: boolean;
  onClick: () => void;
}) {
  const toneClasses: Record<typeof tone, string> = {
    purple: "bg-purple-500/10 text-purple-600 dark:text-purple-400 ring-purple-500/20",
    orange: "bg-orange-500/10 text-orange-600 dark:text-orange-400 ring-orange-500/20",
    blue: "bg-blue-500/10 text-blue-600 dark:text-blue-400 ring-blue-500/20",
    green: "bg-green-500/10 text-green-600 dark:text-green-400 ring-green-500/20",
  };
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      title={
        active
          ? `Ocultar ${label.toLowerCase()} no calendário`
          : `Mostrar ${label.toLowerCase()} no calendário`
      }
      className={cn(
        "flex items-center gap-2 rounded-md border border-border bg-card px-2.5 py-1.5 text-left transition-all hover:border-primary/40 cursor-pointer focus:outline-none focus:ring-2 focus:ring-primary/40",
        !active && "opacity-40 grayscale",
      )}
    >
      <div className={cn("rounded p-1 ring-1 relative", toneClasses[tone])}>
        <Icon className="h-3.5 w-3.5" />
        {!active && (
          <span className="absolute inset-1 flex items-center justify-center pointer-events-none">
            <span className="block h-[1.5px] w-full rotate-45 bg-current rounded-full" />
          </span>
        )}
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-[9px] uppercase tracking-wide text-muted-foreground font-medium leading-none">
          {label}
        </div>
        <div className="text-sm font-bold tabular-nums leading-tight">{value}</div>
      </div>
    </button>
  );
}

// ============================================================
// Config component
// ============================================================

function ProductionCalendarConfigComponent({
  config,
  onChange,
}: WidgetConfigProps<ProductionCalendarConfig>) {
  const set = <K extends keyof ProductionCalendarConfig>(
    key: K,
    value: ProductionCalendarConfig[K],
  ) => onChange({ ...config, [key]: value });
  const setDisplay = <K extends keyof ProductionCalendarConfig["display"]>(
    key: K,
    value: ProductionCalendarConfig["display"][K],
  ) => onChange({ ...config, display: { ...config.display, [key]: value } });
  const setFilters = <K extends keyof ProductionCalendarConfig["filters"]>(
    key: K,
    value: ProductionCalendarConfig["filters"][K],
  ) => onChange({ ...config, filters: { ...config.filters, [key]: value } });

  const accentColor = (config.accent?.color ?? "indigo") as WidgetAccentColor;
  const accentIcon = (config.accent?.icon ?? "Calendar") as WidgetAccentIcon;
  const borderColor = (config.accent?.borderColor ?? "none") as WidgetBorderColor;

  const statusOptions = useMemo<ComboboxOption[]>(
    () => Object.entries(TASK_STATUS_LABELS).map(([value, label]) => ({ value, label })),
    [],
  );

  return (
    <div className="space-y-3 max-h-[70vh] overflow-y-auto pr-1 -mr-1">
      <div className="space-y-1.5">
        <Label className="text-sm">Título</Label>
        <Input
          value={config.title}
          onChange={(v) => set("title", typeof v === "string" ? v : "")}
          placeholder="Calendário de Produção"
        />
      </div>

      <Tabs defaultValue="appearance" className="flex flex-col gap-2">
        <TabsList className="self-start">
          <TabsTrigger value="appearance" className="gap-1">
            <IconAdjustments className="h-3.5 w-3.5" /> Aparência
          </TabsTrigger>
          <TabsTrigger value="display" className="gap-1">
            <IconCalendarStats className="h-3.5 w-3.5" /> Exibição
          </TabsTrigger>
          <TabsTrigger value="filters" className="gap-1">
            <IconFlag className="h-3.5 w-3.5" /> Filtros
          </TabsTrigger>
        </TabsList>

        <TabsContent value="appearance" className="space-y-3 mt-0">
          <Section title="Acento (cor, ícone, borda)" defaultOpen>
            <AccentPicker
              value={{ color: accentColor, icon: accentIcon, borderColor }}
              onChange={(next) =>
                set("accent", {
                  color: next.color,
                  icon: next.icon,
                  borderColor: next.borderColor,
                } as ProductionCalendarConfig["accent"])
              }
            />
          </Section>
        </TabsContent>

        <TabsContent value="display" className="space-y-3 mt-0">
          <Section title="Tipos de evento" defaultOpen>
            <ToggleRow
              label="Prazo (term)"
              hint="Barra roxa; vermelho mais forte quando vencido."
              checked={config.display.showTerm}
              onCheckedChange={(v) => setDisplay("showTerm", v)}
            />
            <ToggleRow
              label="Previsão (forecastDate)"
              hint="Barra laranja."
              checked={config.display.showForecast}
              onCheckedChange={(v) => setDisplay("showForecast", v)}
            />
            <ToggleRow
              label="Iniciada (startedAt)"
              hint="Barra azul — data em que a tarefa entrou em produção."
              checked={config.display.showStarted}
              onCheckedChange={(v) => setDisplay("showStarted", v)}
            />
            <ToggleRow
              label="Concluída (finishedAt)"
              hint="Barra verde."
              checked={config.display.showFinished}
              onCheckedChange={(v) => setDisplay("showFinished", v)}
            />
          </Section>

          <Section title="Layout">
            <ToggleRow
              label="Mostrar filtros no cabeçalho"
              hint="Permite trocar status sem abrir as configurações."
              checked={config.display.showFilters}
              onCheckedChange={(v) => setDisplay("showFilters", v)}
            />
            <ToggleRow
              label="Mostrar domingo"
              hint="Oculta a coluna de domingo quando desativado."
              checked={config.display.showSunday}
              onCheckedChange={(v) => setDisplay("showSunday", v)}
            />
            <ToggleRow
              label="Mostrar sábado"
              hint="Oculta a coluna de sábado quando desativado."
              checked={config.display.showSaturday}
              onCheckedChange={(v) => setDisplay("showSaturday", v)}
            />
            <p className="text-[11px] text-muted-foreground">
              Quando um dia tem mais eventos do que cabem, a célula rola
              verticalmente. A tooltip continua mostrando todos.
            </p>
          </Section>
        </TabsContent>

        <TabsContent value="filters" className="space-y-3 mt-0">
          <Section title="Status das tarefas" defaultOpen>
            <Combobox
              mode="multiple"
              options={statusOptions}
              value={config.filters.statuses}
              onValueChange={(v) =>
                setFilters("statuses", Array.isArray(v) ? (v as TASK_STATUS[]) : [])
              }
              placeholder="Selecione os status"
              emptyText="Nenhum"
              searchable
            />
            <ToggleRow
              label="Incluir tarefas canceladas"
              checked={config.filters.includeCancelled}
              onCheckedChange={(v) => setFilters("includeCancelled", v)}
            />
          </Section>
        </TabsContent>

      </Tabs>
    </div>
  );
}

// ============================================================
// Definition
// ============================================================

export const productionCalendarWidget: WidgetDefinition<ProductionCalendarConfig> = {
  id: "home.production-calendar",
  name: "Calendário de Produção",
  description:
    "Visão mensal do período (26→25) com tarefas plotadas por prazo, previsão, início e conclusão. Cada tipo de evento tem cor própria e pode ser ativado/desativado.",
  icon: IconCalendarStats,
  category: "production",
  allowedSectors: [
    SECTOR_PRIVILEGES.ADMIN,
    SECTOR_PRIVILEGES.PRODUCTION,
    SECTOR_PRIVILEGES.PRODUCTION_MANAGER,
    SECTOR_PRIVILEGES.COMMERCIAL,
    SECTOR_PRIVILEGES.LOGISTIC,
    SECTOR_PRIVILEGES.WAREHOUSE,
    SECTOR_PRIVILEGES.DESIGNER,
    SECTOR_PRIVILEGES.PLOTTING,
    SECTOR_PRIVILEGES.MAINTENANCE,
  ],
  defaultSize: { cols: 4, rows: 3 },
  minSize: { cols: 2, rows: 3 },
  maxSize: { cols: 4, rows: 4 },
  configSchema: productionCalendarConfigSchema,
  defaultConfig: {
    title: "Calendário de Produção",
    accent: { color: "indigo", icon: "Calendar", borderColor: "none" },
    display: {
      showFilters: true,
      showTerm: true,
      showForecast: true,
      showStarted: true,
      showFinished: true,
      showSunday: true,
      showSaturday: true,
    },
    filters: {
      statuses: [
        TASK_STATUS.PREPARATION,
        TASK_STATUS.WAITING_PRODUCTION,
        TASK_STATUS.IN_PRODUCTION,
        TASK_STATUS.COMPLETED,
      ],
      includeCancelled: false,
    },
  },
  RenderComponent: ProductionCalendarRender,
  ConfigComponent: ProductionCalendarConfigComponent,
};
