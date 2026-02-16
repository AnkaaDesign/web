import { useState, useEffect, useCallback, useRef } from "react";
import type { ItemGetManyFormData } from "../../../../schemas";
import { IconFilter, IconX, IconTriangleInverted, IconUser, IconPackages, IconCategory, IconBrandAsana, IconTruck, IconNumber, IconCurrencyDollar, IconAlertTriangleFilled } from "@tabler/icons-react";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Combobox } from "@/components/ui/combobox";
import { STOCK_LEVEL, STOCK_LEVEL_LABELS, ITEM_CATEGORY_TYPE } from "../../../../constants";
import { getStockLevelTextColor } from "../../../../utils";
import { getItemCategories, getItemBrands, getSuppliers } from "../../../../api-client";

import { SupplierLogoDisplay } from "@/components/ui/avatar-display";
import { cn } from "@/lib/utils";

interface ItemFiltersProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  filters: Partial<ItemGetManyFormData>;
  onFilterChange: (filters: Partial<ItemGetManyFormData>) => void;
}

interface FilterState {
  // Basic filters
  showInactive?: boolean;
  shouldAssignToUser?: boolean;
  stockLevels?: STOCK_LEVEL[];

  // Entity filters
  categoryIds?: string[];
  brandIds?: string[];
  supplierIds?: string[];

  // Range filters
  quantityRange?: { min?: number; max?: number };
  totalPriceRange?: { min?: number; max?: number };

  // Measure filters
  measureUnits?: string[];
  measureTypes?: string[];
}

