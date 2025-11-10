import { useParams, useNavigate, Navigate } from "react-router-dom";
import { usePaintFormula, usePaintFormulaMutations } from "../../../../hooks";
import { FormulaManager } from "@/components/painting/formula/formula-manager";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { IconAlertCircle, IconArrowLeft, IconDeviceFloppy } from "@tabler/icons-react";
import { routes } from "../../../../constants";
import { useItems } from "../../../../hooks";

export default function FormulaEdit() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { updateAsync: updateFormula, isUpdating } = usePaintFormulaMutations();

  const {
    data: formulaResponse,
    isLoading: isLoadingFormula,
    error: formulaError,
  } = usePaintFormula(id!, {
    include: {
      components: {
        include: {
          item: {
            include: {
              measures: true,
            },
          },
        },
      },
      paint: {
        include: {
          type: true,
        },
      },
    },

    enabled: !!id,
  });

  const { data: itemsResponse, isLoading: isLoadingItems } = useItems({
    where: {
      measures: {
        some: {
          AND: [{ type: "WEIGHT" }, { value: { gt: 0 } }],
        },
      },
    },
    include: {
      measures: true,
      brand: true,
      category: true,
    },
  });

  const isLoading = isLoadingFormula || isLoadingItems;
  const availableItems = itemsResponse?.data || [];

  if (isLoading) {
    return (
      <div className="container mx-auto p-6 space-y-6">
        <Skeleton className="h-10 w-48" />
        <Skeleton className="h-96 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (formulaError || !formulaResponse?.data) {
    return (
      <div className="container mx-auto p-6">
        <Alert variant="destructive">
          <IconAlertCircle className="h-4 w-4" />
          <AlertDescription>{formulaError?.message || "Erro ao carregar fórmula"}</AlertDescription>
        </Alert>
      </div>
    );
  }

  const formula = formulaResponse.data;

  // Redirect to paint catalog edit since formulas are now managed there
  if (formula.paintId) {
    return <Navigate to={routes.painting.catalog.edit(formula.paintId) + "?tab=formulation"} replace />;
  }

  const handleUpdateFormula = async (updatedData: any) => {
    try {
      await updateFormula({
        id: formula.id,
        data: {
          description: updatedData.description,
        },
      });
      navigate(routes.painting.formulas.details(formula.id));
    } catch (error) {
      // Error handled by API client
    }
  };

  const handleStartProduction = (_productionData: any) => {
    // Navigate to production creation with the formula data
    navigate(routes.painting.productions.root);
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
            <IconArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold">Editar Fórmula</h1>
            <p className="text-muted-foreground">{formula.paint?.name}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => navigate(routes.painting.formulas.details(formula.id))}>
            Cancelar
          </Button>
          <Button onClick={() => handleUpdateFormula({ description: formula.description })} disabled={isUpdating}>
            <IconDeviceFloppy className="h-4 w-4 mr-2" />
            Salvar Alterações
          </Button>
        </div>
      </div>

      {/* Formula Manager */}
      <FormulaManager
        formula={formula}
        availableItems={availableItems}
        onUpdateFormula={handleUpdateFormula}
        onStartProduction={handleStartProduction}
        onAddComponent={(_componentData) => {
          // Add component not implemented
        }}
        onUpdateComponent={(_componentId, _componentData) => {
          // Update component not implemented
        }}
        onRemoveComponent={(_componentId) => {
          // Remove component not implemented
        }}
      />
    </div>
  );
}
