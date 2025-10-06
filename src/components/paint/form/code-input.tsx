import { FormField, FormItem, FormLabel, FormControl, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { IconBarcode } from "@tabler/icons-react";

interface CodeInputProps {
  control: any;
  required?: boolean;
}

export function CodeInput({ control, required = false }: CodeInputProps) {
  return (
    <FormField
      control={control}
      name="code"
      render={({ field }) => (
        <FormItem>
          <FormLabel className="flex items-center gap-2">
            <IconBarcode className="h-4 w-4" />
            Código
            {required && <span className="text-destructive ml-1">*</span>}
          </FormLabel>
          <FormControl>
            <Input
              {...field}
              value={field.value || ""}
              placeholder="Ex: PPG123, FAR456"
              maxLength={20}
              onChange={(e) => {
                // Convert to uppercase for consistency
                const value = e.target.value.toUpperCase();
                field.onChange(value || null);
              }}
              className="bg-transparent"
            />
          </FormControl>
          <FormMessage />
        </FormItem>
      )}
    />
  );
}
