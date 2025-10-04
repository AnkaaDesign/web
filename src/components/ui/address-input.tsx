import { useState, useEffect } from "react";
import { GooglePlacesAutocomplete, type PlaceDetails } from "./google-places-autocomplete";
import { ManualAddressForm, type ManualAddressData } from "./manual-address-form";
import { Button } from "./button";
import { Alert, AlertDescription } from "./alert";
import { IconMapPin, IconEdit, IconRefresh, IconAlertTriangle } from "@tabler/icons-react";
import { cn } from "../../lib/utils";

interface AddressInputProps {
  value?: string;
  onChange?: (value: string) => void;
  onAddressSelect?: (address: PlaceDetails | ManualAddressData) => void;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
  error?: boolean;
  errorMessage?: string;
  showBusinessFields?: boolean;
  required?: boolean;
  apiKey?: string;
  fallbackToManual?: boolean;
}

export function AddressInput({
  value = "",
  onChange,
  onAddressSelect,
  placeholder = "Digite um endereço...",
  className,
  disabled = false,
  error = false,
  errorMessage,
  showBusinessFields = true,
  required = false,
  apiKey,
  fallbackToManual = true,
}: AddressInputProps) {
  const [mode, setMode] = useState<"google" | "manual" | "error">("google");
  const [manualAddress, setManualAddress] = useState<ManualAddressData>({});
  const [apiError, setApiError] = useState<string>("");
  const [hasGoogleApiKey, setHasGoogleApiKey] = useState(false);

  // Check for Google API key on mount
  useEffect(() => {
    const googleApiKey = apiKey || import.meta.env.VITE_GOOGLE_PLACES_API_KEY;
    setHasGoogleApiKey(!!googleApiKey);

    if (!googleApiKey && fallbackToManual) {
      setMode("manual");
    } else if (!googleApiKey) {
      setMode("error");
      setApiError("Chave da API do Google Places não configurada");
    }
  }, [apiKey, fallbackToManual]);

  // Handle Google Places selection
  const handleGooglePlaceSelect = (place: PlaceDetails) => {
    onChange?.(place.formattedAddress || "");
    onAddressSelect?.(place);
    setApiError("");
  };

  // Handle manual address changes
  const handleManualAddressChange = (address: ManualAddressData) => {
    setManualAddress(address);
    onChange?.(address.formattedAddress || "");
    onAddressSelect?.(address);
  };

  // Switch between modes
  const handleModeSwitch = (newMode: "google" | "manual") => {
    setMode(newMode);
    setApiError("");

    if (newMode === "manual") {
      // Try to parse current value into manual form
      if (value) {
        setManualAddress({ formattedAddress: value });
      }
    }
  };

  // Get the appropriate API key
  const getApiKey = () => {
    return apiKey || import.meta.env.VITE_GOOGLE_PLACES_API_KEY || "";
  };

  return (
    <div className={cn("space-y-4", className)}>
      {/* Mode Selection */}
      {hasGoogleApiKey && fallbackToManual && (
        <div className="flex gap-2">
          <Button type="button" variant={mode === "google" ? "default" : "outline"} size="sm" onClick={() => handleModeSwitch("google")} disabled={disabled}>
            <IconMapPin className="h-4 w-4 mr-2" />
            Buscar Endereço
          </Button>

          <Button type="button" variant={mode === "manual" ? "default" : "outline"} size="sm" onClick={() => handleModeSwitch("manual")} disabled={disabled}>
            <IconEdit className="h-4 w-4 mr-2" />
            Manual
          </Button>
        </div>
      )}

      {/* Error State - No API Key */}
      {mode === "error" && (
        <Alert variant="destructive">
          <IconAlertTriangle className="h-4 w-4" />
          <AlertDescription>
            {apiError}
            {fallbackToManual && (
              <div className="mt-2">
                <Button type="button" variant="outline" size="sm" onClick={() => handleModeSwitch("manual")}>
                  Usar formulário manual
                </Button>
              </div>
            )}
          </AlertDescription>
        </Alert>
      )}

      {/* Google Places Mode */}
      {mode === "google" && hasGoogleApiKey && (
        <GooglePlacesAutocomplete
          apiKey={getApiKey()}
          value={value}
          onChange={onChange}
          onPlaceSelect={handleGooglePlaceSelect}
          placeholder={placeholder}
          disabled={disabled}
          error={error}
          errorMessage={errorMessage}
          enableManualInput={fallbackToManual}
          manualInputLabel="Alternar para formulário manual"
        />
      )}

      {/* Manual Mode */}
      {mode === "manual" && (
        <div className="space-y-4">
          {hasGoogleApiKey && (
            <Alert>
              <IconEdit className="h-4 w-4" />
              <AlertDescription>
                Modo manual ativado. Preencha os campos abaixo para inserir o endereço.
                {hasGoogleApiKey && (
                  <Button type="button" variant="link" size="sm" onClick={() => handleModeSwitch("google")} className="ml-2 h-auto p-0">
                    Voltar para busca automática
                  </Button>
                )}
              </AlertDescription>
            </Alert>
          )}

          <ManualAddressForm
            value={manualAddress}
            onChange={handleManualAddressChange}
            showBusinessFields={showBusinessFields}
            disabled={disabled}
            errors={error ? { city: errorMessage } : {}}
            required={required ? { route: true, city: true, state: true } : {}}
          />
        </div>
      )}

      {/* Required field indicator */}
      {required && <p className="text-xs text-muted-foreground">* Campos obrigatórios</p>}
    </div>
  );
}

// Simplified version for basic address input
export function SimpleAddressInput({
  value,
  onChange,
  onAddressSelect,
  placeholder = "Digite um endereço...",
  className,
  disabled = false,
  error = false,
  errorMessage,
  apiKey,
}: Omit<AddressInputProps, "showBusinessFields" | "fallbackToManual">) {
  return (
    <AddressInput
      value={value}
      onChange={onChange}
      onAddressSelect={onAddressSelect}
      placeholder={placeholder}
      className={className}
      disabled={disabled}
      error={error}
      errorMessage={errorMessage}
      showBusinessFields={false}
      fallbackToManual={true}
      apiKey={apiKey}
    />
  );
}

// Error boundary wrapper
export function AddressInputWithErrorBoundary(props: AddressInputProps) {
  const [hasError, setHasError] = useState(false);
  const [errorInfo, setErrorInfo] = useState("");

  useEffect(() => {
    const handleError = (error: ErrorEvent) => {
      if (error.message.includes("Google") || error.message.includes("Places")) {
        setHasError(true);
        setErrorInfo(error.message);
      }
    };

    window.addEventListener("error", handleError);
    return () => window.removeEventListener("error", handleError);
  }, []);

  if (hasError) {
    return (
      <div className="space-y-4">
        <Alert variant="destructive">
          <IconAlertTriangle className="h-4 w-4" />
          <AlertDescription>
            Erro no carregamento do Google Places: {errorInfo}
            <div className="mt-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  setHasError(false);
                  setErrorInfo("");
                }}
              >
                <IconRefresh className="h-4 w-4 mr-2" />
                Tentar novamente
              </Button>
            </div>
          </AlertDescription>
        </Alert>

        {/* Fallback to manual form */}
        <ManualAddressForm
          value={props.onAddressSelect ? {} : undefined}
          onChange={(address) => {
            props.onChange?.(address.formattedAddress || "");
            props.onAddressSelect?.(address);
          }}
          showBusinessFields={props.showBusinessFields}
          disabled={props.disabled}
        />
      </div>
    );
  }

  return <AddressInput {...props} />;
}
