import { useState, useEffect } from "react";
import { IconFilter } from "@tabler/icons-react";
import type { DateRange } from "react-day-picker";
import { FilterDrawer } from "@/components/common/filters/ui/FilterDrawer";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Combobox } from "@/components/ui/combobox";
import { DateTimeInput } from "@/components/ui/date-time-input";
import type { ObservationGetManyFormData } from "../../../../schemas";
import type { Task } from "../../../../types";
import { Badge } from "@/components/ui/badge";

interface ObservationFiltersProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  filters: Partial<ObservationGetManyFormData>;
  onFilterChange: (filters: Partial<ObservationGetManyFormData>) => void;
  tasks: Task[];
}

interface FilterState {
  taskIds: string[];
  hasFiles?: boolean;
  createdAfter?: Date;
  createdBefore?: Date;
}

export function ObservationFilters({ open, onOpenChange, filters, onFilterChange, tasks }: ObservationFiltersProps) {
  const [localState, setLocalState] = useState<FilterState>({
    taskIds: [],
    hasFiles: undefined,
    createdAfter: undefined,
    createdBefore: undefined,
  });

  // Initialize local state from filters when dialog opens
  useEffect(() => {
    if (!open) return;

    setLocalState({
      taskIds: filters.taskIds || [],
      hasFiles: filters.hasFiles,
      createdAfter: filters.createdAt?.gte,
      createdBefore: filters.createdAt?.lte,
    });
  }, [open, filters]);

  const handleApply = () => {
    const newFilters: Partial<ObservationGetManyFormData> = {
      ...filters,
    };

    // Task IDs
    if (localState.taskIds.length > 0) {
      newFilters.taskIds = localState.taskIds;
    } else {
      delete newFilters.taskIds;
    }

    // Has files
    if (localState.hasFiles !== undefined) {
      newFilters.hasFiles = localState.hasFiles;
    } else {
      delete newFilters.hasFiles;
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
      hasFiles: undefined,
      createdAfter: undefined,
      createdBefore: undefined,
    });
  };

  return (
    <FilterDrawer
      open={open}
      onOpenChange={onOpenChange}
      title="Filtros de Observações"
      titleIcon={<IconFilter className="h-5 w-5" />}
      description="Filtre as observações por tarefas, arquivos e datas"
      onApply={handleApply}
      onReset={handleReset}
      applyLabel="Aplicar filtros"
      resetLabel="Limpar todos"
    >
          <Tabs defaultValue="basic" className="w-full">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="basic">Básico</TabsTrigger>
              <TabsTrigger value="tasks">Tarefas</TabsTrigger>
              <TabsTrigger value="dates">Datas</TabsTrigger>
            </TabsList>

            <TabsContent value="basic" className="space-y-4">
              <div className="space-y-4">
                <div className="space-y-3">
                  <Label className="text-base font-medium">Arquivos</Label>
                  <Combobox
                    mode="single"
                    value={localState.hasFiles === true ? "yes" : localState.hasFiles === false ? "no" : "all"}
                    onValueChange={(value) => {
                      setLocalState((prev) => ({
                        ...prev,
                        hasFiles: value === "yes" ? true : value === "no" ? false : undefined,
                      }));
                    }}
                    options={[
                      { value: "all", label: "Todos" },
                      { value: "yes", label: "Apenas com arquivos anexos" },
                      { value: "no", label: "Apenas sem arquivos anexos" },
                    ]}
                    placeholder="Selecione..."
                    searchable={false}
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
                    onValueChange={(value) => {
                      if (Array.isArray(value)) {
                        setLocalState((prev) => ({ ...prev, taskIds: value }));
                      }
                    }}
                    placeholder="Selecionar tarefas..."
                    searchPlaceholder="Buscar tarefas..."
                    emptyText="Nenhuma tarefa encontrada"
                    searchable={true}
                    clearable={true}
                  />
                </div>
              </div>
            </TabsContent>

            <TabsContent value="dates" className="space-y-4">
              <div className="space-y-4">
                <div className="space-y-3">
                  <div className="text-base font-medium">Data de Criação</div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label className="text-xs text-muted-foreground mb-1 block">De</Label>
                      <DateTimeInput
                        mode="date"
                        value={localState.createdAfter}
                        onChange={(date: Date | DateRange | null) => {
                          if (date && !(date instanceof Date)) return;
                          setLocalState((prev) => ({
                            ...prev,
                            createdAfter: date || undefined,
                          }));
                        }}
                        hideLabel
                        placeholder="Selecionar data inicial..."
                      />
                    </div>
                    <div>
                      <Label className="text-xs text-muted-foreground mb-1 block">Até</Label>
                      <DateTimeInput
                        mode="date"
                        value={localState.createdBefore}
                        onChange={(date: Date | DateRange | null) => {
                          if (date && !(date instanceof Date)) return;
                          setLocalState((prev) => ({
                            ...prev,
                            createdBefore: date || undefined,
                          }));
                        }}
                        hideLabel
                        placeholder="Selecionar data final..."
                      />
                    </div>
                  </div>
                </div>
              </div>
            </TabsContent>
          </Tabs>

    </FilterDrawer>
  );
}
