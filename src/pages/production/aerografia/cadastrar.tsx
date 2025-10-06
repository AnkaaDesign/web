import { useNavigate, useSearchParams } from "react-router-dom";
import { useRef, useState, useMemo } from "react";
import { PrivilegeRoute } from "@/components/navigation/privilege-route";
import { PageHeader } from "@/components/ui/page-header";
import { AirbrushingForm } from "@/components/production/airbrushing/form";
import type { AirbrushingFormHandle } from "@/components/production/airbrushing/form";
import { IconSpray, IconArrowLeft, IconArrowRight, IconCheck, IconLoader2 } from "@tabler/icons-react";
import { routes, SECTOR_PRIVILEGES } from "../../../constants";
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

  // Calculate step states
  const isFirstStep = currentStep === 1;
  const isLastStep = currentStep === 3;

  const handleSuccess = (airbrushing: Airbrushing) => {
    setIsSubmitting(false);
    navigate(routes.production.airbrushings.details(airbrushing.id));
  };

  const handleCancel = () => {
    navigate(routes.production.airbrushings.root);
  };

  const handleNext = () => {
    if (formRef.current) {
      formRef.current.handleNext();
    }
  };

  const handlePrevious = () => {
    if (formRef.current) {
      formRef.current.handlePrev();
    }
  };

  const handleSubmit = async () => {
    if (formRef.current) {
      setIsSubmitting(true);
      try {
        await formRef.current.handleSubmit();
      } finally {
        setIsSubmitting(false);
      }
    }
  };

  const handleStepChange = (step: number) => {
    setCurrentStep(step);
    // Check if form can be submitted when on last step
    if (step === 3 && formRef.current) {
      setCanSubmit(formRef.current.canSubmit());
    }
  };

  // Generate navigation actions based on current step
  const navigationActions = useMemo(() => {
    const actions = [];

    // Cancel button is always first
    actions.push({
      key: "cancel",
      label: "Cancelar",
      onClick: handleCancel,
      variant: "outline" as const,
      disabled: isSubmitting,
    });

    // Previous button (if not first step)
    if (!isFirstStep) {
      actions.push({
        key: "previous",
        label: "Anterior",
        icon: IconArrowLeft,
        onClick: handlePrevious,
        variant: "outline" as const,
        disabled: isSubmitting,
      });
    }

    // Next or Submit button
    if (!isLastStep) {
      actions.push({
        key: "next",
        label: "Próximo",
        icon: IconArrowRight,
        onClick: handleNext,
        variant: "default" as const,
        disabled: isSubmitting,
        iconPosition: "right" as const,
      });
    } else {
      actions.push({
        key: "submit",
        label: "Criar Aerografia",
        icon: isSubmitting ? IconLoader2 : IconCheck,
        onClick: handleSubmit,
        variant: "default" as const,
        disabled: isSubmitting || !canSubmit,
        loading: isSubmitting,
      });
    }

    return actions;
  }, [currentStep, isSubmitting, isFirstStep, isLastStep]);

  return (
    <PrivilegeRoute requiredPrivilege={SECTOR_PRIVILEGES.ADMIN}>
      <div className="h-full">
        <div className="flex flex-col h-full space-y-4">
          <div className="flex-shrink-0">
            <PageHeader
              variant="form"
              title="Nova Aerografia"
              icon={IconSpray}
              breadcrumbs={[
                { label: "Início", href: routes.home },
                { label: "Produção", href: routes.production.root },
                { label: "Aerografias", href: routes.production.airbrushings.root },
                { label: "Criar" },
              ]}
              actions={navigationActions}
            />
          </div>
          <div className="flex-1 overflow-y-auto">
            <AirbrushingForm
              ref={formRef}
              mode="create"
              initialTaskId={taskId || undefined}
              onSuccess={handleSuccess}
              onCancel={handleCancel}
              onStepChange={(step) => {
                handleStepChange(step);
                // Update canSubmit state when form state changes
                setTimeout(() => {
                  if (formRef.current) {
                    setCanSubmit(formRef.current.canSubmit());
                  }
                }, 100);
              }}
              className="h-full"
            />
          </div>
        </div>
      </div>
    </PrivilegeRoute>
  );
};
