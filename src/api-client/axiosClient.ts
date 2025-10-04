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
  timeout: 30000,
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

        const queryString = qs.stringify(params, {
          arrayFormat: "brackets",
          encode: false,
          serializeDate: (date: Date) => date.toISOString(),
          skipNulls: true,
          addQueryPrefix: false,
          // Use bracket notation for nested objects (e.g., orderBy[name]=asc)
          allowDots: false,
          strictNullHandling: true,
          // Add index format for arrays
          indices: false,
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
      if (finalConfig.enableLogging) {
        console.log(`[AXIOS INTERCEPTOR] Request starting for: ${config.method?.toUpperCase()} ${config.url}`);
        console.log(`[AXIOS INTERCEPTOR] Instance ID: ${(client as any).__instanceId || "unknown"}`);
        console.log(`[AXIOS INTERCEPTOR] Has token provider: ${!!((client as any).__tokenProvider || globalTokenProvider)}`);
      }

      const requestId = generateRequestId();
      const startTime = Date.now();

      // Add request metadata
      const metadata: RequestMetadata = {
        startTime,
        requestId,
        method: config.method?.toUpperCase() || "UNKNOWN",
        url: config.url || "",
        retryCount: 0,
      };

      config.metadata = metadata;

      // Auto-attach token if tokenProvider is configured
      // Check for updated token provider first (set via setTokenProvider)
      const tokenProvider = (client as any).__tokenProvider || globalTokenProvider || finalConfig.tokenProvider;

      if (finalConfig.enableLogging) {
        console.log(`[API CLIENT DEBUG] Request interceptor - URL: ${config.url}, Has tokenProvider: ${!!tokenProvider}`);
        console.log(
          `[API CLIENT DEBUG] Token provider sources - __tokenProvider: ${!!(client as any).__tokenProvider}, globalTokenProvider: ${!!globalTokenProvider}, finalConfig.tokenProvider: ${!!finalConfig.tokenProvider}`,
        );
      }

      // Always check for fresh token, even if Authorization header exists
      if (tokenProvider) {
        try {
          console.log(`[API CLIENT DEBUG] Calling tokenProvider to get token for ${config.url}`);
          const token = await tokenProvider();
          console.log(`[API CLIENT DEBUG] Token provider result: ${token ? `exists (length: ${token.length})` : "null"}`);

          // Also check localStorage directly to debug
          const localStorageToken = safeLocalStorage.getItem("ankaa_token");
          console.log(`[API CLIENT DEBUG] Direct localStorage check - ankaa_token: ${localStorageToken ? `exists (length: ${localStorageToken.length})` : "null"}`);

          // If we have a token, always use the fresh one
          if (token) {
            config.headers.Authorization = `Bearer ${token}`;
            console.log(`[API CLIENT DEBUG] Fresh authorization header set for ${config.url}`);
          } else if (!config.url?.includes("/auth/")) {
            // FALLBACK: If no token from provider, check localStorage directly
            const fallbackToken = safeLocalStorage.getItem("ankaa_token");
            if (fallbackToken) {
              console.warn(`[API CLIENT DEBUG] FALLBACK: Using token from localStorage directly for ${config.url}`);
              config.headers.Authorization = `Bearer ${fallbackToken}`;
            }
            // If no token and not an auth endpoint, check if we just logged in
            if ((client as any).__justLoggedIn) {
              if (finalConfig.enableLogging) {
                console.log("[API CLIENT DEBUG] No token found after login, waiting and retrying...");
              }
              await delay(300);
              const retryToken = await tokenProvider();
              if (retryToken) {
                config.headers.Authorization = `Bearer ${retryToken}`;
              } else {
              }
            } else {
              if (finalConfig.enableLogging) {
                console.log(`[API CLIENT DEBUG] No token available for ${config.url}`);
              }
            }
          }
        } catch (error) {
          // Silently fail if token retrieval fails
          if (finalConfig.enableLogging) {
            console.error("[API CLIENT DEBUG] Failed to retrieve auth token:", error);
          }
        }
      }

      // Add request ID header if enabled
      if (finalConfig.enableRequestId) {
        config.headers["X-Request-ID"] = requestId;
      }

      // Debug logging for batch operations
      if (config.url?.includes("/batch") && config.method?.toLowerCase() === "put") {
        console.log("🔍 BATCH DEBUG: Request interceptor data:");
        console.log("🔍 BATCH DEBUG: config.data type:", Array.isArray(config.data) ? "direct array" : typeof config.data);
        console.log("🔍 BATCH DEBUG: config.data:", config.data);
        if (config.data && typeof config.data === "object" && !Array.isArray(config.data)) {
          // Generic fix for any array field that was serialized as an object
          const fixedData: any = {};
          for (const key in config.data) {
            const value = config.data[key];
            // Check if this looks like an array that was serialized as an object (has numeric keys)
            if (value && typeof value === "object" && !Array.isArray(value)) {
              const keys = Object.keys(value);
              const isNumericKeys = keys.every((k) => /^\d+$/.test(k));
              if (isNumericKeys) {
                console.log(`🔍 BATCH DEBUG: Converting ${key} from object to array`);
                fixedData[key] = Object.values(value);
              } else {
                fixedData[key] = value;
              }
            } else {
              fixedData[key] = value;
            }
          }
          config.data = fixedData;

          // Force proper JSON serialization
          config.data = JSON.parse(JSON.stringify(config.data));
        }
      }

      // Fix array serialization issue for external-withdrawals
      if (config.url?.includes("/external-withdrawals") && config.method?.toLowerCase() === "post") {
        if (config.data && typeof config.data === "object" && !Array.isArray(config.data)) {
          // Fix array serialization issue for items
          if (config.data.items && typeof config.data.items === "object" && !Array.isArray(config.data.items)) {
            console.log("🔍 EXTERNAL WITHDRAWAL DEBUG: Converting items object to array");
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
          if (finalConfig.enableLogging) {
            console.log(`🎯 Cache hit for ${config.method?.toUpperCase()} ${config.url}`);
          }

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
      if (finalConfig.enableLogging) {
        console.log(`🚀 ${metadata.method} ${metadata.url} [${requestId}]`);

        // Additional debugging for customer requests
        if (config.url?.includes("/customers/") && config.method?.toLowerCase() === "get") {
          console.log("[AXIOS DEBUG] Customer GET request:");
          console.log("[AXIOS DEBUG] - URL:", config.url);
          console.log("[AXIOS DEBUG] - Params:", JSON.stringify(config.params, null, 2));
          console.log("[AXIOS DEBUG] - Base URL:", config.baseURL);
          console.log("[AXIOS DEBUG] - Full URL:", config.baseURL + config.url);
        }

        // Additional debugging for batch update requests
        if (config.url?.includes("/batch") && config.method?.toLowerCase() === "put") {
          console.log("=== AXIOS CLIENT LAYER DEBUGGING ===");
          console.log("Step 24 - Axios interceptor request body:", JSON.stringify(config.data, null, 2));
          console.log("Step 25 - Axios interceptor request params:", JSON.stringify(config.params, null, 2));
          console.log("Step 26 - Full axios config:", {
            method: config.method,
            url: config.url,
            baseURL: config.baseURL,
            headers: config.headers,
            timeout: config.timeout,
          });
        }
      }

      return config;
    },
    (error: AxiosError) => {
      if (finalConfig.enableLogging) {
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
      if (finalConfig.enableLogging) {
        const cacheLabel = metadata.isCached ? " (cached)" : "";
        console.log(`✅ ${metadata.method} ${metadata.url} [${requestId}] - ${duration}ms${cacheLabel}`);

        // Debug log for auth endpoints
        if (finalConfig.enableLogging && metadata.url?.includes("/auth/")) {
          console.log("[DEBUG] Auth response data:", response.data);
        }
      }

      // Dismiss any pending retry toasts for this request
      if (finalConfig.enableNotifications && metadata) {
        notify.dismissRetry?.(metadata.url, metadata.method);
      }

      // Show success notification for write operations
      if (finalConfig.enableNotifications && isWriteMethod(config.method)) {
        // Skip notifications for batch operations - they'll be handled by the dialog
        const isBatchOperation = config.url?.includes("/batch");

        if (!isBatchOperation) {
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

        if (finalConfig.enableLogging) {
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
        if (finalConfig.enableLogging) {
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
              if (finalConfig.enableLogging) {
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
            if (finalConfig.enableLogging) {
              console.error("[API CLIENT DEBUG] Token refresh failed:", refreshError);
            }

            // If refresh returns 401, it means the refresh token is also invalid
            // Don't try to refresh again, just proceed to logout
            const refreshStatus = refreshError?.originalError?.response?.status || refreshError?._statusCode;
            if (refreshStatus === 401) {
              if (finalConfig.enableLogging) {
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
        if (finalConfig.enableLogging) {
          console.log(`[API CLIENT DEBUG] Authentication error detected (${errorInfo._statusCode}), calling auth error handler`);
        }

        try {
          globalAuthErrorHandler({
            statusCode: errorInfo._statusCode,
            message: errorInfo.message,
            category: errorInfo.category,
          });
        } catch (handlerError) {
          if (finalConfig.enableLogging) {
            console.error("[API CLIENT DEBUG] Error in auth error handler:", handlerError);
          }
        }
      }

      // Logging
      if (finalConfig.enableLogging) {
        const duration = metadata ? Date.now() - metadata.startTime : 0;
        console.error(`❌ ${metadata?.method || "UNKNOWN"} ${metadata?.url || "UNKNOWN"} [${requestId || "unknown"}] - ${duration}ms`, errorInfo);
      }

      // Show error notification with detailed messages
      if (finalConfig.enableNotifications) {
        // Skip notifications for batch operations - they'll be handled by the dialog
        const isBatchOperation = config?.url?.includes("/batch");
        // Skip notifications for file uploads - they should be handled by upload components
        const isFileUpload = config?.url?.includes("/files/upload");

        if (!isBatchOperation && !isFileUpload) {
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
    // Debug logging to see what we're working with
    if (process.env.NODE_ENV === "development") {
      console.log("🔍 ERROR EXTRACTION DEBUG:");
      console.log("🔍 Full errorData:", JSON.stringify(errorData, null, 2));
    }

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

    if (process.env.NODE_ENV === "development") {
      console.log("🔍 Extraction sources:", extractionSources);
    }

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

      if (process.env.NODE_ENV === "development") {
        console.log("🔍 Selected detailed error:", detailedError);
      }
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

      if (process.env.NODE_ENV === "development") {
        console.log("🔍 Using fallback message:", mainMessage);
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
    mainMessage = error.message;
    errorMessages = [error.message];
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

  console.log("[AXIOS SINGLETON] Creating THE ONLY instance (lazy initialization)");
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
  console.log("[AXIOS SINGLETON] THE singleton created with ID:", (singletonInstance as any).__instanceId);

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
  console.log("[API CLIENT] Verifying apiClient...");
  console.log("[API CLIENT] apiClient exists:", !!apiClient);
  console.log("[API CLIENT] apiClient instance ID:", (apiClient as any)?.__instanceId);
  console.log("[API CLIENT] apiClient baseURL:", apiClient?.defaults?.baseURL);
  console.log("[API CLIENT] apiClient Authorization header:", apiClient?.defaults?.headers?.common?.Authorization);
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
      console.log("[API CLIENT] Token cleared from THE singleton headers");
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
  console.log("[API CLIENT] Setting token provider globally");
  globalTokenProvider = provider;

  // Only set on instance if it's already created (don't force creation)
  if (singletonInstance) {
    (singletonInstance as any).__tokenProvider = provider;
    console.log("[API CLIENT] Token provider set on THE singleton");
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
    console.log("[API CLIENT] Forced token refresh on THE singleton");

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
