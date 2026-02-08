import { useState, useCallback, useRef } from "react";
import { useCnpjLookup } from "./use-cnpj-lookup";
import { cleanCNPJ, formatCNPJ, isValidCNPJ } from "../../utils";
import type { CustomerQuickCreateFormData } from "@schemas";

// Re-define CnpjData interface (matches the one from use-cnpj-lookup.ts)
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

interface CnpjAutocompleteState {
  isLookingUp: boolean;
  cnpjData: CnpjData | null;
  isCnpjInput: boolean;
  formattedDisplay: string;
  error: string | null;
}

interface UseCnpjAutocompleteOptions {
  onLookupComplete?: (data: CnpjData) => void;
  onLookupError?: (error: Error) => void;
}

/**
 * Hook for integrating CNPJ lookup with combobox components.
 *
 * Features:
 * - Detects if input looks like a CNPJ (8+ digits)
 * - Automatically triggers Brasil API lookup when 14 digits are entered
 * - Provides dynamic create labels based on lookup state
 * - Builds customer data for creation with CNPJ info
 */
export function useCnpjAutocomplete(options?: UseCnpjAutocompleteOptions) {
  const [state, setState] = useState<CnpjAutocompleteState>({
    isLookingUp: false,
    cnpjData: null,
    isCnpjInput: false,
    formattedDisplay: "",
    error: null,
  });

  const previousCnpjRef = useRef<string>("");
  const lookupInProgressRef = useRef<boolean>(false);

  const { lookupCnpj, isLoading } = useCnpjLookup({
    onSuccess: (data) => {
      setState(prev => ({
        ...prev,
        cnpjData: data,
        error: null,
        isLookingUp: false,
      }));
      lookupInProgressRef.current = false;
      options?.onLookupComplete?.(data);
    },
    onError: (error) => {
      setState(prev => ({
        ...prev,
        cnpjData: null,
        error: "CNPJ não encontrado",
        isLookingUp: false,
      }));
      lookupInProgressRef.current = false;
      options?.onLookupError?.(error);
    },
  });

  /**
   * Detect if input looks like a CNPJ (mostly digits, 8+ length)
   */
  const detectCnpjInput = useCallback((input: string): boolean => {
    if (!input) return false;
    const cleaned = cleanCNPJ(input);
    // Consider it CNPJ input if it has 8+ digits
    return cleaned.length >= 8;
  }, []);

  /**
   * Process input and trigger CNPJ lookup if needed
   */
  const processInput = useCallback((input: string) => {
    const cleaned = cleanCNPJ(input);
    const isCnpj = detectCnpjInput(input);

    setState(prev => ({
      ...prev,
      isCnpjInput: isCnpj,
      formattedDisplay: isCnpj ? formatCNPJ(cleaned) : input,
      // Reset data if CNPJ changed
      cnpjData: cleaned !== previousCnpjRef.current ? null : prev.cnpjData,
      error: cleaned !== previousCnpjRef.current ? null : prev.error,
    }));

    // Trigger lookup if complete 14-digit CNPJ and not already looking up
    if (cleaned.length === 14 && cleaned !== previousCnpjRef.current && !lookupInProgressRef.current) {
      previousCnpjRef.current = cleaned;
      lookupInProgressRef.current = true;
      setState(prev => ({ ...prev, isLookingUp: true }));
      lookupCnpj(cleaned);
    }
  }, [detectCnpjInput, lookupCnpj]);

  /**
   * Get dynamic create label based on current state
   */
  const getCreateLabel = useCallback((searchValue: string): string => {
    const cleaned = cleanCNPJ(searchValue);
    const isCnpj = detectCnpjInput(searchValue);

    if (!isCnpj) {
      // Regular text - use default label
      return `Criar cliente "${searchValue}"`;
    }

    if (state.isLookingUp || isLoading) {
      return `Buscando CNPJ ${formatCNPJ(cleaned)}...`;
    }

    if (state.cnpjData) {
      const companyName = state.cnpjData.fantasyName || state.cnpjData.corporateName;
      return `Criar cliente "${companyName}" (${formatCNPJ(state.cnpjData.cnpj)})`;
    }

    if (state.error && cleaned.length === 14) {
      return `CNPJ ${formatCNPJ(cleaned)} não encontrado - criar mesmo assim?`;
    }

    // Partial CNPJ or pending lookup
    if (cleaned.length === 14) {
      return `Criar cliente com CNPJ ${formatCNPJ(cleaned)}`;
    }

    // Typing CNPJ but not complete yet
    return `Digite o CNPJ completo (${cleaned.length}/14 dígitos)`;
  }, [state, isLoading, detectCnpjInput]);

  /**
   * Build customer data for creation based on lookup results
   */
  const buildCustomerData = useCallback((searchValue: string): CustomerQuickCreateFormData => {
    // Debug: Log the current state
    console.log('[useCnpjAutocomplete] buildCustomerData called with:', searchValue);
    console.log('[useCnpjAutocomplete] Current cnpjData:', state.cnpjData);

    // If we have CNPJ data from successful lookup, use it
    if (state.cnpjData) {
      console.log('[useCnpjAutocomplete] Using CNPJ data for customer creation');
      return {
        fantasyName: state.cnpjData.fantasyName || state.cnpjData.corporateName,
        cnpj: state.cnpjData.cnpj,
        corporateName: state.cnpjData.corporateName,
        email: state.cnpjData.email,
        streetType: state.cnpjData.streetType as any,
        address: state.cnpjData.address,
        addressNumber: state.cnpjData.addressNumber,
        addressComplement: state.cnpjData.addressComplement,
        neighborhood: state.cnpjData.neighborhood,
        city: state.cnpjData.city,
        state: state.cnpjData.state,
        zipCode: state.cnpjData.zipCode,
        phones: state.cnpjData.phones || [],
        registrationStatus: state.cnpjData.registrationStatus,
      };
    }

    // Check if input is a valid CNPJ (even if lookup failed)
    const cleaned = cleanCNPJ(searchValue);
    if (cleaned.length === 14 && isValidCNPJ(cleaned)) {
      // User typed a valid CNPJ but lookup failed - create with CNPJ only
      return {
        fantasyName: formatCNPJ(cleaned), // Use formatted CNPJ as placeholder name
        cnpj: cleaned,
        phones: [],
      };
    }

    // Regular text - just use as fantasyName
    return {
      fantasyName: searchValue,
      phones: [],
    };
  }, [state]);

  /**
   * Reset the autocomplete state
   */
  const reset = useCallback(() => {
    previousCnpjRef.current = "";
    lookupInProgressRef.current = false;
    setState({
      isLookingUp: false,
      cnpjData: null,
      isCnpjInput: false,
      formattedDisplay: "",
      error: null,
    });
  }, []);

  return {
    // State
    isLookingUp: state.isLookingUp || isLoading,
    cnpjData: state.cnpjData,
    isCnpjInput: state.isCnpjInput,
    formattedDisplay: state.formattedDisplay,
    error: state.error,

    // Actions
    processInput,
    getCreateLabel,
    buildCustomerData,
    reset,
  };
}
