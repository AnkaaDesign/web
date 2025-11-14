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

  const getActiveFilterCount = () => {
    let count = 0;
    if (localState.taskIds.length > 0) count++;
    if (localState.hasFiles !== undefined) count++;
    if (localState.createdAfter || localState.createdBefore) count++;
    return count;
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <IconFilter className="h-5 w-5" />
            Filtros de Observações
          </SheetTitle>
          <SheetDescription>
            Filtre as observações por tarefas, arquivos e datas
          </SheetDescription>
        </SheetHeader>

        <div className="mt-6 space-y-6">
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
                  <div className="flex items-center space-x-2">
                    <Switch
                      checked={localState.hasFiles === true}
                      onCheckedChange={(checked) => {
                        setLocalState((prev) => ({
                          ...prev,
                          hasFiles: checked ? true : undefined,
                        }));
                      }}
                    />
                    <Label>Apenas com arquivos anexos</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Switch
                      checked={localState.hasFiles === false}
                      onCheckedChange={(checked) => {
                        setLocalState((prev) => ({
                          ...prev,
                          hasFiles: checked ? false : undefined,
                        }));
                      }}
                    />
                    <Label>Apenas sem arquivos anexos</Label>
                  </div>
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
                        onChange={(date: Date | null) => {
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
                        onChange={(date: Date | null) => {
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

          {/* Action Buttons */}
          <div className="flex gap-2 mt-6 pt-4 border-t">
            <Button variant="outline" onClick={handleReset} className="flex-1">
              <IconX className="h-4 w-4 mr-2" />
              Limpar todos
            </Button>
            <Button onClick={handleApply} className="flex-1">
              Aplicar filtros
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
