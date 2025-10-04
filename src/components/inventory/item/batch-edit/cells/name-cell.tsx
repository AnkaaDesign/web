import { Input } from "@/components/ui/input";
import { FormField, FormItem, FormControl } from "@/components/ui/form";

interface NameCellProps {
  control: any;
  index: number;
  disabled?: boolean;
}

export function NameCell({ control, index, disabled }: NameCellProps) {
  return (
    <FormField
      control={control}
      name={`items.${index}.data.name`}
      render={({ field }) => (
        <FormItem>
          <FormControl>
            <Input
              value={field.value || ""}
              onChange={(value) => {
                field.onChange(value);
              }}
              name={field.name}
              onBlur={field.onBlur}
              ref={field.ref}
              disabled={disabled}
              className="h-10"
              placeholder="Nome do produto"
            />
          </FormControl>
        </FormItem>
      )}
    />
  );
}
