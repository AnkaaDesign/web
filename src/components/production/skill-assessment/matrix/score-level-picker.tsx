// components/production/skill-assessment/matrix/score-level-picker.tsx
//
// Right rail: 6 score-level cards (0..5) for the currently active topic.
// Each card uses the score palette as its background (not just border) and
// is clickable — clicking commits the score for the currently active entry
// via the parent's onPickScore callback.

import { useMemo } from "react";
import { IconCheck, IconLoader2 } from "@tabler/icons-react";

import { Card } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import type { Topic, TopicLevel } from "@/types";

interface ScoreLevelPickerProps {
  topic: Topic | null;
  /** Current saved/optimistic score for the active entry on this topic. */
  currentScore: number | null;
  /** True when the active entry has SUBMITTED (no further changes allowed). */
  readOnly?: boolean;
  /** True while an upsert is in flight. */
  isSaving?: boolean;
  /** No active entry to score — render the cards inert. */
  disabled?: boolean;
  onPickScore: (score: number) => void;
}

// Background palette — must mirror score-badge.SCORE_CLASSES so the picker
// cards and the row Nota badges use the SAME colour for the same score.
const LEVEL_BG: Record<number, string> = {
  0: "bg-neutral-900 border border-red-500/70",
  1: "bg-red-700",
  2: "bg-orange-600",
  3: "bg-teal-700",
  4: "bg-blue-700",
  5: "bg-green-700",
};

// Hover state — slightly brighter.
const LEVEL_BG_HOVER: Record<number, string> = {
  0: "hover:bg-neutral-800",
  1: "hover:bg-red-600",
  2: "hover:bg-orange-500",
  3: "hover:bg-teal-600",
  4: "hover:bg-blue-600",
  5: "hover:bg-green-600",
};

// Ring around the selected card.
const LEVEL_RING: Record<number, string> = {
  0: "ring-neutral-300 dark:ring-neutral-500",
  1: "ring-red-300 dark:ring-red-300",
  2: "ring-orange-300 dark:ring-orange-300",
  3: "ring-teal-300 dark:ring-teal-300",
  4: "ring-blue-300 dark:ring-blue-300",
  5: "ring-green-300 dark:ring-green-300",
};

export function ScoreLevelPicker({
  topic,
  currentScore,
  readOnly,
  isSaving,
  disabled,
  onPickScore,
}: ScoreLevelPickerProps) {
  const levels = useMemo<TopicLevel[]>(
    () => [...(topic?.levels ?? [])].sort((a, b) => a.score - b.score),
    [topic],
  );

  if (!topic) {
    return (
      <Card className="flex h-full flex-col items-center justify-center p-6 text-center text-sm text-muted-foreground">
        Selecione um tópico para ver as notas.
      </Card>
    );
  }

  const isInert = disabled || readOnly;

  return (
    <Card className="flex h-full flex-col overflow-hidden p-0">
      <div className="flex h-10 items-center border-b border-border/40 bg-muted px-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        Notas
        {readOnly && (
          <span className="ml-3 text-[10px] font-medium normal-case tracking-normal text-amber-600 dark:text-amber-400">
            (somente leitura)
          </span>
        )}
      </div>
      <ScrollArea className="flex-1">
        <div className="flex flex-col gap-2 p-3">
          {levels.map((lvl) => {
            const selected = currentScore === lvl.score;
            return (
              <button
                key={lvl.id}
                type="button"
                onClick={() => !isInert && onPickScore(lvl.score)}
                disabled={isInert}
                aria-pressed={selected}
                className={cn(
                  "group relative w-full overflow-hidden rounded-lg p-3 text-left text-white shadow-sm transition-all",
                  LEVEL_BG[lvl.score],
                  !isInert && LEVEL_BG_HOVER[lvl.score],
                  !isInert && "cursor-pointer hover:shadow-md active:scale-[0.99]",
                  isInert && "cursor-not-allowed opacity-70",
                  selected && cn("ring-2 ring-offset-2 ring-offset-card", LEVEL_RING[lvl.score]),
                )}
              >
                <div className="flex items-center gap-3">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white/15 font-bold tabular-nums">
                    {selected && isSaving ? (
                      <IconLoader2 className="h-4 w-4 animate-spin" />
                    ) : selected ? (
                      <IconCheck className="h-4 w-4" strokeWidth={3} />
                    ) : (
                      lvl.score
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-semibold leading-tight">{lvl.name}</div>
                    <p className="mt-1 whitespace-pre-line text-xs leading-relaxed text-white/90">
                      {lvl.description}
                    </p>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </ScrollArea>
    </Card>
  );
}
