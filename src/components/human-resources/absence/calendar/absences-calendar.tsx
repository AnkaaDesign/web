import { useEffect, useMemo, useState } from "react";
import {
  format,
  eachDayOfInterval,
  isSameDay,
  addMonths,
  subMonths,
  addYears,
  subYears,
} from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  IconCalendar,
  IconChevronLeft,
  IconChevronRight,
  IconBriefcase,
  IconBeach,
  IconUserOff,
  IconUserExclamation,
  IconConfetti,
  IconUsersGroup,
} from "@tabler/icons-react";

import {
  USER_STATUS,
  getJustificativaCategory,
  getJustificativaMeta,
} from "../../../../constants";

// Category-level color tokens. The cell bars and the summary stat tiles share
// these so the visual story is consistent. Hues are spaced around the wheel
// so the four categories never bleed together visually:
//   purple = ausência (planejada)
//   amber  = falta justificada (atestado, esquecimento, óbito, etc.) — warning
//   red    = falta não justificada (Cálculos de Ponto, Id < 0) — escalated, alarming
//   cyan   = feriado (cool, off the warm spectrum entirely)
// Bars use solid backgrounds + white text so they read as proper status badges
// (matching the centralized BADGE_COLORS workflow), not faded pastel chips.
const CATEGORY_BAR_CLASSES = {
  AUSENCIA: "bg-purple-600 text-white border border-purple-700",
  FALTA_JUSTIFIED: "bg-amber-600 text-white border border-amber-700",
  FALTA_UNJUSTIFIED:
    "bg-red-700 text-white border border-red-800 font-semibold",
} as const;
type BarCategory = keyof typeof CATEGORY_BAR_CLASSES;
const HOLIDAY_BAR_CLASS = "bg-cyan-600 text-white border border-cyan-700";
import type { SecullumAggregatedAbsence } from "../../../../types";
import {
  useSecullumAggregatedAbsences,
  useSecullumHolidays,
  useSecullumUnjustifiedAbsences,
  useSectors,
  useUsers,
} from "../../../../hooks";

import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { LoadingSpinner } from "@/components/ui/loading";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Combobox } from "@/components/ui/combobox";
import type { ComboboxOption } from "@/components/ui/combobox";
import { cn } from "@/lib/utils";

const ALL_USERS = "__ALL__";
// Full pt-BR weekday names for the month view header.
const weekDaysFull = [
  "Domingo",
  "Segunda-feira",
  "Terça-feira",
  "Quarta-feira",
  "Quinta-feira",
  "Sexta-feira",
  "Sábado",
];
// 3-letter abbreviations for the year-view mini-month headers.
const miniWeekDays = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

type ViewMode = "month" | "year";

// Brazilian payroll period: day 26 of previous month → day 25 of selected month.
function getPayrollPeriod(refMonth: Date) {
  const start = new Date(refMonth.getFullYear(), refMonth.getMonth() - 1, 26);
  const end = new Date(refMonth.getFullYear(), refMonth.getMonth(), 25);
  return { start, end };
}

// Default to the payroll period that contains today.
function defaultRefMonth(): Date {
  const today = new Date();
  return today.getDate() >= 26
    ? new Date(today.getFullYear(), today.getMonth() + 1, 1)
    : new Date(today.getFullYear(), today.getMonth(), 1);
}

function startOfWeekSunday(d: Date): Date {
  const day = d.getDay();
  const result = new Date(d.getFullYear(), d.getMonth(), d.getDate() - day);
  return result;
}
function endOfWeekSaturday(d: Date): Date {
  const day = d.getDay();
  const result = new Date(d.getFullYear(), d.getMonth(), d.getDate() + (6 - day));
  return result;
}

