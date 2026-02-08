import { useCallback, useMemo } from "react";
import { z } from "zod";

/**
 * Type-safe URL parameter serializer/deserializer
 */
export interface UrlParamConfig<T> {
  /** Zod schema for validation */
  schema: z.ZodType<T>;
  /** Default value when parameter is missing */
  defaultValue: T;
  /** Custom serializer function */
  serialize?: (value: T) => string | null;
  /** Custom deserializer function */
  deserialize?: (value: string) => T;
  /** Whether to exclude from URL when value equals default */
  excludeDefault?: boolean;
}

/**
 * Built-in parameter configurations for common types
 */
export const urlParamConfigs = {
  // Basic types
  string: (defaultValue: string = ""): UrlParamConfig<string> => ({
    schema: z.string(),
    defaultValue,
    excludeDefault: true,
  }),

  number: (defaultValue: number = 0): UrlParamConfig<number> => ({
    schema: z.coerce.number(),
    defaultValue,
    serialize: (value) => (value === defaultValue ? null : String(value)),
    deserialize: (value) => {
      const num = Number(value);
      return isNaN(num) ? defaultValue : num;
    },
    excludeDefault: true,
  }),

  boolean: (defaultValue: boolean = false): UrlParamConfig<boolean> => ({
    schema: z.coerce.boolean(),
    defaultValue,
    serialize: (value) => (value === defaultValue ? null : String(value)),
    deserialize: (value) => value === "true",
    excludeDefault: true,
  }),

  // Arrays
  stringArray: (defaultValue: string[] = []): UrlParamConfig<string[]> => ({
    schema: z.array(z.string()),
    defaultValue,
    serialize: (value) => (value.length === 0 ? null : JSON.stringify(value)),
    deserialize: (value) => {
      try {
        const parsed = JSON.parse(value);
        return Array.isArray(parsed) ? parsed.filter((item) => typeof item === "string") : defaultValue;
      } catch {
        return defaultValue;
      }
    },
    excludeDefault: true,
  }),

  numberArray: (defaultValue: number[] = []): UrlParamConfig<number[]> => ({
    schema: z.array(z.coerce.number()),
    defaultValue,
    serialize: (value) => (value.length === 0 ? null : JSON.stringify(value)),
    deserialize: (value) => {
      try {
        const parsed = JSON.parse(value);
        return Array.isArray(parsed) ? parsed.map(Number).filter((n) => !isNaN(n)) : defaultValue;
      } catch {
        return defaultValue;
      }
    },
    excludeDefault: true,
  }),

  // Date types
  date: (defaultValue?: Date): UrlParamConfig<Date | null> => ({
    schema: z.coerce.date().nullable(),
    defaultValue: defaultValue || null,
    serialize: (value) => (value ? value.toISOString() : null),
    deserialize: (value) => {
      try {
        return new Date(value);
      } catch {
        return defaultValue || null;
      }
    },
    excludeDefault: true,
  }),

  dateRange: (defaultValue: { gte?: Date; lte?: Date } = {}): UrlParamConfig<{ gte?: Date; lte?: Date }> => ({
    schema: z.object({
      gte: z.coerce.date().optional(),
      lte: z.coerce.date().optional(),
    }),
    defaultValue,
    serialize: (value) => {
      if (!value.gte && !value.lte) return null;
      return JSON.stringify({
        ...(value.gte && { gte: value.gte.toISOString() }),
        ...(value.lte && { lte: value.lte.toISOString() }),
      });
    },
    deserialize: (value) => {
      try {
        const parsed = JSON.parse(value);
        return {
          ...(parsed.gte && { gte: new Date(parsed.gte) }),
          ...(parsed.lte && { lte: new Date(parsed.lte) }),
        };
      } catch {
        return defaultValue;
      }
    },
    excludeDefault: true,
  }),

  // Number ranges
  numberRange: (defaultValue: { min?: number; max?: number } = {}): UrlParamConfig<{ min?: number; max?: number }> => ({
    schema: z.object({
      min: z.coerce.number().optional(),
      max: z.coerce.number().optional(),
    }),
    defaultValue,
    serialize: (value) => {
      if (value.min === undefined && value.max === undefined) return null;
      return JSON.stringify(value);
    },
    deserialize: (value) => {
      try {
        const parsed = JSON.parse(value);
        return {
          ...(parsed.min !== undefined && { min: Number(parsed.min) }),
          ...(parsed.max !== undefined && { max: Number(parsed.max) }),
        };
      } catch {
        return defaultValue;
      }
    },
    excludeDefault: true,
  }),

  // Enum support
  enum: <T extends string>(enumValues: readonly T[], defaultValue: T): UrlParamConfig<T> => ({
    schema: z.enum(enumValues as [T, ...T[]]),
    defaultValue,
    serialize: (value) => (value === defaultValue ? null : value),
    deserialize: (value) => {
      return enumValues.includes(value as T) ? (value as T) : defaultValue;
    },
    excludeDefault: true,
  }),

  // Generic object with JSON serialization
  object: <T>(schema: z.ZodType<T>, defaultValue: T): UrlParamConfig<T> => ({
    schema,
    defaultValue,
    serialize: (value) => {
      if (JSON.stringify(value) === JSON.stringify(defaultValue)) return null;
      return JSON.stringify(value);
    },
    deserialize: (value) => {
      try {
        const parsed = JSON.parse(value);
        const result = schema.safeParse(parsed);
        return result.success ? result.data : defaultValue;
      } catch {
        return defaultValue;
      }
    },
    excludeDefault: true,
  }),
};

