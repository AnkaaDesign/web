// pages/questionnaire/fill/[entryId].tsx
//
// Self-fill flow: the logged-in user answers a questionnaire FOR THEMSELVES,
// stepping through ONE question at a time — the same workflow as the leader
// matrix fill page. Reuses the NOTAS rail (ScoreLevelPicker) and the topic
// stepper, minus the evaluatees roster (there is a single respondent). Picking
// an answer autosaves and auto-advances to the next question.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  IconArrowLeft,
  IconChevronLeft,
  IconChevronRight,
  IconClipboardList,
  IconInfoCircle,
  IconLayoutGrid,
  IconMessage2,
  IconNotes,
  IconSend,
  IconWriting,
} from "@tabler/icons-react";

import { routes, QUESTIONNAIRE_ENTRY_STATUS, QUESTIONNAIRE_QUESTION_TYPE } from "@/constants";
import {
  useQuestionnaireEntry,
  useBatchUpsertQuestionnaireAnswers,
  useSubmitQuestionnaireEntry,
} from "@/hooks/questionnaire/use-questionnaire-entry";
import { usePageTracker } from "@/hooks/common/use-page-tracker";

import { PageHeader } from "@/components/ui/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "@/components/ui/sonner";
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
import { ScoreLevelPicker } from "@/components/production/skill-assessment/matrix/score-level-picker";
import { TopicPickerModal } from "@/components/production/skill-assessment/matrix/topic-picker-modal";
import { StepperProgressBar } from "@/components/production/skill-assessment/matrix/stepper-progress-bar";

const AUTO_ADVANCE_MS = 450;
const SAVE_DEBOUNCE_MS = 600;

/** Adapt a QuestionnaireQuestion (+ options + group) into the Topic shape the
 *  matrix components expect (levels ← options, skill ← group). */
const asTopic = (q: any) =>
  q
    ? {
        ...q,
        skill: q.group ?? null,
        levels: (q.options ?? []).map((o: any) => ({
          id: o.id,
          score: o.value,
          name: o.label,
          description: o.description ?? "",
        })),
      }
    : null;

const isTextQuestion = (q: any) => q?.type === QUESTIONNAIRE_QUESTION_TYPE.TEXT;

/** Uma pergunta está respondida quando tem nota (fechada) ou texto (livre). */
const isAnswered = (q: any, a?: { value: number | null; textValue: string }) =>
  isTextQuestion(q) ? !!a?.textValue.trim() : a?.value != null;

