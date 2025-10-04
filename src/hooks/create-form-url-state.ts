import { useCallback, useEffect, useMemo, useRef } from "react";
import { useSearchParams } from "react-router-dom";
import { urlUtils, performanceUtils, errorHandling } from "@/utils/url-state-utils";
import type { UrlStateConfig, UrlStateOptions, UrlStateManager } from "@/utils/url-state-utils";

/**
 * Factory function for creating form-specific URL state management hooks
 *
 * This provides a reusable pattern for managing complex form state in URLs
 * with proper debouncing, validation, and type safety.
 */

interface FormUrlStateOptions extends UrlStateOptions {
  // Form-specific options
  autoSave?: boolean;
  autoSaveDelay?: number;
  clearOnSubmit?: boolean;
  restoreOnMount?: boolean;
  trackDirtyState?: boolean;

  // Performance options
  batchUpdates?: boolean;
  throttleUpdates?: boolean;
  throttleDelay?: number;

  // Validation options
  validateOnChange?: boolean;
  validateOnMount?: boolean;

  // Event callbacks
  onStateChange?: (state: any) => void;
  onValidationError?: (errors: string[]) => void;
  onRestore?: (state: any) => void;
  onClear?: () => void;
}

interface FormUrlStateHook<T> extends UrlStateManager<T> {
  // Form-specific methods
  isDirty: boolean;
  hasErrors: boolean;
  errors: string[];
  markClean: () => void;
  restore: () => void;

  // Batch operations
  batchUpdate: (updates: Array<{ key: keyof T; value: T[keyof T] }>) => void;

  // State snapshots
  createSnapshot: () => string;
  restoreFromSnapshot: (snapshot: string) => boolean;

  // URL management
  copyShareableUrl: () => Promise<void>;
  getCurrentUrl: () => string;
}

/**
 * Create a typed URL state hook for forms
 */
