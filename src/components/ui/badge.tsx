import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { getBadgeVariant as getCentralizedBadgeVariant } from "../../constants";

import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center rounded-md border px-2.5 py-0.5 text-xs font-medium transition-opacity focus:outline-none focus:ring-1 focus:ring-ring/30 focus:ring-offset-1",
  {
    variants: {
      variant: {
        // ===== NEUTRAL VARIANTS =====
        default: "border-transparent bg-neutral-500 text-white hover:bg-neutral-600",
        secondary: "border-transparent bg-neutral-200 text-neutral-900 hover:bg-neutral-300 dark:bg-neutral-700 dark:text-neutral-100 dark:hover:bg-neutral-600",
        muted: "border-transparent bg-neutral-400 text-white hover:bg-neutral-500",
        outline: "bg-transparent text-neutral-900 dark:text-neutral-100 hover:bg-neutral-100 dark:hover:bg-neutral-800 border border-neutral-300 dark:border-neutral-600",

        // ===== CORE SEMANTIC VARIANTS =====
        // Green status variants (use green-700)
        completed: "border-transparent bg-green-700 text-white hover:bg-green-800",
        received: "border-transparent bg-green-700 text-white hover:bg-green-800",
        approved: "border-transparent bg-green-700 text-white hover:bg-green-800",
        returned: "border-transparent bg-green-700 text-white hover:bg-green-800",
        delivered: "border-transparent bg-green-700 text-white hover:bg-green-800",
        active: "border-transparent bg-green-700 text-white hover:bg-green-800",
        verified: "border-transparent bg-green-700 text-white hover:bg-green-800",
        sent: "border-transparent bg-green-700 text-white hover:bg-green-800",

        // Red status variants (use red-700)
        cancelled: "border-transparent bg-red-700 text-white hover:bg-red-800",
        rejected: "border-transparent bg-red-700 text-white hover:bg-red-800",
        lost: "border-transparent bg-red-700 text-white hover:bg-red-800",
        failed: "border-transparent bg-red-700 text-white hover:bg-red-800",
        bounced: "border-transparent bg-red-700 text-white hover:bg-red-800",
        blocked: "border-transparent bg-red-700 text-white hover:bg-red-800",
        suspended: "border-transparent bg-red-700 text-white hover:bg-red-800",

        // Blue status variants (use blue-700)
        created: "border-transparent bg-blue-700 text-white hover:bg-blue-800",
        inProgress: "border-transparent bg-blue-700 text-white hover:bg-blue-800",
        processing: "border-transparent bg-blue-700 text-white hover:bg-blue-800",

        // Amber status variants (use amber-600)
        pending: "border-transparent bg-amber-600 text-white hover:bg-amber-700",
        expired: "border-transparent bg-amber-600 text-white hover:bg-amber-700",

        // Orange status variants (use orange-600)
        preparation: "border-transparent bg-orange-600 text-white hover:bg-orange-700",

        // ===== COLOR UTILITIES =====
        red: "border-transparent bg-red-700 text-white hover:bg-red-800",
        purple: "border-transparent bg-purple-600 text-white hover:bg-purple-700",
        teal: "border-transparent bg-teal-500 text-white hover:bg-teal-600",
        indigo: "border-transparent bg-indigo-600 text-white hover:bg-indigo-700",
        pink: "border-transparent bg-pink-600 text-white hover:bg-pink-700",
        yellow: "border-transparent bg-yellow-500 text-white hover:bg-yellow-600",
        amber: "border-transparent bg-amber-500 text-white hover:bg-amber-600",
        blue: "border-transparent bg-blue-600 text-white hover:bg-blue-700",
        orange: "border-transparent bg-orange-500 text-white hover:bg-orange-600",
        green: "border-transparent bg-green-700 text-white hover:bg-green-800",
        gray: "border-transparent bg-neutral-500 text-white hover:bg-neutral-600",
        cyan: "border-transparent bg-cyan-500 text-white hover:bg-cyan-600",

        // Inactive variant
        inactive: "border-transparent bg-gray-500 text-white hover:bg-gray-600",

        // ===== DEPRECATED - Keep for backward compatibility =====
        success: "border-transparent bg-green-700 text-white hover:bg-green-800", // Use specific variants instead
        destructive: "border-transparent bg-red-700 text-white hover:bg-red-800", // Use specific variants instead
        primary: "border-transparent bg-blue-700 text-white hover:bg-blue-800", // Use specific variants instead
        error: "border-transparent bg-red-700 text-white hover:bg-red-800", // Use specific variants instead
        info: "border-transparent bg-blue-700 text-white hover:bg-blue-800", // Use specific variants instead
        warning: "border-transparent bg-orange-600 text-white hover:bg-orange-700", // Use specific variants instead
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

const Badge = React.forwardRef<HTMLDivElement, BadgeProps>(({ className, variant, size, ...props }, ref) => {
  return <div ref={ref} className={cn(badgeVariants({ variant, size }), className)} {...props} />;
});

Badge.displayName = "Badge";

// Helper function to get badge variant from status enums
// Uses centralized badge configuration from @ankaa/constants
export function getBadgeVariantFromStatus(status: string, entity?: string): BadgeProps["variant"] {
  return getCentralizedBadgeVariant(status, entity as any) as BadgeProps["variant"];
}

export { Badge, badgeVariants };
