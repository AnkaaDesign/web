import { useNavigate } from "react-router-dom";
import { IconFlask, IconPlus, IconCurrencyDollar, IconWeight, IconBrush, IconAlertCircle, IconList } from "@tabler/icons-react";

import type { Item } from "../../../../../types";
import { formatCurrency } from "../../../../../utils";
import { routes } from "../../../../../constants";
import { usePaintFormulas, useCanViewPrices } from "../../../../../hooks";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

/** Body of the legacy PaintFormulasCard (without the Card chrome). Self-fetches the formulas
 *  that use this item as a component. The DetailPage section provides the title; the header
 *  action buttons are folded into the body's top row. */
export function PaintFormulasSection({ item }: { item: Item }) {
  const navigate = useNavigate();
  const canViewPrices = useCanViewPrices();

  const {
    data: formulasResponse,
    isLoading,
    error,
  } = usePaintFormulas({
    where: { components: { some: { itemId: item.id } } },
    include: {
      paint: true,
      components: { where: { itemId: item.id }, include: { item: true } },
    },
  });

  const formulas = formulasResponse?.data || [];
  const hasFormulas = formulas.length > 0;

  const handleCreateFormula = () => {
    navigate(routes.painting.catalog.create + `?step=2`);
  };

  const handleDisplayAll = () => {
    navigate(routes.painting.formulas.root);
  };

  const handleFormulaClick = (formula: any) => {
    if (formula.paintId) {
      navigate(routes.painting.catalog.details(formula.paintId));
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-20 bg-muted/50 rounded-lg animate-pulse" />
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center">
        <div className="text-center py-8 space-y-4">
          <IconAlertCircle className="h-12 w-12 mx-auto text-destructive/50" />
          <div className="space-y-2">
            <p className="text-sm font-medium text-destructive">Erro ao carregar fórmulas</p>
            <p className="text-xs text-muted-foreground">{error.message || "Não foi possível carregar as fórmulas que utilizam este item"}</p>
          </div>
        </div>
      </div>
    );
  }

  // No formulas use this item → return null so the base drops the whole "Fórmulas de Tinta" card.
  if (!hasFormulas) return null;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-end gap-2">
        <Button variant="outline" size="sm" onClick={handleDisplayAll}>
          <IconList className="h-4 w-4 mr-2" />
          Ver Todas
        </Button>
        <Button variant="outline" size="sm" onClick={handleCreateFormula}>
          <IconPlus className="h-4 w-4 mr-2" />
          Nova Fórmula
        </Button>
      </div>

      <div className="space-y-3">
        {formulas.map((formula) => {
            const componentInFormula = formula.components?.find((c) => c.itemId === item.id);
            return (
              <div
                key={formula.id}
                className="bg-muted/50 rounded-lg p-4 hover:bg-muted transition-colors cursor-pointer"
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
                        {canViewPrices && (
                          <div className="flex items-center gap-1 text-muted-foreground">
                            <IconCurrencyDollar className="h-4 w-4" />
                            <span>{formatCurrency(formula.pricePerLiter)}/L</span>
                          </div>
                        )}
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
            );
          })}
        </div>
    </div>
  );
}
