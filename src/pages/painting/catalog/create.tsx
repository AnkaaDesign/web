import { useNavigate, useSearchParams } from "react-router-dom";
import { PaintForm } from "@/components/painting/form/paint-form";
import type { PaintFormRef } from "@/components/painting/form/paint-form";
import { usePaintFormulaMutations, usePaintType } from "../../../hooks";
import { createPaint } from "../../../api-client";
import { routes, FAVORITE_PAGES } from "../../../constants";
import type { PaintCreateFormData, PaintFormulaCreateFormData } from "../../../schemas";
import type { PaintFormula } from "../../../types";
import { getDefaultFormValues } from "@/utils/url-form-state";
import { useState, useRef } from "react";
import { PageHeader } from "@/components/ui/page-header";
import { IconPalette, IconCheck, IconLoader2, IconArrowLeft, IconArrowRight } from "@tabler/icons-react";

export function CatalogCreatePage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [currentPaintTypeId, setCurrentPaintTypeId] = useState<string | null>(null);
  const paintFormRef = useRef<PaintFormRef>(null);

  // Get step from URL or default to 1
  const stepFromUrl = searchParams.get("step");
  const initialStep = stepFromUrl ? parseInt(stepFromUrl, 10) : 1;
  const [currentStep, setCurrentStep] = useState(initialStep);

  const formulaMutations = usePaintFormulaMutations();

  // Get default values from URL parameters
  const defaultValues = getDefaultFormValues(searchParams);

  // Fetch the current paint type being selected in the form
  const { data: currentPaintType } = usePaintType(currentPaintTypeId || "", {
    enabled: !!currentPaintTypeId,
  });

  // Determine available steps based on current paint type selection
  // Steps: 1-Info, 2-Preview, 3-Formula, 4-Ground (if needsGround)
  const needsGround = currentPaintType?.data?.needGround ?? false;
  const maxSteps = needsGround ? 4 : 3;

  const handleSubmit = async (data: PaintCreateFormData, formulas?: PaintFormula[], colorPreviewFile?: File) => {
    setIsSubmitting(true);
    try {
      // Create the paint (with file upload if available)
      const response = await createPaint(data, undefined, false, colorPreviewFile);
      const paintData = response?.data;
      const paintId = paintData?.id;

      let formulaCreationResults: { success: number; failed: number; errors: string[] } = {
        success: 0,
        failed: 0,
        errors: [],
      };

      if (paintId && formulas && formulas.length > 0) {
        // Create formulas for the newly created paint
        for (const formula of formulas) {
          const validComponents =
            formula.components?.filter((c) => {
              const weight = c.weightInGrams || c.weight || 0;
              return c.itemId && weight > 0;
            }) || [];

          if (validComponents.length === 0) {
            formulaCreationResults.failed++;
            formulaCreationResults.errors.push(`Fórmula "${formula.description || "Sem descrição"}" não tem componentes válidos`);
            continue;
          }

          const formulaData: PaintFormulaCreateFormData = {
            paintId: paintId,
            description: formula.description || "Fórmula Principal",
            components: validComponents.map((c) => ({
              itemId: c.itemId,
              weightInGrams: c.weightInGrams || c.weight || 0,
            })),
          };

          try {
            await formulaMutations.createAsync(formulaData);
            formulaCreationResults.success++;
          } catch (error: any) {
            formulaCreationResults.failed++;
            const errorMessage = error.message || "Erro desconhecido";
            formulaCreationResults.errors.push(`Fórmula "${formula.description || "Sem descrição"}": ${errorMessage}`);
          }
        }
      }

      navigate(routes.painting.catalog.root, { replace: true });
    } catch (error) {
      if (process.env.NODE_ENV !== 'production') {
        console.error("[CreatePage] Error in handleSubmit:", error);
      }
      // Error is handled by the API client
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCancel = () => {
    // Clear URL parameters when cancelling
    navigate(routes.painting.catalog.root, { replace: true });
  };

  // Handle step navigation
  const handleNextStep = () => {
    // Trigger the form's internal next step which handles validation
    paintFormRef.current?.nextStep();
  };

  const handlePrevStep = () => {
    // Trigger the form's internal prev step
    paintFormRef.current?.prevStep();
  };

  // Navigation actions for the PageHeader
  const getNavigationActions = () => {
    const actions = [];
    const isFirstStep = currentStep === 1;
    const isLastStep = currentStep === maxSteps;

    // Cancel button
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
        onClick: handlePrevStep,
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
        onClick: handleNextStep,
        variant: "default" as const,
        disabled: isSubmitting,
        iconPosition: "right" as const,
      });
    } else {
      actions.push({
        key: "submit",
        label: "Cadastrar",
        icon: isSubmitting ? IconLoader2 : IconCheck,
        onClick: () => {
          // Trigger form submission
          const submitButton = document.querySelector("[data-paint-form-submit]") as HTMLButtonElement;
          submitButton?.click();
        },
        variant: "default" as const,
        disabled: isSubmitting,
        loading: isSubmitting,
      });
    }

    return actions;
  };

  return (
    <div className="h-full flex flex-col gap-4 bg-background px-4 pt-4">
      <PageHeader
        title="Cadastrar Tinta"
        icon={IconPalette}
        favoritePage={FAVORITE_PAGES.PINTURA_CATALOGO_CADASTRAR}
        breadcrumbs={[
          { label: "Início", href: routes.home },
          { label: "Pintura", href: routes.painting.root },
          { label: "Catálogo", href: routes.painting.catalog.root },
          { label: "Cadastrar" },
        ]}
        actions={getNavigationActions()}
        className="flex-shrink-0"
      />
      <div className="flex-1 overflow-y-auto pb-6">
        <PaintForm
          ref={paintFormRef}
          mode="create"
          onSubmit={handleSubmit}
          onCancel={handleCancel}
          isSubmitting={isSubmitting}
          defaultValues={defaultValues}
          onStepChange={setCurrentStep}
          onPaintTypeChange={setCurrentPaintTypeId}
          currentStep={currentStep}
        />
      </div>
    </div>
  );
}
