import { cva, type VariantProps } from "class-variance-authority";

/**
 * Authentication styles configuration
 * Returns consistent styling values for auth pages
 */
export function getAuthStyles() {
  return {
    logo: "h-12 w-auto object-contain",
    title: "text-2xl font-bold text-center",
    description: "text-sm text-muted-foreground text-center",
    form: "space-y-4",
    fieldset: "space-y-2",
    label: "text-sm font-medium",
    link: "text-sm text-primary hover:underline transition-colors",
    footer: "flex flex-col space-y-2",
    button: "w-full",
  };
}

/**
 * Authentication layout variants
 * Provides consistent layout styling across auth pages
 */
export const authLayoutVariants = cva(
  "min-h-screen flex items-center justify-center p-4 bg-background",
  {
    variants: {
      background: {
        gradient: "",
        solid: "",
        default: "",
      },
    },
    defaultVariants: {
      background: "default",
    },
  }
);

/**
 * Authentication card variants
 * Provides consistent card styling across auth pages
 */
export const authCardVariants = cva(
  "w-full max-w-md",
  {
    variants: {
      elevation: {
        elevated: "shadow-lg",
        flat: "shadow-none",
        default: "shadow-md",
      },
    },
    defaultVariants: {
      elevation: "default",
    },
  }
);

/**
 * Input variants for form fields
 * Provides consistent input styling with state-based appearance
 */
export const inputVariants = cva(
  "transition-colors",
  {
    variants: {
      state: {
        default: "",
        error: "border-destructive focus-visible:ring-destructive",
        success: "border-green-500 focus-visible:ring-green-500",
      },
    },
    defaultVariants: {
      state: "default",
    },
  }
);

export type AuthLayoutVariants = VariantProps<typeof authLayoutVariants>;
export type AuthCardVariants = VariantProps<typeof authCardVariants>;
export type InputVariants = VariantProps<typeof inputVariants>;
