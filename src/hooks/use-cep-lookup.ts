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
  logradouro: string;
  logradouroType?: string;
  bairro: string;
  localidade: string;
  uf: string;
  erro?: boolean;
}

interface UseCepLookupOptions {
  onSuccess?: (data: CepData) => void;
  onError?: (error: Error) => void;
}

const LOGRADOURO_TYPES = [
  "RUA",
  "AVENIDA",
  "ALAMEDA",
  "TRAVESSA",
  "PRAÇA",
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
  "SÍTIO",
  "PARQUE",
  "FAZENDA",
  "CHÁCARA",
  "CONDOMÍNIO",
  "CONJUNTO",
  "RESIDENCIAL",
];

function extractLogradouroType(street: string | null | undefined): { type: string | null; address: string } {
  // Handle null or undefined street
  if (!street) {
    return { type: null, address: "" };
  }

  const normalized = street.toUpperCase().trim();

  for (const type of LOGRADOURO_TYPES) {
    if (normalized.startsWith(type + " ")) {
      return {
        type: type.replace("Ç", "C").replace("Í", "I").replace("Ã", "A").replace("Ó", "O"),
        address: street.substring(type.length + 1).trim(),
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

        // Extract logradouro type from street name
        const { type, address } = extractLogradouroType(brasilApiData.street);

        // Convert to ViaCEP format for compatibility
        const data: CepData = {
          logradouro: address || brasilApiData.street,
          logradouroType: type || undefined,
          bairro: brasilApiData.neighborhood,
          localidade: brasilApiData.city,
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
