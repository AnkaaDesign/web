import { FormField, FormItem, FormControl, FormLabel, FormMessage, FormDescription } from "@/components/ui/form";
import { Combobox } from "@/components/ui/combobox";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DateTimeInput } from "@/components/ui/date-time-input";
import { cn } from "@/lib/utils";
import { useWatch } from "react-hook-form";
import type { FieldValues, FieldPath } from "react-hook-form";
import { SCHEDULE_FREQUENCY, WEEK_DAY, MONTH, MONTH_OCCURRENCE, SCHEDULE_FREQUENCY_LABELS, WEEK_DAY_LABELS, MONTH_LABELS, MONTH_OCCURRENCE_LABELS } from "../../constants";
export interface ScheduleFormData {
  frequency: SCHEDULE_FREQUENCY;
  frequencyCount?: number;
  // Weekly specific fields
  weeklySchedule?: {
    monday: boolean;
    tuesday: boolean;
    wednesday: boolean;
    thursday: boolean;
    friday: boolean;
    saturday: boolean;
    sunday: boolean;
  };
  // Monthly specific fields
  monthlySchedule?: {
    dayOfMonth?: number | null;
    occurrence?: MONTH_OCCURRENCE | null;
    dayOfWeek?: WEEK_DAY | null;
  };
  // Yearly specific fields
  yearlySchedule?: {
    month: MONTH;
    dayOfMonth?: number | null;
    occurrence?: MONTH_OCCURRENCE | null;
    dayOfWeek?: WEEK_DAY | null;
  };
  // Simple date fields for maintenance
  nextRun?: Date;
  specificDate?: Date | null;
  dayOfMonth?: number | null;
  dayOfWeek?: WEEK_DAY | null;
  month?: MONTH | null;
}
interface ScheduleFormProps<_T extends FieldValues & ScheduleFormData> {
  control: any;
  disabled?: boolean;
  showNextRun?: boolean;
  showSpecificDate?: boolean;
  type?: "order" | "ppe" | "maintenance";
  className?: string;
}
export function ScheduleForm<T extends FieldValues & ScheduleFormData>({
  control,
  disabled = false,
  showNextRun = false,
  showSpecificDate = false,
  type = "order",
  className,
}: ScheduleFormProps<T>) {
  // Watch the frequency field to conditionally render configuration
  const frequency = useWatch({ control, name: "frequency" as FieldPath<T> });
  const frequencyOptions = Object.entries(SCHEDULE_FREQUENCY_LABELS).map(([key, label]) => ({
    value: key as SCHEDULE_FREQUENCY,
    label,
  }));
  const weekDayOptions = [
    { value: "NONE" as const, label: "Selecionar..." },
    ...Object.entries(WEEK_DAY_LABELS).map(([key, label]) => ({
      value: key as WEEK_DAY,
      label,
    })),
  ];
  const monthOptions = [
    { value: "NONE" as const, label: "Selecionar..." },
    ...Object.entries(MONTH_LABELS).map(([key, label]) => ({
      value: key as MONTH,
      label,
    })),
  ];
  const occurrenceOptions = [
    { value: "NONE" as const, label: "Selecionar..." },
    ...Object.entries(MONTH_OCCURRENCE_LABELS).map(([key, label]) => ({
      value: key as MONTH_OCCURRENCE,
      label,
    })),
  ];
  const renderWeeklyConfiguration = () => (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Configuração Semanal</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {Object.entries(WEEK_DAY_LABELS).map(([dayKey, dayLabel]) => {
            const fieldName = dayKey.toLowerCase() as keyof NonNullable<ScheduleFormData["weeklySchedule"]>;
            return (
              <FormField
                key={dayKey}
                control={control}
                name={`weeklySchedule.${fieldName}` as FieldPath<T>}
                render={({ field }) => (
                  <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                    <FormControl>
                      <Checkbox checked={field.value} onCheckedChange={field.onChange} disabled={disabled} />
                    </FormControl>
                    <div className="space-y-1 leading-none">
                      <FormLabel className="text-sm font-normal">{dayLabel}</FormLabel>
                    </div>
                  </FormItem>
                )}
              />
            );
          })}
        </div>
        <FormDescription className="mt-4">Selecione os dias da semana para o agendamento</FormDescription>
      </CardContent>
    </Card>
  );
  const renderMonthlyConfiguration = () => (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Configuração Mensal Avançada</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="text-sm font-medium text-muted-foreground">Configure por ocorrência (opcional):</div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <FormField
            control={control}
            name={"monthlySchedule.occurrence" as FieldPath<T>}
            render={({ field }) => (
              <FormItem>
                <FormLabel>Ocorrência</FormLabel>
                <FormControl>
                  <Combobox
                    value={field.value || "NONE"}
                    onValueChange={(value) => field.onChange(value === "NONE" ? null : value)}
                    options={occurrenceOptions}
                    placeholder="Selecione a ocorrência"
                    disabled={disabled}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={control}
            name={"monthlySchedule.dayOfWeek" as FieldPath<T>}
            render={({ field }) => (
              <FormItem>
                <FormLabel>Dia da Semana</FormLabel>
                <FormControl>
                  <Combobox
                    value={field.value || "NONE"}
                    onValueChange={(value) => field.onChange(value === "NONE" ? null : value)}
                    options={weekDayOptions}
                    placeholder="Selecione o dia da semana"
                    disabled={disabled}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>
        <FormDescription>Exemplo: "Primeira Segunda-feira" ou "Última Sexta-feira" do mês</FormDescription>
      </CardContent>
    </Card>
  );
  const renderYearlyConfiguration = () => (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Configuração Anual</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <FormField
          control={control}
          name={"yearlySchedule.month" as FieldPath<T>}
          render={({ field }) => (
            <FormItem>
              <FormLabel>Mês</FormLabel>
              <FormControl>
                <Combobox
                  value={field.value || "NONE"}
                  onValueChange={(value) => field.onChange(value === "NONE" ? null : value)}
                  options={monthOptions}
                  placeholder="Selecione o mês"
                  disabled={disabled}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <FormField
            control={control}
            name={"yearlySchedule.dayOfMonth" as FieldPath<T>}
            render={({ field }) => (
              <FormItem>
                <FormLabel>Dia do Mês</FormLabel>
                <FormControl>
                  <Input
                    type="number"
                    min={1}
                    max={31}
                    placeholder="Ex: 15"
                    value={field.value ?? ""}
                    onChange={(value) => {
                      const numValue = typeof value === 'number' ? value : (value ? parseInt(value) : null);
                      field.onChange(numValue);
                    }}
                    disabled={disabled}
                  />
                </FormControl>
                <FormDescription>Dia específico do mês ou deixe vazio para usar padrão de ocorrência</FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>
        <div className="text-sm font-medium text-muted-foreground">OU configure por ocorrência:</div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <FormField
            control={control}
            name={"yearlySchedule.occurrence" as FieldPath<T>}
            render={({ field }) => (
              <FormItem>
                <FormLabel>Ocorrência</FormLabel>
                <FormControl>
                  <Combobox
                    value={field.value || "NONE"}
                    onValueChange={(value) => field.onChange(value === "NONE" ? null : value)}
                    options={occurrenceOptions}
                    placeholder="Selecione a ocorrência"
                    disabled={disabled}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={control}
            name={"yearlySchedule.dayOfWeek" as FieldPath<T>}
            render={({ field }) => (
              <FormItem>
                <FormLabel>Dia da Semana</FormLabel>
                <FormControl>
                  <Combobox
                    value={field.value || "NONE"}
                    onValueChange={(value) => field.onChange(value === "NONE" ? null : value)}
                    options={weekDayOptions}
                    placeholder="Selecione o dia da semana"
                    disabled={disabled}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>
        <FormDescription>Exemplo: "Primeira Segunda-feira de Janeiro" ou "Última Sexta-feira de Dezembro"</FormDescription>
      </CardContent>
    </Card>
  );
  const renderSimpleConfiguration = () => {
    if (type === "maintenance" || showSpecificDate) {
      return (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Configuração Simples</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* For PPE and similar, we can have simple day/month fields */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <FormField
                control={control}
                name={"dayOfMonth" as FieldPath<T>}
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Dia do Mês</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        min={1}
                        max={31}
                        placeholder="Ex: 15"
                        value={field.value ?? ""}
                        onChange={(value) => {
                          const numValue = typeof value === 'number' ? value : (value ? parseInt(value) : null);
                          field.onChange(numValue);
                        }}
                        disabled={disabled}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={control}
                name={"dayOfWeek" as FieldPath<T>}
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Dia da Semana</FormLabel>
                    <FormControl>
                      <Combobox
                        value={field.value || "NONE"}
                        onValueChange={(value) => field.onChange(value === "NONE" ? null : value)}
                        options={weekDayOptions}
                        placeholder="Selecione o dia"
                        disabled={disabled}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={control}
                name={"month" as FieldPath<T>}
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Mês</FormLabel>
                    <FormControl>
                      <Combobox
                        value={field.value || "NONE"}
                        onValueChange={(value) => field.onChange(value === "NONE" ? null : value)}
                        options={monthOptions}
                        placeholder="Selecione o mês"
                        disabled={disabled}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
          </CardContent>
        </Card>
      );
    }
    return null;
  };
  const renderDatePicker = (name: string, label: string, description?: string) => (
    <FormField
      control={control}
      name={name as FieldPath<T>}
      render={({ field }) => (
        <FormItem>
          <DateTimeInput
            field={{
              ...field,
              onChange: (date) => {
                if (date && date instanceof Date) {
                  // Set hour to 13:00 (1 PM) for schedules
                  const dateWithTime = new Date(date);
                  dateWithTime.setHours(13, 0, 0, 0);
                  field.onChange(dateWithTime);
                } else {
                  field.onChange(null);
                }
              },
            }}
            label={label}
            mode="date"
            context="scheduled"
            disabled={disabled}
            constraints={{
              minDate: new Date(),
            }}
          />
          <FormDescription>
            {description ? `${description} (horário será definido às 13:00)` : "Horário será definido às 13:00"}
          </FormDescription>
        </FormItem>
      )}
    />
  );
  return (
    <div className={cn("space-y-6", className)}>
      {/* Frequency Selection - Always show 3 columns grid */}
      <div className="grid grid-cols-3 gap-2 md:gap-4">
        {/* Column 1: Frequency */}
        <FormField
          control={control}
          name={"frequency" as FieldPath<T>}
          render={({ field }) => (
            <FormItem>
              <FormLabel>Frequência</FormLabel>
              <FormControl>
                <Combobox value={field.value || ""} onValueChange={field.onChange} options={frequencyOptions} placeholder="Selecione a frequência" disabled={disabled} />
              </FormControl>
              <FormDescription className="text-xs md:text-sm">Frequência</FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />
        {/* Column 2: Frequency Count / Interval */}
        <FormField
          control={control}
          name={"frequencyCount" as FieldPath<T>}
          render={({ field }) => {
            // Get appropriate label and description based on frequency
            const getIntervalInfo = () => {
              switch (frequency) {
                case SCHEDULE_FREQUENCY.DAILY:
                  return {
                    label: "A cada",
                    description: "Dias",
                  };
                case SCHEDULE_FREQUENCY.WEEKLY:
                  return {
                    label: "A cada",
                    description: "Semanas",
                  };
                case SCHEDULE_FREQUENCY.MONTHLY:
                  return {
                    label: "A cada",
                    description: "Meses",
                  };
                case SCHEDULE_FREQUENCY.ANNUAL:
                  return {
                    label: "A cada",
                    description: "Anos",
                  };
                default:
                  return {
                    label: "A cada",
                    description: "-",
                  };
              }
            };
            const { label, description } = getIntervalInfo();
            const showField =
              frequency &&
              (frequency === SCHEDULE_FREQUENCY.WEEKLY ||
                frequency === SCHEDULE_FREQUENCY.MONTHLY ||
                frequency === SCHEDULE_FREQUENCY.ANNUAL ||
                frequency === SCHEDULE_FREQUENCY.DAILY);
            return (
              <FormItem>
                <FormLabel>{label}</FormLabel>
                <FormControl>
                  <Input
                    type="number"
                    min={1}
                    max={100}
                    placeholder="Intervalo"
                    value={showField ? field.value || 1 : ""}
                    onChange={(value) => {
                      const numValue = typeof value === 'number' ? value : (value ? parseInt(value) : 1);
                      field.onChange(numValue);
                    }}
                    disabled={disabled || !showField}
                  />
                </FormControl>
                <FormDescription className="text-xs md:text-sm">{description}</FormDescription>
                <FormMessage />
              </FormItem>
            );
          }}
        />
        {/* Column 3: Day of Month (for monthly) or placeholder */}
        <FormField
          control={control}
          name={"monthlySchedule.dayOfMonth" as FieldPath<T>}
          render={({ field }) => {
            const isMonthly = frequency === SCHEDULE_FREQUENCY.MONTHLY;
            return (
              <FormItem>
                <FormLabel>Dia do Mês</FormLabel>
                <FormControl>
                  <Input
                    type="number"
                    min={1}
                    max={31}
                    placeholder={isMonthly ? "Ex: 15" : "-"}
                    value={isMonthly ? field.value || "" : ""}
                    onChange={(value) => {
                      if (isMonthly) {
                        const numValue = typeof value === 'number' ? value : (value ? parseInt(value) : null);
                        field.onChange(numValue);
                      }
                    }}
                    disabled={disabled || !isMonthly}
                  />
                </FormControl>
                <FormDescription className="text-xs md:text-sm">{isMonthly ? "Dia (1-31)" : "Mensal apenas"}</FormDescription>
                <FormMessage />
              </FormItem>
            );
          }}
        />
      </div>
      {/* Date fields */}
      {showNextRun && <div className="grid grid-cols-1 md:grid-cols-2 gap-4">{renderDatePicker("nextRun", "Próxima Execução", "Data da próxima execução do agendamento")}</div>}
      {showSpecificDate && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">{renderDatePicker("specificDate", "Data Específica", "Data específica para execução única")}</div>
      )}
      {/* Conditional Configuration based on frequency */}
      {frequency === SCHEDULE_FREQUENCY.WEEKLY && renderWeeklyConfiguration()}
      {frequency === SCHEDULE_FREQUENCY.MONTHLY && renderMonthlyConfiguration()}
      {frequency === SCHEDULE_FREQUENCY.ANNUAL && renderYearlyConfiguration()}
      {/* Simple configuration for frequencies that don't need complex setup */}
      {frequency &&
        frequency !== SCHEDULE_FREQUENCY.WEEKLY &&
        frequency !== SCHEDULE_FREQUENCY.MONTHLY &&
        frequency !== SCHEDULE_FREQUENCY.ANNUAL &&
        frequency !== SCHEDULE_FREQUENCY.ONCE &&
        renderSimpleConfiguration()}
    </div>
  );
}
