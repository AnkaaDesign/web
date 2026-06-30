import { useState, useMemo, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { useSecullumCalculations, useMySecullumCalculations, useUsers, useTeamStaffCalculations, useTeamStaffUsers } from "../../../../../hooks";
import { useAuth } from "@/contexts/auth-context";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CalculationTable } from "./calculation-table";
import { CalculationExport } from "./calculation-export";
import { ColumnVisibilityManager } from "./column-visibility-manager";
import { createCalculationColumns } from "./calculation-table-columns";
import { PeriodControl } from "@/components/personnel-department/time-clock-entry/period-control";
import { cn } from "@/lib/utils";
import { useColumnVisibility } from "@/hooks/common/use-column-visibility";
import { Combobox, type ComboboxOption } from "@/components/ui/combobox";
import { IconChevronLeft, IconChevronRight } from "@tabler/icons-react";
import { addMonths, format, subMonths } from "date-fns";
import { ptBR } from "date-fns/locale";
import { CONTRACT_STATUS } from "@/constants";

type CalculationListMode = 'hr' | 'personal';

interface CalculationListProps {
  className?: string;
  mode?: CalculationListMode;
  teamScope?: boolean;
  onExportDataChange?: (data: { rows: any[]; visibleColumns: Set<string>; filters: any }) => void;
  headerSlot?: React.ReactNode;
}

interface CalculationRow {
  id: string;
  date: string;
  entrada1?: string;
  saida1?: string;
  entrada2?: string;
  saida2?: string;
  entrada3?: string;
  saida3?: string;
  normais?: string;
  faltas?: string;
  ex50?: string;
  ex100?: string;
  ex150?: string;
  dsr?: string;
  dsrDeb?: string;
  not?: string;
  exNot?: string;
  ajuste?: string;
  abono2?: string;
  abono3?: string;
  abono4?: string;
  atras?: string;
  adian?: string;
  folga?: string;
  carga?: string;
  justPa?: string;
  tPlusMinus?: string;
  exInt?: string;
  notTot?: string;
  refeicao?: string;
}

// Helper function to convert selected month to 26th-to-25th period
const getPayrollPeriod = (selectedMonth: Date) => {
  // For selected month, get from 26th of previous month to 25th of selected month
  const previousMonth = addMonths(selectedMonth, -1);
  const startDate = new Date(previousMonth.getFullYear(), previousMonth.getMonth(), 26);
  const endDate = new Date(selectedMonth.getFullYear(), selectedMonth.getMonth(), 25);

  return {
    startDate: format(startDate, "yyyy-MM-dd"),
    endDate: format(endDate, "yyyy-MM-dd"),
  };
};

