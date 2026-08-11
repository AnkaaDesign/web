import { FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from "@/components/ui/form";
import { Checkbox } from "@/components/ui/checkbox";

interface HazardPayToggleProps {
  control: any;
  disabled?: boolean;
}

/**
 * Periculosidade (NR-16): adicional de 30% sobre o salário-base. Mutuamente
 * exclusivo com insalubridade (validado no service da api).
 */
export function HazardPayToggle({ control, disabled }: HazardPayToggleProps) {
  return (
    <FormField
      control={control}
      name="hazardPay"
      render={({ field }) => (
        <FormItem className="flex h-full flex-row items-start gap-3 space-y-0 rounded-lg border border-border/50 bg-muted/20 p-4">
          <FormControl>
            <Checkbox checked={!!field.value} onCheckedChange={field.onChange} disabled={disabled} className="mt-0.5" />
          </FormControl>
          <div className="space-y-1 leading-none">
            <FormLabel className="cursor-pointer">Periculosidade (NR-16)</FormLabel>
            <FormDescription>Adicional de 30% sobre o salário-base. Mutuamente exclusivo com insalubridade.</FormDescription>
            <FormMessage />
          </div>
        </FormItem>
      )}
    />
  );
}
