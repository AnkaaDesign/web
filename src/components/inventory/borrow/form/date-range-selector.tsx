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

export function DateRangeSelector({ control, name, label, description, disabled }: DateRangeSelectorProps) {
  return (
    <FormField
      control={control}
      name={name}
      render={({ field }) => {
        // Handle date changes for the "from" field
        const handleFromChange = (date: Date | null) => {
          const currentValue = field.value || {};

          if (!date && !currentValue.lte) {
            field.onChange(undefined);
          } else {
            field.onChange({
              ...(date && { gte: date }),
              ...(currentValue.lte && { lte: currentValue.lte }),
            });
          }
        };

        // Handle date changes for the "to" field
        const handleToChange = (date: Date | null) => {
          const currentValue = field.value || {};

          if (!date && !currentValue.gte) {
            field.onChange(undefined);
          } else {
            field.onChange({
              ...(currentValue.gte && { gte: currentValue.gte }),
              ...(date && { lte: date }),
            });
          }
        };

        return (
          <div className="space-y-3">
            <div className="text-sm font-medium">{label}</div>
            {description && <p className="text-sm text-muted-foreground">{description}</p>}
            <div className="grid grid-cols-2 gap-3 pl-6">
              <DateTimeInput
                mode="date"
                value={field.value?.gte}
                onChange={handleFromChange}
                label="De"
                placeholder="Selecionar data inicial..."
                disabled={disabled}
              />
              <DateTimeInput
                mode="date"
                value={field.value?.lte}
                onChange={handleToChange}
                label="Até"
                placeholder="Selecionar data final..."
                disabled={disabled}
              />
            </div>
          </div>
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

export function StandaloneDateRangeSelector({ value, onChange, label, description, disabled, className }: StandaloneDateRangeSelectorProps) {
  // Handle date changes for the "from" field
  const handleFromChange = (date: Date | null) => {
    if (!date && !value?.lte) {
      onChange(undefined);
    } else {
      onChange({
        ...(date && { gte: date }),
        ...(value?.lte && { lte: value.lte }),
      });
    }
  };

  // Handle date changes for the "to" field
  const handleToChange = (date: Date | null) => {
    if (!date && !value?.gte) {
      onChange(undefined);
    } else {
      onChange({
        ...(value?.gte && { gte: value.gte }),
        ...(date && { lte: date }),
      });
    }
  };

  return (
    <div className={className}>
      <div className="space-y-3">
        {label && <div className="text-sm font-medium">{label}</div>}
        {description && <p className="text-sm text-muted-foreground">{description}</p>}
        <div className="grid grid-cols-2 gap-3 pl-6">
          <DateTimeInput
            mode="date"
            value={value?.gte}
            onChange={handleFromChange}
            label="De"
            placeholder="Selecionar data inicial..."
            disabled={disabled}
          />
          <DateTimeInput
            mode="date"
            value={value?.lte}
            onChange={handleToChange}
            label="Até"
            placeholder="Selecionar data final..."
            disabled={disabled}
          />
        </div>
      </div>
    </div>
  );
}
