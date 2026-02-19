import { useState, useEffect, useMemo } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  IconArrowRight,
  IconCheck,
  IconClipboardCopy,
  IconArrowDown,
  IconInfoCircle,
  IconCopy,
} from "@tabler/icons-react";
import type { Task } from "../../../../types";
import {
  COPYABLE_FIELD_METADATA,
  type CopyableTaskField,
  getFieldsUserCanCopy,
} from "@/types/task-copy";
import { cn } from "@/lib/utils";

export interface CopyFromTaskModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  targetTasks: Task[];
  sourceTask: Task | null;
  step: "selecting_fields" | "confirming";
  onStartSourceSelection: (selectedFields: CopyableTaskField[]) => void;
  onConfirm: (selectedFields: CopyableTaskField[], sourceTask: Task) => void;
  onCancel: () => void;
  onChangeSource: () => void;
  /** User's sector privilege - used to filter which fields they can copy */
  userPrivilege?: string;
}

// Compact task display component - shows first task, "+X Tarefas..." count, and last task
// Designed to never overflow the modal and match the task table row design
function TaskMiniTable({
  tasks,
  title,
  variant,
  onChangeSource,
}: {
  tasks: Task[];
  title: string;
  variant: "source" | "destination";
  onChangeSource?: () => void;
}) {
  const bgClass = variant === "source"
    ? "bg-green-50 dark:bg-green-950/30 border-green-200 dark:border-green-900"
    : "bg-blue-50 dark:bg-blue-950/30 border-blue-200 dark:border-blue-900";
  const headerClass = variant === "source"
    ? "text-green-700 dark:text-green-400"
    : "text-blue-700 dark:text-blue-400";
  const headerBgClass = variant === "source"
    ? "bg-green-100/50 dark:bg-green-900/30"
    : "bg-blue-100/50 dark:bg-blue-900/30";
  const rowBgClass = variant === "source"
    ? "bg-green-50/50 dark:bg-green-950/20"
    : "bg-blue-50/50 dark:bg-blue-950/20";

  // Calculate which tasks to show
  const firstTask = tasks[0];
  const lastTask = tasks.length > 1 ? tasks[tasks.length - 1] : null;
  const middleCount = tasks.length > 2 ? tasks.length - 2 : 0;

  // Render a single task row matching the task table design
  const renderTaskRow = (task: Task, isLast: boolean) => (
    <div
      key={task.id}
      className={cn(
        "grid grid-cols-[1fr_80px_100px] gap-2 px-3 py-2 text-sm",
        !isLast && "border-b border-inherit",
        rowBgClass
      )}
    >
      <div className="font-medium truncate" title={task.name}>
        {task.name || "-"}
      </div>
      <div className="text-muted-foreground truncate text-center">
        {task.serialNumber || task.truck?.plate || "-"}
      </div>
      <div className="text-muted-foreground truncate text-right">
        {task.sector?.name || "-"}
      </div>
    </div>
  );

  return (
    <div className={`rounded-lg border ${bgClass} overflow-hidden`}>
      {/* Header */}
      <div className={`px-3 py-2 ${headerBgClass} flex items-center justify-between`}>
        <p className={`text-xs font-semibold uppercase tracking-wide ${headerClass}`}>
          {title}
        </p>
        {onChangeSource && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onChangeSource}
            className={`h-6 px-2 text-xs ${headerClass} hover:bg-green-200/50 dark:hover:bg-green-800/50`}
          >
            Alterar
          </Button>
        )}
      </div>

      {/* Column headers */}
      <div className={`grid grid-cols-[1fr_80px_100px] gap-2 px-3 py-1.5 ${headerBgClass} border-b border-inherit`}>
        <span className="text-xs font-medium text-muted-foreground">Nome</span>
        <span className="text-xs font-medium text-muted-foreground text-center">Nº Série</span>
        <span className="text-xs font-medium text-muted-foreground text-right">Setor</span>
      </div>

      {/* Task rows - max 2 tasks with count in between */}
      <div className="bg-white/50 dark:bg-black/10">
        {/* First task */}
        {firstTask && renderTaskRow(firstTask, !lastTask && middleCount === 0)}

        {/* Middle count indicator */}
        {middleCount > 0 && (
          <div className={cn(
            "grid grid-cols-[1fr_80px_100px] gap-2 px-3 py-2 text-sm text-muted-foreground border-b border-inherit",
            rowBgClass
          )}>
            <span>+ {middleCount} Tarefa{middleCount > 1 ? "s" : ""}...</span>
          </div>
        )}

        {/* Last task (only if different from first) */}
        {lastTask && renderTaskRow(lastTask, true)}
      </div>
    </div>
  );
}

