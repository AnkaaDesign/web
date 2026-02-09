import React, { useState, useMemo, useEffect, useCallback } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { usePageTracker } from "@/hooks/common/use-page-tracker";
import { useColumnVisibility } from "@/hooks/common/use-column-visibility";
import { useTableState } from "@/hooks/common/use-table-state";
import { Card, CardContent } from "@/components/ui/card";
import {
  IconFilter,
  IconRefresh,
  IconCalculator,
  IconAlertCircle,
  IconUsers,
} from "@tabler/icons-react";
import { routes, SECTOR_PRIVILEGES, FAVORITE_PAGES } from "../../../constants";
import { PrivilegeRoute } from "@/components/navigation/privilege-route";
import { PageHeader } from "@/components/ui/page-header";
import { BonusFilters } from "@/components/human-resources/bonus/list/bonus-filters";
import { BonusSummary } from "@/components/human-resources/bonus/list/bonus-summary";
import { BonusExport } from "@/components/human-resources/bonus/export/bonus-export";
import { BonusColumnVisibilityManager } from "@/components/human-resources/bonus/list/bonus-column-visibility-manager";
import { FilterIndicators } from "@/components/human-resources/bonus/list/filter-indicator";
import { extractActiveFilters, createFilterRemover } from "@/components/human-resources/bonus/list/filter-utils";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useBonusList, useSectors, usePositions, useUsers } from "../../../hooks";
import { calculatePonderedTasks } from "../../../utils/bonus";
import { StandardizedTable } from "@/components/ui/standardized-table";
import type { StandardizedColumn } from "@/components/ui/standardized-table";
// Extended filters interface with bonus-specific fields
interface BonusFiltersData {
  year?: number;
  months?: string[];
  sectorIds?: string[];
  positionIds?: string[];
  userIds?: string[];
}

// Helper to parse filters from URL
function parseFiltersFromUrl(searchParams: URLSearchParams): BonusFiltersData {
  const filters: BonusFiltersData = {};

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

  return filters;
}

// Helper to update filters in URL
function updateFiltersInUrl(
  searchParams: URLSearchParams,
  filters: BonusFiltersData,
  defaultFilters: BonusFiltersData
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
}

// Bonus row interface for table display
interface BonusRow {
  id: string;
  oderId: string;
  userName: string;
  userEmail?: string;
  userCpf?: string;
  payrollNumber?: string;
  position?: { id?: string; name: string; remuneration?: number; bonifiable?: boolean };
  sector?: { id: string; name: string };
  performanceLevel: number;
  status: string;

  // Bonus data
  bonusId?: string;
  bonusAmount: number;      // Net bonus (after discounts) - used for summary calculations
  baseBonus?: number;       // Base bonus (before discounts) - for reference
  tasksCompleted: number;
  averageTasks: number;
  totalWeightedTasks: number;

  // Period statistics (same for all rows in the period)
  totalCollaborators: number;

  // Discount data
  totalDiscounts: number;
  netBonus: number;

  // Month info for multi-month display
  monthLabel?: string;
  month: number;
  year: number;
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL'
  }).format(value);
}

// BonusTableComponent - Simple table for displaying bonus data
interface BonusTableComponentProps {
  data: BonusRow[];
  visibleColumns: Set<string>;
  onRowClick: (row: BonusRow) => void;
  isLoading: boolean;
  error: any;
  multiMonth: boolean;
  onSort?: (columnKey: string) => void;
  getSortDirection?: (columnKey: string) => "asc" | "desc" | null;
  getSortOrder?: (columnKey: string) => number | null;
  sortConfigs?: Array<{ column: string; direction: "asc" | "desc" }>;
}

