// INFO drill-down for the /estatisticas/recursos-humanos/competencias page.
// Opens when the user clicks the OUTER name label (radar axis text or a bar's
// x-axis label) — i.e. the *name*, not the data mark. Its sole purpose is to
// explain WHAT the skill / topic is: the skill description, and for each topic
// its description and its contrary behaviour ("comportamentos contrários").
//
// Deliberately carries NO scores, averages or distribution — that lives in the
// sibling SkillTopicsModal (the DATA modal opened by clicking inside the chart).

import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { IconInfoCircle, IconFlag3, IconAlignLeft } from '@tabler/icons-react';
import { getTopics } from '@/api-client/topic';

interface SkillInfoModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** The skill being explained. */
  skill: { id: string; name: string } | null;
  /** When set, show only this topic (used when a single topic name is clicked). */
  highlightTopicId?: string | null;
}

interface TopicInfo {
  id: string;
  title: string;
  description: string | null;
  counterBehaviors: string | null;
  order: number;
}

export function SkillInfoModal({ open, onOpenChange, skill, highlightTopicId }: SkillInfoModalProps) {
  const { data: topicsResp, isLoading } = useQuery({
    queryKey: ['skill-info-topics', skill?.id],
    queryFn: () => getTopics({
      skillId: skill!.id,
      include: { skill: true },
      orderBy: { order: 'asc' },
      limit: 200,
    } as any),
    enabled: open && !!skill?.id,
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

  const headerTitle = highlightTopicId && topics.length === 1 ? topics[0].title : (skill?.name ?? '—');

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl w-[92vw] max-h-[82vh] flex flex-col p-0 overflow-hidden">
        <DialogHeader className="px-6 pt-6 pb-4 border-b shrink-0">
          <DialogTitle className="flex items-center gap-2">
            <IconInfoCircle className="h-5 w-5 text-primary" />
            {headerTitle}
          </DialogTitle>
          {!highlightTopicId && (
            <DialogDescription className="text-sm text-foreground/75 whitespace-pre-wrap">
              {skillDescription ?? 'Entenda o que esta competência avalia e seus tópicos.'}
            </DialogDescription>
          )}
        </DialogHeader>

        <div className="flex-1 min-h-0 overflow-y-auto px-6 py-5">
          {isLoading && topics.length === 0 ? (
            <div className="space-y-5">
              {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-20 w-full rounded-md" />)}
            </div>
          ) : topics.length === 0 ? (
            <p className="py-12 text-center text-sm text-foreground/60">Nenhuma informação de tópico disponível.</p>
          ) : (
            <div className="space-y-4">
              {topics.map(t => (
                <div key={t.id} className="rounded-lg border border-border/60 bg-card/40 p-3 space-y-2.5">
                  {!highlightTopicId && <h3 className="text-sm font-semibold px-0.5">{t.title}</h3>}

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
      </DialogContent>
    </Dialog>
  );
}

export default SkillInfoModal;
