import { useParams, Navigate, useNavigate } from "react-router-dom";
import { usePaintFormula, usePaintProductionMutations } from "../../../../hooks";
import { FormulaCalculator } from "@/components/painting/formula/formula-calculator";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { LoadingPage } from "@/components/navigation/loading-page";
import { ErrorCard } from "@/components/ui/error-card";
import { IconFlask, IconRefresh, IconEdit } from "@tabler/icons-react";
import { routes, CHANGE_LOG_ENTITY_TYPE } from "../../../../constants";
import { ChangelogHistory } from "@/components/ui/changelog-history";
import { formatCurrency } from "../../../../utils";
import { useAuth } from "@/contexts/auth-context";
import { canEditPaints } from "@/utils/permissions/entity-permissions";
import { toast } from "sonner";
import { PAGE_SPACING } from "@/lib/layout-constants";

export default function FormulaDetails() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const canEdit = canEditPaints(user);
  const { create: createProduction } = usePaintProductionMutations();

  const {
    data: formulaResponse,
    isLoading,
    error,
    refetch,
  } = usePaintFormula(id!, {
    include: {
      components: {
        include: {
          item: true,
        },
      },
      paint: true,
    },
    enabled: !!id,
  });

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <LoadingPage />
      </div>
    );
  }

  if (error || !formulaResponse?.data) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <ErrorCard
          title="Fórmula não encontrada"
          description="A fórmula que você está procurando não existe ou foi excluída."
          onRetry={() => navigate(routes.painting.formulas.root)}
        />
      </div>
    );
  }

  const formula = formulaResponse.data;

  // Redirect to the correct formula details page in the catalog structure
  if (formula && formula.paintId) {
    return <Navigate to={routes.painting.catalog.formulaDetails(formula.paintId, formula.id)} replace />;
  }

  const handleRefresh = () => {
    refetch();
  };

  const handleEdit = () => {
    navigate(routes.painting.formulas.edit(formula.id));
  };

  const handleStartProduction = async (productionData: { formulaId: string; weight: number }) => {
    try {
      // Use the actual formula density for accurate weight-to-volume conversion
      const density = formula.density || 1.0; // g/ml
      const volumeLiters = productionData.weight / (density * 1000); // Convert grams to liters using actual density
      await createProduction({
        formulaId: productionData.formulaId,
        volumeLiters: volumeLiters,
      });
      navigate(routes.painting.productions.root);
    } catch (error) {
      if (process.env.NODE_ENV !== 'production') {
        console.error("Error creating production:", error);
      }
    }
  };

  return (
    <div className="h-full flex flex-col px-4 pt-4">
      <PageHeader
        variant="detail"
        title={formula.description || (formula.paint?.name ? `Fórmula de ${formula.paint.name}` : "Fórmula de Tinta")}
        actions={[
        {
          key: "refresh",
          label: "Atualizar",
          icon: IconRefresh,
          onClick: handleRefresh,
        },
        ...(canEdit ? [{
          key: "edit",
          label: "Editar",
          icon: IconEdit,
          onClick: handleEdit,
        }] : []),
      ]}
      breadcrumbs={[
        { label: "Início", href: routes.home },
        { label: "Pintura", href: routes.painting.root },
        { label: "Fórmulas", href: routes.painting.formulas.root },
        { label: formula.description || "Fórmula" },
      ]}
      />
      <div className="flex-1 overflow-y-auto pb-6">
        {/* Calculator and Formula Info Section */}
        <div className="mt-4 animate-in fade-in-50 duration-700">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {/* Calculator Section */}
            <div className="lg:col-span-2">
              <Card>
                <CardContent className="pt-6">
                  <FormulaCalculator formula={formula} onStartProduction={handleStartProduction} />
                </CardContent>
              </Card>
            </div>

            {/* Formula Details Card */}
            <Card className="lg:col-span-1 bg-muted/30">
              <CardHeader>
                <CardTitle>Especificações</CardTitle>
                <CardDescription>Propriedades da fórmula</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-1">
                  <p className="text-sm font-medium text-muted-foreground">Densidade</p>
                  <p className="text-lg font-semibold">{formula.density} g/ml</p>
                </div>
                <div className="space-y-1">
                  <p className="text-sm font-medium text-muted-foreground">Preço por Litro</p>
                  <p className="text-lg font-semibold">
                    {(() => {
                      return formatCurrency(formula.pricePerLiter);
                    })()}
                  </p>
                </div>
                <div className="space-y-1">
                  <p className="text-sm font-medium text-muted-foreground">Descrição</p>
                  <p className="text-sm">{formula.description || "Sem descrição"}</p>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Changelog Section */}
        <div className="mt-4 animate-in fade-in-50 duration-900">
          <Card>
            <CardHeader>
              <CardTitle>Histórico de Alterações</CardTitle>
              <CardDescription>Acompanhe todas as modificações realizadas nesta fórmula</CardDescription>
            </CardHeader>
            <CardContent>
              <ChangelogHistory
                entityType={CHANGE_LOG_ENTITY_TYPE.PAINT_FORMULA}
                entityId={formula.id}
                entityName={formula.paint?.name || "Fórmula"}
                entityCreatedAt={formula.createdAt}
                className="h-[400px]"
              />
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
