import { useState, useCallback } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { CustomerSelector } from "../form/customer-selector";
import { useTaskOperations } from "@/hooks/useTask";
import { TASK_STATUS } from "@/constants";
import { toast } from "sonner";
import { IconLoader2, IconPlus, IconFileText, IconHash, IconLicense, IconCalendar } from "@tabler/icons-react";
import { DateTimeInput } from "@/components/ui/date-time-input";
import { BatchOperationResultDialog } from "@/components/ui/batch-operation-result-dialog";
import type { BatchOperationResult, BatchOperationError } from "@/types";
import type { Task } from "@/types/task";

// Simplified schema for quick task creation
const quickTaskSchema = z.object({
  name: z.string().optional().nullable(),
  customerId: z.string().optional(),
  forecastDate: z.date().nullable().optional(),
  serialNumberFrom: z.number().nullable().optional(),
  serialNumberTo: z.number().nullable().optional(),
  truck: z.object({
    plate: z.string().optional(),
  }).optional(),
}).refine(
  (data) => {
    // serialNumberFrom must be less than or equal to serialNumberTo when both are provided
    if (
      data.serialNumberFrom !== null &&
      data.serialNumberFrom !== undefined &&
      data.serialNumberTo !== null &&
      data.serialNumberTo !== undefined
    ) {
      return data.serialNumberFrom <= data.serialNumberTo;
    }
    return true;
  },
  {
    message: "'De número de série' deve ser menor ou igual a 'Até número de série'",
    path: ["serialNumberTo"],
  }
);

type QuickTaskFormData = z.infer<typeof quickTaskSchema>;

interface TaskQuickCreateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

