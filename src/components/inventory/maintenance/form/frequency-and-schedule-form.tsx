import { useEffect, useMemo } from "react";
import { FormField, FormItem, FormLabel, FormControl, FormMessage, FormDescription } from "@/components/ui/form";
import { Combobox } from "@/components/ui/combobox";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

import { Separator } from "@/components/ui/separator";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { IconCalendar, IconRotate, IconAlertCircle } from "@tabler/icons-react";
import { SCHEDULE_FREQUENCY, SCHEDULE_FREQUENCY_LABELS, WEEK_DAY, WEEK_DAY_LABELS, MONTH, MONTH_LABELS } from "../../../../constants";
import { addDays, addWeeks, addMonths, addYears, formatDate } from "../../../../utils";
import { cn } from "@/lib/utils";

interface FrequencyAndScheduleFormProps {
  control: any;
  setValue: any;
  watch: any;
  disabled?: boolean;
  required?: boolean;
  className?: string;
}

export function FrequencyAndScheduleForm({ control, setValue, watch, disabled = false, required = false, className }: FrequencyAndScheduleFormProps) {
  // Safe watch function
  const safeWatch = (fieldName: string, defaultValue?: any) => {
    try {
      return watch && typeof watch === "function" ? watch(fieldName) : defaultValue;
    } catch {
      return defaultValue;
    }
  };

  const frequency = safeWatch("frequency");
  const frequencyCount = safeWatch("frequencyCount", 1);
  const specificDate = safeWatch("specificDate");
  const dayOfWeek = safeWatch("dayOfWeek");
  const dayOfMonth = safeWatch("dayOfMonth");
  const month = safeWatch("month");
  const customMonths = safeWatch("customMonths", []);

  // Calculate next run date based on frequency and other parameters
  const calculateNextRun = useMemo(() => {
    if (!frequency) return null;

    const baseDate = new Date();
    const count = frequencyCount || 1;
    let nextDate: Date;

    switch (frequency) {
      case SCHEDULE_FREQUENCY.ONCE:
        return specificDate ? new Date(specificDate) : null;

      case SCHEDULE_FREQUENCY.DAILY:
        // Daily means every single day, ignore count
        nextDate = addDays(baseDate, 1);
        break;

      case SCHEDULE_FREQUENCY.WEEKLY:
        // Weekly with count means every X weeks
        nextDate = addWeeks(baseDate, count);
        if (dayOfWeek) {
          // Adjust to specific day of week
          const targetDay = Object.values(WEEK_DAY).indexOf(dayOfWeek);
          const currentDay = nextDate.getDay();
          const daysToAdd = (targetDay - currentDay + 7) % 7;
          nextDate = addDays(nextDate, daysToAdd);
        }
        break;

      case SCHEDULE_FREQUENCY.BIWEEKLY:
        // Biweekly is fixed at every 2 weeks, ignore count
        nextDate = addWeeks(baseDate, 2);
        break;

      case SCHEDULE_FREQUENCY.MONTHLY:
        // Monthly with count means every X months
        nextDate = addMonths(baseDate, count);
        if (dayOfMonth) {
          // Set to specific day of month, handling month-end edge cases
          nextDate.setDate(Math.min(dayOfMonth, new Date(nextDate.getFullYear(), nextDate.getMonth() + 1, 0).getDate()));
        }
        break;

      case SCHEDULE_FREQUENCY.BIMONTHLY:
        // Bimonthly is fixed at every 2 months, ignore count
        nextDate = addMonths(baseDate, 2);
        break;

      case SCHEDULE_FREQUENCY.QUARTERLY:
        // Quarterly is fixed at every 3 months, ignore count
        nextDate = addMonths(baseDate, 3);
        break;

      case SCHEDULE_FREQUENCY.TRIANNUAL:
        // Triannual is fixed at every 4 months, ignore count
        nextDate = addMonths(baseDate, 4);
        break;

      case SCHEDULE_FREQUENCY.QUADRIMESTRAL:
        // Quadrimestral is fixed at every 4 months, ignore count
        nextDate = addMonths(baseDate, 4);
        break;

      case SCHEDULE_FREQUENCY.SEMI_ANNUAL:
        // Semi-annual is fixed at every 6 months, ignore count
        nextDate = addMonths(baseDate, 6);
        break;

      case SCHEDULE_FREQUENCY.ANNUAL:
        // Annual with count means every X years
        nextDate = addYears(baseDate, count);
        if (month && dayOfMonth) {
          const targetMonth = Object.values(MONTH).indexOf(month);
          nextDate.setMonth(targetMonth);
          nextDate.setDate(Math.min(dayOfMonth, new Date(nextDate.getFullYear(), targetMonth + 1, 0).getDate()));
        }
        break;

      case SCHEDULE_FREQUENCY.CUSTOM:
        // For custom frequency, user should set specificDate
        return specificDate ? new Date(specificDate) : null;

      default:
        return null;
    }

    // Set hour to 13:00 (1 PM) for all calculated dates
    if (nextDate) {
      nextDate.setHours(13, 0, 0, 0);
      return nextDate;
    }

    return null;
  }, [frequency, frequencyCount, specificDate, dayOfWeek, dayOfMonth, month, customMonths]);

  // Update nextRun when calculation changes
  useEffect(() => {
    if (calculateNextRun) {
      setValue("nextRun", calculateNextRun, { shouldValidate: true });
    }
  }, [calculateNextRun, setValue]);

  const renderFrequencySpecificFields = () => {
    switch (frequency) {
      case SCHEDULE_FREQUENCY.ONCE:
        return (
          <FormField
            control={control}
            name="specificDate"
            render={({ field }) => (
              <FormItem className="flex flex-col">
                <FormLabel className={required ? "after:content-['*'] after:ml-0.5 after:text-red-500" : ""}>Data Específica</FormLabel>
                <Popover>
                  <PopoverTrigger asChild>
                    <FormControl>
                      <Button variant={"outline"} className={cn("w-full pl-3 text-left font-normal", !field.value && "text-muted-foreground")} disabled={disabled}>
                        {field.value ? formatDate(field.value) : <span>Selecione a data</span>}
                        <IconCalendar className="ml-auto h-4 w-4 opacity-50" />
                      </Button>
                    </FormControl>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <CalendarComponent
                      mode="single"
                      selected={field.value ? new Date(field.value) : undefined}
                      onSelect={(date: Date | undefined) => {
                        if (date) {
                          // Set hour to 13:00 (1 PM)
                          const dateWithTime = new Date(date);
                          dateWithTime.setHours(13, 0, 0, 0);
                          field.onChange(dateWithTime);
                        } else {
                          field.onChange(null);
                        }
                      }}
                      disabled={(date: Date) => date < new Date(new Date().setHours(0, 0, 0, 0))}
                      autoFocus
                      {...({} as any)}
                    />
                  </PopoverContent>
                </Popover>
                <FormDescription>Defina a data para esta manutenção única (horário será definido às 13:00)</FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
        );

      case SCHEDULE_FREQUENCY.WEEKLY:
      case SCHEDULE_FREQUENCY.BIWEEKLY:
        return (
          <FormField
            control={control}
            name="dayOfWeek"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Dia da Semana (Opcional)</FormLabel>
                <FormControl>
                  <Combobox
                    value={field.value || ""}
                    onValueChange={field.onChange}
                    disabled={disabled}
                    options={Object.entries(WEEK_DAY_LABELS).map(([value, label]) => ({
                      value,
                      label,
                    }))}
                    placeholder="Qualquer dia da semana"
                    searchable={false}
                  />
                </FormControl>
                <FormDescription>Especifique um dia da semana para execução regular</FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
        );

      case SCHEDULE_FREQUENCY.MONTHLY:
      case SCHEDULE_FREQUENCY.BIMONTHLY:
      case SCHEDULE_FREQUENCY.QUARTERLY:
      case SCHEDULE_FREQUENCY.TRIANNUAL:
      case SCHEDULE_FREQUENCY.QUADRIMESTRAL:
      case SCHEDULE_FREQUENCY.SEMI_ANNUAL:
        return (
          <FormField
            control={control}
            name="dayOfMonth"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Dia do Mês (Opcional)</FormLabel>
                <FormControl>
                  <Input type="number" min={1} max={31} placeholder="1-31" value={field.value} onChange={(value) => field.onChange(value)} disabled={disabled} />
                </FormControl>
                <FormDescription>Especifique um dia do mês (se não especificado, usará a data atual)</FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
        );

      case SCHEDULE_FREQUENCY.ANNUAL:
        return (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <FormField
              control={control}
              name="month"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Mês (Opcional)</FormLabel>
                  <FormControl>
                    <Combobox
                      value={field.value || ""}
                      onValueChange={field.onChange}
                      disabled={disabled}
                      options={Object.entries(MONTH_LABELS).map(([value, label]) => ({
                        value,
                        label,
                      }))}
                      placeholder="Mesmo mês atual"
                      searchable={false}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={control}
              name="dayOfMonth"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Dia do Mês (Opcional)</FormLabel>
                  <FormControl>
                    <Input type="number" min={1} max={31} placeholder="1-31" value={field.value} onChange={(value) => field.onChange(value)} disabled={disabled} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <div className="col-span-full">
              <FormDescription>Para manutenção anual, especifique mês e dia para execução regular</FormDescription>
            </div>
          </div>
        );

      case SCHEDULE_FREQUENCY.CUSTOM:
        return (
          <div className="space-y-4">
            <FormField
              control={control}
              name="specificDate"
              render={({ field }) => (
                <FormItem className="flex flex-col">
                  <FormLabel className={required ? "after:content-['*'] after:ml-0.5 after:text-red-500" : ""}>Próxima Execução</FormLabel>
                  <Popover>
                    <PopoverTrigger asChild>
                      <FormControl>
                        <Button variant={"outline"} className={cn("w-full pl-3 text-left font-normal", !field.value && "text-muted-foreground")} disabled={disabled}>
                          {field.value ? formatDate(field.value) : <span>Selecione a data</span>}
                          <IconCalendar className="ml-auto h-4 w-4 opacity-50" />
                        </Button>
                      </FormControl>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <CalendarComponent
                        mode="single"
                        selected={field.value ? new Date(field.value) : undefined}
                        onSelect={(date: Date | undefined) => {
                          if (date) {
                            // Set hour to 13:00 (1 PM)
                            const dateWithTime = new Date(date);
                            dateWithTime.setHours(13, 0, 0, 0);
                            field.onChange(dateWithTime);
                          } else {
                            field.onChange(null);
                          }
                        }}
                        disabled={(date: Date) => date < new Date(new Date().setHours(0, 0, 0, 0))}
                        autoFocus
                        {...({} as any)}
                      />
                    </PopoverContent>
                  </Popover>
                  <FormDescription>Para frequência personalizada, defina manualmente a próxima execução (horário será 13:00)</FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
              <div className="flex items-center gap-2">
                <IconAlertCircle className="h-4 w-4 text-amber-600" />
                <span className="text-sm font-medium text-amber-800">Atenção</span>
              </div>
              <p className="text-sm text-amber-700 mt-1">Com frequência personalizada, você precisará definir manualmente a próxima execução após cada manutenção.</p>
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <IconRotate className="h-5 w-5" />
          Frequência e Agendamento
        </CardTitle>
        <CardDescription>Configure quando e com que frequência esta manutenção deve ser executada</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Frequency Selection */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <FormField
            control={control}
            name="frequency"
            render={({ field }) => (
              <FormItem>
                <FormLabel className={required ? "after:content-['*'] after:ml-0.5 after:text-red-500" : ""}>Frequência</FormLabel>
                <FormControl>
                  <Combobox
                    value={field.value}
                    onValueChange={field.onChange}
                    disabled={disabled}
                    options={Object.entries(SCHEDULE_FREQUENCY_LABELS).map(([value, label]) => ({
                      value,
                      label,
                    }))}
                    placeholder="Selecione a frequência"
                    searchable={false}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          {/* Frequency Count - Only show for flexible interval frequencies (WEEKLY, MONTHLY, ANNUAL) */}
          {frequency && (frequency === SCHEDULE_FREQUENCY.WEEKLY || frequency === SCHEDULE_FREQUENCY.MONTHLY || frequency === SCHEDULE_FREQUENCY.ANNUAL) && (
            <FormField
              control={control}
              name="frequencyCount"
              render={({ field }) => {
                // Get appropriate label and description based on frequency
                const getIntervalLabel = () => {
                  switch (frequency) {
                    case SCHEDULE_FREQUENCY.DAILY:
                      return { label: "Intervalo (dias)", description: "A cada quantos dias executar" };
                    case SCHEDULE_FREQUENCY.WEEKLY:
                      return { label: "Intervalo (semanas)", description: "A cada quantas semanas executar" };
                    case SCHEDULE_FREQUENCY.BIWEEKLY:
                      return { label: "Intervalo (quinzenas)", description: "A cada quantas quinzenas executar" };
                    case SCHEDULE_FREQUENCY.MONTHLY:
                      return { label: "Intervalo (meses)", description: "A cada quantos meses executar" };
                    case SCHEDULE_FREQUENCY.BIMONTHLY:
                      return { label: "Intervalo (bimestres)", description: "A cada quantos bimestres executar" };
                    case SCHEDULE_FREQUENCY.QUARTERLY:
                      return { label: "Intervalo (trimestres)", description: "A cada quantos trimestres executar" };
                    case SCHEDULE_FREQUENCY.TRIANNUAL:
                      return { label: "Intervalo (quadrimestres)", description: "A cada quantos quadrimestres executar" };
                    case SCHEDULE_FREQUENCY.QUADRIMESTRAL:
                      return { label: "Intervalo (períodos de 4 meses)", description: "A cada quantos períodos de 4 meses" };
                    case SCHEDULE_FREQUENCY.SEMI_ANNUAL:
                      return { label: "Intervalo (semestres)", description: "A cada quantos semestres executar" };
                    case SCHEDULE_FREQUENCY.ANNUAL:
                      return { label: "Intervalo (anos)", description: "A cada quantos anos executar" };
                    default:
                      return { label: "Intervalo", description: "A cada quantos períodos executar" };
                  }
                };

                const { label, description } = getIntervalLabel();

                return (
                  <FormItem>
                    <FormLabel>{label}</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        min={1}
                        max={100}
                        placeholder="Intervalo"
                        value={field.value || 1}
                        onChange={(value) => field.onChange(value || 1)}
                        disabled={disabled}
                      />
                    </FormControl>
                    <FormDescription>
                      {description}
                      {field.value && field.value > 1 && (
                        <span className="block mt-1 text-blue-600">
                          {frequency === SCHEDULE_FREQUENCY.DAILY && `Será executada a cada ${field.value} dias`}
                          {frequency === SCHEDULE_FREQUENCY.WEEKLY && `Será executada a cada ${field.value} semanas`}
                          {frequency === SCHEDULE_FREQUENCY.MONTHLY && `Será executada a cada ${field.value} meses`}
                          {frequency === SCHEDULE_FREQUENCY.ANNUAL && `Será executada a cada ${field.value} anos`}
                        </span>
                      )}
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                );
              }}
            />
          )}
        </div>

        {/* Frequency-specific fields */}
        {frequency && renderFrequencySpecificFields()}

        {/* Preview */}
        {calculateNextRun && (
          <>
            <Separator />
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-2">
                <IconCalendar className="h-4 w-4 text-blue-600" />
                <span className="text-sm font-medium text-blue-800">Próxima Execução Prevista</span>
              </div>
              <div className="space-y-1">
                <p className="text-lg font-semibold text-blue-900">{formatDate(calculateNextRun)} às 13:00</p>
                <p className="text-sm text-blue-700">
                  {(() => {
                    const now = new Date();
                    const diffInDays = Math.ceil((calculateNextRun.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

                    if (diffInDays < 0) {
                      return `${Math.abs(diffInDays)} dia(s) atrás (data no passado)`;
                    } else if (diffInDays === 0) {
                      return "Hoje";
                    } else if (diffInDays === 1) {
                      return "Amanhã";
                    } else {
                      return `Em ${diffInDays} dia(s)`;
                    }
                  })()}
                </p>
              </div>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}

export default FrequencyAndScheduleForm;
