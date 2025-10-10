import { useState, useEffect } from "react";
import { IconFilter, IconX } from "@tabler/icons-react";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Combobox } from "@/components/ui/combobox";
import { DateTimeInput } from "@/components/ui/date-time-input";
import type { AirbrushingGetManyFormData } from "../../../../schemas";
import type { Task } from "../../../../types";
import { Badge } from "@/components/ui/badge";
import { AIRBRUSHING_STATUS, AIRBRUSHING_STATUS_LABELS } from "../../../../constants";

interface AirbrushingFiltersProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  filters: Partial<AirbrushingGetManyFormData>;
  onFilterChange: (filters: Partial<AirbrushingGetManyFormData>) => void;
  tasks: Task[];
}

interface FilterState {
  taskIds: string[];
  status: AIRBRUSHING_STATUS[];
  priceMin?: number;
  priceMax?: number;
  hasStartDate?: boolean;
  hasFinishDate?: boolean;
  createdAfter?: Date;
  createdBefore?: Date;
}

export function AirbrushingFilters({ open, onOpenChange, filters, onFilterChange, tasks }: AirbrushingFiltersProps) {
  const [localState, setLocalState] = useState<FilterState>({
    taskIds: [],
    status: [],
    priceMin: undefined,
    priceMax: undefined,
    hasStartDate: undefined,
    hasFinishDate: undefined,
    createdAfter: undefined,
    createdBefore: undefined,
  });

  // Initialize local state from filters when dialog opens
  useEffect(() => {
    if (!open) return;

    setLocalState({
      taskIds: filters.taskIds || [],
      status: filters.status || [],
      priceMin: filters.priceRange?.min,
      priceMax: filters.priceRange?.max,
      hasStartDate: filters.hasStartDate,
      hasFinishDate: filters.hasFinishDate,
      createdAfter: filters.createdAt?.gte,
      createdBefore: filters.createdAt?.lte,
    });
  }, [open, filters]);

  const handleApply = () => {
    const newFilters: Partial<AirbrushingGetManyFormData> = {
      ...filters,
    };

    // Task IDs
    if (localState.taskIds.length > 0) {
      newFilters.taskIds = localState.taskIds;
    } else {
      delete newFilters.taskIds;
    }

    // Status
    if (localState.status.length > 0) {
      newFilters.status = localState.status;
    } else {
      delete newFilters.status;
    }

    // Price range
    if (localState.priceMin !== undefined || localState.priceMax !== undefined) {
      newFilters.priceRange = {};
      if (localState.priceMin !== undefined) {
        newFilters.priceRange.min = localState.priceMin;
      }
      if (localState.priceMax !== undefined) {
        newFilters.priceRange.max = localState.priceMax;
      }
    } else {
      delete newFilters.priceRange;
    }

    // Has start date
    if (localState.hasStartDate !== undefined) {
      newFilters.hasStartDate = localState.hasStartDate;
    } else {
      delete newFilters.hasStartDate;
    }

    // Has finish date
    if (localState.hasFinishDate !== undefined) {
      newFilters.hasFinishDate = localState.hasFinishDate;
    } else {
      delete newFilters.hasFinishDate;
    }

    // Date range
    if (localState.createdAfter || localState.createdBefore) {
      newFilters.createdAt = {};
      if (localState.createdAfter) {
        newFilters.createdAt.gte = localState.createdAfter;
      }
      if (localState.createdBefore) {
        newFilters.createdAt.lte = localState.createdBefore;
      }
    } else {
      delete newFilters.createdAt;
    }

    onFilterChange(newFilters);
    setTimeout(() => onOpenChange(false), 0); // Use timeout to prevent state update conflicts
  };

  const handleReset = () => {
    setLocalState({
      taskIds: [],
      status: [],
      priceMin: undefined,
      priceMax: undefined,
      hasStartDate: undefined,
      hasFinishDate: undefined,
      createdAfter: undefined,
      createdBefore: undefined,
    });
  };

  const getActiveFilterCount = () => {
    let count = 0;
    if (localState.taskIds.length > 0) count++;
    if (localState.status.length > 0) count++;
    if (localState.priceMin !== undefined || localState.priceMax !== undefined) count++;
    if (localState.hasStartDate !== undefined) count++;
    if (localState.hasFinishDate !== undefined) count++;
    if (localState.createdAfter || localState.createdBefore) count++;
    return count;
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <IconFilter className="h-5 w-5" />
            Filtros de Airbrushings
            {getActiveFilterCount() > 0 && <Badge variant="secondary">{getActiveFilterCount()}</Badge>}
          </SheetTitle>
          <SheetDescription>
            Configure os filtros para visualizar airbrushings específicos
          </SheetDescription>
        </SheetHeader>

        <div className="mt-6 space-y-6">
          <Tabs defaultValue="basic" className="w-full">
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="basic">Básico</TabsTrigger>
              <TabsTrigger value="status">Status</TabsTrigger>
              <TabsTrigger value="tasks">Tarefas</TabsTrigger>
              <TabsTrigger value="dates">Datas</TabsTrigger>
            </TabsList>

          <TabsContent value="basic" className="space-y-4">
            <div className="space-y-4">
              <div className="space-y-3">
                <Label className="text-base font-medium">Faixa de Preço</Label>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label className="text-sm">Preço mínimo</Label>
                    <Input
                      type="number"
                      placeholder="0.00"
                      value={localState.priceMin || ""}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                        const value = e.target.value;
                        setLocalState((prev) => ({
                          ...prev,
                          priceMin: value ? parseFloat(value) : undefined,
                        }));
                      }}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-sm">Preço máximo</Label>
                    <Input
                      type="number"
                      placeholder="999999.99"
                      value={localState.priceMax || ""}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                        const value = e.target.value;
                        setLocalState((prev) => ({
                          ...prev,
                          priceMax: value ? parseFloat(value) : undefined,
                        }));
                      }}
                    />
                  </div>
                </div>
              </div>

              <div className="space-y-3">
                <Label className="text-base font-medium">Datas de Execução</Label>
                <div className="flex flex-col space-y-3">
                  <div className="flex items-center space-x-2">
                    <Switch
                      checked={localState.hasStartDate === true}
                      onCheckedChange={(checked: boolean) => {
                        setLocalState((prev) => ({
                          ...prev,
                          hasStartDate: checked ? true : undefined,
                        }));
                      }}
                    />
                    <Label>Apenas com data de início</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Switch
                      checked={localState.hasStartDate === false}
                      onCheckedChange={(checked: boolean) => {
                        setLocalState((prev) => ({
                          ...prev,
                          hasStartDate: checked ? false : undefined,
                        }));
                      }}
                    />
                    <Label>Apenas sem data de início</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Switch
                      checked={localState.hasFinishDate === true}
                      onCheckedChange={(checked: boolean) => {
                        setLocalState((prev) => ({
                          ...prev,
                          hasFinishDate: checked ? true : undefined,
                        }));
                      }}
                    />
                    <Label>Apenas com data de finalização</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Switch
                      checked={localState.hasFinishDate === false}
                      onCheckedChange={(checked: boolean) => {
                        setLocalState((prev) => ({
                          ...prev,
                          hasFinishDate: checked ? false : undefined,
                        }));
                      }}
                    />
                    <Label>Apenas sem data de finalização</Label>
                  </div>
                </div>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="status" className="space-y-4">
            <div className="space-y-3">
              <Label className="text-base font-medium">
                Status
                {localState.status.length > 0 && (
                  <Badge variant="secondary" className="ml-2">
                    {localState.status.length}
                  </Badge>
                )}
              </Label>
              <div className="max-h-60 overflow-y-auto">
                <Combobox
                  mode="multiple"
                  options={Object.values(AIRBRUSHING_STATUS).map((status) => ({
                    value: status,
                    label: AIRBRUSHING_STATUS_LABELS[status],
                  }))}
                  value={localState.status}
                  onValueChange={(status: string[]) => {
                    setLocalState((prev) => ({ ...prev, status: status as AIRBRUSHING_STATUS[] }));
                  }}
                  placeholder="Selecionar status..."
                  searchPlaceholder="Buscar status..."
                />
              </div>
            </div>
          </TabsContent>

          <TabsContent value="tasks" className="space-y-4">
            <div className="space-y-3">
              <Label className="text-base font-medium">
                Tarefas
                {localState.taskIds.length > 0 && (
                  <Badge variant="secondary" className="ml-2">
                    {localState.taskIds.length}
                  </Badge>
                )}
              </Label>
              <div className="max-h-60 overflow-y-auto">
                <Combobox
                  mode="multiple"
                  options={tasks.map((task) => ({
                    value: task.id,
                    label: task.name,
                  }))}
                  value={localState.taskIds}
                  onValueChange={(taskIds: string[]) => {
                    setLocalState((prev) => ({ ...prev, taskIds }));
                  }}
                  placeholder="Selecionar tarefas..."
                  searchPlaceholder="Buscar tarefas..."
                />
              </div>
            </div>
          </TabsContent>

          <TabsContent value="dates" className="space-y-4">
            <div className="space-y-4">
              <div className="space-y-3">
                <Label className="text-base font-medium">Data de Criação</Label>
                <DateTimeInput
                  mode="date-range"
                  value={{ from: localState.createdAfter, to: localState.createdBefore }}
                  onChange={(range) => {
                    setLocalState((prev) => ({
                      ...prev,
                      createdAfter: range?.from,
                      createdBefore: range?.to,
                    }));
                  }}
                  placeholder="Selecionar período..."
                />
              </div>
            </div>
          </TabsContent>
          </Tabs>

          {/* Action Buttons */}
          <div className="flex gap-2 pt-4 border-t">
            <Button variant="outline" onClick={handleReset} className="flex-1">
              <IconX className="h-4 w-4 mr-2" />
              Limpar todos
            </Button>
            <Button onClick={handleApply} className="flex-1">
              Aplicar filtros
              {getActiveFilterCount() > 0 && (
                <Badge variant="secondary" className="ml-2">
                  {getActiveFilterCount()}
                </Badge>
              )}
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
