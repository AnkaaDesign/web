import { FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Combobox } from "@/components/ui/combobox";
import { useFormContext } from "react-hook-form";
import { IconChartDots } from "@tabler/icons-react";
import { STOCK_MODEL, STOCK_MODEL_LABELS } from "../../../../constants";
import type { ItemCreateFormData, ItemUpdateFormData } from "../../../../schemas";

type FormData = ItemCreateFormData | ItemUpdateFormData;

interface StockModelSelectorProps {
  disabled?: boolean;
}

// Capability-fields contract: stock math model is item.stockModel —
// CONSUMPTION uses the consumption-driven rp/max bands; FIXED_TARGET holds a
// fixed quantity on the shelf (fixedTargetQuantity, fallback 1).
export function StockModelSelector({ disabled }: StockModelSelectorProps) {
  const form = useFormContext<FormData>();

  const options = Object.values(STOCK_MODEL).map((model) => ({
    value: model,
    label: STOCK_MODEL_LABELS[model],
  }));

  return (
    <FormField
      control={form.control}
      name="stockModel"
      render={({ field }) => (
        <FormItem>
          <FormLabel className="flex items-center gap-2">
            <IconChartDots className="h-4 w-4" />
            Modelo de Estoque
          </FormLabel>
          <FormControl>
            <Combobox
              options={options}
              value={field.value ?? STOCK_MODEL.CONSUMPTION}
              onValueChange={(value) => {
                field.onChange(value);
                // fixedTargetQuantity is only meaningful for FIXED_TARGET —
                // the API rejects it when set with CONSUMPTION.
                if (value !== STOCK_MODEL.FIXED_TARGET) {
                  form.setValue("fixedTargetQuantity", null, { shouldDirty: true, shouldValidate: true });
                }
              }}
              placeholder="Selecione o modelo de estoque"
              disabled={disabled}
              searchable={false}
              clearable={false}
            />
          </FormControl>
          <FormMessage />
        </FormItem>
      )}
    />
  );
}
