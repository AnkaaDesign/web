import { useState, useRef, useCallback, useEffect } from "react";
import { Button } from "./button";
import { Input } from "./input";
import { Popover, PopoverContent, PopoverTrigger } from "./popover";
import { ScrollArea } from "./scroll-area";
import { IconSearch, IconX, IconMapPin, IconEdit, IconLoader2 } from "@tabler/icons-react";
import { cn } from "../../lib/utils";

export interface AddressComponents {
  streetNumber?: string;
  route?: string;
  neighborhood?: string;
  city?: string;
  state?: string;
  country?: string;
  postalCode?: string;
  formattedAddress?: string;
}

export interface PlaceDetails extends AddressComponents {
  placeId?: string;
  businessName?: string;
  phoneNumber?: string;
  website?: string;
  latitude?: string;
  longitude?: string;
}

export interface GooglePlacePrediction {
  place_id: string;
  description: string;
  structured_formatting?: {
    main_text?: string;
    secondary_text?: string;
  };
  types: string[];
}

export interface GooglePlacesResponse {
  predictions: GooglePlacePrediction[];
  status: string;
  error_message?: string;
}

export interface GooglePlaceDetailsResponse {
  result: {
    place_id: string;
    name?: string;
    formatted_address?: string;
    address_components?: Array<{
      long_name: string;
      short_name: string;
      types: string[];
    }>;
    geometry?: {
      location: {
        lat: number;
        lng: number;
      };
    };
    international_phone_number?: string;
    website?: string;
  };
  status: string;
  error_message?: string;
}

interface GooglePlacesAutocompleteProps {
  apiKey: string;
  value?: string;
  onChange?: (value: string) => void;
  onPlaceSelect?: (place: PlaceDetails) => void;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
  country?: string;
  language?: string;
  types?: string;
  searchDelay?: number;
  enableManualInput?: boolean;
  manualInputLabel?: string;
  error?: boolean;
  errorMessage?: string;
}

