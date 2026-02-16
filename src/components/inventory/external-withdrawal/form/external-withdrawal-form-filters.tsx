import { useState, useEffect } from "react";
import type { ItemGetManyFormData } from "../../../../schemas";
import type { ItemCategory, ItemBrand, Supplier } from "../../../../types";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Combobox } from "@/components/ui/combobox";
import { IconFilter, IconX, IconSearch, IconTag } from "@tabler/icons-react";
import { useItemBrands, useItemCategories, useSuppliers } from "../../../../hooks";

interface ExternalWithdrawalFormFiltersProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  filters: Partial<ItemGetManyFormData>;
  onFilterChange: (filters: Partial<ItemGetManyFormData>) => void;
}

interface FilterState {
  // Basic filters
  showInactive?: boolean;

  // Entity filters
  categoryIds?: string[];
  brandIds?: string[];
  supplierIds?: string[];
}

export function ExternalWithdrawalFormFilters({ open, onOpenChange, filters, onFilterChange }: ExternalWithdrawalFormFiltersProps) {
  const [localState, setLocalState] = useState<FilterState>({});

  // Load entity data
  const { data: categoriesResponse, isLoading: loadingCategories } = useItemCategories({
    orderBy: { name: "asc" },
    where: { status: "ACTIVE" },
  });
  const { data: brandsResponse, isLoading: loadingBrands } = useItemBrands({
    orderBy: { name: "asc" },
    where: { status: "ACTIVE" },
  });
  const { data: suppliersResponse, isLoading: loadingSuppliers } = useSuppliers({
    orderBy: { fantasyName: "asc" },
    where: { status: "ACTIVE" },
  });

  const categories = categoriesResponse?.data || [];
  const brands = brandsResponse?.data || [];
  const suppliers = suppliersResponse?.data || [];

  // Initialize local state from filters when dialog opens
  useEffect(() => {
    if (!open) return;

    // Extract current filter values
    const currentState: FilterState = {
      showInactive: filters.showInactive || false,
      categoryIds: [],
      brandIds: [],
      supplierIds: [],
    };

    // Handle where clause filters
    const where = filters.where || {};
    if (where.categoryId) {
      if (typeof where.categoryId === "string") {
        currentState.categoryIds = [where.categoryId];
      } else if (where.categoryId.in) {
        currentState.categoryIds = where.categoryId.in;
      }
    }

    if (where.brandId) {
      if (typeof where.brandId === "string") {
        currentState.brandIds = [where.brandId];
      } else if (where.brandId.in) {
        currentState.brandIds = where.brandId.in;
      }
    }

    if (where.supplierId) {
      if (typeof where.supplierId === "string") {
        currentState.supplierIds = [where.supplierId];
      } else if (where.supplierId.in) {
        currentState.supplierIds = where.supplierId.in;
      }
    }

    // Handle root-level filter arrays (preferred format)
    if (filters.categoryIds) {
      currentState.categoryIds = Array.isArray(filters.categoryIds) ? filters.categoryIds : [filters.categoryIds];
    }
    if (filters.brandIds) {
      currentState.brandIds = Array.isArray(filters.brandIds) ? filters.brandIds : [filters.brandIds];
    }
    if (filters.supplierIds) {
      currentState.supplierIds = Array.isArray(filters.supplierIds) ? filters.supplierIds : [filters.supplierIds];
    }

    setLocalState(currentState);
  }, [open, filters]);

  const handleApply = () => {
    // Build the filters object from local state
    const newFilters: Partial<ItemGetManyFormData> = {
      // Preserve existing configuration
      limit: filters.limit,
      orderBy: filters.orderBy,
      take: filters.take,
      searchingFor: filters.searchingFor,
      include: filters.include,
    };

    // Add basic filters
    if (localState.showInactive) {
      newFilters.showInactive = true;
    }

    // Build where clause for proper Prisma filtering
    const where: any = {
      // Preserve base filters for external withdrawal items
      isActive: localState.showInactive ? undefined : true,
      quantity: { gt: 0 }, // Only show items with available stock
    };

    // Entity filters using the 'in' operator for multiple selections
    if (localState.categoryIds && localState.categoryIds.length > 0) {
      if (localState.categoryIds.includes("null")) {
        // Handle "no category" case
        const otherIds = localState.categoryIds.filter((id) => id !== "null");
        if (otherIds.length > 0) {
          where.OR = [{ categoryId: null }, { categoryId: { in: otherIds } }];
        } else {
          where.categoryId = null;
        }
      } else {
        where.categoryId = { in: localState.categoryIds };
      }
    }

    if (localState.brandIds && localState.brandIds.length > 0) {
      if (localState.brandIds.includes("null")) {
        // Handle "no brand" case
        const otherIds = localState.brandIds.filter((id) => id !== "null");
        if (otherIds.length > 0) {
          where.OR = [...(where.OR || []), { brandId: null }, { brandId: { in: otherIds } }];
        } else {
          where.brandId = null;
        }
      } else {
        where.brandId = { in: localState.brandIds };
      }
    }

    if (localState.supplierIds && localState.supplierIds.length > 0) {
      if (localState.supplierIds.includes("null")) {
        // Handle "no supplier" case
        const otherIds = localState.supplierIds.filter((id) => id !== "null");
        if (otherIds.length > 0) {
          where.OR = [...(where.OR || []), { supplierId: null }, { supplierId: { in: otherIds } }];
        } else {
          where.supplierId = null;
        }
      } else {
        where.supplierId = { in: localState.supplierIds };
      }
    }

    // Always add where clause for external withdrawal filters
    newFilters.where = where;

    // Apply filters and close dialog
    onFilterChange(newFilters);
    onOpenChange(false);
  };

  const handleReset = () => {
    // Reset to clean filters while preserving essential configuration
    const resetFilters: Partial<ItemGetManyFormData> = {
      limit: filters.limit || 40,
      orderBy: filters.orderBy || { name: "asc" },
      take: filters.take,
      searchingFor: filters.searchingFor,
      include: filters.include,
      where: {
        isActive: true,
        quantity: { gt: 0 },
      },
    };

    setLocalState({});
    onFilterChange(resetFilters);
    onOpenChange(false);
  };

  // Count active filters
  const countActiveFilters = () => {
    let count = 0;
    if (localState.showInactive) count++;
    if (localState.categoryIds?.length) count++;
    if (localState.brandIds?.length) count++;
    if (localState.supplierIds?.length) count++;
    return count;
  };

  const activeFilterCount = countActiveFilters();

  // Transform data for combobox
  const categoryOptions = [
    // Add "Sem categoria" option first
    { value: "null", label: "Sem categoria" },
    ...categories.map((category: ItemCategory) => ({
      value: category.id,
      label: category.name,
    })),
  ];

  const brandOptions = [
    // Add "Sem marca" option first
    { value: "null", label: "Sem marca" },
    ...brands.map((brand: ItemBrand) => ({
      value: brand.id,
      label: brand.name,
    })),
  ];

  const supplierOptions = [
    // Add "Sem fornecedor" option first
    { value: "null", label: "Sem fornecedor" },
    ...suppliers.map((supplier: Supplier) => ({
      value: supplier.id,
      label: supplier.fantasyName || supplier.corporateName || "Sem nome",
    })),
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] h-[70vh] max-h-[700px] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <IconFilter className="h-5 w-5 text-muted-foreground" />
            Filtros de Seleção de Itens - Retirada Externa
            {activeFilterCount > 0 && (
              <Badge variant="secondary" className="ml-2">
                {activeFilterCount}
              </Badge>
            )}
          </DialogTitle>
          <DialogDescription>Configure filtros para refinar a seleção de itens para retirada externa</DialogDescription>
        </DialogHeader>

        <div className="flex-1 flex flex-col overflow-hidden">
          <Tabs defaultValue="basic" className="flex flex-col flex-1 overflow-hidden">
            <TabsList className="grid w-full grid-cols-2 flex-shrink-0">
              <TabsTrigger value="basic" className="flex items-center gap-2">
                <IconSearch className="h-4 w-4" />
                Básico
              </TabsTrigger>
              <TabsTrigger value="entities" className="flex items-center gap-2">
                <IconTag className="h-4 w-4" />
                Categorias e Marcas
              </TabsTrigger>
            </TabsList>

            <div className="flex-1 overflow-hidden mt-4">
              <TabsContent value="basic" className="h-full overflow-auto p-4">
                <div className="space-y-4">
                  {/* Status Switches */}
                  <div className="space-y-3">
                    <Label className="text-sm font-medium">Opções de Exibição</Label>

                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <Label htmlFor="showInactive" className="text-sm font-normal">
                          Mostrar também desativados
                        </Label>
                        <Switch
                          id="showInactive"
                          checked={localState.showInactive ?? false}
                          onCheckedChange={(checked) => setLocalState((prev) => ({ ...prev, showInactive: checked }))}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="entities" className="h-full overflow-auto p-4">
                <div className="space-y-4">
                  {/* Categories */}
                  <div className="space-y-2">
                    <Label>Categorias</Label>
                    <Combobox
                      mode="multiple"
                      options={categoryOptions}
                      value={localState.categoryIds || []}
                      onValueChange={(ids) => setLocalState((prev) => ({ ...prev, categoryIds: Array.isArray(ids) ? ids : ids ? [ids] : [] }))}
                      placeholder="Selecione categorias..."
                      emptyText="Nenhuma categoria encontrada"
                      searchPlaceholder="Buscar categorias..."
                      disabled={loadingCategories}
                    />
                    {(localState.categoryIds?.length || 0) > 0 && (
                      <div className="text-xs text-muted-foreground">
                        {localState.categoryIds?.length} categoria{(localState.categoryIds?.length || 0) !== 1 ? "s" : ""} selecionada
                        {(localState.categoryIds?.length || 0) !== 1 ? "s" : ""}
                      </div>
                    )}
                  </div>

                  {/* Brands */}
                  <div className="space-y-2">
                    <Label>Marcas</Label>
                    <Combobox
                      mode="multiple"
                      options={brandOptions}
                      value={localState.brandIds || []}
                      onValueChange={(ids) => setLocalState((prev) => ({ ...prev, brandIds: Array.isArray(ids) ? ids : ids ? [ids] : [] }))}
                      placeholder="Selecione marcas..."
                      emptyText="Nenhuma marca encontrada"
                      searchPlaceholder="Buscar marcas..."
                      disabled={loadingBrands}
                    />
                    {(localState.brandIds?.length || 0) > 0 && (
                      <div className="text-xs text-muted-foreground">
                        {localState.brandIds?.length} marca{(localState.brandIds?.length || 0) !== 1 ? "s" : ""} selecionada{(localState.brandIds?.length || 0) !== 1 ? "s" : ""}
                      </div>
                    )}
                  </div>

                  {/* Suppliers */}
                  <div className="space-y-2">
                    <Label>Fornecedores</Label>
                    <Combobox
                      mode="multiple"
                      options={supplierOptions}
                      value={localState.supplierIds || []}
                      onValueChange={(ids) => setLocalState((prev) => ({ ...prev, supplierIds: Array.isArray(ids) ? ids : ids ? [ids] : [] }))}
                      placeholder="Selecione fornecedores..."
                      emptyText="Nenhum fornecedor encontrado"
                      searchPlaceholder="Buscar fornecedores..."
                      disabled={loadingSuppliers}
                    />
                    {(localState.supplierIds?.length || 0) > 0 && (
                      <div className="text-xs text-muted-foreground">
                        {localState.supplierIds?.length} fornecedor{(localState.supplierIds?.length || 0) !== 1 ? "es" : ""} selecionado
                        {(localState.supplierIds?.length || 0) !== 1 ? "s" : ""}
                      </div>
                    )}
                  </div>
                </div>
              </TabsContent>
            </div>
          </Tabs>
        </div>

        <Separator className="mt-auto" />

        <DialogFooter className="gap-2 flex-shrink-0">
          <Button variant="outline" onClick={handleReset}>
            <IconX className="h-4 w-4 mr-2" />
            Limpar todos
          </Button>
          <Button onClick={handleApply}>
            Aplicar filtros
            {activeFilterCount > 0 && (
              <Badge variant="secondary" className="ml-2">
                {activeFilterCount}
              </Badge>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
