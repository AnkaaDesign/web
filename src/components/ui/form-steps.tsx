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
   * Overrides which steps accept a click. The default rule is the linear-wizard
   * one: every step up to the furthest one reached so far, plus the immediate
   * next. A step beyond that has never had the steps before it validated, so it
   * stays inert (rendered exactly as it is today).
   */
  canNavigateToStep?: (stepId: number) => boolean;
  /** Freezes every marker — e.g. while a submit is in flight. */
  disabled?: boolean;
}

export function FormSteps({ steps, currentStep, className, stepErrors = {}, onStepClick, canNavigateToStep, disabled = false }: FormStepsProps) {
  const currentIndex = steps.findIndex((step) => step.id === currentStep);

  // Steps already reached stay reachable: walking out to step 5 and back to 2
  // must not re-lock 3–5 — their gates passed already, so making the user click
  // "Próximo" through them again is the exact friction this feature removes.
  const [furthestIndex, setFurthestIndex] = React.useState(currentIndex);
  React.useEffect(() => {
    if (currentIndex > furthestIndex) setFurthestIndex(currentIndex);
  }, [currentIndex, furthestIndex]);

  // Clamp: a dynamic step list can SHRINK under us (a budget/billing customer
  // being removed drops a step), which would otherwise leave the reach index
  // pointing past the end.
  const reachIndex = Math.max(currentIndex, Math.min(furthestIndex, steps.length - 1));

  const isClickable = (step: FormStep, index: number): boolean => {
    if (disabled || !onStepClick || step.id === currentStep) return false;
    if (canNavigateToStep) return canNavigateToStep(step.id);
    return index <= reachIndex + 1;
  };

  return (
    <div className={cn("flex items-center justify-between", className)}>
      {steps.map((step, index) => {
        const clickable = isClickable(step, index);

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
