import { useState, useCallback } from "react";
import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { useTaskMutations, useTaskBatchMutations, useTaskDetail } from "../../../../hooks";
import { TASK_STATUS, SERVICE_ORDER_STATUS } from "../../../../constants";
import { IconLoader2, IconPlus, IconTrash } from "@tabler/icons-react";
import { Label } from "@/components/ui/label";
import type { Task } from "../../../../types";

// Full include config for refetching the task with ALL relations needed for duplication
const DUPLICATE_TASK_INCLUDE = {
  sector: true,
  customer: true,
  responsibles: true,
  serviceOrders: {
    include: {
      assignedTo: true,
    },
  },
  baseFiles: true,
  artworks: {
    include: {
      file: true,
    },
  },
  pricing: {
    include: {
      items: true,
      layoutFile: true,
    },
  },
  budgets: true,
  invoices: true,
  receipts: true,
  bankSlips: true,
  reimbursements: true,
  reimbursementInvoices: true,
  generalPainting: true,
  logoPaints: true,
  truck: {
    include: {
      leftSideLayout: {
        include: { layoutSections: true },
      },
      rightSideLayout: {
        include: { layoutSections: true },
      },
      backSideLayout: {
        include: { layoutSections: true },
      },
    },
  },
};

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
  const [mode, setMode] = useState<'quantity' | 'detailed'>('quantity');
  const [quantity, setQuantity] = useState<number | ''>('');
  const { createAsync } = useTaskMutations();
  const { batchCreateAsync } = useTaskBatchMutations();

  // Refetch the full task with ALL relations when the modal opens
  const { data: fullTaskResponse, isLoading: isLoadingTask } = useTaskDetail(task?.id ?? '', {
    enabled: open && !!task?.id,
    include: DUPLICATE_TASK_INCLUDE,
  });

  // Use the fully-loaded task (with all relations) instead of the partial table data
  const sourceTask = (fullTaskResponse as any)?.data ?? task;

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

  const handleAddCopy = useCallback(() => {
    append({ serialNumber: "", plate: "", chassisNumber: "" });
  }, [append]);

  const handleOpenChange = (newOpen: boolean) => {
    if (newOpen && task) {
      form.reset({
        copies: [{ serialNumber: "", plate: "", chassisNumber: "" }],
      });
      setMode('quantity');
      setQuantity('');
    }
    onOpenChange(newOpen);
  };

  // Build comprehensive task data for a single copy
  const buildTaskData = (copyData: { serialNumber?: string | null; plate?: string | null; chassisNumber?: string | null }) => {
    if (!sourceTask) return null;

    const truckData = sourceTask.truck;

    return {
      // Basic fields
      name: sourceTask.name,
      status: TASK_STATUS.PREPARATION,
      serialNumber: copyData.serialNumber || null,
      details: sourceTask.details,
      entryDate: sourceTask.entryDate,
      term: sourceTask.term,
      forecastDate: sourceTask.forecastDate,
      startedAt: null, // Reset
      finishedAt: null, // Reset
      paintId: sourceTask.paintId,
      customerId: sourceTask.customerId,
      sectorId: sourceTask.sectorId,
      commission: sourceTask.commission,

      // Responsibles (shared references)
      responsibleIds: sourceTask.responsibles?.map((r: any) => r.id) || [],

      // Financial file relations (shared references)
      budgetIds: sourceTask.budgets?.map((b: any) => b.id) || [],
      invoiceIds: sourceTask.invoices?.map((i: any) => i.id) || [],
      receiptIds: sourceTask.receipts?.map((r: any) => r.id) || [],
      reimbursementIds: sourceTask.reimbursements?.map((r: any) => r.id) || [],
      reimbursementInvoiceIds: sourceTask.reimbursementInvoices?.map((r: any) => r.id) || [],

      // Artworks (shared references - pass File IDs, API converts to Artwork entity IDs)
      artworkIds: sourceTask.artworks?.map((artwork: any) => artwork.fileId || artwork.file?.id || artwork.id) || [],

      // Base files (shared references - File IDs)
      baseFileIds: sourceTask.baseFiles?.map((f: any) => f.id) || [],

      // Logo paints (shared references)
      paintIds: sourceTask.logoPaints?.map((paint: any) => paint.id) || [],

      // Service orders (creates NEW records with status reset)
      serviceOrders: sourceTask.serviceOrders?.map((service: any) => ({
        description: service.description,
        type: service.type,
        status: SERVICE_ORDER_STATUS.PENDING,
        statusOrder: 1,
        assignedToId: service.assignedTo?.id || service.assignedToId || null,
        observation: service.observation || null,
        startedAt: null,
        finishedAt: null,
        shouldSync: true,
      })) || [],

      // Truck - copy all fields, use form values for plate/chassis (no fallback to avoid duplicates)
      // Layouts are SHARED (connect to existing layout IDs)
      truck: (copyData.plate || copyData.chassisNumber || truckData)
        ? {
            plate: copyData.plate || null,
            chassisNumber: copyData.chassisNumber || null,
            spot: truckData?.spot || null,
            category: truckData?.category || null,
            implementType: truckData?.implementType || null,
            // Share existing layouts (connect to same layout records)
            leftSideLayoutId: truckData?.leftSideLayout?.id || truckData?.leftSideLayoutId || null,
            rightSideLayoutId: truckData?.rightSideLayout?.id || truckData?.rightSideLayoutId || null,
            backSideLayoutId: truckData?.backSideLayout?.id || truckData?.backSideLayoutId || null,
          }
        : null,

      // Pricing (creates NEW record with same values, budget number auto-incremented by API)
      ...(sourceTask.pricing && sourceTask.pricing.items?.length > 0
        ? {
            pricing: {
              status: 'DRAFT' as const,
              items: sourceTask.pricing.items.map((item: any) => ({
                description: item.description,
                amount: Number(item.amount) || 0,
                observation: item.observation || null,
                shouldSync: item.shouldSync ?? true,
              })),
              subtotal: Number(sourceTask.pricing.subtotal) || 0,
              discountType: sourceTask.pricing.discountType || 'NONE',
              discountValue: sourceTask.pricing.discountValue != null ? Number(sourceTask.pricing.discountValue) : null,
              total: Number(sourceTask.pricing.total) || 0,
              expiresAt: sourceTask.pricing.expiresAt,
              paymentCondition: sourceTask.pricing.paymentCondition,
              downPaymentDate: sourceTask.pricing.downPaymentDate,
              customPaymentText: sourceTask.pricing.customPaymentText,
              guaranteeYears: sourceTask.pricing.guaranteeYears != null ? Number(sourceTask.pricing.guaranteeYears) : null,
              customGuaranteeText: sourceTask.pricing.customGuaranteeText,
              customForecastDays: sourceTask.pricing.customForecastDays != null ? Number(sourceTask.pricing.customForecastDays) : null,
              simultaneousTasks: sourceTask.pricing.simultaneousTasks != null ? Number(sourceTask.pricing.simultaneousTasks) : null,
              discountReference: sourceTask.pricing.discountReference,
              layoutFileId: sourceTask.pricing.layoutFile?.id || sourceTask.pricing.layoutFileId || null,
            },
          }
        : {}),

      // Observation is NOT copied (per business requirement)
      // Cuts are NOT duplicated (separate workflow)
      // Airbrushings are NOT duplicated (separate workflow)
    };
  };

  // Shared creation logic
  const createCopies = async (tasksToCreate: any[]) => {
    if (tasksToCreate.length === 0) return;

    try {
      setIsSubmitting(true);

      let success = false;

      if (tasksToCreate.length === 1) {
        const result = await createAsync(tasksToCreate[0]);
        success = result.success;
      } else {
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
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDetailedSubmit = async (data: DuplicateFormData) => {
    if (!sourceTask) return;
    const tasksToCreate = data.copies.map((copy) => buildTaskData(copy)).filter(Boolean) as any[];
    await createCopies(tasksToCreate);
  };

  const handleQuantitySubmit = async () => {
    if (!sourceTask || !quantity || quantity < 1) return;
    const tasksToCreate = Array.from({ length: quantity }, () =>
      buildTaskData({ serialNumber: null, plate: null, chassisNumber: null })
    ).filter(Boolean) as any[];
    await createCopies(tasksToCreate);
  };

  const handleSubmitClick = () => {
    if (mode === 'quantity') {
      handleQuantitySubmit();
    } else {
      form.handleSubmit(handleDetailedSubmit)();
    }
  };

  if (!task) return null;

  const submitLabel = mode === 'quantity'
    ? (quantity && quantity > 1 ? `Criar ${quantity} Cópias` : quantity === 1 ? "Criar Cópia" : "Criar Cópias")
    : (fields.length > 1 ? `Criar ${fields.length} Cópias` : "Criar Cópia");

  const isSubmitDisabled = isSubmitting || isLoadingTask || (mode === 'quantity' && (!quantity || quantity < 1));

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>Criar Cópias</DialogTitle>
          <DialogDescription>
            Criando cópias de "{task.name}".
            {mode === 'quantity'
              ? " Informe a quantidade de cópias idênticas a criar."
              : " Informe placa, nº série e chassi para cada cópia (opcionais)."}
          </DialogDescription>
        </DialogHeader>

        {/* Mode Toggle */}
        <div className="flex gap-2">
          <Button
            type="button"
            variant={mode === 'quantity' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setMode('quantity')}
            disabled={isSubmitting}
          >
            Quantidade
          </Button>
          <Button
            type="button"
            variant={mode === 'detailed' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setMode('detailed')}
            disabled={isSubmitting}
          >
            Detalhado
          </Button>
        </div>

        <div className="flex-1 flex flex-col overflow-hidden">
          {mode === 'quantity' ? (
            /* Quantity Mode */
            <div className="flex items-center gap-3 py-4">
              <Label className="whitespace-nowrap text-sm font-medium">Quantidade de cópias</Label>
              <Input
                type="number"
                min={1}
                max={50}
                value={quantity}
                onChange={(value: string | number | null) => {
                  const num = Number(value);
                  setQuantity(num > 0 ? Math.min(num, 50) : '');
                }}
                className="w-24"
                placeholder="Ex: 5"
                disabled={isSubmitting}
                autoFocus
              />
            </div>
          ) : (
            /* Detailed Mode */
            <Form {...form}>
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

                    {/* Remove Button */}
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
            </Form>
          )}
        </div>

        <DialogFooter className="mt-4 pt-4 border-t">
          <Button type="button" variant="outline" onClick={() => handleOpenChange(false)} disabled={isSubmitting}>
            Cancelar
          </Button>
          <Button type="button" onClick={handleSubmitClick} disabled={isSubmitDisabled}>
            {(isSubmitting || isLoadingTask) && <IconLoader2 className="mr-2 h-4 w-4 animate-spin" />}
            {isLoadingTask ? "Carregando..." : submitLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