export function TaskQuickCreateDialog({ open, onOpenChange, onSuccess }: TaskQuickCreateDialogProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [batchResult, setBatchResult] = useState<BatchOperationResult<Task> | null>(null);
  const [showBatchResultDialog, setShowBatchResultDialog] = useState(false);

  const { createAsync, batchCreateAsync } = useTaskOperations();

  const form = useForm<QuickTaskFormData>({
    resolver: zodResolver(quickTaskSchema),
    mode: "onChange",
    defaultValues: {
      name: "",
      customerId: "",
      forecastDate: null,
      serialNumberFrom: null,
      serialNumberTo: null,
      truck: {
        plate: "",
      },
    },
  });

  const handleSubmit = useCallback(
    async (data: QuickTaskFormData) => {
      try {
        setIsSubmitting(true);

        // Determine if this is a batch create (range of serial numbers)
        const isBatchCreate =
          data.serialNumberFrom !== null &&
          data.serialNumberFrom !== undefined &&
          data.serialNumberTo !== null &&
          data.serialNumberTo !== undefined;

        if (isBatchCreate) {
          // BATCH CREATE: Generate multiple tasks from serial number range
          const taskCount = data.serialNumberTo! - data.serialNumberFrom! + 1;
          const tasks = [];

          for (let i = data.serialNumberFrom!; i <= data.serialNumberTo!; i++) {
            const task: any = {
              status: TASK_STATUS.PREPARATION,
              serialNumber: String(i),
            };

            // Add optional fields
            if (data.name && data.name.trim()) {
              task.name = `${data.name.trim()} - ${i}`;
            }

            if (data.customerId) {
              task.customerId = data.customerId;
            }

            if (data.truck?.plate) {
              task.truck = {
                plate: data.truck.plate,
              };
            }

            tasks.push(task);
          }

          // Use batch create API
          const result = await batchCreateAsync({ tasks });

          if (result?.success && result.data) {
            // Show batch result dialog
            setBatchResult(result.data);
            setShowBatchResultDialog(true);

            // Show toast summary
            const successCount = result.data.totalSuccess;
            const failedCount = result.data.totalFailed;

            if (failedCount === 0) {
              toast.success(`${successCount} tarefa${successCount > 1 ? 's' : ''} criada${successCount > 1 ? 's' : ''} com sucesso!`);
            } else if (successCount === 0) {
              toast.error(`Falha ao criar ${failedCount} tarefa${failedCount > 1 ? 's' : ''}`);
            } else {
              toast.warning(`${successCount} tarefa${successCount > 1 ? 's' : ''} criada${successCount > 1 ? 's' : ''}, ${failedCount} falha${failedCount > 1 ? 's' : ''}`);
            }

            // Reset form and close dialog only if all succeeded
            if (failedCount === 0) {
              form.reset({
                name: "",
                customerId: "",
                serialNumberFrom: null,
                serialNumberTo: null,
                truck: {
                  plate: "",
                },
              });
              onOpenChange(false);
            }
            // If there were failures, keep the dialog open so user can see what failed and retry

            // Trigger success callback if at least one task succeeded
            if (successCount > 0 && onSuccess) {
              onSuccess();
            }
          }
        } else {
          // SINGLE CREATE: Create one task
          const payload: any = {
            status: TASK_STATUS.PREPARATION,
          };

          // Add optional fields
          if (data.name && data.name.trim()) {
            payload.name = data.name.trim();
          }

          if (data.customerId) {
            payload.customerId = data.customerId;
          }

          if (data.truck?.plate) {
            payload.truck = {
              plate: data.truck.plate,
            };
          }

          // Handle single serial number
          if (data.serialNumberFrom !== null && data.serialNumberFrom !== undefined) {
            payload.serialNumber = String(data.serialNumberFrom);
          } else if (data.serialNumberTo !== null && data.serialNumberTo !== undefined) {
            payload.serialNumber = String(data.serialNumberTo);
          }

          try {
            const result = await createAsync(payload);

            if (result?.success) {
              toast.success("Tarefa criada com sucesso!");

              // Reset form
              form.reset({
                name: "",
                customerId: "",
                forecastDate: null,
                serialNumberFrom: null,
                serialNumberTo: null,
                truck: {
                  plate: "",
                },
              });

              // Close dialog
              onOpenChange(false);

              // Trigger success callback
              if (onSuccess) {
                onSuccess();
              }
            }
          } catch (singleError: any) {
            // For single create errors, just show toast (no batch dialog needed)
            const errorMessage = singleError?.message || "Erro ao criar tarefa";
            toast.error(errorMessage);

            if (process.env.NODE_ENV !== 'production') {
              console.error("Error creating task:", singleError);
            }
            // Don't close dialog - user might want to fix and retry
          }
        }
      } catch (error) {
        // Unexpected errors
        if (process.env.NODE_ENV !== 'production') {
          console.error("Unexpected error:", error);
        }
        toast.error("Erro inesperado ao criar tarefa(s)");
      } finally {
        setIsSubmitting(false);
      }
    },
    [createAsync, batchCreateAsync, form, onOpenChange, onSuccess]
  );

  const handleCancel = useCallback(() => {
    form.reset();
    onOpenChange(false);
  }, [form, onOpenChange]);

  const handleCloseBatchResultDialog = useCallback(() => {
    setShowBatchResultDialog(false);
    setBatchResult(null);
  }, []);

  const { formState } = form;
  const hasErrors = Object.keys(formState.errors).length > 0;
  const name = form.watch("name");
  const customerId = form.watch("customerId");
  const plate = form.watch("truck.plate");
  const serialNumberFrom = form.watch("serialNumberFrom");
  const serialNumberTo = form.watch("serialNumberTo");

  // Require at least one identifier: customer, plate, serial number, or name
  const hasRequiredFields = Boolean(
    (name && name.trim().length > 0) ||
    (customerId && customerId.trim().length > 0) ||
    (plate && plate.trim().length > 0) ||
    serialNumberFrom !== null ||
    serialNumberTo !== null
  );

  // Determine if this will be a batch create
  const willBeBatchCreate =
    serialNumberFrom !== null &&
    serialNumberFrom !== undefined &&
    serialNumberTo !== null &&
    serialNumberTo !== undefined;

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <IconPlus className="h-5 w-5" />
              Criar Nova Tarefa
            </DialogTitle>
            <DialogDescription>
              Preencha os campos abaixo para criar uma nova tarefa rapidamente.
              {willBeBatchCreate && (
                <span className="block mt-1 text-yellow-600 dark:text-yellow-500">
                  Será criada uma tarefa para cada número de série de {serialNumberFrom} até {serialNumberTo} ({serialNumberTo - serialNumberFrom + 1} tarefas)
                </span>
              )}
            </DialogDescription>
          </DialogHeader>

          <Form {...form}>
            <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
              {/* Name */}
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="flex items-center gap-2">
                      <IconFileText className="h-4 w-4" />
                      Nome da Tarefa
                    </FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        value={field.value || ""}
                        placeholder="Ex: Pintura completa do caminhão"
                        disabled={isSubmitting}
                        className="bg-transparent"
                      />
                    </FormControl>
                    {willBeBatchCreate && field.value && (
                      <p className="text-xs text-muted-foreground">
                        Exemplo: {field.value} - {serialNumberFrom}
                      </p>
                    )}
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Customer */}
              <CustomerSelector control={form.control} disabled={isSubmitting} />

              {/* Forecast Date */}
              <FormField
                control={form.control}
                name="forecastDate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="flex items-center gap-2">
                      <IconCalendar className="h-4 w-4" />
                      Data de Previsão
                    </FormLabel>
                    <FormControl>
                      <DateTimeInput
                        field={field}
                        mode="date"
                        context="start"
                        label=""
                        disabled={isSubmitting}
                        allowManualInput={true}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Plate */}
              <FormField
                control={form.control}
                name="truck.plate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="flex items-center gap-2">
                      <IconLicense className="h-4 w-4" />
                      Placa
                    </FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        value={field.value || ""}
                        placeholder="Ex: ABC1234"
                        className="uppercase bg-transparent"
                        onChange={(e) => field.onChange(e.target.value.toUpperCase())}
                        disabled={isSubmitting}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Serial Number Range - for bulk task creation */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="serialNumberFrom"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="flex items-center gap-2">
                        <IconHash className="h-4 w-4" />
                        Número de Série (De)
                      </FormLabel>
                      <FormControl>
                        <Input
                          type="natural"
                          value={field.value ?? ""}
                          placeholder="Ex: 1"
                          className="bg-transparent"
                          onChange={field.onChange}
                          disabled={isSubmitting}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="serialNumberTo"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="flex items-center gap-2">
                        <IconHash className="h-4 w-4" />
                        Número de Série (Até)
                      </FormLabel>
                      <FormControl>
                        <Input
                          type="natural"
                          value={field.value ?? ""}
                          placeholder="Ex: 5"
                          className="bg-transparent"
                          onChange={field.onChange}
                          disabled={isSubmitting}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleCancel}
                  disabled={isSubmitting}
                >
                  Cancelar
                </Button>
                <Button
                  type="submit"
                  disabled={isSubmitting || hasErrors || !hasRequiredFields}
                >
                  {isSubmitting ? (
                    <>
                      <IconLoader2 className="mr-2 h-4 w-4 animate-spin" />
                      {willBeBatchCreate ? 'Criando tarefas...' : 'Criando...'}
                    </>
                  ) : (
                    <>
                      <IconPlus className="mr-2 h-4 w-4" />
                      {willBeBatchCreate
                        ? `Criar ${serialNumberTo! - serialNumberFrom! + 1} Tarefas`
                        : 'Criar Tarefa'}
                    </>
                  )}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Batch Result Dialog */}
      <BatchOperationResultDialog
        open={showBatchResultDialog}
        onOpenChange={handleCloseBatchResultDialog}
        result={batchResult}
        operationType="create"
        entityName="tarefa"
        successItemDisplay={(task: Task) => (
          <div>
            <p className="font-medium text-sm">
              {task.name || `Tarefa ${task.serialNumber || task.id}`}
            </p>
            {task.serialNumber && (
              <p className="text-xs text-muted-foreground">Série: {task.serialNumber}</p>
            )}
          </div>
        )}
        failedItemDisplay={(error: BatchOperationError<any>) => (
          <div>
            <p className="font-medium text-sm">
              Tarefa {error.data?.serialNumber || error.index + 1}
            </p>
            <p className="text-sm text-destructive mt-1">{error.error}</p>
          </div>
        )}
      />
    </>
  );
}
