import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { StandardizedTable, type StandardizedColumn } from "@/components/ui/standardized-table";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useTableState, convertSortConfigsToOrderBy } from "@/hooks/use-table-state";
import { useColumnVisibility } from "@/hooks/use-column-visibility";
import { formatCurrency, formatDate } from "../../../../utils";
import { BONUS_STATUS, BONUS_STATUS_LABELS, routes } from "../../../../constants";
import { getBadgeVariant } from "../../../../constants";
import type { Bonus } from "../../../../types";
import type { BonusGetManyFormData } from "../../../../schemas";
import { IconPlus, IconEye, IconEdit, IconCalculator } from "@tabler/icons-react";
import { ColumnVisibilityManager } from "./column-visibility-manager";
import { BonusSimulationInteractiveTable } from "../../bonus-simulation/bonus-simulation-interactive-table";
import { cn } from "@/lib/utils";

interface BonusListProps {
  bonuses?: Bonus[];
  isLoading?: boolean;
  onFilter?: (filters: BonusGetManyFormData) => void;
  className?: string;
}

// Default visible columns for bonus list
const getDefaultVisibleColumns = () =>
  new Set([
    "user.name",
    "year",
    "month",
    "baseBonus",
    "performanceLevel",
    "status",
    "createdAt",
    "actions",
  ]);

export function BonusList({ bonuses = [], isLoading = false, onFilter, className }: BonusListProps) {
  const navigate = useNavigate();
  const [showSimulation, setShowSimulation] = useState(false);

  const {
    searchTerm,
    page,
    pageSize,
    sortConfigs,
    selectedRows,
    handleSearch,
    handlePageChange,
    handlePageSizeChange,
    handleSort,
    handleRowSelection,
    handleSelectAll,
  } = useTableState({
    defaultPageSize: 10,
    defaultSortConfigs: [{ key: "createdAt", direction: "desc" }],
  });

  const { visibleColumns, setVisibleColumns } = useColumnVisibility(
    "bonus-list-visible-columns",
    getDefaultVisibleColumns()
  );

  // Convert table state to API filters
  const handleTableStateChange = () => {
    const orderBy = convertSortConfigsToOrderBy(sortConfigs);

    const filters: BonusGetManyFormData = {
      page: page + 1, // Convert 0-based to 1-based for API
      limit: pageSize,
      orderBy,
      searchingFor: searchTerm || undefined,
    };

    onFilter?.(filters);
  };

  // Apply filters when table state changes
  React.useEffect(() => {
    handleTableStateChange();
  }, [searchTerm, page, pageSize, sortConfigs]);

  // Define all table columns
  const allColumns: StandardizedColumn<Bonus>[] = [
    {
      key: "user.name",
      title: "Funcionário",
      sortable: true,
      render: (bonus) => (
        <div className="font-medium">
          {bonus.user?.name || "N/A"}
        </div>
      ),
    },
    {
      key: "year",
      title: "Ano",
      sortable: true,
      render: (bonus) => bonus.year.toString(),
    },
    {
      key: "month",
      title: "Mês",
      sortable: true,
      render: (bonus) => {
        const monthNames = [
          "Jan", "Fev", "Mar", "Abr", "Mai", "Jun",
          "Jul", "Ago", "Set", "Out", "Nov", "Dez"
        ];
        return monthNames[bonus.month - 1] || bonus.month.toString();
      },
    },
    {
      key: "baseBonus",
      title: "Valor Base",
      sortable: true,
      render: (bonus) => (
        <span className="font-medium">
          {formatCurrency(bonus.baseBonus)}
        </span>
      ),
    },
    {
      key: "bonusExtra",
      title: "Extra Ponto",
      render: (bonus) => {
        const extras = bonus.bonusExtras || [];
        if (extras.length === 0) return <span className="text-muted-foreground">-</span>;
        const totalValue = extras.reduce((sum, e) => sum + (Number(e.value) || 0), 0);
        const totalPct = extras.reduce((sum, e) => sum + (Number(e.percentage) || 0), 0);
        return (
          <span className="font-medium text-emerald-600">
            {totalPct > 0 ? `${totalPct}%` : ""}{totalPct > 0 && totalValue > 0 ? " / " : ""}{totalValue > 0 ? formatCurrency(totalValue) : ""}
          </span>
        );
      },
    },
    {
      key: "performanceLevel",
      title: "Nível",
      sortable: true,
      render: (bonus) => (
        <Badge variant={bonus.performanceLevel > 0 ? "success" : "secondary"}>
          {bonus.performanceLevel}
        </Badge>
      ),
    },
    {
      key: "status",
      title: "Status",
      sortable: true,
      render: (bonus) => (
        <Badge variant={getBadgeVariant(bonus.status)}>
          {BONUS_STATUS_LABELS[bonus.status] || bonus.status}
        </Badge>
      ),
    },
    {
      key: "createdAt",
      title: "Data de Criação",
      sortable: true,
      render: (bonus) => formatDate(bonus.createdAt),
    },
    {
      key: "actions",
      title: "Ações",
      render: (bonus) => (
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate(routes.humanResources.bonus.details(bonus.id))}
          >
            <IconEye className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate(routes.humanResources.bonus.edit(bonus.id))}
          >
            <IconEdit className="h-4 w-4" />
          </Button>
        </div>
      ),
    },
  ];

  // Filter columns based on visibility
  const columns = allColumns.filter((column) => visibleColumns.has(column.key));

  if (isLoading) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle>Bonificações</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={className}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>Bonificações</CardTitle>
          <div className="flex gap-2">
            {!showSimulation && (
              <ColumnVisibilityManager
                columns={allColumns}
                visibleColumns={visibleColumns}
                onVisibilityChange={setVisibleColumns}
                defaultVisibleColumns={getDefaultVisibleColumns()}
              />
            )}
            <Button
              variant={showSimulation ? "default" : "outline"}
              onClick={() => setShowSimulation(!showSimulation)}
            >
              <IconCalculator className="h-4 w-4 mr-2" />
              Simulação de Bônus
            </Button>
            {!showSimulation && (
              <Button onClick={() => navigate(routes.humanResources.bonus.create)}>
                <IconPlus className="h-4 w-4 mr-2" />
                Criar Bonificação
              </Button>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {showSimulation ? (
          <div className="h-[calc(100vh-300px)]">
            <BonusSimulationInteractiveTable embedded={true} />
          </div>
        ) : (
          <StandardizedTable
            data={bonuses}
            columns={columns}
            searchTerm={searchTerm}
            onSearchChange={handleSearch}
            searchPlaceholder="Buscar por funcionário, ano ou mês..."
            page={page}
            pageSize={pageSize}
            totalCount={bonuses.length}
            onPageChange={handlePageChange}
            onPageSizeChange={handlePageSizeChange}
            sortConfigs={sortConfigs}
            onSort={handleSort}
            selectedRows={selectedRows}
            onRowSelection={handleRowSelection}
            onSelectAll={handleSelectAll}
            emptyMessage="Nenhuma bonificação encontrada"
          />
        )}
      </CardContent>
    </Card>
  );
}