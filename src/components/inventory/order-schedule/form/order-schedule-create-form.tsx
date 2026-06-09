import { useState, useCallback, useMemo, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useNavigate } from "react-router-dom";
import {
  IconLoader2,
  IconArrowLeft,
  IconArrowRight,
  IconCheck,
  IconCalendarRepeat,
  IconSettings,
  IconPackage,
  IconEye,
  IconFileText,
  IconNotes,
  IconTruck,
} from "@tabler/icons-react";
import type { OrderScheduleCreateFormData } from "../../../../schemas";
import { orderScheduleCreateSchema } from "../../../../schemas";
import { useOrderScheduleMutations, useSuppliers } from "../../../../hooks";
import { SupplierLogoDisplay } from "@/components/ui/avatar-display";
import { routes, FAVORITE_PAGES, SCHEDULE_FREQUENCY, SCHEDULE_FREQUENCY_LABELS, WEEK_DAY_LABELS, MONTH_LABELS, MONTH_OCCURRENCE_LABELS, WEEK_DAY, MONTH } from "../../../../constants";
import { toast } from "@/components/ui/sonner";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { PageHeader } from "@/components/ui/page-header";
import { FormSteps } from "@/components/ui/form-steps";
import { Combobox } from "@/components/ui/combobox";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { ItemSelectorTable } from "../../common/item-selector/item-selector-table";
import { ReviewItemsTable } from "./review-items-table";
import { DateTimeInput } from "@/components/ui/date-time-input";

