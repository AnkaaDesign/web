// apps/web/src/components/production/task/batch-edit/cells/date-cell.tsx

import { FormField, FormItem, FormControl } from "@/components/ui/form";
import { DateTimeInput } from "@/components/ui/date-time-input";

interface DateCellProps {
  control: any;
  name: string;
  placeholder?: string;
}

export function DateCell({ control, name, placeholder }: DateCellProps) {
  return (
    <FormField
      control={control}
      name={name}
      render={({ field }) => (
        <FormItem>
          <FormControl>
            {/* @ts-expect-error - component prop mismatch */}
            <DateTimeInput value={field.value} onChange={field.onChange} placeholder={placeholder} timeInput={false} />
          </FormControl>
        </FormItem>
      )}
    />
  );
}
