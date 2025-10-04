import { FormControl, FormField, FormItem, FormLabel } from "@/components/ui/form";
import { Switch } from "@/components/ui/switch";
import { useFormContext } from "react-hook-form";
import { IconUserCheck } from "@tabler/icons-react";
import type { ItemCreateFormData, ItemUpdateFormData } from "../../../../schemas";

type FormData = ItemCreateFormData | ItemUpdateFormData;

interface AssignToUserToggleProps {
  disabled?: boolean;
}

export function AssignToUserToggle({ disabled }: AssignToUserToggleProps) {
  const form = useFormContext<FormData>();

  return (
    <FormField
      control={form.control}
      name="shouldAssignToUser"
      render={({ field }) => (
        <FormItem className="flex flex-row items-center justify-between space-x-2">
          <div className="space-y-0.5">
            <FormLabel className="text-base flex items-center gap-2">
              <IconUserCheck className="h-4 w-4" />
              Atribuir ao Usuário
            </FormLabel>
            <p className="text-sm text-muted-foreground">Item pode ser atribuído a usuários</p>
          </div>
          <FormControl>
            <Switch checked={field.value} onCheckedChange={field.onChange} disabled={disabled} />
          </FormControl>
        </FormItem>
      )}
    />
  );
}
