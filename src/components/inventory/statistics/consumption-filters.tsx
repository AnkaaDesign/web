// web/src/components/inventory/statistics/consumption-filters.tsx

import { useState, useMemo, useCallback, useEffect } from 'react';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  IconFilter,
  IconX,
  IconCalendar,
  IconUsers,
  IconBuilding,
  IconPackage,
  IconTag,
  IconCategory,
  IconInfoCircle,
  IconNumbers,
} from '@tabler/icons-react';
import { format, startOfDay, endOfDay, subDays, subMonths, startOfMonth, endOfMonth, startOfYear, endOfYear } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import type { ConsumptionAnalyticsFilters } from '@/types/consumption-analytics';
import { useSectors } from '@/hooks/useSector';
import { useUsers } from '@/hooks/useUser';
import { useItems } from '@/hooks/useItem';
import { useItemBrands } from '@/hooks/useItemBrand';
import { useItemCategories } from '@/hooks/useItemCategory';
import { ACTIVITY_OPERATION } from '@/constants';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Checkbox } from '@/components/ui/checkbox';
import { cn } from '@/lib/utils';
import { Calendar } from '@/components/ui/calendar';

interface ConsumptionFiltersProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  filters: ConsumptionAnalyticsFilters;
  onApply: (filters: ConsumptionAnalyticsFilters) => void;
  onReset: () => void;
}

// Date range presets
const DATE_PRESETS = [
  {
    label: 'Hoje',
    getValue: () => ({
      from: startOfDay(new Date()),
      to: endOfDay(new Date()),
    }),
  },
  {
    label: 'Últimos 7 dias',
    getValue: () => ({
      from: startOfDay(subDays(new Date(), 6)),
      to: endOfDay(new Date()),
    }),
  },
  {
    label: 'Últimos 30 dias',
    getValue: () => ({
      from: startOfDay(subDays(new Date(), 29)),
      to: endOfDay(new Date()),
    }),
  },
  {
    label: 'Este mês',
    getValue: () => ({
      from: startOfMonth(new Date()),
      to: endOfMonth(new Date()),
    }),
  },
  {
    label: 'Mês passado',
    getValue: () => {
      const lastMonth = subMonths(new Date(), 1);
      return {
        from: startOfMonth(lastMonth),
        to: endOfMonth(lastMonth),
      };
    },
  },
  {
    label: 'Últimos 3 meses',
    getValue: () => ({
      from: startOfDay(subMonths(new Date(), 3)),
      to: endOfDay(new Date()),
    }),
  },
  {
    label: 'Este ano',
    getValue: () => ({
      from: startOfYear(new Date()),
      to: endOfYear(new Date()),
    }),
  },
];

