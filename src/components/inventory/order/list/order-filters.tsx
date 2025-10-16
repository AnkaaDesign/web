import { useState, useEffect } from "react";
import type { OrderGetManyFormData } from "../../../../schemas";
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
import { Switch } from "@/components/ui/switch";
import { IconFilter, IconX } from "@tabler/icons-react";
import { ORDER_STATUS, ORDER_STATUS_LABELS } from "../../../../constants";
import { Combobox, type ComboboxOption } from "@/components/ui/combobox";
import { DateTimeInput } from "@/components/ui/date-time-input";
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
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <IconFilter className="h-5 w-5" />
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
          </SheetTitle>
          <SheetDescription>Configure filtros para refinar a pesquisa de pedidos</SheetDescription>
        </SheetHeader>

        <div className="mt-6 space-y-6">
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

          {/* Date Filters */}
          <div className="space-y-3">
            <div className="text-sm font-medium">Período de criação</div>
            <div className="grid grid-cols-2 gap-3">
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
                label="De"
                placeholder="Selecionar data inicial..."
              />
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
                label="Até"
                placeholder="Selecionar data final..."
              />
            </div>
          </div>

          <div className="space-y-3">
            <div className="text-sm font-medium">Previsão de entrega</div>
            <div className="grid grid-cols-2 gap-3">
              <DateTimeInput
                mode="date"
                value={localState.forecastRange?.gte}
                onChange={(date: Date | null) => {
                  if (!date && !localState.forecastRange?.lte) {
                    setLocalState((prev) => ({ ...prev, forecastRange: undefined }));
                  } else {
                    setLocalState((prev) => ({
                      ...prev,
                      forecastRange: {
                        ...(date && { gte: date }),
                        ...(localState.forecastRange?.lte && { lte: localState.forecastRange.lte }),
                      },
                    }));
                  }
                }}
                label="De"
                placeholder="Selecionar data inicial..."
                context="delivery"
              />
              <DateTimeInput
                mode="date"
                value={localState.forecastRange?.lte}
                onChange={(date: Date | null) => {
                  if (!date && !localState.forecastRange?.gte) {
                    setLocalState((prev) => ({ ...prev, forecastRange: undefined }));
                  } else {
                    setLocalState((prev) => ({
                      ...prev,
                      forecastRange: {
                        ...(localState.forecastRange?.gte && { gte: localState.forecastRange.gte }),
                        ...(date && { lte: date }),
                      },
                    }));
                  }
                }}
                label="Até"
                placeholder="Selecionar data final..."
                context="delivery"
              />
            </div>
          </div>

          <div className="space-y-3">
            <div className="text-sm font-medium">Data de conclusão</div>
            <div className="grid grid-cols-2 gap-3">
              <DateTimeInput
                mode="date"
                value={localState.updatedAtRange?.gte}
                onChange={(date: Date | null) => {
                  if (!date && !localState.updatedAtRange?.lte) {
                    setLocalState((prev) => ({ ...prev, updatedAtRange: undefined }));
                  } else {
                    setLocalState((prev) => ({
                      ...prev,
                      updatedAtRange: {
                        ...(date && { gte: date }),
                        ...(localState.updatedAtRange?.lte && { lte: localState.updatedAtRange.lte }),
                      },
                    }));
                  }
                }}
                label="De"
                placeholder="Selecionar data inicial..."
              />
              <DateTimeInput
                mode="date"
                value={localState.updatedAtRange?.lte}
                onChange={(date: Date | null) => {
                  if (!date && !localState.updatedAtRange?.gte) {
                    setLocalState((prev) => ({ ...prev, updatedAtRange: undefined }));
                  } else {
                    setLocalState((prev) => ({
                      ...prev,
                      updatedAtRange: {
                        ...(localState.updatedAtRange?.gte && { gte: localState.updatedAtRange.gte }),
                        ...(date && { lte: date }),
                      },
                    }));
                  }
                }}
                label="Até"
                placeholder="Selecionar data final..."
              />
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-2 pt-4 border-t">
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
