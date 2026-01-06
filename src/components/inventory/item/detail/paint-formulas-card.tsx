import { useNavigate } from "react-router-dom";
import { IconFlask, IconPlus, IconCurrencyDollar, IconWeight, IconBrush, IconAlertCircle, IconList } from "@tabler/icons-react";

import type { Item } from "../../../../types";
import { formatCurrency } from "../../../../utils";
import { routes } from "../../../../constants";
import { usePaintFormulas } from "../../../../hooks";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";

interface PaintFormulasCardProps {
  item: Item;
  className?: string;
}

export function PaintFormulasCard({ item, className }: PaintFormulasCardProps) {
  const navigate = useNavigate();

  // Fetch all formulas that use this item as a component
  const {
    data: formulasResponse,
    isLoading,
    error,
  } = usePaintFormulas({
    where: {
      components: {
        some: {
          itemId: item.id,
        },
      },
    },
    include: {
      paint: true,
      components: {
        where: {
          itemId: item.id,
        },
        include: {
          item: true,
        },
      },
    },
  });

  const formulas = formulasResponse?.data || [];
  const hasFormulas = formulas.length > 0;

  const handleCreateFormula = () => {
    // Navigate to paint catalog to create a new formula starting at step 2 (formulation)
    navigate(routes.painting.catalog.create + `?step=2`);
  };

  const handleDisplayAll = () => {
    // Navigate to the formulas list page
    navigate(routes.painting.formulas.root);
  };

  const handleFormulaClick = (formula: any) => {
    // Navigate to paint details page
    if (formula.paintId) {
      navigate(routes.painting.catalog.details(formula.paintId));
    }
  };

  // Show loading skeleton
  if (isLoading) {
    return (
      <Card className={cn("shadow-sm border border-border flex flex-col", className)}>
        <CardHeader className="pb-6 flex-shrink-0">
          <CardTitle className="flex items-center gap-2">
          <IconFlask className="h-5 w-5 text-muted-foreground" />
          Fórmulas de Tinta
        </CardTitle>
        </CardHeader>
        <CardContent className="pt-0 flex-1">
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-20 bg-muted/50 rounded-lg animate-pulse" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  // Show error state
  if (error) {
    return (
      <Card className={cn("shadow-sm border border-border flex flex-col", className)}>
        <CardHeader className="pb-6 flex-shrink-0">
          <CardTitle className="flex items-center gap-2">
          <IconFlask className="h-5 w-5 text-muted-foreground" />
          Fórmulas de Tinta
        </CardTitle>
        </CardHeader>
        <CardContent className="pt-0 flex-1 flex items-center justify-center">
          <div className="text-center py-8 space-y-4">
            <IconAlertCircle className="h-12 w-12 mx-auto text-destructive/50" />
            <div className="space-y-2">
              <p className="text-sm font-medium text-destructive">Erro ao carregar fórmulas</p>
              <p className="text-xs text-muted-foreground">{error.message || "Não foi possível carregar as fórmulas que utilizam este item"}</p>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={cn("shadow-sm border border-border flex flex-col", className)}>
      <CardHeader className="pb-6 flex-shrink-0">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
          <IconFlask className="h-5 w-5 text-muted-foreground" />
          Fórmulas de Tinta ({formulas.length})
        </CardTitle>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={handleDisplayAll}>
              <IconList className="h-4 w-4 mr-2" />
              Ver Todas
            </Button>
            <Button variant="outline" size="sm" onClick={handleCreateFormula}>
              <IconPlus className="h-4 w-4 mr-2" />
              Nova Fórmula
            </Button>
          </div>
        </div>
      </CardHeader>

      <CardContent className="pt-0 space-y-4 flex-1 overflow-y-auto">
        {hasFormulas ? (
          <>
            {formulas.map((formula, index) => {
              const componentInFormula = formula.components?.find((c) => c.itemId === item.id);

              return (
                <div key={formula.id}>
                  <div
                    className="bg-muted/50 rounded-lg p-4 hover:bg-muted/70 transition-all duration-200 cursor-pointer transform hover:scale-[1.02]"
                    onClick={() => handleFormulaClick(formula)}
                  >
                    <div className="flex items-start justify-between">
                      <div className="space-y-2 flex-1">
                        <div className="flex items-center gap-2">
                          <IconBrush className="h-4 w-4 text-primary" />
                          <h4 className="font-medium">{formula.paint?.name || "Tinta sem nome"}</h4>
                          {formula.paint?.name && (
                            <Badge variant="outline" className="text-xs">
                              {formula.paint.name}
                            </Badge>
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground">{formula.description}</p>
                        <div className="flex flex-wrap gap-4 text-sm">
                          <div className="flex items-center gap-1 text-muted-foreground">
                            <IconCurrencyDollar className="h-4 w-4" />
                            <span>{formatCurrency(formula.pricePerLiter)}/L</span>
                          </div>
                          <div className="flex items-center gap-1 text-muted-foreground">
                            <IconWeight className="h-4 w-4" />
                            <span>{Number(formula.density).toFixed(3)} g/ml</span>
                          </div>
                          {componentInFormula && (
                            <div className="flex items-center gap-1 text-muted-foreground">
                              <IconFlask className="h-4 w-4" />
                              <span>Proporção: {componentInFormula.ratio?.toFixed(1)}%</span>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                  {index < formulas.length - 1 && <Separator className="my-3" />}
                </div>
              );
            })}
          </>
        ) : (
          <div className="text-center py-8 space-y-4">
            <div className="animate-in fade-in-50 duration-300">
              <IconFlask className="h-12 w-12 mx-auto text-muted-foreground/50 mb-3" />
              <div className="space-y-2">
                <p className="text-sm font-medium text-muted-foreground">Nenhuma fórmula utiliza este item</p>
                <p className="text-xs text-muted-foreground">Este item ainda não é componente de nenhuma fórmula de tinta</p>
              </div>
            </div>
            <div className="flex gap-2 justify-center">
              <Button variant="outline" size="sm" onClick={handleDisplayAll}>
                <IconList className="h-4 w-4 mr-2" />
                Ver Todas Fórmulas
              </Button>
              <Button variant="outline" size="sm" onClick={handleCreateFormula}>
                <IconPlus className="h-4 w-4 mr-2" />
                Criar Nova Fórmula
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
