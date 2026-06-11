import { FormControl, FormField, FormItem, FormLabel } from "@/components/ui/form";
import { Switch } from "@/components/ui/switch";
import { useFormContext } from "react-hook-form";
import { IconTransferIn } from "@tabler/icons-react";
import type { ItemCreateFormData, ItemUpdateFormData } from "../../../../schemas";

type FormData = ItemCreateFormData | ItemUpdateFormData;

interface BorrowableToggleProps {
  disabled?: boolean;
}

// Capability-fields contract: borrow eligibility is item.isBorrowable
// (category.type is UI grouping only — borrowable items may live anywhere).
export function BorrowableToggle({ disabled }: BorrowableToggleProps) {
  const form = useFormContext<FormData>();

  return (
    <FormField
      control={form.control}
      name="isBorrowable"
      render={({ field }) => (
        <FormItem className="flex flex-row items-center justify-between space-x-2">
          <div className="space-y-0.5">
            <FormLabel className="text-base flex items-center gap-2">
              <IconTransferIn className="h-4 w-4" />
              Emprestável
            </FormLabel>
            <p className="text-sm text-muted-foreground">Item pode ser emprestado a colaboradores</p>
          </div>
          <FormControl>
            <Switch checked={field.value ?? false} onCheckedChange={field.onChange} disabled={disabled} />
          </FormControl>
        </FormItem>
      )}
    />
  );
}
