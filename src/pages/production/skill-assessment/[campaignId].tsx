// pages/production/skill-assessment/[campaignId].tsx
//
// Leader's per-campaign topic-paged page. Shows ONE topic at a time and
// every evaluatee for the leader's sector beneath it. The rubric (0..5
// level cards) is rendered alongside so leaders normalise their scoring
// against the same reference for everyone.
//
// State flow:
//   - URL holds the active topic via `?t=<topicId>` so reloads / shares
//     deep-link to the same topic.
//   - Each evaluatee row autosaves on change (350ms debounce, race-safe via
//     `useResponseCell`).
//   - Per-row submit available once all topics for that entry are scored.

import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import {
  IconAlertTriangle,
  IconCalendar,
  IconChevronLeft,
  IconChevronRight,
  IconClipboardList,
  IconLayoutGrid,
} from "@tabler/icons-react";

import { PrivilegeRoute } from "@/components/navigation/privilege-route";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";

import { usePageTracker } from "@/hooks/common/use-page-tracker";
import { useAssessment } from "@/hooks/skill/use-assessment";
import { useAssessmentEntries } from "@/hooks/skill/use-assessment-entry";
import { ASSESSMENT_ENTRY_STATUS, routes } from "@/constants";
import type { AssessmentEntry, Topic } from "@/types";

import { EvaluateesTable } from "@/components/production/skill-assessment/matrix/evaluatees-table";
import { TopicRubricRail } from "@/components/production/skill-assessment/matrix/topic-rubric-rail";
import { TopicPickerModal } from "@/components/production/skill-assessment/matrix/topic-picker-modal";

const JUSTIFICATION_REQUIRED_THRESHOLD = 2;

const formatDateRange = (start?: Date | string | null, end?: Date | string | null) => {
  if (!start || !end) return "";
  const s = new Date(start);
  const e = new Date(end);
  const fmt = (d: Date) =>
    d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });
  return `${fmt(s)} – ${fmt(e)}`;
};

