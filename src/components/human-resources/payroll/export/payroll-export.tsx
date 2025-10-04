import { BaseExportPopover, type ExportFormat, type ExportColumn } from "@/components/ui/export-popover";
import { toast } from "@/components/ui/sonner";
import type { PayrollUserRow } from "../list/payroll-table-columns";
import type { UserGetManyFormData } from "../../../../schemas";
import { formatCurrency } from "../../../../utils";
import { USER_STATUS } from "../../../../constants";
import { payrollService, userService } from "../../../../api-client";
import { exportToCSV, exportToExcel, exportToPDF } from "@/lib/export-utils";

// Extended filters with payroll-specific fields
interface PayrollFiltersData extends Partial<UserGetManyFormData> {
  year?: number;
  months?: string[];
  performanceLevels?: number[];
  userIds?: string[];
  excludeUserIds?: string[]; // New field for excluding users
  sectorIds?: string[];
  positionIds?: string[];
}

interface PayrollExportProps {
  className?: string;
  filters?: PayrollFiltersData;
  currentPageData?: PayrollUserRow[];
  totalRecords?: number;
  selectedItems?: Set<string>;
  visibleColumns?: Set<string>;
}

// Column configuration for export using PayrollUserRow data
const createExportColumns = (): ExportColumn<PayrollUserRow>[] => [
  {
    id: "payrollNumber",
    label: "Nº Folha",
    getValue: (row: PayrollUserRow) => row.payrollNumber ? row.payrollNumber.toString().padStart(4, "0") : "-"
  },
  {
    id: "user.name",
    label: "Nome",
    getValue: (row: PayrollUserRow) => row.name || ""
  },
  {
    id: "user.cpf",
    label: "CPF",
    getValue: (row: PayrollUserRow) => row.cpf || "-"
  },
  {
    id: "position.name",
    label: "Cargo",
    getValue: (row: PayrollUserRow) => row.position?.name || "-"
  },
  {
    id: "sector.name",
    label: "Setor",
    getValue: (row: PayrollUserRow) => row.sector?.name || "-"
  },
  {
    id: "performanceLevel",
    label: "Nível Performance",
    getValue: (row: PayrollUserRow) => row.performanceLevel?.toString() || "0"
  },
  {
    id: "tasksCompleted",
    label: "Tarefas Concluídas",
    getValue: (row: PayrollUserRow) => {
      const tasks = row.monthTaskCount || 0;
      return tasks.toString();
    }
  },
  {
    id: "averageTasks",
    label: "Média Tarefas",
    getValue: (row: PayrollUserRow) => {
      const avg = row.averageTasksPerEmployee || 0;
      return avg.toFixed(1);
    }
  },
  {
    id: "bonus",
    label: "Bonificação",
    getValue: (row: PayrollUserRow) => {
      // Use the actual bonus amount from payroll data
      return formatCurrency(row.bonusAmount || 0);
    }
  },
  {
    id: "remuneration",
    label: "Remuneração",
    getValue: (row: PayrollUserRow) => {
      // Use the base remuneration from payroll data
      return formatCurrency(row.baseRemuneration || 0);
    }
  },
  {
    id: "totalEarnings",
    label: "Total",
    getValue: (row: PayrollUserRow) => {
      // Calculate total from actual values
      const total = (row.baseRemuneration || 0) + (row.bonusAmount || 0);
      return formatCurrency(total);
    }
  },
];

// Default visible columns if none specified
const getDefaultVisibleColumns = () => new Set([
  "payrollNumber",
  "user.name",
  "user.cpf",
  "position.name",
  "performanceLevel",
  "tasksCompleted",
  "averageTasks",
  "bonus",
  "remuneration",
  "totalEarnings"
]);

