import { FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from "@/components/ui/form";
import { Switch } from "@/components/ui/switch";

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
        <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
          <div className="space-y-0.5">
            <FormLabel className="text-base">Periculosidade (NR-16)</FormLabel>
            <FormDescription>Adicional de 30% sobre o salário-base. Mutuamente exclusivo com insalubridade.</FormDescription>
          </div>
          <FormControl>
            <Switch checked={field.value || false} onCheckedChange={field.onChange} disabled={disabled} />
          </FormControl>
          <FormMessage />
        </FormItem>
      )}
    />
  );
}