export const SkillAssessmentCampaignPage = () => {
  const { campaignId } = useParams<{ campaignId: string }>();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [hoveredScore, setHoveredScore] = useState<number | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);

  usePageTracker({ title: "Avaliação por tópico", icon: "clipboard-list" });

  // Pull the campaign with topic + level catalogue.
  const {
    data: assessmentResp,
    isLoading: isLoadingAssessment,
    isError: assessmentError,
  } = useAssessment(
    campaignId,
    {
      include: {
        topics: {
          include: { topic: { include: { skill: true, levels: true } } },
        },
      },
    },
    { enabled: !!campaignId },
  );
  const assessment = assessmentResp?.data;

  // Pull every entry in this campaign assigned to ME (server scopes to
  // evaluatorId=current user for non-admin roles).
  const {
    data: entriesResp,
    isLoading: isLoadingEntries,
  } = useAssessmentEntries(
    campaignId
      ? {
          assessmentId: campaignId,
          evaluatorId: "me",
          include: {
            evaluatee: { include: { position: true, sector: true } },
            responses: true,
          },
          limit: 100,
        }
      : undefined,
    { enabled: !!campaignId },
  );
  const entries: AssessmentEntry[] = entriesResp?.data ?? [];

  // Sort entries by position.hierarchy (asc = higher seniority first) then by
  // name. Position is optional → trailing entries with no position drop to
  // the bottom but stay name-sorted among themselves.
  const sortedEntries = useMemo(() => {
    return [...entries].sort((a, b) => {
      const ha = a.evaluatee?.position?.hierarchy ?? Number.MAX_SAFE_INTEGER;
      const hb = b.evaluatee?.position?.hierarchy ?? Number.MAX_SAFE_INTEGER;
      if (ha !== hb) return ha - hb;
      const na = a.evaluatee?.name ?? "";
      const nb = b.evaluatee?.name ?? "";
      return na.localeCompare(nb, "pt-BR");
    });
  }, [entries]);

  // Flatten topics, sorted by skill.order then topic.order (canonical order).
  const topics: Topic[] = useMemo(() => {
    const join = assessment?.topics ?? [];
    return join
      .map((at) => at.topic)
      .filter((t): t is Topic => !!t)
      .sort((a, b) => {
        const sa = a.skill?.order ?? Number.MAX_SAFE_INTEGER;
        const sb = b.skill?.order ?? Number.MAX_SAFE_INTEGER;
        if (sa !== sb) return sa - sb;
        return (a.order ?? 0) - (b.order ?? 0);
      });
  }, [assessment]);

  // Resolve active topic from URL (?t=<id>) or default to first.
  const urlTopicId = searchParams.get("t");
  const activeTopicId =
    urlTopicId && topics.some((t) => t.id === urlTopicId)
      ? urlTopicId
      : topics[0]?.id ?? null;
  const activeIndex = activeTopicId
    ? topics.findIndex((t) => t.id === activeTopicId)
    : -1;
  const activeTopic = activeIndex >= 0 ? topics[activeIndex] : null;

  // Keep URL in sync when topics finish loading and there's no `t` param yet.
  useEffect(() => {
    if (!urlTopicId && topics.length > 0) {
      setSearchParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          next.set("t", topics[0].id);
          return next;
        },
        { replace: true },
      );
    }
  }, [topics, urlTopicId, setSearchParams]);

  const goToTopic = (id: string) => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      next.set("t", id);
      return next;
    });
  };

  const goToOffset = (offset: number) => {
    if (activeIndex < 0) return;
    const nextIdx = (activeIndex + offset + topics.length) % topics.length;
    goToTopic(topics[nextIdx].id);
  };

  // Aggregate per-entry stats over ALL topics (used by the Tópicos column).
  const statsByEntry = useMemo(() => {
    const map = new Map<string, { scored: number; missingJustifications: number }>();
    for (const e of sortedEntries) {
      let scored = 0;
      let missingJustif = 0;
      for (const r of e.responses ?? []) {
        if (r.score == null) continue;
        scored += 1;
        if (
          r.score <= JUSTIFICATION_REQUIRED_THRESHOLD &&
          !(r.justification ?? "").trim()
        ) {
          missingJustif += 1;
        }
      }
      map.set(e.id, { scored, missingJustifications: missingJustif });
    }
    return map;
  }, [sortedEntries]);

  // Per-topic progress (how many evaluatees already have a score for each
  // topic) — drives the picker modal status dots.
  const progressByTopic = useMemo(() => {
    const map = new Map<string, { scored: number; total: number }>();
    const total = sortedEntries.length;
    for (const t of topics) map.set(t.id, { scored: 0, total });
    for (const e of sortedEntries) {
      for (const r of e.responses ?? []) {
        if (r.score == null) continue;
        const cur = map.get(r.topicId);
        if (cur) cur.scored += 1;
      }
    }
    return map;
  }, [topics, sortedEntries]);

  const isLoading = isLoadingAssessment || isLoadingEntries;
  const totalTopics = topics.length;

  // Campaign-level totals shown in the header.
  const totals = useMemo(() => {
    let pending = 0;
    let inProgress = 0;
    let submitted = 0;
    for (const e of sortedEntries) {
      if (e.status === ASSESSMENT_ENTRY_STATUS.SUBMITTED) submitted += 1;
      else if (e.status === ASSESSMENT_ENTRY_STATUS.IN_PROGRESS) inProgress += 1;
      else pending += 1;
    }
    const total = sortedEntries.length;
    const completionPct = total > 0 ? Math.round((submitted / total) * 100) : 0;
    return { pending, inProgress, submitted, total, completionPct };
  }, [sortedEntries]);

  return (
    <PrivilegeRoute
      requiredPrivilege={[
        "PRODUCTION",
        "PRODUCTION_MANAGER",
        "ADMIN",
        "HUMAN_RESOURCES",
      ]}
    >
      <div className="flex flex-col gap-4 bg-background px-4 pt-4 pb-6">
        <PageHeader
          variant="default"
          title={assessment?.name ?? "Avaliação"}
          icon={IconClipboardList}
          breadcrumbs={[
            { label: "Início", href: routes.home },
            { label: "Minha Equipe", href: routes.myTeam.root },
            {
              label: "Avaliações de Competências",
              href: routes.skillAssessmentLeader.pending,
            },
            { label: assessment?.name ?? "Campanha" },
          ]}
        />

        {isLoading ? (
          <div className="flex flex-col gap-3">
            <Skeleton className="h-16 w-full rounded-lg" />
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr,360px]">
              <Skeleton className="h-96 w-full rounded-lg" />
              <Skeleton className="h-96 w-full rounded-lg" />
            </div>
          </div>
        ) : assessmentError || !assessment ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center gap-3 py-16 text-center">
              <IconAlertTriangle className="h-10 w-10 text-amber-500" />
              <h2 className="text-lg font-semibold">Campanha não encontrada</h2>
              <p className="max-w-md text-sm text-muted-foreground">
                Você não tem permissão para acessar esta campanha ou ela foi removida.
              </p>
              <Button onClick={() => navigate(routes.skillAssessmentLeader.pending)}>
                Voltar
              </Button>
            </CardContent>
          </Card>
        ) : totalTopics === 0 ? (
          <Card>
            <CardContent className="py-10 text-center text-sm text-muted-foreground">
              Esta avaliação ainda não tem tópicos configurados.
            </CardContent>
          </Card>
        ) : (
          <>
            {/* Combined summary + topic paginator */}
            <Card className="overflow-hidden p-0">
              <div className="flex flex-wrap items-center gap-3 border-b border-border/40 px-4 py-2.5">
                <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
                  <IconCalendar className="h-3.5 w-3.5" />
                  {formatDateRange(assessment.periodStart, assessment.periodEnd)}
                </span>
                <Badge
                  variant={assessment.status === "OPEN" ? "default" : "outline"}
                  className="text-[10px]"
                >
                  {assessment.status === "OPEN" ? "Aberta" : assessment.status}
                </Badge>
                <div className="ml-auto flex items-center gap-3 text-xs">
                  <span className="tabular-nums">
                    <span className="font-semibold">{totals.submitted}</span>
                    <span className="text-muted-foreground">/{totals.total} concluídas</span>
                  </span>
                  {totals.pending > 0 && (
                    <span className="text-muted-foreground">
                      {totals.pending} pendente{totals.pending === 1 ? "" : "s"}
                    </span>
                  )}
                  {totals.inProgress > 0 && (
                    <span className="text-muted-foreground">
                      {totals.inProgress} em progresso
                    </span>
                  )}
                </div>
              </div>
              <Progress value={totals.completionPct} className="h-1 rounded-none" />
              <div className="flex items-center gap-2 px-3 py-2.5">
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={() => goToOffset(-1)}
                  aria-label="Tópico anterior"
                  className="h-8 w-8 shrink-0"
                >
                  <IconChevronLeft className="h-4 w-4" />
                </Button>
                <button
                  type="button"
                  onClick={() => setPickerOpen(true)}
                  className="group flex min-w-0 flex-1 items-center gap-3 rounded-md px-2 py-1 text-left hover:bg-muted/40"
                >
                  <span className="truncate text-sm font-semibold leading-tight">
                    {activeTopic?.title ?? ""}
                  </span>
                  <span className="ml-auto shrink-0 text-[10px] uppercase tracking-wide text-muted-foreground">
                    Tópico {activeIndex + 1} de {totalTopics}
                    {activeTopic?.skill?.name ? ` · ${activeTopic.skill.name}` : ""}
                  </span>
                  <IconLayoutGrid className="h-4 w-4 shrink-0 text-muted-foreground opacity-60 group-hover:opacity-100" />
                </button>
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={() => goToOffset(1)}
                  aria-label="Próximo tópico"
                  className="h-8 w-8 shrink-0"
                >
                  <IconChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </Card>

            <TopicPickerModal
              open={pickerOpen}
              onOpenChange={setPickerOpen}
              topics={topics}
              activeTopicId={activeTopicId}
              progressByTopic={progressByTopic}
              onSelect={goToTopic}
            />

            {/* Matrix + rubric — items-stretch makes the table match the
                rail's natural height (with empty space below the last row
                if the table is shorter). */}
            <div className="grid grid-cols-1 items-stretch gap-4 lg:grid-cols-[minmax(0,1fr),440px]">
              <div className="flex min-w-0 flex-col">
                {activeTopic && (
                  <EvaluateesTable
                    entries={sortedEntries}
                    activeTopic={activeTopic}
                    totalTopics={totalTopics}
                    scoredCountByEntry={statsByEntry}
                    onCellHover={setHoveredScore}
                  />
                )}
              </div>
              <div className="flex flex-col">
                <TopicRubricRail topic={activeTopic} highlightedScore={hoveredScore} />
              </div>
            </div>
          </>
        )}
      </div>
    </PrivilegeRoute>
  );
};

export default SkillAssessmentCampaignPage;
