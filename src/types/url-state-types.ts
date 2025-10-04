import { z } from "zod";

/**
 * TypeScript utilities for type-safe URL state management
 *
 * Provides advanced type definitions, schemas, and utilities for ensuring
 * type safety when working with URL parameters in forms.
 */

// ====================================
// Core Type Definitions
// ====================================

/**
 * Base interface for URL state objects
 */
export interface UrlStateBase {
  [key: string]: any;
}

/**
 * URL parameter value types that can be safely serialized
 */
export type UrlParamValue = string | number | boolean | Date | string[] | number[] | Record<string, string> | Record<string, number> | Set<string> | null | undefined;

/**
 * Configuration for a single URL parameter field
 */
export interface UrlFieldConfig<T = any> {
  defaultValue?: T;
  parser?: (value: string | null) => T;
  serializer?: (value: T) => string;
  validator?: (value: any) => value is T;
  transformer?: (value: T) => T;
  debounceMs?: number;
  immediate?: boolean;
  required?: boolean;
  description?: string;
}

/**
 * Complete configuration for URL state management
 */
export type UrlStateConfiguration<T extends UrlStateBase> = {
  readonly [K in keyof T]: UrlFieldConfig<T[K]>;
};

/**
 * Options for URL state hooks
 */
export interface UrlStateHookOptions {
  replaceHistory?: boolean;
  enableDebouncing?: boolean;
  enableValidation?: boolean;
  cleanupDefaults?: boolean;
  autoSave?: boolean;
  trackDirtyState?: boolean;
  onError?: (error: UrlStateError) => void;
  onStateChange?: (state: any) => void;
}

/**
 * URL state error with context
 */
export class UrlStateError extends Error {
  constructor(
    message: string,
    public readonly key: string,
    public readonly value: any,
    public readonly operation: "parse" | "serialize" | "validate",
    public readonly originalError?: Error,
  ) {
    super(message);
    this.name = "UrlStateError";
  }
}

// ====================================
// Advanced Type Utilities
// ====================================

/**
 * Extract required fields from URL state type
 */
export type RequiredUrlFields<T extends UrlStateBase> = {
  [K in keyof T]: undefined extends T[K] ? never : K;
}[keyof T];

/**
 * Extract optional fields from URL state type
 */
export type OptionalUrlFields<T extends UrlStateBase> = {
  [K in keyof T]: undefined extends T[K] ? K : never;
}[keyof T];

/**
 * Make specified fields required in URL state
 */
export type RequireUrlFields<T extends UrlStateBase, K extends keyof T> = T & Required<Pick<T, K>>;

/**
 * Make specified fields optional in URL state
 */
export type PartialUrlFields<T extends UrlStateBase, K extends keyof T> = Omit<T, K> & Partial<Pick<T, K>>;

/**
 * URL state with all fields optional (for partial updates)
 */
export type PartialUrlState<T extends UrlStateBase> = {
  [K in keyof T]?: T[K];
};

/**
 * URL state with serialized values (string representation)
 */
export type SerializedUrlState<T extends UrlStateBase> = {
  [K in keyof T]: string;
};

/**
 * Extract the value type from a URL field configuration
 */
export type ExtractUrlFieldType<T> = T extends UrlFieldConfig<infer U> ? U : never;

/**
 * Extract URL state type from configuration
 */
export type ExtractUrlStateType<T extends Record<string, UrlFieldConfig>> = {
  [K in keyof T]: ExtractUrlFieldType<T[K]>;
};

// ====================================
// Form-Specific Type Definitions
// ====================================

/**
 * Common form state patterns
 */
export interface SearchFormState {
  search: string;
  page: number;
  limit: number;
  sortBy?: string;
  sortOrder?: "asc" | "desc";
}

export interface FilterFormState {
  selectedIds: string[];
  showInactive: boolean;
  categoryIds: string[];
  brandIds: string[];
  dateRange?: {
    from: Date;
    to: Date;
  };
}

export interface BorrowFormState extends SearchFormState, FilterFormState {
  globalUserId?: string;
  useGlobalUser: boolean;
  quantities: Record<string, number>;
  userAssignments: Record<string, string>;
  showSelectedOnly: boolean;
}

export interface ActivityFormState extends SearchFormState, FilterFormState {
  operation: string;
  globalUserId?: string;
  globalQuantity: number;
  quantityAssignments: Record<string, number>;
  showSelectedOnly: boolean;
}

// ====================================
// Zod Schema Utilities
// ====================================

/**
 * Create Zod schema for URL state validation
 */
export const createUrlStateSchema = <T extends UrlStateBase>(fieldSchemas: { [K in keyof T]: z.ZodType<T[K]> }) => {
  return z.object(fieldSchemas).partial();
};

/**
 * Common Zod schemas for URL parameters
 */
