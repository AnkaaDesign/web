import { useCallback, useMemo } from "react";
import { useSearchParams, useNavigate, useLocation } from "react-router-dom";

/**
 * Generic hook for managing URL state with serialization/deserialization
 */
export function useUrlState<T = Record<string, any>>() {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const location = useLocation();

  // Get a value from URL params with optional transformation
  const getParam = useCallback(
    <K extends keyof T>(key: string, defaultValue?: T[K], transformer?: (value: string) => T[K]): T[K] | undefined => {
      const value = searchParams.get(key);
      if (value === null) return defaultValue;

      if (transformer) {
        try {
          return transformer(value);
        } catch (error) {
          console.warn(`Failed to parse URL param "${key}":`, error);
          return defaultValue;
        }
      }

      return value as T[K];
    },
    [searchParams],
  );

  // Set a single URL parameter with optional serialization
  const setParam = useCallback(
    <K extends keyof T>(key: string, value: T[K] | undefined, serializer?: (value: T[K]) => string, options?: { replace?: boolean; preserveOthers?: boolean }) => {
      const newParams = options?.preserveOthers !== false ? new URLSearchParams(searchParams) : new URLSearchParams();

      if (value === undefined || value === null) {
        newParams.delete(key);
      } else {
        const stringValue = serializer ? serializer(value) : String(value);
        newParams.set(key, stringValue);
      }

      const newUrl = `${location.pathname}${newParams.toString() ? `?${newParams.toString()}` : ""}`;

      if (options?.replace) {
        navigate(newUrl, { replace: true });
      } else {
        setSearchParams(newParams);
      }
    },
    [searchParams, setSearchParams, navigate, location.pathname],
  );

  // Set multiple URL parameters at once
  const setParams = useCallback(
    (params: Partial<Record<string, any>>, options?: { replace?: boolean; preserveOthers?: boolean }) => {
      const newParams = options?.preserveOthers !== false ? new URLSearchParams(searchParams) : new URLSearchParams();

      Object.entries(params).forEach(([key, value]) => {
        if (value === undefined || value === null) {
          newParams.delete(key);
        } else {
          newParams.set(key, String(value));
        }
      });

      const newUrl = `${location.pathname}${newParams.toString() ? `?${newParams.toString()}` : ""}`;

      if (options?.replace) {
        navigate(newUrl, { replace: true });
      } else {
        setSearchParams(newParams);
      }
    },
    [searchParams, setSearchParams, navigate, location.pathname],
  );

  // Clear all or specific URL parameters
  const clearParams = useCallback(
    (keysToKeep?: string[]) => {
      if (keysToKeep) {
        const newParams = new URLSearchParams();
        keysToKeep.forEach((key) => {
          const value = searchParams.get(key);
          if (value !== null) {
            newParams.set(key, value);
          }
        });
        setSearchParams(newParams);
      } else {
        setSearchParams(new URLSearchParams());
      }
    },
    [searchParams, setSearchParams],
  );

  // Get all current parameters as an object
  const getAllParams = useCallback((): Record<string, string> => {
    const params: Record<string, string> = {};
    searchParams.forEach((value, key) => {
      params[key] = value;
    });
    return params;
  }, [searchParams]);

  // Check if URL has any parameters
  const hasParams = useMemo(() => {
    return searchParams.toString().length > 0;
  }, [searchParams]);

  return {
    getParam,
    setParam,
    setParams,
    clearParams,
    getAllParams,
    hasParams,
    searchParams,
  };
}

/**
 * Utility functions for common URL state transformations
 */
