// apps/web/src/components/production/task/batch-edit/task-batch-edit-table.tsx

import { useEffect, useState } from "react";
import type { Task, BatchOperationResult } from "../../../../types";
import { TASK_STATUS } from "../../../../constants";
import { zodResolver } from "@hookform/resolvers/zod";
import { useFieldArray, useForm } from "react-hook-form";
import { z } from "zod";
import { Card, CardContent } from "@/components/ui/card";
import { Form } from "@/components/ui/form";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { TABLE_LAYOUT } from "@/components/ui/table-constants";
import { FormInput } from "@/components/ui/form-input";
import { StatusCell } from "./cells/status-cell";
import { SectorCell } from "./cells/sector-cell";
import { CustomerCell } from "./cells/customer-cell";
import { GeneralPaintingCell } from "./cells/general-painting-cell";
import { DateTimeCell } from "./cells/date-time-cell";
import { DateCell } from "./cells/date-cell";
import { cn } from "@/lib/utils";
import { TaskBatchResultDialog } from "./task-batch-result-dialog";
import { useBatchUpdateTasks } from "../../../../hooks";
import { useNavigate } from "react-router-dom";
import { routes } from "../../../../constants";
import { createNameSchema, createDescriptionSchema, nullableDate } from "../../../../schemas";

// Task batch edit schema for UI form
const taskBatchEditSchema = z.object({
  tasks: z.array(
    z.object({
      id: z.string(),
      data: z
        .object({
          name: createNameSchema(3, 200, "nome da tarefa").optional(),
          status: z
            .enum(Object.values(TASK_STATUS) as [string, ...string[]])
            .nullable()
            .optional(),
          serialNumber: z
            .string()
            .regex(/^[A-Z0-9-]*$/, "Número de série deve conter apenas letras maiúsculas, números e hífens")
            .nullable()
            .optional(),
          plate: z
            .string()
            .regex(/^[A-Z0-9-]*$/, "A placa deve conter apenas letras maiúsculas, números e hífens")
            .nullable()
            .optional(),
          chassisNumber: z
            .string()
            .regex(/^[A-Z0-9-]*$/, "O chassi deve conter apenas letras maiúsculas, números e hífens")
            .nullable()
            .optional(),
          details: createDescriptionSchema(1, 1000, false).nullable().optional(),
          entryDate: nullableDate.optional(),
          term: nullableDate.optional(),
          startedAt: nullableDate.optional(),
          finishedAt: nullableDate.optional(),
          customerId: z.string().uuid().nullable().optional(),
          sectorId: z.string().uuid().nullable().optional(),
          paintId: z.string().uuid().nullable().optional(),
        })
        .partial(),
    }),
  ),
});

type TaskBatchEditFormData = z.infer<typeof taskBatchEditSchema>;

interface TaskBatchEditTableProps {
  tasks: Task[];
  onCancel: () => void;
  onSubmit?: () => void;
}

