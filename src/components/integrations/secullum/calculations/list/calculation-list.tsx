import React, { useState, useCallback, useMemo, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { useSecullumCalculations, useMySecullumCalculations, useUsers } from "../../../../../hooks";
import { useAuth } from "@/contexts/auth-context";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CalculationTable } from "./calculation-table";
import { CalculationExport } from "./calculation-export";
import { ColumnVisibilityManager } from "./column-visibility-manager";
import { createCalculationColumns } from "./calculation-table-columns";
import { cn } from "@/lib/utils";
import { useTableState } from "@/hooks/use-table-state";
import { ShowSelectedToggle } from "@/components/ui/show-selected-toggle";
import { useColumnVisibility } from "@/hooks/use-column-visibility";
import { USER_STATUS } from "../../../../../constants";
import { Combobox, type ComboboxOption } from "@/components/ui/combobox";
import { IconChevronLeft, IconChevronRight, IconCalendar } from "@tabler/icons-react";
import { addMonths, format, subMonths } from "date-fns";
import { ptBR } from "date-fns/locale";

type CalculationListMode = 'hr' | 'personal';

interface CalculationListProps {
  className?: string;
  /**
   * Mode determines the behavior:
   * - 'hr': Shows user selector, fetches all users (requires HR privileges) - default
   * - 'personal': Uses current user only, no user selector (accessible to all)
   */
  mode?: CalculationListMode;
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

const DEFAULT_PAGE_SIZE = 40;

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

export function CalculationList({ className, mode = 'hr' }: CalculationListProps) {
  const [searchParams, setSearchParams] = useSearchParams();
  const { user: currentUser } = useAuth();
  const isPersonalMode = mode === 'personal';

  // Get selected month from URL or default to current month
  const [selectedMonth, setSelectedMonth] = useState<Date>(() => {
    const monthParam = searchParams.get("month");
    if (monthParam) {
      try {
        return new Date(monthParam);
      } catch (e) {
        // Ignore invalid dates
      }
    }
    return new Date(); // Default to current month
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

  // Fetch users for filter (only in HR mode)
  const {
    data: usersData,
    isLoading: usersLoading,
  } = useUsers(
    isPersonalMode ? undefined : {
      statuses: [
        USER_STATUS.EXPERIENCE_PERIOD_1,
        USER_STATUS.EXPERIENCE_PERIOD_2,
        USER_STATUS.EFFECTED
      ],
      orderBy: { name: "asc" },
      take: 100,
    }
  );

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

  // Get table state for selected items functionality
  const { selectionCount, showSelectedOnly, toggleShowSelectedOnly } = useTableState({
    defaultPageSize: DEFAULT_PAGE_SIZE,
    resetSelectionOnPageChange: false,
  });

  // Visible columns state with localStorage persistence
  const { visibleColumns, setVisibleColumns } = useColumnVisibility(
    "calculation-list-visible-columns",
    new Set([
      "date", "entrada1", "saida1", "entrada2", "saida2",
      "normais", "ex50", "ex100", "dsr", "ajuste"
    ])
  );

  // Get all available columns for column visibility manager
  const allColumns = useMemo(() => createCalculationColumns(), []);

  // Build query parameters for Secullum API
  const queryParams = useMemo(() => {
    // In personal mode, we don't need a userId - backend uses authenticated user
    if (isPersonalMode) {
      if (!selectedMonth) return null;
      const period = getPayrollPeriod(selectedMonth);
      return {
        startDate: period.startDate,
        endDate: period.endDate,
      };
    }

    // In HR mode, we need a selected user
    if (!selectedUserId || !selectedMonth) {
      return null; // Don't fetch if required params are missing
    }

    const period = getPayrollPeriod(selectedMonth);

    // Build parameters for API call
    // The backend expects userId and will map it to Secullum employeeId
    const params: any = {
      userId: selectedUserId,           // Pass Ankaa userId
      startDate: period.startDate,      // Use startDate for backend
      endDate: period.endDate,          // Use endDate for backend
    };

    return params;
  }, [selectedUserId, selectedMonth, isPersonalMode]);

  // Fetch calculations from Secullum - use personal endpoint in personal mode
  const hrCalculations = useSecullumCalculations(!isPersonalMode ? queryParams : null);
  const personalCalculations = useMySecullumCalculations(isPersonalMode ? queryParams : undefined);

  // Select the active query based on mode
  const { data, isLoading, error } = isPersonalMode ? personalCalculations : hrCalculations;

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

  // Handle month change
  const handleMonthChange = (month: Date) => {
    setSelectedMonth(month);

    const params = new URLSearchParams(searchParams);
    params.set("month", format(month, "yyyy-MM-dd"));
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

  // Prepare user options for combobox
  const userOptions: ComboboxOption[] = useMemo(() => {
    if (!usersData?.data) return [];

    return usersData.data.map((user) => ({
      value: user.id,
      label: user.name,
    }));
  }, [usersData]);

  // Memoize export filters to prevent unnecessary re-renders
  const exportFilters = useMemo(() => ({
    selectedMonth,
    userId: selectedUserId,
  }), [selectedMonth, selectedUserId]);


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
        <div className="flex flex-col sm:flex-row gap-3 sm:items-end">
          <div className="flex-1 min-w-0">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              {/* User Selector - only shown in HR mode */}
              {!isPersonalMode && (
                <div className="flex gap-1 flex-1 min-w-0">
                  <Combobox
                    options={userOptions}
                    value={selectedUserId || ""}
                    onValueChange={(value) => handleUserChange(value || "")}
                    placeholder={usersLoading ? "Carregando funcionários..." : "Selecione um funcionário"}
                    emptyText="Nenhum funcionário encontrado"
                    searchable={true}
                    className="flex-1"
                    disabled={usersLoading}
                  />
                </div>
              )}

              {/* Month Selector */}
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  onClick={handlePreviousMonth}
                  className="h-10 w-10"
                >
                  <IconChevronLeft className="h-4 w-4" />
                </Button>

                <div className="flex flex-col items-center min-w-0">
                  <div className="flex items-center gap-1 text-sm font-medium">
                    <IconCalendar className="h-4 w-4" />
                    <span className="capitalize">{monthName}</span>
                  </div>
                  <div className="text-xs text-muted-foreground">
                    Período: {period}
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
            </div>
          </div>

          <div className="flex gap-2 shrink-0">
            <ShowSelectedToggle showSelectedOnly={showSelectedOnly} onToggle={toggleShowSelectedOnly} selectionCount={selectionCount} />
            <ColumnVisibilityManager columns={allColumns} visibleColumns={visibleColumns} onVisibilityChange={setVisibleColumns} />
            <CalculationExport
              filters={exportFilters}
              currentItems={calculationRows}
              totalRecords={calculationRows.length}
              visibleColumns={visibleColumns}
            />
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