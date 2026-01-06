import React, { useEffect, useMemo } from "react";
import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { DETAIL_PAGE_SPACING } from "@/lib/layout-constants";
import { cn } from "@/lib/utils";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { IconPlus, IconTrash } from "@tabler/icons-react";
import { DateTimeInput } from "@/components/ui/date-time-input";
import { maintenanceCreateSchema, maintenanceUpdateSchema, type MaintenanceCreateFormData, type MaintenanceUpdateFormData } from "../../../../schemas";
import { MAINTENANCE_STATUS } from "../../../../constants";
import type { Maintenance, Item } from "../../../../types";
// Import form components
import { MaintenanceStatusSelector } from "./status-selector";
import { MaintenanceItemSelector } from "./item-selector";

interface BaseMaintenanceFormProps {
  isSubmitting?: boolean;
  onFormStateChange?: (formState: { isValid: boolean; isDirty: boolean }) => void;
  initialMaintenance?: Maintenance;
}

interface CreateMaintenanceFormProps extends BaseMaintenanceFormProps {
  mode: "create";
  onSubmit: (data: MaintenanceCreateFormData) => Promise<void>;
  defaultValues?: Partial<MaintenanceCreateFormData>;
}

interface UpdateMaintenanceFormProps extends BaseMaintenanceFormProps {
  mode: "update";
  onSubmit: (data: MaintenanceUpdateFormData) => Promise<void>;
  defaultValues?: Partial<MaintenanceUpdateFormData>;
}

type MaintenanceFormProps = CreateMaintenanceFormProps | UpdateMaintenanceFormProps;

