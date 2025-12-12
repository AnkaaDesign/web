import { z } from "zod";
import { debounce } from "lodash";

/**
 * URL State Management Utilities
 *
 * Provides comprehensive utilities for managing complex form state in URL parameters
 * with proper validation, type safety, and edge case handling.
 */

// ====================================
// Type Definitions
// ====================================

export interface UrlStateConfig<T> {
  [key: string]: {
    defaultValue?: T[keyof T];
    parser?: (value: string | null) => T[keyof T];
    serializer?: (value: T[keyof T]) => string;
    validator?: (value: any) => value is T[keyof T];
    debounceMs?: number;
    immediate?: boolean;
  };
}

export interface UrlStateOptions {
  replaceHistory?: boolean;
  enableDebouncing?: boolean;
  enableValidation?: boolean;
  cleanupDefaults?: boolean;
  onError?: (error: Error, key: string, value: any) => void;
}

export interface UrlStateManager<T> {
  get: <K extends keyof T>(key: K) => T[K];
  set: <K extends keyof T>(key: K, value: T[K], immediate?: boolean) => void;
  update: (updates: Partial<T>, immediate?: boolean) => void;
  reset: (keys?: (keyof T)[]) => void;
  clear: () => void;
  getAll: () => Partial<T>;
  subscribe: (callback: (state: Partial<T>) => void) => () => void;
  getSearchParams: () => URLSearchParams;
  generateShareableUrl: (baseUrl?: string) => string;
  validate: () => { isValid: boolean; errors: string[] };
}

// ====================================
// Safe Parsers and Serializers
// ====================================

export const createSafeParser = <T>(parser: (value: string) => T, defaultValue: T, onError?: (error: Error, value: string) => void) => {
  return (value: string | null): T => {
    if (value === null || value === undefined || value === "") {
      return defaultValue;
    }

    try {
      return parser(value);
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      onError?.(err, value);
      console.warn(`Failed to parse URL parameter:`, value, err.message);
      return defaultValue;
    }
  };
};

export const createSafeSerializer = <T>(serializer: (value: T) => string, onError?: (error: Error, value: T) => void) => {
  return (value: T): string => {
    try {
      return serializer(value);
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      onError?.(err, value);
      console.warn(`Failed to serialize URL parameter:`, value, err.message);
      return String(value);
    }
  };
};

// ====================================
// Common Type Parsers
// ====================================

export const urlParsers = {
  // String parsers
  string: createSafeParser((value: string) => value, ""),

  // Number parsers
  number: createSafeParser((value: string) => {
    const num = parseFloat(value);
    if (isNaN(num)) throw new Error(`Invalid number: ${value}`);
    return num;
  }, 0),

  // Boolean parsers
  boolean: createSafeParser((value: string) => {
    const lower = value.toLowerCase();
    if (lower === "true" || lower === "1") return true;
    if (lower === "false" || lower === "0") return false;
    throw new Error(`Invalid boolean: ${value}`);
  }, false),

  // Date parsers
  date: createSafeParser((value: string) => {
    const date = new Date(value);
    if (isNaN(date.getTime())) throw new Error(`Invalid date: ${value}`);
    return date;
  }, new Date()),

  // Array parsers
  stringArray: createSafeParser((value: string) => {
    if (!value) return [];
    // Support both JSON and comma-separated formats
    if (value.startsWith("[")) {
      return JSON.parse(value) as string[];
    }
    return value.split(",").filter(Boolean);
  }, [] as string[]),

  numberArray: createSafeParser((value: string) => {
    if (!value) return [];
    const parsed = value.startsWith("[") ? JSON.parse(value) : value.split(",");
    return parsed.map((v: any) => {
      const num = parseFloat(v);
      if (isNaN(num)) throw new Error(`Invalid number in array: ${v}`);
      return num;
    });
  }, [] as number[]),

  // Object parsers
  stringRecord: createSafeParser(
    (value: string) => {
      if (!value || value === "{}") return {};
      const parsed = JSON.parse(value);
      if (typeof parsed !== "object" || Array.isArray(parsed)) {
        throw new Error("Invalid object format");
      }
      return parsed as Record<string, string>;
    },
    {} as Record<string, string>,
  ),

  numberRecord: createSafeParser(
    (value: string) => {
      if (!value || value === "{}") return {};
      const parsed = JSON.parse(value);
      if (typeof parsed !== "object" || Array.isArray(parsed)) {
        throw new Error("Invalid object format");
      }
      // Validate all values are numbers
      const validated: Record<string, number> = {};
      for (const [key, val] of Object.entries(parsed)) {
        const num = parseFloat(val as string);
        if (isNaN(num)) throw new Error(`Invalid number value for key ${key}: ${val}`);
        validated[key] = num;
      }
      return validated;
    },
    {} as Record<string, number>,
  ),

  // Set parsers
  stringSet: createSafeParser((value: string) => {
    if (!value) return new Set<string>();
    const array = value.startsWith("[") ? JSON.parse(value) : value.split(",").filter(Boolean);
    return new Set(array);
  }, new Set<string>()),

  // Enum parsers
  enum: <T extends string>(validValues: readonly T[], defaultValue: T) =>
    createSafeParser((value: string) => {
      if (!validValues.includes(value as T)) {
        throw new Error(`Invalid enum value: ${value}. Valid values: ${validValues.join(", ")}`);
      }
      return value as T;
    }, defaultValue),
};

