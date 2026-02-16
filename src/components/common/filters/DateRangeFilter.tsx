import { useState } from "react";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { IconCalendar, IconX } from "@tabler/icons-react";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

export interface DateRange {
  from?: Date;
  to?: Date;
}

export interface DateRangeFilterProps {
  value?: DateRange;
  onChange: (range: DateRange | undefined) => void;
  placeholder?: string;
  className?: string;
  presets?: Array<{
    label: string;
    value: DateRange | (() => DateRange);
  }>;
}

const DEFAULT_PRESETS = [
  {
    label: "Hoje",
    value: () => {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      return { from: today, to: today };
    },
  },
  {
    label: "Últimos 7 dias",
    value: () => {
      const today = new Date();
      const lastWeek = new Date(today);
      lastWeek.setDate(lastWeek.getDate() - 7);
      return { from: lastWeek, to: today };
    },
  },
  {
    label: "Últimos 30 dias",
    value: () => {
      const today = new Date();
      const lastMonth = new Date(today);
      lastMonth.setDate(lastMonth.getDate() - 30);
      return { from: lastMonth, to: today };
    },
  },
  {
    label: "Este mês",
    value: () => {
      const now = new Date();
      const start = new Date(now.getFullYear(), now.getMonth(), 1);
      const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
      return { from: start, to: end };
    },
  },
  {
    label: "Mês passado",
    value: () => {
      const now = new Date();
      const start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const end = new Date(now.getFullYear(), now.getMonth(), 0);
      return { from: start, to: end };
    },
  },
  {
    label: "Este trimestre",
    value: () => {
      const now = new Date();
      const quarter = Math.floor(now.getMonth() / 3);
      const start = new Date(now.getFullYear(), quarter * 3, 1);
      const end = new Date(now.getFullYear(), (quarter + 1) * 3, 0);
      return { from: start, to: end };
    },
  },
  {
    label: "Este ano",
    value: () => {
      const now = new Date();
      const start = new Date(now.getFullYear(), 0, 1);
      const end = new Date(now.getFullYear(), 11, 31);
      return { from: start, to: end };
    },
  },
];

export function DateRangeFilter({
  value,
  onChange,
  placeholder = "Selecione período",
  className,
  presets = DEFAULT_PRESETS,
}: DateRangeFilterProps) {
  const [open, setOpen] = useState(false);

  const formatRange = () => {
    if (!value?.from) return placeholder;
    if (!value?.to) return format(value.from, "dd/MM/yyyy", { locale: ptBR });
    return `${format(value.from, "dd/MM/yyyy", { locale: ptBR })} - ${format(value.to, "dd/MM/yyyy", { locale: ptBR })}`;
  };

  const handlePresetClick = (preset: DateRange | (() => DateRange)) => {
    const range = typeof preset === "function" ? preset() : preset;
    onChange(range);
    setOpen(false);
  };

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    onChange(undefined);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" className={cn("justify-start text-left font-normal", !value?.from && "text-muted-foreground", className)}>
          <IconCalendar className="mr-2 h-4 w-4" />
          {formatRange()}
          {value?.from && (
            <IconX
              className="ml-auto h-4 w-4 opacity-50 hover:opacity-100"
              onClick={handleClear}
            />
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <div className="flex">
          {presets.length > 0 && (
            <div className="border-r px-3 py-2">
              <div className="text-sm font-medium mb-2">Predefinições</div>
              <div className="space-y-1">
                {presets.map((preset) => (
                  <Button
                    key={preset.label}
                    variant="ghost"
                    size="sm"
                    className="w-full justify-start font-normal"
                    onClick={() => handlePresetClick(preset.value)}
                  >
                    {preset.label}
                  </Button>
                ))}
              </div>
            </div>
          )}
          <div className="p-3">
            <Calendar
              {...({
                mode: "range",
                selected: value,
                onSelect: (range: any) => onChange(range as DateRange),
                numberOfMonths: 2,
                locale: ptBR,
              } as any)}
            />
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
