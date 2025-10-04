import { FormControl, FormField, FormItem, FormLabel } from "@/components/ui/form";
import { Switch } from "@/components/ui/switch";
import { useFormContext } from "react-hook-form";
import { IconCircleCheck } from "@tabler/icons-react";
import type { ItemCreateFormData, ItemUpdateFormData } from "../../../../schemas";

type FormData = ItemCreateFormData | ItemUpdateFormData;

interface StatusToggleProps {
  disabled?: boolean;
}

export function StatusToggle({ disabled }: StatusToggleProps) {
  const form = useFormContext<FormData>();

  return (
    <FormField
      control={form.control}
      name="isActive"
      render={({ field }) => (
        <FormItem className="flex flex-row items-center justify-between space-x-2">
          <div className="space-y-0.5">
            <FormLabel className="text-base flex items-center gap-2">
              <IconCircleCheck className="h-4 w-4" />
              Item Ativo
            </FormLabel>
            <p className="text-sm text-muted-foreground">Item está ativo e disponível no sistema</p>
          </div>
          <FormControl>
            <Switch checked={field.value} onCheckedChange={field.onChange} disabled={disabled} />
          </FormControl>
        </FormItem>
      )}
    />
  );
}
