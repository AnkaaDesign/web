import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import React, { useState, useEffect, useCallback, useMemo, useImperativeHandle, forwardRef } from "react";
import { useSearchParams } from "react-router-dom";
import { Form } from "@/components/ui/form";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { FormSteps, type FormStep } from "@/components/ui/form-steps";
import { paintCreateSchema, paintUpdateSchema, type PaintCreateFormData, type PaintUpdateFormData } from "../../../schemas";
import type { PaintFormula } from "../../../types";
import { useAvailableComponents, usePaintType } from "../../../hooks";
import { serializeFormToUrlParams, deserializeUrlParamsToForm, debounce } from "@/utils/url-form-state";

// Import form field components
import { NameInput } from "./name-input";
import { CodeInput } from "./code-input";
import { HexColorInput } from "./hex-color-input";
import { FinishSelector } from "./finish-selector";
import { PaintBrandSelector } from "./brand-selector";
import { ManufacturerSelector } from "./manufacturer-selector";
import { PaintTypeSelector } from "./paint-type-selector";
import { PaletteSelector } from "./palette-selector";
import { TagsInput } from "./tags-input";
import { GroundSelector } from "./ground-selector";
import { FormulaManager } from "./formula-manager";

interface BaseFormProps {
  onCancel: () => void;
  isSubmitting?: boolean;
  onStepChange?: (step: number) => void;
  onPaintTypeChange?: (paintTypeId: string) => void;
  currentStep?: number;
  onNextStep?: () => void;
  onPrevStep?: () => void;
}

interface CreateFormProps extends BaseFormProps {
  mode: "create";
  onSubmit: (data: PaintCreateFormData, formulas?: PaintFormula[]) => Promise<void>;
  defaultValues?: Partial<PaintCreateFormData>;
}

interface UpdateFormProps extends BaseFormProps {
  mode: "update";
  onSubmit: (data: PaintUpdateFormData, newFormulas?: PaintFormula[]) => Promise<void>;
  defaultValues?: Partial<PaintUpdateFormData>;
  existingFormulas?: PaintFormula[];
  paintId: string;
}

type PaintFormProps = CreateFormProps | UpdateFormProps;

const steps: FormStep[] = [
  { id: 1, name: "Informações Básicas", description: "Dados principais da tinta" },
  { id: 2, name: "Formulação", description: "Componentes e fórmulas (opcional)" },
  { id: 3, name: "Fundo da Tinta", description: "Selecione os fundos necessários" },
];

export interface PaintFormRef {
  nextStep: () => void;
  prevStep: () => void;
}

