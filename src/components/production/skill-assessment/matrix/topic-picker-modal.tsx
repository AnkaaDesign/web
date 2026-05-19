// components/production/skill-assessment/matrix/topic-picker-modal.tsx
//
// Modal topic-picker — grid of topic cards grouped by competência. Each
// card surfaces fill-progress across all evaluatees so the leader can see
// what's done at a glance.

import { useMemo } from "react";
import { IconCheck, IconClock, IconCircleDashed } from "@tabler/icons-react";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import type { Skill, Topic } from "@/types";

export interface TopicPickerProgress {
  scored: number;
  total: number;
}

interface TopicPickerModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  topics: Topic[];
  activeTopicId: string | null;
  progressByTopic: Map<string, TopicPickerProgress>;
  onSelect: (topicId: string) => void;
}

interface TopicGroup {
  skill: Skill | undefined;
  topics: Topic[];
}

function statusForProgress(
  prog: TopicPickerProgress,
): "complete" | "partial" | "empty" {
  if (prog.total > 0 && prog.scored === prog.total) return "complete";
  if (prog.scored === 0) return "empty";
  return "partial";
}

export function TopicPickerModal({
  open,
  onOpenChange,
  topics,
  activeTopicId,
  progressByTopic,
  onSelect,
}: TopicPickerModalProps) {
  const grouped = useMemo<TopicGroup[]>(() => {
    const map = new Map<string, TopicGroup>();
    const order = [...topics].sort((a, b) => {
      const sa = a.skill?.order ?? Number.MAX_SAFE_INTEGER;
      const sb = b.skill?.order ?? Number.MAX_SAFE_INTEGER;
      if (sa !== sb) return sa - sb;
      return (a.order ?? 0) - (b.order ?? 0);
    });
    for (const t of order) {
      const skillId = t.skill?.id ?? t.skillId ?? "_";
      const g = map.get(skillId) ?? { skill: t.skill, topics: [] };
      g.topics.push(t);
      map.set(skillId, g);
    }
    return Array.from(map.values());
  }, [topics]);

  // Per-skill rollup for the section header.
  const skillStats = useMemo(() => {
    const map = new Map<string, { scored: number; total: number }>();
    for (const g of grouped) {
      const key = g.skill?.id ?? "_";
      let scored = 0;
      let total = 0;
      for (const t of g.topics) {
        const p = progressByTopic.get(t.id);
        if (p) {
          scored += p.scored;
          total += p.total;
        }
      }
      map.set(key, { scored, total });
    }
    return map;
  }, [grouped, progressByTopic]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl">
        <DialogHeader>
          <DialogTitle>Selecionar tópico</DialogTitle>
          <DialogDescription>
            Escolha qual tópico avaliar agora. Cada cartão mostra quantos
            avaliados já receberam nota.
          </DialogDescription>
        </DialogHeader>
        <ScrollArea className="max-h-[65vh]">
          <div className="flex flex-col gap-6 pr-2">
            {grouped.map((group) => {
              const sStats = skillStats.get(group.skill?.id ?? "_") ?? {
                scored: 0,
                total: 0,
              };
              const sPct =
                sStats.total > 0
                  ? Math.round((sStats.scored / sStats.total) * 100)
                  : 0;
              return (
                <section
                  key={group.skill?.id ?? "_"}
                  className="flex flex-col gap-2.5"
                >
                  <header className="flex items-baseline justify-between gap-3">
                    <h4 className="text-sm font-semibold">
                      {group.skill?.name ?? "—"}
                    </h4>
                    <div className="flex items-center gap-2 text-[11px] text-muted-foreground tabular-nums">
                      <span>
                        {group.topics.length} tópico
                        {group.topics.length === 1 ? "" : "s"}
                      </span>
                      <span aria-hidden>•</span>
                      <span>
                        {sStats.scored}/{sStats.total} notas
                      </span>
                      <span aria-hidden>•</span>
                      <span>{sPct}%</span>
                    </div>
                  </header>
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
                    {group.topics.map((t) => {
                      const prog = progressByTopic.get(t.id) ?? {
                        scored: 0,
                        total: 0,
                      };
                      const isActive = activeTopicId === t.id;
                      const status = statusForProgress(prog);
                      const pct =
                        prog.total > 0
                          ? Math.round((prog.scored / prog.total) * 100)
                          : 0;
                      return (
                        <button
                          key={t.id}
                          type="button"
                          onClick={() => {
                            onSelect(t.id);
                            onOpenChange(false);
                          }}
                          className={cn(
                            "group flex flex-col gap-2 rounded-lg border p-3 text-left transition-all",
                            "hover:shadow-sm",
                            isActive
                              ? "border-primary bg-primary/10 ring-1 ring-primary/30"
                              : status === "complete"
                                ? "border-emerald-500/40 bg-emerald-500/5 hover:bg-emerald-500/10"
                                : status === "partial"
                                  ? "border-amber-500/40 bg-amber-500/5 hover:bg-amber-500/10"
                                  : "border-border/60 hover:bg-muted/40",
                          )}
                        >
                          <div className="flex items-start gap-2">
                            <div
                              className={cn(
                                "mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full",
                                status === "complete"
                                  ? "bg-emerald-500 text-white"
                                  : status === "partial"
                                    ? "bg-amber-500 text-white"
                                    : "bg-muted text-muted-foreground",
                              )}
                            >
                              {status === "complete" ? (
                                <IconCheck className="h-3 w-3" strokeWidth={3} />
                              ) : status === "partial" ? (
                                <IconClock className="h-3 w-3" />
                              ) : (
                                <IconCircleDashed className="h-3 w-3" />
                              )}
                            </div>
                            <span className="min-w-0 flex-1 text-sm font-medium leading-snug">
                              {t.title}
                            </span>
                            <span
                              className={cn(
                                "shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold tabular-nums",
                                status === "complete"
                                  ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300"
                                  : status === "partial"
                                    ? "bg-amber-500/15 text-amber-700 dark:text-amber-300"
                                    : "bg-muted text-muted-foreground",
                              )}
                            >
                              {prog.scored}/{prog.total}
                            </span>
                          </div>
                          <Progress
                            value={pct}
                            className={cn(
                              "h-1.5",
                              status === "complete" && "[&>div]:bg-emerald-500",
                              status === "partial" && "[&>div]:bg-amber-500",
                            )}
                          />
                        </button>
                      );
                    })}
                  </div>
                </section>
              );
            })}
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
