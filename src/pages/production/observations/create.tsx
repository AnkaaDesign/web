import { useNavigate, useSearchParams } from "react-router-dom";
import { PrivilegeRoute } from "@/components/navigation/privilege-route";
import { ObservationForm } from "@/components/production/observation/form";
import { PageHeader } from "@/components/ui/page-header";
import { routes, SECTOR_PRIVILEGES } from "../../../constants";
import { usePageTracker } from "@/hooks/use-page-tracker";
import type { Observation } from "../../../types";
import { IconCheck, IconLoader2, IconNotebook } from "@tabler/icons-react";
import { useState } from "react";

export const ObservationCreate = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [formState, setFormState] = useState({ isValid: false, isDirty: false });
  const [isSubmitting, setIsSubmitting] = useState(false);

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

  const actions = [
    {
      key: "cancel",
      label: "Cancelar",
      onClick: handleCancel,
      variant: "outline" as const,
      disabled: isSubmitting,
    },
    {
      key: "submit",
      label: "Cadastrar",
      icon: isSubmitting ? IconLoader2 : IconCheck,
      onClick: () => document.getElementById("observation-form-submit")?.click(),
      variant: "default" as const,
      disabled: isSubmitting || !formState.isValid,
      loading: isSubmitting,
    },
  ];

  return (
    <PrivilegeRoute requiredPrivilege={SECTOR_PRIVILEGES.ADMIN}>
      <div className="h-full flex flex-col gap-4 bg-background px-4 pt-4">
        <PageHeader
          title="Cadastrar Observação"
          icon={IconNotebook}
          breadcrumbs={[
            { label: "Produção", href: routes.production.root },
            { label: "Observações", href: routes.production.observations.root },
            { label: "Cadastrar" }
          ]}
          actions={actions}
          className="flex-shrink-0"
        />
        <div className="flex-1 overflow-y-auto pb-6">
          <ObservationForm
            mode="create"
            initialTaskId={taskId || undefined}
            onSuccess={handleSuccess}
            onCancel={handleCancel}
            onFormStateChange={setFormState}
            onSubmittingChange={setIsSubmitting}
          />
        </div>
      </div>
    </PrivilegeRoute>
  );
};
