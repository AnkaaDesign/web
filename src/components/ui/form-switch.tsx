import { FormControl, FormField, FormItem, FormLabel, FormDescription } from "@/components/ui/form";
import { Switch } from "@/components/ui/switch";
import { useFormContext, type Path } from "react-hook-form";
import { cn } from "@/lib/utils";
import React from "react";

interface FormSwitchProps<T extends Record<string, any>> {
  name: Path<T>;
  label?: string;
  description?: string;
  disabled?: boolean;
  icon?: React.ReactNode;
  className?: string;
}

export function FormSwitch<T extends Record<string, any>>({
  name,
  label,
  description,
  disabled = false,
  icon,
  className,
}: FormSwitchProps<T>) {
  const form = useFormContext<T>();

  return (
    <FormField
      control={form.control}
      name={name}
      render={({ field }) => (
        <FormItem className={cn("flex flex-row items-center justify-between rounded-lg border p-3 shadow-sm", className)}>
          <div className="space-y-0.5">
            {label && (
              <FormLabel className="flex items-center gap-2 text-base cursor-pointer">
                {icon}
                {label}
              </FormLabel>
            )}
            {description && (
              <FormDescription className="text-sm text-muted-foreground">
                {description}
              </FormDescription>
            )}
          </div>
          <FormControl>
            <Switch
              checked={field.value}
              onCheckedChange={field.onChange}
              disabled={disabled}
            />
          </FormControl>
        </FormItem>
      )}
    />
  );
}
