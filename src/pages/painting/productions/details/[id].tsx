import { useParams, useNavigate } from "react-router-dom";
import { usePaintProduction } from "../../../../hooks";
import { routes, PAINT_FINISH_LABELS, CHANGE_LOG_ENTITY_TYPE } from "../../../../constants";
import { formatDateTime, formatNumber } from "../../../../utils";
import { LoadingPage } from "@/components/navigation/loading-page";
import { ErrorCard } from "@/components/ui/error-card";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { IconFlask, IconDroplet, IconCalendar, IconPaint, IconComponents, IconWeight, IconRefresh } from "@tabler/icons-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { ChangelogHistory } from "@/components/ui/changelog-history";
import { CanvasNormalMapRenderer } from "@/components/painting/effects/canvas-normal-map-renderer";
import { PAINT_FINISH } from "@/constants";

export function ProductionDetailsPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const {
    data: response,
    isLoading,
    error,
    refetch,
  } = usePaintProduction(id!, {
    include: {
      formula: {
        include: {
          paint: true,
          components: {
            include: {
              item: true,
            },
          },
        },
      },
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

  if (error || !response?.data) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <ErrorCard
          title="Produção não encontrada"
          description="A produção que você está procurando não existe ou foi excluída."
          onRetry={() => navigate(routes.painting.productions.root)}
        />
      </div>
    );
  }

  const production = response.data;
  const formula = production.formula;
  const paint = formula?.paint;

  const handleRefresh = () => {
    refetch();
  };

  // Create a production entity that matches BaseEntity interface
  const productionEntity = {
    id: production.id,
    name: paint ? `Produção de ${paint.name}` : `Produção ${production.id.slice(0, 8)}`,
  };

  return (
    <div className="flex flex-col h-full space-y-6">
      {/* Header */}
      <PageHeader
        variant="detail"
        title={productionEntity.name}
        icon={IconFlask}
        breadcrumbs={[
          { label: "Início", href: routes.home },
          { label: "Pintura", href: routes.painting.root },
          { label: "Produções", href: routes.painting.productions.root },
          { label: productionEntity.name },
        ]}
        actions={[
          {
            key: "refresh",
            label: "Atualizar",
            icon: IconRefresh,
            onClick: handleRefresh,
          },
        ]}
      />

      <div className="flex-1 overflow-y-auto">
        <div className="space-y-6">
          {/* Production Information Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Left column - Production Details */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <IconFlask className="h-5 w-5" />
                  Informações da Produção
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Volume */}
                <div className="flex items-start gap-3">
                  <IconDroplet className="h-5 w-5 text-muted-foreground mt-0.5" />
                  <div className="flex-1">
                    <p className="text-sm font-medium">Volume Produzido</p>
                    <p className="text-2xl font-bold mt-1">{formatNumber(production.volumeLiters)} L</p>
                    <p className="text-sm text-muted-foreground">{formatNumber(production.volumeLiters * 1000)} mL</p>
                  </div>
                </div>

                {/* Weight */}
                <div className="flex items-start gap-3">
                  <IconWeight className="h-5 w-5 text-muted-foreground mt-0.5" />
                  <div className="flex-1">
                    <p className="text-sm font-medium">Peso Total</p>
                    <p className="text-lg font-semibold mt-1">{Math.round(production.volumeLiters * Number(formula?.density || 1) * 1000)} g</p>
                    <p className="text-sm text-muted-foreground">Densidade: {formula?.density ? Number(formula.density).toFixed(2) : "1.00"} g/ml</p>
                  </div>
                </div>

                {/* Date */}
                <div className="flex items-start gap-3">
                  <IconCalendar className="h-5 w-5 text-muted-foreground mt-0.5" />
                  <div className="flex-1">
                    <p className="text-sm font-medium">Data de Produção</p>
                    <p className="text-sm text-muted-foreground mt-1">{formatDateTime(production.createdAt)}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Right column - Paint and Formula */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <IconPaint className="h-5 w-5" />
                  Tinta e Fórmula
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {paint && (
                  <div className="flex items-center gap-3">
                    <div className="h-16 w-16 rounded-md ring-1 ring-border shadow-sm flex-shrink-0 overflow-hidden">
                      {paint.colorPreview ? (
                        <img src={paint.colorPreview} alt={paint.name} className="w-full h-full object-cover" loading="lazy" />
                      ) : paint.finish ? (
                        <CanvasNormalMapRenderer
                          baseColor={paint.hex || "#888888"}
                          finish={(paint.finish as PAINT_FINISH) || PAINT_FINISH.SOLID}
                          width={64}
                          height={64}
                          quality="medium"
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full" style={{ backgroundColor: paint.hex }} />
                      )}
                    </div>
                    <div className="flex-1 space-y-2">
                      <p className="font-semibold text-lg">{paint.name}</p>
                      <div className="flex items-center gap-2">
                        <Badge variant="secondary">{paint.paintBrand?.name || "N/A"}</Badge>
                        <Badge variant="outline">{PAINT_FINISH_LABELS[paint.finish] || paint.finish}</Badge>
                      </div>
                    </div>
                  </div>
                )}

                {formula && (
                  <>
                    <div className="border-t pt-4">
                      <p className="text-sm font-medium">Fórmula Utilizada</p>
                      <p className="text-sm text-muted-foreground mt-1">{formula.description}</p>
                      <div className="flex items-center gap-2 mt-3">
                        <Badge variant="secondary">{formula.components?.length || 0} componentes</Badge>
                      </div>
                    </div>
                    <Button variant="outline" size="sm" className="w-full" onClick={() => navigate(routes.painting.catalog.formulaDetails(paint?.id || "", formula.id))}>
                      Ver detalhes da fórmula
                    </Button>
                  </>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Components Used */}
          {formula?.components && formula.components.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <IconComponents className="h-5 w-5" />
                  Componentes Utilizados
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="rounded-md border border-border/50">
                  <Table className="w-full [&>div]:border-0 [&>div]:rounded-none">
                    <TableHeader className="[&_tr]:border-b-0 [&_tr]:hover:bg-muted">
                      <TableRow className="bg-muted hover:bg-muted even:bg-muted">
                        <TableHead className="whitespace-nowrap text-foreground font-bold uppercase text-xs p-0 bg-muted !border-r-0">
                          <div className="flex items-center px-4 py-3">Componente</div>
                        </TableHead>
                        <TableHead className="whitespace-nowrap text-foreground font-bold uppercase text-xs p-0 bg-muted !border-r-0">
                          <div className="flex items-center px-4 py-3">Percentual</div>
                        </TableHead>
                        <TableHead className="whitespace-nowrap text-foreground font-bold uppercase text-xs p-0 bg-muted !border-r-0">
                          <div className="flex items-center px-4 py-3">Quantidade Utilizada</div>
                        </TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {formula.components
                        .sort((a, b) => b.ratio - a.ratio)
                        .map((component) => {
                          // Calculate total weight in grams: Volume (L) × Density (g/ml) × 1000 (ml/L)
                          const totalWeightGrams = production.volumeLiters * Number(formula.density || 1) * 1000;
                          // Calculate component weight: Total weight × Component ratio / 100
                          const componentWeightGrams = (totalWeightGrams * component.ratio) / 100;

                          return (
                            <TableRow key={component.id}>
                              <TableCell>
                                <div className="flex items-center gap-2">
                                  {component.item?.uniCode && <span className="text-sm font-mono text-muted-foreground">{component.item.uniCode}</span>}
                                  <p className="font-medium">
                                    {component.item?.uniCode && component.item?.name
                                      ? `${component.item.uniCode} - ${component.item.name}`
                                      : component.item?.name || "Item não encontrado"}
                                  </p>
                                </div>
                              </TableCell>
                              <TableCell>
                                <Badge variant="secondary">{component.ratio.toFixed(2)}%</Badge>
                              </TableCell>
                              <TableCell>
                                <div className="flex items-center gap-1 whitespace-nowrap">
                                  <IconWeight className="h-4 w-4 text-muted-foreground" />
                                  <span className={cn("font-medium", componentWeightGrams >= 100 ? "text-lg" : "text-base")}>
                                    {componentWeightGrams < 20 ? componentWeightGrams.toFixed(2) : Math.round(componentWeightGrams)} g
                                  </span>
                                </div>
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      {/* Total Row */}
                      <TableRow className="font-semibold bg-muted/50">
                        <TableCell>Total</TableCell>
                        <TableCell>
                          <Badge>100.00%</Badge>
                        </TableCell>
                        <TableCell>
                          {(() => {
                            const totalWeightGrams = production.volumeLiters * Number(formula.density || 1) * 1000;
                            return (
                              <div className="flex items-center gap-1 whitespace-nowrap">
                                <IconWeight className="h-4 w-4 text-muted-foreground" />
                                <span className="text-lg font-bold">{Math.round(totalWeightGrams)} g</span>
                              </div>
                            );
                          })()}
                        </TableCell>
                      </TableRow>
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Changelog Section */}
          <Card>
            <CardHeader>
              <CardTitle>Histórico de Alterações</CardTitle>
              <CardDescription>Acompanhe todas as modificações realizadas nesta produção</CardDescription>
            </CardHeader>
            <CardContent>
              <ChangelogHistory
                entityType={CHANGE_LOG_ENTITY_TYPE.PAINT_PRODUCTION}
                entityId={production.id}
                entityName={productionEntity.name}
                entityCreatedAt={production.createdAt}
                className="h-[400px]"
              />
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

export default ProductionDetailsPage;