export function createFormUrlState<T extends Record<string, any>>(config: UrlStateConfig<T>, options: FormUrlStateOptions = {}) {
  // Validate configuration
  const configValidation = errorHandling.validateConfig(config);
  if (!configValidation.isValid) {
    console.warn("URL state configuration validation failed:", configValidation.errors);
  }

  return function useFormUrlState(): FormUrlStateHook<T> {
    const [searchParams, setSearchParams] = useSearchParams();

    // Extract options with defaults
    const {
      replaceHistory = true,
      enableDebouncing = true,
      enableValidation = true,
      cleanupDefaults = true,
      autoSave = false,
      autoSaveDelay = 1000,
      restoreOnMount = true,
      trackDirtyState = true,
      batchUpdates = true,
      throttleUpdates = false,
      throttleDelay = 100,
      validateOnChange = true,
      validateOnMount = true,
      onError,
      onStateChange,
      onValidationError,
      onRestore,
      onClear,
    } = options;

    // Internal state tracking
    const initialStateRef = useRef<Partial<T> | null>(null);
    const cleanStateRef = useRef<Partial<T>>({});
    const validationErrorsRef = useRef<string[]>([]);
    const subscribersRef = useRef<Array<(state: Partial<T>) => void>>([]);
    const pendingUpdatesRef = useRef<Partial<T>>({});

    // Error handler
    const handleError = useCallback(
      (error: Error, key: string, value: any) => {
        const handler = errorHandling.createErrorHandler(onError as any);
        if (handler) {
          handler(error, key, value);
        }
      },
      [onError],
    );

    // Parse current state from URL
    const currentState = useMemo((): Partial<T> => {
      const state: Partial<T> = {};
      const errors: string[] = [];

      for (const [key, fieldConfig] of Object.entries(config)) {
        const urlValue = searchParams.get(key);

        try {
          let value: T[keyof T];

          if (urlValue !== null) {
            // Parse from URL
            value = fieldConfig.parser ? fieldConfig.parser(urlValue) : (urlValue as T[keyof T]);
          } else {
            // Use default value
            value = fieldConfig.defaultValue as T[keyof T];
          }

          // Validate if validator provided
          if (enableValidation && fieldConfig.validator && value !== undefined) {
            if (!fieldConfig.validator(value)) {
              errors.push(`Invalid value for ${key}: ${value}`);
              value = fieldConfig.defaultValue as T[keyof T];
            }
          }

          if (value !== undefined) {
            state[key as keyof T] = value;
          }
        } catch (error) {
          errors.push(`Parse error for ${key}: ${error}`);
          handleError(error as Error, key, urlValue);

          // Use default value on error
          if (fieldConfig.defaultValue !== undefined) {
            state[key as keyof T] = fieldConfig.defaultValue;
          }
        }
      }

      // Update validation errors
      validationErrorsRef.current = errors;

      // Notify validation error callback
      if (errors.length > 0 && onValidationError) {
        onValidationError(errors);
      }

      return state;
    }, [searchParams, config, enableValidation, handleError, onValidationError]);

    // Initialize clean state on mount
    useEffect(() => {
      if (initialStateRef.current === null) {
        initialStateRef.current = { ...currentState };
        cleanStateRef.current = { ...currentState };

        if (restoreOnMount && onRestore) {
          onRestore(currentState);
        }
      }
    }, []); // Only run on mount

    // Create debounced/throttled update function
    const updateUrl = useMemo(() => {
      const baseUpdate = (newParams: URLSearchParams) => {
        const cleaned = cleanupDefaults ? urlUtils.cleanParams(newParams) : newParams;
        setSearchParams(cleaned, { replace: replaceHistory });
      };

      if (enableDebouncing && throttleUpdates) {
        return performanceUtils.throttle(baseUpdate, throttleDelay);
      } else if (enableDebouncing) {
        return urlUtils.createDebouncedSetter(baseUpdate);
      }

      return baseUpdate;
    }, [setSearchParams, replaceHistory, enableDebouncing, throttleUpdates, throttleDelay, cleanupDefaults]);

    // Get a single value
    const get = useCallback(
      <K extends keyof T>(key: K): T[K] => {
        return currentState[key] as T[K];
      },
      [currentState],
    );

    // Set a single value
    const set = useCallback(
      <K extends keyof T>(key: K, value: T[K], immediate = false): void => {
        const fieldConfig = config[key as string];
        if (!fieldConfig) {
          console.warn(`No configuration found for key: ${String(key)}`);
          return;
        }

        try {
          // Validate value if validator provided
          if (enableValidation && validateOnChange && fieldConfig.validator && !fieldConfig.validator(value)) {
            const error = new Error(`Validation failed for ${String(key)}: ${value}`);
            handleError(error, String(key), value);
            return;
          }

          const newParams = new URLSearchParams(searchParams);

          if (value === undefined || value === null || value === fieldConfig.defaultValue) {
            newParams.delete(String(key));
          } else {
            const serialized = fieldConfig.serializer ? fieldConfig.serializer(value) : String(value);
            newParams.set(String(key), serialized);
          }

          if (immediate || !enableDebouncing || fieldConfig.immediate) {
            const cleaned = cleanupDefaults ? urlUtils.cleanParams(newParams) : newParams;
            setSearchParams(cleaned, { replace: replaceHistory });
          } else {
            updateUrl(newParams);
          }

          // Track for auto-save
          if (autoSave && !immediate) {
            pendingUpdatesRef.current = { ...pendingUpdatesRef.current, [key]: value };
          }
        } catch (error) {
          handleError(error as Error, String(key), value);
        }
      },
      [searchParams, setSearchParams, config, enableValidation, validateOnChange, enableDebouncing, replaceHistory, cleanupDefaults, handleError, updateUrl, autoSave],
    );

    // Update multiple values
    const update = useCallback(
      (updates: Partial<T>, immediate = false): void => {
        if (batchUpdates && !immediate) {
          // Batch all updates into a single URL change
          const newParams = new URLSearchParams(searchParams);

          for (const [key, value] of Object.entries(updates)) {
            const fieldConfig = config[key];
            if (!fieldConfig) continue;

            try {
              if (enableValidation && validateOnChange && fieldConfig.validator && !fieldConfig.validator(value)) {
                handleError(new Error(`Validation failed for ${key}: ${value}`), key, value);
                continue;
              }

              if (value === undefined || value === null || value === fieldConfig.defaultValue) {
                newParams.delete(key);
              } else {
                const serialized = fieldConfig.serializer ? fieldConfig.serializer(value) : String(value);
                newParams.set(key, serialized);
              }
            } catch (error) {
              handleError(error as Error, key, value);
            }
          }

          if (immediate || !enableDebouncing) {
            const cleaned = cleanupDefaults ? urlUtils.cleanParams(newParams) : newParams;
            setSearchParams(cleaned, { replace: replaceHistory });
          } else {
            updateUrl(newParams);
          }

          // Track for auto-save
          if (autoSave) {
            pendingUpdatesRef.current = { ...pendingUpdatesRef.current, ...updates };
          }
        } else {
          // Update each value individually
          for (const [key, value] of Object.entries(updates)) {
            set(key as keyof T, value, immediate);
          }
        }

        // Notify state change callback
        if (onStateChange) {
          onStateChange({ ...currentState, ...updates });
        }
      },
      [
        searchParams,
        setSearchParams,
        config,
        enableValidation,
        validateOnChange,
        enableDebouncing,
        replaceHistory,
        cleanupDefaults,
        handleError,
        updateUrl,
        autoSave,
        batchUpdates,
        set,
        currentState,
        onStateChange,
      ],
    );

    // Reset specific keys or all
    const reset = useCallback(
      (keys?: (keyof T)[]): void => {
        const newParams = new URLSearchParams(searchParams);

        if (keys) {
          keys.forEach((key) => newParams.delete(String(key)));
        } else {
          // Clear all configured keys
          Object.keys(config).forEach((key) => newParams.delete(key));
        }

        const cleaned = cleanupDefaults ? urlUtils.cleanParams(newParams) : newParams;
        setSearchParams(cleaned, { replace: replaceHistory });

        // Reset clean state if resetting all
        if (!keys) {
          cleanStateRef.current = {};
          if (onClear) {
            onClear();
          }
        }
      },
      [searchParams, setSearchParams, config, replaceHistory, cleanupDefaults, onClear],
    );

    // Clear all parameters
    const clear = useCallback((): void => {
      setSearchParams(new URLSearchParams(), { replace: replaceHistory });
      cleanStateRef.current = {};
      if (onClear) {
        onClear();
      }
    }, [setSearchParams, replaceHistory, onClear]);

    // Get all current state
    const getAll = useCallback((): Partial<T> => {
      return { ...currentState };
    }, [currentState]);

    // Subscribe to state changes
    const subscribe = useCallback((callback: (state: Partial<T>) => void): (() => void) => {
      subscribersRef.current.push(callback);

      return () => {
        const index = subscribersRef.current.indexOf(callback);
        if (index > -1) {
          subscribersRef.current.splice(index, 1);
        }
      };
    }, []);

    // Get current search params
    const getSearchParams = useCallback((): URLSearchParams => {
      return new URLSearchParams(searchParams);
    }, [searchParams]);

    // Generate shareable URL
    const generateShareableUrl = useCallback(
      (baseUrl?: string): string => {
        const url = baseUrl || window.location.href.split("?")[0];
        return urlUtils.generateShareableUrl(url, searchParams);
      },
      [searchParams],
    );

    // Validate current state
    const validate = useCallback((): { isValid: boolean; errors: string[] } => {
      const errors: string[] = [];

      if (enableValidation) {
        for (const [key, fieldConfig] of Object.entries(config)) {
          const value = currentState[key as keyof T];

          if (fieldConfig.validator && value !== undefined && !fieldConfig.validator(value)) {
            errors.push(`Invalid value for ${key}: ${value}`);
          }
        }
      }

      return {
        isValid: errors.length === 0,
        errors,
      };
    }, [currentState, config, enableValidation]);

    // Calculate dirty state
    const isDirty = useMemo((): boolean => {
      if (!trackDirtyState) return false;

      const cleanState = cleanStateRef.current;
      return Object.keys({ ...currentState, ...cleanState }).some((key) => {
        return currentState[key as keyof T] !== cleanState[key as keyof T];
      });
    }, [currentState, trackDirtyState]);

    // Mark state as clean
    const markClean = useCallback((): void => {
      cleanStateRef.current = { ...currentState };
    }, [currentState]);

    // Restore to initial state
    const restore = useCallback((): void => {
      if (initialStateRef.current) {
        update(initialStateRef.current, true);
        if (onRestore) {
          onRestore(initialStateRef.current);
        }
      }
    }, [update, onRestore]);

    // Batch update function
    const batchUpdate = useCallback(
      (updates: Array<{ key: keyof T; value: T[keyof T] }>): void => {
        const updateObject: Partial<T> = {};
        updates.forEach(({ key, value }) => {
          updateObject[key] = value;
        });
        update(updateObject, false);
      },
      [update],
    );

    // Create state snapshot
    const createSnapshot = useCallback((): string => {
      return JSON.stringify(currentState);
    }, [currentState]);

    // Restore from snapshot
    const restoreFromSnapshot = useCallback(
      (snapshot: string): boolean => {
        try {
          const state = JSON.parse(snapshot);
          update(state, true);
          return true;
        } catch (error) {
          console.warn("Failed to restore from snapshot:", error);
          return false;
        }
      },
      [update],
    );

    // Copy shareable URL to clipboard
    const copyShareableUrl = useCallback(async (): Promise<void> => {
      try {
        const url = generateShareableUrl();
        await navigator.clipboard.writeText(url);
      } catch (error) {
        console.warn("Failed to copy URL to clipboard:", error);
        // Fallback for older browsers
        const textArea = document.createElement("textarea");
        textArea.value = generateShareableUrl();
        document.body.appendChild(textArea);
        textArea.select();
        document.execCommand("copy");
        document.body.removeChild(textArea);
      }
    }, [generateShareableUrl]);

    // Get current URL
    const getCurrentUrl = useCallback((): string => {
      return window.location.href;
    }, []);

    // Auto-save functionality
    useEffect(() => {
      if (!autoSave) return;

      const saveTimeout = setTimeout(() => {
        if (Object.keys(pendingUpdatesRef.current).length > 0) {
          // Trigger any pending URL updates immediately
          const newParams = new URLSearchParams(searchParams);
          for (const [key, value] of Object.entries(pendingUpdatesRef.current)) {
            const fieldConfig = config[key];
            if (!fieldConfig) continue;

            if (value === undefined || value === null) {
              newParams.delete(key);
            } else {
              const serialized = fieldConfig.serializer ? fieldConfig.serializer(value) : String(value);
              newParams.set(key, serialized);
            }
          }

          const cleaned = cleanupDefaults ? urlUtils.cleanParams(newParams) : newParams;
          setSearchParams(cleaned, { replace: replaceHistory });
          pendingUpdatesRef.current = {};
        }
      }, autoSaveDelay);

      return () => clearTimeout(saveTimeout);
    }, [currentState, autoSave, autoSaveDelay, searchParams, setSearchParams, config, cleanupDefaults, replaceHistory]);

    // Notify subscribers of state changes
    useEffect(() => {
      subscribersRef.current.forEach((callback) => callback(currentState));
    }, [currentState]);

    // Validation on mount
    useEffect(() => {
      if (validateOnMount) {
        const validation = validate();
        if (!validation.isValid && onValidationError) {
          onValidationError(validation.errors);
        }
      }
    }, []); // Only run on mount

    return {
      // UrlStateManager interface
      get,
      set,
      update,
      reset,
      clear,
      getAll,
      subscribe,
      getSearchParams,
      generateShareableUrl,
      validate,

      // FormUrlStateHook interface
      isDirty,
      hasErrors: validationErrorsRef.current.length > 0,
      errors: validationErrorsRef.current,
      markClean,
      restore,
      batchUpdate,
      createSnapshot,
      restoreFromSnapshot,
      copyShareableUrl,
      getCurrentUrl,
    };
  };
}

