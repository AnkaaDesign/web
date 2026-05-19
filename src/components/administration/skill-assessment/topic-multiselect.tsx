import { useMemo } from "react";
import { IconChevronDown, IconLoader2 } from "@tabler/icons-react";

import { useSkills, useTopics } from "../../../hooks";
import type { Skill, Topic } from "../../../types";
import { cn } from "@/lib/utils";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";

interface TopicMultiSelectProps {
  value: string[];
  onChange: (next: string[]) => void;
  disabled?: boolean;
  placeholder?: string;
}

/**
 * Topic picker grouped by Skill (and Skill area).
 *
 * Each Skill group has a "select all" shortcut that toggles its full topic set.
 */
export function TopicMultiSelect({ value, onChange, disabled, placeholder }: TopicMultiSelectProps) {
  const { data: skillsData, isLoading: skillsLoading } = useSkills({
    limit: 200,
    isActive: true,
    orderBy: { order: "asc" },
  } as any);

  const { data: topicsData, isLoading: topicsLoading } = useTopics({
    limit: 1000,
    isActive: true,
    orderBy: { order: "asc" },
  } as any);

  const isLoading = skillsLoading || topicsLoading;

  const grouped = useMemo(() => {
    const skills: Skill[] = skillsData?.data ?? [];
    const topics: Topic[] = topicsData?.data ?? [];
    const bySkill = new Map<string, Topic[]>();
    topics.forEach((t) => {
      const arr = bySkill.get(t.skillId) ?? [];
      arr.push(t);
      bySkill.set(t.skillId, arr);
    });
    // Group topics in their Skill, sorted by topic.order ASC.
    // Sort Skills by skill.order ASC (Produtividade → Comportamental → Segurança).
    return [...skills]
      .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
      .map((s) => ({
        skill: s,
        topics: (bySkill.get(s.id) ?? []).sort(
          (x, y) => (x.order ?? 0) - (y.order ?? 0),
        ),
      }))
      .filter((g) => g.topics.length > 0);
  }, [skillsData, topicsData]);

  const selectedSet = useMemo(() => new Set(value), [value]);

  const toggleTopic = (id: string) => {
    const next = new Set(selectedSet);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    onChange(Array.from(next));
  };

  const toggleSkillGroup = (topicIds: string[]) => {
    const allSelected = topicIds.every((id) => selectedSet.has(id));
    const next = new Set(selectedSet);
    if (allSelected) {
      topicIds.forEach((id) => next.delete(id));
    } else {
      topicIds.forEach((id) => next.add(id));
    }
    onChange(Array.from(next));
  };

  const summaryLabel =
    value.length === 0
      ? placeholder ?? "Selecione os tópicos"
      : `${value.length} tópico(s) selecionado(s)`;

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          className="w-full justify-between font-normal"
          disabled={disabled}
        >
          <span className={cn(value.length === 0 && "text-muted-foreground")}>{summaryLabel}</span>
          <IconChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className="w-[var(--radix-popover-trigger-width)] p-0"
        align="start"
      >
        <ScrollArea className="h-[480px]">
          {isLoading ? (
            <div className="flex items-center justify-center py-10">
              <IconLoader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : grouped.length === 0 ? (
            <div className="text-center py-8 text-sm text-muted-foreground">
              Nenhuma competência ativa com tópicos.
            </div>
          ) : (
            <div className="divide-y">
              {grouped.map(({ skill, topics }) => {
                const ids = topics.map((t) => t.id);
                const allSelected = ids.every((id) => selectedSet.has(id));
                const partial = !allSelected && ids.some((id) => selectedSet.has(id));
                return (
                  <div key={skill.id} className="p-2">
                    <button
                      type="button"
                      className="flex w-full items-center gap-2 rounded-md px-2 py-2 hover:bg-accent text-left"
                      onClick={() => toggleSkillGroup(ids)}
                    >
                      <Checkbox
                        checked={allSelected}
                        indeterminate={partial}
                        tabIndex={-1}
                        className="pointer-events-none"
                      />
                      <div className="flex-1">
                        <div className="font-medium text-sm">{skill.name}</div>
                        <div className="text-xs text-muted-foreground">
                          {topics.length} tópicos
                        </div>
                      </div>
                    </button>
                    <div className="ml-6 mt-1 space-y-1">
                      {topics.map((t) => (
                        <label
                          key={t.id}
                          className="flex items-start gap-2 rounded-md px-2 py-1.5 hover:bg-accent cursor-pointer"
                        >
                          <Checkbox
                            checked={selectedSet.has(t.id)}
                            onCheckedChange={() => toggleTopic(t.id)}
                            className="mt-0.5"
                          />
                          <div className="flex-1">
                            <div className="text-sm font-medium leading-tight">{t.title}</div>
                            {t.description && (
                              <div className="text-xs text-muted-foreground line-clamp-1">
                                {t.description}
                              </div>
                            )}
                          </div>
                        </label>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
}
