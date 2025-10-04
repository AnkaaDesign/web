import { FormControl, FormField, FormItem, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";

interface QuantityCellProps {
  control: any;
  index: number;
}

export function QuantityCell({ control, index }: QuantityCellProps) {
  return (
    <FormField
      control={control}
      name={`activities.${index}.data.quantity`}
      render={({ field }) => (
        <FormItem>
          <FormControl>
            <Input type="decimal" decimals={2} min={0} className="h-8 text-sm" value={field.value} onChange={(value) => field.onChange(value || 0.01)} />
          </FormControl>
          <FormMessage className="text-xs" />
        </FormItem>
      )}
    />
  );
}
