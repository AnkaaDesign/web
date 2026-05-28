// pages/administration/skill-assessment/entry/[entryId].tsx
//
// Admin read-only review of ONE AssessmentEntry, single-user adaptation of the
// leader MATRIX page: topic stepper + read-only NOTAS rail + averages cards +
// Δ vs the previous campaign. The right slot is contextual — when this topic has
// a PREVIOUS-campaign value it shows a SECOND NOTAS rail (current vs anterior,
// two rails side by side); otherwise it shows the Descrição + Comportamentos
// contrários in that space.

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Navigate, useParams, useSearchParams } from "react-router-dom";
import {
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
  IconRefresh,
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
  useAssessmentEntryComparison,
} from "../../../../hooks";
import type { Topic, TopicLevel } from "../../../../types";

import { PrivilegeRoute } from "@/components/navigation/privilege-route";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
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

interface ResolvedTopic {
  topic: Topic;
  levels: TopicLevel[];
  score: number | null;
  previousScore: number | null;
  justification: string;
}

export const SkillAssessmentEntryDetailsPage = () => {
  usePageTracker({ title: "Detalhe da Avaliação", icon: "clipboard-list" });
  const { id, entryId } = useParams<{ id: string; entryId: string }>();
  const [searchParams, setSearchParams] = useSearchParams();
  const [isReopenOpen, setIsReopenOpen] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);

  const {
    data: entryResp,
    isLoading: isLoadingEntry,
    isRefetching,
    refetch,
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

  const { data: comparisonResp } = useAssessmentEntryComparison(entryId);
  const reopenMut = useReopenAssessmentEntry(entryId ?? "");

  const entry = entryResp?.data;
  const assessment = assessmentResp?.data;
  const previousByTopic = comparisonResp?.data?.responsesByTopic ?? {};
  const previousAssessmentName = comparisonResp?.data?.assessmentName ?? null;

  const responsesByTopic = useMemo(() => {
    const map = new Map<string, any>();
    for (const r of (entry?.responses ?? []) as any[]) if (r.topicId) map.set(r.topicId, r);
    return map;
  }, [entry?.responses]);

  const resolvedTopics: ResolvedTopic[] = useMemo(() => {
    const join = (assessment?.topics ?? []) as any[];
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
          previousScore: topic.id in previousByTopic ? previousByTopic[topic.id] : null,
          justification: response?.justification ?? "",
        };
      });
  }, [assessment?.topics, responsesByTopic, previousByTopic]);

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

  const skillSummaries = useMemo(() => {
    const groups = new Map<string, { skillId: string; skillName: string; order: number; cur: number[]; prev: number[] }>();
    for (const rt of resolvedTopics) {
      const sid = rt.topic.skill?.id ?? "_";
      const sname = rt.topic.skill?.name ?? "Sem competência";
      const order = rt.topic.skill?.order ?? Number.MAX_SAFE_INTEGER;
      const g = groups.get(sid) ?? { skillId: sid, skillName: sname, order, cur: [], prev: [] };
      if (rt.score != null) g.cur.push(rt.score);
      if (rt.previousScore != null) g.prev.push(rt.previousScore);
      groups.set(sid, g);
    }
    return Array.from(groups.values())
      .sort((a, b) => a.order - b.order)
      .map((g) => ({ skillId: g.skillId, skillName: g.skillName, current: avg(g.cur), previous: avg(g.prev) }));
  }, [resolvedTopics]);

  const overall = useMemo(() => {
    const cur: number[] = [];
    const prev: number[] = [];
    for (const rt of resolvedTopics) {
      if (rt.score != null) cur.push(rt.score);
      if (rt.previousScore != null) prev.push(rt.previousScore);
    }
    return { current: avg(cur), previous: avg(prev) };
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
  const hasTopicHistory = active != null && active.previousScore != null;

  const handleReopen = async () => {
    try {
      await reopenMut.mutateAsync();
      setIsReopenOpen(false);
    } catch (err) {
      if (import.meta.env.DEV) console.error(err);
    }
  };

  const descricaoCard = active && (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-sm">
          <IconNotes className="h-4 w-4 text-muted-foreground" />
          Descrição
        </CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-sm leading-relaxed whitespace-pre-line text-foreground/90">
          {active.topic.description || <span className="italic text-muted-foreground">Sem descrição.</span>}
        </p>
      </CardContent>
    </Card>
  );
  const comportamentosCard = active && (
    <Card className="border-amber-500/30 bg-amber-50/30 dark:bg-amber-950/10">
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
            { label: "Administração" },
            { label: "Avaliação de Competências", href: routes.administration.skillAssessment.root },
            { label: assessment?.name ?? "Campanha", href: routes.administration.skillAssessment.details(id) },
            { label: entry.evaluatee?.name ?? "Avaliação" },
          ]}
          actions={[
            { key: "refresh", label: "Atualizar", icon: IconRefresh, onClick: () => refetch(), loading: isRefetching },
            ...(canReopen
              ? [{ key: "reopen", label: "Reabrir", icon: IconLockOpen, variant: "outline" as const, onClick: () => setIsReopenOpen(true), disabled: reopenMut.isPending }]
              : []),
          ]}
        />

        {/* Topic stepper bar — above the summary cards. */}
        <Card className="overflow-hidden p-0">
          <div className="flex items-center gap-2 p-2">
            <Button size="icon" variant="default" onClick={() => goToOffset(-1)} aria-label="Tópico anterior" className="h-12 w-12 shrink-0" disabled={totalTopics === 0}>
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
            <Button size="icon" variant="default" onClick={() => goToOffset(1)} aria-label="Próximo tópico" className="h-12 w-12 shrink-0" disabled={totalTopics === 0}>
              <IconChevronRight className="h-5 w-5" />
            </Button>
          </div>
        </Card>

        {/* Averages — bare cards (no title / card wrapper). */}
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
          {skillSummaries.map((s) => (
            <AverageCard key={s.skillId} label={s.skillName} current={s.current} previous={s.previous} />
          ))}
          <AverageCard label="Nota geral" current={overall.current} previous={overall.previous} highlight />
        </div>

        {active && (
          <>
            {hasTopicHistory ? (
              <>
                {/* With comparison: Descrição + Comportamentos contrários ABOVE the two rails. */}
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  {descricaoCard}
                  {comportamentosCard}
                </div>
                {/* Anterior (left) + Esta avaliação (right, always). */}
                <div className="grid grid-cols-1 items-stretch gap-4 lg:grid-cols-2">
                  <RailColumn label={`Anterior${previousAssessmentName ? ` · ${previousAssessmentName}` : ""}`}>
                    <ScoreLevelPicker topic={active.topic} currentScore={active.previousScore} readOnly onPickScore={noop} />
                  </RailColumn>
                  <RailColumn label="Esta avaliação">
                    <ScoreLevelPicker topic={active.topic} currentScore={active.score} readOnly onPickScore={noop} selectedAction={active.justification?.trim() ? <JustificationButton value={active.justification} /> : undefined} />
                  </RailColumn>
                </div>
              </>
            ) : (
              /* No comparison: description on the left, the current rail on the right (no label). */
              <div className="grid grid-cols-1 items-stretch gap-4 lg:grid-cols-2">
                <div className="flex flex-col gap-4">
                  {descricaoCard}
                  {comportamentosCard}
                </div>
                <div className="flex flex-col">
                  <ScoreLevelPicker topic={active.topic} currentScore={active.score} readOnly onPickScore={noop} selectedAction={active.justification?.trim() ? <JustificationButton value={active.justification} /> : undefined} />
                </div>
              </div>
            )}
          </>
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

/** Labelled column wrapping a NOTAS rail (so two rails can be told apart). */
function RailColumn({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-2">
      <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{label}</span>
      <div className="flex flex-1 flex-col">{children}</div>
    </div>
  );
}

// Badge sizing shared by all three summary badges so they're the same height.
const SUMMARY_BADGE = "px-3 py-1 text-sm";

function AverageCard({ label, current, previous, highlight }: { label: string; current: number | null; previous: number | null; highlight?: boolean }) {
  return (
    <div className="flex flex-col gap-2 rounded-lg border border-border bg-card p-3">
      <span className={cn("truncate text-xs leading-tight", highlight ? "font-semibold text-foreground" : "text-muted-foreground")}>{label}</span>
      {/* Sequence: old (if any) · new · difference — left-aligned, equal sizes. */}
      <div className="flex flex-wrap items-center gap-2">
        {previous != null && <Badge variant="secondary" className={cn(SUMMARY_BADGE, "tabular-nums")}>{previous.toFixed(2)}</Badge>}
        {current != null ? <ScoreBadge score={Math.round(current)} label={current.toFixed(2)} size="lg" /> : <Badge variant="secondary" className={SUMMARY_BADGE}>—</Badge>}
        <TendencyBadge current={current} previous={previous} />
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
