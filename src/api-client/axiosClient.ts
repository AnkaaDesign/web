// packages/services/src/client.ts

import axios, { AxiosError } from "axios";
import type { AxiosRequestConfig, AxiosInstance, InternalAxiosRequestConfig, CancelTokenSource, AxiosResponse } from "axios";
import qs from "qs";
import { notify } from "./notify";
import { safeLocalStorage } from "./platform-utils";

// =====================
// Enhanced Type Definitions
// =====================

interface ApiErrorResponse {
  success: false;
  message: string | string[];
  timestamp: string;
  error: {
    code: string;
    details?: unknown;
  };
  errors?: string[];
  statusCode?: number;
}

interface ApiSuccessResponse<T = unknown> {
  success: true;
  data: T;
  message: string;
  timestamp: string;
}

interface ApiPaginatedResponse<T = unknown> extends ApiSuccessResponse<T[]> {
  meta: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNextPage: boolean;
    hasPreviousPage: boolean;
  };
}

interface ApiClientConfig {
  baseURL: string;
  timeout: number;
  retryAttempts: number;
  retryDelay: number;
  enableNotifications: boolean;
  enableLogging: boolean;
  enableCache: boolean;
  cacheTimeout: number;
  enableRequestId: boolean;
  defaultHeaders: Record<string, string>;
  tokenProvider?: () => string | null | Promise<string | null>;
}

interface RequestMetadata {
  startTime: number;
  requestId: string;
  method: string;
  url: string;
  retryCount: number;
  isCached?: boolean;
  isReactQueryRetry?: boolean; // Track if this is a React Query retry attempt
  suppressToast?: boolean; // Suppress toast for this request
}

// Extend AxiosRequestConfig to include metadata
declare module "axios" {
  interface InternalAxiosRequestConfig {
    metadata?: RequestMetadata;
  }
}

interface CacheEntry<T = unknown> {
  data: T;
  timestamp: number;
  expiresAt: number;
  requestKey: string;
}

interface ErrorInfo {
  title: string;
  message: string;
  _statusCode: number;
  errors: string[];
  isRetryable: boolean;
  category: ErrorCategory;
}

enum ErrorCategory {
  NETWORK = "network",
  AUTHENTICATION = "authentication",
  AUTHORIZATION = "authorization",
  VALIDATION = "validation",
  NOT_FOUND = "not_found",
  CONFLICT = "conflict",
  RATE_LIMIT = "rate_limit",
  SERVER_ERROR = "server_error",
  TIMEOUT = "timeout",
  UNKNOWN = "unknown",
}

interface EnhancedError extends Error {
  category?: ErrorCategory;
}

interface ExtendedAxiosInstance extends AxiosInstance {
  cancelAllRequests?: () => void;
  clearCache?: () => void;
}

// =====================
// Configuration
// =====================

// Support environment-specific API URLs
const getApiUrl = (): string => {
  // Check for browser window object first (web environment)
  if (typeof (globalThis as any).window !== "undefined" && typeof (globalThis as any).window.__ANKAA_API_URL__ !== "undefined") {
    return (globalThis as any).window.__ANKAA_API_URL__; // No /api suffix - using subdomain architecture
  }

  // Check for global config object (can be set by apps) - React Native safe
  if (typeof globalThis !== "undefined" && typeof (globalThis as any).window !== "undefined" && typeof (globalThis as any).window.__ANKAA_API_URL__ !== "undefined") {
    return (globalThis as any).window.__ANKAA_API_URL__; // No /api suffix - using subdomain architecture
  }

  // For React Native/Expo apps
  if (typeof process !== "undefined" && process.env?.EXPO_PUBLIC_API_URL) {
    return process.env.EXPO_PUBLIC_API_URL; // No /api suffix - using subdomain architecture
  }

  // Default fallback
  return "http://localhost:3030"; // No /api suffix - using subdomain architecture
};

const DEFAULT_CONFIG: ApiClientConfig = {
  baseURL: getApiUrl(),
  timeout: 300000, // 5 minutes to allow for large file uploads
  retryAttempts: 0, // Disable retries to prevent infinite loops with rate limiting
  retryDelay: 1000,
  enableNotifications: true,
  enableLogging: process.env.NODE_ENV === "development", // Only enable logging in development
  enableCache: true,
  cacheTimeout: 5 * 60 * 1000, // 5 minutes
  enableRequestId: true,
  defaultHeaders: {
    "Content-Type": "application/json",
    Accept: "application/json",
  },
};

// =====================
// Utility Functions
// =====================

const isWriteMethod = (method?: string): boolean => ["post", "patch", "put", "delete"].includes(method?.toLowerCase() || "");

const isCacheableMethod = (method?: string): boolean => ["get", "head"].includes(method?.toLowerCase() || "");

