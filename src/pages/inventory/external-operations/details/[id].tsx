import { useParams, useNavigate } from "react-router-dom";
import { useExternalOperation, useExternalOperationStatusMutations, useCanViewPrices } from "../../../../hooks";
import { routes, EXTERNAL_OPERATION_STATUS, EXTERNAL_OPERATION_TYPE, CHANGE_LOG_ENTITY_TYPE } from "../../../../constants";
import { formatCurrency } from "../../../../utils";
import { Button } from "@/components/ui/button";
import type { Icon as TablerIcon } from "@tabler/icons-react";
import { IconAlertTriangle, IconRefresh, IconEdit, IconCheck, IconLoader2, IconCurrencyReal, IconTruckDelivery, IconCircleCheck, IconBan } from "@tabler/icons-react";
import { PageHeader } from "@/components/ui/page-header";
import { ExternalOperationInfoCard, ExternalOperationItemsCard, ExternalOperationBillingCard } from "@/components/inventory/external-operation/detail";
import { ExternalOperationDetailSkeleton } from "@/components/inventory/external-operation/detail/external-operation-detail-skeleton";
import { ChangelogHistory } from "@/components/ui/changelog-history";
import React, { useState } from "react";
import { useAuth } from "@/contexts/auth-context";
import { canEditExternalOperations } from "@/utils/permissions/entity-permissions";
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
import { PrivilegeRoute } from "@/components/navigation/privilege-route";
import { SECTOR_PRIVILEGES } from "../../../../constants";
import { usePageTracker } from "@/hooks/common/use-page-tracker";
import { DETAIL_PAGE_SPACING, getDetailGridClasses } from "@/lib/layout-constants";

