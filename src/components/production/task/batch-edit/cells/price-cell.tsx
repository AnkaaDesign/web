// apps/web/src/components/production/task/batch-edit/cells/price-cell.tsx

import { Input } from "@/components/ui/input";
import { FormField, FormItem, FormControl } from "@/components/ui/form";

interface PriceCellProps {
  control: any;
  index: number;
}

export function PriceCell({ control, index }: PriceCellProps) {
  // Defensive check to prevent undefined field names
  if (typeof index !== "number" || index < 0) {
    if (process.env.NODE_ENV !== 'production') {
      console.error("PriceCell: Invalid index provided:", index);
    }
    return <div className="text-red-500 text-xs">Error: Invalid index</div>;
  }

  const formatCurrency = (value: number) => {
    if (isNaN(value)) return "";
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(value);
  };

  const parseCurrency = (value: string) => {
    const numericValue = value.replace(/[^0-9,-]/g, "").replace(",", ".");
    return numericValue ? parseFloat(numericValue) : 0;
  };

  return (
    <FormField
      control={control}
      name={`tasks.${index}.data.price`}
      render={({ field }) => (
        <FormItem>
          <FormControl>
            <Input
              {...field}
              value={formatCurrency(field.value || 0)}
              onChange={(value) => {
                const parsedValue = parseCurrency(typeof value === 'string' ? value : String(value ?? '0'));
                field.onChange(parsedValue);
              }}
              placeholder="R$ 0,00"
              className="transition-all duration-200"
            />
          </FormControl>
        </FormItem>
      )}
    />
  );
}