// ====================================
// Serializers
// ====================================

export const urlSerializers = {
  // Basic serializers
  string: (value: string) => value,
  number: (value: number) => value.toString(),
  boolean: (value: boolean) => value.toString(),
  date: (value: Date) => value.toISOString(),

  // Array serializers
  stringArray: createSafeSerializer((value: string[]) => (value.length === 0 ? "" : JSON.stringify(value))),
  numberArray: createSafeSerializer((value: number[]) => (value.length === 0 ? "" : JSON.stringify(value))),

  // Object serializers
  stringRecord: createSafeSerializer((value: Record<string, string>) => {
    const keys = Object.keys(value);
    return keys.length === 0 ? "" : JSON.stringify(value);
  }),
  numberRecord: createSafeSerializer((value: Record<string, number>) => {
    const keys = Object.keys(value);
    return keys.length === 0 ? "" : JSON.stringify(value);
  }),

  // Set serializers
  stringSet: createSafeSerializer((value: Set<string>) => (value.size === 0 ? "" : JSON.stringify(Array.from(value)))),
};

// ====================================
// Validation Utilities
// ====================================

export const createZodValidator = <T>(schema: z.ZodSchema<T>) => {
  return (value: any): value is T => {
    const result = schema.safeParse(value);
    return result.success;
  };
};

export const validators = {
  // Basic validators
  isString: (value: any): value is string => typeof value === "string",
  isNumber: (value: any): value is number => typeof value === "number" && !isNaN(value),
  isBoolean: (value: any): value is boolean => typeof value === "boolean",
  isDate: (value: any): value is Date => value instanceof Date && !isNaN(value.getTime()),

  // Array validators
  isStringArray: (value: any): value is string[] => Array.isArray(value) && value.every((item) => typeof item === "string"),
  isNumberArray: (value: any): value is number[] => Array.isArray(value) && value.every((item) => typeof item === "number" && !isNaN(item)),

  // Object validators
  isStringRecord: (value: any): value is Record<string, string> =>
    value !== null && typeof value === "object" && !Array.isArray(value) && Object.values(value).every((v) => typeof v === "string"),

  isNumberRecord: (value: any): value is Record<string, number> =>
    value !== null && typeof value === "object" && !Array.isArray(value) && Object.values(value).every((v) => typeof v === "number" && !isNaN(v)),

  // Set validators
  isStringSet: (value: any): value is Set<string> => value instanceof Set && Array.from(value).every((item) => typeof item === "string"),
};

// ====================================
// URL Utilities
// ====================================

