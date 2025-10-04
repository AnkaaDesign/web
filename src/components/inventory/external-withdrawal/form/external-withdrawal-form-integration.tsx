// apps/web/src/components/inventory/external-withdrawal/form/external-withdrawal-form-integration.ts

import { useState, useCallback, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { useExternalWithdrawalMutations } from "../../../../hooks";
import { routes } from "../../../../constants";
import { type ExternalWithdrawalCreateFormData } from "../../../../schemas";
import { type ExternalWithdrawalCreateResponse } from "../../../../types";

export interface FormItem {
  itemId: string;
  quantity: number;
  price: number | null;
}

export interface FormData {
  withdrawerName: string;
  willReturn: boolean;
  notes?: string;
  items: FormItem[];
}

export interface UseExternalWithdrawalFormIntegrationOptions {
  /** Callback called after successful form submission */
  onSuccess?: (result: ExternalWithdrawalCreateResponse) => void;
  /** Callback called if form submission fails */
  onError?: (error: any) => void;
  /** Whether to navigate to the external withdrawals list after successful submission */
  navigateOnSuccess?: boolean;
  /** Custom navigation path after successful submission */
  successNavigationPath?: string;
  /** Whether to show success/error notifications */
  showNotifications?: boolean;
  /** Delay before navigation (in milliseconds) */
  navigationDelay?: number;
}

export interface UseExternalWithdrawalFormIntegrationReturn {
  /** Function to submit the form data */
  submitForm: (data: FormData) => Promise<void>;
  /** Current loading state */
  isLoading: boolean;
  /** Current submitting state */
  isSubmitting: boolean;
  /** Any error that occurred during submission */
  error: any;
  /** Whether the submission was successful */
  isSuccess: boolean;
  /** Reset the form state */
  reset: () => void;
  /** Raw mutation object for advanced use cases */
  mutation: ReturnType<typeof useExternalWithdrawalMutations>["createMutation"];
}

/**
 * Hook for integrating external withdrawal form with API
 *
 * @param options Configuration options for the form integration
 * @returns Object containing submission function, loading states, and utilities
 */
export function useExternalWithdrawalFormIntegration(options: UseExternalWithdrawalFormIntegrationOptions = {}): UseExternalWithdrawalFormIntegrationReturn {
  const { onSuccess, onError, navigateOnSuccess = true, successNavigationPath, showNotifications = true, navigationDelay = 1500 } = options;

  const navigate = useNavigate();
  const { createMutation } = useExternalWithdrawalMutations();

  // Local state for tracking submission
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<any>(null);
  const [isSuccess, setIsSuccess] = useState(false);

  // Reset state when mutation resets
  useEffect(() => {
    if (!createMutation.isPending && !createMutation.isSuccess && !createMutation.isError) {
      setIsSubmitting(false);
      setError(null);
      setIsSuccess(false);
    }
  }, [createMutation.isPending, createMutation.isSuccess, createMutation.isError]);

  /**
   * Transform form data into the format expected by the API
   */
  const transformFormData = useCallback((data: FormData): ExternalWithdrawalCreateFormData => {
    return {
      withdrawerName: data.withdrawerName.trim(),
      willReturn: data.willReturn,
      notes: data.notes?.trim() || null,
      items: data.items.map((item) => ({
        itemId: item.itemId,
        withdrawedQuantity: item.quantity,
        price: data.willReturn ? null : item.price || 0,
      })),
    };
  }, []);

  /**
   * Validate form data before submission
   */
  const validateFormData = useCallback((data: FormData): { isValid: boolean; errors: string[] } => {
    const errors: string[] = [];

    // Validate withdrawer name
    if (!data.withdrawerName?.trim()) {
      errors.push("Nome do retirador é obrigatório");
    } else if (data.withdrawerName.trim().length < 2) {
      errors.push("Nome do retirador deve ter pelo menos 2 caracteres");
    } else if (data.withdrawerName.trim().length > 200) {
      errors.push("Nome do retirador deve ter no máximo 200 caracteres");
    }

    // Validate items
    if (!data.items || data.items.length === 0) {
      errors.push("Pelo menos um item deve ser selecionado");
    } else {
      // Validate individual items
      data.items.forEach((item, index) => {
        if (!item.itemId) {
          errors.push(`Item ${index + 1}: ID do item é obrigatório`);
        }

        if (!item.quantity || item.quantity <= 0) {
          errors.push(`Item ${index + 1}: Quantidade deve ser maior que zero`);
        }

        // Validate price for non-return items
        if (!data.willReturn) {
          if (item.price === null || item.price === undefined || item.price < 0) {
            errors.push(`Item ${index + 1}: Preço é obrigatório para itens que não serão devolvidos`);
          }
        }
      });
    }

    // Validate notes length
    if (data.notes && data.notes.length > 500) {
      errors.push("Observações devem ter no máximo 500 caracteres");
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }, []);

  /**
   * Handle successful submission
   */
  const handleSuccess = useCallback(
    (result: ExternalWithdrawalCreateResponse) => {
      setIsSuccess(true);
      setError(null);

      if (showNotifications) {
        // Success notification is handled by API client
      }

      // Call custom success callback
      if (onSuccess) {
        try {
          onSuccess(result);
        } catch (callbackError) {
          console.error("Error in onSuccess callback:", callbackError);
        }
      }

      // Navigate after delay if configured
      if (navigateOnSuccess) {
        const navigationPath = successNavigationPath || routes.inventory.externalWithdrawals?.root || "/inventory/external-withdrawals";

        setTimeout(() => {
          navigate(navigationPath);
        }, navigationDelay);
      }
    },
    [onSuccess, showNotifications, navigateOnSuccess, successNavigationPath, navigationDelay, navigate],
  );

  /**
   * Handle submission error
   */
  const handleError = useCallback(
    (submissionError: any) => {
      setError(submissionError);
      setIsSuccess(false);

      // Show error notification if enabled
      if (showNotifications) {
        const errorMessage = submissionError?.message || submissionError?.response?.data?.message || "Erro ao criar retirada externa";
        toast.error("Erro na criação", {
          description: errorMessage,
        });
      }

      // Call custom error callback
      if (onError) {
        try {
          onError(submissionError);
        } catch (callbackError) {
          console.error("Error in onError callback:", callbackError);
        }
      }
    },
    [onError, showNotifications],
  );

  /**
   * Submit the form data
   */
  const submitForm = useCallback(
    async (data: FormData): Promise<void> => {
      try {
        setIsSubmitting(true);
        setError(null);
        setIsSuccess(false);

        // Validate form data
        const validation = validateFormData(data);
        if (!validation.isValid) {
          const errorMessage = validation.errors.join(", ");
          throw new Error(errorMessage);
        }

        // Transform data for API
        const apiData = transformFormData(data);

        // Submit to API
        const result = await createMutation.mutateAsync({ data: apiData });

        // Handle success
        if (result.success) {
          handleSuccess(result);
        } else {
          throw new Error(result.message || "Falha ao criar retirada externa");
        }
      } catch (submissionError) {
        console.error("Form submission error:", submissionError);
        handleError(submissionError);
        throw submissionError; // Re-throw so caller can handle if needed
      } finally {
        setIsSubmitting(false);
      }
    },
    [validateFormData, transformFormData, createMutation, handleSuccess, handleError],
  );

  /**
   * Reset all form integration state
   */
  const reset = useCallback(() => {
    setIsSubmitting(false);
    setError(null);
    setIsSuccess(false);
    createMutation.reset();
  }, [createMutation]);

  return {
    submitForm,
    isLoading: createMutation.isPending,
    isSubmitting,
    error: error || createMutation.error,
    isSuccess,
    reset,
    mutation: createMutation,
  };
}

/**
 * Higher-order component that provides form integration props
 * Can be used to wrap form components with integration logic
 */
export interface WithFormIntegrationProps {
  onSubmit: (data: FormData) => Promise<void>;
  isLoading: boolean;
  isSubmitting: boolean;
  error: any;
  isSuccess: boolean;
  onReset: () => void;
}

export function withExternalWithdrawalFormIntegration<P extends WithFormIntegrationProps>(
  Component: React.ComponentType<P>,
  integrationOptions?: UseExternalWithdrawalFormIntegrationOptions,
) {
  return function WrappedComponent(props: Omit<P, keyof WithFormIntegrationProps>) {
    const integration = useExternalWithdrawalFormIntegration(integrationOptions);

    const integrationProps: WithFormIntegrationProps = {
      onSubmit: integration.submitForm,
      isLoading: integration.isLoading,
      isSubmitting: integration.isSubmitting,
      error: integration.error,
      isSuccess: integration.isSuccess,
      onReset: integration.reset,
    };

    return <Component {...(props as P)} {...integrationProps} />;
  };
}

/**
 * Utility function to calculate total price from form items
 */
export function calculateTotalPrice(items: FormItem[], willReturn: boolean): number {
  if (willReturn) return 0;

  return items.reduce((total, item) => {
    const price = item.price || 0;
    const quantity = item.quantity || 0;
    return total + price * quantity;
  }, 0);
}

/**
 * Utility function to validate item selection
 */
export function validateItemSelection(
  selectedItems: Set<string>,
  quantities: Record<string, number>,
  prices: Record<string, number>,
  willReturn: boolean,
): { isValid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (selectedItems.size === 0) {
    errors.push("Pelo menos um item deve ser selecionado");
  }

  // Check for items without valid quantities
  const itemsWithoutQuantity = Array.from(selectedItems).filter((itemId) => {
    const quantity = quantities[itemId];
    return !quantity || quantity <= 0;
  });
  if (itemsWithoutQuantity.length > 0) {
    errors.push("Todos os itens selecionados devem ter quantidade válida");
  }

  // Check for items without prices (only if not returning)
  if (!willReturn) {
    const itemsWithoutPrice = Array.from(selectedItems).filter((itemId) => {
      const price = prices[itemId];
      return price === null || price === undefined || price < 0;
    });
    if (itemsWithoutPrice.length > 0) {
      errors.push("Todos os itens selecionados devem ter preço definido quando não serão devolvidos");
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}

/**
 * Utility function to convert URL state to form data
 */
export function convertUrlStateToFormData(
  withdrawerName: string,
  willReturn: boolean,
  notes: string | null,
  selectedItems: Set<string>,
  quantities: Record<string, number>,
  prices: Record<string, number>,
): FormData {
  return {
    withdrawerName: withdrawerName.trim(),
    willReturn,
    notes: notes?.trim() || undefined,
    items: Array.from(selectedItems).map((itemId) => ({
      itemId,
      quantity: quantities[itemId] || 1,
      price: willReturn ? null : prices[itemId] || 0,
    })),
  };
}
