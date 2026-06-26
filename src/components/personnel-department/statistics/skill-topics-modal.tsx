// DATA drill-down content for the /estatisticas/departamento-pessoal/competencias
// page. About the NUMBERS: each topic's average score, response count and score
// distribution in the active scope; clicking a topic drills into the raw
// evaluations behind it.
//
// (For "what is this skill/topic" — descriptions + contrary behaviour — see the
// sibling SkillInfoPanel.) Rendered as a panel inside SkillDrilldownModal, and
// also exposed as a standalone SkillTopicsModal wrapper.

import { useMemo, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { IconChartBar, IconChevronRight } from '@tabler/icons-react';
import { ScoreBadge, getScoreBadgeClasses } from '@/components/production/skill-assessment/score-badge';
import { cn } from '@/lib/utils';
import type {
  SkillStatsTopicRadarPoint,
  SkillStatsTopicDistribution,
} from '@/types/skill-analytics';

interface TopicRow {
  topicId: string;
  topicTitle: string;
  average: number | null;
  counts: [number, number, number, number, number, number] | null;
  totalResponses: number;
}

export function DistributionBar({ counts, total }: { counts: [number, number, number, number, number, number] | null; total: number }) {
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

export interface SkillTopicsPanelProps {
  skill: { id: string; name: string } | null;
  byTopic: SkillStatsTopicRadarPoint[];
  topicDistribution: SkillStatsTopicDistribution[];
  onTopicClick?: (topic: { id: string; name: string }) => void;
}

function useTopicRows({ skill, byTopic, topicDistribution }: SkillTopicsPanelProps): TopicRow[] {
  return useMemo<TopicRow[]>(() => {
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
}

/** Body-only panel (no Dialog/header chrome). */
export function SkillTopicsPanel(props: SkillTopicsPanelProps) {
  const rows = useTopicRows(props);
  const clickable = !!props.onTopicClick;
  const [search, setSearch] = useState('');

  const filteredRows = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter(r => r.topicTitle.toLowerCase().includes(q));
  }, [rows, search]);

  return (
    <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
      <p className="px-6 pt-3 pb-2 text-sm text-foreground/75 shrink-0">
        {rows.length
          ? <><span className="font-medium">{rows.length}</span> tópico{rows.length !== 1 ? 's' : ''} desta competência no escopo selecionado{clickable ? ' — clique para ver as avaliações.' : '.'}</>
          : 'Nenhum tópico com respostas nesta competência para o escopo atual.'}
      </p>
      {rows.length > 0 && (
        <div className="px-6 pb-3 shrink-0 flex items-center justify-between gap-3">
          <Input
            type="text"
            placeholder="Buscar tópico..."
            value={search}
            onChange={v => setSearch(v == null ? '' : String(v))}
            className="flex-1"
          />
          {search.trim() && (
            <span className="text-xs text-foreground/65 shrink-0">
              {filteredRows.length} de {rows.length}
            </span>
          )}
        </div>
      )}
      <div className="flex-1 min-h-0 px-6 pb-5 flex flex-col overflow-hidden">
        <div className="flex-1 min-h-0 flex flex-col rounded-lg border border-border/50 overflow-hidden bg-card/30">
          <div className="flex-1 min-h-0 overflow-y-auto">
        <Table className="[&>div]:border-0 [&_th]:px-4 [&_td]:px-4">
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
            {filteredRows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={clickable ? 5 : 4} className="py-12 text-center text-sm text-foreground/60">
                  {search ? 'Nenhum tópico corresponde à busca.' : 'Nenhum tópico encontrado.'}
                </TableCell>
              </TableRow>
            ) : (
              filteredRows.map(row => (
                <TableRow
                  key={row.topicId}
                  className={cn('text-sm', clickable && 'cursor-pointer hover:bg-muted/50')}
                  onClick={clickable ? () => props.onTopicClick?.({ id: row.topicId, name: row.topicTitle }) : undefined}
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
        </div>
      </div>
    </div>
  );
}

interface SkillTopicsModalProps extends SkillTopicsPanelProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function SkillTopicsModal({ open, onOpenChange, ...panel }: SkillTopicsModalProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[85vh] flex flex-col p-0 overflow-hidden">
        <DialogHeader className="px-6 pt-6 pb-4 border-b shrink-0">
          <DialogTitle className="flex items-center gap-2">
            <IconChartBar className="h-5 w-5 text-primary" />
            Dados · {panel.skill?.name ?? '—'}
          </DialogTitle>
          <DialogDescription className="sr-only">Tópicos e distribuição de notas da competência.</DialogDescription>
        </DialogHeader>
        <SkillTopicsPanel {...panel} />
      </DialogContent>
    </Dialog>
  );
}

export default SkillTopicsModal;
