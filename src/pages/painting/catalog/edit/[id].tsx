import { useNavigate, useParams } from "react-router-dom";
import { PaintForm } from "@/components/painting/form/paint-form";
import type { PaintFormRef } from "@/components/painting/form/paint-form";
import { usePaint, usePaintFormulaMutations, usePaintType } from "../../../../hooks";
import { updatePaint } from "../../../../api-client";
import { routes } from "../../../../constants";
import { mapPaintToFormData } from "../../../../schemas";
import type { PaintUpdateFormData, PaintFormulaCreateFormData } from "../../../../schemas";
import type { PaintFormula } from "../../../../types";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { PageHeader } from "@/components/ui/page-header";
import { IconAlertCircle, IconPalette, IconCheck, IconLoader2, IconArrowLeft, IconArrowRight } from "@tabler/icons-react";
import { FAVORITE_PAGES } from "../../../../constants";
import { useState, useRef } from "react";

export default function CatalogEditPage() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const formulaMutations = usePaintFormulaMutations();
  const [currentStep, setCurrentStep] = useState(1);
  const [currentPaintTypeId, setCurrentPaintTypeId] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const paintFormRef = useRef<PaintFormRef>(null);

  const {
    data: response,
    isLoading,
    error,
  } = usePaint(id!, {
    include: {
      paintType: true,
      formulas: {
        include: {
          components: {
            include: {
              item: true,
            },
          },
        },
      },
      paintGrounds: {
        include: {
          groundPaint: true,
        },
      },
    },
    enabled: !!id,
  });

  // Fetch the current paint type being selected in the form
  const { data: currentPaintType } = usePaintType(currentPaintTypeId || response?.data?.paintTypeId || "", {
    enabled: !!(currentPaintTypeId || response?.data?.paintTypeId),
  });

  const handleSubmit = async (data: PaintUpdateFormData, newFormulas?: PaintFormula[], colorPreviewFile?: File) => {
    if (!id) return;

    setIsSubmitting(true);
    try {
      // Update the paint data (with file upload if available)
      await updatePaint(id, data, undefined, colorPreviewFile);

      let formulaCreationResults: { success: number; failed: number; errors: string[] } = {
        success: 0,
        failed: 0,
        errors: [],
      };

      // If there are new formulas, create them
      if (newFormulas && newFormulas.length > 0) {
        for (const formula of newFormulas) {
          const validComponents =
            formula.components?.filter((c) => {
              const weightInGrams = c.weightInGrams || 0;
              return c.itemId && weightInGrams > 0;
            }) ?? [];

          if (validComponents.length === 0) {
            formulaCreationResults.failed++;
            formulaCreationResults.errors.push(`Fórmula "${formula.description || "Sem descrição"}" não tem componentes válidos`);
            continue;
          }

          const formulaData: PaintFormulaCreateFormData = {
            paintId: id,
            description: formula.description || "Fórmula Principal",
            components: validComponents.map((c) => ({
              itemId: c.itemId,
              weightInGrams: c.weightInGrams || 0,
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

      navigate(routes.painting.catalog.details(id));
    } catch (error) {
      // Error is handled by the API client
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCancel = () => {
    navigate(routes.painting.catalog.root);
  };

  // Determine available steps based on current paint type selection
  // Steps: 1=Basic Info, 2=Preview, 3=Formula, 4=Ground (optional)
  const needsGround = currentPaintType?.data?.needGround ?? response?.data?.paintType?.needGround;
  const maxSteps = needsGround ? 4 : 3;

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
    } else if (response?.data) {
      actions.push({
        key: "submit",
        label: "Salvar Alterações",
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

  if (isLoading) {
    return (
      <div className="h-full flex flex-col gap-4 bg-background px-4 pt-4">
        <PageHeader
          title="Carregando..."
          icon={IconPalette}
          favoritePage={FAVORITE_PAGES.PINTURA_CATALOGO_EDITAR}
          breadcrumbs={[
            { label: "Início", href: routes.home },
            { label: "Pintura", href: routes.painting.root },
            { label: "Catálogo", href: routes.painting.catalog.root },
            { label: "Carregando..." },
            { label: "Editar" },
          ]}
          className="flex-shrink-0"
        />
        <div className="flex-1 overflow-y-auto pb-6">
          <div className="space-y-4">
            <Skeleton className="h-64 w-full" />
            <Skeleton className="h-32 w-full" />
          </div>
        </div>
      </div>
    );
  }

  if (error || !response?.data) {
    return (
      <div className="h-full flex flex-col gap-4 bg-background px-4 pt-4">
        <PageHeader
          title="Erro ao carregar tinta"
          icon={IconPalette}
          favoritePage={FAVORITE_PAGES.PINTURA_CATALOGO_EDITAR}
          breadcrumbs={[
            { label: "Início", href: routes.home },
            { label: "Pintura", href: routes.painting.root },
            { label: "Catálogo", href: routes.painting.catalog.root },
            { label: "Editar" },
          ]}
          className="flex-shrink-0"
        />
        <div className="flex-1 overflow-y-auto pb-6">
          <Alert variant="destructive">
            <IconAlertCircle className="h-4 w-4" />
            <AlertTitle>Erro ao carregar tinta</AlertTitle>
            <AlertDescription>{error?.message || "Tinta não encontrada"}</AlertDescription>
          </Alert>
        </div>
      </div>
    );
  }

  const paint = response.data;
  const defaultValues = mapPaintToFormData(paint);

  // Extract ground paints for the GroundSelector's initialPaints
  const initialGrounds = paint.paintGrounds?.map((pg) => pg.groundPaint).filter(Boolean) || [];

  return (
    <div className="h-full flex flex-col gap-4 bg-background px-4 pt-4">
      <PageHeader
        title={`Editar ${paint.name}`}
        icon={IconPalette}
        favoritePage={FAVORITE_PAGES.PINTURA_CATALOGO_EDITAR}
        breadcrumbs={[
          { label: "Início", href: routes.home },
          { label: "Pintura", href: routes.painting.root },
          { label: "Catálogo", href: routes.painting.catalog.root },
          { label: paint.name, href: routes.painting.catalog.details(id!) },
          { label: "Editar" },
        ]}
        actions={getNavigationActions()}
        className="flex-shrink-0"
      />
      <div className="flex-1 overflow-y-auto pb-6">
        <PaintForm
          ref={paintFormRef}
          key={paint.id} // Force re-initialization when paint changes
          mode="update"
          onSubmit={handleSubmit}
          onCancel={handleCancel}
          isSubmitting={isSubmitting}
          defaultValues={defaultValues}
          existingFormulas={paint.formulas}
          paintId={paint.id}
          currentStep={currentStep}
          onStepChange={setCurrentStep}
          onPaintTypeChange={setCurrentPaintTypeId}
          initialGrounds={initialGrounds}
        />
      </div>
    </div>
  );
}
