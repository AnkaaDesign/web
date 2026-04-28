import { useState, useMemo, useEffect, useRef, useCallback } from "react";
import { useSearchParams } from "react-router-dom";
import { useSecullumTimeEntries, useSecullumConfiguration } from "../../../hooks";
import { format, addMonths, subMonths } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { DateTimeInput } from "@/components/ui/date-time-input";
import { TimeClockEntryTable } from "@/components/human-resources/time-clock-entry/time-clock-entry-table";
import type { TimeClockEntryTableRef } from "@/components/human-resources/time-clock-entry/time-clock-entry-table";
import { IconChevronLeft, IconChevronRight, IconDeviceFloppy, IconRestore, IconCalendar } from "@tabler/icons-react";
import { Combobox } from "@/components/ui/combobox";
import type { ComboboxOption } from "@/components/ui/combobox";
import { useUsers } from "../../../hooks";
import { PageHeader } from "@/components/ui/page-header";
import { routes, FAVORITE_PAGES, USER_STATUS } from "../../../constants";
import { usePageTracker } from "@/hooks/common/use-page-tracker";
import { useColumnVisibility } from "@/hooks/common/use-column-visibility";
import { ColumnVisibilityManager } from "@/components/integrations/secullum/calculations/list";
import type { ColumnDef } from "@/components/integrations/secullum/calculations/list";

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

