import React from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { DateTimeInput } from "@/components/ui/date-time-input";
import { Combobox } from "@/components/ui/combobox";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { IconFilter, IconPackage, IconUser, IconCategory, IconTag, IconCircleCheck, IconCalendarEvent, IconCalendarCheck, IconX } from "@tabler/icons-react";
import { useItems, useUsers, useItemBrands, useItemCategories } from "../../../../hooks";
import type { BorrowGetManyFormData } from "../../../../schemas";
import { BORROW_STATUS, BORROW_STATUS_LABELS, ITEM_CATEGORY_TYPE } from "../../../../constants";

interface BorrowFiltersProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  filters: Partial<BorrowGetManyFormData>;
  onFilterChange: (filters: Partial<BorrowGetManyFormData>) => void;
}

export function BorrowFilters({ open, onOpenChange, filters, onFilterChange }: BorrowFiltersProps) {
  const { data: itemsData } = useItems({ orderBy: { name: "asc" } });
  const { data: usersData } = useUsers({ orderBy: { name: "asc" } });
  const { data: brandsData } = useItemBrands({ orderBy: { name: "asc" } });
  const { data: categoriesData } = useItemCategories({ orderBy: { name: "asc" } });

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

  // Transform data for comboboxes
  const itemOptions =
    itemsData?.data?.map((item) => ({
      value: item.id,
      label: `${item.name} ${item.uniCode ? `(${item.uniCode})` : ""}`,
    })) || [];

  const userOptions =
    usersData?.data?.map((user) => ({
      value: user.id,
      label: user.name,
    })) || [];

  const brandOptions =
    brandsData?.data?.map((brand) => ({
      value: brand.id,
      label: brand.name,
    })) || [];

  const categoryOptions =
    categoriesData?.data?.map((category) => ({
      value: category.id,
      label: `${category.name}${category.type === ITEM_CATEGORY_TYPE.PPE ? " (EPI)" : ""}`,
    })) || [];

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
              mode="multiple"
              options={itemOptions}
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
              formatDisplay="brand"
              showCount={true}
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
              mode="multiple"
              options={userOptions}
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
              showCount={true}
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
              mode="multiple"
              options={categoryOptions}
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
              mode="multiple"
              options={brandOptions}
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
              value={localFilters.where?.status || "all"}
              onValueChange={(value) =>
                setLocalFilters({
                  ...localFilters,
                  where: {
                    ...localFilters.where,
                    status: value === "all" ? undefined : (value as BORROW_STATUS),
                  },
                })
              }
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

        <div className="flex gap-2 pt-4 border-t">
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
