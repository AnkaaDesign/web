/**
 * Trend Indicator Component
 *
 * Displays trend information with:
 * - Up/down arrow
 * - Percentage change
 * - Optional sparkline
 * - Color coding
 */

import { IconTrendingUp, IconTrendingDown, IconMinus } from "@tabler/icons-react";
import { cn } from "@/lib/utils";

export interface TrendIndicatorProps {
  /**
   * Current value
   */
  current: number;

  /**
   * Previous value for comparison
   */
  previous?: number;

  /**
   * Whether higher values are better (affects color)
   */
  higherIsBetter?: boolean;

  /**
   * Show percentage change
   */
  showPercentage?: boolean;

  /**
   * Show arrow icon
   */
  showArrow?: boolean;

  /**
   * Optional sparkline data points
   */
  sparklineData?: number[];

  /**
   * Size variant
   */
  size?: "sm" | "md" | "lg";

  /**
   * Additional className
   */
  className?: string;
}

/**
 * Trend Indicator Component
 *
 * Shows trend with arrow, percentage, and optional sparkline.
 */
export function TrendIndicator({
  current,
  previous,
  higherIsBetter = true,
  showPercentage = true,
  showArrow = true,
  sparklineData,
  size = "md",
  className,
}: TrendIndicatorProps) {
  // Calculate change
  const change = previous !== undefined ? current - previous : 0;
  const percentage = previous && previous !== 0
    ? (change / previous) * 100
    : 0;

  // Determine trend direction
  let trend: "up" | "down" | "neutral" = "neutral";
  if (Math.abs(percentage) < 0.1) {
    trend = "neutral";
  } else if (change > 0) {
    trend = "up";
  } else if (change < 0) {
    trend = "down";
  }

  // Determine if change is positive (good) or negative (bad)
  const isPositive = higherIsBetter
    ? trend === "up" || trend === "neutral"
    : trend === "down" || trend === "neutral";

  // Size classes
  const sizeClasses = {
    sm: "text-xs",
    md: "text-sm",
    lg: "text-base",
  };

  const iconSizeClasses = {
    sm: "h-3 w-3",
    md: "h-4 w-4",
    lg: "h-5 w-5",
  };

  // Color classes
  const colorClass = trend === "neutral"
    ? "text-muted-foreground"
    : isPositive
    ? "text-green-600 dark:text-green-400"
    : "text-red-600 dark:text-red-400";

  return (
    <div className={cn("flex items-center gap-1", sizeClasses[size], className)}>
      {/* Arrow Icon */}
      {showArrow && (
        <>
          {trend === "up" && (
            <IconTrendingUp className={cn(iconSizeClasses[size], colorClass)} />
          )}
          {trend === "down" && (
            <IconTrendingDown className={cn(iconSizeClasses[size], colorClass)} />
          )}
          {trend === "neutral" && (
            <IconMinus className={cn(iconSizeClasses[size], colorClass)} />
          )}
        </>
      )}

      {/* Percentage */}
      {showPercentage && previous !== undefined && (
        <span className={cn("font-medium", colorClass)}>
          {percentage > 0 ? "+" : ""}
          {percentage.toFixed(1)}%
        </span>
      )}

      {/* Sparkline - Simple SVG visualization */}
      {sparklineData && sparklineData.length > 0 && (
        <SparklineSVG data={sparklineData} color={isPositive ? "green" : "red"} />
      )}
    </div>
  );
}

/**
 * Simple Sparkline SVG Component
 */
interface SparklineSVGProps {
  data: number[];
  color: "green" | "red" | "blue";
  width?: number;
  height?: number;
}

function SparklineSVG({ data, color, width = 40, height = 16 }: SparklineSVGProps) {
  if (data.length < 2) return null;

  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;

  // Generate path points
  const points = data.map((value, index) => {
    const x = (index / (data.length - 1)) * width;
    const y = height - ((value - min) / range) * height;
    return `${x},${y}`;
  }).join(" ");

  const colorClasses = {
    green: "stroke-green-600 dark:stroke-green-400",
    red: "stroke-red-600 dark:stroke-red-400",
    blue: "stroke-blue-600 dark:stroke-blue-400",
  };

  return (
    <svg
      width={width}
      height={height}
      className="inline-block ml-1"
      preserveAspectRatio="none"
    >
      <polyline
        points={points}
        fill="none"
        className={cn(colorClasses[color])}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
