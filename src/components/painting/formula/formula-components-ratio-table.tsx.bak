import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { IconPackage, IconHash, IconCalculator } from "@tabler/icons-react";
import type { PaintFormulaComponent } from "../../../types";

interface FormulaComponentsRatioTableProps {
  components: PaintFormulaComponent[];
  className?: string;
  variant?: "card" | "table-only";
}

export function FormulaComponentsRatioTable({ components, className, variant = "card" }: FormulaComponentsRatioTableProps) {
  // Sort components by ratio (lowest first) for better visualization
  const sortedComponents = [...components].sort((a, b) => (a.ratio || 0) - (b.ratio || 0));

  // Calculate total ratio for validation
  const totalRatio = components.reduce((sum, comp) => sum + (comp.ratio || 0), 0);
  const hasRatioMismatch = Math.abs(totalRatio - 100) > 0.1;

  const tableContent = () => (
    <>
      <div className="rounded-md border">
        <Table className="[&>div]:border-0">
          <TableHeader className="[&_tr]:border-b-0 [&_tr]:hover:bg-muted">
            <TableRow className="bg-muted hover:bg-muted even:bg-muted">
              <TableHead className="whitespace-nowrap text-foreground font-bold uppercase text-xs bg-muted !border-r-0 p-0 w-[100px] sm:w-[120px]">
                <div className="flex items-center h-full min-h-[2.5rem] px-4 py-2 gap-1">
                  <IconHash className="h-3 w-3" />
                  <span className="hidden sm:inline">UNICODE</span>
                  <span className="sm:hidden">CÓDIGO</span>
                </div>
              </TableHead>
              <TableHead className="whitespace-nowrap text-foreground font-bold uppercase text-xs bg-muted !border-r-0 p-0">
                <div className="flex items-center h-full min-h-[2.5rem] px-4 py-2 gap-1">
                  <IconPackage className="h-3 w-3" />
                  COMPONENTE
                </div>
              </TableHead>
              <TableHead className="whitespace-nowrap text-foreground font-bold uppercase text-xs bg-muted !border-r-0 p-0 w-[100px] sm:w-[120px]">
                <div className="flex items-center justify-end h-full min-h-[2.5rem] px-4 py-2 gap-1">
                  <IconCalculator className="h-3 w-3" />
                  <span className="hidden sm:inline">PROPORÇÃO</span>
                  <span className="sm:hidden">%</span>
                </div>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sortedComponents.length === 0 ? (
              <TableRow>
                <TableCell colSpan={3} className="text-center text-muted-foreground py-8">
                  Nenhum componente encontrado
                </TableCell>
              </TableRow>
            ) : (
              sortedComponents.map((component, index) => (
                <TableRow key={component.id || index}>
                  <TableCell className="font-mono text-sm p-2 sm:p-4">
                    {component.item?.uniCode ? (
                      <Badge variant="outline" className="font-mono text-xs">
                        {component.item.uniCode}
                      </Badge>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell className="p-2 sm:p-4">
                    <div className="flex flex-col">
                      <span className="font-medium text-sm sm:text-base">{component.item?.name || `Componente ${index + 1}`}</span>
                      {component.item?.category?.name && <span className="text-xs text-muted-foreground hidden sm:block">{component.item.category.name}</span>}
                    </div>
                  </TableCell>
                  <TableCell className="text-right p-2 sm:p-4">
                    <Badge variant={(component.ratio || 0) > 50 ? "default" : (component.ratio || 0) > 20 ? "secondary" : "outline"} className="font-semibold text-xs sm:text-sm">
                      {(component.ratio || 0).toFixed(1)}%
                    </Badge>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Summary Footer */}
      {components.length > 0 && (
        <div className="mt-4 pt-4 border-t">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 text-sm">
            <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4">
              <span className="text-muted-foreground">
                Total de componentes: <span className="font-medium text-foreground">{components.length}</span>
              </span>
              <span className="text-muted-foreground">
                Soma das proporções:
                <Badge variant={hasRatioMismatch ? "destructive" : "secondary"} className="ml-1 font-semibold">
                  {totalRatio.toFixed(1)}%
                </Badge>
              </span>
            </div>
            {hasRatioMismatch && (
              <Badge variant="destructive" className="text-xs self-start sm:self-auto">
                <span className="font-enhanced-unicode">⚠️</span> Deve somar 100%
              </Badge>
            )}
          </div>
        </div>
      )}
    </>
  );

  if (variant === "table-only") {
    return <div className={className}>{tableContent()}</div>;
  }

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <IconPackage className="h-4 w-4" />
          Tabela de Proporções dos Componentes
        </CardTitle>
      </CardHeader>
      <CardContent>{tableContent()}</CardContent>
    </Card>
  );
}
