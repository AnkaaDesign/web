import { useState, useEffect } from "react";
import type { ExternalWithdrawalGetManyFormData } from "../../../../schemas";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { IconFilter, IconX } from "@tabler/icons-react";
import { EXTERNAL_WITHDRAWAL_STATUS, EXTERNAL_WITHDRAWAL_STATUS_LABELS } from "../../../../constants";
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
  willReturn?: boolean;
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
      willReturn: filters.willReturn,
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

    // Add boolean filters
    if (typeof localState.willReturn === "boolean") {
      newFilters.willReturn = localState.willReturn;
    }
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
    if (typeof localState.willReturn === "boolean") count++;
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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] h-[70vh] max-h-[700px] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <IconFilter className="h-5 w-5 text-muted-foreground" />
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
          </DialogTitle>
          <DialogDescription>Configure filtros para refinar a pesquisa de retiradas externas</DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-auto space-y-6 p-4">
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

          {/* Boolean Filters */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <Label htmlFor="will-return">Com devolução</Label>
              <div className="flex items-center gap-2">
                <Switch
                  id="will-return"
                  checked={localState.willReturn === true}
                  onCheckedChange={(checked) =>
                    setLocalState((prev) => ({
                      ...prev,
                      willReturn: checked ? true : prev.willReturn === true ? undefined : false,
                    }))
                  }
                />
                <Button variant="ghost" size="sm" className="h-6 px-2" onClick={() => setLocalState((prev) => ({ ...prev, willReturn: undefined }))}>
                  <IconX className="h-3 w-3" />
                </Button>
              </div>
            </div>

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
          <div className="space-y-2">
            <Label className="text-sm font-medium">Período de criação</Label>
            <DateTimeInput
              mode="date-range"
              value={localState.createdAtRange}
              onChange={(range) => setLocalState((prev) => ({ ...prev, createdAtRange: range }))}
              placeholder="Selecione o período"
            />
          </div>
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
