import { FormField, FormItem, FormControl, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import type { UserBatchEditFormData } from "../types";

interface PhoneCellProps {
  control: any;
  index: number;
  disabled?: boolean;
}

export function PhoneCell({ control, index, disabled }: PhoneCellProps) {
  return (
    <FormField
      control={control}
      name={`users.${index}.data.phone`}
      render={({ field }) => (
        <FormItem>
          <FormControl>
            <Input
              {...field}
              type="phone"
              value={field.value || ""}
              onChange={(value) => field.onChange(value || null)}
              disabled={disabled}
              placeholder="(00) 00000-0000"
              className="h-8"
            />
          </FormControl>
          <FormMessage />
        </FormItem>
      )}
    />
  );
}
