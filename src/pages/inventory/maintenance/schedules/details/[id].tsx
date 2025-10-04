import { useNavigate, useParams } from "react-router-dom";
import {
  IconAlertTriangle,
  IconRefresh,
  IconTools,
  IconCalendar,
  IconClock,
  IconEdit,
  IconTrash,
  IconPackage,
  IconHistory,
  IconCalendarTime,
  IconAlertCircle,
  IconCircleCheck,
  IconX,
  IconArrowRight,
  IconCalendarCheck,
  IconCalendarClock,
  IconInfoCircle,
  IconFileCheck,
  IconCalendarEvent,
  IconRepeat,
  IconClipboardList,
  IconAlertTriangleFilled,
} from "@tabler/icons-react";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";
import { TruncatedTextWithTooltip } from "@/components/ui/truncated-text-with-tooltip";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { formatDate, formatDateTime, formatRelativeTime } from "../../../../../utils";
import { useMaintenanceSchedule, useItems } from "../../../../../hooks";
import { MAINTENANCE_STATUS, MAINTENANCE_STATUS_LABELS, routes, getDynamicFrequencyLabel, CHANGE_LOG_ENTITY_TYPE } from "../../../../../constants";
import { ChangelogHistory } from "@/components/ui/changelog-history";
import { useState } from "react";
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
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export function MaintenanceScheduleDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [isDeleting, setIsDeleting] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);

  const {
    data: response,
    isLoading,
    error,
    refetch,
  } = useMaintenanceSchedule(id!, {
    include: {
      item: {
        include: {
          brand: true,
          category: true,
        },
      },
      maintenances: {
        orderBy: {
          scheduledFor: "desc",
        },
        take: 50,
        include: {
          item: true,
        },
      },
      weeklyConfig: true,
      monthlyConfig: true,
      yearlyConfig: true,
      count: true,
    },
    enabled: !!id,
  });

  const schedule = response?.data;

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 dark:from-neutral-900 dark:to-neutral-800">
        <div className="container mx-auto p-4 sm:p-6 max-w-7xl">
          <div className="animate-pulse space-y-6">
            {/* Header Skeleton */}
            <div className="space-y-4">
              <div className="flex items-center space-x-2">
                <div className="h-4 w-16 bg-muted rounded"></div>
                <div className="h-4 w-4 bg-muted rounded"></div>
                <div className="h-4 w-20 bg-muted rounded"></div>
                <div className="h-4 w-4 bg-muted rounded"></div>
                <div className="h-4 w-24 bg-muted rounded"></div>
              </div>
              <div className="flex items-center justify-between">
                <div className="h-8 bg-muted rounded w-48"></div>
                <div className="flex gap-2">
                  <div className="h-9 w-20 bg-muted rounded"></div>
                  <div className="h-9 w-20 bg-muted rounded"></div>
                  <div className="h-9 w-16 bg-muted rounded"></div>
                </div>
              </div>
            </div>

            {/* Header Card Skeleton */}
            <div className="h-48 bg-muted rounded-xl"></div>

            {/* Content Grid Skeleton */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="h-96 bg-muted rounded-xl"></div>
              <div className="h-96 bg-muted rounded-xl"></div>
              <div className="h-96 bg-muted rounded-xl"></div>
              <div className="h-96 bg-muted rounded-xl"></div>
            </div>

            {/* Full Width Card Skeletons */}
            <div className="space-y-6">
              <div className="h-64 bg-muted rounded-xl"></div>
              <div className="h-64 bg-muted rounded-xl"></div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (error || !schedule) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 dark:from-neutral-900 dark:to-neutral-800">
        <div className="container mx-auto p-4 sm:p-6 max-w-7xl">
          <div className="flex flex-1 items-center justify-center min-h-[60vh]">
            <div className="text-center px-4 max-w-md mx-auto">
              <div className="animate-in fade-in-50 duration-500">
                <div className="p-4 bg-red-50 dark:bg-red-900/20 rounded-full w-20 h-20 mx-auto mb-6 flex items-center justify-center">
                  <IconAlertTriangle className="h-10 w-10 text-red-500" />
                </div>
                <h2 className="text-xl sm:text-2xl font-semibold mb-3 text-foreground">Agendamento não encontrado</h2>
                <p className="text-sm sm:text-base text-muted-foreground mb-6 leading-relaxed">
                  O agendamento de manutenção que você está procurando não existe ou foi removido do sistema.
                </p>
                <div className="space-y-3">
                  <Button onClick={() => navigate(routes.inventory.maintenance.schedules.root)} className="w-full sm:w-auto">
                    Ir para Lista de Agendamentos
                  </Button>
                  <Button variant="outline" onClick={() => navigate(routes.inventory.root)} className="w-full sm:w-auto">
                    Ir para Estoque
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const handleRefresh = () => {
    refetch();
    toast.success("Dados atualizados");
  };

  const handleDelete = async () => {
    setIsDeleting(true);
    try {
      // TODO: Implement delete
      toast.success("Agendamento excluído com sucesso");
      navigate(routes.inventory.maintenance.schedules.root);
    } catch (error) {
      toast.error("Erro ao excluir agendamento");
    } finally {
      setIsDeleting(false);
      setShowDeleteDialog(false);
    }
  };

  const itemsNeededConfig = schedule.maintenanceItemsConfig as any;
  const hasItemsNeeded = itemsNeededConfig && Array.isArray(itemsNeededConfig.items) && itemsNeededConfig.items.length > 0;

  // Get next maintenance
  const nextMaintenance = schedule.maintenances?.find((m) => m.status === MAINTENANCE_STATUS.PENDING && new Date(m.scheduledFor!) > new Date());

  const isOverdue = schedule.nextRun ? new Date(schedule.nextRun) < new Date() : false;

  return (
    <div className="space-y-6">
      {/* Hero Section */}
      <div className="animate-in fade-in-50 duration-500">
        <PageHeader
          variant="detail"
          title={schedule.name}
          icon={IconCalendarEvent}
          className="shadow-lg"
          breadcrumbs={[
            { label: "Início", href: routes.home },
            { label: "Estoque", href: routes.inventory.root },
            { label: "Manutenções", href: routes.inventory.maintenance.root },
            { label: "Agendamentos", href: routes.inventory.maintenance.schedules.root },
            { label: schedule.name },
          ]}
          actions={[
            {
              key: "refresh",
              label: "Atualizar",
              onClick: handleRefresh,
              icon: IconRefresh,
            },
            {
              key: "edit",
              label: "Editar",
              onClick: () => navigate(routes.inventory.maintenance.schedules.edit(schedule.id)),
              icon: IconEdit,
            },
            {
              key: "delete",
              label: "Excluir",
              onClick: () => setShowDeleteDialog(true),
              icon: IconTrash,
              loading: isDeleting,
            },
          ]}
          metrics={[
            {
              label: "Total de Manutenções",
              value: schedule.maintenances?.length || 0,
              icon: IconTools,
            },
            {
              label: "Próxima Execução",
              value: schedule.nextRun ? formatRelativeTime(new Date(schedule.nextRun)) : "Não agendada",
              icon: IconCalendar,
              // variant: isOverdue ? "destructive" : "default",  // Comment out - metrics don't have variant prop
            },
          ]}
        />
      </div>

      {/* Core Information Grid - Configuration and Item */}
      <div className="animate-in fade-in-50 duration-700">
        {/* Mobile: Single column stacked */}
        <div className="block lg:hidden space-y-4">
          <ScheduleConfigurationCard schedule={schedule} isOverdue={isOverdue} className="h-full" />
          <MaintenanceItemCard schedule={schedule} className="h-full" />
        </div>

        {/* Desktop/Tablet: 2 columns grid */}
        <div className="hidden lg:block">
          <div className="grid grid-cols-2 gap-6">
            <ScheduleConfigurationCard schedule={schedule} isOverdue={isOverdue} className="h-full" />
            <MaintenanceItemCard schedule={schedule} className="h-full" />
          </div>
        </div>
      </div>

      {/* History and Items Needed Grid */}
      <div className="animate-in fade-in-50 duration-800">
        {/* Mobile: Single column stacked */}
        <div className="block lg:hidden space-y-4">
          <MaintenanceHistoryCard schedule={schedule} nextMaintenance={nextMaintenance} className="h-full" />
          {hasItemsNeeded && <ItemsNeededCard itemsNeededConfig={itemsNeededConfig} className="h-full" />}
        </div>

        {/* Desktop/Tablet: 2 columns grid or full width */}
        <div className="hidden lg:block">
          {hasItemsNeeded ? (
            <div className="grid grid-cols-2 gap-6">
              <MaintenanceHistoryCard schedule={schedule} nextMaintenance={nextMaintenance} className="h-full" />
              <ItemsNeededCard itemsNeededConfig={itemsNeededConfig} className="h-full" />
            </div>
          ) : (
            <MaintenanceHistoryCard schedule={schedule} nextMaintenance={nextMaintenance} />
          )}
        </div>
      </div>

      {/* Changelog History - Full Width */}
      <div className="animate-in fade-in-50 duration-900">
        <ChangelogHistory
          entityType={CHANGE_LOG_ENTITY_TYPE.MAINTENANCE_SCHEDULE}
          entityId={schedule.id}
          entityName={schedule.name}
          entityCreatedAt={schedule.createdAt}
          className="h-full"
          maxHeight="500px"
        />
      </div>

      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir Agendamento</AlertDialogTitle>
            <AlertDialogDescription>Tem certeza que deseja excluir este agendamento? Esta ação não pode ser desfeita.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// Schedule Configuration Card Component
function ScheduleConfigurationCard({ schedule, isOverdue, className }: { schedule: any; isOverdue: boolean; className?: string }) {
  const getScheduleDetails = () => {
    if (schedule.weeklyConfig) {
      const days = schedule.weeklyConfig.daysOfWeek?.map((day: string) => day).join(", ") || "";
      return `Dias: ${days}`;
    }
    if (schedule.monthlyConfig) {
      return `Dia ${schedule.monthlyConfig.dayOfMonth} de cada mês`;
    }
    if (schedule.yearlyConfig) {
      return `${schedule.yearlyConfig.dayOfMonth}/${schedule.yearlyConfig.month}`;
    }
    if (schedule.specificDate) {
      return `Data específica: ${formatDate(new Date(schedule.specificDate))}`;
    }
    return null;
  };

  return (
    <Card className={cn("shadow-sm border border-border flex flex-col", className)} level={1}>
      <CardHeader className="pb-6">
        <CardTitle className="flex items-center gap-3 text-xl">
          <div className="p-2 rounded-lg bg-primary/10">
            <IconCalendarEvent className="h-5 w-5 text-primary" />
          </div>
          Configuração do Agendamento
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="space-y-6">
          {/* Description */}
          {schedule.description && (
            <div>
              <h3 className="text-base font-semibold mb-4 text-foreground">Descrição</h3>
              <div className="bg-card-nested rounded-lg px-4 py-3 border border-border">
                <p className="text-sm text-foreground">{schedule.description}</p>
              </div>
            </div>
          )}

          {/* Frequency */}
          <div className={schedule.description ? "pt-6 border-t border-border/50" : ""}>
            <h3 className="text-base font-semibold mb-4 text-foreground">Periodicidade</h3>
            <div className="bg-card-nested rounded-lg p-4 border border-border">
              <div className="flex items-center gap-3 mb-3">
                <div className="p-2 rounded-lg bg-muted/50">
                  <IconRepeat className="h-4 w-4 text-muted-foreground" />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-semibold text-foreground">{getDynamicFrequencyLabel(schedule.frequency, schedule.frequencyCount)}</p>
                  {schedule.interval && <p className="text-xs text-muted-foreground mt-1">Intervalo: {schedule.interval} dias</p>}
                  {getScheduleDetails() && <p className="text-xs text-muted-foreground mt-1">{getScheduleDetails()}</p>}
                </div>
              </div>
            </div>
          </div>

          {/* Schedule Dates */}
          <div className="pt-6 border-t border-border/50">
            <h3 className="text-base font-semibold mb-4 text-foreground">Datas do Agendamento</h3>
            <div className="space-y-3">
              {schedule.nextRun && (
                <div
                  className={cn(
                    "bg-card-nested rounded-lg p-4 border",
                    isOverdue ? "border-orange-200/40 dark:border-orange-700/40 bg-orange-50/80 dark:bg-orange-900/20" : "border-border",
                  )}
                >
                  <div className="flex items-center gap-3">
                    <div className={cn("p-2 rounded-lg", isOverdue ? "bg-orange-100 dark:bg-orange-900/30" : "bg-muted/50")}>
                      <IconCalendarClock className={cn("h-4 w-4", isOverdue ? "text-orange-600 dark:text-orange-400" : "text-muted-foreground")} />
                    </div>
                    <div className="flex-1">
                      <p className="text-xs font-medium text-muted-foreground">Próxima Execução</p>
                      <p className={cn("text-sm font-semibold", isOverdue ? "text-orange-600 dark:text-orange-400" : "text-foreground")}>
                        {formatDateTime(new Date(schedule.nextRun))}
                      </p>
                      <p className={cn("text-xs mt-1", isOverdue ? "text-orange-600 dark:text-orange-400" : "text-muted-foreground")}>
                        {isOverdue && <IconAlertTriangle className="inline h-3 w-3 mr-1" />}
                        {formatRelativeTime(new Date(schedule.nextRun))}
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {schedule.lastRun && (
                <div className="bg-card-nested rounded-lg p-4 border border-border">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-muted/50">
                      <IconCalendarCheck className="h-4 w-4 text-muted-foreground" />
                    </div>
                    <div className="flex-1">
                      <p className="text-xs font-medium text-muted-foreground">Última Execução</p>
                      <p className="text-sm font-semibold text-foreground">{formatDateTime(new Date(schedule.lastRun))}</p>
                      <p className="text-xs text-muted-foreground mt-1">{formatRelativeTime(new Date(schedule.lastRun))}</p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// Maintenance Item Card Component
function MaintenanceItemCard({ schedule, className }: { schedule: any; className?: string }) {
  const navigate = useNavigate();

  return (
    <Card className={cn("shadow-sm border border-border flex flex-col", className)} level={1}>
      <CardHeader className="pb-6">
        <CardTitle className="flex items-center gap-3 text-xl">
          <div className="p-2 rounded-lg bg-primary/10">
            <IconPackage className="h-5 w-5 text-primary" />
          </div>
          Item
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-0 flex-1">
        {schedule.item ? (
          <div className="space-y-6">
            <div>
              <h3 className="text-base font-semibold mb-4 text-foreground">Informações do Item</h3>

              <div className="space-y-4">
                {/* Item Code */}
                {schedule.item.uniCode && (
                  <div className="bg-muted/30 rounded-lg p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <IconFileCheck className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm font-medium text-muted-foreground">Código Único</span>
                    </div>
                    <span className="text-base font-semibold text-foreground font-mono">#{schedule.item.uniCode}</span>
                  </div>
                )}

                {/* Item Name */}
                <div className="bg-muted/30 rounded-lg p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <IconPackage className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm font-medium text-muted-foreground">Item</span>
                  </div>
                  <TruncatedTextWithTooltip text={schedule.item.name} className="text-base font-semibold text-foreground" />
                </div>

                {/* Brand and Category in Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {schedule.item.brand && (
                    <div className="bg-muted/30 rounded-lg p-4">
                      <div className="flex items-center gap-2 mb-2">
                        <IconInfoCircle className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm font-medium text-muted-foreground">Marca</span>
                      </div>
                      <span className="text-base font-semibold text-foreground">{schedule.item.brand.name}</span>
                    </div>
                  )}

                  {schedule.item.category && (
                    <div className="bg-muted/30 rounded-lg p-4">
                      <div className="flex items-center gap-2 mb-2">
                        <IconInfoCircle className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm font-medium text-muted-foreground">Categoria</span>
                      </div>
                      <Badge variant="secondary" className="mt-1">
                        {schedule.item.category.name}
                      </Badge>
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="pt-6 border-t border-border/50">
              <Button variant="outline" size="sm" className="w-full" onClick={() => navigate(routes.inventory.products.details(schedule.item!.id))}>
                <IconArrowRight className="mr-2 h-4 w-4" />
                Ver Detalhes do Item
              </Button>
            </div>
          </div>
        ) : (
          <Alert className="border-dashed">
            <IconAlertCircle className="h-4 w-4" />
            <div className="ml-2">
              <p className="text-sm">Nenhum item associado a este agendamento</p>
            </div>
          </Alert>
        )}
      </CardContent>
    </Card>
  );
}

// Maintenance History Card Component
function MaintenanceHistoryCard({ schedule, nextMaintenance, className }: { schedule: any; nextMaintenance: any; className?: string }) {
  const navigate = useNavigate();
  const maintenanceHistory = schedule.maintenances || [];

  // Get status config
  const getStatusVariant = (status: MAINTENANCE_STATUS) => {
    switch (status) {
      case MAINTENANCE_STATUS.COMPLETED:
        return "success";
      case MAINTENANCE_STATUS.CANCELLED:
        return "destructive";
      case MAINTENANCE_STATUS.IN_PROGRESS:
        return "default";
      case MAINTENANCE_STATUS.OVERDUE:
        return "destructive";
      default:
        return "secondary";
    }
  };

  const getStatusIcon = (status: MAINTENANCE_STATUS) => {
    switch (status) {
      case MAINTENANCE_STATUS.COMPLETED:
        return IconCircleCheck;
      case MAINTENANCE_STATUS.CANCELLED:
        return IconX;
      case MAINTENANCE_STATUS.IN_PROGRESS:
        return IconRefresh;
      case MAINTENANCE_STATUS.OVERDUE:
        return IconAlertTriangle;
      default:
        return IconClock;
    }
  };

  const getStatusBgColor = (status: MAINTENANCE_STATUS) => {
    switch (status) {
      case MAINTENANCE_STATUS.COMPLETED:
        return "bg-green-50/80 dark:bg-green-900/20 border-green-200/40 dark:border-green-700/40";
      case MAINTENANCE_STATUS.CANCELLED:
        return "bg-red-50/80 dark:bg-red-900/20 border-red-200/40 dark:border-red-700/40";
      case MAINTENANCE_STATUS.IN_PROGRESS:
        return "bg-blue-50/80 dark:bg-blue-900/20 border-blue-200/40 dark:border-blue-700/40";
      case MAINTENANCE_STATUS.OVERDUE:
        return "bg-orange-50/80 dark:bg-orange-900/20 border-orange-200/40 dark:border-orange-700/40";
      default:
        return "bg-gray-50/80 dark:bg-gray-900/20 border-gray-200/40 dark:border-gray-700/40";
    }
  };

  return (
    <Card className={cn("shadow-sm border border-border flex flex-col", className)} level={1}>
      <CardHeader className="pb-6">
        <CardTitle className="flex items-center gap-3 text-xl">
          <div className="p-2 rounded-lg bg-primary/10">
            <IconHistory className="h-5 w-5 text-primary" />
          </div>
          Histórico de Manutenções
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-0 flex-grow flex flex-col min-h-0">
        {/* Statistics Section */}
        <div className="grid grid-cols-2 gap-3 mb-6">
          <div className="bg-card-nested rounded-lg p-3 border border-border text-center">
            <span className="text-xs font-medium text-muted-foreground block">Total</span>
            <p className="text-xl font-bold mt-1">{maintenanceHistory.length}</p>
          </div>
          <div className="bg-green-50/80 dark:bg-green-900/20 rounded-lg p-3 border border-green-200/40 dark:border-green-700/40 text-center">
            <span className="text-xs font-medium text-green-800 dark:text-green-200 block">Concluídas</span>
            <p className="text-xl font-bold mt-1 text-green-800 dark:text-green-200">{maintenanceHistory.filter((m: any) => m.status === MAINTENANCE_STATUS.COMPLETED).length}</p>
          </div>
        </div>

        {nextMaintenance && (
          <Alert className="mb-6 border-blue-200 bg-blue-50/50 dark:bg-blue-900/20">
            <IconCalendarTime className="h-4 w-4 text-blue-600" />
            <div className="ml-2">
              <p className="text-sm font-semibold text-blue-900 dark:text-blue-100">Próxima Manutenção</p>
              <p className="text-sm text-blue-800 dark:text-blue-200 mt-1">
                {nextMaintenance.name} - {formatDateTime(new Date(nextMaintenance.scheduledFor!))}
              </p>
              <Button
                variant="link"
                size="sm"
                className="mt-2 p-0 h-auto text-blue-600 hover:text-blue-700"
                onClick={() => navigate(routes.inventory.maintenance.details(nextMaintenance.id))}
              >
                Ver Detalhes <IconArrowRight className="ml-1 h-3 w-3" />
              </Button>
            </div>
          </Alert>
        )}

        {maintenanceHistory.length > 0 ? (
          <ScrollArea className="pr-4 flex-grow" style={{ maxHeight: "400px" }}>
            <div className="grid grid-cols-1 gap-3">
              {maintenanceHistory.map((maintenance: any) => {
                const StatusIcon = getStatusIcon(maintenance.status as MAINTENANCE_STATUS);
                const statusBgColor = getStatusBgColor(maintenance.status as MAINTENANCE_STATUS);

                return (
                  <div
                    key={maintenance.id}
                    className={cn("rounded-lg p-4 transition-all duration-200 cursor-pointer border", statusBgColor, "hover:shadow-md")}
                    onClick={() => navigate(routes.inventory.maintenance.details(maintenance.id))}
                  >
                    <div className="flex items-start gap-3">
                      <div className="flex-shrink-0 mt-0.5">
                        <StatusIcon className="h-5 w-5 text-muted-foreground" />
                      </div>
                      <div className="flex-1">
                        <div className="flex items-start justify-between mb-1">
                          <div className="flex-1">
                            <h4 className="font-semibold text-sm text-foreground">{maintenance.name}</h4>
                            <p className="text-xs text-muted-foreground mt-1">
                              {maintenance.status === MAINTENANCE_STATUS.COMPLETED && maintenance.finishedAt
                                ? `Concluída em ${formatDateTime(new Date(maintenance.finishedAt))}`
                                : `Agendada para ${formatDateTime(new Date(maintenance.scheduledFor!))}`}
                            </p>
                          </div>
                          <Badge variant={getStatusVariant(maintenance.status as MAINTENANCE_STATUS)} className="text-xs ml-2">
                            {MAINTENANCE_STATUS_LABELS[maintenance.status as MAINTENANCE_STATUS]}
                          </Badge>
                        </div>

                        {maintenance.notes && <p className="text-xs text-muted-foreground mt-2 bg-background/60 rounded px-2 py-1">{maintenance.notes}</p>}

                        <div className="flex items-center gap-4 mt-3 text-xs text-muted-foreground">
                          <div className="flex items-center gap-1">
                            <IconClock className="h-3 w-3" />
                            {formatRelativeTime(new Date(maintenance.scheduledFor!))}
                          </div>
                          {maintenance.item && (
                            <div className="flex items-center gap-1">
                              <IconPackage className="h-3 w-3" />
                              {maintenance.item.name}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {schedule._count?.maintenances && schedule._count.maintenances > 50 && (
              <div className="mt-4 text-center">
                <Button variant="outline" size="sm" onClick={() => navigate(routes.inventory.maintenance.list + `?scheduleId=${schedule.id}`)}>
                  Ver todas ({schedule._count?.maintenances ?? 0})
                </Button>
              </div>
            )}
          </ScrollArea>
        ) : (
          <div className="text-center py-12">
            <div className="p-4 bg-muted/30 rounded-full w-16 h-16 mx-auto mb-4 flex items-center justify-center">
              <IconHistory className="h-8 w-8 text-muted-foreground" />
            </div>
            <h3 className="text-lg font-semibold mb-2 text-foreground">Nenhuma manutenção realizada</h3>
            <p className="text-sm text-muted-foreground">As manutenções executadas aparecerão aqui.</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// Items Needed Card Component
function ItemsNeededCard({ itemsNeededConfig, className }: { itemsNeededConfig: any; className?: string }) {
  const navigate = useNavigate();

  // Extract all item IDs from the config
  const itemIds = itemsNeededConfig.items?.map((item: any) => item.itemId).filter(Boolean) || [];

  // Fetch all items data
  const { data: itemsResponse } = useItems({
    where: {
      id: { in: itemIds },
    },
    include: {
      brand: true,
      category: true,
      count: true,
    },
    enabled: itemIds.length > 0,
  });

  const itemsData = itemsResponse?.data || [];

  // Create a map of item data for quick lookup
  const itemsMap = new Map(itemsData.map((item) => [item.id, item]));

  // Enrich the items config with actual item data
  const enrichedItems = itemsNeededConfig.items.map((configItem: any) => {
    const itemData = itemsMap.get(configItem.itemId);
    return {
      ...configItem,
      name: itemData?.name || "Item não encontrado",
      uniCode: itemData?.uniCode,
      brand: itemData?.brand,
      category: itemData?.category,
      currentStock: itemData?.quantity || 0,
      unit: itemData?.measureUnit || "un", // Use measureUnit field from Item type
    };
  });

  // Calculate statistics
  const statistics = {
    totalItems: enrichedItems.length,
    itemsWithStock: enrichedItems.filter((item: any) => item.currentStock >= item.quantity).length,
    itemsWithoutStock: enrichedItems.filter((item: any) => item.currentStock < item.quantity).length,
  };

  return (
    <Card className={cn("shadow-sm border border-border flex flex-col", className)} level={1}>
      <CardHeader className="pb-6">
        <CardTitle className="flex items-center gap-3 text-xl">
          <div className="p-2 rounded-lg bg-primary/10">
            <IconClipboardList className="h-5 w-5 text-primary" />
          </div>
          Itens Necessários
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-0 flex-grow flex flex-col min-h-0">
        {/* Statistics Summary */}
        <div className="grid grid-cols-3 gap-3 mb-6">
          <div className="bg-card-nested rounded-lg p-3 border border-border">
            <span className="text-xs font-medium text-muted-foreground block">Total de Itens</span>
            <p className="text-xl font-bold mt-1">{statistics.totalItems}</p>
          </div>

          <div className="bg-green-50/80 dark:bg-green-900/20 rounded-lg p-3 border border-green-200/40 dark:border-green-700/40">
            <span className="text-xs font-medium text-green-800 dark:text-green-200 block">Com Estoque</span>
            <p className="text-xl font-bold mt-1 text-green-800 dark:text-green-200">{statistics.itemsWithStock}</p>
          </div>

          <div className="bg-red-50/80 dark:bg-red-900/20 rounded-lg p-3 border border-red-200/40 dark:border-red-700/40">
            <span className="text-xs font-medium text-red-800 dark:text-red-200 block">Sem Estoque</span>
            <p className="text-xl font-bold mt-1 text-red-800 dark:text-red-200">{statistics.itemsWithoutStock}</p>
          </div>
        </div>

        {/* Items Grid */}
        <ScrollArea className="pr-4 flex-grow" style={{ maxHeight: "320px" }}>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {enrichedItems.map((item: any, index: number) => {
              const hasEnoughStock = item.currentStock >= item.quantity;
              const stockTextColor = hasEnoughStock ? "text-green-700 dark:text-green-600" : "text-red-700 dark:text-red-600";

              return (
                <div key={item.itemId || index} className="block">
                  <div
                    className="group relative overflow-hidden rounded-lg border border-border/50 dark:border-border/40 bg-card hover:bg-muted/50 transition-colors cursor-pointer min-h-[140px] flex flex-col"
                    onClick={() => item.itemId && navigate(routes.inventory.products.details(item.itemId))}
                  >
                    <div className="p-3 flex-1 flex flex-col justify-between">
                      <div>
                        <div className="flex items-start justify-between gap-2 mb-1">
                          <div className="flex-1 min-w-0">
                            <h4 className="font-semibold text-sm text-foreground truncate">{item.name}</h4>
                          </div>
                        </div>

                        {item.uniCode && <p className="text-xs text-muted-foreground truncate">Código: {item.uniCode}</p>}

                        {item.brand && <p className="text-xs text-muted-foreground truncate">Marca: {item.brand.name}</p>}

                        {item.currentStock < item.quantity && (
                          <div className="flex flex-wrap items-center gap-1 mt-1">
                            <Badge variant="destructive" className="text-xs">
                              Estoque Insuficiente
                            </Badge>
                          </div>
                        )}
                      </div>

                      <div className="mt-3">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <IconAlertTriangleFilled
                                    className={cn("w-4 h-4 flex-shrink-0", stockTextColor)}
                                    aria-label={hasEnoughStock ? "Estoque suficiente" : "Estoque insuficiente"}
                                  />
                                </TooltipTrigger>
                                <TooltipContent>
                                  <div className="space-y-1">
                                    <p className="font-semibold">{hasEnoughStock ? "Estoque Suficiente" : "Estoque Insuficiente"}</p>
                                    <p className="text-xs">
                                      Disponível: {item.currentStock} {item.unit} | Necessário: {item.quantity} {item.unit}
                                    </p>
                                  </div>
                                </TooltipContent>
                              </Tooltip>
                            </TooltipProvider>

                            <span className="font-medium tabular-nums text-sm">
                              {item.currentStock.toLocaleString("pt-BR")} {item.unit}
                            </span>
                          </div>

                          <p className="text-xs text-muted-foreground font-medium">
                            Necessário: {item.quantity.toLocaleString("pt-BR")} {item.unit}
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}

export const MaintenanceScheduleDetailsPage = MaintenanceScheduleDetailPage;
export default MaintenanceScheduleDetailsPage;
