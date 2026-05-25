// pages/production/skill-assessment/fill/[entryId].tsx
//
// Per-evaluatee fill flow. Loads a single AssessmentEntry (with the parent
// assessment's full topic catalog + each topic's 6 TopicLevels) and lets the
// leader score every topic, write justifications, autosave drafts, and
// finally submit.
//
// Autosave strategy:
//   - Debounced save 1.5s after the last change (blur events also flush).
//   - Hard interval safety net every 30s while the form is dirty.
//   - We dedupe by topicId before PUTting /assessment-entry/:id/responses —
//     the server upserts in-place.
//
// Unsaved-changes guard: native beforeunload + a React-Router blocker pattern
// (window.confirm) on link clicks. We also disable the navigate-away link in
// the header when the form is dirty.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { FormProvider, useFieldArray, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";

import { PrivilegeRoute } from "@/components/navigation/privilege-route";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/sonner";
import {
  IconAlertTriangle,
  IconArrowLeft,
  IconClipboardList,
  IconDeviceFloppy,
  IconSend,
} from "@tabler/icons-react";

import { usePageTracker } from "@/hooks/common/use-page-tracker";
import {
  useAssessmentEntry,
  useBatchUpsertResponses,
  useSubmitAssessmentEntry,
  useUpdateAssessmentEntryMeta,
} from "@/hooks/skill/use-assessment-entry";
import { useAssessment } from "@/hooks/skill/use-assessment";

import { ASSESSMENT_ENTRY_STATUS, routes } from "@/constants";
import type {
  AssessmentEntryResponsesUpsertFormData,
  Topic,
  TopicLevel,
} from "@/types";

import { SectorBanner } from "@/components/production/skill-assessment/sector-banner";
import { FillProgress } from "@/components/production/skill-assessment/fill-progress";
import { TopicScorer } from "@/components/production/skill-assessment/topic-scorer";
import { SubmitConfirmationDialog } from "@/components/production/skill-assessment/submit-confirmation-dialog";

// ----- form schema -----

const responseSchema = z.object({
  topicId: z.string().min(1),
  score: z.number().int().min(0).max(5).nullable(),
  justification: z.string(),
});

const fillFormSchema = z.object({
  responses: z.array(responseSchema),
  notes: z.string().optional().nullable(),
});

type FillFormValues = z.infer<typeof fillFormSchema>;

const AUTOSAVE_DEBOUNCE_MS = 1500;
const AUTOSAVE_INTERVAL_MS = 30_000;
const JUSTIFICATION_REQUIRED_THRESHOLD = 2;

// ----- helpers -----

interface ResolvedTopic {
  topic: Topic;
  levels: TopicLevel[];
}

