import { usePageTracker } from "@/hooks/use-page-tracker";
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
      <div className="flex flex-col h-full">
        <OrderCreateForm />
      </div>
    </PrivilegeRoute>
  );
};