export function MaintenanceForm(props: MaintenanceFormProps) {
  const { isSubmitting, defaultValues, mode, onFormStateChange, initialMaintenance } = props;

  // Extract item entities from initialMaintenance for the combobox initial options
  const mainItem = useMemo(() => {
    return initialMaintenance?.item;
  }, [initialMaintenance?.item]);

  // Extract items needed with their item entities
  const itemsNeededMap = useMemo(() => {
    if (!initialMaintenance?.itemsNeeded) return new Map<string, Item>();

    const map = new Map<string, Item>();
    initialMaintenance.itemsNeeded.forEach((maintenanceItem) => {
      if (maintenanceItem.item) {
        map.set(maintenanceItem.itemId, maintenanceItem.item);
      }
    });
    return map;
  }, [initialMaintenance?.itemsNeeded]);

  // Default values for create mode
  const createDefaults: MaintenanceCreateFormData = {
    name: "",
    description: undefined,
    status: MAINTENANCE_STATUS.PENDING,
    itemId: "",
    scheduledFor: undefined, // Initialize scheduledFor
    itemsNeeded: [],
    ...(defaultValues && Object.fromEntries(Object.entries(defaultValues).filter(([_, value]) => value !== null))),
  };

  // Ensure defaultValues has itemsNeeded as array for update mode
  const processedDefaultValues =
    mode === "update" && defaultValues
      ? {
          ...defaultValues,
          // Note: itemsNeeded is not part of update schema, it's handled separately
        }
      : defaultValues;

  // Create form with unified type but conditional schema
  type FormData = MaintenanceCreateFormData | MaintenanceUpdateFormData;

  const form = useForm<FormData>({
    resolver: mode === "create" ? zodResolver(maintenanceCreateSchema) : zodResolver(maintenanceUpdateSchema),
    mode: "onBlur", // Validate on blur for better UX
    reValidateMode: "onChange", // Re-validate on change after first validation
    defaultValues: mode === "create" ? createDefaults : (processedDefaultValues as FormData),
  });

  // useFieldArray for maintenance items (only in create mode)
  const { fields, append, remove } = mode === "create"
    ? useFieldArray({
        control: form.control as any,
        name: "itemsNeeded",
      })
    : { fields: [], append: () => {}, remove: () => {} };

  // Don't auto-add items - allow empty items array for cleanup-only maintenance
  // React.useEffect(() => {
  //   if (mode === "create" && fields.length === 0) {
  //     append({ itemId: "", quantity: 1 });
  //   }
  // }, [mode, fields.length, append]);

  // Watch required fields for custom validation
  const watchName = form.watch("name");
  const watchItemId = form.watch("itemId");
  const watchScheduledFor = form.watch("scheduledFor");

  // Custom validation check for enabling submit button without triggering schema errors
  const checkRequiredFields = useMemo(() => {
    if (mode !== "create") return true; // For update mode, always allow submit

    // Check all required fields
    return !!(watchName?.trim() && watchItemId && watchScheduledFor);
  }, [mode, watchName, watchItemId, watchScheduledFor]);

  // Track form state changes for submit button
  useEffect(() => {
    if (onFormStateChange) {
      onFormStateChange({
        isValid: checkRequiredFields,
        isDirty: form.formState.isDirty,
      });
    }
  }, [checkRequiredFields, form.formState.isDirty, onFormStateChange]);

  const handleSubmit = async (data: any) => {
    try {
      if (mode === "create") {
        const createData = data;
        // Process data to ensure correct types for create
        const processedData: MaintenanceCreateFormData = {
          ...createData,
          name: createData.name.trim(),
          description: createData.description?.trim() || undefined,
          // Filter out empty or invalid items from itemsNeeded
          itemsNeeded: (createData.itemsNeeded || [])
            .filter((item: any) => item?.itemId && item.itemId.trim() !== "" && item?.quantity > 0)
            .map((item: any) => ({
              itemId: item.itemId.trim(),
              quantity: item.quantity,
            })),
        };
        await (props as CreateMaintenanceFormProps).onSubmit(processedData);
      } else {
        const updateData = data as MaintenanceUpdateFormData;
        // Clean up data for update
        const processedUpdateData: MaintenanceUpdateFormData = {
          ...updateData,
          name: updateData.name?.trim(),
          description: updateData.description?.trim() || undefined,
        };
        await (props as UpdateMaintenanceFormProps).onSubmit(processedUpdateData);
      }
    } catch (error) {
      // Error handling done by parent component
    }
  };

  const isRequired = mode === "create";

  return (
    <Form {...form}>
      <form id="maintenance-form" onSubmit={form.handleSubmit(handleSubmit)}>
        {/* Hidden submit button for programmatic form submission */}
        <button id="maintenance-form-submit" type="submit" className="hidden">
          Submit
        </button>

        <div className="space-y-4">
          {/* Basic Information & Item Selection */}
          <Card>
              <CardHeader>
                <CardTitle>Informações Básicas</CardTitle>
                <CardDescription>Identificação, item e agendamento da manutenção</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {/* Left Column: Name, Item, Date */}
                  <div className="space-y-4">
                    <FormField
                      control={form.control}
                      name="name"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className={isRequired ? "after:content-['*'] after:ml-0.5 after:text-destructive" : ""}>Nome da Manutenção</FormLabel>
                          <FormControl>
                            <Input placeholder="Ex: Troca de óleo" disabled={isSubmitting} className="bg-transparent" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <MaintenanceItemSelector control={form.control} disabled={isSubmitting} fieldName="itemId" required={isRequired} label="Item para Manutenção" initialItem={mainItem} />

                    <FormField
                      control={form.control}
                      name="scheduledFor"
                      render={({ field }) => (
                        <FormItem className="flex flex-col">
                          <FormLabel className={isRequired ? "after:content-['*'] after:ml-0.5 after:text-destructive" : ""}>Data Agendada</FormLabel>
                          <DateTimeInput
                            field={field}
                            hideLabel
                            placeholder="Selecione uma data"
                            mode="date"
                            disabled={isSubmitting}
                            constraints={{
                              minDate: new Date(),
                            }}
                          />
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    {mode === "update" && <MaintenanceStatusSelector disabled={isSubmitting} />}
                  </div>

                  {/* Right Column: Description */}
                  <div className="space-y-4">
                    <FormField
                      control={form.control}
                      name="description"
                      render={({ field }) => (
                        <FormItem className="h-full flex flex-col">
                          <FormLabel>Descrição</FormLabel>
                          <FormControl className="flex-1">
                            <Textarea
                              placeholder="Descreva os procedimentos realizados..."
                              className="resize-none h-full min-h-[200px]"
                              disabled={isSubmitting}
                              {...field}
                              value={field.value || ""}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Items Needed */}
            <Card>
              <CardHeader>
                <CardTitle>Itens Necessários (Opcional)</CardTitle>
                <CardDescription>Itens utilizados na manutenção. Deixe vazio para manutenções de limpeza ou que não requerem materiais.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {fields.map((field, index) => {
                  // Get the itemId for this row to look up the initial item
                  const itemId = form.watch(`itemsNeeded.${index}.itemId` as any);
                  const initialItemForRow = itemId ? itemsNeededMap.get(itemId) : undefined;

                  return (
                    <div key={field.id} className="flex gap-4 items-end">
                      <div className="flex-1">
                        <MaintenanceItemSelector control={form.control} fieldName={`itemsNeeded.${index}.itemId`} disabled={isSubmitting} label={index === 0 ? "Item" : undefined} initialItem={initialItemForRow} />
                      </div>
                    <FormField
                      control={form.control}
                      name={`itemsNeeded.${index}.quantity`}
                      render={({ field }) => (
                        <FormItem className="w-72">
                          {index === 0 && <FormLabel>Quantidade</FormLabel>}
                          <FormControl>
                            <Input
                              type="number"
                              min={1}
                              placeholder="Quantidade"
                              disabled={isSubmitting}
                              className="bg-transparent"
                              {...field}
                              value={field.value || 1}
                              onChange={(e) => {
                                const value = parseInt(e.target.value);
                                field.onChange(isNaN(value) || value < 1 ? 1 : value);
                              }}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <div className="flex-shrink-0">
                      {index === 0 && <FormLabel className="block">&nbsp;</FormLabel>}
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => {
                          remove(index);
                          // Don't auto-add new item - allow empty array for cleanup-only maintenance
                        }}
                        disabled={isSubmitting}
                        className="h-10 w-8"
                      >
                        <IconTrash className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                  );
                })}

                <Button type="button" variant="outline" size="sm" onClick={() => append({ itemId: "", quantity: 1 })} disabled={isSubmitting} className="w-full">
                  <IconPlus className="h-4 w-4 mr-2" />
                  Adicionar Item
                </Button>
              </CardContent>
            </Card>
        </div>
      </form>
    </Form>
  );
}
