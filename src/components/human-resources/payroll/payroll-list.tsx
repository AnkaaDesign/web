import React, { useState, useMemo, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { StandardizedTable, type StandardizedColumn } from "@/components/ui/standardized-table";
import { useTableState, convertSortConfigsToOrderBy } from "@/hooks/use-table-state";
import {
  IconUsers,
  IconCurrencyReal,
  IconFilter,
  IconPlus,
  IconRefresh,
  IconCalculator,
} from "@tabler/icons-react";
import {
  usePayrolls,
  useBatchCreatePayroll,
  useFinalizePayrollMonth,
  useSectors
} from "../../../hooks";
import { formatCurrency } from "../../../utils";
import { routes } from "../../../constants";
import type { Payroll } from "../../../types";
import type { PayrollGetManyParams } from "../../../types";
import { PayrollFilters } from "./list/payroll-filters";

interface PayrollListProps {
  className?: string;
}

interface PayrollFiltersState {
  year: number;
  months: string[];
  sectorIds: string[];
  positionIds: string[];
  userIds: string[];
  excludeUserIds: string[];
}

// Calculate net salary for a payroll entry
const calculateNetSalary = (payroll: Payroll): number => {
  let netSalary = payroll.baseRemuneration;

  // Add bonus if exists
  if (payroll.bonus?.finalValue) {
    netSalary += payroll.bonus.finalValue;
  }

  // Subtract discounts
  if (payroll.discounts) {
    for (const discount of payroll.discounts) {
      if (discount.value) {
        netSalary -= discount.value;
      } else if (discount.percentage) {
        netSalary -= (netSalary * discount.percentage) / 100;
      }
    }
  }

  return Math.max(0, netSalary); // Ensure not negative
};

// Get total discounts for a payroll entry
const getTotalDiscounts = (payroll: Payroll): number => {
  if (!payroll.discounts) return 0;

  let totalDiscounts = 0;
  let baseAmount = payroll.baseRemuneration + (payroll.bonus?.finalValue || 0);

  for (const discount of payroll.discounts) {
    if (discount.value) {
      totalDiscounts += discount.value;
    } else if (discount.percentage) {
      totalDiscounts += (baseAmount * discount.percentage) / 100;
    }
  }

  return totalDiscounts;
};

export function PayrollList({ className }: PayrollListProps) {
  const navigate = useNavigate();
  const currentDate = new Date();
  const currentDay = currentDate.getDate();
  let currentYear = currentDate.getFullYear();
  let currentMonth = currentDate.getMonth() + 1;

  // Adjust for payroll period (26th cutoff)
  if (currentDay > 26) {
    currentMonth += 1;
    if (currentMonth > 12) {
      currentMonth = 1;
      currentYear += 1;
    }
  }

  const [filters, setFilters] = useState<PayrollFiltersState>({
    year: currentYear,
    months: [String(currentMonth).padStart(2, '0')],
    sectorIds: [],
    positionIds: [],
    userIds: [],
    excludeUserIds: [],
  });

  const [showFiltersModal, setShowFiltersModal] = useState(false);
  const [finalizeDialog, setFinalizeDialog] = useState<{ year: number; month: number } | null>(null);

  // Batch operations mutations
  const { mutate: batchCreatePayroll, isPending: isCreatingBatch } = useBatchCreatePayroll();
  const { mutate: finalizeMonth, isPending: isFinalizing } = useFinalizePayrollMonth();

  // Fetch sectors for filtering
  const { data: sectorsData } = useSectors({
    orderBy: { name: "asc" },
    limit: 100
  });

  // Table state management
  const {
    page,
    pageSize,
    sortConfigs,
    selectedIds,
    showSelectedOnly,
    setPage,
    toggleSort,
    toggleSelection,
    toggleSelectAll,
    isAllSelected,
    isPartiallySelected,
    getSortDirection,
    getSortOrder,
  } = useTableState({
    defaultPageSize: 25,
    resetSelectionOnPageChange: false,
  });

  // Build query parameters
  const queryParams = useMemo((): PayrollGetManyParams => {
    const orderBy = convertSortConfigsToOrderBy(sortConfigs) || { createdAt: "desc" };

    // Build user filter conditions
    // Default filters: only active users with payroll numbers
    const userConditions: any = {
      isActive: true, // Only active users
      payrollNumber: { not: null } // Only users with payroll numbers
    };

    // Add sector filter
    if (filters.sectorIds.length > 0) {
      userConditions.sectorId = { in: filters.sectorIds };
    }

    // Add position filter
    if (filters.positionIds.length > 0) {
      userConditions.positionId = { in: filters.positionIds };
    }

    // Handle include/exclude users
    if (filters.userIds.length > 0) {
      userConditions.id = { in: filters.userIds };
    } else if (filters.excludeUserIds.length > 0) {
      userConditions.id = { notIn: filters.excludeUserIds };
    }

    // Build where clause for payroll
    const whereClause: any = {
      year: filters.year,
      user: userConditions // Always include user conditions
    };

    // Handle multiple months
    if (filters.months.length > 0) {
      const monthNumbers = filters.months.map(m => parseInt(m));
      whereClause.month = monthNumbers.length === 1 ? monthNumbers[0] : { in: monthNumbers };
    }

    // Add selected IDs filter
    if (showSelectedOnly && selectedIds.length > 0) {
      whereClause.id = { in: selectedIds };
    }

    return {
      page: page + 1, // Convert 0-based to 1-based
      limit: pageSize,
      orderBy,
      where: whereClause,
      include: {
        user: {
          include: {
            position: true,
            sector: true,
          }
        },
        bonus: true,
        discounts: {
          orderBy: { calculationOrder: "asc" }
        },
      },
    };
  }, [filters, page, pageSize, sortConfigs, showSelectedOnly, selectedIds]);

  // Fetch payrolls data
  const {
    data: payrollsResponse,
    isLoading,
    error,
    refetch
  } = usePayrolls(queryParams, {
    refetchInterval: 30000, // Refresh every 30 seconds
  });

  const payrolls = payrollsResponse?.data || [];
  const meta = payrollsResponse?.meta;

  // Define table columns
  const columns: StandardizedColumn<Payroll>[] = [
    {
      key: "user",
      header: "Funcionário",
      accessor: (payroll) => payroll.user?.name || "N/A",
      sortable: true,
      className: "font-medium min-w-[200px]",
    },
    {
      key: "sector",
      header: "Setor",
      accessor: (payroll) => payroll.user?.sector?.name || "N/A",
      sortable: false,
      className: "min-w-[120px]",
    },
    {
      key: "position",
      header: "Cargo",
      accessor: (payroll) => payroll.user?.position?.title || "N/A",
      sortable: false,
      className: "min-w-[120px]",
    },
    {
      key: "baseRemuneration",
      header: "Salário Base",
      accessor: (payroll) => formatCurrency(payroll.baseRemuneration),
      sortable: true,
      className: "text-right min-w-[120px]",
      align: "right",
    },
    {
      key: "bonus",
      header: "Bônus",
      accessor: (payroll) => formatCurrency(payroll.bonus?.finalValue || 0),
      sortable: true,
      className: "text-right min-w-[120px]",
      align: "right",
    },
    {
      key: "discounts",
      header: "Descontos",
      accessor: (payroll) => {
        const totalDiscounts = getTotalDiscounts(payroll);
        return (
          <span className="text-red-600">
            -{formatCurrency(totalDiscounts)}
          </span>
        );
      },
      sortable: false,
      className: "text-right min-w-[120px]",
      align: "right",
    },
    {
      key: "netSalary",
      header: "Salário Líquido",
      accessor: (payroll) => {
        const netSalary = calculateNetSalary(payroll);
        return (
          <span className="font-semibold text-green-600">
            {formatCurrency(netSalary)}
          </span>
        );
      },
      sortable: true,
      className: "text-right min-w-[140px]",
      align: "right",
    },
    {
      key: "discountCount",
      header: "Descontos",
      accessor: (payroll) => {
        const count = payroll.discounts?.length || 0;
        return count > 0 ? (
          <Badge variant="secondary">{count}</Badge>
        ) : (
          <span className="text-muted-foreground">-</span>
        );
      },
      sortable: false,
      className: "text-center min-w-[100px]",
      align: "center",
    },
  ];

  // Handle row click
  const handleRowClick = (payroll: Payroll) => {
    navigate(routes.humanResources.payroll.detail(payroll.id));
  };

  // Handle batch operations
  const handleBatchCreatePayroll = () => {
    // Use the first month if multiple are selected
    const month = filters.months.length > 0 ? parseInt(filters.months[0]) : currentMonth;
    batchCreatePayroll({
      year: filters.year,
      month: month
    });
  };

  const handleFinalizeMonth = () => {
    // Use the first month if multiple are selected
    const month = filters.months.length > 0 ? parseInt(filters.months[0]) : currentMonth;
    setFinalizeDialog({
      year: filters.year,
      month: month
    });
  };

  // Handle filter changes
  const handleFiltersApply = (newFilters: any) => {
    setFilters(newFilters);
    setShowFiltersModal(false);
  };

  const confirmFinalizeMonth = () => {
    if (finalizeDialog) {
      finalizeMonth({
        year: finalizeDialog.year,
        month: finalizeDialog.month
      });
      setFinalizeDialog(null);
    }
  };

  // Calculate summary statistics
  const summaryStats = useMemo(() => {
    return payrolls.reduce((acc, payroll) => ({
      totalEmployees: acc.totalEmployees + 1,
      totalBaseRemuneration: acc.totalBaseRemuneration + payroll.baseRemuneration,
      totalBonuses: acc.totalBonuses + (payroll.bonus?.finalValue || 0),
      totalDiscounts: acc.totalDiscounts + getTotalDiscounts(payroll),
      totalNetSalary: acc.totalNetSalary + calculateNetSalary(payroll),
    }), {
      totalEmployees: 0,
      totalBaseRemuneration: 0,
      totalBonuses: 0,
      totalDiscounts: 0,
      totalNetSalary: 0,
    });
  }, [payrolls]);

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Header with Actions */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Folha de Pagamento</h2>
          <p className="text-muted-foreground">
            Gerencie a folha de pagamento mensal dos funcionários
          </p>
        </div>

        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowFiltersModal(true)}
          >
            <IconFilter className="h-4 w-4" />
            Filtros
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={() => refetch()}
            disabled={isLoading}
          >
            <IconRefresh className="h-4 w-4" />
            Atualizar
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={handleBatchCreatePayroll}
            disabled={isCreatingBatch}
          >
            <IconPlus className="h-4 w-4" />
            {isCreatingBatch ? "Criando..." : "Criar Folha"}
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={handleFinalizeMonth}
            disabled={isFinalizing}
          >
            <IconCalculator className="h-4 w-4" />
            {isFinalizing ? "Finalizando..." : "Finalizar Mês"}
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Funcionários</CardTitle>
            <IconUsers className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{summaryStats.totalEmployees}</div>
            <p className="text-xs text-muted-foreground">
              {filters.months.length > 0
                ? `${filters.months.join(', ')}/${filters.year}`
                : `${filters.year}`
              }
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Base</CardTitle>
            <IconCurrencyReal className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatCurrency(summaryStats.totalBaseRemuneration)}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Bônus</CardTitle>
            <IconCurrencyReal className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {formatCurrency(summaryStats.totalBonuses)}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Líquido Total</CardTitle>
            <IconCurrencyReal className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">
              {formatCurrency(summaryStats.totalNetSalary)}
            </div>
          </CardContent>
        </Card>
      </div>


      {/* Payroll Table */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Folha de Pagamento</CardTitle>
              <CardDescription>
                {meta ? `${meta.totalRecords} funcionário(s) encontrado(s)` : "Carregando..."}
              </CardDescription>
            </div>

            {selectedIds.length > 0 && (
              <Badge variant="secondary">
                {selectedIds.length} selecionado(s)
              </Badge>
            )}
          </div>
        </CardHeader>
        <CardContent>
          <StandardizedTable<Payroll>
            columns={columns}
            data={payrolls}
            getItemKey={(payroll) => payroll.id}
            isSelected={(id) => selectedIds.includes(id)}
            onSelectionChange={toggleSelection}
            onSelectAll={() => toggleSelectAll(payrolls.map(p => p.id))}
            allSelected={isAllSelected(payrolls.map(p => p.id))}
            partiallySelected={isPartiallySelected(payrolls.map(p => p.id))}
            onRowClick={handleRowClick}
            isLoading={isLoading}
            error={error}
            emptyMessage="Nenhuma folha de pagamento encontrada"
            emptyDescription="Tente ajustar os filtros ou criar uma nova folha de pagamento"
            emptyIcon={IconUsers}
            onSort={toggleSort}
            getSortDirection={getSortDirection}
            getSortOrder={getSortOrder}
            sortConfigs={sortConfigs.map((config) => ({
              field: config.column,
              direction: config.direction,
            }))}
            currentPage={page}
            totalPages={meta ? Math.ceil(meta.totalRecords / pageSize) : 0}
            pageSize={pageSize}
            totalRecords={meta?.totalRecords || 0}
            onPageChange={setPage}
            showPagination={true}
            showPageInfo={true}
            className={className}
          />
        </CardContent>
      </Card>

      {/* Filters Modal */}
      <PayrollFilters
        open={showFiltersModal}
        onOpenChange={setShowFiltersModal}
        filters={filters}
        onApplyFilters={handleFiltersApply}
      />

      {/* Finalize Month Confirmation Dialog */}
      <AlertDialog open={!!finalizeDialog} onOpenChange={(open) => !open && setFinalizeDialog(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Finalizar Folha de Pagamento</AlertDialogTitle>
            <AlertDialogDescription>
              {finalizeDialog &&
                `Tem certeza que deseja finalizar a folha de pagamento de ${finalizeDialog.month}/${finalizeDialog.year}? Esta ação não pode ser desfeita.`
              }
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmFinalizeMonth}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Finalizar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}