// pages/administration/skill-assessment/entry/[entryId].tsx
//
// Admin/HR feedback view of ONE collaborator's competency assessment — built to
// be presented to the collaborator in a 1:1 meeting:
//   • Médias                 — per-competency averages + nota geral (with up to
//                              2 past assessments as comparison columns)
//   • Detalhe por tópico     — description + contra-comportamentos and the score
//                              rubric rail; when comparing, one rail per selected
//                              assessment (description/contra-behaviour move to a
//                              row above the rails)
//   • Destaques              — Pontos fortes, A desenvolver, Melhora de
//                              Desempenho, Queda de Desempenho (each toggleable)
// The comparison picker selects up to TWO past assessments to benchmark against.

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Navigate, useParams, useSearchParams } from "react-router-dom";
import {
  IconAdjustmentsHorizontal,
  IconAlertCircle,
  IconArrowDownRight,
  IconArrowUpRight,
  IconChevronLeft,
  IconChevronRight,
  IconClipboardList,
  IconFlag3,
  IconLayoutGrid,
  IconLoader2,
  IconLockOpen,
  IconMessage2,
  IconMinus,
  IconNotes,
  IconTrendingDown,
  IconTrendingUp,
} from "@tabler/icons-react";

import {
  routes,
  SECTOR_PRIVILEGES,
  ASSESSMENT_ENTRY_STATUS,
} from "../../../../constants";
import {
  useAssessment,
  useAssessmentEntry,
  useReopenAssessmentEntry,
} from "../../../../hooks";
import { useAssessmentEntries } from "@/hooks/skill/use-assessment-entry";
import type { AssessmentEntry, Topic, TopicLevel } from "../../../../types";

import { PrivilegeRoute } from "@/components/navigation/privilege-route";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Combobox } from "@/components/ui/combobox";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { ScoreBadge } from "@/components/production/skill-assessment/score-badge";
import { ScoreLevelPicker } from "@/components/production/skill-assessment/matrix/score-level-picker";
import { StepperProgressBar } from "@/components/production/skill-assessment/matrix/stepper-progress-bar";
import { TopicPickerModal } from "@/components/production/skill-assessment/matrix/topic-picker-modal";
import { usePageTracker } from "@/hooks/common/use-page-tracker";
import { cn } from "@/lib/utils";

const noop = () => {};
const round2 = (n: number) => Math.round(n * 100) / 100;
const avg = (xs: number[]) => (xs.length ? round2(xs.reduce((a, b) => a + b, 0) / xs.length) : null);

const MAX_COMPARISONS = 2;
const TOP_N = 3;

interface ResolvedTopic {
  topic: Topic;
  levels: TopicLevel[];
  score: number | null;
  justification: string;
}

interface HighlightItem {
  id: string;
  score: number | null;
  title: string;
  subtitle: string;
}

