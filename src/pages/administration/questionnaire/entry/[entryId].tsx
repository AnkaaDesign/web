// pages/administration/questionnaire/entry/[entryId].tsx
//
// Admin read-only review of ONE QuestionnaireEntry — same stepper layout as the
// self-fill page, read-only: step through questions, see the respondent's
// answer highlighted in the NOTAS rail + their comment. Reuses ScoreLevelPicker.

import { useMemo, useState } from "react";
import { Navigate, useParams } from "react-router-dom";
import {
  IconChevronLeft,
  IconChevronRight,
  IconClipboardList,
  IconInfoCircle,
  IconLayoutGrid,
  IconLoader2,
  IconLockOpen,
  IconMessage2,
  IconNotes,
  IconRefresh,
} from "@tabler/icons-react";

import { routes, SECTOR_PRIVILEGES, QUESTIONNAIRE_ENTRY_STATUS } from "@/constants";
import {
  useQuestionnaireEntry,
  useReopenQuestionnaireEntry,
} from "@/hooks/questionnaire/use-questionnaire-entry";
import { usePageTracker } from "@/hooks/common/use-page-tracker";

import { PrivilegeRoute } from "@/components/navigation/privilege-route";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
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
import { ScoreLevelPicker } from "@/components/production/skill-assessment/matrix/score-level-picker";
import { TopicPickerModal } from "@/components/production/skill-assessment/matrix/topic-picker-modal";
import { StepperProgressBar } from "@/components/production/skill-assessment/matrix/stepper-progress-bar";

const noop = () => {};
const asTopic = (q: any) =>
  q ? { ...q, skill: q.group ?? null, levels: (q.options ?? []).map((o: any) => ({ id: o.id, score: o.value, name: o.label, description: o.description ?? "" })) } : null;

