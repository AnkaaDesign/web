// Details modal for the /estatisticas/departamento-pessoal/competencias page.
//
// Mirrors the productivity page's ProductionPeriodTasksModal pattern: list of
// raw rows behind whatever aggregate the user clicked on. For skill-assessment,
// the "raw rows" are AssessmentEntry records (one per User × Campaign), each
// optionally showing the specific topic's score when the click context was a
// single topic.

import { useMemo, useState, useEffect, type ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { Input } from '@/components/ui/input';
import { getAssessmentEntries } from '@/api-client/assessment-entry';
import { IconClipboardCheck, IconChevronUp, IconChevronDown, IconSelector } from '@tabler/icons-react';
import { ScoreBadge, getScoreLevelLabel } from '@/components/production/skill-assessment/score-badge';
import { cn } from '@/lib/utils';
import type { SkillStatsBaseFilters } from '@/types/skill-analytics';

// A click on the chart resolves into a primary X-axis selection and an
// optional series (in comparison views). 'position' is special — we only know
// the name (not the id), so we pass it through as the id slot to filter via
// users.position.name in the API where clause.
export type SkillStatsClickPrimary =
  | { type: 'skill';     id: string; name: string }
  | { type: 'topic';     id: string; name: string }
  | { type: 'sector';    id: string; name: string }
  | { type: 'user';      id: string; name: string }
  | { type: 'campaign';  id: string; name: string };

export type SkillStatsClickSecondary =
  | { type: 'sector';   id: string; name: string }
  | { type: 'user';     id: string; name: string }
  | { type: 'position'; name: string }
  | { type: 'skill';    id: string; name: string }
  | { type: 'topic';    id: string; name: string }
  | { type: 'campaign'; id: string; name: string };

export interface SkillStatsClickContext {
  primary?: SkillStatsClickPrimary;
  secondary?: SkillStatsClickSecondary;
  /**
   * When set, filter to evaluations whose response (for the scoped topic/skill)
   * equals this exact 0–5 score. Used by the distribution drill-down: clicking a
   * single colored band ("Atende: 4") lists only the users with that score.
   */
  score?: number;
  /**
   * Forces the row granularity. By default it's derived: a score-band click or a
   * collaborator×skill click lists individual responses (one row per
   * user×topic); everything else lists one row per evaluation (collaborator).
   */
  forceGranularity?: 'collaborator' | 'response';
  /** Optional headline override for the dialog. */
  titleOverride?: string;
}

interface SkillStatsEntriesModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  context: SkillStatsClickContext | null;
  baseFilters: SkillStatsBaseFilters;
}

export function buildTitle(context: SkillStatsClickContext | null): string {
  if (!context) return 'Avaliações';
  const parts: string[] = [];
  if (context.primary) {
    const labelByType: Record<SkillStatsClickPrimary['type'], string> = {
      skill: 'Competência',
      topic: 'Tópico',
      sector: 'Setor',
      user: 'Colaborador',
      campaign: 'Campanha',
    };
    parts.push(`${labelByType[context.primary.type]}: ${context.primary.name}`);
  }
  if (context.secondary) {
    const labelByType: Record<SkillStatsClickSecondary['type'], string> = {
      sector: 'Setor',
      user: 'Colaborador',
      position: 'Cargo',
      skill: 'Competência',
      topic: 'Tópico',
      campaign: 'Campanha',
    };
    parts.push(`${labelByType[context.secondary.type]}: ${context.secondary.name}`);
  }
  if (typeof context.score === 'number') {
    const lvl = getScoreLevelLabel(context.score);
    if (lvl) parts.push(`Nota: ${lvl}`);
  }
  // titleOverride is the headline for scope-less drills (KPI cards); compose it
  // with any structured parts rather than letting it hide an active score band.
  if (context.titleOverride) {
    return parts.length ? `${context.titleOverride} · ${parts.join(' · ')}` : context.titleOverride;
  }
  return parts.length ? parts.join(' · ') : 'Avaliações';
}

// Translates click context + base filters into a Prisma-style `where` plus
// hints (`responseTopicId` / `responseSkillId`) used to pick the right per-row
// score:
//   • responseTopicId → show that topic's response.score directly
//   • responseSkillId → show the average of responses whose topic.skillId matches
//   • neither        → show the entry's overall average across all responses
type Granularity = 'collaborator' | 'response';