export function AbsencesCalendar() {
  const [refMonth, setRefMonth] = useState<Date>(() => defaultRefMonth());
  const [viewMode, setViewMode] = useState<ViewMode>("month");
  const [sectorId, setSectorId] = useState<string | undefined>(undefined);
  const [selectedUserId, setSelectedUserId] = useState<string>(ALL_USERS);
  // Visibility toggles per category — user can hide férias / justificadas /
  // não justificadas / feriados independently. StatsRow tiles act as on/off
  // switches.
  const [showVacation, setShowVacation] = useState(true);
  const [showJustifiedFalta, setShowJustifiedFalta] = useState(true);
  const [showUnjustifiedFalta, setShowUnjustifiedFalta] = useState(true);
  const [showHoliday, setShowHoliday] = useState(true);
  // Selected day powers the right-side "Detalhe do dia" panel. Clicking a
  // cell selects it; clicking the same cell again or pressing "Limpar"
  // clears it. Persists only while the day stays inside the visible period.
  const [selectedDay, setSelectedDay] = useState<Date | null>(null);

  // Fetch + render range — driven by payroll period (26→25).
  const range = useMemo(() => {
    if (viewMode === "year") {
      // Year view = the 12 payroll periods anchored in this year. Each runs
      // day 26 of the previous month → day 25 of the anchor month, so the
      // year as a whole spans Dec 26 of prev year → Dec 25 of this year.
      const start = new Date(refMonth.getFullYear() - 1, 11, 26);
      const end = new Date(refMonth.getFullYear(), 11, 25);
      return { periodStart: start, periodEnd: end, gridStart: start, gridEnd: end };
    }
    const { start, end } = getPayrollPeriod(refMonth);
    const gridStart = startOfWeekSunday(start);
    const gridEnd = endOfWeekSaturday(end);
    return { periodStart: start, periodEnd: end, gridStart, gridEnd };
  }, [refMonth, viewMode]);

  const startStr = format(range.periodStart, "yyyy-MM-dd");
  const endStr = format(range.periodEnd, "yyyy-MM-dd");

  const {
    data: absencesData,
    isLoading: absencesLoading,
  } = useSecullumAggregatedAbsences({ startDate: startStr, endDate: endStr, sectorId });
  const { data: unjustifiedData, isLoading: unjustifiedLoading } = useSecullumUnjustifiedAbsences({
    startDate: startStr,
    endDate: endStr,
    sectorId,
  });
  const { data: holidaysData, isLoading: holidaysLoading } = useSecullumHolidays(
    viewMode === "year"
      ? { year: refMonth.getFullYear() }
      : { year: refMonth.getFullYear(), month: refMonth.getMonth() + 1 },
  );
  const { data: sectorsData } = useSectors({ orderBy: { name: "asc" }, take: 100 } as any);
  const { data: usersData, isLoading: usersLoading } = useUsers({
    statuses: [
      USER_STATUS.EXPERIENCE_PERIOD_1,
      USER_STATUS.EXPERIENCE_PERIOD_2,
      USER_STATUS.EFFECTED,
    ],
    where: { secullumEmployeeId: { not: null } },
    orderBy: { name: "asc" },
    take: 100,
  } as any);

  // Resolve the selected Ankaa user's Secullum funcionarioId so we can match
  // records that came back tagged with the "secullum:<id>" sentinel (i.e.
  // the user has no Ankaa→Secullum link yet so userId fell back to the
  // sentinel form). This way picking a specific colaborador in the combobox
  // surfaces their data whether or not the sync has been run.
  const selectedUserSecullumId = useMemo<number | null>(() => {
    if (selectedUserId === ALL_USERS) return null;
    const u: any = (usersData?.data ?? []).find((x: any) => x.id === selectedUserId);
    return u?.secullumEmployeeId ?? null;
  }, [usersData, selectedUserId]);

  const absences: SecullumAggregatedAbsence[] = useMemo(() => {
    const unwrap = (d: any): SecullumAggregatedAbsence[] => {
      const root: any = d?.data;
      if (Array.isArray(root)) return root;
      if (root && Array.isArray(root.data)) return root.data;
      return [];
    };
    let all = [...unwrap(absencesData), ...unwrap(unjustifiedData)];
    if (selectedUserId !== ALL_USERS) {
      all = all.filter(
        (a) =>
          a.userId === selectedUserId ||
          (selectedUserSecullumId != null && a.FuncionarioId === selectedUserSecullumId),
      );
    }
    // Apply per-category visibility toggles.
    all = all.filter((a) => {
      const cat = getJustificativaCategory(a.JustificativaId);
      if (cat === "AUSENCIA") return showVacation;
      if (cat === "FALTA") {
        return isUnjustifiedFalta(a) ? showUnjustifiedFalta : showJustifiedFalta;
      }
      return true;
    });
    return all;
  }, [
    absencesData,
    unjustifiedData,
    selectedUserId,
    selectedUserSecullumId,
    showVacation,
    showJustifiedFalta,
    showUnjustifiedFalta,
  ]);

  const holidays: any[] = useMemo(() => {
    if (!showHoliday) return [];
    const root: any = holidaysData?.data;
    if (Array.isArray(root)) return root;
    if (root && Array.isArray(root.data)) return root.data;
    return [];
  }, [holidaysData, showHoliday]);

  const sectorOptions = useMemo<ComboboxOption[]>(() => {
    const arr = sectorsData?.data ?? [];
    return arr.map((s: any) => ({ value: s.id, label: s.name }));
  }, [sectorsData]);

  const userOptions = useMemo<ComboboxOption[]>(() => {
    const arr = usersData?.data ?? [];
    return [
      { value: ALL_USERS, label: "Todos os colaboradores" },
      ...arr.map((u: any) => ({ value: u.id, label: u.name })),
    ];
  }, [usersData]);

  // Period statistics (only meaningful in month view).
  // Counts only users whose absence overlaps a WORK DAY in the period — this
  // keeps the stat tiles in sync with the cell bars (we hide bars on weekends,
  // so an absence that only touches weekend days produces no visible bar and
  // therefore must not inflate the count).
  const stats = useMemo(() => {
    const days = eachDayOfInterval({ start: range.periodStart, end: range.periodEnd });
    const holidayDateSet = new Set(
      holidays
        .map((h: any) => {
          const raw = h.Data || h.data || h.date;
          if (!raw) return null;
          return String(raw).substring(0, 10);
        })
        .filter(Boolean) as string[],
    );
    const workDaysInPeriod: Date[] = [];
    let workingDays = 0;
    let holidayDaysInPeriod = 0;
    for (const d of days) {
      const dow = d.getDay();
      if (dow === 0 || dow === 6) continue;
      const key = format(d, "yyyy-MM-dd");
      if (holidayDateSet.has(key)) {
        holidayDaysInPeriod++;
        continue;
      }
      workingDays++;
      workDaysInPeriod.push(d);
    }
    // Person-day counters: for every absence record, count how many work days
    // it overlaps in the period and add them to the running total. Faltas are
    // split into "justificadas" (amber — atestado, esquecimento, etc.) and
    // "não justificadas" (red — synthetic from Cálculos de Ponto with Id < 0)
    // so each summary tile reflects only its own subset.
    const usersOnVacation = new Set<string>();
    const usersOnJustifiedFalta = new Set<string>();
    const usersOnUnjustifiedFalta = new Set<string>();
    let vacationDays = 0;
    let justifiedFaltaDays = 0;
    let unjustifiedFaltaDays = 0;
    for (const a of absences) {
      const cat = getJustificativaCategory(a.JustificativaId);
      if (cat !== "AUSENCIA" && cat !== "FALTA") continue;
      const start = new Date(a.Inicio);
      const end = new Date(a.Fim);
      const startD = new Date(start.getFullYear(), start.getMonth(), start.getDate());
      const endD = new Date(end.getFullYear(), end.getMonth(), end.getDate());
      const overlap = workDaysInPeriod.filter((d) => d >= startD && d <= endD).length;
      if (overlap === 0) continue;
      if (cat === "AUSENCIA") {
        vacationDays += overlap;
        usersOnVacation.add(a.userId);
      } else if (isUnjustifiedFalta(a)) {
        unjustifiedFaltaDays += overlap;
        usersOnUnjustifiedFalta.add(a.userId);
      } else {
        justifiedFaltaDays += overlap;
        usersOnJustifiedFalta.add(a.userId);
      }
    }
    return {
      workingDays,
      vacationDays,
      justifiedFaltaDays,
      unjustifiedFaltaDays,
      usersOnVacation: usersOnVacation.size,
      usersOnJustifiedFalta: usersOnJustifiedFalta.size,
      usersOnUnjustifiedFalta: usersOnUnjustifiedFalta.size,
      holidayDays: holidayDaysInPeriod,
    };
  }, [range.periodStart, range.periodEnd, absences, holidays]);

  const isLoading = absencesLoading || holidaysLoading || unjustifiedLoading;

  const goPrev = () =>
    setRefMonth(viewMode === "year" ? subYears(refMonth, 1) : subMonths(refMonth, 1));
  const goNext = () =>
    setRefMonth(viewMode === "year" ? addYears(refMonth, 1) : addMonths(refMonth, 1));

  // Drop the selected day whenever the visible period no longer contains
  // it (period change, year-view toggle, etc.) so the side panel never
  // points at a date that's not on screen.
  useEffect(() => {
    if (!selectedDay) return;
    if (selectedDay < range.periodStart || selectedDay > range.periodEnd) {
      setSelectedDay(null);
    }
  }, [selectedDay, range.periodStart, range.periodEnd]);

  // Keyboard navigation: ←/→ moves to the previous/next period (month in
  // month view, year in year view). Suppressed while typing in inputs or
  // while a combobox/dialog/listbox has focus, so the shortcuts don't fight
  // with form widgets.
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
        setRefMonth((prev) => (viewMode === "year" ? subYears(prev, 1) : subMonths(prev, 1)));
      } else {
        setRefMonth((prev) => (viewMode === "year" ? addYears(prev, 1) : addMonths(prev, 1)));
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [viewMode]);

  return (
    <Card className="h-full flex flex-col shadow-sm border border-border">
      <CardContent className="flex-1 flex flex-col p-4 space-y-4 overflow-hidden">
        {/* Filter bar — single row */}
        <div className="flex items-stretch gap-2 flex-shrink-0">
          <div className="flex-1 min-w-0">
            <Combobox
              options={userOptions}
              value={selectedUserId}
              onValueChange={(v) => setSelectedUserId((Array.isArray(v) ? v[0] : v) || ALL_USERS)}
              placeholder={usersLoading ? "Carregando..." : "Selecione um colaborador"}
              emptyText="Nenhum colaborador"
              searchable
              disabled={usersLoading}
              className="w-full"
            />
          </div>
          <div className="flex-1 min-w-0">
            <Combobox
              options={sectorOptions}
              value={sectorId ?? ""}
              onValueChange={(v) => setSectorId((Array.isArray(v) ? v[0] : v) || undefined)}
              placeholder="Todos os setores"
              emptyText="Nenhum setor"
              clearable
              searchable
              className="w-full"
            />
          </div>

          <div className="flex items-center gap-1 rounded-md border border-border p-0.5 bg-background flex-shrink-0">
            <Button
              type="button"
              size="sm"
              variant={viewMode === "month" ? "default" : "ghost"}
              onClick={() => setViewMode("month")}
              className="h-9 px-3"
            >
              Mês
            </Button>
            <Button
              type="button"
              size="sm"
              variant={viewMode === "year" ? "default" : "ghost"}
              onClick={() => setViewMode("year")}
              className="h-9 px-3"
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
            <div className="flex flex-col items-center px-3 min-w-[200px]">
              <div className="flex items-center gap-1.5 text-sm font-semibold">
                <IconCalendar className="h-4 w-4" />
                <span className="capitalize">
                  {viewMode === "year"
                    ? format(refMonth, "yyyy")
                    : format(refMonth, "MMMM yyyy", { locale: ptBR })}
                </span>
              </div>
              {viewMode === "month" && (
                <div className="text-xs text-muted-foreground tabular-nums">
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
          </div>
        </div>

        {/* Stats row — also acts as visibility toggles for each category.
            Click a tile to hide that category from the calendar; click again
            to bring it back. Dias úteis is informational only (not toggleable). */}
        <StatsRow
          stats={stats}
          showVacation={showVacation}
          showJustifiedFalta={showJustifiedFalta}
          showUnjustifiedFalta={showUnjustifiedFalta}
          showHoliday={showHoliday}
          onToggleVacation={() => setShowVacation((v) => !v)}
          onToggleJustifiedFalta={() => setShowJustifiedFalta((v) => !v)}
          onToggleUnjustifiedFalta={() => setShowUnjustifiedFalta((v) => !v)}
          onToggleHoliday={() => setShowHoliday((v) => !v)}
        />


        {isLoading ? (
          <div className="flex-1 flex items-center justify-center">
            <LoadingSpinner size="lg" />
          </div>
        ) : viewMode === "month" ? (
          <div className="flex-1 min-h-0 flex gap-4 overflow-hidden">
            <div className="flex-1 min-w-0 overflow-hidden flex">
              <MonthView
                gridStart={range.gridStart}
                gridEnd={range.gridEnd}
                periodStart={range.periodStart}
                periodEnd={range.periodEnd}
                absences={absences}
                holidays={holidays}
                selectedDay={selectedDay}
                onSelectDay={setSelectedDay}
              />
            </div>
            <DayDetailPanel
              selectedDay={selectedDay}
              absences={absences}
              holidays={holidays}
              onClose={() => setSelectedDay(null)}
            />
          </div>
        ) : (
          <YearView
            year={refMonth.getFullYear()}
            absences={absences}
            holidays={holidays}
            onMonthClick={(monthIdx) => {
              // Year months 0..11; map to payroll-period anchor refMonth.
              setRefMonth(new Date(refMonth.getFullYear(), monthIdx, 1));
              setViewMode("month");
            }}
          />
        )}
      </CardContent>
    </Card>
  );
}

// ===== STATS ROW ======================================================
function StatsRow({
  stats,
  showVacation,
  showJustifiedFalta,
  showUnjustifiedFalta,
  showHoliday,
  onToggleVacation,
  onToggleJustifiedFalta,
  onToggleUnjustifiedFalta,
  onToggleHoliday,
}: {
  stats: {
    workingDays: number;
    vacationDays: number;
    justifiedFaltaDays: number;
    unjustifiedFaltaDays: number;
    usersOnVacation: number;
    usersOnJustifiedFalta: number;
    usersOnUnjustifiedFalta: number;
    holidayDays: number;
  };
  showVacation: boolean;
  showJustifiedFalta: boolean;
  showUnjustifiedFalta: boolean;
  showHoliday: boolean;
  onToggleVacation: () => void;
  onToggleJustifiedFalta: () => void;
  onToggleUnjustifiedFalta: () => void;
  onToggleHoliday: () => void;
}) {
  const colabSuffix = (n: number) => `${n} ${n === 1 ? "colab." : "colabs."}`;
  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3 flex-shrink-0">
      <StatTile
        icon={IconBriefcase}
        label="Dias úteis"
        value={stats.workingDays}
        suffix={stats.workingDays === 1 ? "dia" : "dias"}
        tone="emerald"
      />
      <StatTile
        icon={IconBeach}
        label="Ausências"
        value={stats.vacationDays}
        suffix={`dias · ${colabSuffix(stats.usersOnVacation)}`}
        tone="purple"
        active={showVacation}
        onClick={onToggleVacation}
      />
      <StatTile
        icon={IconUserOff}
        label="Justificadas"
        value={stats.justifiedFaltaDays}
        suffix={`dias · ${colabSuffix(stats.usersOnJustifiedFalta)}`}
        tone="amber"
        active={showJustifiedFalta}
        onClick={onToggleJustifiedFalta}
      />
      <StatTile
        icon={IconUserExclamation}
        label="Não Justificadas"
        value={stats.unjustifiedFaltaDays}
        suffix={`dias · ${colabSuffix(stats.usersOnUnjustifiedFalta)}`}
        tone="red"
        active={showUnjustifiedFalta}
        onClick={onToggleUnjustifiedFalta}
      />
      <StatTile
        icon={IconConfetti}
        label="Feriados úteis"
        value={stats.holidayDays}
        suffix={stats.holidayDays === 1 ? "dia" : "dias"}
        tone="cyan"
        active={showHoliday}
        onClick={onToggleHoliday}
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
  tone: "emerald" | "purple" | "red" | "amber" | "cyan";
  active?: boolean;
  onClick?: () => void;
}) {
  // Tile hue mirrors the bar palette so the legend reads as the same story:
  //   purple = ausência, amber = falta justificada, red = falta n.j., cyan = feriado.
  // Tiles use a soft tint (vs the bars' solid bg) so the dashboard's stat
  // header doesn't compete visually with the calendar grid below it.
  const toneClasses: Record<typeof tone, string> = {
    emerald: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 ring-emerald-500/20",
    purple: "bg-purple-500/10 text-purple-600 dark:text-purple-400 ring-purple-500/20",
    amber: "bg-amber-500/10 text-amber-600 dark:text-amber-400 ring-amber-500/20",
    red: "bg-red-500/15 text-red-700 dark:text-red-300 ring-red-500/40",
    cyan: "bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 ring-cyan-500/20",
  };
  const isToggleable = typeof onClick === "function";
  // When the tile is toggleable and inactive, mute it heavily so the user
  // sees at a glance that this category is hidden from the calendar.
  const inactiveClasses = isToggleable && active === false
    ? "opacity-40 grayscale"
    : "";
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
        isToggleable && "hover:border-primary/40 cursor-pointer focus:outline-none focus:ring-2 focus:ring-primary/40",
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
          {suffix && <span className="text-xs font-normal text-muted-foreground ml-1.5">{suffix}</span>}
        </div>
      </div>
    </Wrapper>
  );
}

