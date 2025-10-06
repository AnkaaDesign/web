import { useState, useMemo, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { usePageTracker } from "@/hooks/use-page-tracker";
import { useColumnVisibility } from "@/hooks/use-column-visibility";
import { useTableState } from "@/hooks/use-table-state";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  IconFilter,
  IconRefresh,
  IconReceipt,
  IconCalculator,
  IconCheck,
  IconClock,
  IconAlertCircle,
  IconUsers,
  IconDownload
} from "@tabler/icons-react";
import { routes, SECTOR_PRIVILEGES, FAVORITE_PAGES } from "../../../constants";
import { PrivilegeRoute } from "@/components/navigation/privilege-route";
import { PageHeaderWithFavorite } from "@/components/ui/page-header-with-favorite";
import { PayrollFilters } from "@/components/human-resources/payroll/list/payroll-filters";
import { PayrollSummary } from "@/components/human-resources/payroll/list/payroll-summary";
import { PayrollExport } from "@/components/human-resources/payroll/export/payroll-export";
import { PayrollColumnVisibilityManager } from "@/components/human-resources/payroll/list/payroll-column-visibility-manager";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Separator } from "@/components/ui/separator";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { usePayrollBonuses } from "../../../hooks";
import { isUserEligibleForBonus, getCurrentPayrollPeriod } from "../../../utils";
import { StandardizedTable } from "@/components/ui/standardized-table";
import type { StandardizedColumn } from "@/components/ui/standardized-table";

// Extended filters interface with payroll-specific fields
interface PayrollFiltersData {
  year?: number;
  months?: string[];
  performanceLevels?: number[];
  sectorIds?: string[];
  positionIds?: string[];
  userIds?: string[];
  excludeUserIds?: string[];
}

// Helper to parse filters from URL
function parseFiltersFromUrl(searchParams: URLSearchParams): PayrollFiltersData {
  const filters: PayrollFiltersData = {};

  const yearParam = searchParams.get('year');
  if (yearParam) {
    const year = parseInt(yearParam, 10);
    if (!isNaN(year)) filters.year = year;
  }

  const monthsParam = searchParams.get('months');
  if (monthsParam) {
    try {
      const months = JSON.parse(monthsParam);
      if (Array.isArray(months)) filters.months = months;
    } catch {
      // Ignore parsing errors
    }
  }

  const performanceLevelsParam = searchParams.get('performanceLevels');
  if (performanceLevelsParam) {
    try {
      const levels = JSON.parse(performanceLevelsParam);
      if (Array.isArray(levels)) filters.performanceLevels = levels;
    } catch {
      // Ignore parsing errors
    }
  }

  const sectorIdsParam = searchParams.get('sectorIds');
  if (sectorIdsParam) {
    try {
      const ids = JSON.parse(sectorIdsParam);
      if (Array.isArray(ids)) filters.sectorIds = ids;
    } catch {
      // Ignore parsing errors
    }
  }

  const positionIdsParam = searchParams.get('positionIds');
  if (positionIdsParam) {
    try {
      const ids = JSON.parse(positionIdsParam);
      if (Array.isArray(ids)) filters.positionIds = ids;
    } catch {
      // Ignore parsing errors
    }
  }

  const userIdsParam = searchParams.get('userIds');
  if (userIdsParam) {
    try {
      const ids = JSON.parse(userIdsParam);
      if (Array.isArray(ids)) filters.userIds = ids;
    } catch {
      // Ignore parsing errors
    }
  }

  const excludeUserIdsParam = searchParams.get('excludeUserIds');
  if (excludeUserIdsParam) {
    try {
      const ids = JSON.parse(excludeUserIdsParam);
      if (Array.isArray(ids)) filters.excludeUserIds = ids;
    } catch {
      // Ignore parsing errors
    }
  }

  return filters;
}

// Helper to update filters in URL
function updateFiltersInUrl(
  searchParams: URLSearchParams,
  filters: PayrollFiltersData,
  defaultFilters: PayrollFiltersData
) {
  // Year
  if (filters.year && filters.year !== defaultFilters.year) {
    searchParams.set('year', filters.year.toString());
  } else {
    searchParams.delete('year');
  }

  // Months
  if (filters.months && filters.months.length > 0) {
    const defaultMonthsStr = JSON.stringify(defaultFilters.months || []);
    const currentMonthsStr = JSON.stringify(filters.months);
    if (currentMonthsStr !== defaultMonthsStr) {
      searchParams.set('months', currentMonthsStr);
    } else {
      searchParams.delete('months');
    }
  } else {
    searchParams.delete('months');
  }

  // Performance levels
  if (filters.performanceLevels && filters.performanceLevels.length > 0) {
    searchParams.set('performanceLevels', JSON.stringify(filters.performanceLevels));
  } else {
    searchParams.delete('performanceLevels');
  }

  // Sector IDs
  if (filters.sectorIds && filters.sectorIds.length > 0) {
    searchParams.set('sectorIds', JSON.stringify(filters.sectorIds));
  } else {
    searchParams.delete('sectorIds');
  }

  // Position IDs
  if (filters.positionIds && filters.positionIds.length > 0) {
    searchParams.set('positionIds', JSON.stringify(filters.positionIds));
  } else {
    searchParams.delete('positionIds');
  }

  // User IDs
  if (filters.userIds && filters.userIds.length > 0) {
    searchParams.set('userIds', JSON.stringify(filters.userIds));
  } else {
    searchParams.delete('userIds');
  }

  // Exclude User IDs
  if (filters.excludeUserIds && filters.excludeUserIds.length > 0) {
    searchParams.set('excludeUserIds', JSON.stringify(filters.excludeUserIds));
  } else {
    searchParams.delete('excludeUserIds');
  }
}

