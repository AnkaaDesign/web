import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { StandardizedTable, type StandardizedColumn } from "@/components/ui/standardized-table";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useTableState, convertSortConfigsToOrderBy } from "@/hooks/common/use-table-state";
import { useColumnVisibility } from "@/hooks/common/use-column-visibility";
import { formatCurrency, formatDate } from "../../../../utils";
import { BONUS_STATUS_LABELS, routes } from "../../../../constants";
import { getBadgeVariant } from "../../../../constants";
import type { Bonus } from "../../../../types";
import type { BonusGetManyFormData } from "../../../../schemas";
import { IconPlus, IconEye, IconCalculator } from "@tabler/icons-react";
import { ColumnVisibilityManager } from "./column-visibility-manager";
import { BonusSimulationInteractiveTable } from "../../bonus-simulation/bonus-simulation-interactive-table";

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
    page,
    pageSize,
    sortConfigs,
    setPage,
    setPageSize,
    toggleSort,
    toggleSelection,
    toggleSelectAll,
    isSelected,
    isAllSelected,
    isPartiallySelected,
  } = useTableState({
    defaultPageSize: 10,
    defaultSort: [{ column: "createdAt", direction: "desc" }],
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
    };

    onFilter?.(filters);
  };

  // Apply filters when table state changes
  React.useEffect(() => {
    handleTableStateChange();
  }, [page, pageSize, sortConfigs]);

  // Define all table columns
  const allColumns: StandardizedColumn<Bonus>[] = [
    {
      key: "user.name",
      header: "Funcionário",
      sortable: true,
      render: (bonus) => (
        <div className="font-medium">
          {bonus.user?.name || "N/A"}
        </div>
      ),
    },
    {
      key: "year",
      header: "Ano",
      sortable: true,
      render: (bonus) => bonus.year.toString(),
    },
    {
      key: "month",
      header: "Mês",
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
      header: "Valor Base",
      sortable: true,
      render: (bonus) => (
        <span className="font-medium">
          {formatCurrency(Number(bonus.baseBonus))}
        </span>
      ),
    },
    {
      key: "bonusExtra",
      header: "Extra Ponto",
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
      header: "Nível",
      sortable: true,
      render: (bonus) => (
        <Badge variant={bonus.performanceLevel > 0 ? "success" : "secondary"}>
          {bonus.performanceLevel}
        </Badge>
      ),
    },
    {
      key: "status",
      header: "Status",
      sortable: true,
      render: (bonus) => (
        <Badge variant={bonus.status ? getBadgeVariant(bonus.status) : "secondary"}>
          {bonus.status ? (BONUS_STATUS_LABELS[bonus.status] || bonus.status) : "N/A"}
        </Badge>
      ),
    },
    {
      key: "createdAt",
      header: "Data de Criação",
      sortable: true,
      render: (bonus) => formatDate(bonus.createdAt),
    },
    {
      key: "actions",
      header: "Ações",
      render: (bonus) => (
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate(routes.humanResources.bonus.details(bonus.id))}
          >
            <IconEye className="h-4 w-4" />
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
              <Button onClick={() => navigate(routes.humanResources.bonus.simulation)}>
                <IconPlus className="h-4 w-4 mr-2" />
                Nova Simulação
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
            getItemKey={(bonus) => bonus.id}
            currentPage={page + 1}
            pageSize={pageSize}
            totalRecords={bonuses.length}
            totalPages={Math.ceil(bonuses.length / pageSize)}
            onPageChange={(newPage) => setPage(newPage - 1)}
            onPageSizeChange={setPageSize}
            sortConfigs={sortConfigs.map(s => ({ field: s.column, direction: s.direction }))}
            onSort={toggleSort}
            getSortDirection={(key) => sortConfigs.find(s => s.column === key)?.direction || null}
            getSortOrder={(key) => {
              const idx = sortConfigs.findIndex(s => s.column === key);
              return idx >= 0 ? idx : null;
            }}
            isSelected={isSelected}
            onSelectionChange={toggleSelection}
            onSelectAll={() => toggleSelectAll(bonuses.map(b => b.id))}
            allSelected={isAllSelected(bonuses.map(b => b.id))}
            partiallySelected={isPartiallySelected(bonuses.map(b => b.id))}
            emptyMessage="Nenhuma bonificação encontrada"
          />
        )}
      </CardContent>
    </Card>
  );
}