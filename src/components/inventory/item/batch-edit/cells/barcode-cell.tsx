import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { FormField, FormItem, FormControl } from "@/components/ui/form";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Input } from "@/components/ui/input";
import { IconPlus, IconX, IconBarcode } from "@tabler/icons-react";
import { useState } from "react";

interface BarcodeCellProps {
  control: any;
  index: number;
  disabled?: boolean;
}

export function BarcodeCell({ control, index, disabled }: BarcodeCellProps) {
  const [newBarcode, setNewBarcode] = useState("");
  const [isOpen, setIsOpen] = useState(false);

  return (
    <FormField
      control={control}
      name={`items.${index}.data.barcodes`}
      render={({ field }) => {
        const barcodes = field.value || [];

        const addBarcode = () => {
          if (newBarcode && !barcodes.includes(newBarcode)) {
            field.onChange([...barcodes, newBarcode]);
            setNewBarcode("");
          }
        };

        const removeBarcode = (barcode: string) => {
          field.onChange(barcodes.filter((b: string) => b !== barcode));
        };

        return (
          <FormItem>
            <FormControl>
              <Popover open={isOpen} onOpenChange={setIsOpen}>
                <PopoverTrigger asChild>
                  <Button type="button" variant="outline" size="sm" disabled={disabled} className="h-10 w-full justify-start bg-transparent hover:bg-muted">
                    <IconBarcode className="mr-2 h-4 w-4" />
                    {barcodes.length > 0 ? <span>{barcodes.length} código(s)</span> : <span className="text-muted-foreground">Adicionar</span>}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-80 p-3" align="start">
                  <div className="space-y-3">
                    <div className="flex gap-2">
                      <Input
                        value={newBarcode}
                        onChange={(value) => setNewBarcode(value as string)}
                        placeholder="Código de barras"
                        className="h-10"
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                            addBarcode();
                          }
                        }}
                      />
                      <Button type="button" size="sm" onClick={addBarcode} disabled={!newBarcode}>
                        <IconPlus className="h-4 w-4" />
                      </Button>
                    </div>
                    {barcodes.length > 0 && (
                      <div className="space-y-1">
                        {barcodes.map((barcode: string) => (
                          <div key={barcode} className="flex items-center justify-between group">
                            <Badge variant="secondary" className="text-xs">
                              {barcode}
                            </Badge>
                            <Button type="button" variant="ghost" size="sm" className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100" onClick={() => removeBarcode(barcode)}>
                              <IconX className="h-3 w-3" />
                            </Button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </PopoverContent>
              </Popover>
            </FormControl>
          </FormItem>
        );
      }}
    />
  );
}
