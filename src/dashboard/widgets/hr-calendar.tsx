// HR Calendar widget — monthly view of the Brazilian payroll period (26 → 25)
// rendering vacations / faltas (justified + unjustified) / holidays for the
// selected user (or all collaborators) and sector. Built as the dashboard-
// embeddable counterpart to /departamento-pessoal/calendario, sharing the same
// data hooks and category color system.
//
// Data sources (all dedupe across widget instances via react-query):
//   useSecullumAggregatedAbsences  → planned ausências + justified faltas
//   useSecullumUnjustifiedAbsences → synthetic Id < 0 faltas from time-card gaps
//   useSecullumHolidays            → company + national holidays for the month
//
// Configurable: title, accent (color/icon/border), default user/sector, which
// categories to show by default, whether to show inline filter controls.

import { useMemo, useState } from "react";
import { WidgetTabsBar } from "../components/config-kit";
import { z } from "zod";
import { format, eachDayOfInterval } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  IconCalendar,
  IconAdjustments,
  IconBeach,
  IconUserOff,
  IconUserExclamation,
  IconConfetti,
  IconUserSearch,
} from "@tabler/icons-react";

import {
  SECTOR_PRIVILEGES,
  getJustificativaCategory,
  getJustificativaMeta,
} from "../../constants";
import type { SecullumAggregatedAbsence } from "../../types";
import {
  useSecullumAggregatedAbsences,
  useSecullumHolidays,
  useSecullumUnjustifiedAbsences,
  useSectors,
  useUsers,
} from "../../hooks";
import { Combobox } from "../../components/ui/combobox";
import type { ComboboxOption } from "../../components/ui/combobox";
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
import { cn } from "../../lib/utils";
import { routes } from "../../constants/routes";

import { WidgetCard } from "../components/widget-card";
import {
  AccentPicker,
  makeAccentSchema,
  resolveAccent,
} from "../components/widget-accent";
import type {
  WidgetAccentColor,
  WidgetAccentIcon,
  WidgetAccentShade,
} from "../components/widget-accent";
import type {
  WidgetConfigProps,
  WidgetDefinition,
  WidgetRenderProps,
} from "../types";
import { Section, SectionGroup, ToggleRow } from "./_shared";
import {
  CalendarGrid,
  PeriodHeader,
  buildPeriodGrid,
  defaultRefMonth,
  getPayrollPeriod,
  toIsoDay,
} from "./_calendar-shared";

// ============================================================
// Constants
// ============================================================

const ALL_USERS = "__ALL__";

// Same palette as components/personnel-department/absence/calendar/absences-calendar.tsx —
// the dashboard tile and the full HR page must read identically at a glance.
// Solid backgrounds + white text per the centralized BADGE_COLORS workflow:
//   purple = ausência, amber = falta just., red = falta n.j., cyan = feriado.
const CATEGORY_BAR_CLASSES = {
  AUSENCIA: "bg-purple-600 text-white border border-purple-700",
  FALTA_JUSTIFIED: "bg-amber-600 text-white border border-amber-700",
  FALTA_UNJUSTIFIED:
    "bg-red-700 text-white border border-red-800 font-semibold",
} as const;
const HOLIDAY_BAR_CLASS = "bg-cyan-600 text-white border border-cyan-700";

type BarCategory = keyof typeof CATEGORY_BAR_CLASSES;

// ============================================================
// Helpers
// ============================================================

// Unjustified faltas are minted server-side from time-card gaps with a NEGATIVE
// Id sentinel — see secullum.service.ts getUnjustifiedAbsences. We keep the
// rule local rather than re-exporting from the original calendar because it's
// a one-line invariant tied to the API.
function isUnjustifiedFalta(rec: SecullumAggregatedAbsence): boolean {
  return rec.Id < 0;
}

function getBarCategory(rec: SecullumAggregatedAbsence): BarCategory | null {
  const cat = getJustificativaCategory(rec.JustificativaId);
  if (cat === "AUSENCIA") return "AUSENCIA";
  if (cat === "FALTA")
    return isUnjustifiedFalta(rec) ? "FALTA_UNJUSTIFIED" : "FALTA_JUSTIFIED";
  return null;
}

