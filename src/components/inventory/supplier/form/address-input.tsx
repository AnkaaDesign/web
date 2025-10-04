import { FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { GooglePlacesAutocomplete } from "./google-places-autocomplete";
import { Input } from "@/components/ui/input";
import { IconMapPin } from "@tabler/icons-react";
import { useFormContext } from "react-hook-form";
import type { SupplierCreateFormData, SupplierUpdateFormData } from "../../../../schemas";

type FormData = SupplierCreateFormData | SupplierUpdateFormData;

interface AddressInputProps {
  disabled?: boolean;
  onAddressSelect?: (addressData: any) => void;
  useGooglePlaces?: boolean;
}

export function AddressInput({ disabled, onAddressSelect, useGooglePlaces = true }: AddressInputProps) {
  const form = useFormContext<FormData>();

  const handlePlaceSelect = (result: any) => {
    if (result?.extractedData) {
      const { extractedData } = result;

      // Fill address fields automatically
      if (extractedData.address) {
        form.setValue("address", extractedData.address, { shouldDirty: true });
      }
      if (extractedData.addressNumber) {
        form.setValue("addressNumber", extractedData.addressNumber, { shouldDirty: true });
      }
      if (extractedData.neighborhood) {
        form.setValue("neighborhood", extractedData.neighborhood, { shouldDirty: true });
      }
      if (extractedData.city) {
        form.setValue("city", extractedData.city, { shouldDirty: true });
      }
      if (extractedData.state) {
        form.setValue("state", extractedData.state, { shouldDirty: true });
      }
      if (extractedData.zipCode) {
        form.setValue("zipCode", extractedData.zipCode, { shouldDirty: true });
      }

      // Fill business information if it's a business place
      const place = result.place;
      if (place.name && place.types?.includes("establishment")) {
        const currentFantasyName = form.getValues("fantasyName");
        if (!currentFantasyName || currentFantasyName.trim() === "") {
          form.setValue("fantasyName", place.name, { shouldDirty: true });
        }
      }

      if (place.website && !form.getValues("site")) {
        form.setValue("site", place.website, { shouldDirty: true });
      }

      // Call optional callback
      onAddressSelect?.(result);
    }
  };

  return (
    <FormField
      control={form.control}
      name="address"
      render={({ field }) => (
        <FormItem>
          <FormLabel className="flex items-center gap-2">
            <IconMapPin className="h-4 w-4" />
            Endereço *
          </FormLabel>
          <FormControl>
            {useGooglePlaces ? (
              <GooglePlacesAutocomplete onPlaceSelected={handlePlaceSelect} placeholder="Digite o endereço ou nome da empresa..." disabled={disabled} />
            ) : (
              <Input
                value={field.value || ""}
                onChange={(value) => {
                  field.onChange(value);
                }}
                name={field.name}
                onBlur={field.onBlur}
                ref={field.ref}
                placeholder="Digite o endereço completo..."
                disabled={disabled}
                className="transition-all duration-200"
              />
            )}
          </FormControl>
          <FormMessage />
        </FormItem>
      )}
    />
  );
}
