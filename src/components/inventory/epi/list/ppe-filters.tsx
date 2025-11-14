import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { DateTimeInput } from "@/components/ui/date-time-input";
import { Combobox } from "@/components/ui/combobox";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { IconFilter, IconX, IconShield, IconBrandApple, IconCalendarPlus, IconTriangleInverted } from "@tabler/icons-react";
import { getItemBrands } from "../../../../api-client";
import type { ItemGetManyFormData } from "../../../../schemas";
import { PPE_TYPE, PPE_TYPE_LABELS, ITEM_CATEGORY_TYPE } from "../../../../constants";

interface PpeFiltersProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  filters: Partial<ItemGetManyFormData>;
  onFilterChange: (filters: Partial<ItemGetManyFormData>) => void;
}

interface FilterState {
  // Brand filters
  brandIds?: string[];

  // PPE type filter
  ppeType?: string[];

  // Date range filters
  createdAtRange?: { gte?: Date; lte?: Date };

  // Show inactive items
  showInactive?: boolean;
}

export function PpeFilters({ open, onOpenChange, filters, onFilterChange }: PpeFiltersProps) {
  const [localState, setLocalState] = useState<FilterState>({});

  // Create a stable cache for fetched brands
  const cacheRef = useRef<Map<string, { label: string; value: string }>>(new Map());

  // Initialize local state when dialog opens
  useEffect(() => {
    if (!open) return;

    // Convert isActive API filter to showInactive UI state
    let showInactive: boolean | undefined;
    if (typeof filters.isActive === "boolean") {
      showInactive = !filters.isActive;
    }

    setLocalState({
      brandIds: filters.brandIds || [],
      ppeType: filters.ppeType || [],
      createdAtRange: filters.createdAt,
      showInactive,
    });
  }, [open, filters]);

  // Async query function for brands
  const queryBrands = useCallback(async (searchTerm: string, page = 1) => {
    try {
      const queryParams: any = {
        orderBy: { name: "asc" },
        page: page,
        take: 50,
      };

      // Only add searchingFor if there's a search term
      if (searchTerm && searchTerm.trim()) {
        queryParams.searchingFor = searchTerm.trim();
      }

      const response = await getItemBrands(queryParams);
      const brands = response.data || [];
      const hasMore = response.meta?.hasNextPage || false;

      // Convert brands to options format and add to cache
      const options = brands.map((brand) => {
        const option = {
          value: brand.id,
          label: brand.name,
        };
        cacheRef.current.set(brand.id, option);
        return option;
      });

      return {
        data: options,
        hasMore: hasMore,
      };
    } catch (error) {
      console.error("Error fetching brands:", error);
      return {
        data: [],
        hasMore: false,
      };
    }
  }, []);

  // Get initial options from cache for selected brand IDs
  const initialBrandOptions = useMemo(() => {
    if (!localState.brandIds?.length) return [];
    return localState.brandIds
      .map(id => cacheRef.current.get(id))
      .filter((opt): opt is { label: string; value: string } => opt !== undefined);
  }, [localState.brandIds]);

  const handleApply = () => {
    // Start with existing filters but REMOVE isActive to ensure clean state
    const baseFilters = { ...filters };
    delete baseFilters.isActive;

    // Build the filters object from local state
    const newFilters: Partial<ItemGetManyFormData> = {
      ...baseFilters,
      limit: filters.limit,
      orderBy: filters.orderBy,
      include: filters.include,
      page: 1, // Reset to first page when applying filters
      where: {
        category: {
          type: ITEM_CATEGORY_TYPE.PPE,
        },
      },
    };

    // Map showInactive UI state to isActive API filter (at root level)
    if (typeof localState.showInactive === "boolean") {
      newFilters.isActive = !localState.showInactive;
    } else {
      delete newFilters.isActive;
    }

    // Add non-empty filters
    if (localState.brandIds?.length) {
      newFilters.brandIds = localState.brandIds;
    }

    if (localState.ppeType?.length) {
      newFilters.ppeType = localState.ppeType as PPE_TYPE[];
    }

    // Date range filters
    if (localState.createdAtRange?.gte || localState.createdAtRange?.lte) {
      newFilters.createdAt = localState.createdAtRange;
    }

    onFilterChange(newFilters);
    onOpenChange(false);
  };

  const handleReset = () => {
    const resetFilters: Partial<ItemGetManyFormData> = {
      limit: filters.limit || 40,
      orderBy: filters.orderBy || { name: "asc" },
      where: {
        category: {
          type: ITEM_CATEGORY_TYPE.PPE,
        },
      },
    };
    setLocalState({});
    onFilterChange(resetFilters);
    setTimeout(() => {
      onOpenChange(false);
    }, 0);
  };

  // Count active filters
  const countActiveFilters = () => {
    let count = 0;
    if (localState.brandIds?.length) count++;
    if (localState.ppeType?.length) count++;
    if (localState.createdAtRange?.gte || localState.createdAtRange?.lte) count++;
    if (typeof localState.showInactive === "boolean") count++;
    return count;
  };

  const activeFilterCount = countActiveFilters();

  // Transform data for comboboxes
  const ppeTypeOptions = Object.entries(PPE_TYPE_LABELS).map(([value, label]) => ({
    value,
    label,
  }));

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-lg overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <IconFilter className="h-5 w-5" />
            EPIs - Filtros
            {activeFilterCount > 0 && (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Badge variant="secondary" className="ml-2 cursor-pointer hover:bg-destructive hover:text-destructive-foreground transition-colors" onClick={handleReset}>
                      {activeFilterCount}
                    </Badge>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Clique para limpar todos os filtros</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )}
          </SheetTitle>
          <SheetDescription>Configure filtros para refinar sua pesquisa de EPIs</SheetDescription>
        </SheetHeader>

        <div className="mt-6 space-y-6">
          {/* Brand Filter */}
          <div className="grid gap-2">
            <Label className="flex items-center gap-2">
              <IconBrandApple className="h-4 w-4" />
              Marcas
            </Label>
            <Combobox
              async={true}
              queryKey={["item-brands-filter"]}
              queryFn={queryBrands}
              initialOptions={initialBrandOptions}
              mode="multiple"
              value={localState.brandIds || []}
              onValueChange={(value) => setLocalState((prev) => ({ ...prev, brandIds: value }))}
              placeholder="Selecione marcas..."
              emptyText="Nenhuma marca encontrada"
              searchPlaceholder="Buscar marcas..."
              minSearchLength={0}
              pageSize={50}
              debounceMs={300}
            />
            {localState.brandIds && localState.brandIds.length > 0 && (
              <div className="text-xs text-muted-foreground">
                {localState.brandIds.length} marca{localState.brandIds.length !== 1 ? "s" : ""} selecionada{localState.brandIds.length !== 1 ? "s" : ""}
              </div>
            )}
          </div>

          {/* PPE Type Filter */}
          <div className="grid gap-2">
            <Label className="flex items-center gap-2">
              <IconShield className="h-4 w-4" />
              Tipos de EPI
            </Label>
            <Combobox
              mode="multiple"
              options={ppeTypeOptions}
              value={localState.ppeType || []}
              onValueChange={(value) => setLocalState((prev) => ({ ...prev, ppeType: value }))}
              placeholder="Selecione tipos de EPI..."
              emptyText="Nenhum tipo encontrado"
              searchPlaceholder="Buscar tipos..."
            />
            {localState.ppeType && localState.ppeType.length > 0 && (
              <div className="text-xs text-muted-foreground">
                {localState.ppeType.length} tipo{localState.ppeType.length !== 1 ? "s" : ""} selecionado{localState.ppeType.length !== 1 ? "s" : ""}
              </div>
            )}
          </div>

          {/* Status Filter */}
          <div className="space-y-2">
            <Label className="flex items-center gap-2">
              <IconTriangleInverted className="h-4 w-4" />
              Status
            </Label>
            <Combobox
              mode="single"
              options={[
                { value: "ambos", label: "Ambos" },
                { value: "ativo", label: "Ativo" },
                { value: "inativo", label: "Inativo" },
              ]}
              value={
                localState.showInactive === true ? "inativo" :
                localState.showInactive === false ? "ativo" :
                "ambos"
              }
              onValueChange={(value) => {
                setLocalState((prev) => ({
                  ...prev,
                  showInactive: value === "inativo" ? true : value === "ativo" ? false : undefined,
                }));
              }}
              placeholder="Selecione..."
              emptyText="Nenhuma opção encontrada"
            />
          </div>

          {/* Created At Date Range */}
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-sm font-medium">
              <IconCalendarPlus className="h-4 w-4" />
              Data de Criação
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs text-muted-foreground mb-1 block">De</Label>
                <DateTimeInput
                  mode="date"
                  value={localState.createdAtRange?.gte}
                  onChange={(date: Date | null) => {
                    if (!date && !localState.createdAtRange?.lte) {
                      setLocalState((prev) => ({ ...prev, createdAtRange: undefined }));
                    } else {
                      setLocalState((prev) => ({
                        ...prev,
                        createdAtRange: {
                          ...(date && { gte: date }),
                          ...(localState.createdAtRange?.lte && { lte: localState.createdAtRange.lte }),
                        },
                      }));
                    }
                  }}
                  hideLabel
                  placeholder="Selecionar data inicial..."
                />
              </div>
              <div>
                <Label className="text-xs text-muted-foreground mb-1 block">Até</Label>
                <DateTimeInput
                  mode="date"
                  value={localState.createdAtRange?.lte}
                  onChange={(date: Date | null) => {
                    if (!date && !localState.createdAtRange?.gte) {
                      setLocalState((prev) => ({ ...prev, createdAtRange: undefined }));
                    } else {
                      setLocalState((prev) => ({
                        ...prev,
                        createdAtRange: {
                          ...(localState.createdAtRange?.gte && { gte: localState.createdAtRange.gte }),
                          ...(date && { lte: date }),
                        },
                      }));
                    }
                  }}
                  hideLabel
                  placeholder="Selecionar data final..."
                />
              </div>
            </div>
          </div>
        </div>

        <div className="flex gap-2 mt-6 pt-4 border-t">
          <Button variant="outline" onClick={handleReset} className="flex-1 flex items-center gap-2">
            <IconX className="h-4 w-4" />
            Limpar Tudo
          </Button>
          <Button onClick={handleApply} className="flex-1">Aplicar</Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