function getAbsencesForDay(
  absences: SecullumAggregatedAbsence[],
  day: Date,
): SecullumAggregatedAbsence[] {
  const dKey = toIsoDay(day);
  return absences.filter((a) => {
    const start = String(a.Inicio).substring(0, 10);
    const end = String(a.Fim).substring(0, 10);
    return dKey >= start && dKey <= end;
  });
}

function getHolidaysForDay(holidays: any[], day: Date): any[] {
  const dKey = toIsoDay(day);
  return holidays.filter((h) => {
    const raw = h.Data || h.data || h.date;
    if (!raw) return false;
    return String(raw).substring(0, 10) === dKey;
  });
}

// ============================================================
// Config schema
// ============================================================

const hrCalendarConfigSchema = z.object({
  title: z.string().min(1).max(80).default("Calendário de Colaboradores"),
  accent: makeAccentSchema({
    color: "violet",
    icon: "Calendar",
  }),
  display: z
    .object({
      showHeader: z.boolean().default(true),
      showViewAllLink: z.boolean().default(true),
      showFilters: z.boolean().default(true),
      showVacation: z.boolean().default(true),
      showJustifiedFalta: z.boolean().default(true),
      showUnjustifiedFalta: z.boolean().default(true),
      showHoliday: z.boolean().default(true),
      showSunday: z.boolean().default(true),
      showSaturday: z.boolean().default(true),
    })
    .default({
      showHeader: true,
      showViewAllLink: true,
      showFilters: true,
      showVacation: true,
      showJustifiedFalta: true,
      showUnjustifiedFalta: true,
      showHoliday: true,
      showSunday: true,
      showSaturday: true,
    }),
  filters: z
    .object({
      defaultUserId: z.string().default(ALL_USERS),
      defaultSectorId: z.string().nullable().default(null),
    })
    .default({ defaultUserId: ALL_USERS, defaultSectorId: null }),
});
type HrCalendarConfig = z.infer<typeof hrCalendarConfigSchema>;

// ============================================================
// Render
// ============================================================