// Payroll row interface for table display
interface PayrollRow {
  id: string;
  userId: string;
  userName: string;
  userEmail?: string;
  userCpf?: string;
  payrollNumber?: string;
  position?: { id: string; name: string; remuneration?: number; bonifiable?: boolean };
  sector?: { id: string; name: string };
  performanceLevel: number;
  status: string;

  // Payroll data
  payrollId?: string;
  baseRemuneration: number;
  totalDiscounts: number;
  netSalary: number;

  // Bonus data
  bonusAmount: number;
  tasksCompleted: number;
  averageTasks: number;
  totalWeightedTasks: number;
  bonusStatus: 'live' | 'saved';

  // Month info for multi-month display
  monthLabel?: string;
  month: number;
  year: number;
}

// Helper functions for payroll period logic
function isAfterDay26(year: number, month: number): boolean {
  const today = new Date();
  const currentYear = today.getFullYear();
  const currentMonth = today.getMonth() + 1;
  const currentDay = today.getDate();

  // If it's a future period, bonuses are not yet available
  if (year > currentYear || (year === currentYear && month > currentMonth)) {
    return false;
  }

  // If it's a past period, bonuses should be confirmed
  if (year < currentYear || (year === currentYear && month < currentMonth)) {
    return true;
  }

  // For current period, check if we're after day 26
  return currentDay > 26;
}

function getBonusStatus(
  year: number,
  month: number,
): {
  status: "live" | "saved" | "confirmed";
  label: string;
  description: string;
  icon: React.ReactNode;
  variant: "default" | "secondary" | "success" | "warning" | "destructive";
} {
  const afterDay26 = isAfterDay26(year, month);

  if (afterDay26) {
    return {
      status: "confirmed",
      label: "Bonificações Confirmadas",
      description: "Bonificações salvas e finalizadas para este período",
      icon: <IconCheck className="h-4 w-4" />,
      variant: "success",
    };
  } else {
    return {
      status: "live",
      label: "Cálculo Provisório",
      description: "Cálculo em tempo real - bonificações serão confirmadas após o dia 26",
      icon: <IconClock className="h-4 w-4" />,
      variant: "warning",
    };
  }
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL'
  }).format(value);
}

// PayrollTableComponent - Simple table for displaying payroll data
interface PayrollTableComponentProps {
  data: PayrollRow[];
  visibleColumns: Set<string>;
  onRowClick: (row: PayrollRow) => void;
  isLoading: boolean;
  error: any;
  multiMonth: boolean;
  onSort?: (columnKey: string) => void;
  getSortDirection?: (columnKey: string) => "asc" | "desc" | null;
  getSortOrder?: (columnKey: string) => number | null;
  sortConfigs?: Array<{ column: string; direction: "asc" | "desc" }>;
}

