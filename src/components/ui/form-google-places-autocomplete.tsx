import { useRef, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { useFormContext } from "react-hook-form";

interface GooglePlacesAutocompleteProps {
  disabled?: boolean;
  onPlaceSelected?: (place: any) => void;
  placeholder?: string;
  className?: string;
  addressFieldName?: string;
  addressNumberFieldName?: string;
  neighborhoodFieldName?: string;
  cityFieldName?: string;
  stateFieldName?: string;
  zipCodeFieldName?: string;
  fantasyNameFieldName?: string;
  siteFieldName?: string;
}

declare global {
  interface Window {
    google: any;
    initGooglePlaces: () => void;
  }
}

export function GooglePlacesAutocomplete({
  disabled,
  onPlaceSelected,
  placeholder = "Digite o endereço...",
  className,
  addressFieldName = "address",
  addressNumberFieldName = "addressNumber",
  neighborhoodFieldName = "neighborhood",
  cityFieldName = "city",
  stateFieldName = "state",
  zipCodeFieldName = "zipCode",
  fantasyNameFieldName = "fantasyName",
  siteFieldName = "site",
}: GooglePlacesAutocompleteProps) {
  const form = useFormContext();
  const inputRef = useRef<HTMLInputElement>(null);
  const autocompleteRef = useRef<any>(null);

  useEffect(() => {
    const initAutocomplete = () => {
      if (!window.google?.maps?.places || !inputRef.current) return;

      autocompleteRef.current = new window.google.maps.places.Autocomplete(inputRef.current, {
        types: ["address"],
        componentRestrictions: { country: "br" },
      });

      autocompleteRef.current.addListener("place_changed", () => {
        const place = autocompleteRef.current.getPlace();

        if (!place.geometry) {
          return;
        }

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
        if (address) form.setValue(addressFieldName, address, { shouldDirty: true });
        if (streetNumber) form.setValue(addressNumberFieldName, streetNumber, { shouldDirty: true });
        if (neighborhood) form.setValue(neighborhoodFieldName, neighborhood, { shouldDirty: true });
        if (city) form.setValue(cityFieldName, city, { shouldDirty: true });
        if (state) form.setValue(stateFieldName, state, { shouldDirty: true });
        if (postalCode) form.setValue(zipCodeFieldName, postalCode, { shouldDirty: true });

        // Fill business information if it's a business place
        if (place.name && place.types?.includes("establishment")) {
          const currentFantasyName = form.getValues(fantasyNameFieldName);
          if (!currentFantasyName || currentFantasyName.trim() === "") {
            form.setValue(fantasyNameFieldName, place.name, { shouldDirty: true });
          }
        }

        if (place.website && !form.getValues(siteFieldName)) {
          form.setValue(siteFieldName, place.website, { shouldDirty: true });
        }

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
      });
    };

    // Check if Google Places is already loaded
    if (window.google?.maps?.places) {
      initAutocomplete();
    } else {
      // Wait for Google Places to load
      window.initGooglePlaces = initAutocomplete;

      // Load Google Places if not already loading
      if (!document.querySelector('script[src*="maps.googleapis.com"]')) {
        const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;
        if (apiKey) {
          const script = document.createElement("script");
          script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places&callback=initGooglePlaces`;
          script.async = true;
          script.defer = true;
          document.head.appendChild(script);
        }
      }
    }

    return () => {
      if (autocompleteRef.current) {
        window.google?.maps?.event?.clearInstanceListeners?.(autocompleteRef.current);
      }
    };
  }, [
    form,
    onPlaceSelected,
    addressFieldName,
    addressNumberFieldName,
    neighborhoodFieldName,
    cityFieldName,
    stateFieldName,
    zipCodeFieldName,
    fantasyNameFieldName,
    siteFieldName,
  ]);

  return <Input ref={inputRef} placeholder={placeholder} disabled={disabled} className={className} />;
}