function HrCalendarRender({ config, size }: WidgetRenderProps<HrCalendarConfig>) {
  const accent = useMemo(
    () =>
      resolveAccent({
        color: config.accent?.color as WidgetAccentColor,
        icon: config.accent?.icon as WidgetAccentIcon,
        shade: config.accent?.shade as WidgetAccentShade | undefined,
      }),
    [config.accent?.color, config.accent?.icon, config.accent?.shade],
  );
  const AccentIcon = accent.Icon;

  const [refMonth, setRefMonth] = useState<Date>(() => defaultRefMonth());
  const [selectedUserId, setSelectedUserId] = useState<string>(
    config.filters.defaultUserId || ALL_USERS,
  );
  const [sectorId, setSectorId] = useState<string | undefined>(
    config.filters.defaultSectorId ?? undefined,
  );

  const grid = useMemo(() => buildPeriodGrid(refMonth), [refMonth]);
  const { start: periodStart, end: periodEnd } = useMemo(
    () => getPayrollPeriod(refMonth),
    [refMonth],
  );
  const startStr = toIsoDay(periodStart);
  const endStr = toIsoDay(periodEnd);

  const {
    data: absencesData,
    isLoading: absencesLoading,
    isFetching: absencesFetching,
    refetch: refetchAbsences,
  } = useSecullumAggregatedAbsences({ startDate: startStr, endDate: endStr, sectorId });
  const {
    data: unjustifiedData,
    isLoading: unjustifiedLoading,
    refetch: refetchUnjustified,
  } = useSecullumUnjustifiedAbsences({ startDate: startStr, endDate: endStr, sectorId });
  const {
    data: holidaysData,
    isLoading: holidaysLoading,
    refetch: refetchHolidays,
  } = useSecullumHolidays({
    year: refMonth.getFullYear(),
    month: refMonth.getMonth() + 1,
  });
  const { data: sectorsData } = useSectors({ orderBy: { name: "asc" }, take: 100 } as any);
  const { data: usersData, isLoading: usersLoading } = useUsers({
    isActive: true,
    where: { secullumEmployeeId: { not: null } },
    orderBy: { name: "asc" },
    take: 100,
  } as any);

  const isLoading = absencesLoading || unjustifiedLoading || holidaysLoading;
  const isFetching = absencesFetching;
  const onRefresh = () => {
    refetchAbsences();
    refetchUnjustified();
    refetchHolidays();
  };

  // Resolve the selected user's Secullum funcionarioId so we can match records
  // tagged with the "secullum:<id>" sentinel form.
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
    all = all.filter((a) => {
      const cat = getJustificativaCategory(a.JustificativaId);
      if (cat === "AUSENCIA") return config.display.showVacation;
      if (cat === "FALTA")
        return isUnjustifiedFalta(a)
          ? config.display.showUnjustifiedFalta
          : config.display.showJustifiedFalta;
      return true;
    });
    return all;
  }, [
    absencesData,
    unjustifiedData,
    selectedUserId,
    selectedUserSecullumId,
    config.display.showVacation,
    config.display.showJustifiedFalta,
    config.display.showUnjustifiedFalta,
  ]);

  const holidays: any[] = useMemo(() => {
    if (!config.display.showHoliday) return [];
    const root: any = holidaysData?.data;
    if (Array.isArray(root)) return root;
    if (root && Array.isArray(root.data)) return root.data;
    return [];
  }, [holidaysData, config.display.showHoliday]);

  // Counts shown in the footer summary — matches StatsRow tiles in the full page.
  const stats = useMemo(() => {
    const days = eachDayOfInterval({ start: periodStart, end: periodEnd });
    const holidayKeys = new Set(
      holidays
        .map((h: any) => String(h.Data || h.data || h.date || "").substring(0, 10))
        .filter(Boolean),
    );
    let vacation = 0;
    let justified = 0;
    let unjustified = 0;
    let holidayCount = 0;
    for (const d of days) {
      const dow = d.getDay();
      if (dow === 0 || dow === 6) continue;
      if (holidayKeys.has(toIsoDay(d))) holidayCount++;
    }
    for (const a of absences) {
      const cat = getJustificativaCategory(a.JustificativaId);
      if (cat !== "AUSENCIA" && cat !== "FALTA") continue;
      const start = String(a.Inicio).substring(0, 10);
      const end = String(a.Fim).substring(0, 10);
      for (const d of days) {
        const dow = d.getDay();
        if (dow === 0 || dow === 6) continue;
        const k = toIsoDay(d);
        if (holidayKeys.has(k)) continue;
        if (k < start || k > end) continue;
        if (cat === "AUSENCIA") vacation++;
        else if (isUnjustifiedFalta(a)) unjustified++;
        else justified++;
      }
    }
    return { vacation, justified, unjustified, holiday: holidayCount };
  }, [absences, holidays, periodStart, periodEnd]);

  // Combobox options
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

  const compact = (size?.cols ?? 4) <= 2;

  // Inline filter strip — collapsed into a single navigator row when widget is
  // narrow (cols ≤ 2) so the calendar doesn't lose vertical space.
  const headerExtra = (
    <div className="flex items-center gap-2 flex-wrap justify-end">
      {!compact && config.display.showFilters && (
        <>
          <div className="w-40">
            <Combobox
              options={userOptions}
              value={selectedUserId}
              onValueChange={(v) => setSelectedUserId((Array.isArray(v) ? v[0] : v) || ALL_USERS)}
              placeholder={usersLoading ? "Carregando..." : "Colaborador"}
              emptyText="Nenhum"
              searchable
              disabled={usersLoading}
              triggerClassName="h-7 text-xs"
            />
          </div>
          <div className="w-36">
            <Combobox
              options={sectorOptions}
              value={sectorId ?? ""}
              onValueChange={(v) => setSectorId((Array.isArray(v) ? v[0] : v) || undefined)}
              placeholder="Setor"
              emptyText="Nenhum"
              clearable
              searchable
              triggerClassName="h-7 text-xs"
            />
          </div>
        </>
      )}
      <PeriodHeader
        refMonth={refMonth}
        onChange={setRefMonth}
        onRefresh={onRefresh}
        isFetching={isFetching}
      />
    </div>
  );

  // Per-day cell renderer
  const renderCell = ({ date, isWeekend }: { date: Date; isWeekend: boolean }) => {
    const dayAbsences = getAbsencesForDay(absences, date);
    const dayHolidays = getHolidaysForDay(holidays, date);
    const hasContent = dayAbsences.length > 0 || dayHolidays.length > 0;

    // Build the bar list: holidays first, then absences. Holidays/weekends
    // shouldn't show absence bars on top — the absence still exists in the
    // tooltip but the cell stays clean.
    const isHoliday = dayHolidays.length > 0;
    const visibleAbsences = isHoliday || isWeekend ? [] : dayAbsences;
    const hasOverflow = dayHolidays.length + visibleAbsences.length > 2;

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
          {dayHolidays.map((h, i) => (
            <div
              key={`h${i}`}
              className={cn(
                "text-[9px] px-1 py-px rounded-sm truncate font-medium",
                HOLIDAY_BAR_CLASS,
              )}
            >
              {h.Descricao || h.descricao || "Feriado"}
            </div>
          ))}
          {visibleAbsences.map((a, i) => {
            const barCat = getBarCategory(a);
            if (!barCat) return null;
            const meta = getJustificativaMeta(a.JustificativaId);
            const userLabel = a.userName || meta?.abreviado || "—";
            return (
              <div
                key={`a${i}-${a.Id}`}
                className={cn(
                  "text-[9px] px-1 py-px rounded-sm truncate",
                  CATEGORY_BAR_CLASSES[barCat],
                )}
                title={userLabel}
              >
                {userLabel}
              </div>
            );
          })}
        </div>
      </div>
    );

    if (!hasContent) return cell;

    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <div className="h-full">{cell}</div>
        </TooltipTrigger>
        <TooltipContent side="top" className="max-w-xs">
          <div className="space-y-1 text-xs">
            <div className="font-semibold">
              {format(date, "EEEE, dd 'de' MMMM", { locale: ptBR })}
            </div>
            {dayHolidays.map((h, i) => (
              <div key={`th${i}`} className="text-cyan-600 dark:text-cyan-300">
                🎉 {h.Descricao || h.descricao || "Feriado"}
              </div>
            ))}
            {dayAbsences.map((a, i) => {
              const meta = getJustificativaMeta(a.JustificativaId);
              const cat = getBarCategory(a);
              return (
                <div key={`ta${i}-${a.Id}`} className="flex items-start gap-1.5">
                  <span
                    className={cn(
                      "inline-block w-1.5 h-1.5 rounded-full mt-1 shrink-0",
                      cat === "AUSENCIA" && "bg-purple-600",
                      cat === "FALTA_JUSTIFIED" && "bg-amber-600",
                      cat === "FALTA_UNJUSTIFIED" && "bg-red-700",
                    )}
                  />
                  <span>
                    <span className="font-medium">{a.userName}</span>
                    <span className="text-muted-foreground">
                      {" "}
                      · {meta?.label ?? `#${a.JustificativaId}`}
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
      viewAllHref={
        (config.display.showViewAllLink ?? true)
          ? routes.personnelDepartment.calendar.root
          : undefined
      }
      showHeader={config.display.showHeader ?? true}
      accentColor={config.accent?.color as WidgetAccentColor}
      accentShade={config.accent?.shade as WidgetAccentShade | undefined}
    >
      <div className="h-full flex flex-col p-2 gap-2">
        <CalendarGrid
          grid={grid}
          renderCell={renderCell}
          weekDayMode="short"
          showSunday={config.display.showSunday}
          showSaturday={config.display.showSaturday}
        />
        {/* Footer summary — counts mirror the full HR page tiles */}
        <div className="flex items-center justify-between gap-3 px-1 text-[11px] text-muted-foreground flex-wrap">
          {config.display.showVacation && (
            <SummaryChip color="purple" icon={IconBeach} label="Férias/Ausência" value={stats.vacation} />
          )}
          {config.display.showJustifiedFalta && (
            <SummaryChip color="amber" icon={IconUserOff} label="Faltas Just." value={stats.justified} />
          )}
          {config.display.showUnjustifiedFalta && (
            <SummaryChip color="red" icon={IconUserExclamation} label="Faltas N.J." value={stats.unjustified} />
          )}
          {config.display.showHoliday && (
            <SummaryChip color="cyan" icon={IconConfetti} label="Feriados" value={stats.holiday} />
          )}
          {isLoading && <span className="text-[10px] italic">Carregando…</span>}
        </div>
      </div>
    </WidgetCard>
  );
}

function SummaryChip({
  color,
  icon: Icon,
  label,
  value,
}: {
  color: "purple" | "amber" | "red" | "cyan";
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: number;
}) {
  const colors = {
    purple: "text-purple-600 dark:text-purple-300",
    amber: "text-amber-600 dark:text-amber-300",
    red: "text-red-700 dark:text-red-300",
    cyan: "text-cyan-600 dark:text-cyan-300",
  };
  return (
    <span className="inline-flex items-center gap-1">
      <Icon className={cn("h-3 w-3", colors[color])} />
      <span className={cn("font-semibold tabular-nums", colors[color])}>{value}</span>
      <span className="hidden sm:inline">{label}</span>
    </span>
  );
}

// ============================================================
// Config component
// ============================================================

function HrCalendarConfigComponent({
  config,
  onChange,
}: WidgetConfigProps<HrCalendarConfig>) {
  const set = <K extends keyof HrCalendarConfig>(key: K, value: HrCalendarConfig[K]) =>
    onChange({ ...config, [key]: value });
  const setDisplay = <K extends keyof HrCalendarConfig["display"]>(
    key: K,
    value: HrCalendarConfig["display"][K],
  ) => onChange({ ...config, display: { ...config.display, [key]: value } });
  const setFilters = <K extends keyof HrCalendarConfig["filters"]>(
    key: K,
    value: HrCalendarConfig["filters"][K],
  ) => onChange({ ...config, filters: { ...config.filters, [key]: value } });

  const accentColor = (config.accent?.color ?? "violet") as WidgetAccentColor;
  const accentIcon = (config.accent?.icon ?? "Calendar") as WidgetAccentIcon;
  const accentShade = (config.accent?.shade ?? "500") as WidgetAccentShade;

  const { data: sectorsData } = useSectors({ orderBy: { name: "asc" }, take: 100 } as any);
  const { data: usersData } = useUsers({
    isActive: true,
    where: { secullumEmployeeId: { not: null } },
    orderBy: { name: "asc" },
    take: 100,
  } as any);
  const sectorOptions = useMemo<ComboboxOption[]>(
    () =>
      (sectorsData?.data ?? []).map((s: any) => ({ value: s.id, label: s.name })),
    [sectorsData],
  );
  const userOptions = useMemo<ComboboxOption[]>(
    () => [
      { value: ALL_USERS, label: "Todos os colaboradores" },
      ...((usersData?.data ?? []).map((u: any) => ({ value: u.id, label: u.name }))),
    ],
    [usersData],
  );

  return (
    <div className="space-y-3">
      <Tabs defaultValue="appearance" className="flex flex-col gap-2">
        <WidgetTabsBar><TabsList className="self-start">
          <TabsTrigger value="appearance" className="gap-1">
            <IconAdjustments className="h-3.5 w-3.5" /> Aparência
          </TabsTrigger>
          <TabsTrigger value="display" className="gap-1">
            <IconCalendar className="h-3.5 w-3.5" /> Exibição
          </TabsTrigger>
          <TabsTrigger value="filters" className="gap-1">
            <IconUserSearch className="h-3.5 w-3.5" /> Filtros
          </TabsTrigger>
        </TabsList></WidgetTabsBar>

        <TabsContent value="appearance" className="space-y-3 mt-0">
          <SectionGroup defaultOpenId={null}>
            <Section title="Destaque (cor e ícone)" defaultOpen>
              <AccentPicker
                value={{ color: accentColor, icon: accentIcon, shade: accentShade }}
                onChange={(next) =>
                  set("accent", {
                    color: next.color || accentColor,
                    icon: next.icon || accentIcon,
                    shade: next.shade || accentShade,
                  } as HrCalendarConfig["accent"])
                }
              />
            </Section>
            <Section title="Cabeçalho e link">
              <div className="space-y-1">
                <ToggleRow
                  label="Exibir cabeçalho"
                  checked={config.display.showHeader ?? true}
                  onCheckedChange={(v) => setDisplay("showHeader", v)}
                />
                <ToggleRow
                  label='Link "Ver todos"'
                  checked={config.display.showViewAllLink ?? true}
                  onCheckedChange={(v) => setDisplay("showViewAllLink", v)}
                />
              </div>
            </Section>
          </SectionGroup>
        </TabsContent>

        <TabsContent value="display" className="space-y-3 mt-0">
          <SectionGroup defaultOpenId={null}>
            <Section title="Categorias visíveis" defaultOpen>
              <div className="space-y-1">
                <ToggleRow
                  label="Férias / Ausência"
                  checked={config.display.showVacation}
                  onCheckedChange={(v) => setDisplay("showVacation", v)}
                />
                <ToggleRow
                  label="Faltas justificadas"
                  checked={config.display.showJustifiedFalta}
                  onCheckedChange={(v) => setDisplay("showJustifiedFalta", v)}
                />
                <ToggleRow
                  label="Faltas não justificadas"
                  checked={config.display.showUnjustifiedFalta}
                  onCheckedChange={(v) => setDisplay("showUnjustifiedFalta", v)}
                />
                <ToggleRow
                  label="Feriados"
                  checked={config.display.showHoliday}
                  onCheckedChange={(v) => setDisplay("showHoliday", v)}
                />
              </div>
            </Section>

            <Section title="Layout">
              <div className="space-y-1">
                <ToggleRow
                  label="Filtros no cabeçalho"
                  checked={config.display.showFilters}
                  onCheckedChange={(v) => setDisplay("showFilters", v)}
                />
                <ToggleRow
                  label="Mostrar domingo"
                  checked={config.display.showSunday}
                  onCheckedChange={(v) => setDisplay("showSunday", v)}
                />
                <ToggleRow
                  label="Mostrar sábado"
                  checked={config.display.showSaturday}
                  onCheckedChange={(v) => setDisplay("showSaturday", v)}
                />
              </div>
              <p className="text-[11px] text-muted-foreground">
                Quando um dia tem mais eventos do que cabem, a célula rola
                verticalmente. A tooltip continua mostrando todos.
              </p>
            </Section>
          </SectionGroup>
        </TabsContent>

        <TabsContent value="filters" className="space-y-3 mt-0">
          <Section title="Filtros padrão" defaultOpen>
            <div className="space-y-1.5">
              <Label className="text-xs">Colaborador padrão</Label>
              <Combobox
                options={userOptions}
                value={config.filters.defaultUserId}
                onValueChange={(v) =>
                  setFilters("defaultUserId", (Array.isArray(v) ? v[0] : v) || ALL_USERS)
                }
                placeholder="Todos os colaboradores"
                emptyText="Nenhum"
                searchable
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Setor padrão</Label>
              <Combobox
                options={sectorOptions}
                value={config.filters.defaultSectorId ?? ""}
                onValueChange={(v) => {
                  const next = (Array.isArray(v) ? v[0] : v) || "";
                  setFilters("defaultSectorId", next || null);
                }}
                placeholder="Todos os setores"
                emptyText="Nenhum"
                clearable
                searchable
              />
            </div>
          </Section>
        </TabsContent>

      </Tabs>
    </div>
  );
}

// ============================================================
// Definition
// ============================================================

export const hrCalendarWidget: WidgetDefinition<HrCalendarConfig> = {
  id: "home.hr-calendar",
  name: "Calendário de Colaboradores",
  description:
    "Visão mensal do período (26→25) com férias, faltas (justificadas e não justificadas) e feriados por colaborador e setor. Mesmo sistema do calendário completo de RH.",
  icon: IconCalendar,
  category: "hr",
  allowedSectors: [
    SECTOR_PRIVILEGES.HUMAN_RESOURCES,
    SECTOR_PRIVILEGES.ADMIN,
    SECTOR_PRIVILEGES.PRODUCTION_MANAGER,
  ],
  defaultSize: { cols: 4, rows: 3 },
  minSize: { cols: 2, rows: 3 },
  maxSize: { cols: 4, rows: 4 },
  configSchema: hrCalendarConfigSchema,
  defaultConfig: {
    title: "Calendário de Colaboradores",
    accent: { color: "violet", icon: "Calendar", shade: "500" },
    display: {
      showHeader: true,
      showViewAllLink: true,
      showFilters: true,
      showVacation: true,
      showJustifiedFalta: true,
      showUnjustifiedFalta: true,
      showHoliday: true,
      showSunday: true,
      showSaturday: true,
    },
    filters: {
      defaultUserId: ALL_USERS,
      defaultSectorId: null,
    },
  },
  RenderComponent: HrCalendarRender,
  ConfigComponent: HrCalendarConfigComponent,
};
