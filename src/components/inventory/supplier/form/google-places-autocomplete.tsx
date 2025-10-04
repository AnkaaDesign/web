import { useRef, useEffect, useState, useCallback } from "react";
import { Combobox, type ComboboxOption } from "@/components/ui/combobox";
import { useFormContext } from "react-hook-form";
import type { SupplierCreateFormData, SupplierUpdateFormData } from "../../../../schemas";
import { useDebouncedValue } from "@/hooks/use-debounced-value";

type FormData = SupplierCreateFormData | SupplierUpdateFormData;

interface GooglePlacesAutocompleteProps {
  disabled?: boolean;
  onPlaceSelected?: (place: any) => void;
  placeholder?: string;
  className?: string;
}

declare global {
  interface Window {
    google: any;
    initGooglePlaces: () => void;
  }
}

export function GooglePlacesAutocomplete({ disabled, onPlaceSelected, placeholder = "Digite o endereço...", className }: GooglePlacesAutocompleteProps) {
  const form = useFormContext<FormData>();
  const [searchTerm, setSearchTerm] = useState("");
  const [suggestions, setSuggestions] = useState<ComboboxOption[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedValue, setSelectedValue] = useState<string | undefined>();
  const autocompleteServiceRef = useRef<any>(null);
  const placesServiceRef = useRef<any>(null);
  const sessionTokenRef = useRef<any>(null);
  const debouncedSearchTerm = useDebouncedValue(searchTerm, 300);

  // Store place details for retrieval when option is selected
  const placeDetailsMapRef = useRef<Map<string, any>>(new Map());

  const initializeServices = useCallback(() => {
    if (!window.google?.maps?.places) return false;

    if (!autocompleteServiceRef.current) {
      autocompleteServiceRef.current = new window.google.maps.places.AutocompleteService();
    }

    if (!placesServiceRef.current) {
      // Create a dummy div for PlacesService
      const div = document.createElement("div");
      placesServiceRef.current = new window.google.maps.places.PlacesService(div);
    }

    if (!sessionTokenRef.current) {
      sessionTokenRef.current = new window.google.maps.places.AutocompleteSessionToken();
    }

    return true;
  }, []);

  const fetchSuggestions = useCallback(
    async (input: string) => {
      if (!input.trim() || !initializeServices()) {
        setSuggestions([]);
        return;
      }

      setIsLoading(true);

      try {
        autocompleteServiceRef.current.getPlacePredictions(
          {
            input,
            componentRestrictions: { country: "br" },
            types: ["address"],
            sessionToken: sessionTokenRef.current,
          },
          (predictions: any, status: any) => {
            if (status === window.google.maps.places.PlacesServiceStatus.OK && predictions) {
              const options: ComboboxOption[] = predictions.map((prediction: any) => ({
                value: prediction.place_id,
                label: prediction.structured_formatting.main_text,
                description: prediction.structured_formatting.secondary_text,
                metadata: prediction,
              }));
              setSuggestions(options);
            } else {
              setSuggestions([]);
            }
            setIsLoading(false);
          },
        );
      } catch (error) {
        console.error("Error fetching suggestions:", error);
        setSuggestions([]);
        setIsLoading(false);
      }
    },
    [initializeServices],
  );

  const handlePlaceSelect = useCallback(
    (placeId: string | string[] | undefined) => {
      if (!placeId || Array.isArray(placeId)) return;

      setSelectedValue(placeId);

      if (!placesServiceRef.current) return;

      placesServiceRef.current.getDetails(
        {
          placeId,
          fields: ["address_components", "formatted_address", "geometry"],
          sessionToken: sessionTokenRef.current,
        },
        (place: any, status: any) => {
          if (status === window.google.maps.places.PlacesServiceStatus.OK && place) {
            // Reset session token after place selection
            sessionTokenRef.current = new window.google.maps.places.AutocompleteSessionToken();

            // Extract address components
            const components = place.address_components || [];
            let streetNumber = "";
            let route = "";
            let neighborhood = "";
            let city = "";
            let state = "";
            let postalCode = "";

            components.forEach((component: any) => {
              const types = component.types;

              if (types.includes("street_number")) {
                streetNumber = component.long_name;
              }
              if (types.includes("route")) {
                route = component.long_name;
              }
              if (types.includes("sublocality") || types.includes("neighborhood")) {
                neighborhood = component.long_name;
              }
              if (types.includes("administrative_area_level_2") || types.includes("locality")) {
                city = component.long_name;
              }
              if (types.includes("administrative_area_level_1")) {
                state = component.short_name;
              }
              if (types.includes("postal_code")) {
                postalCode = component.long_name;
              }
            });

            // Update form fields
            const address = route;
            if (address) form.setValue("address", address, { shouldDirty: true });
            if (streetNumber) form.setValue("addressNumber", streetNumber, { shouldDirty: true });
            if (neighborhood) form.setValue("neighborhood", neighborhood, { shouldDirty: true });
            if (city) form.setValue("city", city, { shouldDirty: true });
            if (state) form.setValue("state", state, { shouldDirty: true });
            if (postalCode) form.setValue("zipCode", postalCode, { shouldDirty: true });

            if (onPlaceSelected) {
              onPlaceSelected({
                place,
                extractedData: {
                  address,
                  addressNumber: streetNumber,
                  neighborhood,
                  city,
                  state,
                  zipCode: postalCode,
                },
              });
            }
          }
        },
      );
    },
    [form, onPlaceSelected],
  );

  // Load Google Places API
  useEffect(() => {
    const loadGooglePlaces = () => {
      if (!document.querySelector('script[src*="maps.googleapis.com"]')) {
        const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;
        if (apiKey) {
          const script = document.createElement("script");
          script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places`;
          script.async = true;
          script.defer = true;
          script.onload = () => initializeServices();
          document.head.appendChild(script);
        }
      } else {
        initializeServices();
      }
    };

    if (!window.google?.maps?.places) {
      loadGooglePlaces();
    } else {
      initializeServices();
    }
  }, [initializeServices]);

  // Fetch suggestions when search term changes
  useEffect(() => {
    fetchSuggestions(debouncedSearchTerm);
  }, [debouncedSearchTerm, fetchSuggestions]);

  return (
    <Combobox
      value={selectedValue}
      onValueChange={handlePlaceSelect}
      options={suggestions}
      placeholder={placeholder}
      searchPlaceholder="Digite para buscar endereço..."
      emptyText="Nenhum endereço encontrado"
      disabled={disabled}
      className={className}
      async
      queryFn={async (term) => {
        setSearchTerm(term);
        return suggestions;
      }}
      loading={isLoading}
      searchable
      clearable={false}
      minSearchLength={3}
      debounceMs={300}
      renderOption={(option) => (
        <div className="flex flex-col">
          <span className="font-medium">{option.label}</span>
          {option.description && <span className="text-xs text-muted-foreground">{option.description}</span>}
        </div>
      )}
    />
  );
}