export const SkillAssessmentFillPage = () => {
  const { entryId } = useParams<{ entryId: string }>();
  const navigate = useNavigate();
  usePageTracker({ title: "Avaliar competências", icon: "clipboard-check" });

  const {
    data: entryResp,
    isLoading: isLoadingEntry,
    isError: entryError,
    error: entryErrorObj,
  } = useAssessmentEntry(entryId, {
    include: {
      assessment: true,
      evaluatee: { include: { position: true, sector: true } },
      evaluator: true,
      responses: { include: { topic: true } },
    },
  });

  const entry = entryResp?.data;
  const assessmentId = entry?.assessmentId;

  // Pull the parent assessment with the full topic + level catalog. This is
  // the single source of truth for what the leader must score.
  const {
    data: assessmentResp,
    isLoading: isLoadingAssessment,
  } = useAssessment(
    assessmentId,
    {
      include: {
        topics: {
          include: {
            topic: {
              include: { skill: true, levels: true },
            },
          },
        },
      },
    },
    { enabled: !!assessmentId },
  );

  const assessment = assessmentResp?.data;

  // Flatten the AssessmentTopic[] join into ResolvedTopic[], sorted by
  // skill.order ASC then topic.order ASC so the leader walks them in catalogue
  // order (Produtividade → Comportamental → Segurança do Trabalho).
  const resolvedTopics: ResolvedTopic[] = useMemo(() => {
    const join = assessment?.topics ?? [];
    return join
      .map((at) => at.topic)
      .filter((t): t is Topic => !!t && Array.isArray(t.levels) && t.levels.length > 0)
      .sort((a, b) => {
        const skA = a.skill?.order ?? Number.MAX_SAFE_INTEGER;
        const skB = b.skill?.order ?? Number.MAX_SAFE_INTEGER;
        if (skA !== skB) return skA - skB;
        return (a.order ?? 0) - (b.order ?? 0);
      })
      .map<ResolvedTopic>((topic) => ({ topic, levels: topic.levels ?? [] }));
  }, [assessment]);

  const isReadOnly = entry?.status === ASSESSMENT_ENTRY_STATUS.SUBMITTED;

  // ----- form -----

  const form = useForm<FillFormValues>({
    resolver: zodResolver(fillFormSchema),
    defaultValues: { responses: [], notes: "" },
    mode: "onChange",
  });

  const { fields, replace } = useFieldArray({
    control: form.control,
    name: "responses",
  });

  // Seed/refresh form values whenever the entry or topic catalogue changes.
  // We index existing responses by topicId so refetch (cache invalidation
  // after save) keeps the user's in-progress drafts in sync without nuking
  // unsaved local edits.
  const seedSignature = useRef<string>("");
  useEffect(() => {
    if (!entry || resolvedTopics.length === 0) return;

    const responseByTopic = new Map<string, { score: number; justification: string }>();
    for (const r of entry.responses ?? []) {
      responseByTopic.set(r.topicId, {
        score: r.score,
        justification: r.justification ?? "",
      });
    }

    const signature = JSON.stringify({
      entryId: entry.id,
      topicIds: resolvedTopics.map((rt) => rt.topic.id),
      remoteResponses: Array.from(responseByTopic.entries()),
      notes: entry.notes ?? "",
    });
    if (signature === seedSignature.current) return;
    seedSignature.current = signature;

    const seeded = resolvedTopics.map((rt) => {
      const existing = responseByTopic.get(rt.topic.id);
      return {
        topicId: rt.topic.id,
        score: existing?.score ?? null,
        justification: existing?.justification ?? "",
      };
    });

    replace(seeded);
    form.reset(
      { responses: seeded, notes: entry.notes ?? "" },
      { keepDirty: false, keepValues: false },
    );
  }, [entry, resolvedTopics, replace, form]);

  // ----- mutations -----

  const upsertResponses = useBatchUpsertResponses(entryId ?? "");
  const submitEntry = useSubmitAssessmentEntry(entryId ?? "");
  const updateMeta = useUpdateAssessmentEntryMeta(entryId ?? "");

  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);
  const [submitDialogOpen, setSubmitDialogOpen] = useState(false);

  // Track the snapshot we last persisted to allow conflict-free batch saves.
  const lastSavedRef = useRef<string>("");

  // ----- save plumbing -----

  const buildPayload = useCallback(
    (values: FillFormValues): AssessmentEntryResponsesUpsertFormData => {
      // Dedup by topicId (last write wins) + drop topics with no score yet.
      const seen = new Map<string, { score: number; justification?: string | null }>();
      for (const r of values.responses) {
        if (r.score == null) continue;
        seen.set(r.topicId, {
          score: r.score,
          justification: r.justification?.trim() ? r.justification.trim() : null,
        });
      }
      return {
        responses: Array.from(seen.entries()).map(([topicId, v]) => ({
          topicId,
          score: v.score,
          justification: v.justification ?? null,
        })),
      };
    },
    [],
  );

  const flush = useCallback(
    async (opts?: { silent?: boolean }) => {
      if (!entryId || isReadOnly) return;
      const values = form.getValues();
      const payload = buildPayload(values);
      const notesChanged = (values.notes ?? "") !== (entry?.notes ?? "");
      const sig = JSON.stringify({ payload, notes: values.notes ?? "" });
      if (sig === lastSavedRef.current) return; // nothing changed
      const hasResponses = payload.responses.length > 0;
      // Nothing to persist (no scored topics + notes unchanged) — silently
      // record this as the last seen signature so we don't keep retrying.
      if (!hasResponses && !notesChanged) {
        lastSavedRef.current = sig;
        return;
      }
      try {
        if (hasResponses) {
          await upsertResponses.mutateAsync({ ...payload, suppressToast: opts?.silent });
        }
        if (notesChanged) {
          await updateMeta.mutateAsync({ notes: values.notes ?? null, suppressToast: opts?.silent });
        }
        lastSavedRef.current = sig;
        setLastSavedAt(new Date());
        form.reset(values, { keepValues: true, keepDirty: false });
        // Success/error toasts are emitted by the axios interceptor (PUT
        // /assessment-entry/:id/responses, PATCH /assessment-entry/:id).
      } catch {
        // Error toast emitted by the axios error interceptor.
      }
    },
    [entryId, isReadOnly, form, buildPayload, upsertResponses, updateMeta, entry?.notes],
  );

  // Debounced autosave on every value change.
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (isReadOnly) return;
    const subscription = form.watch(() => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        void flush({ silent: true });
      }, AUTOSAVE_DEBOUNCE_MS);
    });
    return () => {
      subscription.unsubscribe();
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [form, flush, isReadOnly]);

  // Hard interval safety net every 30s while dirty.
  useEffect(() => {
    if (isReadOnly) return;
    const id = setInterval(() => {
      if (form.formState.isDirty) void flush({ silent: true });
    }, AUTOSAVE_INTERVAL_MS);
    return () => clearInterval(id);
  }, [form, flush, isReadOnly]);

  // beforeunload guard while dirty.
  useEffect(() => {
    if (isReadOnly) return;
    const handler = (e: BeforeUnloadEvent) => {
      if (form.formState.isDirty) {
        e.preventDefault();
        e.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [form.formState.isDirty, isReadOnly]);

  // ----- derived progress + validation -----

  const watchedResponses = form.watch("responses");
  const totalTopics = resolvedTopics.length;

  const stats = useMemo(() => {
    let answered = 0;
    let missingJustifications = 0;
    for (const r of watchedResponses ?? []) {
      if (r.score == null) continue;
      answered += 1;
      if (r.score <= JUSTIFICATION_REQUIRED_THRESHOLD && !r.justification?.trim()) {
        missingJustifications += 1;
      }
    }
    return { answered, missingJustifications };
  }, [watchedResponses]);

  const canSubmit =
    !isReadOnly &&
    totalTopics > 0 &&
    stats.answered === totalTopics &&
    stats.missingJustifications === 0 &&
    !submitEntry.isPending;

  // ----- handlers -----

  const handleSaveDraftClick = async () => {
    await flush();
  };

  const handleSubmitClick = () => {
    if (stats.answered !== totalTopics) {
      toast.warning(
        `Responda todos os tópicos antes de enviar (${stats.answered}/${totalTopics}).`,
      );
      return;
    }
    if (stats.missingJustifications > 0) {
      toast.warning(
        `Adicione justificativa para todas as notas críticas (≤ 2) — ${stats.missingJustifications} pendente(s).`,
      );
      return;
    }
    setSubmitDialogOpen(true);
  };

  const handleConfirmSubmit = async () => {
    if (!entryId) return;
    try {
      // Flush latest values first to avoid losing edits the user made after
      // their last autosave debounce window.
      await flush({ silent: true });
      await submitEntry.mutateAsync();
      // Success/error toasts are emitted by the axios interceptor (POST
      // /assessment-entry/:id/submit).
      setSubmitDialogOpen(false);
      navigate(routes.skillAssessmentLeader.pending);
    } catch {
      // Error toast emitted by the axios error interceptor.
    }
  };

  const handleBackClick = () => {
    if (!isReadOnly && form.formState.isDirty) {
      const ok = window.confirm(
        "Você tem alterações que ainda não foram salvas. Sair sem salvar?",
      );
      if (!ok) return;
    }
    navigate(routes.skillAssessmentLeader.pending);
  };

  // ----- render -----

  const isLoading = isLoadingEntry || isLoadingAssessment;

  return (
    <PrivilegeRoute requiredPrivilege={["PRODUCTION", "PRODUCTION_MANAGER", "ADMIN", "HUMAN_RESOURCES"]}>
      <div className="flex flex-col gap-4 bg-background px-4 pt-4 pb-24">
        <PageHeader
          variant="default"
          title="Avaliar competências"
          icon={IconClipboardList}
          breadcrumbs={[
            { label: "Início", href: routes.home },
            { label: "Minha Equipe", href: routes.myTeam.root },
            {
              label: "Avaliações de Competências",
              href: routes.skillAssessmentLeader.pending,
            },
            { label: entry?.evaluatee?.name ?? "Avaliar" },
          ]}
          actions={[
            {
              key: "back",
              label: "Voltar",
              icon: IconArrowLeft,
              variant: "outline",
              onClick: handleBackClick,
            },
          ]}
        />

        {isLoading ? (
          <div className="flex flex-col gap-3">
            <Skeleton className="h-24 w-full rounded-lg" />
            <Skeleton className="h-2 w-full" />
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-64 w-full rounded-lg" />
            ))}
          </div>
        ) : entryError || !entry ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center gap-3 py-16 text-center">
              <IconAlertTriangle className="h-10 w-10 text-amber-500" />
              <h2 className="text-lg font-semibold">Avaliação não encontrada</h2>
              <p className="max-w-md text-sm text-muted-foreground">
                {entryErrorObj instanceof Error
                  ? entryErrorObj.message
                  : "Você não tem permissão para acessar esta avaliação ou ela foi removida."}
              </p>
              <Button onClick={handleBackClick}>Voltar para a lista</Button>
            </CardContent>
          </Card>
        ) : (
          <FormProvider {...form}>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleSubmitClick();
              }}
              className="flex flex-col gap-4"
            >
              <div className="sticky top-0 z-20 -mx-4 flex flex-col gap-3 bg-background/95 px-4 py-2 backdrop-blur-sm">
                <SectorBanner
                  assessmentName={entry.assessment?.name ?? "Avaliação"}
                  periodStart={entry.assessment?.periodStart ?? new Date()}
                  periodEnd={entry.assessment?.periodEnd ?? new Date()}
                  evaluateeName={entry.evaluatee?.name ?? "—"}
                  evaluateeSector={entry.evaluatee?.sector?.name}
                  evaluateePosition={entry.evaluatee?.position?.name}
                  evaluatorName={entry.evaluator?.name ?? "—"}
                  status={entry.status}
                />
                <FillProgress
                  completed={stats.answered}
                  total={totalTopics}
                  lastSavedAt={lastSavedAt}
                  isSaving={upsertResponses.isPending || updateMeta.isPending}
                  isDirty={form.formState.isDirty}
                />
              </div>

              {isReadOnly && (
                <Card className="border-emerald-300/60 bg-emerald-50/50 dark:bg-emerald-950/20">
                  <CardContent className="py-3 text-sm text-emerald-800 dark:text-emerald-300">
                    Esta avaliação já foi enviada e está em modo somente leitura. Para editar,
                    solicite a um administrador a reabertura.
                  </CardContent>
                </Card>
              )}

              {totalTopics === 0 ? (
                <Card>
                  <CardContent className="py-10 text-center text-sm text-muted-foreground">
                    Esta avaliação ainda não tem tópicos configurados.
                  </CardContent>
                </Card>
              ) : (
                <div className="flex flex-col gap-4">
                  {fields.map((field, idx) => {
                    const resolved = resolvedTopics[idx];
                    if (!resolved) return null;
                    const watched = watchedResponses?.[idx];
                    return (
                      <TopicScorer
                        key={field.id}
                        index={idx}
                        topic={resolved.topic}
                        levels={resolved.levels}
                        score={watched?.score ?? null}
                        justification={watched?.justification ?? ""}
                        readOnly={isReadOnly}
                        onScoreChange={(score) =>
                          form.setValue(`responses.${idx}.score`, score, {
                            shouldDirty: true,
                            shouldTouch: true,
                          })
                        }
                        onJustificationChange={(value) =>
                          form.setValue(`responses.${idx}.justification`, value, {
                            shouldDirty: true,
                            shouldTouch: true,
                          })
                        }
                      />
                    );
                  })}
                </div>
              )}

              {!isReadOnly && (
                <div className="sticky bottom-0 -mx-4 flex flex-col gap-2 border-t bg-background/95 px-4 py-3 backdrop-blur-sm sm:flex-row sm:items-center sm:justify-between">
                  <div className="text-xs text-muted-foreground">
                    {stats.answered}/{totalTopics} tópicos respondidos
                    {stats.missingJustifications > 0 &&
                      ` · ${stats.missingJustifications} justificativa(s) pendente(s)`}
                  </div>
                  <div className="flex flex-col gap-2 sm:flex-row">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={handleSaveDraftClick}
                      disabled={
                        upsertResponses.isPending ||
                        updateMeta.isPending ||
                        !form.formState.isDirty
                      }
                    >
                      <IconDeviceFloppy className="h-4 w-4" />
                      Salvar rascunho
                    </Button>
                    <Button type="submit" disabled={!canSubmit}>
                      <IconSend className="h-4 w-4" />
                      Finalizar e enviar
                    </Button>
                  </div>
                </div>
              )}
            </form>

            <SubmitConfirmationDialog
              open={submitDialogOpen}
              evaluateeName={entry.evaluatee?.name ?? "—"}
              totalTopics={totalTopics}
              answered={stats.answered}
              missingJustifications={stats.missingJustifications}
              isSubmitting={submitEntry.isPending}
              onOpenChange={setSubmitDialogOpen}
              onConfirm={handleConfirmSubmit}
            />
          </FormProvider>
        )}
      </div>
    </PrivilegeRoute>
  );
};

export default SkillAssessmentFillPage;
