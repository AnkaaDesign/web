import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import { StandardizedTable, type StandardizedColumn } from "@/components/ui/standardized-table";
import {
  IconChecklist,
  IconAlertCircle,
  IconCircleCheckFilled,
  IconClock,
  IconPlayerPause,
  IconX,
  IconHourglass,
  IconUser,
  IconCalendar,
  IconCurrencyReal,
  IconSearch,
  IconLayoutGrid,
  IconTable,
  IconBuildingFactory,
} from "@tabler/icons-react";
import type { Task } from "../../types";
import { formatCurrency, formatDate } from "../../utils";
import { TASK_STATUS, TASK_STATUS_LABELS, COMMISSION_STATUS, COMMISSION_STATUS_LABELS, routes } from "../../constants";
import { cn } from "@/lib/utils";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { getBadgeVariantFromStatus } from "@/components/ui/badge";
import { useTableState } from "@/hooks/use-table-state";

interface RelatedTasksCardProps {
  tasks: Task[];
  title?: string;
  icon?: React.ComponentType<any>;
  viewAllUrl?: string;
  viewAllLabel?: string;
  className?: string;
  defaultView?: "grid" | "table";
  showViewToggle?: boolean;
  displayMode?: "status" | "commission";
}

// Status icons only - colors come from centralized badge system
const TASK_STATUS_CONFIG: Record<
  string,
  {
    icon: any;
  }
> = {
  [TASK_STATUS.PENDING]: {
    icon: IconClock,
  },
  [TASK_STATUS.IN_PRODUCTION]: {
    icon: IconHourglass,
  },
  [TASK_STATUS.ON_HOLD]: {
    icon: IconPlayerPause,
  },
  [TASK_STATUS.COMPLETED]: {
    icon: IconCircleCheckFilled,
  },
  [TASK_STATUS.CANCELLED]: {
    icon: IconX,
  },
};

