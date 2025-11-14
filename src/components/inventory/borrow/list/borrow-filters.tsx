import React, { useCallback, useRef } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { DateTimeInput } from "@/components/ui/date-time-input";
import { Combobox } from "@/components/ui/combobox";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { IconFilter, IconPackage, IconUser, IconCategory, IconTag, IconCircleCheck, IconCalendarEvent, IconCalendarCheck, IconX } from "@tabler/icons-react";
import { getItems, getUsers, getItemBrands, getItemCategories } from "../../../../api-client";
import type { BorrowGetManyFormData } from "../../../../schemas";
import { BORROW_STATUS, BORROW_STATUS_LABELS, ITEM_CATEGORY_TYPE } from "../../../../constants";

interface BorrowFiltersProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  filters: Partial<BorrowGetManyFormData>;
  onFilterChange: (filters: Partial<BorrowGetManyFormData>) => void;
}

export function BorrowFilters({ open, onOpenChange, filters, onFilterChange }: BorrowFiltersProps) {
  // Create stable caches for fetched data
  const itemsCacheRef = useRef<Map<string, { label: string; value: string }>>(new Map());
  const usersCacheRef = useRef<Map<string, { label: string; value: string }>>(new Map());
  const brandsCacheRef = useRef<Map<string, { label: string; value: string }>>(new Map());
  const categoriesCacheRef = useRef<Map<string, { label: string; value: string }>>(new Map());

  const [localFilters, setLocalFilters] = React.useState<Partial<BorrowGetManyFormData>>(filters);

  // Count active filters
  const activeFilterCount = React.useMemo(() => {
    let count = 0;
    if (localFilters.itemIds?.length) count++;
    if (localFilters.userIds?.length) count++;
    if (localFilters.categoryIds?.length) count++;
    if (localFilters.brandIds?.length) count++;
    if (localFilters.where?.status) count++;
    if (localFilters.createdAt?.gte || localFilters.createdAt?.lte) count++;
    if (localFilters.returnedAt?.gte || localFilters.returnedAt?.lte) count++;
    return count;
  }, [localFilters]);

  React.useEffect(() => {
    setLocalFilters(filters);
  }, [filters]);

  const handleApply = () => {
    onFilterChange(localFilters);
    onOpenChange(false);
  };

  const handleClear = () => {
    const clearedFilters: Partial<BorrowGetManyFormData> = {
      limit: filters.limit,
    };
    setLocalFilters(clearedFilters);
    // Immediately apply cleared filters
    onFilterChange(clearedFilters);
  };

  // Async query function for items
  const queryItemsFn = useCallback(async (searchTerm: string, page = 1) => {
    try {
      const response = await getItems({
        orderBy: { name: "asc" },
        page: page,
        take: 50,
        where: searchTerm
          ? {
              OR: [
                { name: { contains: searchTerm, mode: "insensitive" } },
                { uniCode: { contains: searchTerm, mode: "insensitive" } },
              ],
            }
          : undefined,
      });

      const items = response.data || [];
      const hasMore = response.meta?.hasNextPage || false;

      const options = items.map((item) => {
        const label = item.uniCode ? `${item.uniCode} - ${item.name}` : item.name;
        const option = { label, value: item.id };
        itemsCacheRef.current.set(item.id, option);
        return option;
      });

      return { data: options, hasMore };
    } catch (error) {
      console.error("Error fetching items:", error);
      return { data: [], hasMore: false };
    }
  }, []);

  // Async query function for users
  const queryUsersFn = useCallback(async (searchTerm: string, page = 1) => {
    try {
      const response = await getUsers({
        orderBy: { name: "asc" },
        page: page,
        take: 50,
        where: searchTerm
          ? {
              OR: [
                { name: { contains: searchTerm, mode: "insensitive" } },
                { email: { contains: searchTerm, mode: "insensitive" } },
              ],
            }
          : undefined,
      });

      const users = response.data || [];
      const hasMore = response.meta?.hasNextPage || false;

      const options = users.map((user) => {
        const option = { label: user.name, value: user.id };
        usersCacheRef.current.set(user.id, option);
        return option;
      });

      return { data: options, hasMore };
    } catch (error) {
      console.error("Error fetching users:", error);
      return { data: [], hasMore: false };
    }
  }, []);

  // Async query function for brands
  const queryBrandsFn = useCallback(async (searchTerm: string, page = 1) => {
    try {
      const response = await getItemBrands({
        orderBy: { name: "asc" },
        page: page,
        take: 50,
        where: searchTerm
          ? {
              name: { contains: searchTerm, mode: "insensitive" },
            }
          : undefined,
      });

      const brands = response.data || [];
      const hasMore = response.meta?.hasNextPage || false;

      const options = brands.map((brand) => {
        const option = { label: brand.name, value: brand.id };
        brandsCacheRef.current.set(brand.id, option);
        return option;
      });

      return { data: options, hasMore };
    } catch (error) {
      console.error("Error fetching brands:", error);
      return { data: [], hasMore: false };
    }
  }, []);

  // Async query function for categories
  const queryCategoriesFn = useCallback(async (searchTerm: string, page = 1) => {
    try {
      const response = await getItemCategories({
        orderBy: { name: "asc" },
        page: page,
        take: 50,
        where: searchTerm
          ? {
              name: { contains: searchTerm, mode: "insensitive" },
            }
          : undefined,
      });

      const categories = response.data || [];
      const hasMore = response.meta?.hasNextPage || false;

      const options = categories.map((category) => {
        const label = `${category.name}${category.type === ITEM_CATEGORY_TYPE.PPE ? " (EPI)" : ""}`;
        const option = { label, value: category.id };
        categoriesCacheRef.current.set(category.id, option);
        return option;
      });

      return { data: options, hasMore };
    } catch (error) {
      console.error("Error fetching categories:", error);
      return { data: [], hasMore: false };
    }
  }, []);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-lg overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <IconFilter className="h-5 w-5 text-muted-foreground" />
            Empréstimos - Filtros
            {activeFilterCount > 0 && (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Badge variant="secondary" className="ml-2 cursor-pointer hover:bg-destructive hover:text-destructive-foreground transition-colors" onClick={handleClear}>
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
          <SheetDescription>Configure os filtros para refinar sua pesquisa de empréstimos</SheetDescription>
        </SheetHeader>

        <div className="mt-6 space-y-6">
          {/* Item Filter - Multi Combobox */}
          <div className="grid gap-2">
            <Label className="flex items-center gap-2">
              <IconPackage className="h-4 w-4" />
              Itens
            </Label>
            <Combobox
              async={true}
              queryKey={["items", "borrow-filter"]}
              queryFn={queryItemsFn}
              initialOptions={[]}
              mode="multiple"
              value={localFilters.itemIds || []}
              onValueChange={(value) =>
                setLocalFilters({
                  ...localFilters,
                  itemIds: value.length > 0 ? value : undefined,
                })
              }
              placeholder="Selecione itens..."
              emptyText="Nenhum item encontrado"
              searchPlaceholder="Buscar itens..."
              minSearchLength={0}
              pageSize={50}
              debounceMs={300}
            />
            {localFilters.itemIds && localFilters.itemIds.length > 0 && (
              <div className="text-xs text-muted-foreground">
                {localFilters.itemIds.length} item{localFilters.itemIds.length !== 1 ? "s" : ""} selecionado{localFilters.itemIds.length !== 1 ? "s" : ""}
              </div>
            )}
          </div>

          {/* User Filter - Multi Combobox */}
          <div className="grid gap-2">
            <Label className="flex items-center gap-2">
              <IconUser className="h-4 w-4" />
              Usuários
            </Label>
            <Combobox
              async={true}
              queryKey={["users", "borrow-filter"]}
              queryFn={queryUsersFn}
              initialOptions={[]}
              mode="multiple"
              value={localFilters.userIds || []}
              onValueChange={(value) =>
                setLocalFilters({
                  ...localFilters,
                  userIds: value.length > 0 ? value : undefined,
                })
              }
              placeholder="Selecione usuários..."
              emptyText="Nenhum usuário encontrado"
              searchPlaceholder="Buscar usuários..."
              minSearchLength={0}
              pageSize={50}
              debounceMs={300}
            />
            {localFilters.userIds && localFilters.userIds.length > 0 && (
              <div className="text-xs text-muted-foreground">
                {localFilters.userIds.length} usuário{localFilters.userIds.length !== 1 ? "s" : ""} selecionado{localFilters.userIds.length !== 1 ? "s" : ""}
              </div>
            )}
          </div>

          {/* Category Filter - Multi Combobox */}
          <div className="grid gap-2">
            <Label className="flex items-center gap-2">
              <IconCategory className="h-4 w-4" />
              Categorias
            </Label>
            <Combobox
              async={true}
              queryKey={["item-categories", "borrow-filter"]}
              queryFn={queryCategoriesFn}
              initialOptions={[]}
              mode="multiple"
              value={localFilters.categoryIds || []}
              onValueChange={(value) =>
                setLocalFilters({
                  ...localFilters,
                  categoryIds: value.length > 0 ? value : undefined,
                })
              }
              placeholder="Selecione categorias..."
              emptyText="Nenhuma categoria encontrada"
              searchPlaceholder="Buscar categorias..."
              minSearchLength={0}
              pageSize={50}
              debounceMs={300}
            />
            {localFilters.categoryIds && localFilters.categoryIds.length > 0 && (
              <div className="text-xs text-muted-foreground">
                {localFilters.categoryIds.length} categoria{localFilters.categoryIds.length !== 1 ? "s" : ""} selecionada{localFilters.categoryIds.length !== 1 ? "s" : ""}
              </div>
            )}
          </div>

          {/* Brand Filter - Multi Combobox */}
          <div className="grid gap-2">
            <Label className="flex items-center gap-2">
              <IconTag className="h-4 w-4" />
              Marcas
            </Label>
            <Combobox
              async={true}
              queryKey={["item-brands", "borrow-filter"]}
              queryFn={queryBrandsFn}
              initialOptions={[]}
              mode="multiple"
              value={localFilters.brandIds || []}
              onValueChange={(value) =>
                setLocalFilters({
                  ...localFilters,
                  brandIds: value.length > 0 ? value : undefined,
                })
              }
              placeholder="Selecione marcas..."
              emptyText="Nenhuma marca encontrada"
              searchPlaceholder="Buscar marcas..."
              minSearchLength={0}
              pageSize={50}
              debounceMs={300}
            />
            {localFilters.brandIds && localFilters.brandIds.length > 0 && (
              <div className="text-xs text-muted-foreground">
                {localFilters.brandIds.length} marca{localFilters.brandIds.length !== 1 ? "s" : ""} selecionada{localFilters.brandIds.length !== 1 ? "s" : ""}
              </div>
            )}
          </div>

          {/* Status Filter */}
          <div className="grid gap-2">
            <Label htmlFor="status" className="flex items-center gap-2">
              <IconCircleCheck className="h-4 w-4" />
              Status
            </Label>
            <Combobox
              value={localFilters.where?.status ? String(localFilters.where.status) : "all"}
              onValueChange={(value) => {
                const newWhere = { ...localFilters.where };
                if (value === "all") {
                  delete newWhere.status;
                } else {
                  newWhere.status = value as BORROW_STATUS;
                }
                setLocalFilters({
                  ...localFilters,
                  where: Object.keys(newWhere).length > 0 ? newWhere : undefined,
                });
              }}
              options={[
                { label: "Todos os status", value: "all" },
                ...Object.entries(BORROW_STATUS_LABELS).map(([value, label]) => ({
                  label,
                  value,
                })),
              ]}
              placeholder="Todos os status"
              searchable={false}
            />
          </div>

          {/* Borrow Date Range */}
          <div className="grid gap-2">
            <Label className="flex items-center gap-2">
              <IconCalendarEvent className="h-4 w-4" />
              Data do Empréstimo
            </Label>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Data inicial</Label>
                <DateTimeInput
                  type="datetime-local"
                  value={localFilters.createdAt?.gte || undefined}
                  onChange={(value) =>
                    setLocalFilters({
                      ...localFilters,
                      createdAt: {
                        ...localFilters.createdAt,
                        gte: value || undefined,
                      },
                    })
                  }
                  placeholder="Selecione a data inicial"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Data final</Label>
                <DateTimeInput
                  type="datetime-local"
                  value={localFilters.createdAt?.lte || undefined}
                  onChange={(value) =>
                    setLocalFilters({
                      ...localFilters,
                      createdAt: {
                        ...localFilters.createdAt,
                        lte: value || undefined,
                      },
                    })
                  }
                  placeholder="Selecione a data final"
                />
              </div>
            </div>
          </div>

          {/* Return Date Range */}
          <div className="grid gap-2">
            <Label className="flex items-center gap-2">
              <IconCalendarCheck className="h-4 w-4" />
              Data de Devolução
            </Label>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Data inicial</Label>
                <DateTimeInput
                  type="datetime-local"
                  value={localFilters.returnedAt?.gte || undefined}
                  onChange={(value) =>
                    setLocalFilters({
                      ...localFilters,
                      returnedAt: {
                        ...localFilters.returnedAt,
                        gte: value || undefined,
                      },
                    })
                  }
                  placeholder="Selecione a data inicial"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Data final</Label>
                <DateTimeInput
                  type="datetime-local"
                  value={localFilters.returnedAt?.lte || undefined}
                  onChange={(value) =>
                    setLocalFilters({
                      ...localFilters,
                      returnedAt: {
                        ...localFilters.returnedAt,
                        lte: value || undefined,
                      },
                    })
                  }
                  placeholder="Selecione a data final"
                />
              </div>
            </div>
          </div>
        </div>

        <div className="flex gap-2 mt-6 pt-4 border-t">
          <Button variant="outline" onClick={handleClear} className="flex-1 flex items-center gap-2">
            <IconX className="h-4 w-4" />
            Limpar Tudo
          </Button>
          <Button onClick={handleApply} className="flex-1">Aplicar</Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
