import { useState, useEffect, useMemo } from "react";
import type { SupplierGetManyFormData } from "../../../../schemas";
import type { DateRange } from "react-day-picker";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { DateTimeInput } from "@/components/ui/date-time-input";
import { Combobox } from "@/components/ui/combobox";
import { IconFilter, IconX, IconShoppingCart, IconMapPin, IconCalendarPlus, IconPackages } from "@tabler/icons-react";
import { BRAZILIAN_STATES, BRAZILIAN_STATE_NAMES } from "../../../../constants";

interface SupplierFiltersProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  filters: Partial<SupplierGetManyFormData>;
  onFilterChange: (filters: Partial<SupplierGetManyFormData>) => void;
}

// Local filter state interface
interface LocalFilterState {
  hasActiveOrders?: boolean;
  hasLogo?: boolean;
  hasItems?: boolean;
  hasOrders?: boolean;
  hasCnpj?: boolean;
  hasEmail?: boolean;
  hasSite?: boolean;
  states?: string[];
  cities?: string[];
  phoneContains?: string;
  cnpj?: string;
  itemCount?: { min?: number; max?: number };
  orderCount?: { min?: number; max?: number };
  createdAt?: { gte?: Date; lte?: Date };
  updatedAt?: { gte?: Date; lte?: Date };
}

