import { useState, useEffect } from "react";
import type { ExternalOperationGetManyFormData } from "../../../../schemas";
import { FilterDrawer } from "@/components/common/filters/ui/FilterDrawer";
import { Label } from "@/components/ui/label";
import { IconFilter } from "@tabler/icons-react";
import { EXTERNAL_OPERATION_STATUS, EXTERNAL_OPERATION_STATUS_LABELS, EXTERNAL_OPERATION_TYPE, EXTERNAL_OPERATION_TYPE_LABELS } from "../../../../constants";
import { Combobox } from "@/components/ui/combobox";
import { DateTimeInput } from "@/components/ui/date-time-input";
import type { DateRange } from "react-day-picker";

interface ExternalOperationFiltersProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  filters: Partial<ExternalOperationGetManyFormData>;
  onFilterChange: (filters: Partial<ExternalOperationGetManyFormData>) => void;
}

interface FilterState {
  statuses?: EXTERNAL_OPERATION_STATUS[];
  types?: EXTERNAL_OPERATION_TYPE[];
  hasInvoice?: boolean;
  hasReceipt?: boolean;
  createdAtRange?: { gte?: Date; lte?: Date };
}

export function ExternalOperationFilters({ open, onOpenChange, filters, onFilterChange }: ExternalOperationFiltersProps) {
  const [localState, setLocalState] = useState<FilterState>({});

  // Initialize local state from filters only when dialog opens
  useEffect(() => {
    if (!open) return;

    setLocalState({
      statuses: filters.statuses || [],
      types: filters.types || [],
      hasInvoice: filters.hasInvoice,
      hasReceipt: filters.hasReceipt,
      createdAtRange: filters.createdAt,
    });
  }, [open, filters]);

  const handleApply = () => {
    // Build the filters object from local state
    const newFilters: Partial<ExternalOperationGetManyFormData> = {
      limit: filters.limit,
      orderBy: filters.orderBy,
    };

    // Add status filter
    if (localState.statuses && localState.statuses.length > 0) {
      newFilters.statuses = localState.statuses;
    }

    // Add type filter
    if (localState.types && localState.types.length > 0) {
      newFilters.types = localState.types;
    }

    // Add boolean filters
    if (typeof localState.hasInvoice === "boolean") {
      newFilters.hasInvoice = localState.hasInvoice;
    }
    if (typeof localState.hasReceipt === "boolean") {
      newFilters.hasReceipt = localState.hasReceipt;
    }

    // Add date filters
    if (localState.createdAtRange) {
      newFilters.createdAt = localState.createdAtRange;
    }

    // Apply filters first, then close dialog with a small delay
    onFilterChange(newFilters);
    setTimeout(() => {
      onOpenChange(false);
    }, 0);
  };

  const handleReset = () => {
    const resetFilters: Partial<ExternalOperationGetManyFormData> = {
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
    if (localState.statuses && localState.statuses.length > 0) count += localState.statuses.length;
    if (localState.types && localState.types.length > 0) count += localState.types.length;
    if (typeof localState.hasInvoice === "boolean") count++;
    if (typeof localState.hasReceipt === "boolean") count++;
    if (localState.createdAtRange?.gte || localState.createdAtRange?.lte) count++;
    return count;
  };

  const activeFilterCount = countActiveFilters();

  const statusOptions = Object.values(EXTERNAL_OPERATION_STATUS).map((status) => ({
    value: status,
    label: EXTERNAL_OPERATION_STATUS_LABELS[status],
  }));

  const typeOptions = Object.values(EXTERNAL_OPERATION_TYPE).map((type) => ({
    value: type,
    label: EXTERNAL_OPERATION_TYPE_LABELS[type],
  }));

  return (
    <FilterDrawer
      open={open}
      onOpenChange={onOpenChange}
      title="Operações Externas - Filtros"
      titleIcon={<IconFilter className="h-5 w-5" />}
      description="Configure filtros para refinar a pesquisa de operações externas"
      activeFilterCount={activeFilterCount}
      onApply={handleApply}
      onReset={handleReset}
    >
      {/* Status Filter */}
      <div className="space-y-2">
        <Label className="text-sm font-medium">Status</Label>
        <Combobox
          mode="multiple"
          options={statusOptions}
          value={localState.statuses || []}
          onValueChange={(value: string | string[] | null | undefined) => {
            if (!Array.isArray(value)) return;
            setLocalState((prev) => ({ ...prev, statuses: value as EXTERNAL_OPERATION_STATUS[] }));
          }}
          placeholder="Selecione os status"
          emptyText="Nenhum status encontrado"
        />
      </div>

      {/* Type Filter */}
      <div className="space-y-2">
        <Label className="text-sm font-medium">Tipo</Label>
        <Combobox
          mode="multiple"
          options={typeOptions}
          value={localState.types || []}
          onValueChange={(value: string | string[] | null | undefined) => {
            if (!Array.isArray(value)) return;
            setLocalState((prev) => ({ ...prev, types: value as EXTERNAL_OPERATION_TYPE[] }));
          }}
          placeholder="Selecione os tipos"
          emptyText="Nenhum tipo encontrado"
        />
      </div>

      {/* Boolean Filters */}
      <div className="space-y-4">

        <div className="space-y-2">
          <Label htmlFor="has-invoice">Nota fiscal</Label>
          <Combobox
            mode="single"
            value={localState.hasInvoice === true ? "yes" : localState.hasInvoice === false ? "no" : "all"}
            onValueChange={(value) =>
              setLocalState((prev) => ({
                ...prev,
                hasInvoice: value === "yes" ? true : value === "no" ? false : undefined,
              }))
            }
            options={[
              { value: "all", label: "Todos" },
              { value: "yes", label: "Com nota fiscal" },
              { value: "no", label: "Sem nota fiscal" },
            ]}
            placeholder="Selecione..."
            searchable={false}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="has-receipt">Recibo</Label>
          <Combobox
            mode="single"
            value={localState.hasReceipt === true ? "yes" : localState.hasReceipt === false ? "no" : "all"}
            onValueChange={(value) =>
              setLocalState((prev) => ({
                ...prev,
                hasReceipt: value === "yes" ? true : value === "no" ? false : undefined,
              }))
            }
            options={[
              { value: "all", label: "Todos" },
              { value: "yes", label: "Com recibo" },
              { value: "no", label: "Sem recibo" },
            ]}
            placeholder="Selecione..."
            searchable={false}
          />
        </div>
      </div>

      {/* Date Filter */}
      <div className="space-y-3">
        <div className="text-sm font-medium">Período de criação</div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label className="text-xs text-muted-foreground mb-1 block">De</Label>
            <DateTimeInput
              mode="date"
              value={localState.createdAtRange?.gte}
              onChange={(date: Date | DateRange | null) => {
                if (date && !(date instanceof Date)) return;
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
              onChange={(date: Date | DateRange | null) => {
                if (date && !(date instanceof Date)) return;
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
    </FilterDrawer>
  );
}
