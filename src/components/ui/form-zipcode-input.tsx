import { FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { ZipCodeInput as ZipCodeInputBase } from "@/components/ui/zipcode-input";
import { IconMailbox, IconLoader2 } from "@tabler/icons-react";
import { useFormContext } from "react-hook-form";
import { useState } from "react";

interface ZipCodeInputProps {
  disabled?: boolean;
  onCepChange?: (cep: string) => void;
  name?: string;
  addressFieldName?: string;
  neighborhoodFieldName?: string;
  cityFieldName?: string;
  stateFieldName?: string;
}

export function ZipCodeInput({ 
  disabled, 
  onCepChange,
  name = "zipCode",
  addressFieldName = "address",
  neighborhoodFieldName = "neighborhood",
  cityFieldName = "city",
  stateFieldName = "state",
}: ZipCodeInputProps) {
  const form = useFormContext();
  const [isLoading, setIsLoading] = useState(false);
  const [previousValue, setPreviousValue] = useState<string>("");

  const handleCepLookup = async (cep: string) => {
    const cleanCep = cep || "";

    // Only lookup if we have a complete CEP (8 digits) and it's different from previous
    if (cleanCep.length === 8 && cleanCep !== previousValue) {
      setPreviousValue(cleanCep);
      setIsLoading(true);
      try {
        // First try ViaCEP API
        const response = await fetch(`https://viacep.com.br/ws/${cleanCep}/json/`);
        if (response.ok) {
          const data = await response.json();
          if (!data.erro) {
            // CEP data is more precise for address information, so always
            // overwrite existing values (including those from CNPJ autofill)
            if (data.logradouro) {
              form.setValue(addressFieldName, data.logradouro, { shouldDirty: true });
            }
            if (data.bairro) {
              form.setValue(neighborhoodFieldName, data.bairro, { shouldDirty: true });
            }
            if (data.localidade) {
              form.setValue(cityFieldName, data.localidade, { shouldDirty: true });
            }
            if (data.uf) {
              form.setValue(stateFieldName, data.uf, { shouldDirty: true });
            }
          }
        }

        // Call the parent's onCepChange if provided
        if (onCepChange) {
          onCepChange(cleanCep);
        }
      } catch (error) {
        if (process.env.NODE_ENV !== 'production') {
          console.error("Error looking up CEP:", error);
        }
      } finally {
        setIsLoading(false);
      }
    }
  };

  return (
    <FormField
      control={form.control}
      name={name}
      render={({ field }) => (
        <FormItem>
          <FormLabel className="flex items-center gap-2">
            <IconMailbox className="h-4 w-4" />
            CEP
            {isLoading && <IconLoader2 className="h-3 w-3 animate-spin" />}
          </FormLabel>
          <FormControl>
            <ZipCodeInputBase
              value={field.value ?? ""}
              onChange={(value) => {
                field.onChange(value ?? null);
                handleCepLookup(value || "");
              }}
              disabled={disabled || isLoading}
              onBlur={field.onBlur}
              placeholder="00000-000"
            />
          </FormControl>
          <FormMessage />
          {isLoading && <p className="text-xs text-muted-foreground">Buscando endereço...</p>}
        </FormItem>
      )}
    />
  );
}