import { FormControl, FormField, FormItem, FormMessage } from "@/components/ui/form";
import { Combobox } from "@/components/ui/combobox";
import { ACTIVITY_REASON, ACTIVITY_REASON_LABELS } from "../../../../../constants";

interface ReasonCellProps {
  control: any;
  index: number;
}

export function ReasonCell({ control, index }: ReasonCellProps) {
  const options = [
    { value: "system", label: "Automático (pelo sistema)" },
    ...Object.values(ACTIVITY_REASON).map((reason) => ({
      value: reason,
      label: ACTIVITY_REASON_LABELS[reason],
    })),
  ];

  return (
    <FormField
      control={control}
      name={`activities.${index}.data.reason`}
      render={({ field }) => (
        <FormItem>
          <FormControl>
            <Combobox
              options={options}
              value={field.value || "system"}
              onValueChange={(value) => field.onChange(value === "system" ? undefined : value)}
              placeholder="Selecione um motivo"
              className="h-8 text-sm"
              searchable={false}
              clearable={false}
            />
          </FormControl>
          <FormMessage className="text-xs" />
        </FormItem>
      )}
    />
  );
}
