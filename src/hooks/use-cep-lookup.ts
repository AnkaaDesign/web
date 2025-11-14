import { useState, useCallback } from "react";

interface BrasilApiCepData {
  cep: string;
  state: string;
  city: string;
  neighborhood: string;
  street: string;
  service: string;
}

interface CepData {
  street: string;
  streetType?: string;
  bairro: string;
  localidade: string;
  uf: string;
  erro?: boolean;
}

interface UseCepLookupOptions {
  onSuccess?: (data: CepData) => void;
  onError?: (error: Error) => void;
}

// Portuguese street type prefixes for parsing API responses
const STREET_TYPE_PREFIXES = [
  "RUA",
  "AVENIDA",
  "ALAMEDA",
  "TRAVESSA",
  "PRAÇA",
  "PRACA", // Without accent for matching
  "RODOVIA",
  "ESTRADA",
  "VIA",
  "LARGO",
  "VIELA",
  "BECO",
  "RUELA",
  "CAMINHO",
  "PASSAGEM",
  "JARDIM",
  "QUADRA",
  "LOTE",
  "SITIO", // Without accent for matching
  "PARQUE",
  "FAZENDA",
  "CHACARA", // Without accent for matching
  "CONDOMINIO", // Without accent for matching
  "CONJUNTO",
  "RESIDENCIAL",
];

// Map Portuguese street types to English enum values
const STREET_TYPE_PT_TO_EN: Record<string, string> = {
  RUA: "STREET",
  AVENIDA: "AVENUE",
  ALAMEDA: "ALLEY",
  TRAVESSA: "CROSSING",
  PRACA: "SQUARE",
  PRAÇA: "SQUARE",
  RODOVIA: "HIGHWAY",
  ESTRADA: "ROAD",
  VIA: "WAY",
  LARGO: "PLAZA",
  VIELA: "LANE",
  BECO: "DEADEND",
  RUELA: "SMALL_STREET",
  CAMINHO: "PATH",
  PASSAGEM: "PASSAGE",
  JARDIM: "GARDEN",
  QUADRA: "BLOCK",
  LOTE: "LOT",
  SITIO: "SITE",
  SÍTIO: "SITE",
  PARQUE: "PARK",
  FAZENDA: "FARM",
  CHACARA: "RANCH",
  CHÁCARA: "RANCH",
  CONDOMINIO: "CONDOMINIUM",
  CONDOMÍNIO: "CONDOMINIUM",
  CONJUNTO: "COMPLEX",
  RESIDENCIAL: "RESIDENTIAL",
};

function toTitleCase(str: string): string {
  if (!str) return str;

  // Words that should remain uppercase
  const uppercaseWords = ['LTDA', 'ME', 'EPP', 'EIRELI', 'SA', 'S/A', 'S.A.', 'CIA', 'E', 'DE', 'DA', 'DO', 'DOS', 'DAS'];

  // Words that should be lowercase (prepositions, articles, conjunctions)
  const lowercaseWords = ['e', 'de', 'da', 'do', 'dos', 'das', 'para', 'com', 'sem'];

  return str
    .toLowerCase()
    .split(' ')
    .map((word, index) => {
      const upperWord = word.toUpperCase();

      // Keep specific words in uppercase
      if (uppercaseWords.includes(upperWord)) {
        return upperWord;
      }

      // Keep prepositions/articles lowercase unless it's the first word
      if (index > 0 && lowercaseWords.includes(word.toLowerCase())) {
        return word.toLowerCase();
      }

      // Capitalize first letter of each word
      return word.charAt(0).toUpperCase() + word.slice(1);
    })
    .join(' ');
}

function extractStreetType(street: string | null | undefined): { type: string | null; address: string } {
  // Handle null or undefined street
  if (!street) {
    return { type: null, address: "" };
  }

  const normalized = street.toUpperCase().trim();

  for (const type of STREET_TYPES) {
    if (normalized.startsWith(type + " ")) {
      // Extract the remaining address after the street type
      const remainingAddress = street.substring(type.length + 1).trim();

      // Check if the address starts with a preposition (do, da, dos, das, de)
      // If so, keep the full address including the street type
      const hasPreposition = /^(d[oae]s?)\s/i.test(remainingAddress);

      return {
        type: type.replace("Ç", "C").replace("Í", "I").replace("Ã", "A").replace("Ó", "O"),
        address: hasPreposition ? street : remainingAddress, // Keep full address if has preposition
      };
    }
  }

  return { type: null, address: street };
}

export function useCepLookup(options?: UseCepLookupOptions) {
  const [isLoading, setIsLoading] = useState(false);
  const [previousValue, setPreviousValue] = useState<string>("");

  const lookupCep = useCallback(
    async (cep: string) => {
      const cleanCep = cep?.replace(/\D/g, "") || "";

      // Only lookup if we have a complete CEP (8 digits) and it's different from previous
      if (cleanCep.length !== 8 || cleanCep === previousValue) {
        return null;
      }

      setPreviousValue(cleanCep);
      setIsLoading(true);

      try {
        const response = await fetch(`https://brasilapi.com.br/api/cep/v2/${cleanCep}`);

        if (!response.ok) {
          throw new Error("Failed to fetch CEP data");
        }

        const brasilApiData: BrasilApiCepData = await response.json();

        // Extract street type from street name
        const { type, address } = extractStreetType(brasilApiData.street);

        // Convert to ViaCEP format for compatibility
        const data: CepData = {
          street: address || brasilApiData.street,
          streetType: type || undefined,
          bairro: toTitleCase(brasilApiData.neighborhood),
          localidade: toTitleCase(brasilApiData.city),
          uf: brasilApiData.state,
        };

        options?.onSuccess?.(data);
        return data;
      } catch (error) {
        console.error("Error looking up CEP:", error);
        options?.onError?.(error as Error);
        return null;
      } finally {
        setIsLoading(false);
      }
    },
    [previousValue, options],
  );

  return {
    lookupCep,
    isLoading,
  };
}
