// Production schedule calendar — full-page version of the home dashboard
// `production-calendar` widget. Plots tasks across the payroll period
// (day 26 → day 25) keyed by four event types:
//   • Prazo        (term)         — red, escalates when overdue + not done
//   • Previsão     (forecastDate) — orange
//   • Iniciada     (startedAt)    — blue
//   • Concluída    (finishedAt)   — emerald
//
// Layout mirrors the HR `AbsencesCalendar` page: single-row filter bar
// (status + sector + view toggle + period nav), horizontal stat tiles
// that double as visibility toggles, and a 7-col grid with auto-rows
// that fills the available height. Clicking a day selects it and opens
// the right-side detail panel — only the panel rows navigate to a task.

import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  addMonths,
  addYears,
  eachDayOfInterval,
  format,
  isSameDay,
  subMonths,
  subYears,
} from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  IconBolt,
  IconCalendar,
  IconCalendarDue,
  IconCalendarStats,
  IconChevronLeft,
  IconChevronRight,
  IconCircleCheck,
  IconExternalLink,
  IconFlag,
  IconRefresh,
} from "@tabler/icons-react";

import {
  SECTOR_PRIVILEGES,
  TASK_STATUS,
  TASK_STATUS_LABELS,
} from "../../../../constants";
import { routes } from "../../../../constants/routes";
import { useSectors, useTasks } from "../../../../hooks";
import type { Sector, Task } from "../../../../types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Combobox } from "@/components/ui/combobox";
import type { ComboboxOption } from "@/components/ui/combobox";
import { LoadingSpinner } from "@/components/ui/loading";
import { cn } from "@/lib/utils";

// ============================================================
// Period math (mirrors _calendar-shared in dashboard widgets)
// ============================================================

function getPayrollPeriod(refMonth: Date): { start: Date; end: Date } {
  const start = new Date(refMonth.getFullYear(), refMonth.getMonth() - 1, 26);
  const end = new Date(refMonth.getFullYear(), refMonth.getMonth(), 25);
  return { start, end };
}

function startOfWeekSunday(d: Date): Date {
  const out = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  out.setDate(out.getDate() - out.getDay());
  return out;
}

function endOfWeekSaturday(d: Date): Date {
  const out = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  out.setDate(out.getDate() + (6 - out.getDay()));
  return out;
}

function toIsoDay(d: Date): string {
  return format(d, "yyyy-MM-dd");
}

function defaultRefMonth(): Date {
  const today = new Date();
  return today.getDate() >= 26
    ? new Date(today.getFullYear(), today.getMonth() + 1, 1)
    : new Date(today.getFullYear(), today.getMonth(), 1);
}

// ============================================================
// Event types + visual tokens
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
  term: "bg-red-500/15 text-red-700 dark:text-red-300 border border-red-500/30",
  forecastDate:
    "bg-orange-500/15 text-orange-700 dark:text-orange-300 border border-orange-500/30",
  startedAt:
    "bg-blue-500/15 text-blue-700 dark:text-blue-300 border border-blue-500/30",
  finishedAt:
    "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30",
};

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

type ViewMode = "month" | "year";

const WEEK_DAYS_FULL = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];
const MINI_WEEK_DAYS = ["D", "S", "T", "Q", "Q", "S", "S"];

const TASK_INCLUDE = {
  customer: { select: { fantasyName: true, corporateName: true } },
  sector: { select: { id: true, name: true } },
} as const;

const ALL_SECTORS = "__all__";

// ============================================================
// Component
// ============================================================

