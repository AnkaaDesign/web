import { FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from "@/components/ui/form";
import { Checkbox } from "@/components/ui/checkbox";

interface BonifiableToggleProps {
  control: any;
  disabled?: boolean;
  required?: boolean;
}

export function BonifiableToggle({ control, disabled, required }: BonifiableToggleProps) {
  return (
    <FormField
      control={control}
      name="bonifiable"
      render={({ field }) => (
        <FormItem className="flex h-full flex-row items-start gap-3 space-y-0 rounded-lg border border-border/50 bg-muted/20 p-4">
          <FormControl>
            <Checkbox checked={!!field.value} onCheckedChange={field.onChange} disabled={disabled} className="mt-0.5" />
          </FormControl>
          <div className="space-y-1 leading-none">
            <FormLabel className="cursor-pointer">Cargo Bonificável {required && <span className="text-destructive">*</span>}</FormLabel>
            <FormDescription>Define se o cargo é elegível para receber bonificações baseadas em performance</FormDescription>
            <FormMessage />
          </div>
        </FormItem>
      )}
    />
  );
}