export const urlSchemas = {
  // Basic types
  string: (defaultValue = "") => z.string().default(defaultValue),
  number: (defaultValue = 0) => z.coerce.number().default(defaultValue),
  boolean: (defaultValue = false) => z.coerce.boolean().default(defaultValue),
  date: (defaultValue?: Date) => z.coerce.date().default(defaultValue || new Date()),

  // Array types
  stringArray: (defaultValue: string[] = []) => z.array(z.string()).default(defaultValue),
  numberArray: (defaultValue: number[] = []) => z.array(z.coerce.number()).default(defaultValue),

  // Object types
  stringRecord: (defaultValue: Record<string, string> = {}) => z.record(z.string(), z.string()).default(defaultValue),
  numberRecord: (defaultValue: Record<string, number> = {}) => z.record(z.string(), z.coerce.number()).default(defaultValue),

  // Set types
  stringSet: (defaultValue: Set<string> = new Set()) => z.set(z.string()).default(defaultValue),

  // Enum types
  stringEnum: <T extends readonly [string, ...string[]]>(values: T, defaultValue: T[number]) => {
    const schema = z.enum(values);
    return schema.default(defaultValue as any);
  },

  // Optional types
  optionalString: () => z.string().optional(),
  optionalNumber: () => z.coerce.number().optional(),
  optionalDate: () => z.coerce.date().optional(),

  // Custom types
  pagination: (defaultPage = 1, defaultLimit = 20) =>
    z.object({
      page: z.coerce.number().min(1).default(defaultPage),
      limit: z.coerce.number().min(1).max(100).default(defaultLimit),
    }),

  dateRange: () =>
    z
      .object({
        from: z.coerce.date(),
        to: z.coerce.date(),
      })
      .optional(),

  sortConfig: () =>
    z.object({
      sortBy: z.string().optional(),
      sortOrder: z.enum(["asc", "desc"]).optional(),
    }),
};

// ====================================
// Type Guards and Validators
// ====================================

/**
 * Type guard for URL parameter values
 */
export const isValidUrlParamValue = (value: any): value is UrlParamValue => {
  if (value === null || value === undefined) return true;

  const type = typeof value;
  if (["string", "number", "boolean"].includes(type)) return true;
  if (value instanceof Date) return !isNaN(value.getTime());
  if (value instanceof Set) return Array.from(value).every((v) => typeof v === "string");
  if (Array.isArray(value)) {
    return value.every((v) => typeof v === "string" || typeof v === "number");
  }
  if (type === "object") {
    return Object.values(value).every((v) => typeof v === "string" || typeof v === "number");
  }

  return false;
};

/**
 * Type guard for URL state objects
 */
export const isValidUrlState = <T extends UrlStateBase>(value: any, config: UrlStateConfiguration<T>): value is T => {
  if (!value || typeof value !== "object") return false;

  // Check all required fields exist and are valid
  for (const [key, fieldConfig] of Object.entries(config)) {
    const fieldValue = value[key];

    // Check if required field is missing
    if (fieldConfig.required && (fieldValue === undefined || fieldValue === null)) {
      return false;
    }

    // Validate field value if validator provided
    if (fieldValue !== undefined && fieldConfig.validator) {
      if (!fieldConfig.validator(fieldValue)) {
        return false;
      }
    }

    // Check if value is a valid URL parameter type
    if (fieldValue !== undefined && !isValidUrlParamValue(fieldValue)) {
      return false;
    }
  }

  return true;
};

// ====================================
// Configuration Builders
// ====================================

/**
 * Builder class for creating URL state configurations
 */
export class UrlStateConfigBuilder<T extends UrlStateBase = {}> {
  private config: UrlStateConfiguration<T> = {} as UrlStateConfiguration<T>;

  /**
   * Add a string field
   */
  string<K extends string>(key: K, options?: Omit<UrlFieldConfig<string>, "parser" | "serializer">): UrlStateConfigBuilder<T & Record<K, string>> {
    (this.config as any)[key] = {
      defaultValue: "",
      parser: (value: string | null) => value || "",
      serializer: (value: string) => value,
      ...options,
    };
    return this as any;
  }

  /**
   * Add a number field
   */
  number<K extends string>(key: K, options?: Omit<UrlFieldConfig<number>, "parser" | "serializer">): UrlStateConfigBuilder<T & Record<K, number>> {
    (this.config as any)[key] = {
      defaultValue: 0,
      parser: (value: string | null) => (value ? parseFloat(value) : 0),
      serializer: (value: number) => value.toString(),
      validator: (value: any): value is number => typeof value === "number" && !isNaN(value),
      ...options,
    };
    return this as any;
  }

  /**
   * Add a boolean field
   */
  boolean<K extends string>(key: K, options?: Omit<UrlFieldConfig<boolean>, "parser" | "serializer">): UrlStateConfigBuilder<T & Record<K, boolean>> {
    (this.config as any)[key] = {
      defaultValue: false,
      parser: (value: string | null) => value === "true",
      serializer: (value: boolean) => value.toString(),
      ...options,
    };
    return this as any;
  }