const ExternalOperationDetailsPage = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [showActionDialog, setShowActionDialog] = useState(false);
  const [actionType, setActionType] = useState<"FULL_RETURN" | "CHARGE" | "DELIVER" | "LIQUIDATE" | "CANCEL" | null>(null);
  const [actionNotes, setActionNotes] = useState("");
  const { user } = useAuth();
  const canViewPrices = useCanViewPrices();
  const canManageWarehouse = canEditExternalOperations(user);
  const statusMutations = useExternalOperationStatusMutations();

  // Track page access
  usePageTracker({
    title: "Detalhes da Operação Externa",
    icon: "package-export",
  });

  const {
    data: response,
    isLoading,
    error,
    refetch,
  } = useExternalOperation(id!, {
    include: {
      items: {
        include: {
          item: {
            include: {
              category: true,
              brands: true,
              supplier: true,
              prices: { orderBy: { createdAt: "desc" }, take: 1 },
            },
          },
        },
      },
      customer: true,
      services: true,
      invoices: true,
      receipts: true,
      billingInvoice: {
        include: {
          installments: { include: { bankSlip: true } },
          nfseDocuments: true,
        },
      },
    },
    enabled: !!id,
  });

  const withdrawal = response?.data;

  if (isLoading) {
    return (
      <PrivilegeRoute requiredPrivilege={SECTOR_PRIVILEGES.ADMIN}>
        <ExternalOperationDetailSkeleton />
      </PrivilegeRoute>
    );
  }

  if (error || !withdrawal) {
    return (
      <PrivilegeRoute requiredPrivilege={SECTOR_PRIVILEGES.ADMIN}>
        <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 dark:from-neutral-900 dark:to-neutral-800">
          <div className="container mx-auto p-4 sm:p-4 max-w-7xl">
            <div className="flex flex-1 items-center justify-center min-h-[60vh]">
              <div className="text-center px-4 max-w-md mx-auto">
                <div className="animate-in fade-in-50 duration-500">
                  <div className="p-4 bg-red-50 dark:bg-red-900/20 rounded-full w-20 h-20 mx-auto mb-6 flex items-center justify-center">
                    <IconAlertTriangle className="h-10 w-10 text-red-500" />
                  </div>
                  <h2 className="text-xl sm:text-2xl font-semibold mb-3 text-foreground">Operação externa não encontrada</h2>
                  <p className="text-sm sm:text-base text-muted-foreground mb-6 leading-relaxed">
                    A operação externa que você está procurando não existe ou foi removida do sistema.
                  </p>
                  <div className="space-y-3">
                    <Button onClick={() => navigate(routes.inventory.externalOperations?.list || "/inventory/external-operations")} className="w-full sm:w-auto">
                      Ir para Lista de Operações
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
      </PrivilegeRoute>
    );
  }

  const handleEdit = () => {
    navigate(routes.inventory.externalOperations.edit(withdrawal.id));
  };

  const handleRefresh = () => {
    refetch();
  };

  const handleAction = (type: "FULL_RETURN" | "CHARGE" | "DELIVER" | "LIQUIDATE" | "CANCEL") => {
    setActionType(type);
    setActionNotes("");
    setShowActionDialog(true);
  };

  const executeAction = async () => {
    if (!actionType) return;

    try {
      const data = actionNotes.trim() ? { notes: actionNotes.trim() } : undefined;

      switch (actionType) {
        case "FULL_RETURN":
          await statusMutations.markAsFullyReturned.mutateAsync({ id: withdrawal.id, data });
          break;
        case "CHARGE":
          await statusMutations.markAsCharged.mutateAsync({ id: withdrawal.id, data });
          break;
        case "DELIVER":
          await statusMutations.markAsDelivered.mutateAsync({ id: withdrawal.id, data });
          break;
        case "LIQUIDATE":
          await statusMutations.markAsLiquidated.mutateAsync({ id: withdrawal.id, data });
          break;
        case "CANCEL":
          await statusMutations.cancel.mutateAsync({ id: withdrawal.id, data });
          break;
      }

      setShowActionDialog(false);
      setActionType(null);
      setActionNotes("");
      refetch();
    } catch (error) {
      // Error handled by mutation hook
    }
  };

  const getActionConfig = (
    type: "FULL_RETURN" | "CHARGE" | "DELIVER" | "LIQUIDATE" | "CANCEL",
  ): {
    label: string;
    icon: TablerIcon;
    variant: "default" | "destructive" | "outline" | "secondary" | "ghost";
    description: string;
    confirmTitle: string;
    confirmText: string;
    requiresNotes: boolean;
  } => {
    switch (type) {
      case "FULL_RETURN":
        return {
          label: "Devolução Total",
          icon: IconCheck as TablerIcon,
          variant: "default" as const,
          description: "Marcar todos os itens como devolvidos",
          confirmTitle: "Confirmar Devolução Total",
          confirmText: "Esta ação marcará todos os itens como devolvidos.",
          requiresNotes: false,
        };
      case "CHARGE": {
        const billingConfigured = !!withdrawal?.customerId && (withdrawal?.generateInvoice !== false || withdrawal?.generateBankSlip !== false);
        const billingDocs = [withdrawal?.generateInvoice !== false ? "NFS-e" : null, withdrawal?.generateBankSlip !== false ? "boletos" : null].filter(Boolean).join(" e ");
        return {
          label: "Marcar como Cobrado",
          icon: IconCurrencyReal as TablerIcon,
          variant: "default" as const,
          description: "Cobrar o valor dos itens e serviços",
          confirmTitle: "Confirmar Cobrança",
          confirmText: billingConfigured
            ? `Esta ação marcará a operação como cobrada e os documentos de cobrança configurados (${billingDocs}) serão gerados automaticamente.`
            : "Esta ação marcará a operação como cobrada. Nenhum documento de cobrança será gerado automaticamente (faturamento não configurado). Após cobrar, a operação não poderá mais gerar documentos de cobrança automaticamente.",
          requiresNotes: false,
        };
      }
      case "DELIVER":
        return {
          label: "Marcar como Entregue",
          icon: IconTruckDelivery as TablerIcon,
          variant: "default" as const,
          description: "Marcar como entregue (cortesia)",
          confirmTitle: "Confirmar Entrega",
          confirmText: "Esta ação marcará a operação como entregue.",
          requiresNotes: false,
        };
      case "LIQUIDATE":
        return {
          label: "Marcar como Liquidado",
          icon: IconCircleCheck as TablerIcon,
          variant: "default" as const,
          description: "Confirmar o recebimento do valor cobrado (liquidação manual)",
          confirmTitle: "Confirmar Liquidação",
          confirmText: "Esta ação marcará a operação como liquidada, confirmando que o pagamento foi recebido.",
          requiresNotes: false,
        };
      case "CANCEL":
        return {
          label: "Cancelar Operação",
          icon: IconBan as TablerIcon,
          variant: "destructive" as const,
          description: "Cancelar esta operação externa",
          confirmTitle: "Cancelar Operação",
          confirmText: "Esta ação cancelará a operação. Boletos e NFS-e gerados serão cancelados. Esta ação não pode ser desfeita.",
          requiresNotes: true,
        };
    }
  };

  // Create entity object for DetailPageHeader (unused, can be removed later)
  // const entityForHeader = {
  //   id: withdrawal.id,
  //   name: `Retirada #${withdrawal.id.slice(-8)}`,
  // };

  // Custom actions for the header
  const customActions: Array<{
    key: string;
    label: string;
    icon: TablerIcon;
    onClick: () => void;
    variant?: "default" | "outline";
  }> = [];

  // Check if withdrawal can be edited (only pending and partially returned for RETURNABLE)
  const editableStatuses = [EXTERNAL_OPERATION_STATUS.PENDING];
  if (withdrawal.type === EXTERNAL_OPERATION_TYPE.RETURNABLE) {
    editableStatuses.push(EXTERNAL_OPERATION_STATUS.PARTIALLY_RETURNED);
  }
  const canEdit = canManageWarehouse && editableStatuses.includes(withdrawal.status);

  // Build actions based on status
  const withdrawalActions: Array<{
    key: string;
    label: string;
    icon: TablerIcon;
    onClick: () => void;
    variant?: "default" | "outline" | "secondary" | "destructive" | "ghost" | "link";
  }> = [];

  if (canManageWarehouse) {
    // RETURNABLE type: Show "Devolução Total" action
    if (withdrawal.type === EXTERNAL_OPERATION_TYPE.RETURNABLE) {
      if (withdrawal.status === EXTERNAL_OPERATION_STATUS.PENDING || withdrawal.status === EXTERNAL_OPERATION_STATUS.PARTIALLY_RETURNED) {
        withdrawalActions.push({
          key: "full-return",
          label: "Devolução Total",
          icon: IconCheck,
          onClick: () => handleAction("FULL_RETURN"),
          variant: "default" as const,
        });
      }
    }
    // CHARGEABLE type: Show "Cobrar" action
    else if (withdrawal.type === EXTERNAL_OPERATION_TYPE.CHARGEABLE) {
      if (withdrawal.status === EXTERNAL_OPERATION_STATUS.PENDING) {
        withdrawalActions.push({
          key: "charge",
          label: "Marcar como Cobrado",
          icon: IconCurrencyReal,
          onClick: () => handleAction("CHARGE"),
          variant: "default" as const,
        });
      }
    }
    // COMPLIMENTARY type: Show "Marcar como Entregue" action
    else if (withdrawal.type === EXTERNAL_OPERATION_TYPE.COMPLIMENTARY) {
      if (withdrawal.status === EXTERNAL_OPERATION_STATUS.PENDING) {
        withdrawalActions.push({
          key: "deliver",
          label: "Marcar como Entregue",
          icon: IconTruckDelivery,
          onClick: () => handleAction("DELIVER"),
          variant: "default" as const,
        });
      }
    }

    // CHARGED status: allow manual settlement
    if (withdrawal.status === EXTERNAL_OPERATION_STATUS.CHARGED) {
      withdrawalActions.push({
        key: "liquidate",
        label: "Marcar como Liquidado",
        icon: IconCircleCheck,
        onClick: () => handleAction("LIQUIDATE"),
        variant: "default" as const,
      });
    }

    // Cancellation: available while PENDING, PARTIALLY_RETURNED or CHARGED
    if (
      withdrawal.status === EXTERNAL_OPERATION_STATUS.PENDING ||
      withdrawal.status === EXTERNAL_OPERATION_STATUS.PARTIALLY_RETURNED ||
      withdrawal.status === EXTERNAL_OPERATION_STATUS.CHARGED
    ) {
      withdrawalActions.push({
        key: "cancel",
        label: "Cancelar Operação",
        icon: IconBan,
        onClick: () => handleAction("CANCEL"),
        variant: "destructive" as const,
      });
    }
  }

  const isActionLoading =
    statusMutations.markAsFullyReturned.isPending ||
    statusMutations.markAsCharged.isPending ||
    statusMutations.markAsDelivered.isPending ||
    statusMutations.markAsLiquidated.isPending ||
    statusMutations.cancel.isPending;

  return (
    <PrivilegeRoute requiredPrivilege={SECTOR_PRIVILEGES.ADMIN}>
      <div className="h-full flex flex-col px-4 pt-4">
        <div className="flex-shrink-0">
          <PageHeader
            variant="detail"
            title={withdrawal.withdrawerName}
            className="shadow-sm"
            breadcrumbs={[
              { label: "Início", href: routes.home },
              { label: "Estoque", href: routes.inventory.root },
              { label: "Operações Externas", href: routes.inventory.externalOperations?.list || "/inventory/external-operations" },
              { label: withdrawal.withdrawerName },
            ]}
            actions={[
              {
                key: "refresh",
                label: "Atualizar",
                icon: IconRefresh,
                onClick: handleRefresh,
              },
              ...withdrawalActions,
              ...(canEdit
                ? [
                    {
                      key: "edit",
                      label: "Editar",
                      icon: IconEdit,
                      onClick: handleEdit,
                      variant: "default" as const,
                    },
                  ]
                : []),
              ...customActions,
            ]}
          />
        </div>
        <div className="flex-1 overflow-y-auto pb-6">
          <div className="space-y-4 mt-4">
            {/* Core Information Grid */}
            <div className={DETAIL_PAGE_SPACING.HEADER_TO_GRID}>
            <div className={getDetailGridClasses()}>
              <ExternalOperationInfoCard withdrawal={withdrawal} className="h-full" />
              <ChangelogHistory
                entityType={CHANGE_LOG_ENTITY_TYPE.EXTERNAL_OPERATION}
                entityId={withdrawal.id}
                entityName={withdrawal.withdrawerName}
                entityCreatedAt={withdrawal.createdAt}
                className="h-full"
              />
              </div>
            </div>

            {/* Billing Section (CHARGEABLE only) */}
            {withdrawal.type === EXTERNAL_OPERATION_TYPE.CHARGEABLE && (
              <ExternalOperationBillingCard withdrawal={withdrawal} className="w-full" onUpdate={refetch} />
            )}

            {/* Bottom Section: Items Full Width */}
            <ExternalOperationItemsCard withdrawal={withdrawal} className="w-full" onWithdrawalUpdate={refetch} />
          </div>
        </div>

        {/* Action Confirmation Dialog */}
        <AlertDialog open={showActionDialog} onOpenChange={setShowActionDialog}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>{actionType && getActionConfig(actionType).confirmTitle}</AlertDialogTitle>
              <AlertDialogDescription className="space-y-3">
                <p>{actionType && getActionConfig(actionType).confirmText}</p>

                <div className="bg-muted/50 rounded-lg p-3 space-y-2">
                  <p className="text-sm">
                    <span className="font-medium">Responsável:</span> {withdrawal.withdrawerName}
                  </p>
                  {canViewPrices && (
                    <p className="text-sm">
                      <span className="font-medium">Valor Total:</span>{" "}
                      {formatCurrency(
                        (withdrawal.items || []).reduce((sum, item) => sum + (item.withdrawedQuantity || 0) * (item.price || 0), 0) +
                          (withdrawal.services || []).reduce((sum, service) => sum + (Number(service.amount) || 0), 0),
                      )}
                    </p>
                  )}
                  <p className="text-sm">
                    <span className="font-medium">Itens:</span> {withdrawal.items?.length || 0}
                  </p>
                  {withdrawal.items && withdrawal.items.length > 0 && (
                    <div className="text-sm space-y-1 mt-3 pt-3 border-t">
                      <p className="font-medium mb-2">Resumo dos Itens:</p>
                      {withdrawal.items.slice(0, 3).map((item, _index) => (
                        <p key={item.id} className="text-muted-foreground">
                          • {item.item?.name || "Item desconhecido"}:
                          {item.returnedQuantity > 0 && (
                            <span className="ml-1 text-green-600">
                              {item.returnedQuantity}/{item.withdrawedQuantity} devolvidos
                            </span>
                          )}
                          {item.returnedQuantity === 0 && <span className="ml-1">{item.withdrawedQuantity} retirados</span>}
                        </p>
                      ))}
                      {withdrawal.items.length > 3 && <p className="text-muted-foreground italic">... e mais {withdrawal.items.length - 3} itens</p>}
                    </div>
                  )}
                </div>

                {actionType && (getActionConfig(actionType).requiresNotes || !getActionConfig(actionType).requiresNotes) && (
                  <div className="space-y-2">
                    <Label htmlFor="action-notes">Observações {actionType && getActionConfig(actionType).requiresNotes ? "(Obrigatório)" : "(Opcional)"}</Label>
                    <Textarea
                      id="action-notes"
                      placeholder="Adicione observações sobre esta ação..."
                      value={actionNotes}
                      onChange={(e) => setActionNotes(e.target.value)}
                      className="min-h-20"
                    />
                  </div>
                )}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={isActionLoading}>Cancelar</AlertDialogCancel>
              <AlertDialogAction
                onClick={executeAction}
                disabled={isActionLoading || (actionType && getActionConfig(actionType).requiresNotes && !actionNotes.trim()) || false}
                className={actionType && getActionConfig(actionType).variant === "destructive" ? "bg-destructive text-destructive-foreground hover:bg-destructive/90" : ""}
              >
                {isActionLoading ? (
                  <>
                    <IconLoader2 className="mr-2 h-4 w-4 animate-spin" />
                    Processando...
                  </>
                ) : (
                  <>
                    {actionType && React.createElement(getActionConfig(actionType).icon, { className: "mr-2 h-4 w-4" })}
                    Confirmar
                  </>
                )}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </PrivilegeRoute>
  );
};

export default ExternalOperationDetailsPage;
