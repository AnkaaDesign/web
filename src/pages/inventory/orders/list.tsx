import { OrderList } from "@/components/inventory/order/list/order-list";
import { PrivilegeRoute } from "@/components/navigation/privilege-route";
import { PageHeader } from "@/components/ui/page-header";
import { SECTOR_PRIVILEGES, routes, FAVORITE_PAGES } from "../../../constants";
import { usePageTracker } from "@/hooks/use-page-tracker";
import { IconPlus } from "@tabler/icons-react";
import { useNavigate } from "react-router-dom";

export const OrderListPage = () => {
  const navigate = useNavigate();

  // Track page access
  usePageTracker({
    title: "Lista de Pedidos",
    icon: "shopping-cart",
  });

  return (
    <PrivilegeRoute requiredPrivilege={SECTOR_PRIVILEGES.WAREHOUSE}>
      <div className="h-full flex flex-col gap-4 bg-background px-4 pt-4">
        <PageHeader
          variant="list"
          title="Pedidos"
          favoritePage={FAVORITE_PAGES.ESTOQUE_PEDIDOS_LISTAR}
          breadcrumbs={[{ label: "Início", href: routes.home }, { label: "Estoque", href: routes.inventory.root }, { label: "Pedidos" }]}
          actions={[
            {
              key: "create",
              label: "Cadastrar",
              icon: IconPlus,
              onClick: () => navigate(routes.inventory.orders.create),
              variant: "default",
            },
          ]}
          className="flex-shrink-0"
        />

        <div className="flex-1 min-h-0 pb-6 flex flex-col">
          <OrderList className="h-full" />
        </div>
      </div>
    </PrivilegeRoute>
  );
};
