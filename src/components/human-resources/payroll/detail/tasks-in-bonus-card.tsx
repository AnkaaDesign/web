import React, { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { StandardizedTable, type StandardizedColumn } from "@/components/ui/standardized-table";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  IconClipboardList,
  IconSearch,
  IconX,
  IconAdjustments,
  IconUser,
  IconCalendar,
  IconCurrencyReal
} from "@tabler/icons-react";
import { formatDate, formatCurrency } from "../../../../utils";
import {
  COMMISSION_STATUS,
  COMMISSION_STATUS_LABELS,
  TASK_STATUS,
  TASK_STATUS_LABELS
} from "../../../../constants";
import { getBadgeVariant } from "../../../../constants";
import { useTableState, convertSortConfigsToOrderBy } from "@/hooks/use-table-state";
import type { Task, Commission } from "../../../../types";

// Extended task interface for display with commission data
interface TaskInBonusRow extends Task {
  commission?: Commission;
  commissionStatus?: COMMISSION_STATUS;
  commissionValue?: number;
  weightedValue?: number; // For display purposes (Full=1, Partial=0.5)
}

interface TasksInBonusCardProps {
  tasks: TaskInBonusRow[];
  isLoading?: boolean;
  className?: string;
  title?: string;
  description?: string;
}

