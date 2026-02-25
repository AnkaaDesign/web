import { useState, useEffect, useCallback, useRef } from "react";
import { IconFilter, IconX, IconCalendar, IconBuilding, IconTruck, IconTable } from "@tabler/icons-react";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { DateTimeInput } from "@/components/ui/date-time-input";
import { Combobox } from "@/components/ui/combobox";
import type { TaskGetManyFormData } from "../../../../schemas";
import { TRUCK_CATEGORY_LABELS, IMPLEMENT_TYPE_LABELS } from "../../../../constants";
import { CustomerLogoDisplay } from "@/components/ui/avatar-display";
import { getCustomers } from "@/api-client/customer";

const TABLE_VISIBILITY_OPTIONS = [
  { value: "preparation", label: "Em Preparação" },
  { value: "production", label: "Em Produção" },
  { value: "completed", label: "Concluído" },
];

interface TaskPreparationFiltersProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  filters: Partial<TaskGetManyFormData>;
  onFilterChange: (filters: Partial<TaskGetManyFormData>) => void;
  onCustomerNamesChange?: (names: Record<string, string>) => void;
  visibleTables: string[];
  onVisibleTablesChange: (tables: string[]) => void;
}

export function TaskPreparationFilters({ open, onOpenChange, filters, onFilterChange, onCustomerNamesChange, visibleTables, onVisibleTablesChange }: TaskPreparationFiltersProps) {
  // Local state for filters
  const [localFilters, setLocalFilters] = useState<Partial<TaskGetManyFormData>>({
    ...filters,
  });

  // Cache of fetched customers: id -> display name
  const customerCacheRef = useRef<Map<string, { id: string; name: string; logo?: any }>>(new Map());

  // Async customer search function
  const searchCustomers = useCallback(
    async (search?: string, page: number = 1): Promise<{ data: any[]; hasMore: boolean }> => {
      const params: any = {
        orderBy: { fantasyName: "asc" },
        page,
        take: 50,
        include: { logo: true },
      };
      if (search && search.trim()) {
        params.searchingFor = search.trim();
      }
      try {
        const response = await getCustomers(params);
        const customers = response.data || [];
        const hasMore = response.meta?.hasNextPage || false;
        // Cache all fetched customers for label display
        customers.forEach((c: any) => {
          customerCacheRef.current.set(c.id, {
            id: c.id,
            name: c.corporateName || c.fantasyName,
            logo: c.logo,
          });
        });
        return { data: customers, hasMore };
      } catch {
        return { data: [], hasMore: false };
      }
    },
    [],
  );

  // Reset local state when dialog opens
  useEffect(() => {
    if (open) {
      setLocalFilters({ ...filters });
    }
  }, [open, filters]);

  // Handle apply filters
  const handleApply = () => {
    // Emit customer names for selected IDs (for filter indicator display)
    if (onCustomerNamesChange && localFilters.customerIds?.length) {
      const names: Record<string, string> = {};
      localFilters.customerIds.forEach((id) => {
        const cached = customerCacheRef.current.get(id);
        if (cached) names[id] = cached.name;
      });
      onCustomerNamesChange(names);
    }
    onFilterChange(localFilters);
    onOpenChange(false);
  };

  // Handle clear filters
  const handleClear = () => {
    setLocalFilters({});
  };

  // Truck category options
  const truckCategoryOptions = Object.entries(TRUCK_CATEGORY_LABELS).map(([value, label]) => ({
    value,
    label,
  }));

  // Implement type options
  const implementTypeOptions = Object.entries(IMPLEMENT_TYPE_LABELS).map(([value, label]) => ({
    value,
    label,
  }));

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <IconFilter className="h-5 w-5" />
            Filtros da Preparação
          </SheetTitle>
          <SheetDescription>
            Filtre as tarefas por previsão, prazo, cliente e mais
          </SheetDescription>
        </SheetHeader>

        <div className="mt-6 space-y-6">
          {/* Forecast Date Range */}
          <div className="space-y-3">
            <Label className="flex items-center gap-2">
              <IconCalendar className="h-4 w-4" />
              Previsão
            </Label>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs text-muted-foreground mb-1 block">De</Label>
                <DateTimeInput
                  mode="date"
                  value={localFilters.forecastDateRange?.from as Date | undefined}
                  onChange={(dateOrRange) => {
                    const date = dateOrRange && typeof dateOrRange === 'object' && 'from' in dateOrRange ? dateOrRange.from : dateOrRange;
                    if (!date && !localFilters.forecastDateRange?.to) {
                      const { forecastDateRange, ...rest } = localFilters;
                      setLocalFilters(rest);
                    } else {
                      setLocalFilters({
                        ...localFilters,
                        forecastDateRange: {
                          ...(date && { from: date }),
                          ...(localFilters.forecastDateRange?.to && { to: localFilters.forecastDateRange.to }),
                        },
                      });
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
                  value={localFilters.forecastDateRange?.to as Date | undefined}
                  onChange={(dateOrRange) => {
                    const date = dateOrRange && typeof dateOrRange === 'object' && 'from' in dateOrRange ? dateOrRange.to : dateOrRange;
                    if (!date && !localFilters.forecastDateRange?.from) {
                      const { forecastDateRange, ...rest } = localFilters;
                      setLocalFilters(rest);
                    } else {
                      setLocalFilters({
                        ...localFilters,
                        forecastDateRange: {
                          ...(localFilters.forecastDateRange?.from && { from: localFilters.forecastDateRange.from }),
                          ...(date && { to: date }),
                        },
                      });
                    }
                  }}
                  hideLabel
                  placeholder="Selecionar data final..."
                />
              </div>
            </div>
          </div>

          {/* Term Date Range */}
          <div className="space-y-3">
            <Label className="flex items-center gap-2">
              <IconCalendar className="h-4 w-4" />
              Prazo
            </Label>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs text-muted-foreground mb-1 block">De</Label>
                <DateTimeInput
                  mode="date"
                  value={localFilters.termRange?.from as Date | undefined}
                  onChange={(dateOrRange) => {
                    const date = dateOrRange && typeof dateOrRange === 'object' && 'from' in dateOrRange ? dateOrRange.from : dateOrRange;
                    if (!date && !localFilters.termRange?.to) {
                      const { termRange, ...rest } = localFilters;
                      setLocalFilters(rest);
                    } else {
                      setLocalFilters({
                        ...localFilters,
                        termRange: {
                          ...(date && { from: date }),
                          ...(localFilters.termRange?.to && { to: localFilters.termRange.to }),
                        },
                      });
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
                  value={localFilters.termRange?.to as Date | undefined}
                  onChange={(dateOrRange) => {
                    const date = dateOrRange && typeof dateOrRange === 'object' && 'from' in dateOrRange ? dateOrRange.to : dateOrRange;
                    if (!date && !localFilters.termRange?.from) {
                      const { termRange, ...rest } = localFilters;
                      setLocalFilters(rest);
                    } else {
                      setLocalFilters({
                        ...localFilters,
                        termRange: {
                          ...(localFilters.termRange?.from && { from: localFilters.termRange.from }),
                          ...(date && { to: date }),
                        },
                      });
                    }
                  }}
                  hideLabel
                  placeholder="Selecionar data final..."
                />
              </div>
            </div>
          </div>

          {/* Customer Filter */}
          <div className="space-y-2">
            <Label className="flex items-center gap-2">
              <IconBuilding className="h-4 w-4" />
              Razão Social
            </Label>
            <Combobox<any>
              mode="multiple"
              placeholder="Selecione os clientes"
              emptyText="Nenhum cliente encontrado"
              value={localFilters.customerIds || []}
              onValueChange={(value) => {
                const arr = Array.isArray(value) ? value : (value ? [value] : []);
                setLocalFilters({ ...localFilters, customerIds: arr.length > 0 ? arr : undefined });
              }}
              async={true}
              queryKey={["customers-preparation-filter"]}
              queryFn={searchCustomers}
              minSearchLength={0}
              getOptionValue={(customer: any) => customer.id}
              getOptionLabel={(customer: any) => customer.corporateName || customer.fantasyName}
              renderOption={(customer: any, _isSelected) => (
                <div className="flex items-center gap-3 w-full">
                  <CustomerLogoDisplay
                    logo={customer.logo}
                    customerName={customer.fantasyName || customer.corporateName}
                    size="sm"
                    shape="rounded"
                    className="flex-shrink-0"
                  />
                  <div className="flex flex-col gap-1 min-w-0 flex-1">
                    <div className="font-medium truncate">{customer.corporateName || customer.fantasyName}</div>
                  </div>
                </div>
              )}
            />
          </div>

          {/* Table Visibility */}
          <div className="space-y-2">
            <Label className="flex items-center gap-2">
              <IconTable className="h-4 w-4" />
              Tabelas Visíveis
            </Label>
            <Combobox
              mode="multiple"
              options={TABLE_VISIBILITY_OPTIONS}
              value={visibleTables}
              onValueChange={(value) => {
                const arr = Array.isArray(value) ? value : (value ? [value] : []);
                onVisibleTablesChange(arr);
              }}
              placeholder="Selecione as tabelas"
              searchable={false}
              minSearchLength={0}
            />
          </div>

          {/* Truck Category Filter */}
          <div className="space-y-2">
            <Label className="flex items-center gap-2">
              <IconTruck className="h-4 w-4" />
              Categoria do Caminhão
            </Label>
            <Combobox
              mode="multiple"
              options={truckCategoryOptions}
              value={(localFilters as any).truckCategories || []}
              onValueChange={(value) => {
                const arr = Array.isArray(value) ? value : (value ? [value] : []);
                setLocalFilters({ ...localFilters, truckCategories: arr.length > 0 ? arr : undefined } as any);
              }}
              placeholder="Selecione as categorias"
              searchable={true}
              minSearchLength={0}
            />
          </div>

          {/* Implement Type Filter */}
          <div className="space-y-2">
            <Label className="flex items-center gap-2">
              <IconTruck className="h-4 w-4" />
              Tipo de Implemento
            </Label>
            <Combobox
              mode="multiple"
              options={implementTypeOptions}
              value={(localFilters as any).implementTypes || []}
              onValueChange={(value) => {
                const arr = Array.isArray(value) ? value : (value ? [value] : []);
                setLocalFilters({ ...localFilters, implementTypes: arr.length > 0 ? arr : undefined } as any);
              }}
              placeholder="Selecione os implementos"
              searchable={true}
              minSearchLength={0}
            />
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-2 mt-6 pt-4 border-t">
          <Button variant="outline" onClick={handleClear} className="flex-1">
            <IconX className="h-4 w-4 mr-2" />
            Limpar Filtros
          </Button>
          <Button onClick={handleApply} className="flex-1">
            Aplicar Filtros
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