function PayrollTableComponent({
  data,
  visibleColumns,
  onRowClick,
  isLoading,
  error,
  multiMonth,
  onSort,
  getSortDirection,
  getSortOrder,
  sortConfigs = []
}: PayrollTableComponentProps) {
  // Define all possible columns with improved design like old implementation
  const allColumns: StandardizedColumn<PayrollRow>[] = [
    // Month column - always available, shown automatically when multiple months selected
    {
      key: "month",
      header: "Período",
      accessor: (row: PayrollRow) => row.monthLabel || "-",
      sortable: true,
      className: "font-medium text-sm w-32 truncate",
      align: "left" as const,
    },

    // Core identification columns (cleaner layout)
    {
      key: "payrollNumber",
      header: "Nº Folha",
      accessor: (row: PayrollRow) => row.payrollNumber || "-",
      sortable: true,
      className: "font-mono text-xs w-24 truncate",
      align: "left" as const,
    },
    {
      key: "user.name",
      header: "Colaborador",
      accessor: (row: PayrollRow) => row.userName,
      sortable: true,
      className: "font-medium text-sm w-40 truncate",
      align: "left" as const,
    },
    {
      key: "position.name",
      header: "Cargo",
      accessor: (row: PayrollRow) => row.position?.name || "-",
      sortable: true,
      className: "text-sm w-36 truncate",
      align: "left" as const,
    },
    {
      key: "sector.name",
      header: "Setor",
      accessor: (row: PayrollRow) => row.sector?.name || "-",
      sortable: true,
      className: "text-sm w-24 truncate",
      align: "left" as const,
    },
    {
      key: "performanceLevel",
      header: "Desempenho",
      accessor: (row: PayrollRow) => row.performanceLevel || 0,
      sortable: true,
      className: "text-sm w-24 truncate",
      align: "left" as const,
    },

    // Task statistics columns (improved layout)
    {
      key: "tasksCompleted",
      header: "Tarefas",
      accessor: (row: PayrollRow) => {
        // Check if user is eligible for bonus
        const isEligible = row.position?.bonifiable && row.performanceLevel > 0;
        return isEligible ? row.tasksCompleted.toFixed(1) : "-";
      },
      sortable: true,
      className: "text-sm w-24 font-medium truncate",
      align: "left" as const,
    },
    {
      key: "totalWeightedTasks",
      header: "Ponderadas",
      accessor: (row: PayrollRow) => {
        // Check if user is eligible for bonus
        const isEligible = row.position?.bonifiable && row.performanceLevel > 0;
        return isEligible ? row.totalWeightedTasks.toFixed(1) : "-";
      },
      sortable: true,
      className: "text-sm w-24 font-medium truncate",
      align: "left" as const,
    },
    {
      key: "averageTasks",
      header: "Média",
      accessor: (row: PayrollRow) => {
        // Check if user is eligible for bonus
        const isEligible = row.position?.bonifiable && row.performanceLevel > 0;
        return isEligible ? row.averageTasks.toFixed(1) : "-";
      },
      sortable: true,
      className: "text-sm w-24 font-medium truncate",
      align: "left" as const,
    },

    // Financial columns (better formatted)
    {
      key: "remuneration",
      header: "Salário Base",
      accessor: (row: PayrollRow) => formatCurrency(row.baseRemuneration),
      sortable: true,
      className: "text-sm w-28 font-mono truncate",
      align: "left" as const,
    },
    {
      key: "bonus",
      header: "Bônus",
      accessor: (row: PayrollRow) => {
        // Check if user is eligible for bonus
        const isEligible = row.position?.bonifiable && row.performanceLevel > 0;

        if (!isEligible) {
          return <span className="text-muted-foreground text-sm whitespace-nowrap">Não elegível</span>;
        }

        return <span className="whitespace-nowrap">{formatCurrency(row.bonusAmount)}</span>;
      },
      sortable: true,
      className: "text-sm w-32 truncate",
      align: "left" as const,
    },
    {
      key: "totalEarnings",
      header: "Total Bruto",
      accessor: (row: PayrollRow) => formatCurrency(row.baseRemuneration + row.bonusAmount),
      sortable: true,
      className: "text-sm w-32 font-mono font-semibold truncate",
      align: "left" as const,
    },
    {
      key: "netSalary",
      header: "Líquido",
      accessor: (row: PayrollRow) => formatCurrency(row.netSalary),
      sortable: true,
      className: "text-sm w-32 font-mono font-bold text-green-600 truncate",
      align: "left" as const,
    },

    // Additional information columns
    {
      key: "user.cpf",
      header: "CPF",
      accessor: (row: PayrollRow) => row.userCpf || "-",
      sortable: true,
      className: "font-mono text-xs w-24 truncate",
      align: "left" as const,
    },
  ];

  // Filter columns based on visibility
  const columns = allColumns.filter(column => visibleColumns.has(column.key));

  return (
    <StandardizedTable<PayrollRow>
      columns={columns}
      data={data}
      getItemKey={(row) => row.id}
      onRowClick={onRowClick}
      isLoading={isLoading}
      error={error}
      emptyMessage="Nenhuma folha de pagamento encontrada"
      emptyDescription="Selecione um período para visualizar a folha de pagamento"
      emptyIcon={IconUsers}
      showPagination={false}
      showPageInfo={false}
      currentPage={0}
      totalPages={1}
      pageSize={data.length}
      totalRecords={data.length}
      className="border-0"
      onSort={onSort}
      getSortDirection={getSortDirection}
      getSortOrder={getSortOrder}
      sortConfigs={sortConfigs}
    />
  );
}

// Get current year and month as defaults
function getDefaultFilters(): PayrollFiltersData {
  // Use centralized period utility (26th-25th cycle)
  // If today is Sept 26th or later, this returns October
  const { year, month } = getCurrentPayrollPeriod();

  return {
    year,
    months: [String(month).padStart(2, "0")],
  };
}

/**
 * Helper function to determine if a bonus period has closed
 * The bonus period closes on the 26th of the month AFTER the payroll month
 * @param payrollMonth - The month of the payroll (1-12)
 * @param payrollYear - The year of the payroll
 * @param currentDate - The current date (defaults to now)
 * @returns true if the bonus period has closed
 */
