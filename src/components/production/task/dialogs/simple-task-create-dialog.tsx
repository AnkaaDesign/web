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
import { useTaskMutations } from "@/hooks";
import { TASK_STATUS } from "@/constants";
import { toast } from "sonner";
import { IconLoader2, IconPlus, IconFileText, IconHash, IconLicense } from "@tabler/icons-react";

// Simplified schema for task creation in preparation page
const simpleTaskSchema = z
  .object({
    name: z.string().min(3, "Nome deve ter no mínimo 3 caracteres"),
    customerId: z.string().optional(),
    serialNumber: z.string().optional(),
    serialNumberFrom: z.number().nullable().optional(),
    serialNumberTo: z.number().nullable().optional(),
    truck: z
      .object({
        plate: z.string().optional(),
      })
      .optional(),
  })
  .refine(
    (data) => {
      // If serialNumberFrom is provided, serialNumberTo must also be provided
      if (data.serialNumberFrom !== null && data.serialNumberFrom !== undefined) {
        return data.serialNumberTo !== null && data.serialNumberTo !== undefined;
      }
      return true;
    },
    {
      message: "Se informar 'De número de série', deve informar 'Até número de série'",
      path: ["serialNumberTo"],
    },
  )
  .refine(
    (data) => {
      // If serialNumberTo is provided, serialNumberFrom must also be provided
      if (data.serialNumberTo !== null && data.serialNumberTo !== undefined) {
        return data.serialNumberFrom !== null && data.serialNumberFrom !== undefined;
      }
      return true;
    },
    {
      message: "Se informar 'Até número de série', deve informar 'De número de série'",
      path: ["serialNumberFrom"],
    },
  )
  .refine(
    (data) => {
      // serialNumberFrom must be less than or equal to serialNumberTo
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
    },
  );

type SimpleTaskFormData = z.infer<typeof simpleTaskSchema>;

interface SimpleTaskCreateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

export function SimpleTaskCreateDialog({ open, onOpenChange, onSuccess }: SimpleTaskCreateDialogProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { createAsync } = useTaskMutations();

  const form = useForm<SimpleTaskFormData>({
    resolver: zodResolver(simpleTaskSchema),
    mode: "onChange",
    defaultValues: {
      name: "",
      customerId: "",
      serialNumber: "",
      serialNumberFrom: null,
      serialNumberTo: null,
      truck: {
        plate: "",
      },
    },
  });

  const handleSubmit = useCallback(
    async (data: SimpleTaskFormData) => {
      try {
        setIsSubmitting(true);

        // Build the task creation payload
        const payload: any = {
          status: TASK_STATUS.PREPARATION,
          name: data.name,
        };

        // Add optional fields
        if (data.customerId) {
          payload.customerId = data.customerId;
        }

        if (data.serialNumber) {
          payload.serialNumber = data.serialNumber.toUpperCase();
        }

        if (data.truck?.plate) {
          payload.truck = {
            plate: data.truck.plate.toUpperCase(),
          };
        }

        // Add serial number range for bulk creation
        if (data.serialNumberFrom !== null && data.serialNumberTo !== null) {
          payload.serialNumberFrom = data.serialNumberFrom;
          payload.serialNumberTo = data.serialNumberTo;
        }

        const result = await createAsync(payload);

        if (result?.success) {
          // Handle both single and bulk creation responses
          const isBulkResponse = result.data && "success" in result.data && Array.isArray((result.data as any).success);
          const createdTasks = isBulkResponse ? (result.data as any).success : [result.data];
          const tasksCount = createdTasks.length;

          // Show success message with count
          if (tasksCount > 0) {
            toast.success(`${tasksCount} tarefa${tasksCount > 1 ? "s" : ""} criada${tasksCount > 1 ? "s" : ""} com sucesso!`);
          }

          // Reset form
          form.reset({
            name: "",
            customerId: "",
            serialNumber: "",
            serialNumberFrom: null,
            serialNumberTo: null,
            truck: {
              plate: "",
            },
          });

          // Close dialog
          onOpenChange(false);

          // Note: Task list will automatically refresh via React Query invalidation
          // The useTaskMutations hook already invalidates all task queries on successful creation

          // Trigger success callback if provided (for any custom logic)
          if (onSuccess) {
            onSuccess();
          }
        }
      } catch (error) {
        if (process.env.NODE_ENV !== "production") {
          console.error("Error creating task:", error);
        }
      } finally {
        setIsSubmitting(false);
      }
    },
    [createAsync, form, onOpenChange, onSuccess],
  );

  const handleCancel = useCallback(() => {
    form.reset();
    onOpenChange(false);
  }, [form, onOpenChange]);

  const { formState } = form;
  const hasErrors = Object.keys(formState.errors).length > 0;
  const name = form.watch("name");
  const hasRequiredFields = Boolean(name && name.trim().length >= 3);

  // Watch serial number range for better UX feedback
  const serialNumberFrom = form.watch("serialNumberFrom");
  const serialNumberTo = form.watch("serialNumberTo");
  const hasBulkRange = serialNumberFrom !== null && serialNumberTo !== null && serialNumberFrom <= serialNumberTo;
  const expectedTaskCount = hasBulkRange ? serialNumberTo - serialNumberFrom + 1 : 1;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <IconPlus className="h-5 w-5" />
            Criar Nova Tarefa
          </DialogTitle>
          <DialogDescription>
            Preencha os campos abaixo para criar uma ou mais tarefas rapidamente.
            {hasBulkRange && (
              <span className="block mt-1 font-medium text-primary">
                {expectedTaskCount} tarefa{expectedTaskCount > 1 ? "s" : ""} será{expectedTaskCount > 1 ? "ão" : ""} criada
                {expectedTaskCount > 1 ? "s" : ""}.
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
                    Nome da Tarefa <span className="text-destructive">*</span>
                  </FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      value={field.value || ""}
                      placeholder="Ex: Pintura completa do caminhão"
                      disabled={isSubmitting}
                      className="bg-transparent"
                      autoFocus
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Customer */}
            <CustomerSelector control={form.control} disabled={isSubmitting} />

            {/* Serial Number and Plate */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="serialNumber"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="flex items-center gap-2">
                      <IconHash className="h-4 w-4" />
                      Número de Série
                    </FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        value={field.value || ""}
                        placeholder="Ex: ABC-123456"
                        className="uppercase bg-transparent"
                        onChange={(value: string) => field.onChange(value.toUpperCase())}
                        disabled={isSubmitting}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

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
                        onChange={(value: string) => field.onChange(value.toUpperCase())}
                        disabled={isSubmitting}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Serial Number Range - for bulk task creation */}
            <div className="space-y-2">
              <div className="text-sm font-medium text-muted-foreground">Criação em Lote (Opcional)</div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="serialNumberFrom"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="flex items-center gap-2">
                        <IconHash className="h-4 w-4" />
                        De número de série
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
                        Até número de série
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
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={handleCancel} disabled={isSubmitting}>
                Cancelar
              </Button>
              <Button type="submit" disabled={isSubmitting || hasErrors || !hasRequiredFields}>
                {isSubmitting ? (
                  <>
                    <IconLoader2 className="mr-2 h-4 w-4 animate-spin" />
                    Criando...
                  </>
                ) : (
                  <>
                    <IconPlus className="mr-2 h-4 w-4" />
                    {hasBulkRange ? `Criar ${expectedTaskCount} Tarefa${expectedTaskCount > 1 ? "s" : ""}` : "Criar Tarefa"}
                  </>
                )}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
