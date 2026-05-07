import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { format, addMonths, subMonths, eachDayOfInterval } from "date-fns";
import { ptBR } from "date-fns/locale";
import { IconCalendar, IconChevronLeft, IconChevronRight } from "@tabler/icons-react";

import type { SecullumJustificativaCategory } from "../../../../constants";
import type { SecullumAggregatedAbsence } from "../../../../types";
import {
  AUSENCIA_JUSTIFICATIVA_IDS,
  FALTA_JUSTIFICATIVA_IDS,
  SECULLUM_JUSTIFICATIVAS,
  USER_STATUS,
  getJustificativaCategory,
} from "../../../../constants";
import {
  useSecullumAggregatedAbsences,
  useSecullumUnjustifiedAbsences,
  useSectors,
  useUsers,
} from "../../../../hooks";

import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Combobox } from "@/components/ui/combobox";
import type { ComboboxOption } from "@/components/ui/combobox";
import { DateTimeInput } from "@/components/ui/date-time-input";

import { AbsenceTable } from "./absence-table";
import { AbsenceFormDialog } from "../form/absence-form-dialog";

interface AbsenceListProps {
  category: SecullumJustificativaCategory;
  className?: string;
}

const ALL_USERS = "__ALL__";

const parseLocalDate = (str: string | null): Date | null => {
  if (!str) return null;
  const parts = str.split("-");
  if (parts.length !== 3) return null;
  const d = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
  return isNaN(d.getTime()) ? null : d;
};

// Brazilian payroll period: day 26 of previous month → day 25 of selected month.
// Mirrors the controle-de-ponto convention so the same calendar mental model applies.
const getPayrollPeriod = (month: Date) => {
  const start = new Date(month.getFullYear(), month.getMonth() - 1, 26);
  const end = new Date(month.getFullYear(), month.getMonth(), 25);
  return { start, end };
};

// Resolve the payroll period that contains a given anchor date. Day 25 or
// earlier → period ending in anchor's month; day 26 or later → period ending
// next month.
const periodContaining = (anchor: Date) => {
  const refMonth =
    anchor.getDate() >= 26
      ? new Date(anchor.getFullYear(), anchor.getMonth() + 1, 1)
      : new Date(anchor.getFullYear(), anchor.getMonth(), 1);
  return { refMonth, ...getPayrollPeriod(refMonth) };
};

// Default to the payroll period that contains today.
const defaultPeriod = () => periodContaining(new Date());