// Field selection item component
function FieldSelectionItem({
  field,
  isSelected,
  onToggle,
}: {
  field: CopyableTaskField;
  isSelected: boolean;
  onToggle: (field: CopyableTaskField) => void;
}) {
  const metadata = COPYABLE_FIELD_METADATA[field];

  return (
    <div
      className={cn(
        "flex items-center justify-between gap-3 p-3 rounded-lg border-2 transition-all cursor-pointer hover:border-primary/50",
        isSelected ? "border-primary bg-primary/5" : "border-border bg-background"
      )}
      onClick={() => onToggle(field)}
    >
      <div className="flex items-center gap-3">
        <Checkbox
          checked={isSelected}
          onCheckedChange={() => onToggle(field)}
          className="pointer-events-none"
        />
        <span className="text-sm font-medium">{metadata.label}</span>
      </div>
      <div className="flex items-center gap-2">
        {metadata.isShared && (
          <Badge variant="outline" className="text-xs bg-blue-50 text-blue-700 border-blue-300 dark:bg-blue-950/30 dark:text-blue-400 dark:border-blue-800">
            <IconInfoCircle className="h-3 w-3 mr-1" />
            Compartilhado
          </Badge>
        )}
        {metadata.createNewInstances && (
          <Badge variant="outline" className="text-xs bg-green-50 text-green-700 border-green-300 dark:bg-green-950/30 dark:text-green-400 dark:border-green-800">
            <IconCopy className="h-3 w-3 mr-1" />
            Nova instância
          </Badge>
        )}
      </div>
    </div>
  );
}