export const PaintForm = forwardRef<PaintFormRef, PaintFormProps>((props, ref) => {
  const { defaultValues, mode, onStepChange, onPaintTypeChange } = props;
  const [searchParams, setSearchParams] = useSearchParams();

  // Initialize state from URL parameters (for both create and update modes)
  const initialUrlState = deserializeUrlParamsToForm(searchParams);

  const [currentStep, setCurrentStep] = useState(props.currentStep || initialUrlState.currentStep);
  // In update mode, we don't pass existing formulas to the manager since it should only add new ones
  const [formulas, setFormulas] = useState<PaintFormula[]>(initialUrlState.formulas);

  // Sync currentStep from props
  useEffect(() => {
    if (props.currentStep !== undefined && props.currentStep !== currentStep) {
      setCurrentStep(props.currentStep);
    }
  }, [props.currentStep]);

  // Default values for create mode - merge URL params with defaults
  const createDefaults: PaintCreateFormData = {
    name: "",
    hex: "#000000",
    finish: "SOLID",
    paintBrandId: null,
    manufacturer: null,
    tags: [],
    palette: undefined,
    paletteOrder: undefined,
    paintTypeId: "",
    groundIds: [],
    ...defaultValues,
    ...(mode === "create" ? initialUrlState.formData : {}),
  };

  const form = useForm<PaintCreateFormData | PaintUpdateFormData>({
    resolver: zodResolver(mode === "create" ? paintCreateSchema : paintUpdateSchema),
    defaultValues: mode === "create" ? createDefaults : defaultValues,
    mode: "onTouched", // Validate on blur
  });

  // Debounced function to update URL parameters
  const debouncedUpdateUrl = useMemo(
    () =>
      debounce((formData: Partial<PaintCreateFormData>, formulas: PaintFormula[], step: number) => {
        if (mode === "create") {
          // Clean up empty/null/undefined values before serializing
          const cleanedData = Object.entries(formData).reduce((acc, [key, value]) => {
            // Keep the value if it's not null, undefined, or empty string
            if (value !== null && value !== undefined && value !== "") {
              acc[key as keyof PaintCreateFormData] = value;
            }
            return acc;
          }, {} as Partial<PaintCreateFormData>);

          const params = serializeFormToUrlParams(cleanedData, formulas, step);
          const currentParams = new URLSearchParams(searchParams);

          // Only update if params have actually changed
          if (params.toString() !== currentParams.toString()) {
            setSearchParams(params, { replace: true });
          }
        } else if (mode === "update") {
          // In update mode, only update the step parameter
          const params = new URLSearchParams(searchParams);
          params.set("step", step.toString());
          setSearchParams(params, { replace: true });
        }
      }, 1000),
    [mode, setSearchParams, searchParams],
  );

  // Cleanup debounced function on unmount
  useEffect(() => {
    return () => {
      debouncedUpdateUrl.cancel();
    };
  }, [debouncedUpdateUrl]);

  // Watch form values and update URL
  useEffect(() => {
    if (mode === "create") {
      const subscription = form.watch((values) => {
        debouncedUpdateUrl(values as Partial<PaintCreateFormData>, formulas, currentStep);
      });

      return () => subscription.unsubscribe();
    }
  }, [form, formulas, currentStep, debouncedUpdateUrl, mode]);

  // Watch paint type and paint brand selection for dual filtering
  const paintTypeId = form.watch("paintTypeId");
  const paintBrandId = form.watch("paintBrandId");

  // Get paint type details for ground requirements
  const { data: paintType } = usePaintType(paintTypeId || "", {
    enabled: !!paintTypeId,
  });

  // Get component items filtered by intersection of paint brand and paint type
  const { data: availableComponentsResponse } = useAvailableComponents({
    paintBrandId: paintBrandId || undefined,
    paintTypeId: paintTypeId || undefined,
    enabled: !!paintBrandId && !!paintTypeId, // Only fetch when both are selected
  });

  // Notify parent when paint type changes
  useEffect(() => {
    if (paintTypeId && onPaintTypeChange) {
      onPaintTypeChange(paintTypeId);
    }
  }, [paintTypeId, onPaintTypeChange]);

  // Sort component items returned from the backend (already filtered by intersection)
  const sortedComponentItems = React.useMemo(() => {
    if (!availableComponentsResponse?.data) return [];

    // Backend returns items that exist in BOTH paint brand AND paint type
    // Just sort them by unicode, then by name
    return [...availableComponentsResponse.data].sort((a, b) => {
      const aUnicode = a.uniCode || "";
      const bUnicode = b.uniCode || "";

      if (aUnicode && bUnicode) {
        return aUnicode.localeCompare(bUnicode);
      }
      if (aUnicode && !bUnicode) return -1;
      if (!aUnicode && bUnicode) return 1;

      // If both don't have unicode, sort by name
      return a.name.localeCompare(b.name, "pt-BR");
    });
  }, [availableComponentsResponse?.data]);

  const handleSubmit = async (data: PaintCreateFormData | PaintUpdateFormData) => {
    // For create mode, we'll handle formulas separately after paint creation
    // For update mode, formulas are already created and managed through the formula API

    if (mode === "create") {
      // Filter valid formulas to pass to the parent
      const validFormulas = formulas.filter((f) => f.components && f.components.length > 0 && f.components.some((c) => c.itemId && c.ratio > 0));

      await (props as CreateFormProps).onSubmit(data as PaintCreateFormData, validFormulas);
    } else {
      // In update mode, also handle new formulas if any
      const validFormulas = formulas.filter((f) => f.components && f.components.length > 0 && f.components.some((c) => c.itemId && c.ratio > 0));

      await (props as UpdateFormProps).onSubmit(data as PaintUpdateFormData, validFormulas);
    }
  };

  // Filter steps based on whether paint type needs ground
  const availableSteps = React.useMemo(() => {
    if (paintType?.data?.needGround) {
      return steps;
    }
    // If paint type doesn't need ground, exclude step 3
    return steps.filter((step) => step.id !== 3);
  }, [paintType?.data?.needGround]);

  const validateCurrentStep = useCallback(async (): Promise<boolean> => {
    switch (currentStep) {
      case 1:
        // Validate basic information fields
        const step1Valid = await form.trigger(["name", "paintTypeId", "paintBrandId", "finish", "hex"]);

        if (!step1Valid) {
          // Form will show field-specific errors automatically
          return false;
        }

        // Additional custom validation for name trimming
        const values = form.getValues();
        if (!values.name?.trim()) {
          form.setError("name", { type: "manual", message: "Nome da tinta não pode ser vazio" });
          return false;
        }

        return true;

      case 2:
        // Formula step is optional, always allow progression
        return true;

      case 3:
        // Ground selection validation
        if (paintType?.data?.needGround) {
          const groundValid = await form.trigger("groundIds");
          if (!groundValid) {
            return false;
          }

          const groundValues = form.getValues();
          if (!groundValues.groundIds || groundValues.groundIds.length === 0) {
            form.setError("groundIds", { type: "manual", message: "Selecione pelo menos um fundo" });
            return false;
          }
        }
        return true;

      default:
        return true;
    }
  }, [currentStep, form, paintType]);

  const nextStep = useCallback(async () => {
    const isValid = await validateCurrentStep();
    if (!isValid) {
      return;
    }

    const currentIndex = availableSteps.findIndex((step) => step.id === currentStep);
    if (currentIndex < availableSteps.length - 1) {
      const newStep = availableSteps[currentIndex + 1].id;
      setCurrentStep(newStep);
      onStepChange?.(newStep);

      // Immediately update URL with new step
      if (mode === "create") {
        const params = serializeFormToUrlParams(form.getValues(), formulas, newStep);
        setSearchParams(params, { replace: true });
      } else if (mode === "update") {
        const params = new URLSearchParams(searchParams);
        params.set("step", newStep.toString());
        setSearchParams(params, { replace: true });
      }
    }
  }, [validateCurrentStep, availableSteps, currentStep, onStepChange, mode, form, formulas, searchParams, setSearchParams]);

  const prevStep = useCallback(() => {
    const currentIndex = availableSteps.findIndex((step) => step.id === currentStep);
    if (currentIndex > 0) {
      const newStep = availableSteps[currentIndex - 1].id;
      setCurrentStep(newStep);
      onStepChange?.(newStep);

      // Immediately update URL with new step
      if (mode === "create") {
        const params = serializeFormToUrlParams(form.getValues(), formulas, newStep);
        setSearchParams(params, { replace: true });
      } else if (mode === "update") {
        const params = new URLSearchParams(searchParams);
        params.set("step", newStep.toString());
        setSearchParams(params, { replace: true });
      }
    }
  }, [availableSteps, currentStep, onStepChange, mode, form, formulas, searchParams, setSearchParams]);

  // Expose functions through ref
  useImperativeHandle(
    ref,
    () => ({
      nextStep,
      prevStep,
    }),
    [nextStep, prevStep],
  );

  return (
    <div className="h-full overflow-y-auto p-6">
      <Form {...form}>
        <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6">
          {/* Step Indicator */}
          <FormSteps steps={availableSteps} currentStep={currentStep} />

          {/* Step Content */}
          {currentStep === 1 && (
            <div className="space-y-6">
              <Card className="bg-transparent">
                <CardHeader>
                  <CardTitle>Informações Básicas</CardTitle>
                  <CardDescription>Preencha os dados principais da tinta</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-6">
                    {/* Name and Code in the same row */}
                    <div className="grid gap-6 md:grid-cols-3">
                      <div className="md:col-span-2">
                        <NameInput control={form.control} required />
                      </div>
                      <CodeInput control={form.control} />
                    </div>

                    {/* Layout with 2/3 and 1/3 columns */}
                    <div className="grid gap-6 md:grid-cols-3">
                      {/* Left column with form fields - takes 2/3 */}
                      <div className="md:col-span-2 space-y-4">
                        {/* All selectors in a single column */}
                        <PaintBrandSelector control={form.control} required />
                        <PaintTypeSelector control={form.control} required />
                        <FinishSelector control={form.control} required />
                        <ManufacturerSelector control={form.control} />
                        <PaletteSelector control={form.control} />
                      </div>

                      {/* Right column with color picker - takes 1/3 */}
                      <div className="flex flex-col">
                        <HexColorInput control={form.control} required />
                      </div>
                    </div>

                    {/* Tags field spanning full width */}
                    <TagsInput control={form.control} />
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {currentStep === 2 && (
            <div className="space-y-6">
              {/* Show existing formulas in update mode */}
              {props.mode === "update" && props.existingFormulas && props.existingFormulas.length > 0 && (
                <Card className="flex flex-col max-h-[400px]">
                  <CardHeader className="flex-shrink-0">
                    <CardTitle>Fórmulas Existentes</CardTitle>
                    <CardDescription>Estas são as fórmulas já cadastradas para esta tinta</CardDescription>
                  </CardHeader>
                  <CardContent className="flex-1 overflow-y-auto">
                    <div className="space-y-3">
                      {props.existingFormulas.map((formula, index) => (
                        <div key={formula.id} className="p-4 bg-muted/30 rounded-lg border border-border/50">
                          <h4 className="font-medium mb-2 text-sm">{formula.description || `Fórmula ${index + 1}`}</h4>
                          {formula.components && formula.components.length > 0 && (
                            <ul className="space-y-1 text-sm text-muted-foreground">
                              {formula.components.map((component) => (
                                <li key={component.id} className="pl-2">
                                  <span className="font-enhanced-unicode">•</span> {component.item?.name || component.itemId}: {component.ratio.toFixed(2)}%
                                </li>
                              ))}
                            </ul>
                          )}
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}

              <Card className="flex flex-col max-h-[600px]">
                <CardHeader className="flex-shrink-0">
                  <CardTitle>{props.mode === "update" ? "Adicionar Nova Fórmula" : "Formulação da Tinta"}</CardTitle>
                  <CardDescription>
                    {props.mode === "update" ? "Adicione uma nova fórmula para esta tinta (opcional)" : "Gerencie as fórmulas e componentes da tinta (opcional)"}
                  </CardDescription>
                </CardHeader>
                <CardContent className="flex-1 overflow-y-auto">
                  <FormulaManager
                    formulas={formulas}
                    onFormulasChange={(newFormulas) => {
                      setFormulas(newFormulas);
                      // Immediately update URL when formulas change
                      if (mode === "create") {
                        const params = serializeFormToUrlParams(form.getValues(), newFormulas, currentStep);
                        setSearchParams(params, { replace: true });
                      }
                      // In update mode, we don't need to sync formulas to URL since they're new formulas being added
                    }}
                    paintId={props.mode === "update" ? props.paintId : undefined}
                    availableItems={sortedComponentItems}
                  />
                </CardContent>
              </Card>
            </div>
          )}

          {currentStep === 3 && paintType?.data?.needGround && (
            <div className="space-y-6">
              <Card className="bg-transparent">
                <CardHeader>
                  <CardTitle>Seleção de Fundo</CardTitle>
                  <CardDescription>Selecione os fundos necessários para esta tinta</CardDescription>
                </CardHeader>
                <CardContent>
                  <GroundSelector control={form.control} required />
                </CardContent>
              </Card>
            </div>
          )}

          {/* Hidden submit button for external triggering */}
          <button type="submit" data-paint-form-submit style={{ display: "none" }} />
        </form>
      </Form>
    </div>
  );
});

PaintForm.displayName = "PaintForm";
