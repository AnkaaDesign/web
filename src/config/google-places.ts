/**
 * Google Places API Configuration
 *
 * This file handles Google Places API configuration and provides
 * utilities for checking API availability and handling errors.
 */

export interface GooglePlacesConfig {
  apiKey: string;
  language: string;
  country: string;
  types: string;
  searchDelay: number;
}

// Default configuration
const DEFAULT_CONFIG: Omit<GooglePlacesConfig, "apiKey"> = {
  language: "pt-BR",
  country: "br",
  types: "address",
  searchDelay: 300,
};

/**
 * Get Google Places API key from environment variables
 */
export function getGooglePlacesApiKey(): string | null {
  return import.meta.env.VITE_GOOGLE_PLACES_API_KEY || null;
}

/**
 * Check if Google Places API is available
 */
export function isGooglePlacesAvailable(): boolean {
  const apiKey = getGooglePlacesApiKey();
  return !!apiKey && apiKey.length > 0;
}

/**
 * Get complete Google Places configuration
 */
export function getGooglePlacesConfig(overrides?: Partial<GooglePlacesConfig>): GooglePlacesConfig | null {
  const apiKey = getGooglePlacesApiKey();

  if (!apiKey) {
    return null;
  }

  return {
    apiKey,
    ...DEFAULT_CONFIG,
    ...overrides,
  };
}

/**
 * Validate Google Places API key format
 */
export function validateGooglePlacesApiKey(apiKey: string): boolean {
  // Basic validation - Google API keys typically start with specific prefixes
  const validPrefixes = ["AIza", "AAAA", "BBBB"]; // Common Google API key prefixes

  if (!apiKey || apiKey.length < 30) {
    return false;
  }

  return validPrefixes.some((prefix) => apiKey.startsWith(prefix));
}

/**
 * Get Google Places API status and error messages
 */
export function getGooglePlacesStatus(): {
  available: boolean;
  error?: string;
  suggestion?: string;
} {
  const apiKey = getGooglePlacesApiKey();

  if (!apiKey) {
    return {
      available: false,
      error: "Chave da API do Google Places não configurada",
      suggestion: "Configure a variável VITE_GOOGLE_PLACES_API_KEY no arquivo .env",
    };
  }

  if (!validateGooglePlacesApiKey(apiKey)) {
    return {
      available: false,
      error: "Chave da API do Google Places parece inválida",
      suggestion: "Verifique se a chave foi copiada corretamente do Google Cloud Console",
    };
  }

  return {
    available: true,
  };
}

/**
 * Create Google Places API URLs
 */
export function createGooglePlacesUrl(endpoint: "autocomplete" | "details", params: Record<string, string>): string {
  const baseUrl = "https://maps.googleapis.com/maps/api/place";
  const url = new URL(`${baseUrl}/${endpoint}/json`);

  Object.entries(params).forEach(([key, value]) => {
    if (value) {
      url.searchParams.set(key, value);
    }
  });

  return url.toString();
}

/**
 * Handle Google Places API errors
 */
export function handleGooglePlacesError(error: any): string {
  if (error?.status) {
    switch (error.status) {
      case "ZERO_RESULTS":
        return "Nenhum resultado encontrado para esta busca";
      case "INVALID_REQUEST":
        return "Parâmetros de busca inválidos";
      case "REQUEST_DENIED":
        return "Acesso negado. Verifique sua chave da API";
      case "OVER_QUERY_LIMIT":
        return "Limite de consultas excedido. Tente novamente mais tarde";
      case "UNKNOWN_ERROR":
        return "Erro temporário do servidor. Tente novamente";
      default:
        return `Erro da API: ${error.status}`;
    }
  }

  if (error?.message?.includes("fetch")) {
    return "Erro de conexão. Verifique sua internet";
  }

  return "Erro desconhecido. Tente novamente";
}

/**
 * Development helper to log Google Places configuration
 */
export function logGooglePlacesConfig(): void {
  if (import.meta.env.DEV) {
    const status = getGooglePlacesStatus();
    const config = getGooglePlacesConfig();

    console.group("🗺️ Google Places Configuration");
    if (status.error) {
      console.warn("Error:", status.error);
      if (status.suggestion) {
        console.info("Suggestion:", status.suggestion);
      }
    }

    if (config) {
    }

    console.groupEnd();
  }
}

// Log configuration on module load in development
if (import.meta.env.DEV) {
  logGooglePlacesConfig();
}
