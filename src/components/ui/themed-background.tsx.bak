import { forwardRef } from "react";
import { cn } from "@/lib/utils";

export interface ThemedBackgroundProps extends React.HTMLAttributes<HTMLDivElement> {
  className?: string;
}

/**
 * ThemedBackground component provides consistent background colors
 * across light and dark themes using CSS variables from the design system.
 *
 * This component automatically adapts to the current theme by using
 * the muted color CSS variable.
 *
 * The transition between themes is handled by the global CSS with a 300ms duration.
 */
export const ThemedBackground = forwardRef<HTMLDivElement, ThemedBackgroundProps>(({ className, ...props }, ref) => {
  return <div ref={ref} className={cn("bg-muted transition-colors duration-300", className)} {...props} />;
});

ThemedBackground.displayName = "ThemedBackground";
