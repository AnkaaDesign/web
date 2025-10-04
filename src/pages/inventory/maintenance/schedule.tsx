import React, { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useMaintenanceSchedules, useMaintenanceScheduleMutations } from "../../../hooks";
import type { MaintenanceSchedule } from "../../../types";
import type { MaintenanceScheduleGetManyFormData } from "../../../schemas";
import { routes, SCHEDULE_FREQUENCY_LABELS, SECTOR_PRIVILEGES } from "../../../constants";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  IconSearch,
  IconPlus,
  IconCalendar,
  IconClock,
  IconSettings,
  IconEdit,
  IconTrash,
  IconPackage,
  IconRefresh,
  IconAlertCircle,
  IconPlayerPlay,
  IconPlayerPause,
} from "@tabler/icons-react";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { format, formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { PrivilegeRoute } from "@/components/navigation/privilege-route";
import { PageHeader } from "@/components/ui/page-header";
import { usePageTracker } from "@/hooks/use-page-tracker";
import { useDebounce } from "@/hooks/use-debounce";
import { ContextMenuProvider, useContextMenu, type ContextMenuItem } from "@/components/ui/context-menu";

interface MaintenanceScheduleListProps {
  className?: string;
}

function MaintenanceScheduleCard({ schedule, onRefresh }: { schedule: MaintenanceSchedule; onRefresh: () => void }) {
  const navigate = useNavigate();
  const { openMenu } = useContextMenu();
  const { deleteMutation, updateMutation } = useMaintenanceScheduleMutations();

  const handleEdit = () => {
    navigate(routes.inventory.maintenance.schedules.edit(schedule.id));
  };

  const handleDelete = async () => {
    if (window.confirm(`Tem certeza que deseja excluir o agendamento "${schedule.name}"? Esta ação não pode ser desfeita.`)) {
      try {
        await deleteMutation.mutateAsync(schedule.id);
        onRefresh();
      } catch (error) {
        // Error is handled by API client
      }
    }
  };

  const handleToggleActive = async () => {
    const action = schedule.isActive ? "desativar" : "ativar";
    const confirmMessage = `Tem certeza que deseja ${action} o agendamento "${schedule.name}"?`;

    if (window.confirm(confirmMessage)) {
      try {
        await updateMutation.mutateAsync({
          id: schedule.id,
          data: { isActive: !schedule.isActive },
        });
        onRefresh();
      } catch (error) {
        // Error is handled by API client
      }
    }
  };

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    const menuItems: ContextMenuItem[] = [
      {
        id: "edit",
        label: "Editar",
        icon: <IconEdit className="h-4 w-4" />,
        onClick: handleEdit,
      },
      {
        id: "toggle-active",
        label: schedule.isActive ? "Desativar" : "Ativar",
        icon: schedule.isActive ? <IconPlayerPause className="h-4 w-4" /> : <IconPlayerPlay className="h-4 w-4" />,
        onClick: handleToggleActive,
      },
      {
        id: "delete",
        label: "Excluir",
        icon: <IconTrash className="h-4 w-4" />,
        onClick: handleDelete,
        variant: "destructive",
      },
    ];

    openMenu(e.clientX, e.clientY, menuItems);
  };

  const getFrequencyLabel = () => {
    const baseLabel = SCHEDULE_FREQUENCY_LABELS[schedule.frequency] || schedule.frequency;
    if (schedule.frequencyCount && schedule.frequencyCount > 1) {
      switch (schedule.frequency) {
        case "DAILY":
          return `A cada ${schedule.frequencyCount} dias`;
        case "WEEKLY":
          return schedule.frequencyCount === 2 ? "Quinzenal" : `A cada ${schedule.frequencyCount} semanas`;
        case "MONTHLY":
          if (schedule.frequencyCount === 2) return "Bimestral";
          if (schedule.frequencyCount === 3) return "Trimestral";
          if (schedule.frequencyCount === 6) return "Semestral";
          return `A cada ${schedule.frequencyCount} meses`;
        case "ANNUAL":
          return schedule.frequencyCount === 1 ? "Anual" : `A cada ${schedule.frequencyCount} anos`;
        default:
          return baseLabel;
      }
    }
    return baseLabel;
  };

  // Calculate next run in relative time
  const getNextRunInfo = () => {
    if (!schedule.nextRun) return null;
    const nextRunDate = new Date(schedule.nextRun);
    const now = new Date();
    const isOverdue = nextRunDate < now;

    return {
      date: nextRunDate,
      relative: formatDistanceToNow(nextRunDate, { locale: ptBR, addSuffix: true }),
      isOverdue,
    };
  };

  const nextRunInfo = getNextRunInfo();

  return (
    <Card
      className="relative overflow-hidden hover:shadow-lg transition-all duration-200 cursor-pointer group"
      onClick={() => navigate(routes.inventory.maintenance.schedules.details(schedule.id))}
      onContextMenu={handleContextMenu}
    >
      <div className="p-5">
        {/* Header with title and status */}
        <div className="flex items-start justify-between mb-3">
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-base text-foreground group-hover:text-primary transition-colors truncate">{schedule.name}</h3>

            {/* Item being maintained - highlighted */}
            {schedule.item && (
              <div className="flex items-center gap-1.5 mt-1">
                <IconPackage className="h-3.5 w-3.5 text-primary flex-shrink-0" />
                <p className="text-sm font-medium text-primary truncate">{schedule.item.name}</p>
              </div>
            )}

            {schedule.description && <p className="text-xs text-muted-foreground mt-1 line-clamp-1">{schedule.description}</p>}
          </div>

          <Badge variant={schedule.isActive ? "active" : "inactive"} className="ml-2 flex-shrink-0 text-xs">
            {schedule.isActive ? "Ativo" : "Inativo"}
          </Badge>
        </div>

        {/* Main info section */}
        <div className="space-y-2.5">
          {/* Frequency */}
          <div className="flex items-start gap-2">
            <IconRefresh className="h-3.5 w-3.5 text-muted-foreground mt-0.5 flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-xs text-muted-foreground">Periodicidade</p>
              <p className="text-sm font-medium text-foreground">{getFrequencyLabel()}</p>
            </div>
          </div>

          {/* Next/First execution */}
          {nextRunInfo && (
            <div className="flex items-start gap-2">
              <IconCalendar className={cn("h-3.5 w-3.5 mt-0.5 flex-shrink-0", nextRunInfo.isOverdue ? "text-orange-500" : "text-muted-foreground")} />
              <div className="flex-1 min-w-0">
                <p className="text-xs text-muted-foreground">{!schedule.lastRun ? "Primeira execução" : "Próxima manutenção"}</p>
                <p className={cn("text-sm font-medium", nextRunInfo.isOverdue ? "text-orange-600" : "text-foreground")}>
                  {format(nextRunInfo.date, "dd/MM/yyyy", { locale: ptBR })}
                </p>
              </div>
              {nextRunInfo.isOverdue && <IconAlertCircle className="h-4 w-4 text-orange-500 flex-shrink-0" />}
            </div>
          )}

          {/* Last execution */}
          {schedule.lastRun && (
            <div className="flex items-start gap-2">
              <IconClock className="h-3.5 w-3.5 text-muted-foreground mt-0.5 flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-xs text-muted-foreground">Última manutenção</p>
                <p className="text-sm font-medium text-foreground">{format(new Date(schedule.lastRun), "dd/MM/yyyy", { locale: ptBR })}</p>
              </div>
            </div>
          )}

          {/* Items used for maintenance */}
          {schedule.maintenanceItemsConfig && schedule.maintenanceItemsConfig.length > 0 && (
            <div className="flex items-start gap-2">
              <IconSettings className="h-3.5 w-3.5 text-muted-foreground mt-0.5 flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-xs text-muted-foreground">Itens utilizados</p>
                <p className="text-sm font-medium text-foreground">
                  {schedule.maintenanceItemsConfig.length} {schedule.maintenanceItemsConfig.length === 1 ? "item" : "itens"}
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </Card>
  );
}

// Create the list component to separate concerns
function MaintenanceScheduleList({ className }: MaintenanceScheduleListProps) {
  const navigate = useNavigate();

  // Search state
  const [searchTerm, setSearchTerm] = useState("");
  const debouncedSearchTerm = useDebounce(searchTerm, 500);

  // Query filters
  const queryFilters = useMemo(() => {
    const filters: MaintenanceScheduleGetManyFormData = {
      limit: 100,
      orderBy: { name: "asc" },
      include: {
        item: true,
      },
    };

    if (debouncedSearchTerm && debouncedSearchTerm.trim() !== "") {
      filters.searchingFor = debouncedSearchTerm;
    }

    return filters;
  }, [debouncedSearchTerm]);

  // Fetch schedules
  const { data: schedulesData, isLoading, refresh } = useMaintenanceSchedules(queryFilters);

  const schedules = schedulesData?.data || [];

  return (
    <Card className={cn("h-full flex flex-col shadow-sm border border-border", className)}>
      <CardContent className="flex-1 flex flex-col p-6 space-y-4 overflow-hidden">
        {/* Search */}
        <div className="relative w-full">
          <IconSearch className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
          <Input
            type="text"
            placeholder="Buscar agendamentos..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10 w-full"
            disabled={isLoading}
          />
        </div>

        {/* Schedules Grid */}
        <div className="flex-1 min-h-0 overflow-auto">
          {isLoading ? (
            <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
              {Array.from({ length: 6 }).map((_, i) => (
                <Card key={i} className="p-5">
                  <div className="space-y-3">
                    <Skeleton className="h-5 w-3/4" />
                    <Skeleton className="h-3 w-full" />
                    <div className="space-y-2 pt-2">
                      <Skeleton className="h-4 w-1/2" />
                      <Skeleton className="h-4 w-2/3" />
                      <Skeleton className="h-4 w-3/4" />
                    </div>
                    <div className="pt-3 border-t">
                      <Skeleton className="h-3 w-1/3 mb-1.5" />
                      <div className="flex gap-1">
                        <Skeleton className="h-5 w-16" />
                        <Skeleton className="h-5 w-16" />
                      </div>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          ) : schedules.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center p-8">
              <IconCalendar className="h-16 w-16 text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold text-foreground mb-2">{debouncedSearchTerm ? "Nenhum agendamento encontrado" : "Nenhum agendamento cadastrado"}</h3>
              <p className="text-muted-foreground mb-4 max-w-md">
                {debouncedSearchTerm
                  ? "Tente ajustar os termos da busca ou limpe o filtro para ver todos os agendamentos."
                  : "Crie seu primeiro agendamento de manutenção para automatizar o processo."}
              </p>
              {!debouncedSearchTerm && (
                <Button onClick={() => navigate(routes.inventory.maintenance.schedules.create)} className="gap-2">
                  <IconPlus className="h-4 w-4" />
                  Criar Primeiro Agendamento
                </Button>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
              {schedules.map((schedule) => (
                <MaintenanceScheduleCard key={schedule.id} schedule={schedule} onRefresh={refresh} />
              ))}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

export function MaintenanceSchedulePage() {
  const navigate = useNavigate();

  // Track page access
  usePageTracker({
    title: "Agendamentos de Manutenção",
    icon: "calendar",
  });

  return (
    <PrivilegeRoute requiredPrivilege={SECTOR_PRIVILEGES.WAREHOUSE}>
      <ContextMenuProvider>
        <div className="flex flex-col h-full space-y-4">
          <div className="flex-shrink-0">
            <PageHeader
              variant="default"
              title="Agendamentos de Manutenção"
              icon={IconCalendar}
              breadcrumbs={[
                { label: "Início", href: routes.home },
                { label: "Estoque", href: routes.inventory.root },
                { label: "Manutenção", href: routes.inventory.maintenance.root },
                { label: "Agendamentos" },
              ]}
              actions={[
                {
                  key: "create",
                  label: "Novo Agendamento",
                  icon: IconPlus,
                  onClick: () => navigate(routes.inventory.maintenance.schedules.create),
                  variant: "default",
                },
              ]}
            />
          </div>
          <MaintenanceScheduleList className="flex-1 min-h-0" />
        </div>
      </ContextMenuProvider>
    </PrivilegeRoute>
  );
}
