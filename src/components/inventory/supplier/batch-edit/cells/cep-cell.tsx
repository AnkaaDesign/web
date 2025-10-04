import { useState, useRef } from "react";
import { FormField, FormItem, FormControl, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui";
import { IconLoader2 } from "@tabler/icons-react";

interface CepCellProps {
  control: any;
  index: number;
  disabled?: boolean;
  onAddressFound?: (data: { address: string; neighborhood: string; city: string; state: string }) => void;
}

export function CepCell({ control, index, disabled, onAddressFound }: CepCellProps) {
  const [isLoading, setIsLoading] = useState(false);
  const lastLookupRef = useRef<string>("");

  const handleCepLookup = async (cep: string) => {
    const cleanCep = cep || "";

    // Only lookup if we have a complete CEP (8 digits)
    if (cleanCep.length === 8) {
      // Track the last lookup to avoid duplicate API calls
      if (cleanCep === lastLookupRef.current) {
        return;
      }
      lastLookupRef.current = cleanCep;

      setIsLoading(true);
      try {
        // Use ViaCEP API
        const response = await fetch(`https://viacep.com.br/ws/${cleanCep}/json/`);
        if (response.ok) {
          const data = await response.json();
          if (!data.erro && onAddressFound) {
            // Always update fields when a valid CEP is found
            // This will overwrite existing values
            onAddressFound({
              address: data.logradouro || "",
              neighborhood: data.bairro || "",
              city: data.localidade || "",
              state: data.uf || "",
            });
          }
        }
      } catch (error) {
        console.error("Error looking up CEP:", error);
      } finally {
        setIsLoading(false);
      }
    } else {
      // Reset the last lookup when CEP is incomplete
      lastLookupRef.current = "";
    }
  };

  return (
    <FormField
      control={control}
      name={`suppliers.${index}.data.zipCode`}
      render={({ field }) => (
        <FormItem>
          <FormControl>
            <div className="relative">
              <Input
                type="cep"
                value={field.value ?? ""}
                onChange={(value) => {
                  field.onChange(value ?? null);
                  handleCepLookup(value || "");
                }}
                disabled={disabled || isLoading}
                onBlur={field.onBlur}
                placeholder="00000-000"
                className="h-8 pr-8"
              />
              {isLoading && <IconLoader2 className="absolute right-2 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground" />}
            </div>
          </FormControl>
          <FormMessage />
        </FormItem>
      )}
    />
  );
}
