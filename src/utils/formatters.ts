// packages/utils/src/formatters.ts

export const formatChassis = (chassis: string): string => {
  // Remove all non-alphanumeric characters and convert to uppercase
  const cleaned = chassis.replace(/[^A-Z0-9]/gi, "").toUpperCase();

  // Format as: XXX XXXXX XX XXXXXX (3-5-2-6 groups)
  if (cleaned.length <= 3) {
    return cleaned;
  } else if (cleaned.length <= 8) {
    return cleaned.replace(/([A-Z0-9]{3})([A-Z0-9]{1,5})/, "$1 $2");
  } else if (cleaned.length <= 10) {
    return cleaned.replace(/([A-Z0-9]{3})([A-Z0-9]{5})([A-Z0-9]{1,2})/, "$1 $2 $3");
  } else if (cleaned.length <= 17) {
    return cleaned.replace(/([A-Z0-9]{3})([A-Z0-9]{5})([A-Z0-9]{2})([A-Z0-9]{1,6})/, "$1 $2 $3 $4");
  }

  // Limit to 17 characters
  return cleaned.substring(0, 17).replace(/([A-Z0-9]{3})([A-Z0-9]{5})([A-Z0-9]{2})([A-Z0-9]{6})/, "$1 $2 $3 $4");
};

export const formatCPF = (cpf: string): string => {
  const cleaned = cpf.replace(/\D/g, "");

  // Handle partial inputs
  if (cleaned.length <= 3) {
    return cleaned;
  } else if (cleaned.length <= 6) {
    return cleaned.replace(/(\d{3})(\d{1,3})/, "$1.$2");
  } else if (cleaned.length <= 9) {
    return cleaned.replace(/(\d{3})(\d{3})(\d{1,3})/, "$1.$2.$3");
  } else if (cleaned.length <= 11) {
    return cleaned.replace(/(\d{3})(\d{3})(\d{3})(\d{1,2})/, "$1.$2.$3-$4");
  }

  // Limit to 11 digits
  return cleaned.substring(0, 11).replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");
};

export const formatCNPJ = (cnpj: string): string => {
  const cleaned = cnpj.replace(/\D/g, "");

  // Handle partial inputs
  if (cleaned.length <= 2) {
    return cleaned;
  } else if (cleaned.length <= 5) {
    return cleaned.replace(/(\d{2})(\d{1,3})/, "$1.$2");
  } else if (cleaned.length <= 8) {
    return cleaned.replace(/(\d{2})(\d{3})(\d{1,3})/, "$1.$2.$3");
  } else if (cleaned.length <= 12) {
    return cleaned.replace(/(\d{2})(\d{3})(\d{3})(\d{1,4})/, "$1.$2.$3/$4");
  } else if (cleaned.length <= 14) {
    return cleaned.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{1,2})/, "$1.$2.$3/$4-$5");
  }

  // Limit to 14 digits
  return cleaned.substring(0, 14).replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, "$1.$2.$3/$4-$5");
};

export const formatPhone = (phone: string): string => {
  const cleaned = phone.replace(/\D/g, "");
  if (cleaned.length === 13) {
    // +55 11 91234-5678
    return cleaned.replace(/(\d{2})(\d{2})(\d{5})(\d{4})/, "+$1 $2 $3-$4");
  } else if (cleaned.length === 12) {
    // +55 11 1234-5678
    return cleaned.replace(/(\d{2})(\d{2})(\d{4})(\d{4})/, "+$1 $2 $3-$4");
  }
  return phone;
};

