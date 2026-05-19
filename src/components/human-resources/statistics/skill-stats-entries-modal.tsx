// Details modal for the /estatisticas/recursos-humanos/competencias page.
//
// Mirrors the productivity page's ProductionPeriodTasksModal pattern: list of
// raw rows behind whatever aggregate the user clicked on. For skill-assessment,
// the "raw rows" are AssessmentEntry records (one per User × Campaign), each
// optionally showing the specific topic's score when the click context was a
// single topic.

import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { Input } from '@/components/ui/input';
import { getAssessmentEntries } from '@/api-client/assessment-entry';
import { IconClipboardCheck } from '@tabler/icons-react';
import { ScoreBadge } from '@/components/production/skill-assessment/score-badge';
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
  | { type: 'skill';    id: string; name: string };

export interface SkillStatsClickContext {
  primary?: SkillStatsClickPrimary;
  secondary?: SkillStatsClickSecondary;
  /** Optional headline override for the dialog. */
  titleOverride?: string;
}

interface SkillStatsEntriesModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  context: SkillStatsClickContext | null;
  baseFilters: SkillStatsBaseFilters;
}

function buildTitle(context: SkillStatsClickContext | null): string {
  if (!context) return 'Avaliações';
  if (context.titleOverride) return context.titleOverride;
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
    };
    parts.push(`${labelByType[context.secondary.type]}: ${context.secondary.name}`);
  }
  return parts.length ? parts.join(' · ') : 'Avaliações';
}

// Translates click context + base filters into a Prisma-style `where` plus
// hints (`responseTopicId` / `responseSkillId`) used to pick the right per-row
// score:
//   • responseTopicId → show that topic's response.score directly
//   • responseSkillId → show the average of responses whose topic.skillId matches
//   • neither        → show the entry's overall average across all responses
function deriveQuery(
  context: SkillStatsClickContext | null,
  base: SkillStatsBaseFilters,
): { params: any; responseTopicId: string | undefined; responseSkillId: string | undefined } {
  const where: any = {};
  let evaluatee: any = {};
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
    }
  }

  if (Object.keys(evaluatee).length > 0) where.evaluatee = { is: evaluatee };
  if (responses) where.responses = responses;

  // Status filter: respect includeInProgress (defaults to SUBMITTED only,
  // matching the backend's default behaviour on the analytics endpoints).
  const status = base.includeInProgress ? undefined : (['SUBMITTED'] as any);

  return {
    params: {
      where,
      ...(status ? { status } : {}),
      limit: 200,
      include: {
        assessment: true,
        evaluatee: { include: { sector: true, position: true } },
        evaluator: true,
        // Always include responses (with topic.skillId) so we can compute a
        // per-row score for any scope, not just topic clicks.
        responses: { include: { topic: true } },
      },
      orderBy: [{ submittedAt: 'desc' }],
    },
    responseTopicId,
    responseSkillId,
  };
}

