import React, { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  IconAlertTriangle,
  IconRefresh,
  IconCalendar,
  IconClock,
  IconEdit,
  IconTrash,
  IconPackage,
  IconCalendarTime,
  IconCircleCheck,
  IconCalendarCheck,
  IconCalendarClock,
  IconCalendarEvent,
  IconRepeat,
  IconPlayerPlay,
  IconPlayerPause,
  IconCalendarRepeat,
} from "@tabler/icons-react";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatDate, formatDateTime } from "../../../../../utils";
import { useOrderSchedule, useOrderScheduleMutations, useItems } from "../../../../../hooks";
import { routes, getDynamicFrequencyLabel, CHANGE_LOG_ENTITY_TYPE, WEEK_DAY_LABELS, MONTH_LABELS } from "../../../../../constants";
import type { WEEK_DAY, MONTH } from "../../../../../constants";
import { ChangelogHistory } from "@/components/ui/changelog-history";
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

export function OrderScheduleDetailsPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [isDeleting, setIsDeleting] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);

  const { delete: deleteSchedule, update: updateSchedule } = useOrderScheduleMutations();

  const {
    data: response,
    isLoading,
    error,
    refetch,
  } = useOrderSchedule(id!, {
    include: {
      weeklyConfig: true,
      monthlyConfig: true,
      yearlyConfig: true,
    },
    enabled: !!id,
  });

  const schedule = response?.data;

  // Fetch items data
  const itemIds = schedule?.items || [];
  const { data: itemsResponse } = useItems({
    where: {
      id: { in: itemIds },
    },
    include: {
      brand: true,
      category: true,
    },
    enabled: itemIds.length > 0,
  });

  const items = itemsResponse?.data || [];

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 dark:from-neutral-900 dark:to-neutral-800">
        <div className="container mx-auto p-4 sm:p-4 max-w-7xl">
          <div className="animate-pulse space-y-6">
            <div className="space-y-4">
              <div className="flex items-center space-x-2">
                <div className="h-4 w-16 bg-muted rounded"></div>
                <div className="h-4 w-4 bg-muted rounded"></div>
                <div className="h-4 w-20 bg-muted rounded"></div>
              </div>
              <div className="flex items-center justify-between">
                <div className="h-8 bg-muted rounded w-48"></div>
                <div className="flex gap-2">
                  <div className="h-9 w-20 bg-muted rounded"></div>
                  <div className="h-9 w-20 bg-muted rounded"></div>
                </div>
              </div>
            </div>
            <div className="h-48 bg-muted rounded-xl"></div>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="h-96 bg-muted rounded-xl"></div>
              <div className="h-96 bg-muted rounded-xl"></div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (error || !schedule) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 dark:from-neutral-900 dark:to-neutral-800">
        <div className="container mx-auto p-4 sm:p-4 max-w-7xl">
          <div className="flex flex-1 items-center justify-center min-h-[60vh]">
            <div className="text-center px-4 max-w-md mx-auto">
              <div className="animate-in fade-in-50 duration-500">
                <div className="p-4 bg-red-50 dark:bg-red-900/20 rounded-full w-20 h-20 mx-auto mb-6 flex items-center justify-center">
                  <IconAlertTriangle className="h-10 w-10 text-red-500" />
                </div>
                <h2 className="text-xl sm:text-2xl font-semibold mb-3 text-foreground">Agendamento não encontrado</h2>
                <p className="text-sm sm:text-base text-muted-foreground mb-6 leading-relaxed">
                  O agendamento de pedidos que você está procurando não existe ou foi removido do sistema.
                </p>
                <div className="space-y-3">
                  <Button onClick={() => navigate(routes.inventory.orders.schedules.root)} className="w-full sm:w-auto">
                    Ir para Lista de Agendamentos
                  </Button>
                  <Button variant="outline" onClick={() => navigate(routes.inventory.orders.root)} className="w-full sm:w-auto">
                    Ir para Pedidos
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
      await deleteSchedule(schedule.id);
      toast.success("Agendamento excluído com sucesso");
      navigate(routes.inventory.orders.schedules.root);
    } catch (error) {
      toast.error("Erro ao excluir agendamento");
      if (process.env.NODE_ENV !== "production") {
        console.error("Error deleting schedule:", error);
      }
    } finally {
      setIsDeleting(false);
      setShowDeleteDialog(false);
    }
  };

  const handleToggleActive = async () => {
    try {
      await updateSchedule({ id: schedule.id, isActive: !schedule.isActive });
      toast.success(schedule.isActive ? "Agendamento desativado" : "Agendamento ativado");
      refetch();
    } catch (error) {
      toast.error("Erro ao atualizar agendamento");
    }
  };

  const isOverdue = schedule?.nextRun ? new Date(schedule.nextRun) < new Date() : false;

  const getScheduleDetails = () => {
    if (schedule.weeklyConfig) {
      const days = schedule.weeklyConfig.daysOfWeek?.map((day: string) => WEEK_DAY_LABELS[day as WEEK_DAY] || day).join(", ") || "";
      return `Dias: ${days}`;
    }
    if (schedule.dayOfWeek) {
      return `Dia: ${WEEK_DAY_LABELS[schedule.dayOfWeek as WEEK_DAY] || schedule.dayOfWeek}`;
    }
    if (schedule.monthlyConfig && schedule.monthlyConfig.dayOfMonth) {
      return `Dia ${schedule.monthlyConfig.dayOfMonth} de cada mês`;
    }
    if (schedule.dayOfMonth) {
      return `Dia ${schedule.dayOfMonth} de cada mês`;
    }
    if (schedule.yearlyConfig) {
      return `${schedule.yearlyConfig.dayOfMonth}/${schedule.yearlyConfig.month}`;
    }
    if (schedule.month) {
      return `Mês: ${MONTH_LABELS[schedule.month as MONTH] || schedule.month}`;
    }
    if (schedule.specificDate) {
      return `Data específica: ${formatDate(new Date(schedule.specificDate))}`;
    }
    return null;
  };

  return (
    <div className="h-full flex flex-col gap-4 bg-background px-4 pt-4">
      <PageHeader
        variant="detail"
        title={schedule.name || `Agendamento #${schedule.id.slice(-8)}`}
        className="flex-shrink-0 animate-in fade-in-50 duration-500 shadow-sm"
        breadcrumbs={[
          { label: "Início", href: routes.home },
          { label: "Estoque", href: routes.inventory.root },
          { label: "Pedidos", href: routes.inventory.orders.root },
          { label: "Agendamentos", href: routes.inventory.orders.schedules.root },
          { label: schedule.name || `#${schedule.id.slice(-8)}` },
        ]}
        actions={[
          {
            key: "refresh",
            label: "Atualizar",
            onClick: handleRefresh,
            icon: IconRefresh,
          },
          {
            key: "toggle",
            label: schedule.isActive ? "Desativar" : "Ativar",
            onClick: handleToggleActive,
            icon: schedule.isActive ? IconPlayerPause : IconPlayerPlay,
          },
          {
            key: "edit",
            label: "Editar",
            onClick: () => navigate(routes.inventory.orders.schedules.edit(schedule.id)),
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

      <div className="flex-1 overflow-y-auto pb-6">
        <div className="space-y-4">
          {/* Configuration and Items Grid */}
          <div className="animate-in fade-in-50 duration-700">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {/* Schedule Configuration Card */}
              <Card className="shadow-sm border border-border flex flex-col">
                <CardHeader className="pb-4">
                  <CardTitle className="flex items-center gap-2">
                    <IconCalendarEvent className="h-5 w-5 text-muted-foreground" />
                    Informações do Agendamento
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-0 flex-1">
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
                            <span className="text-sm font-semibold text-foreground">
                              {getDynamicFrequencyLabel(schedule.frequency, schedule.frequencyCount)}
                            </span>
                            {getScheduleDetails() && (
                              <div className="text-xs text-muted-foreground mt-1">{getScheduleDetails()}</div>
                            )}
                          </div>
                        </div>
                        <div className="flex justify-between items-center bg-muted/50 rounded-lg px-4 py-3">
                          <span className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                            <IconCircleCheck className="h-4 w-4" />
                            Status
                          </span>
                          <Badge variant={schedule.isActive ? "active" : "destructive"}>
                            {schedule.isActive ? "Ativo" : "Inativo"}
                          </Badge>
                        </div>
                      </div>
                    </div>

                    {/* Dates Section */}
                    <div className="pt-4 border-t border-border/50">
                      <h4 className="text-sm font-semibold mb-3 text-foreground">Datas</h4>
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
                            <span className="text-sm font-semibold text-foreground">
                              {formatDateTime(new Date(schedule.lastRun))}
                            </span>
                          </div>
                        )}

                        <div className="flex justify-between items-center bg-muted/50 rounded-lg px-4 py-3">
                          <span className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                            <IconCalendar className="h-4 w-4" />
                            Criado em
                          </span>
                          <span className="text-sm font-semibold text-foreground">
                            {formatDateTime(new Date(schedule.createdAt))}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Items Card */}
              <Card className="shadow-sm border border-border flex flex-col">
                <CardHeader className="pb-4">
                  <CardTitle className="flex items-center gap-2">
                    <IconPackage className="h-5 w-5 text-muted-foreground" />
                    Itens do Agendamento
                    {items.length > 0 && (
                      <Badge variant="secondary" className="ml-2">
                        {items.length}
                      </Badge>
                    )}
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-0 flex-1">
                  {items.length > 0 ? (
                    <div className="border rounded-lg overflow-hidden dark:border-border/40">
                      <Table>
                        <TableHeader>
                          <TableRow className="bg-muted/50">
                            <TableHead className="font-semibold">Código</TableHead>
                            <TableHead className="font-semibold">Nome</TableHead>
                            <TableHead className="font-semibold">Marca</TableHead>
                            <TableHead className="font-semibold">Categoria</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {items.map((item) => (
                            <TableRow
                              key={item.id}
                              className="cursor-pointer hover:bg-muted/30"
                              onClick={() => navigate(routes.inventory.products.details(item.id))}
                            >
                              <TableCell className="font-mono text-sm">{item.uniCode || "-"}</TableCell>
                              <TableCell className="font-medium">{item.name}</TableCell>
                              <TableCell>{item.brand?.name || "-"}</TableCell>
                              <TableCell>{item.category?.name || "-"}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  ) : (
                    <div className="text-center py-12">
                      <div className="p-4 bg-muted/30 rounded-full w-16 h-16 mx-auto mb-4 flex items-center justify-center">
                        <IconPackage className="h-8 w-8 text-muted-foreground" />
                      </div>
                      <h3 className="text-lg font-semibold mb-2 text-foreground">Nenhum item configurado</h3>
                      <p className="text-sm text-muted-foreground">
                        Este agendamento não possui itens configurados.
                      </p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>

          {/* Changelog History */}
          <div className="animate-in fade-in-50 duration-1000">
            <ChangelogHistory
              entityType={CHANGE_LOG_ENTITY_TYPE.ORDER_SCHEDULE}
              entityId={schedule.id}
              entityName={schedule.name || `Agendamento #${schedule.id.slice(-8)}`}
              entityCreatedAt={schedule.createdAt}
              maxHeight="500px"
            />
          </div>
        </div>
      </div>

      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir Agendamento</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir este agendamento? Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

export default OrderScheduleDetailsPage;
