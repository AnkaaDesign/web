import { clsx } from "clsx";

/**
 * Color utility functions for managing consistent colors across the application
 * Uses semantic naming and provides helpers for common color patterns
 */

// Card hierarchy levels for consistent nesting
export const cardLevels = {
  0: "bg-background",
  1: "bg-card dark:bg-card",
  2: "bg-card-nested dark:bg-card-nested",
  3: "bg-card-nested dark:bg-card-nested", // Same as level 2 to avoid too much contrast
} as const;

// Semantic status colors with low saturation
export const statusColors = {
  success: {
    bg: "bg-green-50/60 dark:bg-green-950/20",
    border: "border-green-200/40 dark:border-green-800/40",
    text: "text-green-700 dark:text-green-400",
    icon: "text-green-600 dark:text-green-500",
  },
  error: {
    bg: "bg-red-50/60 dark:bg-red-950/20",
    border: "border-red-200/40 dark:border-red-800/40",
    text: "text-red-700 dark:text-red-400",
    icon: "text-red-600 dark:text-red-500",
  },
  warning: {
    bg: "bg-amber-50/60 dark:bg-amber-950/20",
    border: "border-amber-200/40 dark:border-amber-800/40",
    text: "text-amber-700 dark:text-amber-400",
    icon: "text-amber-600 dark:text-amber-500",
  },
  info: {
    bg: "bg-blue-50/60 dark:bg-blue-950/20",
    border: "border-blue-200/40 dark:border-blue-800/40",
    text: "text-blue-700 dark:text-blue-400",
    icon: "text-blue-600 dark:text-blue-500",
  },
  neutral: {
    bg: "bg-muted/50",
    border: "border-border",
    text: "text-muted-foreground",
    icon: "text-muted-foreground",
  },
} as const;

// Hover state utilities
export const hoverEffects = {
  subtle: "hover:opacity-[0.85] transition-opacity",
  card: "hover:bg-muted/20 transition-colors",
  row: "hover:bg-muted/30 transition-colors",
  button: "hover:opacity-90 transition-opacity",
} as const;

// Focus state utilities with low opacity
export const focusEffects = {
  ring: "focus:ring-1 focus:ring-ring/30 focus:ring-offset-1",
  outline: "focus:outline-none focus:ring-1 focus:ring-ring/30",
  visible: "focus-visible:ring-1 focus-visible:ring-ring/30 focus-visible:ring-offset-1",
} as const;

// Input and form element colors
export const formColors = {
  input: "bg-input dark:bg-input border-border",
  select: "bg-input dark:bg-input border-border",
  combobox: "bg-input dark:bg-input border-border",
  switch: "border-border",
  disabled: "opacity-50 cursor-not-allowed",
} as const;

// Table colors
export const tableColors = {
  header: "bg-muted dark:bg-muted",
  headerText: "text-foreground font-medium",
  row: "border-b border-border",
  rowHover: "hover:bg-muted/20",
  rowAlternate: "even:bg-muted/10",
  rowSelected: "data-[state=selected]:bg-muted/30",
} as const;

/**
 * Get the appropriate card background class based on nesting level
 */
export function getCardLevel(level: number): string {
  return cardLevels[Math.min(level, 3) as keyof typeof cardLevels];
}

/**
 * Get status colors for a given status type
 */
export function getStatusColors(status: keyof typeof statusColors): (typeof statusColors)[keyof typeof statusColors] {
  return statusColors[status] || statusColors.neutral;
}

/**
 * Create consistent button classes with proper hover states
 */
export function buttonClasses(variant: "primary" | "secondary" | "outline" | "ghost" | "destructive", className?: string): string {
  const baseClasses = "transition-all active:scale-[0.98]";

  const variantClasses = {
    primary: "bg-primary text-primary-foreground shadow-sm hover:opacity-90",
    secondary: "bg-secondary text-secondary-foreground border border-border hover:opacity-90",
    outline: "bg-transparent border border-border text-foreground hover:bg-muted/30",
    ghost: "bg-transparent text-foreground hover:bg-muted/30",
    destructive: "bg-destructive text-destructive-foreground shadow-sm hover:opacity-90",
  };

  return clsx(baseClasses, variantClasses[variant], className);
}

/**
 * Create consistent input classes
 */
export function inputClasses(className?: string): string {
  return clsx(
    "w-full rounded-md border px-3 py-2 text-sm",
    formColors.input,
    focusEffects.ring,
    "placeholder:text-muted-foreground",
    "disabled:cursor-not-allowed disabled:opacity-50",
    className,
  );
}

/**
 * Apply semantic color classes to an element based on status
 */
export function withStatusColor(status: keyof typeof statusColors, type: "bg" | "text" | "border" | "all" = "all"): string {
  const colors = getStatusColors(status);

  if (type === "all") {
    return clsx(colors.bg, colors.border, colors.text);
  }

  return colors[type] || "";
}