const generateRequestId = (): string => `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

const createCacheKey = (config: AxiosRequestConfig): string => {
  const { method, url, params, data } = config;
  return `${method?.toUpperCase()}_${url}_${JSON.stringify(params)}_${JSON.stringify(data)}`;
};

const getSuccessMessage = (method?: string): string => {
  const methodMessages: Record<string, string> = {
    post: "Criado com sucesso",
    patch: "Atualizado com sucesso",
    put: "Atualizado com sucesso",
    delete: "Excluído com sucesso",
  };

  return methodMessages[method?.toLowerCase() || ""] || "Operação realizada com sucesso";
};

const shouldRetry = (error: AxiosError, attempt: number, maxAttempts: number): boolean => {
  if (attempt >= maxAttempts) return false;

  // Don't retry client errors (4xx) - especially rate limits (429)
  const status = error.response?.status;
  if (status && status >= 400 && status < 500) {
    // Never retry rate limit errors (429) to avoid infinite loops
    // Only retry 408 (timeout) as it might be a temporary network issue
    return status === 408;
  }

  // Retry network errors, timeouts, and server errors (5xx)
  return !!(
    !error.response || // Network error
    error.code === "ECONNABORTED" || // Timeout
    error.code === "ETIMEDOUT" || // Timeout
    error.message === "Network Error" || // Network error
    (status && status >= 500) // Server error
  );
};

const delay = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

// =====================
// Request Retry Tracking & Toast Deduplication
// =====================
//
// This system prevents duplicate error toasts when React Query retries failed requests.
//
// Problem: React Query automatically retries failed requests (3x for queries, 1x for mutations).
// Each retry attempt would trigger a new error toast from Axios, resulting in multiple toasts
// for the same operation.
//
// Solution: Track recent errors and suppress duplicate toasts within a deduplication window (2s).
// This ensures users only see ONE error toast for a failed operation, even if it's retried
// multiple times by React Query.
//
// The tracker:
// 1. Records each error by request key (method:url)
// 2. Checks if a similar error occurred within the deduplication window
// 3. Suppresses the toast if it's a duplicate
// 4. Clears tracking when requests succeed
// 5. Auto-cleans old entries every 30 seconds

interface RetryTrackingEntry {
  lastErrorTime: number;
  errorCount: number;
  lastErrorMessage: string;
}

class RequestRetryTracker {
  private retryingRequests = new Map<string, RetryTrackingEntry>();
  private readonly deduplicationWindow = 2000; // 2 seconds window for deduplication

  private getRequestKey(url: string, method: string): string {
    return `${method.toUpperCase()}:${url}`;
  }

  // Check if we should show a toast for this error
  shouldShowToast(url: string, method: string, errorMessage: string): boolean {
    const key = this.getRequestKey(url, method);
    const now = Date.now();
    const existing = this.retryingRequests.get(key);

    if (!existing) {
      // First time seeing this error
      this.retryingRequests.set(key, {
        lastErrorTime: now,
        errorCount: 1,
        lastErrorMessage: errorMessage,
      });
      return true;
    }

    // Check if this is within the deduplication window
    const timeSinceLastError = now - existing.lastErrorTime;

    if (timeSinceLastError < this.deduplicationWindow) {
      // Same error within deduplication window - don't show toast
      existing.errorCount++;
      existing.lastErrorTime = now;
      return false;
    }

    // Outside deduplication window - show toast and reset
    this.retryingRequests.set(key, {
      lastErrorTime: now,
      errorCount: 1,
      lastErrorMessage: errorMessage,
    });
    return true;
  }

  // Mark a request as completed successfully
  clearRequest(url: string, method: string): void {
    const key = this.getRequestKey(url, method);
    this.retryingRequests.delete(key);
  }

  // Clean up old entries periodically
  cleanup(): void {
    const now = Date.now();
    const maxAge = 60000; // 60 seconds

    for (const [key, entry] of this.retryingRequests.entries()) {
      if (now - entry.lastErrorTime > maxAge) {
        this.retryingRequests.delete(key);
      }
    }
  }
}

// =====================
// Cache Management
// =====================

class RequestCache {
  private cache = new Map<string, CacheEntry>();
  private readonly maxSize = 100;
  private readonly defaultTimeout: number;

  constructor(defaultTimeout: number) {
    this.defaultTimeout = defaultTimeout;
  }

  set<T>(key: string, data: T, timeout?: number): void {
    // Clean expired entries if cache is getting large
    if (this.cache.size >= this.maxSize) {
      this.cleanExpired();

      // If still too large, remove oldest entries
      if (this.cache.size >= this.maxSize) {
        const oldestKeys = Array.from(this.cache.keys()).slice(0, 20);
        oldestKeys.forEach((k) => this.cache.delete(k));
      }
    }

    const now = Date.now();
    const expiresAt = now + (timeout || this.defaultTimeout);

    this.cache.set(key, {
      data,
      timestamp: now,
      expiresAt,
      requestKey: key,
    });
  }

  get<T>(key: string): T | null {
    const entry = this.cache.get(key);
    if (!entry) return null;

    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      return null;
    }

    return entry.data as T;
  }

  clear(): void {
    this.cache.clear();
  }

  private cleanExpired(): void {
    const now = Date.now();
    for (const [key, entry] of this.cache.entries()) {
      if (now > entry.expiresAt) {
        this.cache.delete(key);
      }
    }
  }
}

// =====================
// Enhanced API Client Factory
// =====================

const createApiClient = (config: Partial<ApiClientConfig> = {}): ExtendedAxiosInstance => {
  const finalConfig = { ...DEFAULT_CONFIG, ...config };
  const cache = new RequestCache(finalConfig.cacheTimeout);
  const cancelTokens = new Map<string, CancelTokenSource>();
  const retryTracker = new RequestRetryTracker();

  // Periodic cleanup of retry tracking entries
  const cleanupInterval = setInterval(() => {
    retryTracker.cleanup();
  }, 30000); // Clean up every 30 seconds

  const client = axios.create({
    baseURL: finalConfig.baseURL,
    timeout: finalConfig.timeout,
    headers: finalConfig.defaultHeaders,
    paramsSerializer: {
      serialize: (params) => {
        // Log params for debugging in development
        if (finalConfig.enableLogging && process.env.NODE_ENV === "development") {
          console.log("[AxiosClient] Serializing params:", JSON.stringify(params, null, 2));
        }

        // Pre-process params: JSON-stringify complex nested objects
        // This matches the mobile's approach and ensures null values inside nested
        // objects (like where.truck.isNot=null) are preserved instead of being
        // stripped by qs.stringify's skipNulls option
        const processedParams: Record<string, any> = {};

        for (const [key, value] of Object.entries(params)) {
          if (value === null || value === undefined) {
            continue; // Skip null/undefined top-level values
          }

          // Skip empty strings entirely - they cause API validation errors
          if (value === "") {
            continue;
          }

          // CRITICAL: Extra safeguard for similarColor - must be valid hex format
          if (key === "similarColor") {
            if (
              typeof value !== "string" ||
              value === "" ||
              value === "#000000" ||
              !/^#[0-9A-Fa-f]{6}$/.test(value)
            ) {
              continue;
            }
          }

          // Check if this is a complex nested object (more than 1 level deep)
          if (
            typeof value === "object" &&
            !Array.isArray(value) &&
            !(value instanceof Date)
          ) {
            // Check if it has nested objects
            const hasNestedObjects = Object.values(value).some(
              (v) =>
                v !== null &&
                typeof v === "object" &&
                !Array.isArray(v) &&
                !(v instanceof Date),
            );

            if (hasNestedObjects) {
              // JSON-stringify complex nested objects to preserve null values
              // and avoid issues with deep dot notation parsing
              processedParams[key] = JSON.stringify(value);
            } else {
              // Keep simple objects for qs.stringify
              processedParams[key] = value;
            }
          } else {
            processedParams[key] = value;
          }
        }

        const queryString = qs.stringify(processedParams, {
          arrayFormat: "indices",
          encode: true, // CRITICAL: Must encode special characters like # in hex colors
          serializeDate: (date: Date) => date.toISOString(),
          skipNulls: true,
          addQueryPrefix: false,
          allowDots: true,
          strictNullHandling: true,
          // Use indices for arrays to produce orderBy[0].name=asc instead of orderBy[].name=asc
          indices: true,
        });

        // Log serialized query string for debugging
        if (finalConfig.enableLogging && process.env.NODE_ENV === "development") {
          console.log("[AxiosClient] Serialized query string:", queryString);
        }

        return queryString;
      },
    },
    // Enhanced validation for responses
    validateStatus: (status) => status >= 200 && status < 300,
  });

  // =====================
  // Request Interceptor
  // =====================

  client.interceptors.request.use(
    async (config: InternalAxiosRequestConfig) => {
      if (finalConfig.enableLogging && process.env.NODE_ENV !== 'production') {
        console.log(`[AXIOS INTERCEPTOR] Request starting for: ${config.method?.toUpperCase()} ${config.url}`);
        console.log(`[AXIOS INTERCEPTOR] Instance ID: ${(client as any).__instanceId || "unknown"}`);
        console.log(`[AXIOS INTERCEPTOR] Has token provider: ${!!((client as any).__tokenProvider || globalTokenProvider)}`);
      }

      const requestId = generateRequestId();
      const startTime = Date.now();

      // Merge with existing metadata (preserve custom flags like suppressToast)
      const metadata: RequestMetadata = {
        ...config.metadata, // Preserve any existing metadata
        startTime,
        requestId,
        method: config.method?.toUpperCase() || "UNKNOWN",
        url: config.url || "",
        retryCount: config.metadata?.retryCount || 0,
      };

      config.metadata = metadata;

      // Auto-attach token if tokenProvider is configured
      // Check for updated token provider first (set via setTokenProvider)
      const tokenProvider = (client as any).__tokenProvider || globalTokenProvider || finalConfig.tokenProvider;

      if (finalConfig.enableLogging && process.env.NODE_ENV !== 'production') {
        console.log(`[API CLIENT DEBUG] Request interceptor - URL: ${config.url}, Has tokenProvider: ${!!tokenProvider}`);
        console.log(
          `[API CLIENT DEBUG] Token provider sources - __tokenProvider: ${!!(client as any).__tokenProvider}, globalTokenProvider: ${!!globalTokenProvider}, finalConfig.tokenProvider: ${!!finalConfig.tokenProvider}`,
        );
      }

      // Always check for fresh token, even if Authorization header exists
      if (tokenProvider) {
        try {
          const token = await tokenProvider();

          // If we have a token, always use the fresh one
          if (token) {
            config.headers.Authorization = `Bearer ${token}`;
          } else if (!config.url?.includes("/auth/")) {
            // FALLBACK: If no token from provider, check localStorage directly
            const fallbackToken = safeLocalStorage.getItem("ankaa_token");
            if (fallbackToken) {
              if (process.env.NODE_ENV !== 'production') {
                console.warn(`[API CLIENT DEBUG] FALLBACK: Using token from localStorage directly for ${config.url}`);
              }
              config.headers.Authorization = `Bearer ${fallbackToken}`;
            }
            // If no token and not an auth endpoint, check if we just logged in
            if ((client as any).__justLoggedIn) {
              await delay(300);
              const retryToken = await tokenProvider();
              if (retryToken) {
                config.headers.Authorization = `Bearer ${retryToken}`;
              }
            }
          }
        } catch (error) {
          // Silently fail if token retrieval fails
          if (process.env.NODE_ENV !== 'production') {
            console.error("[API CLIENT DEBUG] Failed to retrieve auth token:", error);
          }
        }
      }

      // Add request ID header if enabled
      if (finalConfig.enableRequestId) {
        config.headers["X-Request-ID"] = requestId;
      }

      // CRITICAL: Clean query parameters to remove empty strings, null, undefined
      // This is the FINAL line of defense before axios serializes params
      if (config.params && typeof config.params === "object") {
        const cleanedParams: any = {};
        for (const [key, value] of Object.entries(config.params)) {
          // Skip empty strings, null, undefined
          if (value === "" || value === null || value === undefined) {
            continue;
          }

          // SPECIAL: Skip similarColor if it's the default black or empty
          if (key === "similarColor" && (value === "#000000" || value === "")) {
            continue;
          }

          // SPECIAL: Skip similarColorThreshold if there's no similarColor
          if (key === "similarColorThreshold" && (!config.params.similarColor || config.params.similarColor === "#000000" || config.params.similarColor === "")) {
            continue;
          }

          cleanedParams[key] = value;
        }

        // Replace params with cleaned version
        config.params = cleanedParams;
      }

      // Handle FormData - remove Content-Type to let browser set it with boundary
      if (config.data instanceof FormData) {
        // Remove Content-Type header - browser will set it with proper boundary
        if (config.headers["Content-Type"]) {
          delete config.headers["Content-Type"];
        }
        // Also remove from common headers if present
        if (config.headers.common && config.headers.common["Content-Type"]) {
          delete config.headers.common["Content-Type"];
        }
      }

      // Fix array serialization issues for batch operations and regular task updates
      if ((config.url?.includes("/batch") || config.url?.includes("/tasks/")) && (config.method?.toLowerCase() === "put" || config.method?.toLowerCase() === "patch" || config.method?.toLowerCase() === "post")) {
        // Skip object transformation if data is FormData
        if (config.data && typeof config.data === "object" && !Array.isArray(config.data) && !(config.data instanceof FormData)) {
          // Known date fields that should never be empty objects
          const dateFields = ['startedAt', 'completedAt', 'entryDate', 'forecastDate', 'deliveryDate', 'createdAt', 'updatedAt', 'term', 'finishedAt'];

          // Recursively fix any array field that was serialized as an object with numeric keys
          // Also remove empty objects that should be dates
          const fixArrays = (obj: any, parentKey?: string): any => {
            if (obj === null || obj === undefined) return obj;
            if (Array.isArray(obj)) {
              return obj.map(item => fixArrays(item));
            }
            // CRITICAL: Check for Date BEFORE generic object handling
            // Date objects have typeof === "object" but Object.keys() returns []
            // We must preserve Date objects, not treat them as empty objects
            if (obj instanceof Date) {
              return obj; // Return Date as-is, let JSON.stringify handle it
            }
            if (typeof obj === "object") {
              const keys = Object.keys(obj);
              const isNumericKeys = keys.length > 0 && keys.every((k) => /^\d+$/.test(k));
              const isEmptyObject = keys.length === 0;

              // If this is an empty object and the parent key is a date field, return null
              // Note: Actual Date objects are already handled above, so this only catches
              // malformed empty objects like {} that were meant to be dates
              if (isEmptyObject && parentKey && dateFields.includes(parentKey)) {
                return null;
              }

              if (isNumericKeys) {
                // Convert object with numeric keys to array, then recursively fix items
                return Object.values(obj).map(item => fixArrays(item));
              }

              // Regular object, recursively fix all properties
              const fixed: any = {};
              for (const key of keys) {
                const value = fixArrays(obj[key], key);
                // Include all values, including null for date fields (needed to clear dates)
                fixed[key] = value;
              }
              return fixed;
            }
            return obj;
          };

          config.data = fixArrays(config.data);

          // Force proper JSON serialization
          config.data = JSON.parse(JSON.stringify(config.data));
        }
      }

      // Fix array serialization issue for external-withdrawals
      if (config.url?.includes("/external-withdrawals") && config.method?.toLowerCase() === "post") {
        if (config.data && typeof config.data === "object" && !Array.isArray(config.data)) {
          // Fix array serialization issue for items
          if (config.data.items && typeof config.data.items === "object" && !Array.isArray(config.data.items)) {
            config.data = {
              ...config.data,
              items: Object.values(config.data.items),
            };
          }

          // Ensure data is properly serialized
          if (config.data.items && Array.isArray(config.data.items)) {
            // Force proper JSON serialization by stringify and parse
            config.data = JSON.parse(JSON.stringify(config.data));
          }
        }
      }

      // Add cache-busting for GET requests (but not for cached responses)
      if (config.method === "get" && !finalConfig.enableCache) {
        config.params = { ...config.params, _t: Date.now() };
      }

      // Check cache for GET requests
      if (finalConfig.enableCache && isCacheableMethod(config.method)) {
        const cacheKey = createCacheKey(config);
        const cachedResponse = cache.get(cacheKey);

        if (cachedResponse) {
          metadata.isCached = true;

          // Return cached response immediately
          return Promise.resolve(config);
        }
      }

      // Create cancel token for this request
      const cancelToken = axios.CancelToken.source();
      config.cancelToken = cancelToken.token;
      cancelTokens.set(requestId, cancelToken);

      // Logging
      if (finalConfig.enableLogging && process.env.NODE_ENV !== 'production') {
        console.log(`🚀 ${metadata.method} ${metadata.url} [${requestId}]`);

        // Additional debugging for customer requests
        if (config.url?.includes("/customers/") && config.method?.toLowerCase() === "get") {
          console.log("[AXIOS DEBUG] Customer GET request:");
          console.log("[AXIOS DEBUG] - URL:", config.url);
          console.log("[AXIOS DEBUG] - Params:", JSON.stringify(config.params, null, 2));
          console.log("[AXIOS DEBUG] - Base URL:", config.baseURL);
          console.log("[AXIOS DEBUG] - Full URL:", config.baseURL + config.url);
        }

      }

      return config;
    },
    (error: AxiosError) => {
      if (finalConfig.enableLogging && process.env.NODE_ENV !== 'production') {
        console.error("❌ Request setup error:", error.message);
      }

      const enhancedError = new Error("Erro ao preparar a requisição. Tente novamente.") as EnhancedError;
      enhancedError.category = ErrorCategory.UNKNOWN;

      return Promise.reject(enhancedError);
    },
  );

  // =====================
  // Response Interceptor
  // =====================

  client.interceptors.response.use(
    (response: AxiosResponse<ApiSuccessResponse | ApiPaginatedResponse>) => {
      const config = response.config as InternalAxiosRequestConfig;
      const metadata = config.metadata as RequestMetadata;
      const duration = Date.now() - metadata.startTime;
      const requestId = metadata.requestId;

      // Clean up cancel token
      if (requestId) {
        cancelTokens.delete(requestId);
      }

      // Cache successful GET responses
      if (finalConfig.enableCache && isCacheableMethod(config.method) && !metadata.isCached) {
        const cacheKey = createCacheKey(config);
        cache.set(cacheKey, response.data);
      }

      // Logging
      if (finalConfig.enableLogging && process.env.NODE_ENV !== 'production') {
        const cacheLabel = metadata.isCached ? " (cached)" : "";
        console.log(`✅ ${metadata.method} ${metadata.url} [${requestId}] - ${duration}ms${cacheLabel}`);

        // Debug log for auth endpoints
        if (metadata.url?.includes("/auth/")) {
          console.log("[DEBUG] Auth response data:", response.data);
        }
      }

      // Dismiss any pending retry toasts for this request
      if (finalConfig.enableNotifications && metadata) {
        notify.dismissRetry?.(metadata.url, metadata.method);
        // Clear retry tracking for successful requests
        retryTracker.clearRequest(metadata.url, metadata.method);
      }

      // Show success notification for write operations
      if (finalConfig.enableNotifications && isWriteMethod(config.method)) {
        // Skip notifications for batch operations - they'll be handled by the dialog
        const isBatchOperation = config.url?.includes("/batch");
        // Skip notifications for mark-viewed - this is a background operation
        const isMarkViewed = config.url?.includes("/mark-viewed");
        // Skip notifications for notification-related endpoints - these are background operations
        // that would create confusing duplicate toasts when marking notifications as read
        const isNotificationEndpoint = config.url?.includes("/notifications") || config.url?.includes("/seen-notifications");
        // Only show success if the response indicates success
        const isSuccess = (response.data?.success as boolean | undefined) !== false; // Show success unless explicitly false

        if (!isBatchOperation && !isMarkViewed && !isNotificationEndpoint && isSuccess) {
          const message = response.data?.message || getSuccessMessage(config.method);
          notify.success("Sucesso", message);
        }
      }

      return response;
    },
    async (error: AxiosError<ApiErrorResponse>) => {
      const config = error.config as InternalAxiosRequestConfig;
      const metadata = config?.metadata as RequestMetadata;
      const requestId = metadata?.requestId;

      // Clean up cancel token
      if (requestId) {
        cancelTokens.delete(requestId);
      }

      // Handle retry logic
      if (config && metadata && shouldRetry(error, metadata.retryCount, finalConfig.retryAttempts)) {
        metadata.retryCount++;

        if (finalConfig.enableLogging && process.env.NODE_ENV !== 'production') {
          console.log(`🔄 Retrying ${metadata.method} ${metadata.url} [${requestId}] - Attempt ${metadata.retryCount}/${finalConfig.retryAttempts}`);
        }

        // Show retry notification
        if (finalConfig.enableNotifications) {
          const errorInfo = handleApiError(error);
          notify.retry("Tentando novamente...", errorInfo.message, metadata.url, metadata.method, metadata.retryCount, finalConfig.retryAttempts);
        }

        // Calculate exponential backoff delay
        const backoffDelay = finalConfig.retryDelay * Math.pow(2, metadata.retryCount - 1);
        await delay(backoffDelay);

        // Create new cancel token for retry
        const newCancelToken = axios.CancelToken.source();
        config.cancelToken = newCancelToken.token;
        cancelTokens.set(requestId, newCancelToken);

        return client.request(config);
      }

      // Process and handle the error
      const errorInfo = handleApiError(error);

      // Handle 401 errors - try to refresh token first
      if (errorInfo._statusCode === 401 && !config.url?.includes("/auth/refresh") && !config.url?.includes("/auth/login")) {
        if (process.env.NODE_ENV !== 'production') {
          console.log("[API CLIENT DEBUG] Got 401, attempting to refresh token");
        }

        // Check if we're already refreshing to avoid infinite loops
        if (!(config as any).__isRetryRequest) {
          try {
            // Import authService dynamically to avoid circular dependency
            const { authService } = await import("./auth");

            // Try to refresh the token
            const refreshResponse = await authService.refreshToken();

            if (refreshResponse?.success && refreshResponse?.data?.token) {
              if (process.env.NODE_ENV !== 'production') {
                console.log("[API CLIENT DEBUG] Token refreshed successfully");
              }

              // Update the stored token
              const newToken = refreshResponse.data.token;

              // Update token in storage with proper key prefix
              safeLocalStorage.setItem("ankaa_token", newToken);
              // Also update global token (only in web environment)
              if (typeof (globalThis as any).window !== "undefined") {
                (globalThis as any).window.__ANKAA_AUTH_TOKEN__ = newToken;
              }

              // Retry the original request with new token
              config.headers.Authorization = `Bearer ${newToken}`;
              (config as any).__isRetryRequest = true;

              return client.request(config);
            }
          } catch (refreshError: any) {
            if (process.env.NODE_ENV !== 'production') {
              console.error("[API CLIENT DEBUG] Token refresh failed:", refreshError);
            }

            // If refresh returns 401, it means the refresh token is also invalid
            // Don't try to refresh again, just proceed to logout
            const refreshStatus = refreshError?.originalError?.response?.status || refreshError?._statusCode;
            if (refreshStatus === 401) {
              if (process.env.NODE_ENV !== 'production') {
                console.log("[API CLIENT DEBUG] Refresh token is also invalid, proceeding to logout");
              }
            }
            // Continue to logout flow below
          }
        }
      }

      // Handle authentication errors (401/403) - trigger logout if refresh failed
      if (
        (errorInfo.category === ErrorCategory.AUTHENTICATION || errorInfo.category === ErrorCategory.AUTHORIZATION) &&
        globalAuthErrorHandler &&
        (errorInfo._statusCode === 401 || errorInfo._statusCode === 403)
      ) {
        if (process.env.NODE_ENV !== 'production') {
          console.log(`[API CLIENT DEBUG] Authentication error detected (${errorInfo._statusCode}), calling auth error handler`);
        }

        try {
          globalAuthErrorHandler({
            statusCode: errorInfo._statusCode,
            message: errorInfo.message,
            category: errorInfo.category,
          });
        } catch (handlerError) {
          if (process.env.NODE_ENV !== 'production') {
            console.error("[API CLIENT DEBUG] Error in auth error handler:", handlerError);
          }
        }
      }

      // Logging
      if (finalConfig.enableLogging && process.env.NODE_ENV !== 'production') {
        const duration = metadata ? Date.now() - metadata.startTime : 0;
        console.error(`❌ ${metadata?.method || "UNKNOWN"} ${metadata?.url || "UNKNOWN"} [${requestId || "unknown"}] - ${duration}ms`, errorInfo);
      }

      // Show error notification with detailed messages
      if (finalConfig.enableNotifications && metadata) {
        // Skip notifications for batch operations - they'll be handled by the dialog
        const isBatchOperation = config?.url?.includes("/batch");
        // Skip notifications for file uploads - they should be handled by upload components
        const isFileUpload = config?.url?.includes("/files/upload");
        // Skip notifications for notification-related endpoints - these are background operations
        const isNotificationEndpoint = config?.url?.includes("/notifications") || config?.url?.includes("/seen-notifications");

        // Check if we should show this toast (deduplication check)
        const shouldShow = retryTracker.shouldShowToast(metadata.url, metadata.method, errorInfo.message);

        if (!isBatchOperation && !isFileUpload && !isNotificationEndpoint && shouldShow) {
          // For rate limit errors, show specialized message
          if (errorInfo.category === ErrorCategory.RATE_LIMIT) {
            notify.error("Limite de Requisições", errorInfo.message, {
              duration: 8000,
            });
          } else if (errorInfo.errors && errorInfo.errors.length > 1) {
            // For multiple errors, show all details
            notify.error(errorInfo.title, errorInfo.message, { duration: 10000 });
          } else {
            notify.error(errorInfo.title, errorInfo.message);
          }
        }
      }

      // Create enhanced error with additional metadata
      const enhancedError = new Error(errorInfo.message);
      Object.assign(enhancedError, {
        title: errorInfo.title,
        _statusCode: errorInfo._statusCode,
        errors: errorInfo.errors,
        category: errorInfo.category,
        isRetryable: errorInfo.isRetryable,
        requestId: requestId,
        originalError: error,
      });

      return Promise.reject(enhancedError);
    },
  );

  // Add method to cancel all pending requests
  const extendedClient = client as ExtendedAxiosInstance;
  extendedClient.cancelAllRequests = () => {
    for (const [requestId, cancelToken] of cancelTokens.entries()) {
      cancelToken.cancel(`Request ${requestId} cancelled by user`);
    }
    cancelTokens.clear();
  };

  // Add method to clear cache
  extendedClient.clearCache = () => {
    cache.clear();
  };

  // Add cleanup method for when the client is destroyed
  (extendedClient as any).destroy = () => {
    clearInterval(cleanupInterval);
    cancelTokens.clear();
    cache.clear();
  };

  return extendedClient;
};

// =====================
// Enhanced Error Handling
// =====================

const handleApiError = (error: unknown): ErrorInfo => {
  const defaultError: ErrorInfo = {
    title: "Erro",
    message: "Erro desconhecido. Tente novamente.",
    _statusCode: 500,
    errors: [],
    isRetryable: false,
    category: ErrorCategory.UNKNOWN,
  };

  // Handle axios cancel
  if (axios.isCancel(error)) {
    return {
      title: "Operação Cancelada",
      message: "A operação foi cancelada.",
      _statusCode: 0,
      errors: ["Cancelled"],
      isRetryable: false,
      category: ErrorCategory.UNKNOWN,
    };
  }

  // Type guard for axios error
  if (!axios.isAxiosError(error)) {
    return defaultError;
  }

  // Network or timeout errors
  if (!error.response || error.code === "ECONNABORTED" || error.message === "Network Error") {
    return {
      title: "Erro de Conexão",
      message: "Não foi possível conectar ao servidor. Verifique sua conexão com a internet e tente novamente.",
      _statusCode: 0,
      errors: ["Erro de conectividade"],
      isRetryable: true,
      category: ErrorCategory.NETWORK,
    };
  }

  // Server timeout
  if (error.code === "ETIMEDOUT") {
    return {
      title: "Tempo Esgotado",
      message: "A operação demorou mais que o esperado. Tente novamente.",
      _statusCode: 408,
      errors: ["Timeout"],
      isRetryable: true,
      category: ErrorCategory.TIMEOUT,
    };
  }

  const response = error.response;
  const errorData = response?.data;
  const statusCode = response?.status || 500;

  // Ultra-robust error message extraction with detailed logging
  let errorMessages: string[] = [];
  let mainMessage = "";
  let detailedError = "";

  if (errorData) {
    // Primary extraction - try to get the most detailed error first
    const extractionSources = [
      // Try exception stack first line (most detailed)
      errorData.exception?.stack?.[0],
      // Try nested error structures common in NestJS
      errorData.response?.message,
      errorData.response?.error,
      // Try specific error fields
      errorData.error,
      errorData.detail,
      errorData.details,
      errorData.description,
      errorData.reason,
      errorData.cause,
      // Original error messages
      errorData.originalError?.message,
      // For batch operation first failed item (common pattern)
      errorData.data?.failed?.[0]?.error,
      // Main message field
      errorData.message,
    ].filter(Boolean);

    // Find the most detailed error message
    for (const source of extractionSources) {
      if (typeof source === "string") {
        // Extract from exception stack format (e.g., "BadRequestException: Actual detailed error")
        const stackMatch = source.match(/^\w+Exception: (.+)$/);
        const candidate = stackMatch ? stackMatch[1] : source;

        // Use the most detailed/longest meaningful error message
        if (candidate.trim() && candidate.length > 10) {
          if (!detailedError || candidate.length > detailedError.length) {
            detailedError = candidate;
          }
        }
      }
    }

    // Use the most detailed error as main message
    if (detailedError) {
      mainMessage = detailedError;
      errorMessages = [detailedError];
    }

    // Handle main message if no detailed error found
    if (!mainMessage) {
      if (Array.isArray(errorData.message)) {
        errorMessages = errorData.message;
        mainMessage = errorMessages.join("\n");
      } else if (typeof errorData.message === "string") {
        mainMessage = errorData.message;
        errorMessages = [errorData.message];
      }
    }

    // Include additional errors if available
    if (errorData.errors && Array.isArray(errorData.errors)) {
      const additionalErrors = errorData.errors.filter((err: string) => !errorMessages.includes(err));
      errorMessages = [...errorMessages, ...additionalErrors];

      if (additionalErrors.length > 0) {
        if (mainMessage) {
          mainMessage = mainMessage + "\n\n" + additionalErrors.join("\n");
        } else {
          mainMessage = additionalErrors.join("\n");
        }
      }
    }

    // Handle batch operation failures with detailed extraction
    if (errorData.data?.failed && Array.isArray(errorData.data.failed)) {
      const failedDetails = errorData.data.failed.map((item: any, index: number) => {
        const itemIndex = item.index !== undefined ? item.index : index;

        // Extract the most detailed error from the failed item
        const itemErrorSources = [item.errorDetails?.message, item.error, item.message, item.details, item.reason].filter(Boolean);

        const itemError = itemErrorSources[0] || "Erro desconhecido";
        return `• Item ${itemIndex + 1}: ${itemError}`;
      });

      if (failedDetails.length > 0) {
        const batchErrorMessage = `\n\nDetalhes dos erros:\n${failedDetails.join("\n")}`;
        mainMessage = mainMessage ? mainMessage + batchErrorMessage : `Erros na operação em lote:${batchErrorMessage}`;
        errorMessages = [...errorMessages, ...failedDetails];
      }
    }

    // Final validation - ensure we have a meaningful message
    if (!mainMessage && errorData.message) {
      mainMessage = typeof errorData.message === "string" ? errorData.message : "Erro desconhecido";
      errorMessages = [mainMessage];
    }
  }

  // Fallback to error message
  if (!mainMessage && error.message) {
    // For 502 errors, use custom message instead of Axios's default
    if (statusCode === 502) {
      mainMessage = "Servidor indisponivel";
      errorMessages = ["Servidor indisponivel"];
    } else {
      mainMessage = error.message;
      errorMessages = [error.message];
    }
  }

  // Determine error category and retryability
  const { category, isRetryable } = categorizeError(statusCode);

  // Set appropriate title based on status code
  const title = getErrorTitle(statusCode);

  // Enhance message based on status code
  const enhancedMessage = enhanceErrorMessage(mainMessage);

  return {
    title,
    message: enhancedMessage || defaultError.message,
    _statusCode: statusCode,
    errors: errorMessages.length > 0 ? errorMessages : defaultError.errors,
    isRetryable,
    category,
  };
};

const categorizeError = (statusCode: number): { category: ErrorCategory; isRetryable: boolean } => {
  if (statusCode >= 500) {
    return { category: ErrorCategory.SERVER_ERROR, isRetryable: true };
  }

  switch (statusCode) {
    case 400:
    case 422:
      return { category: ErrorCategory.VALIDATION, isRetryable: false };
    case 401:
      return { category: ErrorCategory.AUTHENTICATION, isRetryable: false };
    case 403:
      return { category: ErrorCategory.AUTHORIZATION, isRetryable: false };
    case 404:
      return { category: ErrorCategory.NOT_FOUND, isRetryable: false };
    case 408:
      return { category: ErrorCategory.TIMEOUT, isRetryable: true };
    case 409:
      return { category: ErrorCategory.CONFLICT, isRetryable: false };
    case 429:
      return { category: ErrorCategory.RATE_LIMIT, isRetryable: true };
    default:
      return { category: ErrorCategory.UNKNOWN, isRetryable: false };
  }
};

const getErrorTitle = (statusCode: number): string => {
  const titleMap: Record<number, string> = {
    400: "Dados Inválidos",
    401: "Não Autorizado",
    403: "Acesso Negado",
    404: "Não Encontrado",
    408: "Tempo Esgotado",
    409: "Conflito",
    422: "Dados Inválidos",
    429: "Muitas Tentativas",
    500: "Erro Interno",
    502: "Serviço Indisponível",
    503: "Serviço Indisponível",
    504: "Tempo Esgotado",
  };

  return titleMap[statusCode] || "Erro";
};

const enhanceErrorMessage = (message: string): string => {
  if (!message) return "";

  // Return message as is - backend already provides Portuguese messages
  return message;
};

// =====================
// Main API Client Instance (SINGLETON)
// =====================

// CRITICAL: Force single axios instance with lazy initialization
let singletonInstance: ExtendedAxiosInstance | null = null;

// Lazy initialization function - creates instance only when first accessed
const getSingletonInstance = (): ExtendedAxiosInstance => {
  // Return existing instance if already created
  if (singletonInstance) {
    return singletonInstance;
  }

  // Only create instance in browser environment
  if (typeof (globalThis as any).window === "undefined") {
    throw new Error("[AXIOS SINGLETON] Cannot create API client in non-browser environment");
  }

  if (process.env.NODE_ENV !== 'production') {
    console.log("[AXIOS SINGLETON] Creating THE ONLY instance (lazy initialization)");
  }
  singletonInstance = createApiClient({
    tokenProvider: async () => {
      // Try all possible token sources in order of preference
      let token = null;

      // 1. Try the global token provider first (this is what auth context sets)
      if (globalTokenProvider) {
        try {
          token = await globalTokenProvider();
        } catch (e) {}
      }

      // 2. Direct localStorage check with proper key as fallback
      if (!token) {
        // CRITICAL: Use the correct key with prefix!
        const localToken = safeLocalStorage.getItem("ankaa_token");
        if (localToken) {
          token = localToken;
        }
      }

      // 3. Check global window token as last resort
      if (!token && typeof (globalThis as any).window !== "undefined" && (globalThis as any).window.__ANKAA_AUTH_TOKEN__) {
        token = (globalThis as any).window.__ANKAA_AUTH_TOKEN__;
      }

      return token;
    },
  });

  // Mark instance
  (singletonInstance as any).__instanceId = "THE-SINGLETON";

  // Store globally for debugging
  (globalThis as any).window.__ANKAA_API_CLIENT__ = singletonInstance;
  if (process.env.NODE_ENV !== 'production') {
    console.log("[AXIOS SINGLETON] THE singleton created with ID:", (singletonInstance as any).__instanceId);
  }

  return singletonInstance;
};

// Export a proxy that ensures lazy initialization
export const apiClient = new Proxy({} as ExtendedAxiosInstance, {
  get(_target, prop) {
    const instance = getSingletonInstance();
    const value = (instance as any)[prop];

    // If the property is a function, bind it to the instance
    if (typeof value === "function") {
      return value.bind(instance);
    }

    return value;
  },
  set(_target, prop, value) {
    const instance = getSingletonInstance();
    (instance as any)[prop] = value;
    return true;
  },
});

// Export axios itself for cancel token usage
export { axios };

// Add a verification function to ensure the singleton is properly initialized
export const verifyApiClient = (): void => {
  if (process.env.NODE_ENV !== 'production') {
    console.log("[API CLIENT] Verifying apiClient...");
    console.log("[API CLIENT] apiClient exists:", !!apiClient);
    console.log("[API CLIENT] apiClient instance ID:", (apiClient as any)?.__instanceId);
    console.log("[API CLIENT] apiClient baseURL:", apiClient?.defaults?.baseURL);
    console.log("[API CLIENT] apiClient Authorization header:", apiClient?.defaults?.headers?.common?.Authorization);
  }
};

// =====================
// Token Management
// =====================

// Storage for the token provider to be used by the default apiClient
let globalTokenProvider: (() => string | null | Promise<string | null>) | undefined;

// Global authentication error handler
let globalAuthErrorHandler: ((error: { statusCode: number; message: string; category: ErrorCategory }) => void) | undefined;

export const setAuthToken = (token: string | null): void => {
  // Get the singleton instance (lazy initialization)
  const instance = getSingletonInstance();

  if (token) {
    // Ensure headers object exists
    if (!instance.defaults.headers) {
      instance.defaults.headers = {} as any;
    }
    if (!instance.defaults.headers.common) {
      instance.defaults.headers.common = {} as any;
    }

    instance.defaults.headers.common["Authorization"] = `Bearer ${token}`;

    // ALSO store in localStorage and global for fallback
    safeLocalStorage.setItem("ankaa_token", token);
    if (typeof (globalThis as any).window !== "undefined") {
      (globalThis as any).window.__ANKAA_AUTH_TOKEN__ = token;
    }
  } else {
    if (instance.defaults.headers?.common) {
      delete instance.defaults.headers.common["Authorization"];
      if (process.env.NODE_ENV !== 'production') {
        console.log("[API CLIENT] Token cleared from THE singleton headers");
      }
    }

    // ALSO clear from localStorage and global
    safeLocalStorage.removeItem("ankaa_token");
    if (typeof (globalThis as any).window !== "undefined") {
      delete (globalThis as any).window.__ANKAA_AUTH_TOKEN__;
    }
  }
};

// Set a token provider function that will be called for each request
export const setTokenProvider = (provider: () => string | null | Promise<string | null>): void => {
  if (process.env.NODE_ENV !== 'production') {
    console.log("[API CLIENT] Setting token provider globally");
  }
  globalTokenProvider = provider;

  // Only set on instance if it's already created (don't force creation)
  if (singletonInstance) {
    (singletonInstance as any).__tokenProvider = provider;
    if (process.env.NODE_ENV !== 'production') {
      console.log("[API CLIENT] Token provider set on THE singleton");
    }
  }
};

// Get the current token provider
export const getTokenProvider = (): (() => string | null | Promise<string | null>) | undefined => {
  return globalTokenProvider;
};

// Set authentication error handler that will be called on 401/403 errors
export const setAuthErrorHandler = (handler: (error: { statusCode: number; message: string; category: ErrorCategory }) => void): void => {
  globalAuthErrorHandler = handler;
};

// Remove authentication error handler
export const removeAuthErrorHandler = (): void => {
  globalAuthErrorHandler = undefined;
};

// Get the current auth error handler
export const getAuthErrorHandler = (): ((error: { statusCode: number; message: string; category: ErrorCategory }) => void) | undefined => {
  return globalAuthErrorHandler;
};

// Update the API URL dynamically
export const updateApiUrl = (url: string): void => {
  const newBaseUrl = url; // No /api suffix - using subdomain architecture

  // First, set the window variable for future instances (web environment only)
  if (typeof (globalThis as any).window !== "undefined") {
    (globalThis as any).window.__ANKAA_API_URL__ = url;
  }

  // Only update instance if it's already created (don't force creation)
  if (singletonInstance) {
    singletonInstance.defaults.baseURL = newBaseUrl;
    if (process.env.NODE_ENV !== 'production') {
      console.log("[API CLIENT] API URL updated");
    }
  }
};

// Mark that we just logged in (used to handle race conditions)
export const setJustLoggedIn = (): void => {
  // Only set on instance if it's already created (don't force creation)
  if (singletonInstance) {
    (singletonInstance as any).__justLoggedIn = true;
    // Clear it after a short delay
    setTimeout(() => {
      if (singletonInstance) {
        delete (singletonInstance as any).__justLoggedIn;
      }
    }, 2000);
  }
};

// Force refresh token on all requests
export const forceTokenRefresh = (token: string): void => {
  // Get the singleton instance (lazy initialization)
  const instance = getSingletonInstance();

  if (instance && instance.defaults && instance.defaults.headers) {
    instance.defaults.headers.common["Authorization"] = `Bearer ${token}`;
    if (process.env.NODE_ENV !== 'production') {
      console.log("[API CLIENT] Forced token refresh on THE singleton");
    }

    // ALSO update localStorage and global
    safeLocalStorage.setItem("ankaa_token", token);
    if (typeof (globalThis as any).window !== "undefined") {
      (globalThis as any).window.__ANKAA_AUTH_TOKEN__ = token;
    }
  }
};

// =====================
// Utility Functions
// =====================

export const createCustomApiClient = (config: Partial<ApiClientConfig>): ExtendedAxiosInstance => {
  return createApiClient(config);
};

export const cancelAllRequests = (): void => {
  apiClient.cancelAllRequests?.();
};

export const clearApiCache = (): void => {
  apiClient.clearCache?.();
};

// =====================
// Enhanced HTTP Methods with Better Type Support
// =====================

export const httpGet = <TResponse = unknown>(url: string, config?: AxiosRequestConfig): Promise<AxiosResponse<TResponse>> => {
  return apiClient.get<TResponse>(url, config);
};

export const httpPost = <TResponse = unknown, TData = unknown>(url: string, data?: TData, config?: AxiosRequestConfig): Promise<AxiosResponse<TResponse>> => {
  return apiClient.post<TResponse>(url, data, config);
};

export const httpPut = <TResponse = unknown, TData = unknown>(url: string, data?: TData, config?: AxiosRequestConfig): Promise<AxiosResponse<TResponse>> => {
  return apiClient.put<TResponse>(url, data, config);
};

export const httpPatch = <TResponse = unknown, TData = unknown>(url: string, data?: TData, config?: AxiosRequestConfig): Promise<AxiosResponse<TResponse>> => {
  return apiClient.patch<TResponse>(url, data, config);
};

export const httpDelete = <TResponse = unknown>(url: string, config?: AxiosRequestConfig): Promise<AxiosResponse<TResponse>> => {
  return apiClient.delete<TResponse>(url, config);
};

// =====================
// Export Types
// =====================

export type { ApiSuccessResponse, ApiErrorResponse, ApiPaginatedResponse, ApiClientConfig, ErrorInfo, ErrorCategory, RequestMetadata };
