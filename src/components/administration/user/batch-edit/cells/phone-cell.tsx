import { FormField, FormItem, FormControl, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";

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
              ref={field.ref}
              type="phone"
              value={field.value || ""}
              onChange={(value: string | number | null) => field.onChange(value || null)}
              onBlur={field.onBlur}
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
