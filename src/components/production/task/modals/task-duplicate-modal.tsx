import { useState, useCallback } from "react";
import { useForm, useFieldArray, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { useTaskMutations, useTaskBatchMutations, useTaskDetail } from "../../../../hooks";
import { TASK_STATUS, SERVICE_ORDER_STATUS, PAYMENT_CONDITION } from "../../../../constants";
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
  quote: {
    include: {
      services: true,
      layoutFiles: true,
      customerConfigs: true,
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

  const watchedCopies = useWatch({ control: form.control, name: "copies" });
  const isCopyFilled = (c: { serialNumber?: string | null; plate?: string | null; chassisNumber?: string | null } | undefined) =>
    !!(c?.serialNumber?.trim() || c?.plate?.trim() || c?.chassisNumber?.trim());
  const filledCopiesCount = (watchedCopies || []).filter(isCopyFilled).length;
  const hasEmptyCopy = (watchedCopies || []).some((c) => !isCopyFilled(c));

  const handleAddCopy = useCallback(() => {
    if (hasEmptyCopy) return;
    append({ serialNumber: "", plate: "", chassisNumber: "" });
  }, [append, hasEmptyCopy]);

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

  // Normalize a source quote's paymentCondition before copying it.
  // The enum was historically split (CASH -> CASH_5/CASH_40) but the column is a free
  // String, so old records still hold dead values (CASH, PIX, ...) that the create
  // schema rejects. Map known legacy values to their modern equivalent and drop any
  // value that isn't a current enum member so a duplicate never fails validation.
  const LEGACY_PAYMENT_CONDITION_MAP: Record<string, PAYMENT_CONDITION> = {
    CASH: PAYMENT_CONDITION.CASH_40,
    PIX: PAYMENT_CONDITION.CASH_5,
  };
  const normalizePaymentCondition = (value: any): PAYMENT_CONDITION | null => {
    if (!value) return null;
    const mapped = LEGACY_PAYMENT_CONDITION_MAP[value] ?? value;
    return (Object.values(PAYMENT_CONDITION) as string[]).includes(mapped) ? (mapped as PAYMENT_CONDITION) : null;
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
      // All dates reset — duplicates start fresh
      entryDate: null,
      term: null,
      forecastDate: null,
      startedAt: null,
      finishedAt: null,
      paintId: sourceTask.paintId,
      customerId: sourceTask.customerId,
      sectorId: sourceTask.sectorId,
      // Bonification is NOT copied — a fresh duplicate has done zero work
      bonification: null,

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
      // Cancelled SOs are skipped so they don't get resurrected as PENDING on copies
      serviceOrders: sourceTask.serviceOrders
        ?.filter((service: any) => service.status !== SERVICE_ORDER_STATUS.CANCELLED)
        .map((service: any) => ({
          description: service.description,
          type: service.type,
          status: SERVICE_ORDER_STATUS.PENDING,
          statusOrder: 1,
          assignedToId: service.assignedTo?.id || service.assignedToId || null,
          observation: service.observation || null,
          startedAt: null,
          finishedAt: null,
        })) || [],

      // Truck - copy all fields, use form values for plate/chassis (no fallback to avoid duplicates)
      // Layouts are SHARED (connect to existing layout IDs)
      truck: (copyData.plate || copyData.chassisNumber || truckData)
        ? {
            plate: copyData.plate || null,
            chassisNumber: copyData.chassisNumber || null,
            // Spot is a UNIQUE physical garage location — never copy it to a duplicate
            spot: null,
            category: truckData?.category || null,
            implementType: truckData?.implementType || null,
            // Share existing layouts (connect to same layout records)
            leftSideLayoutId: truckData?.leftSideLayout?.id || truckData?.leftSideLayoutId || null,
            rightSideLayoutId: truckData?.rightSideLayout?.id || truckData?.rightSideLayoutId || null,
            backSideLayoutId: truckData?.backSideLayout?.id || truckData?.backSideLayoutId || null,
          }
        : null,

      // Quote (creates NEW record with same values, budget number auto-incremented by API)
      ...(sourceTask.quote && sourceTask.quote.services?.length > 0
        ? {
            quote: {
              status: 'PENDING' as const,
              services: sourceTask.quote.services.map((item: any) => ({
                description: item.description,
                amount: Number(item.amount) || 0,
                observation: item.observation || null,
              })),
              subtotal: Number(sourceTask.quote.subtotal) || 0,
              total: Number(sourceTask.quote.total) || 0,
              expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
              guaranteeYears: sourceTask.quote.guaranteeYears != null ? Number(sourceTask.quote.guaranteeYears) : null,
              customGuaranteeText: sourceTask.quote.customGuaranteeText,
              customForecastDays: sourceTask.quote.customForecastDays != null ? Number(sourceTask.quote.customForecastDays) : null,
              simultaneousTasks: sourceTask.quote.simultaneousTasks != null ? Number(sourceTask.quote.simultaneousTasks) : null,
              layoutFileIds: (sourceTask.quote.layoutFiles || []).map((f: any) => f.id),
              customerConfigs: sourceTask.quote.customerConfigs?.map((config: any) => ({
                customerId: config.customerId,
                subtotal: Number(config.subtotal) || 0,
                total: Number(config.total) || 0,
                discountType: config.discountType || 'NONE',
                discountValue: config.discountValue != null ? Number(config.discountValue) : null,
                discountReference: config.discountReference || null,
                customPaymentText: config.customPaymentText || null,
                responsibleId: config.responsibleId || null,
                paymentCondition: normalizePaymentCondition(config.paymentCondition),
                paymentConfig: config.paymentConfig || null,
                generateInvoice: config.generateInvoice ?? true,
                generateBankSlip: config.generateBankSlip ?? true,
              })) || [],
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
    const tasksToCreate = data.copies
      .filter(isCopyFilled)
      .map((copy) => buildTaskData(copy))
      .filter(Boolean) as any[];
    if (tasksToCreate.length === 0) return;
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
    : (filledCopiesCount > 1 ? `Criar ${filledCopiesCount} Cópias` : "Criar Cópia");

  const isSubmitDisabled =
    isSubmitting ||
    isLoadingTask ||
    (mode === 'quantity' && (!quantity || quantity < 1)) ||
    (mode === 'detailed' && filledCopiesCount === 0);

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
                disabled={isSubmitting || hasEmptyCopy}
                title={hasEmptyCopy ? "Preencha placa, nº série ou chassi em todas as cópias antes de adicionar outra" : undefined}
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
