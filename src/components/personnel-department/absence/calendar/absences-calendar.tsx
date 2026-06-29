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
  IconCalendarEvent,
  IconCake,
  IconChevronLeft,
  IconChevronRight,
  IconBriefcase,
  IconBeach,
  IconStethoscope,
  IconUserOff,
  IconUserExclamation,
  IconConfetti,
  IconStar,
  IconUsersGroup,
  IconPencil,
  IconPlus,
  IconTrash,
} from "@tabler/icons-react";

import {
  CONTRACT_STATUS,
  LEAVE_STATUS,
  LEAVE_TYPE_LABELS,
  VACATION_JUSTIFICATIVA_ID,
  getJustificativaCategory,
  getJustificativaMeta,
} from "../../../../constants";
import type { LEAVE_TYPE } from "../../../../constants";

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
// Per-category bar icon, mirroring the icons used in the summary stat tiles so
// each cell bar reads with the same glyph as its tile (férias=praia,
// falta justificada=usuário ausente, falta n.j.=usuário alerta).
const CATEGORY_BAR_ICONS = {
  AUSENCIA: IconBeach,
  FALTA_JUSTIFIED: IconUserOff,
  FALTA_UNJUSTIFIED: IconUserExclamation,
} as const;
const HOLIDAY_BAR_CLASS = "bg-cyan-600 text-white border border-cyan-700";
// New unified-calendar overlays: afastamentos (Leave), aniversários (User.birth)
// e eventos da agenda (AgendaEvent). Hues keep distance from the existing four.
const LEAVE_BAR_CLASS = "bg-orange-600 text-white border border-orange-700";
const BIRTHDAY_BAR_CLASS = "bg-pink-600 text-white border border-pink-700";
const EVENT_BAR_CLASS = "bg-indigo-600 text-white border border-indigo-700";
// Datas comemorativas (dataset estático pt-BR + aniversário da empresa) —
// fúcsia, longe do ciano dos feriados oficiais e do rosa dos aniversários.
const COMMEMORATIVE_BAR_CLASS = "bg-fuchsia-600 text-white border border-fuchsia-700";
import type { SecullumAggregatedAbsence, Leave, AgendaEvent, User } from "../../../../types";
import {
  useAgendaEventMutations,
  useAgendaEvents,
  useLeaves,
  useSecullumAggregatedAbsences,
  useSecullumHolidays,
  useSecullumUnjustifiedAbsences,
  useSectors,
  useUsers,
} from "../../../../hooks";
import { AgendaEventDialog } from "../../calendar/agenda-event-dialog";
import {
  getCommemorativesForDay,
  dedupeAgainstHolidays,
  type CommemorativeDate,
} from "../../calendar/commemorative-dates";

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

// Standard calendar month (day 1 → last day). The old payroll-period window
// (26→25) made the grid open with a week of blank spacer cells, which read
// as a broken layout — the unified calendar shows conventional months.
function getMonthPeriod(refMonth: Date) {
  const start = new Date(refMonth.getFullYear(), refMonth.getMonth(), 1);
  const end = new Date(refMonth.getFullYear(), refMonth.getMonth() + 1, 0);
  return { start, end };
}

// Default to the current calendar month.
function defaultRefMonth(): Date {
  const today = new Date();
  return new Date(today.getFullYear(), today.getMonth(), 1);
}

// ---- Visibility toggles persistence (localStorage) ---------------------
const VISIBILITY_STORAGE_KEY = "hr-calendar-visibility";

type VisibilityPrefs = Partial<Record<
  | "vacation"
  | "justifiedFalta"
  | "unjustifiedFalta"
  | "holiday"
  | "leave"
  | "birthday"
  | "event"
  | "commemorative",
  boolean
>>;

