import { useState, useCallback } from "react";
import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { useTaskMutations, useTaskBatchMutations } from "../../../../hooks";
import { TASK_STATUS } from "../../../../constants";
import { IconLoader2, IconPlus, IconTrash } from "@tabler/icons-react";
import type { Task } from "../../../../types";

// Schema for a single copy entry
const copyEntrySchema = z.object({
  serialNumber: z
    .string()
    .nullable()
    .optional()
    .transform((val) => val?.trim().toUpperCase() || null),
  plate: z
    .string()
    .nullable()
    .optional()
    .transform((val) => val?.trim().toUpperCase() || null),
  chassisNumber: z
    .string()
    .nullable()
    .optional()
    .transform((val) => val?.trim().replace(/\s/g, "").toUpperCase() || null),
});

// Schema for multiple copies
const duplicateSchema = z.object({
  copies: z.array(copyEntrySchema).min(1, "Adicione pelo menos uma cópia"),
});

type DuplicateFormData = z.infer<typeof duplicateSchema>;

interface TaskDuplicateModalProps {
  task: Task | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

export const TaskDuplicateModal = ({ task, open, onOpenChange, onSuccess }: TaskDuplicateModalProps) => {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { createAsync } = useTaskMutations();
  const { batchCreateAsync } = useTaskBatchMutations();

  const form = useForm<DuplicateFormData>({
    resolver: zodResolver(duplicateSchema),
    defaultValues: {
      copies: [{ serialNumber: "", plate: "", chassisNumber: "" }],
    },
  });

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "copies",
  });

  // Add a new copy entry
  const handleAddCopy = useCallback(() => {
    append({ serialNumber: "", plate: "", chassisNumber: "" });
  }, [append]);

  // Reset form when task changes
  const handleOpenChange = (newOpen: boolean) => {
    if (newOpen && task) {
      form.reset({
        copies: [{ serialNumber: "", plate: "", chassisNumber: "" }],
      });
    }
    onOpenChange(newOpen);
  };

  // Build task data for a single copy
  const buildTaskData = (copyData: { serialNumber?: string | null; plate?: string | null; chassisNumber?: string | null }) => {
    if (!task) return null;

    return {
      // Basic fields
      name: task.name,
      status: TASK_STATUS.PREPARATION,
      // Sanitize serialNumber - remove invalid characters, keep only A-Z, 0-9, and -
      serialNumber: (copyData.serialNumber || String(task.serialNumber || "")).replace(/[^A-Z0-9-]/gi, "").toUpperCase() || null,
      details: task.details,
      entryDate: task.entryDate,
      term: task.term,
      startedAt: null, // Reset
      finishedAt: null, // Reset
      paintId: task.paintId,
      customerId: task.customerId,
      sectorId: task.sectorId,
      commission: task.commission, // Required field
      budgetIds: task.budgets?.map((b: any) => b.id) || [],
      invoiceIds: task.invoices?.map((i: any) => i.id) || [],
      receiptIds: task.receipts?.map((r: any) => r.id) || [],

      // Relations - copy artwork and paint IDs
      // artworkIds must be File IDs (artwork.fileId or artwork.file.id), not Artwork entity IDs
      artworkIds: task.artworks?.map((artwork: any) => artwork.fileId || artwork.file?.id || artwork.id),
      paintIds: task.logoPaints?.map((paint) => paint.id),

      // Complex relations - copy nested data
      // observation.artworkIds are actually file IDs (Observation has files, not artworks)
      observation: task.observation
        ? {
            description: task.observation.description,
            artworkIds: task.observation.files?.map((file: any) => file.id) || [],
          }
        : null,

      services: task.serviceOrders?.map((service) => ({
        status: service.status,
        statusOrder: service.statusOrder,
        description: service.description,
        startedAt: null, // Reset service dates
        finishedAt: null,
      })),

      // Truck with new plate and chassis from form (only if there's data)
      truck: (copyData.plate || copyData.chassisNumber || task.truck)
        ? {
            plate: copyData.plate || task.truck?.plate || null,
            chassisNumber: copyData.chassisNumber || task.truck?.chassisNumber || null,
            spot: task.truck?.spot || null,
          }
        : null,

      // Note: cuts are not duplicated as they are separate records
      // The new task will need new cut entries if required
      cut: null,

      // Note: airbrushings are not duplicated as they are separate records
      // The new task will need new airbrushing entries if required
    };
  };

  const handleSubmit = async (data: DuplicateFormData) => {
    if (!task) return;

    try {
      setIsSubmitting(true);

      // Build task data for each copy
      const tasksToCreate = data.copies.map((copy) => buildTaskData(copy)).filter(Boolean) as any[];

      if (tasksToCreate.length === 0) {
        return;
      }

      let success = false;

      if (tasksToCreate.length === 1) {
        // Single copy - use regular create
        const result = await createAsync(tasksToCreate[0]);
        success = result.success;
      } else {
        // Multiple copies - use batch create
        const result = await batchCreateAsync({ tasks: tasksToCreate });
        success = result.success;
      }

      if (success) {
        handleOpenChange(false);
        onSuccess?.();
      }
    } catch (error) {
      if (process.env.NODE_ENV !== 'production') {
        console.error("Error creating copies:", error);
      }
      // Error is handled by the mutation hook
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!task) return null;

  const copyCount = fields.length;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>Criar Cópias</DialogTitle>
          <DialogDescription>
            Criando {copyCount > 1 ? `${copyCount} cópias` : "uma cópia"} de "{task.name}". Informe o número de série, placa e chassi para cada cópia.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="flex-1 flex flex-col overflow-hidden">
            <div className="max-h-[40vh] overflow-y-auto space-y-2 py-2">
              {fields.map((field, index) => (
                <div
                  key={field.id}
                  className="flex items-end gap-2"
                >
                  <div className="flex-1 grid grid-cols-1 md:grid-cols-3 gap-2">
                    {/* Serial Number */}
                    <FormField
                      control={form.control}
                      name={`copies.${index}.serialNumber`}
                      render={({ field }) => (
                        <FormItem className="space-y-1">
                          {index === 0 && <FormLabel>Nº Série</FormLabel>}
                          <FormControl>
                            <Input
                              ref={field.ref}
                              value={field.value || ""}
                              placeholder="Ex: ABC-12345"
                              className="uppercase"
                              onChange={(value: string | number | null) => field.onChange(typeof value === 'string' ? value.toUpperCase() : String(value ?? '').toUpperCase())}
                              onBlur={field.onBlur}
                              disabled={isSubmitting}
                              autoFocus={index === 0}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    {/* Plate */}
                    <FormField
                      control={form.control}
                      name={`copies.${index}.plate`}
                      render={({ field }) => (
                        <FormItem className="space-y-1">
                          {index === 0 && <FormLabel>Placa</FormLabel>}
                          <FormControl>
                            <Input
                              ref={field.ref}
                              value={field.value || ""}
                              placeholder="Ex: ABC1D23"
                              className="uppercase"
                              onChange={(value: string | number | null) => field.onChange(typeof value === 'string' ? value.toUpperCase() : String(value ?? '').toUpperCase())}
                              onBlur={field.onBlur}
                              disabled={isSubmitting}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    {/* Chassis Number */}
                    <FormField
                      control={form.control}
                      name={`copies.${index}.chassisNumber`}
                      render={({ field }) => (
                        <FormItem className="space-y-1">
                          {index === 0 && <FormLabel>Nº Chassi</FormLabel>}
                          <FormControl>
                            <Input
                              ref={field.ref}
                              value={field.value || ""}
                              placeholder="Ex: 9BWZZZ377VT004251"
                              className="uppercase"
                              onChange={(value: string | number | null) => field.onChange(typeof value === 'string' ? value.toUpperCase() : String(value ?? '').toUpperCase())}
                              onBlur={field.onBlur}
                              disabled={isSubmitting}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  {/* Remove Button - always show to maintain layout consistency */}
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => remove(index)}
                    disabled={isSubmitting || fields.length <= 1}
                    className={fields.length > 1 ? "text-destructive shrink-0" : "text-muted-foreground/30 shrink-0 cursor-not-allowed"}
                    title={fields.length > 1 ? "Remover cópia" : "Não é possível remover a única cópia"}
                  >
                    <IconTrash className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>

            {/* Adicionar Button - full width */}
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleAddCopy}
              disabled={isSubmitting}
              className="w-full mt-2"
            >
              <IconPlus className="h-4 w-4 mr-2" />
              Adicionar
            </Button>

            <DialogFooter className="mt-4 pt-4 border-t">
              <Button type="button" variant="outline" onClick={() => handleOpenChange(false)} disabled={isSubmitting}>
                Cancelar
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting && <IconLoader2 className="mr-2 h-4 w-4 animate-spin" />}
                {copyCount > 1 ? `Criar ${copyCount} Cópias` : "Criar Cópia"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
};
