import { Switch } from "@/components/ui/switch";
import { FormField, FormItem, FormControl, FormLabel } from "@/components/ui/form";

interface StatusCellProps {
  control: any;
  index: number;
  disabled?: boolean;
}

export function StatusCell({ control, index, disabled }: StatusCellProps) {
  return (
    <FormField
      control={control}
      name={`items.${index}.data.isActive`}
      render={({ field }) => (
        <FormItem className="flex items-center">
          <FormControl>
            <Switch checked={field.value} onCheckedChange={field.onChange} disabled={disabled} />
          </FormControl>
        </FormItem>
      )}
    />
  );
}