export function TaskScheduleCalendar() {
  const navigate = useNavigate();

  const [refMonth, setRefMonth] = useState<Date>(() => defaultRefMonth());
  const [viewMode, setViewMode] = useState<ViewMode>("month");
  const [sectorId, setSectorId] = useState<string>(ALL_SECTORS);

  // Status filter is fixed — production calendar focuses on tasks that
  // are actively flowing through the pipeline. Cancelled tasks are hidden.
  const statuses = useMemo<TASK_STATUS[]>(
    () => [
      TASK_STATUS.PREPARATION,
      TASK_STATUS.WAITING_PRODUCTION,
      TASK_STATUS.IN_PRODUCTION,
      TASK_STATUS.COMPLETED,
    ],
    [],
  );

  const [showTerm, setShowTerm] = useState(true);
  const [showForecast, setShowForecast] = useState(true);
  const [showStarted, setShowStarted] = useState(true);
  const [showFinished, setShowFinished] = useState(true);

  const [selectedDay, setSelectedDay] = useState<Date | null>(null);

  const range = useMemo(() => {
    if (viewMode === "year") {
      const start = new Date(refMonth.getFullYear() - 1, 11, 26);
      const end = new Date(refMonth.getFullYear(), 11, 25);
      return { periodStart: start, periodEnd: end, gridStart: start, gridEnd: end };
    }
    const { start, end } = getPayrollPeriod(refMonth);
    return {
      periodStart: start,
      periodEnd: end,
      gridStart: startOfWeekSunday(start),
      gridEnd: endOfWeekSaturday(end),
    };
  }, [refMonth, viewMode]);

  const today = useMemo(() => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), d.getDate());
  }, []);

  useEffect(() => {
    if (!selectedDay) return;
    if (selectedDay < range.periodStart || selectedDay > range.periodEnd) {
      setSelectedDay(null);
    }
  }, [selectedDay, range.periodStart, range.periodEnd]);

  // ←/→ keyboard navigation
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
      if (e.metaKey || e.ctrlKey || e.altKey || e.shiftKey) return;
      const target = e.target as HTMLElement | null;
      if (
        target?.closest(
          "input, textarea, select, [contenteditable='true'], [role='combobox'], [role='listbox'], [role='dialog'], [role='menu']",
        )
      ) {
        return;
      }
      e.preventDefault();
      if (e.key === "ArrowLeft") {
        setRefMonth((p) => (viewMode === "year" ? subYears(p, 1) : subMonths(p, 1)));
      } else {
        setRefMonth((p) => (viewMode === "year" ? addYears(p, 1) : addMonths(p, 1)));
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [viewMode]);

  // Only production-privileged sectors can carry production tasks, so the
  // filter dropdown is restricted to those — listing HR / Admin / Finance
  // sectors here would always return zero tasks.
  const { data: sectorsData, isLoading: sectorsLoading } = useSectors({
    orderBy: { name: "asc" },
    take: 100,
  } as any);
  const sectorOptions = useMemo<ComboboxOption[]>(() => {
    const list = ((sectorsData?.data ?? []) as Sector[]).filter(
      (s) => s.privileges === SECTOR_PRIVILEGES.PRODUCTION,
    );
    return [
      { value: ALL_SECTORS, label: "Todos os setores" },
      ...list.map((s) => ({ value: s.id, label: s.name })),
    ];
  }, [sectorsData]);

  // Always fetch all four event-type ranges. The visibility toggles flip
  // a render-time flag (showTerm, …) so clicking a stat tile hides bars
  // immediately from cached data instead of triggering a network round-trip.
  const baseParams = {
    take: 500,
    status: statuses,
    sectorIds: sectorId === ALL_SECTORS ? undefined : [sectorId],
    include: TASK_INCLUDE as any,
    orderBy: { name: "asc" as const },
  };

  const termQ = useTasks({
    ...baseParams,
    termRange: { from: range.periodStart, to: range.periodEnd },
  } as any);
  const forecastQ = useTasks({
    ...baseParams,
    forecastDateRange: { from: range.periodStart, to: range.periodEnd },
  } as any);
  const startedQ = useTasks({
    ...baseParams,
    startedDateRange: { from: range.periodStart, to: range.periodEnd },
  } as any);
  const finishedQ = useTasks({
    ...baseParams,
    finishedDateRange: { from: range.periodStart, to: range.periodEnd },
  } as any);

  const isLoading =
    termQ.isLoading || forecastQ.isLoading || startedQ.isLoading || finishedQ.isLoading;
  const isFetching =
    termQ.isFetching || forecastQ.isFetching || startedQ.isFetching || finishedQ.isFetching;

  const onRefresh = () => {
    termQ.refresh();
    forecastQ.refresh();
    startedQ.refresh();
    finishedQ.refresh();
  };

  const dayEvents = useMemo(() => {
    const map = new Map<string, DayEvent[]>();
    const push = (key: string, ev: DayEvent) => {
      const arr = map.get(key) ?? [];
      arr.push(ev);
      map.set(key, arr);
    };
    const slot = (
      tasks: Task[] | undefined,
      type: EventType,
      picker: (t: Task) => Date | null | undefined,
    ) => {
      if (!tasks) return;
      for (const t of tasks) {
        const d = picker(t);
        if (!d) continue;
        const dt = d instanceof Date ? d : new Date(d);
        if (Number.isNaN(dt.getTime())) continue;
        if (dt < range.periodStart || dt > range.periodEnd) continue;
        // Past-date filter: only Iniciada, Concluída and overdue Prazos
        // are meaningful once a day is in the past. Forecasts and
        // already-completed prazos on past dates are noise — the
        // finishedAt bar already records the outcome.
        const isPast = dt < today;
        if (isPast) {
          if (type === "forecastDate") continue;
          if (type === "term" && t.status === TASK_STATUS.COMPLETED) continue;
        }
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
    range.periodStart,
    range.periodEnd,
    today,
    showTerm,
    showForecast,
    showStarted,
    showFinished,
  ]);

  const stats = useMemo(() => {
    let term = 0,
      forecast = 0,
      started = 0,
      finished = 0,
      overdue = 0;
    for (const [key, evs] of dayEvents.entries()) {
      const [y, m, d] = key.split("-").map(Number);
      const dt = new Date(y, (m ?? 1) - 1, d ?? 1);
      for (const e of evs) {
        if (e.type === "term") {
          term++;
          if (dt < today && e.task.status !== TASK_STATUS.COMPLETED) overdue++;
        } else if (e.type === "forecastDate") forecast++;
        else if (e.type === "startedAt") started++;
        else if (e.type === "finishedAt") finished++;
      }
    }
    return { term, forecast, started, finished, overdue };
  }, [dayEvents, today]);

  const goPrev = () =>
    setRefMonth((p) => (viewMode === "year" ? subYears(p, 1) : subMonths(p, 1)));
  const goNext = () =>
    setRefMonth((p) => (viewMode === "year" ? addYears(p, 1) : addMonths(p, 1)));

  const selectedEvents = useMemo<DayEvent[]>(() => {
    if (!selectedDay) return [];
    const evs = dayEvents.get(toIsoDay(selectedDay)) ?? [];
    const order: Record<EventType, number> = {
      term: 0,
      forecastDate: 1,
      startedAt: 2,
      finishedAt: 3,
    };
    return [...evs].sort((a, b) => order[a.type] - order[b.type]);
  }, [selectedDay, dayEvents]);

  return (
    <Card className="h-full flex flex-col shadow-sm border border-border">
      <CardContent className="flex-1 flex flex-col p-4 space-y-4 overflow-hidden">
        {/* Filter bar — sector + view toggle + period nav, all aligned to the
            same baseline so the row reads as a single control strip. */}
        <div className="flex items-center gap-2 flex-shrink-0 flex-wrap">
          <div className="flex-1 min-w-[200px] max-w-md">
            <Combobox
              options={sectorOptions}
              value={sectorId}
              onValueChange={(v) =>
                setSectorId((Array.isArray(v) ? v[0] : v) || ALL_SECTORS)
              }
              placeholder={sectorsLoading ? "Carregando..." : "Setor"}
              emptyText="Nenhum setor"
              searchable
              disabled={sectorsLoading}
              className="w-full"
            />
          </div>

          <div className="flex items-center rounded-md border border-border bg-muted/40 h-10 p-0.5 flex-shrink-0">
            <Button
              type="button"
              size="sm"
              variant={viewMode === "month" ? "default" : "ghost"}
              onClick={() => setViewMode("month")}
              className="h-full px-4 text-xs"
            >
              Mês
            </Button>
            <Button
              type="button"
              size="sm"
              variant={viewMode === "year" ? "default" : "ghost"}
              onClick={() => setViewMode("year")}
              className="h-full px-4 text-xs"
            >
              Ano
            </Button>
          </div>

          <div className="flex items-center gap-1 flex-shrink-0">
            <Button
              type="button"
              variant="outline"
              size="icon"
              onClick={goPrev}
              className="h-10 w-10"
              title={viewMode === "year" ? "Ano anterior (←)" : "Período anterior (←)"}
              aria-label={viewMode === "year" ? "Ano anterior" : "Período anterior"}
              aria-keyshortcuts="ArrowLeft"
            >
              <IconChevronLeft className="h-4 w-4" />
            </Button>
            <div className="flex flex-col items-center justify-center px-3 h-10 min-w-[200px]">
              <div className="flex items-center gap-1.5 text-sm font-semibold leading-none">
                <IconCalendar className="h-4 w-4" />
                <span className="capitalize">
                  {viewMode === "year"
                    ? format(refMonth, "yyyy")
                    : format(refMonth, "MMMM yyyy", { locale: ptBR })}
                </span>
              </div>
              {viewMode === "month" && (
                <div className="text-[11px] text-muted-foreground tabular-nums mt-0.5 leading-none">
                  {format(range.periodStart, "dd/MM", { locale: ptBR })} a{" "}
                  {format(range.periodEnd, "dd/MM/yyyy", { locale: ptBR })}
                </div>
              )}
            </div>
            <Button
              type="button"
              variant="outline"
              size="icon"
              onClick={goNext}
              className="h-10 w-10"
              title={viewMode === "year" ? "Próximo ano (→)" : "Próximo período (→)"}
              aria-label={viewMode === "year" ? "Próximo ano" : "Próximo período"}
              aria-keyshortcuts="ArrowRight"
            >
              <IconChevronRight className="h-4 w-4" />
            </Button>
            <Button
              type="button"
              variant="outline"
              size="icon"
              onClick={onRefresh}
              className="h-10 w-10"
              title="Atualizar"
              aria-label="Atualizar"
            >
              <IconRefresh className={cn("h-4 w-4", isFetching && "animate-spin")} />
            </Button>
          </div>
        </div>

        {/* Stats / toggles */}
        <StatsRow
          stats={stats}
          showTerm={showTerm}
          showForecast={showForecast}
          showStarted={showStarted}
          showFinished={showFinished}
          onToggleTerm={() => setShowTerm((v) => !v)}
          onToggleForecast={() => setShowForecast((v) => !v)}
          onToggleStarted={() => setShowStarted((v) => !v)}
          onToggleFinished={() => setShowFinished((v) => !v)}
        />

        {/* Body */}
        {isLoading ? (
          <div className="flex-1 flex items-center justify-center">
            <LoadingSpinner size="lg" />
          </div>
        ) : (
          <div className="flex-1 min-h-0 flex gap-4 overflow-hidden">
            <div className="flex-1 min-w-0 overflow-hidden">
              {viewMode === "month" ? (
                <MonthView
                  gridStart={range.gridStart}
                  gridEnd={range.gridEnd}
                  periodStart={range.periodStart}
                  periodEnd={range.periodEnd}
                  today={today}
                  dayEvents={dayEvents}
                  selectedDay={selectedDay}
                  onSelectDay={setSelectedDay}
                />
              ) : (
                <YearView
                  year={refMonth.getFullYear()}
                  today={today}
                  dayEvents={dayEvents}
                  onMonthClick={(monthIdx) => {
                    setRefMonth(new Date(refMonth.getFullYear(), monthIdx, 1));
                    setViewMode("month");
                  }}
                />
              )}
            </div>

            {viewMode === "month" && (
              <SidePanel
                selectedDay={selectedDay}
                events={selectedEvents}
                today={today}
                onOpenTask={(task) => {
                  // Finished tasks live in the history detail page; in-flight
                  // tasks live in the preparation detail page (cronograma's
                  // /detalhes is now an alias for the same flow).
                  const path =
                    task.status === TASK_STATUS.COMPLETED
                      ? routes.production.history.details(task.id)
                      : routes.production.preparation.details(task.id);
                  navigate(path);
                }}
                onClose={() => setSelectedDay(null)}
              />
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ============================================================
// Stats row + tile (horizontal, HR-style)
// ============================================================

function StatsRow({
  stats,
  showTerm,
  showForecast,
  showStarted,
  showFinished,
  onToggleTerm,
  onToggleForecast,
  onToggleStarted,
  onToggleFinished,
}: {
  stats: { term: number; forecast: number; started: number; finished: number; overdue: number };
  showTerm: boolean;
  showForecast: boolean;
  showStarted: boolean;
  showFinished: boolean;
  onToggleTerm: () => void;
  onToggleForecast: () => void;
  onToggleStarted: () => void;
  onToggleFinished: () => void;
}) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3 flex-shrink-0">
      <StatTile
        icon={IconFlag}
        label="Prazos"
        value={stats.term}
        suffix={stats.term === 1 ? "tarefa" : "tarefas"}
        tone="red"
        active={showTerm}
        onClick={onToggleTerm}
      />
      <StatTile
        icon={IconCalendarDue}
        label="Previsões"
        value={stats.forecast}
        suffix={stats.forecast === 1 ? "tarefa" : "tarefas"}
        tone="orange"
        active={showForecast}
        onClick={onToggleForecast}
      />
      <StatTile
        icon={IconBolt}
        label="Iniciadas"
        value={stats.started}
        suffix={stats.started === 1 ? "tarefa" : "tarefas"}
        tone="blue"
        active={showStarted}
        onClick={onToggleStarted}
      />
      <StatTile
        icon={IconCircleCheck}
        label="Concluídas"
        value={stats.finished}
        suffix={stats.finished === 1 ? "tarefa" : "tarefas"}
        tone="emerald"
        active={showFinished}
        onClick={onToggleFinished}
      />
      <StatTile
        icon={IconFlag}
        label="Vencidos"
        value={stats.overdue}
        suffix={stats.overdue === 1 ? "prazo" : "prazos"}
        tone="rose"
      />
    </div>
  );
}

function StatTile({
  icon: Icon,
  label,
  value,
  suffix,
  tone,
  active,
  onClick,
}: {
  icon: any;
  label: string;
  value: number;
  suffix?: string;
  tone: "red" | "orange" | "blue" | "emerald" | "rose";
  active?: boolean;
  onClick?: () => void;
}) {
  const toneClasses: Record<typeof tone, string> = {
    red: "bg-red-500/10 text-red-600 dark:text-red-400 ring-red-500/20",
    orange: "bg-orange-500/10 text-orange-600 dark:text-orange-400 ring-orange-500/20",
    blue: "bg-blue-500/10 text-blue-600 dark:text-blue-400 ring-blue-500/20",
    emerald: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 ring-emerald-500/20",
    rose: "bg-rose-600/15 text-rose-700 dark:text-rose-300 ring-rose-600/40",
  };
  const isToggleable = typeof onClick === "function";
  const inactiveClasses = isToggleable && active === false ? "opacity-40 grayscale" : "";
  const Wrapper: any = isToggleable ? "button" : "div";
  return (
    <Wrapper
      type={isToggleable ? "button" : undefined}
      onClick={onClick}
      aria-pressed={isToggleable ? active : undefined}
      title={
        isToggleable
          ? active
            ? `Ocultar ${label.toLowerCase()} no calendário`
            : `Mostrar ${label.toLowerCase()} no calendário`
          : undefined
      }
      className={cn(
        "flex items-center gap-3 rounded-lg border border-border bg-card p-3 text-left transition-all",
        isToggleable &&
          "hover:border-primary/40 cursor-pointer focus:outline-none focus:ring-2 focus:ring-primary/40",
        inactiveClasses,
      )}
    >
      <div className={cn("rounded-md p-2 ring-1 relative", toneClasses[tone])}>
        <Icon className="h-5 w-5" />
        {isToggleable && active === false && (
          <span className="absolute inset-1.5 flex items-center justify-center pointer-events-none">
            <span className="block h-[2px] w-full rotate-45 bg-current rounded-full" />
          </span>
        )}
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-xs uppercase tracking-wide text-muted-foreground font-medium">
          {label}
        </div>
        <div className="text-lg font-bold tabular-nums leading-tight">
          {value}
          {suffix && (
            <span className="text-xs font-normal text-muted-foreground ml-1.5">{suffix}</span>
          )}
        </div>
      </div>
    </Wrapper>
  );
}

// ============================================================
// Per-day event list — renders every event and scrolls inside
// the cell when they don't fit. Cell heights stay locked to the
// row's 1fr share regardless of how many events it has.
// ============================================================

function DayEventList({
  events,
  date,
  today,
}: {
  events: DayEvent[];
  date: Date;
  today: Date;
}) {
  if (events.length === 0) return null;
  return (
    <div
      className="flex-1 min-h-0 flex flex-col gap-1 overflow-y-auto pr-0.5 [&::-webkit-scrollbar]:w-1 [&::-webkit-scrollbar-thumb]:bg-border [&::-webkit-scrollbar-thumb]:rounded"
      onWheelCapture={(e) => e.stopPropagation()}
    >
      {events.map((ev, i) => {
        const isOverdueTerm =
          ev.type === "term" && date < today && ev.task.status !== TASK_STATUS.COMPLETED;
        const cls = isOverdueTerm ? EVENT_BAR_OVERDUE : EVENT_BAR_CLASSES[ev.type];
        const customer = (ev.task as any).customer?.fantasyName as string | undefined;
        const label = customer ?? ev.task.name ?? "—";
        return (
          <div
            key={`${ev.type}-${ev.task.id}-${i}`}
            className={cn(
              "text-[10px] px-1.5 py-0.5 rounded-sm truncate font-medium flex-shrink-0",
              cls,
            )}
          >
            {label}
          </div>
        );
      })}
    </div>
  );
}

// ============================================================
// Month view
// ============================================================

function MonthView({
  gridStart,
  gridEnd,
  periodStart,
  periodEnd,
  today,
  dayEvents,
  selectedDay,
  onSelectDay,
}: {
  gridStart: Date;
  gridEnd: Date;
  periodStart: Date;
  periodEnd: Date;
  today: Date;
  dayEvents: Map<string, DayEvent[]>;
  selectedDay: Date | null;
  onSelectDay: (d: Date | null) => void;
}) {
  const allDays = eachDayOfInterval({ start: gridStart, end: gridEnd });
  // Lock all rows to the same fraction of available height. `auto-rows-fr`
  // only sets a *minimum* of `1fr`, so a cell whose min-content exceeds
  // that share will stretch the row — making one row much taller than the
  // others. `repeat(N, 1fr)` (no `minmax`) is a hard cap, and inside each
  // cell `flex-1 min-h-0 overflow-y-auto` lets the event list scroll.
  const numRows = Math.max(1, Math.ceil(allDays.length / 7));

  return (
    <div className="h-full flex flex-col rounded-lg border border-border bg-background shadow-sm overflow-hidden">
      <div className="grid grid-cols-7 bg-background border-b-2 border-border">
        {WEEK_DAYS_FULL.map((d) => (
          <div
            key={d}
            className="px-3 py-3 text-center font-bold text-[11px] uppercase tracking-[0.08em] text-foreground/80 border-r last:border-r-0 border-border"
          >
            {d}
          </div>
        ))}
      </div>
      <div
        className="flex-1 grid grid-cols-7 min-h-0"
        style={{ gridTemplateRows: `repeat(${numRows}, minmax(0, 1fr))` }}
      >
        {allDays.map((date, idx) => {
          const isInPeriod = date >= periodStart && date <= periodEnd;
          const isLastCol = (idx + 1) % 7 === 0;
          const isLastRow = idx >= allDays.length - 7;

          // Out-of-period spacers — keep grid alignment but read as inactive.
          if (!isInPeriod) {
            return (
              <div
                key={idx}
                aria-hidden
                className={cn(
                  "min-h-[120px] bg-muted/20 border-border",
                  !isLastCol && "border-r",
                  !isLastRow && "border-b",
                )}
              />
            );
          }

          const isToday = isSameDay(date, today);
          const isSelected = selectedDay ? isSameDay(date, selectedDay) : false;
          const dow = date.getDay();
          const isWeekend = dow === 0 || dow === 6;
          const events = dayEvents.get(toIsoDay(date)) ?? [];
          const order: Record<EventType, number> = {
            term: 0,
            forecastDate: 1,
            startedAt: 2,
            finishedAt: 3,
          };
          const sortedEvents = [...events].sort((a, b) => order[a.type] - order[b.type]);

          return (
            <button
              key={idx}
              type="button"
              onClick={() => onSelectDay(isSelected ? null : date)}
              className={cn(
                // flex+items-stretch keeps the day number pinned to the
                // top edge — without it, native <button> centers its
                // content vertically and empty days drift to the middle.
                "bg-background min-h-[120px] p-2 relative overflow-hidden transition-colors duration-150 border-border text-left flex flex-col items-stretch justify-start gap-1.5",
                !isLastCol && "border-r",
                !isLastRow && "border-b",
                isWeekend && "bg-blue-50/40 dark:bg-blue-950/20",
                !isToday && !isSelected && "hover:bg-accent/40",
                isToday && "ring-2 ring-primary ring-inset",
                isSelected && !isToday && "ring-2 ring-primary/60 ring-inset bg-primary/5",
                "focus:outline-none focus:bg-accent/40",
              )}
              aria-pressed={isSelected}
            >
              <div className="flex items-start justify-between flex-shrink-0">
                <span
                  className={cn(
                    "text-sm tabular-nums leading-none",
                    !isToday && "font-semibold text-foreground",
                    isToday && "font-bold text-primary",
                  )}
                >
                  {format(date, "d")}
                </span>
                {events.length > 0 && (
                  <span className="text-[10px] font-bold tabular-nums text-muted-foreground leading-none">
                    {events.length}
                  </span>
                )}
              </div>

              <DayEventList events={sortedEvents} date={date} today={today} />
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ============================================================
// Side panel — events for the selected day (only place that navigates)
// ============================================================

function SidePanel({
  selectedDay,
  events,
  today,
  onOpenTask,
  onClose,
}: {
  selectedDay: Date | null;
  events: DayEvent[];
  today: Date;
  onOpenTask: (task: Task) => void;
  onClose: () => void;
}) {
  return (
    <aside className="hidden lg:flex w-[340px] shrink-0 flex-col rounded-lg border border-border bg-card overflow-hidden">
      <div className="px-3 py-2.5 border-b border-border flex items-center justify-between gap-2">
        <div className="min-w-0">
          <div className="text-[10px] uppercase tracking-wide text-muted-foreground font-semibold">
            Detalhe do dia
          </div>
          <div className="text-sm font-bold capitalize truncate">
            {selectedDay
              ? format(selectedDay, "EEEE, dd 'de' MMMM", { locale: ptBR })
              : "Selecione um dia"}
          </div>
        </div>
        {selectedDay && (
          <Button variant="ghost" size="sm" onClick={onClose} className="h-7 px-2 text-xs">
            Limpar
          </Button>
        )}
      </div>
      <div className="flex-1 overflow-y-auto p-2">
        {!selectedDay && (
          <div className="h-full flex flex-col items-center justify-center text-center text-xs text-muted-foreground p-6 gap-2">
            <IconCalendarStats className="h-8 w-8 opacity-50" />
            Clique em qualquer dia da grade para ver os eventos deste dia.
          </div>
        )}
        {selectedDay && events.length === 0 && (
          <div className="h-full flex flex-col items-center justify-center text-center text-xs text-muted-foreground p-6 gap-2">
            <IconCalendarStats className="h-8 w-8 opacity-50" />
            Nenhum evento neste dia.
          </div>
        )}
        {selectedDay && events.length > 0 && (
          <ul className="space-y-1.5">
            {events.map((ev, i) => {
              const isOverdueTerm =
                ev.type === "term" &&
                selectedDay < today &&
                ev.task.status !== TASK_STATUS.COMPLETED;
              const customer = (ev.task as any).customer?.fantasyName as string | undefined;
              const sector = (ev.task as any).sector?.name as string | undefined;
              const Icon = EVENT_ICONS[ev.type];
              return (
                <li key={`${ev.type}-${ev.task.id}-${i}`}>
                  <button
                    type="button"
                    onClick={() => onOpenTask(ev.task)}
                    className="w-full text-left rounded-md border border-border bg-background hover:border-primary/50 hover:bg-accent/40 focus:outline-none focus:ring-2 focus:ring-primary/40 px-2.5 py-2 transition-colors"
                  >
                    <div className="flex items-center gap-2">
                      <span
                        className={cn(
                          "inline-flex items-center justify-center h-5 w-5 rounded-md shrink-0",
                          EVENT_BAR_CLASSES[ev.type],
                        )}
                      >
                        <Icon className="h-3 w-3" />
                      </span>
                      <span className="text-[10px] uppercase tracking-wide font-semibold text-muted-foreground">
                        {EVENT_LABELS[ev.type]}
                      </span>
                      {isOverdueTerm && (
                        <Badge variant="destructive" className="h-4 px-1 text-[9px]">
                          vencido
                        </Badge>
                      )}
                      <IconExternalLink className="h-3 w-3 ml-auto text-muted-foreground" />
                    </div>
                    <div className="mt-1 text-sm font-semibold truncate">
                      {customer ?? ev.task.name ?? "—"}
                    </div>
                    {customer && ev.task.name && (
                      <div className="text-xs text-muted-foreground truncate">
                        {ev.task.name}
                      </div>
                    )}
                    <div className="mt-1 flex items-center gap-2 text-[11px] text-muted-foreground">
                      <span>
                        {TASK_STATUS_LABELS[ev.task.status as TASK_STATUS] ?? ev.task.status}
                      </span>
                      {sector && (
                        <>
                          <span>·</span>
                          <span className="truncate">{sector}</span>
                        </>
                      )}
                    </div>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </aside>
  );
}

// ============================================================
// Year view — 3-col grid of mini-month cards (HR-style polish:
// large cards, header summary, aspect-square cells, icon
// indicators in the corner — no hover popover).
// ============================================================

function YearView({
  year,
  today,
  dayEvents,
  onMonthClick,
}: {
  year: number;
  today: Date;
  dayEvents: Map<string, DayEvent[]>;
  onMonthClick: (monthIdx: number) => void;
}) {
  const months = useMemo(
    () => Array.from({ length: 12 }, (_, i) => new Date(year, i, 1)),
    [year],
  );
  return (
    <div className="h-full overflow-y-auto pr-1">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {months.map((m, idx) => (
          <MiniMonth
            key={idx}
            monthDate={m}
            today={today}
            dayEvents={dayEvents}
            onClick={() => onMonthClick(idx)}
          />
        ))}
      </div>
    </div>
  );
}

function MiniMonth({
  monthDate,
  today,
  dayEvents,
  onClick,
}: {
  monthDate: Date;
  today: Date;
  dayEvents: Map<string, DayEvent[]>;
  onClick: () => void;
}) {
  const { start: periodStart, end: periodEnd } = getPayrollPeriod(monthDate);
  const gridStart = startOfWeekSunday(periodStart);
  const gridEnd = endOfWeekSaturday(periodEnd);
  // Pad to 42 cells (6 weeks × 7) so every mini-month has identical height
  // and the cards top-align in their row.
  const naturalDays = eachDayOfInterval({ start: gridStart, end: gridEnd });
  const allDays = [...naturalDays];
  while (allDays.length < 42) {
    const last = allDays[allDays.length - 1];
    allDays.push(new Date(last.getFullYear(), last.getMonth(), last.getDate() + 1));
  }

  // Header summary — counts for the visible period only.
  let summaryTerm = 0;
  let summaryForecast = 0;
  let summaryStarted = 0;
  let summaryFinished = 0;
  for (const d of naturalDays) {
    if (d < periodStart || d > periodEnd) continue;
    const evs = dayEvents.get(toIsoDay(d)) ?? [];
    for (const ev of evs) {
      if (ev.type === "term") summaryTerm++;
      else if (ev.type === "forecastDate") summaryForecast++;
      else if (ev.type === "startedAt") summaryStarted++;
      else if (ev.type === "finishedAt") summaryFinished++;
    }
  }
  const totalEvents = summaryTerm + summaryForecast + summaryStarted + summaryFinished;

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "group text-left rounded-xl border border-border bg-card overflow-hidden transition-colors hover:border-primary/50 focus:outline-none focus:ring-2 focus:ring-primary/50 focus:ring-offset-2 focus:ring-offset-background",
      )}
    >
      {/* Header band */}
      <div className="px-4 py-2.5 border-b border-border bg-card flex items-center justify-between gap-2">
        <h3 className="text-base font-bold capitalize text-foreground group-hover:text-primary transition-colors truncate">
          {format(monthDate, "MMMM", { locale: ptBR })}
        </h3>
        <div className="flex items-center gap-2 text-xs font-semibold tabular-nums">
          {totalEvents === 0 ? (
            <span className="text-muted-foreground/60 text-[11px]">sem registros</span>
          ) : (
            <>
              {summaryTerm > 0 && (
                <span className="inline-flex items-center gap-1 text-red-600 dark:text-red-300">
                  <IconFlag className="h-3.5 w-3.5" strokeWidth={2.5} />
                  {summaryTerm}
                </span>
              )}
              {summaryForecast > 0 && (
                <span className="inline-flex items-center gap-1 text-orange-600 dark:text-orange-300">
                  <IconCalendarDue className="h-3.5 w-3.5" strokeWidth={2.5} />
                  {summaryForecast}
                </span>
              )}
              {summaryStarted > 0 && (
                <span className="inline-flex items-center gap-1 text-blue-600 dark:text-blue-300">
                  <IconBolt className="h-3.5 w-3.5" strokeWidth={2.5} />
                  {summaryStarted}
                </span>
              )}
              {summaryFinished > 0 && (
                <span className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-300">
                  <IconCircleCheck className="h-3.5 w-3.5" strokeWidth={2.5} />
                  {summaryFinished}
                </span>
              )}
            </>
          )}
        </div>
      </div>

      {/* Mini-day grid */}
      <div className="p-3">
        <div className="rounded-md border border-border bg-background overflow-hidden">
          <div className="grid grid-cols-7 bg-card border-b border-border">
            {MINI_WEEK_DAYS.map((d, i) => (
              <div
                key={`h${i}`}
                className={cn(
                  "px-1 py-1.5 text-center text-[11px] font-bold uppercase tracking-wide text-foreground/70 border-r last:border-r-0 border-border",
                  (i === 0 || i === 6) && "bg-muted/40",
                )}
              >
                {d}
              </div>
            ))}
          </div>
          <div className="grid grid-cols-7">
            {allDays.map((date, idx) => {
              const isInPeriod = date >= periodStart && date <= periodEnd;
              const isToday = isSameDay(date, today);
              const isLastCol = (idx + 1) % 7 === 0;
              const isLastRow = idx >= allDays.length - 7;
              const dow = date.getDay();
              const isWeekend = dow === 0 || dow === 6;

              if (!isInPeriod) {
                return (
                  <div
                    key={idx}
                    aria-hidden
                    className={cn(
                      "aspect-square bg-muted/30 border-border",
                      !isLastCol && "border-r",
                      !isLastRow && "border-b",
                    )}
                  />
                );
              }

              const evs = dayEvents.get(toIsoDay(date)) ?? [];
              const presentTypes = new Set<EventType>();
              for (const e of evs) presentTypes.add(e.type);
              const hasOverdueTerm = evs.some(
                (e) =>
                  e.type === "term" &&
                  date < today &&
                  e.task.status !== TASK_STATUS.COMPLETED,
              );

              return (
                <div
                  key={idx}
                  className={cn(
                    "relative aspect-square flex items-center justify-center text-[13px] font-medium tabular-nums transition-colors border-border",
                    !isLastCol && "border-r",
                    !isLastRow && "border-b",
                    isWeekend && !isToday && "bg-blue-50/40 dark:bg-blue-950/20 text-blue-600/80 dark:text-blue-400/80",
                    !isWeekend && !isToday && "text-foreground",
                    isToday && "ring-2 ring-primary ring-inset font-bold text-primary",
                  )}
                >
                  <span>{format(date, "d")}</span>
                  {!isToday && presentTypes.size > 0 && (
                    <div className="absolute top-0.5 right-0.5 flex items-center gap-0.5">
                      {hasOverdueTerm ? (
                        <IconFlag className="h-3.5 w-3.5 text-red-700 dark:text-red-300" strokeWidth={2.5} />
                      ) : (
                        presentTypes.has("term") && (
                          <IconFlag className="h-3.5 w-3.5 text-red-600 dark:text-red-400" strokeWidth={2.5} />
                        )
                      )}
                      {presentTypes.has("forecastDate") && (
                        <IconCalendarDue className="h-3.5 w-3.5 text-orange-600 dark:text-orange-400" strokeWidth={2.5} />
                      )}
                      {presentTypes.has("startedAt") && (
                        <IconBolt className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" strokeWidth={2.5} />
                      )}
                      {presentTypes.has("finishedAt") && (
                        <IconCircleCheck className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" strokeWidth={2.5} />
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </button>
  );
}

export default TaskScheduleCalendar;