export function CopyFromTaskModal({
  open,
  onOpenChange,
  targetTasks,
  sourceTask,
  step,
  onStartSourceSelection,
  onConfirm,
  onCancel,
  onChangeSource,
  userPrivilege,
}: CopyFromTaskModalProps) {
  const [selectedFields, setSelectedFields] = useState<Set<CopyableTaskField>>(new Set());

  // Get fields the user is allowed to copy based on their privilege
  const allowedFields = useMemo(
    () => getFieldsUserCanCopy(userPrivilege),
    [userPrivilege]
  );

  // Reset selected fields when modal opens
  useEffect(() => {
    if (open && step === "selecting_fields") {
      setSelectedFields(new Set());
    }
  }, [open, step]);

  // Group fields by category - only include fields user has permission to copy
  const fieldsByCategory = useMemo(() => {
    const groups: Record<string, CopyableTaskField[]> = {};

    // Only show fields that user has permission to copy
    allowedFields.forEach((field) => {
      const metadata = COPYABLE_FIELD_METADATA[field];
      if (!groups[metadata.category]) {
        groups[metadata.category] = [];
      }
      groups[metadata.category].push(field);
    });

    return groups;
  }, [allowedFields]);

  // Get category order
  const categoryOrder = [
    'Ações Rápidas',
    'Informações Gerais',
    'Datas',
    'Comercial',
    'Pintura e Artes',
    'Produção',
    'Veículo',
  ];

  // All individual fields (excluding 'all' meta-option)
  const individualFields = useMemo(
    () => allowedFields.filter((f) => f !== 'all'),
    [allowedFields]
  );

  const allIndividualSelected = individualFields.length > 0 &&
    individualFields.every((f) => selectedFields.has(f));

  const handleToggleField = (field: CopyableTaskField) => {
    setSelectedFields((prev) => {
      const newSet = new Set(prev);

      if (field === 'all') {
        // If all are already selected, deselect all; otherwise select all individual fields
        if (allIndividualSelected) {
          newSet.clear();
        } else {
          individualFields.forEach((f) => newSet.add(f));
        }
      } else {
        if (newSet.has(field)) {
          newSet.delete(field);
        } else {
          newSet.add(field);
        }
      }

      return newSet;
    });
  };

  const handleStartSelection = () => {
    if (selectedFields.size === 0) return;
    onStartSourceSelection(Array.from(selectedFields));
  };

  const handleConfirm = () => {
    if (!sourceTask || selectedFields.size === 0) return;
    // Submit the individually selected fields directly (no 'all' meta-value in the set)
    const fieldsToSubmit = Array.from(selectedFields);
    onConfirm(fieldsToSubmit, sourceTask);
  };

  const handleCancel = () => {
    setSelectedFields(new Set());
    onCancel();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[700px] bg-white dark:bg-card">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <IconClipboardCopy className="h-5 w-5" />
            Copiar de Outra Tarefa
          </DialogTitle>
          <DialogDescription>
            {step === "selecting_fields"
              ? "Selecione os campos que deseja copiar. Após selecionar, você escolherá a tarefa de origem."
              : "Confirme os campos que serão copiados."}
          </DialogDescription>
        </DialogHeader>

        {step === "selecting_fields" ? (
          <div className="space-y-4">
            {/* Destination Tasks Table */}
            <TaskMiniTable
              tasks={targetTasks}
              title={`Tarefa${targetTasks.length > 1 ? "s" : ""} de Destino (${targetTasks.length})`}
              variant="destination"
            />

            <Separator />

            {/* Fields Selection */}
            <div className="space-y-3">
              <Label className="text-sm font-semibold">Campos para copiar</Label>

              <ScrollArea className="h-[400px] pr-3">
                <div className="space-y-4">
                  {categoryOrder.map((category) => {
                    const fields = fieldsByCategory[category];
                    if (!fields || fields.length === 0) return null;

                    return (
                      <div key={category} className="space-y-2">
                        <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                          {category}
                        </h4>
                        <div className="space-y-2">
                          {fields.map((field) => (
                            <FieldSelectionItem
                              key={field}
                              field={field}
                              isSelected={field === 'all' ? allIndividualSelected : selectedFields.has(field)}
                              onToggle={handleToggleField}
                            />
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </ScrollArea>
            </div>

            {/* Selection counter */}
            {selectedFields.size > 0 && (
              <div className="flex items-center justify-between p-3 rounded-lg bg-primary/5 border border-primary/20">
                <span className="text-sm font-medium">
                  {allIndividualSelected
                    ? 'Todos os campos selecionados'
                    : `${selectedFields.size} campo${selectedFields.size > 1 ? 's' : ''} selecionado${selectedFields.size > 1 ? 's' : ''}`
                  }
                </span>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setSelectedFields(new Set())}
                  className="h-7 text-xs"
                >
                  Limpar
                </Button>
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            {/* Source Task Table */}
            {sourceTask && (
              <TaskMiniTable
                tasks={[sourceTask]}
                title="Tarefa de Origem"
                variant="source"
                onChangeSource={onChangeSource}
              />
            )}

            {/* Arrow indicator */}
            <div className="flex justify-center">
              <div className="flex items-center justify-center w-8 h-8 rounded-full bg-primary/10">
                <IconArrowDown className="h-4 w-4 text-primary" />
              </div>
            </div>

            {/* Destination Tasks Table */}
            <TaskMiniTable
              tasks={targetTasks}
              title={`Tarefa${targetTasks.length > 1 ? "s" : ""} de Destino (${targetTasks.length})`}
              variant="destination"
            />

            <Separator />

            {/* Fields to copy */}
            <div>
              <p className="text-sm font-medium mb-3">Campos que serão copiados:</p>
              <ScrollArea className="h-[150px] pr-3">
                <div className="space-y-2">
                  {allIndividualSelected ? (
                    <div className="flex items-center gap-3 p-3 rounded-lg bg-primary/5 border border-primary/20">
                      <IconCheck className="h-4 w-4 text-primary flex-shrink-0" />
                      <span className="text-sm font-medium">COPIAR TUDO</span>
                    </div>
                  ) : (
                    Array.from(selectedFields).map((field) => {
                      const metadata = COPYABLE_FIELD_METADATA[field];
                      return (
                        <div
                          key={field}
                          className="flex items-center justify-between gap-3 p-2.5 rounded-lg bg-accent/50"
                        >
                          <div className="flex items-center gap-3">
                            <IconCheck className="h-4 w-4 text-green-600 flex-shrink-0" />
                            <span className="text-sm font-medium">{metadata.label}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            {metadata.isShared && (
                              <Badge variant="outline" className="text-xs bg-blue-50 text-blue-700 border-blue-300 dark:bg-blue-950/30 dark:text-blue-400 dark:border-blue-800">
                                Compartilhado
                              </Badge>
                            )}
                            {metadata.createNewInstances && (
                              <Badge variant="outline" className="text-xs bg-green-50 text-green-700 border-green-300 dark:bg-green-950/30 dark:text-green-400 dark:border-green-800">
                                Nova instância
                              </Badge>
                            )}
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </ScrollArea>
            </div>

          </div>
        )}

        <DialogFooter>
          <Button type="button" variant="outline" onClick={handleCancel}>
            Cancelar
          </Button>
          {step === "selecting_fields" ? (
            <Button type="button" onClick={handleStartSelection} disabled={selectedFields.size === 0}>
              <span>Selecionar Tarefa</span>
              <IconArrowRight className="ml-2 h-4 w-4" />
            </Button>
          ) : (
            <Button type="button" onClick={handleConfirm} disabled={!sourceTask}>
              <IconClipboardCopy className="mr-2 h-4 w-4" />
              <span>
                Copiar para {targetTasks.length} tarefa{targetTasks.length > 1 ? "s" : ""}
              </span>
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
