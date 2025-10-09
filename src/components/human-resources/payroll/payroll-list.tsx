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
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
  IconCalendar,
  IconCurrencyReal,
  IconFilter,
  IconX,
  IconPlus,
  IconDownload,
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
import { Combobox } from "@/components/ui/combobox";
import { Label } from "@/components/ui/label";

interface PayrollListProps {
  className?: string;
}

interface PayrollFilters {
  year: number;
  month: number;
  searchTerm: string;
  userId?: string;
  sectorIds?: string[];
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
      if (discount.fixedValue) {
        netSalary -= discount.fixedValue;
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
    if (discount.fixedValue) {
      totalDiscounts += discount.fixedValue;
    } else if (discount.percentage) {
      totalDiscounts += (baseAmount * discount.percentage) / 100;
    }
  }

  return totalDiscounts;
};

export function PayrollList({ className }: PayrollListProps) {
  const navigate = useNavigate();
  const currentDate = new Date();
  const currentYear = currentDate.getFullYear();
  const currentMonth = currentDate.getMonth() + 1;
  const hasInitializedSectorsRef = useRef(false);

  const [filters, setFilters] = useState<PayrollFilters>({
    year: currentYear,
    month: currentMonth,
    searchTerm: "",
  });

  const [showFilters, setShowFilters] = useState(true);
  const [finalizeDialog, setFinalizeDialog] = useState<{ year: number; month: number } | null>(null);

  // Batch operations mutations
  const { mutate: batchCreatePayroll, isPending: isCreatingBatch } = useBatchCreatePayroll();
  const { mutate: finalizeMonth, isPending: isFinalizing } = useFinalizePayrollMonth();

  // Fetch sectors for filtering
  const { data: sectorsData } = useSectors({
    orderBy: { name: "asc" },
    limit: 100
  });

  // Get default sector IDs (production, warehouse, leader privileges)
  const defaultSectorIds = useMemo(() => {
    if (!sectorsData?.data) return [];

    return sectorsData.data
      .filter(sector =>
        sector.privilege === 'PRODUCTION' ||
        sector.privilege === 'WAREHOUSE' ||
        sector.privilege === 'LEADER'
      )
      .map(sector => sector.id);
  }, [sectorsData?.data]);

  // Set default sectors when they become available
  useEffect(() => {
    if (!hasInitializedSectorsRef.current && defaultSectorIds.length > 0) {
      setFilters(prev => ({
        ...prev,
        sectorIds: defaultSectorIds
      }));
      hasInitializedSectorsRef.current = true;
    }
  }, [defaultSectorIds]);

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

    return {
      page: page + 1, // Convert 0-based to 1-based
      limit: pageSize,
      orderBy,
      where: {
        year: filters.year,
        month: filters.month,
        ...(filters.userId && { userId: filters.userId }),
        ...(filters.sectorIds && filters.sectorIds.length > 0 && {
          user: {
            sectorId: { in: filters.sectorIds }
          }
        }),
        ...(filters.searchTerm && {
          OR: [
            {
              user: {
                name: { contains: filters.searchTerm, mode: "insensitive" }
              }
            },
            {
              user: {
                email: { contains: filters.searchTerm, mode: "insensitive" }
              }
            }
          ]
        }),
        ...(showSelectedOnly && selectedIds.length > 0 && {
          id: { in: selectedIds }
        }),
      },
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
    batchCreatePayroll({
      year: filters.year,
      month: filters.month
    });
  };

  const handleFinalizeMonth = () => {
    setFinalizeDialog({
      year: filters.year,
      month: filters.month
    });
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
            onClick={() => setShowFilters(!showFilters)}
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
              {filters.month}/{filters.year}
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

      {/* Filters */}
      {showFilters && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg">Filtros</CardTitle>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowFilters(false)}
              >
                <IconX className="h-4 w-4" />
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Ano</label>
                <Select
                  value={String(filters.year)}
                  onValueChange={(value) =>
                    setFilters({ ...filters, year: parseInt(value) })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Array.from({ length: 5 }, (_, i) => currentYear - 2 + i).map((year) => (
                      <SelectItem key={year} value={String(year)}>
                        {year}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Mês</label>
                <Select
                  value={String(filters.month)}
                  onValueChange={(value) =>
                    setFilters({ ...filters, month: parseInt(value) })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Array.from({ length: 12 }, (_, i) => i + 1).map((month) => (
                      <SelectItem key={month} value={String(month)}>
                        {new Date(2024, month - 1).toLocaleDateString("pt-BR", { month: "long" })}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label className="text-sm font-medium">Setores</Label>
                <Combobox
                  mode="multiple"
                  value={filters.sectorIds || []}
                  onValueChange={(value) =>
                    setFilters({ ...filters, sectorIds: value as string[] })
                  }
                  options={sectorsData?.data?.map(sector => ({
                    value: sector.id,
                    label: sector.name
                  })) || []}
                  placeholder="Todos os setores"
                  emptyText="Nenhum setor encontrado"
                  className="w-full"
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Buscar funcionário</label>
                <Input
                  placeholder="Nome ou email..."
                  value={filters.searchTerm}
                  onChange={(e) =>
                    setFilters({ ...filters, searchTerm: e.target.value })
                  }
                />
              </div>

              <div className="flex items-end">
                <Button
                  variant="outline"
                  onClick={() => setFilters({
                    year: currentYear,
                    month: currentMonth,
                    searchTerm: "",
                    sectorIds: defaultSectorIds,
                  })}
                  className="w-full"
                >
                  Limpar Filtros
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

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