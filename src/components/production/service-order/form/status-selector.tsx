import { FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Combobox } from "@/components/ui/combobox";
import type { ServiceOrderCreateFormData, ServiceOrderUpdateFormData } from "../../../../schemas";
import { SERVICE_ORDER_STATUS, SERVICE_ORDER_STATUS_LABELS } from "../../../../constants";
import { Badge } from "@/components/ui/badge";
import { getBadgeVariant } from "@/lib/utils";

interface StatusSelectorProps {
  control: any;
  disabled?: boolean;
}

export function StatusSelector({ control, disabled }: StatusSelectorProps) {
  const statusOptions = Object.values(SERVICE_ORDER_STATUS).map((status) => ({
    value: status,
    label: SERVICE_ORDER_STATUS_LABELS[status],
  }));

  return (
    <FormField
      control={control}
      name="status"
      render={({ field }) => (
        <FormItem>
          <FormLabel>Status</FormLabel>
          <FormControl>
            <Combobox
              value={field.value}
              onValueChange={field.onChange}
              disabled={disabled}
              options={statusOptions}
              placeholder="Selecione o status..."
              searchable={false}
              renderValue={(option) => (
                <div className="flex items-center space-x-2">
                  <Badge variant={getBadgeVariant("serviceOrderStatus", field.value)}>{SERVICE_ORDER_STATUS_LABELS[field.value as SERVICE_ORDER_STATUS]}</Badge>
                </div>
              )}
              renderOption={(option) => (
                <div className="flex items-center space-x-2">
                  <Badge variant={getBadgeVariant("serviceOrderStatus", option.value)}>{option.label}</Badge>
                </div>
              )}
            />
          </FormControl>
          <FormMessage />
        </FormItem>
      )}
    />
  );
}