function loadVisibilityPrefs(): VisibilityPrefs {
  try {
    const raw = localStorage.getItem(VISIBILITY_STORAGE_KEY);
    return raw ? (JSON.parse(raw) as VisibilityPrefs) : {};
  } catch {
    return {};
  }
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
  // Visibility toggles per category — user can hide each overlay
  // independently. StatsRow tiles act as on/off switches and the choices
  // persist in localStorage across visits.
  const [showVacation, setShowVacation] = useState(() => loadVisibilityPrefs().vacation ?? true);
  const [showJustifiedFalta, setShowJustifiedFalta] = useState(() => loadVisibilityPrefs().justifiedFalta ?? true);
  const [showUnjustifiedFalta, setShowUnjustifiedFalta] = useState(() => loadVisibilityPrefs().unjustifiedFalta ?? true);
  const [showHoliday, setShowHoliday] = useState(() => loadVisibilityPrefs().holiday ?? true);
  const [showLeave, setShowLeave] = useState(() => loadVisibilityPrefs().leave ?? true);
  const [showBirthday, setShowBirthday] = useState(() => loadVisibilityPrefs().birthday ?? true);
  const [showEvent, setShowEvent] = useState(() => loadVisibilityPrefs().event ?? true);
  const [showCommemorative, setShowCommemorative] = useState(
    () => loadVisibilityPrefs().commemorative ?? true,
  );

  // Agenda-event dialog (create/edit) wiring.
  const [eventDialogOpen, setEventDialogOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState<AgendaEvent | null>(null);
  const agendaEventMutations = useAgendaEventMutations();

  // Persist toggle choices.
  useEffect(() => {
    try {
      const prefs: VisibilityPrefs = {
        vacation: showVacation,
        justifiedFalta: showJustifiedFalta,
        unjustifiedFalta: showUnjustifiedFalta,
        holiday: showHoliday,
        leave: showLeave,
        birthday: showBirthday,
        event: showEvent,
        commemorative: showCommemorative,
      };
      localStorage.setItem(VISIBILITY_STORAGE_KEY, JSON.stringify(prefs));
    } catch {
      // localStorage indisponível — preferências não persistem nesta sessão.
    }
  }, [showVacation, showJustifiedFalta, showUnjustifiedFalta, showHoliday, showLeave, showBirthday, showEvent, showCommemorative]);
  // Selected day powers the right-side "Detalhe do dia" panel. Clicking a
  // cell selects it; clicking the same cell again or pressing "Limpar"
  // clears it. Persists only while the day stays inside the visible period.
  const [selectedDay, setSelectedDay] = useState<Date | null>(null);

  // Fetch + render range — standard calendar months.
  const range = useMemo(() => {
    if (viewMode === "year") {
      const start = new Date(refMonth.getFullYear(), 0, 1);
      const end = new Date(refMonth.getFullYear(), 11, 31);
      return { periodStart: start, periodEnd: end, gridStart: start, gridEnd: end };
    }
    const { start, end } = getMonthPeriod(refMonth);
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
    // statuses: [CONTRACT_STATUS.ACTIVE] = currentContractStatus ACTIVE —
    // colaboradores com contrato ativo, exclui desligados. Mesma convenção
    // dos aniversários acima.
    statuses: [CONTRACT_STATUS.ACTIVE],
    where: { secullumEmployeeId: { not: null } },
    orderBy: { name: "asc" },
    take: 100,
  } as any);

  // ---- Unified-calendar overlays --------------------------------------
  // Aniversários: every ACTIVE collaborator (no Secullum link required) —
  // birthdays recur yearly, so the list is range-independent.
  // statuses: [CONTRACT_STATUS.ACTIVE] filtra por currentContractStatus ACTIVE
  // (ver schemas/user.ts), so colaboradores desligados NÃO aparecem nos
  // aniversários.
  const { data: birthdayUsersData } = useUsers({
    statuses: [CONTRACT_STATUS.ACTIVE],
    orderBy: { name: "asc" },
    // 100 é o teto do paginationSchema da API — limit: 200 era REJEITADO
    // pelo zod (400) e os aniversários nunca carregavam.
    limit: 100,
  } as any);

  // Afastamentos (Leave): only records that can overlap the visible period —
  // started before it ends AND not finished before it starts (end =
  // actualEndDate ?? expectedEndDate; both null ⇒ open-ended, always kept).
  // Without the end-date bound, old COMPLETED leaves would consume the
  // result cap (orderBy startDate asc) and truncate current ones.
  const { data: leavesData, isLoading: leavesLoading } = useLeaves({
    where: {
      status: { in: [LEAVE_STATUS.SCHEDULED, LEAVE_STATUS.ACTIVE, LEAVE_STATUS.COMPLETED] },
      startDate: { lte: format(range.periodEnd, "yyyy-MM-dd'T'23:59:59") },
      OR: [
        { actualEndDate: { gte: format(range.periodStart, "yyyy-MM-dd'T'00:00:00") } },
        { actualEndDate: null, expectedEndDate: { gte: format(range.periodStart, "yyyy-MM-dd'T'00:00:00") } },
        { actualEndDate: null, expectedEndDate: null },
      ],
    },
    include: { user: true },
    orderBy: { startDate: "asc" },
    // 100 é o teto do paginationSchema da API; com o filtro de sobreposição
    // acima, os afastamentos visíveis de um período nunca chegam perto disso.
    limit: 100,
  } as any);

  // Eventos da agenda dentro do período visível.
  const { data: agendaEventsData, isLoading: agendaEventsLoading } = useAgendaEvents({
    where: {
      isActive: true,
      eventDate: {
        gte: format(range.periodStart, "yyyy-MM-dd'T'00:00:00"),
        lte: format(range.periodEnd, "yyyy-MM-dd'T'23:59:59"),
      },
    },
    include: { createdBy: true },
    orderBy: { eventDate: "asc" },
    limit: 100,
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
    // Dedupe: drop Secullum records that our DB already owns and renders. The
    // Férias/Afastamento sync tags the Motivo with [ANKAA-VAC:<id>] /
    // [ANKAA-LEAVE:<id>]; those are shown from our own data (vacations/leaves),
    // so showing the mirrored Secullum copy too would double them up.
    all = all.filter((a) => {
      const motivo = a.Motivo ?? "";
      return !motivo.includes("[ANKAA-VAC:") && !motivo.includes("[ANKAA-LEAVE:");
    });
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

  // Afastamentos visíveis — respeitam o toggle e os filtros de colaborador/setor.
  const leaves: Leave[] = useMemo(() => {
    if (!showLeave) return [];
    let arr: Leave[] = leavesData?.data ?? [];
    if (selectedUserId !== ALL_USERS) {
      arr = arr.filter((l) => l.userId === selectedUserId);
    }
    if (sectorId) {
      arr = arr.filter((l: any) => l.user?.sectorId === sectorId);
    }
    return arr;
  }, [leavesData, showLeave, selectedUserId, sectorId]);

  // Aniversariantes visíveis — recorrentes por dia/mês de nascimento.
  const birthdayUsers: User[] = useMemo(() => {
    if (!showBirthday) return [];
    let arr: User[] = (birthdayUsersData?.data ?? []).filter((u: any) => !!u.birth);
    if (selectedUserId !== ALL_USERS) {
      arr = arr.filter((u) => u.id === selectedUserId);
    }
    if (sectorId) {
      arr = arr.filter((u: any) => u.sectorId === sectorId);
    }
    return arr;
  }, [birthdayUsersData, showBirthday, selectedUserId, sectorId]);

  // Eventos da agenda visíveis (não filtram por colaborador/setor — são
  // eventos da empresa, com alvos próprios de notificação).
  const agendaEvents: AgendaEvent[] = useMemo(() => {
    if (!showEvent) return [];
    return agendaEventsData?.data ?? [];
  }, [agendaEventsData, showEvent]);

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
    // Afastamentos — person-work-day overlap, same rule as the absence bars.
    const usersOnLeave = new Set<string>();
    let leaveDays = 0;
    for (const l of leaves) {
      const bounds = getLeaveBounds(l);
      const overlap = workDaysInPeriod.filter((d) => d >= bounds.start && d <= bounds.end).length;
      if (overlap === 0) continue;
      leaveDays += overlap;
      usersOnLeave.add(l.userId);
    }

    // Aniversários no período (qualquer dia, inclusive fins de semana).
    let birthdayCount = 0;
    for (const d of days) {
      birthdayCount += getBirthdaysForDay(birthdayUsers, d).length;
    }

    // Datas comemorativas no período (dataset estático — qualquer dia).
    // Conta APÓS o dedupe contra feriados, para o tile "Comemorativas" bater
    // com as barras realmente renderizadas (Corpus Christi etc. não conta
    // duas vezes).
    let commemorativeCount = 0;
    if (showCommemorative) {
      for (const d of days) {
        commemorativeCount += getCommemorativesForDayDeduped(
          d,
          getHolidaysForDay(holidays, d),
        ).length;
      }
    }

    // Eventos da agenda no período.
    const eventCount = agendaEvents.filter((e) => {
      const day = toLocalDay(new Date(e.eventDate));
      return day >= range.periodStart && day <= range.periodEnd;
    }).length;

    return {
      workingDays,
      vacationDays,
      justifiedFaltaDays,
      unjustifiedFaltaDays,
      usersOnVacation: usersOnVacation.size,
      usersOnJustifiedFalta: usersOnJustifiedFalta.size,
      usersOnUnjustifiedFalta: usersOnUnjustifiedFalta.size,
      holidayDays: holidayDaysInPeriod,
      leaveDays,
      usersOnLeave: usersOnLeave.size,
      birthdayCount,
      eventCount,
      commemorativeCount,
    };
  }, [range.periodStart, range.periodEnd, absences, holidays, leaves, birthdayUsers, agendaEvents, showCommemorative]);

  const isLoading =
    absencesLoading || holidaysLoading || unjustifiedLoading || leavesLoading || agendaEventsLoading;

  const handleEditEvent = (event: AgendaEvent) => {
    setEditingEvent(event);
    setEventDialogOpen(true);
  };

  const handleDeleteEvent = (event: AgendaEvent) => {
    if (!window.confirm(`Excluir o evento "${event.title}"?`)) return;
    agendaEventMutations.delete(event.id);
  };

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
    // `flex-1` (not h-full + overflow-hidden): the card fills the viewport
    // when there's room and GROWS past it when the month grid needs more
    // height — the page then scrolls. The old hard-capped chain compressed
    // the grid rows on shorter screens, clipping/overlapping the cells.
    <Card className="flex-1 flex flex-col shadow-sm border border-border">
      <CardContent className="flex-1 flex flex-col p-4 space-y-4">
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

          <div className="flex items-center gap-2 ml-auto flex-shrink-0">
          <Button
            type="button"
            onClick={() => {
              setEditingEvent(null);
              setEventDialogOpen(true);
            }}
            className="h-10"
          >
            <IconPlus className="h-4 w-4 mr-1.5" />
            Novo Evento
          </Button>
          <div className="flex items-center gap-1 rounded-md border border-border p-0.5 bg-background">
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

          <div className="flex items-center gap-1">
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
          showLeave={showLeave}
          showBirthday={showBirthday}
          showEvent={showEvent}
          showCommemorative={showCommemorative}
          onToggleVacation={() => setShowVacation((v) => !v)}
          onToggleJustifiedFalta={() => setShowJustifiedFalta((v) => !v)}
          onToggleUnjustifiedFalta={() => setShowUnjustifiedFalta((v) => !v)}
          onToggleHoliday={() => setShowHoliday((v) => !v)}
          onToggleLeave={() => setShowLeave((v) => !v)}
          onToggleBirthday={() => setShowBirthday((v) => !v)}
          onToggleEvent={() => setShowEvent((v) => !v)}
          onToggleCommemorative={() => setShowCommemorative((v) => !v)}
        />

        {isLoading ? (
          <div className="flex-1 flex items-center justify-center">
            <LoadingSpinner size="lg" />
          </div>
        ) : viewMode === "month" ? (
          <div className="flex-1 flex gap-4 items-stretch">
            <div className="flex-1 min-w-0 flex">
              <MonthView
                gridStart={range.gridStart}
                gridEnd={range.gridEnd}
                periodStart={range.periodStart}
                periodEnd={range.periodEnd}
                absences={absences}
                holidays={holidays}
                leaves={leaves}
                birthdayUsers={birthdayUsers}
                agendaEvents={agendaEvents}
                showCommemoratives={showCommemorative}
                selectedDay={selectedDay}
                onSelectDay={setSelectedDay}
              />
            </div>
            <DayDetailPanel
              selectedDay={selectedDay}
              absences={absences}
              holidays={holidays}
              leaves={leaves}
              birthdayUsers={birthdayUsers}
              agendaEvents={agendaEvents}
              showCommemoratives={showCommemorative}
              onEditEvent={handleEditEvent}
              onDeleteEvent={handleDeleteEvent}
              onClose={() => setSelectedDay(null)}
            />
          </div>
        ) : (
          <YearView
            year={refMonth.getFullYear()}
            absences={absences}
            holidays={holidays}
            leaves={leaves}
            birthdayUsers={birthdayUsers}
            agendaEvents={agendaEvents}
            showCommemoratives={showCommemorative}
            onMonthClick={(monthIdx) => {
              setRefMonth(new Date(refMonth.getFullYear(), monthIdx, 1));
              setViewMode("month");
            }}
          />
        )}

        <AgendaEventDialog
          open={eventDialogOpen}
          onOpenChange={(open) => {
            setEventDialogOpen(open);
            if (!open) setEditingEvent(null);
          }}
          editing={editingEvent}
          defaultDate={selectedDay}
        />
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
  showLeave,
  showBirthday,
  showEvent,
  showCommemorative,
  onToggleVacation,
  onToggleJustifiedFalta,
  onToggleUnjustifiedFalta,
  onToggleHoliday,
  onToggleLeave,
  onToggleBirthday,
  onToggleEvent,
  onToggleCommemorative,
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
    leaveDays: number;
    usersOnLeave: number;
    birthdayCount: number;
    eventCount: number;
    commemorativeCount: number;
  };
  showVacation: boolean;
  showJustifiedFalta: boolean;
  showUnjustifiedFalta: boolean;
  showHoliday: boolean;
  showLeave: boolean;
  showBirthday: boolean;
  showEvent: boolean;
  showCommemorative: boolean;
  onToggleVacation: () => void;
  onToggleJustifiedFalta: () => void;
  onToggleUnjustifiedFalta: () => void;
  onToggleHoliday: () => void;
  onToggleLeave: () => void;
  onToggleBirthday: () => void;
  onToggleEvent: () => void;
  onToggleCommemorative: () => void;
}) {
  const colabSuffix = (n: number) => `${n} ${n === 1 ? "colab." : "colabs."}`;
  return (
    <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-9 gap-3 flex-shrink-0">
      <StatTile
        icon={IconBriefcase}
        label="Dias úteis"
        value={stats.workingDays}
        suffix={stats.workingDays === 1 ? "dia" : "dias"}
        tone="emerald"
      />
      <StatTile
        icon={IconBeach}
        label="Férias"
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
      <StatTile
        icon={IconStethoscope}
        label="Afastamentos"
        value={stats.leaveDays}
        suffix={`dias · ${colabSuffix(stats.usersOnLeave)}`}
        tone="orange"
        active={showLeave}
        onClick={onToggleLeave}
      />
      <StatTile
        icon={IconCake}
        label="Aniversários"
        value={stats.birthdayCount}
        suffix={stats.birthdayCount === 1 ? "colab." : "colabs."}
        tone="pink"
        active={showBirthday}
        onClick={onToggleBirthday}
      />
      <StatTile
        icon={IconCalendarEvent}
        label="Eventos"
        value={stats.eventCount}
        suffix={stats.eventCount === 1 ? "evento" : "eventos"}
        tone="indigo"
        active={showEvent}
        onClick={onToggleEvent}
      />
      <StatTile
        icon={IconStar}
        label="Comemorativas"
        value={stats.commemorativeCount}
        suffix={stats.commemorativeCount === 1 ? "data" : "datas"}
        tone="fuchsia"
        active={showCommemorative}
        onClick={onToggleCommemorative}
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
  tone: "emerald" | "purple" | "red" | "amber" | "cyan" | "orange" | "pink" | "indigo" | "fuchsia";
  active?: boolean;
  onClick?: () => void;
}) {
  // Tile hue mirrors the bar palette so the legend reads as the same story:
  //   purple = férias, amber = falta justificada, red = falta n.j., cyan = feriado,
  //   orange = afastamento, pink = aniversário, indigo = evento da agenda,
  //   fuchsia = data comemorativa.
  // Tiles use a soft tint (vs the bars' solid bg) so the dashboard's stat
  // header doesn't compete visually with the calendar grid below it.
  const toneClasses: Record<typeof tone, string> = {
    emerald: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 ring-emerald-500/20",
    purple: "bg-purple-500/10 text-purple-600 dark:text-purple-400 ring-purple-500/20",
    amber: "bg-amber-500/10 text-amber-600 dark:text-amber-400 ring-amber-500/20",
    red: "bg-red-500/15 text-red-700 dark:text-red-300 ring-red-500/40",
    cyan: "bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 ring-cyan-500/20",
    orange: "bg-orange-500/10 text-orange-600 dark:text-orange-400 ring-orange-500/20",
    pink: "bg-pink-500/10 text-pink-600 dark:text-pink-400 ring-pink-500/20",
    indigo: "bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 ring-indigo-500/20",
    fuchsia: "bg-fuchsia-500/10 text-fuchsia-600 dark:text-fuchsia-400 ring-fuchsia-500/20",
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
  leaves,
  birthdayUsers,
  agendaEvents,
  showCommemoratives,
  selectedDay,
  onSelectDay,
}: {
  gridStart: Date;
  gridEnd: Date;
  periodStart: Date;
  periodEnd: Date;
  absences: SecullumAggregatedAbsence[];
  holidays: any[];
  leaves: Leave[];
  birthdayUsers: User[];
  agendaEvents: AgendaEvent[];
  showCommemoratives: boolean;
  selectedDay: Date | null;
  onSelectDay: (d: Date | null) => void;
}) {
  const allDays = eachDayOfInterval({ start: gridStart, end: gridEnd });
  // Rows get an equal share of the available height but never shrink below
  // 120px: `minmax(120px, 1fr)`. When the viewport is short the grid simply
  // grows past it and the PAGE scrolls — the old hard `minmax(0, 1fr)` cap
  // plus per-cell min-heights compressed/overlapped the bottom rows, which
  // was the "broken layout" users saw on smaller screens.
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
        className="flex-1 grid grid-cols-7"
        style={{ gridTemplateRows: `repeat(${numRows}, minmax(120px, 1fr))` }}
      >
        {allDays.map((date, idx) => {
          const isInPeriod = date >= periodStart && date <= periodEnd;
          const isLastCol = (idx + 1) % 7 === 0;
          const isLastRow = idx >= allDays.length - 7;

          // Out-of-month slots are rendered as blank spacers so the grid
          // keeps its 7-column alignment without the dimmed prev/next-month
          // dates that read as "disabled".
          if (!isInPeriod) {
            return (
              <div
                key={idx}
                aria-hidden
                className={cn(
                  "bg-muted/20 border-border",
                  !isLastCol && "border-r",
                  !isLastRow && "border-b",
                )}
              />
            );
          }

          const dayAbsences = getAbsencesForDay(absences, date);
          const dayHolidays = getHolidaysForDay(holidays, date);
          const dayLeaves = getLeavesForDay(leaves, date);
          const dayBirthdays = getBirthdaysForDay(birthdayUsers, date);
          const dayEvents = getEventsForDay(agendaEvents, date);
          const dayCommemoratives = showCommemoratives
            ? getCommemorativesForDayDeduped(date, dayHolidays)
            : [];
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
                    "bg-background p-2 relative overflow-hidden transition-colors duration-150 border-border text-left flex flex-col items-stretch justify-start gap-1.5",
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

                  {/* Events list fills remaining cell height and scrolls when
                      it overflows. `overscroll-contain` keeps wheel scrolls
                      inside the cell so they don't bubble out to the page. */}
                  <div
                    className="mt-1.5 space-y-1 flex-1 min-h-0 overflow-y-auto overscroll-contain pr-1 [&::-webkit-scrollbar]:w-1 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-border [&::-webkit-scrollbar-thumb]:rounded-full"
                    onWheel={(e) => e.stopPropagation()}
                  >
                    {/* Holidays — cyan. Matches "Feriados úteis" tile. */}
                    {dayHolidays.slice(0, 1).map((h, i) => (
                      <div
                        key={`h${i}`}
                        className={cn(
                          "text-[10px] px-1.5 py-0.5 rounded-sm truncate font-medium flex items-center gap-1",
                          HOLIDAY_BAR_CLASS,
                        )}
                      >
                        <IconConfetti className="h-3 w-3 flex-shrink-0" strokeWidth={2.5} />
                        <span className="truncate">{h.Descricao || h.descricao || "Feriado"}</span>
                      </div>
                    ))}
                    {/* Commemorative dates — fuchsia. Always visible (incl. weekends/holidays). */}
                    {dayCommemoratives.map((c, i) => (
                      <div
                        key={`cm${i}`}
                        className={cn(
                          "text-[10px] px-1.5 py-0.5 rounded-sm truncate font-medium flex items-center gap-1",
                          COMMEMORATIVE_BAR_CLASS,
                        )}
                        title={c.name}
                      >
                        <IconStar className="h-3 w-3 flex-shrink-0" strokeWidth={2.5} />
                        <span className="truncate">{c.name}</span>
                      </div>
                    ))}
                    {/* Agenda events — indigo. Always visible (incl. weekends/holidays). */}
                    {dayEvents.map((ev) => (
                      <div
                        key={`e${ev.id}`}
                        className={cn(
                          "text-[10px] px-1.5 py-0.5 rounded-sm truncate font-medium flex items-center gap-1",
                          EVENT_BAR_CLASS,
                        )}
                        title={ev.title}
                      >
                        <IconCalendarEvent className="h-3 w-3 flex-shrink-0" strokeWidth={2.5} />
                        <span className="truncate">{ev.title}</span>
                      </div>
                    ))}
                    {/* Birthdays — pink. Always visible (incl. weekends/holidays). */}
                    {dayBirthdays.map((u) => (
                      <div
                        key={`b${u.id}`}
                        className={cn(
                          "text-[10px] px-1.5 py-0.5 rounded-sm truncate font-medium flex items-center gap-1",
                          BIRTHDAY_BAR_CLASS,
                        )}
                        title={`Aniversário de ${u.name}`}
                      >
                        <IconCake className="h-3 w-3 flex-shrink-0" strokeWidth={2.5} />
                        <span className="truncate">{shortName(u.name)}</span>
                      </div>
                    ))}
                    {/* Leaves (afastamentos) — orange. Workdays only, same
                        noise rule as the absence bars. */}
                    {!isWeekend && dayHolidays.length === 0 &&
                      dayLeaves.map((l) => (
                        <div
                          key={`l${l.id}`}
                          className={cn(
                            "text-[10px] px-1.5 py-0.5 rounded-sm truncate font-medium flex items-center gap-1",
                            LEAVE_BAR_CLASS,
                          )}
                          title={`${l.user?.name ?? "Colaborador"} · ${getLeaveTypeLabel(l)}`}
                        >
                          <IconStethoscope className="h-3 w-3 flex-shrink-0" strokeWidth={2.5} />
                          <span className="truncate">{shortName(l.user?.name ?? "Colaborador")} · {getLeaveTypeLabel(l)}</span>
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
                      return (
                        <>
                          {items.map((it, i) => {
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
                            const BarIcon = barCat ? CATEGORY_BAR_ICONS[barCat] : null;
                            return (
                              <div
                                key={`a${i}`}
                                className={cn(
                                  "text-[10px] px-1.5 py-0.5 rounded-sm truncate font-medium flex items-center gap-1",
                                  cls,
                                )}
                                title={`${a.userName} · ${meta?.label ?? a.JustificativaDescricao}`}
                              >
                                {BarIcon && <BarIcon className="h-3 w-3 flex-shrink-0" strokeWidth={2.5} />}
                                <span className="truncate">{shortName(a.userName)} · {meta?.label ?? a.JustificativaDescricao}</span>
                              </div>
                            );
                          })}
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
  leaves,
  birthdayUsers,
  agendaEvents,
  showCommemoratives,
  onEditEvent,
  onDeleteEvent,
  onClose,
}: {
  selectedDay: Date | null;
  absences: SecullumAggregatedAbsence[];
  holidays: any[];
  leaves: Leave[];
  birthdayUsers: User[];
  agendaEvents: AgendaEvent[];
  showCommemoratives: boolean;
  onEditEvent: (event: AgendaEvent) => void;
  onDeleteEvent: (event: AgendaEvent) => void;
  onClose: () => void;
}) {
  const dayAbsences = selectedDay ? getAbsencesForDay(absences, selectedDay) : [];
  const dayHolidays = selectedDay ? getHolidaysForDay(holidays, selectedDay) : [];
  const dayLeaves = selectedDay ? getLeavesForDay(leaves, selectedDay) : [];
  const dayBirthdays = selectedDay ? getBirthdaysForDay(birthdayUsers, selectedDay) : [];
  const dayEvents = selectedDay ? getEventsForDay(agendaEvents, selectedDay) : [];
  const dayCommemoratives =
    selectedDay && showCommemoratives
      ? getCommemorativesForDayDeduped(selectedDay, dayHolidays)
      : [];
  const isWeekend =
    !!selectedDay && (selectedDay.getDay() === 0 || selectedDay.getDay() === 6);

  // Bucket absences exactly like the cell bars: ≥3 collaborators sharing a
  // [GRP:uuid] tag (or implicit JustId+period) collapse into a "coletiva"
  // card; everyone else is rendered as an individual card.
  const buckets = selectedDay && !isWeekend && dayHolidays.length === 0
    ? bucketDayAbsences(dayAbsences)
    : { collectives: [], individuals: [] as SecullumAggregatedAbsence[] };

  const totalCards =
    dayHolidays.length +
    buckets.collectives.length +
    buckets.individuals.length +
    dayLeaves.length +
    dayBirthdays.length +
    dayEvents.length +
    dayCommemoratives.length;
  const showWeekendNote = !!selectedDay && isWeekend && totalCards === 0;
  const showWorkdayNote = !!selectedDay && !isWeekend && totalCards === 0;

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
        {selectedDay && dayCommemoratives.map((c, i) => (
          <CommemorativeCard key={`cm${i}`} commemorative={c} />
        ))}
        {selectedDay && dayEvents.map((ev) => (
          <EventCard key={ev.id} event={ev} onEdit={onEditEvent} onDelete={onDeleteEvent} />
        ))}
        {selectedDay && dayBirthdays.map((u) => (
          <BirthdayCard key={u.id} user={u} referenceDate={selectedDay} />
        ))}
        {selectedDay && dayLeaves.map((l) => (
          <LeaveCard key={l.id} leave={l} />
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
  category: BarCategory | "HOLIDAY" | "LEAVE" | "BIRTHDAY" | "EVENT" | "COMMEMORATIVE";
  label: string;
}) {
  const tone = {
    AUSENCIA: "bg-purple-600 text-white",
    FALTA_JUSTIFIED: "bg-amber-600 text-white",
    FALTA_UNJUSTIFIED: "bg-red-700 text-white",
    HOLIDAY: "bg-cyan-600 text-white",
    LEAVE: "bg-orange-600 text-white",
    BIRTHDAY: "bg-pink-600 text-white",
    EVENT: "bg-indigo-600 text-white",
    COMMEMORATIVE: "bg-fuchsia-600 text-white",
  }[category];
  const Icon =
    category === "AUSENCIA"
      ? IconBeach
      : category === "FALTA_JUSTIFIED"
        ? IconUserOff
        : category === "FALTA_UNJUSTIFIED"
          ? IconUserExclamation
          : category === "LEAVE"
            ? IconStethoscope
            : category === "BIRTHDAY"
              ? IconCake
              : category === "EVENT"
                ? IconCalendarEvent
                : category === "COMMEMORATIVE"
                  ? IconStar
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

function CommemorativeCard({ commemorative }: { commemorative: CommemorativeDate }) {
  return (
    <div className="rounded-md border border-border bg-background px-2.5 py-2">
      <CategoryBadge
        category="COMMEMORATIVE"
        label={commemorative.isCompanyAnniversary ? "Empresa" : "Comemorativa"}
      />
      <div className="mt-1 text-sm font-semibold truncate">{commemorative.name}</div>
    </div>
  );
}

function EventCard({
  event,
  onEdit,
  onDelete,
}: {
  event: AgendaEvent;
  onEdit: (event: AgendaEvent) => void;
  onDelete: (event: AgendaEvent) => void;
}) {
  // Codificação de notifyDaysBefore: N > 0 = N dias antes; 0 = no dia
  // (notifyOnDay legado também conta); -1 = aviso de atraso (1 dia após).
  const reminders: string[] = [];
  const allReminders = event.notifyDaysBefore ?? [];
  const beforeDays = allReminders.filter((d) => d > 0).sort((a, b) => b - a);
  if (beforeDays.length > 0) {
    reminders.push(`D-${beforeDays.join(", D-")}`);
  }
  if (event.notifyOnDay || allReminders.includes(0)) reminders.push("no dia");
  if (allReminders.includes(-1)) reminders.push("atraso (1 dia após)");
  return (
    <div className="rounded-md border border-border bg-background px-2.5 py-2 space-y-1">
      <div className="flex items-start justify-between gap-2">
        <CategoryBadge category="EVENT" label="Evento" />
        <div className="flex items-center gap-0.5">
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6"
            title="Editar evento"
            onClick={() => onEdit(event)}
          >
            <IconPencil className="h-3.5 w-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6 text-destructive hover:text-destructive"
            title="Excluir evento"
            onClick={() => onDelete(event)}
          >
            <IconTrash className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>
      <div className="text-sm font-semibold">{event.title}</div>
      {event.description && (
        <div className="text-xs text-muted-foreground whitespace-pre-wrap">{event.description}</div>
      )}
      {reminders.length > 0 && (
        <div className="text-[11px] text-muted-foreground/80">
          Lembretes: {reminders.join(" · ")}
        </div>
      )}
      {event.createdBy?.name && (
        <div className="text-[11px] text-muted-foreground/80 truncate">
          Criado por {event.createdBy.name}
        </div>
      )}
    </div>
  );
}

function BirthdayCard({ user, referenceDate }: { user: User; referenceDate: Date }) {
  const birth = user.birth ? new Date(user.birth) : null;
  const age = birth ? referenceDate.getFullYear() - birth.getFullYear() : null;
  return (
    <div className="rounded-md border border-border bg-background px-2.5 py-2 space-y-1">
      <CategoryBadge category="BIRTHDAY" label="Aniversário" />
      <div className="text-sm font-semibold truncate">{user.name}</div>
      {age !== null && age > 0 && (
        <div className="text-xs text-muted-foreground">Completa {age} anos</div>
      )}
      {(user as any).sector?.name && (
        <div className="text-[11px] text-muted-foreground/80 truncate">
          {(user as any).sector.name}
        </div>
      )}
    </div>
  );
}

function LeaveCard({ leave }: { leave: Leave }) {
  const start = toLocalDay(new Date(leave.startDate));
  const end = leave.actualEndDate
    ? toLocalDay(new Date(leave.actualEndDate))
    : leave.expectedEndDate
      ? toLocalDay(new Date(leave.expectedEndDate))
      : null;
  return (
    <div className="rounded-md border border-border bg-background px-2.5 py-2 space-y-1">
      <CategoryBadge category="LEAVE" label="Afastamento" />
      <div className="text-sm font-semibold truncate">{leave.user?.name ?? "Colaborador"}</div>
      <div className="text-xs text-muted-foreground truncate">{getLeaveTypeLabel(leave)}</div>
      <div className="text-[11px] text-muted-foreground/80">
        {format(start, "dd/MM/yyyy")}
        {end ? ` a ${format(end, "dd/MM/yyyy")}` : " — sem data de retorno"}
      </div>
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
      ? "Férias Coletiva"
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
  leaves,
  birthdayUsers,
  agendaEvents,
  showCommemoratives,
  onMonthClick,
}: {
  year: number;
  absences: SecullumAggregatedAbsence[];
  holidays: any[];
  leaves: Leave[];
  birthdayUsers: User[];
  agendaEvents: AgendaEvent[];
  showCommemoratives: boolean;
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
            leaves={leaves}
            birthdayUsers={birthdayUsers}
            agendaEvents={agendaEvents}
            showCommemoratives={showCommemoratives}
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
  leaves,
  birthdayUsers,
  agendaEvents,
  showCommemoratives,
  onClick,
}: {
  monthDate: Date;
  absences: SecullumAggregatedAbsence[];
  holidays: any[];
  leaves: Leave[];
  birthdayUsers: User[];
  agendaEvents: AgendaEvent[];
  showCommemoratives: boolean;
  onClick: () => void;
}) {
  // Each mini-month renders the standard calendar month so the year overview
  // matches what the user sees when they click in to the month view.
  const { start: periodStart, end: periodEnd } = getMonthPeriod(monthDate);
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
  let leaveDays = 0;
  let birthdayDays = 0;
  let eventDays = 0;
  let commemorativeDays = 0;
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
  // Overlay categories (afastamentos, aniversários, eventos, comemorativas) are
  // tallied per-day mirroring the mini-day dot logic below: afastamentos only
  // count on work days (no weekends/holidays), while aniversários/eventos/
  // comemorativas always count. This keeps the header chips in sync with the
  // dots so a month with only these categories no longer reads "sem registros".
  for (const date of naturalDays) {
    if (date < periodStart || date > periodEnd) continue;
    const dow = date.getDay();
    const isWeekend = dow === 0 || dow === 6;
    const dayHolidays = getHolidaysForDay(holidays, date);
    const isWorkDay = !isWeekend && dayHolidays.length === 0;
    if (isWorkDay && getLeavesForDay(leaves, date).length > 0) leaveDays++;
    if (getBirthdaysForDay(birthdayUsers, date).length > 0) birthdayDays++;
    if (getEventsForDay(agendaEvents, date).length > 0) eventDays++;
    if (
      showCommemoratives &&
      getCommemorativesForDayDeduped(date, dayHolidays).length > 0
    )
      commemorativeDays++;
  }
  const totalEvents =
    vacationDays +
    justifiedFaltaDays +
    unjustifiedFaltaDays +
    holidayDays +
    leaveDays +
    birthdayDays +
    eventDays +
    commemorativeDays;

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "group text-left rounded-xl border border-border bg-card overflow-hidden transition-colors hover:border-primary/50 focus:outline-none focus:ring-2 focus:ring-primary/50 focus:ring-offset-2 focus:ring-offset-background",
      )}
    >
      {/* Header band — neutral bg, no per-month tint. Month name and the count
          badges share one row; the badges wrap (right-aligned) only if a busy
          month can't fit them all, so they never collide with the title. */}
      <div className="px-4 py-2.5 border-b border-border bg-card flex items-center justify-between gap-2">
        <h3 className="text-base font-bold capitalize text-foreground group-hover:text-primary transition-colors flex-shrink-0">
          {format(monthDate, "MMMM", { locale: ptBR })}
        </h3>
        <div className="flex flex-wrap items-center justify-end gap-x-2 gap-y-1 text-xs font-semibold tabular-nums">
          {totalEvents === 0 ? (
            <span className="text-muted-foreground/60 text-[11px]">sem registros</span>
          ) : (
            <>
              {vacationDays > 0 && (
                <span className="inline-flex items-center gap-1 text-purple-600 dark:text-purple-400">
                  <IconBeach className="h-4 w-4" strokeWidth={2.5} />
                  {vacationDays}
                </span>
              )}
              {justifiedFaltaDays > 0 && (
                <span className="inline-flex items-center gap-1 text-amber-600 dark:text-amber-400">
                  <IconUserOff className="h-4 w-4" strokeWidth={2.5} />
                  {justifiedFaltaDays}
                </span>
              )}
              {unjustifiedFaltaDays > 0 && (
                <span className="inline-flex items-center gap-1 text-red-700 dark:text-red-300">
                  <IconUserExclamation className="h-4 w-4" strokeWidth={2.5} />
                  {unjustifiedFaltaDays}
                </span>
              )}
              {holidayDays > 0 && (
                <span className="inline-flex items-center gap-1 text-cyan-600 dark:text-cyan-400">
                  <IconConfetti className="h-4 w-4" strokeWidth={2.5} />
                  {holidayDays}
                </span>
              )}
              {leaveDays > 0 && (
                <span className="inline-flex items-center gap-1 text-orange-600 dark:text-orange-400">
                  <IconStethoscope className="h-4 w-4" strokeWidth={2.5} />
                  {leaveDays}
                </span>
              )}
              {birthdayDays > 0 && (
                <span className="inline-flex items-center gap-1 text-pink-600 dark:text-pink-400">
                  <IconCake className="h-4 w-4" strokeWidth={2.5} />
                  {birthdayDays}
                </span>
              )}
              {eventDays > 0 && (
                <span className="inline-flex items-center gap-1 text-indigo-600 dark:text-indigo-400">
                  <IconCalendarEvent className="h-4 w-4" strokeWidth={2.5} />
                  {eventDays}
                </span>
              )}
              {commemorativeDays > 0 && (
                <span className="inline-flex items-center gap-1 text-fuchsia-600 dark:text-fuchsia-400">
                  <IconStar className="h-4 w-4" strokeWidth={2.5} />
                  {commemorativeDays}
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
            const dayLeaves = getLeavesForDay(leaves, date);
            const dayBirthdays = getBirthdaysForDay(birthdayUsers, date);
            const dayEvents = getEventsForDay(agendaEvents, date);
            const dayCommemoratives = showCommemoratives
              ? getCommemorativesForDayDeduped(date, dayHolidays)
              : [];
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

            // Compact per-category indicators — one small icon per category
            // present that day, matching the header badge glyphs / month-view
            // bars exactly. Absence-style categories (férias, faltas,
            // afastamento) only count on work days (no weekends/holidays — same
            // noise rule the month view applies); holidays, comemorativas,
            // aniversários and eventos always show.
            const isWorkDay = !isWeekend && dayHolidays.length === 0;
            const indicators: Array<{ key: string; Icon: any; cls: string }> = [];
            if (dayHolidays.length > 0) indicators.push({ key: "holiday", Icon: IconConfetti, cls: "text-cyan-600 dark:text-cyan-400" });
            if (dayCommemoratives.length > 0) indicators.push({ key: "commem", Icon: IconStar, cls: "text-fuchsia-600 dark:text-fuchsia-400" });
            if (dayEvents.length > 0) indicators.push({ key: "event", Icon: IconCalendarEvent, cls: "text-indigo-600 dark:text-indigo-400" });
            if (dayBirthdays.length > 0) indicators.push({ key: "birthday", Icon: IconCake, cls: "text-pink-600 dark:text-pink-400" });
            if (isWorkDay && dayLeaves.length > 0) indicators.push({ key: "leave", Icon: IconStethoscope, cls: "text-orange-600 dark:text-orange-400" });
            if (isWorkDay && ausencias > 0) indicators.push({ key: "ausencia", Icon: IconBeach, cls: "text-purple-600 dark:text-purple-400" });
            if (isWorkDay && justifiedFaltas > 0) indicators.push({ key: "jfalta", Icon: IconUserOff, cls: "text-amber-600 dark:text-amber-400" });
            if (isWorkDay && unjustifiedFaltas > 0) indicators.push({ key: "ufalta", Icon: IconUserExclamation, cls: "text-red-700 dark:text-red-300" });

            const cellNode = (
              <div
                className={cn(
                  "relative aspect-square flex flex-col items-center justify-center text-[13px] font-medium tabular-nums transition-colors border-border",
                  !isLastCol && "border-r",
                  !isLastRow && "border-b",
                  isWeekend && !isToday && "bg-blue-50/40 dark:bg-blue-950/20 text-blue-600/80 dark:text-blue-400/80",
                  !isWeekend && !isToday && "text-foreground hover:bg-accent/30",
                  isToday && "ring-2 ring-primary ring-inset font-bold text-primary",
                )}
              >
                <span className="leading-none">{format(date, "d")}</span>
                {indicators.length > 0 && (
                  <div className="mt-0.5 flex items-center justify-center gap-[2px] flex-wrap max-w-full px-0.5">
                    {indicators.map(({ key, Icon, cls }) => (
                      <Icon
                        key={key}
                        className={cn("h-3.5 w-3.5 flex-shrink-0", cls)}
                        strokeWidth={2.5}
                      />
                    ))}
                  </div>
                )}
              </div>
            );

            // Tooltip only when there's something to show; else just render
            // the cell to keep the year-view grid lightweight (12 × 42 cells).
            const hasContent =
              dayAbsences.length > 0 ||
              dayHolidays.length > 0 ||
              dayLeaves.length > 0 ||
              dayBirthdays.length > 0 ||
              dayEvents.length > 0 ||
              dayCommemoratives.length > 0;
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
                    absences={isWorkDay ? dayAbsences : []}
                    holidays={dayHolidays}
                    leaves={isWorkDay ? dayLeaves : []}
                    birthdays={dayBirthdays}
                    events={dayEvents}
                    commemoratives={dayCommemoratives}
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
// sharing the same group key) and leftover individual records. Only Férias
// (JustificativaId 2) collapses into coletivas — every other type (faltas,
// dispensas, treinamentos, etc.) renders as individual rows even when many
// employees share the same date range. Group key is either the explicit
// [GRP:uuid] prefix or the implicit (JustificativaId + Inicio + Fim) tuple.
function bucketDayAbsences(
  dayAbsences: SecullumAggregatedAbsence[],
): { collectives: CollectiveBucket[]; individuals: SecullumAggregatedAbsence[] } {
  const buckets = new Map<string, SecullumAggregatedAbsence[]>();
  const individuals: SecullumAggregatedAbsence[] = [];
  for (const a of dayAbsences) {
    const barCat = getBarCategory(a);
    if (!barCat || a.JustificativaId !== VACATION_JUSTIFICATIVA_ID) {
      individuals.push(a);
      continue;
    }
    const explicit = getExplicitCollectiveKey(a);
    const inicio = String(a.Inicio).substring(0, 10);
    const fim = String(a.Fim).substring(0, 10);
    const key = explicit
      ? `grp:${explicit}`
      : `imp:${a.JustificativaId}:${inicio}:${fim}`;
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

// Pretty label for a collective bar. Only Férias (JustificativaId 2) is ever
// bucketed today, so this always returns "Férias Coletivas" — the fallback
// stays as a defensive default in case the bucketing rule is widened later.
function getCollectiveLabel(bucket: CollectiveBucket): string {
  if (bucket.justificativaId === VACATION_JUSTIFICATIVA_ID) return "Férias Coletivas";
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

// Normalizes any Date to local midnight for day-level comparisons.
function toLocalDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

// Leave day bounds: start = startDate; end = actualEndDate ?? expectedEndDate.
// Open-ended leaves (no end at all) run "forever" so they paint every day
// from the start onward — matches how an active afastamento really behaves.
function getLeaveBounds(leave: Leave): { start: Date; end: Date } {
  const start = toLocalDay(new Date(leave.startDate));
  const rawEnd = leave.actualEndDate ?? leave.expectedEndDate;
  const end = rawEnd ? toLocalDay(new Date(rawEnd)) : new Date(9999, 0, 1);
  return { start, end };
}

function getLeavesForDay(leaves: Leave[], date: Date): Leave[] {
  const day = toLocalDay(date);
  return leaves.filter((l) => {
    const { start, end } = getLeaveBounds(l);
    return day >= start && day <= end;
  });
}

// Birthdays recur yearly by day/month. Feb 29 birthdays celebrate on Feb 28
// in non-leap years.
function getBirthdaysForDay(users: User[], date: Date): User[] {
  const month = date.getMonth();
  const day = date.getDate();
  const year = date.getFullYear();
  const isLeap = (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
  const matchesFeb29 = month === 1 && day === 28 && !isLeap;
  return users.filter((u) => {
    if (!u.birth) return false;
    const b = new Date(u.birth);
    if (b.getMonth() === month && b.getDate() === day) return true;
    if (matchesFeb29 && b.getMonth() === 1 && b.getDate() === 29) return true;
    return false;
  });
}

function getEventsForDay(events: AgendaEvent[], date: Date): AgendaEvent[] {
  return events.filter((e) => isSameDay(toLocalDay(new Date(e.eventDate)), date));
}

function getLeaveTypeLabel(leave: Leave): string {
  return LEAVE_TYPE_LABELS[leave.type as LEAVE_TYPE] ?? "Afastamento";
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

// Extracts the human-readable description from a Secullum holiday record.
function getHolidayName(h: any): string {
  return String(h?.Descricao || h?.descricao || "").trim();
}

// Commemoratives for a day, MINUS any that duplicate an official Secullum
// holiday on the same day (the feriado bar wins — see dedupeAgainstHolidays).
// Single source of truth so the cell grid, the day-detail panel and the
// summary stat all suppress the same duplicates (e.g. Corpus Christi).
function getCommemorativesForDayDeduped(
  date: Date,
  dayHolidays: any[],
): CommemorativeDate[] {
  const commemoratives = getCommemorativesForDay(date);
  if (commemoratives.length === 0 || dayHolidays.length === 0) return commemoratives;
  return dedupeAgainstHolidays(commemoratives, dayHolidays.map(getHolidayName));
}

function DayTooltip({
  date,
  absences,
  holidays,
  leaves = [],
  birthdays = [],
  events = [],
  commemoratives = [],
  isWeekend,
  isInPeriod,
}: {
  date: Date;
  absences: SecullumAggregatedAbsence[];
  holidays: any[];
  leaves?: Leave[];
  birthdays?: User[];
  events?: AgendaEvent[];
  commemoratives?: CommemorativeDate[];
  isWeekend: boolean;
  isInPeriod: boolean;
}) {
  const hasAnything =
    holidays.length > 0 ||
    absences.length > 0 ||
    leaves.length > 0 ||
    birthdays.length > 0 ||
    events.length > 0 ||
    commemoratives.length > 0;
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
          <span className="font-medium text-cyan-600 dark:text-cyan-400">Feriado:</span>{" "}
          {holidays.map((h: any) => h.Descricao || h.descricao).join(", ")}
        </div>
      )}
      {commemoratives.length > 0 && (
        <ul className="space-y-0.5">
          {commemoratives.map((c, i) => (
            <li key={`cm${i}`} className="text-xs flex items-center gap-2 whitespace-nowrap">
              <span className="inline-block h-2 w-2 rounded-full flex-shrink-0 bg-fuchsia-600" />
              <span className="font-medium">{c.name}</span>
            </li>
          ))}
        </ul>
      )}
      {events.length > 0 && (
        <ul className="space-y-0.5">
          {events.map((ev) => (
            <li key={`e${ev.id}`} className="text-xs flex items-center gap-2 whitespace-nowrap">
              <span className="inline-block h-2 w-2 rounded-full flex-shrink-0 bg-indigo-600" />
              <span className="font-medium">{ev.title}</span>
            </li>
          ))}
        </ul>
      )}
      {birthdays.length > 0 && (
        <ul className="space-y-0.5">
          {birthdays.map((u) => (
            <li key={`b${u.id}`} className="text-xs flex items-center gap-2 whitespace-nowrap">
              <span className="inline-block h-2 w-2 rounded-full flex-shrink-0 bg-pink-600" />
              <span className="font-medium">{u.name}</span>
              <span className="text-muted-foreground">— Aniversário</span>
            </li>
          ))}
        </ul>
      )}
      {leaves.length > 0 && (
        <ul className="space-y-0.5">
          {leaves.map((l) => (
            <li key={`l${l.id}`} className="text-xs flex items-center gap-2 whitespace-nowrap">
              <span className="inline-block h-2 w-2 rounded-full flex-shrink-0 bg-orange-600" />
              <span className="font-medium">{l.user?.name ?? "Colaborador"}</span>
              <span className="text-muted-foreground">— {getLeaveTypeLabel(l)}</span>
            </li>
          ))}
        </ul>
      )}
      {!holidays.length && isWeekend && (
        <p className="text-xs text-muted-foreground">Fim de semana</p>
      )}
      {!hasAnything && !isWeekend && isInPeriod && (
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
