/**
 * Analytics Tracking Module
 *
 * Provides event tracking functionality for user analytics.
 * Can be extended to integrate with Google Analytics, Mixpanel, or other services.
 */

export interface AnalyticsEvent {
  category: string;
  action: string;
  label?: string;
  value?: number;
  [key: string]: any;
}

/**
 * Track an event for analytics
 *
 * @param eventName - Name of the event to track
 * @param properties - Event properties and metadata
 */
export const trackEvent = (_eventName: string, _properties: AnalyticsEvent): void => {
  try {
    // TODO: Integrate with analytics service (Google Analytics, Mixpanel, etc.)
    // Example for Google Analytics:
    // if (window.gtag) {
    //   window.gtag('event', eventName, {
    //     event_category: properties.category,
    //     event_label: properties.label,
    //     value: properties.value,
    //     custom_parameters: properties
    //   });
    // }

    // Example for custom analytics service:
    // analyticsService.track(eventName, properties);
  } catch (error) {
    // Silently fail - analytics should never break the app
    if (process.env.NODE_ENV !== 'production') {
      console.warn("Analytics tracking failed:", error);
    }
  }
};

/**
 * Track page view
 *
 * @param pageName - Name of the page
 * @param path - URL path
 * @param additionalData - Additional tracking data
 */
export const trackPageView = (pageName: string, path: string, additionalData?: Record<string, any>): void => {
  trackEvent("page_view", {
    category: "navigation",
    action: "page_view",
    label: pageName,
    page_name: pageName,
    page_path: path,
    ...additionalData,
  });
};

/**
 * Track user action
 *
 * @param action - Action performed by user
 * @param context - Context where action was performed
 * @param metadata - Additional metadata
 */
export const trackUserAction = (action: string, context: string, metadata?: Record<string, any>): void => {
  trackEvent("user_action", {
    category: "user_interaction",
    action: action,
    label: context,
    ...metadata,
  });
};

/**
 * Track performance metrics
 *
 * @param metric - Name of the performance metric
 * @param value - Value of the metric (typically in milliseconds)
 * @param context - Context where metric was measured
 */
export const trackPerformance = (metric: string, value: number, context: string): void => {
  trackEvent("performance", {
    category: "performance",
    action: metric,
    label: context,
    value: value,
    performance_metric: metric,
    performance_value: value,
    performance_context: context,
  });
};

/**
 * Track errors for debugging and monitoring
 *
 * @param error - Error object or message
 * @param context - Context where error occurred
 * @param severity - Error severity level
 */
export const trackError = (error: Error | string, context: string, severity: "low" | "medium" | "high" | "critical" = "medium"): void => {
  const errorMessage = error instanceof Error ? error.message : error;
  const errorStack = error instanceof Error ? error.stack : undefined;

  trackEvent("error", {
    category: "error",
    action: "error_occurred",
    label: context,
    error_message: errorMessage,
    error_stack: errorStack,
    error_context: context,
    error_severity: severity,
  });
};

/**
 * Initialize analytics service
 * Call this on app startup to set up analytics tracking
 */
export const initializeAnalytics = (): void => {
  // Initialize analytics service here// Track app initialization
  trackEvent("app_initialized", {
    category: "app_lifecycle",
    action: "initialize",
    label: "app_start",
    timestamp: new Date().toISOString(),
  });
};
