import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { IconFlask, IconChevronDown, IconChevronRight, IconCurrencyReal, IconDroplet, IconFilter } from "@tabler/icons-react";

import { usePaintFormulas } from "../../../hooks";
import { useCurrentUser } from "../../../hooks/common/use-auth";
import { routes, SECTOR_PRIVILEGES } from "../../../constants";
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
import { useDebounce } from "@/hooks/common/use-debounce";
import { cn } from "@/lib/utils";
import { PageHeader } from "@/components/ui/page-header";
import { FormulaFilters } from "@/components/painting/formula/formula-filters";
import type { FormulaFiltersData } from "@/components/painting/formula/formula-filters";

export default function FormulasList() {
  const navigate = useNavigate();
  const { data: currentUser } = useCurrentUser();
  const isWarehouseSector = currentUser?.sector?.privileges === SECTOR_PRIVILEGES.WAREHOUSE;
  const [searchTerm, setSearchTerm] = useState("");
  const debouncedSearch = useDebounce(searchTerm, 300);
  const [openFormulas, setOpenFormulas] = useState<Set<string>>(new Set());
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [sortBy, setSortBy] = useState<"createdAt" | "pricePerLiter" | "density">("createdAt");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");
  const [advancedFilters, setAdvancedFilters] = useState<FormulaFiltersData>({
    paintNames: [],
    hasComponents: "all",
    sortBy: "createdAt",
    sortOrder: "desc",
  });

  const {
    data: formulasResponse,
    isLoading,
    error,
  } = usePaintFormulas({
    searchingFor: debouncedSearch,
    orderBy: { [sortBy]: sortOrder },
    include: {
      paint: {
        include: {
          paintType: true,
          paintBrand: true,
        },
      },
      _count: {
        select: {
          components: true,
        },
      },
      components: {
        include: {
          item: true,
        },
      },
    },
  });

  const formulas = formulasResponse?.data || [];

  // Extract unique paint names for filters
  const availablePaintNames = useMemo(() => {
    const paintNames = new Set<string>();
    formulas.forEach((formula) => {
      if (formula.paint?.name) {
        paintNames.add(formula.paint.name);
      }
    });
    return Array.from(paintNames).sort();
  }, [formulas]);

  // Apply advanced filters
  const filteredFormulas = useMemo(() => {
    let filtered = [...formulas];

    // Filter by paint names
    if (advancedFilters.paintNames && advancedFilters.paintNames.length > 0) {
      filtered = filtered.filter(
        (formula) =>
          formula.paint?.name &&
          advancedFilters.paintNames?.includes(formula.paint.name)
      );
    }

    // Filter by has components
    if (advancedFilters.hasComponents === "with") {
      filtered = filtered.filter(
        (formula) => formula.components && formula.components.length > 0
      );
    } else if (advancedFilters.hasComponents === "without") {
      filtered = filtered.filter(
        (formula) => !formula.components || formula.components.length === 0
      );
    }

    return filtered;
  }, [formulas, advancedFilters]);

  // Check if there are active filters
  const hasActiveFilters = useMemo(() => {
    return (
      (advancedFilters.paintNames?.length || 0) > 0 ||
      advancedFilters.hasComponents !== "all"
    );
  }, [advancedFilters]);

  const totalFilterCount = useMemo(() => {
    let count = 0;
    if (advancedFilters.paintNames?.length) {
      count += advancedFilters.paintNames.length;
    }
    if (advancedFilters.hasComponents !== "all") {
      count += 1;
    }
    if (advancedFilters.sortBy && advancedFilters.sortBy !== "createdAt") {
      count += 1;
    }
    if (advancedFilters.sortOrder && advancedFilters.sortOrder !== "desc") {
      count += 1;
    }
    return count;
  }, [advancedFilters]);

  const handleFilterChange = (filters: FormulaFiltersData) => {
    setAdvancedFilters(filters);
    if (filters.sortBy) setSortBy(filters.sortBy);
    if (filters.sortOrder) setSortOrder(filters.sortOrder);
  };

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
    <div className="h-full flex flex-col px-4 pt-4">
      <PageHeader
        variant="default"
        title="Fórmulas de Tinta"
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
      <div className="flex-1 overflow-y-auto pb-6">
        <div className="mt-4 space-y-4">
          {/* Search and Filters */}
          <Card className="shadow-sm border border-border">
            <CardContent className="p-4 sm:p-4">
              <div className="flex flex-col gap-3 sm:flex-row">
                <div className="relative flex-1">
                  <IconSearch className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input placeholder="Buscar fórmulas..." value={searchTerm} onChange={(value) => setSearchTerm(typeof value === "string" ? value : "")} className="pl-10" />
                </div>
                <Button
                  variant={hasActiveFilters ? "default" : "outline"}
                  size="default"
                  onClick={() => setFiltersOpen(true)}
                  className="group"
                >
                  <IconFilter className="h-4 w-4 text-muted-foreground group-hover:text-foreground transition-colors" />
                  <span className="text-foreground">
                    Filtros
                    {hasActiveFilters ? ` (${totalFilterCount})` : ""}
                  </span>
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Content */}
          {/* Loading skeleton */}
          {isLoading &&
            Array.from({ length: 3 }).map((_, index) => (
              <Card key={index} className="shadow-sm border border-border">
                <CardContent className="p-4 sm:p-4">
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

          {/* Content */}
          {!isLoading && filteredFormulas.length === 0 ? (
            <Card className="shadow-sm border border-border">
              <CardContent className="pt-4 sm:pt-6">
                <div className="text-center py-8 sm:py-12 px-4">
                  <IconFlask className="h-10 w-10 sm:h-12 sm:w-12 mx-auto text-muted-foreground/50 mb-4" />
                  <p className="text-sm sm:text-base text-muted-foreground mb-4">
                    {searchTerm || hasActiveFilters ? "Nenhuma fórmula encontrada com esses critérios" : "Nenhuma fórmula cadastrada ainda"}
                  </p>
                  {!searchTerm && !hasActiveFilters && (
                    <Button onClick={() => navigate(routes.painting.catalog.root)}>
                      <IconPlus className="h-4 w-4 mr-2" />
                      Criar Primeira Fórmula
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          ) : (
            filteredFormulas.map((formula) => {
              const componentCount = formula._count?.components ?? formula.components?.length ?? 0;
              const hasValidDensity = formula.density && Number(formula.density) > 0;
              const hasValidPrice = formula.pricePerLiter && Number(formula.pricePerLiter) > 0;

              return (
                <Collapsible key={formula.id} open={openFormulas.has(formula.id)} onOpenChange={() => toggleFormula(formula.id)}>
                  <Card className="shadow-sm border border-border overflow-hidden hover:shadow-sm hover:border-red-500 transition-all duration-200">
                    <CollapsibleTrigger asChild>
                      <Button variant="ghost" className="w-full p-0 h-auto justify-start hover:bg-transparent">
                        <div className="w-full p-4 sm:p-4">
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
                                  {!isWarehouseSector && (
                                    <div className="flex items-center gap-1 text-xs sm:text-sm text-muted-foreground">
                                      <IconCurrencyReal className="h-3 w-3 sm:h-4 sm:w-4" />
                                      <span className="font-mono">{hasValidPrice ? formatCurrency(Number(formula.pricePerLiter)) + "/L" : "-"}</span>
                                    </div>
                                  )}
                                  <div className="flex items-center gap-1 text-xs sm:text-sm text-muted-foreground">
                                    <IconDroplet className="h-3 w-3 sm:h-4 sm:w-4" />
                                    <span className="font-mono">{hasValidDensity ? `${formatNumberWithDecimals(Number(formula.density), 2)} g/ml` : "-"}</span>
                                  </div>
                                </div>
                                <div className="flex flex-wrap gap-1 mt-2">
                                  <Badge variant="secondary" className="text-xs whitespace-nowrap">
                                    {componentCount} {componentCount === 1 ? "componente" : "componentes"}
                                  </Badge>
                                  {formula.paint?.paintBrand && (
                                    <Badge variant="outline" className="text-xs whitespace-nowrap">
                                      {formula.paint.paintBrand.name}
                                    </Badge>
                                  )}
                                  {formula.paint?.paintType && (
                                    <Badge variant="outline" className="text-xs whitespace-nowrap">
                                      {formula.paint.paintType.name}
                                    </Badge>
                                  )}
                                </div>
                              </div>
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
                                    {!isWarehouseSector && (
                                      <TableHead className="text-right font-semibold text-xs uppercase w-32">Preço</TableHead>
                                    )}
                                    <TableHead className="text-right font-semibold text-xs uppercase w-32">Proporção</TableHead>
                                  </TableRow>
                                </TableHeader>
                                <TableBody>
                                  {formula.components
                                    .sort((a, b) => (b.ratio || 0) - (a.ratio || 0))
                                    .map((component, index) => (
                                      <TableRow
                                        key={component.id}
                                        className={cn("cursor-pointer transition-all border-b border-border border-2 border-transparent hover:border-red-500", index % 2 === 1 && "bg-muted/10", "hover:bg-muted/20")}
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
                                        {!isWarehouseSector && (
                                          <TableCell className="p-0 text-right">
                                            <div className="px-4 py-2 tabular-nums text-base">
                                              {(() => {
                                                const price = calculateComponentPrice(component, formula);
                                                return price !== null ? formatCurrency(price) : "-";
                                              })()}
                                            </div>
                                          </TableCell>
                                        )}
                                        <TableCell className="p-0 text-right">
                                          <div className="px-4 py-2 tabular-nums text-base">{formatNumberWithDecimals(component.ratio || 0, 2)}%</div>
                                        </TableCell>
                                      </TableRow>
                                    ))}
                                </TableBody>
                              </Table>
                            </div>

                            {/* Summary */}
                            {((!isWarehouseSector && hasValidPrice) || hasValidDensity) && (
                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                {!isWarehouseSector && hasValidPrice && (
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

          {/* Results info */}
          {!isLoading && filteredFormulas.length > 0 && (
            <div className="pb-4">
              <div className="text-center">
                <p className="text-sm text-muted-foreground">
                  {filteredFormulas.length} de {formulasResponse?.meta?.totalRecords || formulas.length} fórmula(s) encontrada(s)
                </p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Advanced Filters Modal */}
      <FormulaFilters
        open={filtersOpen}
        onOpenChange={setFiltersOpen}
        filters={advancedFilters}
        onFilterChange={handleFilterChange}
        availablePaintNames={availablePaintNames}
      />
    </div>
  );
}
