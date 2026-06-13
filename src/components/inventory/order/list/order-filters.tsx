import { useState, useEffect, useCallback, useRef } from "react";
import type { OrderGetManyFormData } from "../../../../schemas";
import { FilterDrawer } from "@/components/common/filters/ui/FilterDrawer";
import { Label } from "@/components/ui/label";
import { IconFilter } from "@tabler/icons-react";
import { ORDER_STATUS, ORDER_STATUS_LABELS, ORDER_PAYMENT_STATUS, ORDER_PAYMENT_STATUS_LABELS } from "../../../../constants";
import { Combobox, type ComboboxOption } from "@/components/ui/combobox";
import { DateTimeInput } from "@/components/ui/date-time-input";
import { getSuppliers } from "../../../../api-client";
import { SupplierLogoDisplay } from "@/components/ui/avatar-display";

interface OrderFiltersProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  filters: Partial<OrderGetManyFormData>;
  onFilterChange: (filters: Partial<OrderGetManyFormData>) => void;
}

interface FilterState {
  status?: ORDER_STATUS[];
  paymentStatuses?: ORDER_PAYMENT_STATUS[];
  supplierIds?: string[];
  createdAtRange?: { gte?: Date; lte?: Date };
  forecastRange?: { gte?: Date; lte?: Date };
  updatedAtRange?: { gte?: Date; lte?: Date };
}

