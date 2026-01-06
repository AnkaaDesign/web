import { useCallback, useRef, useEffect, useState, useMemo } from "react";
import { useSearchParams, useNavigate, useLocation } from "react-router-dom";
import { z } from "zod";
import type { UrlStateBase, UrlStateConfiguration, UrlFieldConfig, UrlParamValue, PartialUrlState, SerializedUrlState } from "../types/url-state-types";

export type UrlUpdateAction = "pagination" | "sorting" | "selection" | "filter" | "search" | "form" | "navigation" | "batch" | "restore";

export interface UrlUpdate<T = any> {
  id: string;
  action: UrlUpdateAction;
  updater: (params: URLSearchParams) => void;
  priority: number;
  timestamp: number;
  immediate?: boolean;
  conflictsWith?: UrlUpdateAction[];
  metadata?: {
    keys?: (keyof T)[];
    source?: string;
    version?: number;
  };
}

export interface StateSnapshot<T> {
  id: string;
  timestamp: number;
  state: Partial<T>;
  url: string;
  source: "programmatic" | "navigation" | "restore";
}

export interface NavigationEvent {
  type: "popstate" | "pushstate" | "replacestate";
  url: string;
  timestamp: number;
}

export interface UseUrlStateCoordinatorOptions<T extends UrlStateBase> {
  // Type configuration
  config?: UrlStateConfiguration<T>;
  schema?: z.ZodSchema<Partial<T>>;

  // Debouncing configuration
  debounceMs?: Partial<Record<UrlUpdateAction, number>>;

  // Namespacing
  namespace?: string;

  // Browser navigation
  enableNavigationTracking?: boolean;
  preventNavigationConflicts?: boolean;
  enableBrowserHistorySync?: boolean;
  maxQueueSize?: number;

  // State persistence
  enableStatePersistence?: boolean;
  persistenceKey?: string;
  maxHistorySize?: number;

  // Validation and error handling
  enableValidation?: boolean;
  onValidationError?: (errors: z.ZodError, state: Partial<T>) => void;
  onNavigationConflict?: (event: NavigationEvent, currentState: Partial<T>) => void;
  onError?: (error: Error, context: { action: UrlUpdateAction; key?: string }) => void;

  // Performance
  enableOptimisticUpdates?: boolean;
  batchUpdateThreshold?: number;

  // Callbacks
  onStateChange?: (state: Partial<T>, previous: Partial<T>) => void;
  onUrlChange?: (url: string, state: Partial<T>) => void;
}

const DEFAULT_DEBOUNCE: Record<UrlUpdateAction, number> = {
  search: 150,
  filter: 50,
  pagination: 0,
  sorting: 0,
  selection: 25,
  form: 100,
  navigation: 0,
  batch: 0,
  restore: 0,
};

const DEFAULT_OPTIONS = {
  debounceMs: DEFAULT_DEBOUNCE,
  enableNavigationTracking: true,
  preventNavigationConflicts: true,
  enableBrowserHistorySync: true,
  enableStatePersistence: true,
  maxHistorySize: 50,
  maxQueueSize: 50,
  enableValidation: true,
  enableOptimisticUpdates: true,
  batchUpdateThreshold: 3,
};

