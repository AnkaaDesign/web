import { useState, useRef, useCallback } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { PrivilegeRoute } from "@/components/navigation/privilege-route";
import { PageHeaderWithFavorite } from "@/components/ui/page-header-with-favorite";
import { AirbrushingForm } from "@/components/production/airbrushing/form/airbrushing-form";
import type { AirbrushingFormHandle } from "@/components/production/airbrushing/form/airbrushing-form";
import { IconSpray, IconCheck, IconLoader2 } from "@tabler/icons-react";
import { routes, SECTOR_PRIVILEGES, FAVORITE_PAGES } from "../../../constants";
import { usePageTracker } from "@/hooks/use-page-tracker";
import type { Airbrushing } from "../../../types";

export const AirbrushingCreate = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const formRef = useRef<AirbrushingFormHandle>(null);
  const [currentStep, setCurrentStep] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [canSubmit, setCanSubmit] = useState(false);

  // Get task ID from URL params if provided
  const taskId = searchParams.get("taskId");

  // Track page for analytics
  usePageTracker({ title: "Aerografia - Criar" });

  const handleSuccess = (airbrushing: Airbrushing) => {
    navigate(routes.production.airbrushings.details(airbrushing.id));
  };

  const handleCancel = () => {
    navigate(routes.production.airbrushings.root);
  };

  const handleStepChange = (step: number) => {
    setCurrentStep(step);
    // Check if form can be submitted when on last step
    if (step === 3 && formRef.current) {
      setCanSubmit(formRef.current.canSubmit());
    }
  };

  // Update canSubmit whenever form state changes
  const handleFormStateChange = useCallback(() => {
    if (formRef.current) {
      setCanSubmit(formRef.current.canSubmit());
    }
  }, []);

  // Calculate step states exactly like order form
  const isLastStep = currentStep === 3;
  const isFirstStep = currentStep === 1;

  // Generate regular action buttons (not navigation icons)
  const navigationActions = [];

  // Cancel button
  navigationActions.push({
    key: "cancel",
    label: "Cancelar",
    onClick: handleCancel,
    variant: "outline" as const,
    disabled: isSubmitting,
  });

  // Back button for non-first steps
  if (!isFirstStep) {
    navigationActions.push({
      key: "back",
      label: "Voltar",
      onClick: () => formRef.current?.handlePrev(),
      variant: "outline" as const,
      disabled: isSubmitting,
    });
  }

  // Next button for non-last steps
  if (!isLastStep) {
    navigationActions.push({
      key: "next",
      label: "Próximo",
      onClick: () => formRef.current?.handleNext(),
      variant: "default" as const,
      disabled: isSubmitting,
    });
  }

  // Submit button for last step only
  if (isLastStep) {
    console.log("[CREATE PAGE] Rendering submit button - isSubmitting:", isSubmitting, "canSubmit:", canSubmit, "disabled:", isSubmitting || !canSubmit);
    navigationActions.push({
      key: "submit",
      label: "Cadastrar",
      icon: isSubmitting ? IconLoader2 : IconCheck,
      onClick: async () => {
        console.log("[CREATE PAGE] Button clicked");
        console.log("[CREATE PAGE] formRef.current:", formRef.current);

        if (!formRef.current) {
          console.log("[CREATE PAGE] formRef.current is null, returning");
          return;
        }

        console.log("[CREATE PAGE] Setting isSubmitting to true");
        setIsSubmitting(true);

        try {
          console.log("[CREATE PAGE] Calling handleSubmit...");
          const success = await formRef.current.handleSubmit();
          console.log("[CREATE PAGE] handleSubmit returned:", success);

          // If validation failed (returned false), reset submitting state
          if (!success) {
            console.log("[CREATE PAGE] Validation failed, resetting isSubmitting");
            setIsSubmitting(false);
          }
          // If success (returned true), navigation will unmount the component
        } catch (error) {
          console.error("[CREATE PAGE] Error submitting airbrushing:", error);
          setIsSubmitting(false);
        }
      },
      variant: "default" as const,
      disabled: isSubmitting || !canSubmit,
      loading: isSubmitting,
    });
  }


  return (
    <PrivilegeRoute requiredPrivilege={[SECTOR_PRIVILEGES.ADMIN, SECTOR_PRIVILEGES.FINANCIAL]}>
      <div className="h-full flex flex-col">
        <div className="flex-shrink-0">
          <PageHeaderWithFavorite
            title="Nova Aerografia"
            icon={IconSpray}
            favoritePage={FAVORITE_PAGES.PRODUCAO_AEROGRAFIA_CADASTRAR}
            breadcrumbs={[
              { label: "Início", href: routes.home },
              { label: "Produção", href: routes.production.root },
              { label: "Aerografia", href: routes.production.airbrushings.root },
              { label: "Criar" },
            ]}
            actions={navigationActions}
          />
        </div>
        <div className="flex-1 min-h-0 overflow-hidden pt-6">
          <AirbrushingForm
              className="h-full"
              ref={formRef}
              mode="create"
              initialTaskId={taskId || undefined}
              onSuccess={handleSuccess}
              onCancel={handleCancel}
              onStepChange={handleStepChange}
              onFormStateChange={handleFormStateChange}
            />
        </div>
      </div>
    </PrivilegeRoute>
  );
};
