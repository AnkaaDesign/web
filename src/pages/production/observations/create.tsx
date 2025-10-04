import { useNavigate, useSearchParams } from "react-router-dom";
import { PrivilegeRoute } from "@/components/navigation/privilege-route";
import { ObservationForm } from "@/components/production/observation/form";
import { routes, SECTOR_PRIVILEGES } from "../../../constants";
import { usePageTracker } from "@/hooks/use-page-tracker";
import type { Observation } from "../../../types";

export const ObservationCreate = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  // Get task ID from URL params if provided
  const taskId = searchParams.get("taskId");

  // Track page for analytics
  usePageTracker({ title: "Observações - Criar", icon: "observations_create" });

  const handleSuccess = (observation: Observation) => {
    navigate(routes.production.observations.details(observation.id));
  };

  const handleCancel = () => {
    navigate(routes.production.observations.root);
  };

  return (
    <PrivilegeRoute requiredPrivilege={SECTOR_PRIVILEGES.ADMIN}>
      <div className="h-full">
        <ObservationForm mode="create" initialTaskId={taskId || undefined} onSuccess={handleSuccess} onCancel={handleCancel} />
      </div>
    </PrivilegeRoute>
  );
};