  /**
   * Add a string array field
   */
  stringArray<K extends string>(key: K, options?: Omit<UrlFieldConfig<string[]>, "parser" | "serializer">): UrlStateConfigBuilder<T & Record<K, string[]>> {
    (this.config as any)[key] = {
      defaultValue: [],
      parser: (value: string | null) => {
        if (!value) return [];
        try {
          return JSON.parse(value);
        } catch {
          return value.split(",").filter(Boolean);
        }
      },
      serializer: (value: string[]) => JSON.stringify(value),
      validator: (value: any): value is string[] => Array.isArray(value) && value.every((v) => typeof v === "string"),
      ...options,
    };
    return this as any;
  }

  /**
   * Add a record field
   */
  record<K extends string, V extends string | number>(
    key: K,
    valueType: "string" | "number",
    options?: Omit<UrlFieldConfig<Record<string, V>>, "parser" | "serializer">,
  ): UrlStateConfigBuilder<T & Record<K, Record<string, V>>> {
    const parser =
      valueType === "number"
        ? (value: string | null) => {
            if (!value || value === "{}") return {};
            const parsed = JSON.parse(value);
            const result: Record<string, number> = {};
            for (const [k, v] of Object.entries(parsed)) {
              result[k] = parseFloat(v as string);
            }
            return result as Record<string, V>;
          }
        : (value: string | null) => {
            if (!value || value === "{}") return {};
            return JSON.parse(value) as Record<string, V>;
          };

    (this.config as any)[key] = {
      defaultValue: {},
      parser,
      serializer: (value: Record<string, V>) => JSON.stringify(value),
      validator: (value: any): value is Record<string, V> => {
        if (!value || typeof value !== "object" || Array.isArray(value)) return false;
        return Object.values(value).every((v) => typeof v === valueType);
      },
      ...options,
    };
    return this as any;
  }

  /**
   * Add an enum field
   */
  enum<K extends string, E extends readonly [string, ...string[]]>(
    key: K,
    enumValues: E,
    options?: Omit<UrlFieldConfig<E[number]>, "parser" | "serializer" | "validator">,
  ): UrlStateConfigBuilder<T & Record<K, E[number]>> {
    (this.config as any)[key] = {
      defaultValue: enumValues[0],
      parser: (value: string | null) => {
        if (!value || !enumValues.includes(value as E[number])) {
          return enumValues[0];
        }
        return value as E[number];
      },
      serializer: (value: E[number]) => value,
      validator: (value: any): value is E[number] => enumValues.includes(value),
      ...options,
    };
    return this as any;
  }

  /**
   * Add a custom field
   */
  custom<K extends string, V>(key: K, fieldConfig: UrlFieldConfig<V>): UrlStateConfigBuilder<T & Record<K, V>> {
    (this.config as any)[key] = fieldConfig;
    return this as any;
  }

  /**
   * Build the final configuration
   */
  build(): UrlStateConfiguration<T> {
    return this.config;
  }
}

/**
 * Create a URL state configuration builder
 */
export const createUrlStateConfig = () => new UrlStateConfigBuilder();

// ====================================
// Predefined Configurations
// ====================================

/**
 * Configuration for basic search forms
 */
export const searchFormConfig = createUrlStateConfig()
  .string("search")
  .number("page", { defaultValue: 1, immediate: true })
  .number("limit", { defaultValue: 20, immediate: true })
  .build();

/**
 * Configuration for borrow forms
 */
export const borrowFormConfig = createUrlStateConfig()
  .string("search", { debounceMs: 300 })
  .stringArray("selectedIds")
  .record("quantities", "number")
  .record("userAssignments", "string")
  .string("globalUserId")
  .boolean("useGlobalUser")
  .boolean("showSelectedOnly")
  .boolean("showInactive")
  .stringArray("categoryIds")
  .stringArray("brandIds")
  .stringArray("supplierIds")
  .number("page", { defaultValue: 1, immediate: true })
  .number("limit", { defaultValue: 20, immediate: true })
  .build();

/**
 * Configuration for activity forms
 */
export const activityFormConfig = createUrlStateConfig()
  .string("search", { debounceMs: 300 })
  .stringArray("selectedIds")
  .enum("operation", ["INBOUND", "OUTBOUND"] as const, { defaultValue: "OUTBOUND" })
  .record("quantityAssignments", "number")
  .number("globalQuantity", { defaultValue: 1 })
  .string("globalUserId")
  .boolean("showSelectedOnly")
  .boolean("showInactive")
  .stringArray("categoryIds")
  .stringArray("brandIds")
  .stringArray("supplierIds")
  .number("page", { defaultValue: 1, immediate: true })
  .number("limit", { defaultValue: 20, immediate: true })
  .build();

// Export types for the predefined configurations
export type SearchFormConfig = ExtractUrlStateType<typeof searchFormConfig>;
export type BorrowFormConfig = ExtractUrlStateType<typeof borrowFormConfig>;
export type ActivityFormConfig = ExtractUrlStateType<typeof activityFormConfig>;
