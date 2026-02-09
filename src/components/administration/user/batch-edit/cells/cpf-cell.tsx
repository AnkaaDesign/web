import { FormField, FormItem, FormControl, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";

interface CpfCellProps {
  control: any;
  index: number;
  disabled?: boolean;
}

export function CpfCell({ control, index, disabled }: CpfCellProps) {
  return (
    <FormField
      control={control}
      name={`users.${index}.data.cpf`}
      render={({ field }) => (
        <FormItem>
          <FormControl>
            <Input
              type="cpf"
              value={field.value ?? ""}
              onChange={(value: string | number | null) => {
                field.onChange(value ?? null);
              }}
              disabled={disabled}
              onBlur={field.onBlur}
              placeholder="Digite o CPF"
              className="h-8"
            />
          </FormControl>
          <FormMessage />
        </FormItem>
      )}
    />
  );
}