export function TasksInBonusCard({
  tasks = [],
  isLoading = false,
  className,
  title = "Tarefas Incluídas na Bonificação",
  description = "Lista de tarefas concluídas incluídas no cálculo da bonificação"
}: TasksInBonusCardProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<COMMISSION_STATUS | "ALL">("ALL");

  // Table state management
  const {
    sortConfigs,
    toggleSort,
    getSortDirection,
    getSortOrder,
  } = useTableState({
    defaultPageSize: 50,
    resetSelectionOnPageChange: false,
  });

  // Filter and search tasks
  const filteredTasks = useMemo(() => {
    return tasks.filter(task => {
      // Search filter
      const matchesSearch = !searchTerm ||
        task.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        task.customer?.fantasyName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        task.serialNumber?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        task.truck?.plate?.toLowerCase().includes(searchTerm.toLowerCase());

      // Status filter
      const matchesStatus = statusFilter === "ALL" ||
        task.commissionStatus === statusFilter ||
        task.commission === statusFilter;

      return matchesSearch && matchesStatus;
    });
  }, [tasks, searchTerm, statusFilter]);

  // Sort tasks
  const sortedTasks = useMemo(() => {
    if (sortConfigs.length === 0) {
      // Default sort by completion date (newest first)
      return [...filteredTasks].sort((a, b) => {
        const dateA = a.finishedAt ? new Date(a.finishedAt).getTime() : 0;
        const dateB = b.finishedAt ? new Date(b.finishedAt).getTime() : 0;
        return dateB - dateA;
      });
    }

    return [...filteredTasks].sort((a, b) => {
      for (const config of sortConfigs) {
        let comparison = 0;
        const { column, direction } = config;

        switch (column) {
          case "name":
            comparison = a.name.localeCompare(b.name, "pt-BR");
            break;
          case "customer":
            comparison = (a.customer?.fantasyName || "").localeCompare(b.customer?.fantasyName || "", "pt-BR");
            break;
          case "finishedAt":
            const dateA = a.finishedAt ? new Date(a.finishedAt).getTime() : 0;
            const dateB = b.finishedAt ? new Date(b.finishedAt).getTime() : 0;
            comparison = dateA - dateB;
            break;
          case "commissionStatus":
            comparison = (a.commissionStatus || "").localeCompare(b.commissionStatus || "");
            break;
          case "weightedValue":
            comparison = (a.weightedValue || 0) - (b.weightedValue || 0);
            break;
          case "price":
            comparison = (a.price || 0) - (b.price || 0);
            break;
        }

        if (comparison !== 0) {
          return direction === "desc" ? -comparison : comparison;
        }
      }
      return 0;
    });
  }, [filteredTasks, sortConfigs]);

  // Calculate summary statistics
  const summary = useMemo(() => {
    const total = filteredTasks.length;
    const fullCommission = filteredTasks.filter(t =>
      t.commissionStatus === COMMISSION_STATUS.FULL_COMMISSION ||
      t.commission === COMMISSION_STATUS.FULL_COMMISSION
    ).length;
    const partialCommission = filteredTasks.filter(t =>
      t.commissionStatus === COMMISSION_STATUS.PARTIAL_COMMISSION ||
      t.commission === COMMISSION_STATUS.PARTIAL_COMMISSION
    ).length;
    const totalWeighted = fullCommission + (partialCommission * 0.5);

    return { total, fullCommission, partialCommission, totalWeighted };
  }, [filteredTasks]);

  // Table columns
  const columns: StandardizedColumn<TaskInBonusRow>[] = [
    {
      key: "name",
      header: "Tarefa",
      accessor: (task) => (
        <div className="space-y-1">
          <div className="font-medium text-sm truncate">{task.name}</div>
          {(task.serialNumber || task.truck?.plate) && (
            <div className="text-xs text-muted-foreground font-mono">
              {task.serialNumber && <span>S/N: {task.serialNumber}</span>}
              {task.serialNumber && task.truck?.plate && <span className="mx-1">•</span>}
              {task.truck?.plate && <span>Placa: {task.truck.plate}</span>}
            </div>
          )}
        </div>
      ),
      sortable: true,
      className: "w-64",
      align: "left",
    },
    {
      key: "customer",
      header: "Cliente",
      accessor: (task) => (
        <div className="text-sm">
          {task.customer?.fantasyName ? (
            <div className="flex items-center gap-2">
              <IconUser className="h-3 w-3 text-muted-foreground" />
              <span className="truncate">{task.customer.fantasyName}</span>
            </div>
          ) : (
            <span className="text-muted-foreground">-</span>
          )}
        </div>
      ),
      sortable: true,
      className: "w-48",
      align: "left",
    },
    {
      key: "finishedAt",
      header: "Data Conclusão",
      accessor: (task) => (
        <div className="text-sm">
          {task.finishedAt ? (
            <div className="flex items-center gap-2">
              <IconCalendar className="h-3 w-3 text-muted-foreground" />
              <span className="font-mono">{formatDate(task.finishedAt)}</span>
            </div>
          ) : (
            <span className="text-muted-foreground">-</span>
          )}
        </div>
      ),
      sortable: true,
      className: "w-32",
      align: "center",
    },
    {
      key: "commissionStatus",
      header: "Status Comissão",
      accessor: (task) => {
        const status = task.commissionStatus || task.commission;
        if (!status) return <span className="text-muted-foreground">-</span>;

        const variant = getBadgeVariant("COMMISSION_STATUS", status);
        const label = COMMISSION_STATUS_LABELS[status] || status;

        return (
          <Badge variant={variant} className="text-xs">
            {label}
          </Badge>
        );
      },
      sortable: true,
      className: "w-36",
      align: "center",
    },
    {
      key: "weightedValue",
      header: "Valor Ponderado",
      accessor: (task) => {
        const status = task.commissionStatus || task.commission;
        let weight = 0;

        if (status === COMMISSION_STATUS.FULL_COMMISSION) {
          weight = 1.0;
        } else if (status === COMMISSION_STATUS.PARTIAL_COMMISSION) {
          weight = 0.5;
        }

        return (
          <div className="text-sm font-medium text-center tabular-nums">
            {weight.toFixed(1)}
          </div>
        );
      },
      sortable: true,
      className: "w-24",
      align: "center",
    },
  ];

  return (
    <Card className={className}>
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <IconClipboardList className="h-5 w-5 text-primary" />
              {title}
            </CardTitle>
            <CardDescription>{description}</CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="text-xs">
              {summary.total} tarefa{summary.total !== 1 ? 's' : ''}
            </Badge>
            <Badge variant="success" className="text-xs">
              {summary.totalWeighted.toFixed(1)} ponderado
            </Badge>
          </div>
        </div>

        {/* Filters */}
        <div className="flex items-center gap-4 mt-4">
          <div className="relative flex-1 max-w-sm">
            <IconSearch className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por nome, cliente, S/N ou placa..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 pr-10"
            />
            {searchTerm && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setSearchTerm("")}
                className="absolute right-1 top-1/2 transform -translate-y-1/2 h-6 w-6 p-0"
              >
                <IconX className="h-4 w-4" />
              </Button>
            )}
          </div>

          <div className="flex items-center gap-2">
            <IconAdjustments className="h-4 w-4 text-muted-foreground" />
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as COMMISSION_STATUS | "ALL")}
              className="px-3 py-2 text-sm border border-input rounded-md bg-background text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
            >
              <option value="ALL">Todos os Status</option>
              <option value={COMMISSION_STATUS.FULL_COMMISSION}>
                {COMMISSION_STATUS_LABELS[COMMISSION_STATUS.FULL_COMMISSION]}
              </option>
              <option value={COMMISSION_STATUS.PARTIAL_COMMISSION}>
                {COMMISSION_STATUS_LABELS[COMMISSION_STATUS.PARTIAL_COMMISSION]}
              </option>
              <option value={COMMISSION_STATUS.NO_COMMISSION}>
                {COMMISSION_STATUS_LABELS[COMMISSION_STATUS.NO_COMMISSION]}
              </option>
              <option value={COMMISSION_STATUS.SUSPENDED_COMMISSION}>
                {COMMISSION_STATUS_LABELS[COMMISSION_STATUS.SUSPENDED_COMMISSION]}
              </option>
            </select>
          </div>
        </div>

        {/* Summary Stats */}
        {filteredTasks.length > 0 && (
          <div className="grid grid-cols-5 gap-4 mt-4 p-4 bg-muted/30 rounded-lg">
            <div className="text-center">
              <div className="text-lg font-semibold text-foreground">{summary.total}</div>
              <div className="text-xs text-muted-foreground">Total</div>
            </div>
            <div className="text-center">
              <div className="text-lg font-semibold text-green-600">{summary.fullCommission}</div>
              <div className="text-xs text-muted-foreground">Integral</div>
            </div>
            <div className="text-center">
              <div className="text-lg font-semibold text-orange-600">{summary.partialCommission}</div>
              <div className="text-xs text-muted-foreground">Parcial</div>
            </div>
            <div className="text-center">
              <div className="text-lg font-semibold text-blue-600">{summary.totalWeighted.toFixed(1)}</div>
              <div className="text-xs text-muted-foreground">Ponderado</div>
            </div>
            <div className="text-center">
              <div className="text-lg font-semibold text-primary">{formatCurrency(summary.totalValue)}</div>
              <div className="text-xs text-muted-foreground">Valor Total</div>
            </div>
          </div>
        )}
      </CardHeader>

      <CardContent className="px-0 pb-0">
        <div className="h-96 overflow-auto">
          <StandardizedTable<TaskInBonusRow>
            columns={columns}
            data={sortedTasks}
            getItemKey={(task) => task.id}
            isLoading={isLoading}
            emptyMessage="Nenhuma tarefa encontrada"
            emptyDescription="Não há tarefas que correspondam aos filtros selecionados"
            emptyIcon={IconClipboardList}
            onSort={toggleSort}
            getSortDirection={getSortDirection}
            getSortOrder={getSortOrder}
            sortConfigs={sortConfigs.map((config) => ({ field: config.column, direction: config.direction }))}
            // Disable pagination for this card view
            currentPage={0}
            totalPages={1}
            pageSize={sortedTasks.length}
            totalRecords={sortedTasks.length}
            showPagination={false}
            showPageInfo={false}
            className="[&_table]:border-0 [&_tbody_tr]:border-b-0 [&_tbody_tr:hover]:bg-muted/50"
          />
        </div>
      </CardContent>
    </Card>
  );
}