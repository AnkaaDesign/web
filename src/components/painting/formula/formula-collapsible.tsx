import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { IconChevronDown, IconCurrencyReal, IconDroplet, IconFlask } from "@tabler/icons-react";
import { formatCurrency, formatNumberWithDecimals } from "../../../utils";
import { cn } from "@/lib/utils";
import type { PaintFormula } from "../../../types";

interface FormulaCollapsibleProps {
  formula: PaintFormula;
  isOpen?: boolean;
  onOpenChange?: (isOpen: boolean) => void;
  className?: string;
}

export function FormulaCollapsible({ formula, isOpen = false, onOpenChange, className }: FormulaCollapsibleProps) {
  const hasComponents = formula.components && formula.components.length > 0;
  const componentsCount = formula.components?.length || 0;
  const totalRatio = formula.components?.reduce((sum, comp) => sum + (comp.ratio || 0), 0) || 0;

  return (
    <Collapsible open={isOpen} onOpenChange={onOpenChange} className={cn("w-full", className)}>
      <CollapsibleTrigger className="w-full">
        <div className="flex items-center justify-between p-4 hover:bg-muted/50 rounded-lg transition-all duration-200 border-2 border-transparent hover:border-red-500">
          <div className="flex items-center gap-3">
            <IconFlask className="h-5 w-5 text-primary" />
            <div className="flex flex-col items-start">
              <span className="font-medium text-left">{formula.description || "Fórmula sem descrição"}</span>
              <div className="flex items-center gap-2 mt-1">
                {hasComponents && (
                  <Badge variant="secondary" className="text-xs">
                    {componentsCount} {componentsCount === 1 ? "componente" : "componentes"}
                  </Badge>
                )}
                {formula.pricePerLiter && Number(formula.pricePerLiter) > 0 && (
                  <Badge variant="outline" className="text-xs">
                    {formatCurrency(Number(formula.pricePerLiter))}/L
                  </Badge>
                )}
                {formula.density && Number(formula.density) > 0 && (
                  <Badge variant="outline" className="text-xs">
                    {formatNumberWithDecimals(Number(formula.density), 3)} g/ml
                  </Badge>
                )}
              </div>
            </div>
          </div>
          <IconChevronDown className={cn("h-4 w-4 text-muted-foreground transition-transform duration-200", isOpen && "rotate-180")} />
        </div>
      </CollapsibleTrigger>

      <CollapsibleContent className="px-4 pb-4">
        <div className="space-y-4">
          {/* Components Table */}
          {hasComponents && (
            <div className="rounded-lg border">
              <Table className="[&>div]:border-0">
                <TableHeader>
                  <TableRow>
                    <TableHead>Unicode</TableHead>
                    <TableHead>Componente</TableHead>
                    <TableHead className="text-right">Proporção</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {formula.components
                    ?.sort((a, b) => (b.ratio || 0) - (a.ratio || 0))
                    .map((component) => (
                      <TableRow key={component.id} className="border-2 border-transparent hover:border-red-500 transition-all duration-200">
                        <TableCell className="font-mono text-sm">{component.item?.uniCode || "-"}</TableCell>
                        <TableCell className="font-medium">{component.item?.name || "Item desconhecido"}</TableCell>
                        <TableCell className="text-right">{formatNumberWithDecimals(component.ratio || 0, 2)}%</TableCell>
                      </TableRow>
                    ))}
                  {Math.abs(totalRatio - 100) > 0.01 && (
                    <TableRow>
                      <TableCell className="font-mono text-sm text-muted-foreground">-</TableCell>
                      <TableCell className="font-medium text-muted-foreground">Total</TableCell>
                      <TableCell className={cn("text-right font-medium", Math.abs(totalRatio - 100) > 0.01 && "text-destructive")}>
                        {formatNumberWithDecimals(totalRatio, 2)}%
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          )}

          {/* Formula Properties */}
          <div className="grid grid-cols-2 gap-4">
            {/* Density */}
            <div className="flex items-center gap-2 p-3 bg-muted/50 rounded-lg">
              <IconDroplet className="h-4 w-4 text-muted-foreground" />
              <div>
                <p className="text-xs text-muted-foreground">Densidade</p>
                <p className="font-medium">{formula.density && Number(formula.density) > 0 ? `${formatNumberWithDecimals(Number(formula.density), 3)} g/ml` : "-"}</p>
              </div>
            </div>

            {/* Price per Liter */}
            <div className="flex items-center gap-2 p-3 bg-muted/50 rounded-lg">
              <IconCurrencyReal className="h-4 w-4 text-muted-foreground" />
              <div>
                <p className="text-xs text-muted-foreground">Preço por Litro</p>
                <p className="font-medium">{formula.pricePerLiter && Number(formula.pricePerLiter) > 0 ? formatCurrency(Number(formula.pricePerLiter)) : "-"}</p>
              </div>
            </div>
          </div>

          {/* Warning if no components */}
          {!hasComponents && <div className="text-center py-4 text-sm text-muted-foreground">Esta fórmula não possui componentes cadastrados</div>}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}