export function GooglePlacesAutocomplete({
  apiKey,
  value = "",
  onChange,
  onPlaceSelect,
  placeholder = "Digite um endereço...",
  className,
  disabled = false,
  country = "br",
  language = "pt-BR",
  types = "address",
  searchDelay = 300,
  enableManualInput = true,
  manualInputLabel = "Inserir endereço manualmente",
  error = false,
  errorMessage,
}: GooglePlacesAutocompleteProps) {
  const [searchText, setSearchText] = useState(value);
  const [predictions, setPredictions] = useState<GooglePlacePrediction[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isError, setIsError] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const [isManualMode, setIsManualMode] = useState(false);
  const [selectedPlace, setSelectedPlace] = useState<PlaceDetails | null>(null);

  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const searchAttempts = useRef(0);

  // Check for API key
  if (!apiKey) {
    console.error("GooglePlacesAutocomplete: apiKey is required");
    return <div className="text-red-500 text-sm p-2 border border-red-300 rounded-lg bg-red-50">Erro: Chave da API do Google Places não configurada</div>;
  }

  // Update search text when value prop changes
  useEffect(() => {
    if (value !== searchText) {
      setSearchText(value);
    }
  }, [value, searchText]);

  // Parse address components from Google Places API response
  const parseAddressComponents = (addressComponents: any[]): AddressComponents => {
    const components: AddressComponents = {};

    addressComponents?.forEach((component) => {
      const types = component.types;

      if (types.includes("street_number")) {
        components.streetNumber = component.long_name;
      }
      if (types.includes("route")) {
        components.route = component.long_name;
      }
      if (types.includes("sublocality") || types.includes("sublocality_level_1")) {
        components.neighborhood = component.long_name;
      }
      if (types.includes("administrative_area_level_2")) {
        components.city = component.long_name;
      } else if (types.includes("locality") && !components.city) {
        components.city = component.long_name;
      }
      if (types.includes("administrative_area_level_1")) {
        components.state = component.short_name;
      }
      if (types.includes("country")) {
        components.country = component.long_name;
      }
      if (types.includes("postal_code")) {
        components.postalCode = component.long_name;
      }
    });

    return components;
  };

  // Fetch place details when a place is selected
  const fetchPlaceDetails = async (placeId: string): Promise<PlaceDetails | null> => {
    setIsLoading(true);

    try {
      const url = new URL("https://maps.googleapis.com/maps/api/place/details/json");
      url.searchParams.set("place_id", placeId);
      url.searchParams.set("fields", "place_id,name,formatted_address,address_components,geometry,international_phone_number,website");
      url.searchParams.set("language", language);
      url.searchParams.set("key", apiKey);

      const response = await fetch(url.toString());
      const data: GooglePlaceDetailsResponse = await response.json();

      if (data.status === "OK" && data.result) {
        const result = data.result;
        const addressComponents = parseAddressComponents(result.address_components || []);

        const placeDetails: PlaceDetails = {
          ...addressComponents,
          placeId: result.place_id,
          businessName: result.name,
          formattedAddress: result.formatted_address,
          phoneNumber: result.international_phone_number,
          website: result.website,
          latitude: result.geometry?.location?.lat?.toString(),
          longitude: result.geometry?.location?.lng?.toString(),
        };

        return placeDetails;
      } else {
        setIsError(true);
        setErrorMsg("Erro ao obter detalhes do endereço");
        return null;
      }
    } catch (error) {
      console.error("Error fetching place details:", error);
      setIsError(true);
      setErrorMsg("Erro ao obter detalhes do endereço");
      return null;
    } finally {
      setIsLoading(false);
    }
  };

  // Search function with retry logic
  const performSearch = async (text: string, attempt = 0) => {
    if (text.length < 2 || isManualMode) {
      setPredictions([]);
      return;
    }

    setIsLoading(true);
    setIsError(false);
    setErrorMsg("");

    try {
      // Modify search query based on attempt to improve results
      let searchQuery = text;
      let searchTypes = types;

      if (attempt === 1) {
        searchQuery = `${text}, Brasil`;
      } else if (attempt === 2) {
        searchTypes = "establishment|address";
      } else if (attempt === 3) {
        searchQuery = `empresa ${text}`;
        searchTypes = "establishment";
      }

      const url = new URL("https://maps.googleapis.com/maps/api/place/autocomplete/json");
      url.searchParams.set("input", searchQuery);
      url.searchParams.set("types", searchTypes);
      url.searchParams.set("language", language);
      url.searchParams.set("components", `country:${country}`);
      url.searchParams.set("key", apiKey);

      const response = await fetch(url.toString());
      const data: GooglePlacesResponse = await response.json();

      if (data.status === "OK" && data.predictions) {
        setPredictions(data.predictions);

        // If no results and we haven't exhausted attempts, try again
        if (data.predictions.length === 0 && attempt < 3) {
          searchAttempts.current = attempt + 1;
          setTimeout(() => performSearch(text, attempt + 1), 500);
        } else if (data.predictions.length === 0) {
          setErrorMsg("Nenhum endereço encontrado. Tente um termo diferente.");
        }
      } else {
        if (attempt < 3) {
          searchAttempts.current = attempt + 1;
          setTimeout(() => performSearch(text, attempt + 1), 500);
        } else {
          setIsError(true);
          setErrorMsg(data.error_message || "Erro ao buscar endereços. Tente novamente.");
          setPredictions([]);
        }
      }
    } catch (error) {
      console.error("Error fetching places:", error);
      setIsError(true);
      setErrorMsg("Erro de conexão. Verifique sua internet e tente novamente.");
      setPredictions([]);
    } finally {
      setIsLoading(false);
    }
  };

  // Debounced search function
  const debouncedSearch = useCallback(
    (text: string) => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }

      timeoutRef.current = setTimeout(() => {
        performSearch(text);
      }, searchDelay);
    },
    [searchDelay],
  );

  // Clean up timeout on unmount
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  // Handle text input changes
  const handleTextChange = (text: string) => {
    setSearchText(text);
    onChange?.(text);
    searchAttempts.current = 0;

    if (!isManualMode && text.length > 1) {
      debouncedSearch(text);
    } else {
      setPredictions([]);
    }
  };

  // Handle place selection
  const handlePlaceSelect = async (prediction: GooglePlacePrediction) => {
    const placeDetails = await fetchPlaceDetails(prediction.place_id);

    if (placeDetails) {
      setSelectedPlace(placeDetails);
      setSearchText(prediction.description);
      onChange?.(prediction.description);
      onPlaceSelect?.(placeDetails);
    }

    setIsOpen(false);
    setPredictions([]);
  };

  // Handle manual mode toggle
  const handleManualModeToggle = () => {
    setIsManualMode(!isManualMode);
    setPredictions([]);
    setIsError(false);
    setErrorMsg("");

    if (!isManualMode) {
      // Entering manual mode - keep current text
      setSelectedPlace(null);
    }
  };

  // Handle clear
  const handleClear = () => {
    setSearchText("");
    onChange?.("");
    setSelectedPlace(null);
    setPredictions([]);
    setIsError(false);
    setErrorMsg("");
    onPlaceSelect?.({}); // Clear selection
  };

  // Handle retry search
  const handleRetry = () => {
    if (searchText && !isManualMode) {
      searchAttempts.current = 0;
      setIsError(false);
      setErrorMsg("");
      debouncedSearch(searchText);
    }
  };

  return (
    <div className={cn("relative w-full", className)}>
      <Popover open={isOpen && !isManualMode} onOpenChange={setIsOpen}>
        <PopoverTrigger asChild>
          <div className="relative">
            <Input
              value={searchText}
              onChange={(e) => handleTextChange(e.target.value)}
              placeholder={isManualMode ? `${placeholder} (modo manual)` : placeholder}
              className={cn("pr-20", (error || isError) && "border-red-500 focus:ring-red-500", selectedPlace && !isManualMode && "border-green-500")}
              disabled={disabled}
              onFocus={() => {
                if (!isManualMode && searchText.length > 1) {
                  setIsOpen(true);
                }
              }}
              withIcon
            />

            {/* Icons container */}
            <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
              {isLoading && <IconLoader2 className="h-4 w-4 animate-spin text-muted-foreground" />}

              {!isLoading && (
                <>
                  {selectedPlace && !isManualMode && <IconMapPin className="h-4 w-4 text-green-600" />}

                  {isManualMode && <IconEdit className="h-4 w-4 text-blue-600" />}

                  {searchText && (
                    <Button type="button" variant="ghost" size="sm" className="h-6 w-6 p-0 hover:bg-muted" onClick={handleClear}>
                      <IconX className="h-3 w-3" />
                    </Button>
                  )}
                </>
              )}
            </div>
          </div>
        </PopoverTrigger>

        <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0 max-h-80" align="start" side="bottom">
          <ScrollArea className="max-h-72">
            <div className="p-2 space-y-1">
              {/* Error message */}
              {isError && errorMsg && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
                  <p className="text-sm text-red-700 mb-2">{errorMsg}</p>
                  <Button type="button" variant="outline" size="sm" onClick={handleRetry} className="text-red-700 border-red-300 hover:bg-red-100">
                    <IconSearch className="h-4 w-4 mr-2" />
                    Tentar novamente
                  </Button>
                </div>
              )}

              {/* Predictions */}
              {predictions.length > 0 && (
                <>
                  {predictions.map((prediction) => (
                    <button
                      key={prediction.place_id}
                      type="button"
                      className="w-full text-left p-3 hover:bg-muted rounded-lg transition-colors focus:outline-none focus:bg-muted"
                      onClick={() => handlePlaceSelect(prediction)}
                    >
                      <div className="flex items-start gap-2">
                        <IconMapPin className="h-4 w-4 text-muted-foreground mt-0.5 flex-shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{prediction.structured_formatting?.main_text || prediction.description}</p>
                          {prediction.structured_formatting?.secondary_text && (
                            <p className="text-xs text-muted-foreground truncate">{prediction.structured_formatting.secondary_text}</p>
                          )}
                        </div>
                      </div>
                    </button>
                  ))}
                </>
              )}

              {/* No results message */}
              {!isLoading && !isError && predictions.length === 0 && searchText.length > 1 && (
                <div className="p-3 text-center text-sm text-muted-foreground">Nenhum resultado encontrado para "{searchText}"</div>
              )}
            </div>
          </ScrollArea>

          {/* Manual input option */}
          {enableManualInput && (
            <div className="border-t p-2">
              <Button type="button" variant="ghost" size="sm" onClick={handleManualModeToggle} className="w-full justify-start">
                <IconEdit className="h-4 w-4 mr-2" />
                {manualInputLabel}
              </Button>
            </div>
          )}
        </PopoverContent>
      </Popover>

      {/* Manual mode indicator */}
      {isManualMode && (
        <div className="mt-2 flex items-center justify-between p-2 bg-blue-50 border border-blue-200 rounded-lg">
          <div className="flex items-center gap-2 text-sm text-blue-700">
            <IconEdit className="h-4 w-4" />
            Modo manual ativado
          </div>
          <Button type="button" variant="ghost" size="sm" onClick={handleManualModeToggle} className="text-blue-700 hover:bg-blue-100">
            Voltar à busca
          </Button>
        </div>
      )}

      {/* Error message from props */}
      {(error || errorMessage) && <p className="mt-1 text-sm text-red-600">{errorMessage || "Campo obrigatório"}</p>}
    </div>
  );
}
