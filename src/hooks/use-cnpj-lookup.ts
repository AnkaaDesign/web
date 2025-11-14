import { useState, useCallback } from "react";

interface BrasilApiCnpjData {
  cnpj: string;
  razao_social: string;
  nome_fantasia: string;
  cnae_fiscal: number;
  cnae_fiscal_descricao: string;
  descricao_situacao_cadastral: string;
  situacao_cadastral: number;
  logradouro: string;
  numero: string;
  complemento: string;
  bairro: string;
  cep: string;
  uf: string;
  municipio: string;
  ddd_telefone_1: string;
  ddd_telefone_2?: string;
  email: string;
}

interface CnpjData {
  cnpj: string;
  fantasyName: string;
  corporateName: string;
  email: string | null;
  address: string;
  addressNumber: string;
  addressComplement: string | null;
  neighborhood: string;
  city: string;
  state: string;
  zipCode: string;
  phones: string[];
  economicActivityCode: string;
  economicActivityDescription: string;
  registrationStatus: "ACTIVE" | "SUSPENDED" | "UNFIT" | "ACTIVE_NOT_REGULAR" | "DEREGISTERED" | null;
  streetType: string | null;
}

interface UseCnpjLookupOptions {
  onSuccess?: (data: CnpjData) => void;
  onError?: (error: Error) => void;
}

const STREET_TYPES = [
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

function extractStreetType(street: string): { type: string | null; address: string } {
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

function mapSituacaoCadastral(code: number): "ACTIVE" | "SUSPENDED" | "UNFIT" | "ACTIVE_NOT_REGULAR" | "DEREGISTERED" | null {
  const mapping: Record<number, "ACTIVE" | "SUSPENDED" | "UNFIT" | "ACTIVE_NOT_REGULAR" | "DEREGISTERED"> = {
    2: "ACTIVE",
    3: "SUSPENDED",
    4: "UNFIT",
    8: "DEREGISTERED",
  };
  return mapping[code] || null;
}

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

export function useCnpjLookup(options?: UseCnpjLookupOptions) {
  const [isLoading, setIsLoading] = useState(false);
  const [previousValue, setPreviousValue] = useState<string>("");

  const lookupCnpj = useCallback(
    async (cnpj: string) => {
      const cleanCnpj = cnpj?.replace(/\D/g, "") || "";

      // Only lookup if we have a complete CNPJ (14 digits) and it's different from previous
      if (cleanCnpj.length !== 14 || cleanCnpj === previousValue) {
        return null;
      }

      setPreviousValue(cleanCnpj);
      setIsLoading(true);

      try {
        const response = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${cleanCnpj}`);

        if (!response.ok) {
          throw new Error("Failed to fetch CNPJ data");
        }

        const brasilApiData: BrasilApiCnpjData = await response.json();

        // Extract street type from street name
        const { type, address } = extractStreetType(brasilApiData.logradouro);

        // Collect all available phones
        const phones: string[] = [];
        if (brasilApiData.ddd_telefone_1) {
          phones.push(brasilApiData.ddd_telefone_1);
        }
        if (brasilApiData.ddd_telefone_2) {
          phones.push(brasilApiData.ddd_telefone_2);
        }

        const data: CnpjData = {
          cnpj: brasilApiData.cnpj,
          fantasyName: toTitleCase(brasilApiData.nome_fantasia || brasilApiData.razao_social),
          corporateName: toTitleCase(brasilApiData.razao_social),
          email: brasilApiData.email || null,
          address: address || brasilApiData.logradouro,
          addressNumber: brasilApiData.numero,
          addressComplement: brasilApiData.complemento || null,
          neighborhood: toTitleCase(brasilApiData.bairro),
          city: toTitleCase(brasilApiData.municipio),
          state: brasilApiData.uf,
          zipCode: brasilApiData.cep,
          phones: phones,
          economicActivityCode: brasilApiData.cnae_fiscal.toString(),
          economicActivityDescription: brasilApiData.cnae_fiscal_descricao,
          registrationStatus: mapSituacaoCadastral(brasilApiData.situacao_cadastral),
          streetType: type,
        };

        options?.onSuccess?.(data);
        return data;
      } catch (error) {
        console.error("Error looking up CNPJ:", error);
        options?.onError?.(error as Error);
        return null;
      } finally {
        setIsLoading(false);
      }
    },
    [previousValue, options],
  );

  return {
    lookupCnpj,
    isLoading,
  };
}
