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

import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { z } from "zod";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  IconCalendarStats,
  IconAdjustments,
  IconChevronDown,
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
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "../../components/ui/collapsible";
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
import { ToggleRow } from "./_shared";
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

const EVENT_BAR_CLASSES: Record<EventType, string> = {
  term:
    "bg-red-500/15 text-red-700 dark:text-red-300 border border-red-500/30",
  forecastDate:
    "bg-orange-500/15 text-orange-700 dark:text-orange-300 border border-orange-500/30",
  startedAt:
    "bg-blue-500/15 text-blue-700 dark:text-blue-300 border border-blue-500/30",
  finishedAt:
    "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30",
};

// Stronger styling for term bars on tasks already past the deadline (and not
// yet completed) — we want overdue work to read as escalated, not informational.
const EVENT_BAR_OVERDUE =
  "bg-red-600/30 text-red-800 dark:text-red-200 border border-red-600/50 font-semibold";

const EVENT_DOT_CLASSES: Record<EventType, string> = {
  term: "bg-red-500",
  forecastDate: "bg-orange-500",
  startedAt: "bg-blue-500",
  finishedAt: "bg-emerald-500",
};

const EVENT_ICONS: Record<EventType, React.ComponentType<{ className?: string }>> = {
  term: IconFlag,
  forecastDate: IconCalendarDue,
  startedAt: IconBolt,
  finishedAt: IconCircleCheck,
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
  const navigate = useNavigate();
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
  const [statuses, setStatuses] = useState<TASK_STATUS[]>(config.filters.statuses);

  const grid = useMemo(() => buildPeriodGrid(refMonth), [refMonth]);
  const { start: periodStart, end: periodEnd } = useMemo(
    () => getPayrollPeriod(refMonth),
    [refMonth],
  );

  const effectiveStatuses = useMemo<TASK_STATUS[]>(() => {
    const list = [...statuses];
    if (config.filters.includeCancelled && !list.includes(TASK_STATUS.CANCELLED)) {
      list.push(TASK_STATUS.CANCELLED);
    }
    return list;
  }, [statuses, config.filters.includeCancelled]);

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
    enabled: config.display.showTerm,
  } as any);
  const forecastQ = useTasks({
    ...baseParams,
    forecastDateRange: { from: periodStart, to: periodEnd },
    enabled: config.display.showForecast,
  } as any);
  const startedQ = useTasks({
    ...baseParams,
    startedDateRange: { from: periodStart, to: periodEnd },
    enabled: config.display.showStarted,
  } as any);
  const finishedQ = useTasks({
    ...baseParams,
    finishedDateRange: { from: periodStart, to: periodEnd },
    enabled: config.display.showFinished,
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
    if (config.display.showTerm) slot(termQ.data?.data ?? [], "term", (t) => t.term);
    if (config.display.showForecast) slot(forecastQ.data?.data ?? [], "forecastDate", (t) => t.forecastDate);
    if (config.display.showStarted) slot(startedQ.data?.data ?? [], "startedAt", (t) => t.startedAt);
    if (config.display.showFinished) slot(finishedQ.data?.data ?? [], "finishedAt", (t) => t.finishedAt);
    return map;
  }, [
    termQ.data,
    forecastQ.data,
    startedQ.data,
    finishedQ.data,
    periodStart,
    periodEnd,
    config.display.showTerm,
    config.display.showForecast,
    config.display.showStarted,
    config.display.showFinished,
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

  const statusOptions = useMemo<ComboboxOption[]>(() => {
    return Object.entries(TASK_STATUS_LABELS).map(([value, label]) => ({ value, label }));
  }, []);

  const compact = (size?.cols ?? 4) <= 2;

  const headerExtra = (
    <div className="flex items-center gap-2 flex-wrap justify-end">
      {!compact && config.display.showFilters && (
        <div className="w-44">
          <Combobox
            mode="multiple"
            options={statusOptions}
            value={statuses}
            onValueChange={(v) =>
              setStatuses(Array.isArray(v) ? (v as TASK_STATUS[]) : v ? [v as TASK_STATUS] : [])
            }
            placeholder="Status"
            emptyText="Nenhum"
            searchable
            triggerClassName="h-7 text-xs"
          />
        </div>
      )}
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
                  navigate(routes.production.schedule.details(ev.task.id));
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
        <div className="flex items-center justify-between gap-3 px-1 text-[11px] text-muted-foreground flex-wrap">
          {config.display.showTerm && (
            <SummaryChip type="term" label="Prazos" value={stats.term} />
          )}
          {config.display.showForecast && (
            <SummaryChip type="forecastDate" label="Previsões" value={stats.forecast} />
          )}
          {config.display.showStarted && (
            <SummaryChip type="startedAt" label="Iniciadas" value={stats.started} />
          )}
          {config.display.showFinished && (
            <SummaryChip type="finishedAt" label="Concluídas" value={stats.finished} />
          )}
          {isLoading && <span className="text-[10px] italic">Carregando…</span>}
        </div>
      </div>
    </WidgetCard>
  );
}

function SummaryChip({
  type,
  label,
  value,
}: {
  type: EventType;
  label: string;
  value: number;
}) {
  const Icon = EVENT_ICONS[type];
  const colorText = {
    term: "text-red-700 dark:text-red-300",
    forecastDate: "text-orange-700 dark:text-orange-300",
    startedAt: "text-blue-700 dark:text-blue-300",
    finishedAt: "text-emerald-700 dark:text-emerald-300",
  }[type];
  return (
    <span className="inline-flex items-center gap-1">
      <Icon className={cn("h-3 w-3", colorText)} />
      <span className={cn("font-semibold tabular-nums", colorText)}>{value}</span>
      <span className="hidden sm:inline">{label}</span>
    </span>
  );
}

// ============================================================
// Config component
// ============================================================

function Section({
  title,
  defaultOpen = false,
  children,
}: {
  title: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  return (
    <Collapsible defaultOpen={defaultOpen} className="border border-border rounded-md">
      <CollapsibleTrigger className="w-full flex items-center justify-between px-3 py-2 text-sm font-medium hover:bg-accent/50 [&[data-state=open]>svg]:rotate-180">
        {title}
        <IconChevronDown className="h-4 w-4 transition-transform" />
      </CollapsibleTrigger>
      <CollapsibleContent className="px-3 pb-3 pt-1 space-y-3">{children}</CollapsibleContent>
    </Collapsible>
  );
}

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

      <Tabs defaultValue="display" className="flex flex-col gap-2">
        <TabsList className="self-start">
          <TabsTrigger value="display" className="gap-1">
            <IconAdjustments className="h-3.5 w-3.5" /> Exibição
          </TabsTrigger>
          <TabsTrigger value="filters" className="gap-1">
            <IconCalendarStats className="h-3.5 w-3.5" /> Filtros
          </TabsTrigger>
          <TabsTrigger value="appearance">Aparência</TabsTrigger>
        </TabsList>

        <TabsContent value="display" className="space-y-3 mt-0">
          <Section title="Tipos de evento" defaultOpen>
            <ToggleRow
              label="Prazo (term)"
              hint="Bara vermelha; vermelho mais forte quando vencido."
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
