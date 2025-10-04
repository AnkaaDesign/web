import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { IconFlask, IconChevronDown, IconChevronRight, IconCurrencyDollar, IconWeight, IconEye } from "@tabler/icons-react";

import { usePaint, usePaintFormulasByPaintId } from "../../../../../../hooks";
import { formatCurrency } from "../../../../../../utils";
import { routes } from "../../../../../../constants";

import { Card, CardContent } from "@/components/ui/card";
import { LoadingSpinner } from "@/components/ui/loading";
import { ErrorCard } from "@/components/ui/error-card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { PageHeader } from "@/components/ui/page-header";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";

export default function PaintFormulasPage() {
  const { id: paintId } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [openFormulas, setOpenFormulas] = useState<Set<string>>(new Set());
  const [hasInitialized, setHasInitialized] = useState(false);

  // Fetch paint basic info
  const {
    data: paintResponse,
    isLoading: paintLoading,
    error: paintError,
  } = usePaint(paintId!, {
    include: {
      paintType: true,
    },
    enabled: !!paintId,
  });

  // Fetch formulas for this paint
  const {
    data: formulasResponse,
    isLoading: formulasLoading,
    error: formulasError,
    refresh: _refreshFormulas,
  } = usePaintFormulasByPaintId(
    paintId!,
    {
      include: {
        components: {
          include: {
            item: true,
          },
        },
      },
    },
    { enabled: !!paintId },
  );

  // Get formulas from response (empty array if no data yet)
  const formulas = formulasResponse?.data || [];

  // Calculate component price based on ratio and formula density
  const calculateComponentPrice = (component: any, formula: any) => {
    const item = component.item;
    if (!item || !item.prices || item.prices.length === 0) return null;

    // Get item price
    const itemPrice = item.prices[0].value;

    // Get weight measure from item (weight per can/unit)
    const weightMeasure = item.measures?.find((m: any) => m.measureType === "WEIGHT");

    // Calculate weight per unit in grams
    let weightPerUnitInGrams = 0;
    if (weightMeasure) {
      if (weightMeasure.unit === "KILOGRAM") {
        weightPerUnitInGrams = (weightMeasure.value || 0) * 1000; // Convert kg to grams
      } else if (weightMeasure.unit === "GRAM") {
        weightPerUnitInGrams = weightMeasure.value || 0;
      }
    }

    // If no weight measure, check for volume measure and use density
    if (weightPerUnitInGrams === 0) {
      const volumeMeasure = item.measures?.find((m: any) => m.measureType === "VOLUME");
      if (volumeMeasure) {
        const formulaDensity = Number(formula.density) || 1.0;
        let volumeInMl = 0;
        if (volumeMeasure.unit === "LITER") {
          volumeInMl = (volumeMeasure.value || 0) * 1000;
        } else if (volumeMeasure.unit === "MILLILITER") {
          volumeInMl = volumeMeasure.value || 0;
        }
        weightPerUnitInGrams = volumeInMl * formulaDensity;
      }
    }

    // If still no weight, assume the item quantity is already in the unit we need
    if (weightPerUnitInGrams === 0) {
      weightPerUnitInGrams = 1; // Last resort: assume 1g per unit
    }

    // Calculate price per gram
    const pricePerGram = weightPerUnitInGrams > 0 ? itemPrice / weightPerUnitInGrams : 0;

    // For display purposes, calculate price per 1000g (1kg) based on ratio
    // This represents the proportional cost contribution of this component
    const componentWeightFor1L = (1000 * Number(formula.density || 1) * component.ratio) / 100;
    const componentCost = pricePerGram * componentWeightFor1L;

    return componentCost;
  };

  // Initialize first formula as open when formulas are loaded
  useEffect(() => {
    if (formulas.length > 0 && !hasInitialized) {
      setOpenFormulas(new Set([formulas[0].id]));
      setHasInitialized(true);
    }
  }, [formulas, hasInitialized]);

  const isLoading = paintLoading || formulasLoading;
  const error = paintError || formulasError;

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  if (error || !paintResponse?.data) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <ErrorCard
          title="Erro ao carregar dados"
          description={paintError ? "Não foi possível carregar as informações da tinta." : "Não foi possível carregar as fórmulas desta tinta. Por favor, tente novamente."}
          onRetry={() => {
            window.location.reload();
          }}
        />
      </div>
    );
  }

  const paint = paintResponse.data;

  const toggleFormula = (formulaId: string) => {
    const newOpenFormulas = new Set(openFormulas);
    if (newOpenFormulas.has(formulaId)) {
      newOpenFormulas.delete(formulaId);
    } else {
      newOpenFormulas.add(formulaId);
    }
    setOpenFormulas(newOpenFormulas);
  };

  return (
    <div className="flex flex-col h-full space-y-6">
      {/* Page Header - Fixed */}
      <div className="animate-in fade-in-50 duration-500">
        <PageHeader
          variant="default"
          title={`Fórmulas de ${paint.name}`}
          icon={IconFlask}
          breadcrumbs={[
            { label: "Início", href: routes.home },
            { label: "Pintura", href: routes.painting.root },
            { label: "Catálogo", href: routes.painting.catalog.root },
            { label: paint.name, href: routes.painting.catalog.details(paintId!) },
            { label: "Fórmulas" },
          ]}
        />
      </div>

      {/* Scrollable Content */}
      <div className="flex-1 overflow-y-auto">
        <div className="space-y-4 animate-in fade-in-50 duration-700">
            {formulas.length === 0 ? (
              <Card className="shadow-sm border border-border" level={1}>
                <CardContent className="pt-4 sm:pt-6">
                  <div className="text-center py-6 sm:py-8">
                    <IconFlask className="h-10 w-10 sm:h-12 sm:w-12 mx-auto text-muted-foreground/50 mb-3" />
                    <p className="text-sm sm:text-base text-muted-foreground px-4">Nenhuma fórmula cadastrada para esta tinta</p>
                  </div>
                </CardContent>
              </Card>
            ) : (
              formulas.map((formula) => (
                <Collapsible key={formula.id} open={openFormulas.has(formula.id)} onOpenChange={() => toggleFormula(formula.id)}>
                  <Card className="shadow-sm border border-border overflow-hidden" level={1}>
                    <CollapsibleTrigger asChild>
                      <Button variant="ghost" className="w-full p-0 h-auto justify-start hover:bg-transparent">
                        <div className="w-full p-4 sm:p-6">
                          <div className="flex items-center justify-between gap-4">
                            <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1">
                              <div className="p-2 rounded-lg bg-primary/10 flex-shrink-0">
                                {openFormulas.has(formula.id) ? <IconChevronDown className="h-4 w-4 text-primary" /> : <IconChevronRight className="h-4 w-4 text-primary" />}
                              </div>
                              <div className="text-left min-w-0 flex-1">
                                <h3 className="font-semibold text-base sm:text-lg truncate">{formula.description}</h3>
                                <Badge variant="secondary" className="text-xs mt-1">
                                  {formula.components?.length || 0} componentes
                                </Badge>
                              </div>
                            </div>
                            <div className="flex flex-col items-end gap-1 text-xs sm:text-sm">
                              <span className="flex items-center gap-1 text-muted-foreground">
                                <IconCurrencyDollar className="h-4 w-4" />
                                <span className="font-medium">{formatCurrency(formula.pricePerLiter)}/L</span>
                              </span>
                              <span className="flex items-center gap-1 text-muted-foreground">
                                <IconWeight className="h-4 w-4" />
                                <span className="font-medium font-mono">{Number(formula.density).toFixed(3)} g/ml</span>
                              </span>
                            </div>
                          </div>
                        </div>
                      </Button>
                    </CollapsibleTrigger>

                    <CollapsibleContent>
                      <Separator />
                      <CardContent className="pt-4 sm:pt-6">
                        {formula.components && formula.components.length > 0 ? (
                          <div className="space-y-4">
                            <div className="rounded-lg border border-border overflow-hidden">
                              <Table className="w-full table-fixed">
                                <TableHeader>
                                  <TableRow className="bg-muted hover:bg-muted">
                                    <TableHead className="font-semibold text-xs uppercase">Componente</TableHead>
                                    <TableHead className="text-right font-semibold text-xs uppercase w-32">Preço</TableHead>
                                    <TableHead className="text-right font-semibold text-xs uppercase w-32">Proporção</TableHead>
                                  </TableRow>
                                </TableHeader>
                                <TableBody>
                                  {formula.components
                                    .sort((a, b) => b.ratio - a.ratio)
                                    .map((component, index) => (
                                      <TableRow
                                        key={component.id}
                                        className={cn("cursor-pointer transition-colors border-b border-border", index % 2 === 1 && "bg-muted/10", "hover:bg-muted/20")}
                                      >
                                        <TableCell className="p-0">
                                          <div className="px-4 py-2">
                                            <div className="flex items-center gap-2">
                                              <span className="text-base">
                                                <span className="font-medium text-muted-foreground">{component.item?.uniCode || "SEM CÓDIGO"}</span>
                                                <span className="mx-2">-</span>
                                                <span>{component.item?.name || "Componente sem nome"}</span>
                                              </span>
                                            </div>
                                          </div>
                                        </TableCell>
                                        <TableCell className="p-0 text-right">
                                          <div className="px-4 py-2 tabular-nums text-base">
                                            {(() => {
                                              const price = calculateComponentPrice(component, formula);
                                              return price !== null ? formatCurrency(price) : "-";
                                            })()}
                                          </div>
                                        </TableCell>
                                        <TableCell className="p-0 text-right">
                                          <div className="px-4 py-2 tabular-nums text-base">{component.ratio.toFixed(2)}%</div>
                                        </TableCell>
                                      </TableRow>
                                    ))}
                                </TableBody>
                              </Table>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                              <div className="p-3 sm:p-4 bg-muted/50 rounded-lg">
                                <p className="text-xs sm:text-sm text-muted-foreground mb-1">Densidade</p>
                                <p className="font-semibold text-sm sm:text-base font-mono">{Number(formula.density).toFixed(3)} g/ml</p>
                              </div>
                              <div className="p-3 sm:p-4 bg-muted/50 rounded-lg">
                                <p className="text-xs sm:text-sm text-muted-foreground mb-1">Preço por Litro</p>
                                <p className="font-semibold text-sm sm:text-base">{formatCurrency(formula.pricePerLiter)}</p>
                              </div>
                            </div>

                            <div className="flex justify-end pt-2">
                              <Button
                                variant="default"
                                size="sm"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  navigate(routes.painting.catalog.formulaDetails(paintId!, formula.id));
                                }}
                              >
                                <IconEye className="h-4 w-4 mr-2" />
                                Ver Detalhes da Fórmula
                              </Button>
                            </div>
                          </div>
                        ) : (
                          <div className="text-center py-6 sm:py-8 text-muted-foreground">
                            <p className="text-sm sm:text-base mb-4">Nenhum componente cadastrado para esta fórmula</p>
                            <Button
                              variant="default"
                              size="sm"
                              onClick={(e) => {
                                e.stopPropagation();
                                navigate(routes.painting.catalog.formulaDetails(paintId!, formula.id));
                              }}
                            >
                              <IconEye className="h-4 w-4 mr-2" />
                              Ver Detalhes da Fórmula
                            </Button>
                          </div>
                        )}
                      </CardContent>
                    </CollapsibleContent>
                  </Card>
                </Collapsible>
              ))
            )}
        </div>
      </div>
    </div>
  );
}
