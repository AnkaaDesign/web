// Web Design System Utilities
// Consistent styling patterns using the unified design system

import { cva, type VariantProps } from "class-variance-authority";

// Enhanced Button Variants using design system
export const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-all disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&svg:not([class*='size-'])]:size-4 shrink-0 [&_svg]:shrink-0 outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground shadow-sm hover:bg-primary/90 focus-visible:ring-primary/30",
        destructive: "bg-destructive text-destructive-foreground shadow-sm hover:bg-destructive/90 focus-visible:ring-destructive/30",
        outline: "border border-border bg-background shadow-sm hover:bg-accent hover:text-accent-foreground focus-visible:ring-primary/30",
        secondary: "bg-secondary text-secondary-foreground shadow-sm hover:bg-secondary/80 focus-visible:ring-secondary/30",
        ghost: "hover:bg-accent hover:text-accent-foreground focus-visible:ring-primary/30",
        link: "text-primary underline-offset-4 hover:underline focus-visible:ring-primary/30",
      },
      size: {
        sm: "h-8 rounded-md px-3 text-xs font-medium",
        default: "h-10 px-4 py-2 text-sm font-medium",
        lg: "h-12 rounded-md px-6 text-base font-medium",
        icon: "h-10 w-10",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

// Enhanced Input Variants
export const inputVariants = cva(
  "flex w-full rounded-lg border border-border bg-white dark:bg-neutral-800 px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring/30 focus-visible:ring-offset-1 disabled:cursor-not-allowed disabled:opacity-50 transition-all",
  {
    variants: {
      size: {
        sm: "h-8 px-2 text-xs",
        default: "h-10 px-3 text-sm",
        lg: "h-12 px-4 text-base",
      },
      state: {
        default: "border-border focus:ring-ring/30 focus:ring-offset-1",
        error: "border-destructive focus-visible:ring-destructive/30",
        success: "border-green-500 focus-visible:ring-green-500/30",
      },
    },
    defaultVariants: {
      size: "default",
      state: "default",
    },
  },
);

// Enhanced Card Variants
export const cardVariants = cva("rounded-xl border bg-card text-card-foreground shadow-sm transition-all", {
  variants: {
    variant: {
      default: "border-border shadow-sm",
      elevated: "border-transparent shadow-md hover:shadow-lg",
      outline: "border-border bg-transparent shadow-none",
    },
    padding: {
      none: "p-0",
      sm: "p-4",
      default: "p-6",
      lg: "p-8",
    },
  },
  defaultVariants: {
    variant: "default",
    padding: "default",
  },
});

// Auth Layout Variants
export const authLayoutVariants = cva("min-h-screen flex items-center justify-center p-4", {
  variants: {
    background: {
      default: "bg-background",
      gradient: "bg-gradient-to-br from-primary/5 via-background to-primary/10",
    },
  },
  defaultVariants: {
    background: "default",
  },
});

// Auth Card Variants
export const authCardVariants = cva("w-full rounded-xl border bg-card shadow-sm", {
  variants: {
    size: {
      default: "max-w-md",
      wide: "max-w-lg",
    },
    elevation: {
      default: "shadow-sm",
      elevated: "shadow-lg border-transparent",
    },
  },
  defaultVariants: {
    size: "default",
    elevation: "default",
  },
});

// Verification Code Input Variants
export const verificationCodeInputVariants = cva("w-12 h-12 text-center text-xl font-bold rounded-lg border transition-all focus:outline-none focus:ring-2", {
  variants: {
    state: {
      default: "border-border bg-background focus:border-ring focus:ring-ring focus:ring-offset-2",
      filled: "border-primary bg-primary/10 focus:border-primary focus:ring-primary/30",
      error: "border-destructive bg-destructive/10 focus:border-destructive focus:ring-destructive/30",
    },
  },
  defaultVariants: {
    state: "default",
  },
});

// Loading Spinner Variants
export const loadingSpinnerVariants = cva("animate-spin rounded-full border-2 border-transparent", {
  variants: {
    size: {
      sm: "w-4 h-4 border-t-primary border-r-primary",
      default: "w-5 h-5 border-t-primary border-r-primary",
      lg: "w-6 h-6 border-t-primary border-r-primary",
    },
    variant: {
      primary: "border-t-primary border-r-primary",
      secondary: "border-t-secondary border-r-secondary",
      destructive: "border-t-destructive border-r-destructive",
    },
  },
  defaultVariants: {
    size: "default",
    variant: "primary",
  },
});

// Helper functions for consistent styling
export function getAuthStyles() {
  return {
    layout: "min-h-screen flex items-center justify-center bg-background p-4",
    card: "w-full max-w-md rounded-xl border bg-card shadow-sm",
    logo: "w-40 h-16 object-contain mx-auto mb-4",
    title: "text-2xl font-semibold text-center text-card-foreground",
    description: "text-sm text-muted-foreground text-center",
    form: "space-y-4",
    fieldset: "space-y-2",
    label: "text-sm font-medium text-foreground",
    button: "w-full h-12 font-medium",
    footer: "flex flex-col space-y-4 mt-12",
    link: "text-primary hover:text-primary/80 underline-offset-4 hover:underline text-sm",
  };
}

export function getVerificationCodeStyles() {
  return {
    container: "space-y-6",
    title: "text-2xl font-bold text-center text-card-foreground",
    description: "text-center text-muted-foreground",
    inputContainer: "flex justify-center gap-2",
    input: "w-12 h-12 text-center text-xl font-bold rounded-lg border transition-all",
    button: "w-full h-12 font-medium",
    resendButton: "text-center text-sm text-primary hover:text-primary/80 underline-offset-4 hover:underline",
  };
}

export function getLoadingStyles() {
  return {
    spinner: "animate-spin rounded-full w-5 h-5 border-2 border-transparent border-t-primary border-r-primary",
    skeleton: "animate-pulse bg-muted rounded",
    overlay: "absolute inset-0 bg-background/50 flex items-center justify-center",
  };
}

// Table styling utilities
export const tableHeaderVariants = cva("whitespace-nowrap font-bold uppercase text-xs p-0", {
  variants: {
    variant: {
      default: "text-black dark:text-neutral-200 bg-neutral-300 dark:bg-neutral-800",
      primary: "text-primary-foreground bg-primary dark:bg-primary",
      secondary: "text-secondary-foreground bg-secondary dark:bg-secondary",
    },
  },
  defaultVariants: {
    variant: "default",
  },
});

export const tableCellVariants = cva("px-4 py-2", {
  variants: {
    align: {
      left: "text-left",
      center: "text-center",
      right: "text-right",
    },
    variant: {
      default: "",
      numeric: "font-mono tabular-nums",
      currency: "font-medium tabular-nums",
      emphasis: "font-semibold",
    },
  },
  defaultVariants: {
    align: "left",
    variant: "default",
  },
});

// Helper function to get table column alignment class
export function getTableColumnAlignment(align?: "left" | "center" | "right"): string {
  switch (align) {
    case "center":
      return "text-center";
    case "right":
      return "text-right";
    default:
      return "text-left";
  }
}

// Helper function to get table styling classes
export function getTableStyles() {
  return {
    container: "rounded-lg flex flex-col",
    wrapper: "border-l border-r border-t border-neutral-600 dark:border-neutral-700 rounded-t-lg overflow-hidden",
    table: "table-fixed w-full [&>div]:border-0 [&>div]:rounded-none",
    header: "[&_tr]:border-b-0 [&_tr]:hover:!bg-neutral-300 [&_tr]:dark:hover:!bg-neutral-950",
    headerRow: "[&]:!bg-neutral-300 [&]:dark:!bg-neutral-800 [&]:hover:!bg-neutral-300 [&]:dark:hover:!bg-neutral-800 [&]:even:!bg-neutral-300 [&]:dark:even:!bg-neutral-800",
    headerCell: "whitespace-nowrap text-black dark:text-neutral-200 font-bold uppercase text-xs bg-neutral-300 dark:bg-neutral-800",
    bodyRow: "hover:bg-neutral-50 dark:hover:bg-gray-800 transition-colors cursor-pointer",
    bodyRowSelected: "bg-primary/10 dark:bg-primary/20",
    bodyCell: "px-4 py-2",
    footer: "p-4 border-l border-r border-b border-neutral-600 rounded-b-lg bg-neutral-50 dark:bg-neutral-800",
    emptyState: "border border-neutral-200 dark:border-neutral-700 rounded-lg p-8 text-center text-muted-foreground bg-white dark:bg-neutral-800",
    loadingState: "border border-neutral-200 dark:border-neutral-700 rounded-lg p-8 text-center text-muted-foreground bg-white dark:bg-neutral-800",
    errorState: "border border-neutral-200 dark:border-neutral-700 rounded-lg p-8 text-center text-destructive bg-white dark:bg-neutral-800",
  };
}

// Helper function to format table cell content based on type
export function formatTableCellContent(value: any, type?: "text" | "number" | "currency" | "percentage" | "date"): string {
  if (value === null || value === undefined) return "-";

  switch (type) {
    case "number":
      return value.toLocaleString("pt-BR");
    case "currency":
      return value;
    case "percentage":
      return `${value}%`;
    case "date":
      return value;
    default:
      return String(value);
  }
}

// Type exports for better TypeScript support
export type ButtonVariants = VariantProps<typeof buttonVariants>;
export type InputVariants = VariantProps<typeof inputVariants>;
export type CardVariants = VariantProps<typeof cardVariants>;
export type AuthLayoutVariants = VariantProps<typeof authLayoutVariants>;
export type AuthCardVariants = VariantProps<typeof authCardVariants>;
export type VerificationCodeInputVariants = VariantProps<typeof verificationCodeInputVariants>;
export type LoadingSpinnerVariants = VariantProps<typeof loadingSpinnerVariants>;
export type TableHeaderVariants = VariantProps<typeof tableHeaderVariants>;
export type TableCellVariants = VariantProps<typeof tableCellVariants>;