export function SkillStatsEntriesModal({
  open,
  onOpenChange,
  context,
  baseFilters,
}: SkillStatsEntriesModalProps) {
  const [search, setSearch] = useState('');

  const { params, responseTopicId, responseSkillId } = useMemo(
    () => deriveQuery(context, baseFilters),
    [context, baseFilters],
  );

  // Header for the score column adapts to scope so users know *what* number
  // they're seeing without having to re-read the dialog title.
  const scoreColumnLabel = responseTopicId
    ? 'Nota'
    : responseSkillId
      ? 'Média'
      : 'Média';

  // Per-entry score:
  // - topic scope → exact response.score (integer 0–5)
  // - skill scope → mean of that skill's topic responses in the entry
  // - default     → mean of all responses in the entry
  const computeScore = (entry: any): number | null => {
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

  // Matches the canonical formatting used by entries-table / campaign-analytics:
  // integer for direct topic scores, two-decimal for aggregates.
  const formatScoreLabel = (v: number): string =>
    responseTopicId ? v.toFixed(0) : v.toFixed(2);

  const { data, isLoading, isError } = useQuery({
    queryKey: ['skill-stats-entries-modal', params],
    queryFn: () => getAssessmentEntries(params as any),
    enabled: open,
  });

  const rawEntries: any[] = (data as any)?.data ?? [];
  const total = (data as any)?.meta?.totalRecords ?? (data as any)?.meta?.total ?? rawEntries.length;

  const filteredEntries = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return rawEntries;
    return rawEntries.filter(e => {
      const name = (e.evaluatee?.name ?? '').toLowerCase();
      const sector = (e.evaluatee?.sector?.name ?? '').toLowerCase();
      const position = (e.evaluatee?.position?.name ?? '').toLowerCase();
      const assessment = (e.assessment?.name ?? '').toLowerCase();
      return (
        name.includes(q) ||
        sector.includes(q) ||
        position.includes(q) ||
        assessment.includes(q)
      );
    });
  }, [rawEntries, search]);

  // 4 fixed columns (Colaborador, Setor, Cargo, Campanha) + always-on score.
  const columnCount = 5;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[85vh] flex flex-col p-0 overflow-hidden">
        <DialogHeader className="px-6 pt-6 pb-4 border-b shrink-0">
          <DialogTitle className="flex items-center gap-2">
            <IconClipboardCheck className="h-5 w-5 text-primary" />
            {buildTitle(context)}
          </DialogTitle>
          <DialogDescription className="text-sm text-foreground/75">
            {isLoading
              ? 'Carregando avaliações…'
              : isError
                ? 'Erro ao carregar'
                : (
                  <>
                    <span className="font-medium">{total}</span>{' '}
                    avaliaç{total !== 1 ? 'ões' : 'ão'} no escopo selecionado
                  </>
                )}
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
          <div className="px-6 py-3 border-b shrink-0 flex items-center justify-between gap-3">
            <Input
              type="text"
              placeholder="Buscar por colaborador, setor, cargo ou campanha..."
              value={search}
              onChange={v => setSearch(v == null ? '' : String(v))}
              className="flex-1"
            />
            {search.trim() && (
              <span className="text-xs text-foreground/65 shrink-0">
                {filteredEntries.length} de {rawEntries.length}
              </span>
            )}
          </div>

          {/* Plain overflow-y-auto, not Radix ScrollArea — see productivity
              modal for the rationale around sticky <thead>. */}
          <div className="flex-1 min-h-0 overflow-y-auto">
            <Table className="[&>div]:border-0 [&_th]:px-6 [&_td]:px-6">
              <TableHeader className="sticky top-0 z-10 bg-muted shadow-[inset_0_-1px_0_hsl(var(--border))]">
                <TableRow>
                  <TableHead>Colaborador</TableHead>
                  <TableHead>Setor</TableHead>
                  <TableHead>Cargo</TableHead>
                  <TableHead>Campanha</TableHead>
                  <TableHead className="text-right">{scoreColumnLabel}</TableHead>
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
                      Erro ao carregar avaliações. Tente novamente.
                    </TableCell>
                  </TableRow>
                ) : filteredEntries.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={columnCount} className="py-12 text-center text-sm text-foreground/60">
                      {search ? 'Nenhum resultado.' : 'Nenhuma avaliação encontrada no escopo.'}
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredEntries.map((entry: any) => (
                    <TableRow key={entry.id} className="text-sm">
                      <TableCell className="font-medium max-w-[200px] truncate">
                        {entry.evaluatee?.name ?? '—'}
                      </TableCell>
                      <TableCell className="text-foreground/85 max-w-[160px] truncate">
                        {entry.evaluatee?.sector?.name ?? '—'}
                      </TableCell>
                      <TableCell className="text-foreground/85 max-w-[160px] truncate">
                        {entry.evaluatee?.position?.name ?? '—'}
                      </TableCell>
                      <TableCell className="text-foreground/85 max-w-[200px] truncate">
                        {entry.assessment?.name ?? '—'}
                      </TableCell>
                      <TableCell className="text-right">
                        {(() => {
                          const v = computeScore(entry);
                          return v == null ? (
                            <span className="text-xs text-muted-foreground">—</span>
                          ) : (
                            <ScoreBadge score={Math.round(v)} label={formatScoreLabel(v)} size="md" />
                          );
                        })()}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
