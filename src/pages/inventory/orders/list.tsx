import { OrderTablePage } from "@/components/inventory/order/table";
import { PrivilegeRoute } from "@/components/navigation/privilege-route";
import { SECTOR_PRIVILEGES } from "../../../constants";
import { usePageTracker } from "@/hooks/common/use-page-tracker";

export const OrderListPage = () => {
  // Track page access
  usePageTracker({
    title: "Lista de Pedidos",
    icon: "shopping-cart",
  });

  return (
    <PrivilegeRoute requiredPrivilege={SECTOR_PRIVILEGES.WAREHOUSE}>
      <OrderTablePage />
    </PrivilegeRoute>
  );
};
