import { useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { StandardizedTable, type StandardizedColumn } from "@/components/ui/standardized-table";
import { IconUsers } from "@tabler/icons-react";
import { useAuth } from "../../../../hooks/common/use-auth";
import { usePayrolls } from "../../../../hooks";
import { createPayrollColumns } from "./payroll-table-columns";
import type { PayrollColumn, PayrollUserRow } from "./payroll-table-columns";
import { useTableState } from "@/hooks/common/use-table-state";
import { routes } from "../../../../constants";


// Payroll filters
interface PayrollFiltersData {
  year?: number;
  months?: string[];
  sectorIds?: string[];
  positionIds?: string[];
  userIds?: string[];
}

interface PayrollTableProps {
  className?: string;
  visibleColumns?: Set<string>;
  filters?: PayrollFiltersData;
  onDataChange?: (data: { items: PayrollUserRow[]; totalRecords: number }) => void;
  refreshInterval?: number;
}

export function PayrollTable({
  className,
  visibleColumns,
  filters,
  onDataChange,
  refreshInterval: _refreshInterval = 30000
}: PayrollTableProps) {
  const navigate = useNavigate();

  // Permission checks
  const { user: _user } = useAuth();

  // Handle row click to navigate to payroll details
  const handleRowClick = (row: PayrollUserRow & { month?: number; year?: number }) => {
    // For saved payrolls with valid ID, navigate directly
    if (row.payrollId && !row.payrollId.startsWith('temp-')) {
      navigate(routes.humanResources.payroll.detail(row.payrollId));
    } else if (row.id && row.month && (row.year || filters?.year)) {
      // For live calculations, create live ID with user info
      const year = row.year || filters?.year;
      const liveId = `live-${row.id}-${year}-${row.month}`;
      navigate(routes.humanResources.payroll.detail(liveId));
    }
  };

  // Table state management
  const {
    sortConfigs,
    selectedIds: selectedItems,
    toggleSort,
    toggleSelection,
    toggleSelectAll,
    isAllSelected,
    isPartiallySelected,
    getSortDirection,
    getSortOrder,
  } = useTableState({
    defaultPageSize: 100,
    resetSelectionOnPageChange: false,
  });

  // Get month labels for display
  const monthLabels = useMemo(() => {
    if (!filters?.year || !filters?.months) return new Map();

    const labels = new Map<string, string>();
    filters.months.forEach(month => {
      const date = new Date(filters.year!, parseInt(month) - 1);
      const monthName = date.toLocaleDateString('pt-BR', { month: 'short' });
      const cleanMonth = monthName.replace(/\./g, '').charAt(0).toUpperCase() + monthName.replace(/\./g, '').slice(1);
      labels.set(month, `${cleanMonth} ${filters.year}`);
    });
    return labels;
  }, [filters?.year, filters?.months]);

  // Fetch payroll data for each selected month
  const firstMonth = filters?.months?.[0] ? parseInt(filters.months[0]) : 0;
  const secondMonth = filters?.months?.[1] ? parseInt(filters.months[1]) : 0;
  const thirdMonth = filters?.months?.[2] ? parseInt(filters.months[2]) : 0;

  const payrollParams = {
    include: {
      user: { include: { position: true, sector: true } },
      bonus: { include: { tasks: true, bonusDiscounts: true } },
      discounts: true,
    },
    take: 200, // Ensure we get all payrolls for the month (max ~100 employees)
  };

  const { data: firstMonthData, isLoading: firstMonthLoading, error: firstMonthError } = usePayrolls(
    { ...payrollParams, where: { year: filters?.year || 0, month: firstMonth } },
    { enabled: !!filters?.year && firstMonth > 0 }
  );

  const { data: secondMonthData, isLoading: secondMonthLoading } = usePayrolls(
    { ...payrollParams, where: { year: filters?.year || 0, month: secondMonth } },
    { enabled: !!filters?.year && secondMonth > 0 }
  );

  const { data: thirdMonthData, isLoading: thirdMonthLoading } = usePayrolls(
    { ...payrollParams, where: { year: filters?.year || 0, month: thirdMonth } },
    { enabled: !!filters?.year && thirdMonth > 0 }
  );

  // Combine all payroll data with proper month labels
  const allPayrollData = useMemo(() => {
    const combined: any[] = [];

    // Add first month data
    if (firstMonthData?.data && filters?.months?.[0]) {
      const monthStr = filters.months[0];
      const label = monthLabels.get(monthStr);
      combined.push(...firstMonthData.data.map((p: any) => ({
        ...p,
        monthLabel: label,
        month: firstMonth,
        displayMonth: monthStr, // Keep original string for reference
      })));
    }

    // Add second month data
    if (secondMonthData?.data && filters?.months?.[1]) {
      const monthStr = filters.months[1];
      const label = monthLabels.get(monthStr);
      combined.push(...secondMonthData.data.map((p: any) => ({
        ...p,
        monthLabel: label,
        month: secondMonth,
        displayMonth: monthStr,
      })));
    }

    // Add third month data
    if (thirdMonthData?.data && filters?.months?.[2]) {
      const monthStr = filters.months[2];
      const label = monthLabels.get(monthStr);
      combined.push(...thirdMonthData.data.map((p: any) => ({
        ...p,
        monthLabel: label,
        month: thirdMonth,
        displayMonth: monthStr,
      })));
    }

    return combined;
  }, [firstMonthData, secondMonthData, thirdMonthData, firstMonth, secondMonth, thirdMonth, monthLabels, filters?.months]);

  const isLoading = firstMonthLoading || secondMonthLoading || thirdMonthLoading;

  // Convert payroll entities to table rows
  const processedData = useMemo(() => {
    // Filter by position, sector, user if specified
    let filteredData = allPayrollData;

    if (filters?.positionIds && filters.positionIds.length > 0) {
      filteredData = filteredData.filter((p: any) =>
        filters.positionIds!.includes(p.user?.positionId)
      );
    }

    if (filters?.sectorIds && filters.sectorIds.length > 0) {
      filteredData = filteredData.filter((p: any) =>
        filters.sectorIds!.includes(p.user?.sectorId)
      );
    }

    if (filters?.userIds && filters.userIds.length > 0) {
      filteredData = filteredData.filter((p: any) =>
        filters.userIds!.includes(p.userId)
      );
    }

    // Map payroll entities to table rows
    const rows: PayrollUserRow[] = filteredData.map((payroll: any) => {
      const user = payroll.user;
      const bonus = payroll.bonus;

      return {
        // User fields
        id: filters?.months && filters.months.length > 1
          ? `${user.id}-${payroll.month}`
          : user.id,
        name: user.name,
        email: user.email,
        cpf: user.cpf,
        payrollNumber: user.payrollNumber,
        position: user.position,
        sector: user.sector,
        status: user.status,

        // Payroll fields
        payrollId: payroll.id,
        baseRemuneration: Number(payroll.baseRemuneration) || 0,

        // Bonus fields
        bonus: bonus,
        bonusAmount: bonus?.baseBonus ? Number(bonus.baseBonus) : 0,
        hasBonus: bonus?.baseBonus ? Number(bonus.baseBonus) > 0 : false,

        // Month info (for multi-month display)
        monthLabel: payroll.monthLabel,
        monthYear: `${payroll.year}-${payroll.month}`,
      } as PayrollUserRow;
    });

    return rows;
  }, [allPayrollData, filters]);

  // Apply sorting to processed data
  const sortedData = useMemo(() => {
    if (!sortConfigs || sortConfigs.length === 0) {
      // Default sort by name
      return [...processedData].sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));
    }

    return [...processedData].sort((a, b) => {
      for (const config of sortConfigs) {
        let aValue: any;
        let bValue: any;

        switch (config.column) {
          case 'payrollNumber':
            aValue = a.payrollNumber || 0;
            bValue = b.payrollNumber || 0;
            break;
          case 'user.name':
            aValue = a.name || '';
            bValue = b.name || '';
            break;
          case 'user.cpf':
            aValue = a.cpf || '';
            bValue = b.cpf || '';
            break;
          case 'position.name':
            aValue = a.position?.name || '';
            bValue = b.position?.name || '';
            break;
          case 'sector.name':
            aValue = a.sector?.name || '';
            bValue = b.sector?.name || '';
            break;
          case 'tasksCompleted':
            // Calculate weighted tasks
            aValue = 0;
            bValue = 0;
            if (a.bonus?.tasks) {
              const aFull = a.bonus.tasks.filter((t: any) => t.commission === 'FULL_COMMISSION').length;
              const aPartial = a.bonus.tasks.filter((t: any) => t.commission === 'PARTIAL_COMMISSION').length;
              aValue = aFull + (aPartial * 0.5);
            }
            if (b.bonus?.tasks) {
              const bFull = b.bonus.tasks.filter((t: any) => t.commission === 'FULL_COMMISSION').length;
              const bPartial = b.bonus.tasks.filter((t: any) => t.commission === 'PARTIAL_COMMISSION').length;
              bValue = bFull + (bPartial * 0.5);
            }
            break;
          case 'averageTasks':
            // Calculate average
            aValue = 0;
            bValue = 0;
            if (a.bonus?.tasks && a.bonus?.users) {
              const aFull = a.bonus.tasks.filter((t: any) => t.commission === 'FULL_COMMISSION').length;
              const aPartial = a.bonus.tasks.filter((t: any) => t.commission === 'PARTIAL_COMMISSION').length;
              const aTotal = aFull + (aPartial * 0.5);
              aValue = a.bonus.users.length > 0 ? aTotal / a.bonus.users.length : 0;
            }
            if (b.bonus?.tasks && b.bonus?.users) {
              const bFull = b.bonus.tasks.filter((t: any) => t.commission === 'FULL_COMMISSION').length;
              const bPartial = b.bonus.tasks.filter((t: any) => t.commission === 'PARTIAL_COMMISSION').length;
              const bTotal = bFull + (bPartial * 0.5);
              bValue = b.bonus.users.length > 0 ? bTotal / b.bonus.users.length : 0;
            }
            break;
          case 'bonus':
            aValue = a.bonusAmount || 0;
            bValue = b.bonusAmount || 0;
            break;
          case 'remuneration':
            aValue = a.baseRemuneration || 0;
            bValue = b.baseRemuneration || 0;
            break;
          case 'totalEarnings':
            aValue = (a.baseRemuneration || 0) + (a.bonusAmount || 0);
            bValue = (b.baseRemuneration || 0) + (b.bonusAmount || 0);
            break;
          default:
            aValue = a.name || '';
            bValue = b.name || '';
        }

        // Compare values
        let comparison = 0;
        if (typeof aValue === 'string' && typeof bValue === 'string') {
          comparison = aValue.localeCompare(bValue, 'pt-BR');
        } else if (typeof aValue === 'number' && typeof bValue === 'number') {
          comparison = aValue - bValue;
        }

        // Apply sort direction
        if (config.direction === 'desc') {
          comparison = -comparison;
        }

        if (comparison !== 0) {
          return comparison;
        }
      }

      return 0;
    });
  }, [processedData, sortConfigs]);

  // Update parent component with current data
  useEffect(() => {
    if (sortedData && onDataChange) {
      onDataChange({
        items: sortedData,
        totalRecords: sortedData.length,
      });
    }
  }, [sortedData, onDataChange]);

  // Note: We don't need a global average anymore
  // Each row calculates its own average from its bonus.tasks and bonus.users

  // Filter columns based on visibility
  const allColumns: PayrollColumn[] = createPayrollColumns();
  const columns: PayrollColumn[] = visibleColumns
    ? allColumns.filter((column) => visibleColumns.has(column.key))
    : allColumns;

  // Convert PayrollColumn to StandardizedColumn
  const columnsWithActions: StandardizedColumn<PayrollUserRow>[] = [
    // Add month column if multiple months selected
    ...(filters?.months && filters.months.length > 1
      ? [
          {
            key: "month",
            header: "MÊS/ANO",
            accessor: (row: PayrollUserRow) => row.monthLabel || "-",
            sortable: false,
            className: "font-medium text-sm w-32",
            align: "left" as const,
          },
        ]
      : []),

    // Map payroll columns
    ...columns.map((col) => ({
      key: col.key,
      header: col.header,
      accessor: (row: PayrollUserRow) => {
        // For averageTasks, calculate from row's own bonus data
        if (col.key === "averageTasks") {
          // Calculate average from this row's bonus data
          let monthAverage = 0;
          if (row.bonus?.tasks && row.bonus?.users) {
            const tasks = row.bonus.tasks;
            const usersCount = row.bonus.users.length;

            const fullCount = tasks.filter((t: any) => t.commission === 'FULL_COMMISSION').length;
            const partialCount = tasks.filter((t: any) => t.commission === 'PARTIAL_COMMISSION').length;
            const totalWeighted = fullCount + (partialCount * 0.5);

            monthAverage = usersCount > 0 ? totalWeighted / usersCount : 0;
          }
          return col.accessor(row, monthAverage);
        }
        return col.accessor(row);
      },
      sortable: col.sortable,
      className: col.className,
      align: col.align,
    })),
  ];

  return (
    <div className="h-full overflow-auto">
      <StandardizedTable<PayrollUserRow>
        columns={columnsWithActions}
        data={sortedData}
        getItemKey={(row) => row.id}
        isSelected={(id) => {
          const baseId = id.includes("-") ? id.split("-")[0] : id;
          return selectedItems.includes(baseId);
        }}
        onSelectionChange={(id) => {
          const baseId = id.includes("-") ? id.split("-")[0] : id;
          toggleSelection(baseId);
        }}
        onSelectAll={() => {
          const baseIds = [
            ...new Set(sortedData.map((row) => (row.id.includes("-") ? row.id.split("-")[0] : row.id))),
          ];
          toggleSelectAll(baseIds);
        }}
        allSelected={(() => {
          const baseIds = [
            ...new Set(sortedData.map((row) => (row.id.includes("-") ? row.id.split("-")[0] : row.id))),
          ];
          return isAllSelected(baseIds);
        })()}
        partiallySelected={(() => {
          const baseIds = [
            ...new Set(sortedData.map((row) => (row.id.includes("-") ? row.id.split("-")[0] : row.id))),
          ];
          return isPartiallySelected(baseIds);
        })()}
        isLoading={isLoading}
        error={firstMonthError}
        emptyMessage="Nenhuma folha de pagamento encontrada"
        emptyIcon={IconUsers}
        onSort={toggleSort}
        getSortDirection={getSortDirection}
        getSortOrder={getSortOrder}
        onRowClick={handleRowClick}
        sortConfigs={sortConfigs.map((config) => ({ field: config.column, direction: config.direction }))}
        currentPage={0}
        totalPages={1}
        pageSize={sortedData.length}
        totalRecords={sortedData.length}
        className={className}
      />
    </div>
  );
}