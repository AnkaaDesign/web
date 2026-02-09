import { FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from "@/components/ui/form";
import { Input } from "@/components/ui/input";

interface NameInputProps {
  control: any;
  disabled?: boolean;
  required?: boolean;
}

export function NameInput({ control, disabled, required }: NameInputProps) {
  return (
    <FormField
      control={control}
      name="name"
      render={({ field }) => {
        const characterCount = (field.value || "").length;

        return (
          <FormItem>
            <FormLabel>Nome do Setor {required && <span className="text-destructive">*</span>}</FormLabel>
            <FormControl>
              <Input
                {...field}
                placeholder="Ex: Recursos Humanos, Produção, Financeiro"
                disabled={disabled}
                transparent={true}
                maxLength={100}
              />
            </FormControl>
            <FormDescription className="flex justify-between text-xs">
              <span>Nome único para identificar o setor</span>
              <span className={characterCount > 90 ? "text-orange-500" : "text-muted-foreground"}>{characterCount}/100</span>
            </FormDescription>
            <FormMessage />
          </FormItem>
        );
      }}
    />
  );
}
