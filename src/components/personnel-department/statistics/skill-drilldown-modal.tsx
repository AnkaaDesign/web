// Unified drill-down modal for the /estatisticas/departamento-pessoal/competencias
// page. Just 2 levels: the SKILL DETAIL (description + per-topic distribution,
// responses, average AND each topic's description/contrary behaviour) and the
// TOPIC DETAIL (the evaluations behind a topic). The page owns the stack; this
// component renders the top view and emits push/jump/close events.

import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { IconChevronRight, IconInfoCircle, IconClipboardCheck } from '@tabler/icons-react';
import { cn } from '@/lib/utils';
import { SkillDetailPanel } from './skill-info-modal';
import { SkillEntriesPanel, buildTitle, type SkillStatsClickContext } from './skill-stats-entries-modal';
import type {
  SkillStatsBaseFilters,
  SkillStatsTopicRadarPoint,
  SkillStatsTopicDistribution,
} from '@/types/skill-analytics';

export type SkillDrilldownView =
  | { kind: 'skill'; skill: { id: string; name: string } }
  | { kind: 'scores'; context: SkillStatsClickContext; override?: Partial<SkillStatsBaseFilters> | null };

const VIEW_META: Record<SkillDrilldownView['kind'], { crumb: string; icon: typeof IconInfoCircle }> = {
  skill: { crumb: 'Competência', icon: IconInfoCircle },
  scores: { crumb: 'Avaliações', icon: IconClipboardCheck },
};

function viewTitle(view: SkillDrilldownView): string {
  switch (view.kind) {
    case 'skill': return view.skill.name;
    case 'scores': return buildTitle(view.context);
  }
}

interface SkillDrilldownModalProps {
  stack: SkillDrilldownView[];
  byTopic: SkillStatsTopicRadarPoint[];
  topicDistribution: SkillStatsTopicDistribution[];
  baseFilters: SkillStatsBaseFilters;
  onPush: (view: SkillDrilldownView) => void;
  onJump: (index: number) => void;
  onClose: () => void;
}

export function SkillDrilldownModal({
  stack,
  byTopic,
  topicDistribution,
  baseFilters,
  onPush,
  onJump,
  onClose,
}: SkillDrilldownModalProps) {
  const open = stack.length > 0;
  const top = stack[stack.length - 1];
  const TopIcon = top ? VIEW_META[top.kind].icon : IconInfoCircle;

  return (
    <Dialog open={open} onOpenChange={o => { if (!o) onClose(); }}>
      <DialogContent className="max-w-5xl w-[94vw] max-h-[82vh] flex flex-col p-0 gap-0 overflow-hidden">
        <DialogHeader className="px-6 pt-5 pb-3 shrink-0 space-y-2 text-left">
          {/* Title row */}
          <div className="flex items-center gap-2.5">
            <TopIcon className="h-5 w-5 text-primary shrink-0" />
            <DialogTitle className="text-base font-semibold truncate">
              {top ? viewTitle(top) : ''}
            </DialogTitle>
          </div>

          {/* Breadcrumb — directly below the title; the sole navigation control
              (no separate back button). Clicking a crumb pops back to that view. */}
          <nav className="flex items-center flex-wrap gap-x-0.5 gap-y-0.5 text-sm">
            {stack.map((v, i) => {
              const isLast = i === stack.length - 1;
              return (
                <span key={i} className="inline-flex items-center gap-0.5">
                  {i > 0 && <IconChevronRight className="h-3.5 w-3.5 text-muted-foreground/40" />}
                  <button
                    type="button"
                    onClick={() => onJump(i)}
                    disabled={isLast}
                    className={cn(
                      'rounded px-1 py-0.5 transition-colors',
                      isLast
                        ? 'font-medium text-foreground cursor-default'
                        : 'text-muted-foreground hover:bg-muted hover:text-foreground',
                    )}
                  >
                    {VIEW_META[v.kind].crumb}
                  </button>
                </span>
              );
            })}
          </nav>
          {/* Inset, rounded separator below the breadcrumb (not edge-to-edge). */}
          <div className="h-px rounded-full bg-border/40" />
          <DialogDescription className="sr-only">Detalhamento de competências, dados e avaliações.</DialogDescription>
        </DialogHeader>

        {/* Body — one panel per view kind. */}
        <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
          {top?.kind === 'skill' && (
            <SkillDetailPanel
              skill={top.skill}
              byTopic={byTopic}
              topicDistribution={topicDistribution}
              active={open}
              onTopicClick={topic =>
                onPush({ kind: 'scores', context: { primary: { type: 'topic', id: topic.id, name: topic.name } } })
              }
            />
          )}
          {top?.kind === 'scores' && (
            <SkillEntriesPanel
              context={top.context}
              baseFilters={top.override ? { ...baseFilters, ...top.override } : baseFilters}
              active={open}
            />
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default SkillDrilldownModal;