export const QuestionnaireEntryDetailsPage = () => {
  usePageTracker({ title: "Resposta do Questionário", icon: "clipboard-list" });
  const { id, entryId } = useParams<{ id: string; entryId: string }>();
  const [activeIndex, setActiveIndex] = useState(0);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [isReopenOpen, setIsReopenOpen] = useState(false);

  const { data, isLoading, isRefetching, refetch, error } = useQuestionnaireEntry(entryId);
  const reopenMut = useReopenQuestionnaireEntry(entryId ?? "");

  const entry = data?.data as any;
  const questions = useMemo(() => ((entry?.questions ?? []) as any[]).filter((q) => (q.options?.length ?? 0) > 0), [entry]);
  const answersByQuestion = entry?.answersByQuestion ?? {};

  const total = questions.length;
  const active = questions[activeIndex] ?? null;
  const activeAnswer = active ? answersByQuestion[active.id] : null;

  const progressByQuestion = useMemo(() => {
    const map = new Map<string, { scored: number; total: number }>();
    for (const q of questions) map.set(q.id, { scored: answersByQuestion[q.id]?.value != null ? 1 : 0, total: 1 });
    return map;
  }, [questions, answersByQuestion]);

  if (!id || !entryId) return <Navigate to={routes.administration.questionnaire.root} replace />;
  if (error) return <Navigate to={routes.administration.questionnaire.details(id)} replace />;
  if (isLoading) {
    return <div className="flex items-center justify-center h-full"><IconLoader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>;
  }
  if (!entry) return <Navigate to={routes.administration.questionnaire.details(id)} replace />;

  const canReopen = entry.status === QUESTIONNAIRE_ENTRY_STATUS.SUBMITTED;
  const goToOffset = (offset: number) => { if (total) setActiveIndex((i) => (i + offset + total) % total); };

  return (
    <PrivilegeRoute requiredPrivilege={[SECTOR_PRIVILEGES.ADMIN, SECTOR_PRIVILEGES.HUMAN_RESOURCES]}>
      <div className="flex flex-col gap-4 bg-background px-4 pt-4 pb-6">
        <PageHeader
          variant="detail"
          title={entry.respondent?.name ?? "Resposta"}
          icon={IconClipboardList}
          breadcrumbs={[
            { label: "Início", href: routes.home },
            { label: "Administração" },
            { label: "Questionários", href: routes.administration.questionnaire.root },
            { label: entry.questionnaire?.name ?? "Questionário", href: routes.administration.questionnaire.details(id) },
            { label: entry.respondent?.name ?? "Resposta" },
          ]}
          actions={[
            { key: "refresh", label: "Atualizar", icon: IconRefresh, onClick: () => refetch(), loading: isRefetching },
            ...(canReopen ? [{ key: "reopen", label: "Reabrir", icon: IconLockOpen, variant: "outline" as const, onClick: () => setIsReopenOpen(true), disabled: reopenMut.isPending }] : []),
          ]}
        />

        {/* Question stepper bar. */}
        <Card className="overflow-hidden p-0">
          <div className="flex items-center gap-2 p-2">
            <Button size="icon" variant="default" onClick={() => goToOffset(-1)} aria-label="Pergunta anterior" className="h-12 w-12 shrink-0" disabled={total === 0}>
              <IconChevronLeft className="h-5 w-5" />
            </Button>
            <button type="button" onClick={() => setPickerOpen(true)} className="group flex min-w-0 flex-1 flex-col gap-2 rounded-md px-3 py-2 text-left hover:bg-muted/40">
              <div className="flex min-w-0 items-center gap-3">
                <span className="truncate text-sm font-semibold leading-tight">{active?.title ?? "—"}</span>
                <span className="ml-auto shrink-0 text-[10px] uppercase tracking-wide text-muted-foreground">
                  Pergunta {total === 0 ? 0 : activeIndex + 1} de {total}
                  {active?.group?.name ? ` · ${active.group.name}` : ""}
                </span>
                <IconLayoutGrid className="h-4 w-4 shrink-0 text-muted-foreground opacity-60 group-hover:opacity-100" />
              </div>
              <StepperProgressBar
                total={total}
                currentIndex={activeIndex}
                isScored={(i) => answersByQuestion[questions[i]?.id]?.value != null}
                className="w-full"
              />
            </button>
            <Button size="icon" variant="default" onClick={() => goToOffset(1)} aria-label="Próxima pergunta" className="h-12 w-12 shrink-0" disabled={total === 0}>
              <IconChevronRight className="h-5 w-5" />
            </Button>
          </div>
        </Card>

        {active && (
          <>
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
                      {active.description || <span className="italic text-muted-foreground">Sem descrição.</span>}
                    </p>
                  </CardContent>
                </Card>
                {active.helpText && (
                  <Card className="border-blue-200 bg-blue-50/50 dark:border-blue-900/40 dark:bg-blue-950/20">
                    <CardHeader className="pb-2">
                      <CardTitle className="flex items-center gap-2 text-sm text-blue-900 dark:text-blue-200">
                        <IconInfoCircle className="h-4 w-4" />
                        Informação auxiliar
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="whitespace-pre-line text-sm leading-relaxed text-blue-900/90 dark:text-blue-200/90">
                        {active.helpText}
                      </p>
                    </CardContent>
                  </Card>
                )}
              </div>
              <div className="flex flex-col">
                <ScoreLevelPicker
                  topic={asTopic(active) as any}
                  currentScore={activeAnswer?.value ?? null}
                  readOnly
                  showHeader={false}
                  onPickScore={noop}
                  selectedAction={activeAnswer?.comment?.trim() ? <CommentButton value={activeAnswer.comment} /> : undefined}
                />
              </div>
            </div>
          </>
        )}
      </div>

      <TopicPickerModal
        open={pickerOpen}
        onOpenChange={setPickerOpen}
        topics={questions.map((q) => asTopic(q) as any)}
        activeTopicId={active?.id ?? null}
        progressByTopic={progressByQuestion}
        onSelect={(qid) => { const idx = questions.findIndex((q) => q.id === qid); if (idx >= 0) setActiveIndex(idx); setPickerOpen(false); }}
      />

      <AlertDialog open={isReopenOpen} onOpenChange={setIsReopenOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <IconLockOpen className="h-5 w-5 text-amber-500" />
              Reabrir resposta?
            </AlertDialogTitle>
            <AlertDialogDescription>
              A resposta voltará ao status "Em progresso" e o respondente poderá editá-la novamente. O
              histórico não será apagado.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={reopenMut.isPending}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => reopenMut.mutate(undefined, { onSettled: () => setIsReopenOpen(false) })}
              disabled={reopenMut.isPending}
            >
              Reabrir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </PrivilegeRoute>
  );
};

/** Respondent comment shown as a visible pill on the selected score card; opens a modal. */
function CommentButton({ value }: { value: string }) {
  const has = !!value?.trim();
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button
          type="button"
          size="sm"
          aria-label="Ver comentário"
          className="h-7 gap-1 border border-white/30 bg-white/20 px-2 text-xs font-medium text-white shadow-sm hover:bg-white/30"
        >
          <IconMessage2 className="h-4 w-4" />
          Comentário
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <IconMessage2 className="h-5 w-5 text-muted-foreground" />
            Comentário
          </DialogTitle>
        </DialogHeader>
        {has ? (
          <p className="whitespace-pre-wrap text-sm leading-relaxed text-foreground/90">{value}</p>
        ) : (
          <p className="text-sm italic text-muted-foreground">Nenhum comentário registrado.</p>
        )}
      </DialogContent>
    </Dialog>
  );
}

export default QuestionnaireEntryDetailsPage;