export function PayrollExport({
  className,
  filters = {},
  currentPageData = [],
  totalRecords = 0,
  selectedItems,
  visibleColumns
}: PayrollExportProps) {

  const fetchAllItems = async (): Promise<PayrollUserRow[]> => {
    try {
      // For payroll export, we need to fetch and process the data similar to the table
      // This is complex because we need to merge user data with payroll bonus data

      // First, fetch users
      const usersResponse = await userService.getMany({
        ...filters,
        limit: 100, // Max 100 due to API limit
        where: {
          ...filters?.where,
          status: { not: USER_STATUS.DISMISSED },
          ...(filters?.userIds?.length ? { id: { in: filters.userIds } } :
             filters?.excludeUserIds?.length ? { id: { notIn: filters.excludeUserIds } } : {}),
          ...(filters?.sectorIds?.length ? { sectorId: { in: filters.sectorIds } } : {}),
          ...(filters?.positionIds?.length ? { positionId: { in: filters.positionIds } } : {}),
        },
        include: {
          position: {
            include: {
              remunerations: true,
            },
          },
          sector: true,
        },
      });

      const users = usersResponse.data || [];
      const processedRows: PayrollUserRow[] = [];

      // If we have year and months selected, fetch payroll data for each month
      if (filters.year && filters.months && filters.months.length > 0) {
        for (const monthStr of filters.months) {
          const month = parseInt(monthStr);

          // Fetch payroll bonuses for this month
          const payrollResponse = await payrollService.getLiveBonuses(filters.year, month);
          const payrollData = payrollResponse.data?.data || [];

          // Process each user for this month
          for (const user of users) {
            const userPayrollData = payrollData.find((item: any) => item.userId === user.id);

            const row: PayrollUserRow = {
              ...user,
              id: filters.months.length > 1 ? `${user.id}-${monthStr}` : user.id,
              payrollId: userPayrollData?.payrollId || null,
              performanceLevel: userPayrollData?.bonus?.performanceLevel || 0,
              monthTaskCount: userPayrollData?.taskStats?.totalPonderado || 0,
              totalTasks: userPayrollData?.taskStats?.totalTasks || 0,
              bonus: userPayrollData?.bonus || null,
              bonusAmount: userPayrollData?.totalBonuses || userPayrollData?.bonus?.baseBonus || 0,
              baseRemuneration: userPayrollData?.baseSalary || user.position?.remuneration || 0,
              averageTasksPerEmployee: userPayrollData?.statistics?.averageTasksPerUser || 0,
              hasBonus: (userPayrollData?.totalBonuses || userPayrollData?.bonus?.baseBonus || 0) > 0,
              monthLabel: new Date(filters.year, month - 1).toLocaleDateString('pt-BR', {
                month: 'short',
                year: 'numeric'
              }),
              monthYear: `${filters.year}-${monthStr}`,
            };

            // Apply performance level filter if specified
            if (!filters.performanceLevels ||
                filters.performanceLevels.length === 0 ||
                filters.performanceLevels.includes(row.performanceLevel)) {
              processedRows.push(row);
            }
          }
        }
      } else {
        // No months selected, just return user data as rows
        for (const user of users) {
          const row: PayrollUserRow = {
            ...user,
            id: user.id,
            payrollId: null,
            performanceLevel: 0,
            monthTaskCount: 0,
            totalTasks: 0,
            bonus: null,
            bonusAmount: 0,
            baseRemuneration: user.position?.remuneration || 0,
            averageTasksPerEmployee: 0,
            hasBonus: false,
          };
          processedRows.push(row);
        }
      }

      return processedRows;
    } catch (error) {
      console.error("Error fetching payroll data for export:", error);
      toast.error("Erro ao buscar dados da folha de pagamento para exportação");
      throw error;
    }
  };

  const handleExport = async (format: ExportFormat, items: PayrollUserRow[], columns: ExportColumn<PayrollUserRow>[]) => {
    try {
      // Prepare data for export
      const exportData = items.map((row) => {
        const exportRow: Record<string, string> = {};
        columns.forEach((col) => {
          exportRow[col.label] = col.getValue(row);
        });
        return exportRow;
      });

      // Get filename based on filters
      const monthNames = filters.months?.map(m => {
        const month = parseInt(m);
        return new Date(filters.year || new Date().getFullYear(), month - 1).toLocaleDateString('pt-BR', { month: 'short' });
      }).join('_') || 'todos';
      const filename = `folha_pagamento_${filters.year || new Date().getFullYear()}_${monthNames}`;

      // Export based on format
      switch (format) {
        case "csv":
          exportToCSV(exportData, filename);
          toast.success("Folha de pagamento exportada em CSV");
          break;
        case "excel":
          exportToExcel(exportData, filename);
          toast.success("Folha de pagamento exportada em Excel");
          break;
        case "pdf":
          exportToPDF(exportData, filename, {
            title: `Folha de Pagamento - ${filters.year || new Date().getFullYear()}`,
            orientation: "landscape"
          });
          toast.success("Folha de pagamento exportada em PDF");
          break;
      }
    } catch (error) {
      console.error("Export error:", error);
      toast.error("Erro ao exportar dados");
      throw error;
    }
  };

  // Create columns
  const exportColumns = createExportColumns();

  // Filter columns based on visibility
  const filteredColumns = visibleColumns
    ? exportColumns.filter((col) => visibleColumns.has(col.id))
    : exportColumns;

  return (
    <BaseExportPopover<PayrollUserRow>
      className={className}
      currentItems={currentPageData}
      totalRecords={totalRecords}
      selectedItems={selectedItems}
      visibleColumns={visibleColumns || getDefaultVisibleColumns()}
      exportColumns={filteredColumns}
      defaultVisibleColumns={getDefaultVisibleColumns()}
      onExport={handleExport}
      onFetchAllItems={fetchAllItems}
      entityName="folha de pagamento"
      entityNamePlural="folhas de pagamento"
    />
  );
}