export function AbsenceList({ category, className }: AbsenceListProps) {
  const [searchParams, setSearchParams] = useSearchParams();

  // If the URL provides only one of startDate/endDate, derive the matching
  // companion from the payroll period that contains the present date —
  // otherwise the missing side falls back to today's default and produces an
  // inverted range (e.g. start=2026-04-26, end=2026-04-25 → no data).
  const initial = useMemo(() => {
    const urlStart = parseLocalDate(searchParams.get("startDate"));
    const urlEnd = parseLocalDate(searchParams.get("endDate"));
    if (urlStart && urlEnd) {
      return {
        start: urlStart,
        end: urlEnd,
        refMonth: new Date(urlEnd.getFullYear(), urlEnd.getMonth(), 1),
      };
    }
    const anchor = urlEnd ?? urlStart;
    if (anchor) return periodContaining(anchor);
    return defaultPeriod();
  }, []);
  const [startDate, setStartDate] = useState<Date>(() => initial.start);
  const [endDate, setEndDate] = useState<Date>(() => initial.end);
  const [selectedMonth, setSelectedMonth] = useState<Date>(() => initial.refMonth);
  const [selectedUserId, setSelectedUserId] = useState<string>(() => searchParams.get("userId") || ALL_USERS);
  const [selectedSectorId, setSelectedSectorId] = useState<string>(() => searchParams.get("sectorId") || "");
  const [selectedJustificativaId, setSelectedJustificativaId] = useState<number | undefined>(() => {
    const v = searchParams.get("justificativaId");
    return v ? Number(v) : undefined;
  });
  const [editing, setEditing] = useState<SecullumAggregatedAbsence | null>(null);

  const { data: usersData, isLoading: usersLoading } = useUsers({
    statuses: [USER_STATUS.EXPERIENCE_PERIOD_1, USER_STATUS.EXPERIENCE_PERIOD_2, USER_STATUS.EFFECTED],
    where: { secullumEmployeeId: { not: null } },
    orderBy: { name: "asc" },
    take: 100,
  } as any);
  const { data: sectorsData } = useSectors({ orderBy: { name: "asc" }, take: 100 } as any);

  const userOptions = useMemo<ComboboxOption[]>(() => {
    const arr = usersData?.data ?? [];
    return [
      { value: ALL_USERS, label: "Todos os colaboradores" },
      ...arr.map((u: any) => ({ value: u.id, label: u.name })),
    ];
  }, [usersData]);

  const sectorOptions = useMemo<ComboboxOption[]>(() => {
    const arr = sectorsData?.data ?? [];
    return arr.map((s: any) => ({ value: s.id, label: s.name }));
  }, [sectorsData]);

  const allowedJustificativaIds = category === "AUSENCIA" ? AUSENCIA_JUSTIFICATIVA_IDS : FALTA_JUSTIFICATIVA_IDS;
  const justificativaOptions = useMemo<ComboboxOption[]>(() => {
    return allowedJustificativaIds.map((id) => ({
      value: String(id),
      label: SECULLUM_JUSTIFICATIVAS[id]?.label ?? `#${id}`,
    }));
  }, [allowedJustificativaIds]);

  const aggregatedParams = useMemo(
    () => ({
      startDate: format(startDate, "yyyy-MM-dd"),
      endDate: format(endDate, "yyyy-MM-dd"),
      sectorId: selectedSectorId || undefined,
    }),
    [startDate, endDate, selectedSectorId],
  );

  const { data, isLoading } = useSecullumAggregatedAbsences(aggregatedParams);
  // Unjustified absences (Cálculos de Ponto) only relevant for Faltas page —
  // they belong to FALTA category by definition. Skip the heavier fetch on
  // Ausências.
  const { data: unjustifiedData, isLoading: unjustifiedLoading } = useSecullumUnjustifiedAbsences(
    aggregatedParams,
    { enabled: category === "FALTA" },
  );

  // Faltas use per-day rows (each work day José missed = one row); Ausências
  // keep range rows (one row per record showing Início/Fim).
  const expandToDays = category === "FALTA";

  // Work days in the visible period (for per-day expansion on Faltas).
  const workDaysInPeriod = useMemo(() => {
    const days = eachDayOfInterval({ start: startDate, end: endDate });
    return days.filter((d) => d.getDay() !== 0 && d.getDay() !== 6);
  }, [startDate, endDate]);

  const records = useMemo<SecullumAggregatedAbsence[]>(() => {
    const unwrap = (d: any): SecullumAggregatedAbsence[] => {
      const root: any = d?.data;
      if (Array.isArray(root)) return root;
      if (root && Array.isArray(root.data)) return root.data;
      return [];
    };
    const justified = unwrap(data);
    const unjustified = category === "FALTA" ? unwrap(unjustifiedData) : [];
    return [...justified, ...unjustified].filter((a) => {
      if (getJustificativaCategory(a.JustificativaId) !== category) return false;
      if (selectedJustificativaId && a.JustificativaId !== selectedJustificativaId) return false;
      if (selectedUserId !== ALL_USERS && a.userId !== selectedUserId) return false;
      return true;
    });
  }, [data, unjustifiedData, category, selectedJustificativaId, selectedUserId]);

  // Per-day expanded rows for Faltas. Each absence × each overlapping work day
  // produces one row, so a 91-day atestado becomes ~60+ rows in the period.
  const dayRows = useMemo(() => {
    if (!expandToDays) return [];
    const rows: Array<SecullumAggregatedAbsence & { dayDate: Date }> = [];
    for (const a of records) {
      const start = new Date(a.Inicio);
      const end = new Date(a.Fim);
      const startD = new Date(start.getFullYear(), start.getMonth(), start.getDate());
      const endD = new Date(end.getFullYear(), end.getMonth(), end.getDate());
      for (const d of workDaysInPeriod) {
        if (d >= startD && d <= endD) rows.push({ ...a, dayDate: d });
      }
    }
    rows.sort((a, b) => {
      const t = a.dayDate.getTime() - b.dayDate.getTime();
      if (t !== 0) return t;
      return a.userName.localeCompare(b.userName, "pt-BR");
    });
    return rows;
  }, [expandToDays, records, workDaysInPeriod]);

  const updateParam = (key: string, value: string | null) => {
    const params = new URLSearchParams(searchParams);
    if (value) params.set(key, value);
    else params.delete(key);
    setSearchParams(params, { replace: true });
  };

  const handleStartDateChange = (date: Date | null | any) => {
    if (!date || !(date instanceof Date) || isNaN(date.getTime())) return;
    const next = endDate < date ? date : endDate;
    setStartDate(date);
    if (next !== endDate) setEndDate(next);
    updateParam("startDate", format(date, "yyyy-MM-dd"));
    if (next !== endDate) updateParam("endDate", format(next, "yyyy-MM-dd"));
  };

  const handleEndDateChange = (date: Date | null | any) => {
    if (!date || !(date instanceof Date) || isNaN(date.getTime())) return;
    const prev = startDate > date ? date : startDate;
    setEndDate(date);
    if (prev !== startDate) setStartDate(prev);
    updateParam("endDate", format(date, "yyyy-MM-dd"));
    if (prev !== startDate) updateParam("startDate", format(prev, "yyyy-MM-dd"));
  };

  const handleMonthChange = (month: Date) => {
    const { start, end } = getPayrollPeriod(month);
    setSelectedMonth(month);
    setStartDate(start);
    setEndDate(end);
    updateParam("startDate", format(start, "yyyy-MM-dd"));
    updateParam("endDate", format(end, "yyyy-MM-dd"));
  };

  const handleUserChange = (userId: string) => {
    setSelectedUserId(userId || ALL_USERS);
    updateParam("userId", userId === ALL_USERS ? null : userId);
  };

  const handlePreviousUser = () => {
    const list = usersData?.data ?? [];
    if (list.length === 0) return;
    if (selectedUserId === ALL_USERS) {
      handleUserChange(list[list.length - 1].id);
      return;
    }
    const idx = list.findIndex((u: any) => u.id === selectedUserId);
    if (idx <= 0) handleUserChange(ALL_USERS);
    else handleUserChange(list[idx - 1].id);
  };

  const handleNextUser = () => {
    const list = usersData?.data ?? [];
    if (list.length === 0) return;
    if (selectedUserId === ALL_USERS) {
      handleUserChange(list[0].id);
      return;
    }
    const idx = list.findIndex((u: any) => u.id === selectedUserId);
    if (idx === -1 || idx === list.length - 1) handleUserChange(ALL_USERS);
    else handleUserChange(list[idx + 1].id);
  };

  // Sync selectedMonth from endDate so the displayed period label tracks the
  // user's manual date edits. Payroll period ends on day 25 of selectedMonth.
  useEffect(() => {
    setSelectedMonth(new Date(endDate.getFullYear(), endDate.getMonth(), 1));
  }, [endDate]);

  return (
    <div className={className}>
      <Card className="h-full flex flex-col shadow-sm border border-border">
        <CardContent className="flex-1 flex flex-col p-4 space-y-4 overflow-hidden">
          {/* Single filter row: user + sector + justificativa + period + date range */}
          <div className="flex items-stretch gap-2 flex-shrink-0">
            <div className="flex items-stretch gap-1 flex-1 min-w-0">
              <Button type="button" variant="outline" size="icon" onClick={handlePreviousUser} disabled={usersLoading} className="h-10 w-10 flex-shrink-0">
                <IconChevronLeft className="h-4 w-4" />
              </Button>
              <div className="flex-1 min-w-0">
                <Combobox
                  options={userOptions}
                  value={selectedUserId}
                  onValueChange={(v) => handleUserChange((Array.isArray(v) ? v[0] : v) || ALL_USERS)}
                  placeholder={usersLoading ? "Carregando..." : "Selecione um colaborador"}
                  emptyText="Nenhum colaborador encontrado"
                  searchable
                  className="w-full"
                  disabled={usersLoading}
                />
              </div>
              <Button type="button" variant="outline" size="icon" onClick={handleNextUser} disabled={usersLoading} className="h-10 w-10 flex-shrink-0">
                <IconChevronRight className="h-4 w-4" />
              </Button>
            </div>

            <div className="flex-1 min-w-0">
              <Combobox
                options={sectorOptions}
                value={selectedSectorId}
                onValueChange={(v) => {
                  const next = (Array.isArray(v) ? v[0] : v) || "";
                  setSelectedSectorId(next);
                  updateParam("sectorId", next || null);
                }}
                placeholder="Todos os setores"
                emptyText="Nenhum setor"
                clearable
                searchable
                className="w-full"
              />
            </div>

            <div className="flex-1 min-w-0">
              <Combobox
                options={justificativaOptions}
                value={selectedJustificativaId != null ? String(selectedJustificativaId) : ""}
                onValueChange={(v) => {
                  const raw = (Array.isArray(v) ? v[0] : v) || "";
                  const next = raw ? Number(raw) : undefined;
                  setSelectedJustificativaId(next);
                  updateParam("justificativaId", next ? String(next) : null);
                }}
                placeholder={category === "AUSENCIA" ? "Todas as ausências" : "Todas as faltas"}
                emptyText="Nenhuma justificativa"
                clearable
                searchable
                className="w-full"
              />
            </div>

            <div className="flex items-center gap-1 flex-shrink-0">
              <Button type="button" variant="outline" size="icon" onClick={() => handleMonthChange(subMonths(selectedMonth, 1))} className="h-10 w-10">
                <IconChevronLeft className="h-4 w-4" />
              </Button>
              <div className="flex flex-col items-center px-3 min-w-[180px]">
                <div className="flex items-center gap-1.5 text-sm font-semibold">
                  <IconCalendar className="h-4 w-4" />
                  <span className="capitalize">{format(selectedMonth, "MMMM yyyy", { locale: ptBR })}</span>
                </div>
                <div className="text-xs text-muted-foreground tabular-nums">
                  {format(startDate, "dd/MM", { locale: ptBR })} a {format(endDate, "dd/MM/yyyy", { locale: ptBR })}
                </div>
              </div>
              <Button type="button" variant="outline" size="icon" onClick={() => handleMonthChange(addMonths(selectedMonth, 1))} className="h-10 w-10">
                <IconChevronRight className="h-4 w-4" />
              </Button>
            </div>

            <div className="flex items-center gap-1 flex-shrink-0">
              <DateTimeInput
                mode="date"
                value={startDate}
                onChange={handleStartDateChange}
                className="w-[140px]"
                placeholder="Data inicial"
              />
              <span className="text-muted-foreground text-sm px-1">até</span>
              <DateTimeInput
                mode="date"
                value={endDate}
                onChange={handleEndDateChange}
                className="w-[140px]"
                placeholder="Data final"
              />
            </div>
          </div>

          <div className="flex-1 min-h-0">
            <AbsenceTable
              absences={records}
              dayRows={expandToDays ? dayRows : undefined}
              isLoading={isLoading}
              onEdit={(rec) => setEditing(rec)}
              emptyText={`Nenhuma ${category === "AUSENCIA" ? "ausência" : "falta"} no período de ${format(startDate, "dd/MM/yyyy", { locale: ptBR })} a ${format(endDate, "dd/MM/yyyy", { locale: ptBR })}`}
            />
          </div>
        </CardContent>
      </Card>

      <AbsenceFormDialog
        open={!!editing}
        onOpenChange={(o) => !o && setEditing(null)}
        category={category}
        editing={editing}
      />
    </div>
  );
}