function isBonusPeriodClosed(payrollMonth: number, payrollYear: number, currentDate = new Date()): boolean {
  const currentYear = currentDate.getFullYear();
  const currentMonth = currentDate.getMonth() + 1; // JavaScript months are 0-based
  const currentDay = currentDate.getDate();

  // Calculate closure date (26th of the month after payroll month)
  let closureMonth = payrollMonth + 1;
  let closureYear = payrollYear;

  // Handle year transition (December -> January)
  if (closureMonth > 12) {
    closureMonth = 1;
    closureYear = payrollYear + 1;
  }

  // Check if we're past the closure date
  if (currentYear > closureYear) {
    return true;
  } else if (currentYear === closureYear) {
    if (currentMonth > closureMonth) {
      return true;
    } else if (currentMonth === closureMonth && currentDay >= 26) {
      return true;
    }
  }

  return false;
}

/**
 * Helper function to determine if a payroll is live vs saved
 * @param payroll - The payroll object
 * @param payrollMonth - The month of the payroll
 * @param payrollYear - The year of the payroll
 * @returns true if the payroll is live (can be modified), false if saved (locked)
 */
function isPayrollLive(payroll: any, payrollMonth: number, payrollYear: number): boolean {
  // Check if payroll has a real database ID (not a temporary one)
  const hasRealPayrollId = payroll.id && !payroll.id.startsWith('00000000-');

  // Check if bonus period has closed
  const bonusPeriodClosed = isBonusPeriodClosed(payrollMonth, payrollYear);

  // Determine live status based on business rules
  if (!hasRealPayrollId) {
    // No real database ID means it's a temporary/calculated payroll
    return true;
  } else if (!bonusPeriodClosed) {
    // Even saved payrolls are considered "live" if bonus period is still open
    return true;
  } else if (payroll.isLive === true || payroll.isTemporary === true) {
    // Explicit override flags
    return true;
  } else {
    // Has real ID and bonus period is closed = truly saved
    return false;
  }
}

