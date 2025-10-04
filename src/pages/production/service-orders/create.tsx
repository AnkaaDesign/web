import { useNavigate, useSearchParams } from "react-router-dom";
import { ServiceOrderForm } from "@/components/production/service-order/form";
import { routes } from "../../../constants";
import { usePageTracker } from "@/hooks/use-page-tracker";
import type { ServiceOrder } from "../../../types";

export const ServiceOrderCreatePage = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  // Get task ID from URL params if provided
  const taskId = searchParams.get("taskId");

  // Track page for analytics
  usePageTracker({
    title: "Cadastrar Ordem de Serviço",
    icon: "file-plus",
  });

  const handleSuccess = (serviceOrder: ServiceOrder) => {
    navigate(routes.production.serviceOrders.details(serviceOrder.id));
  };

  const handleCancel = () => {
    navigate(routes.production.serviceOrders.root);
  };

  return (
    <div className="h-full">
      <ServiceOrderForm mode="create" initialTaskId={taskId || undefined} onSuccess={handleSuccess} onCancel={handleCancel} />
    </div>
  );
};
