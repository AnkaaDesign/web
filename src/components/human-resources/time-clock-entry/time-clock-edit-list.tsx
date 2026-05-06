import { useState, useMemo, useEffect, useRef, useCallback } from "react";
import { useSearchParams } from "react-router-dom";
import { format, addMonths, subMonths } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { DateTimeInput } from "@/components/ui/date-time-input";
import { Combobox } from "@/components/ui/combobox";
import type { ComboboxOption } from "@/components/ui/combobox";
import {
  IconChevronLeft,
  IconChevronRight,
  IconDeviceFloppy,
  IconRestore,
  IconCalendar,
} from "@tabler/icons-react";
import { cn } from "@/lib/utils";
import { useSecullumTimeEntries, useSecullumConfiguration, useUsers, useSecullumHolidays } from "../../../hooks";
import { TimeClockEntryTable } from "./time-clock-entry-table";
import type { TimeClockEntryTableRef } from "./time-clock-entry-table";
import { useColumnVisibility } from "@/hooks/common/use-column-visibility";
import { ColumnVisibilityManager } from "@/components/integrations/secullum/calculations/list";
import type { ColumnDef } from "@/components/integrations/secullum/calculations/list";
import { USER_STATUS } from "../../../constants";
import type { EditExportRow } from "./time-clock-entry-edit-export";

const TIME_CLOCK_COLUMNS: ColumnDef[] = [
  { key: "entry1", header: "Entrada 1" },
  { key: "exit1", header: "Saída 1" },
  { key: "entry2", header: "Entrada 2" },
  { key: "exit2", header: "Saída 2" },
  { key: "entry3", header: "Entrada 3" },
  { key: "exit3", header: "Saída 3" },
  { key: "entry4", header: "Entrada 4" },
  { key: "exit4", header: "Saída 4" },
  { key: "entry5", header: "Entrada 5" },
  { key: "exit5", header: "Saída 5" },
  { key: "compensated", header: "Compensado" },
  { key: "neutral", header: "Neutro" },
  { key: "dayOff", header: "Folga" },
  { key: "freeLunch", header: "Almoço" },
];

interface TimeClockEntryEditListProps {
  className?: string;
  headerSlot?: React.ReactNode;
  onExportDataChange?: (
    data: {
      rows: EditExportRow[];
      visibleColumns: Set<string>;
      userName: string | null;
      startDate: Date | null;
      endDate: Date | null;
    } | null,
  ) => void;
}

