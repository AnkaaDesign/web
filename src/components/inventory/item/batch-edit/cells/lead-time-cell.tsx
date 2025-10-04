import { Input } from "@/components/ui/input";
import { FormField, FormItem, FormControl } from "@/components/ui/form";

interface LeadTimeCellProps {
  control: any;
  index: number;
  disabled?: boolean;
}

export function LeadTimeCell({ control, index, disabled }: LeadTimeCellProps) {
  return (
    <FormField
      control={control}
      name={`items.${index}.data.estimatedLeadTime`}
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
