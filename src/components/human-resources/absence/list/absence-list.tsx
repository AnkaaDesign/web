import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { format, addMonths, subMonths } from "date-fns";
import { ptBR } from "date-fns/locale";
import { IconCalendar, IconChevronLeft, IconChevronRight } from "@tabler/icons-react";

import type { SecullumAggregatedAbsence } from "../../../../types";
import {
  CONTRACT_STATUS,
  VACATION_JUSTIFICATIVA_ID,
} from "../../../../constants";
import {
  useSecullumAggregatedAbsences,
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

const periodContaining = (anchor: Date) => {
  const refMonth =
    anchor.getDate() >= 26
      ? new Date(anchor.getFullYear(), anchor.getMonth() + 1, 1)
      : new Date(anchor.getFullYear(), anchor.getMonth(), 1);
  return { refMonth, ...getPayrollPeriod(refMonth) };
};

const defaultPeriod = () => periodContaining(new Date());

export function AbsenceList({ className }: AbsenceListProps) {
  const [searchParams, setSearchParams] = useSearchParams();

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
  const [editing, setEditing] = useState<SecullumAggregatedAbsence | null>(null);

  const { data: usersData, isLoading: usersLoading } = useUsers({
    statuses: [CONTRACT_STATUS.ACTIVE],
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

  const aggregatedParams = useMemo(
    () => ({
      startDate: format(startDate, "yyyy-MM-dd"),
      endDate: format(endDate, "yyyy-MM-dd"),
      sectorId: selectedSectorId || undefined,
    }),
    [startDate, endDate, selectedSectorId],
  );

  const { data, isLoading } = useSecullumAggregatedAbsences(aggregatedParams);

  const records = useMemo<SecullumAggregatedAbsence[]>(() => {
    const root: any = data?.data;
    const list: SecullumAggregatedAbsence[] = Array.isArray(root)
      ? root
      : root && Array.isArray(root.data)
        ? root.data
        : [];
    return list.filter((a) => {
      if (a.JustificativaId !== VACATION_JUSTIFICATIVA_ID) return false;
      if (selectedUserId !== ALL_USERS && a.userId !== selectedUserId) return false;
      return true;
    });
  }, [data, selectedUserId]);

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

  useEffect(() => {
    setSelectedMonth(new Date(endDate.getFullYear(), endDate.getMonth(), 1));
  }, [endDate]);

  return (
    <div className={className}>
      <Card className="h-full flex flex-col shadow-sm border border-border">
        <CardContent className="flex-1 flex flex-col p-4 space-y-4 overflow-hidden">
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
              isLoading={isLoading}
              onEdit={(rec) => setEditing(rec)}
              emptyText={`Nenhuma férias no período de ${format(startDate, "dd/MM/yyyy", { locale: ptBR })} a ${format(endDate, "dd/MM/yyyy", { locale: ptBR })}`}
            />
          </div>
        </CardContent>
      </Card>

      <AbsenceFormDialog
        open={!!editing}
        onOpenChange={(o) => !o && setEditing(null)}
        editing={editing}
      />
    </div>
  );
}