export function ItemFilters({ open, onOpenChange, filters, onFilterChange }: ItemFiltersProps) {
  const [localState, setLocalState] = useState<FilterState>({});

  // Create caches for fetched items
  const categoryCacheRef = useRef<Map<string, { label: string; value: string }>>(new Map());
  const brandCacheRef = useRef<Map<string, { label: string; value: string }>>(new Map());
  const supplierCacheRef = useRef<Map<string, { label: string; value: string }>>(new Map());

  // Initialize local state from filters only when dialog opens
  useEffect(() => {
    if (!open) return;

    const where = filters.where || {};

    // Convert isActive API filter to showInactive UI state
    let showInactive: boolean | undefined;
    if (typeof filters.isActive === "boolean") {
      showInactive = !filters.isActive;
    } else {
      showInactive = undefined;
    }

    setLocalState({
      showInactive,
      shouldAssignToUser: where.shouldAssignToUser,
      stockLevels: filters.stockLevels as STOCK_LEVEL[] | undefined,
      categoryIds: filters.categoryIds ? (Array.isArray(filters.categoryIds) ? filters.categoryIds : [filters.categoryIds]) : where.categoryId ? [where.categoryId as string] : [],
      brandIds: filters.brandIds ? (Array.isArray(filters.brandIds) ? filters.brandIds : [filters.brandIds]) : where.brandId ? [where.brandId as string] : [],
      supplierIds: filters.supplierIds ? (Array.isArray(filters.supplierIds) ? filters.supplierIds : [filters.supplierIds]) : where.supplierId ? [where.supplierId as string] : [],
      measureUnits: filters.measureUnits || [],
      measureTypes: filters.measureTypes || [],
      quantityRange: filters.quantityRange,
      totalPriceRange: filters.totalPriceRange,
    });
  }, [open, filters]); // Depend on filters to reinitialize when they change

  // Query function for categories
  const queryCategoriesFn = useCallback(async (searchTerm: string, page = 1) => {
    try {
      const queryParams: any = {
        orderBy: { name: "asc" },
        page: page,
        take: 50,
      };

      if (searchTerm && searchTerm.trim()) {
        queryParams.where = {
          name: { contains: searchTerm.trim(), mode: "insensitive" },
        };
      }

      const response = await getItemCategories(queryParams);
      const categories = response.data || [];
      const hasMore = response.meta?.hasNextPage || false;

      const options = categories.map((category) => {
        const label = `${category.name}${category.type === ITEM_CATEGORY_TYPE.PPE ? " (EPI)" : ""}`;
        const option = { label, value: category.id };
        categoryCacheRef.current.set(category.id, option);
        return option;
      });

      return { data: options, hasMore };
    } catch (error) {
      if (process.env.NODE_ENV !== 'production') {
        console.error("Error fetching categories:", error);
      }
      return { data: [], hasMore: false };
    }
  }, []);

  // Query function for brands
  const queryBrandsFn = useCallback(async (searchTerm: string, page = 1) => {
    try {
      const queryParams: any = {
        orderBy: { name: "asc" },
        page: page,
        take: 50,
      };

      if (searchTerm && searchTerm.trim()) {
        queryParams.where = {
          name: { contains: searchTerm.trim(), mode: "insensitive" },
        };
      }

      const response = await getItemBrands(queryParams);
      const brands = response.data || [];
      const hasMore = response.meta?.hasNextPage || false;

      const options = brands.map((brand) => {
        const option = { label: brand.name, value: brand.id };
        brandCacheRef.current.set(brand.id, option);
        return option;
      });

      return { data: options, hasMore };
    } catch (error) {
      if (process.env.NODE_ENV !== 'production') {
        console.error("Error fetching brands:", error);
      }
      return { data: [], hasMore: false };
    }
  }, []);

  // Query function for suppliers
  const querySuppliersFn = useCallback(async (searchTerm: string, page = 1) => {
    try {
      const queryParams: any = {
        orderBy: { fantasyName: "asc" },
        page: page,
        take: 50,
        include: { logo: true },
      };

      if (searchTerm && searchTerm.trim()) {
        queryParams.where = {
          OR: [
            { fantasyName: { contains: searchTerm.trim(), mode: "insensitive" } },
            { corporateName: { contains: searchTerm.trim(), mode: "insensitive" } },
          ],
        };
      }

      const response = await getSuppliers(queryParams);
      const suppliers = response.data || [];
      const hasMore = response.meta?.hasNextPage || false;

      const options = suppliers.map((supplier) => {
        const option = {
          label: supplier.fantasyName,
          value: supplier.id,
          logo: supplier.logo,
        };
        supplierCacheRef.current.set(supplier.id, option);
        return option;
      });

      return { data: options, hasMore };
    } catch (error) {
      if (process.env.NODE_ENV !== 'production') {
        console.error("Error fetching suppliers:", error);
      }
      return { data: [], hasMore: false };
    }
  }, []);

  const handleApply = () => {
    // Start with existing filters but REMOVE isActive to ensure clean state
    const baseFilters = { ...filters };
    delete baseFilters.isActive;
    delete baseFilters.showInactive;

    // Build the filters object from local state
    const newFilters: Partial<ItemGetManyFormData> = {
      ...baseFilters,
      limit: filters.limit,
      orderBy: filters.orderBy,
      // Add stock levels array filter
      ...(localState.stockLevels && localState.stockLevels.length > 0 && { stockLevels: localState.stockLevels }),
      quantityRange: localState.quantityRange,
      totalPriceRange: localState.totalPriceRange,
    };

    // Map showInactive UI state to isActive API filter (at root level)
    // - showInactive: false → isActive: true (only active items)
    // - showInactive: true → isActive: false (only inactive items)
    // - showInactive: undefined → no isActive filter (both active and inactive)
    if (typeof localState.showInactive === "boolean") {
      newFilters.isActive = !localState.showInactive;
    } else {
      // Explicitly ensure isActive is not set
      delete newFilters.isActive;
    }

    // Build where clause
    const where: any = {};

    // Basic boolean filters - include both true and false values
    if (typeof localState.shouldAssignToUser === "boolean") where.shouldAssignToUser = localState.shouldAssignToUser;

    // Entity filters - these go at the root level, not in where clause
    if (localState.categoryIds && localState.categoryIds.length > 0) {
      newFilters.categoryIds = localState.categoryIds;
    }
    if (localState.brandIds && localState.brandIds.length > 0) {
      newFilters.brandIds = localState.brandIds;
    }
    if (localState.supplierIds && localState.supplierIds.length > 0) {
      newFilters.supplierIds = localState.supplierIds;
    }

    // Add measure units to the main filters (not in where clause)
    if (localState.measureUnits && localState.measureUnits.length > 0) {
      newFilters.measureUnits = localState.measureUnits;
    }
    if (localState.measureTypes && localState.measureTypes.length > 0) {
      newFilters.measureTypes = localState.measureTypes;
    }

    if (Object.keys(where).length > 0) {
      newFilters.where = where;
    }

    // Apply filters first, then close dialog with a small delay to avoid ref issues
    onFilterChange(newFilters);
    // Use setTimeout to ensure filter changes are processed before dialog closes
    setTimeout(() => {
      onOpenChange(false);
    }, 0);
  };

  const handleReset = () => {
    const resetFilters: Partial<ItemGetManyFormData> = {
      limit: filters.limit || 40,
      orderBy: filters.orderBy || { name: "asc" },
    };
    setLocalState({});
    onFilterChange(resetFilters);
    // Use setTimeout to ensure filter changes are processed before dialog closes
    setTimeout(() => {
      onOpenChange(false);
    }, 0);
  };

  // Count active filters
  const countActiveFilters = () => {
    let count = 0;
    if (localState.showInactive) count++;
    if (typeof localState.shouldAssignToUser === "boolean") count++;
    if (localState.stockLevels && localState.stockLevels.length > 0) count += localState.stockLevels.length;
    if (localState.categoryIds?.length) count++;
    if (localState.brandIds?.length) count++;
    if (localState.supplierIds?.length) count++;
    if (localState.measureUnits?.length) count++;
    if (localState.measureTypes?.length) count++;
    if (localState.quantityRange?.min || localState.quantityRange?.max) count++;
    if (localState.totalPriceRange?.min || localState.totalPriceRange?.max) count++;
    return count;
  };

  const activeFilterCount = countActiveFilters();

  // Stock level options for the combobox with colors
  const stockLevelOptions = Object.values(STOCK_LEVEL).map((level) => {
    const colorClass = getStockLevelTextColor(level);
    return {
      value: level,
      label: STOCK_LEVEL_LABELS[level],
      className: colorClass,
      icon: IconAlertTriangleFilled,
    };
  });

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <IconFilter className="h-5 w-5" />
            Itens - Filtros
            {activeFilterCount > 0 && (
              <Badge
                variant="secondary"
                className="ml-2 cursor-pointer hover:bg-destructive hover:text-destructive-foreground transition-colors"
                onClick={handleReset}
                title="Clique para limpar todos os filtros"
              >
                {activeFilterCount}
              </Badge>
            )}
          </SheetTitle>
          <SheetDescription>Configure filtros para refinar a pesquisa de itens</SheetDescription>
        </SheetHeader>

        <div className="mt-6 space-y-6">
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

          {/* Atribuir ao Usuário Filter */}
          <div className="space-y-2">
            <Label className="flex items-center gap-2">
              <IconUser className="h-4 w-4" />
              Atribuir ao usuário
            </Label>
            <Combobox
              mode="single"
              options={[
                { value: "ambos", label: "Ambos" },
                { value: "sim", label: "Sim" },
                { value: "nao", label: "Não" },
              ]}
              value={
                localState.shouldAssignToUser === true ? "sim" : localState.shouldAssignToUser === false ? "nao" : "ambos"
              }
              onValueChange={(value) => {
                setLocalState((prev) => ({
                  ...prev,
                  shouldAssignToUser: value === "sim" ? true : value === "nao" ? false : undefined,
                }));
              }}
              placeholder="Selecione..."
              emptyText="Nenhuma opção encontrada"
            />
          </div>

          {/* Stock Status Filter */}
          <div className="space-y-2">
            <Label className="flex items-center gap-2">
              <IconPackages className="h-4 w-4" />
              Status de Estoque
            </Label>
            <Combobox
              mode="multiple"
              options={stockLevelOptions}
              value={localState.stockLevels || []}
              onValueChange={(value) => {
                if (!value || (Array.isArray(value) && value.length === 0)) {
                  setLocalState((prev) => ({
                    ...prev,
                    stockLevels: undefined,
                  }));
                } else {
                  setLocalState((prev) => ({
                    ...prev,
                    stockLevels: value as STOCK_LEVEL[],
                  }));
                }
              }}
              placeholder="Selecione status de estoque..."
              emptyText="Nenhum status encontrado"
              searchPlaceholder="Buscar status..."
              renderOption={(option, _isSelected) => {
                const Icon = option.icon;
                return (
                  <div className="flex items-center gap-2">
                    {Icon && <Icon className={cn("h-4 w-4", option.className, "group-hover:!text-white")} />}
                    <span className={cn(option.className, "group-hover:!text-white")}>{option.label}</span>
                  </div>
                );
              }}
            />
            {localState.stockLevels && localState.stockLevels.length > 0 && (
              <div className="text-xs text-muted-foreground">
                {localState.stockLevels.length} status selecionado{localState.stockLevels.length !== 1 ? "s" : ""}
              </div>
            )}
          </div>

          {/* Category Filter */}
          <div className="space-y-2">
            <Label className="flex items-center gap-2">
              <IconCategory className="h-4 w-4" />
              Categoria
            </Label>
            <Combobox
              async={true}
              queryKey={["item-categories", "filter"]}
              queryFn={queryCategoriesFn}
              initialOptions={[]}
              value={localState.categoryIds || []}
              onValueChange={(value) => {
                if (!value || (Array.isArray(value) && value.length === 0)) {
                  setLocalState((prev) => ({
                    ...prev,
                    categoryIds: undefined,
                  }));
                } else {
                  setLocalState((prev) => ({
                    ...prev,
                    categoryIds: value as string[],
                  }));
                }
              }}
              placeholder="Selecione categorias..."
              emptyText="Nenhuma categoria encontrada"
              searchPlaceholder="Buscar categorias..."
              mode="multiple"
              minSearchLength={0}
              pageSize={50}
              debounceMs={300}
            />
            {localState.categoryIds && localState.categoryIds.length > 0 && (
              <div className="text-xs text-muted-foreground">
                {localState.categoryIds.length} categoria{localState.categoryIds.length !== 1 ? "s" : ""} selecionada{localState.categoryIds.length !== 1 ? "s" : ""}
              </div>
            )}
          </div>

          {/* Brand Filter */}
          <div className="space-y-2">
            <Label className="flex items-center gap-2">
              <IconBrandAsana className="h-4 w-4" />
              Marca
            </Label>
            <Combobox
              async={true}
              queryKey={["item-brands", "filter"]}
              queryFn={queryBrandsFn}
              initialOptions={[]}
              value={localState.brandIds || []}
              onValueChange={(value) => {
                if (!value || (Array.isArray(value) && value.length === 0)) {
                  setLocalState((prev) => ({
                    ...prev,
                    brandIds: undefined,
                  }));
                } else {
                  setLocalState((prev) => ({
                    ...prev,
                    brandIds: value as string[],
                  }));
                }
              }}
              placeholder="Selecione marcas..."
              emptyText="Nenhuma marca encontrada"
              searchPlaceholder="Buscar marcas..."
              mode="multiple"
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

          {/* Supplier Filter */}
          <div className="space-y-2">
            <Label className="flex items-center gap-2">
              <IconTruck className="h-4 w-4" />
              Fornecedor
            </Label>
            <Combobox
              async={true}
              queryKey={["suppliers", "filter"]}
              queryFn={querySuppliersFn}
              initialOptions={[]}
              value={localState.supplierIds || []}
              onValueChange={(value) => {
                if (!value || (Array.isArray(value) && value.length === 0)) {
                  setLocalState((prev) => ({
                    ...prev,
                    supplierIds: undefined,
                  }));
                } else {
                  setLocalState((prev) => ({
                    ...prev,
                    supplierIds: value as string[],
                  }));
                }
              }}
              placeholder="Selecione fornecedores..."
              emptyText="Nenhum fornecedor encontrado"
              searchPlaceholder="Buscar fornecedores..."
              mode="multiple"
              minSearchLength={0}
              pageSize={50}
              debounceMs={300}
              renderOption={(option, _isSelected) => (
                <div className="flex items-center gap-3 w-full">
                  <SupplierLogoDisplay
                    logo={(option as any).logo}
                    supplierName={option.label}
                    size="sm"
                    shape="rounded"
                    className="flex-shrink-0"
                  />
                  <div className="flex flex-col gap-1 min-w-0 flex-1">
                    <div className="font-medium truncate">{option.label}</div>
                  </div>
                </div>
              )}
            />
            {localState.supplierIds && localState.supplierIds.length > 0 && (
              <div className="text-xs text-muted-foreground">
                {localState.supplierIds.length} fornecedor{localState.supplierIds.length !== 1 ? "es" : ""} selecionado{localState.supplierIds.length !== 1 ? "s" : ""}
              </div>
            )}
          </div>

          {/* Quantity Range Filter */}
          <div className="space-y-2">
            <Label className="text-sm font-medium flex items-center gap-2">
              <IconNumber className="h-4 w-4" />
              Faixa de Quantidade
            </Label>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label htmlFor="quantityMin" className="text-xs text-muted-foreground">
                  Mínimo
                </Label>
                <Input
                  id="quantityMin"
                  type="decimal"
                  min={0}
                  step={0.01}
                  placeholder="0"
                  value={localState.quantityRange?.min ?? null}
                  onChange={(value) => {
                    const min = typeof value === "number" ? value : undefined;
                    setLocalState((prev) => ({
                      ...prev,
                      quantityRange: {
                        ...prev.quantityRange,
                        min,
                      },
                    }));
                  }}
                  className="bg-transparent"
                />
              </div>
              <div>
                <Label htmlFor="quantityMax" className="text-xs text-muted-foreground">
                  Máximo
                </Label>
                <Input
                  id="quantityMax"
                  type="decimal"
                  min={0}
                  step={0.01}
                  placeholder="∞"
                  value={localState.quantityRange?.max ?? null}
                  onChange={(value) => {
                    const max = typeof value === "number" ? value : undefined;
                    setLocalState((prev) => ({
                      ...prev,
                      quantityRange: {
                        ...prev.quantityRange,
                        max,
                      },
                    }));
                  }}
                  className="bg-transparent"
                />
              </div>
            </div>
          </div>

          {/* Price Range Filter */}
          <div className="space-y-2">
            <Label className="text-sm font-medium flex items-center gap-2">
              <IconCurrencyDollar className="h-4 w-4" />
              Faixa de Preço
            </Label>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label htmlFor="priceMin" className="text-xs text-muted-foreground">
                  Mínimo
                </Label>
                <Input
                  id="priceMin"
                  type="currency"
                  placeholder="R$ 0,00"
                  value={localState.totalPriceRange?.min ?? undefined}
                  onChange={(value) => {
                    const min = typeof value === "number" ? value : undefined;
                    setLocalState((prev) => ({
                      ...prev,
                      totalPriceRange: {
                        ...prev.totalPriceRange,
                        min,
                      },
                    }));
                  }}
                  className="bg-transparent"
                />
              </div>
              <div>
                <Label htmlFor="priceMax" className="text-xs text-muted-foreground">
                  Máximo
                </Label>
                <Input
                  id="priceMax"
                  type="currency"
                  placeholder="R$ ∞"
                  value={localState.totalPriceRange?.max ?? undefined}
                  onChange={(value) => {
                    const max = typeof value === "number" ? value : undefined;
                    setLocalState((prev) => ({
                      ...prev,
                      totalPriceRange: {
                        ...prev.totalPriceRange,
                        max,
                      },
                    }));
                  }}
                  className="bg-transparent"
                />
              </div>
            </div>
          </div>

          {/* Medidas (Measure Units) - simplified without quick filters */}
          {/* Note: The user requested "Medidas (without quick filters)" so I'm keeping it simple */}
          {/* This could be expanded based on specific requirements */}

          {/* Action Buttons */}
          <div className="flex gap-2 mt-6 pt-4 border-t">
            <Button variant="outline" onClick={handleReset} className="flex-1">
              <IconX className="h-4 w-4 mr-2" />
              Limpar todos
            </Button>
            <Button onClick={handleApply} className="flex-1">
              Aplicar filtros
              {activeFilterCount > 0 && (
                <Badge variant="secondary" className="ml-2">
                  {activeFilterCount}
                </Badge>
              )}
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
