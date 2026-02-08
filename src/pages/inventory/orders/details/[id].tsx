import { useParams, useNavigate } from "react-router-dom";
import { useOrder, useOrderMutations } from "../../../../hooks";
import { routes, ORDER_STATUS, CHANGE_LOG_ENTITY_TYPE } from "../../../../constants";
import { Button } from "@/components/ui/button";
import { IconAlertTriangle, IconShoppingCart, IconTrash, IconRefresh, IconEdit, IconLoader2, IconCheck } from "@tabler/icons-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/ui/page-header";
import type { PageAction } from "@/components/ui/page-header";
import { OrderInfoCard, OrderItemsCard, OrderDocumentsCard } from "@/components/inventory/order/detail";
import { OrderDetailSkeleton } from "@/components/inventory/order/detail/order-detail-skeleton";
import { ChangelogHistory } from "@/components/ui/changelog-history";
import { usePrivileges } from "../../../../hooks";
import { useState } from "react";
import { useAuth } from "@/contexts/auth-context";
import { canEditOrders } from "@/utils/permissions/entity-permissions";
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
import { OrderTotalBadge } from "@/components/inventory/order/common/order-total-calculator";
import { DETAIL_PAGE_SPACING, getDetailGridClasses } from "@/lib/layout-constants";

const OrderDetailsPage = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showCompleteDialog, setShowCompleteDialog] = useState(false);
  const { user } = useAuth();
  const canManageWarehouse = canEditOrders(user);
  const { deleteMutation, updateAsync } = useOrderMutations();

  // Track page access
  usePageTracker({
    title: "Detalhes do Pedido",
    icon: "shopping-cart",
  });

  const {
    data: response,
    isLoading,
    error,
    refetch,
  } = useOrder(id!, {
    include: {
      items: {
        include: {
          item: {
            include: {
              brand: true,
              measures: true,
            },
          },
        },
      },
      supplier: {
        include: {
          logo: true,
        },
      },
      budgets: true,
      invoices: true,
      receipts: true,
      reimbursements: true,
      invoiceReimbursements: true,
    },
    enabled: !!id,
  });

  const order = response?.data;

  if (isLoading) {
    return (
      <PrivilegeRoute requiredPrivilege={SECTOR_PRIVILEGES.WAREHOUSE}>
        <OrderDetailSkeleton />
      </PrivilegeRoute>
    );
  }

  if (error || !order) {
    return (
      <PrivilegeRoute requiredPrivilege={SECTOR_PRIVILEGES.WAREHOUSE}>
        <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 dark:from-neutral-900 dark:to-neutral-800">
          <div className="container mx-auto p-4 sm:p-4 max-w-7xl">
            <div className="flex flex-1 items-center justify-center min-h-[60vh]">
              <div className="text-center px-4 max-w-md mx-auto">
                <div className="animate-in fade-in-50 duration-500">
                  <div className="p-4 bg-red-50 dark:bg-red-900/20 rounded-full w-20 h-20 mx-auto mb-6 flex items-center justify-center">
                    <IconAlertTriangle className="h-10 w-10 text-red-500" />
                  </div>
                  <h2 className="text-xl sm:text-2xl font-semibold mb-3 text-foreground">Pedido não encontrado</h2>
                  <p className="text-sm sm:text-base text-muted-foreground mb-6 leading-relaxed">O pedido que você está procurando não existe ou foi removido do sistema.</p>
                  <div className="space-y-3">
                    <Button onClick={() => navigate(routes.inventory.orders.list)} className="w-full sm:w-auto">
                      Ir para Lista de Pedidos
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
    navigate(routes.inventory.orders.edit(order.id));
  };

  const handleRefresh = () => {
    refetch();
  };

  const handleDelete = async () => {
    try {
      await deleteMutation.mutateAsync(order.id);
      navigate(routes.inventory.orders.list);
    } catch (error) {
      if (process.env.NODE_ENV !== 'production') {
        console.error("Error deleting order:", error);
      }
    }
  };

  const handleOrderUpdate = () => {
    refetch();
  };

  const handleCompleteOrder = async () => {
    try {
      await updateAsync({
        id: order.id,
        data: {
          status: ORDER_STATUS.RECEIVED,
        },
      });
      setShowCompleteDialog(false);
      refetch();
    } catch (error) {
      if (process.env.NODE_ENV !== 'production') {
        console.error("Error completing order:", error);
      }
    }
  };

  // Check if all items are fully received
  const allItemsReceived = order.items?.every((item) => item.receivedQuantity === item.orderedQuantity) ?? false;

  // Custom actions for the header
  const customActions = [];

  if (canManageWarehouse) {
    customActions.push({
      label: "Excluir",
      icon: IconTrash,
      onClick: () => setShowDeleteDialog(true),
    });
  }

  // Check if order can be edited
  const canEdit = canManageWarehouse && ![ORDER_STATUS.RECEIVED, ORDER_STATUS.CANCELLED].includes(order.status);

  // Check if all items are fulfilled
  const allItemsFulfilled = order.items?.every((item) => item.fulfilledAt !== null) ?? false;

  // Build actions based on status
  const orderActions = [];

  // Determine which button to show based on the order lifecycle:
  // Priority 1: Check explicit status that indicates fulfillment/receiving phase
  // Priority 2: For OVERDUE status, check if items are fulfilled to determine phase
  //
  // Lifecycle flow:
  // CREATED → PARTIALLY_FULFILLED → FULFILLED → PARTIALLY_RECEIVED → RECEIVED
  //    ↓             ↓                   ↓              ↓
  //           [Marcar como Feito]   [Marcar como Recebido]
  //
  // Special case: OVERDUE can occur at any stage, so we check item fulfillment

  // Determine if order is in fulfillment or receiving phase
  let isInFulfillmentPhase = false;
  let isInReceivingPhase = false;

  if (order.status === ORDER_STATUS.OVERDUE) {
    // For OVERDUE orders, check item fulfillment to determine phase
    // If all items are fulfilled, it's ready to be received
    // If not all fulfilled, it still needs to be marked as done
    isInReceivingPhase = allItemsFulfilled;
    isInFulfillmentPhase = !allItemsFulfilled;
  } else if ([ORDER_STATUS.CREATED, ORDER_STATUS.PARTIALLY_FULFILLED].includes(order.status)) {
    // Orders in these statuses are in the fulfillment phase
    isInFulfillmentPhase = true;
  } else if ([ORDER_STATUS.FULFILLED, ORDER_STATUS.PARTIALLY_RECEIVED].includes(order.status)) {
    // Orders in these statuses are in the receiving phase
    isInReceivingPhase = true;
  }

  // Show "Marcar como Feito" button when order is in fulfillment phase
  if (canManageWarehouse && isInFulfillmentPhase && order.status !== ORDER_STATUS.CANCELLED) {
    orderActions.push({
      key: "fulfill",
      label: "Marcar como Feito",
      icon: IconShoppingCart,
      onClick: async () => {
        try {
          await updateAsync({
            id: order.id,
            data: {
              status: ORDER_STATUS.FULFILLED,
            },
          });
          // Mark all items as fulfilled
          const itemIds = order.items?.map((item) => item.id) || [];
          if (itemIds.length > 0) {
            const { batchMarkOrderItemsFulfilled } = await import("../../../../api-client");
            await batchMarkOrderItemsFulfilled(itemIds);
          }
          refetch();
        } catch (error) {
          if (process.env.NODE_ENV !== 'production') {
            console.error("Error marking order as done:", error);
          }
        }
      },
    });
  }

  // Show "Marcar como Recebido" button when order is in receiving phase
  if (canManageWarehouse && isInReceivingPhase && order.status !== ORDER_STATUS.RECEIVED && order.status !== ORDER_STATUS.CANCELLED) {
    orderActions.push({
      key: "complete",
      label: "Marcar como Recebido",
      icon: IconCheck,
      onClick: () => setShowCompleteDialog(true),
    });
  }

  return (
    <PrivilegeRoute requiredPrivilege={SECTOR_PRIVILEGES.WAREHOUSE}>
      <div className="h-full flex flex-col gap-4 bg-background px-4 pt-4">
        <PageHeader
          variant="detail"
          title={order.description}
          breadcrumbs={[
            { label: "Início", href: routes.home },
            { label: "Estoque", href: routes.inventory.root },
            { label: "Pedidos", href: routes.inventory.orders.list },
            { label: order.description },
          ]}
          actions={[
            {
              key: "refresh",
              label: "Atualizar",
              icon: IconRefresh,
              onClick: handleRefresh,
            },
            ...(orderActions as PageAction[]),
            ...(canEdit
              ? [
                  {
                    key: "edit",
                    label: "Editar",
                    icon: IconEdit,
                    onClick: handleEdit,
                  } as PageAction,
                ]
              : []),
            ...(customActions.map((action) => ({ key: "delete", ...action })) as PageAction[]),
          ]}
          className="flex-shrink-0"
        />
        <div className="flex-1 overflow-y-auto pb-6">
          <div className="space-y-4">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {/* Core Information Grid */}
              <OrderInfoCard order={order} className="h-full" />
              <ChangelogHistory
                entityType={CHANGE_LOG_ENTITY_TYPE.ORDER}
                entityId={order.id}
                entityName={order.description}
                entityCreatedAt={order.createdAt}
                className="h-full"
              />
            </div>

            {/* Bottom Section: Items and Documents */}
            <OrderItemsCard order={order} className="w-full" onOrderUpdate={handleOrderUpdate} />

            {/* Documents Section */}
            <OrderDocumentsCard order={order} className="w-full" />
          </div>
        </div>

        {/* Delete Confirmation Dialog */}
        <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Confirmar Exclusão</AlertDialogTitle>
              <AlertDialogDescription>
                Tem certeza que deseja excluir este pedido? Esta ação não pode ser desfeita.
                <br />
                <br />
                <strong>Fornecedor:</strong> {order.supplier?.fantasyName || "Não especificado"}
                <br />
                <strong>Valor Total:</strong> <OrderTotalBadge orderItems={order.items} />
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

        {/* Complete Order Confirmation Dialog */}
        <AlertDialog open={showCompleteDialog} onOpenChange={setShowCompleteDialog}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Confirmar Recebimento Total</AlertDialogTitle>
              <AlertDialogDescription>
                Tem certeza que deseja marcar este pedido como totalmente recebido?
                <br />
                <br />
                <div className="bg-muted/50 rounded-lg p-3 space-y-2">
                  <p className="text-sm">
                    <span className="font-medium">Fornecedor:</span> {order.supplier?.fantasyName || "Não especificado"}
                  </p>
                  <p className="text-sm">
                    <span className="font-medium">Valor Total:</span> <OrderTotalBadge orderItems={order.items} />
                  </p>
                  <p className="text-sm">
                    <span className="font-medium">Itens:</span> {order.items?.length || 0}
                  </p>
                </div>
                <br />
                Esta ação irá:
                <ul className="list-disc list-inside space-y-1 text-sm">
                  <li>Marcar o pedido como completamente recebido</li>
                  <li>Registrar a data de conclusão</li>
                  <li>Criar atividades de entrada para todos os itens</li>
                </ul>
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={false}>Cancelar</AlertDialogCancel>
              <AlertDialogAction onClick={handleCompleteOrder} disabled={false}>
                {false ? (
                  <>
                    <IconLoader2 className="mr-2 h-4 w-4 animate-spin" />
                    Processando...
                  </>
                ) : (
                  <>
                    <IconCheck className="mr-2 h-4 w-4" />
                    Confirmar Recebimento
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

export default OrderDetailsPage;
