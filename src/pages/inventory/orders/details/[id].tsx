import { SECTOR_PRIVILEGES } from "../../../../constants";
import { PrivilegeRoute } from "@/components/navigation/privilege-route";
import { usePageTracker } from "@/hooks/common/use-page-tracker";
import { OrderDetailPage } from "@/components/inventory/order/detail-page";

const OrderDetailsPage = () => {
  // Track page access
  usePageTracker({
    title: "Detalhes do Pedido",
    icon: "shopping-cart",
  });

  return (
    <PrivilegeRoute requiredPrivilege={[SECTOR_PRIVILEGES.WAREHOUSE, SECTOR_PRIVILEGES.FINANCIAL, SECTOR_PRIVILEGES.ACCOUNTING, SECTOR_PRIVILEGES.ADMIN]}>
      <OrderDetailPage />
    </PrivilegeRoute>
  );
};

export default OrderDetailsPage;