function deriveQuery(
  context: SkillStatsClickContext | null,
  base: SkillStatsBaseFilters,
): {
  params: any;
  responseTopicId: string | undefined;
  responseSkillId: string | undefined;
  granularity: Granularity;
  scoreFilter: number | null;
} {
  const where: any = {};
  // Always exclude dismissed collaborators — they must never surface in the
  // score lists even when they have a real (historical) entry in scope.
  let evaluatee: any = { currentContractStatus: { not: 'TERMINATED' } };
  let responses: any = undefined;
  let responseTopicId: string | undefined;
  let responseSkillId: string | undefined;

  // ---- Base filters ----
  if (base.assessmentIds?.length) where.assessmentId = { in: base.assessmentIds };
  if (base.sectorIds?.length) evaluatee.sectorId = { in: base.sectorIds };
  if (base.userIds?.length) where.evaluateeId = { in: base.userIds };
  // skillIds without topics scope responses to that skill family.
  if (base.skillIds?.length && !base.topicIds?.length) {
    responses = { some: { topic: { skillId: { in: base.skillIds } } } };
    if (base.skillIds.length === 1) responseSkillId = base.skillIds[0];
  }
  if (base.topicIds?.length) {
    responses = { some: { topicId: { in: base.topicIds } } };
    if (base.topicIds.length === 1) responseTopicId = base.topicIds[0];
  }

  // ---- Primary context (specific selection) overrides base ----
  if (context?.primary) {
    switch (context.primary.type) {
      case 'campaign':
        where.assessmentId = context.primary.id;
        break;
      case 'sector':
        evaluatee = { ...evaluatee, sectorId: context.primary.id };
        break;
      case 'user':
        where.evaluateeId = context.primary.id;
        break;
      case 'topic':
        responseTopicId = context.primary.id;
        responseSkillId = undefined;
        responses = { some: { topicId: context.primary.id } };
        break;
      case 'skill':
        responseSkillId = context.primary.id;
        responseTopicId = undefined;
        responses = { some: { topic: { skillId: context.primary.id } } };
        break;
    }
  }

  // ---- Secondary context (series) further narrows ----
  if (context?.secondary) {
    switch (context.secondary.type) {
      case 'sector':
        evaluatee = { ...evaluatee, sectorId: context.secondary.id };
        break;
      case 'user':
        where.evaluateeId = context.secondary.id;
        break;
      case 'position':
        // We only have the position name (byUser exposes name not id), so we
        // join via users.position.name. Safe because position names are
        // unique in practice.
        evaluatee = { ...evaluatee, position: { is: { name: context.secondary.name } } };
        break;
      case 'skill':
        // A secondary skill narrows responses further. Don't override the
        // primary's topic if one was set (topic ⊂ skill); otherwise this
        // becomes the score-scoping skill.
        if (!responseTopicId) responseSkillId = context.secondary.id;
        responses = { some: { topic: { skillId: context.secondary.id } } };
        break;
      case 'topic':
        // Series = topic (e.g. X=campaign × series=topic). Scope to that topic's
        // responses so the listed score is the relevant one.
        responseTopicId = context.secondary.id;
        responseSkillId = undefined;
        responses = { some: { topicId: context.secondary.id } };
        break;
      case 'campaign':
        // Series = campaign (e.g. X=skill × series=campaign). Narrow to that
        // single campaign.
        where.assessmentId = context.secondary.id;
        break;
    }
  }

  // Distribution score-band drill-down: keep only entries whose response (for
  // the already-scoped topic/skill, if any) equals the clicked 0–5 score. Merge
  // into the existing `responses.some` so a topic/skill scope is preserved.
  if (typeof context?.score === 'number') {
    const some = responses?.some ? { ...responses.some } : {};
    some.score = context.score;
    responses = { some };
  }

  if (Object.keys(evaluatee).length > 0) where.evaluatee = { is: evaluatee };
  if (responses) where.responses = responses;

  // Status filter: respect includeInProgress (defaults to SUBMITTED only,
  // matching the backend's default behaviour on the analytics endpoints).
  const status = base.includeInProgress ? undefined : (['SUBMITTED'] as any);

  // Granularity: a score-band drill, or ANY collaborator drill, is about the
  // individual responses (one row per topic with its exact score) — not a single
  // averaged row. So clicking a colaborador shows the scores they actually got.
  const scoreFilter = typeof context?.score === 'number' ? context.score : null;
  const isUserPrimary = context?.primary?.type === 'user';
  const granularity: Granularity =
    context?.forceGranularity ??
    (scoreFilter != null || isUserPrimary ? 'response' : 'collaborator');

  return {
    params: {
      where,
      ...(status ? { status } : {}),
      limit: 200,
      include: {
        assessment: true,
        evaluatee: { include: { sector: true, position: true } },
        evaluator: true,
        // Always include responses (with topic + its skill) so we can compute a
        // per-row score for any scope AND sort/group by competência + topic order.
        responses: { include: { topic: { include: { skill: true } } } },
      },
      orderBy: [{ submittedAt: 'desc' }],
    },
    responseTopicId,
    responseSkillId,
    granularity,
    scoreFilter,
  };
}

