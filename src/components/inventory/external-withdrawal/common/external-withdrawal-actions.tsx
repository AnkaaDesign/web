import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
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
import { IconLoader2, IconCheck, IconCurrencyReal, IconX, IconPackageExport } from "@tabler/icons-react";
import { EXTERNAL_WITHDRAWAL_STATUS, EXTERNAL_WITHDRAWAL_TYPE } from "../../../../constants";
import { useExternalWithdrawalStatusMutations, usePrivileges } from "../../../../hooks";
import type { ExternalWithdrawal } from "../../../../types";
import { formatDateTime } from "../../../../utils";
import { cn } from "@/lib/utils";

interface ExternalWithdrawalActionsProps {
  withdrawal: ExternalWithdrawal;
  className?: string;
  variant?: "default" | "compact";
}

type ActionType = "PARTIAL_RETURN" | "FULL_RETURN" | "CHARGE" | "LIQUIDATE" | "DELIVER" | "CANCEL";

export function ExternalWithdrawalActions({ withdrawal, className, variant = "default" }: ExternalWithdrawalActionsProps) {
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [actionType, setActionType] = useState<ActionType | null>(null);
  const [notes, setNotes] = useState("");

  const {
    markAsPartiallyReturned,
    markAsFullyReturned,
    markAsCharged,
    markAsLiquidated,
    markAsDelivered,
    cancel,
  } = useExternalWithdrawalStatusMutations();
  const { canManageWarehouse } = usePrivileges();

  // Only show for active/partially returned withdrawals and users with warehouse permissions
  const canChangeStatus =
    canManageWarehouse && ![EXTERNAL_WITHDRAWAL_STATUS.FULLY_RETURNED, EXTERNAL_WITHDRAWAL_STATUS.CHARGED, EXTERNAL_WITHDRAWAL_STATUS.CANCELLED].includes(withdrawal.status);

  if (!canChangeStatus) {
    return null;
  }

  const handleAction = (type: ActionType) => {
    setActionType(type);
    setNotes("");
    setShowConfirmDialog(true);
  };

  const executeAction = async () => {
    if (!actionType) return;

    try {
      const data = notes.trim() ? { notes: notes.trim() } : undefined;

      switch (actionType) {
        case "PARTIAL_RETURN":
          await markAsPartiallyReturned.mutateAsync({ id: withdrawal.id, data });
          break;
        case "FULL_RETURN":
          await markAsFullyReturned.mutateAsync({ id: withdrawal.id, data });
          break;
        case "CHARGE":
          await markAsCharged.mutateAsync({ id: withdrawal.id, data });
          break;
        case "LIQUIDATE":
          await markAsLiquidated.mutateAsync({ id: withdrawal.id, data });
          break;
        case "DELIVER":
          await markAsDelivered.mutateAsync({ id: withdrawal.id, data });
          break;
        case "CANCEL":
          await cancel.mutateAsync({ id: withdrawal.id, data });
          break;
      }

      setShowConfirmDialog(false);
      setActionType(null);
      setNotes("");
    } catch (error) {
      // Error handled by mutation hook
    }
  };

  const getActionConfig = (type: ActionType) => {
    switch (type) {
      case "PARTIAL_RETURN":
        return {
          label: "Devolução Parcial",
          icon: IconPackageExport,
          variant: "secondary" as const,
          className: undefined,
          description: "Marcar alguns itens como devolvidos",
          confirmTitle: "Confirmar Devolução Parcial",
          confirmText: "Esta ação marcará a retirada como parcialmente devolvida.",
          requiresNotes: false,
        };
      case "FULL_RETURN":
        return {
          label: "Devolução Total",
          icon: IconCheck,
          variant: "default" as const,
          className: undefined,
          description: "Marcar todos os itens como devolvidos",
          confirmTitle: "Confirmar Devolução Total",
          confirmText: "Esta ação marcará todos os itens como devolvidos.",
          requiresNotes: false,
        };
      case "CHARGE":
        return {
          label: "Cobrar",
          icon: IconCurrencyReal,
          variant: "secondary" as const,
          className: undefined,
          description: "Cobrar o valor dos itens",
          confirmTitle: "Confirmar Cobrança",
          confirmText: "Esta ação marcará os itens como cobrados do responsável.",
          requiresNotes: false,
        };
      case "LIQUIDATE":
        return {
          label: "Liquidar",
          icon: IconCheck,
          variant: "default" as const,
          className: undefined,
          description: "Liquidar o valor cobrado",
          confirmTitle: "Confirmar Liquidação",
          confirmText: "Esta ação marcará o valor como liquidado.",
          requiresNotes: false,
        };
      case "DELIVER":
        return {
          label: "Entregar",
          icon: IconPackageExport,
          variant: "default" as const,
          className: undefined,
          description: "Marcar como entregue",
          confirmTitle: "Confirmar Entrega",
          confirmText: "Esta ação marcará a retirada como entregue.",
          requiresNotes: false,
        };
      case "CANCEL":
        return {
          label: "Cancelar",
          icon: IconX,
          variant: "destructive" as const,
          className: undefined,
          description: "Cancelar a retirada",
          confirmTitle: "Confirmar Cancelamento",
          confirmText: "Esta ação cancelará a retirada externa.",
          requiresNotes: true,
        };
    }
  };

  const isLoading =
    markAsPartiallyReturned.isPending ||
    markAsFullyReturned.isPending ||
    markAsCharged.isPending ||
    markAsLiquidated.isPending ||
    markAsDelivered.isPending ||
    cancel.isPending;

  const currentActionConfig = actionType ? getActionConfig(actionType) : null;

  // Available actions based on current type and status
  const availableActions: ActionType[] = [];

  if (withdrawal.type === EXTERNAL_WITHDRAWAL_TYPE.RETURNABLE) {
    if (withdrawal.status === EXTERNAL_WITHDRAWAL_STATUS.PENDING) {
      availableActions.push("PARTIAL_RETURN", "FULL_RETURN", "CANCEL");
    } else if (withdrawal.status === EXTERNAL_WITHDRAWAL_STATUS.PARTIALLY_RETURNED) {
      availableActions.push("FULL_RETURN", "CANCEL");
    }
  } else if (withdrawal.type === EXTERNAL_WITHDRAWAL_TYPE.CHARGEABLE) {
    if (withdrawal.status === EXTERNAL_WITHDRAWAL_STATUS.PENDING) {
      availableActions.push("CHARGE", "CANCEL");
    } else if (withdrawal.status === EXTERNAL_WITHDRAWAL_STATUS.CHARGED) {
      availableActions.push("LIQUIDATE", "CANCEL");
    }
  } else if (withdrawal.type === EXTERNAL_WITHDRAWAL_TYPE.COMPLIMENTARY) {
    if (withdrawal.status === EXTERNAL_WITHDRAWAL_STATUS.PENDING) {
      availableActions.push("DELIVER", "CANCEL");
    }
  }

  if (variant === "compact") {
    return (
      <>
        <div className={cn("flex items-center gap-2 flex-wrap", className)}>
          {availableActions.map((action) => {
            const config = getActionConfig(action);
            const Icon = config.icon;

            return (
              <Button key={action} onClick={() => handleAction(action)} variant={config.variant} size="sm" disabled={isLoading} className={config.className}>
                <Icon className="mr-1 h-3 w-3" />
                {config.label}
              </Button>
            );
          })}
        </div>

        {showConfirmDialog && currentActionConfig && (
          <AlertDialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>{currentActionConfig.confirmTitle}</AlertDialogTitle>
                <AlertDialogDescription className="space-y-3">
                  <p>{currentActionConfig.confirmText}</p>

                  <div className="bg-muted/50 rounded-lg p-3 space-y-2">
                    <p className="text-sm">
                      <span className="font-medium">Retirador:</span> {withdrawal.withdrawerName}
                    </p>
                    <p className="text-sm">
                      <span className="font-medium">Valor Total:</span> R$ {withdrawal.totalPrice?.toFixed(2) || "0,00"}
                    </p>
                    <p className="text-sm">
                      <span className="font-medium">Data da Retirada:</span> {formatDateTime(withdrawal.createdAt)}
                    </p>
                    <p className="text-sm">
                      <span className="font-medium">Itens:</span> {withdrawal.items?.length || 0}
                    </p>
                  </div>

                  {currentActionConfig.requiresNotes && (
                    <div className="space-y-2">
                      <Label htmlFor="action-notes">Observações {currentActionConfig.requiresNotes ? "(Obrigatório)" : "(Opcional)"}</Label>
                      <Textarea
                        id="action-notes"
                        placeholder="Adicione observações sobre esta ação..."
                        value={notes}
                        onChange={(e) => setNotes(e.target.value)}
                        className="min-h-20"
                      />
                    </div>
                  )}

                  {!currentActionConfig.requiresNotes && (
                    <div className="space-y-2">
                      <Label htmlFor="action-notes">Observações (Opcional)</Label>
                      <Textarea
                        id="action-notes"
                        placeholder="Adicione observações sobre esta ação..."
                        value={notes}
                        onChange={(e) => setNotes(e.target.value)}
                        className="min-h-20"
                      />
                    </div>
                  )}
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel disabled={isLoading}>Cancelar</AlertDialogCancel>
                <AlertDialogAction
                  onClick={executeAction}
                  disabled={isLoading || (currentActionConfig.requiresNotes && !notes.trim())}
                  className={cn(actionType === "CANCEL" && "bg-red-600 hover:bg-red-700", actionType === "CHARGE" && "bg-purple-600 hover:bg-purple-700")}
                >
                  {isLoading ? (
                    <>
                      <IconLoader2 className="mr-2 h-4 w-4 animate-spin" />
                      Processando...
                    </>
                  ) : (
                    <>
                      {currentActionConfig.icon && <currentActionConfig.icon className="mr-2 h-4 w-4" />}
                      Confirmar
                    </>
                  )}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        )}
      </>
    );
  }

  // Default variant - larger buttons with descriptions
  return (
    <>
      <div className={cn("space-y-3", className)}>
        {availableActions.map((action) => {
          const config = getActionConfig(action);
          const Icon = config.icon;

          return (
            <Button
              key={action}
              onClick={() => handleAction(action)}
              variant={config.variant}
              size="lg"
              disabled={isLoading}
              className={cn("w-full justify-start", config.className)}
            >
              <Icon className="mr-3 h-4 w-4" />
              <div className="flex-1 text-left">
                <div className="font-medium">{config.label}</div>
                <div className="text-xs opacity-80">{config.description}</div>
              </div>
            </Button>
          );
        })}
      </div>

      {showConfirmDialog && currentActionConfig && (
        <AlertDialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>{currentActionConfig.confirmTitle}</AlertDialogTitle>
              <AlertDialogDescription className="space-y-3">
                <p>{currentActionConfig.confirmText}</p>

                <div className="bg-muted/50 rounded-lg p-3 space-y-2">
                  <p className="text-sm">
                    <span className="font-medium">Retirador:</span> {withdrawal.withdrawerName}
                  </p>
                  <p className="text-sm">
                    <span className="font-medium">Valor Total:</span> R$ {withdrawal.totalPrice?.toFixed(2) || "0,00"}
                  </p>
                  <p className="text-sm">
                    <span className="font-medium">Data da Retirada:</span> {formatDateTime(withdrawal.createdAt)}
                  </p>
                  <p className="text-sm">
                    <span className="font-medium">Itens:</span> {withdrawal.items?.length || 0}
                  </p>
                </div>

                {currentActionConfig.requiresNotes && (
                  <div className="space-y-2">
                    <Label htmlFor="action-notes">Observações (Obrigatório)</Label>
                    <Textarea
                      id="action-notes"
                      placeholder="Adicione observações sobre esta ação..."
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      className="min-h-20"
                    />
                  </div>
                )}

                {!currentActionConfig.requiresNotes && (
                  <div className="space-y-2">
                    <Label htmlFor="action-notes">Observações (Opcional)</Label>
                    <Textarea
                      id="action-notes"
                      placeholder="Adicione observações sobre esta ação..."
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      className="min-h-20"
                    />
                  </div>
                )}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={isLoading}>Cancelar</AlertDialogCancel>
              <AlertDialogAction
                onClick={executeAction}
                disabled={isLoading || (currentActionConfig.requiresNotes && !notes.trim())}
                className={cn(actionType === "CANCEL" && "bg-red-600 hover:bg-red-700", actionType === "CHARGE" && "bg-purple-600 hover:bg-purple-700")}
              >
                {isLoading ? (
                  <>
                    <IconLoader2 className="mr-2 h-4 w-4 animate-spin" />
                    Processando...
                  </>
                ) : (
                  <>
                    {currentActionConfig.icon && <currentActionConfig.icon className="mr-2 h-4 w-4" />}
                    Confirmar
                  </>
                )}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}
    </>
  );
}
