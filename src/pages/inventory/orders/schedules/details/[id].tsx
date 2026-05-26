import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  IconAlertTriangle,
  IconRefresh,
  IconCalendar,
  IconEdit,
  IconTrash,
  IconPackage,
  IconCircleCheck,
  IconCalendarCheck,
  IconCalendarClock,
  IconCalendarEvent,
  IconRepeat,
  IconPlayerPlay,
  IconPlayerPause,
} from "@tabler/icons-react";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatDate, formatDateTime, formatNumber, formatCurrency } from "../../../../../utils";
import { useOrderSchedule, useOrderScheduleMutations, useItems, useOrderScheduleProjection, useTriggerOrderSchedule } from "../../../../../hooks";
import { routes, getDynamicFrequencyLabel, CHANGE_LOG_ENTITY_TYPE, WEEK_DAY_LABELS, MONTH_LABELS, MONTH_OCCURRENCE_LABELS } from "../../../../../constants";
import type { WEEK_DAY, MONTH, MONTH_OCCURRENCE } from "../../../../../constants";
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { toast } from "@/components/ui/sonner";
import type { OrderScheduleCascadeMode } from "../../../../../types";
import { cn } from "@/lib/utils";

export function OrderScheduleDetailsPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [isDeleting, setIsDeleting] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showTriggerDialog, setShowTriggerDialog] = useState(false);
  const [cascadeMode, setCascadeMode] = useState<OrderScheduleCascadeMode>("GAP_ONLY");

  const { delete: deleteSchedule, update: updateSchedule } = useOrderScheduleMutations();
  const triggerSchedule = useTriggerOrderSchedule();

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

  // Fetch order projection (quantities/totals for today vs the scheduled trigger date)
  const { data: projectionResponse } = useOrderScheduleProjection(id!, {
    enabled: !!id,
  });

  const projection = projectionResponse?.data;
  const projectionMeta = projection?.meta;
  const projectionByItem = new Map((projection?.items || []).map((p) => [p.itemId, p]));

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
      navigate(routes.inventory.orders.schedules.root);
    } catch (error) {
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
      await updateSchedule({ id: schedule.id, data: { isActive: !schedule.isActive } });
      refetch();
    } catch (error) {
      // Error toast handled by API client interceptor
    }
  };

  const handleOpenTrigger = () => {
    // When there's no gap (overdue / once), the "bridge" option doesn't apply — default to the full cycle.
    setCascadeMode((projectionMeta?.gapDays ?? 0) > 0 ? "GAP_ONLY" : "GAP_PLUS_CYCLE");
    setShowTriggerDialog(true);
  };

  const handleConfirmTrigger = () => {
    triggerSchedule.mutate(
      { id: schedule.id, cascadeMode },
      {
        onSuccess: (response) => {
          setShowTriggerDialog(false);
          if (response.data?.order?.id) {
            toast.success("Pedido criado a partir do agendamento.");
            navigate(routes.inventory.orders.details(response.data.order.id));
          } else {
            toast.info("Nenhum item precisava ser pedido no momento.");
            refetch();
          }
        },
      },
    );
  };

  const isOverdue = schedule?.nextRun ? new Date(schedule.nextRun) < new Date() : false;

  const gapDays = projectionMeta?.gapDays ?? 0;
  const intervalDays = projectionMeta?.intervalDays ?? null;
  const hasGapOption = gapDays > 0;

  const getScheduleDetails = () => {
    if (schedule.weeklyConfig) {
      const selectedDays: WEEK_DAY[] = [];
      if (schedule.weeklyConfig.monday) selectedDays.push("MONDAY" as WEEK_DAY);
      if (schedule.weeklyConfig.tuesday) selectedDays.push("TUESDAY" as WEEK_DAY);
      if (schedule.weeklyConfig.wednesday) selectedDays.push("WEDNESDAY" as WEEK_DAY);
      if (schedule.weeklyConfig.thursday) selectedDays.push("THURSDAY" as WEEK_DAY);
      if (schedule.weeklyConfig.friday) selectedDays.push("FRIDAY" as WEEK_DAY);
      if (schedule.weeklyConfig.saturday) selectedDays.push("SATURDAY" as WEEK_DAY);
      if (schedule.weeklyConfig.sunday) selectedDays.push("SUNDAY" as WEEK_DAY);
      const days = selectedDays.map(day => WEEK_DAY_LABELS[day] || day).join(", ");
      return `Dias: ${days}`;
    }
    if (schedule.dayOfWeek) {
      return `Dia: ${WEEK_DAY_LABELS[schedule.dayOfWeek as WEEK_DAY] || schedule.dayOfWeek}`;
    }
    // Monthly: positional (Nth weekday, e.g. "2ª quinta-feira") takes precedence over fixed day.
    if (schedule.monthlyConfig?.occurrence && schedule.monthlyConfig?.dayOfWeek) {
      return `${MONTH_OCCURRENCE_LABELS[schedule.monthlyConfig.occurrence as MONTH_OCCURRENCE]} ${(WEEK_DAY_LABELS[schedule.monthlyConfig.dayOfWeek as WEEK_DAY] || "").toLowerCase()}`;
    }
    if (schedule.monthlyConfig?.dayOfMonth) {
      return `Dia ${schedule.monthlyConfig.dayOfMonth} de cada mês`;
    }
    if (schedule.dayOfMonth) {
      return `Dia ${schedule.dayOfMonth} de cada mês`;
    }
    if (schedule.yearlyConfig) {
      const y = schedule.yearlyConfig;
      const monthLabel = MONTH_LABELS[y.month as MONTH] || y.month;
      if (y.occurrence && y.dayOfWeek) {
        return `${MONTH_OCCURRENCE_LABELS[y.occurrence as MONTH_OCCURRENCE]} ${(WEEK_DAY_LABELS[y.dayOfWeek as WEEK_DAY] || "").toLowerCase()} de ${monthLabel}`;
      }
      return `${y.dayOfMonth} de ${monthLabel}`;
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
            key: "trigger",
            label: "Disparar agora",
            onClick: handleOpenTrigger,
            icon: IconPlayerPlay,
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
          {/* Configuration + Changelog Grid */}
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
                    <div className={cn(schedule.description && "pt-4 border-t border-border")}>
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
                    <div className="pt-4 border-t border-border">
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

              {/* Changelog History — next to the schedule info */}
              <ChangelogHistory
                entityType={CHANGE_LOG_ENTITY_TYPE.ORDER_SCHEDULE}
                entityId={schedule.id}
                entityName={schedule.name || `Agendamento #${schedule.id.slice(-8)}`}
                entityCreatedAt={schedule.createdAt}
                maxHeight="500px"
              />
            </div>
          </div>

          {/* Items Card — full width, after the changelog */}
          <div className="animate-in fade-in-50 duration-1000">
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
                  <>
                    {projectionMeta && (
                      <div className="mb-3 flex flex-wrap items-center gap-2">
                        {projectionMeta.scheduledDate && (
                          <Badge variant="secondary" className="gap-1">
                            <IconCalendarClock className="h-3 w-3" />
                            Disparo previsto: {formatDate(new Date(projectionMeta.scheduledDate))}
                            {projectionMeta.gapDays > 0 && ` (${projectionMeta.gapDays} dias)`}
                          </Badge>
                        )}
                        <Badge variant="outline">Total hoje: {formatCurrency(projectionMeta.totalToday)}</Badge>
                        <Badge variant="outline">Total na data: {formatCurrency(projectionMeta.totalScheduled)}</Badge>
                      </div>
                    )}
                    <p className="mb-2 text-xs text-muted-foreground">
                      hoje = se pedir agora · na data = projeção do estoque na data de disparo
                    </p>
                    <div className="border rounded-lg overflow-hidden dark:border-border">
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-muted/50">
                          <TableHead className="font-semibold">Código</TableHead>
                          <TableHead className="font-semibold">Nome</TableHead>
                          <TableHead className="font-semibold">Marca</TableHead>
                          <TableHead className="font-semibold">Categoria</TableHead>
                          <TableHead className="font-semibold text-right">Qtd. hoje</TableHead>
                          <TableHead className="font-semibold text-right">Qtd. na data</TableHead>
                          <TableHead className="font-semibold text-right">Preço hoje</TableHead>
                          <TableHead className="font-semibold text-right">Preço na data</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {items.map((item) => {
                          const p = projectionByItem.get(item.id);
                          const showProjection = p && !p.skipped;
                          return (
                          <TableRow
                            key={item.id}
                            className="cursor-pointer hover:bg-muted/30"
                            onClick={() => navigate(routes.inventory.products.details(item.id))}
                          >
                            <TableCell className="font-mono text-sm">{item.uniCode || "-"}</TableCell>
                            <TableCell className="font-medium">{item.name}</TableCell>
                            <TableCell>{item.brand?.name || "-"}</TableCell>
                            <TableCell>{item.category?.name || "-"}</TableCell>
                            <TableCell className="text-right tabular-nums">{showProjection ? formatNumber(p!.quantityToday) : "—"}</TableCell>
                            <TableCell className="text-right tabular-nums">{showProjection ? formatNumber(p!.quantityScheduled) : "—"}</TableCell>
                            <TableCell className="text-right tabular-nums">{showProjection ? formatCurrency(p!.totalToday) : "—"}</TableCell>
                            <TableCell className="text-right tabular-nums">{showProjection ? formatCurrency(p!.totalScheduled) : "—"}</TableCell>
                          </TableRow>
                          );
                        })}
                        {projectionMeta && (
                          <TableRow className="bg-muted/50 font-semibold">
                            <TableCell colSpan={6} className="text-right">Total</TableCell>
                            <TableCell className="text-right tabular-nums">{formatCurrency(projectionMeta.totalToday)}</TableCell>
                            <TableCell className="text-right tabular-nums">{formatCurrency(projectionMeta.totalScheduled)}</TableCell>
                          </TableRow>
                        )}
                      </TableBody>
                    </Table>
                    </div>
                  </>
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

      <Dialog open={showTriggerDialog} onOpenChange={setShowTriggerDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Disparar agendamento agora</DialogTitle>
            <DialogDescription>
              Escolha quanto este pedido deve cobrir. O agendamento permanece configurado normalmente.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <RadioGroup value={cascadeMode} onValueChange={(value) => setCascadeMode(value as OrderScheduleCascadeMode)}>
              {hasGapOption && (
                <label
                  htmlFor="cascade-gap-only"
                  className={cn(
                    "flex items-start gap-3 rounded-lg border border-border p-3 cursor-pointer hover:bg-muted/30",
                    cascadeMode === "GAP_ONLY" && "border-primary bg-muted/30",
                  )}
                >
                  <RadioGroupItem value="GAP_ONLY" id="cascade-gap-only" className="mt-0.5" />
                  <div className="space-y-1">
                    <p className="text-sm font-medium text-foreground">
                      Cobrir apenas até o próximo disparo
                      <span className="ml-1 text-muted-foreground">({gapDays} dias)</span>
                    </p>
                    <p className="text-xs text-muted-foreground">o agendamento ainda dispara na data prevista</p>
                  </div>
                </label>
              )}

              <label
                htmlFor="cascade-gap-cycle"
                className={cn(
                  "flex items-start gap-3 rounded-lg border border-border p-3 cursor-pointer hover:bg-muted/30",
                  cascadeMode === "GAP_PLUS_CYCLE" && "border-primary bg-muted/30",
                )}
              >
                <RadioGroupItem value="GAP_PLUS_CYCLE" id="cascade-gap-cycle" className="mt-0.5" />
                <div className="space-y-1">
                  <p className="text-sm font-medium text-foreground">
                    Cobrir até o próximo disparo + ciclo completo
                    <span className="ml-1 text-muted-foreground">
                      ({gapDays}{intervalDays != null ? ` + ${intervalDays}` : ""} dias)
                    </span>
                  </p>
                  <p className="text-xs text-muted-foreground">o próximo disparo é adiado um ciclo</p>
                </div>
              </label>
            </RadioGroup>

            {projectionMeta && (
              <div className="rounded-lg bg-muted/50 p-3 text-xs text-muted-foreground space-y-1">
                {projectionMeta.scheduledDate && (
                  <div className="flex justify-between">
                    <span>Disparo previsto</span>
                    <span className="font-medium text-foreground">{formatDate(new Date(projectionMeta.scheduledDate))}</span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span>Total se pedir hoje</span>
                  <span className="font-medium text-foreground">{formatCurrency(projectionMeta.totalToday)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Total projetado na data</span>
                  <span className="font-medium text-foreground">{formatCurrency(projectionMeta.totalScheduled)}</span>
                </div>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowTriggerDialog(false)} disabled={triggerSchedule.isPending}>
              Cancelar
            </Button>
            <Button onClick={handleConfirmTrigger} disabled={triggerSchedule.isPending}>
              {triggerSchedule.isPending ? "Disparando..." : "Confirmar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default OrderScheduleDetailsPage;
