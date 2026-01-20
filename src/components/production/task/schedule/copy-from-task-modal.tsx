import React, { useState, useEffect, useMemo } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Checkbox } from "@/components/ui/checkbox";
import {
  IconArrowRight,
  IconCheck,
  IconClipboardCopy,
  IconArrowDown,
  IconInfoCircle,
  IconCopy,
  IconAlertTriangle,
} from "@tabler/icons-react";
import type { Task } from "../../../../types";
import { COPYABLE_TASK_FIELDS, COPYABLE_FIELD_METADATA, type CopyableTaskField } from "@/types/task-copy";
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
}

// Mini table component for displaying tasks
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

  return (
    <div className={`rounded-lg border ${bgClass} overflow-hidden`}>
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
      <div className="overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className={`${headerBgClass} border-b border-inherit`}>
              <th className="px-3 py-1.5 text-left text-xs font-medium text-muted-foreground">Nome</th>
              <th className="px-3 py-1.5 text-left text-xs font-medium text-muted-foreground">Nº Série</th>
              <th className="px-3 py-1.5 text-left text-xs font-medium text-muted-foreground">Setor</th>
            </tr>
          </thead>
          <tbody className="bg-white/50 dark:bg-black/10">
            {tasks.slice(0, 5).map((task, index) => (
              <tr key={task.id} className={index !== Math.min(tasks.length - 1, 4) ? "border-b border-inherit" : ""}>
                <td className="px-3 py-2 font-medium truncate max-w-[140px]" title={task.name}>
                  {task.name}
                </td>
                <td className="px-3 py-2 text-muted-foreground truncate max-w-[100px]">
                  {task.serialNumber || task.truck?.plate || "-"}
                </td>
                <td className="px-3 py-2 text-muted-foreground truncate max-w-[100px]">
                  {task.sector?.name || "-"}
                </td>
              </tr>
            ))}
            {tasks.length > 5 && (
              <tr className="border-t border-inherit">
                <td colSpan={3} className="px-3 py-2 text-center text-xs text-muted-foreground">
                  + {tasks.length - 5} mais tarefa{tasks.length - 5 > 1 ? "s" : ""}
                </td>
              </tr>
            )}
          </tbody>
        </table>
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
        "flex items-start gap-3 p-3 rounded-lg border-2 transition-all cursor-pointer hover:border-primary/50",
        isSelected ? "border-primary bg-primary/5" : "border-border bg-background"
      )}
      onClick={() => onToggle(field)}
    >
      <div className="flex items-center pt-0.5">
        <Checkbox
          checked={isSelected}
          onCheckedChange={() => onToggle(field)}
          className="pointer-events-none"
        />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-sm font-medium">{metadata.label}</span>
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
        <p className="text-xs text-muted-foreground">{metadata.description}</p>
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
}: CopyFromTaskModalProps) {
  const [selectedFields, setSelectedFields] = useState<Set<CopyableTaskField>>(new Set());

  // Reset selected fields when modal opens
  useEffect(() => {
    if (open && step === "selecting_fields") {
      setSelectedFields(new Set());
    }
  }, [open, step]);

  // Group fields by category
  const fieldsByCategory = useMemo(() => {
    const groups: Record<string, CopyableTaskField[]> = {};

    COPYABLE_TASK_FIELDS.forEach((field) => {
      const metadata = COPYABLE_FIELD_METADATA[field];
      if (!groups[metadata.category]) {
        groups[metadata.category] = [];
      }
      groups[metadata.category].push(field);
    });

    return groups;
  }, []);

  // Get category order
  const categoryOrder = [
    'Ações Rápidas',
    'Básico',
    'Referências',
    'Arquivos',
    'Recursos Compartilhados',
    'Recursos Individuais',
    'Observações',
  ];

  const handleToggleField = (field: CopyableTaskField) => {
    setSelectedFields((prev) => {
      const newSet = new Set(prev);

      // If toggling 'all', clear other selections
      if (field === 'all') {
        if (newSet.has('all')) {
          newSet.delete('all');
        } else {
          newSet.clear();
          newSet.add('all');
        }
      } else {
        // If selecting another field, remove 'all'
        if (newSet.has('all')) {
          newSet.delete('all');
        }

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
    onConfirm(Array.from(selectedFields), sourceTask);
  };

  const handleCancel = () => {
    setSelectedFields(new Set());
    onCancel();
  };

  // Check if any shared resources are selected
  const hasSharedResources = useMemo(() => {
    return Array.from(selectedFields).some(field => COPYABLE_FIELD_METADATA[field].isShared);
  }, [selectedFields]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[700px] max-h-[90vh] bg-white dark:bg-card">
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
                              isSelected={selectedFields.has(field)}
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

            {/* Warning for shared resources */}
            {hasSharedResources && (
              <Alert className="bg-amber-50 border-amber-200 dark:bg-amber-950/30 dark:border-amber-900">
                <IconAlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                <AlertDescription className="text-xs text-amber-700 dark:text-amber-400">
                  <strong>Atenção:</strong> Recursos compartilhados (marcados com badge azul) são referências aos mesmos dados.
                  Alterações feitas em uma tarefa afetarão todas as tarefas que compartilham esse recurso.
                </AlertDescription>
              </Alert>
            )}

            {/* Selection counter */}
            {selectedFields.size > 0 && (
              <div className="flex items-center justify-between p-3 rounded-lg bg-primary/5 border border-primary/20">
                <span className="text-sm font-medium">
                  {selectedFields.has('all')
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
              <ScrollArea className="h-[200px] pr-3">
                <div className="space-y-2">
                  {selectedFields.has('all') ? (
                    <div className="flex items-center gap-3 p-3 rounded-lg bg-primary/5 border border-primary/20">
                      <IconCheck className="h-4 w-4 text-primary flex-shrink-0" />
                      <div className="flex-1">
                        <span className="text-sm font-medium">COPIAR TUDO</span>
                        <p className="text-xs text-muted-foreground mt-1">
                          Todos os campos serão copiados (exceto serialNumber, plate e chassisNumber)
                        </p>
                      </div>
                    </div>
                  ) : (
                    Array.from(selectedFields).map((field) => {
                      const metadata = COPYABLE_FIELD_METADATA[field];
                      return (
                        <div
                          key={field}
                          className="flex items-center gap-3 p-2.5 rounded-lg bg-accent/50"
                        >
                          <IconCheck className="h-4 w-4 text-green-600 flex-shrink-0" />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-sm font-medium">{metadata.label}</span>
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
                            <p className="text-xs text-muted-foreground mt-0.5">{metadata.description}</p>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </ScrollArea>
            </div>

            {/* Warning for shared resources in confirmation */}
            {hasSharedResources && (
              <Alert className="bg-amber-50 border-amber-200 dark:bg-amber-950/30 dark:border-amber-900">
                <IconAlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                <AlertDescription className="text-xs text-amber-700 dark:text-amber-400">
                  <strong>Atenção:</strong> Recursos compartilhados vinculam as mesmas entidades. Mudanças feitas através
                  de uma tarefa afetarão todas as tarefas vinculadas.
                </AlertDescription>
              </Alert>
            )}
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