function BonusTableComponent({
  data,
  visibleColumns,
  onRowClick,
  isLoading,
  error,
  multiMonth: _multiMonth,
  onSort,
  getSortDirection,
  getSortOrder,
  sortConfigs = []
}: BonusTableComponentProps) {
  // Define all possible columns
  const allColumns: StandardizedColumn<BonusRow>[] = [
    {
      key: "month",
      header: "Período",
      accessor: (row: BonusRow) => row.monthLabel || "-",
      sortable: true,
      className: "font-medium text-sm w-32 truncate",
      align: "left" as const,
    },
    {
      key: "payrollNumber",
      header: "Nº Folha",
      accessor: (row: BonusRow) => row.payrollNumber || "-",
      sortable: true,
      className: "font-mono text-xs w-24 truncate",
      align: "left" as const,
    },
    {
      key: "user.name",
      header: "Colaborador",
      accessor: (row: BonusRow) => row.userName,
      sortable: true,
      className: "font-medium text-sm w-40 truncate",
      align: "left" as const,
    },
    {
      key: "user.cpf",
      header: "CPF",
      accessor: (row: BonusRow) => row.userCpf || "-",
      sortable: true,
      className: "font-mono text-xs w-32 truncate",
      align: "left" as const,
    },
    {
      key: "position.name",
      header: "Cargo",
      accessor: (row: BonusRow) => row.position?.name || "-",
      sortable: true,
      className: "text-sm w-36 truncate",
      align: "left" as const,
    },
    {
      key: "sector.name",
      header: "Setor",
      accessor: (row: BonusRow) => row.sector?.name || "-",
      sortable: true,
      className: "text-sm w-24 truncate",
      align: "left" as const,
    },
    {
      key: "performanceLevel",
      header: "Desempenho",
      accessor: (row: BonusRow) => row.performanceLevel || 0,
      sortable: true,
      className: "text-sm w-24 truncate",
      align: "left" as const,
    },
    {
      key: "tasksCompleted",
      header: "Tarefas",
      accessor: (row: BonusRow) => row.tasksCompleted,
      sortable: true,
      className: "text-sm w-24 font-medium truncate",
      align: "left" as const,
    },
    {
      key: "totalWeightedTasks",
      header: "Ponderadas",
      accessor: (row: BonusRow) => row.totalWeightedTasks.toFixed(1),
      sortable: true,
      className: "text-sm w-24 font-medium truncate",
      align: "left" as const,
    },
    {
      key: "totalCollaborators",
      header: "Colaboradores",
      accessor: (row: BonusRow) => row.totalCollaborators || 0,
      sortable: true,
      className: "text-sm w-28 font-medium truncate",
      align: "left" as const,
    },
    {
      key: "averageTasks",
      header: "Média",
      accessor: (row: BonusRow) => row.averageTasks.toFixed(2),
      sortable: true,
      className: "text-sm w-24 font-medium truncate",
      align: "left" as const,
    },
    {
      key: "bonus",
      header: "Bônus Bruto",
      accessor: (row: BonusRow) => <span className="whitespace-nowrap">{formatCurrency(row.baseBonus || row.bonusAmount)}</span>,
      sortable: true,
      className: "text-sm w-32 font-mono font-semibold truncate",
      align: "left" as const,
    },
    {
      key: "totalDiscounts",
      header: "Ajustes",
      accessor: (row: BonusRow) => {
        if (row.totalDiscounts === 0) {
          return <span className="whitespace-nowrap text-muted-foreground">R$ 0,00</span>;
        }
        const isExtra = row.totalDiscounts > 0;
        const absValue = Math.abs(row.totalDiscounts);
        const prefix = isExtra ? '+' : '-';
        const colorClass = isExtra ? 'text-green-600' : 'text-red-600';
        return <span className={`whitespace-nowrap ${colorClass}`}>{prefix}{formatCurrency(absValue)}</span>;
      },
      sortable: true,
      className: "text-sm w-28 font-mono truncate",
      align: "left" as const,
    },
    {
      key: "netBonus",
      header: "Bônus Líquido",
      accessor: (row: BonusRow) => <span className="whitespace-nowrap">{formatCurrency(row.netBonus)}</span>,
      sortable: true,
      className: "text-sm w-32 font-mono font-bold text-green-600 truncate",
      align: "left" as const,
    },
  ];

  // Filter columns based on visibility
  const columns = allColumns.filter(column => visibleColumns.has(column.key));

  return (
    <StandardizedTable<BonusRow>
      columns={columns}
      data={data}
      getItemKey={(row) => row.id}
      onRowClick={onRowClick}
      isLoading={isLoading}
      error={error}
      emptyMessage="Nenhum bônus encontrado"
      emptyDescription="Selecione um período para visualizar os bônus"
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
function getDefaultFilters(): BonusFiltersData {
  const today = new Date();
  const currentYear = today.getFullYear();
  const currentMonth = today.getMonth() + 1;
  const currentDay = today.getDate();

  let year = currentYear;
  let month = currentMonth;

  // If day <= 5, show previous month (bonus not yet paid for current month)
  if (currentDay <= 5) {
    month = currentMonth - 1;
    if (month < 1) {
      month = 12;
      year = currentYear - 1;
    }
  }

  return {
    year,
    months: [String(month).padStart(2, "0")],
  };
}

export default function BonusListPage() {
  usePageTracker({ title: "Bônus", icon: "gift" });

  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const {
    sortConfigs,
    toggleSort,
    getSortDirection,
    getSortOrder,
  } = useTableState({
    defaultSort: [{ column: 'user.name', direction: 'asc' }]
  });

  const defaultFilters = useMemo(() => getDefaultFilters(), []);
  const urlFilters = useMemo(() => parseFiltersFromUrl(searchParams), [searchParams]);
  const initialFilters = useMemo(() => {
    const hasUrlFilters = searchParams.has('year') || searchParams.has('months');
    return hasUrlFilters ? { ...defaultFilters, ...urlFilters } : defaultFilters;
  }, [defaultFilters, urlFilters, searchParams]);

  const { data: sectorsData } = useSectors({
    orderBy: { name: "asc" },
    limit: 100,
  });

  const { data: positionsData } = usePositions({
    orderBy: { name: "asc" },
    limit: 100,
  });

  const { data: usersData } = useUsers({
    orderBy: { name: "asc" },
    include: { position: true, sector: true },
    where: {
      isActive: true,
      payrollNumber: { not: null },
    },
    limit: 100,
  });

  const defaultSectorIds = useMemo(() => {
    if (!sectorsData?.data) return [];
    // Note: LEADER privilege was removed - filter only PRODUCTION and WAREHOUSE
    return sectorsData.data
      .filter(sector =>
        sector.privilege === 'PRODUCTION' ||
        sector.privilege === 'WAREHOUSE'
      )
      .map(sector => sector.id);
  }, [sectorsData?.data]);

  const filtersWithDefaults = useMemo(() => {
    // Don't apply default sector filter if user has selected specific users or positions
    // This allows filtering by user/position without being restricted by default sectors
    if (initialFilters.sectorIds && initialFilters.sectorIds.length > 0) {
      return initialFilters;
    }
    if (initialFilters.userIds && initialFilters.userIds.length > 0) {
      return initialFilters;
    }
    if (initialFilters.positionIds && initialFilters.positionIds.length > 0) {
      return initialFilters;
    }
    return { ...initialFilters, sectorIds: defaultSectorIds };
  }, [initialFilters, defaultSectorIds]);

  const [filters, setFilters] = useState<BonusFiltersData>(filtersWithDefaults);
  const hasInitializedSectorsRef = React.useRef(false);

  useEffect(() => {
    // Only apply default sectors if:
    // 1. We haven't initialized yet
    // 2. Default sectors are available
    // 3. No sector filters are currently set
    // 4. No user or position filters are set (user explicitly wants specific users/positions)
    // 5. No URL parameters exist for sectors/users/positions
    if (
      !hasInitializedSectorsRef.current &&
      defaultSectorIds.length > 0 &&
      (!filters.sectorIds || filters.sectorIds.length === 0) &&
      (!filters.userIds || filters.userIds.length === 0) &&
      (!filters.positionIds || filters.positionIds.length === 0) &&
      !searchParams.has('sectorIds') &&
      !searchParams.has('userIds') &&
      !searchParams.has('positionIds')
    ) {
      setFilters(prev => ({ ...prev, sectorIds: defaultSectorIds }));
      hasInitializedSectorsRef.current = true;
    }
  }, [defaultSectorIds, filters.sectorIds, filters.userIds, filters.positionIds, searchParams]);

  const [showFilters, setShowFilters] = useState(false);
  const { visibleColumns: baseVisibleColumns, setVisibleColumns } = useColumnVisibility(
    "bonus-list-visible-columns",
    new Set([
      'user.name',
      'position.name',
      'performanceLevel',
      'tasksCompleted',
      'totalCollaborators',
      'averageTasks',
      'bonus',
      'netBonus',
    ])
  );
  const [isRefreshing, setIsRefreshing] = useState(false);

  const visibleColumns = useMemo(() => {
    const columns = new Set(baseVisibleColumns);
    const isMultiMonth = filters.months && filters.months.length > 1;
    if (isMultiMonth) {
      columns.add('month');
    } else {
      columns.delete('month');
    }
    return columns;
  }, [baseVisibleColumns, filters.months]);

  const selectedYear = filters.year || new Date().getFullYear();
  const selectedMonths = filters.months?.map(m => parseInt(m)) || [new Date().getMonth() + 1];

  // Use standard useBonusList hook - API handles saved vs live data transparently
  // When specific users are selected, don't apply sector/position filters
  // This allows filtering by user regardless of their sector/position
  const hasUserFilter = filters.userIds && filters.userIds.length > 0;
  const { data: bonusData, isLoading, error } = useBonusList({
    year: selectedYear,
    months: selectedMonths,
    sectorIds: hasUserFilter ? undefined : filters.sectorIds,
    positionIds: hasUserFilter ? undefined : filters.positionIds,
    userIds: filters.userIds,
    include: {
      user: {
        include: {
          position: true,
          sector: true,
        },
      },
      tasks: true,
      bonusDiscounts: true,
      bonusExtras: true,
      users: true,
    },
  });

  // Process the bonus data into rows for display
  const processedBonuses = useMemo(() => {
    if (!bonusData?.data) return [];

    const bonuses = bonusData.data;
    const combined: BonusRow[] = [];

    bonuses.forEach((bonus: any) => {
      if (!bonus) return;

      const user = bonus.user;
      if (!user) return;

      // Apply client-side filters (similar to payroll list)
      // When specific users are selected, skip sector/position filters
      const hasUserFilter = filters.userIds && filters.userIds.length > 0;

      if (hasUserFilter) {
        // Only filter by userIds when users are explicitly selected
        if (!filters.userIds!.includes(user.id)) {
          return;
        }
      } else {
        // Apply sector and position filters only when no specific users are selected
        if (filters.sectorIds && filters.sectorIds.length > 0 && !filters.sectorIds.includes(user.sectorId)) {
          return;
        }
        if (filters.positionIds && filters.positionIds.length > 0 && !filters.positionIds.includes(user.positionId)) {
          return;
        }
      }

      // Get month label
      const monthName = new Date(bonus.year, bonus.month - 1).toLocaleDateString('pt-BR', { month: 'short' });
      const cleanMonthName = monthName.replace('.', '');
      const monthLabel = `${cleanMonthName.charAt(0).toUpperCase() + cleanMonthName.slice(1)} - ${bonus.year}`;

      // Get bonus amount
      const bonusAmount = bonus.baseBonus
        ? (typeof bonus.baseBonus === 'object' && bonus.baseBonus?.toNumber
          ? bonus.baseBonus.toNumber()
          : Number(bonus.baseBonus) || 0)
        : 0;

      // Get net bonus directly from the database field
      const netBonusAmount = bonus.netBonus !== undefined && bonus.netBonus !== null
        ? (typeof bonus.netBonus === 'object' && (bonus.netBonus as any)?.toNumber
          ? (bonus.netBonus as any).toNumber()
          : Number(bonus.netBonus))
        : bonusAmount;

      // Calculate net adjustment (positive = extras, negative = discounts)
      // netBonus > baseBonus means extras outweigh discounts
      const totalDiscounts = netBonusAmount - bonusAmount;

      // Get period-level task count (total tasks in the period - same for all users)
      // bonus.tasks contains ALL tasks for the period
      const totalTasksInPeriod = bonus.tasks?.length || 0;

      // Get period-level weighted tasks (total weighted tasks - same for all users)
      // bonus.weightedTasks is the TOTAL weighted tasks for the period
      const totalWeightedTasks = bonus.weightedTasks
        ? (typeof bonus.weightedTasks === 'object' && bonus.weightedTasks?.toNumber
          ? bonus.weightedTasks.toNumber()
          : Number(bonus.weightedTasks) || 0)
        : calculatePonderedTasks(bonus.tasks || []);

      // Get total collaborators from the users array (all bonifiable users)
      // bonus.users contains all eligible users for bonus calculation
      const totalCollaborators = bonus.users?.length || 0;

      // Get average tasks per user directly from API (pre-calculated correctly)
      // This is: totalWeightedTasks / totalEligibleUsers
      const averageTasks = bonus.averageTaskPerUser
        ? (typeof bonus.averageTaskPerUser === 'object' && bonus.averageTaskPerUser?.toNumber
          ? bonus.averageTaskPerUser.toNumber()
          : Number(bonus.averageTaskPerUser) || 0)
        : (totalCollaborators > 0 ? totalWeightedTasks / totalCollaborators : 0);

      const row: BonusRow = {
        id: bonus.id,
        oderId: user.id,
        userName: user.name || 'Sem nome',
        userEmail: user.email,
        userCpf: user.cpf,
        payrollNumber: user.payrollNumber,
        position: user.position ? {
          id: user.position.id,
          name: user.position.name,
          remuneration: user.position.remuneration,
          bonifiable: user.position.bonifiable,
        } : undefined,
        sector: user.sector ? {
          id: user.sector.id,
          name: user.sector.name,
        } : undefined,
        performanceLevel: bonus.performanceLevel || user.performanceLevel || 0,

        bonusId: bonus.id,
        bonusAmount: netBonusAmount,              // Net bonus (after discounts) for summary calculations
        baseBonus: bonusAmount,                   // Base bonus (before discounts) for reference
        tasksCompleted: totalTasksInPeriod,       // Total raw task count for the period
        averageTasks: averageTasks,               // Pre-calculated average from API
        totalWeightedTasks: totalWeightedTasks,   // Total weighted tasks for the period

        totalCollaborators: totalCollaborators,   // Total bonifiable users

        totalDiscounts: totalDiscounts,
        netBonus: netBonusAmount,

        monthLabel,
        month: bonus.month,
        year: bonus.year,
      };

      combined.push(row);
    });

    // Apply sorting
    if (sortConfigs.length === 0) {
      return combined;
    }

    return [...combined].sort((a, b) => {
      for (const config of sortConfigs) {
        let aValue: any;
        let bValue: any;
        const columnKey = config.column;

        if (columnKey === 'user.name') {
          aValue = a.userName;
          bValue = b.userName;
        } else if (columnKey === 'bonus') {
          aValue = a.bonusAmount;
          bValue = b.bonusAmount;
        } else if (columnKey === 'netBonus') {
          aValue = a.netBonus;
          bValue = b.netBonus;
        } else if (columnKey === 'user.cpf') {
          aValue = a.userCpf;
          bValue = b.userCpf;
        } else {
          const path = columnKey.split('.');
          if (path.length === 1) {
            aValue = a[path[0] as keyof BonusRow];
            bValue = b[path[0] as keyof BonusRow];
          } else if (path.length === 2) {
            const parent = path[0] as keyof BonusRow;
            const child = path[1];
            aValue = (a[parent] as any)?.[child];
            bValue = (b[parent] as any)?.[child];
          }
        }

        if (aValue === null || aValue === undefined) aValue = '';
        if (bValue === null || bValue === undefined) bValue = '';

        let comparison = 0;
        if (typeof aValue === 'string' && typeof bValue === 'string') {
          comparison = aValue.localeCompare(bValue, 'pt-BR');
        } else if (typeof aValue === 'number' && typeof bValue === 'number') {
          comparison = aValue - bValue;
        } else {
          comparison = String(aValue).localeCompare(String(bValue), 'pt-BR');
        }

        if (comparison !== 0) {
          return config.direction === 'asc' ? comparison : -comparison;
        }
      }
      return 0;
    });
  }, [bonusData, sortConfigs, filters]);

  const handleApplyFilters = async (newFilters: BonusFiltersData) => {
    setIsRefreshing(true);
    setFilters(newFilters);
    setShowFilters(false);

    setSearchParams((prev) => {
      const newParams = new URLSearchParams(prev);
      updateFiltersInUrl(newParams, newFilters, defaultFilters);
      return newParams;
    }, { replace: true });

    setTimeout(() => {
      setIsRefreshing(false);
    }, 300);
  };

  const handleRowClick = (row: BonusRow) => {
    if (row.bonusId) {
      navigate(routes.humanResources.bonus.details(row.bonusId));
    }
  };

  // Create filter remover function
  const onRemoveFilter = useCallback(
    createFilterRemover(filters, defaultFilters, handleApplyFilters),
    [filters, defaultFilters, handleApplyFilters]
  );

  // Extract active filters for badge display
  const activeFilterBadges = useMemo(() => {
    return extractActiveFilters(
      filters,
      defaultFilters,
      onRemoveFilter,
      {
        sectors: sectorsData?.data || [],
        positions: positionsData?.data || [],
        users: usersData?.data || [],
      }
    );
  }, [filters, defaultFilters, onRemoveFilter, sectorsData?.data, positionsData?.data, usersData?.data]);

  // Clear all filters
  const clearAllFilters = useCallback(() => {
    handleApplyFilters(defaultFilters);
  }, [defaultFilters, handleApplyFilters]);

  const activeFiltersCount = useMemo(() => {
    const defaultFilters = getDefaultFilters();
    let count = 0;
    if (filters.year && filters.year !== defaultFilters.year) count++;
    if (filters.months && (filters.months.length !== 1 || filters.months[0] !== defaultFilters.months?.[0])) count++;
    if (filters.userIds && filters.userIds.length > 0) count++;
    if (filters.sectorIds && filters.sectorIds.length > 0) count++;
    if (filters.positionIds && filters.positionIds.length > 0) count++;
    return count;
  }, [filters]);

  const hasActiveFilters = activeFiltersCount > 0;
  const hasError = !!error;

  return (
    <PrivilegeRoute requiredPrivilege={[SECTOR_PRIVILEGES.HUMAN_RESOURCES, SECTOR_PRIVILEGES.ADMIN]}>
      <div className="h-full flex flex-col gap-4 bg-background px-4 pt-4 pb-4">
        <PageHeader
          className="flex-shrink-0"
          title="Bônus"
          favoritePage={FAVORITE_PAGES.RECURSOS_HUMANOS_BONUS_LISTAR}
          breadcrumbs={[{ label: "Início", href: routes.home }, { label: "Recursos Humanos" }, { label: "Bônus" }]}
          description={(() => {
            if (filters.year && filters.months && filters.months.length > 0) {
              if (filters.months.length === 1) {
                const monthName = new Date(filters.year, parseInt(filters.months[0]) - 1).toLocaleDateString("pt-BR", { month: "long" });
                return `Período: ${monthName} de ${filters.year}`;
              } else {
                return `Período: ${filters.months.length} meses de ${filters.year}`;
              }
            }
            return "Visualização de bônus com cálculos de tarefas e bonificações";
          })()}
          actions={[]}
        />

        {hasError && (
          <Alert variant="destructive" className="flex-shrink-0">
            <IconAlertCircle className="h-4 w-4" />
            <AlertDescription>
              Erro ao carregar dados de bônus. Verifique a conexão e tente novamente.
            </AlertDescription>
          </Alert>
        )}

        <Card className="flex-1 min-h-0 flex flex-col shadow-sm border border-border">
          <CardContent className="px-6 pt-6 pb-4 flex-shrink-0">
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-2">
                <Button
                  onClick={() => setShowFilters(!showFilters)}
                  variant={hasActiveFilters ? "default" : "outline"}
                  size="default"
                >
                  <IconFilter className="h-4 w-4 mr-2" />
                  {hasActiveFilters ? `Filtros (${activeFiltersCount})` : "Filtros"}
                </Button>

                <BonusColumnVisibilityManager
                  visibleColumns={visibleColumns}
                  onVisibilityChange={setVisibleColumns}
                />
              </div>

              <div className="flex items-center gap-2">
                <Button
                  onClick={() => navigate(routes.humanResources.bonus.simulation)}
                  variant="outline"
                  size="default"
                >
                  <IconCalculator className="h-4 w-4 mr-2" />
                  Simulação de Bônus
                </Button>

                <BonusExport
                  filters={filters}
                  currentPageData={processedBonuses}
                  totalRecords={processedBonuses.length}
                  visibleColumns={visibleColumns}
                />
              </div>
            </div>

            {/* Active Filter Badges */}
            {activeFilterBadges.length > 0 && (
              <FilterIndicators
                filters={activeFilterBadges}
                onClearAll={clearAllFilters}
                className="mt-4"
              />
            )}
          </CardContent>

          <CardContent className="flex-1 flex flex-col p-4 pt-0 relative min-h-0">
            <div className="flex-1 min-h-0 rounded-lg border border-border">
              <BonusTableComponent
                data={processedBonuses}
                visibleColumns={visibleColumns}
                onRowClick={handleRowClick}
                isLoading={isLoading}
                error={hasError ? error : null}
                multiMonth={filters.months ? filters.months.length > 1 : false}
                onSort={toggleSort}
                getSortDirection={getSortDirection}
                getSortOrder={getSortOrder}
                sortConfigs={sortConfigs}
              />
            </div>

            {(isRefreshing || isLoading) && (
              <div className="absolute inset-0 bg-background/80 backdrop-blur-sm flex items-center justify-center z-10 rounded-lg">
                <div className="flex items-center gap-2 text-muted-foreground">
                  <IconRefresh className="h-4 w-4 animate-spin" />
                  <span className="text-sm font-medium">
                    {isRefreshing ? "Aplicando filtros..." : "Carregando dados..."}
                  </span>
                </div>
              </div>
            )}
          </CardContent>

          {/* Summary - At bottom, no spacing between table */}
          {processedBonuses.length > 0 && (
            <div className="px-6 pb-6 flex-shrink-0">
              <BonusSummary bonuses={processedBonuses} />
            </div>
          )}
        </Card>

        <BonusFilters
          open={showFilters}
          onOpenChange={setShowFilters}
          filters={filters}
          onApplyFilters={handleApplyFilters}
        />
      </div>
    </PrivilegeRoute>
  );
}
