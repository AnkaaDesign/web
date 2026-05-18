// components/production/skill-assessment/matrix/topic-picker-modal.tsx
//
// Modal topic-picker — replaces the inline combobox. Shows the campaign's
// full skill→topic catalogue as a grid; each topic card surfaces its
// fill-progress across all evaluatees so the leader can see at a glance
// what is done vs pending.

import { useMemo } from "react";
import { IconCircle, IconCircleCheck, IconCircleDot } from "@tabler/icons-react";

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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl">
        <DialogHeader>
          <DialogTitle>Selecionar tópico</DialogTitle>
          <DialogDescription>
            Veja a matriz de competências e o progresso de cada tópico para escolher
            qual avaliar agora.
          </DialogDescription>
        </DialogHeader>
        <ScrollArea className="max-h-[60vh]">
          <div className="flex flex-col gap-5 pr-2">
            {grouped.map((group) => (
              <section key={group.skill?.id ?? "_"} className="flex flex-col gap-2">
                <header className="flex items-center justify-between gap-2 border-b border-border/40 pb-1.5">
                  <h4 className="text-sm font-semibold">{group.skill?.name ?? "—"}</h4>
                  <span className="text-[10px] uppercase tracking-wide text-muted-foreground">
                    {group.topics.length} tópico{group.topics.length === 1 ? "" : "s"}
                  </span>
                </header>
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
                  {group.topics.map((t) => {
                    const prog =
                      progressByTopic.get(t.id) ?? { scored: 0, total: 0 };
                    const isActive = activeTopicId === t.id;
                    const complete = prog.total > 0 && prog.scored === prog.total;
                    const empty = prog.scored === 0;
                    const pct =
                      prog.total > 0 ? Math.round((prog.scored / prog.total) * 100) : 0;
                    return (
                      <button
                        key={t.id}
                        type="button"
                        onClick={() => {
                          onSelect(t.id);
                          onOpenChange(false);
                        }}
                        className={cn(
                          "group flex flex-col gap-2 rounded-lg border px-3 py-2.5 text-left transition-colors",
                          isActive
                            ? "border-primary/50 bg-primary/10"
                            : "border-border/40 hover:bg-muted/40",
                        )}
                      >
                        <div className="flex items-start gap-2">
                          {complete ? (
                            <IconCircleCheck className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
                          ) : empty ? (
                            <IconCircle className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground/60" />
                          ) : (
                            <IconCircleDot className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
                          )}
                          <span className="min-w-0 flex-1 text-sm leading-snug">
                            {t.title}
                          </span>
                          <span
                            className={cn(
                              "shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium tabular-nums",
                              complete
                                ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300"
                                : "bg-muted text-muted-foreground",
                            )}
                          >
                            {prog.scored}/{prog.total}
                          </span>
                        </div>
                        <Progress
                          value={pct}
                          className={cn(
                            "h-1",
                            complete && "[&>div]:bg-emerald-500",
                          )}
                        />
                      </button>
                    );
                  })}
                </div>
              </section>
            ))}
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
