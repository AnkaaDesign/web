// INFO drill-down content for the /estatisticas/departamento-pessoal/competencias
// page. Explains WHAT a skill / topic is: the skill description, and for each
// topic its description and contrary behaviour ("comportamentos contrários").
//
// Deliberately carries NO scores, averages or distribution — that lives in the
// sibling SkillTopicsPanel (the DATA view). Both are rendered as panels inside
// the unified SkillDrilldownModal, and also exposed as standalone *Modal
// wrappers for any caller that wants a one-off dialog.

import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { Input } from '@/components/ui/input';
import { IconInfoCircle, IconFlag3, IconAlignLeft, IconChevronRight } from '@tabler/icons-react';
import { getTopics } from '@/api-client/topic';
import { cn } from '@/lib/utils';
import { ScoreBadge } from '@/components/production/skill-assessment/score-badge';
import { DistributionBar } from './skill-topics-modal';
import type { SkillStatsTopicRadarPoint, SkillStatsTopicDistribution } from '@/types/skill-analytics';

interface TopicInfo {
  id: string;
  title: string;
  description: string | null;
  counterBehaviors: string | null;
  order: number;
}

export interface SkillInfoPanelProps {
  /** The skill being explained. */
  skill: { id: string; name: string } | null;
  /** When set, show only this topic (used when a single topic name is clicked). */
  highlightTopicId?: string | null;
  /** Whether the panel is mounted/visible (gates the query). */
  active?: boolean;
  /** When provided, topic cards become clickable → drill into that topic. */
  onTopicClick?: (topic: { id: string; name: string }) => void;
}

/**
 * Body-only panel (no Dialog/header chrome) — used by SkillDrilldownModal and
 * the standalone SkillInfoModal.
 */
