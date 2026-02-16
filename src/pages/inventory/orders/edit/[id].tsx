import { useParams, useNavigate } from "react-router-dom";
import { useOrder } from "../../../../hooks";
import { routes } from "../../../../constants";
import type { Order } from "../../../../types";
import { Button } from "@/components/ui/button";
import { IconAlertTriangle, IconShoppingCart } from "@tabler/icons-react";
import { PrivilegeRoute } from "@/components/navigation/privilege-route";
import { SECTOR_PRIVILEGES } from "../../../../constants";
import { usePageTracker } from "@/hooks/common/use-page-tracker";
import { Card, CardContent } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { OrderEditForm } from "@/components/inventory/order/form/order-edit-form";

export const EditOrderPage = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  // Track page access
  usePageTracker({
    title: "Editar Pedido",
    icon: "edit",
  });

  const {
    data: response,
    isLoading,
    error,
  } = useOrder(id!, {
    include: {
      items: {
        include: {
          item: true,
        },
      },
      supplier: true,
      budgets: true,
      receipts: true,
      invoices: true,
    },
    enabled: !!id,
  });

  const order = response?.data;

  if (isLoading) {
    return (
      <PrivilegeRoute requiredPrivilege={[SECTOR_PRIVILEGES.WAREHOUSE, SECTOR_PRIVILEGES.ADMIN]}>
        <div className="h-full flex flex-col gap-4 bg-background px-4 pt-4">
          <div className="flex-shrink-0">
            <PageHeader
              variant="form"
              title="Editar Pedido"
              icon={IconShoppingCart}
              breadcrumbs={[
                { label: "Início", href: routes.home },
                { label: "Estoque", href: routes.inventory.root },
                { label: "Pedidos", href: routes.inventory.orders.list },
                { label: "Editar" },
              ]}
              className="flex-shrink-0"
            />
          </div>
          <div className="flex-1 overflow-y-auto pb-6">
            <div className="space-y-6">
              <div className="animate-pulse space-y-6">
                <div className="h-32 bg-muted rounded-xl"></div>
                <div className="h-96 bg-muted rounded-xl"></div>
              </div>
            </div>
          </div>
        </div>
      </PrivilegeRoute>
    );
  }

  if (error || !order) {
    return (
      <PrivilegeRoute requiredPrivilege={[SECTOR_PRIVILEGES.WAREHOUSE, SECTOR_PRIVILEGES.ADMIN]}>
        <div className="h-full flex flex-col gap-4 bg-background px-4 pt-4">
          <PageHeader
            variant="form"
            title="Editar Pedido"
            icon={IconShoppingCart}
            breadcrumbs={[
              { label: "Início", href: routes.home },
              { label: "Estoque", href: routes.inventory.root },
              { label: "Pedidos", href: routes.inventory.orders.list },
              { label: "Editar" },
            ]}
            backButton={{
              onClick: () => navigate(routes.inventory.orders.list),
            }}
            className="flex-shrink-0"
          />
          <div className="flex-1 overflow-y-auto pb-6">
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-16">
                <div className="text-center max-w-md mx-auto">
                  <div className="p-4 bg-red-50 dark:bg-red-900/20 rounded-full w-20 h-20 mx-auto mb-6 flex items-center justify-center">
                    <IconAlertTriangle className="h-10 w-10 text-red-500" />
                  </div>
                  <h2 className="text-xl sm:text-2xl font-semibold mb-3 text-foreground">Pedido não encontrado</h2>
                  <p className="text-sm sm:text-base text-muted-foreground mb-6 leading-relaxed">O pedido que você está tentando editar não existe ou foi removido do sistema.</p>
                  <div className="space-y-3">
                    <Button onClick={() => navigate(routes.inventory.orders.list)} className="w-full sm:w-auto">
                      Ir para Lista de Pedidos
                    </Button>
                    <Button variant="outline" onClick={() => navigate(routes.inventory.root)} className="w-full sm:w-auto">
                      Ir para Estoque
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </PrivilegeRoute>
    );
  }

  // Ensure items are loaded
  if (!order.items) {
    return (
      <PrivilegeRoute requiredPrivilege={[SECTOR_PRIVILEGES.WAREHOUSE, SECTOR_PRIVILEGES.ADMIN]}>
        <div className="h-full flex flex-col gap-4 bg-background px-4 pt-4">
          <PageHeader
            variant="form"
            title="Editar Pedido"
            icon={IconShoppingCart}
            breadcrumbs={[
              { label: "Início", href: routes.home },
              { label: "Estoque", href: routes.inventory.root },
              { label: "Pedidos", href: routes.inventory.orders.list },
              { label: "Editar" },
            ]}
            className="flex-shrink-0"
          />
          <div className="flex-1 overflow-y-auto pb-6 flex items-center justify-center">
            <div className="flex items-center gap-2">
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
              <span className="text-muted-foreground">Carregando itens...</span>
            </div>
          </div>
        </div>
      </PrivilegeRoute>
    );
  }

  return (
    <PrivilegeRoute requiredPrivilege={[SECTOR_PRIVILEGES.WAREHOUSE, SECTOR_PRIVILEGES.ADMIN]}>
      <div className="h-full flex flex-col">
        <OrderEditForm
          order={order as Order & { items: NonNullable<Order["items"]> }}
        />
      </div>
    </PrivilegeRoute>
  );
};
