import { FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";

interface LevelInputProps {
  control: any;
  disabled?: boolean;
  required?: boolean;
}

export function LevelInput({ control, disabled, required }: LevelInputProps) {
  return (
    <FormField
      control={control}
      name="level"
      render={({ field }) => (
        <FormItem>
          <FormLabel>Nível do Cargo {required && <span className="text-destructive">*</span>}</FormLabel>
          <FormControl>
            <Input type="number" min={0} max={10} step={1} placeholder="Ex: 5" disabled={disabled} value={field.value} onChange={(value) => field.onChange(value)} />
          </FormControl>
          <FormMessage />
        </FormItem>
      )}
    />
  );
}
