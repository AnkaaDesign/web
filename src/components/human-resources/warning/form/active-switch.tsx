import type { WarningCreateFormData, WarningUpdateFormData } from "../../../../schemas";

import { FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from "@/components/ui/form";
import { Switch } from "@/components/ui/switch";

interface ActiveSwitchProps {
  control: any;
  disabled?: boolean;
}

export function ActiveSwitch({ control, disabled }: ActiveSwitchProps) {
  return (
    <FormField
      control={control}
      name="isActive"
      render={({ field }) => (
        <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-lg border p-4">
          <FormControl>
            <Switch checked={field.value} onCheckedChange={field.onChange} disabled={disabled} />
          </FormControl>
          <div className="space-y-1 leading-none">
            <FormLabel>Advertência Ativa</FormLabel>
            <FormDescription>{field.value ? "A advertência está ativa e pendente de resolução" : "A advertência foi resolvida ou não está mais em vigor"}</FormDescription>
          </div>
          <FormMessage />
        </FormItem>
      )}
    />
  );
}