export const formatBrazilianPhone = (phone: string): string => {
  const cleaned = phone.replace(/\D/g, "");

  // Remove country code if present
  let phoneNumber = cleaned;
  if (cleaned.startsWith("55") && cleaned.length >= 12) {
    phoneNumber = cleaned.substring(2);
  }

  // Handle partial inputs
  if (phoneNumber.length === 0) {
    return "";
  } else if (phoneNumber.length <= 2) {
    // Just area code: "11"
    return `(${phoneNumber}`;
  } else if (phoneNumber.length <= 6) {
    // Partial number after area code: "(11) 9999"
    const areaCode = phoneNumber.substring(0, 2);
    const firstPart = phoneNumber.substring(2);
    return `(${areaCode}) ${firstPart}`;
  } else if (phoneNumber.length <= 10) {
    // Landline or partial mobile: "(11) 9999-9999" or "(11) 99999-999"
    const areaCode = phoneNumber.substring(0, 2);
    const thirdDigit = phoneNumber.charAt(2);

    // Check if it's a mobile number (third digit is 9)
    const isMobile = thirdDigit === "9";

    if (phoneNumber.length === 10 && !isMobile) {
      // Complete landline (doesn't start with 9)
      const firstPart = phoneNumber.substring(2, 6);
      const secondPart = phoneNumber.substring(6);
      return `(${areaCode}) ${firstPart}-${secondPart}`;
    } else {
      // Partial mobile (7-10 digits starting with 9) or any 7-9 digit number
      const firstPart = phoneNumber.substring(2, 7);
      const secondPart = phoneNumber.substring(7);
      if (secondPart) {
        return `(${areaCode}) ${firstPart}-${secondPart}`;
      }
      return `(${areaCode}) ${firstPart}`;
    }
  } else if (phoneNumber.length === 11) {
    // Complete mobile: "(11) 99999-9999"
    const areaCode = phoneNumber.substring(0, 2);
    const firstPart = phoneNumber.substring(2, 7);
    const secondPart = phoneNumber.substring(7);
    return `(${areaCode}) ${firstPart}-${secondPart}`;
  }

  // Limit to 11 digits for Brazilian phones
  const truncated = phoneNumber.substring(0, 11);
  if (truncated.length === 11) {
    const areaCode = truncated.substring(0, 2);
    const firstPart = truncated.substring(2, 7);
    const secondPart = truncated.substring(7);
    return `(${areaCode}) ${firstPart}-${secondPart}`;
  }

  return phone;
};

export const formatBrazilianPhoneWithCountryCode = (phone: string): string => {
  const cleaned = phone.replace(/\D/g, "");

  if (cleaned.startsWith("55") && cleaned.length === 13) {
    // +55 (11) 99999-9999
    return cleaned.replace(/(\d{2})(\d{2})(\d{5})(\d{4})/, "+$1 ($2) $3-$4");
  } else if (cleaned.startsWith("55") && cleaned.length === 12) {
    // +55 (11) 9999-9999
    return cleaned.replace(/(\d{2})(\d{2})(\d{4})(\d{4})/, "+$1 ($2) $3-$4");
  }

  return phone;
};

export const formatPIS = (pis: string): string => {
  const cleaned = pis.replace(/\D/g, "");

  // Handle partial inputs
  if (cleaned.length <= 3) {
    return cleaned;
  } else if (cleaned.length <= 8) {
    return cleaned.replace(/(\d{3})(\d{1,5})/, "$1.$2");
  } else if (cleaned.length <= 10) {
    return cleaned.replace(/(\d{3})(\d{5})(\d{1,2})/, "$1.$2.$3");
  } else if (cleaned.length <= 11) {
    return cleaned.replace(/(\d{3})(\d{5})(\d{2})(\d{0,1})/, "$1.$2.$3-$4");
  }

  // Limit to 11 digits
  return cleaned.substring(0, 11).replace(/(\d{3})(\d{5})(\d{2})(\d{1})/, "$1.$2.$3-$4");
};

export const formatCEP = (cep: string): string => {
  const cleaned = cep.replace(/\D/g, "");

  // Handle partial inputs
  if (cleaned.length <= 5) {
    return cleaned;
  } else if (cleaned.length <= 8) {
    const firstPart = cleaned.substring(0, 5);
    const secondPart = cleaned.substring(5);
    return `${firstPart}-${secondPart}`;
  }

  // Limit to 8 digits
  const truncated = cleaned.substring(0, 8);
  return truncated.replace(/(\d{5})(\d{3})/, "$1-$2");
};

export const formatZipCode = (zipCode: string): string => {
  if (!zipCode || typeof zipCode !== "string") {
    return "";
  }
  const cleaned = zipCode.replace(/\D/g, "");
  if (cleaned.length <= 5) {
    return cleaned;
  }
  if (cleaned.length <= 8) {
    return cleaned.replace(/(\d{5})(\d{3})/, "$1-$2");
  }
  return zipCode;
};

export type PixKeyType = "cpf" | "cnpj" | "phone" | "email" | "random";

export interface PixKeyInfo {
  type: PixKeyType;
  formatted: string;
  isValid: boolean;
}

