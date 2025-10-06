import { useCallback, useEffect, useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { useExternalWithdrawalFormUrlState } from "@/hooks/use-external-withdrawal-form-url-state";
import type { ExternalWithdrawalFormStage } from "@/hooks/use-external-withdrawal-form-url-state";
import { routes } from "../../../../constants";

/**
 * Navigation and Data Persistence Logic for External Withdrawal Form
 *
 * Features:
 * - Stage transitions with validation
 * - Persist form data across page refreshes using URL state
 * - Handle browser back/forward navigation
 * - Validate stages before allowing progression
 * - Handle incomplete data scenarios
 * - Provide smooth user experience with proper loading states
 */

export interface ExternalWithdrawalFormValidationState {
  stage1Valid: boolean;
  stage2Valid: boolean;
  stage3Valid: boolean;
  canProceedToStage2: boolean;
  canProceedToStage3: boolean;
  canSubmit: boolean;
  errors: {
    withdrawerName?: string;
    selectedItems?: string;
    quantities?: Record<string, string>;
    prices?: Record<string, string>;
    general?: string;
  };
}

export interface ExternalWithdrawalFormNavigationOptions {
  enableAutoSave?: boolean;
  validateOnStageChange?: boolean;
  enableBrowserNavigation?: boolean;
  defaultStage?: ExternalWithdrawalFormStage;
  onStageChange?: (stage: ExternalWithdrawalFormStage, previousStage: ExternalWithdrawalFormStage) => void;
  onValidationError?: (errors: ExternalWithdrawalFormValidationState["errors"]) => void;
  onDataRestore?: (hasRestoredData: boolean) => void;
}

interface NavigationState {
  isNavigating: boolean;
  isValidating: boolean;
  hasUnsavedChanges: boolean;
  lastValidatedStage: ExternalWithdrawalFormStage | null;
}

// Stage configuration with validation rules
const STAGE_VALIDATION_CONFIG = {
  1: {
    title: "Informações Básicas",
    requiredFields: ["withdrawerName"],
    minWithdrawerNameLength: 2,
    maxWithdrawerNameLength: 200,
  },
  2: {
    title: "Seleção de Itens",
    requiredFields: ["selectedItems"],
    minSelectedItems: 1,
    maxSelectedItems: 100,
  },
  3: {
    title: "Confirmação",
    requiredFields: ["withdrawerName", "selectedItems"],
    requirePricesForSale: true,
  },
} as const;

export function useExternalWithdrawalFormNavigation(options: ExternalWithdrawalFormNavigationOptions = {}) {
  const { enableAutoSave = true, validateOnStageChange = true, enableBrowserNavigation = true, defaultStage = 1, onStageChange, onValidationError, onDataRestore } = options;

  const navigate = useNavigate();

  // URL state management
  const urlState = useExternalWithdrawalFormUrlState({
    defaultQuantity: 1,
    defaultPrice: 0,
    preserveQuantitiesOnDeselect: false,
    defaultPageSize: 40,
    validateOnStageChange,
  });

  // Navigation state
  const [navigationState, setNavigationState] = useState<NavigationState>({
    isNavigating: false,
    isValidating: false,
    hasUnsavedChanges: false,
    lastValidatedStage: null,
  });

  // Current stage from URL state
  const currentStage = urlState.stage || defaultStage;

  // Validation logic
  const validateStage = useCallback(
    (
      _stage: ExternalWithdrawalFormStage,
      data?: {
        withdrawerName?: string;
        selectedItems?: Set<string>;
        quantities?: Record<string, number>;
        prices?: Record<string, number>;
        willReturn?: boolean;
      },
    ): ExternalWithdrawalFormValidationState => {
      const {
        withdrawerName = urlState.withdrawerName,
        selectedItems = urlState.selectedItems,
        quantities = urlState.quantities,
        prices = urlState.prices,
        willReturn = urlState.willReturn,
      } = data || {};

      const errors: ExternalWithdrawalFormValidationState["errors"] = {};

      // Stage 1 validation: Basic information
      const stage1Valid = (() => {
        const config = STAGE_VALIDATION_CONFIG[1];

        if (!withdrawerName || withdrawerName.trim().length < config.minWithdrawerNameLength) {
          errors.withdrawerName = `Nome do retirador deve ter pelo menos ${config.minWithdrawerNameLength} caracteres`;
          return false;
        }

        if (withdrawerName.trim().length > config.maxWithdrawerNameLength) {
          errors.withdrawerName = `Nome do retirador deve ter no máximo ${config.maxWithdrawerNameLength} caracteres`;
          return false;
        }

        return true;
      })();

      // Stage 2 validation: Item selection
      const stage2Valid = (() => {
        const config = STAGE_VALIDATION_CONFIG[2];

        if (!selectedItems || selectedItems.size < config.minSelectedItems) {
          errors.selectedItems = `Pelo menos ${config.minSelectedItems} item deve ser selecionado`;
          return false;
        }

        if (selectedItems.size > config.maxSelectedItems) {
          errors.selectedItems = `No máximo ${config.maxSelectedItems} itens podem ser selecionados`;
          return false;
        }

        // Validate quantities for selected items
        const quantityErrors: Record<string, string> = {};
        for (const itemId of selectedItems) {
          const quantity = quantities[itemId];
          if (!quantity || quantity <= 0) {
            quantityErrors[itemId] = "Quantidade deve ser maior que zero";
          }
          if (quantity && quantity > 999999) {
            quantityErrors[itemId] = "Quantidade muito alta";
          }
        }

        if (Object.keys(quantityErrors).length > 0) {
          errors.quantities = quantityErrors;
          return false;
        }

        // Validate prices for sale (willReturn = false)
        if (!willReturn) {
          const priceErrors: Record<string, string> = {};
          for (const itemId of selectedItems) {
            const price = prices[itemId];
            if (!price || price < 0) {
              priceErrors[itemId] = "Preço deve ser informado para venda";
            }
          }

          if (Object.keys(priceErrors).length > 0) {
            errors.prices = priceErrors;
            return false;
          }
        }

        return true;
      })();

      // Stage 3 validation: Final confirmation
      const stage3Valid = stage1Valid && stage2Valid;

      return {
        stage1Valid,
        stage2Valid,
        stage3Valid,
        canProceedToStage2: stage1Valid,
        canProceedToStage3: stage1Valid && stage2Valid,
        canSubmit: stage3Valid,
        errors,
      };
    },
    [urlState],
  );

  // Get current validation state
  const validationState = useMemo(() => validateStage(currentStage), [validateStage, currentStage]);

  // Navigate to stage with validation
  const navigateToStage = useCallback(
    async (
      targetStage: ExternalWithdrawalFormStage,
      options: {
        force?: boolean;
        skipValidation?: boolean;
        showToast?: boolean;
      } = {},
    ): Promise<boolean> => {
      const { force = false, skipValidation = false, showToast = true } = options;

      if (targetStage === currentStage) {
        return true;
      }

      setNavigationState((prev) => ({ ...prev, isNavigating: true, isValidating: !skipValidation }));

      try {
        // Validate current stage before proceeding (if not forced or skipping validation)
        if (!force && !skipValidation && validateOnStageChange) {
          const validation = validateStage(currentStage);

          // Block navigation if current stage is invalid and we're going forward
          if (targetStage > currentStage) {
            if (targetStage >= 2 && !validation.canProceedToStage2) {
              if (showToast) {
                toast.error("Complete as informações básicas antes de prosseguir");
              }
              if (onValidationError) {
                onValidationError(validation.errors);
              }
              return false;
            }

            if (targetStage >= 3 && !validation.canProceedToStage3) {
              if (showToast) {
                toast.error("Selecione pelo menos um item antes de prosseguir");
              }
              if (onValidationError) {
                onValidationError(validation.errors);
              }
              return false;
            }
          }
        }

        // Update stage in URL state
        urlState.setFilter("stage", targetStage);

        // Update navigation state
        setNavigationState((prev) => ({
          ...prev,
          lastValidatedStage: skipValidation ? prev.lastValidatedStage : currentStage,
          hasUnsavedChanges: false,
        }));

        // Trigger stage change callback
        if (onStageChange) {
          onStageChange(targetStage, currentStage);
        }

        if (showToast && targetStage !== currentStage) {
          const stageConfig = STAGE_VALIDATION_CONFIG[targetStage];
          toast.success(`Navegando para: ${stageConfig.title}`);
        }

        return true;
      } catch (error) {
        console.error("Navigation error:", error);
        if (showToast) {
          toast.error("Erro ao navegar entre etapas");
        }
        return false;
      } finally {
        setNavigationState((prev) => ({ ...prev, isNavigating: false, isValidating: false }));
      }
    },
    [currentStage, validateStage, validateOnStageChange, urlState, onStageChange, onValidationError],
  );

  // Stage navigation helpers
  const goToNextStage = useCallback(() => {
    if (currentStage < 3) {
      return navigateToStage((currentStage + 1) as ExternalWithdrawalFormStage);
    }
    return Promise.resolve(false);
  }, [currentStage, navigateToStage]);

  const goToPreviousStage = useCallback(() => {
    if (currentStage > 1) {
      return navigateToStage((currentStage - 1) as ExternalWithdrawalFormStage, { skipValidation: true });
    }
    return Promise.resolve(false);
  }, [currentStage, navigateToStage]);

  const goToStage1 = useCallback(() => navigateToStage(1, { skipValidation: true }), [navigateToStage]);
  const goToStage2 = useCallback(() => navigateToStage(2), [navigateToStage]);
  const goToStage3 = useCallback(() => navigateToStage(3), [navigateToStage]);

  // Auto-save functionality
  useEffect(() => {
    if (!enableAutoSave) return;

    const hasFormData = Boolean(
      urlState.withdrawerName || urlState.selectedItems.size > 0 || Object.keys(urlState.quantities).length > 0 || Object.keys(urlState.prices).length > 0 || urlState.notes,
    );

    setNavigationState((prev) => ({
      ...prev,
      hasUnsavedChanges: hasFormData,
    }));
  }, [enableAutoSave, urlState.withdrawerName, urlState.selectedItems, urlState.quantities, urlState.prices, urlState.notes]);

  // Browser navigation handling
  useEffect(() => {
    if (!enableBrowserNavigation) return;

    const handlePopState = (event: PopStateEvent) => {
      // Let URL state management handle the navigation
      // This prevents double navigation
      event.preventDefault();
    };

    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      if (navigationState.hasUnsavedChanges) {
        event.preventDefault();
        event.returnValue = "Você tem alterações não salvas. Tem certeza que deseja sair?";
        return event.returnValue;
      }
    };

    window.addEventListener("popstate", handlePopState);
    window.addEventListener("beforeunload", handleBeforeUnload);

    return () => {
      window.removeEventListener("popstate", handlePopState);
      window.removeEventListener("beforeunload", handleBeforeUnload);
    };
  }, [enableBrowserNavigation, navigationState.hasUnsavedChanges]);

  // Data restoration on mount
  useEffect(() => {
    const hasExistingData = urlState.withdrawerName || urlState.selectedItems.size > 0 || Object.keys(urlState.quantities).length > 0;

    if (hasExistingData && onDataRestore) {
      onDataRestore(true);
      toast.info("Dados do formulário restaurados", {
        description: "Seus dados foram recuperados da sessão anterior",
      });
    }
  }, []); // Only run on mount

  // Handle form completion and cleanup
  const handleFormComplete = useCallback(
    (withdrawalId?: string) => {
      // Clear all form data
      urlState.resetFilters();

      // Reset navigation state
      setNavigationState({
        isNavigating: false,
        isValidating: false,
        hasUnsavedChanges: false,
        lastValidatedStage: null,
      });

      // Navigate to appropriate page
      if (withdrawalId) {
        navigate(`${routes.inventory.externalWithdrawals?.details || "/inventory/external-withdrawals/details"}/${withdrawalId}`);
      } else {
        navigate(routes.inventory.externalWithdrawals?.root || "/inventory/external-withdrawals");
      }

      toast.success("Retirada externa criada com sucesso!");
    },
    [urlState, navigate],
  );

  // Handle form cancellation
  const handleFormCancel = useCallback(
    (options: { confirmIfUnsaved?: boolean } = {}) => {
      const { confirmIfUnsaved = true } = options;

      if (confirmIfUnsaved && navigationState.hasUnsavedChanges) {
        if (!window.confirm("Você tem alterações não salvas. Tem certeza que deseja cancelar?")) {
          return false;
        }
      }

      // Clear all form data
      urlState.resetFilters();

      // Reset navigation state
      setNavigationState({
        isNavigating: false,
        isValidating: false,
        hasUnsavedChanges: false,
        lastValidatedStage: null,
      });

      // Navigate back to list
      navigate(routes.inventory.externalWithdrawals?.root || "/inventory/external-withdrawals");
      return true;
    },
    [navigationState.hasUnsavedChanges, urlState, navigate],
  );

  // Force stage validation (useful for manual validation triggers)
  const forceValidateCurrentStage = useCallback(() => {
    setNavigationState((prev) => ({ ...prev, isValidating: true }));
    const validation = validateStage(currentStage);
    setNavigationState((prev) => ({ ...prev, isValidating: false }));

    if (onValidationError && !validation[`stage${currentStage}Valid` as keyof ExternalWithdrawalFormValidationState]) {
      onValidationError(validation.errors);
    }

    return validation;
  }, [currentStage, validateStage, onValidationError]);

  return {
    // Current state
    currentStage,
    validationState,
    navigationState,

    // URL state (pass-through for convenience)
    urlState,

    // Navigation methods
    navigateToStage,
    goToNextStage,
    goToPreviousStage,
    goToStage1,
    goToStage2,
    goToStage3,

    // Form lifecycle
    handleFormComplete,
    handleFormCancel,

    // Validation
    validateStage,
    forceValidateCurrentStage,

    // Computed values
    canGoForward: currentStage < 3 && (currentStage === 1 ? validationState.canProceedToStage2 : validationState.canProceedToStage3),
    canGoBackward: currentStage > 1,
    isFirstStage: currentStage === 1,
    isLastStage: currentStage === 3,
    progressPercentage: Math.round((currentStage / 3) * 100),

    // Stage configurations
    stageConfig: STAGE_VALIDATION_CONFIG,
  };
}

