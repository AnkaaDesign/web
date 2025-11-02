import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { IconLoader, IconPackage, IconUser } from "@tabler/icons-react";
import { ppeDeliveryCreateSchema, ppeDeliveryUpdateSchema, type PpeDeliveryCreateFormData, type PpeDeliveryUpdateFormData } from "../../../../schemas";
import { useAuth } from "../../../../hooks";
import { type PpeDelivery } from "../../../../types";
import { PPE_DELIVERY_STATUS, PPE_DELIVERY_STATUS_LABELS, routes, SECTOR_PRIVILEGES } from "../../../../constants";
import { ItemSelectorDropdown } from "./item-selector-dropdown";
import { UserSelectorDropdown } from "./user-selector-dropdown";
import { hasPrivilege } from "../../../../utils";

interface BasePpeDeliveryFormProps {
  isSubmitting?: boolean;
}

interface CreatePpeDeliveryFormProps extends BasePpeDeliveryFormProps {
  mode: "create";
  onSubmit: (data: PpeDeliveryCreateFormData) => Promise<void>;
  defaultValues?: Partial<PpeDeliveryCreateFormData>;
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
  const { data: currentUser } = useAuth();

  const [selectedUserId, setSelectedUserId] = useState<string | undefined>(mode === "update" ? props.ppeDelivery.userId : undefined);

  const currentStatus = mode === "update" ? props.ppeDelivery.status : PPE_DELIVERY_STATUS.APPROVED;

  // Setup form based on mode
  const form = useForm<PpeDeliveryCreateFormData | PpeDeliveryUpdateFormData>({
    resolver: zodResolver(mode === "create" ? ppeDeliveryCreateSchema : ppeDeliveryUpdateSchema),
    mode: "onBlur", // Validate on blur for better UX
    defaultValues:
      mode === "create"
        ? {
            itemId: "",
            userId: "",
            quantity: 1,
            status: PPE_DELIVERY_STATUS.APPROVED, // Auto-approve for admin
            actualDeliveryDate: null,
            ...props.defaultValues,
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

  const handleSubmit = async (data: PpeDeliveryCreateFormData | PpeDeliveryUpdateFormData) => {
    try {
      if (mode === "create") {
        const createData: PpeDeliveryCreateFormData = {
          ...(data as PpeDeliveryCreateFormData),
          reviewedBy: currentUser?.id ?? "",
          status: PPE_DELIVERY_STATUS.APPROVED, // Auto-approve when admin creates
        };
        await props.onSubmit(createData);
      } else {
        await props.onSubmit(data as PpeDeliveryUpdateFormData);
      }
      navigate(routes.inventory.ppe.deliveries.root);
    } catch (error) {
      console.error("Error submitting form:", error);
    }
  };

  const handleError = (errors: Record<string, any>) => {
    console.error("PPE delivery form validation errors:", errors);
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
      <CardContent className="p-6">
        <Form {...form}>
          <form id="ppe-delivery-form" onSubmit={form.handleSubmit(handleSubmit, handleError)} className="space-y-6">
            {/* Hidden submit button for programmatic form submission */}
            <button type="submit" id="ppe-delivery-form-submit" className="hidden" aria-hidden="true" />
              {/* User, Item and Quantity Selection (only for create mode) */}
              {canEditItemAndUser && (
                <div className="grid grid-cols-1 md:grid-cols-[1.5fr,2.5fr,150px] gap-4">
                  <FormField
                    control={form.control}
                    name="userId"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="flex items-center gap-2">
                          <IconUser className="h-4 w-4" />
                          Funcionário <span className="text-destructive">*</span>
                        </FormLabel>
                        <FormControl>
                          <UserSelectorDropdown
                            value={field.value}
                            onChange={(value) => {
                              field.onChange(value);
                              setSelectedUserId(value);
                              // Clear item selection when user changes
                              form.setValue("itemId", "");
                            }}
                            placeholder="Selecione o funcionário"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="itemId"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="flex items-center gap-2">
                          <IconPackage className="h-4 w-4" />
                          EPI <span className="text-destructive">*</span>
                        </FormLabel>
                        <FormControl>
                          <ItemSelectorDropdown value={field.value} onChange={field.onChange} placeholder="Selecione o EPI" userId={selectedUserId} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

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
                            onChange={(e) => {
                              const value = parseInt(e.target.value);
                              if (isNaN(value) || value < 1) {
                                field.onChange(1);
                              } else if (value > 999) {
                                field.onChange(999);
                              } else {
                                field.onChange(value);
                              }
                            }}
                            placeholder="Quantidade"
                            className="bg-transparent"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
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
                          onChange={(e) => {
                            const value = parseInt(e.target.value);
                            if (isNaN(value) || value < 1) {
                              field.onChange(1);
                            } else if (value > 999) {
                              field.onChange(999);
                            } else {
                              field.onChange(value);
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
                            <option value={PPE_DELIVERY_STATUS.PENDING}>{PPE_DELIVERY_STATUS_LABELS[PPE_DELIVERY_STATUS.PENDING]}</option>
                            <option value={PPE_DELIVERY_STATUS.APPROVED}>{PPE_DELIVERY_STATUS_LABELS[PPE_DELIVERY_STATUS.APPROVED]}</option>
                            <option value={PPE_DELIVERY_STATUS.DELIVERED}>{PPE_DELIVERY_STATUS_LABELS[PPE_DELIVERY_STATUS.DELIVERED]}</option>
                            <option value={PPE_DELIVERY_STATUS.REPROVED}>{PPE_DELIVERY_STATUS_LABELS[PPE_DELIVERY_STATUS.REPROVED]}</option>
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
