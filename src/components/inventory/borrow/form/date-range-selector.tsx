import type { DateRange } from "react-day-picker";
import { FormField } from "@/components/ui/form";
import { DateTimeInput } from "@/components/ui/date-time-input";

interface DateRangeSelectorProps {
  control: any;
  name: "createdAt" | "returnedAt";
  label: string;
  description?: string;
  disabled?: boolean;
  placeholder?: string;
}

export function DateRangeSelector({ control, name, label, description, disabled, placeholder = "Selecione um período" }: DateRangeSelectorProps) {
  return (
    <FormField
      control={control}
      name={name}
      render={({ field }) => {
        // Convert from our API format to DateRange format
        const dateRange: DateRange | undefined = field.value
          ? {
              from: field.value.gte ? new Date(field.value.gte) : undefined,
              to: field.value.lte ? new Date(field.value.lte) : undefined,
            }
          : undefined;

        // Handle DateRange changes and convert back to API format
        const handleDateRangeChange = (range: DateRange | null) => {
          if (!range) {
            field.onChange(undefined);
            return;
          }

          const newValue: { gte?: Date; lte?: Date } = {};

          if (range.from) {
            newValue.gte = range.from;
          }

          if (range.to) {
            newValue.lte = range.to;
          }

          // Only set the value if we have at least one date
          field.onChange(Object.keys(newValue).length > 0 ? newValue : undefined);
        };

        return (
          <DateTimeInput
            field={field}
            mode="date-range"
            value={dateRange}
            onChange={handleDateRangeChange}
            label={label}
            placeholder={placeholder}
            description={description}
            disabled={disabled}
            numberOfMonths={2}
          />
        );
      }}
    />
  );
}

// Standalone version without form integration
interface StandaloneDateRangeSelectorProps {
  value?: { gte?: Date; lte?: Date };
  onChange: (value: { gte?: Date; lte?: Date } | undefined) => void;
  label?: string;
  description?: string;
  disabled?: boolean;
  placeholder?: string;
  className?: string;
}

export function StandaloneDateRangeSelector({ value, onChange, label, description, disabled, placeholder = "Selecione um período", className }: StandaloneDateRangeSelectorProps) {
  // Convert from our API format to DateRange format
  const dateRange: DateRange | undefined = value
    ? {
        from: value.gte ? new Date(value.gte) : undefined,
        to: value.lte ? new Date(value.lte) : undefined,
      }
    : undefined;

  // Handle DateRange changes and convert back to API format
  const handleDateRangeChange = (range: DateRange | undefined) => {
    if (!range) {
      onChange(undefined);
      return;
    }

    const newValue: { gte?: Date; lte?: Date } = {};

    if (range.from) {
      newValue.gte = range.from;
    }

    if (range.to) {
      newValue.lte = range.to;
    }

    // Only set the value if we have at least one date
    onChange(Object.keys(newValue).length > 0 ? newValue : undefined);
  };

  return (
    <div className={className}>
      {label && <label className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 mb-2 block">{label}</label>}
      <DateRangePicker dateRange={dateRange} onDateRangeChange={handleDateRangeChange} placeholder={placeholder} disabled={disabled} className="w-full" />
      {description && <p className="text-sm text-muted-foreground mt-2">{description}</p>}
    </div>
  );
}