export function TimeClockEntryEditList({
  className,
  headerSlot,
  onExportDataChange,
}: TimeClockEntryEditListProps) {
  const [searchParams, setSearchParams] = useSearchParams();
  const tableRef = useRef<TimeClockEntryTableRef>(null);
  const [changedRowsCount, setChangedRowsCount] = useState(0);

  const { visibleColumns, setVisibleColumns } = useColumnVisibility(
    "time-clock-visible-columns",
    new Set([
      "entry1",
      "exit1",
      "entry2",
      "exit2",
      "entry3",
      "exit3",
      "entry4",
      "exit4",
      "compensated",
      "dayOff",
    ]),
  );

  const handleChangedRowsChange = useCallback((count: number) => {
    setChangedRowsCount(count);
  }, []);

  const { data: configData, isLoading: configLoading } = useSecullumConfiguration();

  const [startDate, setStartDate] = useState<Date | null>(() => {
    const date = searchParams.get("startDate");
    if (date) {
      const parts = date.split("-");
      if (parts.length === 3) {
        const parsed = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
        return isNaN(parsed.getTime()) ? null : parsed;
      }
    }
    return null;
  });

  const [endDate, setEndDate] = useState<Date | null>(() => {
    const date = searchParams.get("endDate");
    if (date) {
      const parts = date.split("-");
      if (parts.length === 3) {
        const parsed = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
        return isNaN(parsed.getTime()) ? null : parsed;
      }
    }
    return null;
  });

  const [_startDateInput, setStartDateInput] = useState(() => {
    const date = searchParams.get("startDate");
    if (date) {
      const parsed = new Date(date);
      if (!isNaN(parsed.getTime())) return date;
    }
    return "";
  });

  const [_endDateInput, setEndDateInput] = useState(() => {
    const date = searchParams.get("endDate");
    if (date) {
      const parsed = new Date(date);
      if (!isNaN(parsed.getTime())) return date;
    }
    return "";
  });

  useEffect(() => {
    const hasUrlDates = searchParams.get("startDate") || searchParams.get("endDate");

    if (hasUrlDates && !startDate && !endDate) {
      const urlStart = searchParams.get("startDate");
      const urlEnd = searchParams.get("endDate");

      if (urlStart) {
        const parts = urlStart.split("-");
        const parsed = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
        if (!isNaN(parsed.getTime())) {
          setStartDate(parsed);
          setStartDateInput(urlStart);
        }
      }

      if (urlEnd) {
        const parts = urlEnd.split("-");
        const parsed = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
        if (!isNaN(parsed.getTime())) {
          setEndDate(parsed);
          setEndDateInput(urlEnd);
        }
      }
    } else if (
      !configLoading &&
      configData?.data &&
      Array.isArray(configData.data) &&
      configData.data.length > 0 &&
      configData.data[0]?.dateRange &&
      !startDate &&
      !endDate
    ) {
      try {
        const dateRange = configData.data[0].dateRange;
        const startParts = dateRange.start.split("-");
        const endParts = dateRange.end.split("-");

        const configStart = new Date(
          parseInt(startParts[0]),
          parseInt(startParts[1]) - 1,
          parseInt(startParts[2]),
        );
        const configEnd = new Date(
          parseInt(endParts[0]),
          parseInt(endParts[1]) - 1,
          parseInt(endParts[2]),
        );

        if (!isNaN(configStart.getTime()) && !isNaN(configEnd.getTime())) {
          setStartDate(configStart);
          setEndDate(configEnd);

          const formattedStart = format(configStart, "yyyy-MM-dd");
          const formattedEnd = format(configEnd, "yyyy-MM-dd");

          setStartDateInput(formattedStart);
          setEndDateInput(formattedEnd);
        }
      } catch (__error) {
        if (process.env.NODE_ENV !== "production") {
          console.error("Error parsing config dates:", __error);
        }
      }
    } else if (
      !configLoading &&
      (!configData?.data ||
        !Array.isArray(configData.data) ||
        configData.data.length === 0 ||
        !configData.data[0]?.dateRange) &&
      !startDate &&
      !endDate &&
      !hasUrlDates
    ) {
      const prevMonth = addMonths(new Date(), -1);
      const defaultStart = new Date(prevMonth.getFullYear(), prevMonth.getMonth(), 26);
      const defaultEnd = new Date(new Date().getFullYear(), new Date().getMonth(), 25);

      setStartDate(defaultStart);
      setEndDate(defaultEnd);
      setStartDateInput(format(defaultStart, "yyyy-MM-dd"));
      setEndDateInput(format(defaultEnd, "yyyy-MM-dd"));
    }
  }, [configLoading, configData, searchParams, startDate, endDate]);

  const [selectedMonth, setSelectedMonth] = useState<Date>(() => new Date());
  const [selectedUserId, setSelectedUserId] = useState(searchParams.get("userId") || "");

  const {
    data: usersData,
    isLoading: usersLoading,
    error: usersError,
  } = useUsers({
    statuses: [
      USER_STATUS.EXPERIENCE_PERIOD_1,
      USER_STATUS.EXPERIENCE_PERIOD_2,
      USER_STATUS.EFFECTED,
    ],
    orderBy: { name: "asc" },
    take: 100,
  });

  useEffect(() => {
    if (usersData?.data && usersData.data.length > 0 && !selectedUserId) {
      const firstUserId = usersData.data[0].id;
      setSelectedUserId(firstUserId);

      const params = new URLSearchParams(searchParams);
      params.set("userId", firstUserId);
      setSearchParams(params);
    }
  }, [usersData, selectedUserId, searchParams, setSearchParams]);

  const queryParams = useMemo(
    () => ({
      userId: selectedUserId || undefined,
      startDate: startDate ? format(startDate, "yyyy-MM-dd") : undefined,
      endDate: endDate ? format(endDate, "yyyy-MM-dd") : undefined,
    }),
    [selectedUserId, startDate, endDate],
  );

  const { data, isLoading } = useSecullumTimeEntries(queryParams);

  // Holidays for the visible range — used to label feriado time-cells in the
  // edit table. Secullum's /Batidas endpoint (which feeds Edit mode) does NOT
  // populate Entrada1..Saida5 with "FERIADO" / "FOLGA" text the way /Calculos
  // does, so we derive the labels client-side from the holiday list and the
  // entry's `Folga` flag. See `time-clock-entry-table.tsx` for the cell-level
  // render.
  // The holidays endpoint takes year (and optional month). Pull the visible
  // range's year(s); the underlying query is cached for 24h.
  const holidayYears = useMemo(() => {
    const ys = new Set<number>();
    if (startDate) ys.add(startDate.getFullYear());
    if (endDate) ys.add(endDate.getFullYear());
    if (!startDate && !endDate) ys.add(new Date().getFullYear());
    return Array.from(ys);
  }, [startDate, endDate]);

  const holidaysQuery1 = useSecullumHolidays(
    holidayYears[0] != null ? { year: holidayYears[0] } : undefined,
  );
  const holidaysQuery2 = useSecullumHolidays(
    holidayYears[1] != null ? { year: holidayYears[1] } : undefined,
  );

  const holidayDates = useMemo(() => {
    const set = new Set<string>();
    const collect = (resp: any) => {
      const root = resp?.data;
      const list: any[] = Array.isArray(root) ? root : Array.isArray(root?.data) ? root.data : [];
      for (const h of list) {
        const raw = h?.Data;
        if (!raw) continue;
        // Secullum returns "2026-05-01T03:00:00.000Z" — slice to YYYY-MM-DD.
        // Use the local date portion of the ISO string to avoid TZ shifts.
        const ymd = String(raw).slice(0, 10);
        if (/^\d{4}-\d{2}-\d{2}$/.test(ymd)) set.add(ymd);
      }
    };
    collect(holidaysQuery1.data);
    collect(holidaysQuery2.data);
    return set;
  }, [holidaysQuery1.data, holidaysQuery2.data]);

  const handleStartDateChange = (date: Date | null | any) => {
    if (date && typeof date === "object" && "getTime" in date && !isNaN(date.getTime())) {
      if (endDate && date > endDate) {
        setEndDate(date);
        setEndDateInput(format(date, "yyyy-MM-dd"));
        const params = new URLSearchParams(searchParams);
        params.set("startDate", format(date, "yyyy-MM-dd"));
        params.set("endDate", format(date, "yyyy-MM-dd"));
        setSearchParams(params);
      } else {
        const formatted = format(date, "yyyy-MM-dd");
        const params = new URLSearchParams(searchParams);
        params.set("startDate", formatted);
        setSearchParams(params);
      }
      setStartDate(date);
      setStartDateInput(format(date, "yyyy-MM-dd"));
    } else if (!date) {
      setStartDate(null);
      setStartDateInput("");
      const params = new URLSearchParams(searchParams);
      params.delete("startDate");
      setSearchParams(params);
    }
  };

  const handleEndDateChange = (date: Date | null | any) => {
    if (date && typeof date === "object" && "getTime" in date && !isNaN(date.getTime())) {
      if (startDate && date < startDate) {
        setStartDate(date);
        setStartDateInput(format(date, "yyyy-MM-dd"));
        const params = new URLSearchParams(searchParams);
        params.set("startDate", format(date, "yyyy-MM-dd"));
        params.set("endDate", format(date, "yyyy-MM-dd"));
        setSearchParams(params);
      } else {
        const formatted = format(date, "yyyy-MM-dd");
        const params = new URLSearchParams(searchParams);
        params.set("endDate", formatted);
        setSearchParams(params);
      }
      setEndDate(date);
      setEndDateInput(format(date, "yyyy-MM-dd"));
    } else if (!date) {
      setEndDate(null);
      setEndDateInput("");
      const params = new URLSearchParams(searchParams);
      params.delete("endDate");
      setSearchParams(params);
    }
  };

  const getPayrollPeriod = (month: Date) => {
    const previousMonth = addMonths(month, -1);
    const startDate = new Date(previousMonth.getFullYear(), previousMonth.getMonth(), 26);
    const endDate = new Date(month.getFullYear(), month.getMonth(), 25);
    return {
      startDate: format(startDate, "yyyy-MM-dd"),
      endDate: format(endDate, "yyyy-MM-dd"),
    };
  };

  const getPayrollPeriodDisplay = (month: Date) => {
    const previousMonth = subMonths(month, 1);
    const start = new Date(previousMonth.getFullYear(), previousMonth.getMonth(), 26);
    const end = new Date(month.getFullYear(), month.getMonth(), 25);
    return {
      period: `${format(start, "dd/MM", { locale: ptBR })} a ${format(end, "dd/MM/yyyy", { locale: ptBR })}`,
      monthName: format(month, "MMMM yyyy", { locale: ptBR }),
    };
  };

  const handleMonthChange = (month: Date) => {
    setSelectedMonth(month);
    const period = getPayrollPeriod(month);
    const s = new Date(period.startDate + "T00:00:00");
    const e = new Date(period.endDate + "T00:00:00");
    setStartDate(s);
    setEndDate(e);
    setStartDateInput(period.startDate);
    setEndDateInput(period.endDate);
    const params = new URLSearchParams(searchParams);
    params.set("startDate", period.startDate);
    params.set("endDate", period.endDate);
    setSearchParams(params);
  };

  const handlePreviousMonth = () => handleMonthChange(subMonths(selectedMonth, 1));
  const handleNextMonth = () => handleMonthChange(addMonths(selectedMonth, 1));

  const handleUserChange = (userId: string) => {
    setSelectedUserId(userId);
    const params = new URLSearchParams(searchParams);
    if (userId) params.set("userId", userId);
    else params.delete("userId");
    setSearchParams(params);
  };

  const handlePreviousUser = () => {
    if (!usersData?.data || usersData.data.length === 0) return;
    const currentIndex = usersData.data.findIndex((user) => user.id === selectedUserId);
    if (currentIndex === -1 || currentIndex === 0) {
      handleUserChange(usersData.data[usersData.data.length - 1].id);
    } else {
      handleUserChange(usersData.data[currentIndex - 1].id);
    }
  };

  const handleNextUser = () => {
    if (!usersData?.data || usersData.data.length === 0) return;
    const currentIndex = usersData.data.findIndex((user) => user.id === selectedUserId);
    if (currentIndex === -1 || currentIndex === usersData.data.length - 1) {
      handleUserChange(usersData.data[0].id);
    } else {
      handleUserChange(usersData.data[currentIndex + 1].id);
    }
  };

  const userOptions: ComboboxOption[] = useMemo(() => {
    if (!usersData?.data) return [];
    return usersData.data.map((user) => ({ value: user.id, label: user.name }));
  }, [usersData]);

  const periodDisplay = getPayrollPeriodDisplay(selectedMonth);

  // Push the export-friendly entry list up to the unified page so it can render
  // the export popover in the page header for this mode.
  const selectedUserName: string | null = useMemo(() => {
    if (!selectedUserId || !usersData?.data) return null;
    return usersData.data.find((u) => u.id === selectedUserId)?.name ?? null;
  }, [selectedUserId, usersData]);

  const exportRows: EditExportRow[] = useMemo(() => {
    const raw = (data?.data?.data?.lista ?? []) as any[];
    return raw.map((e: any) => {
      const dateLabel: string =
        e.DataExibicao ||
        (e.Data ? format(new Date(e.Data), "dd/MM/yyyy") : "") ||
        "";
      return {
        id: String(e.Id ?? e.id ?? `${dateLabel}-${e.FuncionarioId ?? ""}`),
        date: dateLabel,
        entry1: e.Entrada1 ?? "",
        exit1: e.Saida1 ?? "",
        entry2: e.Entrada2 ?? "",
        exit2: e.Saida2 ?? "",
        entry3: e.Entrada3 ?? "",
        exit3: e.Saida3 ?? "",
        entry4: e.Entrada4 ?? "",
        exit4: e.Saida4 ?? "",
        entry5: e.Entrada5 ?? "",
        exit5: e.Saida5 ?? "",
        compensated: e.Compensado ? "Sim" : "",
        neutral: e.Neutro ? "Sim" : "",
        dayOff: e.Folga ? "Sim" : "",
        freeLunch: e.AlmocoLivre ? "Sim" : "",
      };
    });
  }, [data]);

  // The Date column is identity-like and always exported regardless of the
  // table's column-visibility state.
  const exportVisibleColumns = useMemo(
    () => new Set(["date", ...Array.from(visibleColumns ?? [])]),
    [visibleColumns],
  );

  useEffect(() => {
    onExportDataChange?.({
      rows: exportRows,
      visibleColumns: exportVisibleColumns,
      userName: selectedUserName,
      startDate,
      endDate,
    });
  }, [exportRows, exportVisibleColumns, selectedUserName, startDate, endDate, onExportDataChange]);

  return (
    <Card className={cn("flex flex-col shadow-sm border border-border", className)}>
      <CardContent className="flex-1 flex flex-col p-4 space-y-4 overflow-hidden">
        {usersError && (
          <div className="text-red-600 text-sm p-2 bg-red-50 rounded flex-shrink-0">
            Error loading users: {String(usersError)}
          </div>
        )}

        <div className="flex items-center gap-2 flex-shrink-0">
          {headerSlot}
          <div className="flex gap-1 shrink-0">
            <Button
              type="button"
              variant="outline"
              size="icon"
              onClick={handlePreviousUser}
              disabled={!usersData?.data || usersData.data.length === 0}
              className="h-10 w-10"
            >
              <IconChevronLeft className="h-4 w-4" />
            </Button>
            <Combobox
              options={userOptions}
              value={selectedUserId}
              onValueChange={(value) =>
                handleUserChange((Array.isArray(value) ? value[0] : value) || "")
              }
              placeholder={usersLoading ? "Carregando..." : "Selecione um funcionário"}
              emptyText="Nenhum funcionário encontrado"
              searchable={true}
              className="w-96"
              disabled={usersLoading}
            />
            <Button
              type="button"
              variant="outline"
              size="icon"
              onClick={handleNextUser}
              disabled={!usersData?.data || usersData.data.length === 0}
              className="h-10 w-10"
            >
              <IconChevronRight className="h-4 w-4" />
            </Button>
          </div>

          <div className="flex items-center gap-2 ml-auto">
            <div className="flex items-center gap-1">
              <Button
                type="button"
                variant="outline"
                size="icon"
                onClick={handlePreviousMonth}
                className="h-10 w-10"
              >
                <IconChevronLeft className="h-4 w-4" />
              </Button>
              <div className="flex flex-col items-center px-2">
                <div className="flex items-center gap-1 text-sm font-medium">
                  <IconCalendar className="h-4 w-4" />
                  <span className="capitalize">{periodDisplay.monthName}</span>
                </div>
                <div className="text-xs text-muted-foreground">
                  Período: {periodDisplay.period}
                </div>
              </div>
              <Button
                type="button"
                variant="outline"
                size="icon"
                onClick={handleNextMonth}
                className="h-10 w-10"
              >
                <IconChevronRight className="h-4 w-4" />
              </Button>
            </div>

            <div className="flex items-center gap-1">
              <DateTimeInput
                mode="date"
                value={startDate}
                onChange={handleStartDateChange}
                className="w-[140px]"
                placeholder="Data inicial"
                showClearButton={true}
              />
              <span className="text-muted-foreground text-sm px-1">até</span>
              <DateTimeInput
                mode="date"
                value={endDate}
                onChange={handleEndDateChange}
                className="w-[140px]"
                placeholder="Data final"
                showClearButton={true}
              />
            </div>

            <ColumnVisibilityManager
              columns={TIME_CLOCK_COLUMNS}
              visibleColumns={visibleColumns}
              onVisibilityChange={setVisibleColumns}
            />

            {changedRowsCount > 0 && (
              <div className="flex items-center gap-1 ml-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => tableRef.current?.handleRestore()}
                >
                  <IconRestore className="h-4 w-4 mr-2" />
                  Restaurar
                </Button>
                <Button
                  type="button"
                  variant="default"
                  onClick={() => tableRef.current?.handleSubmit()}
                >
                  <IconDeviceFloppy className="h-4 w-4 mr-2" />
                  Salvar ({changedRowsCount})
                </Button>
              </div>
            )}
          </div>
        </div>

        <div className="flex-1 min-h-0">
          <TimeClockEntryTable
            ref={tableRef}
            entries={data?.data?.data?.lista || []}
            isLoading={isLoading}
            className="h-full"
            onChangedRowsChange={handleChangedRowsChange}
            visibleColumns={visibleColumns}
            holidayDates={holidayDates}
          />
        </div>
      </CardContent>
    </Card>
  );
}
