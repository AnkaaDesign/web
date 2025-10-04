import { FormField, FormItem, FormControl, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";

interface CnpjCellProps {
  control: any;
  index: number;
  disabled?: boolean;
}

export function CnpjCell({ control, index, disabled }: CnpjCellProps) {
  return (
    <FormField
      control={control}
      name={`suppliers.${index}.data.cnpj`}
      render={({ field }) => (
        <FormItem>
          <FormControl>
            <Input
              type="cnpj"
              value={field.value ?? ""}
              onChange={(value) => {
                field.onChange(value ?? null);
              }}
              disabled={disabled}
              onBlur={field.onBlur}
              placeholder="00.000.000/0000-00"
              className="h-8"
            />
          </FormControl>
          <FormMessage />
        </FormItem>
      )}
    />
  );
}
