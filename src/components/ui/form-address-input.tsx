import { FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { GooglePlacesAutocomplete } from "./form-google-places-autocomplete";
import { Input } from "@/components/ui/input";
import { IconMapPin } from "@tabler/icons-react";
import { useFormContext } from "react-hook-form";

interface AddressInputProps {
  disabled?: boolean;
  onAddressSelect?: (addressData: any) => void;
  useGooglePlaces?: boolean;
  required?: boolean;
  name?: string;
  addressNumberFieldName?: string;
  neighborhoodFieldName?: string;
  cityFieldName?: string;
  stateFieldName?: string;
  zipCodeFieldName?: string;
  fantasyNameFieldName?: string;
  siteFieldName?: string;
}

export function AddressInput({
  disabled,
  onAddressSelect,
  useGooglePlaces = true,
  required = true,
  name = "address",
  addressNumberFieldName = "addressNumber",
  neighborhoodFieldName = "neighborhood",
  cityFieldName = "city",
  stateFieldName = "state",
  zipCodeFieldName = "zipCode",
  fantasyNameFieldName = "fantasyName",
  siteFieldName = "site",
}: AddressInputProps) {
  const form = useFormContext();

  const handlePlaceSelect = (result: any) => {
    if (result?.extractedData) {
      const { extractedData } = result;

      // Fill address fields automatically
      if (extractedData.address) {
        form.setValue(name, extractedData.address, { shouldDirty: true });
      }
      if (extractedData.addressNumber) {
        form.setValue(addressNumberFieldName, extractedData.addressNumber, { shouldDirty: true });
      }
      if (extractedData.neighborhood) {
        form.setValue(neighborhoodFieldName, extractedData.neighborhood, { shouldDirty: true });
      }
      if (extractedData.city) {
        form.setValue(cityFieldName, extractedData.city, { shouldDirty: true });
      }
      if (extractedData.state) {
        form.setValue(stateFieldName, extractedData.state, { shouldDirty: true });
      }
      if (extractedData.zipCode) {
        form.setValue(zipCodeFieldName, extractedData.zipCode, { shouldDirty: true });
      }

      // Fill business information if it's a business place
      const place = result.place;
      if (place.name && place.types?.includes("establishment")) {
        const currentFantasyName = form.getValues(fantasyNameFieldName);
        if (!currentFantasyName || currentFantasyName.trim() === "") {
          form.setValue(fantasyNameFieldName, place.name, { shouldDirty: true });
        }
      }

      if (place.website && !form.getValues(siteFieldName)) {
        form.setValue(siteFieldName, place.website, { shouldDirty: true });
      }

      // Call optional callback
      onAddressSelect?.(result);
    }
  };

  return (
    <FormField
      control={form.control}
      name={name}
      render={({ field }) => (
        <FormItem>
          <FormLabel className="flex items-center gap-2">
            <IconMapPin className="h-4 w-4" />
            Endereço {required && "*"}
          </FormLabel>
          <FormControl>
            {useGooglePlaces ? (
              <GooglePlacesAutocomplete
                onPlaceSelected={handlePlaceSelect}
                placeholder="Digite o endereço ou nome da empresa..."
                disabled={disabled}
                addressFieldName={name}
                addressNumberFieldName={addressNumberFieldName}
                neighborhoodFieldName={neighborhoodFieldName}
                cityFieldName={cityFieldName}
                stateFieldName={stateFieldName}
                zipCodeFieldName={zipCodeFieldName}
                fantasyNameFieldName={fantasyNameFieldName}
                siteFieldName={siteFieldName}
              />
            ) : (
              <Input {...field} value={field.value ?? ""} placeholder="Digite o endereço completo..." disabled={disabled} transparent={true} className="transition-all duration-200" />
            )}
          </FormControl>
          <FormMessage />
        </FormItem>
      )}
    />
  );
}