// ===== MONTH VIEW =====================================================
function MonthView({
  gridStart,
  gridEnd,
  periodStart,
  periodEnd,
  absences,
  holidays,
  selectedDay,
  onSelectDay,
}: {
  gridStart: Date;
  gridEnd: Date;
  periodStart: Date;
  periodEnd: Date;
  absences: SecullumAggregatedAbsence[];
  holidays: any[];
  selectedDay: Date | null;
  onSelectDay: (d: Date | null) => void;
}) {
  const allDays = eachDayOfInterval({ start: gridStart, end: gridEnd });
  // Lock all rows to the same fraction of available height. `auto-rows-fr`
  // sets `1fr` only as a minimum, so a cell whose min-content exceeds that
  // share will stretch its whole row. `repeat(N, minmax(0, 1fr))` is a hard
  // cap — content overflow stays inside the cell where it can scroll.
  const numRows = Math.max(1, Math.ceil(allDays.length / 7));

  return (
    <div className="flex-1 flex flex-col rounded-lg border border-border bg-background shadow-sm overflow-hidden">
      <div className="grid grid-cols-7 bg-background border-b-2 border-border">
        {weekDaysFull.map((d) => (
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

          // Out-of-period slots are rendered as blank spacers so the calendar
          // visually starts at periodStart (day 26) and ends at periodEnd
          // (day 25), without the dimmed prev/next-month dates that read as
          // "disabled". The grid alignment is preserved by keeping the cell.
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

          const dayAbsences = getAbsencesForDay(absences, date);
          const dayHolidays = getHolidaysForDay(holidays, date);
          const isToday = isSameDay(date, new Date());
          const isSelected = selectedDay ? isSameDay(date, selectedDay) : false;
          const dow = date.getDay();
          const isWeekend = dow === 0 || dow === 6;

          return (
                <button
                  key={idx}
                  type="button"
                  onClick={() => onSelectDay(isSelected ? null : date)}
                  aria-pressed={isSelected}
                  className={cn(
                    "bg-background min-h-[120px] p-2 relative overflow-hidden transition-colors duration-150 border-border text-left flex flex-col items-stretch justify-start gap-1.5",
                    !isLastCol && "border-r",
                    !isLastRow && "border-b",
                    isWeekend && "bg-blue-50/40 dark:bg-blue-950/20",
                    !isToday && !isSelected && "hover:bg-accent/40",
                    isToday && "ring-2 ring-primary ring-inset",
                    isSelected && !isToday && "ring-2 ring-primary/60 ring-inset bg-primary/5",
                    "focus:outline-none focus:bg-accent/40",
                  )}
                >
                  <div className="flex items-start justify-between">
                    <span
                      className={cn(
                        "text-sm tabular-nums",
                        !isToday && "font-semibold text-foreground",
                        isToday && "font-bold text-primary",
                      )}
                    >
                      {format(date, "d")}
                    </span>
                  </div>

                  <div className="mt-1.5 space-y-1">
                    {/* Holidays — amber. Matches "Feriados úteis" tile. */}
                    {dayHolidays.slice(0, 1).map((h, i) => (
                      <div
                        key={`h${i}`}
                        className={cn(
                          "text-[10px] px-1.5 py-0.5 rounded-sm truncate font-medium",
                          HOLIDAY_BAR_CLASS,
                        )}
                      >
                        {h.Descricao || h.descricao || "Feriado"}
                      </div>
                    ))}
                    {/* Absence bars use category-level color so they line up
                        with the summary stat tiles (violet=férias, red=falta).
                        Hidden on weekends and holidays — neither are work days,
                        so showing the absence on top of the holiday is noise.

                        Same-day records are bucketed into collectives first
                        (≥3 colabs sharing a [GRP:uuid] tag or implicit
                        JustId+period) so a Férias Coletiva renders as ONE
                        violet bar with a count, not 19 stacked names. */}
                    {!isWeekend && dayHolidays.length === 0 && (() => {
                      const { collectives, individuals } = bucketDayAbsences(dayAbsences);
                      const items: Array<
                        | { kind: "collective"; bucket: CollectiveBucket }
                        | { kind: "individual"; absence: SecullumAggregatedAbsence }
                      > = [
                        ...collectives.map((b) => ({ kind: "collective" as const, bucket: b })),
                        ...individuals.map((a) => ({ kind: "individual" as const, absence: a })),
                      ];
                      const visible = items.slice(0, 3);
                      const hidden = items.length - visible.length;
                      return (
                        <>
                          {visible.map((it, i) => {
                            if (it.kind === "collective") {
                              const b = it.bucket;
                              const cls = CATEGORY_BAR_CLASSES[b.category];
                              const label = getCollectiveLabel(b);
                              return (
                                <div
                                  key={`c${i}`}
                                  className={cn(
                                    "text-[10px] px-1.5 py-0.5 rounded-sm truncate font-semibold flex items-center gap-1",
                                    cls,
                                  )}
                                  title={`${label} · ${b.members.length} colaboradores`}
                                >
                                  <IconUsersGroup className="h-3 w-3 flex-shrink-0" strokeWidth={2.5} />
                                  <span className="truncate">
                                    {label} · {b.members.length}
                                  </span>
                                </div>
                              );
                            }
                            const a = it.absence;
                            const barCat = getBarCategory(a);
                            const meta = getJustificativaMeta(a.JustificativaId);
                            const cls = barCat
                              ? CATEGORY_BAR_CLASSES[barCat]
                              : "bg-muted text-muted-foreground border border-border";
                            return (
                              <div
                                key={`a${i}`}
                                className={cn(
                                  "text-[10px] px-1.5 py-0.5 rounded-sm truncate font-medium",
                                  cls,
                                )}
                                title={`${a.userName} · ${meta?.label ?? a.JustificativaDescricao}`}
                              >
                                {shortName(a.userName)} · {meta?.label ?? a.JustificativaDescricao}
                              </div>
                            );
                          })}
                          {hidden > 0 && (
                            <div className="text-[10px] text-muted-foreground font-medium">
                              +{hidden} mais
                            </div>
                          )}
                        </>
                      );
                    })()}
                  </div>
                </button>
          );
        })}
      </div>
    </div>
  );
}

