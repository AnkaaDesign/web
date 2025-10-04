import { OrderList } from "@/components/inventory/order/list/order-list";
import { PrivilegeRoute } from "@/components/navigation/privilege-route";
import { PageHeaderWithFavorite } from "@/components/ui/page-header-with-favorite";
import { SECTOR_PRIVILEGES, routes, FAVORITE_PAGES } from "../../../constants";
import { usePageTracker } from "@/hooks/use-page-tracker";
import { IconShoppingCart, IconPlus } from "@tabler/icons-react";
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
      <div className="flex flex-col h-full space-y-4">
        <div className="flex-shrink-0">
          <PageHeaderWithFavorite
            title="Pedidos"
            icon={IconShoppingCart}
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
          />
        </div>
        <OrderList className="flex-1 min-h-0" />
      </div>
    </PrivilegeRoute>
  );
};