export const QuestionnaireFillPage = () => {
  const { entryId } = useParams<{ entryId: string }>();
  const navigate = useNavigate();
  usePageTracker({ title: "Responder questionário", icon: "clipboard-check" });

  const { data, isLoading, isError } = useQuestionnaireEntry(entryId);
  const upsert = useBatchUpsertQuestionnaireAnswers(entryId ?? "");
  const submitMut = useSubmitQuestionnaireEntry(entryId ?? "");

  const entry = data?.data as any; // service injects `questions` + `answersByQuestion`
  const isReadOnly = entry?.status === QUESTIONNAIRE_ENTRY_STATUS.SUBMITTED;

  // Uma pergunta fechada sem opções está mal cadastrada e não tem como ser
  // respondida; uma de texto livre nunca tem opções e PRECISA aparecer.
  const questions = useMemo(
    () =>
      ((entry?.questions ?? []) as any[]).filter(
        (q) => isTextQuestion(q) || (q.options?.length ?? 0) > 0,
      ),
    [entry],
  );

  const [answers, setAnswers] = useState<
    Record<string, { value: number | null; textValue: string; comment: string }>
  >({});
  const [activeIndex, setActiveIndex] = useState(0);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [submitOpen, setSubmitOpen] = useState(false);

  // Seed local answers from the entry once loaded.
  const seedRef = useRef("");
  useEffect(() => {
    if (!entry || questions.length === 0) return;
    const sig = `${entry.id}:${questions.length}`;
    if (seedRef.current === sig) return;
    seedRef.current = sig;
    const byQ = entry.answersByQuestion ?? {};
    const seed: Record<string, { value: number | null; textValue: string; comment: string }> = {};
    for (const q of questions) {
      seed[q.id] = {
        value: byQ[q.id]?.value ?? null,
        textValue: byQ[q.id]?.textValue ?? "",
        comment: byQ[q.id]?.comment ?? "",
      };
    }
    setAnswers(seed);
  }, [entry, questions]);

  const activeQuestion = questions[activeIndex] ?? null;
  const activeAnswer = activeQuestion
    ? answers[activeQuestion.id] ?? { value: null, textValue: "", comment: "" }
    : null;
  const total = questions.length;
  const answered = useMemo(
    () => questions.filter((q) => isAnswered(q, answers[q.id])).length,
    [questions, answers],
  );
  // Só as obrigatórias travam o envio (o backend valida o mesmo).
  const missingRequired = useMemo(
    () => questions.filter((q) => q.isRequired !== false && !isAnswered(q, answers[q.id])).length,
    [questions, answers],
  );

  // Autosave com debounce. O que está pendente fica ACUMULADO por pergunta em
  // vez de num único payload: com o auto-avanço de 450ms e o debounce de 600ms,
  // responder duas perguntas seguidas rápido descartava o salvamento da
  // primeira. Um valor nulo (ou texto vazio) é enviado de propósito — é assim
  // que a API apaga a resposta de uma pergunta opcional.
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingSaves = useRef<Map<string, any>>(new Map());
  const saveAnswer = useCallback(
    (question: any, value: number | null, textValue: string, comment: string) => {
      if (!entryId || isReadOnly) return;
      pendingSaves.current.set(
        question.id,
        isTextQuestion(question)
          ? { questionId: question.id, value: null, textValue: textValue.trim() || null }
          : { questionId: question.id, value, comment: comment.trim() ? comment.trim() : null },
      );
      if (saveTimer.current) clearTimeout(saveTimer.current);
      saveTimer.current = setTimeout(async () => {
        const batch = [...pendingSaves.current.values()];
        pendingSaves.current.clear();
        if (!batch.length) return;
        try {
          await upsert.mutateAsync({ answers: batch, suppressToast: true });
        } catch {
          /* toast via interceptor */
        }
      }, SAVE_DEBOUNCE_MS);
    },
    [entryId, isReadOnly, upsert],
  );

  const advanceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const goToOffset = (offset: number) => {
    if (total === 0) return;
    setActiveIndex((i) => (i + offset + total) % total);
  };

  const handlePick = (score: number) => {
    if (isReadOnly || !activeQuestion) return;
    const cur = answers[activeQuestion.id] ?? { value: null, textValue: "", comment: "" };
    const next = { ...cur, value: score };
    setAnswers((prev) => ({ ...prev, [activeQuestion.id]: next }));
    saveAnswer(activeQuestion, score, next.textValue, next.comment);
    if (advanceTimer.current) clearTimeout(advanceTimer.current);
    advanceTimer.current = setTimeout(() => goToOffset(1), AUTO_ADVANCE_MS);
  };

  const handleComment = (comment: string) => {
    if (isReadOnly || !activeQuestion) return;
    const cur = answers[activeQuestion.id] ?? { value: null, textValue: "", comment: "" };
    setAnswers((prev) => ({ ...prev, [activeQuestion.id]: { ...cur, comment } }));
    if (advanceTimer.current) clearTimeout(advanceTimer.current); // typing cancels auto-advance
    // Sem nota escolhida, `{value:null}` significa APAGAR para a API — o
    // comentário seria jogado fora. Fica só no estado local até a nota existir
    // (escolher a nota reenvia o comentário junto).
    if (cur.value != null) saveAnswer(activeQuestion, cur.value, cur.textValue, comment);
  };

  const handleText = (textValue: string) => {
    if (isReadOnly || !activeQuestion) return;
    const cur = answers[activeQuestion.id] ?? { value: null, textValue: "", comment: "" };
    setAnswers((prev) => ({ ...prev, [activeQuestion.id]: { ...cur, textValue } }));
    if (advanceTimer.current) clearTimeout(advanceTimer.current);
    saveAnswer(activeQuestion, cur.value, textValue, cur.comment);
  };

  const flushAll = useCallback(async () => {
    if (!entryId || isReadOnly) return;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    // A fila pendente entra no payload em vez de ser descartada. Ela pode
    // conter um APAGAR (opcional esvaziada) — e apagar não aparece na lista de
    // respondidas abaixo, então limpar a fila ressuscitava o texto antigo numa
    // ficha que está prestes a ser congelada.
    const pendentes = [...pendingSaves.current.values()];
    pendingSaves.current.clear();
    const respondidas = questions
      .filter((q) => isAnswered(q, answers[q.id]))
      .map((q) => {
        const a = answers[q.id];
        return isTextQuestion(q)
          ? { questionId: q.id, value: null, textValue: a.textValue.trim() }
          : {
              questionId: q.id,
              value: a.value as number,
              comment: a.comment.trim() ? a.comment.trim() : null,
            };
      });
    // A fila vence: é o estado mais recente da tela.
    const porPergunta = new Map<string, any>();
    for (const a of respondidas) porPergunta.set(a.questionId, a);
    for (const a of pendentes) porPergunta.set(a.questionId, a);
    const payload = [...porPergunta.values()];
    if (payload.length) await upsert.mutateAsync({ answers: payload, suppressToast: true });
  }, [entryId, isReadOnly, questions, answers, upsert]);

  const handleSubmitClick = () => {
    if (missingRequired > 0) {
      toast.warning(
        `Responda as ${missingRequired} pergunta(s) obrigatória(s) antes de enviar (${answered}/${total} respondidas).`,
      );
      return;
    }
    setSubmitOpen(true);
  };

  const handleConfirmSubmit = async () => {
    if (!entryId) return;
    try {
      await flushAll();
      await submitMut.mutateAsync();
      setSubmitOpen(false);
      navigate(routes.questionnaire.mine);
    } catch {
      /* toast via interceptor */
    }
  };

  const progressByQuestion = useMemo(() => {
    const map = new Map<string, { scored: number; total: number }>();
    for (const q of questions) map.set(q.id, { scored: isAnswered(q, answers[q.id]) ? 1 : 0, total: 1 });
    return map;
  }, [questions, answers]);

  return (
    <div className="flex flex-col gap-4 bg-background px-4 pt-4 pb-6">
      <PageHeader
        variant="default"
        title={entry?.questionnaire?.name ?? "Responder questionário"}
        icon={IconClipboardList}
        breadcrumbs={[
          { label: "Início", href: routes.home },
          { label: "Questionários", href: routes.questionnaire.mine },
          { label: entry?.questionnaire?.name ?? "Responder" },
        ]}
        actions={[
          ...(!isReadOnly && entry && (entry.questions?.length ?? 0) > 0
            ? [{
                key: "submit",
                label: "Finalizar e enviar",
                icon: IconSend,
                onClick: handleSubmitClick,
                disabled: missingRequired > 0 || submitMut.isPending,
                loading: submitMut.isPending,
              }]
            : []),
          { key: "back", label: "Voltar", icon: IconArrowLeft, variant: "outline" as const, onClick: () => navigate(routes.home) },
        ]}
      />

      {isLoading ? (
        <div className="flex flex-col gap-3">
          <Skeleton className="h-24 w-full rounded-lg" />
          <Skeleton className="h-2 w-full" />
          <Skeleton className="h-96 w-full rounded-lg" />
        </div>
      ) : isError || !entry ? (
        <Card>
          <CardContent className="py-16 text-center text-sm text-muted-foreground">
            Questionário não encontrado ou sem permissão de acesso.
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Question stepper bar. */}
          <Card className="overflow-hidden p-0">
            <div className="flex items-center gap-2 p-2">
              <Button size="icon" variant="default" onClick={() => goToOffset(-1)} aria-label="Pergunta anterior" className="h-12 w-12 shrink-0" disabled={total === 0}>
                <IconChevronLeft className="h-5 w-5" />
              </Button>
              <button type="button" onClick={() => setPickerOpen(true)} className="group flex min-w-0 flex-1 flex-col gap-2 rounded-md px-3 py-2 text-left hover:bg-muted/40">
                <div className="flex min-w-0 items-center gap-3">
                  <span className="truncate text-sm font-semibold leading-tight">{activeQuestion?.title ?? "—"}</span>
                  {activeQuestion?.isRequired === false && (
                    <span className="shrink-0 rounded-full border border-border/60 px-2 py-0.5 text-[10px] uppercase tracking-wide text-muted-foreground">
                      Opcional
                    </span>
                  )}
                  <span className="ml-auto shrink-0 text-[10px] uppercase tracking-wide text-muted-foreground">
                    Pergunta {total === 0 ? 0 : activeIndex + 1} de {total}
                    {activeQuestion?.group?.name ? ` · ${activeQuestion.group.name}` : ""}
                  </span>
                  <IconLayoutGrid className="h-4 w-4 shrink-0 text-muted-foreground opacity-60 group-hover:opacity-100" />
                </div>
                <StepperProgressBar
                  total={total}
                  currentIndex={activeIndex}
                  isScored={(i) => isAnswered(questions[i], answers[questions[i]?.id])}
                  className="w-full"
                />
              </button>
              <Button size="icon" variant="default" onClick={() => goToOffset(1)} aria-label="Próxima pergunta" className="h-12 w-12 shrink-0" disabled={total === 0}>
                <IconChevronRight className="h-5 w-5" />
              </Button>
            </div>
          </Card>

          {total === 0 ? (
            <Card>
              <CardContent className="py-10 text-center text-sm text-muted-foreground">
                Este questionário ainda não tem perguntas configuradas.
              </CardContent>
            </Card>
          ) : activeQuestion ? (
            <>
              {/* Description + auxiliary info as two distinct cards on the left, NOTAS rail on the right. */}
              <div className="grid grid-cols-1 items-stretch gap-4 lg:grid-cols-2">
                <div className="flex flex-col gap-4">
                  <Card className="flex flex-1 flex-col">
                    <CardHeader className="pb-2">
                      <CardTitle className="flex items-center gap-2 text-sm">
                        <IconNotes className="h-4 w-4 text-muted-foreground" />
                        Descrição
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="flex flex-1 flex-col">
                      <p className="text-sm leading-relaxed whitespace-pre-line text-foreground/90">
                        {activeQuestion.description || <span className="italic text-muted-foreground">Sem descrição.</span>}
                      </p>
                    </CardContent>
                  </Card>
                  {activeQuestion.helpText && (
                    <Card className="border-blue-200 bg-blue-50/50 dark:border-blue-900/40 dark:bg-blue-950/20">
                      <CardHeader className="pb-2">
                        <CardTitle className="flex items-center gap-2 text-sm text-blue-900 dark:text-blue-200">
                          <IconInfoCircle className="h-4 w-4" />
                          Informação auxiliar
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <p className="whitespace-pre-line text-sm leading-relaxed text-blue-900/90 dark:text-blue-200/90">
                          {activeQuestion.helpText}
                        </p>
                      </CardContent>
                    </Card>
                  )}
                </div>
                <div className="flex flex-col">
                  {isTextQuestion(activeQuestion) ? (
                    <Card className="flex flex-1 flex-col">
                      <CardHeader className="pb-2">
                        <CardTitle className="flex items-center gap-2 text-sm">
                          <IconWriting className="h-4 w-4 text-muted-foreground" />
                          Sua resposta
                          {activeQuestion.isRequired === false && (
                            <span className="text-xs font-normal text-muted-foreground">(opcional)</span>
                          )}
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="flex flex-1 flex-col">
                        <Textarea
                          value={activeAnswer?.textValue ?? ""}
                          onChange={(e) => handleText(e.target.value)}
                          disabled={isReadOnly}
                          rows={10}
                          maxLength={5000}
                          className="flex-1"
                          placeholder={isReadOnly ? "Sem resposta." : "Escreva sua resposta…"}
                        />
                      </CardContent>
                    </Card>
                  ) : (
                    <ScoreLevelPicker
                      topic={asTopic(activeQuestion) as any}
                      currentScore={activeAnswer?.value ?? null}
                      readOnly={isReadOnly}
                      isSaving={upsert.isPending}
                      showHeader={false}
                      onPickScore={handlePick}
                    />
                  )}
                </div>
              </div>

              {/* Comment — só faz sentido em pergunta fechada: numa de texto
                  livre a resposta JÁ é o texto. */}
              {!isTextQuestion(activeQuestion) && (
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="flex items-center gap-2 text-sm">
                      <IconMessage2 className="h-4 w-4 text-muted-foreground" />
                      Comentário <span className="text-xs font-normal text-muted-foreground">(opcional)</span>
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <Textarea
                      value={activeAnswer?.comment ?? ""}
                      onChange={(e) => handleComment(e.target.value)}
                      disabled={isReadOnly}
                      rows={3}
                      placeholder={isReadOnly ? "Sem comentário." : "Adicione um comentário (opcional)…"}
                    />
                  </CardContent>
                </Card>
              )}
            </>
          ) : null}

        </>
      )}

      <TopicPickerModal
        open={pickerOpen}
        onOpenChange={setPickerOpen}
        topics={questions.map((q) => asTopic(q) as any)}
        activeTopicId={activeQuestion?.id ?? null}
        progressByTopic={progressByQuestion}
        onSelect={(qid) => {
          const idx = questions.findIndex((q) => q.id === qid);
          if (idx >= 0) setActiveIndex(idx);
          setPickerOpen(false);
        }}
      />

      <AlertDialog open={submitOpen} onOpenChange={setSubmitOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <IconSend className="h-5 w-5 text-primary" />
              Enviar questionário?
            </AlertDialogTitle>
            <AlertDialogDescription>
              Você respondeu {answered} de {total} pergunta(s)
              {answered < total ? " — as demais são opcionais e ficarão em branco" : ""}. Após o
              envio, as respostas não poderão ser alteradas.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmSubmit} disabled={submitMut.isPending}>
              Confirmar e enviar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default QuestionnaireFillPage;
