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
}

export function FormSteps({ steps, currentStep, className, stepErrors = {} }: FormStepsProps) {
  return (
    <div className={cn("flex items-center justify-between", className)}>
      {steps.map((step, index) => (
        <React.Fragment key={step.id}>
          <div
            data-testid={`form-step-${step.id}`}
            data-error={stepErrors[step.id] ? "true" : "false"}
            className={cn(
              "flex items-center space-x-2",
              currentStep === step.id && "text-primary",
              currentStep > step.id && "text-primary",
              currentStep < step.id && "text-muted-foreground",
            )}
          >
            <div
              className={cn(
                "flex h-8 w-8 items-center justify-center rounded-full border-2 relative",
                currentStep === step.id && !stepErrors[step.id] && "border-primary bg-primary text-primary-foreground",
                currentStep === step.id && stepErrors[step.id] && "border-destructive bg-destructive text-destructive-foreground",
                currentStep > step.id && !stepErrors[step.id] && "border-primary bg-primary text-primary-foreground",
                currentStep > step.id && stepErrors[step.id] && "border-destructive bg-destructive text-destructive-foreground",
                currentStep < step.id && !stepErrors[step.id] && "border-muted-foreground",
                currentStep < step.id && stepErrors[step.id] && "border-destructive",
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
              <p className="text-sm font-medium">{step.name}</p>
              <p className="text-xs text-muted-foreground">{step.description}</p>
            </div>
          </div>
          {index < steps.length - 1 && <div className={cn("h-0.5 flex-1 bg-muted", currentStep > step.id && "bg-primary")} />}
        </React.Fragment>
      ))}
    </div>
  );
}
