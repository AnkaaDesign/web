import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { formatNumber } from "../../../../utils";
import { MEASURE_UNIT_LABELS, MEASURE_TYPE } from "../../../../constants";
import type { PaintBrand } from "../../../../types";
import { IconComponents, IconWeight, IconDroplet, IconPackage } from "@tabler/icons-react";
import { useNavigate } from "react-router-dom";

interface PaintBrandComponentsCardProps {
  paintBrand: PaintBrand;
}

export function PaintBrandComponentsCard({ paintBrand }: PaintBrandComponentsCardProps) {
  const navigate = useNavigate();
  const components = paintBrand.componentItems || [];

  if (components.length === 0) {
    return (
      <Card className="h-full flex flex-col">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <IconComponents className="h-5 w-5" />
            Componentes
          </CardTitle>
        </CardHeader>
        <CardContent className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <IconPackage className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <p className="text-muted-foreground">Nenhum componente configurado para esta marca.</p>
            <p className="text-sm text-muted-foreground mt-2">Configure os componentes editando a marca.</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="h-full flex flex-col shadow-sm border border-border">
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-3 text-xl">
            <div className="p-2 rounded-lg bg-primary/10">
              <IconComponents className="h-5 w-5 text-primary" />
            </div>
            Componentes ({components.length})
          </CardTitle>
        </div>
      </CardHeader>
      <CardContent className="flex-1 min-h-0 pt-0">
        <div className="rounded-md border border-border/50 h-full flex flex-col bg-muted/30">
          <div className="overflow-auto flex-1">
            <Table className="w-full [&>div]:border-0 [&>div]:rounded-none">
              <TableHeader className="[&_tr]:border-b-0 [&_tr]:hover:bg-muted sticky top-0 z-10">
                <TableRow className="bg-muted hover:bg-muted even:bg-muted">
                  <TableHead className="whitespace-nowrap text-foreground font-bold uppercase text-xs p-0 bg-muted !border-r-0">
                    <div className="flex items-center px-4 py-3">Componente</div>
                  </TableHead>
                  <TableHead className="whitespace-nowrap text-foreground font-bold uppercase text-xs p-0 bg-muted !border-r-0">
                    <div className="flex items-center px-4 py-3">Categoria</div>
                  </TableHead>
                  <TableHead className="whitespace-nowrap text-foreground font-bold uppercase text-xs p-0 bg-muted !border-r-0">
                    <div className="flex items-center px-4 py-3">Peso</div>
                  </TableHead>
                  <TableHead className="whitespace-nowrap text-foreground font-bold uppercase text-xs p-0 bg-muted !border-r-0">
                    <div className="flex items-center px-4 py-3">Volume</div>
                  </TableHead>
                  <TableHead className="whitespace-nowrap text-foreground font-bold uppercase text-xs p-0 bg-muted !border-r-0">
                    <div className="flex items-center px-4 py-3">Estoque</div>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {components.map((item) => {
                  const weightMeasure = item.measures?.find((m) => m.measureType === MEASURE_TYPE.WEIGHT);
                  const volumeMeasure = item.measures?.find((m) => m.measureType === MEASURE_TYPE.VOLUME);
                  const hasStock = item.quantity > 0;

                  return (
                    <TableRow key={item.id} className="cursor-pointer hover:bg-muted/50" onClick={() => navigate(`/estoque/produtos/detalhes/${item.id}`)}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          {item.uniCode && <span className="text-sm font-mono text-muted-foreground">{item.uniCode}</span>}
                          <p className="font-medium">{item.name}</p>
                        </div>
                      </TableCell>
                      <TableCell>{item.category ? <Badge variant="outline">{item.category.name}</Badge> : <span className="text-muted-foreground">-</span>}</TableCell>
                      <TableCell>
                        {weightMeasure ? (
                          <div className="flex items-center gap-1 whitespace-nowrap">
                            <IconWeight className="h-4 w-4 text-muted-foreground" />
                            <span className="text-sm">
                              {weightMeasure.value !== null ? formatNumber(weightMeasure.value) : "-"}{" "}
                              {weightMeasure.unit && MEASURE_UNIT_LABELS[weightMeasure.unit] ? MEASURE_UNIT_LABELS[weightMeasure.unit] : weightMeasure.unit || ""}
                            </span>
                          </div>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {volumeMeasure ? (
                          <div className="flex items-center gap-1 whitespace-nowrap">
                            <IconDroplet className="h-4 w-4 text-muted-foreground" />
                            <span className="text-sm">
                              {volumeMeasure.value !== null ? formatNumber(volumeMeasure.value) : "-"}{" "}
                              {volumeMeasure.unit && MEASURE_UNIT_LABELS[volumeMeasure.unit] ? MEASURE_UNIT_LABELS[volumeMeasure.unit] : volumeMeasure.unit || ""}
                            </span>
                          </div>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <span className={cn("font-medium", hasStock ? "text-green-600" : "text-red-600")}>{formatNumber(item.quantity)}</span>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
