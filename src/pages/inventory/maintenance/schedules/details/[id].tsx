import React from "react";
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
  IconBox,
  IconExternalLink,
  IconCurrencyDollar,
  IconBoxMultiple,
  IconPlayerPause,
  IconHourglass,
} from "@tabler/icons-react";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";
import { TruncatedTextWithTooltip } from "@/components/ui/truncated-text-with-tooltip";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { ItemsNeededList } from "@/components/inventory/maintenance/common/items-needed-list";
import { MaintenanceHistoryTable } from "@/components/inventory/maintenance/common/maintenance-history-table";
import { formatDate, formatDateTime, formatRelativeTime, determineStockLevel, getStockLevelMessage, formatCurrency } from "../../../../../utils";
import { useMaintenanceSchedule, useItems } from "../../../../../hooks";
import { MAINTENANCE_STATUS, MAINTENANCE_STATUS_LABELS, routes, getDynamicFrequencyLabel, CHANGE_LOG_ENTITY_TYPE, STOCK_LEVEL_LABELS, MEASURE_UNIT_LABELS, ORDER_STATUS, MEASURE_UNIT, STOCK_LEVEL } from "../../../../../constants";
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
          supplier: true,
          prices: {
            orderBy: {
              createdAt: "desc",
            },
            take: 1,
          },
          orderItems: {
            include: {
              order: true,
            },
          },
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

  // Extract item IDs for cost calculation - always return an array, even when schedule is not loaded
  const itemIdsForCost = React.useMemo(() => {
    if (!schedule?.maintenanceItemsConfig || !Array.isArray(schedule.maintenanceItemsConfig)) return [];
    return schedule.maintenanceItemsConfig.map((item: any) => item.itemId).filter(Boolean);
  }, [schedule?.maintenanceItemsConfig]);

  // Hook must always be called in the same position - enabled flag handles when to fetch
  const { data: itemsForCostResponse } = useItems({
    where: {
      id: { in: itemIdsForCost },
    },
    include: {
      prices: {
        orderBy: {
          createdAt: "desc",
        },
        take: 1,
      },
    },
    enabled: itemIdsForCost.length > 0 && !!schedule,
  });

  // Calculate total cost - must be called before any early returns
  const totalCost = React.useMemo(() => {
    if (!itemsForCostResponse?.data || itemIdsForCost.length === 0) return 0;

    const itemsMap = new Map(itemsForCostResponse.data.map((item) => [item.id, item]));

    const itemsConfig = schedule?.maintenanceItemsConfig;
    if (!itemsConfig || !Array.isArray(itemsConfig)) return 0;

    return itemsConfig.reduce((sum: number, configItem: any) => {
      const itemData = itemsMap.get(configItem.itemId);
      const price = itemData?.prices?.[0]?.value || 0;
      const quantity = configItem.quantity || 0;
      return sum + (price * quantity);
    }, 0);
  }, [itemsForCostResponse, schedule?.maintenanceItemsConfig, itemIdsForCost]);

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
  };

  const handleDelete = async () => {
    setIsDeleting(true);
    try {
      // TODO: Implement delete
      navigate(routes.inventory.maintenance.schedules.root);
    } catch (error) {
      console.error("Error deleting schedule:", error);
    } finally {
      setIsDeleting(false);
      setShowDeleteDialog(false);
    }
  };

  const itemsNeededConfig = schedule?.maintenanceItemsConfig as any;
  const hasItemsNeeded = itemsNeededConfig && Array.isArray(itemsNeededConfig) && itemsNeededConfig.length > 0;

  // Get next maintenance
  const nextMaintenance = schedule?.maintenances?.find((m) => m.status === MAINTENANCE_STATUS.PENDING && new Date(m.scheduledFor!) > new Date());

  const isOverdue = schedule?.nextRun ? new Date(schedule.nextRun) < new Date() : false;

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
        />
      </div>

      {/* Core Information Grid - Configuration and Item */}
      <div className="animate-in fade-in-50 duration-700">
        {/* Mobile: Single column stacked */}
        <div className="block lg:hidden space-y-4">
          <ScheduleConfigurationCard schedule={schedule} isOverdue={isOverdue} totalCost={totalCost} className="h-full" />
          <MaintenanceItemCard schedule={schedule} className="h-full" />
        </div>

        {/* Desktop/Tablet: 2 columns grid */}
        <div className="hidden lg:block">
          <div className="grid grid-cols-2 gap-6">
            <ScheduleConfigurationCard schedule={schedule} isOverdue={isOverdue} totalCost={totalCost} className="h-full" />
            <MaintenanceItemCard schedule={schedule} className="h-full" />
          </div>
        </div>
      </div>

      {/* Maintenance History - Full Width */}
      <div className="animate-in fade-in-50 duration-800">
        <MaintenanceHistoryCard schedule={schedule} nextMaintenance={nextMaintenance} />
      </div>

      {/* Items Needed - Full Width */}
      {hasItemsNeeded && (
        <div className="animate-in fade-in-50 duration-900">
          <ItemsNeededList itemsConfig={itemsNeededConfig} />
        </div>
      )}

      {/* Changelog History - Full Width */}
      <div className="animate-in fade-in-50 duration-1000">
        <ChangelogHistory
          entityType={CHANGE_LOG_ENTITY_TYPE.MAINTENANCE_SCHEDULE}
          entityId={schedule.id}
          entityName={schedule.name}
          entityCreatedAt={schedule.createdAt}
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
function ScheduleConfigurationCard({ schedule, isOverdue, totalCost, className }: { schedule: any; isOverdue: boolean; totalCost: number; className?: string }) {
  const getScheduleDetails = () => {
    if (schedule.weeklyConfig) {
      const days = schedule.weeklyConfig.daysOfWeek?.map((day: string) => day).join(", ") || "";
      return `Dias: ${days}`;
    }
    if (schedule.monthlyConfig && schedule.monthlyConfig.dayOfMonth) {
      return `Dia ${schedule.monthlyConfig.dayOfMonth} de cada mês`;
    }
    // Fallback: check if dayOfMonth is directly on schedule for monthly frequency
    if (schedule.frequency === 'MONTHLY' && schedule.dayOfMonth) {
      return `Dia ${schedule.dayOfMonth} de cada mês`;
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
      <CardHeader className="pb-4">
        <CardTitle className="flex items-center gap-3 text-xl">
          <div className="p-2 rounded-lg bg-primary/10">
            <IconCalendarEvent className="h-5 w-5 text-primary" />
          </div>
          Informações do Agendamento
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="space-y-6">
          {/* Description */}
          {schedule.description && (
            <div>
              <p className="text-sm text-muted-foreground">{schedule.description}</p>
            </div>
          )}

          {/* Frequency */}
          <div className={cn(schedule.description && "pt-4 border-t border-border/50")}>
            <h4 className="text-sm font-semibold mb-3 text-foreground">Periodicidade</h4>
            <div className="space-y-3">
              <div className="flex justify-between items-center bg-muted/50 rounded-lg px-4 py-3">
                <span className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                  <IconRepeat className="h-4 w-4" />
                  Frequência
                </span>
                <div className="text-right">
                  <span className="text-sm font-semibold text-foreground">{getDynamicFrequencyLabel(schedule.frequency, schedule.frequencyCount)}</span>
                  {getScheduleDetails() && (
                    <div className="text-xs text-muted-foreground mt-1">
                      {getScheduleDetails()}
                    </div>
                  )}
                </div>
              </div>
              <div className="flex justify-between items-center bg-muted/50 rounded-lg px-4 py-3">
                <span className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                  <IconCircleCheck className="h-4 w-4" />
                  Status
                </span>
                <Badge variant={schedule.isActive !== false ? "success" : "secondary"}>{schedule.isActive !== false ? "Ativo" : "Inativo"}</Badge>
              </div>
              {totalCost > 0 && (
                <div className="flex justify-between items-center bg-muted/50 rounded-lg px-4 py-3">
                  <span className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                    <IconCurrencyDollar className="h-4 w-4" />
                    Custo Estimado
                  </span>
                  <span className="text-sm font-semibold text-foreground">{formatCurrency(totalCost)}</span>
                </div>
              )}
            </div>
          </div>

          {/* Dates Section */}
          <div className="pt-4 border-t border-border/50">
            <h4 className="text-sm font-semibold mb-3 text-foreground">Datas do Sistema</h4>
            <div className="space-y-3">
              {schedule.nextRun && (
                <div className="flex justify-between items-center bg-muted/50 rounded-lg px-4 py-3">
                  <span className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                    <IconCalendarClock className="h-4 w-4" />
                    Próxima Execução
                  </span>
                  <div className="text-right">
                    <div className="flex items-center gap-2">
                      <span className={cn("text-sm font-semibold", isOverdue && "text-orange-600 dark:text-orange-400")}>
                        {formatDateTime(new Date(schedule.nextRun))}
                      </span>
                      {isOverdue && (
                        <div className="flex items-center gap-1 text-xs text-orange-600 dark:text-orange-400">
                          <IconAlertTriangle className="h-3 w-3" />
                          <span>Atrasada</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {schedule.lastRun && (
                <div className="flex justify-between items-center bg-muted/50 rounded-lg px-4 py-3">
                  <span className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                    <IconCalendarCheck className="h-4 w-4" />
                    Última Execução
                  </span>
                  <span className="text-sm font-semibold text-foreground">{formatDateTime(new Date(schedule.lastRun))}</span>
                </div>
              )}

              <div className="flex justify-between items-center bg-muted/50 rounded-lg px-4 py-3">
                <span className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                  <IconCalendar className="h-4 w-4" />
                  Criada em
                </span>
                <span className="text-sm font-semibold text-foreground">{formatDateTime(new Date(schedule.createdAt))}</span>
              </div>
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
  const item = schedule.item;

  if (!item) {
    return (
      <Card className={cn("shadow-sm border border-border", className)} level={1}>
        <CardHeader className="pb-6">
          <CardTitle className="flex items-center gap-3 text-xl">
            <div className="p-2 rounded-lg bg-primary/10">
              <IconBox className="h-5 w-5 text-primary" />
            </div>
            Equipamento da Manutenção
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="text-center py-12">
            <IconInfoCircle className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <p className="text-muted-foreground">Nenhum equipamento especificado para esta manutenção.</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Get the most recent price from the prices array
  const currentPrice = item.prices && item.prices.length > 0 ? item.prices[0].value : null;

  // Check if item has active orders
  const activeOrderStatuses = [ORDER_STATUS.CREATED, ORDER_STATUS.PARTIALLY_FULFILLED, ORDER_STATUS.FULFILLED, ORDER_STATUS.PARTIALLY_RECEIVED];

  const hasActiveOrder = item.orderItems?.some((orderItem: any) => orderItem.order && activeOrderStatuses.includes(orderItem.order.status)) || false;

  // Determine stock level using the unified algorithm
  const stockLevel = determineStockLevel(item.quantity || 0, item.reorderPoint || null, item.maxQuantity || null, hasActiveOrder);

  // Get color based on stock level
  const getStockColor = () => {
    switch (stockLevel) {
      case STOCK_LEVEL.NEGATIVE_STOCK:
        return "text-neutral-500";
      case STOCK_LEVEL.OUT_OF_STOCK:
        return "text-red-700";
      case STOCK_LEVEL.CRITICAL:
        return "text-orange-500";
      case STOCK_LEVEL.LOW:
        return "text-yellow-500";
      case STOCK_LEVEL.OPTIMAL:
        return "text-green-700";
      case STOCK_LEVEL.OVERSTOCKED:
        return "text-purple-600";
      default:
        return "text-neutral-500";
    }
  };

  const stockStatus = {
    color: getStockColor(),
    label: STOCK_LEVEL_LABELS[stockLevel],
    description: getStockLevelMessage(stockLevel, item.quantity || 0, item.reorderPoint || null),
  };

  const handleViewItem = () => {
    navigate(routes.inventory.products.details(item.id));
  };

  return (
    <Card className={cn("shadow-sm border border-border flex flex-col", className)} level={1}>
      <CardHeader className="pb-6">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-3 text-xl">
            <div className="p-2 rounded-lg bg-primary/10">
              <IconBox className="h-5 w-5 text-primary" />
            </div>
            Equipamento da Manutenção
          </CardTitle>
          <Button variant="ghost" size="sm" onClick={handleViewItem} className="text-xs">
            <IconExternalLink className="h-3 w-3 mr-1" />
            Ver detalhes
          </Button>
        </div>
      </CardHeader>
      <CardContent className="pt-0 flex-1">
        <div className="space-y-6">
          {/* Product Information Section */}
          <div>
            <h3 className="text-base font-semibold mb-4 text-foreground">Informações do Produto</h3>
            <div className="space-y-4">
              {/* Item Name */}
              <div className="bg-muted/30 rounded-lg p-4">
                <p className="text-base font-semibold text-foreground">
                  {item.uniCode && (
                    <>
                      <span className="font-mono text-sm text-muted-foreground">{item.uniCode}</span>
                      <span className="mx-2 text-muted-foreground">-</span>
                    </>
                  )}
                  {item.name}
                </p>
              </div>

              {/* Brand */}
              <div className="flex justify-between items-center bg-muted/50 rounded-lg px-4 py-3">
                <span className="text-sm font-medium text-muted-foreground">Marca</span>
                <span className="text-sm font-semibold text-foreground">{item.brand ? item.brand.name : <span className="text-muted-foreground italic">Não definida</span>}</span>
              </div>

              {/* Category */}
              <div className="flex justify-between items-center bg-muted/50 rounded-lg px-4 py-3">
                <span className="text-sm font-medium text-muted-foreground">Categoria</span>
                <span className="text-sm font-semibold text-foreground">
                  {item.category ? item.category.name : <span className="text-muted-foreground italic">Não definida</span>}
                </span>
              </div>

              {/* Supplier */}
              <div className="flex justify-between items-center bg-muted/50 rounded-lg px-4 py-3">
                <span className="text-sm font-medium text-muted-foreground">Fornecedor</span>
                <span className="text-sm font-semibold text-foreground">
                  {item.supplier ? item.supplier.fantasyName || item.supplier.name : <span className="text-muted-foreground italic">Não definido</span>}
                </span>
              </div>
            </div>
          </div>

          {/* Stock and Price Section */}
          <div className="pt-6 border-t border-border/50">
            <h3 className="text-base font-semibold mb-4 text-foreground">Estoque e Preço</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-muted/30 rounded-lg p-4">
                <div className="flex items-center gap-2 mb-2">
                  <IconBoxMultiple className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm font-medium text-muted-foreground">Estoque Atual</span>
                </div>
                <div className="flex items-center gap-2">
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <IconAlertTriangleFilled className={cn("w-5 h-5 flex-shrink-0", stockStatus.color)} aria-label={stockStatus.label} />
                      </TooltipTrigger>
                      <TooltipContent>
                        <div className="space-y-1">
                          <p className="font-semibold">{stockStatus.label}</p>
                          <p className="text-xs">{stockStatus.description}</p>
                        </div>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                  <p className="text-2xl font-bold text-foreground">
                    {item.quantity % 1 === 0
                      ? item.quantity.toLocaleString("pt-BR")
                      : item.quantity.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </p>
                </div>
                {item.measureUnit && <p className="text-sm text-muted-foreground mt-1">{MEASURE_UNIT_LABELS[item.measureUnit as MEASURE_UNIT]}</p>}
              </div>
              <div className="bg-muted/30 rounded-lg p-4">
                <div className="flex items-center gap-2 mb-2">
                  <IconCurrencyDollar className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm font-medium text-muted-foreground">Preço Unitário</span>
                </div>
                {currentPrice !== null && currentPrice !== undefined ? (
                  <p className="text-2xl font-bold text-foreground">{formatCurrency(currentPrice)}</p>
                ) : (
                  <p className="text-sm text-muted-foreground">Não definido</p>
                )}
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// Maintenance History Card Component
function MaintenanceHistoryCard({ schedule, nextMaintenance, className }: { schedule: any; nextMaintenance: any; className?: string }) {
  const navigate = useNavigate();
  const maintenanceHistory = schedule.maintenances || [];

  // Calculate statistics
  const statistics = React.useMemo(() => {
    const totalMaintenances = maintenanceHistory.length;
    const completedMaintenances = maintenanceHistory.filter((m: any) => m.status === MAINTENANCE_STATUS.COMPLETED).length;
    const pendingMaintenances = maintenanceHistory.filter((m: any) => m.status === MAINTENANCE_STATUS.PENDING).length;

    return {
      totalMaintenances,
      completedMaintenances,
      pendingMaintenances,
    };
  }, [maintenanceHistory]);

  return (
    <Card className={cn("shadow-sm border border-border flex flex-col", className)} level={1}>
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-3 text-xl">
            <div className="p-2 rounded-lg bg-primary/10">
              <IconHistory className="h-5 w-5 text-primary" />
            </div>
            Histórico de Manutenções
          </CardTitle>
          {schedule._count?.maintenances && schedule._count.maintenances > 50 && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigate(routes.inventory.maintenance.list + `?scheduleId=${schedule.id}`)}
            >
              Ver todas ({schedule._count?.maintenances ?? 0})
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="pt-0 flex-grow flex flex-col min-h-0">
        {maintenanceHistory.length > 0 ? (
          <MaintenanceHistoryTable maintenances={maintenanceHistory} />
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

export const MaintenanceScheduleDetailsPage = MaintenanceScheduleDetailPage;
export default MaintenanceScheduleDetailsPage;
