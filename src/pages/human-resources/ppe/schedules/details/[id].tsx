import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { routes, SECTOR_PRIVILEGES, SCHEDULE_FREQUENCY_LABELS, MONTH } from "../../../../../constants";
import { ASSIGNMENT_TYPE_LABELS, PPE_DELIVERY_STATUS_LABELS } from "../../../../../constants";
import type { PpeDelivery, PpeScheduleItem } from "../../../../../types";
import { usePpeDeliverySchedule, usePpeDeliveryScheduleMutations, useAuth } from "../../../../../hooks";
import { PageHeader } from "@/components/ui/page-header";
import { IconCalendar, IconEdit, IconTrash, IconRefresh, IconAlertTriangle } from "@tabler/icons-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
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
import { PrivilegeRoute } from "@/components/navigation/privilege-route";
import { hasPrivilege } from "../../../../../utils";
import { usePageTracker } from "@/hooks/use-page-tracker";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export function PPEScheduleDetailsPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { deleteMutation } = usePpeDeliveryScheduleMutations();
  const { data: currentUser } = useAuth();

  // Dialog states
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);

  // Track page access
  usePageTracker({
    title: "Detalhes do Agendamento de EPI",
    icon: "calendar",
  });

  // Permission checks
  const canManageWarehouse = currentUser && hasPrivilege(currentUser, SECTOR_PRIVILEGES.WAREHOUSE);
  const isAdmin = currentUser && hasPrivilege(currentUser, SECTOR_PRIVILEGES.ADMIN);

  // Fetch PPE schedule data
  const {
    data: ppeSchedule,
    isLoading,
    error,
    refetch,
  } = usePpeDeliverySchedule(id!, {
    include: {
      deliveries: {
        include: {
          item: true,
          user: true,
        },
      },
    },
    enabled: !!id,
  });

  // Handlers
  const handleEdit = () => {
    if (ppeSchedule?.data && canManageWarehouse) {
      navigate(routes.humanResources.ppe.schedules.edit(ppeSchedule.data.id));
    }
  };

  const handleRefresh = () => {
    refetch();
    toast.success("Dados atualizados com sucesso");
  };

  const handleDelete = async () => {
    if (!ppeSchedule?.data) return;

    try {
      await deleteMutation.mutateAsync(ppeSchedule.data.id);
      toast.success("Agendamento excluído com sucesso");
      navigate(routes.humanResources.ppe.schedules.root);
    } catch (error) {
      toast.error("Erro ao excluir agendamento");
    } finally {
      setShowDeleteDialog(false);
    }
  };

  // Loading state
  if (isLoading) {
    return (
      <PrivilegeRoute requiredPrivilege={SECTOR_PRIVILEGES.WAREHOUSE}>
        <div className="flex flex-col h-full space-y-6">
          <div className="animate-pulse space-y-4">
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
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="h-96 bg-muted rounded-xl"></div>
            <div className="h-96 bg-muted rounded-xl"></div>
          </div>
        </div>
      </PrivilegeRoute>
    );
  }

  // Error state
  if (error || !ppeSchedule?.data) {
    return (
      <PrivilegeRoute requiredPrivilege={SECTOR_PRIVILEGES.WAREHOUSE}>
        <div className="flex flex-col h-full space-y-6">
          <PageHeader
            variant="detail"
            title="Agendamento não encontrado"
            icon={IconCalendar}
            breadcrumbs={[
              { label: "Início", href: routes.home },
              { label: "RH", href: routes.humanResources.root },
              { label: "EPIs", href: routes.humanResources.ppe.root },
              { label: "Agendamentos", href: routes.humanResources.ppe.schedules.root },
              { label: "Detalhes" },
            ]}
          />
          <div className="flex flex-1 items-center justify-center">
            <div className="text-center px-4 max-w-md mx-auto">
              <div className="animate-in fade-in-50 duration-500">
                <div className="p-4 bg-red-50 dark:bg-red-900/20 rounded-full w-20 h-20 mx-auto mb-6 flex items-center justify-center">
                  <IconAlertTriangle className="h-10 w-10 text-red-500" />
                </div>
                <h2 className="text-xl sm:text-2xl font-semibold mb-3 text-foreground">Agendamento não encontrado</h2>
                <p className="text-sm sm:text-base text-muted-foreground mb-6 leading-relaxed">
                  O agendamento de EPI que você está procurando não existe ou foi removido do sistema.
                </p>
                <div className="space-y-3">
                  <Button onClick={() => navigate(routes.humanResources.ppe.schedules.root)} className="w-full sm:w-auto">
                    Ir para Lista de Agendamentos
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </PrivilegeRoute>
    );
  }

  // Check permissions
  const canEdit = canManageWarehouse;
  const canDelete = isAdmin;

  return (
    <PrivilegeRoute requiredPrivilege={SECTOR_PRIVILEGES.WAREHOUSE}>
      <div className="flex flex-col h-full space-y-6">
        {/* Header */}
        <div className="animate-in fade-in-50 duration-500">
          <PageHeader
            variant="detail"
            title={`Agendamento #${ppeSchedule.data.id.slice(-8)}`}
            icon={IconCalendar}
            breadcrumbs={[
              { label: "Início", href: routes.home },
              { label: "RH", href: routes.humanResources.root },
              { label: "EPIs", href: routes.humanResources.ppe.root },
              { label: "Agendamentos", href: routes.humanResources.ppe.schedules.root },
              { label: `#${ppeSchedule.data.id.slice(-8)}` },
            ]}
            actions={[
              {
                key: "refresh",
                label: "Atualizar",
                icon: IconRefresh,
                onClick: handleRefresh,
              },
              ...(canEdit
                ? [
                    {
                      key: "edit",
                      label: "Editar",
                      icon: IconEdit,
                      onClick: handleEdit,
                    },
                  ]
                : []),
              ...(canDelete
                ? [
                    {
                      key: "delete",
                      label: "Excluir",
                      icon: IconTrash,
                      onClick: () => setShowDeleteDialog(true),
                    },
                  ]
                : []),
            ]}
          />
        </div>

        <div className="flex-1 overflow-y-auto">
          <div className="space-y-6">
            {/* Content Grid */}
            <div className="animate-in fade-in-50 duration-700 space-y-6">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Basic Information Card */}
                <Card>
                  <CardHeader>
                    <CardTitle>Informações Gerais</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">Status</span>
                      <Badge variant={ppeSchedule.data.isActive ? "success" : "secondary"}>{ppeSchedule.data.isActive ? "Ativo" : "Inativo"}</Badge>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">Frequência</span>
                      <span className="text-sm font-medium">{SCHEDULE_FREQUENCY_LABELS[ppeSchedule.data.frequency] || ppeSchedule.data.frequency}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">Frequência de Repetição</span>
                      <span className="text-sm font-medium">{ppeSchedule.data.frequencyCount}x</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">Tipo de Atribuição</span>
                      <span className="text-sm font-medium">{ASSIGNMENT_TYPE_LABELS[ppeSchedule.data.assignmentType] || ppeSchedule.data.assignmentType}</span>
                    </div>
                    {ppeSchedule.data.ppeItems && ppeSchedule.data.ppeItems.length > 0 && (
                      <div>
                        <span className="text-sm text-muted-foreground">EPIs</span>
                        <div className="mt-2 flex flex-wrap gap-2">
                          {ppeSchedule.data.ppeItems.map((ppe: PpeScheduleItem, index: number) => (
                            <Badge key={`${ppe.ppeType}-${index}`} variant="outline">
                              {ppe.ppeType} (Qtd: {ppe.quantity})
                            </Badge>
                          ))}
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* Schedule Configuration Card */}
                <Card>
                  <CardHeader>
                    <CardTitle>Configuração do Agendamento</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {ppeSchedule.data.specificDate && (
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-muted-foreground">Data Específica</span>
                        <span className="text-sm font-medium">{new Date(ppeSchedule.data.specificDate).toLocaleDateString("pt-BR")}</span>
                      </div>
                    )}
                    {ppeSchedule.data.dayOfWeek !== null && ppeSchedule.data.dayOfWeek !== undefined && (
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-muted-foreground">Dia da Semana</span>
                        <span className="text-sm font-medium">{["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"][Number(ppeSchedule.data.dayOfWeek)]}</span>
                      </div>
                    )}
                    {ppeSchedule.data.dayOfMonth !== null && ppeSchedule.data.dayOfMonth !== undefined && (
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-muted-foreground">Dia do Mês</span>
                        <span className="text-sm font-medium">{ppeSchedule.data.dayOfMonth}</span>
                      </div>
                    )}
                    {ppeSchedule.data.month !== null && ppeSchedule.data.month !== undefined && (
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-muted-foreground">Mês</span>
                        <span className="text-sm font-medium">
                          {["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"][Number(ppeSchedule.data.month)]}
                        </span>
                      </div>
                    )}
                    {ppeSchedule.data.customMonths && ppeSchedule.data.customMonths.length > 0 && (
                      <div>
                        <span className="text-sm text-muted-foreground">Meses Personalizados</span>
                        <div className="mt-2 flex flex-wrap gap-2">
                          {ppeSchedule.data.customMonths.map((month: MONTH) => (
                            <Badge key={month} variant="outline">
                              {["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"][Number(month)]}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* Deliveries Summary Card */}
                {ppeSchedule.data.deliveries && ppeSchedule.data.deliveries.length > 0 && (
                  <Card className="lg:col-span-2">
                    <CardHeader>
                      <CardTitle>Últimas Entregas</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-4">
                        {ppeSchedule.data.deliveries.slice(0, 5).map((delivery: PpeDelivery) => (
                          <div key={delivery.id} className="flex items-center justify-between p-4 border rounded-lg">
                            <div className="space-y-1">
                              <p className="text-sm font-medium">{delivery.item?.name || "Item não especificado"}</p>
                              <p className="text-xs text-muted-foreground">
                                {delivery.user?.name || "Usuário não especificado"} - Qtd: {delivery.quantity}
                              </p>
                            </div>
                            <div className="text-right">
                              <p className="text-sm text-muted-foreground">
                                {delivery.scheduledDate ? new Date(delivery.scheduledDate).toLocaleDateString("pt-BR") : "Não agendado"}
                              </p>
                              <Badge variant="outline">{PPE_DELIVERY_STATUS_LABELS[delivery.status] || delivery.status}</Badge>
                            </div>
                          </div>
                        ))}
                        {ppeSchedule.data.deliveries.length > 5 && (
                          <p className="text-sm text-muted-foreground text-center">E mais {ppeSchedule.data.deliveries.length - 5} entregas...</p>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Delete Dialog */}
        <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Excluir Agendamento</AlertDialogTitle>
              <AlertDialogDescription>
                Tem certeza que deseja excluir este agendamento? Esta ação não pode ser desfeita e todas as entregas futuras serão canceladas.
              </AlertDialogDescription>
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
    </PrivilegeRoute>
  );
}
