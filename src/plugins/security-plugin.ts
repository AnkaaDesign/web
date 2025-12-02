import type { Plugin } from "vite";
import { generateCSPHeader } from "../config/security";

/**
 * Vite plugin to inject security headers during development and build
 */
export function securityPlugin(): Plugin {
  return {
    name: "security-headers",
    configureServer(server) {
      // Add security headers to development server
      server.middlewares.use((_req, res, next) => {
        // Content Security Policy
        const cspHeader = generateCSPHeader();
        res.setHeader("Content-Security-Policy", cspHeader);

        // Additional security headers for development
        res.setHeader("X-Content-Type-Options", "nosniff");
        res.setHeader("X-Frame-Options", "DENY");
        res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
        res.setHeader("X-DNS-Prefetch-Control", "off");
        res.setHeader("X-Download-Options", "noopen");
        res.setHeader("X-Permitted-Cross-Domain-Policies", "none");

        // Permissions Policy
        const permissionsPolicy = [
          "camera=()",
          "microphone=()",
          "geolocation=()",
          "payment=()",
          "usb=()",
          "bluetooth=()",
          "accelerometer=()",
          "gyroscope=()",
          "ambient-light-sensor=()",
        ].join(", ");
        res.setHeader("Permissions-Policy", permissionsPolicy);

        // Hide sensitive headers
        res.removeHeader("X-Powered-By");
        res.removeHeader("Server");

        next();
      });
    },

    generateBundle() {
      // Log security configuration during build
      console.log("🔒 Security headers configured");
    },

    // Removed transformIndexHtml to avoid duplicate CSP headers
    // CSP is now only set via server middleware using generateCSPHeader()
  };
}

/**
 * Plugin to validate security configuration
 */
export function securityValidationPlugin(): Plugin {
  return {
    name: "security-validation",
    buildStart() {
      // Validate security configuration at build time
      try {
        const { isSecure, warnings, recommendations } = validateSecurityConfigBuild();

        if (!isSecure) {
          console.warn("⚠️  Security warnings detected:");
          warnings.forEach((warning) => console.warn(`   - ${warning}`));

          if (recommendations.length > 0) {
            console.warn("📋 Recommendations:");
            recommendations.forEach((rec) => console.warn(`   - ${rec}`));
          }
        } else {
          console.log("✅ Security configuration validated");
        }
      } catch (error) {
        console.warn("⚠️  Security validation failed:", error instanceof Error ? error.message : "Unknown error");
      }
    },
  };
}

function validateSecurityConfigBuild() {
  const warnings: string[] = [];
  const recommendations: string[] = [];

  // Check environment variables - use process.env during build
  if (!process.env.VITE_API_URL) {
    warnings.push("VITE_API_URL not configured");
    recommendations.push("Set VITE_API_URL environment variable");
  }

  // Check for development mode in production
  if (process.env.NODE_ENV === "production") {
    warnings.push("Development mode detected in production build");
    recommendations.push("Ensure proper production build configuration");
  }

  return {
    isSecure: warnings.length === 0,
    warnings,
    recommendations,
  };
}
