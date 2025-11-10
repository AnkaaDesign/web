import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";

export interface EnumOption<T = string> {
  value: T;
  label: string;
  icon?: React.ReactNode;
  disabled?: boolean;
}

export interface EnumFilterProps<T = string> {
  value: T | undefined;
  onChange: (value: T | undefined) => void;
  options: EnumOption<T>[];
  placeholder?: string;
  className?: string;
  allowClear?: boolean;
}

export function EnumFilter<T extends string = string>({
  value,
  onChange,
  options,
  placeholder = "Selecione...",
  className,
  allowClear = true,
}: EnumFilterProps<T>) {
  return (
    <Select
      value={value}
      onValueChange={(newValue) => {
        if (newValue === "__clear__" && allowClear) {
          onChange(undefined);
        } else {
          onChange(newValue as T);
        }
      }}
    >
      <SelectTrigger className={cn(className)}>
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        {allowClear && value && (
          <SelectItem value="__clear__">
            <span className="text-muted-foreground">Limpar seleção</span>
          </SelectItem>
        )}
        {options.map((option) => (
          <SelectItem
            key={String(option.value)}
            value={String(option.value)}
            disabled={option.disabled}
          >
            <div className="flex items-center gap-2">
              {option.icon}
              <span>{option.label}</span>
            </div>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