// ===== DAY DETAIL PANEL ===============================================
// Right-side panel that mirrors the production calendar's "Detalhe do dia"
// — each event/absence is its own card with the matching category color,
// icon, collaborator name, justificativa label and sector. Replaces the
// older hover popover, which the user found cramped.
function DayDetailPanel({
  selectedDay,
  absences,
  holidays,
  onClose,
}: {
  selectedDay: Date | null;
  absences: SecullumAggregatedAbsence[];
  holidays: any[];
  onClose: () => void;
}) {
  const dayAbsences = selectedDay ? getAbsencesForDay(absences, selectedDay) : [];
  const dayHolidays = selectedDay ? getHolidaysForDay(holidays, selectedDay) : [];
  const isWeekend =
    !!selectedDay && (selectedDay.getDay() === 0 || selectedDay.getDay() === 6);

  // Bucket absences exactly like the cell bars: ≥3 collaborators sharing a
  // [GRP:uuid] tag (or implicit JustId+period) collapse into a "coletiva"
  // card; everyone else is rendered as an individual card.
  const buckets = selectedDay && !isWeekend && dayHolidays.length === 0
    ? bucketDayAbsences(dayAbsences)
    : { collectives: [], individuals: [] as SecullumAggregatedAbsence[] };

  const totalCards = dayHolidays.length + buckets.collectives.length + buckets.individuals.length;
  const showWeekendNote = !!selectedDay && isWeekend && dayHolidays.length === 0;
  const showWorkdayNote =
    !!selectedDay && !isWeekend && dayHolidays.length === 0 && dayAbsences.length === 0;

  return (
    <aside className="hidden lg:flex w-[360px] shrink-0 flex-col rounded-lg border border-border bg-card overflow-hidden">
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
      <div className="flex-1 overflow-y-auto p-2 space-y-1.5">
        {!selectedDay && (
          <div className="h-full flex flex-col items-center justify-center text-center text-xs text-muted-foreground p-6 gap-2">
            <IconCalendar className="h-8 w-8 opacity-50" />
            Clique em qualquer dia da grade para ver os eventos deste dia.
          </div>
        )}
        {selectedDay && totalCards === 0 && (
          <div className="h-full flex flex-col items-center justify-center text-center text-xs text-muted-foreground p-6 gap-2">
            <IconCalendar className="h-8 w-8 opacity-50" />
            {showWorkdayNote && "Dia útil — sem registros."}
            {showWeekendNote && "Fim de semana."}
            {!showWorkdayNote && !showWeekendNote && "Nenhum evento neste dia."}
          </div>
        )}
        {selectedDay && dayHolidays.map((h: any, i: number) => (
          <HolidayCard key={`h${i}`} holiday={h} />
        ))}
        {selectedDay && buckets.collectives.map((b) => (
          <CollectiveCard key={b.key} bucket={b} />
        ))}
        {selectedDay && buckets.individuals.map((a) => (
          <AbsenceCard key={a.Id} absence={a} />
        ))}
      </div>
    </aside>
  );
}

