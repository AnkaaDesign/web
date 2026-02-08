import { OrderScheduleCreateForm } from "@/components/inventory/order-schedule/form/order-schedule-create-form";
import { usePageTracker } from "@/hooks/common/use-page-tracker";

export const OrderScheduleCreate = () => {
  // Track page access
  usePageTracker({
    title: "Criar Agendamento de Pedido",
    icon: "calendar-repeat",
  });

  return <OrderScheduleCreateForm />;
};

export default OrderScheduleCreate;
