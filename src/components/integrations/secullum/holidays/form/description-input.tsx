import { FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";

interface DescriptionInputProps {
  control: any;
  disabled?: boolean;
  required?: boolean;
}

export function DescriptionInput({ control, disabled, required }: DescriptionInputProps) {
  return (
    <FormField
      control={control}
      name="Descricao"
      render={({ field }) => (
        <FormItem className="flex flex-col">
          <FormLabel>Descrição {required && <span className="text-destructive">*</span>}</FormLabel>
          <FormControl>
            <Input
              value={field.value}
              onChange={field.onChange}
              onBlur={field.onBlur}
              name={field.name}
              ref={field.ref}
              placeholder="Ex: Dia da Independência, Natal, Ano Novo"
              disabled={disabled}
              maxLength={100}
              className="w-full"
            />
          </FormControl>
          <div className="flex justify-between items-center">
            <FormMessage />
            <span className="text-xs text-muted-foreground">{field.value?.length || 0}/100</span>
          </div>
        </FormItem>
      )}
    />
  );
}
