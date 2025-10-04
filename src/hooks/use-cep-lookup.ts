import { useState, useCallback } from "react";

interface CepData {
  logradouro: string;
  bairro: string;
  localidade: string;
  uf: string;
  erro?: boolean;
}

interface UseCepLookupOptions {
  onSuccess?: (data: CepData) => void;
  onError?: (error: Error) => void;
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
        const response = await fetch(`https://viacep.com.br/ws/${cleanCep}/json/`);

        if (!response.ok) {
          throw new Error("Failed to fetch CEP data");
        }

        const data: CepData = await response.json();

        if (data.erro) {
          throw new Error("CEP not found");
        }

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
