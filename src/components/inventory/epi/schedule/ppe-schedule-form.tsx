import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from "@/components/ui/form";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { IconShield, IconUsers as Users, IconUserCheck as UserCheck, IconUserX as UserX } from "@tabler/icons-react";
import { ppeDeliveryScheduleCreateSchema, ppeDeliveryScheduleUpdateSchema, type PpeDeliveryScheduleCreateFormData, type PpeDeliveryScheduleUpdateFormData } from "../../../../schemas";
import { getUsers } from "../../../../api-client";
import { type PpeDeliverySchedule } from "../../../../types";
import {
  PPE_TYPE,
  ASSIGNMENT_TYPE,
  ASSIGNMENT_TYPE_LABELS,
  SCHEDULE_FREQUENCY,
  SCHEDULE_FREQUENCY_LABELS,
  WEEK_DAY,
  WEEK_DAY_LABELS,
  MONTH,
  MONTH_LABELS,
} from "../../../../constants";
import { Combobox } from "@/components/ui/combobox";
import { DateTimeInput } from "@/components/ui/date-time-input";
import { PpeItemsConfiguration } from "./ppe-items-configuration";

interface BasePpeScheduleFormProps {
  isSubmitting?: boolean;
}

interface CreatePpeScheduleFormProps extends BasePpeScheduleFormProps {
  mode: "create";
  onSubmit: (data: PpeDeliveryScheduleCreateFormData) => Promise<void>;
  defaultValues?: Partial<PpeDeliveryScheduleCreateFormData>;
}

interface UpdatePpeScheduleFormProps extends BasePpeScheduleFormProps {
  mode: "update";
  ppeSchedule: PpeDeliverySchedule;
  onSubmit: (data: PpeDeliveryScheduleUpdateFormData) => Promise<void>;
  defaultValues?: Partial<PpeDeliveryScheduleUpdateFormData>;
}

type PpeScheduleFormProps = CreatePpeScheduleFormProps | UpdatePpeScheduleFormProps;

