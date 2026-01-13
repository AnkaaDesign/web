import { useNavigate } from "react-router-dom";
import { IconFlask, IconPlus, IconCurrencyDollar, IconWeight, IconCalculator, IconAlertCircle, IconList } from "@tabler/icons-react";

import type { Paint } from "../../../../types";
import { formatCurrency } from "../../../../utils";
import { routes, SECTOR_PRIVILEGES } from "../../../../constants";
import { useAuth } from "@/contexts/auth-context";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { FormulaCardSkeleton } from "@/components/ui/formula-card-skeleton";
import { cn } from "@/lib/utils";

interface PaintFormulasCardProps {
  paint: Paint;
  className?: string;
  isLoading?: boolean;
  error?: Error | null;
  onRetry?: () => void;
}

export function PaintFormulasCard({ paint, className, isLoading = false, error = null, onRetry }: PaintFormulasCardProps) {
  const navigate = useNavigate();
  const { user } = useAuth();

  // Hide prices for warehouse users
  const isWarehouseUser = user?.sector?.privileges === SECTOR_PRIVILEGES.WAREHOUSE;
  const showPrices = !isWarehouseUser;

  const handleCreateFormula = () => {
    // Navigate to paint edit page starting at step 2 (formulation)
    navigate(routes.painting.catalog.edit(paint.id) + `?step=2`);
  };

  const handleFormulaClick = (formulaId: string) => {
    // Navigate to formula calculator page
    navigate(routes.painting.catalog.formulaDetails(paint.id, formulaId));
  };

  const hasFormulas = paint.formulas && paint.formulas.length > 0;

  // Show loading skeleton
  if (isLoading) {
    return <FormulaCardSkeleton className={className} itemCount={3} />;
  }

  // Show error state
  if (error) {
    return (
      <Card className={cn("shadow-sm border border-border flex flex-col", className)}>
        <CardHeader className="pb-6 flex-shrink-0">
          <CardTitle className="flex items-center gap-2">
          <IconFlask className="h-5 w-5 text-muted-foreground" />
          Fórmulas
        </CardTitle>
        </CardHeader>
        <CardContent className="pt-0 flex-1 flex items-center justify-center">
          <div className="text-center py-8 space-y-4">
            <IconAlertCircle className="h-12 w-12 mx-auto text-destructive/50" />
            <div className="space-y-2">
              <p className="text-sm font-medium text-destructive">Erro ao carregar fórmulas</p>
              <p className="text-xs text-muted-foreground">{error.message || "Não foi possível carregar as fórmulas desta tinta"}</p>
            </div>
            {onRetry && (
              <Button variant="outline" size="sm" onClick={onRetry} className="transition-all duration-200">
                Tentar Novamente
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={cn("shadow-sm border border-border flex flex-col", className)}>
      <CardHeader className="pb-6 flex-shrink-0">
        <CardTitle className="flex items-center gap-2">
          <IconFlask className="h-5 w-5 text-muted-foreground" />
          Fórmulas ({paint.formulas?.length || 0})
        </CardTitle>
      </CardHeader>

      <CardContent className="pt-0 space-y-4 flex-1 overflow-y-auto">
        {hasFormulas ? (
          <>
            {paint.formulas!.map((formula, index) => (
              <div key={formula.id}>
                <div
                  className="bg-muted/50 rounded-lg p-4 hover:bg-muted/70 transition-all duration-200 cursor-pointer"
                  onClick={() => handleFormulaClick(formula.id)}
                >
                  <div className="flex items-start justify-between">
                    <div className="space-y-2 flex-1">
                      <h4 className="font-medium">{formula.description}</h4>
                      <div className="flex flex-wrap gap-4 text-sm">
                        {showPrices && (
                          <div className="flex items-center gap-1 text-muted-foreground">
                            <IconCurrencyDollar className="h-4 w-4" />
                            <span>{formatCurrency(formula.pricePerLiter)}/L</span>
                          </div>
                        )}
                        <div className="flex items-center gap-1 text-muted-foreground">
                          <IconWeight className="h-4 w-4" />
                          <span>{Number(formula.density).toFixed(3)} g/ml</span>
                        </div>
                        <div className="flex items-center gap-1 text-muted-foreground">
                          <IconFlask className="h-4 w-4" />
                          <span>{formula.components?.length || 0} componentes</span>
                        </div>
                      </div>
                    </div>
                    {formula.components && formula.components.length > 0 && (
                      <Badge variant="outline" className="ml-2">
                        <IconCalculator className="h-3 w-3 mr-1" />
                        Calculadora
                      </Badge>
                    )}
                  </div>
                </div>
                {index < paint.formulas!.length - 1 && <Separator className="my-3" />}
              </div>
            ))}

            <div className="pt-2 flex gap-2">
              <Button variant="outline" size="sm" onClick={() => navigate(routes.painting.catalog.formulas(paint.id))} className="flex-1">
                <IconList className="h-4 w-4 mr-2" />
                Mostrar Todos
              </Button>
              <Button variant="outline" size="sm" onClick={handleCreateFormula} className="flex-1">
                <IconPlus className="h-4 w-4 mr-2" />
                Nova Fórmula
              </Button>
            </div>
          </>
        ) : (
          <div className="text-center py-8 space-y-4">
            <div className="animate-in fade-in-50 duration-300">
              <IconFlask className="h-12 w-12 mx-auto text-muted-foreground/50 mb-3" />
              <div className="space-y-2">
                <p className="text-sm font-medium text-muted-foreground">Nenhuma fórmula cadastrada</p>
                <p className="text-xs text-muted-foreground">Crie a primeira fórmula para esta tinta e comece a produzir</p>
              </div>
            </div>
            <div className="flex gap-2 justify-center">
              <Button variant="outline" size="sm" onClick={() => navigate(routes.painting.catalog.formulas(paint.id))}>
                <IconList className="h-4 w-4 mr-2" />
                Mostrar Todos
              </Button>
              <Button variant="outline" size="sm" onClick={handleCreateFormula}>
                <IconPlus className="h-4 w-4 mr-2" />
                Criar Primeira Fórmula
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
