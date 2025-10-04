import type { PositionCreateFormData, PositionUpdateFormData } from "../../../../schemas";

import { FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from "@/components/ui/form";
import { Switch } from "@/components/ui/switch";

interface BonifiableToggleProps {
  control: any;
  disabled?: boolean;
  required?: boolean;
}

export function BonifiableToggle({ control, disabled, required }: BonifiableToggleProps) {
  return (
    <FormField
      control={control}
      name="bonifiable"
      render={({ field }) => (
        <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
          <div className="space-y-0.5">
            <FormLabel className="text-base">
              Cargo Bonificável {required && <span className="text-destructive">*</span>}
            </FormLabel>
            <FormDescription>
              Define se o cargo é elegível para receber bonificações baseadas em performance
            </FormDescription>
          </div>
          <FormControl>
            <Switch
              checked={field.value || false}
              onCheckedChange={field.onChange}
              disabled={disabled}
            />
          </FormControl>
          <FormMessage />
        </FormItem>
      )}
    />
  );
}