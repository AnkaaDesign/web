import { Input } from "@/components/ui/input";
import { FormField, FormItem, FormControl } from "@/components/ui/form";

interface ReorderPointCellProps {
  control: any;
  index: number;
  disabled?: boolean;
}

export function ReorderPointCell({ control, index, disabled }: ReorderPointCellProps) {
  return (
    <FormField
      control={control}
      name={`items.${index}.data.reorderPoint`}
      render={({ field }) => (
        <FormItem>
          <FormControl>
            <Input type="number" min={0} disabled={disabled} className="h-10" placeholder="0" value={field.value} onChange={(value) => field.onChange(value)} />
          </FormControl>
        </FormItem>
      )}
    />
  );
}
