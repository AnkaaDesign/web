import { useState, useEffect } from "react";
import type { OrderGetManyFormData } from "../../../../schemas";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { IconFilter, IconX } from "@tabler/icons-react";
import { ORDER_STATUS, ORDER_STATUS_LABELS } from "../../../../constants";
import { Combobox, type ComboboxOption } from "@/components/ui/combobox";
import { DateTimeInput } from "@/components/ui/date-time-input";
import type { DateRange } from "react-day-picker";
import { useSuppliers } from "../../../../hooks";

interface OrderFiltersProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  filters: Partial<OrderGetManyFormData>;
  onFilterChange: (filters: Partial<OrderGetManyFormData>) => void;
}

interface FilterState {
  status?: ORDER_STATUS[];
  supplierIds?: string[];
  hasItems?: boolean;
  isFromSchedule?: boolean;
  createdAtRange?: { gte?: Date; lte?: Date };
  forecastRange?: { gte?: Date; lte?: Date };
  updatedAtRange?: { gte?: Date; lte?: Date };
}

export function OrderFilters({ open, onOpenChange, filters, onFilterChange }: OrderFiltersProps) {
  const [localState, setLocalState] = useState<FilterState>({});

  // Load suppliers for filter
  const { data: suppliersData } = useSuppliers({ orderBy: { fantasyName: "asc" } });

  // Initialize local state from filters only when dialog opens
  useEffect(() => {
    if (!open) return;

    setLocalState({
      status: filters.status || [],
      supplierIds: filters.supplierIds || [],
      hasItems: filters.hasItems,
      isFromSchedule: filters.isFromSchedule,
      createdAtRange: filters.createdAt,
      forecastRange: filters.forecastRange,
      updatedAtRange: filters.updatedAtRange,
    });
  }, [open, filters]);

  const handleApply = () => {
    // Build the filters object from local state
    const newFilters: Partial<OrderGetManyFormData> = {
      limit: filters.limit,
      orderBy: filters.orderBy,
    };

    // Add status filter
    if (localState.status && localState.status.length > 0) {
      newFilters.status = localState.status;
    }

    // Add supplier filter
    if (localState.supplierIds && localState.supplierIds.length > 0) {
      newFilters.supplierIds = localState.supplierIds;
    }

    // Add boolean filters
    if (typeof localState.hasItems === "boolean") {
      newFilters.hasItems = localState.hasItems;
    }
    if (typeof localState.isFromSchedule === "boolean") {
      newFilters.isFromSchedule = localState.isFromSchedule;
    }

    // Add date filters
    if (localState.createdAtRange) {
      newFilters.createdAt = localState.createdAtRange;
    }
    if (localState.forecastRange) {
      newFilters.forecastRange = localState.forecastRange;
    }
    if (localState.updatedAtRange) {
      newFilters.updatedAtRange = localState.updatedAtRange;
    }

    // Apply filters first, then close dialog with a small delay
    onFilterChange(newFilters);
    setTimeout(() => {
      onOpenChange(false);
    }, 0);
  };

  const handleReset = () => {
    const resetFilters: Partial<OrderGetManyFormData> = {
      limit: filters.limit || 20,
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
    if (localState.status && localState.status.length > 0) count += localState.status.length;
    if (localState.supplierIds && localState.supplierIds.length > 0) count += localState.supplierIds.length;
    if (typeof localState.hasItems === "boolean") count++;
    if (typeof localState.isFromSchedule === "boolean") count++;
    if (localState.createdAtRange?.gte || localState.createdAtRange?.lte) count++;
    if (localState.forecastRange?.gte || localState.forecastRange?.lte) count++;
    if (localState.updatedAtRange?.gte || localState.updatedAtRange?.lte) count++;
    return count;
  };

  const activeFilterCount = countActiveFilters();

  const statusOptions: ComboboxOption[] = Object.values(ORDER_STATUS).map((status) => ({
    value: status,
    label: ORDER_STATUS_LABELS[status],
  }));

  const supplierOptions: ComboboxOption[] =
    suppliersData?.data?.map((supplier) => ({
      value: supplier.id,
      label: supplier.fantasyName,
    })) || [];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] h-[70vh] max-h-[700px] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <IconFilter className="h-5 w-5 text-muted-foreground" />
            Pedidos - Filtros
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
          </DialogTitle>
          <DialogDescription>Configure filtros para refinar a pesquisa de pedidos</DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-auto space-y-6 p-4">
          {/* Status Filter */}
          <div className="space-y-2">
            <Label className="text-sm font-medium">Status</Label>
            <Combobox<ComboboxOption>
              options={statusOptions}
              value={localState.status || []}
              onValueChange={(values) => setLocalState((prev) => ({ ...prev, status: (Array.isArray(values) ? values : []) as ORDER_STATUS[] }))}
              placeholder="Selecione os status"
              emptyText="Nenhum status encontrado"
              mode="multiple"
              searchable={true}
            />
          </div>

          {/* Supplier Filter */}
          <div className="space-y-2">
            <Label className="text-sm font-medium">Fornecedores</Label>
            <Combobox<ComboboxOption>
              options={supplierOptions}
              value={localState.supplierIds || []}
              onValueChange={(values) => setLocalState((prev) => ({ ...prev, supplierIds: Array.isArray(values) ? values : [] }))}
              placeholder="Selecione os fornecedores"
              emptyText="Nenhum fornecedor encontrado"
              mode="multiple"
              searchable={true}
            />
          </div>

          {/* Boolean Filters */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <Label htmlFor="has-items">Possui itens</Label>
              <div className="flex items-center gap-2">
                <Switch
                  id="has-items"
                  checked={localState.hasItems === true}
                  onCheckedChange={(checked) =>
                    setLocalState((prev) => ({
                      ...prev,
                      hasItems: checked ? true : prev.hasItems === true ? undefined : false,
                    }))
                  }
                />
                <Button variant="ghost" size="sm" className="h-6 px-2" onClick={() => setLocalState((prev) => ({ ...prev, hasItems: undefined }))}>
                  <IconX className="h-3 w-3" />
                </Button>
              </div>
            </div>

            <div className="flex items-center justify-between">
              <Label htmlFor="is-from-schedule">Pedido agendado</Label>
              <div className="flex items-center gap-2">
                <Switch
                  id="is-from-schedule"
                  checked={localState.isFromSchedule === true}
                  onCheckedChange={(checked) =>
                    setLocalState((prev) => ({
                      ...prev,
                      isFromSchedule: checked ? true : prev.isFromSchedule === true ? undefined : false,
                    }))
                  }
                />
                <Button variant="ghost" size="sm" className="h-6 px-2" onClick={() => setLocalState((prev) => ({ ...prev, isFromSchedule: undefined }))}>
                  <IconX className="h-3 w-3" />
                </Button>
              </div>
            </div>
          </div>

          {/* Date Filters */}
          <DateTimeInput
            mode="date-range"
            value={{
              from: localState.createdAtRange?.gte,
              to: localState.createdAtRange?.lte,
            }}
            onChange={(dateRange: DateRange | null) => {
              if (!dateRange || (!dateRange.from && !dateRange.to)) {
                setLocalState((prev) => ({ ...prev, createdAtRange: undefined }));
              } else {
                setLocalState((prev) => ({
                  ...prev,
                  createdAtRange: {
                    ...(dateRange.from && { gte: dateRange.from }),
                    ...(dateRange.to && { lte: dateRange.to }),
                  },
                }));
              }
            }}
            label="Período de criação"
            placeholder="Selecionar período..."
            description="Filtra por período de criação do pedido"
            numberOfMonths={2}
          />

          <DateTimeInput
            mode="date-range"
            value={{
              from: localState.forecastRange?.gte,
              to: localState.forecastRange?.lte,
            }}
            onChange={(dateRange: DateRange | null) => {
              if (!dateRange || (!dateRange.from && !dateRange.to)) {
                setLocalState((prev) => ({ ...prev, forecastRange: undefined }));
              } else {
                setLocalState((prev) => ({
                  ...prev,
                  forecastRange: {
                    ...(dateRange.from && { gte: dateRange.from }),
                    ...(dateRange.to && { lte: dateRange.to }),
                  },
                }));
              }
            }}
            label="Previsão de entrega"
            placeholder="Selecionar período..."
            description="Filtra por período de previsão de entrega"
            context="delivery"
            numberOfMonths={2}
          />

          <DateTimeInput
            mode="date-range"
            value={{
              from: localState.updatedAtRange?.gte,
              to: localState.updatedAtRange?.lte,
            }}
            onChange={(dateRange: DateRange | null) => {
              if (!dateRange || (!dateRange.from && !dateRange.to)) {
                setLocalState((prev) => ({ ...prev, updatedAtRange: undefined }));
              } else {
                setLocalState((prev) => ({
                  ...prev,
                  updatedAtRange: {
                    ...(dateRange.from && { gte: dateRange.from }),
                    ...(dateRange.to && { lte: dateRange.to }),
                  },
                }));
              }
            }}
            label="Data de conclusão"
            placeholder="Selecionar período..."
            description="Filtra por período de conclusão do pedido"
            numberOfMonths={2}
          />
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
