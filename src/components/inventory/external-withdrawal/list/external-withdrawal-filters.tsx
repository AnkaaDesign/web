import { useState, useEffect } from "react";
import type { ExternalWithdrawalGetManyFormData } from "../../../../schemas";
import { FilterDrawer } from "@/components/common/filters/ui/FilterDrawer";
import { Label } from "@/components/ui/label";
import { IconFilter } from "@tabler/icons-react";
import { EXTERNAL_WITHDRAWAL_STATUS, EXTERNAL_WITHDRAWAL_STATUS_LABELS, EXTERNAL_WITHDRAWAL_TYPE, EXTERNAL_WITHDRAWAL_TYPE_LABELS } from "../../../../constants";
import { Combobox } from "@/components/ui/combobox";
import { DateTimeInput } from "@/components/ui/date-time-input";
import type { DateRange } from "react-day-picker";

interface ExternalWithdrawalFiltersProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  filters: Partial<ExternalWithdrawalGetManyFormData>;
  onFilterChange: (filters: Partial<ExternalWithdrawalGetManyFormData>) => void;
}

interface FilterState {
  statuses?: EXTERNAL_WITHDRAWAL_STATUS[];
  types?: EXTERNAL_WITHDRAWAL_TYPE[];
  hasNfe?: boolean;
  hasReceipt?: boolean;
  createdAtRange?: { gte?: Date; lte?: Date };
}

export function ExternalWithdrawalFilters({ open, onOpenChange, filters, onFilterChange }: ExternalWithdrawalFiltersProps) {
  const [localState, setLocalState] = useState<FilterState>({});

  // Initialize local state from filters only when dialog opens
  useEffect(() => {
    if (!open) return;

    setLocalState({
      statuses: filters.statuses || [],
      types: filters.types || [],
      hasNfe: filters.hasNfe,
      hasReceipt: filters.hasReceipt,
      createdAtRange: filters.createdAt,
    });
  }, [open, filters]);

  const handleApply = () => {
    // Build the filters object from local state
    const newFilters: Partial<ExternalWithdrawalGetManyFormData> = {
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
    if (typeof localState.hasNfe === "boolean") {
      newFilters.hasNfe = localState.hasNfe;
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
    const resetFilters: Partial<ExternalWithdrawalGetManyFormData> = {
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
    if (typeof localState.hasNfe === "boolean") count++;
    if (typeof localState.hasReceipt === "boolean") count++;
    if (localState.createdAtRange?.gte || localState.createdAtRange?.lte) count++;
    return count;
  };

  const activeFilterCount = countActiveFilters();

  const statusOptions = Object.values(EXTERNAL_WITHDRAWAL_STATUS).map((status) => ({
    value: status,
    label: EXTERNAL_WITHDRAWAL_STATUS_LABELS[status],
  }));

  const typeOptions = Object.values(EXTERNAL_WITHDRAWAL_TYPE).map((type) => ({
    value: type,
    label: EXTERNAL_WITHDRAWAL_TYPE_LABELS[type],
  }));

  return (
    <FilterDrawer
      open={open}
      onOpenChange={onOpenChange}
      title="Retiradas Externas - Filtros"
      titleIcon={<IconFilter className="h-5 w-5" />}
      description="Configure filtros para refinar a pesquisa de retiradas externas"
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
            setLocalState((prev) => ({ ...prev, statuses: value as EXTERNAL_WITHDRAWAL_STATUS[] }));
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
            setLocalState((prev) => ({ ...prev, types: value as EXTERNAL_WITHDRAWAL_TYPE[] }));
          }}
          placeholder="Selecione os tipos"
          emptyText="Nenhum tipo encontrado"
        />
      </div>

      {/* Boolean Filters */}
      <div className="space-y-4">

        <div className="space-y-2">
          <Label htmlFor="has-nfe">NFe</Label>
          <Combobox
            mode="single"
            value={localState.hasNfe === true ? "yes" : localState.hasNfe === false ? "no" : "all"}
            onValueChange={(value) =>
              setLocalState((prev) => ({
                ...prev,
                hasNfe: value === "yes" ? true : value === "no" ? false : undefined,
              }))
            }
            options={[
              { value: "all", label: "Todos" },
              { value: "yes", label: "Com NFe" },
              { value: "no", label: "Sem NFe" },
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