// --- Card variants ----------------------------------------------------

function CategoryBadge({
  category,
  label,
}: {
  category: BarCategory | "HOLIDAY";
  label: string;
}) {
  const tone = {
    AUSENCIA: "bg-purple-600 text-white",
    FALTA_JUSTIFIED: "bg-amber-600 text-white",
    FALTA_UNJUSTIFIED: "bg-red-700 text-white",
    HOLIDAY: "bg-cyan-600 text-white",
  }[category];
  const Icon =
    category === "AUSENCIA"
      ? IconBeach
      : category === "FALTA_JUSTIFIED"
        ? IconUserOff
        : category === "FALTA_UNJUSTIFIED"
          ? IconUserExclamation
          : IconConfetti;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] uppercase tracking-wide font-semibold",
        tone,
      )}
    >
      <Icon className="h-3 w-3" strokeWidth={2.5} />
      {label}
    </span>
  );
}

function HolidayCard({ holiday }: { holiday: any }) {
  const desc = holiday.Descricao || holiday.descricao || "Feriado";
  return (
    <div className="rounded-md border border-border bg-background px-2.5 py-2">
      <CategoryBadge category="HOLIDAY" label="Feriado" />
      <div className="mt-1 text-sm font-semibold truncate">{desc}</div>
    </div>
  );
}

function AbsenceCard({ absence }: { absence: SecullumAggregatedAbsence }) {
  const cat = getBarCategory(absence);
  const meta = getJustificativaMeta(absence.JustificativaId);
  const catLabel =
    cat === "AUSENCIA"
      ? "Ausência"
      : cat === "FALTA_JUSTIFIED"
        ? "Justificada"
        : cat === "FALTA_UNJUSTIFIED"
          ? "Não Justificada"
          : "Outro";
  const justLabel = meta?.label ?? absence.JustificativaDescricao ?? `#${absence.JustificativaId}`;
  return (
    <div className="rounded-md border border-border bg-background px-2.5 py-2 space-y-1">
      <CategoryBadge category={cat ?? "AUSENCIA"} label={catLabel} />
      <div className="text-sm font-semibold truncate">{absence.userName}</div>
      <div className="text-xs text-muted-foreground truncate">{justLabel}</div>
      {absence.sectorName && (
        <div className="text-[11px] text-muted-foreground/80 truncate">
          {absence.sectorName}
        </div>
      )}
    </div>
  );
}

function CollectiveCard({ bucket }: { bucket: CollectiveBucket }) {
  const catLabel =
    bucket.category === "AUSENCIA"
      ? "Ausência Coletiva"
      : bucket.category === "FALTA_JUSTIFIED"
        ? "Justificada Coletiva"
        : "Não Justificada Coletiva";
  const label = getCollectiveLabel(bucket);
  return (
    <div className="rounded-md border border-border bg-background px-2.5 py-2 space-y-1">
      <CategoryBadge category={bucket.category} label={catLabel} />
      <div className="text-sm font-semibold flex items-center gap-1.5 truncate">
        <IconUsersGroup className="h-4 w-4 shrink-0" strokeWidth={2.5} />
        <span className="truncate">{label}</span>
      </div>
      <div className="text-xs text-muted-foreground">
        {bucket.members.length} colaboradores
      </div>
      <ul className="pt-1 space-y-0.5 max-h-32 overflow-y-auto pr-1">
        {bucket.members.map((m) => (
          <li
            key={m.Id}
            className="text-[11px] text-muted-foreground truncate flex items-center gap-1"
          >
            <span className="inline-block w-1 h-1 rounded-full bg-muted-foreground/60 shrink-0" />
            {m.userName}
          </li>
        ))}
      </ul>
    </div>
  );
}