export function TaskBatchEditTable({ tasks, onCancel: _onCancel, onSubmit: _onSubmit }: TaskBatchEditTableProps) {
  // Early validation to prevent rendering with invalid data
  if (!tasks || !Array.isArray(tasks) || tasks.length === 0) {
    if (process.env.NODE_ENV !== 'production') {
      console.error("TaskBatchEditTable: Invalid tasks provided:", tasks);
    }
    return (
      <div className="text-center py-8 text-muted-foreground">
        <div className="text-lg font-medium mb-2">Erro: Dados de tarefas inválidos</div>
        <div className="text-sm">As tarefas não foram carregadas corretamente.</div>
      </div>
    );
  }

  const navigate = useNavigate();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [batchResult, setBatchResult] = useState<BatchOperationResult<Task, Task> | null>(null);
  const [showResultDialog, setShowResultDialog] = useState(false);

  const { mutateAsync: batchUpdateAsync } = useBatchUpdateTasks();

  const form = useForm<TaskBatchEditFormData>({
    resolver: zodResolver(taskBatchEditSchema),
    defaultValues: {
      tasks:
        tasks && tasks.length > 0
          ? tasks.map((task: Task) => ({
              id: task.id,
              data: {
                name: task.name || "",
                status: task.status,
                serialNumber: task.serialNumber || "",
                plate: task.truck?.plate || "",
                chassisNumber: task.truck?.chassisNumber || "",
                details: task.details || "",
                entryDate: task.entryDate ? new Date(task.entryDate) : null,
                term: task.term ? new Date(task.term) : null,
                startedAt: task.startedAt ? new Date(task.startedAt) : null,
                finishedAt: task.finishedAt ? new Date(task.finishedAt) : null,
                customerId: task.customerId || null,
                sectorId: task.sectorId || null,
                paintId: task.generalPainting?.id || null,
              },
            }))
          : [],
    },
  });

  const { fields, replace } = useFieldArray({
    control: form.control,
    name: "tasks",
    keyName: "fieldId", // Using a custom key name to avoid conflicts
  });

  // Ensure fields are properly initialized
  useEffect(() => {
    if (tasks && tasks.length > 0 && (!fields || fields.length === 0)) {
      const formattedTasks = tasks.map((task: Task) => ({
        id: task.id,
        data: {
          name: task.name || "",
          status: task.status,
          serialNumber: task.serialNumber || "",
          plate: task.truck?.plate || "",
          chassisNumber: task.truck?.chassisNumber || "",
          details: task.details || "",
          entryDate: task.entryDate ? new Date(task.entryDate) : null,
          term: task.term ? new Date(task.term) : null,
          startedAt: task.startedAt ? new Date(task.startedAt) : null,
          finishedAt: task.finishedAt ? new Date(task.finishedAt) : null,
          customerId: task.customerId || null,
          sectorId: task.sectorId || null,
          paintId: task.generalPainting?.id || null,
        },
      }));
      replace(formattedTasks);
    }
  }, [tasks, fields, replace]);

  const handleSubmit = async (data: TaskBatchEditFormData) => {
    try {
      setIsSubmitting(true);

      // Filter out tasks that haven't changed
      const updatedTasks = data.tasks.filter((task: any, index: number) => {
        const originalTask = tasks[index];
        const hasChanges =
          task.data.name !== originalTask.name ||
          task.data.status !== originalTask.status ||
          task.data.serialNumber !== originalTask.serialNumber ||
          task.data.plate !== originalTask.truck?.plate ||
          task.data.chassisNumber !== originalTask.truck?.chassisNumber ||
          task.data.customerId !== originalTask.customerId ||
          task.data.sectorId !== originalTask.sectorId ||
          task.data.paintId !== originalTask.generalPainting?.id ||
          task.data.entryDate?.toISOString() !== originalTask.entryDate ||
          task.data.term?.toISOString() !== originalTask.term ||
          task.data.startedAt?.toISOString() !== originalTask.startedAt ||
          task.data.finishedAt?.toISOString() !== originalTask.finishedAt;

        return hasChanges;
      });

      if (updatedTasks.length === 0) {
        alert("Nenhuma alteração foi feita.");
        setIsSubmitting(false);
        return;
      }

      // Transform data for API
      const transformedTasks = updatedTasks.map((task: any) => {
        const transformed: any = {
          id: task.id,
          data: { ...task.data },
        };

        return transformed;
      });

      const response = await batchUpdateAsync({ tasks: transformedTasks });

      if (response?.data) {
        setBatchResult(response.data);
        setShowResultDialog(true);
      }
    } catch (error) {
      if (process.env.NODE_ENV !== 'production') {
        console.error("Erro ao atualizar tarefas em lote:", error);
      }
      alert("Erro ao atualizar tarefas. Por favor, tente novamente.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleResultDialogClose = () => {
    setShowResultDialog(false);
    setBatchResult(null);
    // If there were no failures, navigate back to list
    if (batchResult && batchResult.totalFailed === 0 && batchResult.totalSuccess > 0) {
      navigate(routes.production.schedule.root);
    }
  };

  return (
    <Form {...form}>
      <Card className="h-full flex flex-col">
        {/* Hidden submit button for page header to trigger */}
        <button id="task-batch-form-submit" type="button" onClick={form.handleSubmit(handleSubmit)} style={{ display: "none" }} disabled={isSubmitting} />
        <CardContent className="p-4 flex-1 overflow-hidden flex flex-col">
          <div className="mb-4 p-3 bg-muted/50 rounded-lg border border-border">
            <div className="flex items-center gap-2 mb-1">
              <div className="w-2 h-2 bg-primary rounded-full animate-pulse"></div>
              <h3 className="text-sm font-medium text-foreground">
                Editando {tasks.length} {tasks.length === 1 ? "tarefa selecionada" : "tarefas selecionadas"}
              </h3>
            </div>
            <p className="text-xs text-muted-foreground">As alterações serão aplicadas apenas aos campos modificados em cada tarefa</p>
          </div>

          {/* Tasks Table */}
          <div className="border border-border rounded-lg overflow-x-auto overflow-y-auto flex-1">
            <Table className={cn("w-full min-w-[3000px] [&>div]:border-0 [&>div]:rounded-none", TABLE_LAYOUT.tableLayout)}>
              <TableHeader className="[&_tr]:border-b-0 [&_tr]:hover:bg-muted sticky top-0 z-10">
                <TableRow className="bg-muted hover:bg-muted even:bg-muted">
                  <TableHead className="whitespace-nowrap text-foreground font-bold uppercase text-xs bg-muted !border-r-0 p-0 w-64">
                    <div className="flex items-center h-full min-h-[2.5rem] px-4 py-2">
                      <span className="truncate">Logomarca</span>
                    </div>
                  </TableHead>
                  <TableHead className="whitespace-nowrap text-foreground font-bold uppercase text-xs bg-muted !border-r-0 p-0 w-44">
                    <div className="px-3 py-2">Status</div>
                  </TableHead>
                  <TableHead className="whitespace-nowrap text-foreground font-bold uppercase text-xs bg-muted !border-r-0 p-0 w-72">
                    <div className="px-3 py-2">Razão Social</div>
                  </TableHead>
                  <TableHead className="whitespace-nowrap text-foreground font-bold uppercase text-xs bg-muted !border-r-0 p-0 w-48">
                    <div className="px-3 py-2">Setor</div>
                  </TableHead>
                  <TableHead className="whitespace-nowrap text-foreground font-bold uppercase text-xs bg-muted !border-r-0 p-0 w-24">
                    <div className="px-3 py-2">Nº Série</div>
                  </TableHead>
                  <TableHead className="whitespace-nowrap text-foreground font-bold uppercase text-xs bg-muted !border-r-0 p-0 w-24">
                    <div className="px-3 py-2">Placa</div>
                  </TableHead>
                  <TableHead className="whitespace-nowrap text-foreground font-bold uppercase text-xs bg-muted !border-r-0 p-0 w-48">
                    <div className="px-3 py-2">Chassi</div>
                  </TableHead>
                  <TableHead className="whitespace-nowrap text-foreground font-bold uppercase text-xs bg-muted !border-r-0 p-0 w-72">
                    <div className="px-3 py-2">Pintura Geral</div>
                  </TableHead>
                  <TableHead className="whitespace-nowrap text-foreground font-bold uppercase text-xs bg-muted !border-r-0 p-0 w-32">
                    <div className="px-3 py-2">Data Entrada</div>
                  </TableHead>
                  <TableHead className="whitespace-nowrap text-foreground font-bold uppercase text-xs bg-muted !border-r-0 p-0 w-40">
                    <div className="px-3 py-2">Prazo</div>
                  </TableHead>
                  <TableHead className="whitespace-nowrap text-foreground font-bold uppercase text-xs bg-muted !border-r-0 p-0 w-40">
                    <div className="px-3 py-2">Iniciado em</div>
                  </TableHead>
                  <TableHead className="whitespace-nowrap text-foreground font-bold uppercase text-xs bg-muted !border-r-0 p-0 w-40">
                    <div className="px-3 py-2">Finalizado em</div>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody className="[&_tr:hover]:bg-accent/10 [&_tr:nth-child(even)]:bg-muted/30">
                {fields && fields.length > 0 ? (
                  fields.map((field, index) => {
                    if (!field || typeof index !== "number" || index < 0) {
                      if (process.env.NODE_ENV !== 'production') {
                        console.error("Invalid field or index in task batch edit table:", { field, index });
                      }
                      return null;
                    }
                    const originalTask = tasks[index];
                    return (
                      <TableRow
                        key={field.fieldId}
                        className={cn(
                          "cursor-default transition-colors border-b border-border",
                          // Alternating row colors
                          index % 2 === 1 && "bg-muted/10",
                          // Hover state that works with alternating colors
                          "hover:bg-muted/20",
                        )}
                      >
                        <TableCell className="w-64 p-0 !border-r-0">
                          <div className="px-3 py-2">
                            <FormInput name={`tasks.${index}.data.name`} placeholder="Logomarca" />
                          </div>
                        </TableCell>
                        <TableCell className="w-44 p-0 !border-r-0">
                          <div className="px-3 py-2">
                            <StatusCell control={form.control} index={index} />
                          </div>
                        </TableCell>
                        <TableCell className="w-72 p-0 !border-r-0">
                          <div className="px-3 py-2">
                            <CustomerCell control={form.control} index={index} initialCustomer={originalTask?.customer} />
                          </div>
                        </TableCell>
                        <TableCell className="w-48 p-0 !border-r-0">
                          <div className="px-3 py-2">
                            <SectorCell control={form.control} index={index} />
                          </div>
                        </TableCell>
                        <TableCell className="w-24 p-0 !border-r-0">
                          <div className="px-3 py-2">
                            <FormInput name={`tasks.${index}.data.serialNumber`} placeholder="Nº Série" className="uppercase" />
                          </div>
                        </TableCell>
                        <TableCell className="w-24 p-0 !border-r-0">
                          <div className="px-3 py-2">
                            <FormInput name={`tasks.${index}.data.plate`} placeholder="Placa" className="uppercase" />
                          </div>
                        </TableCell>
                        <TableCell className="w-48 p-0 !border-r-0">
                          <div className="px-3 py-2">
                            <FormInput name={`tasks.${index}.data.chassisNumber`} placeholder="Chassi" className="uppercase" />
                          </div>
                        </TableCell>
                        <TableCell className="w-72 p-0 !border-r-0">
                          <div className="px-3 py-2">
                            <GeneralPaintingCell control={form.control} index={index} initialPaint={originalTask?.generalPainting} />
                          </div>
                        </TableCell>
                        <TableCell className="w-32 p-0 !border-r-0">
                          <div className="px-3 py-2">
                            <DateCell control={form.control} name={`tasks.${index}.data.entryDate`} placeholder="Data de entrada" />
                          </div>
                        </TableCell>
                        <TableCell className="w-40 p-0 !border-r-0">
                          <div className="px-3 py-2">
                            <DateTimeCell control={form.control} name={`tasks.${index}.data.term`} placeholder="Prazo de entrega" defaultTime="07:30" />
                          </div>
                        </TableCell>
                        <TableCell className="w-40 p-0 !border-r-0">
                          <div className="px-3 py-2">
                            <DateTimeCell control={form.control} name={`tasks.${index}.data.startedAt`} placeholder="Data/hora de início" defaultTime="07:30" />
                          </div>
                        </TableCell>
                        <TableCell className="w-40 p-0 !border-r-0">
                          <div className="px-3 py-2">
                            <DateTimeCell control={form.control} name={`tasks.${index}.data.finishedAt`} placeholder="Data/hora de conclusão" defaultTime="07:30" />
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })
                ) : (
                  <TableRow>
                    <TableCell colSpan={12} className="text-center py-8 text-muted-foreground">
                      Carregando tarefas...
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {showResultDialog && batchResult && <TaskBatchResultDialog result={batchResult} onClose={handleResultDialogClose} />}
    </Form>
  );
}
