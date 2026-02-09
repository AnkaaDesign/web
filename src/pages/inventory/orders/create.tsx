import { usePageTracker } from "@/hooks/common/use-page-tracker";
import { PrivilegeRoute } from "@/components/navigation/privilege-route";
import { SECTOR_PRIVILEGES } from "../../../constants";
import { OrderCreateForm } from "@/components/inventory/order/form/order-create-form";

export const CreateOrderPage = () => {
  usePageTracker({
    title: "Cadastrar Pedido",
    icon: "plus",
  });

  return (
    <PrivilegeRoute requiredPrivilege={[SECTOR_PRIVILEGES.WAREHOUSE, SECTOR_PRIVILEGES.ADMIN]}>
      <div className="h-full flex flex-col">
        <OrderCreateForm />
      </div>
    </PrivilegeRoute>
  );
};