export function SkillInfoPanel({ skill, highlightTopicId, active = true, onTopicClick }: SkillInfoPanelProps) {
  const { data: topicsResp, isLoading } = useQuery({
    queryKey: ['skill-info-topics', skill?.id],
    queryFn: () => getTopics({
      skillId: skill!.id,
      include: { skill: true },
      orderBy: { order: 'asc' },
      limit: 200,
    } as any),
    enabled: active && !!skill?.id,
    staleTime: 5 * 60 * 1000,
  });

  const fetched: any[] = useMemo(() => topicsResp?.data ?? [], [topicsResp]);
  const skillDescription: string | null = useMemo(
    () => fetched.find(t => t?.skill?.description)?.skill?.description ?? null,
    [fetched],
  );

  const topics = useMemo<TopicInfo[]>(() => {
    let list: TopicInfo[] = fetched.map((t: any) => ({
      id: t.id,
      title: t.title,
      description: t.description ?? null,
      counterBehaviors: t.counterBehaviors ?? null,
      order: t.order ?? 0,
    }));
    if (highlightTopicId) list = list.filter(t => t.id === highlightTopicId);
    return list.sort((a, b) => (a.order !== b.order ? a.order - b.order : a.title.localeCompare(b.title, 'pt-BR')));
  }, [fetched, highlightTopicId]);

  return (
    <div className="flex-1 min-h-0 overflow-y-auto px-6 py-5">
      {!highlightTopicId && skillDescription && (
        <p className="text-sm text-foreground/75 whitespace-pre-wrap mb-4">{skillDescription}</p>
      )}
      {isLoading && topics.length === 0 ? (
        <div className="space-y-5">
          {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-20 w-full rounded-md" />)}
        </div>
      ) : topics.length === 0 ? (
        <p className="py-12 text-center text-sm text-foreground/60">Nenhuma informação de tópico disponível.</p>
      ) : (
        <div className="space-y-4">
          {topics.map(t => (
            <div
              key={t.id}
              className={cn(
                'rounded-lg border border-border/60 bg-card/40 p-3 space-y-2.5 transition-colors',
                onTopicClick && 'cursor-pointer hover:bg-muted/50 hover:border-border',
              )}
              onClick={onTopicClick ? () => onTopicClick({ id: t.id, name: t.title }) : undefined}
            >
              {!highlightTopicId && (
                <div className="flex items-center justify-between gap-2 px-0.5">
                  <h3 className="text-sm font-semibold">{t.title}</h3>
                  {onTopicClick && <IconChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />}
                </div>
              )}

              {t.description && (
                <div className="rounded-md border border-border/50 bg-muted/40 px-3 py-2.5">
                  <p className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wide text-muted-foreground mb-1">
                    <IconAlignLeft className="h-3.5 w-3.5" />
                    Descrição
                  </p>
                  <p className="text-sm leading-relaxed whitespace-pre-wrap text-foreground/85">{t.description}</p>
                </div>
              )}

              {t.counterBehaviors && (
                <div className="rounded-md border border-amber-500/25 bg-amber-500/[0.06] px-3 py-2.5">
                  <p className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wide text-amber-600 dark:text-amber-400 mb-1">
                    <IconFlag3 className="h-3.5 w-3.5" />
                    Comportamentos contrários
                  </p>
                  <p className="text-sm leading-relaxed whitespace-pre-wrap text-foreground/80">{t.counterBehaviors}</p>
                </div>
              )}

              {!t.description && !t.counterBehaviors && (
                <p className="text-sm text-muted-foreground italic px-0.5">Sem descrição cadastrada.</p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

interface SkillInfoModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  skill: { id: string; name: string } | null;
  highlightTopicId?: string | null;
}

export function SkillInfoModal({ open, onOpenChange, skill, highlightTopicId }: SkillInfoModalProps) {
  const headerTitle = skill?.name ?? '—';
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl w-[92vw] max-h-[82vh] flex flex-col p-0 overflow-hidden">
        <DialogHeader className="px-6 pt-6 pb-4 border-b shrink-0">
          <DialogTitle className="flex items-center gap-2">
            <IconInfoCircle className="h-5 w-5 text-primary" />
            {headerTitle}
          </DialogTitle>
          <DialogDescription className="sr-only">Detalhes da competência e seus tópicos.</DialogDescription>
        </DialogHeader>
        <SkillInfoPanel skill={skill} highlightTopicId={highlightTopicId} active={open} />
      </DialogContent>
    </Dialog>
  );
}

// ── Merged skill-detail panel ───────────────────────────────────────────────
// Single view that combines the rubric (description + contrary behaviour) WITH
// the live stats (distribution, responses, average) per topic — so the modal is
// just 2 levels: skill detail → topic detail (the evaluations). Each topic card
// is clickable and drills into that topic's scores.

export interface SkillDetailPanelProps {
  skill: { id: string; name: string } | null;
  byTopic: SkillStatsTopicRadarPoint[];
  topicDistribution: SkillStatsTopicDistribution[];
  onTopicClick?: (topic: { id: string; name: string }) => void;
  active?: boolean;
}

export function SkillDetailPanel({ skill, byTopic, topicDistribution, onTopicClick, active = true }: SkillDetailPanelProps) {
  const [search, setSearch] = useState('');

  const { data: topicsResp, isLoading } = useQuery({
    queryKey: ['skill-info-topics', skill?.id],
    queryFn: () => getTopics({ skillId: skill!.id, include: { skill: true }, orderBy: { order: 'asc' }, limit: 200 } as any),
    enabled: active && !!skill?.id,
    staleTime: 5 * 60 * 1000,
  });

  const fetched: any[] = useMemo(() => topicsResp?.data ?? [], [topicsResp]);
  const skillDescription: string | null = useMemo(
    () => fetched.find(t => t?.skill?.description)?.skill?.description ?? null,
    [fetched],
  );

  // Merge rubric (fetched) with stats (byTopic average + topicDistribution).
  const cards = useMemo(() => {
    const avgByTopic = new Map<string, number | null>();
    byTopic.filter(t => !skill || t.skillId === skill.id).forEach(t => avgByTopic.set(t.topicId, t.average));
    const distByTopic = new Map<string, SkillStatsTopicDistribution>();
    topicDistribution.filter(d => !skill || d.skillId === skill.id).forEach(d => distByTopic.set(d.topicId, d));
    return fetched
      .map((t: any) => {
        const dist = distByTopic.get(t.id);
        return {
          id: t.id,
          title: t.title,
          description: t.description ?? null,
          counterBehaviors: t.counterBehaviors ?? null,
          order: t.order ?? 0,
          average: avgByTopic.has(t.id) ? avgByTopic.get(t.id) ?? null : (dist?.average ?? null),
          counts: dist?.counts ?? null,
          totalResponses: dist?.totalResponses ?? 0,
        };
      })
      .sort((a, b) => (a.order !== b.order ? a.order - b.order : a.title.localeCompare(b.title, 'pt-BR')));
  }, [fetched, byTopic, topicDistribution, skill]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return q ? cards.filter(c => c.title.toLowerCase().includes(q)) : cards;
  }, [cards, search]);

  const clickable = !!onTopicClick;

  return (
    <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
      {skillDescription && (
        <p className="px-6 pt-1 pb-3 text-sm text-foreground/75 whitespace-pre-wrap shrink-0">{skillDescription}</p>
      )}
      <div className="px-6 pb-3 shrink-0">
        <Input
          type="text"
          placeholder="Buscar tópico..."
          value={search}
          onChange={v => setSearch(v == null ? '' : String(v))}
          className="w-full"
        />
      </div>
      <div className="flex-1 min-h-0 overflow-y-auto px-6 pb-5 space-y-3">
        {isLoading && cards.length === 0 ? (
          Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-28 w-full rounded-lg" />)
        ) : filtered.length === 0 ? (
          <p className="py-12 text-center text-sm text-foreground/60">
            {search ? 'Nenhum tópico corresponde à busca.' : 'Nenhum tópico cadastrado.'}
          </p>
        ) : (
          filtered.map(t => (
            <button
              key={t.id}
              type="button"
              onClick={clickable ? () => onTopicClick?.({ id: t.id, name: t.title }) : undefined}
              className={cn(
                'w-full text-left rounded-lg border border-border/60 bg-card/40 p-3.5 space-y-3 transition-colors',
                clickable && 'cursor-pointer hover:bg-muted/40 hover:border-border',
              )}
            >
              <div className="flex items-start justify-between gap-3">
                <h3 className="text-sm font-semibold">{t.title}</h3>
                <div className="flex items-center gap-2 shrink-0">
                  {t.average == null
                    ? <span className="text-xs text-muted-foreground">—</span>
                    : <ScoreBadge score={Math.round(t.average)} label={t.average.toFixed(2)} size="md" />}
                  {clickable && <IconChevronRight className="h-4 w-4 text-muted-foreground" />}
                </div>
              </div>

              <div className="flex items-center gap-3">
                <DistributionBar counts={t.counts} total={t.totalResponses} />
                <span className="text-xs text-muted-foreground whitespace-nowrap">
                  {t.totalResponses || 0} resp.
                </span>
              </div>

              {t.description && (
                <div className="rounded-md border border-border/50 bg-muted/40 px-3 py-2.5">
                  <p className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wide text-muted-foreground mb-1">
                    <IconAlignLeft className="h-3.5 w-3.5" /> Descrição
                  </p>
                  <p className="text-sm leading-relaxed whitespace-pre-wrap text-foreground/85">{t.description}</p>
                </div>
              )}

              {t.counterBehaviors && (
                <div className="rounded-md border border-amber-500/25 bg-amber-500/[0.06] px-3 py-2.5">
                  <p className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wide text-amber-600 dark:text-amber-400 mb-1">
                    <IconFlag3 className="h-3.5 w-3.5" /> Comportamentos contrários
                  </p>
                  <p className="text-sm leading-relaxed whitespace-pre-wrap text-foreground/80">{t.counterBehaviors}</p>
                </div>
              )}
            </button>
          ))
        )}
      </div>
    </div>
  );
}

export default SkillInfoModal;