export function CalculationList({ className, mode = 'hr', teamScope = false, onExportDataChange, headerSlot }: CalculationListProps) {
  const [searchParams, setSearchParams] = useSearchParams();
  const { user: currentUser } = useAuth();
  const isPersonalMode = mode === 'personal';

  // Get selected month from URL or default to current month
  const initialMonth = (() => {
    const monthParam = searchParams.get("month");
    if (monthParam) {
      try { return new Date(monthParam); } catch (e) { /* ignore */ }
    }
    return new Date();
  })();
  const [selectedMonth, setSelectedMonth] = useState<Date>(initialMonth);

  // Custom date range — defaults to the current payroll period
  const [customStartDate, setCustomStartDate] = useState<Date | null>(() => {
    const s = searchParams.get("customStartDate");
    if (s) {
      const parts = s.split("-");
      if (parts.length === 3) return new Date(+parts[0], +parts[1] - 1, +parts[2]);
    }
    const p = getPayrollPeriod(initialMonth);
    return new Date(p.startDate + "T00:00:00");
  });
  const [customEndDate, setCustomEndDate] = useState<Date | null>(() => {
    const e = searchParams.get("customEndDate");
    if (e) {
      const parts = e.split("-");
      if (parts.length === 3) return new Date(+parts[0], +parts[1] - 1, +parts[2]);
    }
    const p = getPayrollPeriod(initialMonth);
    return new Date(p.endDate + "T00:00:00");
  });

  // Get selected user from URL (only for HR mode)
  const [selectedUserId, setSelectedUserId] = useState(() => {
    if (isPersonalMode) {
      return currentUser?.id || "";
    }
    return searchParams.get("userId") || "";
  });

  // Update selectedUserId when currentUser changes in personal mode
  useEffect(() => {
    if (isPersonalMode && currentUser?.id) {
      setSelectedUserId(currentUser.id);
    }
  }, [isPersonalMode, currentUser?.id]);

  // Fetch users for filter (only in HR mode). Team-scope leaders see only their
  // own team via the secure team-staff endpoint; HR/admins see everyone.
  const userFilters = isPersonalMode
    ? undefined
    : {
        statuses: [CONTRACT_STATUS.ACTIVE],
        where: { secullumEmployeeId: { not: null } },
        orderBy: { name: "asc" } as const,
        take: 100,
        include: { currentContract: true, position: true, sector: true },
      };
  const hrUsersQuery = useUsers(userFilters, { enabled: !isPersonalMode && !teamScope });
  const teamUsersQuery = useTeamStaffUsers(userFilters, { enabled: !isPersonalMode && teamScope });
  const usersQuery = teamScope ? teamUsersQuery : hrUsersQuery;
  const usersData = usersQuery.data;
  const usersLoading = usersQuery.isLoading;

  // Set first user as default when users are loaded and no user is selected (HR mode only)
  useEffect(() => {
    if (!isPersonalMode && !selectedUserId && usersData?.data && usersData.data.length > 0) {
      const firstUserId = usersData.data[0].id;
      setSelectedUserId(firstUserId);

      // Update URL params
      const params = new URLSearchParams(searchParams);
      params.set("userId", firstUserId);
      setSearchParams(params, { replace: true });
    }
  }, [isPersonalMode, usersData?.data]); // Only depend on user data and mode

  // Visible columns state with localStorage persistence.
  // Keep this Set in sync with `getDefaultVisibleColumns()` in
  // column-visibility-manager.tsx — that function powers the "Restaurar"
  // button and must produce the same defaults as first-render.
  const { visibleColumns, setVisibleColumns } = useColumnVisibility(
    "calculation-list-visible-columns",
    new Set([
      "date", "entrada1", "saida1", "entrada2", "saida2",
      "normais", "atras", "faltas", "ajuste", "ex50", "ex100", "dsr",
    ])
  );

  // Get all available columns for column visibility manager
  const allColumns = useMemo(() => createCalculationColumns(), []);

  // Build query parameters for Secullum API
  const queryParams = useMemo(() => {
    if (!customStartDate || !customEndDate) return null;
    const startDate = format(customStartDate, "yyyy-MM-dd");
    const endDate = format(customEndDate, "yyyy-MM-dd");
    if (isPersonalMode) return { startDate, endDate };
    if (!selectedUserId) return null;
    return { userId: selectedUserId, startDate, endDate };
  }, [selectedUserId, isPersonalMode, customStartDate, customEndDate]);

  // Fetch calculations — endpoint depends on mode/scope. All three hooks always
  // run (Rules of Hooks); their internal `enabled` checks gate the network call.
  const hrCalculations = useSecullumCalculations(!teamScope && !isPersonalMode && queryParams ? queryParams : undefined);
  const personalCalculations = useMySecullumCalculations(!teamScope && isPersonalMode && queryParams ? queryParams : undefined);
  // Team leader uses the secure per-member endpoint; backend validates the
  // target user belongs to the leader's led sector.
  const teamCalcParams = useMemo(() => {
    if (!teamScope || !customStartDate || !customEndDate || !selectedUserId) return undefined;
    return {
      userId: selectedUserId,
      startDate: format(customStartDate, "yyyy-MM-dd"),
      endDate: format(customEndDate, "yyyy-MM-dd"),
    };
  }, [teamScope, selectedUserId, customStartDate, customEndDate]);
  const teamCalculations = useTeamStaffCalculations(teamCalcParams, { enabled: teamScope });

  // Select the active query. The team-staff service unwraps axios's data, so
  // its result is already `{ success, data: { Colunas, Linhas, Totais } }`;
  // the HR hooks hand back the raw AxiosResponse. Normalize so the extractor
  // below (`data.data || data`) sees the same shape in both branches.
  const activeQuery = teamScope ? teamCalculations : isPersonalMode ? personalCalculations : hrCalculations;
  const rawData = activeQuery.data as any;
  const data = teamScope && rawData ? { data: rawData } : rawData;
  const { isLoading, error } = activeQuery;

  // Debug logging
  useEffect(() => {
    if (process.env.NODE_ENV !== 'production') {
      console.error('[CalculationList] Error:', error);
    }
  }, [error]);

  // Transform Secullum calculation data to table rows and totals
  const { calculationRows, totalsRow } = useMemo((): { calculationRows: CalculationRow[], totalsRow: any } => {
    // Check if we have a successful response with data
    if (!data) {
      return { calculationRows: [], totalsRow: null };
    }

    // The actual response structure is: { data: { success, message, data: { Colunas, Linhas, Totais } } }
    // Because axios wraps the response in a data property
    const apiResponse = data.data || data;

    // Check if the response was successful
    if (apiResponse.success === false) {
      return { calculationRows: [], totalsRow: null };
    }

    // Get the actual calculation data
    const secullumData = apiResponse.data;
    if (!secullumData) {
      return { calculationRows: [], totalsRow: null };
    }

    const { Colunas = [], Linhas = [], Totais = [] } = secullumData;

    // Create a mapping of column names to indices for easier access
    const columnMap = new Map<string, number>();
    Colunas.forEach((col: any, index: number) => {
      columnMap.set(col.Nome, index);
    });

    const rows = Linhas.map((row: any[], rowIndex: number) => {
      const calculationRow: CalculationRow = {
        id: `calc-${rowIndex}`,
        date: row[columnMap.get("Data") ?? 0] || "",
        entrada1: row[columnMap.get("Entrada 1") ?? 1] || "",
        saida1: row[columnMap.get("Saída 1") ?? 2] || "",
        entrada2: row[columnMap.get("Entrada 2") ?? 3] || "",
        saida2: row[columnMap.get("Saída 2") ?? 4] || "",
        entrada3: row[columnMap.get("Entrada 3") ?? 5] || "",
        saida3: row[columnMap.get("Saída 3") ?? 6] || "",
        normais: row[columnMap.get("Normais") ?? 7] || "",
        faltas: row[columnMap.get("Faltas") ?? 8] || "",
        ex50: row[columnMap.get("Ex50%") ?? 9] || "",
        ex100: row[columnMap.get("Ex100%") ?? 10] || "",
        ex150: row[columnMap.get("Ex150%") ?? 11] || "",
        dsr: row[columnMap.get("DSR") ?? 12] || "",
        dsrDeb: row[columnMap.get("DSR.Deb") ?? 13] || "",
        not: row[columnMap.get("Not.") ?? 14] || "",
        exNot: row[columnMap.get("ExNot") ?? 15] || "",
        ajuste: row[columnMap.get("Ajuste") ?? 16] || "",
        abono2: row[columnMap.get("Abono2") ?? 17] || "",
        abono3: row[columnMap.get("Abono3") ?? 18] || "",
        abono4: row[columnMap.get("Abono4") ?? 19] || "",
        atras: row[columnMap.get("Atras.") ?? 20] || "",
        adian: row[columnMap.get("Adian.") ?? 21] || "",
        folga: row[columnMap.get("Folga") ?? 22] || "",
        carga: row[columnMap.get("Carga") ?? 23] || "",
        justPa: row[columnMap.get("JustPa.") ?? 24] || "",
        tPlusMinus: row[columnMap.get("T+/-") ?? 25] || "",
        exInt: row[columnMap.get("ExInt") ?? 26] || "",
        notTot: row[columnMap.get("Not.Tot.") ?? 27] || "",
        refeicao: row[columnMap.get("Refeição") ?? 28] || "",
      };

      return calculationRow;
    });

    // Process totals if available from Secullum
    let totals = null;
    if (Totais && Totais.length > 0) {
      totals = {
        id: 'totals-row',
        date: 'TOTAIS',
        entrada1: '',
        saida1: '',
        entrada2: '',
        saida2: '',
        entrada3: '',
        saida3: '',
        normais: Totais[columnMap.get("Normais") ?? 7] || "",
        faltas: Totais[columnMap.get("Faltas") ?? 8] || "",
        ex50: Totais[columnMap.get("Ex50%") ?? 9] || "",
        ex100: Totais[columnMap.get("Ex100%") ?? 10] || "",
        ex150: Totais[columnMap.get("Ex150%") ?? 11] || "",
        dsr: Totais[columnMap.get("DSR") ?? 12] || "",
        dsrDeb: Totais[columnMap.get("DSR.Deb") ?? 13] || "",
        not: Totais[columnMap.get("Not.") ?? 14] || "",
        exNot: Totais[columnMap.get("ExNot") ?? 15] || "",
        ajuste: Totais[columnMap.get("Ajuste") ?? 16] || "",
        abono2: Totais[columnMap.get("Abono2") ?? 17] || "",
        abono3: Totais[columnMap.get("Abono3") ?? 18] || "",
        abono4: Totais[columnMap.get("Abono4") ?? 19] || "",
        atras: Totais[columnMap.get("Atras.") ?? 20] || "",
        adian: Totais[columnMap.get("Adian.") ?? 21] || "",
        folga: Totais[columnMap.get("Folga") ?? 22] || "",
        carga: Totais[columnMap.get("Carga") ?? 23] || "",
        justPa: Totais[columnMap.get("JustPa.") ?? 24] || "",
        tPlusMinus: Totais[columnMap.get("T+/-") ?? 25] || "",
        exInt: Totais[columnMap.get("ExInt") ?? 26] || "",
        notTot: Totais[columnMap.get("Not.Tot.") ?? 27] || "",
        refeicao: Totais[columnMap.get("Refeição") ?? 28] || "",
      };
    }

    return { calculationRows: rows, totalsRow: totals };
  }, [data]);

  // Handle user change
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

  const handleCustomStartDateChange = (date: Date | null | any) => {
    if (date && typeof date === 'object' && 'getTime' in date && !isNaN(date.getTime())) {
      setCustomStartDate(date);
      const params = new URLSearchParams(searchParams);
      params.set("customStartDate", format(date, "yyyy-MM-dd"));
      setSearchParams(params);
    } else if (!date) {
      setCustomStartDate(null);
      const params = new URLSearchParams(searchParams);
      params.delete("customStartDate");
      setSearchParams(params);
    }
  };

  const handleCustomEndDateChange = (date: Date | null | any) => {
    if (date && typeof date === 'object' && 'getTime' in date && !isNaN(date.getTime())) {
      setCustomEndDate(date);
      const params = new URLSearchParams(searchParams);
      params.set("customEndDate", format(date, "yyyy-MM-dd"));
      setSearchParams(params);
    } else if (!date) {
      setCustomEndDate(null);
      const params = new URLSearchParams(searchParams);
      params.delete("customEndDate");
      setSearchParams(params);
    }
  };

  const handleMonthChange = (month: Date) => {
    setSelectedMonth(month);
    const p = getPayrollPeriod(month);
    const s = new Date(p.startDate + "T00:00:00");
    const e = new Date(p.endDate + "T00:00:00");
    setCustomStartDate(s);
    setCustomEndDate(e);
    const params = new URLSearchParams(searchParams);
    params.set("month", format(month, "yyyy-MM-dd"));
    params.set("customStartDate", p.startDate);
    params.set("customEndDate", p.endDate);
    setSearchParams(params);
  };

  // Navigate to previous month
  const handlePreviousMonth = () => {
    const previousMonth = subMonths(selectedMonth, 1);
    handleMonthChange(previousMonth);
  };

  // Navigate to next month
  const handleNextMonth = () => {
    const nextMonth = addMonths(selectedMonth, 1);
    handleMonthChange(nextMonth);
  };

  // Format the period display (26th to 25th)
  const getPayrollPeriodDisplay = (month: Date) => {
    const previousMonth = subMonths(month, 1);
    const startDate = new Date(previousMonth.getFullYear(), previousMonth.getMonth(), 26);
    const endDate = new Date(month.getFullYear(), month.getMonth(), 25);

    return {
      period: `${format(startDate, "dd/MM", { locale: ptBR })} a ${format(endDate, "dd/MM/yyyy", { locale: ptBR })}`,
      monthName: format(month, "MMMM yyyy", { locale: ptBR }),
    };
  };

  const { period, monthName } = getPayrollPeriodDisplay(selectedMonth);

  // Regular monthly period bounds (26th prev month → 25th) as Dates.
  const monthBounds = useMemo(() => {
    const p = getPayrollPeriod(selectedMonth);
    return {
      start: new Date(p.startDate + "T00:00:00"),
      end: new Date(p.endDate + "T00:00:00"),
    };
  }, [selectedMonth]);

  // A custom range is "active" when the current custom dates differ from the
  // regular monthly bounds (handleMonthChange keeps them in sync otherwise).
  const isCustomRange = useMemo(() => {
    if (!customStartDate || !customEndDate) return true;
    return (
      format(customStartDate, "yyyy-MM-dd") !== format(monthBounds.start, "yyyy-MM-dd") ||
      format(customEndDate, "yyyy-MM-dd") !== format(monthBounds.end, "yyyy-MM-dd")
    );
  }, [customStartDate, customEndDate, monthBounds]);

  // Chip labels + bounds passed to PeriodControl.
  const periodTitle = isCustomRange ? "Período personalizado" : monthName;
  const periodSubtitle = isCustomRange
    ? `${customStartDate ? format(customStartDate, "dd/MM/yyyy") : "—"} a ${customEndDate ? format(customEndDate, "dd/MM/yyyy") : "—"}`
    : period;
  const periodStart = customStartDate ?? monthBounds.start;
  const periodEnd = customEndDate ?? monthBounds.end;

  // Stepping a month resets to the regular monthly period (handleMonthChange
  // rewrites customStartDate/customEndDate + their URL params), so the prev/next
  // chevrons effectively clear any active custom range.
  const handlePrevPeriod = handlePreviousMonth;
  const handleNextPeriod = handleNextMonth;

  // Calendar range pick → set both custom dates (and their URL params).
  const handlePeriodRangeChange = (start: Date | null, end: Date | null) => {
    handleCustomStartDateChange(start);
    handleCustomEndDateChange(end);
  };

  // Prepare user options for combobox
  const userOptions: ComboboxOption[] = useMemo(() => {
    if (!usersData?.data) return [];

    return usersData.data.map((user) => ({
      value: user.id,
      label: user.name,
    }));
  }, [usersData]);

  const selectedUser = useMemo(
    () => usersData?.data?.find((u) => u.id === selectedUserId) ?? (isPersonalMode ? currentUser : null),
    [usersData, selectedUserId, isPersonalMode, currentUser],
  );

  const exportFilters = useMemo(() => ({
    selectedMonth,
    userId: selectedUserId,
    customStartDate,
    customEndDate,
    selectedUser,
  }), [selectedMonth, selectedUserId, customStartDate, customEndDate, selectedUser]);

  useEffect(() => {
    onExportDataChange?.({ rows: calculationRows, visibleColumns, filters: exportFilters });
  }, [calculationRows, visibleColumns, exportFilters]);

  return (
    <Card className={cn("flex flex-col shadow-sm border border-border", className)}>
      <CardContent className="flex-1 flex flex-col p-4 space-y-4 min-h-0">
        {/* Error display */}
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
            <strong className="font-medium">Erro ao carregar cálculos:</strong>{' '}
            {(error as any)?.message || 'Erro desconhecido'}
          </div>
        )}

        {/* Filters */}
        <div className="flex items-center gap-2">
          {headerSlot}
          {/* Left: user selector */}
          {!isPersonalMode && (
            <div className="flex gap-1 shrink-0">
              <Button type="button" variant="default" size="icon" onClick={handlePreviousUser} disabled={!usersData?.data || usersData.data.length === 0} className="h-10 w-10">
                <IconChevronLeft className="h-4 w-4" />
              </Button>
              <Combobox
                options={userOptions}
                value={selectedUserId || ""}
                onValueChange={(value) => { const userId = Array.isArray(value) ? value[0] : value; handleUserChange(userId || ""); }}
                placeholder={usersLoading ? "Carregando..." : "Selecione um funcionário"}
                emptyText="Nenhum funcionário encontrado"
                searchable={true}
                className="w-96"
                disabled={usersLoading}
              />
              <Button type="button" variant="default" size="icon" onClick={handleNextUser} disabled={!usersData?.data || usersData.data.length === 0} className="h-10 w-10">
                <IconChevronRight className="h-4 w-4" />
              </Button>
            </div>
          )}

          {/* Right: period chip + actions */}
          <div className="flex items-center gap-2 ml-auto">
            <PeriodControl
              variant="range"
              title={periodTitle}
              subtitle={periodSubtitle}
              startDate={periodStart}
              endDate={periodEnd}
              onRangeChange={handlePeriodRangeChange}
              onPrev={handlePrevPeriod}
              onNext={handleNextPeriod}
            />

            <div className="flex gap-2 shrink-0">
              <ColumnVisibilityManager columns={allColumns} visibleColumns={visibleColumns} onVisibilityChange={setVisibleColumns} />
              <CalculationExport
                filters={exportFilters}
                currentItems={calculationRows}
                totalRecords={calculationRows.length}
                visibleColumns={visibleColumns}
              />
            </div>
          </div>
        </div>

        {/* Calculation table */}
        <div className="flex-1 min-h-0 overflow-auto">
          <CalculationTable
            visibleColumns={visibleColumns}
            data={calculationRows || []}
            totalsRow={totalsRow}
            isLoading={isLoading}
            className="h-full"
          />
        </div>
      </CardContent>

    </Card>
  );
}