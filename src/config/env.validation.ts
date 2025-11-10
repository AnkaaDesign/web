import { z } from "zod";

/**
 * Environment variable validation schema for web application
 * This ensures all required Vite environment variables are present and valid
 */
export const envSchema = z.object({
  // API Configuration
  VITE_API_URL: z.string().url("VITE_API_URL must be a valid URL"),

  // Development Flags
  DISABLE_RATE_LIMITING: z
    .string()
    .transform((val) => val === "true")
    .optional(),

  // Analytics (Optional)
  VITE_ANALYTICS_ID: z.string().optional(),
  VITE_SENTRY_DSN: z.string().url().optional(),

  // Environment
  NODE_ENV: z.enum(["development", "production", "test"]).optional(),
  DEV: z.boolean().optional(),
  PROD: z.boolean().optional(),
});

export type EnvConfig = z.infer<typeof envSchema>;

/**
 * Validates and returns the environment configuration
 * Uses import.meta.env for Vite environment variables
 */
export function validateEnv(): EnvConfig {
  try {
    const envVars = {
      ...import.meta.env,
      NODE_ENV: import.meta.env.NODE_ENV || import.meta.env.MODE,
      DEV: import.meta.env.DEV,
      PROD: import.meta.env.PROD,
    };

    const result = envSchema.parse(envVars);

    // Additional custom validations
    if (result.DEV) {
    }
    return result;
  } catch (error) {
    if (error instanceof z.ZodError) {
      const missingVars = error.errors.map((err) => `${err.path.join(".")}: ${err.message}`);
      console.error("❌ Web environment validation failed:");
      missingVars.forEach((err) => console.error(`  - ${err}`));

      console.error("\n📋 Please check your .env file and ensure all required VITE_ variables are set.");
      console.error("📋 You can copy from apps/web/.env.example and fill in the values.");

      // In development, we can continue but show warnings
      if (import.meta.env.DEV) {
        console.warn("⚠️  Continuing in development mode with missing variables");
        return {} as EnvConfig;
      } else {
        throw new Error("Environment validation failed in production mode");
      }
    }

    throw error;
  }
}

/**
 * Get validated environment configuration
 * Safe to use throughout the application
 */
export const env = validateEnv();

/**
 * Type-safe environment variable access
 */
export const getEnvVar = <K extends keyof EnvConfig>(key: K): EnvConfig[K] => {
  return env[key];
};

/**
 * Check if we're in development mode
 */
export const isDev = () => import.meta.env.DEV;

/**
 * Check if we're in production mode
 */
export const isProd = () => import.meta.env.PROD;
