import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { z } from "zod";
import { ppeDeliveryUpdateSchema, type PpeDeliveryUpdateFormData } from "../../../../schemas";
import { useAuth } from "../../../../hooks";
import { type PpeDelivery } from "../../../../types";
import { PPE_DELIVERY_STATUS, PPE_DELIVERY_STATUS_LABELS, routes, SECTOR_PRIVILEGES } from "../../../../constants";
import { MultiDeliveryInput } from "./multi-delivery-input";
import { hasPrivilege } from "../../../../utils";

// Batch create schema for multiple deliveries
const ppeDeliveryBatchCreateSchema = z.object({
  ppeDeliveries: z.array(
    z.object({
      userId: z.string().uuid("Funcionário inválido").min(1, "Selecione um funcionário"),
      itemId: z.string().uuid("EPI inválido").min(1, "Selecione um EPI"),
      quantity: z.number().positive("Quantidade deve ser positiva").int("Quantidade deve ser um número inteiro"),
    })
  ).min(1, "Adicione pelo menos uma entrega"),
});

type PpeDeliveryBatchCreateFormData = z.infer<typeof ppeDeliveryBatchCreateSchema>;

interface BasePpeDeliveryFormProps {
  isSubmitting?: boolean;
}

interface CreatePpeDeliveryFormProps extends BasePpeDeliveryFormProps {
  mode: "create";
  onSubmit: (data: PpeDeliveryBatchCreateFormData) => Promise<void>;
  defaultValues?: Partial<PpeDeliveryBatchCreateFormData>;
}

interface UpdatePpeDeliveryFormProps extends BasePpeDeliveryFormProps {
  mode: "update";
  ppeDelivery: PpeDelivery;
  onSubmit: (data: PpeDeliveryUpdateFormData) => Promise<void>;
  defaultValues?: Partial<PpeDeliveryUpdateFormData>;
}

type PpeDeliveryFormProps = CreatePpeDeliveryFormProps | UpdatePpeDeliveryFormProps;

