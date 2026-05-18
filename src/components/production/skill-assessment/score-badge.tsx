// components/production/skill-assessment/score-badge.tsx
//
// Renders a Nota (score 0..5) as a colored Badge using the project's standard
// Badge component. Provides a single source of truth for the score color
// palette across the entire skill-assessment feature.
//
// Palette (black → red → orange → amber → blue → green):
//   0: black   — Não atende
//   1: red     — Crítico
//   2: orange  — Insuficiente
//   3: amber   — Atende parcialmente
//   4: blue    — Atende
//   5: green   — Referência
//
// Text is ALWAYS white for legibility across the entire palette.

import * as React from "react";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export interface ScoreBadgeProps {
  /** Score value (0..5). Out-of-range values render with a neutral muted style. */
  score: number | null | undefined;
  /** Optional size variant — defaults to "md". */
  size?: "sm" | "md" | "lg";
  /** Optional label override (defaults to the raw number). */
  label?: React.ReactNode;
  /** Render only the colored swatch (no number) — useful for radar/legend dots. */
  swatchOnly?: boolean;
  className?: string;
}

const SCORE_CLASSES: Record<number, string> = {
  0: "border-transparent bg-neutral-900 text-white hover:bg-neutral-900",
  1: "border-transparent bg-red-600 text-white hover:bg-red-600",
  2: "border-transparent bg-orange-500 text-white hover:bg-orange-500",
  3: "border-transparent bg-amber-500 text-white hover:bg-amber-500",
  4: "border-transparent bg-blue-600 text-white hover:bg-blue-600",
  5: "border-transparent bg-emerald-600 text-white hover:bg-emerald-600",
};

const FALLBACK_CLASS =
  "border-transparent bg-neutral-200 text-neutral-700 hover:bg-neutral-200 dark:bg-neutral-700 dark:text-neutral-200";

/**
 * Returns the raw Tailwind class string for a given score. Useful when you
 * need to colour a non-Badge element (e.g. a radio card swatch) with the
 * exact same palette.
 */
export function getScoreBadgeClasses(score: number | null | undefined): string {
  if (score == null || !Number.isFinite(score)) return FALLBACK_CLASS;
  return SCORE_CLASSES[score as 0 | 1 | 2 | 3 | 4 | 5] ?? FALLBACK_CLASS;
}

const SIZE_CLASSES: Record<NonNullable<ScoreBadgeProps["size"]>, string> = {
  sm: "px-2 py-0.25 text-[0.688rem] min-w-[1.25rem]",
  md: "px-2.5 py-0.5 text-xs min-w-[1.5rem]",
  lg: "px-3 py-1 text-sm min-w-[1.75rem]",
};

export function ScoreBadge({
  score,
  size = "md",
  label,
  swatchOnly,
  className,
}: ScoreBadgeProps) {
  const classes = getScoreBadgeClasses(score);

  if (swatchOnly) {
    return (
      <span
        aria-label={score != null ? `Nota ${score}` : "Sem nota"}
        className={cn(
          "inline-block h-3 w-3 rounded-sm",
          classes.replace(/hover:[^\s]+/g, ""),
          className,
        )}
      />
    );
  }

  return (
    <Badge
      className={cn(
        "justify-center font-semibold tabular-nums",
        SIZE_CLASSES[size],
        classes,
        className,
      )}
    >
      {label ?? (score == null ? "—" : score)}
    </Badge>
  );
}

export default ScoreBadge;