export const urlUtils = {
  /**
   * Clean URL parameters by removing empty/default values
   */
  cleanParams: (params: URLSearchParams, defaultsToRemove: string[] = []): URLSearchParams => {
    const cleaned = new URLSearchParams();

    for (const [key, value] of params) {
      // Skip empty values
      if (!value) continue;

      // Skip default values that should be removed
      if (defaultsToRemove.includes(value)) continue;

      // Skip common empty/default patterns (but keep "false" for boolean fields)
      if (["[]", "{}", "0", "null", "undefined"].includes(value)) {
        continue;
      }

      cleaned.set(key, value);
    }

    return cleaned;
  },

  /**
   * Compare two URLSearchParams for equality
   */
  areParamsEqual: (params1: URLSearchParams, params2: URLSearchParams): boolean => {
    const keys1 = Array.from(params1.keys()).sort();
    const keys2 = Array.from(params2.keys()).sort();

    if (keys1.length !== keys2.length) return false;
    if (keys1.join(",") !== keys2.join(",")) return false;

    return keys1.every((key) => params1.get(key) === params2.get(key));
  },

  /**
   * Merge multiple URLSearchParams
   */
  mergeParams: (...paramsList: URLSearchParams[]): URLSearchParams => {
    const merged = new URLSearchParams();

    for (const params of paramsList) {
      for (const [key, value] of params) {
        merged.set(key, value);
      }
    }

    return merged;
  },

  /**
   * Create a debounced parameter setter
   */
  createDebouncedSetter: (setter: (params: URLSearchParams) => void, delay: number = 300) => {
    return debounce((params: URLSearchParams) => {
      setter(params);
    }, delay);
  },

  /**
   * Generate a shareable URL from current parameters
   */
  generateShareableUrl: (baseUrl: string, params: URLSearchParams, options: { includeProtocol?: boolean; cleanParams?: boolean } = {}): string => {
    const { includeProtocol = true, cleanParams = true } = options;

    const cleanedParams = cleanParams ? urlUtils.cleanParams(params) : params;
    const queryString = cleanedParams.toString();

    // Handle different base URL formats
    let url = baseUrl;
    if (!includeProtocol) {
      url = url.replace(/^https?:\/\//, "");
    }

    if (queryString) {
      const separator = url.includes("?") ? "&" : "?";
      return `${url}${separator}${queryString}`;
    }

    return url;
  },

  /**
   * Parse a full URL and extract search parameters
   */
  parseUrl: (url: string): { pathname: string; searchParams: URLSearchParams } => {
    try {
      const parsed = new URL(url, window.location.origin);
      return {
        pathname: parsed.pathname,
        searchParams: parsed.searchParams,
      };
    } catch (error) {
      console.warn("Failed to parse URL:", url, error);
      return {
        pathname: "",
        searchParams: new URLSearchParams(),
      };
    }
  },
};

// ====================================
// Performance Utilities
// ====================================

export const performanceUtils = {
  /**
   * Throttle function calls to prevent excessive updates
   */
  throttle: <T extends (...args: any[]) => any>(func: T, delay: number): ((...args: Parameters<T>) => void) => {
    let timeoutId: NodeJS.Timeout | null = null;
    let lastExecTime = 0;

    return (...args: Parameters<T>) => {
      const currentTime = Date.now();

      if (currentTime - lastExecTime > delay) {
        func(...args);
        lastExecTime = currentTime;
      } else {
        if (timeoutId) clearTimeout(timeoutId);
        timeoutId = setTimeout(
          () => {
            func(...args);
            lastExecTime = Date.now();
          },
          delay - (currentTime - lastExecTime),
        );
      }
    };
  },

  /**
   * Batch multiple URL parameter updates
   */
  batchUpdates: <T>(updates: Array<() => T>, delay: number = 0): Promise<T[]> => {
    return new Promise((resolve) => {
      if (delay === 0) {
        resolve(updates.map((update) => update()));
      } else {
        setTimeout(() => {
          resolve(updates.map((update) => update()));
        }, delay);
      }
    });
  },
};

// ====================================
// Error Handling
// ====================================

export class UrlStateError extends Error {
  constructor(
    message: string,
    public key: string,
    public value: any,
    public originalError?: Error,
  ) {
    super(message);
    this.name = "UrlStateError";
  }
}

export const errorHandling = {
  /**
   * Create error handler for URL state operations
   */
  createErrorHandler: (onError?: (error: UrlStateError) => void) => {
    return (error: Error, key: string, value: any) => {
      const urlError = new UrlStateError(`URL state error for key "${key}": ${error.message}`, key, value, error);

      if (onError) {
        onError(urlError);
      } else {
        console.error(urlError);
      }
    };
  },

  /**
   * Validate URL state configuration
   */
  validateConfig: <T>(config: UrlStateConfig<T>): { isValid: boolean; errors: string[] } => {
    const errors: string[] = [];

    for (const [key, fieldConfig] of Object.entries(config)) {
      if (!fieldConfig) {
        errors.push(`Missing configuration for key: ${key}`);
        continue;
      }

      // Validate parser and serializer compatibility
      if (fieldConfig.parser && fieldConfig.serializer) {
        try {
          const testValue = fieldConfig.defaultValue;
          if (testValue !== undefined && testValue !== null) {
            const serialized = fieldConfig.serializer(testValue);
            const parsed = fieldConfig.parser(serialized);

            if (fieldConfig.validator && !fieldConfig.validator(parsed)) {
              errors.push(`Parser/serializer mismatch for key: ${key}`);
            }
          }
        } catch (error) {
          errors.push(`Parser/serializer error for key: ${key}: ${error}`);
        }
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  },
};