export function PpeDeliveryForm(props: PpeDeliveryFormProps) {
  const { isSubmitting, mode } = props;
  const navigate = useNavigate();
  const { user: currentUser } = useAuth();

  const currentStatus = mode === "update" ? props.ppeDelivery.status : PPE_DELIVERY_STATUS.APPROVED;

  // Setup form based on mode
  const form = useForm<PpeDeliveryBatchCreateFormData | PpeDeliveryUpdateFormData>({
    resolver: zodResolver(mode === "create" ? ppeDeliveryBatchCreateSchema : ppeDeliveryUpdateSchema),
    mode: "onBlur", // Validate on blur for better UX
    defaultValues:
      mode === "create"
        ? {
            ppeDeliveries: props.defaultValues?.ppeDeliveries || [],
          }
        : {
            quantity: props.ppeDelivery.quantity,
            status: currentStatus,
            scheduledDate: props.ppeDelivery.scheduledDate,
            actualDeliveryDate: props.ppeDelivery.actualDeliveryDate,
            ...props.defaultValues,
          },
  });

  // Handle status changes and auto-set dates
  const watchStatus = form.watch("status");

  useEffect(() => {
    if (watchStatus === PPE_DELIVERY_STATUS.DELIVERED && !form.getValues("actualDeliveryDate")) {
      form.setValue("actualDeliveryDate", new Date());
    }
  }, [watchStatus, form]);

  const handleSubmit = async (data: PpeDeliveryBatchCreateFormData | PpeDeliveryUpdateFormData) => {
    try {
      if (mode === "create") {
        const batchData = data as PpeDeliveryBatchCreateFormData;
        // Add reviewedBy and status to each delivery
        const deliveriesWithStatus = {
          ppeDeliveries: batchData.ppeDeliveries.map((delivery) => ({
            ...delivery,
            reviewedBy: currentUser?.id ?? "",
            status: PPE_DELIVERY_STATUS.APPROVED, // Auto-approve when admin creates
          })),
        };
        await props.onSubmit(deliveriesWithStatus);
        // Don't navigate here - let parent component handle navigation after showing dialog
      } else {
        await props.onSubmit(data as PpeDeliveryUpdateFormData);
        // For update mode, navigate after success
        navigate(routes.inventory.ppe.deliveries.root);
      }
    } catch (error) {
      if (process.env.NODE_ENV !== 'production') {
        console.error("Error submitting form:", error);
      }
    }
  };

  const handleError = (errors: Record<string, any>) => {
    if (process.env.NODE_ENV !== 'production') {
      console.error("PPE delivery form validation errors:", errors);
    }
    // Scroll to first error field if exists
    const firstErrorField = Object.keys(errors)[0];
    if (firstErrorField) {
      const element = document.querySelector(`[name="${firstErrorField}"]`);
      if (element) {
        element.scrollIntoView({ behavior: "smooth", block: "center" });
      }
    }
  };

  // Can edit item and user only in create mode
  const canEditItemAndUser = mode === "create";

  // Can change status in update mode and user has warehouse privileges
  const canChangeStatus = mode === "update" && currentUser && hasPrivilege(currentUser, SECTOR_PRIVILEGES.WAREHOUSE);

  return (
    <Card className="shadow-sm border border-border">
      <CardContent className="p-4">
        <Form {...form}>
          <form id="ppe-delivery-form" onSubmit={form.handleSubmit(handleSubmit, handleError)} className="space-y-8">
            {/* Hidden submit button for programmatic form submission */}
            <button type="submit" id="ppe-delivery-form-submit" className="hidden" aria-hidden="true" />
              {/* Multi Delivery Input (only for create mode) */}
              {canEditItemAndUser && (
                <MultiDeliveryInput control={form.control} disabled={isSubmitting} />
              )}

              {/* Quantity field for update mode */}
              {!canEditItemAndUser && (
                <FormField
                  control={form.control}
                  name="quantity"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Quantidade <span className="text-destructive">*</span></FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          min={1}
                          max={999}
                          value={field.value}
                          onChange={(value: string | number | null) => {
                            const numValue = typeof value === 'number' ? value : parseInt(String(value ?? '1'));
                            if (isNaN(numValue) || numValue < 1) {
                              field.onChange(1);
                            } else if (numValue > 999) {
                              field.onChange(999);
                            } else {
                              field.onChange(numValue);
                            }
                          }}
                          placeholder="Quantidade"
                          className="max-w-[150px] bg-transparent"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}

              {/* Status field for update mode */}
              {canChangeStatus && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <FormField
                    control={form.control}
                    name="status"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Status *</FormLabel>
                        <FormControl>
                          <select
                            value={field.value}
                            onChange={field.onChange}
                            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            {Object.values(PPE_DELIVERY_STATUS).map((status) => (
                              <option key={status} value={status}>{PPE_DELIVERY_STATUS_LABELS[status]}</option>
                            ))}
                          </select>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              )}

              {/* Form Validation Summary */}
              {Object.keys(form.formState.errors).length > 0 && (
                <div className="bg-red-50 border border-red-200 rounded-md p-4">
                  <h4 className="text-red-800 font-medium mb-2 flex items-center gap-2">
                    <span>⚠️</span>
                    Erros de Validação
                  </h4>
                  <p className="text-red-700 text-sm mb-3">Corrija os erros abaixo antes de enviar:</p>
                  <ul className="text-red-700 text-sm space-y-1">
                    {Object.entries(form.formState.errors).map(([field, error]) => (
                      <li key={field} className="flex items-start gap-2">
                        <span className="font-medium">
                          {field === "userId" && "Funcionário:"}
                          {field === "itemId" && "EPI:"}
                          {field === "quantity" && "Quantidade:"}
                          {field === "status" && "Status:"}
                          {!["userId", "itemId", "quantity", "status"].includes(field) && `${field}:`}
                        </span>
                        <span>{error?.message || "Campo obrigatório"}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}