export function RelatedTasksCard({
  tasks = [],
  title = "Tarefas Relacionadas",
  icon: Icon = IconChecklist,
  viewAllUrl,
  viewAllLabel = "Ver todas as tarefas",
  className,
  defaultView = "grid",
  showViewToggle = true,
  displayMode = "status",
}: RelatedTasksCardProps) {
  const navigate = useNavigate();
  const [viewMode, setViewMode] = useState<"grid" | "table">(defaultView);
  const [searchTerm, setSearchTerm] = useState("");

  const {
    sortConfigs,
    toggleSort,
    getSortDirection,
    getSortOrder,
  } = useTableState({
    defaultPageSize: 50,
    resetSelectionOnPageChange: false,
  });

  // Filter tasks by search term
  const filteredTasks = useMemo(() => {
    if (!searchTerm) return tasks;

    // Normalize search term - remove spaces, hyphens, and special chars for better matching
    const search = searchTerm.toLowerCase().trim();
    const normalizedSearch = search.replace(/[\s\-_./]/g, "");

    return tasks.filter((task) => {
      const taskName = task.name?.toLowerCase() || "";
      const serialNumber = task.serialNumber?.toLowerCase() || "";
      const normalizedSerialNumber = serialNumber.replace(/[\s\-_./]/g, "");
      const plate = task.plate?.toLowerCase() || "";
      const normalizedPlate = plate.replace(/[\s\-_./]/g, "");
      const customerName = task.customer?.fantasyName?.toLowerCase() || "";
      // Support both user and createdBy fields for compatibility
      const userName = (task.user?.name || (task as any).createdBy?.name)?.toLowerCase() || "";
      const sectorName = task.sector?.name?.toLowerCase() || "";
      const taskId = task.id?.toLowerCase() || "";

      return (
        taskName.includes(search) ||
        serialNumber.includes(search) ||
        normalizedSerialNumber.includes(normalizedSearch) ||
        plate.includes(search) ||
        normalizedPlate.includes(normalizedSearch) ||
        customerName.includes(search) ||
        userName.includes(search) ||
        sectorName.includes(search) ||
        taskId.includes(search)
      );
    });
  }, [tasks, searchTerm]);

  // Sort tasks by status priority and date
  const sortedTasks = useMemo(() => {
    if (viewMode === "table" && sortConfigs.length > 0) {
      return [...filteredTasks].sort((a, b) => {
        for (const config of sortConfigs) {
          let comparison = 0;
          const { column, direction } = config;

          switch (column) {
            case "name":
              comparison = (a.name || "").localeCompare(b.name || "", "pt-BR");
              break;
            case "customer":
              comparison = (a.customer?.fantasyName || "").localeCompare(b.customer?.fantasyName || "", "pt-BR");
              break;
            case "createdAt":
              comparison = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
              break;
            case "status":
              comparison = (a.status || "").localeCompare(b.status || "");
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
    }

    // Default sort for grid view
    return [...filteredTasks].sort((a, b) => {
      const statusPriority: Record<string, number> = {
        [TASK_STATUS.IN_PRODUCTION]: 1,
        [TASK_STATUS.ON_HOLD]: 2,
        [TASK_STATUS.PENDING]: 3,
        [TASK_STATUS.COMPLETED]: 4,
        [TASK_STATUS.CANCELLED]: 5,
      };

      const aPriority = statusPriority[a.status] ?? 6;
      const bPriority = statusPriority[b.status] ?? 6;

      if (aPriority !== bPriority) return aPriority - bPriority;

      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });
  }, [filteredTasks, viewMode, sortConfigs]);

  // Calculate statistics
  const statistics = useMemo(() => {
    const totalTasks = tasks.length;
    const activeTasks = tasks.filter(
      (task) => task.status !== TASK_STATUS.CANCELLED && task.status !== TASK_STATUS.COMPLETED
    ).length;
    const completedTasks = tasks.filter((task) => task.status === TASK_STATUS.COMPLETED).length;
    const totalValue = tasks.reduce((sum, task) => sum + (task.price || 0), 0);

    const statusCounts = tasks.reduce(
      (acc, task) => {
        acc[task.status] = (acc[task.status] || 0) + 1;
        return acc;
      },
      {} as Record<string, number>
    );

    const commissionCounts = tasks.reduce(
      (acc, task) => {
        const commission = task.commission || "NO_COMMISSION";
        acc[commission] = (acc[commission] || 0) + 1;
        return acc;
      },
      {} as Record<string, number>
    );

    return {
      totalTasks,
      activeTasks,
      completedTasks,
      totalValue,
      statusCounts,
      commissionCounts,
    };
  }, [tasks]);

  // Get task title
  const getTaskTitle = (task: Task) => {
    if (task.name) return task.name;
    if (task.details) return task.details;
    if (task.services && task.services.length > 0) {
      return task.services.map((service: any) => service.description).join(", ");
    }
    return `Tarefa #${task.id.slice(-8).toUpperCase()}`;
  };

  // Table columns
  const columns: StandardizedColumn<Task>[] = [
    {
      key: "name",
      header: "Tarefa",
      accessor: (task) => (
        <div className="space-y-1">
          <div className="font-medium text-sm truncate">{getTaskTitle(task)}</div>
          {(task.serialNumber || task.plate) && (
            <div className="text-xs text-muted-foreground">
              {task.serialNumber && <span>S/N: {task.serialNumber}</span>}
              {task.serialNumber && task.plate && <span className="mx-1">•</span>}
              {task.plate && <span>Placa: {task.plate}</span>}
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
      key: "sector",
      header: "Setor",
      accessor: (task) => (
        <div className="text-sm">
          {task.sector?.name ? (
            <div className="flex items-center gap-2">
              <IconBuildingFactory className="h-3 w-3 text-muted-foreground" />
              <span className="truncate">{task.sector.name}</span>
            </div>
          ) : (
            <span className="text-muted-foreground">-</span>
          )}
        </div>
      ),
      sortable: true,
      className: "w-40",
      align: "left",
    },
    {
      key: "createdAt",
      header: "Data Criação",
      accessor: (task) => (
        <div className="text-sm">
          <div className="flex items-center gap-2">
            <IconCalendar className="h-3 w-3 text-muted-foreground" />
            <span>{formatDate(task.createdAt)}</span>
          </div>
        </div>
      ),
      sortable: true,
      className: "w-32",
      align: "center",
    },
    {
      key: displayMode === "commission" ? "commission" : "status",
      header: displayMode === "commission" ? "Comissão" : "Status",
      accessor: (task) => {
        if (displayMode === "commission") {
          const variant = getBadgeVariantFromStatus(task.commission || "NO_COMMISSION", "COMMISSION_STATUS");
          const label = COMMISSION_STATUS_LABELS[task.commission as keyof typeof COMMISSION_STATUS_LABELS] || task.commission || "Sem Comissão";

          return (
            <Badge variant={variant} className="text-xs">
              {label}
            </Badge>
          );
        } else {
          const variant = getBadgeVariantFromStatus(task.status, "TASK");
          const label = TASK_STATUS_LABELS[task.status] || task.status;

          return (
            <Badge variant={variant} className="text-xs">
              {label}
            </Badge>
          );
        }
      },
      sortable: true,
      className: "w-32",
      align: "center",
    },
    {
      key: "price",
      header: "Valor",
      accessor: (task) => (
        <div className="text-sm font-medium text-right">
          {task.price ? (
            <div className="flex items-center justify-end gap-2">
              <IconCurrencyReal className="h-3 w-3 text-muted-foreground" />
              <span className="tabular-nums">{formatCurrency(task.price)}</span>
            </div>
          ) : (
            <span className="text-muted-foreground">-</span>
          )}
        </div>
      ),
      sortable: true,
      className: "w-32",
      align: "right",
    },
  ];

  if (tasks.length === 0) {
    return (
      <Card className={cn("shadow-sm border border-border", className)} level={1}>
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-3 text-xl">
              <div className="p-2 rounded-lg bg-primary/10">
                <Icon className="h-5 w-5 text-primary" />
              </div>
              {title}
            </CardTitle>
            {viewAllUrl && (
              <Button variant="outline" size="sm" onClick={() => navigate(viewAllUrl)}>
                {viewAllLabel}
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="text-center py-12">
            <IconAlertCircle className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <p className="text-muted-foreground">Nenhuma tarefa encontrada.</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={cn("shadow-sm border border-border flex flex-col overflow-hidden", className)} level={1}>
      <CardHeader className="pb-4 flex-shrink-0">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-3 text-xl">
            <div className="p-2 rounded-lg bg-primary/10">
              <Icon className="h-5 w-5 text-primary" />
            </div>
            {title}
          </CardTitle>
          <div className="flex items-center gap-2">
            {showViewToggle && (
              <div className="flex items-center gap-1 mr-2">
                <Button
                  variant={viewMode === "grid" ? "default" : "ghost"}
                  size="sm"
                  onClick={() => setViewMode("grid")}
                  className="h-8 w-8 p-0"
                >
                  <IconLayoutGrid className="h-4 w-4" />
                </Button>
                <Button
                  variant={viewMode === "table" ? "default" : "ghost"}
                  size="sm"
                  onClick={() => setViewMode("table")}
                  className="h-8 w-8 p-0"
                >
                  <IconTable className="h-4 w-4" />
                </Button>
              </div>
            )}
            {viewAllUrl && (
              <Button variant="outline" size="sm" onClick={() => navigate(viewAllUrl)}>
                {viewAllLabel}
              </Button>
            )}
          </div>
        </div>
      </CardHeader>

      <CardContent className="pt-0 flex-1 flex flex-col min-h-0 overflow-hidden">
        {/* Search */}
        <div className="relative mb-4 flex-shrink-0">
          <IconSearch className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por nome, cliente, setor, S/N ou placa..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e?.target?.value || "")}
            className="pl-10"
          />
        </div>

        {/* Tasks Display */}
        {viewMode === "grid" ? (
          <ScrollArea className="flex-1 min-h-0 h-full">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pr-4">
              {sortedTasks.map((task, index) => {
                const config = TASK_STATUS_CONFIG[task.status];
                const StatusIcon = config.icon;
                const taskDescription = getTaskTitle(task);
                const variant = getBadgeVariantFromStatus(task.status, "TASK");

                return (
                  <div
                    key={task.id}
                    onClick={() => navigate(routes.production.schedule.details(task.id))}
                    className="relative group p-5 rounded-lg border border-border hover:border-primary/30 transition-all duration-300 hover:shadow-md cursor-pointer"
                  >
                    {/* Index Number */}
                    <div className="absolute top-4 left-4 w-8 h-8 rounded-full bg-muted/50 flex items-center justify-center">
                      <span className="text-xs font-semibold text-muted-foreground">
                        {(index + 1).toString().padStart(2, '0')}
                      </span>
                    </div>

                    {/* Status/Commission Badge */}
                    <div className="absolute top-4 right-4">
                      {displayMode === "commission" ? (
                        <Badge variant={getBadgeVariantFromStatus(task.commission || "NO_COMMISSION", "COMMISSION_STATUS")}>
                          {COMMISSION_STATUS_LABELS[task.commission as keyof typeof COMMISSION_STATUS_LABELS] || task.commission || "Sem Comissão"}
                        </Badge>
                      ) : (
                        <Badge variant={getBadgeVariantFromStatus(task.status, "TASK")}>
                          {TASK_STATUS_LABELS[task.status]}
                        </Badge>
                      )}
                    </div>

                    {/* Task Content */}
                    <div className="mt-12 space-y-4">
                      {/* Task Name */}
                      <div>
                        <h4 className="font-semibold text-base line-clamp-2 text-foreground group-hover:text-primary transition-colors">
                          {taskDescription}
                        </h4>
                      </div>

                      {/* Info Stack */}
                      <div className="space-y-3">
                        {/* Customer */}
                        {task.customer && (
                          <div className="p-3 rounded-lg bg-muted/50">
                            <div className="flex items-start gap-2">
                              <IconUser className="h-3.5 w-3.5 text-muted-foreground mt-0.5 flex-shrink-0" />
                              <div className="space-y-0.5 flex-1 min-w-0">
                                <p className="text-xs text-muted-foreground">Cliente</p>
                                <p className="text-sm font-medium truncate" title={task.customer?.fantasyName || 'Sem cliente'}>
                                  {task.customer?.fantasyName || 'Sem cliente'}
                                </p>
                              </div>
                            </div>
                          </div>
                        )}

                        {/* User */}
                        {(task.user || (task as any).createdBy) && (
                          <div className="p-3 rounded-lg bg-muted/50">
                            <div className="flex items-start gap-2">
                              <IconUser className="h-3.5 w-3.5 text-muted-foreground mt-0.5 flex-shrink-0" />
                              <div className="space-y-0.5 flex-1 min-w-0">
                                <p className="text-xs text-muted-foreground">Responsável</p>
                                <p className="text-sm font-medium truncate" title={task.user?.name || (task as any).createdBy?.name || 'Sem responsável'}>
                                  {task.user?.name || (task as any).createdBy?.name || 'Sem responsável'}
                                </p>
                              </div>
                            </div>
                          </div>
                        )}

                        {/* Sector */}
                        <div className="p-3 rounded-lg bg-muted/50">
                          <div className="flex items-start gap-2">
                            <IconBuildingFactory className="h-3.5 w-3.5 text-muted-foreground mt-0.5 flex-shrink-0" />
                            <div className="space-y-0.5 flex-1 min-w-0">
                              <p className="text-xs text-muted-foreground">Setor</p>
                              <p className="text-sm font-medium truncate" title={task.sector?.name || 'Sem setor'}>
                                {task.sector?.name || 'Sem setor'}
                              </p>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Footer with Date */}
                      {(task.finishedAt || task.createdAt) && (
                        <div className="flex items-center justify-between pt-3 border-t border-border/50">
                          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                            <IconCalendar className="h-3.5 w-3.5" />
                            <span>{task.finishedAt ? 'Concluída' : 'Criada'}</span>
                          </div>
                          <span className="text-xs font-medium text-muted-foreground">
                            {new Date(task.finishedAt || task.createdAt).toLocaleDateString('pt-BR', {
                              day: '2-digit',
                              month: 'short',
                              year: 'numeric'
                            })}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </ScrollArea>
        ) : (
          <div className="flex-1 min-h-0 overflow-auto">
            <StandardizedTable<Task>
              columns={columns}
              data={sortedTasks}
              getItemKey={(task) => task.id}
              isLoading={false}
              emptyMessage="Nenhuma tarefa encontrada"
              emptyDescription="Não há tarefas que correspondam aos filtros selecionados"
              emptyIcon={IconChecklist}
              onSort={toggleSort}
              getSortDirection={getSortDirection}
              getSortOrder={getSortOrder}
              sortConfigs={sortConfigs.map((config) => ({ field: config.column, direction: config.direction }))}
              onRowClick={(task) => navigate(routes.production.schedule.details(task.id))}
              currentPage={0}
              totalPages={1}
              pageSize={sortedTasks.length}
              totalRecords={sortedTasks.length}
              showPagination={false}
              showPageInfo={false}
              className="[&_table]:border-0 [&_tbody_tr]:border-b-0 [&_tbody_tr:hover]:bg-muted/50"
            />
          </div>
        )}

        {/* Status/Commission Summary - Moved to Bottom */}
        <div className="flex flex-wrap gap-2 mt-4 pt-4 border-t border-border flex-shrink-0">
          {displayMode === "commission" ? (
            [COMMISSION_STATUS.FULL_COMMISSION, COMMISSION_STATUS.PARTIAL_COMMISSION, COMMISSION_STATUS.NO_COMMISSION, COMMISSION_STATUS.SUSPENDED_COMMISSION].map(
              (commission: string) => {
                const count = statistics.commissionCounts[commission] || 0;
                const variant = getBadgeVariantFromStatus(commission, "COMMISSION_STATUS");
                return (
                  <Badge key={commission} variant={variant} className="font-medium">
                    {COMMISSION_STATUS_LABELS[commission as keyof typeof COMMISSION_STATUS_LABELS]} ({count})
                  </Badge>
                );
              }
            )
          ) : (
            [TASK_STATUS.PENDING, TASK_STATUS.IN_PRODUCTION, TASK_STATUS.ON_HOLD, TASK_STATUS.COMPLETED, TASK_STATUS.CANCELLED].map(
              (status: string) => {
                const count = statistics.statusCounts[status] || 0;
                const variant = getBadgeVariantFromStatus(status, "TASK");
                return (
                  <Badge key={status} variant={variant} className="font-medium">
                    {TASK_STATUS_LABELS[status as TASK_STATUS]} ({count})
                  </Badge>
                );
              }
            )
          )}
        </div>
      </CardContent>
    </Card>
  );
}
