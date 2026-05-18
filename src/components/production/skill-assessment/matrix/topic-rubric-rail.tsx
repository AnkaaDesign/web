// components/production/skill-assessment/matrix/topic-rubric-rail.tsx
//
// Right rail: rubric for the currently active topic. Shows title,
// description, counter-behaviors callout, then 6 level cards (score 0..5)
// with name + description, palette-matched to ScoreBadge.

import { useMemo } from "react";
import { IconFlag3 } from "@tabler/icons-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { cn } from "@/lib/utils";
import { ScoreBadge } from "../score-badge";
import type { Topic, TopicLevel } from "@/types";

interface TopicRubricRailProps {
  topic: Topic | null;
  highlightedScore: number | null;
}

const LEVEL_BORDER: Record<number, string> = {
  0: "border-neutral-300 dark:border-neutral-700",
  1: "border-red-200 dark:border-red-900/40",
  2: "border-orange-200 dark:border-orange-900/40",
  3: "border-amber-200 dark:border-amber-900/40",
  4: "border-blue-200 dark:border-blue-900/40",
  5: "border-emerald-200 dark:border-emerald-900/40",
};

const LEVEL_BORDER_ACTIVE: Record<number, string> = {
  0: "border-neutral-700 bg-neutral-50 dark:bg-neutral-900/40",
  1: "border-red-500 bg-red-50/70 dark:bg-red-950/30",
  2: "border-orange-500 bg-orange-50/70 dark:bg-orange-950/30",
  3: "border-amber-500 bg-amber-50/70 dark:bg-amber-950/30",
  4: "border-blue-500 bg-blue-50/70 dark:bg-blue-950/30",
  5: "border-emerald-500 bg-emerald-50/70 dark:bg-emerald-950/30",
};

export function TopicRubricRail({ topic, highlightedScore }: TopicRubricRailProps) {
  const levels = useMemo<TopicLevel[]>(
    () => [...(topic?.levels ?? [])].sort((a, b) => a.score - b.score),
    [topic],
  );

  if (!topic) {
    return (
      <div className="flex h-full flex-col items-center justify-center rounded-lg border border-border/40 bg-card p-6 text-center text-sm text-muted-foreground">
        Selecione um tópico para ver a rubrica.
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col rounded-lg border border-border/40 bg-card">
      <div className="border-b border-border/40 px-3 py-2">
        <div className="flex items-center justify-between gap-2">
          <h3 className="text-sm font-semibold leading-tight">{topic.title}</h3>
          {topic.skill?.name && (
            <span className="rounded-full bg-muted px-1.5 py-0.5 text-[9px] uppercase tracking-wide text-muted-foreground">
              {topic.skill.name}
            </span>
          )}
        </div>
        {topic.description && (
          <p className="mt-1 whitespace-pre-line text-xs leading-relaxed text-muted-foreground">
            {topic.description}
          </p>
        )}
      </div>
      <ScrollArea className="flex-1">
        <div className="flex flex-col gap-3 p-3">
          {topic.counterBehaviors && (
            <Alert className="border-amber-200 bg-amber-50/60 py-2 dark:border-amber-900/40 dark:bg-amber-950/20">
              <IconFlag3 className="h-3.5 w-3.5 text-amber-600" />
              <AlertDescription className="text-xs text-amber-900 dark:text-amber-200">
                <span className="font-semibold">O que evitar: </span>
                <span className="whitespace-pre-line">{topic.counterBehaviors}</span>
              </AlertDescription>
            </Alert>
          )}
          <div className="flex flex-col gap-2">
            {levels.map((lvl) => {
              const active = highlightedScore === lvl.score;
              return (
                <div
                  key={lvl.id}
                  className={cn(
                    "rounded-lg border-2 p-2.5 transition-colors",
                    active ? LEVEL_BORDER_ACTIVE[lvl.score] : LEVEL_BORDER[lvl.score],
                  )}
                >
                  <div className="flex items-center gap-2">
                    <ScoreBadge score={lvl.score} size="sm" />
                    <span className="text-sm font-semibold leading-tight">{lvl.name}</span>
                  </div>
                  <p className="mt-1 whitespace-pre-line text-xs leading-relaxed text-muted-foreground">
                    {lvl.description}
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      </ScrollArea>
    </div>
  );
}