export function ConsumptionFilters({
  open,
  onOpenChange,
  filters,
  onApply,
  onReset,
}: ConsumptionFiltersProps) {
  const [localFilters, setLocalFilters] = useState<ConsumptionAnalyticsFilters>(filters);

  // Sync local state when drawer opens or filters change
  useEffect(() => {
    if (open) {
      setLocalFilters(filters);
    }
  }, [open, filters]);

  // Load data for filters
  const { data: sectorsData } = useSectors({});
  const { data: usersData } = useUsers({});
  const { data: itemsData } = useItems({});
  const { data: brandsData } = useItemBrands({});
  const { data: categoriesData } = useItemCategories({});

  // Deduplicate users
  const uniqueUsers = useMemo(() => {
    if (!usersData?.data) return [];
    const seen = new Set<string>();
    return usersData.data.filter(user => {
      if (seen.has(user.id)) return false;
      seen.add(user.id);
      return true;
    });
  }, [usersData?.data]);

  // Calculate active filter count (excluding operation since it's always OUTBOUND for consumption)
  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (localFilters.sectorIds && localFilters.sectorIds.length > 0) count++;
    if (localFilters.userIds && localFilters.userIds.length > 0) count++;
    if (localFilters.itemIds && localFilters.itemIds.length > 0) count++;
    if (localFilters.brandIds && localFilters.brandIds.length > 0) count++;
    if (localFilters.categoryIds && localFilters.categoryIds.length > 0) count++;
    return count;
  }, [localFilters]);

  // Check comparison mode warnings
  const sectorFilterDisabled = useMemo(
    () => (localFilters.userIds?.length ?? 0) >= 2,
    [localFilters.userIds]
  );

  const userFilterDisabled = useMemo(
    () => (localFilters.sectorIds?.length ?? 0) >= 2,
    [localFilters.sectorIds]
  );

  const handleApply = useCallback(() => {
    onApply(localFilters);
    onOpenChange(false);
  }, [localFilters, onApply, onOpenChange]);

  const handleClear = useCallback(() => {
    const defaultFilters: ConsumptionAnalyticsFilters = {
      startDate: startOfDay(subMonths(new Date(), 1)),
      endDate: endOfDay(new Date()),
      operation: ACTIVITY_OPERATION.OUTBOUND, // Always OUTBOUND for consumption
      sortBy: 'quantity',
      sortOrder: 'desc',
      limit: 50,
    };
    setLocalFilters(defaultFilters);
  }, []);

  const handleDatePreset = useCallback((preset: { from: Date; to: Date }) => {
    setLocalFilters({
      ...localFilters,
      startDate: preset.from,
      endDate: preset.to,
    });
  }, [localFilters]);

  // Multi-select handlers
  const toggleSector = useCallback((sectorId: string) => {
    const current = localFilters.sectorIds || [];
    const updated = current.includes(sectorId)
      ? current.filter(id => id !== sectorId)
      : [...current, sectorId];
    setLocalFilters({
      ...localFilters,
      sectorIds: updated.length > 0 ? updated : undefined,
    });
  }, [localFilters]);

  const toggleUser = useCallback((userId: string) => {
    const current = localFilters.userIds || [];
    const updated = current.includes(userId)
      ? current.filter(id => id !== userId)
      : [...current, userId];
    setLocalFilters({
      ...localFilters,
      userIds: updated.length > 0 ? updated : undefined,
    });
  }, [localFilters]);

  const toggleItem = useCallback((itemId: string) => {
    const current = localFilters.itemIds || [];
    const updated = current.includes(itemId)
      ? current.filter(id => id !== itemId)
      : [...current, itemId];
    setLocalFilters({
      ...localFilters,
      itemIds: updated.length > 0 ? updated : undefined,
    });
  }, [localFilters]);

  const toggleBrand = useCallback((brandId: string) => {
    const current = localFilters.brandIds || [];
    const updated = current.includes(brandId)
      ? current.filter(id => id !== brandId)
      : [...current, brandId];
    setLocalFilters({
      ...localFilters,
      brandIds: updated.length > 0 ? updated : undefined,
    });
  }, [localFilters]);

  const toggleCategory = useCallback((categoryId: string) => {
    const current = localFilters.categoryIds || [];
    const updated = current.includes(categoryId)
      ? current.filter(id => id !== categoryId)
      : [...current, categoryId];
    setLocalFilters({
      ...localFilters,
      categoryIds: updated.length > 0 ? updated : undefined,
    });
  }, [localFilters]);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-lg flex flex-col">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <IconFilter className="h-5 w-5" />
            Análise de Consumo - Filtros
            {activeFilterCount > 0 && (
              <Badge variant="secondary" className="ml-2">
                {activeFilterCount}
              </Badge>
            )}
          </SheetTitle>
          <SheetDescription>
            Configure os filtros para refinar a análise de consumo
          </SheetDescription>
        </SheetHeader>

        <ScrollArea className="flex-1 -mx-6 px-6">
          <div className="space-y-6 py-4">
            {/* Limit */}
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <IconNumbers className="h-4 w-4" />
                Número de Resultados
              </Label>
              <Input
                type="number"
                min={1}
                max={200}
                value={localFilters.limit || 50}
                onChange={(value: number | undefined) => {
                  const numValue = value || 50;
                  console.log('Limit changed to:', numValue);
                  setLocalFilters({
                    ...localFilters,
                    limit: numValue,
                  });
                }}
                placeholder="50"
                className="bg-transparent"
              />
            </div>

            {/* Date Range Section */}
            <div className="space-y-3">
              <Label className="flex items-center gap-2 text-base font-semibold">
                <IconCalendar className="h-4 w-4" />
                Período
              </Label>

              {/* Period Combobox */}
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="w-full justify-between">
                    <span className="truncate">
                      {format(localFilters.startDate, 'dd/MM/yyyy', { locale: ptBR })} - {format(localFilters.endDate, 'dd/MM/yyyy', { locale: ptBR })}
                    </span>
                    <IconCalendar className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[400px] p-0" align="start">
                  <Command>
                    <CommandList>
                      <CommandGroup heading="Períodos Predefinidos">
                        {DATE_PRESETS.map((preset) => (
                          <CommandItem
                            key={preset.label}
                            onSelect={() => {
                              handleDatePreset(preset.getValue());
                            }}
                            className="cursor-pointer"
                          >
                            <IconCalendar className="mr-2 h-4 w-4" />
                            <span>{preset.label}</span>
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                    <div className="border-t p-3">
                      <div className="text-sm font-medium mb-2">Período Personalizado</div>
                      <div className="grid grid-cols-2 gap-2">
                        <div className="space-y-1">
                          <Label className="text-xs text-muted-foreground">Data inicial</Label>
                          <Popover>
                            <PopoverTrigger asChild>
                              <Button
                                variant="outline"
                                size="sm"
                                className={cn(
                                  'w-full justify-start text-left font-normal text-xs',
                                  !localFilters.startDate && 'text-muted-foreground'
                                )}
                              >
                                {localFilters.startDate
                                  ? format(localFilters.startDate, 'dd/MM/yy', { locale: ptBR })
                                  : 'Selecione'}
                              </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-auto p-0" align="start">
                              <Calendar
                                mode="single"
                                selected={localFilters.startDate}
                                onSelect={(date) =>
                                  date &&
                                  setLocalFilters({
                                    ...localFilters,
                                    startDate: startOfDay(date),
                                  })
                                }
                                locale={ptBR}
                              />
                            </PopoverContent>
                          </Popover>
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs text-muted-foreground">Data final</Label>
                          <Popover>
                            <PopoverTrigger asChild>
                              <Button
                                variant="outline"
                                size="sm"
                                className={cn(
                                  'w-full justify-start text-left font-normal text-xs',
                                  !localFilters.endDate && 'text-muted-foreground'
                                )}
                              >
                                {localFilters.endDate
                                  ? format(localFilters.endDate, 'dd/MM/yy', { locale: ptBR })
                                  : 'Selecione'}
                              </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-auto p-0" align="start">
                              <Calendar
                                mode="single"
                                selected={localFilters.endDate}
                                onSelect={(date) =>
                                  date &&
                                  setLocalFilters({
                                    ...localFilters,
                                    endDate: endOfDay(date),
                                  })
                                }
                                locale={ptBR}
                              />
                            </PopoverContent>
                          </Popover>
                        </div>
                      </div>
                    </div>
                  </Command>
                </PopoverContent>
              </Popover>
            </div>

            {/* Sectors Filter */}
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <IconBuilding className="h-4 w-4" />
                Setores
              </Label>
              {sectorFilterDisabled && (
                <Alert variant="default" className="py-2">
                  <IconInfoCircle className="h-4 w-4" />
                  <AlertDescription className="text-xs">
                    Selecione 2+ setores para comparação. Desativa filtro de usuários.
                  </AlertDescription>
                </Alert>
              )}
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className="w-full justify-between"
                    disabled={sectorFilterDisabled}
                  >
                    <span className="truncate">
                      {localFilters.sectorIds && localFilters.sectorIds.length > 0
                        ? `${localFilters.sectorIds.length} selecionado(s)`
                        : 'Selecione setores...'}
                    </span>
                    <IconBuilding className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[400px] p-0" align="start">
                  <Command>
                    <CommandInput placeholder="Buscar setor..." />
                    <CommandEmpty>Nenhum setor encontrado.</CommandEmpty>
                    <CommandList>
                      <CommandGroup>
                        {sectorsData?.data?.map((sector) => (
                          <CommandItem
                            key={sector.id}
                            onSelect={() => toggleSector(sector.id)}
                            className="cursor-pointer"
                          >
                            <Checkbox
                              checked={localFilters.sectorIds?.includes(sector.id)}
                              className="mr-2"
                            />
                            <span>{sector.name}</span>
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
            </div>

            {/* Users Filter */}
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <IconUsers className="h-4 w-4" />
                Usuários
              </Label>
              {userFilterDisabled && (
                <Alert variant="default" className="py-2">
                  <IconInfoCircle className="h-4 w-4" />
                  <AlertDescription className="text-xs">
                    Selecione 2+ usuários para comparação. Desativa filtro de setores.
                  </AlertDescription>
                </Alert>
              )}
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className="w-full justify-between"
                    disabled={userFilterDisabled}
                  >
                    <span className="truncate">
                      {localFilters.userIds && localFilters.userIds.length > 0
                        ? `${localFilters.userIds.length} selecionado(s)`
                        : 'Selecione usuários...'}
                    </span>
                    <IconUsers className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[400px] p-0" align="start">
                  <Command>
                    <CommandInput placeholder="Buscar usuário..." />
                    <CommandEmpty>Nenhum usuário encontrado.</CommandEmpty>
                    <CommandList>
                      <CommandGroup>
                        {uniqueUsers.map((user) => (
                          <CommandItem
                            key={user.id}
                            onSelect={() => toggleUser(user.id)}
                            className="cursor-pointer"
                          >
                            <Checkbox
                              checked={localFilters.userIds?.includes(user.id)}
                              className="mr-2"
                            />
                            <span>{user.name}</span>
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
            </div>

            {/* Items Filter */}
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <IconPackage className="h-4 w-4" />
                Itens
              </Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="w-full justify-between">
                    <span className="truncate">
                      {localFilters.itemIds && localFilters.itemIds.length > 0
                        ? `${localFilters.itemIds.length} selecionado(s)`
                        : 'Todos os itens'}
                    </span>
                    <IconPackage className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[400px] p-0" align="start">
                  <Command>
                    <CommandInput placeholder="Buscar item..." />
                    <CommandEmpty>Nenhum item encontrado.</CommandEmpty>
                    <CommandList>
                      <CommandGroup>
                        {itemsData?.data?.map((item) => (
                          <CommandItem
                            key={item.id}
                            onSelect={() => toggleItem(item.id)}
                            className="cursor-pointer"
                          >
                            <Checkbox
                              checked={localFilters.itemIds?.includes(item.id)}
                              className="mr-2"
                            />
                            <span>{item.name}</span>
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
            </div>

            {/* Brands Filter */}
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <IconTag className="h-4 w-4" />
                Marcas
              </Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="w-full justify-between">
                    <span className="truncate">
                      {localFilters.brandIds && localFilters.brandIds.length > 0
                        ? `${localFilters.brandIds.length} selecionada(s)`
                        : 'Todas as marcas'}
                    </span>
                    <IconTag className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[400px] p-0" align="start">
                  <Command>
                    <CommandInput placeholder="Buscar marca..." />
                    <CommandEmpty>Nenhuma marca encontrada.</CommandEmpty>
                    <CommandList>
                      <CommandGroup>
                        {brandsData?.data?.map((brand) => (
                          <CommandItem
                            key={brand.id}
                            onSelect={() => toggleBrand(brand.id)}
                            className="cursor-pointer"
                          >
                            <Checkbox
                              checked={localFilters.brandIds?.includes(brand.id)}
                              className="mr-2"
                            />
                            <span>{brand.name}</span>
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
            </div>

            {/* Categories Filter */}
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <IconCategory className="h-4 w-4" />
                Categorias
              </Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="w-full justify-between">
                    <span className="truncate">
                      {localFilters.categoryIds && localFilters.categoryIds.length > 0
                        ? `${localFilters.categoryIds.length} selecionada(s)`
                        : 'Todas as categorias'}
                    </span>
                    <IconCategory className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[400px] p-0" align="start">
                  <Command>
                    <CommandInput placeholder="Buscar categoria..." />
                    <CommandEmpty>Nenhuma categoria encontrada.</CommandEmpty>
                    <CommandList>
                      <CommandGroup>
                        {categoriesData?.data?.map((category) => (
                          <CommandItem
                            key={category.id}
                            onSelect={() => toggleCategory(category.id)}
                            className="cursor-pointer"
                          >
                            <Checkbox
                              checked={localFilters.categoryIds?.includes(category.id)}
                              className="mr-2"
                            />
                            <span>{category.name}</span>
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
            </div>
          </div>
        </ScrollArea>

        <div className="flex gap-2 pt-4 border-t">
          <Button variant="outline" onClick={handleClear} className="flex-1">
            <IconX className="h-4 w-4 mr-2" />
            Limpar Tudo
          </Button>
          <Button onClick={handleApply} className="flex-1">
            Aplicar
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