export interface SkillEntriesPanelProps {
  context: SkillStatsClickContext | null;
  baseFilters: SkillStatsBaseFilters;
  /** Gates the query — pass the parent dialog's open state. */
  active?: boolean;
}

/** Body-only panel (no Dialog/header chrome). */
export function SkillEntriesPanel({ context, baseFilters, active = true }: SkillEntriesPanelProps) {
  const [search, setSearch] = useState('');

  const { params, responseTopicId, responseSkillId, granularity, scoreFilter } = useMemo(
    () => deriveQuery(context, baseFilters),
    [context, baseFilters],
  );
  const isResponseMode = granularity === 'response';

  const { data, isLoading, isError } = useQuery({
    queryKey: ['skill-stats-entries-modal', params],
    queryFn: () => getAssessmentEntries(params as any),
    enabled: active,
  });

  const rawEntries: any[] = (data as any)?.data ?? [];

  // Per-entry aggregate score (collaborator mode):
  // - topic scope → exact response.score (integer 0–5)
  // - skill scope → mean of that skill's topic responses in the entry
  // - default     → mean of all responses in the entry
  const computeEntryScore = (entry: any): number | null => {
    const responses: any[] = Array.isArray(entry?.responses) ? entry.responses : [];
    if (responseTopicId) {
      const r = responses.find(x => x?.topicId === responseTopicId);
      return typeof r?.score === 'number' ? r.score : null;
    }
    if (responseSkillId) {
      const filtered = responses.filter(x => x?.topic?.skillId === responseSkillId && typeof x?.score === 'number');
      if (!filtered.length) return null;
      return filtered.reduce((s, x) => s + (x.score as number), 0) / filtered.length;
    }
    const scored = responses.filter(x => typeof x?.score === 'number');
    if (!scored.length) return null;
    return scored.reduce((s, x) => s + (x.score as number), 0) / scored.length;
  };

  // Uniform row shape for both modes. Response mode expands each entry's
  // responses into one row per (collaborator × topic) matching the scope, with
  // the exact 0–5 score plus competência/tópico ordering for natural sorting.
  type Row = {
    id: string;
    name: string;
    sector: string;
    position: string;
    campaign: string;
    skillName: string;
    skillOrder: number;
    topicTitle: string;
    topicOrder: number;
    score: number | null;
    isAverage: boolean;
  };
  const rows = useMemo<Row[]>(() => {
    if (isResponseMode) {
      const out: Row[] = [];
      for (const e of rawEntries) {
        const responses: any[] = Array.isArray(e?.responses) ? e.responses : [];
        for (const r of responses) {
          if (typeof r?.score !== 'number') continue;
          if (responseTopicId && r.topicId !== responseTopicId) continue;
          if (responseSkillId && r.topic?.skillId !== responseSkillId) continue;
          if (scoreFilter != null && r.score !== scoreFilter) continue;
          out.push({
            id: `${e.id}:${r.topicId}`,
            name: e.evaluatee?.name ?? '—',
            sector: e.evaluatee?.sector?.name ?? '—',
            position: e.evaluatee?.position?.name ?? '—',
            campaign: e.assessment?.name ?? '—',
            skillName: r.topic?.skill?.name ?? '—',
            skillOrder: r.topic?.skill?.order ?? 0,
            topicTitle: r.topic?.title ?? '—',
            topicOrder: r.topic?.order ?? 0,
            score: r.score,
            isAverage: false,
          });
        }
      }
      return out;
    }
    return rawEntries.map(e => ({
      id: e.id,
      name: e.evaluatee?.name ?? '—',
      sector: e.evaluatee?.sector?.name ?? '—',
      position: e.evaluatee?.position?.name ?? '—',
      campaign: e.assessment?.name ?? '—',
      skillName: '—',
      skillOrder: 0,
      topicTitle: '—',
      topicOrder: 0,
      score: computeEntryScore(e),
      // topic-exact scope shows an integer; skill-mean / overall-mean → 2 decimals.
      isAverage: !responseTopicId,
    }));
  }, [rawEntries, isResponseMode, responseTopicId, responseSkillId, scoreFilter]);

  const filteredRows = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter(r =>
      r.name.toLowerCase().includes(q) ||
      r.sector.toLowerCase().includes(q) ||
      r.position.toLowerCase().includes(q) ||
      r.campaign.toLowerCase().includes(q) ||
      r.skillName.toLowerCase().includes(q) ||
      r.topicTitle.toLowerCase().includes(q),
    );
  }, [rows, search]);

  // ── Sortable columns ──────────────────────────────────────────────────────
  type Col = {
    key: string;
    label: string;
    align?: 'right';
    sortValue: (r: Row) => string | number;
    cell: (r: Row) => ReactNode;
  };
  const scoreCell = (r: Row): ReactNode =>
    r.score == null
      ? <span className="text-xs text-muted-foreground">—</span>
      : <ScoreBadge score={Math.round(r.score)} label={r.isAverage ? r.score.toFixed(2) : r.score.toFixed(0)} size="md" />;
  const naturalTopicKey = (r: Row) => r.skillOrder * 1000 + r.topicOrder;

  const columns = useMemo<Col[]>(() => {
    const colaborador: Col = { key: 'name', label: 'Colaborador', sortValue: r => r.name, cell: r => <span className="font-medium">{r.name}</span> };
    const setor: Col = { key: 'sector', label: 'Setor', sortValue: r => r.sector, cell: r => <span className="text-foreground/85">{r.sector}</span> };
    const score: Col = { key: 'score', label: isResponseMode || responseTopicId ? 'Nota' : 'Média', align: 'right', sortValue: r => r.score ?? -1, cell: scoreCell };
    if (isResponseMode) {
      return [
        colaborador,
        setor,
        { key: 'skill', label: 'Competência', sortValue: naturalTopicKey, cell: r => <span className="text-foreground/85">{r.skillName}</span> },
        { key: 'topic', label: 'Tópico', sortValue: naturalTopicKey, cell: r => <span className="text-foreground/85">{r.topicTitle}</span> },
        score,
      ];
    }
    return [
      colaborador,
      setor,
      { key: 'position', label: 'Cargo', sortValue: r => r.position, cell: r => <span className="text-foreground/85">{r.position}</span> },
      { key: 'campaign', label: 'Campanha', sortValue: r => r.campaign, cell: r => <span className="text-foreground/85">{r.campaign}</span> },
      score,
    ];
  }, [isResponseMode, responseTopicId]);

  // Default sort: response mode reads in natural competência+tópico order;
  // collaborator mode by highest score first. Reset when the mode flips.
  const [sort, setSort] = useState<{ key: string; dir: 'asc' | 'desc' }>(
    isResponseMode ? { key: 'topic', dir: 'asc' } : { key: 'score', dir: 'desc' },
  );
  useEffect(() => {
    setSort(isResponseMode ? { key: 'topic', dir: 'asc' } : { key: 'score', dir: 'desc' });
  }, [isResponseMode]);

  const sortedRows = useMemo(() => {
    const col = columns.find(c => c.key === sort.key) ?? columns[0];
    const arr = [...filteredRows];
    arr.sort((a, b) => {
      const va = col.sortValue(a);
      const vb = col.sortValue(b);
      const cmp = typeof va === 'number' && typeof vb === 'number'
        ? va - vb
        : String(va).localeCompare(String(vb), 'pt-BR');
      return sort.dir === 'asc' ? cmp : -cmp;
    });
    return arr;
  }, [filteredRows, columns, sort]);

  const onSort = (key: string) =>
    setSort(s => (s.key === key ? { key, dir: s.dir === 'asc' ? 'desc' : 'asc' } : { key, dir: 'asc' }));

  const total = rows.length;
  const noun = isResponseMode ? 'resposta' : 'avaliação';
  const nounPlural = isResponseMode ? 'respostas' : 'avaliações';
  const columnCount = columns.length;

  return (
    <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
        <p className="px-6 pt-3 pb-2 text-sm text-foreground/75 shrink-0">
          {isLoading
            ? 'Carregando…'
            : isError
              ? 'Erro ao carregar'
              : (
                <>
                  <span className="font-medium">{total}</span>{' '}
                  {total !== 1 ? nounPlural : noun} no escopo selecionado
                </>
              )}
        </p>
        <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
          <div className="px-6 pb-3 shrink-0 flex items-center justify-between gap-3">
            <Input
              type="text"
              placeholder={isResponseMode
                ? 'Buscar por colaborador, setor, competência ou tópico...'
                : 'Buscar por colaborador, setor, cargo ou campanha...'}
              value={search}
              onChange={v => setSearch(v == null ? '' : String(v))}
              className="flex-1"
            />
            {search.trim() && (
              <span className="text-xs text-foreground/65 shrink-0">
                {sortedRows.length} de {rows.length}
              </span>
            )}
          </div>

          {/* Inset, rounded table — not flush to the modal edges. Outer wrapper
              clips the rounded corners; inner div owns the scroll so the sticky
              <thead> still works. Click a header to sort by that column. */}
          <div className="flex-1 min-h-0 px-6 pb-5 flex flex-col overflow-hidden">
            <div className="flex-1 min-h-0 flex flex-col rounded-lg border border-border/50 overflow-hidden bg-card/30">
              <div className="flex-1 min-h-0 overflow-y-auto">
            <Table className="[&>div]:border-0 [&_th]:px-4 [&_td]:px-4">
              <TableHeader className="sticky top-0 z-10 bg-muted shadow-[inset_0_-1px_0_hsl(var(--border))]">
                <TableRow>
                  {columns.map(col => {
                    const active = sort.key === col.key;
                    return (
                      <TableHead key={col.key} className={cn(col.align === 'right' && 'text-right')}>
                        <button
                          type="button"
                          onClick={() => onSort(col.key)}
                          className={cn(
                            'inline-flex items-center gap-1 select-none transition-colors hover:text-foreground',
                            col.align === 'right' && 'flex-row-reverse',
                            active ? 'text-foreground' : 'text-muted-foreground',
                          )}
                        >
                          {col.label}
                          {active
                            ? (sort.dir === 'asc' ? <IconChevronUp className="h-3.5 w-3.5" /> : <IconChevronDown className="h-3.5 w-3.5" />)
                            : <IconSelector className="h-3.5 w-3.5 opacity-40" />}
                        </button>
                      </TableHead>
                    );
                  })}
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  Array.from({ length: 8 }).map((_, i) => (
                    <TableRow key={i}>
                      {Array.from({ length: columnCount }).map((_, j) => (
                        <TableCell key={j}><Skeleton className="h-4 w-full" /></TableCell>
                      ))}
                    </TableRow>
                  ))
                ) : isError ? (
                  <TableRow>
                    <TableCell colSpan={columnCount} className="text-center text-destructive py-10">
                      Erro ao carregar. Tente novamente.
                    </TableCell>
                  </TableRow>
                ) : sortedRows.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={columnCount} className="py-12 text-center text-sm text-foreground/60">
                      {search ? 'Nenhum resultado.' : 'Nenhum registro encontrado no escopo.'}
                    </TableCell>
                  </TableRow>
                ) : (
                  sortedRows.map(row => (
                    <TableRow key={row.id} className="text-sm">
                      {columns.map(col => (
                        <TableCell
                          key={col.key}
                          className={cn('max-w-[220px] truncate', col.align === 'right' && 'text-right')}
                        >
                          {col.cell(row)}
                        </TableCell>
                      ))}
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
              </div>
            </div>
          </div>
        </div>
    </div>
  );
}

export function SkillStatsEntriesModal({
  open,
  onOpenChange,
  context,
  baseFilters,
}: SkillStatsEntriesModalProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[85vh] flex flex-col p-0 overflow-hidden">
        <DialogHeader className="px-6 pt-6 pb-4 border-b shrink-0">
          <DialogTitle className="flex items-center gap-2">
            <IconClipboardCheck className="h-5 w-5 text-primary" />
            {buildTitle(context)}
          </DialogTitle>
          <DialogDescription className="sr-only">Avaliações no escopo selecionado.</DialogDescription>
        </DialogHeader>
        <SkillEntriesPanel context={context} baseFilters={baseFilters} active={open} />
      </DialogContent>
    </Dialog>
  );
}
