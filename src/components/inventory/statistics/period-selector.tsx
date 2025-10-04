import { useMemo } from "react";
import { startOfDay, endOfDay, startOfWeek, endOfWeek, startOfMonth, endOfMonth, startOfQuarter, endOfQuarter, startOfYear, endOfYear, subDays, subWeeks, subMonths, subQuarters, subYears } from "date-fns";
import { DateRange } from "react-day-picker";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { IconCalendar, IconChevronDown } from "@tabler/icons-react";
import { cn } from "@/lib/utils";

export type PeriodType = 'day' | 'week' | 'month' | 'quarter' | 'year' | 'custom';

interface PeriodOption {
  value: PeriodType;
  label: string;
  description?: string;
  dateRange?: DateRange;
}

interface PeriodSelectorProps {
  value: PeriodType;
  onChange: (period: PeriodType, dateRange?: DateRange) => void;
  disabled?: boolean;
  className?: string;
}

export function PeriodSelector({
  value,
  onChange,
  disabled = false,
  className,
}: PeriodSelectorProps) {
  const periodOptions = useMemo((): PeriodOption[] => {
    const now = new Date();

    return [
      // Current periods
      {
        value: 'day',
        label: 'Hoje',
        description: 'Período atual do dia',
        dateRange: {
          from: startOfDay(now),
          to: endOfDay(now),
        },
      },
      {
        value: 'week',
        label: 'Esta Semana',
        description: 'Semana atual (segunda a domingo)',
        dateRange: {
          from: startOfWeek(now, { weekStartsOn: 1 }), // Monday
          to: endOfWeek(now, { weekStartsOn: 1 }),
        },
      },
      {
        value: 'month',
        label: 'Este Mês',
        description: 'Mês atual',
        dateRange: {
          from: startOfMonth(now),
          to: endOfMonth(now),
        },
      },
      {
        value: 'quarter',
        label: 'Este Trimestre',
        description: 'Trimestre atual',
        dateRange: {
          from: startOfQuarter(now),
          to: endOfQuarter(now),
        },
      },
      {
        value: 'year',
        label: 'Este Ano',
        description: 'Ano atual',
        dateRange: {
          from: startOfYear(now),
          to: endOfYear(now),
        },
      },
    ];
  }, []);

  const quickPresets = useMemo(() => {
    const now = new Date();

    return [
      {
        label: 'Últimos 7 dias',
        dateRange: {
          from: startOfDay(subDays(now, 6)),
          to: endOfDay(now),
        },
      },
      {
        label: 'Últimos 30 dias',
        dateRange: {
          from: startOfDay(subDays(now, 29)),
          to: endOfDay(now),
        },
      },
      {
        label: 'Últimos 90 dias',
        dateRange: {
          from: startOfDay(subDays(now, 89)),
          to: endOfDay(now),
        },
      },
      {
        label: 'Semana passada',
        dateRange: {
          from: startOfWeek(subWeeks(now, 1), { weekStartsOn: 1 }),
          to: endOfWeek(subWeeks(now, 1), { weekStartsOn: 1 }),
        },
      },
      {
        label: 'Mês passado',
        dateRange: {
          from: startOfMonth(subMonths(now, 1)),
          to: endOfMonth(subMonths(now, 1)),
        },
      },
      {
        label: 'Trimestre passado',
        dateRange: {
          from: startOfQuarter(subQuarters(now, 1)),
          to: endOfQuarter(subQuarters(now, 1)),
        },
      },
      {
        label: 'Ano passado',
        dateRange: {
          from: startOfYear(subYears(now, 1)),
          to: endOfYear(subYears(now, 1)),
        },
      },
    ];
  }, []);

  const selectedOption = periodOptions.find(option => option.value === value);

  const handlePeriodSelect = (option: PeriodOption) => {
    onChange(option.value, option.dateRange);
  };

  const handlePresetSelect = (preset: { label: string; dateRange: DateRange }) => {
    onChange('custom', preset.dateRange);
  };

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          className={cn(
            "justify-between min-w-[140px]",
            !selectedOption && "text-muted-foreground",
            className
          )}
          disabled={disabled}
        >
          <div className="flex items-center gap-2">
            <IconCalendar className="h-4 w-4" />
            {selectedOption?.label || (value === 'custom' ? 'Personalizado' : 'Selecionar')}
          </div>
          <IconChevronDown className="h-4 w-4 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0" align="start">
        <div className="p-4 space-y-4">
          {/* Current Periods */}
          <div>
            <h4 className="text-sm font-medium mb-3">Períodos Atuais</h4>
            <div className="space-y-1">
              {periodOptions.map((option) => (
                <Button
                  key={option.value}
                  variant={value === option.value ? "secondary" : "ghost"}
                  className="w-full justify-start h-auto p-3"
                  onClick={() => handlePeriodSelect(option)}
                >
                  <div className="text-left">
                    <div className="font-medium">{option.label}</div>
                    {option.description && (
                      <div className="text-xs text-muted-foreground mt-1">
                        {option.description}
                      </div>
                    )}
                  </div>
                </Button>
              ))}
            </div>
          </div>

          <div className="border-t pt-4">
            <h4 className="text-sm font-medium mb-3">Períodos Rápidos</h4>
            <div className="space-y-1">
              {quickPresets.map((preset) => (
                <Button
                  key={preset.label}
                  variant="ghost"
                  className="w-full justify-start h-auto p-3"
                  onClick={() => handlePresetSelect(preset)}
                >
                  <div className="text-left">
                    <div className="font-medium">{preset.label}</div>
                    <div className="text-xs text-muted-foreground mt-1">
                      {preset.dateRange.from?.toLocaleDateString('pt-BR')} -{' '}
                      {preset.dateRange.to?.toLocaleDateString('pt-BR')}
                    </div>
                  </div>
                </Button>
              ))}
            </div>
          </div>

          <div className="border-t pt-4">
            <Button
              variant={value === 'custom' ? "secondary" : "ghost"}
              className="w-full justify-start"
              onClick={() => onChange('custom')}
            >
              Período personalizado
            </Button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}