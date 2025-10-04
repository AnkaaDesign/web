// apps/web/src/components/production/task/batch-edit/cells/date-time-cell.tsx

import { FormField, FormItem, FormControl } from "@/components/ui/form";
import { DateTimeInput } from "@/components/ui/date-time-input";

interface DateTimeCellProps {
  control: any;
  name: string;
  placeholder?: string;
}

export function DateTimeCell({ control, name, placeholder }: DateTimeCellProps) {
  return (
    <FormField
      control={control}
      name={name}
      render={({ field }) => (
        <FormItem>
          <FormControl>
            <DateTimeInput value={field.value} onChange={field.onChange} placeholder={placeholder} />
          </FormControl>
        </FormItem>
      )}
    />
  );
}