export const SkillAssessmentEntryDetailsPage = () => {
  usePageTracker({ title: "Detalhe da Avaliação", icon: "clipboard-list" });
  const { id, entryId } = useParams<{ id: string; entryId: string }>();
  const [searchParams, setSearchParams] = useSearchParams();
  const [isReopenOpen, setIsReopenOpen] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);

  // ── Display config (feedback view) ─────────────────────────────────────────
  const [configOpen, setConfigOpen] = useState(false);
  // Defaults: only Médias + the per-topic detail (description, contra-behaviour,
  // current score) are shown; the highlight cards are opt-in via Config.
  const [showAverages, setShowAverages] = useState(true);
  const [showStrengths, setShowStrengths] = useState(false);
  const [showGaps, setShowGaps] = useState(false);
  const [showImprovement, setShowImprovement] = useState(false);
  const [showDecline, setShowDecline] = useState(false);
  const [comparisonIds, setComparisonIds] = useState<string[]>([]);

  const {
    data: entryResp,
    isLoading: isLoadingEntry,
    error: entryError,
  } = useAssessmentEntry(entryId, {
    include: {
      assessment: true,
      evaluatee: { include: { position: true, sector: true } },
      evaluator: true,
      responses: true,
    } as any,
  });

  const { data: assessmentResp, isLoading: isLoadingAssessment } = useAssessment(
    id ?? "",
    { include: { topics: { include: { topic: { include: { skill: true, levels: true } } } } } as any } as any,
  );

  const reopenMut = useReopenAssessmentEntry(entryId ?? "");

  const entry = entryResp?.data;
  const assessment = assessmentResp?.data;

  // The collaborator's full assessment history — feeds the comparison picker.
  const { data: historyResp } = useAssessmentEntries(
    entry?.evaluateeId
      ? { evaluateeId: entry.evaluateeId, include: { assessment: true, responses: true } as any, limit: 100 }
      : undefined,
    { enabled: !!entry?.evaluateeId },
  );

  const priorEntries = useMemo<AssessmentEntry[]>(() => {
    const currentCreatedAt = assessment?.createdAt ? new Date(assessment.createdAt).getTime() : Infinity;
    return ((historyResp?.data ?? []) as AssessmentEntry[])
      .filter(
        (e) =>
          e.id !== entryId &&
          e.assessment?.createdAt != null &&
          new Date(e.assessment.createdAt).getTime() < currentCreatedAt,
      )
      .sort(
        (a, b) =>
          new Date(b.assessment!.createdAt as any).getTime() - new Date(a.assessment!.createdAt as any).getTime(),
      );
  }, [historyResp, assessment?.createdAt, entryId]);

  // Selected comparisons, chronological (oldest → newest); current is implicitly newest.
  const selectedComparisons = useMemo(
    () =>
      priorEntries
        .filter((e) => comparisonIds.includes(e.assessmentId))
        .sort(
          (a, b) =>
            new Date(a.assessment!.createdAt as any).getTime() - new Date(b.assessment!.createdAt as any).getTime(),
        ),
    [priorEntries, comparisonIds],
  );
  const hasComparison = selectedComparisons.length > 0;

  const comparisonOptions = useMemo(
    () =>
      priorEntries.map((e) => {
        const name = e.assessment?.name ?? "Avaliação";
        const d = e.assessment?.periodEnd ?? e.assessment?.createdAt;
        return {
          value: e.assessmentId,
          label: d
            ? `${name} · ${new Date(d as any).toLocaleDateString("pt-BR", { month: "short", year: "numeric" })}`
            : name,
        };
      }),
    [priorEntries],
  );

  /** Per-topic score map for a given entry. */
  const byTopicOf = (e: AssessmentEntry): Record<string, number> => {
    const m: Record<string, number> = {};
    for (const r of (e.responses ?? []) as any[]) if (r.topicId != null && r.score != null) m[r.topicId] = r.score;
    return m;
  };
  const comparisonMaps = useMemo(() => selectedComparisons.map(byTopicOf), [selectedComparisons]);

  const resolvedTopics: ResolvedTopic[] = useMemo(() => {
    const join = (assessment?.topics ?? []) as any[];
    const responsesByTopic = new Map<string, any>();
    for (const r of (entry?.responses ?? []) as any[]) if (r.topicId) responsesByTopic.set(r.topicId, r);
    return [...join]
      .map((at) => at.topic as Topic | undefined)
      .filter((t): t is Topic => !!t)
      .sort((a, b) => {
        const sa = a.skill?.order ?? Number.MAX_SAFE_INTEGER;
        const sb = b.skill?.order ?? Number.MAX_SAFE_INTEGER;
        if (sa !== sb) return sa - sb;
        return (a.order ?? 0) - (b.order ?? 0);
      })
      .map<ResolvedTopic>((topic) => {
        const response = responsesByTopic.get(topic.id);
        return {
          topic,
          levels: ((topic.levels as TopicLevel[] | undefined) ?? []).slice().sort((a, b) => a.score - b.score),
          score: response?.score ?? null,
          justification: response?.justification ?? "",
        };
      });
  }, [assessment?.topics, entry?.responses]);

  // Per-skill rows: current average + an average for each selected comparison.
  const skillRows = useMemo(() => {
    const groups = new Map<string, { skillId: string; skillName: string; order: number; topicIds: string[] }>();
    for (const rt of resolvedTopics) {
      const sid = rt.topic.skill?.id ?? "_";
      const g =
        groups.get(sid) ??
        {
          skillId: sid,
          skillName: rt.topic.skill?.name ?? "Sem competência",
          order: rt.topic.skill?.order ?? Number.MAX_SAFE_INTEGER,
          topicIds: [] as string[],
        };
      g.topicIds.push(rt.topic.id);
      groups.set(sid, g);
    }
    const currentByTopic: Record<string, number> = {};
    for (const rt of resolvedTopics) if (rt.score != null) currentByTopic[rt.topic.id] = rt.score;
    const avgIn = (byTopic: Record<string, number>, topicIds: string[]) =>
      avg(topicIds.map((t) => byTopic[t]).filter((s): s is number => s != null));
    return Array.from(groups.values())
      .sort((a, b) => a.order - b.order)
      .map((g) => ({
        skillId: g.skillId,
        skillName: g.skillName,
        current: avgIn(currentByTopic, g.topicIds),
        comparisons: comparisonMaps.map((cb) => avgIn(cb, g.topicIds)),
      }));
  }, [resolvedTopics, comparisonMaps]);

  const overallRow = useMemo(() => {
    const cur = resolvedTopics.map((rt) => rt.score).filter((s): s is number => s != null);
    const comparisons = selectedComparisons.map((ce) =>
      avg(((ce.responses ?? []) as any[]).map((r) => r.score).filter((s): s is number => s != null)),
    );
    return { current: avg(cur), comparisons };
  }, [resolvedTopics, selectedComparisons]);

  // Per-topic improvements / declines vs the MOST RECENT selected comparison.
  const { improvements, declines } = useMemo(() => {
    const mostRecent = comparisonMaps.length ? comparisonMaps[comparisonMaps.length - 1] : null;
    if (!mostRecent) return { improvements: [] as any[], declines: [] as any[] };
    const withDelta = resolvedTopics
      .filter((rt) => rt.score != null && mostRecent[rt.topic.id] != null)
      .map((rt) => ({
        topic: rt.topic,
        current: rt.score as number,
        previous: mostRecent[rt.topic.id],
        delta: (rt.score as number) - mostRecent[rt.topic.id],
      }));
    return {
      improvements: withDelta.filter((x) => x.delta > 0).sort((a, b) => b.delta - a.delta).slice(0, TOP_N),
      declines: withDelta.filter((x) => x.delta < 0).sort((a, b) => a.delta - b.delta).slice(0, TOP_N),
    };
  }, [resolvedTopics, comparisonMaps]);

  const urlTopicId = searchParams.get("t");
  const activeTopicId =
    urlTopicId && resolvedTopics.some((rt) => rt.topic.id === urlTopicId)
      ? urlTopicId
      : resolvedTopics[0]?.topic.id ?? null;
  const activeIndex = activeTopicId ? resolvedTopics.findIndex((rt) => rt.topic.id === activeTopicId) : -1;
  const active = activeIndex >= 0 ? resolvedTopics[activeIndex] : null;
  const totalTopics = resolvedTopics.length;

  useEffect(() => {
    if (!urlTopicId && resolvedTopics.length > 0) {
      setSearchParams((prev) => {
        const next = new URLSearchParams(prev);
        next.set("t", resolvedTopics[0].topic.id);
        return next;
      }, { replace: true });
    }
  }, [urlTopicId, resolvedTopics, setSearchParams]);

  const goToTopic = (tid: string) =>
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      next.set("t", tid);
      return next;
    });
  const goToOffset = (offset: number) => {
    if (activeIndex < 0 || totalTopics === 0) return;
    goToTopic(resolvedTopics[(activeIndex + offset + totalTopics) % totalTopics].topic.id);
  };

  const { strengths, gaps } = useMemo(() => {
    const scored = resolvedTopics.filter((rt) => rt.score != null);
    const sorted = [...scored].sort((a, b) => (b.score as number) - (a.score as number));
    return { strengths: sorted.slice(0, TOP_N), gaps: [...sorted].reverse().slice(0, TOP_N) };
  }, [resolvedTopics]);

  const progressByTopic = useMemo(() => {
    const map = new Map<string, { scored: number; total: number }>();
    for (const rt of resolvedTopics) map.set(rt.topic.id, { scored: rt.score != null ? 1 : 0, total: 1 });
    return map;
  }, [resolvedTopics]);

  const isLoading = isLoadingEntry || isLoadingAssessment;

  if (!id || !entryId) return <Navigate to={routes.administration.skillAssessment.root} replace />;
  if (entryError) return <Navigate to={routes.administration.skillAssessment.details(id)} replace />;
  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <IconLoader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }
  if (!entry) return <Navigate to={routes.administration.skillAssessment.details(id)} replace />;

  const status = entry.status as ASSESSMENT_ENTRY_STATUS;
  const canReopen = status === ASSESSMENT_ENTRY_STATUS.SUBMITTED;

  const handleReopen = async () => {
    try {
      await reopenMut.mutateAsync();
      setIsReopenOpen(false);
    } catch (err) {
      if (import.meta.env.DEV) console.error(err);
    }
  };

  const levelName = (rt: ResolvedTopic) => rt.levels.find((l) => l.score === rt.score)?.name;
  const skillName = (t: Topic) => t.skill?.name ?? "";

  const strengthItems: HighlightItem[] = strengths.map((rt) => ({
    id: rt.topic.id,
    score: rt.score,
    title: rt.topic.title,
    subtitle: [skillName(rt.topic), levelName(rt)].filter(Boolean).join(" · "),
  }));
  const gapItems: HighlightItem[] = gaps.map((rt) => ({
    id: rt.topic.id,
    score: rt.score,
    title: rt.topic.title,
    subtitle: [skillName(rt.topic), levelName(rt)].filter(Boolean).join(" · "),
  }));
  const improvementItems: HighlightItem[] = improvements.map((c) => ({
    id: c.topic.id,
    score: c.current,
    title: c.topic.title,
    subtitle: `${skillName(c.topic)} · de ${c.previous} para ${c.current}`,
  }));
  const declineItems: HighlightItem[] = declines.map((c) => ({
    id: c.topic.id,
    score: c.current,
    title: c.topic.title,
    subtitle: `${skillName(c.topic)} · de ${c.previous} para ${c.current}`,
  }));

  const showStrengthsCard = showStrengths && strengthItems.length > 0;
  const showGapsCard = showGaps && gapItems.length > 0;
  const showImprovementCard = showImprovement && improvementItems.length > 0;
  const showDeclineCard = showDecline && declineItems.length > 0;
  const highlightCount = [showStrengthsCard, showGapsCard, showImprovementCard, showDeclineCard].filter(Boolean).length;
  const anyHighlight = highlightCount > 0;
  // Visible highlight cards fill the row — column count tracks how many show.
  const highlightCols =
    highlightCount <= 1 ? "md:grid-cols-1" : highlightCount === 2 ? "md:grid-cols-2" : highlightCount === 3 ? "md:grid-cols-3" : "md:grid-cols-4";

  // Per-topic rails: one per selected comparison (oldest→newest) + the current.
  const activeComparisonScores = active
    ? selectedComparisons.map((ce, i) => ({
        key: ce.id,
        name: ce.assessment?.name ?? "Avaliação",
        score: comparisonMaps[i]?.[active.topic.id] ?? null,
      }))
    : [];
  const railColsClass = activeComparisonScores.length >= 2 ? "lg:grid-cols-3" : "lg:grid-cols-2";

  const descricaoCard = active && (
    <Card className="flex flex-1 flex-col">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-sm">
          <IconNotes className="h-4 w-4 text-muted-foreground" />
          Descrição
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-1 flex-col">
        <p className="text-sm leading-relaxed whitespace-pre-line text-foreground/90">
          {active.topic.description || <span className="italic text-muted-foreground">Sem descrição.</span>}
        </p>
      </CardContent>
    </Card>
  );
  const comportamentosCard = active && (
    <Card className="flex flex-1 flex-col border-amber-500/30 bg-amber-50/30 dark:bg-amber-950/10">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-sm text-amber-700 dark:text-amber-300">
          <IconFlag3 className="h-4 w-4" />
          Comportamentos contrários
        </CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-sm leading-relaxed whitespace-pre-line text-amber-900 dark:text-amber-200">
          {active.topic.counterBehaviors || <span className="italic opacity-70">Sem comportamentos contrários cadastrados.</span>}
        </p>
      </CardContent>
    </Card>
  );
  const currentRail = active && (
    <ScoreLevelPicker
      topic={active.topic}
      currentScore={active.score}
      readOnly
      showHeader={false}
      onPickScore={noop}
      selectedAction={active.justification?.trim() ? <JustificationButton value={active.justification} /> : undefined}
    />
  );

  return (
    <PrivilegeRoute
      requiredPrivilege={[SECTOR_PRIVILEGES.ADMIN, SECTOR_PRIVILEGES.HUMAN_RESOURCES, SECTOR_PRIVILEGES.PRODUCTION_MANAGER]}
    >
      <div className="flex flex-col gap-4 bg-background px-4 pt-4 pb-6">
        <PageHeader
          variant="detail"
          title={entry.evaluatee?.name ?? "Avaliação"}
          icon={IconClipboardList}
          breadcrumbs={[
            { label: "Início", href: routes.home },
            { label: "Administração", href: routes.administration.root },
            { label: "Avaliação de Competências", href: routes.administration.skillAssessment.root },
            { label: assessment?.name ?? "Campanha", href: routes.administration.skillAssessment.details(id) },
            { label: entry.evaluatee?.name ?? "Avaliação" },
          ]}
          actions={[
            { key: "config", label: "Configurar", icon: IconAdjustmentsHorizontal, onClick: () => setConfigOpen(true) },
            ...(canReopen
              ? [{ key: "reopen", label: "Reabrir", icon: IconLockOpen, variant: "outline" as const, onClick: () => setIsReopenOpen(true), disabled: reopenMut.isPending }]
              : []),
          ]}
        />

        {/* ── Pager (topic navigation) ─────────────────────────────────────── */}
        <Card className="overflow-hidden p-0">
          <div className="flex items-center gap-2 p-2">
            <Button size="icon" variant="outline" onClick={() => goToOffset(-1)} aria-label="Tópico anterior" className="h-11 w-11 shrink-0" disabled={totalTopics === 0}>
              <IconChevronLeft className="h-5 w-5" />
            </Button>
            <button type="button" onClick={() => setPickerOpen(true)} className="group flex min-w-0 flex-1 flex-col gap-2 rounded-md px-3 py-2 text-left hover:bg-muted/40">
              <div className="flex min-w-0 items-center gap-3">
                <span className="truncate text-sm font-semibold leading-tight">{active?.topic.title ?? "—"}</span>
                <span className="ml-auto shrink-0 text-[10px] uppercase tracking-wide text-muted-foreground">
                  Tópico {activeIndex + 1} de {totalTopics}
                  {active?.topic.skill?.name ? ` · ${active.topic.skill.name}` : ""}
                </span>
                <IconLayoutGrid className="h-4 w-4 shrink-0 text-muted-foreground opacity-60 group-hover:opacity-100" />
              </div>
              <StepperProgressBar
                total={totalTopics}
                currentIndex={activeIndex}
                isScored={(i) => resolvedTopics[i]?.score != null}
                className="w-full"
              />
            </button>
            <Button size="icon" variant="outline" onClick={() => goToOffset(1)} aria-label="Próximo tópico" className="h-11 w-11 shrink-0" disabled={totalTopics === 0}>
              <IconChevronRight className="h-5 w-5" />
            </Button>
          </div>
        </Card>

        {/* ── Médias ───────────────────────────────────────────────────────── */}
        {showAverages && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Médias</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
                {skillRows.map((s) => (
                  <AverageCard key={s.skillId} label={s.skillName} current={s.current} comparisons={s.comparisons} />
                ))}
                <AverageCard label="Nota geral" current={overallRow.current} comparisons={overallRow.comparisons} highlight />
              </div>
            </CardContent>
          </Card>
        )}

        {/* ── Detalhe por tópico ───────────────────────────────────────────── */}
        {active &&
          (hasComparison ? (
            // Comparing: description + contra-behaviour in a row ABOVE, one rail per assessment below.
            <div className="flex flex-col gap-4">
              <div className="grid grid-cols-1 items-stretch gap-4 md:grid-cols-2">
                {descricaoCard}
                {comportamentosCard}
              </div>
              <div className={cn("grid grid-cols-1 items-stretch gap-4", railColsClass)}>
                {activeComparisonScores.map((c) => (
                  <RailColumn key={c.key} label={c.name}>
                    <ScoreLevelPicker topic={active.topic} currentScore={c.score} readOnly showHeader={false} onPickScore={noop} />
                  </RailColumn>
                ))}
                <RailColumn label={assessment?.name ?? "Esta avaliação"} highlight>
                  {currentRail}
                </RailColumn>
              </div>
            </div>
          ) : (
            // No comparison: description/contra-behaviour on the left, current rail on the right.
            <div className="grid grid-cols-1 items-stretch gap-4 lg:grid-cols-2">
              <div className="flex flex-col gap-4">
                {descricaoCard}
                {comportamentosCard}
              </div>
              <div className="flex flex-col">{currentRail}</div>
            </div>
          ))}

        {/* ── Destaques (below the detail, single row, each toggleable) ─────── */}
        {anyHighlight && (
          <div className={cn("grid grid-cols-1 gap-4", highlightCols)}>
            {showStrengthsCard && (
              <HighlightCard
                title="Pontos fortes"
                icon={<IconArrowUpRight className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />}
                items={strengthItems}
              />
            )}
            {showGapsCard && (
              <HighlightCard
                title="A desenvolver"
                icon={<IconFlag3 className="h-4 w-4 text-amber-600 dark:text-amber-400" />}
                items={gapItems}
              />
            )}
            {showImprovementCard && (
              <HighlightCard
                title="Melhora de Desempenho"
                icon={<IconTrendingUp className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />}
                items={improvementItems}
              />
            )}
            {showDeclineCard && (
              <HighlightCard
                title="Queda de Desempenho"
                icon={<IconTrendingDown className="h-4 w-4 text-red-600 dark:text-red-400" />}
                items={declineItems}
              />
            )}
          </div>
        )}
      </div>

      <TopicPickerModal
        open={pickerOpen}
        onOpenChange={setPickerOpen}
        topics={resolvedTopics.map((rt) => rt.topic)}
        activeTopicId={activeTopicId}
        progressByTopic={progressByTopic}
        onSelect={(tid) => { goToTopic(tid); setPickerOpen(false); }}
      />

      <Dialog open={configOpen} onOpenChange={setConfigOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <IconAdjustmentsHorizontal className="h-5 w-5 text-muted-foreground" />
              Configurar exibição
            </DialogTitle>
            <DialogDescription>
              Escolha o que mostrar ao apresentar este resultado para o colaborador.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-5 py-1">
            <section className="space-y-2">
              <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Seções</h4>
              <div className="divide-y divide-border/60 rounded-lg border border-border/60">
                <ConfigRow label="Médias" desc="Médias por competência e nota geral." checked={showAverages} onChange={setShowAverages} />
                <ConfigRow label="Pontos fortes" desc="Tópicos com as maiores notas." checked={showStrengths} onChange={setShowStrengths} />
                <ConfigRow label="A desenvolver" desc="Tópicos com as menores notas." checked={showGaps} onChange={setShowGaps} />
                <ConfigRow label="Melhora de Desempenho" desc="Maiores evoluções vs. a comparação." checked={showImprovement} onChange={setShowImprovement} />
                <ConfigRow label="Queda de Desempenho" desc="Maiores quedas vs. a comparação." checked={showDecline} onChange={setShowDecline} />
              </div>
            </section>

            <section className="space-y-2">
              <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Comparação</h4>
              <div className="space-y-1.5 rounded-lg border border-border/60 p-3">
                <Label className="text-sm">Comparar com avaliações (até {MAX_COMPARISONS})</Label>
                <Combobox
                  mode="multiple"
                  value={comparisonIds}
                  onValueChange={(v) => {
                    const arr = Array.isArray(v) ? v : v ? [v] : [];
                    setComparisonIds(arr.slice(-MAX_COMPARISONS));
                  }}
                  options={comparisonOptions}
                  placeholder="Nenhuma comparação"
                  searchable
                  disabled={priorEntries.length === 0}
                />
                <p className="text-xs text-muted-foreground">
                  {priorEntries.length === 0
                    ? "Este colaborador não possui avaliações anteriores."
                    : `Selecione até ${MAX_COMPARISONS} avaliações. Cada uma vira uma coluna de nota.`}
                </p>
              </div>
            </section>
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog open={isReopenOpen} onOpenChange={setIsReopenOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <IconLockOpen className="h-5 w-5 text-amber-500" />
              Reabrir avaliação?
            </AlertDialogTitle>
            <AlertDialogDescription>
              A avaliação voltará ao status "Em progresso" e o líder poderá ajustar as respostas. O
              histórico não será apagado.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleReopen} disabled={reopenMut.isPending}>Reabrir</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </PrivilegeRoute>
  );
};