// ===== YEAR VIEW (3-col mini-month grid) ==============================
function YearView({
  year,
  absences,
  holidays,
  onMonthClick,
}: {
  year: number;
  absences: SecullumAggregatedAbsence[];
  holidays: any[];
  onMonthClick: (monthIdx: number) => void;
}) {
  const months = useMemo(
    () => Array.from({ length: 12 }, (_, i) => new Date(year, i, 1)),
    [year],
  );

  return (
    <div className="flex-1 min-h-0 overflow-auto">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {months.map((monthDate, idx) => (
          <MiniMonth
            key={idx}
            monthDate={monthDate}
            absences={absences}
            holidays={holidays}
            onClick={() => onMonthClick(idx)}
          />
        ))}
      </div>
    </div>
  );
}

function MiniMonth({
  monthDate,
  absences,
  holidays,
  onClick,
}: {
  monthDate: Date;
  absences: SecullumAggregatedAbsence[];
  holidays: any[];
  onClick: () => void;
}) {
  // Each mini-month renders the payroll period anchored at this month
  // (day 26 of previous month → day 25 of this month) so the year overview
  // matches what the user sees when they click in to the month view.
  const { start: periodStart, end: periodEnd } = getPayrollPeriod(monthDate);
  const gridStart = startOfWeekSunday(periodStart);
  const gridEnd = endOfWeekSaturday(periodEnd);
  // Pad to 42 cells (6 weeks × 7 days) so every mini-month has identical
  // height. Without this, periods that fit in fewer weeks render shorter
  // and cards within the same row don't top-align.
  const naturalDays = eachDayOfInterval({ start: gridStart, end: gridEnd });
  const allDays = [...naturalDays];
  while (allDays.length < 42) {
    const last = allDays[allDays.length - 1];
    const next = new Date(last.getFullYear(), last.getMonth(), last.getDate() + 1);
    allDays.push(next);
  }

  // Per-period counters: person-days for absences, holiday-days for holidays.
  // Matches the StatsRow tile math so the year-view glance and the month-view
  // summary line up.
  let vacationDays = 0;
  let justifiedFaltaDays = 0;
  let unjustifiedFaltaDays = 0;
  let holidayDays = 0;
  const holidayKeys = new Set<string>();
  for (const h of holidays) {
    const raw = (h as any).Data || (h as any).data || (h as any).date;
    if (!raw) continue;
    const part = String(raw).substring(0, 10);
    const [yy, mm, dd] = part.split("-").map(Number);
    if (!yy || !mm || !dd) continue;
    const d = new Date(yy, mm - 1, dd);
    if (d < periodStart || d > periodEnd) continue;
    holidayKeys.add(part);
    const dow = d.getDay();
    if (dow !== 0 && dow !== 6) holidayDays++;
  }
  for (const a of absences) {
    const cat = getJustificativaCategory(a.JustificativaId);
    if (cat !== "AUSENCIA" && cat !== "FALTA") continue;
    const start = new Date(a.Inicio);
    const end = new Date(a.Fim);
    const startD = new Date(start.getFullYear(), start.getMonth(), start.getDate());
    const endD = new Date(end.getFullYear(), end.getMonth(), end.getDate());
    for (
      let d = new Date(periodStart);
      d <= periodEnd;
      d = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1)
    ) {
      const dow = d.getDay();
      if (dow === 0 || dow === 6) continue; // skip weekends
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
      if (holidayKeys.has(key)) continue; // skip holidays — not work days
      if (d >= startD && d <= endD) {
        if (cat === "AUSENCIA") vacationDays++;
        else if (isUnjustifiedFalta(a)) unjustifiedFaltaDays++;
        else justifiedFaltaDays++;
      }
    }
  }
  const totalEvents = vacationDays + justifiedFaltaDays + unjustifiedFaltaDays + holidayDays;

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "group text-left rounded-xl border border-border bg-card overflow-hidden transition-colors hover:border-primary/50 focus:outline-none focus:ring-2 focus:ring-primary/50 focus:ring-offset-2 focus:ring-offset-background",
      )}
    >
      {/* Header band — neutral bg, no per-month tint. */}
      <div className="px-4 py-2.5 border-b border-border bg-card flex items-center justify-between gap-2">
        <h3 className="text-base font-bold capitalize text-foreground group-hover:text-primary transition-colors truncate">
          {format(monthDate, "MMMM", { locale: ptBR })}
        </h3>
        <div className="flex items-center gap-2 text-xs font-semibold tabular-nums">
          {totalEvents === 0 ? (
            <span className="text-muted-foreground/60 text-[11px]">sem registros</span>
          ) : (
            <>
              {vacationDays > 0 && (
                <span className="inline-flex items-center gap-1 text-purple-600 dark:text-purple-400">
                  <IconBeach className="h-3.5 w-3.5" strokeWidth={2.5} />
                  {vacationDays}
                </span>
              )}
              {justifiedFaltaDays > 0 && (
                <span className="inline-flex items-center gap-1 text-amber-600 dark:text-amber-400">
                  <IconUserOff className="h-3.5 w-3.5" strokeWidth={2.5} />
                  {justifiedFaltaDays}
                </span>
              )}
              {unjustifiedFaltaDays > 0 && (
                <span className="inline-flex items-center gap-1 text-red-700 dark:text-red-300">
                  <IconUserExclamation className="h-3.5 w-3.5" strokeWidth={2.5} />
                  {unjustifiedFaltaDays}
                </span>
              )}
              {holidayDays > 0 && (
                <span className="inline-flex items-center gap-1 text-cyan-600 dark:text-cyan-400">
                  <IconConfetti className="h-3.5 w-3.5" strokeWidth={2.5} />
                  {holidayDays}
                </span>
              )}
            </>
          )}
        </div>
      </div>

      {/* Mini-day grid uses the same border + background workflow as the
          month view so the year overview reads as a fleet of small calendars. */}
      <div className="p-3">
        <div className="rounded-md border border-border bg-background overflow-hidden">
          <div className="grid grid-cols-7 bg-card border-b border-border">
            {miniWeekDays.map((d, i) => (
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
            const isLastCol = (idx + 1) % 7 === 0;
            const isLastRow = idx >= allDays.length - 7;

            // Out-of-period slots render as blank spacers so the mini-month
            // visually starts at periodStart (day 26) and ends at periodEnd
            // (day 25), matching the month view. The cell is kept so the
            // 7-column grid alignment is preserved.
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

            const dayAbsences = getAbsencesForDay(absences, date);
            const dayHolidays = getHolidaysForDay(holidays, date);
            const isToday = isSameDay(date, new Date());
            const dow = date.getDay();
            const isWeekend = dow === 0 || dow === 6;

            const ausencias = dayAbsences.filter(
              (a) => getJustificativaCategory(a.JustificativaId) === "AUSENCIA",
            ).length;
            const justifiedFaltas = dayAbsences.filter(
              (a) =>
                getJustificativaCategory(a.JustificativaId) === "FALTA" &&
                !isUnjustifiedFalta(a),
            ).length;
            const unjustifiedFaltas = dayAbsences.filter(
              (a) =>
                getJustificativaCategory(a.JustificativaId) === "FALTA" &&
                isUnjustifiedFalta(a),
            ).length;

            // Icon-driven event indicators (matches the StatsRow tile icons:
            // beach = férias, user-off = falta justificada, user-exclamation =
            // falta não justificada, confetti = feriado).
            // Holidays win — same rule as the month view.
            const showHoliday = dayHolidays.length > 0;
            const showAusencia = !showHoliday && !isWeekend && ausencias > 0;
            const showJustifiedFalta = !showHoliday && !isWeekend && justifiedFaltas > 0;
            const showUnjustifiedFalta = !showHoliday && !isWeekend && unjustifiedFaltas > 0;

            const cellNode = (
              <div
                className={cn(
                  "relative aspect-square flex items-center justify-center text-[13px] font-medium tabular-nums transition-colors border-border",
                  !isLastCol && "border-r",
                  !isLastRow && "border-b",
                  isWeekend && !isToday && "bg-blue-50/40 dark:bg-blue-950/20 text-blue-600/80 dark:text-blue-400/80",
                  !isWeekend && !isToday && "text-foreground hover:bg-accent/30",
                  isToday && "ring-2 ring-primary ring-inset font-bold text-primary",
                )}
              >
                <span>{format(date, "d")}</span>
                {!isToday &&
                  (showHoliday || showAusencia || showJustifiedFalta || showUnjustifiedFalta) && (
                    <div className="absolute top-0.5 right-0.5 flex items-center gap-0.5">
                      {showHoliday && (
                        <IconConfetti
                          className="h-4 w-4 text-cyan-600 dark:text-cyan-400"
                          strokeWidth={2.5}
                        />
                      )}
                      {showAusencia && (
                        <IconBeach
                          className="h-4 w-4 text-purple-600 dark:text-purple-400"
                          strokeWidth={2.5}
                        />
                      )}
                      {showJustifiedFalta && (
                        <IconUserOff
                          className="h-4 w-4 text-amber-600 dark:text-amber-400"
                          strokeWidth={2.5}
                        />
                      )}
                      {showUnjustifiedFalta && (
                        <IconUserExclamation
                          className="h-4 w-4 text-red-700 dark:text-red-300"
                          strokeWidth={2.5}
                        />
                      )}
                    </div>
                  )}
              </div>
            );

            // Tooltip only when there's something to show; else just render
            // the cell to keep the year-view grid lightweight (12 × 42 cells).
            const hasContent = dayAbsences.length > 0 || dayHolidays.length > 0;
            if (!hasContent) {
              return <div key={idx}>{cellNode}</div>;
            }
            return (
              <Tooltip key={idx}>
                <TooltipTrigger asChild>
                  <div
                    role="button"
                    tabIndex={0}
                    onClick={(e) => e.stopPropagation()}
                    onKeyDown={(e) => e.stopPropagation()}
                  >
                    {cellNode}
                  </div>
                </TooltipTrigger>
                <TooltipContent side="top" className="w-auto max-w-none">
                  <DayTooltip
                    date={date}
                    absences={isWeekend ? [] : dayAbsences}
                    holidays={dayHolidays}
                    isWeekend={isWeekend}
                    isInPeriod={true}
                  />
                </TooltipContent>
              </Tooltip>
            );
          })}
          </div>
        </div>
      </div>
    </button>
  );
}