export function useUrlStateCoordinator<T extends UrlStateBase>(options: UseUrlStateCoordinatorOptions<T> = {}) {
  const {
    config,
    schema,
    debounceMs = DEFAULT_DEBOUNCE,
    namespace,
    enableNavigationTracking = true,
    preventNavigationConflicts = true,
    enableBrowserHistorySync = true,
    enableStatePersistence = true,
    persistenceKey,
    maxHistorySize = 50,
    maxQueueSize = 50,
    enableValidation = true,
    enableOptimisticUpdates = true,
    batchUpdateThreshold = 3,
    onValidationError,
    onNavigationConflict,
    onError,
    onStateChange,
    onUrlChange,
  } = { ...DEFAULT_OPTIONS, ...options };

  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const location = useLocation();

  // State management
  const [optimisticState, setOptimisticState] = useState<Partial<T>>({});
  const [isNavigating, setIsNavigating] = useState(false);
  const [stateVersion, setStateVersion] = useState(0);

  // Refs for coordination
  const updateQueueRef = useRef<UrlUpdate<T>[]>([]);
  const processingRef = useRef(false);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const updateIdCounter = useRef(0);
  const historyRef = useRef<StateSnapshot<T>[]>([]);
  const navigationListenerRef = useRef<(() => void) | null>(null);
  const lastProcessedUrlRef = useRef<string>("");
  const validationErrorsRef = useRef<z.ZodError | null>(null);
  const lastUrlStateRef = useRef<string>("");
  const isNavigatingRef = useRef(false);

  // Generate unique storage key
  const storageKey = useMemo(() => {
    const baseKey = persistenceKey || `url-state-${namespace || "default"}`;
    return `${baseKey}-${location.pathname}`;
  }, [persistenceKey, namespace, location.pathname]);

  // ====================================
  // Type-Safe State Utilities
  // ====================================

  /**
   * Parse URL parameters to typed state
   */
  const parseUrlState = useCallback(
    (params: URLSearchParams): Partial<T> => {
      if (!config) return {} as Partial<T>;

      const state: Partial<T> = {};

      try {
        for (const [key, fieldConfig] of Object.entries(config) as [keyof T, UrlFieldConfig<T[keyof T]>][]) {
          const paramKey = namespace ? `${namespace}_${String(key)}` : String(key);
          const rawValue = params.get(paramKey);

          if (rawValue !== null) {
            if (fieldConfig.parser) {
              try {
                state[key] = fieldConfig.parser(rawValue);
              } catch (error) {
                onError?.(error as Error, { action: "filter", key: String(key) });
                if (fieldConfig.defaultValue !== undefined) {
                  state[key] = fieldConfig.defaultValue;
                }
              }
            } else {
              state[key] = rawValue as T[keyof T];
            }
          } else if (fieldConfig.defaultValue !== undefined) {
            state[key] = fieldConfig.defaultValue;
          }
        }

        // Validate with schema if provided
        if (enableValidation && schema) {
          const result = schema.safeParse(state);
          if (!result.success) {
            validationErrorsRef.current = result.error;
            onValidationError?.(result.error, state);

            // Use default values for invalid fields
            for (const issue of result.error.issues) {
              const path = issue.path[0] as keyof T;
              if (path && config[path]?.defaultValue !== undefined) {
                state[path] = config[path].defaultValue;
              }
            }
          } else {
            validationErrorsRef.current = null;
          }
        }

        return state;
      } catch (error) {
        onError?.(error as Error, { action: "filter" });
        return {} as Partial<T>;
      }
    },
    [config, namespace, enableValidation, schema, onValidationError, onError],
  );

  /**
   * Serialize typed state to URL parameters
   */
  const serializeUrlState = useCallback(
    (state: Partial<T>): URLSearchParams => {
      const params = new URLSearchParams();

      if (!config) return params;

      try {
        for (const [key, value] of Object.entries(state) as [keyof T, T[keyof T]][]) {
          if (value === undefined || value === null) continue;

          const fieldConfig = config[key];
          if (!fieldConfig) continue;

          const paramKey = namespace ? `${namespace}_${String(key)}` : String(key);

          if (fieldConfig.serializer) {
            try {
              const serializedValue = fieldConfig.serializer(value);
              if (serializedValue !== "") {
                params.set(paramKey, serializedValue);
              }
            } catch (error) {
              onError?.(error as Error, { action: "filter", key: String(key) });
            }
          } else if (value !== fieldConfig.defaultValue) {
            params.set(paramKey, String(value));
          }
        }

        return params;
      } catch (error) {
        onError?.(error as Error, { action: "filter" });
        return new URLSearchParams();
      }
    },
    [config, namespace, onError],
  );

  // ====================================
  // Current State Management
  // ====================================

  /**
   * Get current state from URL and optimistic updates
   */
  const currentState = useMemo(() => {
    const urlState = parseUrlState(searchParams);

    if (enableOptimisticUpdates) {
      return { ...urlState, ...optimisticState };
    }

    return urlState;
  }, [searchParams, optimisticState, enableOptimisticUpdates, parseUrlState]);

  /**
   * Get a specific parameter value with type safety
   */
  const getParam = useCallback(
    <K extends keyof T>(
      key: K,
      options?: {
        useOptimistic?: boolean;
        fallback?: T[K];
      },
    ): T[K] | undefined => {
      const { useOptimistic = enableOptimisticUpdates, fallback } = options || {};

      if (useOptimistic && optimisticState[key] !== undefined) {
        return optimisticState[key];
      }

      const state = parseUrlState(searchParams);
      return state[key] ?? fallback;
    },
    [searchParams, optimisticState, enableOptimisticUpdates, parseUrlState],
  );

  // ====================================
  // Browser Navigation Handling
  // ====================================

  /**
   * Handle browser navigation events
   */
  const handleNavigationEvent = useCallback(
    (event: PopStateEvent) => {
      if (!enableNavigationTracking) return;

      setIsNavigating(true);
      isNavigatingRef.current = true;

      const navigationEvent: NavigationEvent = {
        type: "popstate",
        url: window.location.href,
        timestamp: Date.now(),
      };

      const newState = parseUrlState(new URLSearchParams(window.location.search));

      if (preventNavigationConflicts && updateQueueRef.current.length > 0) {
        onNavigationConflict?.(navigationEvent, newState);
        // Cancel pending updates to prevent conflicts
        cancelPendingUpdates();
      }

      // Clear any pending updates to prevent conflicts
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
      updateQueueRef.current = [];

      // Update optimistic state if enabled
      if (enableOptimisticUpdates) {
        setOptimisticState({});
      }

      setStateVersion((prev) => prev + 1);

      // Reset navigation flag after a short delay
      setTimeout(() => {
        setIsNavigating(false);
        isNavigatingRef.current = false;
      }, 100);

      onUrlChange?.(navigationEvent.url, newState);
    },
    [enableNavigationTracking, preventNavigationConflicts, enableOptimisticUpdates, parseUrlState, onNavigationConflict, onUrlChange],
  );

  // ====================================
  // State Persistence
  // ====================================

  /**
   * Save state snapshot to history
   */
  const saveStateSnapshot = useCallback(
    (state: Partial<T>, source: StateSnapshot<T>["source"] = "programmatic") => {
      if (!enableStatePersistence) return;

      const snapshot: StateSnapshot<T> = {
        id: `snapshot_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        timestamp: Date.now(),
        state: { ...state },
        url: window.location.href,
        source,
      };

      historyRef.current.push(snapshot);

      // Limit history size
      if (historyRef.current.length > maxHistorySize) {
        historyRef.current = historyRef.current.slice(-maxHistorySize);
      }

      // Persist to localStorage
      try {
        localStorage.setItem(storageKey, JSON.stringify(historyRef.current));
      } catch (error) {
        onError?.(error as Error, { action: "restore" });
      }
    },
    [enableStatePersistence, maxHistorySize, storageKey, onError],
  );

  /**
   * Restore state from persistence
   */
  const restoreState = useCallback(
    (snapshotId?: string) => {
      if (!enableStatePersistence) return false;

      try {
        const stored = localStorage.getItem(storageKey);
        if (!stored) return false;

        const history: StateSnapshot<T>[] = JSON.parse(stored);
        historyRef.current = history;

        const snapshot = snapshotId ? history.find((s) => s.id === snapshotId) : history[history.length - 1];

        if (!snapshot) return false;

        // Apply the restored state
        const serializedParams = serializeUrlState(snapshot.state);
        setSearchParams(serializedParams, { replace: true });

        if (enableOptimisticUpdates) {
          setOptimisticState(snapshot.state);
        }

        setStateVersion((prev) => prev + 1);
        return true;
      } catch (error) {
        onError?.(error as Error, { action: "restore" });
        return false;
      }
    },
    [enableStatePersistence, storageKey, serializeUrlState, setSearchParams, enableOptimisticUpdates, onError],
  );

  /**
   * Clear state history
   */
  const clearStateHistory = useCallback(() => {
    historyRef.current = [];
    try {
      localStorage.removeItem(storageKey);
    } catch (error) {
      onError?.(error as Error, { action: "restore" });
    }
  }, [storageKey, onError]);

  // Browser navigation handling
  useEffect(() => {
    if (!enableBrowserHistorySync && !enableNavigationTracking) return;

    const handleBeforeUnload = () => {
      // Process any pending updates before page unload
      if (updateQueueRef.current.length > 0) {
        processQueue();
      }
    };

    // Track URL changes to detect conflicts
    const handleUrlChange = () => {
      const currentUrl = window.location.search;
      if (currentUrl !== lastUrlStateRef.current && !isNavigatingRef.current) {
        // URL changed externally, clear queue to prevent conflicts
        updateQueueRef.current = [];
        lastUrlStateRef.current = currentUrl;
      }
    };

    window.addEventListener("popstate", handleNavigationEvent);
    window.addEventListener("beforeunload", handleBeforeUnload);

    // Check for URL changes periodically (for hash routing compatibility)
    const urlCheckInterval = setInterval(handleUrlChange, 100);

    return () => {
      window.removeEventListener("popstate", handleNavigationEvent);
      window.removeEventListener("beforeunload", handleBeforeUnload);
      clearInterval(urlCheckInterval);

      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [enableBrowserHistorySync, enableNavigationTracking, handleNavigationEvent, processQueue]);

  // ====================================
  // Update Queue Processing
  // ====================================

  /**
   * Process all queued updates in a single batch
   */
  const processQueue = useCallback(() => {
    if (processingRef.current || updateQueueRef.current.length === 0) {
      return;
    }

    processingRef.current = true;

    try {
      // Prevent processing if we're in the middle of navigation
      if (isNavigatingRef.current) {
        processingRef.current = false;
        return;
      }

      const previousState = currentState;

      // Sort updates by priority and timestamp
      const sortedUpdates = [...updateQueueRef.current].sort((a, b) => {
        if (a.priority !== b.priority) {
          return b.priority - a.priority;
        }
        return a.timestamp - b.timestamp;
      });

      // Resolve conflicts
      const finalUpdates = resolveConflicts(sortedUpdates);

      // Apply all updates to a single URLSearchParams instance
      setSearchParams(
        (prev) => {
          const newParams = new URLSearchParams(prev);
          const processedParams = new Set<string>();

          finalUpdates.forEach((update) => {
            try {
              const tempParams = new URLSearchParams(newParams);
              update.updater(tempParams);

              // Merge changes efficiently
              for (const [key, value] of tempParams) {
                if (!processedParams.has(key)) {
                  newParams.delete(key);
                  newParams.set(key, value);
                  processedParams.add(key);
                }
              }
            } catch (error) {
              if (process.env.NODE_ENV !== 'production') {
                console.warn(`Failed to apply URL update for action ${update.action}:`, error);
              }
            }
          });

          // Update version and notify
          setStateVersion((prev) => prev + 1);
          lastProcessedUrlRef.current = newParams.toString();
          lastUrlStateRef.current = newParams.toString();

          return newParams;
        },
        { replace: true },
      );

      // Clear optimistic state after successful update
      if (enableOptimisticUpdates) {
        setOptimisticState({});
      }

      // Save state snapshot
      const newState = parseUrlState(new URLSearchParams(lastProcessedUrlRef.current));
      saveStateSnapshot(newState, "programmatic");

      // Notify state change
      onStateChange?.(newState, previousState);
      onUrlChange?.(window.location.href, newState);

      updateQueueRef.current = [];
    } finally {
      processingRef.current = false;
    }
  }, [currentState, setSearchParams, enableOptimisticUpdates, parseUrlState, saveStateSnapshot, onStateChange, onUrlChange]);

  /**
   * Resolve conflicts between updates
   */
  const resolveConflicts = useCallback((updates: UrlUpdate<T>[]): UrlUpdate<T>[] => {
    const resolvedUpdates: UrlUpdate<T>[] = [];
    const processedActions = new Set<UrlUpdateAction>();

    for (const update of updates) {
      // Check for conflicts
      const hasConflict = update.conflictsWith?.some((action) => processedActions.has(action));

      if (!hasConflict) {
        resolvedUpdates.push(update);
        processedActions.add(update.action);
      } else {
        // Handle conflict by merging or skipping
        if (process.env.NODE_ENV !== 'production') {
          console.warn(`URL update conflict detected for action ${update.action}, skipping...`);
        }
      }
    }

    return resolvedUpdates;
  }, []);

  /**
   * Schedule an update with appropriate debouncing
   */
  const scheduleUpdate = useCallback(
    (action: UrlUpdateAction) => {
      const delay = debounceMs[action] ?? DEFAULT_DEBOUNCE[action] ?? 0;

      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }

      if (delay === 0) {
        processQueue();
      } else {
        timeoutRef.current = setTimeout(() => {
          processQueue();
          timeoutRef.current = null;
        }, delay);
      }
    },
    [debounceMs, processQueue],
  );

  // ====================================
  // Public API Methods
  // ====================================

  /**
   * Queue a URL update with coordination
   */
  const queueUpdate = useCallback(
    (
      updater: (params: URLSearchParams) => void,
      action: UrlUpdateAction = "filter",
      options?: {
        priority?: number;
        optimistic?: Partial<T>;
        metadata?: UrlUpdate<T>["metadata"];
        immediate?: boolean;
        conflictsWith?: UrlUpdateAction[];
      },
    ) => {
      const { priority = getPriorityForAction(action), optimistic, metadata, immediate = false, conflictsWith = [] } = options || {};

      // Prevent queue overflow
      if (updateQueueRef.current.length >= maxQueueSize) {
        if (process.env.NODE_ENV !== 'production') {
          console.warn(`URL update queue is full (${maxQueueSize} items), clearing old updates`);
        }
        updateQueueRef.current = updateQueueRef.current.slice(-maxQueueSize / 2);
      }

      const update: UrlUpdate<T> = {
        id: `${namespace || "global"}_${action}_${++updateIdCounter.current}`,
        action,
        updater,
        priority,
        timestamp: Date.now(),
        immediate,
        conflictsWith,
        metadata,
      };

      // Apply optimistic update immediately if provided
      if (enableOptimisticUpdates && optimistic) {
        setOptimisticState((prev) => ({ ...prev, ...optimistic }));
      }

      // Remove conflicting updates for non-cumulative actions
      if (!isCumulativeAction(action)) {
        updateQueueRef.current = updateQueueRef.current.filter((u) => u.action !== action || u.metadata?.keys?.some((key) => metadata?.keys?.includes(key)) === false);
      }

      updateQueueRef.current.push(update);

      if (immediate) {
        processQueue();
      } else {
        scheduleUpdate(action);
      }
    },
    [namespace, enableOptimisticUpdates, scheduleUpdate, processQueue, maxQueueSize],
  );

  /**
   * Set a typed parameter value
   */
  const setParam = useCallback(
    <K extends keyof T>(
      key: K,
      value: T[K] | undefined,
      options?: {
        action?: UrlUpdateAction;
        priority?: number;
        immediate?: boolean;
        optimistic?: boolean;
      },
    ) => {
      const { action = "filter", priority, immediate = false, optimistic = enableOptimisticUpdates } = options || {};

      const fieldConfig = config?.[key];
      const paramKey = getParamName(key);

      // Apply optimistic update
      if (optimistic) {
        setOptimisticState((prev) => ({ ...prev, [key]: value }));
      }

      const updater = (params: URLSearchParams) => {
        if (value === undefined || value === null || value === fieldConfig?.defaultValue) {
          params.delete(paramKey);
        } else {
          const serializedValue = fieldConfig?.serializer ? fieldConfig.serializer(value) : String(value);

          if (serializedValue !== "") {
            params.set(paramKey, serializedValue);
          } else {
            params.delete(paramKey);
          }
        }
      };

      if (immediate) {
        const newParams = new URLSearchParams(searchParams);
        updater(newParams);
        setSearchParams(newParams, { replace: true });

        if (optimistic) {
          setOptimisticState({});
        }
      } else {
        queueUpdate(updater, action, {
          priority,
          optimistic: optimistic ? ({ [key]: value } as Partial<T>) : undefined,
          metadata: { keys: [key], source: "setParam" },
        });
      }
    },
    [config, getParamName, enableOptimisticUpdates, searchParams, setSearchParams, queueUpdate],
  );

  /**
   * Set multiple parameters at once
   */
  const setParams = useCallback(
    (
      updates: Partial<T>,
      options?: {
        action?: UrlUpdateAction;
        priority?: number;
        immediate?: boolean;
        optimistic?: boolean;
      },
    ) => {
      const { action = "batch", priority, immediate = false, optimistic = enableOptimisticUpdates } = options || {};

      // Apply optimistic update
      if (optimistic) {
        setOptimisticState((prev) => ({ ...prev, ...updates }));
      }

      const updater = (params: URLSearchParams) => {
        for (const [key, value] of Object.entries(updates) as [keyof T, T[keyof T]][]) {
          const fieldConfig = config?.[key];
          const paramKey = getParamName(key);

          if (value === undefined || value === null || value === fieldConfig?.defaultValue) {
            params.delete(paramKey);
          } else {
            const serializedValue = fieldConfig?.serializer ? fieldConfig.serializer(value) : String(value);

            if (serializedValue !== "") {
              params.set(paramKey, serializedValue);
            } else {
              params.delete(paramKey);
            }
          }
        }
      };

      if (immediate) {
        const newParams = new URLSearchParams(searchParams);
        updater(newParams);
        setSearchParams(newParams, { replace: true });

        if (optimistic) {
          setOptimisticState({});
        }
      } else {
        queueUpdate(updater, action, {
          priority,
          optimistic: optimistic ? updates : undefined,
          metadata: {
            keys: Object.keys(updates) as (keyof T)[],
            source: "setParams",
          },
        });
      }
    },
    [config, getParamName, enableOptimisticUpdates, searchParams, setSearchParams, queueUpdate],
  );

  /**
   * Batch multiple updates together
   */
  const batchUpdates = useCallback(
    (
      updates: Array<{
        updater: (params: URLSearchParams) => void;
        action?: UrlUpdateAction;
        optimistic?: Partial<T>;
      }>,
    ) => {
      const combinedOptimistic: Partial<T> = {};

      updates.forEach(({ updater, action = "batch", optimistic }, index) => {
        const update: UrlUpdate<T> = {
          id: `${namespace || "global"}_batch_${++updateIdCounter.current}`,
          action: "batch",
          updater,
          priority: 100 + index, // Ensure order within batch
          timestamp: Date.now(),
          metadata: { source: "batchUpdates" },
        };

        if (optimistic) {
          Object.assign(combinedOptimistic, optimistic);
        }

        updateQueueRef.current.push(update);
      });

      // Apply combined optimistic update
      if (enableOptimisticUpdates && Object.keys(combinedOptimistic).length > 0) {
        setOptimisticState((prev) => ({ ...prev, ...combinedOptimistic }));
      }

      scheduleUpdate("batch");
    },
    [namespace, enableOptimisticUpdates, scheduleUpdate],
  );

  /**
   * Reset specific parameters to their default values
   */
  const resetParams = useCallback(
    (keys?: (keyof T)[], options?: { action?: UrlUpdateAction; immediate?: boolean }) => {
      const { action = "filter", immediate = false } = options || {};

      if (!config) return;

      const keysToReset = keys || (Object.keys(config) as (keyof T)[]);
      const resetState: Partial<T> = {};

      keysToReset.forEach((key) => {
        const fieldConfig = config[key];
        if (fieldConfig?.defaultValue !== undefined) {
          resetState[key] = fieldConfig.defaultValue;
        }
      });

      setParams(resetState, { action, immediate });
    },
    [config, setParams],
  );

  /**
   * Clear all parameters
   */
  const clearParams = useCallback(
    (options?: { action?: UrlUpdateAction; immediate?: boolean }) => {
      const { action = "filter", immediate = false } = options || {};

      const updater = (params: URLSearchParams) => {
        if (namespace) {
          // Clear only namespaced parameters
          for (const [key] of params) {
            if (key.startsWith(`${namespace}_`)) {
              params.delete(key);
            }
          }
        } else {
          // Clear all parameters
          params.forEach((_, key) => params.delete(key));
        }
      };

      if (immediate) {
        const newParams = new URLSearchParams(searchParams);
        updater(newParams);
        setSearchParams(newParams, { replace: true });

        if (enableOptimisticUpdates) {
          setOptimisticState({});
        }
      } else {
        queueUpdate(updater, action, {
          priority: getPriorityForAction(action),
          metadata: { source: "clearParams" },
        });
      }
    },
    [namespace, searchParams, setSearchParams, enableOptimisticUpdates, queueUpdate],
  );

  /**
   * Cancel all pending updates
   */
  const cancelPendingUpdates = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    updateQueueRef.current = [];

    if (enableOptimisticUpdates) {
      setOptimisticState({});
    }
  }, [enableOptimisticUpdates]);

  /**
   * Generate a shareable URL with current state
   */
  const generateShareableUrl = useCallback(
    (baseUrl?: string, includeOptimistic = false): string => {
      const state = includeOptimistic ? currentState : parseUrlState(searchParams);
      const params = serializeUrlState(state);
      const url = baseUrl || window.location.origin + location.pathname;

      const queryString = params.toString();
      return queryString ? `${url}?${queryString}` : url;
    },
    [currentState, parseUrlState, searchParams, serializeUrlState, location.pathname],
  );

  /**
   * Validate current state
   */
  const validateState = useCallback(
    (state?: Partial<T>): { isValid: boolean; errors: z.ZodError | null } => {
      if (!enableValidation || !schema) {
        return { isValid: true, errors: null };
      }

      const stateToValidate = state || currentState;
      const result = schema.safeParse(stateToValidate);

      return {
        isValid: result.success,
        errors: result.success ? null : result.error,
      };
    },
    [enableValidation, schema, currentState],
  );

  /**
   * Get a namespaced parameter name
   */
  const getParamName = useCallback(
    (baseName: string | keyof T) => {
      const name = String(baseName);
      return namespace ? `${namespace}_${name}` : name;
    },
    [namespace],
  );

  // ====================================
  // Effects
  // ====================================

  // Restore state on mount
  useEffect(() => {
    if (enableStatePersistence) {
      restoreState();
    }
  }, [enableStatePersistence, restoreState]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      navigationListenerRef.current?.();
    };
  }, []);

  // ====================================
  // Return API
  // ====================================

  return {
    // Current state
    searchParams,
    currentState,
    optimisticState,
    isNavigating,
    stateVersion,
    validationErrors: validationErrorsRef.current,

    // Parameter management
    getParam,
    setParam,
    setParams,
    resetParams,
    clearParams,
    getParamName,

    // Update coordination
    queueUpdate,
    batchUpdates,
    cancelPendingUpdates,
    processQueue,

    // State persistence
    saveStateSnapshot,
    restoreState,
    clearStateHistory,
    stateHistory: historyRef.current,

    // Utilities
    generateShareableUrl,
    validateState,
    parseUrlState,
    serializeUrlState,

    // Status
    hasPendingUpdates: updateQueueRef.current.length > 0,
    isProcessing: processingRef.current,
  };
}

// ====================================
// Helper Functions
// ====================================

/**
 * Determine if an action type should accumulate updates or replace them
 */
function isCumulativeAction(action: UrlUpdateAction): boolean {
  return ["selection", "batch", "form"].includes(action);
}

/**
 * Get default priority for an action type
 */
function getPriorityForAction(action: UrlUpdateAction): number {
  switch (action) {
    case "batch":
      return 100;
    case "navigation":
      return 95;
    case "restore":
      return 90;
    case "pagination":
      return 85;
    case "sorting":
      return 80;
    case "filter":
      return 70;
    case "form":
      return 65;
    case "search":
      return 60;
    case "selection":
      return 50;
    default:
      return 0;
  }
}

// ====================================
// Type Exports
// ====================================

export type { UrlUpdate, StateSnapshot, NavigationEvent, UseUrlStateCoordinatorOptions };
