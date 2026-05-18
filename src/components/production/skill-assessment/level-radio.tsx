// components/production/skill-assessment/level-radio.tsx
//
// A single Level option card. Renders the full verbatim TopicLevel.description
// — never truncated. Selecting it sets the topic's nota (score).
//
// Nota colours mirror the centralized ScoreBadge palette
// (black → red → orange → yellow → lime → green) so the level chooser,
// summary badges, and analytics distributions all share one ramp.

import { IconCheck } from "@tabler/icons-react";
import { cn } from "@/lib/utils";

import { ScoreBadge } from "./score-badge";

interface LevelRadioProps {
  score: number; // 0..5
  name: string;
  description: string;
  selected: boolean;
  disabled?: boolean;
  onSelect: () => void;
}

// Border + hover states (idle). Mirrors the ScoreBadge palette but for
// borders/backgrounds of the radio card itself.
const COLOR_BASE: Record<number, string> = {
  0: "border-neutral-300 hover:border-neutral-500 hover:bg-neutral-50 dark:border-neutral-700 dark:hover:bg-neutral-900/40",
  1: "border-red-200 hover:border-red-400 hover:bg-red-50 dark:border-red-900/40 dark:hover:bg-red-950/30",
  2: "border-orange-200 hover:border-orange-400 hover:bg-orange-50 dark:border-orange-900/40 dark:hover:bg-orange-950/30",
  3: "border-yellow-200 hover:border-yellow-400 hover:bg-yellow-50 dark:border-yellow-900/40 dark:hover:bg-yellow-950/30",
  4: "border-lime-200 hover:border-lime-400 hover:bg-lime-50 dark:border-lime-900/40 dark:hover:bg-lime-950/30",
  5: "border-emerald-300 hover:border-emerald-500 hover:bg-emerald-50 dark:border-emerald-900/40 dark:hover:bg-emerald-950/30",
};

// Border + bg + ring when selected.
const COLOR_SELECTED: Record<number, string> = {
  0: "border-neutral-700 bg-neutral-100 ring-2 ring-neutral-500/40 dark:bg-neutral-900/40",
  1: "border-red-500 bg-red-50 ring-2 ring-red-400/60 dark:bg-red-950/40",
  2: "border-orange-500 bg-orange-50 ring-2 ring-orange-400/60 dark:bg-orange-950/40",
  3: "border-yellow-500 bg-yellow-50 ring-2 ring-yellow-400/60 dark:bg-yellow-950/40",
  4: "border-lime-500 bg-lime-50 ring-2 ring-lime-400/60 dark:bg-lime-950/40",
  5: "border-emerald-500 bg-emerald-50 ring-2 ring-emerald-400/60 dark:bg-emerald-950/40",
};

export function LevelRadio({
  score,
  name,
  description,
  selected,
  disabled,
  onSelect,
}: LevelRadioProps) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      aria-label={`Nota ${score}: ${name}`}
      disabled={disabled}
      onClick={onSelect}
      className={cn(
        "group relative flex h-full flex-col gap-2 rounded-xl border-2 p-3 text-left transition-all",
        "cursor-pointer disabled:cursor-not-allowed disabled:opacity-60",
        selected ? COLOR_SELECTED[score] : COLOR_BASE[score],
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2">
          <ScoreBadge
            score={score}
            size="md"
            className="h-7 w-7 rounded-full justify-center px-0 text-sm"
          />
          <span className="text-sm font-semibold leading-tight">{name}</span>
        </div>
        {selected && (
          <span className="rounded-full bg-foreground/10 p-1">
            <IconCheck className="h-3.5 w-3.5" />
          </span>
        )}
      </div>
      <p className="whitespace-pre-line text-xs leading-relaxed text-muted-foreground">
        {description}
      </p>
    </button>
  );
}
