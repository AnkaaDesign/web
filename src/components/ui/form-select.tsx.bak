import * as React from "react";
import { useFormContext } from "react-hook-form";
import { FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";

interface FormSelectOption {
  value: string;
  label: string;
}

interface FormSelectProps {
  name: string;
  label?: string;
  description?: string;
  placeholder?: string;
  options: FormSelectOption[];
  disabled?: boolean;
  required?: boolean;
  icon?: React.ReactNode;
  className?: string;
  triggerClassName?: string;
  emptyText?: string;
  allowClear?: boolean;
}

export function FormSelect({
  name,
  label,
  description,
  placeholder = "Selecione uma opção",
  options,
  disabled = false,
  required = false,
  icon,
  className,
  triggerClassName,
  emptyText = "Nenhuma opção disponível",
  allowClear = true,
}: FormSelectProps) {
  const form = useFormContext();

  return (
    <FormField
      control={form.control}
      name={name}
      render={({ field }) => (
        <FormItem className={className}>
          {label && (
            <FormLabel className="flex items-center gap-2">
              {icon}
              {label}
              {required && <span className="text-destructive ml-1">*</span>}
            </FormLabel>
          )}
          <Select
            disabled={disabled}
            value={field.value || ""}
            onValueChange={(value) => {
              // Handle clear selection
              field.onChange(value === "__CLEAR__" ? undefined : value);
            }}
          >
            <FormControl>
              <SelectTrigger 
                className={cn(
                  "transition-all duration-200",
                  "hover:bg-primary hover:text-primary-foreground",
                  "focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                  triggerClassName
                )}
              >
                <SelectValue 
                  placeholder={`${placeholder}${required ? '' : ' (opcional)'}`}
                />
              </SelectTrigger>
            </FormControl>
            <SelectContent>
              {/* Clear option - only show if allowClear is true and a value is selected */}
              {allowClear && field.value && (
                <SelectItem value="__CLEAR__">
                  <span className="text-muted-foreground">Limpar seleção</span>
                </SelectItem>
              )}
              
              {/* Options */}
              {options.length > 0 ? (
                options.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))
              ) : (
                <div className="px-2 py-4 text-center text-sm text-muted-foreground">
                  {emptyText}
                </div>
              )}
            </SelectContent>
          </Select>
          {description && <FormDescription>{description}</FormDescription>}
          <FormMessage />
        </FormItem>
      )}
    />
  );
}

// Convenience wrapper for status selectors with common enum pattern
interface FormStatusSelectProps extends Omit<FormSelectProps, "options"> {
  statusEnum: Record<string, string>;
  statusLabels: Record<string, string>;
}

export function FormStatusSelect({ 
  statusEnum, 
  statusLabels, 
  ...props 
}: FormStatusSelectProps) {
  const options = React.useMemo(() => 
    Object.values(statusEnum).map(value => ({
      value,
      label: statusLabels[value] || value,
    })), 
    [statusEnum, statusLabels]
  );

  return (
    <FormSelect
      {...props}
      options={options}
    />
  );
}

// Convenience wrapper for Brazilian states
interface FormBrazilianStateSelectProps extends Omit<FormSelectProps, "options"> {
  states: Record<string, string>;
  stateLabels: Record<string, string>;
}

export function FormBrazilianStateSelect({ 
  states, 
  stateLabels, 
  ...props 
}: FormBrazilianStateSelectProps) {
  const options = React.useMemo(() => 
    Object.values(states).map(state => ({
      value: state,
      label: `${stateLabels[state]} (${state})`,
    })), 
    [states, stateLabels]
  );

  return (
    <FormSelect
      {...props}
      options={options}
      placeholder="Selecione o estado"
      emptyText="Nenhum estado encontrado"
    />
  );
}