export function PpeScheduleForm(props: PpeScheduleFormProps) {
  const { isSubmitting: _isSubmitting, mode } = props;
  // Note: Form uses props.onSubmit directly instead of mutations

  const [selectedAssignmentType, setSelectedAssignmentType] = useState<ASSIGNMENT_TYPE>(mode === "update" ? props.ppeSchedule.assignmentType : ASSIGNMENT_TYPE.SPECIFIC);

  // Create a stable cache for fetched users
  const cacheRef = useRef<Map<string, { label: string; value: string }>>(new Map());

  // Setup form based on mode
  const form = useForm<PpeDeliveryScheduleCreateFormData | PpeDeliveryScheduleUpdateFormData>({
    resolver: zodResolver(mode === "create" ? ppeDeliveryScheduleCreateSchema : ppeDeliveryScheduleUpdateSchema),
    mode: "onBlur", // Validate on blur for better UX
    // @ts-expect-error - form type mismatch
    defaultValues:
      mode === "create"
        ? {
            name: props.defaultValues?.name || "",
            items: props.defaultValues?.items || [{ ppeType: Object.values(PPE_TYPE)[0], quantity: 1 }],
            assignmentType: props.defaultValues?.assignmentType || ASSIGNMENT_TYPE.SPECIFIC,
            excludedUserIds: props.defaultValues?.excludedUserIds || [],
            includedUserIds: props.defaultValues?.includedUserIds || [],
            frequency: props.defaultValues?.frequency || SCHEDULE_FREQUENCY.MONTHLY,
            frequencyCount: props.defaultValues?.frequencyCount || 1,
            dayOfMonth: props.defaultValues?.dayOfMonth || 1,
            customMonths: props.defaultValues?.customMonths || [],
            isActive: props.defaultValues?.isActive ?? true, // Ensure schedule is created as active
          }
        : {
            name: props.ppeSchedule.name || props.defaultValues?.name || "",
            items: props.defaultValues?.items || props.ppeSchedule.items || [],
            assignmentType: props.defaultValues?.assignmentType || props.ppeSchedule.assignmentType || ASSIGNMENT_TYPE.ALL,
            excludedUserIds: props.defaultValues?.excludedUserIds || props.ppeSchedule.excludedUserIds || [],
            includedUserIds: props.defaultValues?.includedUserIds || props.ppeSchedule.includedUserIds || [],
            frequency: props.defaultValues?.frequency || props.ppeSchedule.frequency,
            frequencyCount: props.defaultValues?.frequencyCount || props.ppeSchedule.frequencyCount,
            specificDate: props.defaultValues?.specificDate || props.ppeSchedule.specificDate,
            dayOfMonth: props.defaultValues?.dayOfMonth || props.ppeSchedule.dayOfMonth,
            dayOfWeek: props.defaultValues?.dayOfWeek || props.ppeSchedule.dayOfWeek,
            month: props.defaultValues?.month || props.ppeSchedule.month,
            customMonths: props.defaultValues?.customMonths || props.ppeSchedule.customMonths || [],
            isActive: props.defaultValues?.isActive ?? props.ppeSchedule.isActive,
          },
  });

  // Watch form fields for conditional rendering
  const watchAssignmentType = form.watch("assignmentType");
  const watchFrequency = form.watch("frequency");

  useEffect(() => {
    if (watchAssignmentType) {
      setSelectedAssignmentType(watchAssignmentType);
    }
  }, [watchAssignmentType]);

  // Async query function for active users
  const queryUsers = useCallback(async (searchTerm: string, page = 1) => {
    try {
      const queryParams: any = {
        orderBy: { name: "asc" },
        page: page,
        take: 50,
        where: { isActive: true },
      };

      // Only add searchingFor if there's a search term
      if (searchTerm && searchTerm.trim()) {
        queryParams.searchingFor = searchTerm.trim();
      }

      const response = await getUsers(queryParams);
      const users = response.data || [];
      const hasMore = response.meta?.hasNextPage || false;

      // Convert users to options format and add to cache
      const options = users.map((user) => {
        const option = {
          value: user.id,
          label: user.name,
        };
        cacheRef.current.set(user.id, option);
        return option;
      });

      return {
        data: options,
        hasMore: hasMore,
      };
    } catch (error) {
      if (process.env.NODE_ENV !== 'production') {
        console.error("Error fetching users:", error);
      }
      return {
        data: [],
        hasMore: false,
      };
    }
  }, []);

  // Get initial options from cache for selected user IDs
  const initialUserOptions = useMemo(() => {
    const userIds = form.watch("includedUserIds") || form.watch("excludedUserIds") || [];
    if (!userIds.length) return [];
    return userIds
      .map(id => cacheRef.current.get(id))
      .filter((opt): opt is { label: string; value: string } => opt !== undefined);
  }, [form.watch("includedUserIds"), form.watch("excludedUserIds")]);

  const handleSubmit = async (data: PpeDeliveryScheduleCreateFormData | PpeDeliveryScheduleUpdateFormData) => {
    try {
      if (mode === "create") {
        await (props as CreatePpeScheduleFormProps).onSubmit(data as PpeDeliveryScheduleCreateFormData);
      } else {
        await (props as UpdatePpeScheduleFormProps).onSubmit(data as PpeDeliveryScheduleUpdateFormData);
      }
      // Navigation is handled by the page component's onSubmit callback
    } catch (error) {
      if (process.env.NODE_ENV !== 'production') {
        console.error("Error submitting form:", error);
      }
    }
  };

  const handleError = (errors: Record<string, any>) => {
    if (process.env.NODE_ENV !== 'production') {
      console.error("PPE schedule form validation errors:", errors);
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

  // Frequency groups - defines which fields appear for which frequencies (inspired by maintenance schedule pattern)
  const frequencyGroups = useMemo(() => ({
    withInterval: [SCHEDULE_FREQUENCY.WEEKLY, SCHEDULE_FREQUENCY.MONTHLY, SCHEDULE_FREQUENCY.ANNUAL] as string[],
    needsDayOfWeek: [SCHEDULE_FREQUENCY.WEEKLY, SCHEDULE_FREQUENCY.BIWEEKLY] as string[],
    needsDayOfMonth: [
      SCHEDULE_FREQUENCY.MONTHLY, SCHEDULE_FREQUENCY.BIMONTHLY, SCHEDULE_FREQUENCY.QUARTERLY,
      SCHEDULE_FREQUENCY.TRIANNUAL, SCHEDULE_FREQUENCY.QUADRIMESTRAL, SCHEDULE_FREQUENCY.SEMI_ANNUAL,
      SCHEDULE_FREQUENCY.ANNUAL,
    ] as string[],
    needsMonth: [SCHEDULE_FREQUENCY.ANNUAL] as string[],
    needsSpecificDate: [SCHEDULE_FREQUENCY.ONCE] as string[],
    needsNextRun: [
      SCHEDULE_FREQUENCY.DAILY, SCHEDULE_FREQUENCY.WEEKLY, SCHEDULE_FREQUENCY.BIWEEKLY,
      SCHEDULE_FREQUENCY.MONTHLY, SCHEDULE_FREQUENCY.BIMONTHLY, SCHEDULE_FREQUENCY.QUARTERLY,
      SCHEDULE_FREQUENCY.TRIANNUAL, SCHEDULE_FREQUENCY.QUADRIMESTRAL, SCHEDULE_FREQUENCY.SEMI_ANNUAL,
      SCHEDULE_FREQUENCY.ANNUAL,
    ] as string[],
  }), []);

  return (
    <Card className="h-full flex flex-col shadow-sm border border-border overflow-hidden">
      <div className="flex-1 overflow-y-auto p-4">
        <Form {...form}>
          <form id="ppe-schedule-form" onSubmit={form.handleSubmit(handleSubmit, handleError)} className="space-y-8">
            {/* Hidden submit button for programmatic form submission */}
            <button type="submit" id="ppe-schedule-form-submit" className="hidden" aria-hidden="true" />

              {/* Name */}
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>
                      Nome <span className="text-destructive">*</span>
                    </FormLabel>
                    <FormControl>
                      <Input
                        placeholder="Ex: Entrega Semestral de Uniformes"
                        value={field.value || ""}
                        onChange={field.onChange}
                        className="bg-transparent"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* PPE Items Configuration */}
              <FormField
                control={form.control}
                name="items"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="flex items-center gap-2">
                      <IconShield className="h-4 w-4" />
                      Configuração de EPI <span className="text-destructive">*</span>
                    </FormLabel>
                    <FormControl>
                      <PpeItemsConfiguration value={field.value || []} onChange={field.onChange} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Assignment Type and Target Selection */}
              <div className="space-y-4">
                <FormField
                  control={form.control}
                  name="assignmentType"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="flex items-center gap-2">
                        <Users className="h-4 w-4" />
                        Tipo de Atribuição <span className="text-destructive">*</span>
                      </FormLabel>
                      <FormControl>
                        <Combobox
                          value={field.value}
                          onValueChange={field.onChange}
                          options={Object.values(ASSIGNMENT_TYPE).map((type) => ({
                            label: ASSIGNMENT_TYPE_LABELS[type],
                            value: type,
                          }))}
                          placeholder="Selecione o tipo de atribuição"
                          searchPlaceholder="Buscar tipo..."
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* User Selection based on Assignment Type */}
                {selectedAssignmentType === ASSIGNMENT_TYPE.SPECIFIC && (
                  <FormField
                    control={form.control}
                    name="includedUserIds"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="flex items-center gap-2">
                          <UserCheck className="h-4 w-4" />
                          Funcionários Específicos <span className="text-destructive">*</span>
                        </FormLabel>
                        <FormControl>
                          <Combobox
                            async={true}
                            queryKey={["users-schedule-included"]}
                            queryFn={queryUsers}
                            initialOptions={initialUserOptions}
                            value={field.value || []}
                            onValueChange={field.onChange}
                            placeholder="Selecione os funcionários"
                            emptyText="Nenhum funcionário encontrado"
                            searchPlaceholder="Buscar funcionários..."
                            mode="multiple"
                            minSearchLength={0}
                            pageSize={50}
                            debounceMs={300}
                          />
                        </FormControl>
                        <FormDescription>Selecione os funcionários que receberão os EPIs neste agendamento</FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                )}

                {selectedAssignmentType === ASSIGNMENT_TYPE.ALL_EXCEPT && (
                  <FormField
                    control={form.control}
                    name="excludedUserIds"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="flex items-center gap-2">
                          <UserX className="h-4 w-4" />
                          Funcionários Excluídos
                        </FormLabel>
                        <FormControl>
                          <Combobox
                            async={true}
                            queryKey={["users-schedule-excluded"]}
                            queryFn={queryUsers}
                            initialOptions={initialUserOptions}
                            value={field.value || []}
                            onValueChange={field.onChange}
                            placeholder="Selecione os funcionários a excluir"
                            emptyText="Nenhum funcionário encontrado"
                            searchPlaceholder="Buscar funcionários..."
                            mode="multiple"
                            minSearchLength={0}
                            pageSize={50}
                            debounceMs={300}
                          />
                        </FormControl>
                        <FormDescription>Selecione os funcionários que NÃO receberão os EPIs neste agendamento</FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                )}
              </div>

              {/* Schedule Configuration - All frequency fields in a single responsive row */}
              <div className="flex flex-wrap gap-4">
                {/* Frequency */}
                <FormField
                  control={form.control}
                  name="frequency"
                  render={({ field }) => (
                    <FormItem className="flex-1 min-w-[200px]">
                      <FormLabel>
                        Frequência <span className="text-destructive">*</span>
                      </FormLabel>
                      <FormControl>
                        <Combobox
                          value={field.value}
                          onValueChange={field.onChange}
                          options={Object.values(SCHEDULE_FREQUENCY).map((freq) => ({
                            label: SCHEDULE_FREQUENCY_LABELS[freq],
                            value: freq,
                          }))}
                          placeholder="Selecione a frequência"
                          searchPlaceholder="Buscar frequência..."
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Frequency count (A cada) - only for frequencies that support intervals */}
                {watchFrequency && frequencyGroups.withInterval.includes(watchFrequency) && (
                  <FormField
                    control={form.control}
                    name="frequencyCount"
                    render={({ field }) => {
                      const getIntervalLabel = () => {
                        switch (watchFrequency) {
                          case SCHEDULE_FREQUENCY.WEEKLY: return "Intervalo (semanas)";
                          case SCHEDULE_FREQUENCY.MONTHLY: return "Intervalo (meses)";
                          case SCHEDULE_FREQUENCY.ANNUAL: return "Intervalo (anos)";
                          default: return "Intervalo";
                        }
                      };
                      return (
                        <FormItem className="flex-1 min-w-[150px]">
                          <FormLabel>{getIntervalLabel()}</FormLabel>
                          <FormControl>
                            <Input type="number" min={1} value={field.value} onChange={(value) => field.onChange(typeof value === "number" ? value : parseInt(String(value)) || 1)} placeholder="1" className="bg-transparent" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      );
                    }}
                  />
                )}

                {/* Specific Date - for ONCE frequency */}
                {watchFrequency && frequencyGroups.needsSpecificDate.includes(watchFrequency) && (
                  <FormField
                    control={form.control}
                    name="specificDate"
                    render={({ field }) => (
                      <FormItem className="flex flex-col flex-1 min-w-[200px]">
                        <FormLabel>
                          Data Específica <span className="text-destructive">*</span>
                        </FormLabel>
                        <DateTimeInput
                          {...{
                            onChange: (value) => field.onChange(value),
                            onBlur: field.onBlur,
                            value: field.value ?? null,
                            name: field.name,
                          }}
                          hideLabel
                          placeholder="Selecione a data"
                          mode="date"
                          constraints={{ minDate: new Date() }}
                        />
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                )}

                {/* Day of Week - for weekly/biweekly */}
                {watchFrequency && frequencyGroups.needsDayOfWeek.includes(watchFrequency) && (
                  <FormField
                    control={form.control}
                    name="dayOfWeek"
                    render={({ field }) => (
                      <FormItem className="flex-1 min-w-[200px]">
                        <FormLabel>
                          Dia da Semana <span className="text-destructive">*</span>
                        </FormLabel>
                        <FormControl>
                          <Combobox
                            value={field.value || ""}
                            onValueChange={field.onChange}
                            options={Object.values(WEEK_DAY).map((day) => ({
                              label: WEEK_DAY_LABELS[day],
                              value: day,
                            }))}
                            placeholder="Selecione o dia"
                            searchPlaceholder="Buscar dia..."
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                )}

                {/* Month - for annual */}
                {watchFrequency && frequencyGroups.needsMonth.includes(watchFrequency) && (
                  <FormField
                    control={form.control}
                    name="month"
                    render={({ field }) => (
                      <FormItem className="flex-1 min-w-[200px]">
                        <FormLabel>
                          Mês <span className="text-destructive">*</span>
                        </FormLabel>
                        <FormControl>
                          <Combobox
                            value={field.value || ""}
                            onValueChange={field.onChange}
                            options={Object.values(MONTH).map((m) => ({
                              label: MONTH_LABELS[m],
                              value: m,
                            }))}
                            placeholder="Selecione o mês"
                            searchPlaceholder="Buscar mês..."
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                )}

                {/* Day of Month - for monthly, bimonthly, quarterly, etc. */}
                {watchFrequency && frequencyGroups.needsDayOfMonth.includes(watchFrequency) && (
                  <FormField
                    control={form.control}
                    name="dayOfMonth"
                    render={({ field }) => (
                      <FormItem className="flex-1 min-w-[150px]">
                        <FormLabel>
                          Dia do Mês <span className="text-destructive">*</span>
                        </FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            min={1}
                            max={31}
                            value={field.value || ""}
                            onChange={(value: string | number | null) => field.onChange(typeof value === 'number' ? value : (typeof value === 'string' ? (parseInt(value) || undefined) : undefined))}
                            placeholder="1-31"
                            className="bg-transparent"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                )}

                {/* First Run / Next Run - for all recurring frequencies */}
                {watchFrequency && frequencyGroups.needsNextRun.includes(watchFrequency) && (
                  <FormField
                    control={form.control}
                    name={"nextRun" as any}
                    render={({ field }) => (
                      <FormItem className="flex flex-col flex-1 min-w-[200px]">
                        <FormLabel>Primeira Execução</FormLabel>
                        <DateTimeInput
                          {...{
                            onChange: (value) => field.onChange(value),
                            onBlur: field.onBlur,
                            value: field.value ?? null,
                            name: field.name,
                          }}
                          hideLabel
                          placeholder="Data de início"
                          mode="date"
                          constraints={{ minDate: new Date() }}
                        />
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                )}
              </div>

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
                          {field === "items" && "Itens de EPI:"}
                          {field === "assignmentType" && "Tipo de Atribuição:"}
                          {field === "includedUserIds" && "Funcionários Incluídos:"}
                          {field === "excludedUserIds" && "Funcionários Excluídos:"}
                          {field === "frequency" && "Frequência:"}
                          {field === "frequencyCount" && "Repetir a cada:"}
                          {field === "dayOfMonth" && "Dia do Mês:"}
                          {field === "dayOfWeek" && "Dia da Semana:"}
                          {field === "month" && "Mês:"}
                          {field === "specificDate" && "Data Específica:"}
                          {![
                            "items",
                            "assignmentType",
                            "includedUserIds",
                            "excludedUserIds",
                            "frequency",
                            "frequencyCount",
                            "dayOfMonth",
                            "dayOfWeek",
                            "month",
                            "specificDate",
                          ].includes(field) && `${field}:`}
                        </span>
                        <span>{error?.message || "Campo obrigatório"}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
          </form>
        </Form>
      </div>
    </Card>
  );
}
