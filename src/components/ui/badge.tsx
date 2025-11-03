import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { getBadgeVariant as getCentralizedBadgeVariant } from "../../constants";

import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center rounded-md border px-2.5 py-0.5 text-xs font-medium transition-opacity focus:outline-none focus:ring-1 focus:ring-ring/30 focus:ring-offset-1",
  {
    variants: {
      variant: {
        // Neutral variants
        default: "border-transparent bg-neutral-500 text-white hover:bg-neutral-600",
        secondary: "border-transparent bg-neutral-200 text-neutral-900 hover:bg-neutral-300 dark:bg-neutral-700 dark:text-neutral-100 dark:hover:bg-neutral-600",
        muted: "border-transparent bg-neutral-400 text-white hover:bg-neutral-500",
        outline: "bg-transparent text-neutral-900 dark:text-neutral-100 hover:bg-neutral-100 dark:hover:bg-neutral-800 border border-neutral-300 dark:border-neutral-600",

        // Primary variants - ALL use the same blue for consistency (2 tones more vibrant)
        primary: "border-transparent bg-blue-700 text-white hover:bg-blue-800",
        info: "border-transparent bg-blue-700 text-white hover:bg-blue-800",
        inProgress: "border-transparent bg-blue-700 text-white hover:bg-blue-800",
        blue: "border-transparent bg-blue-600 text-white hover:bg-blue-700",

        // Success variants - ALL use the same green for consistency (2 tones more vibrant)
        success: "border-transparent bg-green-700 text-white hover:bg-green-800",
        completed: "border-transparent bg-green-700 text-white hover:bg-green-800",
        active: "border-transparent bg-green-700 text-white hover:bg-green-800",
        green: "border-transparent bg-green-600 text-white hover:bg-green-700",

        // Warning variants - Different shades for semantic meaning (2 tones more vibrant)
        warning: "border-transparent bg-orange-600 text-white hover:bg-orange-700", // Overdue/Warning - Orange
        pending: "border-transparent bg-amber-600 text-white hover:bg-amber-700", // Pending - Amber (yellowish)
        onHold: "border-transparent bg-orange-600 text-white hover:bg-orange-700", // On Hold - Orange (distinct from amber)
        orange: "border-transparent bg-orange-500 text-white hover:bg-orange-600",

        // Error/Destructive variants - ALL use the same red for consistency (2 tones more vibrant)
        error: "border-transparent bg-red-700 text-white hover:bg-red-800",
        destructive: "border-transparent bg-red-700 text-white hover:bg-red-800",
        cancelled: "border-transparent bg-red-700 text-white hover:bg-red-800",

        // Financial variants
        invoiced: "border-transparent bg-cyan-600 text-white hover:bg-cyan-700",
        settled: "border-transparent bg-emerald-600 text-white hover:bg-emerald-700",

        // Additional color variants
        purple: "border-transparent bg-purple-600 text-white hover:bg-purple-700",
        teal: "border-transparent bg-teal-500 text-white hover:bg-teal-600",
        indigo: "border-transparent bg-indigo-600 text-white hover:bg-indigo-700",
        pink: "border-transparent bg-pink-600 text-white hover:bg-pink-700",
        yellow: "border-transparent bg-yellow-500 text-white hover:bg-yellow-600",
        amber: "border-transparent bg-amber-500 text-white hover:bg-amber-600",

        // Inactive variant
        inactive: "border-transparent bg-gray-500 text-white hover:bg-gray-600",
      },
      size: {
        default: "px-2.5 py-0.5 text-xs",
        sm: "px-2 py-0.25 text-[0.688rem]",
        lg: "px-3 py-1 text-sm",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

export interface BadgeProps extends React.HTMLAttributes<HTMLDivElement>, VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, size, ...props }: BadgeProps) {
  return <div className={cn(badgeVariants({ variant, size }), className)} {...props} />;
}

// Helper function to get badge variant from status enums
// Uses centralized badge configuration from @ankaa/constants
export function getBadgeVariantFromStatus(status: string, entity?: string): BadgeProps["variant"] {
  return getCentralizedBadgeVariant(status, entity as any) as BadgeProps["variant"];
}

export { Badge, badgeVariants };
