// DATA drill-down for the /estatisticas/recursos-humanos/competencias page.
// Opens when the user clicks INSIDE the chart (a radar vertex/polygon tip or a
// skill bar) — i.e. on the data mark itself. It is about the NUMBERS: each
// topic's average score, response count and score distribution in the active
// scope, and clicking a topic drills into the raw evaluations behind it.
//
// (For "what is this skill/topic" — descriptions + contrary behaviour — see the
// sibling SkillInfoModal, opened by clicking the OUTER name label.)

import { useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { IconChartBar, IconChevronRight } from '@tabler/icons-react';
import { ScoreBadge, getScoreBadgeClasses } from '@/components/production/skill-assessment/score-badge';
import { cn } from '@/lib/utils';
import type {
  SkillStatsTopicRadarPoint,
  SkillStatsTopicDistribution,
} from '@/types/skill-analytics';

interface SkillTopicsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  skill: { id: string; name: string } | null;
  byTopic: SkillStatsTopicRadarPoint[];
  topicDistribution: SkillStatsTopicDistribution[];
  onTopicClick?: (topic: { id: string; name: string }) => void;
}

interface TopicRow {
  topicId: string;
  topicTitle: string;
  average: number | null;
  counts: [number, number, number, number, number, number] | null;
  totalResponses: number;
}

function DistributionBar({ counts, total }: { counts: TopicRow['counts']; total: number }) {
  if (!counts || total <= 0) return <span className="text-xs text-muted-foreground">—</span>;
  return (
    <div className="flex h-3 w-full min-w-[120px] overflow-hidden rounded-sm bg-muted/40" role="img" aria-label="Distribuição de notas">
      {counts.map((c, score) => {
        if (c <= 0) return null;
        const pct = (c / total) * 100;
        return (
          <div
            key={score}
            title={`Nota ${score}: ${c} (${pct.toFixed(0)}%)`}
            className={cn(getScoreBadgeClasses(score).replace(/hover:[^\s]+/g, ''), 'h-full')}
            style={{ width: `${pct}%` }}
          />
        );
      })}
    </div>
  );
}

export function SkillTopicsModal({
  open,
  onOpenChange,
  skill,
  byTopic,
  topicDistribution,
  onTopicClick,
}: SkillTopicsModalProps) {
  const rows = useMemo<TopicRow[]>(() => {
    if (!skill) return [];
    const distByTopic = new Map<string, SkillStatsTopicDistribution>();
    topicDistribution.filter(d => d.skillId === skill.id).forEach(d => distByTopic.set(d.topicId, d));

    const merged = new Map<string, TopicRow>();
    byTopic.filter(t => t.skillId === skill.id).forEach(t => {
      const dist = distByTopic.get(t.topicId);
      merged.set(t.topicId, {
        topicId: t.topicId,
        topicTitle: t.topicTitle,
        average: t.average,
        counts: dist?.counts ?? null,
        totalResponses: dist?.totalResponses ?? 0,
      });
    });
    distByTopic.forEach((d, topicId) => {
      if (!merged.has(topicId)) {
        merged.set(topicId, {
          topicId,
          topicTitle: d.topicTitle,
          average: d.average,
          counts: d.counts,
          totalResponses: d.totalResponses,
        });
      }
    });
    return Array.from(merged.values()).sort((a, b) => a.topicTitle.localeCompare(b.topicTitle, 'pt-BR'));
  }, [skill, byTopic, topicDistribution]);

  const clickable = !!onTopicClick;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[85vh] flex flex-col p-0 overflow-hidden">
        <DialogHeader className="px-6 pt-6 pb-4 border-b shrink-0">
          <DialogTitle className="flex items-center gap-2">
            <IconChartBar className="h-5 w-5 text-primary" />
            Dados · {skill?.name ?? '—'}
          </DialogTitle>
          <DialogDescription className="text-sm text-foreground/75">
            {rows.length
              ? <><span className="font-medium">{rows.length}</span> tópico{rows.length !== 1 ? 's' : ''} desta competência no escopo selecionado{clickable ? ' — clique para ver as avaliações.' : '.'}</>
              : 'Nenhum tópico com respostas nesta competência para o escopo atual.'}
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 min-h-0 overflow-y-auto">
          <Table className="[&>div]:border-0 [&_th]:px-6 [&_td]:px-6">
            <TableHeader className="sticky top-0 z-10 bg-muted shadow-[inset_0_-1px_0_hsl(var(--border))]">
              <TableRow>
                <TableHead>Tópico</TableHead>
                <TableHead className="w-[200px]">Distribuição</TableHead>
                <TableHead className="text-right w-[110px]">Respostas</TableHead>
                <TableHead className="text-right w-[90px]">Média</TableHead>
                {clickable && <TableHead className="w-[40px]" />}
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={clickable ? 5 : 4} className="py-12 text-center text-sm text-foreground/60">
                    Nenhum tópico encontrado.
                  </TableCell>
                </TableRow>
              ) : (
                rows.map(row => (
                  <TableRow
                    key={row.topicId}
                    className={cn('text-sm', clickable && 'cursor-pointer hover:bg-muted/50')}
                    onClick={clickable ? () => onTopicClick?.({ id: row.topicId, name: row.topicTitle }) : undefined}
                  >
                    <TableCell className="font-medium max-w-[260px] truncate">{row.topicTitle}</TableCell>
                    <TableCell><DistributionBar counts={row.counts} total={row.totalResponses} /></TableCell>
                    <TableCell className="text-right text-foreground/85 tabular-nums">{row.totalResponses || '—'}</TableCell>
                    <TableCell className="text-right">
                      {row.average == null ? (
                        <span className="text-xs text-muted-foreground">—</span>
                      ) : (
                        <ScoreBadge score={Math.round(row.average)} label={row.average.toFixed(2)} size="md" />
                      )}
                    </TableCell>
                    {clickable && (
                      <TableCell className="text-right text-muted-foreground">
                        <IconChevronRight className="h-4 w-4 inline-block" />
                      </TableCell>
                    )}
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default SkillTopicsModal;
