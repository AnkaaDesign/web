import { useState, useEffect, useMemo } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { DateTimeInput } from "@/components/ui/date-time-input";
import { Combobox } from "@/components/ui/combobox";
import { IconFilter, IconX, IconBriefcase, IconMapPin, IconCalendarPlus } from "@tabler/icons-react";
import { useCustomerFilters } from "@/hooks/use-customer-filters";
import { BRAZILIAN_STATES, BRAZILIAN_STATE_NAMES } from "../../../../constants";

interface CustomerFiltersProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

// Local filter state interface
interface LocalFilterState {
  states?: string[];
  taskCount?: { min?: number; max?: number };
  createdAt?: { gte?: Date; lte?: Date };
}

export function CustomerFilters({ open, onOpenChange }: CustomerFiltersProps) {
  const { filters: urlFilters, setFilters, resetFilters: resetUrlFilters } = useCustomerFilters();

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
        states: urlFilters.states,
        taskCount: urlFilters.taskCount,
        createdAt: urlFilters.createdAt,
      });
    }
  }, [open, urlFilters]);

  // Count active filters in local state
  const localActiveFilterCount = useMemo(() => {
    let count = 0;
    if (localState.states && localState.states.length > 0) count++;
    if (localState.taskCount?.min || localState.taskCount?.max) count++;
    if (localState.createdAt?.gte || localState.createdAt?.lte) count++;
    return count;
  }, [localState]);

  const handleApply = () => {
    // Prepare batch filter update - only include non-empty values
    const filtersToApply: any = {};

    Object.keys(localState).forEach((key) => {
      const value = localState[key as keyof LocalFilterState];

      if (value === undefined || (Array.isArray(value) && value.length === 0)) {
        filtersToApply[key] = undefined;
      } else {
        filtersToApply[key] = value;
      }
    });

    // Use batch update instead of individual setFilter calls
    setFilters(filtersToApply);

    // Close dialog after applying
    setTimeout(() => {
      onOpenChange(false);
    }, 50);
  };

  const handleReset = () => {
    // Clear local state
    setLocalState({});
    // Clear URL filters
    resetUrlFilters();
    // Close dialog
    setTimeout(() => {
      onOpenChange(false);
    }, 50);
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <IconFilter className="h-5 w-5" />
            Clientes - Filtros
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
          </SheetTitle>
          <SheetDescription>Configure filtros para refinar a pesquisa de clientes</SheetDescription>
        </SheetHeader>

        <div className="mt-6 space-y-6">
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
              onValueChange={(states: string[]) => setLocalState((prev) => ({ ...prev, states: states.length > 0 ? states : undefined }))}
              placeholder="Selecione estados..."
              emptyText="Nenhum estado encontrado"
              searchPlaceholder="Buscar estados..."
              searchable={true}
              minSearchLength={0}
            />
            {localState.states && localState.states.length > 0 && (
              <div className="text-xs text-muted-foreground">
                {localState.states.length} estado{localState.states.length !== 1 ? "s" : ""} selecionado{localState.states.length !== 1 ? "s" : ""}
              </div>
            )}
          </div>

          {/* Task Count Range */}
          <div className="space-y-2">
            <Label className="text-sm font-medium flex items-center gap-2">
              <IconBriefcase className="h-4 w-4" />
              Quantidade de Tarefas
            </Label>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label htmlFor="taskCountMin" className="text-xs text-muted-foreground">
                  Mínimo
                </Label>
                <Input
                  id="taskCountMin"
                  type="number"
                  min="0"
                  placeholder="Valor mínimo"
                  value={localState.taskCount?.min?.toString() || ""}
                  onChange={(value) => {
                    const strValue = value as string;
                    const min = strValue ? parseInt(strValue, 10) : undefined;
                    if (min !== undefined && isNaN(min)) return;
                    setLocalState((prev) => ({
                      ...prev,
                      taskCount: {
                        ...prev.taskCount,
                        min: min,
                      },
                    }));
                  }}
                  className="bg-transparent"
                />
              </div>
              <div>
                <Label htmlFor="taskCountMax" className="text-xs text-muted-foreground">
                  Máximo
                </Label>
                <Input
                  id="taskCountMax"
                  type="number"
                  min="0"
                  placeholder="Sem limite"
                  value={localState.taskCount?.max?.toString() || ""}
                  onChange={(value) => {
                    const strValue = value as string;
                    const max = strValue ? parseInt(strValue, 10) : undefined;
                    if (max !== undefined && isNaN(max)) return;
                    setLocalState((prev) => ({
                      ...prev,
                      taskCount: {
                        ...prev.taskCount,
                        max: max,
                      },
                    }));
                  }}
                  className="bg-transparent"
                />
              </div>
            </div>
            {(localState.taskCount?.min || localState.taskCount?.max) && (
              <div className="text-xs text-muted-foreground">
                {localState.taskCount?.min && localState.taskCount?.max
                  ? `Entre ${localState.taskCount.min} e ${localState.taskCount.max} tarefas`
                  : localState.taskCount?.min
                    ? `Pelo menos ${localState.taskCount.min} tarefas`
                    : `Até ${localState.taskCount.max} tarefas`}
              </div>
            )}
          </div>

          {/* Created At Date Range */}
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-sm font-medium">
              <IconCalendarPlus className="h-4 w-4" />
              Data de Cadastro
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs text-muted-foreground mb-1 block">De</Label>
                <DateTimeInput
                  mode="date"
                  value={localState.createdAt?.gte}
                  onChange={(date: Date | null) => {
                    if (!date && !localState.createdAt?.lte) {
                      setLocalState((prev) => ({ ...prev, createdAt: undefined }));
                    } else {
                      setLocalState((prev) => ({
                        ...prev,
                        createdAt: {
                          ...(date && { gte: date }),
                          ...(localState.createdAt?.lte && { lte: localState.createdAt.lte }),
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
                  value={localState.createdAt?.lte}
                  onChange={(date: Date | null) => {
                    if (!date && !localState.createdAt?.gte) {
                      setLocalState((prev) => ({ ...prev, createdAt: undefined }));
                    } else {
                      setLocalState((prev) => ({
                        ...prev,
                        createdAt: {
                          ...(localState.createdAt?.gte && { gte: localState.createdAt.gte }),
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
              Limpar Filtros
            </Button>
            <Button onClick={handleApply} className="flex-1">
              Aplicar Filtros
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