/** A single config row: label + description + switch. */
function ConfigRow({
  label,
  desc,
  checked,
  onChange,
}: {
  label: string;
  desc: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-4 p-3">
      <div className="space-y-0.5">
        <Label className="text-sm">{label}</Label>
        <p className="text-xs text-muted-foreground">{desc}</p>
      </div>
      <Switch checked={checked} onCheckedChange={onChange} />
    </div>
  );
}

/** Labelled column wrapping a NOTAS rail (so rails can be told apart). */
function RailColumn({ label, children, highlight }: { label: string; children: ReactNode; highlight?: boolean }) {
  return (
    <div className="flex flex-col gap-2">
      <span className={cn("truncate text-xs font-semibold uppercase tracking-wide", highlight ? "text-primary" : "text-muted-foreground")}>
        {label}
      </span>
      <div className="flex flex-1 flex-col">{children}</div>
    </div>
  );
}

/** A highlight card (Pontos fortes / A desenvolver / Melhora / Queda) — each row
 *  is a ScoreBadge + topic title + subtitle, so all four read consistently. */
function HighlightCard({ title, icon, items }: { title: string; icon: ReactNode; items: HighlightItem[] }) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-sm">
          {icon}
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {items.map((it) => (
          <div key={it.id} className="flex items-center gap-3">
            <ScoreBadge score={it.score} size="md" />
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-medium">{it.title}</div>
              <div className="truncate text-xs text-muted-foreground">{it.subtitle}</div>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

// Badge sizing shared by the summary badges so they're the same height.
const SUMMARY_BADGE = "px-3 py-1 text-sm";

/** Per-skill average tile: up to 2 comparison score columns (oldest→newest), the
 *  current score (colored), and a tendency badge vs the most-recent comparison. */
function AverageCard({
  label,
  current,
  comparisons,
  highlight,
}: {
  label: string;
  current: number | null;
  comparisons: (number | null)[];
  highlight?: boolean;
}) {
  const mostRecentComparison = comparisons.length ? comparisons[comparisons.length - 1] : null;
  return (
    <div className="flex flex-col gap-2 rounded-lg border border-border bg-card p-3">
      <span className={cn("truncate text-xs leading-tight", highlight ? "font-semibold text-foreground" : "text-muted-foreground")}>{label}</span>
      <div className="flex flex-wrap items-center gap-1.5">
        {comparisons.map((c, i) =>
          c != null ? (
            <Badge key={i} variant="secondary" className={cn(SUMMARY_BADGE, "tabular-nums")}>
              {c.toFixed(2)}
            </Badge>
          ) : null,
        )}
        {current != null ? (
          <ScoreBadge score={Math.round(current)} label={current.toFixed(2)} size="lg" />
        ) : (
          <Badge variant="secondary" className={SUMMARY_BADGE}>—</Badge>
        )}
        <TendencyBadge current={current} previous={mostRecentComparison} />
      </div>
    </div>
  );
}

/** Tendency shown as a colored % badge — direction conveyed by the icon (no +/- sign). */
function TendencyBadge({ current, previous }: { current: number | null; previous: number | null }) {
  if (current == null || previous == null) return null;
  const diff = current - previous;
  const pct = previous !== 0 ? (diff / previous) * 100 : diff !== 0 ? 100 : 0;
  const up = diff > 0;
  const down = diff < 0;
  return (
    <Badge
      className={cn(
        "gap-0.5 border-transparent tabular-nums text-white",
        SUMMARY_BADGE,
        up ? "bg-emerald-600 hover:bg-emerald-600" : down ? "bg-red-700 hover:bg-red-700" : "bg-neutral-500 hover:bg-neutral-500",
      )}
    >
      {up ? <IconArrowUpRight className="h-4 w-4" /> : down ? <IconArrowDownRight className="h-4 w-4" /> : <IconMinus className="h-4 w-4" />}
      {Math.abs(Math.round(pct))}%
    </Badge>
  );
}

/** Justification shown as a visible pill on the selected score card; opens a modal. */
function JustificationButton({ value }: { value: string }) {
  const has = !!value?.trim();
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button
          type="button"
          size="sm"
          aria-label="Ver justificativa"
          className="h-7 gap-1 border border-white/30 bg-white/20 px-2 text-xs font-medium text-white shadow-sm hover:bg-white/30"
        >
          <IconAlertCircle className="h-4 w-4" />
          Justificativa
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <IconMessage2 className="h-5 w-5 text-muted-foreground" />
            Justificativa
          </DialogTitle>
        </DialogHeader>
        {has ? (
          <p className="whitespace-pre-wrap text-sm leading-relaxed text-foreground/90">{value}</p>
        ) : (
          <p className="text-sm italic text-muted-foreground">Nenhuma justificativa registrada.</p>
        )}
      </DialogContent>
    </Dialog>
  );
}

export default SkillAssessmentEntryDetailsPage;
