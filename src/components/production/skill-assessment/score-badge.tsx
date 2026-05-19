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

// Score palette — diverging "bad → acceptable → good" with green at the top.
// All stops are dark enough that the always-white text passes WCAG AA
// (≥4.5:1 contrast). Aligned with the canonical app status colours so a
// "5" badge reads the same green as `Badge variant="completed"` and a "1"
// badge reads the same red as `variant="cancelled"`.
//
// Note on level 3: an earlier draft used amber-700 here, but amber sits in
// the same hue family as the orange used for level 2 — the eye couldn't
// distinguish 2 from 3 at a glance. Teal-700 breaks out of warm-orange
// territory entirely and signals "crossed into acceptable" — visually
// distinct from both orange-600 (below) and blue-700 (above), and reads
// semantically neutral/calm, fitting "Adequado".
//
//   5 → green-700   (max — same as "completed")
//   4 → blue-700    (same as "inProgress")
//   3 → teal-700    (neutral / acceptable threshold)
//   2 → orange-600
//   1 → red-700     (same as "cancelled")
//   0 → neutral-900 (black)
const SCORE_CLASSES: Record<number, string> = {
  0: "border-transparent bg-neutral-900 text-white hover:bg-neutral-900",
  1: "border-transparent bg-red-700 text-white hover:bg-red-700",
  2: "border-transparent bg-orange-600 text-white hover:bg-orange-600",
  3: "border-transparent bg-teal-700 text-white hover:bg-teal-700",
  4: "border-transparent bg-blue-700 text-white hover:bg-blue-700",
  5: "border-transparent bg-green-700 text-white hover:bg-green-700",
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
