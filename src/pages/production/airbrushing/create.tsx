import { useState, useRef } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { PrivilegeRoute } from "@/components/navigation/privilege-route";
import { PageHeaderWithFavorite } from "@/components/ui/page-header-with-favorite";
import { AirbrushingForm } from "@/components/production/airbrushing/form/airbrushing-form";
import type { AirbrushingFormHandle } from "@/components/production/airbrushing/form/airbrushing-form";
import { IconSpray, IconArrowLeft, IconArrowRight, IconCheck, IconLoader2 } from "@tabler/icons-react";
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
    setIsSubmitting(false);
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

  // Submit button for last step only
  if (isLastStep) {
    navigationActions.push({
      key: "submit",
      label: "Cadastrar",
      icon: isSubmitting ? IconLoader2 : IconCheck,
      onClick: async () => {
        setIsSubmitting(true);
        try {
          await formRef.current?.handleSubmit();
        } catch (error) {
          setIsSubmitting(false);
        }
      },
      variant: "default" as const,
      disabled: isSubmitting || !canSubmit,
      loading: isSubmitting,
    });
  }

  // Generate navigation icons separately for title area
  const navigationIcons = [];

  // Previous icon (if not first step)
  if (!isFirstStep) {
    navigationIcons.push({
      key: "previous",
      label: "", // Icon only
      icon: IconArrowLeft,
      onClick: () => formRef.current?.handlePrev(),
      variant: "ghost" as const,
      disabled: isSubmitting,
    });
  }

  // Next icon (if not last step)
  if (!isLastStep) {
    navigationIcons.push({
      key: "next",
      label: "", // Icon only
      icon: IconArrowRight,
      onClick: () => formRef.current?.handleNext(),
      variant: "ghost" as const,
      disabled: isSubmitting,
    });
  }

  return (
    <PrivilegeRoute requiredPrivilege={[SECTOR_PRIVILEGES.ADMIN, SECTOR_PRIVILEGES.FINANCIAL]}>
      <div className="h-full flex flex-col">
        <div className="flex-shrink-0">
          <PageHeaderWithFavorite
            title={
              <div className="flex items-center gap-3">
                <span>Nova Aerografia</span>
                {navigationIcons.length > 0 && (
                  <div className="flex items-center gap-1">
                    {navigationIcons.map((iconAction) => {
                      const Icon = iconAction.icon;
                      return (
                        <button
                          key={iconAction.key}
                          onClick={iconAction.onClick}
                          disabled={iconAction.disabled}
                          className="p-1.5 rounded-md hover:bg-muted/80 transition-colors text-muted-foreground hover:text-foreground disabled:opacity-50 disabled:cursor-not-allowed"
                          title={iconAction.key === "previous" ? "Anterior" : "Próximo"}
                        >
                          <Icon className="h-4 w-4" />
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            }
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
        <div className="flex-1 overflow-y-auto">
          <div className="max-w-3xl mx-auto p-4">
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
            />
          </div>
        </div>
      </div>
    </PrivilegeRoute>
  );
};
