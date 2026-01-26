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
} from "@tabler/icons-react";
import type { OrderScheduleCreateFormData } from "../../../../schemas";
import { orderScheduleCreateSchema } from "../../../../schemas";
import { useOrderScheduleMutations } from "../../../../hooks";
import { routes, FAVORITE_PAGES, SCHEDULE_FREQUENCY, SCHEDULE_FREQUENCY_LABELS, WEEK_DAY_LABELS, MONTH_LABELS } from "../../../../constants";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { PageHeader } from "@/components/ui/page-header";
import { FormSteps } from "@/components/ui/form-steps";
import { Combobox } from "@/components/ui/combobox";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { ItemsSelector } from "./items-selector";
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
      case 1:
        const step1Valid = await form.trigger(["frequency", "frequencyCount"]);
        if (!step1Valid) {
          toast.error("Por favor, configure o cronograma corretamente");
          return false;
        }
        return true;

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
  }, [currentStep, form]);

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
  const watchedFrequency = form.watch("frequency");
  const watchedFrequencyCount = form.watch("frequencyCount");
  const watchedDayOfWeek = form.watch("dayOfWeek");
  const watchedDayOfMonth = form.watch("dayOfMonth");
  const watchedMonth = form.watch("month");
  const watchedSpecificDate = form.watch("specificDate");
  const watchedNextRun = form.watch("nextRun");

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
                          <div className="flex flex-wrap gap-4">
                                <FormField
                                  control={form.control}
                                  name="frequency"
                                  render={({ field }) => (
                                    <FormItem className="flex-1 min-w-[200px]">
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
                                {watchedFrequency && frequencyGroups.withInterval.includes(watchedFrequency) && (
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
                                {watchedFrequency && frequencyGroups.needsSpecificDate.includes(watchedFrequency) && (
                                  <FormField
                                    control={form.control}
                                    name="specificDate"
                                    render={({ field }) => (
                                      <FormItem className="flex flex-col flex-1 min-w-[200px]">
                                        <FormLabel>
                                          {watchedFrequency === SCHEDULE_FREQUENCY.ONCE ? "Data do Pedido" : "Próxima Execução"}
                                          <span className="text-destructive">*</span>
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
                                {watchedFrequency && frequencyGroups.needsDayOfWeek.includes(watchedFrequency) && (
                                  <FormField
                                    control={form.control}
                                    name="dayOfWeek"
                                    render={({ field }) => (
                                      <FormItem className="flex-1 min-w-[200px]">
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
                                {watchedFrequency && frequencyGroups.needsMonth.includes(watchedFrequency) && (
                                  <FormField
                                    control={form.control}
                                    name="month"
                                    render={({ field }) => (
                                      <FormItem className="flex-1 min-w-[200px]">
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

                                {/* Day of month field (for monthly/quarterly/annual frequencies) */}
                                {watchedFrequency && frequencyGroups.needsDayOfMonth.includes(watchedFrequency) && (
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
                                            disabled={isSubmitting}
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

                                {/* Next run date field (for all except ONCE and CUSTOM) */}
                                {watchedFrequency && frequencyGroups.needsNextRun.includes(watchedFrequency) && (
                                  <FormField
                                    control={form.control}
                                    name="nextRun"
                                    render={({ field }) => (
                                      <FormItem className="flex flex-col flex-1 min-w-[200px]">
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
                  </div>
                )}

                {/* Step 2: Item Selection */}
                {currentStep === 2 && (
                  <div className="flex flex-col h-full">
                    <Card className="w-full flex-1 flex flex-col min-h-0 shadow-sm border border-border">
                      <CardHeader className="pb-4">
                        <CardTitle className="text-base flex items-center gap-2">
                          <IconPackage className="h-4 w-4" />
                          Seleção de Itens
                        </CardTitle>
                        <CardDescription>Escolha os itens para este agendamento (mínimo 1)</CardDescription>
                      </CardHeader>
                      <CardContent className="flex-1 flex flex-col min-h-0 px-4 py-4">
                        <ItemsSelector control={form.control} required />
                      </CardContent>
                    </Card>
                  </div>
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
                        {/* Schedule Information */}
                        <div className="flex justify-between items-center bg-muted/50 rounded-lg px-4 py-3">
                          <span className="text-sm font-medium text-muted-foreground">Frequência</span>
                          <span className="text-sm font-semibold text-foreground">
                            {SCHEDULE_FREQUENCY_LABELS[watchedFrequency] || watchedFrequency}
                            {watchedFrequencyCount && watchedFrequencyCount > 1 && ` - A cada ${watchedFrequencyCount}`}
                          </span>
                        </div>

                        {watchedDayOfWeek && (
                          <div className="flex justify-between items-center bg-muted/50 rounded-lg px-4 py-3">
                            <span className="text-sm font-medium text-muted-foreground">Dia da Semana</span>
                            <span className="text-sm font-semibold text-foreground">{WEEK_DAY_LABELS[watchedDayOfWeek]}</span>
                          </div>
                        )}

                        {watchedDayOfMonth && (
                          <div className="flex justify-between items-center bg-muted/50 rounded-lg px-4 py-3">
                            <span className="text-sm font-medium text-muted-foreground">Dia do Mês</span>
                            <span className="text-sm font-semibold text-foreground">{watchedDayOfMonth}</span>
                          </div>
                        )}

                        {watchedMonth && (
                          <div className="flex justify-between items-center bg-muted/50 rounded-lg px-4 py-3">
                            <span className="text-sm font-medium text-muted-foreground">Mês</span>
                            <span className="text-sm font-semibold text-foreground">{MONTH_LABELS[watchedMonth]}</span>
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

                        {/* Items Summary */}
                        <div className="flex justify-between items-center bg-primary/10 rounded-lg px-4 py-3 border border-primary/20">
                          <div className="flex items-center gap-2">
                            <IconPackage className="h-4 w-4 text-primary" />
                            <span className="text-sm font-medium text-muted-foreground">Itens Selecionados</span>
                          </div>
                          <span className="text-sm font-bold text-primary">{watchedItems.length}</span>
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