export default function TimeClockListPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const tableRef = useRef<TimeClockEntryTableRef>(null);
  const [changedRowsCount, setChangedRowsCount] = useState(0);

  const { visibleColumns, setVisibleColumns } = useColumnVisibility(
    "time-clock-visible-columns",
    new Set(["entry1", "exit1", "entry2", "exit2", "entry3", "exit3", "entry4", "exit4", "compensated", "dayOff"]),
  );

  // Callback to handle changed rows count updates
  const handleChangedRowsChange = useCallback((count: number) => {
    setChangedRowsCount(count);
  }, []);

  // Track page access
  usePageTracker({
    title: "Controle de Ponto",
    icon: "clock",
  });

  // Fetch Secullum configuration for default dates
  const { data: configData, isLoading: configLoading } = useSecullumConfiguration();

  // Date range state - will be set from Secullum configuration
  const [startDate, setStartDate] = useState<Date | null>(() => {
    const date = searchParams.get("startDate");
    if (date) {
      // Parse date in local timezone to avoid UTC issues
      const parts = date.split("-");
      if (parts.length === 3) {
        const parsed = new Date(
          parseInt(parts[0]),
          parseInt(parts[1]) - 1, // Month is 0-indexed
          parseInt(parts[2]),
        );
        return isNaN(parsed.getTime()) ? null : parsed;
      }
    }
    return null; // Don't set default, wait for config
  });

  const [endDate, setEndDate] = useState<Date | null>(() => {
    const date = searchParams.get("endDate");
    if (date) {
      // Parse date in local timezone to avoid UTC issues
      const parts = date.split("-");
      if (parts.length === 3) {
        const parsed = new Date(
          parseInt(parts[0]),
          parseInt(parts[1]) - 1, // Month is 0-indexed
          parseInt(parts[2]),
        );
        return isNaN(parsed.getTime()) ? null : parsed;
      }
    }
    return null; // Don't set default, wait for config
  });

  // Local state for date inputs to allow typing
  const [_startDateInput, setStartDateInput] = useState(() => {
    const date = searchParams.get("startDate");
    if (date) {
      const parsed = new Date(date);
      if (!isNaN(parsed.getTime())) {
        return date;
      }
    }
    return ""; // Don't set default, wait for config
  });

  const [_endDateInput, setEndDateInput] = useState(() => {
    const date = searchParams.get("endDate");
    if (date) {
      const parsed = new Date(date);
      if (!isNaN(parsed.getTime())) {
        return date;
      }
    }
    return ""; // Don't set default, wait for config
  });

  // Set dates from Secullum configuration when loaded
  useEffect(() => {
    const hasUrlDates = searchParams.get("startDate") || searchParams.get("endDate");

    // If we have URL dates, use them
    if (hasUrlDates && !startDate && !endDate) {
      const urlStart = searchParams.get("startDate");
      const urlEnd = searchParams.get("endDate");

      if (urlStart) {
        // Parse date in local timezone
        const parts = urlStart.split("-");
        const parsed = new Date(
          parseInt(parts[0]),
          parseInt(parts[1]) - 1, // Month is 0-indexed
          parseInt(parts[2]),
        );
        if (!isNaN(parsed.getTime())) {
          setStartDate(parsed);
          setStartDateInput(urlStart);
        }
      }

      if (urlEnd) {
        // Parse date in local timezone
        const parts = urlEnd.split("-");
        const parsed = new Date(
          parseInt(parts[0]),
          parseInt(parts[1]) - 1, // Month is 0-indexed
          parseInt(parts[2]),
        );
        if (!isNaN(parsed.getTime())) {
          setEndDate(parsed);
          setEndDateInput(urlEnd);
        }
      }
    }
    // If config is loaded and we don't have dates yet, use config dates
    else if (!configLoading && configData?.data && Array.isArray(configData.data) && configData.data.length > 0 && configData.data[0]?.dateRange && !startDate && !endDate) {
      try {
        // Parse dates in local timezone to avoid UTC conversion issues
        // Split the date string and create date with explicit year, month, day
        const dateRange = configData.data[0].dateRange;
        const startParts = dateRange.start.split("-");
        const endParts = dateRange.end.split("-");

        const configStart = new Date(
          parseInt(startParts[0]),
          parseInt(startParts[1]) - 1, // Month is 0-indexed
          parseInt(startParts[2]),
        );
        const configEnd = new Date(
          parseInt(endParts[0]),
          parseInt(endParts[1]) - 1, // Month is 0-indexed
          parseInt(endParts[2]),
        );

        // Check if dates are valid
        if (!isNaN(configStart.getTime()) && !isNaN(configEnd.getTime())) {
          setStartDate(configStart);
          setEndDate(configEnd);

          const formattedStart = format(configStart, "yyyy-MM-dd");
          const formattedEnd = format(configEnd, "yyyy-MM-dd");

          setStartDateInput(formattedStart);
          setEndDateInput(formattedEnd);
        }
      } catch (__error) {
        if (process.env.NODE_ENV !== 'production') {
          console.error("Error parsing config dates:", __error);
        }
      }
    }
    // If config is loaded but has no date range and we have no dates, use defaults
    else if (
      !configLoading &&
      (!configData?.data || !Array.isArray(configData.data) || configData.data.length === 0 || !configData.data[0]?.dateRange) &&
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

  // Fetch users for filter
  const {
    data: usersData,
    isLoading: usersLoading,
    error: usersError,
  } = useUsers({
    statuses: [
      USER_STATUS.EXPERIENCE_PERIOD_1,
      USER_STATUS.EXPERIENCE_PERIOD_2,
      USER_STATUS.EFFECTED
    ],
    orderBy: { name: "asc" },
    take: 100,
  });

  // Set first user as default when users are loaded and no user is selected
  useEffect(() => {
    if (usersData?.data && usersData.data.length > 0 && !selectedUserId) {
      const firstUserId = usersData.data[0].id;
      setSelectedUserId(firstUserId);

      const params = new URLSearchParams(searchParams);
      params.set("userId", firstUserId);
      setSearchParams(params);
    }
  }, [usersData, selectedUserId, searchParams, setSearchParams]);

  // Build query parameters for Secullum API
  const queryParams = useMemo(() => {
    const params = {
      userId: selectedUserId || undefined, // Pass userId, backend will handle the mapping
      startDate: startDate ? format(startDate, "yyyy-MM-dd") : undefined,
      endDate: endDate ? format(endDate, "yyyy-MM-dd") : undefined,
    };

    return params;
  }, [selectedUserId, startDate, endDate]);

  // Fetch time clock entries from Secullum
  const { data, isLoading } = useSecullumTimeEntries(queryParams);

  const handleStartDateChange = (date: Date | null | any) => {
    if (date && typeof date === 'object' && 'getTime' in date && !isNaN(date.getTime())) {
      // Check if start date is after end date
      if (endDate && date > endDate) {
        // Auto-adjust end date to be the same as start date
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
    if (date && typeof date === 'object' && 'getTime' in date && !isNaN(date.getTime())) {
      // Check if end date is before start date
      if (startDate && date < startDate) {
        // Auto-adjust start date to be the same as end date
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
    if (userId) {
      params.set("userId", userId);
    } else {
      params.delete("userId");
    }
    setSearchParams(params);
  };

  const handlePreviousUser = () => {
    if (!usersData?.data || usersData.data.length === 0) return;

    const currentIndex = usersData.data.findIndex((user) => user.id === selectedUserId);

    if (currentIndex === -1 || currentIndex === 0) {
      // If no user selected or at first user, go to last user
      const lastUser = usersData.data[usersData.data.length - 1];
      handleUserChange(lastUser.id);
    } else {
      // Go to previous user
      const previousUser = usersData.data[currentIndex - 1];
      handleUserChange(previousUser.id);
    }
  };

  const handleNextUser = () => {
    if (!usersData?.data || usersData.data.length === 0) return;

    const currentIndex = usersData.data.findIndex((user) => user.id === selectedUserId);

    if (currentIndex === -1 || currentIndex === usersData.data.length - 1) {
      // If no user selected or at last user, go to first user
      const firstUser = usersData.data[0];
      handleUserChange(firstUser.id);
    } else {
      // Go to next user
      const nextUser = usersData.data[currentIndex + 1];
      handleUserChange(nextUser.id);
    }
  };

  // Prepare user options for combobox
  const userOptions: ComboboxOption[] = useMemo(() => {
    if (!usersData?.data) return [];

    return usersData.data.map((user) => ({
      value: user.id,
      label: user.name,
    }));
  }, [usersData]);

  return (
    <div className="h-full flex flex-col gap-4 bg-background px-4 pt-4 pb-4">
      <PageHeader
        className="flex-shrink-0"
        title="Controle de Ponto"
        favoritePage={FAVORITE_PAGES.RECURSOS_HUMANOS_CARGOS_LISTAR}
        breadcrumbs={[{ label: "Início", href: routes.home }, { label: "Recursos Humanos", href: routes.humanResources.root }, { label: "Controle de Ponto" }]}
        actions={
          changedRowsCount > 0
            ? [
                {
                  key: "restore",
                  label: "Restaurar",
                  icon: IconRestore,
                  onClick: () => tableRef.current?.handleRestore(),
                  variant: "outline" as const,
                },
                {
                  key: "save",
                  label: `Salvar (${changedRowsCount})`,
                  icon: IconDeviceFloppy,
                  onClick: () => tableRef.current?.handleSubmit(),
                  variant: "default" as const,
                },
              ]
            : []
        }
      />

      {/* Debug info */}
      {usersError && <div className="text-red-600 text-sm p-2 bg-red-50 rounded flex-shrink-0">Error loading users: {String(usersError)}</div>}

      <Card className="flex-1 min-h-0 flex flex-col shadow-sm border border-border">
        <CardContent className="flex-1 flex flex-col p-4 space-y-4 overflow-hidden">
          {/* Filters */}
          <div className="flex items-center gap-2 flex-shrink-0">
            {/* Left: user selector */}
            <div className="flex gap-1 shrink-0">
              <Button type="button" variant="outline" size="icon" onClick={handlePreviousUser} disabled={!usersData?.data || usersData.data.length === 0} className="h-10 w-10">
                <IconChevronLeft className="h-4 w-4" />
              </Button>
              <Combobox
                options={userOptions}
                value={selectedUserId}
                onValueChange={(value) => handleUserChange((Array.isArray(value) ? value[0] : value) || "")}
                placeholder={usersLoading ? "Carregando..." : "Selecione um funcionário"}
                emptyText="Nenhum funcionário encontrado"
                searchable={true}
                className="w-96"
                disabled={usersLoading}
              />
              <Button type="button" variant="outline" size="icon" onClick={handleNextUser} disabled={!usersData?.data || usersData.data.length === 0} className="h-10 w-10">
                <IconChevronRight className="h-4 w-4" />
              </Button>
            </div>

            {/* Right: period + dates */}
            <div className="flex items-center gap-2 ml-auto">
              <div className="flex items-center gap-1">
                <Button type="button" variant="outline" size="icon" onClick={handlePreviousMonth} className="h-10 w-10">
                  <IconChevronLeft className="h-4 w-4" />
                </Button>
                <div className="flex flex-col items-center px-2">
                  <div className="flex items-center gap-1 text-sm font-medium">
                    <IconCalendar className="h-4 w-4" />
                    <span className="capitalize">{getPayrollPeriodDisplay(selectedMonth).monthName}</span>
                  </div>
                  <div className="text-xs text-muted-foreground">Período: {getPayrollPeriodDisplay(selectedMonth).period}</div>
                </div>
                <Button type="button" variant="outline" size="icon" onClick={handleNextMonth} className="h-10 w-10">
                  <IconChevronRight className="h-4 w-4" />
                </Button>
              </div>

              <div className="flex items-center gap-1">
                <DateTimeInput mode="date" value={startDate} onChange={handleStartDateChange} className="w-[140px]" placeholder="Data inicial" showClearButton={true} />
                <span className="text-muted-foreground text-sm px-1">até</span>
                <DateTimeInput mode="date" value={endDate} onChange={handleEndDateChange} className="w-[140px]" placeholder="Data final" showClearButton={true} />
              </div>

              <ColumnVisibilityManager columns={TIME_CLOCK_COLUMNS} visibleColumns={visibleColumns} onVisibilityChange={setVisibleColumns} />
            </div>
          </div>

          {/* Table in scrollable area */}
          <div className="flex-1 min-h-0">
            <TimeClockEntryTable ref={tableRef} entries={data?.data?.data?.lista || []} isLoading={isLoading} className="h-full" onChangedRowsChange={handleChangedRowsChange} visibleColumns={visibleColumns} />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
