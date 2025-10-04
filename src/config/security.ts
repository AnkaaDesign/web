/**
 * Security configuration for the Ankaa web application
 * This file defines security-related settings for the frontend
 */

export interface SecurityConfig {
  csp: {
    enabled: boolean;
    reportOnly: boolean;
    reportUri: string;
  };
  https: {
    enforced: boolean;
    hsts: boolean;
  };
  headers: {
    xFrameOptions: string;
    xContentTypeOptions: boolean;
    referrerPolicy: string;
  };
}

// Function to get security config dynamically
export const getSecurityConfig = (): SecurityConfig => {
  const isDev = (typeof import.meta !== "undefined" && import.meta.env.DEV) || false;
  const isProd = (typeof import.meta !== "undefined" && import.meta.env.PROD) || false;
  const apiUrl = (typeof import.meta !== "undefined" && import.meta.env.VITE_API_URL) || "http://localhost:3030";

  return {
    csp: {
      enabled: true,
      reportOnly: isDev,
      reportUri: `${apiUrl}/api/security/csp-report`,
    },
    https: {
      enforced: isProd,
      hsts: isProd,
    },
    headers: {
      xFrameOptions: "DENY",
      xContentTypeOptions: true,
      referrerPolicy: "strict-origin-when-cross-origin",
    },
  };
};

export const securityConfig = getSecurityConfig();

/**
 * Content Security Policy directives for the web application
 */
const isDev = (typeof import.meta !== "undefined" && import.meta.env.DEV) || false;
const isProd = (typeof import.meta !== "undefined" && import.meta.env.PROD) || false;

export const cspDirectives = {
  defaultSrc: ["'self'"],

  // Scripts - allow self and specific trusted sources
  scriptSrc: [
    "'self'",
    // Allow inline scripts only in development
    ...(isDev ? ["'unsafe-inline'"] : []),
    // Vite HMR and dev server
    ...(isDev ? ["'unsafe-eval'", "http://localhost:*"] : []),
    // Trusted CDNs for production
    "https://cdn.jsdelivr.net",
    "https://unpkg.com",
  ],

  // Styles - allow self and inline styles for styled-components/CSS-in-JS
  styleSrc: [
    "'self'",
    "'unsafe-inline'", // Required for styled-components and Tailwind
    "https://fonts.googleapis.com",
  ],

  // Images - allow self, data URLs, and HTTPS
  imgSrc: [
    "'self'",
    "data:",
    "https:",
    "blob:", // For file previews
  ],

  // API connections
  connectSrc: [
    "'self'",
    // Development API servers
    ...(isDev ? ["http://localhost:*", "ws://localhost:*", "wss://localhost:*", "http://192.168.*:*", "ws://192.168.*:*"] : []),
    // Production API
    "http://192.168.0.145:3030",
    // Additional API server
    "http://192.168.0.145:3030",
    // Firebase services
    "https://*.firebaseio.com",
    "https://*.googleapis.com",
    // WebSocket connections
    "wss://*.firebaseio.com",
  ].filter(Boolean),

  // Fonts
  fontSrc: ["'self'", "https://fonts.gstatic.com", "data:"],

  // Media sources
  mediaSrc: [
    "'self'",
    "blob:", // For media files and recordings
  ],

  // Deny object for security
  objectSrc: ["'none'"],

  // Frame protection
  frameSrc: ["'none'"],
  frameAncestors: ["'none'"],

  // Worker sources
  workerSrc: [
    "'self'",
    "blob:", // For service workers
  ],

  // Form actions
  formAction: ["'self'"],

  // Base URI protection
  baseUri: ["'self'"],

  // Manifest for PWA
  manifestSrc: ["'self'"],

  // Upgrade insecure requests in production
  ...(isProd && {
    upgradeInsecureRequests: [],
  }),
};

/**
 * Generate CSP header value from directives
 */
export function generateCSPHeader(): string {
  const directives = Object.entries(cspDirectives)
    .map(([key, values]) => {
      // Convert camelCase to kebab-case
      const directive = key.replace(/([A-Z])/g, "-$1").toLowerCase();

      if (Array.isArray(values) && values.length > 0) {
        return `${directive} ${values.join(" ")}`;
      } else if (Array.isArray(values) && values.length === 0) {
        return directive; // For directives like upgrade-insecure-requests
      }
      return null;
    })
    .filter(Boolean)
    .join("; ");

  // Add report URI if configured
  const reportUri = securityConfig.csp.reportUri;
  if (reportUri) {
    return `${directives}; report-uri ${reportUri}`;
  }

  return directives;
}

/**
 * Validate current environment security settings
 */
export function validateSecurityConfig(): {
  isSecure: boolean;
  warnings: string[];
  recommendations: string[];
} {
  const warnings: string[] = [];
  const recommendations: string[] = [];

  // Check HTTPS in production
  if (import.meta.env.PROD && window.location.protocol !== "https:") {
    warnings.push("Application is not served over HTTPS in production");
    recommendations.push("Enable HTTPS for production deployment");
  }

  // Check for development mode in production
  if (import.meta.env.PROD && import.meta.env.DEV) {
    warnings.push("Development mode detected in production build");
    recommendations.push("Ensure proper production build configuration");
  }

  // Check CSP configuration
  if (!securityConfig.csp.enabled) {
    warnings.push("Content Security Policy is disabled");
    recommendations.push("Enable CSP for enhanced security");
  }

  // Check for unsafe directives in production
  if (import.meta.env.PROD) {
    const unsafeDirectives = cspDirectives.scriptSrc.filter((src) => src.includes("unsafe-"));

    if (unsafeDirectives.length > 0) {
      warnings.push(`Unsafe CSP directives in production: ${unsafeDirectives.join(", ")}`);
      recommendations.push("Remove unsafe CSP directives for production");
    }
  }

  return {
    isSecure: warnings.length === 0,
    warnings,
    recommendations,
  };
}

/**
 * Security utilities for runtime checks
 */
export const securityUtils = {
  /**
   * Check if current context is secure (HTTPS or localhost)
   */
  isSecureContext(): boolean {
    return window.isSecureContext || window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1";
  },

  /**
   * Check if CSP is properly configured
   */
  hasCSP(): boolean {
    const meta = document.querySelector('meta[http-equiv="Content-Security-Policy"]');
    return meta !== null;
  },

  /**
   * Report security violation
   */
  reportViolation(type: string, details: any): void {
    if (import.meta.env.PROD) {
      // In production, send to monitoring service
      console.warn(`Security violation: ${type}`, details);

      // Example: Send to API
      fetch(`${import.meta.env.VITE_API_URL}/api/security/security-report`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type,
          details,
          timestamp: new Date().toISOString(),
          userAgent: navigator.userAgent,
          url: window.location.href,
        }),
      }).catch(console.error);
    } else {
      console.warn(`Security violation: ${type}`, details);
    }
  },
};
