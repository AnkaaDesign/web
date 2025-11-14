import { useState, useEffect } from "react";
import type { ExternalWithdrawalGetManyFormData } from "../../../../schemas";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { IconFilter, IconX } from "@tabler/icons-react";
import { EXTERNAL_WITHDRAWAL_STATUS, EXTERNAL_WITHDRAWAL_STATUS_LABELS, EXTERNAL_WITHDRAWAL_TYPE, EXTERNAL_WITHDRAWAL_TYPE_LABELS } from "../../../../constants";
import { Combobox } from "@/components/ui/combobox";
import { DateTimeInput } from "@/components/ui/date-time-input";

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
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <IconFilter className="h-5 w-5" />
            Retiradas Externas - Filtros
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
          <SheetDescription>Configure filtros para refinar a pesquisa de retiradas externas</SheetDescription>
        </SheetHeader>

        <div className="mt-6 space-y-6">
          {/* Status Filter */}
          <div className="space-y-2">
            <Label className="text-sm font-medium">Status</Label>
            <Combobox
              mode="multiple"
              options={statusOptions}
              value={localState.statuses || []}
              onValueChange={(values: string[]) => setLocalState((prev) => ({ ...prev, statuses: values as EXTERNAL_WITHDRAWAL_STATUS[] }))}
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
              onValueChange={(values: string[]) => setLocalState((prev) => ({ ...prev, types: values as EXTERNAL_WITHDRAWAL_TYPE[] }))}
              placeholder="Selecione os tipos"
              emptyText="Nenhum tipo encontrado"
            />
          </div>

          {/* Boolean Filters */}
          <div className="space-y-4">

            <div className="flex items-center justify-between">
              <Label htmlFor="has-nfe">Com NFe</Label>
              <div className="flex items-center gap-2">
                <Switch
                  id="has-nfe"
                  checked={localState.hasNfe === true}
                  onCheckedChange={(checked) =>
                    setLocalState((prev) => ({
                      ...prev,
                      hasNfe: checked ? true : prev.hasNfe === true ? undefined : false,
                    }))
                  }
                />
                <Button variant="ghost" size="sm" className="h-6 px-2" onClick={() => setLocalState((prev) => ({ ...prev, hasNfe: undefined }))}>
                  <IconX className="h-3 w-3" />
                </Button>
              </div>
            </div>

            <div className="flex items-center justify-between">
              <Label htmlFor="has-receipt">Com recibo</Label>
              <div className="flex items-center gap-2">
                <Switch
                  id="has-receipt"
                  checked={localState.hasReceipt === true}
                  onCheckedChange={(checked) =>
                    setLocalState((prev) => ({
                      ...prev,
                      hasReceipt: checked ? true : prev.hasReceipt === true ? undefined : false,
                    }))
                  }
                />
                <Button variant="ghost" size="sm" className="h-6 px-2" onClick={() => setLocalState((prev) => ({ ...prev, hasReceipt: undefined }))}>
                  <IconX className="h-3 w-3" />
                </Button>
              </div>
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
                  hideLabel
                  placeholder="Selecionar data inicial..."
                />
              </div>
              <div>
                <Label className="text-xs text-muted-foreground mb-1 block">Até</Label>
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
                  hideLabel
                  placeholder="Selecionar data final..."
                />
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-2 mt-6 pt-4 border-t">
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