export const detectPixKeyType = (key: string): PixKeyInfo => {
  if (!key || typeof key !== "string") {
    return { type: "random", formatted: key, isValid: false };
  }

  const cleaned = key.trim();

  // Email detection (simplest check first)
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (emailRegex.test(cleaned)) {
    return {
      type: "email",
      formatted: cleaned,
      isValid: true
    };
  }

  // Remove all non-digit characters for numeric checks
  const numericOnly = cleaned.replace(/\D/g, "");

  // CPF detection (11 digits)
  if (numericOnly.length === 11 && !numericOnly.startsWith("55")) {
    return {
      type: "cpf",
      formatted: formatCPF(numericOnly),
      isValid: true
    };
  }

  // CNPJ detection (14 digits)
  if (numericOnly.length === 14) {
    return {
      type: "cnpj",
      formatted: formatCNPJ(numericOnly),
      isValid: true
    };
  }

  // Phone detection
  // Brazilian phone with country code: 55 + 2 digit area code + 8 or 9 digits = 12 or 13 digits
  if ((numericOnly.length === 13 || numericOnly.length === 12) && numericOnly.startsWith("55")) {
    return {
      type: "phone",
      formatted: formatBrazilianPhoneWithCountryCode(numericOnly),
      isValid: true
    };
  }

  // Brazilian phone without country code: 2 digit area code + 8 or 9 digits = 10 or 11 digits
  if (numericOnly.length === 11 || numericOnly.length === 10) {
    return {
      type: "phone",
      formatted: formatBrazilianPhone(numericOnly),
      isValid: true
    };
  }

  // Random key (UUID-like or any other format)
  // Random PIX keys are typically 32 characters
  return {
    type: "random",
    formatted: cleaned,
    isValid: cleaned.length >= 32
  };
};

export const formatPixKey = (key: string): string => {
  const info = detectPixKeyType(key);
  return info.formatted;
};

/**
 * Portuguese prepositions and articles that should remain lowercase in Title Case
 * These are common connecting words in Brazilian Portuguese
 */
const PORTUGUESE_LOWERCASE_WORDS = new Set([
  "de", "da", "do", "das", "dos",  // of, from
  "e",                              // and
  "em", "na", "no", "nas", "nos",  // in, on, at
  "para", "pra",                   // for, to
  "por", "pela", "pelo",           // by, through
  "com",                           // with
  "sem",                           // without
  "a", "o", "as", "os",            // the (articles)
  "um", "uma", "uns", "umas",      // a/an (articles)
  "ao", "aos", "à", "às",          // contractions
]);

/**
 * Brazilian company suffixes that should remain uppercase
 */
const COMPANY_SUFFIXES = new Set([
  "ltda", "ltda.",                 // Limitada
  "eireli",                        // Empresa Individual de Responsabilidade Limitada
  "s/a", "s.a.", "s.a",            // Sociedade Anônima
  "cia", "cia.",                   // Companhia
  "mei",                           // Microempreendedor Individual
  "ss",                            // Sociedade Simples
]);

/**
 * Convert a string to Title Case (capitalize first letter of each word)
 * Keeps Portuguese prepositions and articles lowercase (except at the start)
 * Words with 2-3 characters become entirely uppercase (except prepositions)
 * Company suffixes (LTDA, EIRELI, S/A, etc.) remain uppercase
 * Example: "pintura de cabine" -> "Pintura de Cabine"
 * Example: "TROCA DA LONA DO CAMINHAO" -> "Troca da Lona do Caminhão"
 * Example: "AZUL FIRENZE" -> "Azul Firenze"
 * Example: "Tp Transportes" -> "TP Transportes"
 * Example: "Tmr Transportes" -> "TMR Transportes"
 * Example: "TRF Logistic" -> "TRF Logistic"
 * Example: "empresa abc ltda" -> "Empresa Abc LTDA"
 * Example: "comercio eireli" -> "Comercio EIRELI"
 */
export const toTitleCase = (str: string): string => {
  if (!str) return "";
  return str
    .split(" ")
    .map((word, index) => {
      if (word.length === 0) return word;

      const lowerWord = word.toLowerCase();

      // Keep Portuguese prepositions/articles lowercase (except first word)
      if (index > 0 && PORTUGUESE_LOWERCASE_WORDS.has(lowerWord)) {
        return lowerWord;
      }

      // Keep company suffixes uppercase
      if (COMPANY_SUFFIXES.has(lowerWord)) {
        return word.toUpperCase();
      }

      // Words with 2-3 characters become entirely uppercase (likely acronyms/abbreviations)
      if (word.length >= 2 && word.length <= 3) {
        return word.toUpperCase();
      }

      // Capitalize first letter, lowercase the rest
      return lowerWord.charAt(0).toUpperCase() + lowerWord.slice(1);
    })
    .join(" ");
};