/**
 * Predefined configurations for common form patterns
 */
export const commonFormConfigs = {
  // Basic search form
  searchForm: <T extends { search: string; page: number; limit: number }>(): UrlStateConfig<T> => ({
    search: {
      defaultValue: "" as T["search"],
      parser: (value) => (value || "") as T["search"],
      serializer: (value) => String(value),
      debounceMs: 300,
    },
    page: {
      defaultValue: 1 as T["page"],
      parser: (value) => (value ? parseInt(value, 10) : 1) as T["page"],
      serializer: (value) => String(value),
      immediate: true,
    },
    limit: {
      defaultValue: 20 as T["limit"],
      parser: (value) => (value ? parseInt(value, 10) : 20) as T["limit"],
      serializer: (value) => String(value),
      immediate: true,
    },
  }),

  // Filter form with arrays and objects
  filterForm: <
    T extends {
      filters: Record<string, any>;
      selectedIds: string[];
      showInactive: boolean;
    },
  >(): UrlStateConfig<T> => ({
    filters: {
      defaultValue: {} as T["filters"],
      parser: (value) => (value ? JSON.parse(value) : {}) as T["filters"],
      serializer: (value) => JSON.stringify(value),
    },
    selectedIds: {
      defaultValue: [] as T["selectedIds"],
      parser: (value) => (value ? JSON.parse(value) : []) as T["selectedIds"],
      serializer: (value) => JSON.stringify(value),
    },
    showInactive: {
      defaultValue: false as T["showInactive"],
      parser: (value) => (value === "true") as T["showInactive"],
      serializer: (value) => String(value),
      immediate: true,
    },
  }),
};
