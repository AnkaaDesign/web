import React, { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { MultiSelect } from "@/components/ui/multi-select";
import { IconArrowRight, IconCheck, IconClipboardCopy, IconArrowDown } from "@tabler/icons-react";
import type { Task } from "../../../../types";
import { formatDate } from "../../../../utils";

export type CopyableField =
  | "details"
  | "term"
  | "artworkIds"
  | "budgetIds"
  | "pricingIds"
  | "paintId"
  | "paintIds"
  | "serviceOrders"
  | "cuts"
  | "layout";

interface FieldCategory {
  id: CopyableField;
  label: string;
  description: string;
}

const FIELD_CATEGORIES: FieldCategory[] = [
  { id: "details", label: "Detalhes", description: "Descrição/detalhes da tarefa" },
  { id: "term", label: "Prazo", description: "Data limite para conclusão" },
  { id: "artworkIds", label: "Artes", description: "Arquivos de arte anexados" },
  { id: "budgetIds", label: "Orçamentos", description: "Orçamentos associados" },
  { id: "pricingIds", label: "Precificação", description: "Precificação compartilhada" },
  { id: "paintId", label: "Pintura Geral", description: "Cor de pintura geral" },
  { id: "paintIds", label: "Tintas da Logomarca", description: "Tintas utilizadas na logomarca" },
  { id: "serviceOrders", label: "Ordens de Serviço", description: "Criar novas ordens de serviço baseadas na origem" },
  { id: "cuts", label: "Cortes", description: "Criar novos cortes baseados na origem" },
  { id: "layout", label: "Layout do Caminhão", description: "Layout e seções do caminhão" },
];

export interface CopyFromTaskModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  targetTasks: Task[];
  sourceTask: Task | null;
  step: "selecting_fields" | "confirming";
  onStartSourceSelection: (selectedFields: CopyableField[]) => void;
  onConfirm: (selectedFields: CopyableField[], sourceTask: Task) => void;
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
  const [selectedFields, setSelectedFields] = useState<Set<CopyableField>>(new Set());

  // Reset selected fields when modal opens
  useEffect(() => {
    if (open && step === "selecting_fields") {
      setSelectedFields(new Set());
    }
  }, [open, step]);

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

  // Convert FIELD_CATEGORIES to options for MultiSelect
  const fieldOptions = FIELD_CATEGORIES.map((field) => ({
    value: field.id,
    label: field.label,
  }));

  // Convert selected fields Set to array for MultiSelect
  const selectedFieldsArray = Array.from(selectedFields);

  const handleFieldsChange = (newSelected: string[]) => {
    setSelectedFields(new Set(newSelected as CopyableField[]));
  };

  // Get source task field values for preview
  const getSourceFieldPreview = (fieldId: CopyableField): string => {
    if (!sourceTask) return "-";
    switch (fieldId) {
      case "details":
        return sourceTask.details ? `${sourceTask.details.substring(0, 40)}...` : "Sem detalhes";
      case "term":
        return sourceTask.term ? formatDate(sourceTask.term) : "Sem prazo";
      case "artworkIds":
        return sourceTask.artworks?.length ? `${sourceTask.artworks.length} arquivo(s)` : "Nenhuma arte";
      case "budgetIds":
        return sourceTask.budgets?.length ? `${sourceTask.budgets.length} orçamento(s)` : "Sem orçamento";
      case "pricingIds":
        return (sourceTask as any).pricings?.length ? `${(sourceTask as any).pricings.length} precificação(ões)` : "Sem precificação";
      case "paintId":
        return sourceTask.generalPainting?.name || "Sem pintura";
      case "paintIds":
        return sourceTask.logoPaints?.length ? `${sourceTask.logoPaints.length} tinta(s)` : "Nenhuma tinta";
      case "serviceOrders":
        return sourceTask.serviceOrders?.length ? `${sourceTask.serviceOrders.length} serviço(s)` : "Nenhum serviço";
      case "cuts":
        return sourceTask.cuts?.length ? `${sourceTask.cuts.length} corte(s)` : "Nenhum corte";
      case "layout":
        if (sourceTask.truck) {
          const layoutCount = [
            sourceTask.truck.leftSideLayout,
            sourceTask.truck.rightSideLayout,
            sourceTask.truck.backSideLayout,
          ].filter(Boolean).length;
          return layoutCount > 0 ? `${layoutCount} lado(s)` : "Sem layout";
        }
        return "Sem caminhão";
      default:
        return "-";
    }
  };

  // Check if field has content
  const fieldHasContent = (fieldId: CopyableField): boolean => {
    if (!sourceTask) return false;
    switch (fieldId) {
      case "details":
        return !!sourceTask.details;
      case "term":
        return !!sourceTask.term;
      case "artworkIds":
        return (sourceTask.artworks?.length || 0) > 0;
      case "budgetIds":
        return (sourceTask.budgets?.length || 0) > 0;
      case "pricingIds":
        return ((sourceTask as any).pricings?.length || 0) > 0;
      case "paintId":
        return !!sourceTask.paintId;
      case "paintIds":
        return (sourceTask.logoPaints?.length || 0) > 0;
      case "serviceOrders":
        return (sourceTask.serviceOrders?.length || 0) > 0;
      case "cuts":
        return (sourceTask.cuts?.length || 0) > 0;
      case "layout":
        return !!(sourceTask.truck?.leftSideLayout || sourceTask.truck?.rightSideLayout || sourceTask.truck?.backSideLayout);
      default:
        return false;
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[650px] bg-white dark:bg-card">
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
          <div className="py-4 space-y-4">
            {/* Destination Tasks Table */}
            <TaskMiniTable
              tasks={targetTasks}
              title={`Tarefa${targetTasks.length > 1 ? "s" : ""} de Destino (${targetTasks.length})`}
              variant="destination"
            />

            {/* Fields MultiSelect */}
            <div className="space-y-2">
              <Label className="text-sm font-medium">Campos para copiar</Label>
              <MultiSelect
                options={fieldOptions}
                selected={selectedFieldsArray}
                onChange={handleFieldsChange}
                placeholder="Selecione os campos..."
              />
            </div>
          </div>
        ) : (
          <div className="py-4 space-y-4">
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
              <ScrollArea className="h-[140px] pr-3">
                <div className="grid gap-2">
                  {FIELD_CATEGORIES.filter((f) => selectedFields.has(f.id)).map((field) => {
                    const hasContent = fieldHasContent(field.id);
                    return (
                      <div
                        key={field.id}
                        className={`flex items-center justify-between p-2.5 rounded-lg ${
                          hasContent ? "bg-accent/50" : "bg-muted/30"
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <IconCheck className={`h-4 w-4 ${hasContent ? "text-green-600" : "text-muted-foreground"}`} />
                          <span className="text-sm font-medium">{field.label}</span>
                        </div>
                        <span
                          className={`text-xs truncate max-w-[180px] ${
                            hasContent ? "text-foreground" : "text-muted-foreground italic"
                          }`}
                        >
                          {getSourceFieldPreview(field.id)}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </ScrollArea>
            </div>

            {/* Warning for serviceOrders/cuts */}
            {(selectedFields.has("serviceOrders") || selectedFields.has("cuts")) && (
              <div className="p-3 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900">
                <p className="text-xs text-amber-700 dark:text-amber-400">
                  <strong>Nota:</strong> Ordens de serviço e cortes serão criados como novas entidades independentes nas
                  tarefas de destino.
                </p>
              </div>
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
