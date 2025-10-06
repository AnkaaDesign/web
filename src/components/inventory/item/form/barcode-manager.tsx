import { useState } from "react";
import { useWatch, useFieldArray, useFormContext } from "react-hook-form";
import { FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { IconPlus, IconTrash, IconBarcode } from "@tabler/icons-react";
import type { ItemCreateFormData, ItemUpdateFormData } from "../../../../schemas";

type FormData = ItemCreateFormData | ItemUpdateFormData;

interface BarcodeManagerProps {
  disabled?: boolean;
}

export function BarcodeManager({ disabled }: BarcodeManagerProps) {
  const form = useFormContext<FormData>();
  const [newBarcode, setNewBarcode] = useState("");

  // For primitive arrays, we need to watch the value directly
  const watchedBarcodes = useWatch({
    control: form.control,
    name: "barcodes",
  });

  // Ensure barcodes is always an array
  const barcodes = Array.isArray(watchedBarcodes) ? watchedBarcodes : [];

  const { append, remove } = useFieldArray({
    control: form.control,
    name: "barcodes",
  });

  const handleAddBarcode = () => {
    if (newBarcode.trim() && !barcodes.includes(newBarcode.trim())) {
      append(newBarcode.trim());
      setNewBarcode("");
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleAddBarcode();
    }
  };

  return (
    <FormField
      control={form.control}
      name="barcodes"
      render={({ field }) => {
        // Ensure field.value is always an array
        if (!Array.isArray(field.value)) {
          field.onChange([]);
        }

        return (
          <FormItem>
            <FormLabel className="flex items-center gap-2">
              <IconBarcode className="h-4 w-4" />
              Códigos de Barras
            </FormLabel>

            <div className="space-y-2">
              <div className="flex gap-2">
                <Input value={newBarcode} onChange={(value) => setNewBarcode(value as string)} onKeyPress={handleKeyPress} placeholder="Digite o código de barras" disabled={disabled} transparent={true} />
                <Button type="button" onClick={handleAddBarcode} disabled={disabled || !newBarcode.trim()} size="icon">
                  <IconPlus className="h-4 w-4" />
                </Button>
              </div>

              {Array.isArray(barcodes) && barcodes.length > 0 && (
                <div className="space-y-2 mt-4">
                  {barcodes.map((barcode: string, index: number) => (
                    <div key={`barcode-${index}`} className="flex items-center gap-2">
                      <Input value={barcode} disabled className="flex-1" transparent={true} />
                      <Button type="button" onClick={() => remove(index)} disabled={disabled} size="icon" variant="destructive">
                        <IconTrash className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <FormMessage />
          </FormItem>
        );
      }}
    />
  );
}