export const OrderScheduleCreateForm = () => {
  const navigate = useNavigate();
  const [currentStep, setCurrentStep] = useState(1);
  const { createMutation } = useOrderScheduleMutations();

  const steps = [
    {
      id: 1,
      name: "Configuração Geral",
      description: "Frequência e cronograma",
    },
    {
      id: 2,
      name: "Seleção de Itens",
      description: "Escolha os itens",
    },
    {
      id: 3,
      name: "Revisão",
      description: "Confirme os dados",
    },
  ];

  const form = useForm<OrderScheduleCreateFormData>({
    resolver: zodResolver(orderScheduleCreateSchema),
    defaultValues: {
      frequency: "MONTHLY",
      frequencyCount: 1,
      isActive: true,
      items: [],
    },
    mode: "onTouched",
    reValidateMode: "onChange",
  });

  // Suppliers for the optional target-supplier selector (propagated to generated orders).
  const { data: suppliersResponse } = useSuppliers({
    orderBy: { fantasyName: "asc" },
    take: 100,
    include: { logo: true },
  });
  const suppliers = suppliersResponse?.data || [];

  // Item selection state for ItemSelectorTable (uses Set<string>)
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());

  // Sync selected items with form
  useEffect(() => {
    form.setValue("items", Array.from(selectedItems));
  }, [selectedItems, form]);

  // Handle single item selection (toggle)
  const handleSelectItem = useCallback((itemId: string) => {
    setSelectedItems((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(itemId)) {
        newSet.delete(itemId);
      } else {
        newSet.add(itemId);
      }
      return newSet;
    });
  }, []);

  // Handle batch selection (itemData is ignored for order schedule - no quantities/prices needed)
  const handleBatchSelectItems = useCallback((itemIds: string[], _itemData?: Record<string, { quantity?: number; price?: number; icms?: number; ipi?: number }>) => {
    setSelectedItems((prev) => {
      const newSet = new Set(prev);
      // Check if all items are already selected
      const allSelected = itemIds.every((id) => newSet.has(id));
      if (allSelected) {
        // Deselect all
        itemIds.forEach((id) => newSet.delete(id));
      } else {
        // Select all
        itemIds.forEach((id) => newSet.add(id));
      }
      return newSet;
    });
  }, []);

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
      SCHEDULE_FREQUENCY.BIWEEKLY,
      SCHEDULE_FREQUENCY.MONTHLY,
      SCHEDULE_FREQUENCY.BIMONTHLY,
      SCHEDULE_FREQUENCY.QUARTERLY,
      SCHEDULE_FREQUENCY.TRIANNUAL,
      SCHEDULE_FREQUENCY.QUADRIMESTRAL,
      SCHEDULE_FREQUENCY.SEMI_ANNUAL,
      SCHEDULE_FREQUENCY.ANNUAL,
      SCHEDULE_FREQUENCY.CUSTOM,
    ];

    return commonFrequencies.map((freq) => ({
      value: freq,
      label: SCHEDULE_FREQUENCY_LABELS[freq] || freq,
    }));
  }, []);

  const validateCurrentStep = useCallback(async (): Promise<boolean> => {
    switch (currentStep) {
      case 1: {
        // Validate the base fields first.
        const baseValid = await form.trigger(["frequency", "frequencyCount"]);

        // Then enforce the frequency-specific fields here (instead of only at submit
        // via the schema refine, which surfaces a vague message on `frequency`).
        // Set a field-level error on the actually-missing field so the user is told
        // exactly what to fill in before advancing.
        const freq = form.getValues("frequency") as SCHEDULE_FREQUENCY | undefined;
        const v = form.getValues();
        let specificValid = true;

        const requireField = (name: any, present: boolean, message: string) => {
          if (!present) {
            form.setError(name, { type: "manual", message });
            specificValid = false;
          }
        };

        if (freq && frequencyGroups.needsDayOfWeek.includes(freq)) {
          requireField("dayOfWeek", !!v.dayOfWeek, "Selecione o dia da semana");
        }
        if (freq && frequencyGroups.needsDayOfMonth.includes(freq)) {
          if (freq === SCHEDULE_FREQUENCY.ANNUAL) {
            requireField("dayOfMonth", !!v.dayOfMonth, "Informe o dia do mês");
          } else {
            // Accept EITHER a fixed day-of-month OR a complete positional pair
            // (occurrence + dayOfWeek). The two are mutually exclusive in the UI.
            const hasFixed = v.dayOfMonth != null && String(v.dayOfMonth) !== "";
            const hasOccurrence = !!v.monthlySchedule?.occurrence;
            const hasPosDayOfWeek = !!v.monthlySchedule?.dayOfWeek;
            const hasAnyPositional = hasOccurrence || hasPosDayOfWeek;
            if (!hasFixed && !hasAnyPositional) {
              requireField("dayOfMonth", false, "Informe o dia do mês ou a ocorrência + dia da semana");
            } else if (hasAnyPositional && !(hasOccurrence && hasPosDayOfWeek)) {
              // Positional partially filled — require both halves.
              requireField("monthlySchedule.occurrence", hasOccurrence, "Selecione a ocorrência");
              requireField("monthlySchedule.dayOfWeek", hasPosDayOfWeek, "Selecione o dia da semana");
            }
          }
        }
        if (freq && frequencyGroups.needsMonth.includes(freq)) {
          requireField("month", !!v.month, "Selecione o mês");
        }
        if (freq && frequencyGroups.needsSpecificDate.includes(freq)) {
          requireField("specificDate", !!v.specificDate, "Selecione a data");
        }

        if (!baseValid || !specificValid) {
          toast.error("Por favor, configure o cronograma corretamente");
          return false;
        }
        return true;
      }

      case 2:
        const items = form.getValues("items");
        if (!items || items.length === 0) {
          toast.error("Pelo menos um item deve ser selecionado");
          return false;
        }
        return true;

      case 3:
        return true;

      default:
        return true;
    }
  }, [currentStep, form, frequencyGroups]);

  const nextStep = useCallback(() => {
    if (currentStep < steps.length) {
      setCurrentStep(currentStep + 1);
    }
  }, [currentStep, steps.length]);

  const prevStep = useCallback(() => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    }
  }, [currentStep]);

  const handleNext = useCallback(async () => {
    const isValid = await validateCurrentStep();
    if (isValid) {
      nextStep();
    }
  }, [validateCurrentStep, nextStep]);

  const handleSubmit = useCallback(async () => {
    try {
      const isValid = await validateCurrentStep();
      if (!isValid) return;

      const formData = form.getValues();

      // Normalize the monthly config so the payload carries exactly one branch:
      // a fixed dayOfMonth XOR a positional monthlySchedule (occurrence + dayOfWeek).
      // The UI enforces mutual exclusion, but guard the payload regardless.
      const fixedFilled = formData.dayOfMonth != null && String(formData.dayOfMonth) !== "";
      const positionalFilled = !!formData.monthlySchedule?.occurrence || !!formData.monthlySchedule?.dayOfWeek;
      if (fixedFilled) {
        formData.monthlySchedule = undefined as any;
      } else if (positionalFilled) {
        formData.dayOfMonth = undefined as any;
      }

      await createMutation.mutateAsync(formData);

      // Success notification is handled by the API client
      setTimeout(() => {
        navigate(routes.inventory.orders.schedules.root);
      }, 1500);
    } catch (error) {
      if (process.env.NODE_ENV !== "production") {
        console.error("Submission error:", error);
      }
    }
  }, [validateCurrentStep, form, createMutation, navigate]);

  const handleCancel = useCallback(() => {
    navigate(routes.inventory.orders.schedules.root);
  }, [navigate]);

  const isLastStep = currentStep === 3;
  const isFirstStep = currentStep === 1;
  const isSubmitting = createMutation.isPending;

  // Navigation actions
  const navigationActions = [];

  navigationActions.push({
    key: "cancel",
    label: "Cancelar",
    onClick: handleCancel,
    variant: "outline" as const,
    disabled: isSubmitting,
  });

  if (!isFirstStep) {
    navigationActions.push({
      key: "previous",
      label: "Anterior",
      icon: IconArrowLeft,
      onClick: prevStep,
      variant: "outline" as const,
      disabled: isSubmitting,
    });
  }

  if (!isLastStep) {
    navigationActions.push({
      key: "next",
      label: "Próximo",
      icon: IconArrowRight,
      onClick: handleNext,
      variant: "default" as const,
      disabled: isSubmitting,
      iconPosition: "right" as const,
    });
  } else {
    navigationActions.push({
      key: "submit",
      label: "Cadastrar",
      icon: isSubmitting ? IconLoader2 : IconCheck,
      onClick: handleSubmit,
      variant: "default" as const,
      disabled: isSubmitting,
      loading: isSubmitting,
    });
  }

  const watchedItems = form.watch("items") || [];
  const watchedName = form.watch("name");
  const watchedDescription = form.watch("description");
  const watchedFrequency = form.watch("frequency");
  const watchedFrequencyCount = form.watch("frequencyCount");
  const watchedDayOfWeek = form.watch("dayOfWeek");
  const watchedDayOfMonth = form.watch("dayOfMonth");
  const watchedMonth = form.watch("month");
  const watchedSpecificDate = form.watch("specificDate");
  const watchedNextRun = form.watch("nextRun");
  const watchedMonthlySchedule = form.watch("monthlySchedule");

  // Mutual-exclusion flags for the monthly day config: a filled fixed day greys out
  // the positional pair and vice-versa. Reactive via the watched values above.
  const fixedFilled = watchedDayOfMonth != null && String(watchedDayOfMonth) !== "";
  const positionalFilled = !!watchedMonthlySchedule?.occurrence || !!watchedMonthlySchedule?.dayOfWeek;

  return (
    <div className="h-full flex flex-col gap-4 bg-background px-4 pt-4 pb-4">
      <PageHeader
        className="flex-shrink-0"
        title="Criar Agendamento de Pedido"
        icon={IconCalendarRepeat}
        favoritePage={FAVORITE_PAGES.ESTOQUE_PEDIDOS_AGENDAMENTOS_CADASTRAR}
        breadcrumbs={[
          { label: "Início", href: routes.home },
          { label: "Estoque", href: routes.inventory.root },
          { label: "Pedidos", href: routes.inventory.orders.root },
          { label: "Agendamentos", href: routes.inventory.orders.schedules.root },
          { label: "Cadastrar" },
        ]}
        actions={navigationActions}
      />

      <Card className="flex-1 min-h-0 flex flex-col shadow-sm border border-border">
        <CardContent className="flex-1 flex flex-col p-4 overflow-hidden min-h-0">
          <Form {...form}>
            <form className="flex flex-col h-full" onSubmit={(e) => e.preventDefault()}>
              {/* Step Indicator */}
              <div className="flex-shrink-0 mb-6">
                <FormSteps steps={steps} currentStep={currentStep} />
              </div>

              {/* Step Content */}
              <div className={cn("flex-1 min-h-0", currentStep === 2 ? "flex flex-col overflow-hidden" : "overflow-y-auto")}>
                {/* Step 1: General Configuration */}
                {currentStep === 1 && (
                  <div className="space-y-4">
                    <Card className="w-full shadow-sm border border-border">
                      <CardHeader className="pb-4">
                        <CardTitle className="text-base flex items-center gap-2">
                          <IconSettings className="h-4 w-4" />
                          Configuração do Agendamento
                        </CardTitle>
                        <CardDescription>Defina a frequência e período de execução</CardDescription>
                      </CardHeader>
                      <CardContent className="space-y-4">
                          {/* Name and Description */}
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <FormField
                              control={form.control}
                              name="name"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel className="flex items-center gap-2">
                                    <IconFileText className="h-4 w-4" />
                                    Nome do Agendamento
                                  </FormLabel>
                                  <FormControl>
                                    <Input
                                      placeholder="Ex: Pedido semanal de materiais"
                                      disabled={isSubmitting}
                                      transparent
                                      {...field}
                                      value={field.value || ""}
                                    />
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                            <FormField
                              control={form.control}
                              name="description"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel className="flex items-center gap-2">
                                    <IconNotes className="h-4 w-4" />
                                    Descrição
                                  </FormLabel>
                                  <FormControl>
                                    <Textarea
                                      placeholder="Descrição opcional do agendamento"
                                      disabled={isSubmitting}
                                      className="resize-none h-10 min-h-[40px]"
                                      {...field}
                                      value={field.value || ""}
                                    />
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                          </div>

                          {/* Target supplier — optional; propagated to every order this
                              schedule generates. */}
                          <FormField
                            control={form.control}
                            name="supplierId"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel className="flex items-center gap-2">
                                  <IconTruck className="h-4 w-4" />
                                  Fornecedor
                                </FormLabel>
                                <FormControl>
                                  <Combobox
                                    value={field.value || ""}
                                    onValueChange={(value) => {
                                      const stringValue = Array.isArray(value) ? value[0] : value;
                                      field.onChange(stringValue || null);
                                    }}
                                    options={suppliers.map((supplier) => ({
                                      value: supplier.id,
                                      label: supplier.fantasyName,
                                      logo: supplier.logo,
                                    }))}
                                    placeholder="Selecione um fornecedor (opcional)"
                                    emptyText="Nenhum fornecedor encontrado"
                                    disabled={isSubmitting}
                                    className="h-10 w-full"
                                    renderOption={(option, _isSelected) => (
                                      <div className="flex items-center gap-3 w-full">
                                        <SupplierLogoDisplay
                                          logo={(option as any).logo}
                                          supplierName={option.label}
                                          size="sm"
                                          shape="rounded"
                                          className="flex-shrink-0"
                                        />
                                        <div className="flex flex-col gap-1 min-w-0 flex-1">
                                          <div className="font-medium truncate">{option.label}</div>
                                        </div>
                                      </div>
                                    )}
                                  />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />

                          {/* Frequency Configuration — one full-width row; fields flex-fill
                              evenly on desktop and wrap only on narrow screens. */}
                          <div className="flex flex-wrap gap-4 items-start">
                                <FormField
                                  control={form.control}
                                  name="frequency"
                                  render={({ field }) => (
                                    <FormItem className="flex-1 min-w-[150px]">
                                      <FormLabel>Frequência <span className="text-destructive">*</span></FormLabel>
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
                                {watchedFrequency && frequencyGroups.withInterval.includes(watchedFrequency as SCHEDULE_FREQUENCY) && (
                                  <FormField
                                    control={form.control}
                                    name="frequencyCount"
                                    render={({ field }) => {
                                      const getIntervalLabel = () => {
                                        switch (watchedFrequency) {
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
                                        <FormItem className="flex-1 min-w-[150px]">
                                          <FormLabel>{getIntervalLabel()}</FormLabel>
                                          <FormControl>
                                            <Input
                                              type="number"
                                              min={1}
                                              placeholder="1"
                                              disabled={isSubmitting}
                                              className="bg-transparent"
                                              ref={field.ref}
                                              value={field.value}
                                              onChange={(value) => field.onChange(typeof value === 'number' ? value : parseInt(String(value)) || 1)}
                                              onBlur={field.onBlur}
                                            />
                                          </FormControl>
                                          <FormMessage />
                                        </FormItem>
                                      );
                                    }}
                                  />
                                )}

                                {/* Specific date field (for ONCE and CUSTOM frequencies) */}
                                {watchedFrequency && frequencyGroups.needsSpecificDate.includes(watchedFrequency as SCHEDULE_FREQUENCY) && (
                                  <FormField
                                    control={form.control}
                                    name="specificDate"
                                    render={({ field }) => (
                                      <FormItem className="flex flex-col flex-1 min-w-[150px]">
                                        <FormLabel>
                                          {watchedFrequency === SCHEDULE_FREQUENCY.ONCE ? "Data do Pedido" : "Próxima Execução"}
                                          <span className="text-destructive">*</span>
                                        </FormLabel>
                                        <DateTimeInput
                                          field={{
                                            onChange: (value) => field.onChange(value),
                                            onBlur: field.onBlur,
                                            value: field.value ? new Date(field.value) : null,
                                            name: field.name,
                                          }}
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
                                {watchedFrequency && frequencyGroups.needsDayOfWeek.includes(watchedFrequency as SCHEDULE_FREQUENCY) && (
                                  <FormField
                                    control={form.control}
                                    name="dayOfWeek"
                                    render={({ field }) => (
                                      <FormItem className="flex-1 min-w-[150px]">
                                        <FormLabel>Dia da Semana <span className="text-destructive">*</span></FormLabel>
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
                                {watchedFrequency && frequencyGroups.needsMonth.includes(watchedFrequency as SCHEDULE_FREQUENCY) && (
                                  <FormField
                                    control={form.control}
                                    name="month"
                                    render={({ field }) => (
                                      <FormItem className="flex-1 min-w-[150px]">
                                        <FormLabel>Mês <span className="text-destructive">*</span></FormLabel>
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

                                {/* Monthly day config — fixed day-of-month and the positional
                                    pair (occurrence + weekday) are shown together; filling one
                                    side disables the other (mutual exclusion). ANNUAL keeps only
                                    the fixed day-of-month (+ the Mês field above). */}
                                {watchedFrequency &&
                                  frequencyGroups.needsDayOfMonth.includes(watchedFrequency as SCHEDULE_FREQUENCY) && (
                                    <FormField
                                      control={form.control}
                                      name="dayOfMonth"
                                      render={({ field }) => (
                                        <FormItem className="flex-1 min-w-[150px]">
                                          <FormLabel>Dia do Mês <span className="text-destructive">*</span></FormLabel>
                                          <FormControl>
                                            <Input
                                              type="number"
                                              min={1}
                                              max={31}
                                              placeholder="1-31"
                                              disabled={isSubmitting || (watchedFrequency !== SCHEDULE_FREQUENCY.ANNUAL && positionalFilled)}
                                              className="bg-transparent"
                                              ref={field.ref}
                                              value={field.value ?? ""}
                                              onChange={(value) => field.onChange(typeof value === 'number' ? value : parseInt(String(value)) || undefined)}
                                              onBlur={field.onBlur}
                                            />
                                          </FormControl>
                                          <FormMessage />
                                        </FormItem>
                                      )}
                                    />
                                  )}

                                {watchedFrequency &&
                                  frequencyGroups.needsDayOfMonth.includes(watchedFrequency as SCHEDULE_FREQUENCY) &&
                                  watchedFrequency !== SCHEDULE_FREQUENCY.ANNUAL && (
                                    <>
                                      <FormField
                                        control={form.control}
                                        name="monthlySchedule.occurrence"
                                        render={({ field }) => (
                                          <FormItem className="flex-1 min-w-[150px]">
                                            <FormLabel>Ocorrência</FormLabel>
                                            <FormControl>
                                              <Combobox
                                                value={field.value || undefined}
                                                onValueChange={field.onChange}
                                                disabled={isSubmitting || fixedFilled}
                                                options={Object.entries(MONTH_OCCURRENCE_LABELS).map(([value, label]) => ({ value, label }))}
                                                placeholder="Primeira, Segunda…"
                                                searchable={false}
                                              />
                                            </FormControl>
                                            <FormMessage />
                                          </FormItem>
                                        )}
                                      />
                                      <FormField
                                        control={form.control}
                                        name="monthlySchedule.dayOfWeek"
                                        render={({ field }) => (
                                          <FormItem className="flex-1 min-w-[150px]">
                                            <FormLabel>Dia da Semana</FormLabel>
                                            <FormControl>
                                              <Combobox
                                                value={field.value || undefined}
                                                onValueChange={field.onChange}
                                                disabled={isSubmitting || fixedFilled}
                                                options={Object.entries(WEEK_DAY_LABELS).map(([value, label]) => ({ value, label }))}
                                                placeholder="Selecione o dia da semana"
                                                searchable={false}
                                              />
                                            </FormControl>
                                            <FormMessage />
                                          </FormItem>
                                        )}
                                      />
                                    </>
                                  )}

                                {/* Next run date field (for all except ONCE and CUSTOM) */}
                                {watchedFrequency && frequencyGroups.needsNextRun.includes(watchedFrequency as SCHEDULE_FREQUENCY) && (
                                  <FormField
                                    control={form.control}
                                    name="nextRun"
                                    render={({ field }) => (
                                      <FormItem className="flex flex-col flex-1 min-w-[150px]">
                                        <FormLabel>Primeira Execução</FormLabel>
                                        <DateTimeInput
                                          field={{
                                            onChange: (value) => field.onChange(value),
                                            onBlur: field.onBlur,
                                            value: field.value ? new Date(field.value) : null,
                                            name: field.name,
                                          }}
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

                          {/* Helper for the mutually-exclusive monthly day config. */}
                          {watchedFrequency &&
                            frequencyGroups.needsDayOfMonth.includes(watchedFrequency as SCHEDULE_FREQUENCY) &&
                            watchedFrequency !== SCHEDULE_FREQUENCY.ANNUAL && (
                              <p className="text-xs text-muted-foreground">
                                Informe o dia do mês OU a ocorrência + dia da semana.
                              </p>
                            )}
                      </CardContent>
                    </Card>
                  </div>
                )}

                {/* Step 2: Item Selection */}
                {currentStep === 2 && (
                  <ItemSelectorTable
                    selectedItems={selectedItems}
                    onSelectItem={handleSelectItem}
                    onSelectAll={() => {}}
                    onBatchSelectItems={handleBatchSelectItems}
                    editableColumns={{
                      showQuantityInput: false,
                      showPriceInput: false,
                      showIcmsInput: false,
                      showIpiInput: false,
                    }}
                    fixedColumnsConfig={{
                      fixedColumns: ['name'],
                      fixedReasons: {
                        name: 'Essencial para identificar o item',
                      },
                    }}
                    defaultColumns={[
                      'uniCode',
                      'name',
                      'brand.name',
                      'category.name',
                      'measures',
                      'price',
                      'quantity',
                      'reorderPoint',
                    ]}
                    storageKey="order-schedule-item-selector"
                    className="flex-1 min-h-0"
                  />
                )}

                {/* Step 3: Review */}
                {currentStep === 3 && (
                  <div className="space-y-4">
                    <Card className="w-full shadow-sm border border-border">
                      <CardHeader className="pb-4">
                        <CardTitle className="text-base flex items-center gap-2">
                          <IconEye className="h-4 w-4" />
                          Revisão do Agendamento
                        </CardTitle>
                        <CardDescription>Revise as informações antes de cadastrar</CardDescription>
                      </CardHeader>
                      <CardContent className="space-y-3">
                        {/* Name and Description */}
                        {watchedName && (
                          <div className="flex justify-between items-center bg-muted/50 rounded-lg px-4 py-3">
                            <span className="text-sm font-medium text-muted-foreground">Nome</span>
                            <span className="text-sm font-semibold text-foreground">{watchedName}</span>
                          </div>
                        )}

                        {watchedDescription && (
                          <div className="flex justify-between items-center bg-muted/50 rounded-lg px-4 py-3">
                            <span className="text-sm font-medium text-muted-foreground">Descrição</span>
                            <span className="text-sm font-semibold text-foreground">{watchedDescription}</span>
                          </div>
                        )}

                        {/* Schedule Information */}
                        <div className="flex justify-between items-center bg-muted/50 rounded-lg px-4 py-3">
                          <span className="text-sm font-medium text-muted-foreground">Frequência</span>
                          <span className="text-sm font-semibold text-foreground">
                            {SCHEDULE_FREQUENCY_LABELS[watchedFrequency as SCHEDULE_FREQUENCY] || watchedFrequency}
                            {watchedFrequencyCount && watchedFrequencyCount > 1 && ` - A cada ${watchedFrequencyCount}`}
                          </span>
                        </div>

                        {watchedDayOfWeek && (
                          <div className="flex justify-between items-center bg-muted/50 rounded-lg px-4 py-3">
                            <span className="text-sm font-medium text-muted-foreground">Dia da Semana</span>
                            <span className="text-sm font-semibold text-foreground">{WEEK_DAY_LABELS[watchedDayOfWeek as WEEK_DAY]}</span>
                          </div>
                        )}

                        {watchedDayOfMonth && (
                          <div className="flex justify-between items-center bg-muted/50 rounded-lg px-4 py-3">
                            <span className="text-sm font-medium text-muted-foreground">Dia do Mês</span>
                            <span className="text-sm font-semibold text-foreground">{watchedDayOfMonth}</span>
                          </div>
                        )}

                        {watchedMonthlySchedule?.occurrence && watchedMonthlySchedule?.dayOfWeek && (
                          <div className="flex justify-between items-center bg-muted/50 rounded-lg px-4 py-3">
                            <span className="text-sm font-medium text-muted-foreground">Dia no mês</span>
                            <span className="text-sm font-semibold text-foreground">
                              {(MONTH_OCCURRENCE_LABELS as any)[watchedMonthlySchedule.occurrence]}{" "}
                              {(WEEK_DAY_LABELS as any)[watchedMonthlySchedule.dayOfWeek]?.toLowerCase()}
                            </span>
                          </div>
                        )}

                        {watchedMonth && (
                          <div className="flex justify-between items-center bg-muted/50 rounded-lg px-4 py-3">
                            <span className="text-sm font-medium text-muted-foreground">Mês</span>
                            <span className="text-sm font-semibold text-foreground">{MONTH_LABELS[watchedMonth as MONTH]}</span>
                          </div>
                        )}

                        {watchedSpecificDate && (
                          <div className="flex justify-between items-center bg-muted/50 rounded-lg px-4 py-3">
                            <span className="text-sm font-medium text-muted-foreground">Data Específica</span>
                            <span className="text-sm font-semibold text-foreground">
                              {new Date(watchedSpecificDate).toLocaleDateString('pt-BR')}
                            </span>
                          </div>
                        )}

                        {watchedNextRun && (
                          <div className="flex justify-between items-center bg-muted/50 rounded-lg px-4 py-3">
                            <span className="text-sm font-medium text-muted-foreground">Primeira Execução</span>
                            <span className="text-sm font-semibold text-foreground">
                              {new Date(watchedNextRun).toLocaleDateString('pt-BR')}
                            </span>
                          </div>
                        )}

                        {/* Items Summary + table of the selected items */}
                        <div className="space-y-2">
                          <div className="flex justify-between items-center bg-primary/10 rounded-lg px-4 py-3 border border-primary/20">
                            <div className="flex items-center gap-2">
                              <IconPackage className="h-4 w-4 text-primary" />
                              <span className="text-sm font-medium text-muted-foreground">Itens Selecionados</span>
                            </div>
                            <span className="text-sm font-bold text-primary">{watchedItems.length}</span>
                          </div>
                          <ReviewItemsTable itemIds={watchedItems} />
                        </div>

                      </CardContent>
                    </Card>
                  </div>
                )}
              </div>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
};

export default OrderScheduleCreateForm;