export const urlStateTransformers = {
  // Array transformations
  stringArray: {
    serialize: (value: string[]): string => value.join(","),
    deserialize: (value: string): string[] => (value ? value.split(",").filter(Boolean) : []),
  },

  // JSON transformations
  json: {
    serialize: <T>(value: T): string => JSON.stringify(value),
    deserialize: <T>(value: string): T => JSON.parse(value),
  },

  // Number transformations
  number: {
    serialize: (value: number): string => value.toString(),
    deserialize: (value: string): number => {
      const num = parseFloat(value);
      if (isNaN(num)) throw new Error(`Invalid number: ${value}`);
      return num;
    },
  },

  // Boolean transformations
  boolean: {
    serialize: (value: boolean): string => value.toString(),
    deserialize: (value: string): boolean => value === "true",
  },

  // Set transformations
  set: {
    serialize: (value: Set<string>): string => Array.from(value).join(","),
    deserialize: (value: string): Set<string> => new Set(value ? value.split(",").filter(Boolean) : []),
  },

  // Object transformations with validation
  object: <T>(validate?: (obj: any) => obj is T) => ({
    serialize: (value: T): string => JSON.stringify(value),
    deserialize: (value: string): T => {
      const parsed = JSON.parse(value);
      if (validate && !validate(parsed)) {
        throw new Error("Invalid object structure");
      }
      return parsed;
    },
  }),
};

/**
 * Hook for managing URL state with type safety and validation
 */
export function useTypedUrlState<T extends Record<string, any>>(config: {
  [K in keyof T]: {
    defaultValue?: T[K];
    serialize?: (value: T[K]) => string;
    deserialize?: (value: string) => T[K];
    validate?: (value: any) => value is T[K];
  };
}) {
  const { getParam, setParam, setParams, clearParams, hasParams } = useUrlState<T>();

  const getTypedParam = useCallback(
    <K extends keyof T>(key: K): T[K] | undefined => {
      const fieldConfig = config[key];
      return getParam(key as string, fieldConfig?.defaultValue, fieldConfig?.deserialize);
    },
    [getParam, config],
  );

  const setTypedParam = useCallback(
    <K extends keyof T>(key: K, value: T[K] | undefined, options?: { replace?: boolean; preserveOthers?: boolean }) => {
      const fieldConfig = config[key];

      // Validate if validator is provided
      if (value !== undefined && fieldConfig?.validate && !fieldConfig.validate(value)) {
        console.warn(`Invalid value for URL param "${String(key)}":`, value);
        return;
      }

      setParam(key as string, value, fieldConfig?.serialize, options);
    },
    [setParam, config],
  );

  const setTypedParams = useCallback(
    (params: Partial<T>, options?: { replace?: boolean; preserveOthers?: boolean }) => {
      const serializedParams: Record<string, any> = {};

      Object.entries(params).forEach(([key, value]) => {
        const fieldConfig = config[key as keyof T];

        if (value !== undefined && fieldConfig?.validate && !fieldConfig.validate(value)) {
          console.warn(`Invalid value for URL param "${key}":`, value);
          return;
        }

        serializedParams[key] = fieldConfig?.serialize ? fieldConfig.serialize(value as T[keyof T]) : value;
      });

      setParams(serializedParams, options);
    },
    [setParams, config],
  );

  const getAllTypedParams = useCallback((): Partial<T> => {
    const result: Partial<T> = {};

    Object.keys(config).forEach((key) => {
      const typedKey = key as keyof T;
      const value = getTypedParam(typedKey);
      if (value !== undefined) {
        result[typedKey] = value;
      }
    });

    return result;
  }, [config, getTypedParam]);

  return {
    getParam: getTypedParam,
    setParam: setTypedParam,
    setParams: setTypedParams,
    clearParams,
    getAllParams: getAllTypedParams,
    hasParams,
  };
}

/**
 * Hook for URL state with automatic debouncing
 */
export function useDebouncedUrlState<T>(
  key: string,
  defaultValue: T,
  delay: number = 300,
  options?: {
    serialize?: (value: T) => string;
    deserialize?: (value: string) => T;
  },
) {
  const { getParam, setParam } = useUrlState<{ [K in typeof key]: T }>();

  const value = useMemo(() => {
    return getParam(key, defaultValue, options?.deserialize);
  }, [getParam, key, defaultValue, options?.deserialize]);

  const setValue = useCallback(
    debounce((newValue: T) => {
      setParam(key, newValue, options?.serialize, { preserveOthers: true });
    }, delay),
    [setParam, key, options?.serialize, delay],
  );

  return [value, setValue] as const;
}

// Simple debounce utility
function debounce<T extends (...args: any[]) => any>(func: T, delay: number): (...args: Parameters<T>) => void {
  let timeoutId: NodeJS.Timeout;

  return (...args: Parameters<T>) => {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => func(...args), delay);
  };
}
