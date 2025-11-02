import { FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { ZipCodeInput as ZipCodeInputBase } from "@/components/ui/zipcode-input";
import { IconMailbox, IconLoader2 } from "@tabler/icons-react";
import { useFormContext } from "react-hook-form";
import { useState } from "react";
import type { SupplierCreateFormData, SupplierUpdateFormData } from "../../../../schemas";

type FormData = SupplierCreateFormData | SupplierUpdateFormData;

interface ZipCodeInputProps {
  disabled?: boolean;
  onCepChange?: (cep: string) => void;
}

export function ZipCodeInput({ disabled, onCepChange }: ZipCodeInputProps) {
  const form = useFormContext<FormData>();
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
            // Get current form values to check if fields are already filled
            const currentValues = form.getValues();

            // Helper to check if a field should be filled (only fill if empty)
            const shouldFillField = (fieldValue: any) => fieldValue === null || fieldValue === undefined || fieldValue === "";

            // Auto-fill address fields only if they're empty
            if (data.logradouro && shouldFillField(currentValues.address)) {
              form.setValue("address", data.logradouro, { shouldDirty: true });
            }
            if (data.bairro && shouldFillField(currentValues.neighborhood)) {
              form.setValue("neighborhood", data.bairro, { shouldDirty: true });
            }
            if (data.localidade && shouldFillField(currentValues.city)) {
              form.setValue("city", data.localidade, { shouldDirty: true });
            }
            if (data.uf && shouldFillField(currentValues.state)) {
              form.setValue("state", data.uf, { shouldDirty: true });
            }

            // If Google Places is available, try to get more complete address
            if (import.meta.env.VITE_GOOGLE_MAPS_API_KEY) {
              // Construct full address for Google Places search
              // The AddressInput component will handle Google Places autocomplete
            }
          }
        }

        // Call the parent's onCepChange if provided
        if (onCepChange) {
          onCepChange(cleanCep);
        }
      } catch (error) {
        console.error("Error looking up CEP:", error);
      } finally {
        setIsLoading(false);
      }
    }
  };

  return (
    <FormField
      control={form.control}
      name="zipCode"
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
