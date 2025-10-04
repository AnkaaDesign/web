import type { VacationCreateFormData, VacationUpdateFormData } from "../../../../schemas";

import { FormControl, FormDescription, FormField, FormItem, FormLabel } from "@/components/ui/form";
import { Switch } from "@/components/ui/switch";

interface CollectiveSwitchProps {
  control: any;
  disabled?: boolean;
}

export function CollectiveSwitch({ control, disabled }: CollectiveSwitchProps) {
  return (
    <FormField
      control={control}
      name="isCollective"
      render={({ field }) => (
        <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
          <div className="space-y-0.5">
            <FormLabel className="text-base">Férias Coletivas</FormLabel>
            <FormDescription>Marque se estas férias fazem parte de um período coletivo</FormDescription>
          </div>
          <FormControl>
            <Switch checked={field.value} onCheckedChange={field.onChange} disabled={disabled} />
          </FormControl>
        </FormItem>
      )}
    />
  );
}
