import { useNavigate, useParams } from "react-router-dom";
import { ServiceOrderForm } from "@/components/production/service-order/form";
import { routes } from "../../../../constants";
import { usePageTracker } from "@/hooks/use-page-tracker";
import type { ServiceOrder } from "../../../../types";

export const ServiceOrderEditPage = () => {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();

  // Track page for analytics
  usePageTracker({
    title: "Editar Ordem de Serviço",
    icon: "file-edit",
  });

  const handleSuccess = (serviceOrder: ServiceOrder) => {
    navigate(routes.production.serviceOrders.details(serviceOrder.id));
  };

  const handleCancel = () => {
    navigate(routes.production.serviceOrders.root);
  };

  if (!id) {
    navigate(routes.production.serviceOrders.root);
    return null;
  }

  return (
    <div className="h-full">
      <ServiceOrderForm serviceOrderId={id} mode="edit" onSuccess={handleSuccess} onCancel={handleCancel} />
    </div>
  );
};
