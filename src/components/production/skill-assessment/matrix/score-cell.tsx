// components/production/skill-assessment/matrix/score-cell.tsx
//
// Inline score selector cell for the leader's matrix table. Renders the 6
// score swatches (0..5) horizontally; clicking one fires the parent's
// onChange. The currently saved score sits highlighted; while a mutation is
// in flight a small ring + spinner overlays the chosen swatch.
//
// Mirrors the goal-cell ergonomic: cell IS the input (no edit-mode toggle),
// because the score range is a fixed 6-button enum.

import { IconCheck, IconLoader2 } from "@tabler/icons-react";
import { cn } from "@/lib/utils";
import { getScoreBadgeClasses } from "../score-badge";

interface ScoreCellProps {
  value: number | null;
  isSaving?: boolean;
  disabled?: boolean;
  onChange: (score: number) => void;
  ariaLabel?: string;
}

const SCORES = [0, 1, 2, 3, 4, 5] as const;

export function ScoreCell({ value, isSaving, disabled, onChange, ariaLabel }: ScoreCellProps) {
  return (
    <div
      role="radiogroup"
      aria-label={ariaLabel ?? "Nota"}
      className={cn(
        "inline-flex items-center gap-1 rounded-md p-0.5",
        disabled && "opacity-60",
      )}
    >
      {SCORES.map((s) => {
        const selected = value === s;
        const palette = getScoreBadgeClasses(s).replace(/hover:[^\s]+/g, "");
        return (
          <button
            key={s}
            type="button"
            role="radio"
            aria-checked={selected}
            aria-label={`Nota ${s}`}
            disabled={disabled || isSaving}
            onClick={() => onChange(s)}
            className={cn(
              "relative inline-flex h-7 w-7 items-center justify-center rounded-md text-xs font-semibold tabular-nums transition-all",
              "cursor-pointer disabled:cursor-not-allowed",
              selected
                ? cn("text-white ring-2 ring-offset-1 ring-offset-background", palette, "ring-foreground/30")
                : "text-muted-foreground bg-muted/30 hover:bg-muted hover:text-foreground",
            )}
          >
            {isSaving && selected ? (
              <IconLoader2 className="h-3.5 w-3.5 animate-spin" />
            ) : selected ? (
              <IconCheck className="h-3.5 w-3.5" />
            ) : (
              s
            )}
          </button>
        );
      })}
    </div>
  );
}
