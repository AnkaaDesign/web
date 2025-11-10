import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { PAINT_FINISH_LABELS, routes } from "../../../../constants";
import type { PaintType } from "../../../../types";
import { IconPaint, IconBrush, IconFlask, IconPalette, IconTag } from "@tabler/icons-react";
import { useNavigate } from "react-router-dom";

interface PaintTypeRelatedPaintsCardProps {
  paintType: PaintType;
}

export function PaintTypeRelatedPaintsCard({ paintType }: PaintTypeRelatedPaintsCardProps) {
  const navigate = useNavigate();
  const paints = paintType.paints || [];
  const totalPaints = paintType._count?.paints || 0;

  // Calculate statistics
  const statistics = useMemo(() => {
    const totalFormulas = paints.reduce((sum, paint) => sum + (paint.formulas?.length || 0), 0);
    const paintsWithFormulas = paints.filter((paint) => paint.formulas && paint.formulas.length > 0).length;
    const paintsWithoutFormulas = paints.length - paintsWithFormulas;

    // Count unique brands
    const uniqueBrands = new Set(paints.filter((p) => p.paintBrand?.name).map((p) => p.paintBrand!.name));
    const brandCount = uniqueBrands.size;

    // Count unique finishes
    const finishCounts = paints.reduce(
      (acc, paint) => {
        acc[paint.finish] = (acc[paint.finish] || 0) + 1;
        return acc;
      },
      {} as Record<string, number>,
    );

    // Count total unique tags
    const allTags = new Set(paints.flatMap((p) => p.tags || []));
    const totalTags = allTags.size;

    return {
      totalPaints: paints.length,
      totalFormulas,
      paintsWithFormulas,
      paintsWithoutFormulas,
      brandCount,
      finishCounts,
      totalTags,
    };
  }, [paints]);

  if (totalPaints === 0) {
    return (
      <Card className="shadow-sm border border-border">
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-3 text-xl">
              <div className="p-2 rounded-lg bg-primary/10">
                <IconBrush className="h-5 w-5 text-primary" />
              </div>
              Tintas Relacionadas
            </CardTitle>
            {paintType.id && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  const catalogUrl = routes.painting.catalog.root + "?paintTypeIds=" + paintType.id;
                  navigate(catalogUrl);
                }}
              >
                Ver no catálogo
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="text-center py-12">
            <IconPaint className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <p className="text-muted-foreground">Nenhuma tinta cadastrada para este tipo.</p>
            <Button className="mt-4" onClick={() => navigate(routes.painting.catalog.create)}>
              Cadastrar Primeira Tinta
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="shadow-sm border border-border" level={1}>
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-3 text-xl">
            <div className="p-2 rounded-lg bg-primary/10">
              <IconBrush className="h-5 w-5 text-primary" />
            </div>
            Tintas Relacionadas ({totalPaints})
          </CardTitle>
          {paintType.id && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                const catalogUrl = routes.painting.catalog.root + "?paintTypeIds=" + paintType.id;
                navigate(catalogUrl);
              }}
            >
              Ver no catálogo
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        {/* Statistics Summary */}
        <div className="grid grid-cols-3 gap-3 mb-6">
          <div className="bg-card-nested rounded-lg p-3 border border-border">
            <span className="text-xs font-medium text-muted-foreground block">Total de Tintas</span>
            <p className="text-xl font-bold mt-1">{statistics.totalPaints}</p>
          </div>

          <div className="bg-green-50/80 dark:bg-green-900/20 rounded-lg p-3 border border-green-200/40 dark:border-green-700/40">
            <span className="text-xs font-medium text-green-800 dark:text-green-200 block">Com Fórmulas</span>
            <p className="text-xl font-bold mt-1 text-green-800 dark:text-green-200">{statistics.paintsWithFormulas}</p>
          </div>

          <div className="bg-blue-50/80 dark:bg-blue-900/20 rounded-lg p-3 border border-blue-200/40 dark:border-blue-700/40">
            <span className="text-xs font-medium text-blue-800 dark:text-blue-200 block">Total Fórmulas</span>
            <p className="text-xl font-bold mt-1 text-blue-800 dark:text-blue-200">{statistics.totalFormulas}</p>
          </div>
        </div>

        {/* Additional Statistics */}
        <div className="flex flex-wrap gap-2 mb-4">
          {statistics.brandCount > 0 && (
            <Badge variant="outline" className="font-medium">
              <IconPalette className="h-3 w-3 mr-1" />
              {statistics.brandCount} {statistics.brandCount === 1 ? "Marca" : "Marcas"}
            </Badge>
          )}
          {statistics.totalTags > 0 && (
            <Badge variant="outline" className="font-medium">
              <IconTag className="h-3 w-3 mr-1" />
              {statistics.totalTags} Tags únicas
            </Badge>
          )}
          {statistics.paintsWithoutFormulas > 0 && (
            <Badge variant="secondary" className="font-medium">
              {statistics.paintsWithoutFormulas} sem fórmulas
            </Badge>
          )}
        </div>

        {/* Paints Grid with ScrollArea - Max height for 3 rows */}
        <ScrollArea className="h-[420px]">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 pr-4">
            {paints.map((paint) => {
              const formulaCount = paint.formulas?.length || 0;
              const hasFormulas = formulaCount > 0;

              return (
                <div
                  key={paint.id}
                  className="group relative overflow-hidden rounded-lg border border-border/50 dark:border-border/40 bg-card hover:bg-muted/50 transition-colors cursor-pointer"
                  onClick={() => navigate(routes.painting.catalog.details(paint.id))}
                >
                  <div className="p-4 space-y-3">
                    {/* Color Preview and Name */}
                    <div className="flex items-center gap-3">
                      <div className="h-12 w-12 rounded-lg border border-border/60 dark:border-border/50 shadow-sm" style={{ backgroundColor: paint.hex }} />
                      <div className="flex-1">
                        <h4 className="font-medium line-clamp-1">{paint.name}</h4>
                        <p className="text-xs text-muted-foreground font-mono">{paint.hex}</p>
                      </div>
                    </div>

                    {/* Paint Details */}
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge variant="outline" className="text-xs">
                        {PAINT_FINISH_LABELS[paint.finish] || paint.finish}
                      </Badge>
                      {paint.paintBrand?.name && (
                        <Badge variant="outline" className="text-xs">
                          {paint.paintBrand?.name}
                        </Badge>
                      )}
                      <div className={cn("flex items-center gap-1 text-xs", hasFormulas ? "text-green-600" : "text-amber-600")}>
                        <IconFlask className="h-3 w-3" />
                        <span>{formulaCount} fórmula(s)</span>
                      </div>
                    </div>

                    {/* Tags */}
                    {paint.tags && paint.tags.length > 0 && (
                      <div className="flex gap-1 flex-wrap">
                        {paint.tags.slice(0, 3).map((tag, index) => (
                          <Badge key={index} variant="secondary" className="text-xs">
                            {tag}
                          </Badge>
                        ))}
                        {paint.tags.length > 3 && (
                          <Badge variant="secondary" className="text-xs">
                            +{paint.tags.length - 3}
                          </Badge>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