/**
 * Hook for type-safe URL parameter management
 */
export function useUrlParams<T extends Record<string, any>>(configs: { [K in keyof T]: UrlParamConfig<T[K]> }, searchParams: URLSearchParams, namespace?: string) {
  // Create parameter name getter
  const getParamName = useCallback((key: string) => (namespace ? `${namespace}_${key}` : key), [namespace]);

  // Parse values from URL
  const values = useMemo(() => {
    const result = {} as T;

    for (const [key, config] of Object.entries(configs) as [keyof T, UrlParamConfig<T[keyof T]>][]) {
      const paramName = getParamName(key as string);
      const urlValue = searchParams.get(paramName);

      if (urlValue === null) {
        result[key] = config.defaultValue;
      } else {
        try {
          if (config.deserialize) {
            result[key] = config.deserialize(urlValue);
          } else {
            // Use schema to parse
            const parsed = config.schema.safeParse(urlValue);
            result[key] = parsed.success ? parsed.data : config.defaultValue;
          }
        } catch {
          result[key] = config.defaultValue;
        }
      }
    }

    return result;
  }, [configs, searchParams, getParamName]);

  // Serialize values to URL parameters
  const serialize = useCallback(
    (newValues: Partial<T>): Record<string, string> => {
      const urlParams: Record<string, string> = {};

      for (const [key, value] of Object.entries(newValues) as [keyof T, T[keyof T]][]) {
        const config = configs[key];
        if (!config) continue;

        const paramName = getParamName(key as string);

        // Skip if value equals default and excludeDefault is true
        if (config.excludeDefault && JSON.stringify(value) === JSON.stringify(config.defaultValue)) {
          continue;
        }

        let serialized: string | null;
        if (config.serialize) {
          serialized = config.serialize(value);
        } else {
          // Default serialization
          if (value === null || value === undefined) {
            serialized = null;
          } else if (typeof value === "object") {
            serialized = JSON.stringify(value);
          } else {
            serialized = String(value);
          }
        }

        if (serialized !== null) {
          urlParams[paramName] = serialized;
        }
      }

      return urlParams;
    },
    [configs, getParamName],
  );

  // Validation function
  const validate = useCallback(
    (valuesToValidate: Partial<T>): { success: boolean; errors?: Record<keyof T, string[]> } => {
      const errors: Record<keyof T, string[]> = {} as Record<keyof T, string[]>;
      let hasErrors = false;

      for (const [key, value] of Object.entries(valuesToValidate) as [keyof T, T[keyof T]][]) {
        const config = configs[key];
        if (!config) continue;

        const result = config.schema.safeParse(value);
        if (!result.success) {
          errors[key] = result.error.errors.map((e) => e.message);
          hasErrors = true;
        }
      }

      return hasErrors ? { success: false, errors } : { success: true };
    },
    [configs],
  );

  // Get default values
  const getDefaults = useCallback((): T => {
    const defaults = {} as T;
    for (const [key, config] of Object.entries(configs) as [keyof T, UrlParamConfig<T[keyof T]>][]) {
      defaults[key] = config.defaultValue;
    }
    return defaults;
  }, [configs]);

  return {
    values,
    serialize,
    validate,
    getDefaults,
    getParamName,
  };
}

/**
 * Helper to create strongly typed URL parameter configurations
 */
export function createUrlParamConfig<T extends Record<string, any>>(configs: { [K in keyof T]: UrlParamConfig<T[K]> }): { [K in keyof T]: UrlParamConfig<T[K]> } {
  return configs;
}