export function SupplierFilters({ open, onOpenChange, filters, onFilterChange }: SupplierFiltersProps) {
  // Local state for filters (UI changes)
  const [localState, setLocalState] = useState<LocalFilterState>({});

  // Create state options
  const stateOptions = useMemo(
    () =>
      BRAZILIAN_STATES.map((state) => ({
        value: state,
        label: BRAZILIAN_STATE_NAMES[state] || state,
      })),
    [],
  );

  // Initialize local state when dialog opens
  useEffect(() => {
    if (open) {
      setLocalState({
        hasActiveOrders: filters.hasActiveOrders,
        hasLogo: filters.hasLogo,
        hasItems: filters.hasItems,
        hasOrders: filters.hasOrders,
        hasCnpj: filters.hasCnpj,
        hasEmail: filters.hasEmail,
        hasSite: filters.hasSite,
        states: filters.states,
        cities: filters.cities,
        phoneContains: filters.phoneContains,
        cnpj: filters.cnpj,
        itemCount: filters.itemCount,
        orderCount: filters.orderCount,
        createdAt: filters.createdAt,
        updatedAt: filters.updatedAt,
      });
    }
  }, [open, filters]);

  // Count active filters in local state
  const localActiveFilterCount = useMemo(() => {
    let count = 0;
    if (localState.hasActiveOrders) count++;
    if (localState.hasLogo !== undefined) count++;
    if (localState.hasItems !== undefined) count++;
    if (localState.hasOrders !== undefined) count++;
    if (localState.hasCnpj !== undefined) count++;
    if (localState.hasEmail !== undefined) count++;
    if (localState.hasSite !== undefined) count++;
    if (localState.states && localState.states.length > 0) count++;
    if (localState.cities && localState.cities.length > 0) count++;
    if (localState.phoneContains) count++;
    if (localState.cnpj) count++;
    if (localState.itemCount?.min || localState.itemCount?.max) count++;
    if (localState.orderCount?.min || localState.orderCount?.max) count++;
    if (localState.createdAt?.gte || localState.createdAt?.lte) count++;
    if (localState.updatedAt?.gte || localState.updatedAt?.lte) count++;
    return count;
  }, [localState]);

  const handleApply = () => {
    // Prepare batch filter update - only include non-empty values
    const filtersToApply: Partial<SupplierGetManyFormData> = {};

    Object.keys(localState).forEach((key) => {
      const value = localState[key as keyof LocalFilterState];

      if (value === undefined || (Array.isArray(value) && value.length === 0) || value === "") {
        // Don't include undefined/empty values
      } else {
        (filtersToApply as any)[key] = value;
      }
    });

    // Use the onFilterChange callback
    onFilterChange(filtersToApply);

    // Close dialog after applying
    setTimeout(() => {
      onOpenChange(false);
    }, 50);
  };

  const handleReset = () => {
    // Clear local state
    setLocalState({});
    // Clear filters via callback
    onFilterChange({});
    // Close dialog
    setTimeout(() => {
      onOpenChange(false);
    }, 50);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] h-[70vh] max-h-[700px] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <IconFilter className="h-5 w-5 text-muted-foreground" />
            Fornecedores - Filtros
            {localActiveFilterCount > 0 && (
              <Badge
                variant="secondary"
                className="ml-2 cursor-pointer hover:bg-destructive hover:text-destructive-foreground transition-colors"
                onClick={() => setLocalState({})}
                title="Clique para limpar todos os filtros"
              >
                {localActiveFilterCount}
              </Badge>
            )}
          </DialogTitle>
          <DialogDescription>Configure filtros para refinar a pesquisa de fornecedores</DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-auto space-y-6 py-4">
          {/* Active Orders Filter */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label htmlFor="hasActiveOrders" className="text-sm font-normal flex items-center gap-2">
                <IconShoppingCart className="h-4 w-4 text-muted-foreground" />
                Pedidos ativos
              </Label>
              <Switch
                id="hasActiveOrders"
                checked={localState.hasActiveOrders ?? false}
                onCheckedChange={(checked) => setLocalState((prev) => ({ ...prev, hasActiveOrders: checked || undefined }))}
              />
            </div>
            <p className="text-xs text-muted-foreground">Fornecedores com pedidos em andamento (exceto cancelados ou recebidos)</p>
          </div>

          <Separator />

          {/* States Filter */}
          <div className="space-y-2">
            <Label className="flex items-center gap-2">
              <IconMapPin className="h-4 w-4" />
              Estados
            </Label>
            <Combobox
              mode="multiple"
              options={stateOptions}
              value={localState.states || []}
              onValueChange={(states) => setLocalState((prev) => ({ ...prev, states: states.length > 0 ? states : undefined }))}
              placeholder="Selecione estados..."
              emptyText="Nenhum estado encontrado"
              searchPlaceholder="Buscar estados..."
            />
            {localState.states && localState.states.length > 0 && (
              <div className="text-xs text-muted-foreground">
                {localState.states.length} estado{localState.states.length !== 1 ? "s" : ""} selecionado{localState.states.length !== 1 ? "s" : ""}
              </div>
            )}
          </div>

          <Separator />

          {/* Item Count Range */}
          <div className="space-y-2">
            <Label className="text-sm font-medium flex items-center gap-2">
              <IconPackages className="h-4 w-4" />
              Quantidade de Itens
            </Label>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label htmlFor="itemCountMin" className="text-xs text-muted-foreground">
                  Mínimo
                </Label>
                <Input
                  id="itemCountMin"
                  type="number"
                  min="0"
                  placeholder="Valor mínimo"
                  value={localState.itemCount?.min?.toString() || ""}
                  onChange={(e) => {
                    const min = e.target.value ? parseInt(e.target.value, 10) : undefined;
                    if (min !== undefined && isNaN(min)) return;
                    setLocalState((prev) => ({
                      ...prev,
                      itemCount: {
                        ...prev.itemCount,
                        min: min,
                      },
                    }));
                  }}
                />
              </div>
              <div>
                <Label htmlFor="itemCountMax" className="text-xs text-muted-foreground">
                  Máximo
                </Label>
                <Input
                  id="itemCountMax"
                  type="number"
                  min="0"
                  placeholder="Sem limite"
                  value={localState.itemCount?.max?.toString() || ""}
                  onChange={(e) => {
                    const max = e.target.value ? parseInt(e.target.value, 10) : undefined;
                    if (max !== undefined && isNaN(max)) return;
                    setLocalState((prev) => ({
                      ...prev,
                      itemCount: {
                        ...prev.itemCount,
                        max: max,
                      },
                    }));
                  }}
                />
              </div>
            </div>
            {(localState.itemCount?.min || localState.itemCount?.max) && (
              <div className="text-xs text-muted-foreground">
                {localState.itemCount?.min && localState.itemCount?.max
                  ? `Entre ${localState.itemCount.min} e ${localState.itemCount.max} itens`
                  : localState.itemCount?.min
                    ? `Pelo menos ${localState.itemCount.min} itens`
                    : `Até ${localState.itemCount.max} itens`}
              </div>
            )}
          </div>

          <Separator />

          {/* Created At Date Range */}
          <div className="space-y-2">
            <DateTimeInput
              mode="date-range"
              value={{
                from: localState.createdAt?.gte,
                to: localState.createdAt?.lte,
              }}
              onChange={(dateRange: DateRange | null) => {
                if (!dateRange || (!dateRange.from && !dateRange.to)) {
                  setLocalState((prev) => ({ ...prev, createdAt: undefined }));
                } else {
                  setLocalState((prev) => ({
                    ...prev,
                    createdAt: {
                      ...(dateRange.from && { gte: dateRange.from }),
                      ...(dateRange.to && { lte: dateRange.to }),
                    },
                  }));
                }
              }}
              label={
                <div className="flex items-center gap-2">
                  <IconCalendarPlus className="h-4 w-4" />
                  Data de Cadastro
                </div>
              }
              placeholder="Selecionar período..."
              description="Filtra por período de cadastro do fornecedor"
              numberOfMonths={2}
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
            {localActiveFilterCount > 0 && (
              <Badge variant="secondary" className="ml-2">
                {localActiveFilterCount}
              </Badge>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