// ===== HELPERS ========================================================

// Portuguese name connector words that should never be shown as a "second name".
// Lowercase set; comparison is case-insensitive after trimming.
const NAME_CONNECTORS = new Set([
  "de",
  "da",
  "do",
  "das",
  "dos",
  "e",
  "del",
  "della",
  "der",
  "von",
  "van",
]);

// Returns "First Second" — picks the first name plus the next non-connector
// token. If every following token is a connector (rare), falls back to first
// name only. If only one token, returns it as-is.
function shortName(full: string): string {
  if (!full) return "";
  const parts = full.trim().split(/\s+/);
  if (parts.length <= 1) return parts[0] ?? "";
  const first = parts[0];
  for (let i = 1; i < parts.length; i++) {
    const candidate = parts[i];
    if (!NAME_CONNECTORS.has(candidate.toLowerCase())) {
      return `${first} ${candidate}`;
    }
  }
  return first;
}

// Minimum members for a same-day group to collapse into a single
// "Férias Coletivas" bar instead of N individual rows. Below the threshold
// we fall back to listing each colab — a 2-person overlap isn't really
// "coletiva" and showing two names is more useful than hiding them.
const COLLECTIVE_THRESHOLD = 3;

type CollectiveBucket = {
  key: string;
  category: BarCategory;
  justificativaId: number;
  justificativaLabel: string;
  members: SecullumAggregatedAbsence[];
};

// Unjustified faltas are the synthetic records minted by getUnjustifiedAbsences
// (server-side, see secullum.service.ts). They use a NEGATIVE Id sentinel so we
// can tell them apart from real Secullum afastamento entries — even when both
// share JustificativaId 3 ("Falta sem Justificativa").
function isUnjustifiedFalta(rec: SecullumAggregatedAbsence): boolean {
  return rec.Id < 0;
}

// Resolves the bar/dot color category from a record. AUSENCIA stays violet;
// FALTA splits into amber (justified) vs red (unjustified) based on Id sign.
function getBarCategory(rec: SecullumAggregatedAbsence): BarCategory | null {
  const cat = getJustificativaCategory(rec.JustificativaId);
  if (cat === "AUSENCIA") return "AUSENCIA";
  if (cat === "FALTA") return isUnjustifiedFalta(rec) ? "FALTA_UNJUSTIFIED" : "FALTA_JUSTIFIED";
  return null;
}

// Pulls the explicit [GRP:uuid] prefix from Motivo (Ankaa's encoding for a
// collective creation). Returns null if no prefix — the caller then falls back
// to implicit detection via shared justificativa + period.
function getExplicitCollectiveKey(rec: SecullumAggregatedAbsence): string | null {
  const motivo = (rec as any).Motivo as string | undefined;
  if (!motivo) return null;
  const m = motivo.match(/^\[GRP:([^\]]+)\]/);
  return m ? m[1] : null;
}