export function OrderFilters({ open, onOpenChange, filters, onFilterChange }: OrderFiltersProps) {
  const [localState, setLocalState] = useState<FilterState>({});

  // Create stable cache for fetched suppliers
  const suppliersCacheRef = useRef<Map<string, { label: string; value: string }>>(new Map());

  // Initialize local state from filters only when dialog opens
  useEffect(() => {
    if (!open) return;

    setLocalState({
      status: filters.status || [],
      paymentStatuses: filters.paymentStatuses || [],
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

    // Add payment status filter
    if (localState.paymentStatuses && localState.paymentStatuses.length > 0) {
      newFilters.paymentStatuses = localState.paymentStatuses;
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
    if (localState.paymentStatuses && localState.paymentStatuses.length > 0) count += localState.paymentStatuses.length;
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

  const paymentStatusOptions: ComboboxOption[] = Object.values(ORDER_PAYMENT_STATUS).map((status) => ({
    value: status,
    label: ORDER_PAYMENT_STATUS_LABELS[status],
  }));

  // Async query function for suppliers
  const querySuppliersFn = useCallback(async (searchTerm: string, page = 1) => {
    try {
      const response = await getSuppliers({
        orderBy: { fantasyName: "asc" },
        page: page,
        take: 50,
        include: { logo: true },
        where: searchTerm
          ? {
              OR: [
                { fantasyName: { contains: searchTerm, mode: "insensitive" } },
                { corporateName: { contains: searchTerm, mode: "insensitive" } },
              ],
            }
          : undefined,
      });

      const suppliers = response.data || [];
      const hasMore = response.meta?.hasNextPage || false;

      const options = suppliers.map((supplier) => {
        const option = { label: supplier.fantasyName, value: supplier.id, logo: supplier.logo };
        suppliersCacheRef.current.set(supplier.id, option);
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

  return (
    <FilterDrawer
      open={open}
      onOpenChange={onOpenChange}
      title="Pedidos - Filtros"
      titleIcon={<IconFilter className="h-5 w-5" />}
      description="Configure filtros para refinar a pesquisa de pedidos"
      activeFilterCount={activeFilterCount}
      onApply={handleApply}
      onReset={handleReset}
      applyLabel="Aplicar filtros"
      resetLabel="Limpar todos"
    >
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

          {/* Payment Status Filter */}
          <div className="space-y-2">
            <Label className="text-sm font-medium">Status de Pagamento</Label>
            <Combobox<ComboboxOption>
              options={paymentStatusOptions}
              value={localState.paymentStatuses || []}
              onValueChange={(values) =>
                setLocalState((prev) => ({ ...prev, paymentStatuses: (Array.isArray(values) ? values : []) as ORDER_PAYMENT_STATUS[] }))
              }
              placeholder="Selecione os status de pagamento"
              emptyText="Nenhum status encontrado"
              mode="multiple"
              searchable={true}
            />
          </div>

          {/* Supplier Filter */}
          <div className="space-y-2">
            <Label className="text-sm font-medium">Fornecedores</Label>
            <Combobox<ComboboxOption>
              async={true}
              queryKey={["suppliers", "order-filter"]}
              queryFn={querySuppliersFn}
              initialOptions={[]}
              value={localState.supplierIds || []}
              onValueChange={(values) => setLocalState((prev) => ({ ...prev, supplierIds: Array.isArray(values) ? values : [] }))}
              placeholder="Selecione os fornecedores"
              emptyText="Nenhum fornecedor encontrado"
              mode="multiple"
              searchable={true}
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
          </div>

          {/* Date Filters */}
          <div className="space-y-3">
            <div className="text-sm font-medium">Período de criação</div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs text-muted-foreground mb-1 block">De</Label>
                <DateTimeInput
                  mode="date"
                  value={localState.createdAtRange?.gte}
                  onChange={(date) => {
                    const dateValue = date instanceof Date ? date : null;
                    if (!dateValue && !localState.createdAtRange?.lte) {
                      setLocalState((prev) => ({ ...prev, createdAtRange: undefined }));
                    } else {
                      setLocalState((prev) => ({
                        ...prev,
                        createdAtRange: {
                          ...(dateValue && { gte: dateValue }),
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
                  onChange={(date) => {
                    const dateValue = date instanceof Date ? date : null;
                    if (!dateValue && !localState.createdAtRange?.gte) {
                      setLocalState((prev) => ({ ...prev, createdAtRange: undefined }));
                    } else {
                      setLocalState((prev) => ({
                        ...prev,
                        createdAtRange: {
                          ...(localState.createdAtRange?.gte && { gte: localState.createdAtRange.gte }),
                          ...(dateValue && { lte: dateValue }),
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

          <div className="space-y-3">
            <div className="text-sm font-medium">Previsão de entrega</div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs text-muted-foreground mb-1 block">De</Label>
                <DateTimeInput
                  mode="date"
                  value={localState.forecastRange?.gte}
                  onChange={(date) => {
                    const dateValue = date instanceof Date ? date : null;
                    if (!dateValue && !localState.forecastRange?.lte) {
                      setLocalState((prev) => ({ ...prev, forecastRange: undefined }));
                    } else {
                      setLocalState((prev) => ({
                        ...prev,
                        forecastRange: {
                          ...(dateValue && { gte: dateValue }),
                          ...(localState.forecastRange?.lte && { lte: localState.forecastRange.lte }),
                        },
                      }));
                    }
                  }}
                  hideLabel
                  placeholder="Selecionar data inicial..."
                  context="scheduled"
                />
              </div>
              <div>
                <Label className="text-xs text-muted-foreground mb-1 block">Até</Label>
                <DateTimeInput
                  mode="date"
                  value={localState.forecastRange?.lte}
                  onChange={(date) => {
                    const dateValue = date instanceof Date ? date : null;
                    if (!dateValue && !localState.forecastRange?.gte) {
                      setLocalState((prev) => ({ ...prev, forecastRange: undefined }));
                    } else {
                      setLocalState((prev) => ({
                        ...prev,
                        forecastRange: {
                          ...(localState.forecastRange?.gte && { gte: localState.forecastRange.gte }),
                          ...(dateValue && { lte: dateValue }),
                        },
                      }));
                    }
                  }}
                  hideLabel
                  placeholder="Selecionar data final..."
                  context="scheduled"
                />
              </div>
            </div>
          </div>

          <div className="space-y-3">
            <div className="text-sm font-medium">Data de conclusão</div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs text-muted-foreground mb-1 block">De</Label>
                <DateTimeInput
                  mode="date"
                  value={localState.updatedAtRange?.gte}
                  onChange={(date) => {
                    const dateValue = date instanceof Date ? date : null;
                    if (!dateValue && !localState.updatedAtRange?.lte) {
                      setLocalState((prev) => ({ ...prev, updatedAtRange: undefined }));
                    } else {
                      setLocalState((prev) => ({
                        ...prev,
                        updatedAtRange: {
                          ...(dateValue && { gte: dateValue }),
                          ...(localState.updatedAtRange?.lte && { lte: localState.updatedAtRange.lte }),
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
                  value={localState.updatedAtRange?.lte}
                  onChange={(date) => {
                    const dateValue = date instanceof Date ? date : null;
                    if (!dateValue && !localState.updatedAtRange?.gte) {
                      setLocalState((prev) => ({ ...prev, updatedAtRange: undefined }));
                    } else {
                      setLocalState((prev) => ({
                        ...prev,
                        updatedAtRange: {
                          ...(localState.updatedAtRange?.gte && { gte: localState.updatedAtRange.gte }),
                          ...(dateValue && { lte: dateValue }),
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
    </FilterDrawer>
  );
}
