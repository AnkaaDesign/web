import { useParams, useNavigate } from "react-router-dom";
import { useOrder, useOrderMutations } from "../../../../hooks";
import { routes, ORDER_STATUS, CHANGE_LOG_ENTITY_TYPE } from "../../../../constants";
import { Button } from "@/components/ui/button";
import { IconAlertTriangle, IconShoppingCart, IconTrash, IconRefresh, IconEdit, IconLoader2, IconCheck } from "@tabler/icons-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/ui/page-header";
import type { PageAction } from "@/components/ui/page-header";
import { OrderInfoCard, OrderItemsCard } from "@/components/inventory/order/detail";
import { OrderDetailSkeleton } from "@/components/inventory/order/detail/order-detail-skeleton";
import { ChangelogHistory } from "@/components/ui/changelog-history";
import { usePrivileges } from "../../../../hooks";
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
import { PrivilegeRoute } from "@/components/navigation/privilege-route";
import { SECTOR_PRIVILEGES } from "../../../../constants";
import { usePageTracker } from "@/hooks/use-page-tracker";
import { OrderTotalBadge } from "@/components/inventory/order/common/order-total-calculator";

const OrderDetailsPage = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showCompleteDialog, setShowCompleteDialog] = useState(false);
  const { canManageWarehouse } = usePrivileges();
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
          item: true,
        },
      },
      supplier: true,
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
          <div className="container mx-auto p-4 sm:p-6 max-w-7xl">
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
      toast.success("Pedido excluído com sucesso");
      navigate(routes.inventory.orders.list);
    } catch (error) {
      toast.error("Erro ao excluir pedido");
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
      toast.success("Pedido marcado como recebido");
      setShowCompleteDialog(false);
      refetch();
    } catch (error) {
      toast.error("Erro ao marcar pedido como recebido");
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

  // Show mark as fulfilled action if not all items are fulfilled and order is not received/cancelled
  if (canManageWarehouse && !allItemsFulfilled && ![ORDER_STATUS.RECEIVED, ORDER_STATUS.CANCELLED].includes(order.status)) {
    orderActions.push({
      key: "fulfill",
      label: "Marcar como Pedido",
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
          toast.success("Pedido marcado como pedido");
          refetch();
        } catch (error) {
          toast.error("Erro ao marcar pedido como pedido");
        }
      },
    });
  }

  // Show complete action if all items are received and order is not yet completed
  if (canManageWarehouse && allItemsReceived && order.status !== ORDER_STATUS.RECEIVED) {
    orderActions.push({
      key: "complete",
      label: "Marcar como Recebido",
      icon: IconCheck,
      onClick: () => setShowCompleteDialog(true),
    });
  }

  return (
    <PrivilegeRoute requiredPrivilege={SECTOR_PRIVILEGES.WAREHOUSE}>
      <div className="flex flex-col h-full space-y-6">
        {/* Hero Section - Enhanced Header with Actions */}
        <div className="animate-in fade-in-50 duration-500">
          <PageHeader
            variant="detail"
            title={`Pedido #${order.id.slice(-8)}`}
            icon={IconShoppingCart}
            className="shadow-lg"
            breadcrumbs={[
              { label: "Início", href: routes.home },
              { label: "Estoque", href: routes.inventory.root },
              { label: "Pedidos", href: routes.inventory.orders.list },
              { label: `#${order.id.slice(-8)}` },
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
          />
        </div>

        <div className="flex-1 overflow-y-auto">
          <div className="space-y-6">
            {/* Core Information Grid */}
            <div className="animate-in fade-in-50 duration-700 space-y-6">
              {/* Top Section: Info and Changelog */}
              {/* Mobile: Single column stacked */}
              <div className="block lg:hidden space-y-4">
                <OrderInfoCard order={order} className="h-full" />
                <ChangelogHistory
                  entityType={CHANGE_LOG_ENTITY_TYPE.ORDER}
                  entityId={order.id}
                  entityName={`Pedido #${order.id.slice(-8)}`}
                  entityCreatedAt={order.createdAt}
                  className="h-full"
                />
              </div>

              {/* Desktop/Tablet: 2 columns grid with 1/2 and 1/2 split */}
              <div className="hidden lg:block">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <OrderInfoCard order={order} className="h-full" />
                  <ChangelogHistory
                    entityType={CHANGE_LOG_ENTITY_TYPE.ORDER}
                    entityId={order.id}
                    entityName={`Pedido #${order.id.slice(-8)}`}
                    entityCreatedAt={order.createdAt}
                    className="h-full"
                  />
                </div>
              </div>

              {/* Bottom Section: Items Full Width */}
              <OrderItemsCard order={order} className="w-full" onOrderUpdate={handleOrderUpdate} />
            </div>
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