// Splits a day's absences into "collective buckets" (≥ THRESHOLD members
// sharing the same group key) and leftover individual records. Group key is
// either the explicit [GRP:uuid] prefix or the implicit
// (JustificativaId + Inicio + Fim) tuple — both indicate the same coletiva
// regardless of whether the records were created via Ankaa or directly in
// Secullum. Records with non-AUSENCIA/non-FALTA categories are left as
// individuals (we don't collapse "Hora extra" etc.).
function bucketDayAbsences(
  dayAbsences: SecullumAggregatedAbsence[],
): { collectives: CollectiveBucket[]; individuals: SecullumAggregatedAbsence[] } {
  const buckets = new Map<string, SecullumAggregatedAbsence[]>();
  const individuals: SecullumAggregatedAbsence[] = [];
  for (const a of dayAbsences) {
    const barCat = getBarCategory(a);
    if (!barCat) {
      individuals.push(a);
      continue;
    }
    const explicit = getExplicitCollectiveKey(a);
    const inicio = String(a.Inicio).substring(0, 10);
    const fim = String(a.Fim).substring(0, 10);
    // Implicit key includes the unjustified suffix so a coletiva of justified
    // faltas (id 3 with explicit Secullum entries, Id ≥ 0) doesn't merge with
    // unjustified synthetic ones (id 3 with Id < 0).
    const key = explicit
      ? `grp:${explicit}`
      : `imp:${a.JustificativaId}:${inicio}:${fim}:${isUnjustifiedFalta(a) ? "u" : "j"}`;
    const arr = buckets.get(key) ?? [];
    arr.push(a);
    buckets.set(key, arr);
  }
  const collectives: CollectiveBucket[] = [];
  for (const [key, members] of buckets) {
    if (members.length < COLLECTIVE_THRESHOLD) {
      individuals.push(...members);
      continue;
    }
    const first = members[0];
    const barCat = getBarCategory(first)!;
    const meta = getJustificativaMeta(first.JustificativaId);
    collectives.push({
      key,
      category: barCat,
      justificativaId: first.JustificativaId,
      justificativaLabel: meta?.label ?? first.JustificativaDescricao ?? "Ausência",
      members,
    });
  }
  // Sort collectives biggest-first so the densest day-event surfaces at the top.
  collectives.sort((a, b) => b.members.length - a.members.length);
  // Sort individuals alphabetically for stable rendering.
  individuals.sort((a, b) => a.userName.localeCompare(b.userName, "pt-BR"));
  return { collectives, individuals };
}

// Pretty label for a collective bar. Vacation collectives are common enough
// to deserve the dedicated "Férias Coletivas" wording; everything else uses
// the justificativa label suffixed with "Coletiva".
function getCollectiveLabel(bucket: CollectiveBucket): string {
  // JustificativaId 5 = Férias (per AUSENCIA bucket: ids 2,5,6,7,8,9,10,12).
  if (bucket.justificativaId === 5) return "Férias Coletivas";
  return `${bucket.justificativaLabel} (coletiva)`;
}

function getAbsencesForDay(
  absences: SecullumAggregatedAbsence[],
  date: Date,
): SecullumAggregatedAbsence[] {
  return absences.filter((a) => {
    const start = new Date(a.Inicio);
    const end = new Date(a.Fim);
    const startD = new Date(start.getFullYear(), start.getMonth(), start.getDate());
    const endD = new Date(end.getFullYear(), end.getMonth(), end.getDate());
    return date >= startD && date <= endD;
  });
}

function getHolidaysForDay(holidays: any[], date: Date): any[] {
  return holidays.filter((h: any) => {
    const raw = h.Data || h.data || h.date;
    if (!raw) return false;
    const datePart = String(raw).substring(0, 10);
    const [y, m, d] = datePart.split("-").map(Number);
    if (!y || !m || !d) return false;
    return isSameDay(new Date(y, m - 1, d), date);
  });
}

function DayTooltip({
  date,
  absences,
  holidays,
  isWeekend,
  isInPeriod,
}: {
  date: Date;
  absences: SecullumAggregatedAbsence[];
  holidays: any[];
  isWeekend: boolean;
  isInPeriod: boolean;
}) {
  return (
    <div className="space-y-1.5">
      <p className="font-semibold capitalize">
        {format(date, "EEEE, dd 'de' MMMM", { locale: ptBR })}
      </p>
      {!isInPeriod && (
        <p className="text-xs text-muted-foreground">Fora do período selecionado</p>
      )}
      {holidays.length > 0 && (
        <div className="text-sm">
          <span className="font-medium text-red-600 dark:text-red-400">Feriado:</span>{" "}
          {holidays.map((h: any) => h.Descricao || h.descricao).join(", ")}
        </div>
      )}
      {!holidays.length && isWeekend && (
        <p className="text-xs text-muted-foreground">Fim de semana</p>
      )}
      {!holidays.length && !isWeekend && absences.length === 0 && isInPeriod && (
        <p className="text-xs text-muted-foreground">Dia útil</p>
      )}
      {absences.length > 0 && (() => {
        const { collectives, individuals } = bucketDayAbsences(absences);
        return (
          <div className="space-y-2 mt-1">
            {collectives.map((b) => {
              const dotColor =
                b.category === "AUSENCIA"
                  ? "bg-purple-600"
                  : b.category === "FALTA_JUSTIFIED"
                    ? "bg-amber-600"
                    : "bg-red-700";
              const label = getCollectiveLabel(b);
              return (
                <div key={b.key} className="space-y-0.5">
                  <div className="text-xs flex items-center gap-2 whitespace-nowrap font-semibold">
                    <span className={cn("inline-block h-2 w-2 rounded-full flex-shrink-0", dotColor)} />
                    <IconUsersGroup className="h-3.5 w-3.5 flex-shrink-0" strokeWidth={2.5} />
                    <span>
                      {label}
                      <span className="text-muted-foreground font-normal">
                        {" "}— {b.members.length} colaboradores
                      </span>
                    </span>
                  </div>
                  <ul className="pl-5 space-y-0.5">
                    {b.members.map((m) => (
                      <li key={m.Id} className="text-[11px] text-muted-foreground whitespace-nowrap">
                        {m.userName}
                      </li>
                    ))}
                  </ul>
                </div>
              );
            })}
            {individuals.length > 0 && (
              <ul className="space-y-0.5">
                {individuals.map((a) => {
                  const barCat = getBarCategory(a);
                  const meta = getJustificativaMeta(a.JustificativaId);
                  const dotColor =
                    barCat === "AUSENCIA"
                      ? "bg-purple-600"
                      : barCat === "FALTA_JUSTIFIED"
                        ? "bg-amber-600"
                        : barCat === "FALTA_UNJUSTIFIED"
                          ? "bg-red-700"
                          : "bg-muted-foreground";
                  return (
                    <li key={a.Id} className="text-xs flex items-center gap-2 whitespace-nowrap">
                      <span className={cn("inline-block h-2 w-2 rounded-full flex-shrink-0", dotColor)} />
                      <span className="font-medium">{a.userName}</span>
                      <span className="text-muted-foreground">
                        — {meta?.label ?? a.JustificativaDescricao}
                      </span>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        );
      })()}
    </div>
  );
}