// Standalone validation function for external use
export function validateExternalWithdrawalFormData(data: {
  withdrawerName: string;
  selectedItems: Set<string>;
  quantities: Record<string, number>;
  prices: Record<string, number>;
  willReturn: boolean;
}): ExternalWithdrawalFormValidationState {
  const errors: ExternalWithdrawalFormValidationState["errors"] = {};

  // Stage 1 validation
  const stage1Valid = data.withdrawerName.trim().length >= 2 && data.withdrawerName.trim().length <= 200;
  if (!stage1Valid) {
    errors.withdrawerName = "Nome do retirador deve ter entre 2 e 200 caracteres";
  }

  // Stage 2 validation
  const stage2Valid = data.selectedItems.size > 0 && data.selectedItems.size <= 100;
  if (!stage2Valid) {
    errors.selectedItems = data.selectedItems.size === 0 ? "Pelo menos um item deve ser selecionado" : "Muitos itens selecionados (máximo 100)";
  }

  // Validate quantities and prices
  if (stage2Valid) {
    const quantityErrors: Record<string, string> = {};
    const priceErrors: Record<string, string> = {};

    for (const itemId of data.selectedItems) {
      const quantity = data.quantities[itemId];
      if (!quantity || quantity <= 0) {
        quantityErrors[itemId] = "Quantidade inválida";
      }

      if (!data.willReturn) {
        const price = data.prices[itemId];
        if (!price || price < 0) {
          priceErrors[itemId] = "Preço deve ser informado";
        }
      }
    }

    if (Object.keys(quantityErrors).length > 0) {
      errors.quantities = quantityErrors;
    }
    if (Object.keys(priceErrors).length > 0) {
      errors.prices = priceErrors;
    }
  }

  const stage3Valid = stage1Valid && stage2Valid && Object.keys(errors.quantities || {}).length === 0 && Object.keys(errors.prices || {}).length === 0;

  return {
    stage1Valid,
    stage2Valid,
    stage3Valid,
    canProceedToStage2: stage1Valid,
    canProceedToStage3: stage1Valid && stage2Valid,
    canSubmit: stage3Valid,
    errors,
  };
}
