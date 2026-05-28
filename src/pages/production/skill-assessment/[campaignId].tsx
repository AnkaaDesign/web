// pages/production/skill-assessment/[campaignId].tsx
//
// Leader's per-campaign topic-paged page. Shows ONE topic at a time. The
// matrix on the left lists every evaluatee in the leader's sector; the
// rail on the right is a Score Level Picker — clicking a level card
// commits that score to the currently active evaluatee and auto-advances
// to the next unscored evaluatee for this topic.
//
// State flow:
//   - URL holds the active topic via `?t=<topicId>`.
//   - Active entry is local state; defaults to the first unscored entry
//     for the active topic (or the first row if all are scored).
//   - Scoring goes through `useResponseCell` lifted to this page so the
//     ScoreLevelPicker can drive it. An optimistic-scores map keeps the
//     row badge in sync immediately, without waiting for the cache.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import {
  IconAlertTriangle,
  IconChevronLeft,
  IconChevronRight,
  IconClipboardList,
  IconFlag3,
  IconLayoutGrid,
  IconLoader2,
  IconMessage2,
  IconNotes,
} from "@tabler/icons-react";

import { PrivilegeRoute } from "@/components/navigation/privilege-route";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

import { usePageTracker } from "@/hooks/common/use-page-tracker";
import { useAssessment } from "@/hooks/skill/use-assessment";
import { useAssessmentEntries } from "@/hooks/skill/use-assessment-entry";
import { useResponseCell } from "@/hooks/skill/use-response-cell";
import { ASSESSMENT_ENTRY_STATUS, routes } from "@/constants";
import type { AssessmentEntry, Topic } from "@/types";

import { EvaluateesTable } from "@/components/production/skill-assessment/matrix/evaluatees-table";
import { ScoreLevelPicker } from "@/components/production/skill-assessment/matrix/score-level-picker";
import { TopicPickerModal } from "@/components/production/skill-assessment/matrix/topic-picker-modal";
import { StepperProgressBar } from "@/components/production/skill-assessment/matrix/stepper-progress-bar";

const AUTO_ADVANCE_DELAY_MS = 450;

