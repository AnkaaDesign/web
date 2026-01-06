import { useState, useRef, useCallback } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { PrivilegeRoute } from "@/components/navigation/privilege-route";
import { PageHeader } from "@/components/ui/page-header";
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
    navigationActions.push({
      key: "submit",
      label: "Cadastrar",
      icon: isSubmitting ? IconLoader2 : IconCheck,
      onClick: async () => {
        if (!formRef.current) {
          return;
        }

        setIsSubmitting(true);

        try {
          const success = await formRef.current.handleSubmit();

          // If validation failed (returned false), reset submitting state
          if (!success) {
            setIsSubmitting(false);
          }
          // If success (returned true), navigation will unmount the component
        } catch (error) {
          if (process.env.NODE_ENV !== 'production') {
            console.error("Error submitting airbrushing:", error);
          }
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
      <div className="h-full flex flex-col gap-4 bg-background px-4 pt-4">
        <PageHeader
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
          className="flex-shrink-0"
        />
        <div className="flex-1 overflow-y-auto pb-6">
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
