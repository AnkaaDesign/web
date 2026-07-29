import React from "react";
import { IconCheck, IconAlertCircle } from "@tabler/icons-react";
import { cn } from "@/lib/utils";

export interface FormStep {
  id: number;
  name: string;
  description: string;
}

interface FormStepsProps {
  steps: FormStep[];
  currentStep: number;
  className?: string;
  stepErrors?: { [key: number]: boolean };
  /**
   * Turns the step markers into buttons. Receives the clicked step's `id`.
   *
   * The caller owns what a jump costs. The convention across the wizards
   * (`handleStepClick`): going BACK is free — no gate, nothing is lost — while
   * going FORWARD runs the very same validation as the "Próximo" button, so a
   * click can never skip a gate that the button enforces.
   */
  onStepClick?: (stepId: number) => void;
  /**
   * Restricts which steps accept a click. By default EVERY step is offered —
   * the gate lives in `handleStepClick`, which walks the validations between
   * here and the target and parks the user on the first one that refuses. A
   * marker that looks inert instead teaches "you can't get there from here",
   * which is false: the wizard decides that, not the indicator.
   */
  canNavigateToStep?: (stepId: number) => boolean;
  /** Freezes every marker — e.g. while a submit is in flight. */
  disabled?: boolean;
}

export function FormSteps({ steps, currentStep, className, stepErrors = {}, onStepClick, canNavigateToStep, disabled = false }: FormStepsProps) {
  const isClickable = (step: FormStep): boolean => {
    if (disabled || !onStepClick || step.id === currentStep) return false;
    if (canNavigateToStep) return canNavigateToStep(step.id);
    return true;
  };

  return (
    <div className={cn("flex items-center justify-between", className)}>
      {steps.map((step, index) => {
        const clickable = isClickable(step);

        const containerClassName = cn(
          "flex items-center space-x-2 text-left",
          currentStep === step.id && "text-primary",
          currentStep > step.id && "text-primary",
          currentStep < step.id && "text-muted-foreground",
          clickable && "cursor-pointer rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background group",
        );

        const marker = (
          <>
            <div
              className={cn(
                "flex h-8 w-8 items-center justify-center rounded-full border-2 relative transition-colors",
                currentStep === step.id && !stepErrors[step.id] && "border-primary bg-primary text-primary-foreground",
                currentStep === step.id && stepErrors[step.id] && "border-destructive bg-destructive text-destructive-foreground",
                currentStep > step.id && !stepErrors[step.id] && "border-primary bg-primary text-primary-foreground",
                currentStep > step.id && stepErrors[step.id] && "border-destructive bg-destructive text-destructive-foreground",
                currentStep < step.id && !stepErrors[step.id] && "border-muted-foreground",
                currentStep < step.id && stepErrors[step.id] && "border-destructive",
                // Solid ring + a real offset against the page background. A translucent ring sitting
                // 1px off the filled circle blends its green into the circle's own and reads as a blur.
                clickable && "group-hover:ring-2 group-hover:ring-offset-2 group-hover:ring-offset-background",
                clickable && !stepErrors[step.id] && "group-hover:ring-primary",
                clickable && stepErrors[step.id] && "group-hover:ring-destructive",
              )}
            >
              {stepErrors[step.id] && currentStep >= step.id ? (
                <IconAlertCircle className="h-4 w-4" />
              ) : currentStep > step.id ? (
                <IconCheck className="h-4 w-4" />
              ) : (
                <span className="text-sm font-medium">{step.id}</span>
              )}
            </div>
            <div className="hidden sm:block">
              <p className={cn("text-sm font-medium", clickable && "group-hover:underline")}>{step.name}</p>
              <p className="text-xs text-muted-foreground">{step.description}</p>
            </div>
          </>
        );

        return (
          <React.Fragment key={step.id}>
            {clickable ? (
              <button
                type="button"
                data-testid={`form-step-${step.id}`}
                data-error={stepErrors[step.id] ? "true" : "false"}
                className={containerClassName}
                onClick={() => onStepClick?.(step.id)}
                aria-current={currentStep === step.id ? "step" : undefined}
                aria-label={`Ir para a etapa ${step.id}: ${step.name}`}
                title={`Ir para: ${step.name}`}
              >
                {marker}
              </button>
            ) : (
              <div
                data-testid={`form-step-${step.id}`}
                data-error={stepErrors[step.id] ? "true" : "false"}
                className={containerClassName}
                aria-current={currentStep === step.id ? "step" : undefined}
              >
                {marker}
              </div>
            )}
            {index < steps.length - 1 && <div className={cn("h-0.5 flex-1 bg-muted", currentStep > step.id && "bg-primary")} />}
          </React.Fragment>
        );
      })}
    </div>
  );
}
