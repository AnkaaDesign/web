import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { IconFlask, IconChevronDown, IconChevronRight, IconCurrencyReal, IconDroplet } from "@tabler/icons-react";

import { usePaintFormulas } from "../../../hooks";
import { routes } from "../../../constants";
import { formatCurrency, formatNumberWithDecimals } from "../../../utils";

import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { IconPlus, IconSearch, IconAlertCircle } from "@tabler/icons-react";
import { useDebounce } from "@/hooks/use-debounce";
import { cn } from "@/lib/utils";
import { PageHeader } from "@/components/ui/page-header";

export default function FormulasList() {
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState("");
  const debouncedSearch = useDebounce(searchTerm, 300);
  const [openFormulas, setOpenFormulas] = useState<Set<string>>(new Set());

  const {
    data: formulasResponse,
    isLoading,
    error,
  } = usePaintFormulas({
    searchingFor: debouncedSearch,
    include: {
      paint: true,
      components: {
        include: {
          item: true,
        },
      },
    },
  });

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

  const toggleFormula = (formulaId: string) => {
    setOpenFormulas((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(formulaId)) {
        newSet.delete(formulaId);
      } else {
        newSet.add(formulaId);
      }
      return newSet;
    });
  };

  const handleFormulaClick = (formula: any) => {
    if (formula.paintId) {
      navigate(routes.painting.catalog.formulaDetails(formula.paintId, formula.id));
    }
  };

  if (error) {
    return (
      <div className="container mx-auto px-4 py-6 max-w-7xl">
        <Alert variant="destructive">
          <IconAlertCircle className="h-4 w-4" />
          <AlertDescription>Erro ao carregar fórmulas: {error.message}</AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-gradient-to-b from-background to-muted/20">
      <div className="flex flex-col h-full space-y-4">
        <main className="flex flex-col flex-1 min-h-0">
          {/* Fixed Header Section */}
          <div className="flex-shrink-0 space-y-4">
            {/* Page Header */}
            <PageHeader
              variant="default"
              title="Fórmulas de Tinta"
              icon={IconFlask}
              breadcrumbs={[{ label: "Início", href: routes.home }, { label: "Pintura", href: routes.painting.root }, { label: "Fórmulas" }]}
              actions={[
                {
                  key: "new-formula",
                  label: "Nova Fórmula",
                  icon: IconPlus,
                  onClick: () => navigate(routes.painting.catalog.create + `?step=2`),
                  variant: "default",
                },
              ]}
            />

            {/* Search */}
            <Card className="shadow-sm border border-border" level={1}>
              <CardContent className="p-4 sm:p-6">
                <div className="relative">
                  <IconSearch className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input placeholder="Buscar fórmulas..." value={searchTerm} onChange={(value) => setSearchTerm(typeof value === "string" ? value : "")} className="pl-10" />
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Scrollable Content Section */}
          <div className="flex-1 overflow-auto">
            <div className="space-y-4">
              {/* Loading skeleton */}
              {isLoading &&
                Array.from({ length: 3 }).map((_, index) => (
                  <Card key={index} className="shadow-sm border border-border" level={1}>
                    <CardContent className="p-4 sm:p-6">
                      <div className="flex items-center gap-4">
                        <Skeleton className="h-12 w-12 rounded-lg" />
                        <div className="space-y-2 flex-1">
                          <Skeleton className="h-4 w-[250px]" />
                          <Skeleton className="h-3 w-[200px]" />
                        </div>
                        <Skeleton className="h-6 w-16" />
                      </div>
                    </CardContent>
                  </Card>
                ))}
            </div>

            {/* Content */}
            <section className="space-y-4">
              {!isLoading && formulas.length === 0 ? (
                <Card className="shadow-sm border border-border" level={1}>
                  <CardContent className="pt-4 sm:pt-6">
                    <div className="text-center py-8 sm:py-12 px-4">
                      <IconFlask className="h-10 w-10 sm:h-12 sm:w-12 mx-auto text-muted-foreground/50 mb-4" />
                      <p className="text-sm sm:text-base text-muted-foreground mb-4">
                        {searchTerm ? "Nenhuma fórmula encontrada com esses critérios" : "Nenhuma fórmula cadastrada ainda"}
                      </p>
                      {!searchTerm && (
                        <Button onClick={() => navigate(routes.painting.catalog.root)}>
                          <IconPlus className="h-4 w-4 mr-2" />
                          Criar Primeira Fórmula
                        </Button>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ) : (
                formulas.map((formula) => {
                  const componentCount = formula.components?.length || 0;
                  const hasValidDensity = formula.density && Number(formula.density) > 0;
                  const hasValidPrice = formula.pricePerLiter && Number(formula.pricePerLiter) > 0;

                  return (
                    <Collapsible key={formula.id} open={openFormulas.has(formula.id)} onOpenChange={() => toggleFormula(formula.id)}>
                      <Card className="shadow-sm border border-border overflow-hidden hover:shadow-lg transition-all duration-200" level={1}>
                        <CollapsibleTrigger asChild>
                          <Button variant="ghost" className="w-full p-0 h-auto justify-start hover:bg-transparent">
                            <div className="w-full p-4 sm:p-6">
                              <div className="flex items-center justify-between gap-2">
                                <div className="flex items-center gap-2 sm:gap-4 min-w-0 flex-1">
                                  <div className="p-2 rounded-lg bg-primary/10">
                                    {openFormulas.has(formula.id) ? <IconChevronDown className="h-4 w-4 text-primary" /> : <IconChevronRight className="h-4 w-4 text-primary" />}
                                  </div>
                                  <div className="min-w-0 flex-1">
                                    <h3 className="font-semibold text-sm sm:text-base truncate text-left">
                                      {formula.paint?.name ? `${formula.paint.name}` : ""}
                                      {formula.paint?.name && formula.description ? " - " : ""}
                                      {formula.description || "Fórmula sem descrição"}
                                    </h3>
                                    <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-4 mt-1">
                                      <div className="flex items-center gap-1 text-xs sm:text-sm text-muted-foreground">
                                        <IconCurrencyReal className="h-3 w-3 sm:h-4 sm:w-4" />
                                        <span className="font-mono">{hasValidPrice ? formatCurrency(Number(formula.pricePerLiter)) + "/L" : "-"}</span>
                                      </div>
                                      <div className="flex items-center gap-1 text-xs sm:text-sm text-muted-foreground">
                                        <IconDroplet className="h-3 w-3 sm:h-4 sm:w-4" />
                                        <span className="font-mono">{hasValidDensity ? `${formatNumberWithDecimals(Number(formula.density), 2)} g/ml` : "-"}</span>
                                      </div>
                                    </div>
                                  </div>
                                  <Badge variant="secondary" className="text-xs sm:text-sm whitespace-nowrap">
                                    {componentCount} {componentCount === 1 ? "componente" : "componentes"}
                                  </Badge>
                                </div>
                              </div>
                            </div>
                          </Button>
                        </CollapsibleTrigger>

                        <CollapsibleContent>
                          <Separator />
                          <CardContent className="pt-4 sm:pt-6">
                            {formula.components && formula.components.length > 0 ? (
                              <div className="space-y-4 sm:space-y-6">
                                {/* Components Table */}
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
                                        .sort((a, b) => (b.ratio || 0) - (a.ratio || 0))
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
                                              <div className="px-4 py-2 tabular-nums text-base">{formatNumberWithDecimals(component.ratio || 0, 2)}%</div>
                                            </TableCell>
                                          </TableRow>
                                        ))}
                                    </TableBody>
                                  </Table>
                                </div>

                                {/* Summary */}
                                {(hasValidPrice || hasValidDensity) && (
                                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    {hasValidPrice && (
                                      <div className="flex items-center gap-2 p-3 rounded-lg bg-muted/50">
                                        <IconCurrencyReal className="h-4 w-4 text-primary" />
                                        <span className="text-sm text-muted-foreground">Preço por litro:</span>
                                        <span className="font-mono font-medium">{formatCurrency(Number(formula.pricePerLiter))}</span>
                                      </div>
                                    )}
                                    {hasValidDensity && (
                                      <div className="flex items-center gap-2 p-3 rounded-lg bg-muted/50">
                                        <IconDroplet className="h-4 w-4 text-primary" />
                                        <span className="text-sm text-muted-foreground">Densidade:</span>
                                        <span className="font-mono font-medium">{formatNumberWithDecimals(Number(formula.density), 2)} g/ml</span>
                                      </div>
                                    )}
                                  </div>
                                )}

                                {/* Actions */}
                                <div className="flex justify-end gap-2">
                                  <Button
                                    variant="default"
                                    size="sm"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleFormulaClick(formula);
                                    }}
                                  >
                                    Ver Detalhes
                                  </Button>
                                </div>
                              </div>
                            ) : (
                              <div className="text-center py-8">
                                <p className="text-sm text-muted-foreground mb-4">Esta fórmula não possui componentes cadastrados</p>
                                <Button
                                  variant="default"
                                  size="sm"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleFormulaClick(formula);
                                  }}
                                >
                                  Ver Detalhes
                                </Button>
                              </div>
                            )}
                          </CardContent>
                        </CollapsibleContent>
                      </Card>
                    </Collapsible>
                  );
                })
              )}
            </section>

            {/* Results info */}
            {!isLoading && formulas.length > 0 && (
              <section className="animate-in fade-in-50 duration-1000 pb-4">
                <div className="text-center">
                  <p className="text-sm text-muted-foreground">{formulasResponse?.meta?.totalRecords || formulas.length} fórmula(s) encontrada(s)</p>
                </div>
              </section>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}