export default function PayrollListPage() {
  // Track page access
  usePageTracker({
    title: "Folha de Pagamento",
    icon: "receipt",
  });

  // Navigation
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  // URL state management for sorting
  const {
    sortConfigs,
    toggleSort,
    getSortDirection,
    getSortOrder,
  } = useTableState({
    defaultSort: [{ column: 'user.name', direction: 'asc' }]
  });

  // Initialize filters from URL or defaults
  const defaultFilters = useMemo(() => getDefaultFilters(), []);
  const urlFilters = useMemo(() => parseFiltersFromUrl(searchParams), [searchParams]);
  const initialFilters = useMemo(() => {
    // If URL has filters, use them; otherwise use defaults
    const hasUrlFilters = searchParams.has('year') || searchParams.has('months');
    return hasUrlFilters ? { ...defaultFilters, ...urlFilters } : defaultFilters;
  }, [defaultFilters, urlFilters, searchParams]);

  // State management
  const [filters, setFilters] = useState<PayrollFiltersData>(initialFilters);
  const [showFilters, setShowFilters] = useState(false);
  const { visibleColumns: baseVisibleColumns, setVisibleColumns } = useColumnVisibility(
    "payroll-list-visible-columns",
    new Set([
      'user.name',
      'position.name',
      'performanceLevel',
      'averageTasks',
      'bonus',
      'remuneration',
      'totalEarnings',
    ])
  );
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Automatically add "month" column when multiple months are selected
  const visibleColumns = useMemo(() => {
    const columns = new Set(baseVisibleColumns);
    const isMultiMonth = filters.months && filters.months.length > 1;

    console.log('Column visibility update:', {
      isMultiMonth,
      monthsCount: filters.months?.length,
      baseColumns: Array.from(baseVisibleColumns),
      hasMonth: baseVisibleColumns.has('month')
    });

    if (isMultiMonth) {
      // Always show month column when multiple months are selected
      columns.add('month');
      console.log('Added month column, final columns:', Array.from(columns));
    } else {
      // Hide month column in single-month view
      columns.delete('month');
    }

    return columns;
  }, [baseVisibleColumns, filters.months]);

  // Mutations

  // Prepare month parameters (up to 12 months max)
  const monthParams = useMemo(() => {
    const params: Array<{ month: number; year: number; monthStr: string }> = [];

    if (filters.year && filters.months && filters.months.length > 0) {
      filters.months.forEach(monthStr => {
        params.push({
          month: parseInt(monthStr),
          year: filters.year!,
          monthStr
        });
      });
    }

    // Pad to 12 to keep hook count stable
    while (params.length < 12) {
      params.push({ month: 0, year: 0, monthStr: '00' });
    }

    return params;
  }, [filters.year, filters.months]);

  // Call hooks a fixed 12 times (max months), conditionally enable them
  const query0 = usePayrollBonuses(monthParams[0].year, monthParams[0].month);
  const query1 = usePayrollBonuses(monthParams[1].year, monthParams[1].month);
  const query2 = usePayrollBonuses(monthParams[2].year, monthParams[2].month);
  const query3 = usePayrollBonuses(monthParams[3].year, monthParams[3].month);
  const query4 = usePayrollBonuses(monthParams[4].year, monthParams[4].month);
  const query5 = usePayrollBonuses(monthParams[5].year, monthParams[5].month);
  const query6 = usePayrollBonuses(monthParams[6].year, monthParams[6].month);
  const query7 = usePayrollBonuses(monthParams[7].year, monthParams[7].month);
  const query8 = usePayrollBonuses(monthParams[8].year, monthParams[8].month);
  const query9 = usePayrollBonuses(monthParams[9].year, monthParams[9].month);
  const query10 = usePayrollBonuses(monthParams[10].year, monthParams[10].month);
  const query11 = usePayrollBonuses(monthParams[11].year, monthParams[11].month);

  // Collect only the active queries
  const payrollData = [query0, query1, query2, query3, query4, query5, query6, query7, query8, query9, query10, query11];
  const activePayrollData = payrollData.filter((_, index) => monthParams[index].month > 0);
  const payrollQueries = monthParams.filter(p => p.month > 0);

  // Combine loading states
  const isLoading = activePayrollData.some(query => query.isLoading);
  const hasError = activePayrollData.some(query => query.error);
  const errors = activePayrollData.filter(query => query.error).map(query => query.error);

  // Process and combine all payroll data
  const processedPayrolls = useMemo(() => {
    const combined: PayrollRow[] = [];

    activePayrollData.forEach((query, activeIndex) => {
      if (!query.data) return;

      const { year, month, monthStr } = payrollQueries[activeIndex];
      // Get month name in Portuguese and format as title case (first letter uppercase)
      const monthName = new Date(year, month - 1).toLocaleDateString('pt-BR', { month: 'short' });
      // Remove the dot at the end if present (e.g., "jan." -> "jan")
      const cleanMonthName = monthName.replace('.', '');
      // Format as title case: "Jan - 2025"
      const monthLabel = `${cleanMonthName.charAt(0).toUpperCase() + cleanMonthName.slice(1)} - ${year}`;

      // Check if query.data has a nested data property (API response wrapper) or is the array directly
      const payrollsArray = Array.isArray(query.data)
        ? query.data
        : (query.data?.data && Array.isArray(query.data.data)
          ? query.data.data
          : []);

      console.log(`Processing payrolls for ${month}/${year}:`, payrollsArray);

      // Calculate period-wide statistics like the old implementation
      // All users show the SAME task count (total tasks for the period)
      // All users show the SAME average (total tasks divided by eligible users)
      let totalTasksForPeriod = 0;
      let eligibleUsersCount = 0;
      let hasValidBonusData = false;

      // First pass: calculate totals for the period
      payrollsArray.forEach((payroll: any) => {
        if (!payroll?.user) return;
        const user = payroll.user;
        const bonus = payroll.bonus;

        // Check if user is eligible for bonus
        const isEligible = isUserEligibleForBonus(user);
        if (isEligible) {
          eligibleUsersCount++;

          // Use bonus data to get period totals
          if (bonus) {
            hasValidBonusData = true;
            // For live calculations, use totalTasks from bonus service
            if (bonus.totalTasks !== undefined) {
              totalTasksForPeriod = Number(bonus.totalTasks) || 0;
            } else if (bonus.tasks && Array.isArray(bonus.tasks)) {
              // Legacy: calculate from task array if available
              const fullTasks = bonus.tasks.filter((t: any) => t.commission === 'FULL_COMMISSION').length;
              const partialTasks = bonus.tasks.filter((t: any) => t.commission === 'PARTIAL_COMMISSION').length;
              totalTasksForPeriod = Math.max(totalTasksForPeriod, fullTasks + (partialTasks * 0.5));
            }
          }
        }
      });

      // Calculate the average tasks per eligible user (same for all users in old implementation)
      const averageTasksPerUser = eligibleUsersCount > 0 ? totalTasksForPeriod / eligibleUsersCount : 0;

      console.log(`Period ${month}/${year} stats:`, {
        totalTasksForPeriod,
        eligibleUsersCount,
        averageTasksPerUser,
        hasValidBonusData
      });

      // Second pass: create payroll rows with period-wide statistics
      payrollsArray.forEach((payroll: any) => {
        // Enhanced data validation - handle all edge cases
        if (!payroll) {
          console.warn('Null/undefined payroll data detected, skipping');
          return;
        }

        if (!payroll.user) {
          console.warn('Payroll missing user data:', payroll);
          return;
        }

        const user = payroll.user;
        const bonus = payroll.bonus;

        // Ensure user has required basic fields
        if (!user.id) {
          console.warn('User missing ID field:', user);
          return;
        }

        // Apply filters with proper null/undefined handling
        if (filters.sectorIds && filters.sectorIds.length > 0 && !filters.sectorIds.includes(user?.sectorId)) {
          return;
        }

        if (filters.positionIds && filters.positionIds.length > 0 && !filters.positionIds.includes(user?.positionId)) {
          return;
        }

        if (filters.userIds && filters.userIds.length > 0 && !filters.userIds.includes(user?.id)) {
          return;
        }

        if (filters.excludeUserIds && filters.excludeUserIds.length > 0 && filters.excludeUserIds.includes(user?.id)) {
          return;
        }

        if (filters.performanceLevels && filters.performanceLevels.length > 0 && !filters.performanceLevels.includes(user?.performanceLevel || 0)) {
          return;
        }

        // Determine bonus eligibility using proper business logic
        const isEligibleForBonus = isUserEligibleForBonus(user);

        // Use period-wide statistics (like old working implementation)
        // All eligible users show the SAME task count and average
        let tasksCompleted = 0;
        let averageTasks = 0;

        if (isEligibleForBonus && hasValidBonusData) {
          // Show total tasks for the period (same for all users)
          tasksCompleted = totalTasksForPeriod;
          // Show average tasks per user (same for all users)
          averageTasks = averageTasksPerUser;
        }

        // Calculate the discounts total with proper number handling
        const totalDiscounts = payroll.discounts && Array.isArray(payroll.discounts)
          ? payroll.discounts.reduce((sum: number, discount: any) => {
              if (!discount) return sum;
              const discountValue = discount.value ? Number(discount.value) : 0;
              return sum + (isNaN(discountValue) ? 0 : discountValue);
            }, 0)
          : 0;

        // Calculate net salary components with proper null handling and bonus eligibility
        const baseRemuneration = Number(payroll.baseRemuneration) || 0;

        // Only include bonus for eligible users
        const bonusAmount = isEligibleForBonus && bonus?.baseBonus
          ? Number(bonus.baseBonus) || 0
          : 0;

        const netSalary = baseRemuneration + bonusAmount - totalDiscounts;

        // Use the user's payroll number (employee registration number)
        // This is NOT the payroll ID, but the employee's permanent registration number
        const payrollNumber = user.payrollNumber || "-";

        // Determine if this is a live calculation vs saved payroll
        // Uses helper function that implements the complete business logic
        const isLiveCalculation = isPayrollLive(payroll, month, year);

        const row: PayrollRow = {
          id: filters.months && filters.months.length > 1 ? `${payroll.id || `${user.id}-${month}`}` : (payroll.id || user.id),
          userId: user.id,
          userName: user.name || 'Sem nome',
          userEmail: user.email,
          userCpf: user.cpf,
          payrollNumber: payrollNumber,
          position: user.position,
          sector: user.sector,
          performanceLevel: payroll.performanceLevel || bonus?.performanceLevel || user.performanceLevel || 0,
          status: payroll.status || user.status || 'ACTIVE',

          // Payroll data
          payrollId: payroll.id,
          baseRemuneration: baseRemuneration,
          totalDiscounts: totalDiscounts,
          netSalary: netSalary,

          // Bonus data
          bonusAmount: bonusAmount,
          tasksCompleted,
          averageTasks,
          totalWeightedTasks: totalTasksForPeriod, // Same for all users - total weighted tasks
          // Use the calculated isLiveCalculation flag
          bonusStatus: isLiveCalculation ? 'live' : 'saved',

          // Month info
          monthLabel,
          month,
          year,
        };

        combined.push(row);
      });
    });

    // Apply sorting
    if (sortConfigs.length === 0) {
      return combined;
    }

    return [...combined].sort((a, b) => {
      for (const config of sortConfigs) {
        let aValue: any;
        let bValue: any;

        // Map column keys to actual field names
        const columnKey = config.column;

        // Handle special mappings for column keys that don't match field names
        if (columnKey === 'user.name') {
          aValue = a.userName;
          bValue = b.userName;
        } else if (columnKey === 'remuneration') {
          aValue = a.baseRemuneration;
          bValue = b.baseRemuneration;
        } else if (columnKey === 'bonus') {
          aValue = a.bonusAmount;
          bValue = b.bonusAmount;
        } else if (columnKey === 'totalEarnings') {
          aValue = a.baseRemuneration + a.bonusAmount;
          bValue = b.baseRemuneration + b.bonusAmount;
        } else if (columnKey === 'netSalary') {
          aValue = a.netSalary;
          bValue = b.netSalary;
        } else if (columnKey === 'user.cpf') {
          aValue = a.userCpf;
          bValue = b.userCpf;
        } else {
          // Handle nested paths for other fields
          const path = columnKey.split('.');

          if (path.length === 1) {
            // Direct field
            aValue = a[path[0] as keyof PayrollRow];
            bValue = b[path[0] as keyof PayrollRow];
          } else if (path.length === 2) {
            // Nested field (e.g., position.name, sector.name)
            const parent = path[0] as keyof PayrollRow;
            const child = path[1];
            aValue = (a[parent] as any)?.[child];
            bValue = (b[parent] as any)?.[child];
          }
        }

        // Handle null/undefined values
        if (aValue === null || aValue === undefined) aValue = '';
        if (bValue === null || bValue === undefined) bValue = '';

        // Compare values
        let comparison = 0;
        if (typeof aValue === 'string' && typeof bValue === 'string') {
          comparison = aValue.localeCompare(bValue, 'pt-BR');
        } else if (typeof aValue === 'number' && typeof bValue === 'number') {
          comparison = aValue - bValue;
        } else {
          comparison = String(aValue).localeCompare(String(bValue), 'pt-BR');
        }

        // Apply direction
        if (comparison !== 0) {
          return config.direction === 'asc' ? comparison : -comparison;
        }
      }
      return 0;
    });
  }, [activePayrollData, payrollQueries, filters, sortConfigs]);

  // Handle filter application
  const handleApplyFilters = async (newFilters: PayrollFiltersData) => {
    setIsRefreshing(true);
    setFilters(newFilters);
    setShowFilters(false);

    // Update URL with new filters
    setSearchParams((prev) => {
      const newParams = new URLSearchParams(prev);
      updateFiltersInUrl(newParams, newFilters, defaultFilters);
      return newParams;
    }, { replace: true });

    // Small delay to show loading state
    setTimeout(() => {
      setIsRefreshing(false);
    }, 300);
  };

  // Reset filters to default
  const handleResetFilters = async () => {
    setIsRefreshing(true);
    const resetFilters = getDefaultFilters();
    setFilters(resetFilters);
    setShowFilters(false);

    // Clear filters from URL
    setSearchParams((prev) => {
      const newParams = new URLSearchParams(prev);
      updateFiltersInUrl(newParams, resetFilters, defaultFilters);
      return newParams;
    }, { replace: true });

    // Small delay to show loading state
    setTimeout(() => {
      setIsRefreshing(false);
    }, 300);
  };

  // Handle refreshing data
  const handleRefresh = () => {
    setIsRefreshing(true);
    // Invalidate all payroll queries to force refetch
    activePayrollData.forEach(query => query.refetch());

    setTimeout(() => {
      setIsRefreshing(false);
    }, 500);
  };

  // Handle navigation to bonus simulation
  const handleNavigateToSimulation = () => {
    navigate(routes.administration.bonus.simulation);
  };


  // Handle row click
  const handleRowClick = (row: PayrollRow) => {
    // For live calculations, we need to pass the user/year/month to fetch details
    // For saved payrolls, we can use the payrollId
    if (row.bonusStatus === 'saved' && row.payrollId) {
      // Saved payroll - navigate with ID
      navigate(routes.humanResources.payroll.detail(row.payrollId));
    } else {
      // Live calculation - navigate with user/year/month parameters
      // We'll use a special format for live payrolls
      const liveId = `${row.userId}_${row.year}_${row.month}`;
      navigate(routes.humanResources.payroll.detail(liveId));
    }
  };

  // Calculate period status for display
  const periodStatus = useMemo(() => {
    if (!filters.year || !filters.months || filters.months.length === 0) {
      return null;
    }

    // For single month, get the status
    if (filters.months.length === 1) {
      const month = parseInt(filters.months[0]);
      return getBonusStatus(filters.year, month);
    }

    // For multiple months, show general info
    return {
      status: "multiple" as const,
      label: "Múltiplos Períodos",
      description: `${filters.months.length} meses selecionados`,
      icon: <IconAlertCircle className="h-4 w-4" />,
      variant: "default" as const,
    };
  }, [filters.year, filters.months]);

  // Count active filters (excluding defaults)
  const activeFiltersCount = useMemo(() => {
    const defaultFilters = getDefaultFilters();
    let count = 0;

    // Count non-default year
    if (filters.year && filters.year !== defaultFilters.year) count++;

    // Count non-default months (more than 1 or different than current)
    if (filters.months && (filters.months.length !== 1 || filters.months[0] !== defaultFilters.months?.[0])) count++;

    // Count other filters
    if (filters.userIds && filters.userIds.length > 0) count++;
    if (filters.excludeUserIds && filters.excludeUserIds.length > 0) count++;
    if (filters.sectorIds && filters.sectorIds.length > 0) count++;
    if (filters.positionIds && filters.positionIds.length > 0) count++;
    if (filters.performanceLevels && filters.performanceLevels.length > 0) count++;

    return count;
  }, [filters]);

  return (
    <PrivilegeRoute requiredPrivilege={[SECTOR_PRIVILEGES.HUMAN_RESOURCES, SECTOR_PRIVILEGES.ADMIN]}>
      <div className="flex flex-col h-full space-y-4">
        {/* Page Header */}
        <div className="flex-shrink-0">
          <PageHeaderWithFavorite
            title="Folha de Pagamento"
            icon={IconReceipt}
            favoritePage={FAVORITE_PAGES.ADMINISTRACAO_FOLHA_DE_PAGAMENTO}
            breadcrumbs={[{ label: "Início", href: routes.home }, { label: "Administração" }, { label: "Folha de Pagamento" }]}
            description={(() => {
              if (filters.year && filters.months && filters.months.length > 0) {
                if (filters.months.length === 1) {
                  const monthName = new Date(filters.year, parseInt(filters.months[0]) - 1).toLocaleDateString("pt-BR", { month: "long" });
                  return `Período: ${monthName} de ${filters.year}`;
                } else {
                  return `Período: ${filters.months.length} meses de ${filters.year}`;
                }
              }
              return "Visualização da folha de pagamento com cálculos de comissões e bonificações";
            })()}
            actions={[]}
          />
        </div>


        {/* Error Alert */}
        {hasError && (
          <Alert variant="destructive">
            <IconAlertCircle className="h-4 w-4" />
            <AlertDescription>
              Erro ao carregar dados da folha de pagamento. Verifique a conexão e tente novamente.
            </AlertDescription>
          </Alert>
        )}

        {/* Table and Controls Card */}
        <div className="flex-1 overflow-hidden">
          <Card className="h-full flex flex-col shadow-sm border border-border">
            {/* Actions Bar */}
            <CardContent className="pt-6 pb-4">
              <div className="flex items-center justify-between gap-4">
                {/* Left side - Filters and Controls */}
                <div className="flex items-center gap-2 h-9">
                  <Button
                    onClick={() => setShowFilters(!showFilters)}
                    variant={activeFiltersCount > 0 ? "secondary" : "outline"}
                    size="sm"
                    className="h-9"
                  >
                    <IconFilter className="mr-2 h-4 w-4" />
                    Filtros
                    {activeFiltersCount > 0 && (
                      <Badge variant="default" className="ml-2">
                        {activeFiltersCount}
                      </Badge>
                    )}
                  </Button>

                  {activeFiltersCount > 0 && (
                    <Button onClick={handleResetFilters} variant="outline" size="sm" className="h-9">
                      <IconRefresh className="mr-2 h-4 w-4" />
                      Resetar
                    </Button>
                  )}

                  <Button onClick={handleRefresh} variant="outline" size="sm" disabled={isRefreshing} className="h-9">
                    <IconRefresh className={`mr-2 h-4 w-4 ${isRefreshing || isLoading ? "animate-spin" : ""}`} />
                    {isRefreshing ? "Atualizando..." : "Atualizar"}
                  </Button>

                  <Separator orientation="vertical" className="h-6" />

                  <PayrollColumnVisibilityManager
                    visibleColumns={visibleColumns}
                    onVisibilityChange={setVisibleColumns}
                  />
                </div>

                {/* Right side - Actions */}
                <div className="flex gap-2 h-9">
                  <Button onClick={handleNavigateToSimulation} variant="outline" size="sm" className="h-9">
                    <IconCalculator className="mr-2 h-4 w-4" />
                    Simular Bônus
                  </Button>

                  <PayrollExport
                    filters={filters}
                    currentPageData={processedPayrolls}
                    totalRecords={processedPayrolls.length}
                    visibleColumns={visibleColumns}
                  />
                </div>
              </div>
            </CardContent>

            {/* Table Content */}
            <CardContent className="flex-1 overflow-hidden px-6 py-0 relative">
              <div className="h-full">
                <PayrollTableComponent
                  data={processedPayrolls}
                  visibleColumns={visibleColumns}
                  onRowClick={handleRowClick}
                  isLoading={isLoading}
                  error={hasError ? errors[0] : null}
                  multiMonth={filters.months ? filters.months.length > 1 : false}
                  onSort={toggleSort}
                  getSortDirection={getSortDirection}
                  getSortOrder={getSortOrder}
                  sortConfigs={sortConfigs}
                />
              </div>

              {/* Loading overlay */}
              {(isRefreshing || isLoading) && (
                <div className="absolute inset-0 bg-background/80 backdrop-blur-sm flex items-center justify-center z-10">
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <IconRefresh className="h-4 w-4 animate-spin" />
                    <span className="text-sm font-medium">
                      {isRefreshing ? "Aplicando filtros..." : "Carregando dados..."}
                    </span>
                  </div>
                </div>
              )}
            </CardContent>

            {/* Summary - At bottom */}
            {processedPayrolls.length > 0 && (
              <div className="px-6 pb-6">
                <PayrollSummary users={processedPayrolls} />
              </div>
            )}
          </Card>
        </div>

        {/* Filters Modal */}
        <PayrollFilters
          open={showFilters}
          onOpenChange={setShowFilters}
          filters={filters}
          onApplyFilters={handleApplyFilters}
        />
      </div>
    </PrivilegeRoute>
  );
}
