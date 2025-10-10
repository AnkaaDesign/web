import { useState, useEffect, useMemo } from "react";
import type { DateRange } from "react-day-picker";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { DateTimeInput } from "@/components/ui/date-time-input";
import { Combobox } from "@/components/ui/combobox";
import { IconFilter, IconX, IconBriefcase, IconMapPin, IconCalendarPlus, IconTags } from "@tabler/icons-react";
import { useCustomerFilters } from "@/hooks/use-customer-filters";
import { BRAZILIAN_STATES, BRAZILIAN_STATE_NAMES } from "../../../../constants";

interface CustomerFiltersProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

// Local filter state interface
interface LocalFilterState {
  hasTasks?: boolean;
  states?: string[];
  tags?: string[];
  taskCount?: { min?: number; max?: number };
  createdAt?: { gte?: Date; lte?: Date };
}

export function CustomerFilters({ open, onOpenChange }: CustomerFiltersProps) {
  const { filters: urlFilters, setFilters, resetFilters: resetUrlFilters } = useCustomerFilters();

  // Local state for filters (UI changes)
  const [localState, setLocalState] = useState<LocalFilterState>({});
  const [customTags, setCustomTags] = useState<string>("");

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
        hasTasks: urlFilters.hasTasks,
        states: urlFilters.states,
        tags: urlFilters.tags,
        taskCount: urlFilters.taskCount,
        createdAt: urlFilters.createdAt,
      });
    }
  }, [open, urlFilters]);

  // Count active filters in local state
  const localActiveFilterCount = useMemo(() => {
    let count = 0;
    if (localState.hasTasks) count++;
    if (localState.states && localState.states.length > 0) count++;
    if (localState.tags && localState.tags.length > 0) count++;
    if (localState.taskCount?.min || localState.taskCount?.max) count++;
    if (localState.createdAt?.gte || localState.createdAt?.lte) count++;
    return count;
  }, [localState]);

  const handleAddTag = () => {
    if (customTags.trim()) {
      const newTags = customTags
        .split(",")
        .map((tag) => tag.trim())
        .filter(Boolean);
      setLocalState((prev) => ({
        ...prev,
        tags: [...(prev.tags || []), ...newTags],
      }));
      setCustomTags("");
    }
  };

  const handleRemoveTag = (tagToRemove: string) => {
    setLocalState((prev) => ({
      ...prev,
      tags: prev.tags?.filter((tag) => tag !== tagToRemove),
    }));
  };

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
    setCustomTags("");
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
          {/* Has Tasks Filter */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label htmlFor="hasTasks" className="text-sm font-normal flex items-center gap-2">
                <IconBriefcase className="h-4 w-4 text-muted-foreground" />
                Possui tarefas
              </Label>
              <Switch id="hasTasks" checked={localState.hasTasks ?? false} onCheckedChange={(checked) => setLocalState((prev) => ({ ...prev, hasTasks: checked || undefined }))} />
            </div>
            <p className="text-xs text-muted-foreground">Clientes que possuem tarefas associadas</p>
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
              onValueChange={(states: string[]) => setLocalState((prev) => ({ ...prev, states: states.length > 0 ? states : undefined }))}
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

          {/* Tags Filter */}
          <div className="space-y-2">
            <Label className="flex items-center gap-2">
              <IconTags className="h-4 w-4" />
              Tags
            </Label>
            <div className="flex gap-2">
              <Input
                placeholder="Digite tags separadas por vírgula..."
                value={customTags}
                onChange={(value) => setCustomTags(value as string)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    handleAddTag();
                  }
                }}
              />
              <Button type="button" onClick={handleAddTag} size="sm">
                Adicionar
              </Button>
            </div>
            {localState.tags && localState.tags.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-2">
                {localState.tags.map((tag) => (
                  <Badge key={tag} variant="secondary" className="cursor-pointer" onClick={() => handleRemoveTag(tag)}>
                    {tag}
                    <IconX className="h-3 w-3 ml-1" />
                  </Badge>
                ))}
              </div>
            )}
          </div>

          <Separator />

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
              description="Filtra por período de cadastro do cliente"
              numberOfMonths={2}
            />
          </div>

          {/* Action Buttons */}
          <div className="flex gap-2 pt-4 border-t">
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