export const SkillAssessmentCampaignPage = () => {
  const { campaignId } = useParams<{ campaignId: string }>();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [pickerOpen, setPickerOpen] = useState(false);
  const [activeEntryId, setActiveEntryId] = useState<string | null>(null);

  usePageTracker({ title: "Avaliação por tópico", icon: "clipboard-list" });

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

  const { data: entriesResp, isLoading: isLoadingEntries } = useAssessmentEntries(
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

  const urlTopicId = searchParams.get("t");
  const activeTopicId =
    urlTopicId && topics.some((t) => t.id === urlTopicId)
      ? urlTopicId
      : topics[0]?.id ?? null;
  const activeIndex = activeTopicId
    ? topics.findIndex((t) => t.id === activeTopicId)
    : -1;
  const activeTopic = activeIndex >= 0 ? topics[activeIndex] : null;

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

  // ─── Active-entry + scoring (lifted from row) ────────────────────────────

  // Optimistic score for the current topic, keyed by entryId. Cleared when
  // topic changes so it never leaks across topics. Used by EvaluateeRow to
  // show the new badge immediately while the server cache catches up.
  const [optimisticByEntry, setOptimisticByEntry] = useState<Map<string, number | null>>(
    () => new Map(),
  );

  useEffect(() => {
    // Topic changed → reset optimistic overrides (they belonged to the prev topic).
    setOptimisticByEntry(new Map());
  }, [activeTopicId]);

  const hasScore = useCallback(
    (entryId: string, topicId: string): boolean => {
      const over = optimisticByEntry.get(entryId);
      if (over != null) return true;
      const e = sortedEntries.find((x) => x.id === entryId);
      if (!e) return false;
      const r = (e.responses ?? []).find((r) => r.topicId === topicId);
      return r?.score != null;
    },
    [optimisticByEntry, sortedEntries],
  );

  // When the topic changes, jump to the first unscored entry (or first row).
  // Topic navigation always resets the active row — the leader scores top-down
  // per topic.
  useEffect(() => {
    if (!activeTopicId || sortedEntries.length === 0) {
      setActiveEntryId(null);
      return;
    }
    const firstUnscored = sortedEntries.find(
      (e) =>
        e.status !== ASSESSMENT_ENTRY_STATUS.SUBMITTED &&
        !hasScore(e.id, activeTopicId),
    );
    setActiveEntryId((firstUnscored ?? sortedEntries[0]).id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTopicId]);

  // Roster fixup: if the active entry vanished from the roster (e.g. refetch
  // dropped it), fall back to the first row. Does NOT fire on topic change.
  useEffect(() => {
    if (sortedEntries.length === 0) return;
    setActiveEntryId((current) => {
      if (current && sortedEntries.some((e) => e.id === current)) return current;
      return sortedEntries[0].id;
    });
  }, [sortedEntries]);

  const activeEntry = useMemo(
    () => sortedEntries.find((e) => e.id === activeEntryId) ?? null,
    [sortedEntries, activeEntryId],
  );

  const activeSavedResponse = useMemo(() => {
    if (!activeEntry || !activeTopicId) return null;
    return (activeEntry.responses ?? []).find((r) => r.topicId === activeTopicId) ?? null;
  }, [activeEntry, activeTopicId]);

  const activeIsReadOnly =
    activeEntry?.status === ASSESSMENT_ENTRY_STATUS.SUBMITTED;

  const cell = useResponseCell({
    entryId: activeEntry?.id ?? "",
    topicId: activeTopic?.id ?? "",
    savedScore: activeSavedResponse?.score ?? null,
    savedJustification: activeSavedResponse?.justification ?? "",
    disabled: !activeEntry || !activeTopic || activeIsReadOnly,
    // Error toast emitted by the axios interceptor (PUT /assessment-entry/:id/responses).
  });

  // Display score for the picker: live cell takes precedence over optimistic
  // map, both fall back to the server-saved value.
  const pickerCurrentScore = useMemo(() => {
    if (cell.score != null) return cell.score;
    if (activeEntryId) {
      const over = optimisticByEntry.get(activeEntryId);
      if (over !== undefined) return over;
    }
    return activeSavedResponse?.score ?? null;
  }, [cell.score, optimisticByEntry, activeEntryId, activeSavedResponse]);

  const advanceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (advanceTimerRef.current) clearTimeout(advanceTimerRef.current);
    };
  }, []);

  const handlePickScore = useCallback(
    (score: number) => {
      if (!activeEntry || !activeTopicId) return;
      if (activeIsReadOnly) return;

      cell.setScore(score);
      // Mirror into the optimistic map so the row badge updates instantly.
      setOptimisticByEntry((prev) => {
        const next = new Map(prev);
        next.set(activeEntry.id, score);
        return next;
      });

      // Auto-advance: pick the next entry that doesn't have a score for the
      // current topic (and isn't submitted). If none, stay put.
      if (advanceTimerRef.current) clearTimeout(advanceTimerRef.current);
      advanceTimerRef.current = setTimeout(() => {
        const startIdx = sortedEntries.findIndex((e) => e.id === activeEntry.id);
        if (startIdx < 0) return;
        // Look forward, then wrap.
        for (let offset = 1; offset <= sortedEntries.length; offset++) {
          const next = sortedEntries[(startIdx + offset) % sortedEntries.length];
          if (next.id === activeEntry.id) break;
          if (next.status === ASSESSMENT_ENTRY_STATUS.SUBMITTED) continue;
          if (hasScore(next.id, activeTopicId)) continue;
          setActiveEntryId(next.id);
          return;
        }
        // All scored — stay on the just-scored row.
      }, AUTO_ADVANCE_DELAY_MS);
    },
    [activeEntry, activeTopicId, activeIsReadOnly, cell, sortedEntries, hasScore],
  );

  // Stepper progress: % of topics with a saved score for the active entry.

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
          title={
            assessment?.name
              ? activeTopic?.skill?.name
                ? `${assessment.name} - ${activeTopic.skill.name}`
                : assessment.name
              : "Avaliação"
          }
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
            <Skeleton className="h-32 w-full rounded-lg" />
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr,440px]">
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
            {/* Topic pager — compact navigation row */}
            <Card className="overflow-hidden p-0">
              <div className="flex items-center gap-2 p-2">
                <Button
                  size="icon"
                  variant="default"
                  onClick={() => goToOffset(-1)}
                  aria-label="Tópico anterior"
                  className="h-12 w-12 shrink-0"
                >
                  <IconChevronLeft className="h-5 w-5" />
                </Button>
                <button
                  type="button"
                  onClick={() => setPickerOpen(true)}
                  className="group flex min-w-0 flex-1 flex-col gap-2 rounded-md px-3 py-2 text-left hover:bg-muted/40"
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <span className="truncate text-sm font-semibold leading-tight">
                      {activeTopic?.title ?? ""}
                    </span>
                    <span className="ml-auto shrink-0 text-[10px] uppercase tracking-wide text-muted-foreground">
                      Tópico {activeIndex + 1} de {totalTopics}
                      {activeTopic?.skill?.name ? ` · ${activeTopic.skill.name}` : ""}
                    </span>
                    <IconLayoutGrid className="h-4 w-4 shrink-0 text-muted-foreground opacity-60 group-hover:opacity-100" />
                  </div>
                  <StepperProgressBar
                    total={totalTopics}
                    currentIndex={activeIndex}
                    isScored={(i) => hasScore(activeEntry?.id ?? "", topics[i]?.id)}
                    className="w-full"
                  />
                </button>
                <Button
                  size="icon"
                  variant="default"
                  onClick={() => goToOffset(1)}
                  aria-label="Próximo tópico"
                  className="h-12 w-12 shrink-0"
                >
                  <IconChevronRight className="h-5 w-5" />
                </Button>
              </div>
            </Card>

            {/* Descrição + Comportamentos contrários */}
            {activeTopic && (
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="flex items-center gap-2 text-sm">
                      <IconNotes className="h-4 w-4 text-muted-foreground" />
                      Descrição
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm whitespace-pre-line text-foreground/90">
                      {activeTopic.description || (
                        <span className="italic text-muted-foreground">
                          Sem descrição.
                        </span>
                      )}
                    </p>
                  </CardContent>
                </Card>
                <Card className="border-amber-500/30 bg-amber-50/30 dark:bg-amber-950/10">
                  <CardHeader className="pb-2">
                    <CardTitle className="flex items-center gap-2 text-sm text-amber-700 dark:text-amber-300">
                      <IconFlag3 className="h-4 w-4" />
                      Comportamentos contrários
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm whitespace-pre-line text-amber-900 dark:text-amber-200">
                      {activeTopic.counterBehaviors || (
                        <span className="italic opacity-70">
                          Sem comportamentos contrários cadastrados.
                        </span>
                      )}
                    </p>
                  </CardContent>
                </Card>
              </div>
            )}

            <TopicPickerModal
              open={pickerOpen}
              onOpenChange={setPickerOpen}
              topics={topics}
              activeTopicId={activeTopicId}
              progressByTopic={progressByTopic}
              onSelect={goToTopic}
            />

            {/* Matrix + score picker */}
            <div className="grid grid-cols-1 items-stretch gap-4 lg:grid-cols-2">
              <div className="flex min-w-0 flex-col">
                {activeTopic && (
                  <EvaluateesTable
                    entries={sortedEntries}
                    activeTopic={activeTopic}
                    activeEntryId={activeEntryId}
                    optimisticScores={optimisticByEntry}
                    onSelectEntry={setActiveEntryId}
                  />
                )}
              </div>
              <div className="flex flex-col">
                <ScoreLevelPicker
                  topic={activeTopic}
                  currentScore={pickerCurrentScore}
                  readOnly={activeIsReadOnly}
                  isSaving={cell.isSaving}
                  disabled={!activeEntry}
                  onPickScore={handlePickScore}
                />
              </div>
            </div>

            {/* Justificativa — per (evaluatee, topic) free-text note */}
            {activeTopic && (
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="flex items-center gap-2 text-sm">
                    <IconMessage2 className="h-4 w-4 text-muted-foreground" />
                    Justificativa
                    {activeEntry?.evaluatee?.name && (
                      <span className="text-xs font-normal text-muted-foreground">
                        · {activeEntry.evaluatee.name}
                      </span>
                    )}
                    {cell.isSaving && (
                      <span className="ml-auto flex items-center gap-1 text-xs font-normal text-muted-foreground">
                        <IconLoader2 className="h-3 w-3 animate-spin" />
                        Salvando…
                      </span>
                    )}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <Textarea
                    placeholder={
                      !activeEntry
                        ? "Selecione um avaliado para escrever uma justificativa."
                        : activeIsReadOnly
                          ? "Esta avaliação foi enviada e não pode ser editada."
                          : pickerCurrentScore == null
                            ? "Selecione uma nota para registrar uma justificativa (opcional)."
                            : "Descreva o porquê da nota atribuída (opcional)."
                    }
                    value={cell.justification}
                    onChange={(e) => cell.setJustification(e.target.value)}
                    disabled={!activeEntry || activeIsReadOnly}
                    rows={4}
                  />
                </CardContent>
              </Card>
            )}
          </>
        )}
      </div>
    </PrivilegeRoute>
  );
};

export default SkillAssessmentCampaignPage;
