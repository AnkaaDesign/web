import { useState, useRef, useCallback } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { PrivilegeRoute } from "@/components/navigation/privilege-route";
import { ObservationForm } from "@/components/production/observation/form";
import { PageHeader } from "@/components/ui/page-header";
import { routes, SECTOR_PRIVILEGES } from "../../../constants";
import { usePageTracker } from "@/hooks/common/use-page-tracker";
import type { Observation } from "../../../types";
import { IconNotebook } from "@tabler/icons-react";

export const ObservationCreate = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [currentStep, setCurrentStep] = useState(1);
  const navigationHandlersRef = useRef<{ handleNext: () => void; handlePrev: () => void } | undefined>(undefined);

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

  const handleNavigationReady = useCallback((handlers: { handleNext: () => void; handlePrev: () => void }) => {
    navigationHandlersRef.current = handlers;
  }, []);

  const handleNextStep = () => {
    navigationHandlersRef.current?.handleNext();
  };

  const handlePrevStep = () => {
    navigationHandlersRef.current?.handlePrev();
  };

  // Dynamic actions based on current step
  const getActions = () => {
    const actions = [
      {
        key: "cancel",
        label: "Cancelar",
        onClick: handleCancel,
        variant: "outline" as const,
      },
    ];

    // Step 1: Only show Next button
    if (currentStep === 1) {
      actions.push({
        key: "next",
        label: "Próximo",
        onClick: handleNextStep,
        variant: "outline" as const,
      });
    }
    // Step 2: Show Previous and Next buttons
    else if (currentStep === 2) {
      actions.push(
        {
          key: "previous",
          label: "Anterior",
          onClick: handlePrevStep,
          variant: "outline" as const,
        },
        {
          key: "next",
          label: "Próximo",
          onClick: handleNextStep,
          variant: "outline" as const,
        }
      );
    }
    // Step 3: Show Previous and Submit buttons
    else if (currentStep === 3) {
      actions.push(
        {
          key: "previous",
          label: "Anterior",
          onClick: handlePrevStep,
          variant: "outline" as const,
        },
        {
          key: "submit",
          label: "Cadastrar",
          onClick: () => document.getElementById("observation-form-submit")?.click(),
          variant: "outline" as const,
        }
      );
    }

    return actions;
  };

  const actions = getActions();

  return (
    <PrivilegeRoute requiredPrivilege={[SECTOR_PRIVILEGES.PRODUCTION, SECTOR_PRIVILEGES.WAREHOUSE, SECTOR_PRIVILEGES.COMMERCIAL, SECTOR_PRIVILEGES.ADMIN]}>
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
            onStepChange={setCurrentStep}
            onNavigationReady={handleNavigationReady}
          />
        </div>
      </div>
    </PrivilegeRoute>
  );
};
