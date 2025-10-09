import React, { useEffect } from "react";
import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";

import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { IconPlus, IconTrash } from "@tabler/icons-react";
import { DateTimeInput } from "@/components/ui/date-time-input";
import { maintenanceCreateSchema, maintenanceUpdateSchema, type MaintenanceCreateFormData, type MaintenanceUpdateFormData } from "../../../../schemas";
import { MAINTENANCE_STATUS } from "../../../../constants";

// Import form components
import { MaintenanceStatusSelector } from "./status-selector";
import { MaintenanceItemSelector } from "./item-selector";

interface BaseMaintenanceFormProps {
  isSubmitting?: boolean;
  onFormStateChange?: (formState: { isValid: boolean; isDirty: boolean }) => void;
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
  const { isSubmitting, defaultValues, mode, onFormStateChange } = props;

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
    mode: "onChange",
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

  // Track form state changes for submit button
  useEffect(() => {
    if (onFormStateChange) {
      onFormStateChange({
        isValid: form.formState.isValid,
        isDirty: form.formState.isDirty,
      });
    }
  }, [form.formState.isValid, form.formState.isDirty, onFormStateChange]);

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
    <Card className="flex-1 min-h-0 flex flex-col shadow-sm border border-border">
      <CardContent className="flex-1 flex flex-col p-6 space-y-4 overflow-hidden min-h-0">
        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="flex-1 flex flex-col overflow-y-auto space-y-6">
            {/* Hidden submit button for programmatic form submission */}
            <button type="submit" id="maintenance-form-submit" className="hidden" aria-hidden="true" />

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
                            <Input placeholder="Ex: Troca de óleo" disabled={isSubmitting} {...field} value={field.value || ""} onChange={(e) => field.onChange(e.target.value)} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <MaintenanceItemSelector control={form.control} disabled={isSubmitting} fieldName="itemId" required={isRequired} label="Item para Manutenção" />

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
                {fields.map((field, index) => (
                  <div key={field.id} className="flex gap-4 items-end">
                    <div className="flex-1">
                      <MaintenanceItemSelector control={form.control} fieldName={`itemsNeeded.${index}.itemId`} disabled={isSubmitting} label={index === 0 ? "Item" : undefined} />
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
                ))}

                <Button type="button" variant="outline" size="sm" onClick={() => append({ itemId: "", quantity: 1 })} disabled={isSubmitting} className="w-full">
                  <IconPlus className="h-4 w-4 mr-2" />
                  Adicionar Item
                </Button>
              </CardContent>
            </Card>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}
