import React, { useEffect, useMemo } from "react";
import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";

import { Form } from "@/components/ui/form";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { IconPlus, IconTrash } from "@tabler/icons-react";
import { maintenanceScheduleCreateSchema, maintenanceScheduleUpdateSchema, type MaintenanceScheduleCreateFormData, type MaintenanceScheduleUpdateFormData } from "../../../../../schemas";
import { SCHEDULE_FREQUENCY, SCHEDULE_FREQUENCY_LABELS, WEEK_DAY_LABELS, MONTH_LABELS } from "../../../../../constants";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Combobox } from "@/components/ui/combobox";
import { FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { MaintenanceItemSelector } from "@/components/inventory/maintenance/form/item-selector";
import { cn } from "@/lib/utils";
import { DateTimeInput } from "@/components/ui/date-time-input";

interface BaseMaintenanceScheduleFormProps {
  isSubmitting?: boolean;
  onCancel?: () => void;
  onFormStateChange?: (formState: { isValid: boolean; isDirty: boolean }) => void;
}

interface CreateMaintenanceScheduleFormProps extends BaseMaintenanceScheduleFormProps {
  mode: "create";
  onSubmit: (data: MaintenanceScheduleCreateFormData) => Promise<void>;
  defaultValues?: Partial<MaintenanceScheduleCreateFormData>;
}

interface UpdateMaintenanceScheduleFormProps extends BaseMaintenanceScheduleFormProps {
  mode: "update";
  onSubmit: (data: MaintenanceScheduleUpdateFormData) => Promise<void>;
  defaultValues?: Partial<MaintenanceScheduleUpdateFormData>;
}

type MaintenanceScheduleFormProps = CreateMaintenanceScheduleFormProps | UpdateMaintenanceScheduleFormProps;

export function MaintenanceScheduleForm(props: MaintenanceScheduleFormProps) {
  const { isSubmitting, defaultValues, mode, onFormStateChange } = props;

  // Default values for create mode
  const createDefaults: MaintenanceScheduleCreateFormData = {
    name: "",
    description: "",
    frequency: SCHEDULE_FREQUENCY.MONTHLY,
    frequencyCount: 1,
    isActive: true,
    itemId: "", // Required field for item receiving maintenance
    maintenanceItemsConfig: [], // Optional - items needed for maintenance
    ...(mode === "create" && defaultValues ? defaultValues : {}),
  };

  // Create form with appropriate schema
  const form = useForm<MaintenanceScheduleCreateFormData | MaintenanceScheduleUpdateFormData>({
    resolver: zodResolver(mode === "create" ? maintenanceScheduleCreateSchema : maintenanceScheduleUpdateSchema),
    mode: "onBlur", // Validate on blur for better UX
    reValidateMode: "onChange", // Re-validate on change after first validation
    defaultValues: mode === "create" ? createDefaults : (((defaultValues as Partial<MaintenanceScheduleUpdateFormData>) || {}) as any),
  });

  // useFieldArray for maintenance items config
  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "maintenanceItemsConfig",
  });

  const watchFrequency = form.watch("frequency");

  // Group frequencies by their behavior for optimized rendering
  const frequencyGroups = useMemo(
    () => ({
      // Frequencies with customizable interval (shows frequencyCount field)
      withInterval: [SCHEDULE_FREQUENCY.WEEKLY, SCHEDULE_FREQUENCY.MONTHLY, SCHEDULE_FREQUENCY.ANNUAL],
      // Frequencies that need day of week
      needsDayOfWeek: [SCHEDULE_FREQUENCY.WEEKLY, SCHEDULE_FREQUENCY.BIWEEKLY],
      // Frequencies that need day of month
      needsDayOfMonth: [
        SCHEDULE_FREQUENCY.MONTHLY,
        SCHEDULE_FREQUENCY.BIMONTHLY,
        SCHEDULE_FREQUENCY.QUARTERLY,
        SCHEDULE_FREQUENCY.TRIANNUAL,
        SCHEDULE_FREQUENCY.QUADRIMESTRAL,
        SCHEDULE_FREQUENCY.SEMI_ANNUAL,
        SCHEDULE_FREQUENCY.ANNUAL,
      ],
      // Frequencies that need month
      needsMonth: [SCHEDULE_FREQUENCY.ANNUAL],
      // Frequencies that need specific date
      needsSpecificDate: [SCHEDULE_FREQUENCY.ONCE, SCHEDULE_FREQUENCY.CUSTOM],
      // Frequencies that need next run date
      needsNextRun: [
        SCHEDULE_FREQUENCY.DAILY,
        SCHEDULE_FREQUENCY.WEEKLY,
        SCHEDULE_FREQUENCY.BIWEEKLY,
        SCHEDULE_FREQUENCY.MONTHLY,
        SCHEDULE_FREQUENCY.BIMONTHLY,
        SCHEDULE_FREQUENCY.QUARTERLY,
        SCHEDULE_FREQUENCY.TRIANNUAL,
        SCHEDULE_FREQUENCY.QUADRIMESTRAL,
        SCHEDULE_FREQUENCY.SEMI_ANNUAL,
        SCHEDULE_FREQUENCY.ANNUAL,
      ],
    }),
    [],
  );

  // Optimized frequency options based on common usage patterns
  const frequencyOptions = useMemo(() => {
    const commonFrequencies = [
      SCHEDULE_FREQUENCY.ONCE,
      SCHEDULE_FREQUENCY.DAILY,
      SCHEDULE_FREQUENCY.WEEKLY,
      SCHEDULE_FREQUENCY.MONTHLY,
      SCHEDULE_FREQUENCY.QUARTERLY,
      SCHEDULE_FREQUENCY.SEMI_ANNUAL,
      SCHEDULE_FREQUENCY.ANNUAL,
    ];

    return commonFrequencies.map((freq) => ({
      value: freq,
      label: SCHEDULE_FREQUENCY_LABELS[freq],
    }));
  }, []);


  const handleSubmit = async (data: any) => {
    try {
      if (mode === "create") {
        // Validate required fields for create mode
        if (!data.name?.trim()) {
          form.setError("name", { message: "Nome é obrigatório" });
          return;
        }

        // Validate frequency-specific requirements
        const frequency = data.frequency;
        if (frequency === SCHEDULE_FREQUENCY.ONCE && !data.specificDate) {
          form.setError("specificDate", { message: "Data específica é obrigatória para frequência 'Uma vez'" });
          return;
        }
        if (frequency === SCHEDULE_FREQUENCY.WEEKLY && !data.dayOfWeek) {
          form.setError("dayOfWeek", { message: "Dia da semana é obrigatório para frequência semanal" });
          return;
        }
        if (frequency === SCHEDULE_FREQUENCY.MONTHLY && !data.dayOfMonth) {
          form.setError("dayOfMonth", { message: "Dia do mês é obrigatório para frequência mensal" });
          return;
        }
        if (frequency === SCHEDULE_FREQUENCY.ANNUAL && (!data.dayOfMonth || !data.month)) {
          if (!data.dayOfMonth) {
            form.setError("dayOfMonth", { message: "Dia do mês é obrigatório para frequência anual" });
          }
          if (!data.month) {
            form.setError("month", { message: "Mês é obrigatório para frequência anual" });
          }
          return;
        }

        // Filter out empty items (maintenanceItemsConfig is optional)
        const validItems = data.maintenanceItemsConfig?.filter((item: any) => item.itemId && item.quantity > 0) || [];

        // Clean up data for submission
        const processedData: MaintenanceScheduleCreateFormData = {
          ...data,
          name: data.name.trim(),
          description: data.description?.trim() || undefined,
          maintenanceItemsConfig: validItems,
        };

        await (props as CreateMaintenanceScheduleFormProps).onSubmit(processedData);
      } else {
        // Clean up data for update
        const processedData: MaintenanceScheduleUpdateFormData = {
          ...data,
          name: data.name?.trim(),
          description: data.description?.trim() || undefined,
        };

        await (props as UpdateMaintenanceScheduleFormProps).onSubmit(processedData);
      }
    } catch (error) {
      console.error("Form submission error:", error);
      // Error handling done by parent component
    }
  };

  // Log validation errors for debugging
  React.useEffect(() => {
    const errors = form.formState.errors;
    if (Object.keys(errors).length > 0) {
      // Also log if submit was attempted
      if (form.formState.isSubmitted) {
      }
    }
  }, [form.formState.errors, form.formState.isSubmitted]);

  // Track form state changes for submit button
  useEffect(() => {
    if (onFormStateChange) {
      onFormStateChange({
        isValid: form.formState.isValid,
        isDirty: form.formState.isDirty,
      });
    }
  }, [form.formState.isValid, form.formState.isDirty, onFormStateChange]);

  const isRequired = mode === "create";

  return (
    <Card className="h-full flex flex-col shadow-sm border border-border overflow-hidden">
      <div className="flex-1 overflow-y-auto p-6">
        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6">
            {/* Hidden submit button for programmatic form submission */}
            <button type="submit" id="maintenance-schedule-form-submit" className="hidden" aria-hidden="true" />

            {/* Basic Information & Item Selection */}
            <Card>
              <CardHeader>
                <CardTitle>Informações Básicas</CardTitle>
                <CardDescription>Identificação e item para agendamento de manutenção</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Nome do Agendamento {isRequired && <span className="text-destructive">*</span>}</FormLabel>
                        <FormControl>
                          <Input
                            value={field.value}
                            onChange={field.onChange}
                            onBlur={field.onBlur}
                            name={field.name}
                            ref={field.ref}
                            placeholder="Ex: Manutenção Preventiva Mensal"
                            disabled={isSubmitting}
                            className="bg-transparent"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <MaintenanceItemSelector control={form.control} disabled={isSubmitting} fieldName="itemId" required={isRequired} label="Item para Manutenção" />
                </div>

                <FormField
                  control={form.control}
                  name="description"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Descrição</FormLabel>
                      <FormControl>
                        <Textarea
                          value={field.value}
                          onChange={field.onChange}
                          onBlur={field.onBlur}
                          name={field.name}
                          ref={field.ref}
                          placeholder="Descreva os procedimentos de manutenção..."
                          className="resize-none"
                          rows={3}
                          disabled={isSubmitting}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </CardContent>
            </Card>

            {/* Schedule Configuration */}
            <Card>
              <CardHeader>
                <CardTitle>Configuração de Agendamento</CardTitle>
                <CardDescription>Configure a frequência e período da manutenção</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="frequency"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Frequência {isRequired && <span className="text-destructive">*</span>}</FormLabel>
                        <FormControl>
                          <Combobox
                            value={field.value}
                            onValueChange={field.onChange}
                            disabled={isSubmitting}
                            options={frequencyOptions}
                            placeholder="Selecione a frequência"
                            searchable={false}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {/* Show interval field only for frequencies that support it */}
                  {watchFrequency && frequencyGroups.withInterval.includes(watchFrequency) && (
                    <FormField
                      control={form.control}
                      name="frequencyCount"
                      render={({ field }) => {
                        const getIntervalLabel = () => {
                          switch (watchFrequency) {
                            case SCHEDULE_FREQUENCY.WEEKLY:
                              return "Intervalo (semanas)";
                            case SCHEDULE_FREQUENCY.MONTHLY:
                              return "Intervalo (meses)";
                            case SCHEDULE_FREQUENCY.ANNUAL:
                              return "Intervalo (anos)";
                            default:
                              return "Intervalo";
                          }
                        };

                        return (
                          <FormItem>
                            <FormLabel>{getIntervalLabel()}</FormLabel>
                            <FormControl>
                              <Input
                                type="number"
                                min={1}
                                placeholder="1"
                                disabled={isSubmitting}
                                className="bg-transparent"
                                {...field}
                                onChange={(value) => field.onChange(typeof value === "number" ? value : parseInt(String(value)) || 1)}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        );
                      }}
                    />
                  )}
                </div>

                {/* Frequency-specific fields */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Specific date field (for ONCE and CUSTOM frequencies) */}
                  {watchFrequency && frequencyGroups.needsSpecificDate.includes(watchFrequency) && (
                    <FormField
                      control={form.control}
                      name="specificDate"
                      render={({ field }) => (
                        <FormItem className="flex flex-col md:col-span-2">
                          <FormLabel>
                            {watchFrequency === SCHEDULE_FREQUENCY.ONCE ? "Data da Manutenção" : "Próxima Execução"}
                            {isRequired && <span className="text-destructive">*</span>}
                          </FormLabel>
                          <DateTimeInput
                            field={field}
                            hideLabel
                            placeholder="Selecione a data"
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
                  )}

                  {/* Day of week field (for WEEKLY and BIWEEKLY) */}
                  {watchFrequency && frequencyGroups.needsDayOfWeek.includes(watchFrequency) && (
                    <FormField
                      control={form.control}
                      name="dayOfWeek"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Dia da Semana {isRequired && <span className="text-destructive">*</span>}</FormLabel>
                          <FormControl>
                            <Combobox
                              value={field.value || undefined}
                              onValueChange={field.onChange}
                              disabled={isSubmitting}
                              options={Object.entries(WEEK_DAY_LABELS).map(([value, label]) => ({ value, label }))}
                              placeholder="Selecione o dia da semana"
                              searchable={false}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  )}

                  {/* Month field (for ANNUAL only) */}
                  {watchFrequency && frequencyGroups.needsMonth.includes(watchFrequency) && (
                    <FormField
                      control={form.control}
                      name="month"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Mês {isRequired && <span className="text-destructive">*</span>}</FormLabel>
                          <FormControl>
                            <Combobox
                              value={field.value || undefined}
                              onValueChange={field.onChange}
                              disabled={isSubmitting}
                              options={Object.entries(MONTH_LABELS).map(([value, label]) => ({ value, label }))}
                              placeholder="Selecione o mês"
                              searchable={false}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  )}

                  {/* Day of month field (for monthly/quarterly/annual frequencies) */}
                  {watchFrequency && frequencyGroups.needsDayOfMonth.includes(watchFrequency) && (
                    <FormField
                      control={form.control}
                      name="dayOfMonth"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Dia do Mês {isRequired && <span className="text-destructive">*</span>}</FormLabel>
                          <FormControl>
                            <Input
                              type="number"
                              min={1}
                              max={31}
                              placeholder="1-31"
                              disabled={isSubmitting}
                              className="bg-transparent"
                              {...field}
                              value={field.value ?? ""}
                              onChange={(value) => field.onChange(typeof value === "number" ? value : parseInt(String(value)) || undefined)}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  )}

                  {/* Next run date field (for all except ONCE and CUSTOM) */}
                  {watchFrequency && frequencyGroups.needsNextRun.includes(watchFrequency) && (
                    <FormField
                      control={form.control}
                      name="nextRun"
                      render={({ field }) => (
                        <FormItem
                          className={cn("flex flex-col", {
                            "md:col-span-2":
                              !frequencyGroups.needsDayOfWeek.includes(watchFrequency) &&
                              !frequencyGroups.needsDayOfMonth.includes(watchFrequency) &&
                              !frequencyGroups.needsMonth.includes(watchFrequency),
                          })}
                        >
                          <FormLabel>Primeira Execução</FormLabel>
                          <DateTimeInput
                            field={field}
                            hideLabel
                            placeholder="Data de início"
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
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Items Needed Configuration */}
            <Card>
              <CardHeader>
                <CardTitle>Itens Necessários</CardTitle>
                <CardDescription>Itens utilizados em cada manutenção (opcional)</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {fields.map((field, index) => (
                  <div key={field.id} className="flex gap-4 items-end">
                    <div className="flex-1">
                      <MaintenanceItemSelector
                        control={form.control}
                        fieldName={`maintenanceItemsConfig.${index}.itemId`}
                        disabled={isSubmitting}
                        required={false}
                        label={index === 0 ? "Item" : undefined}
                      />
                    </div>
                    <FormField
                      control={form.control}
                      name={`maintenanceItemsConfig.${index}.quantity`}
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
                        onClick={() => remove(index)}
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
      </div>
    </Card>
  );
}
