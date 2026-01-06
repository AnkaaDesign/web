import React from "react";

import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { IconAlertTriangle, IconTool, IconPackage, IconCalendar, IconArrowLeft, IconCheck, IconRotate } from "@tabler/icons-react";
import { type Maintenance } from "../../../../types";
import { MAINTENANCE_STATUS, MAINTENANCE_STATUS_LABELS, routes } from "../../../../constants";
import { formatDateTime } from "../../../../utils";
import { useFinishMaintenance } from "../../../../hooks";
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

interface MaintenanceFinishFormProps {
  maintenance: Maintenance & {
    lastRun?: Date | null;
    frequency?: string;
    frequencyCount?: number;
    isActive?: boolean;
    nextRun?: Date | null;
    item?: { name: string; uniCode?: string };
    itemsNeeded?: Array<{
      item?: { name: string };
      quantity: number;
    }>;
  };
  onCancel: () => void;
}

export function MaintenanceFinishForm({ maintenance, onCancel }: MaintenanceFinishFormProps) {
  const navigate = useNavigate();
  const finishMutation = useFinishMaintenance();
  const [showConfirmDialog, setShowConfirmDialog] = React.useState(false);

  const isCompleted = maintenance.status === MAINTENANCE_STATUS.COMPLETED;
  const canFinish = maintenance.status === MAINTENANCE_STATUS.IN_PROGRESS || maintenance.status === MAINTENANCE_STATUS.PENDING;

  const handleFinish = async () => {
    try {
      // Validate that the maintenance can be finished
      if (!canFinish) {
        if (process.env.NODE_ENV !== 'production') {
          console.error("Cannot finish maintenance in current status:", maintenance.status);
        }
        return;
      }

      // Validate that required data is present
      if (!maintenance.id) {
        if (process.env.NODE_ENV !== 'production') {
          console.error("Cannot finish maintenance: missing ID");
        }
        return;
      }

      const result = await finishMutation.mutateAsync({
        id: maintenance.id,
        include: {
          item: true,
          lastMaintenanceRun: true,
        },
      });

      if (result.success) {
        navigate(routes.inventory.maintenance.list);
      } else {
        if (process.env.NODE_ENV !== 'production') {
          console.error("Failed to finish maintenance:", result);
        }
      }
    } catch (error) {
      if (process.env.NODE_ENV !== 'production') {
        console.error("Error finishing maintenance:", error);
      }
    }
  };

  return (
    <>
      <div className="space-y-6">
        {/* Main Information Card */}
        <Card>
          <CardHeader>
            <CardTitle>Informações da Manutenção</CardTitle>
            <CardDescription>Detalhes da manutenção e status de conclusão</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Status Banner */}
            {isCompleted ? (
              <div className="bg-green-50 border border-green-200 rounded-lg p-4 flex items-center gap-3">
                <IconCheck className="h-5 w-5 text-green-700" />
                <div className="flex-1">
                  <p className="font-medium text-green-900">Manutenção Concluída</p>
                  <p className="text-sm text-green-700">Esta manutenção foi finalizada em {formatDateTime(maintenance.lastRun!)}</p>
                </div>
              </div>
            ) : (
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 flex items-center gap-3">
                <IconAlertTriangle className="h-5 w-5 text-amber-600" />
                <div className="flex-1">
                  <p className="font-medium text-amber-900">{maintenance.status === MAINTENANCE_STATUS.IN_PROGRESS ? "Manutenção em Andamento" : "Manutenção Pendente"}</p>
                  <p className="text-sm text-amber-700">Esta manutenção ainda não foi finalizada</p>
                </div>
              </div>
            )}

            <Separator />

            {/* Maintenance Information */}
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-muted-foreground mb-2">
                <IconTool className="h-4 w-4" />
                <span className="text-sm font-medium">Informações da Manutenção</span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-sm text-muted-foreground">Nome</label>
                  <p className="font-medium">{maintenance.name}</p>
                </div>
                <div>
                  <label className="text-sm text-muted-foreground">Status</label>
                  <p className="font-medium">{MAINTENANCE_STATUS_LABELS[maintenance.status]}</p>
                </div>
                {maintenance.description && (
                  <div className="col-span-full">
                    <label className="text-sm text-muted-foreground">Descrição</label>
                    <p className="font-medium">{maintenance.description}</p>
                  </div>
                )}
              </div>
            </div>

            <Separator />

            {/* Item Information */}
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-muted-foreground mb-2">
                <IconPackage className="h-4 w-4" />
                <span className="text-sm font-medium">Item Relacionado</span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-sm text-muted-foreground">Item</label>
                  <p className="font-medium">{maintenance.item?.name || "-"}</p>
                </div>
                {maintenance.item?.uniCode && (
                  <div>
                    <label className="text-sm text-muted-foreground">Código</label>
                    <p className="font-medium">{maintenance.item.uniCode}</p>
                  </div>
                )}
              </div>
            </div>

            {/* Items Needed */}
            {maintenance.itemsNeeded && maintenance.itemsNeeded.length > 0 && (
              <>
                <Separator />
                <div className="space-y-4">
                  <div className="flex items-center gap-2 text-muted-foreground mb-2">
                    <IconPackage className="h-4 w-4" />
                    <span className="text-sm font-medium">Itens Necessários</span>
                  </div>
                  <div className="space-y-2">
                    {maintenance.itemsNeeded.map((maintenanceItem, index) => (
                      <div key={index} className="bg-muted/30 rounded-lg p-3 flex justify-between items-center">
                        <span className="font-medium">{maintenanceItem.item?.name || "Item desconhecido"}</span>
                        <span className="text-sm text-muted-foreground">Qtd: {maintenanceItem.quantity}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </>
            )}

            <Separator />

            {/* Scheduling Information */}
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-muted-foreground mb-2">
                <IconRotate className="h-4 w-4" />
                <span className="text-sm font-medium">Informações de Agendamento</span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-sm text-muted-foreground">Frequência</label>
                  <p className="font-medium">{maintenance.frequency}</p>
                  {maintenance.frequencyCount && maintenance.frequencyCount > 1 && <p className="text-xs text-muted-foreground">A cada {maintenance.frequencyCount} período(s)</p>}
                </div>
                <div>
                  <label className="text-sm text-muted-foreground">Status do Agendamento</label>
                  <p className="font-medium">
                    {maintenance.isActive ? (
                      <span className="text-green-700">Ativo - Reagendará Automaticamente</span>
                    ) : (
                      <span className="text-orange-600">Inativo - Não Reagendará</span>
                    )}
                  </p>
                </div>
              </div>
              {maintenance.isActive && !isCompleted && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                  <p className="text-sm text-blue-800">
                    <strong>Atenção:</strong> Após finalizar esta manutenção, a próxima execução será calculada automaticamente com base na frequência configurada.
                  </p>
                </div>
              )}
            </div>

            <Separator />

            {/* Date Information */}
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-muted-foreground mb-2">
                <IconCalendar className="h-4 w-4" />
                <span className="text-sm font-medium">Informações de Data</span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-sm text-muted-foreground">Próxima Execução</label>
                  <p className="font-medium">{maintenance.nextRun ? formatDateTime(maintenance.nextRun) : "-"}</p>
                </div>
                {maintenance.lastRun && (
                  <div>
                    <label className="text-sm text-muted-foreground">Última Execução</label>
                    <p className="font-medium">{formatDateTime(maintenance.lastRun)}</p>
                  </div>
                )}
                <div>
                  <label className="text-sm text-muted-foreground">Data de Criação</label>
                  <p className="font-medium">{formatDateTime(maintenance.createdAt)}</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Action Buttons */}
        <div className="flex justify-between gap-4">
          <Button type="button" variant="outline" onClick={onCancel} disabled={finishMutation.isPending}>
            <IconArrowLeft className="mr-2 h-4 w-4" />
            Voltar
          </Button>

          {canFinish && (
            <Button type="button" onClick={() => setShowConfirmDialog(true)} disabled={finishMutation.isPending}>
              <IconCheck className="mr-2 h-4 w-4" />
              Marcar como Finalizada
            </Button>
          )}
        </div>
      </div>

      {/* Confirmation Dialog */}
      <AlertDialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar Finalização</AlertDialogTitle>
            <AlertDialogDescription className="space-y-3">
              <p>Você está prestes a marcar esta manutenção como finalizada:</p>

              <div className="bg-muted/50 rounded-lg p-3 space-y-2">
                <p className="text-sm">
                  <span className="font-medium">Manutenção:</span> {maintenance.name}
                </p>
                <p className="text-sm">
                  <span className="font-medium">Item:</span> {maintenance.item?.name}
                </p>
                <p className="text-sm">
                  <span className="font-medium">Status atual:</span> {MAINTENANCE_STATUS_LABELS[maintenance.status]}
                </p>
              </div>

              <p className="text-sm text-muted-foreground">
                Esta ação irá marcar a manutenção como concluída e atualizar a data da última execução.
                {maintenance.itemsNeeded && maintenance.itemsNeeded.length > 0 && <span> Os itens necessários serão consumidos do estoque.</span>}
              </p>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={finishMutation.isPending}>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleFinish} disabled={finishMutation.isPending}>
              Confirmar Finalização
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
