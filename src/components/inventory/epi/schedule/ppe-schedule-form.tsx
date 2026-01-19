import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from "@/components/ui/form";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { IconLoader2 as Loader2, IconCalendar as CalendarIcon, IconShield, IconUsers as Users, IconUserCheck as UserCheck, IconUserX as UserX } from "@tabler/icons-react";
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
  USER_STATUS,
  routes,
} from "../../../../constants";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { Combobox } from "@/components/ui/combobox";
import { PpeItemsConfiguration } from "./ppe-items-configuration";
import { DETAIL_PAGE_SPACING } from "@/lib/layout-constants";

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
  const { isSubmitting, mode } = props;
  const navigate = useNavigate();
  // Note: Form uses props.onSubmit directly instead of mutations

  const [selectedAssignmentType, setSelectedAssignmentType] = useState<ASSIGNMENT_TYPE>(mode === "update" ? props.ppeSchedule.assignmentType : ASSIGNMENT_TYPE.ALL);

  // Create a stable cache for fetched users
  const cacheRef = useRef<Map<string, { label: string; value: string }>>(new Map());

  // Setup form based on mode
  const form = useForm<PpeDeliveryScheduleCreateFormData | PpeDeliveryScheduleUpdateFormData>({
    resolver: zodResolver(mode === "create" ? ppeDeliveryScheduleCreateSchema : ppeDeliveryScheduleUpdateSchema),
    mode: "onBlur", // Validate on blur for better UX
    defaultValues:
      mode === "create"
        ? {
            ppeItems: [{ ppeType: Object.values(PPE_TYPE)[0], quantity: 1 }],
            assignmentType: ASSIGNMENT_TYPE.ALL,
            excludedUserIds: [],
            includedUserIds: [],
            frequency: SCHEDULE_FREQUENCY.MONTHLY,
            frequencyCount: 1,
            dayOfMonth: 1,
            customMonths: [],
            ...props.defaultValues,
          }
        : {
            ppeItems: props.ppeSchedule.ppeItems || [],
            assignmentType: props.ppeSchedule.assignmentType || ASSIGNMENT_TYPE.ALL,
            excludedUserIds: props.ppeSchedule.excludedUserIds || [],
            includedUserIds: props.ppeSchedule.includedUserIds || [],
            frequency: props.ppeSchedule.frequency,
            frequencyCount: props.ppeSchedule.frequencyCount,
            specificDate: props.ppeSchedule.specificDate,
            dayOfMonth: props.ppeSchedule.dayOfMonth,
            dayOfWeek: props.ppeSchedule.dayOfWeek,
            month: props.ppeSchedule.month,
            customMonths: props.ppeSchedule.customMonths || [],
            ...props.defaultValues,
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
      navigate(routes.inventory.ppe.root);
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

  // Helper function to render schedule details based on frequency
  const renderScheduleFields = () => {
    switch (watchFrequency) {
      case SCHEDULE_FREQUENCY.ONCE:
        return (
          <FormField
            control={form.control}
            name="specificDate"
            render={({ field }) => (
              <FormItem>
                <FormLabel>
                  Data Específica <span className="text-destructive">*</span>
                </FormLabel>
                <Popover>
                  <PopoverTrigger asChild>
                    <FormControl>
                      <Button variant="outline" className={cn("w-full pl-3 text-left font-normal", !field.value && "text-muted-foreground")}>
                        {field.value ? format(field.value, "PPP", { locale: ptBR }) : <span>Selecione a data</span>}
                        <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                      </Button>
                    </FormControl>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar mode="single" selected={field.value || undefined} onSelect={field.onChange} initialFocus />
                  </PopoverContent>
                </Popover>
                <FormMessage />
              </FormItem>
            )}
          />
        );
      case SCHEDULE_FREQUENCY.WEEKLY:
        return (
          <FormField
            control={form.control}
            name="dayOfWeek"
            render={({ field }) => (
              <FormItem>
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
        );
      case SCHEDULE_FREQUENCY.MONTHLY:
        // Day of month is now rendered inline with frequency fields
        return null;
      case SCHEDULE_FREQUENCY.ANNUAL:
        return (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <FormField
              control={form.control}
              name="month"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>
                    Mês <span className="text-destructive">*</span>
                  </FormLabel>
                  <FormControl>
                    <Combobox
                      value={field.value || ""}
                      onValueChange={field.onChange}
                      options={Object.values(MONTH).map((month) => ({
                        label: MONTH_LABELS[month],
                        value: month,
                      }))}
                      placeholder="Selecione o mês"
                      searchPlaceholder="Buscar mês..."
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="dayOfMonth"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>
                    Dia do Mês <span className="text-destructive">*</span>
                  </FormLabel>
                  <FormControl>
                    <Input type="number" min={1} max={31} value={field.value || ""} onChange={(value) => field.onChange(typeof value === "number" ? value : undefined)} placeholder="1-31" className="bg-transparent" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <Card className="h-full flex flex-col shadow-sm border border-border overflow-hidden">
      <div className="flex-1 overflow-y-auto p-4">
        <Form {...form}>
          <form id="ppe-schedule-form" onSubmit={form.handleSubmit(handleSubmit, handleError)} className="space-y-8">
            {/* Hidden submit button for programmatic form submission */}
            <button type="submit" id="ppe-schedule-form-submit" className="hidden" aria-hidden="true" />
              {/* PPE Items Configuration */}
              <FormField
                control={form.control}
                name="ppeItems"
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

              {/* Schedule Configuration - Frequency, a cada, and dia do mes in same row */}
              <div className="grid grid-cols-[2fr,1fr,1fr] gap-4">
                {/* Frequency */}
                <FormField
                  control={form.control}
                  name="frequency"
                  render={({ field }) => (
                    <FormItem>
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

                {/* Frequency count (A cada) */}
                <FormField
                  control={form.control}
                  name="frequencyCount"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>A cada</FormLabel>
                      <FormControl>
                        <Input type="number" min={1} value={field.value} onChange={(value) => field.onChange(typeof value === "number" ? value : 1)} placeholder="1" className="bg-transparent" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Day of Month - show for monthly frequency */}
                {watchFrequency === SCHEDULE_FREQUENCY.MONTHLY ? (
                  <FormField
                    control={form.control}
                    name="dayOfMonth"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>
                          Dia do Mês <span className="text-destructive">*</span>
                        </FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            min={1}
                            max={31}
                            value={field.value || ""}
                            onChange={(value: string) => field.onChange(parseInt(value) || undefined)}
                            placeholder="1-31"
                            className="bg-transparent"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                ) : (
                  <div className="invisible">{/* Placeholder to maintain grid structure */}</div>
                )}
              </div>

              {/* Frequency-specific fields (except monthly dayOfMonth which is now inline) */}
              {watchFrequency !== SCHEDULE_FREQUENCY.MONTHLY && renderScheduleFields()}

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
                          {field === "ppeItems" && "Itens de EPI:"}
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
                            "ppeItems",
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
