// pages/administration/questionnaire/details/[id].tsx
//
// Admin detail for a questionnaire campaign: info, lifecycle actions
// (open/close/cancel/delete), and the respondents (entries) list.

import { useMemo, useState } from "react";
import { Navigate, useParams, useNavigate } from "react-router-dom";
import {
  IconAlertTriangle,
  IconClipboardList,
  IconEyeOff,
  IconInfoCircle,
  IconLoader2,
  IconLockOpen,
  IconLock,
  IconBan,
  IconTrash,
  IconUsers,
  IconSearch,
} from "@tabler/icons-react";

import {
  routes,
  SECTOR_PRIVILEGES,
  QUESTIONNAIRE_STATUS,
} from "@/constants";
import {
  useQuestionnaire,
  useOpenQuestionnaire,
  useCloseQuestionnaire,
  useCancelQuestionnaire,
  useDeleteQuestionnaire,
} from "@/hooks/questionnaire/use-questionnaire";
import { usePageTracker } from "@/hooks/common/use-page-tracker";

import { PrivilegeRoute } from "@/components/navigation/privilege-route";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DetailRow } from "@/components/ui/detail-row";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
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
import { QuestionnaireStatusBadge } from "@/components/questionnaire/questionnaire-status-badge";
import { QuestionnaireEntryStatusBadge } from "@/components/questionnaire/questionnaire-entry-status-badge";
import { AnonymousResults } from "@/components/questionnaire/anonymous-results";

const HEAD_BASE = "h-10 px-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground";
const CELL_BASE = "px-3 py-3 align-middle !border-b !border-border/30";

const fmt = (d: Date | string | null | undefined) =>
  d ? new Date(d).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" }) : "—";

export const QuestionnaireDetailsPage = () => {
  usePageTracker({ title: "Detalhe do Questionário", icon: "clipboard-list" });
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const { data, isLoading, error } = useQuestionnaire(id ?? "", {
    include: {
      createdBy: true,
      targetUsers: { include: { user: true } },
      questions: { include: { question: { include: { group: true } } } },
      entries: {
        include: {
          respondent: { include: { position: true, sector: true } },
          answers: true,
          _count: { select: { answers: true } },
        },
      },
      _count: { select: { questions: true, entries: true, targetUsers: true } },
    } as any,
  });

  const openMut = useOpenQuestionnaire();
  const closeMut = useCloseQuestionnaire();
  const cancelMut = useCancelQuestionnaire();
  const deleteMut = useDeleteQuestionnaire();

  // Lifecycle confirmation dialog — styled AlertDialog (no window.confirm).
  const [pendingLifecycleAction, setPendingLifecycleAction] = useState<
    "open" | "close" | "cancel" | "delete" | null
  >(null);

  const q = data?.data as any;
  const entries = useMemo(() => (q?.entries ?? []) as any[], [q]);
  const questionsCount = q?._count?.questions ?? 0;

  const [search, setSearch] = useState("");
  const collator = useMemo(() => new Intl.Collator("pt-BR", { sensitivity: "base", numeric: true }), []);
  const filteredEntries = useMemo(() => {
    const term = search.trim().toLowerCase();
    const matched = !term
      ? entries
      : entries.filter((e) => e.respondent?.name?.toLowerCase().includes(term));
    return [...matched].sort((a, b) => {
      const s = collator.compare((a.respondent as any)?.sector?.name ?? "", (b.respondent as any)?.sector?.name ?? "");
      if (s !== 0) return s;
      return collator.compare(a.respondent?.name ?? "", b.respondent?.name ?? "");
    });
  }, [entries, search, collator]);

  // Questions grouped by Tema, for the "Perguntas incluídas" accordion.
  const perguntasByTema = useMemo(() => {
    const groups = new Map<string, { id: string; name: string; order: number; items: any[] }>();
    for (const link of (q?.questions ?? []) as any[]) {
      const question = link.question;
      if (!question) continue;
      const g = question.group;
      const key = g?.id ?? "_";
      const bucket = groups.get(key) ?? { id: key, name: g?.name ?? "Sem tema", order: g?.order ?? 999, items: [] as any[] };
      bucket.items.push(question);
      groups.set(key, bucket);
    }
    return Array.from(groups.values())
      .sort((a, b) => a.order - b.order)
      .map((g) => ({ ...g, items: g.items.sort((a, b) => (a.order ?? 0) - (b.order ?? 0)) }));
  }, [q]);

  if (!id) return <Navigate to={routes.administration.questionnaire.root} replace />;
  if (error) return <Navigate to={routes.administration.questionnaire.root} replace />;
  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <IconLoader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }
  if (!q) return <Navigate to={routes.administration.questionnaire.root} replace />;

  const status = q.status as QUESTIONNAIRE_STATUS;

  const lifecycleAnyPending =
    openMut.isPending || closeMut.isPending || cancelMut.isPending || deleteMut.isPending;

  // Copy + behavior for each lifecycle confirmation dialog.
  const lifecycleDialogCopy: Record<
    "open" | "close" | "cancel" | "delete",
    { title: string; description: string; destructive?: boolean; confirmLabel: string }
  > = {
    open: {
      title: "Abrir questionário?",
      description: "Esta ação gera as fichas dos respondentes e libera o preenchimento.",
      confirmLabel: "Abrir",
    },
    close: {
      title: "Fechar questionário?",
      description: "Esta ação encerra a coleta. Os respondentes não poderão mais enviar respostas.",
      confirmLabel: "Fechar",
    },
    cancel: {
      title: "Cancelar questionário?",
      description: "Esta ação invalida o questionário. As fichas existentes ficam congeladas.",
      confirmLabel: "Cancelar questionário",
    },
    delete: {
      title: "Excluir questionário?",
      description: `Tem certeza que deseja excluir o questionário "${q.name}" definitivamente? Esta ação não pode ser desfeita.`,
      destructive: true,
      confirmLabel: "Excluir",
    },
  };

  const confirmLifecycleAction = () => {
    if (!pendingLifecycleAction) return;
    const action = pendingLifecycleAction;
    const done = () => setPendingLifecycleAction(null);
    if (action === "open") openMut.mutate(q.id, { onSettled: done });
    else if (action === "close") closeMut.mutate(q.id, { onSettled: done });
    else if (action === "cancel") cancelMut.mutate(q.id, { onSettled: done });
    else if (action === "delete")
      deleteMut.mutate(q.id, {
        onSuccess: () => navigate(routes.administration.questionnaire.root),
        onSettled: done,
      });
  };

  const actions: any[] = [];
  if (status === QUESTIONNAIRE_STATUS.DRAFT) {
    actions.push({
      key: "open",
      label: "Abrir",
      icon: IconLockOpen,
      onClick: () => setPendingLifecycleAction("open"),
      disabled: lifecycleAnyPending,
      loading: openMut.isPending,
    });
  }
  if (status === QUESTIONNAIRE_STATUS.OPEN) {
    actions.push({
      key: "close",
      label: "Fechar",
      icon: IconLock,
      variant: "outline" as const,
      onClick: () => setPendingLifecycleAction("close"),
      disabled: lifecycleAnyPending,
      loading: closeMut.isPending,
    });
  }
  if (status === QUESTIONNAIRE_STATUS.DRAFT || status === QUESTIONNAIRE_STATUS.OPEN) {
    actions.push({
      key: "cancel",
      label: "Cancelar",
      icon: IconBan,
      variant: "outline" as const,
      onClick: () => setPendingLifecycleAction("cancel"),
      disabled: lifecycleAnyPending,
      loading: cancelMut.isPending,
    });
  }
  if (status === QUESTIONNAIRE_STATUS.CANCELLED) {
    actions.push({
      key: "delete",
      label: "Excluir",
      icon: IconTrash,
      variant: "destructive" as const,
      onClick: () => setPendingLifecycleAction("delete"),
      disabled: lifecycleAnyPending,
      loading: deleteMut.isPending,
    });
  }

  return (
    <PrivilegeRoute requiredPrivilege={[SECTOR_PRIVILEGES.ADMIN, SECTOR_PRIVILEGES.HUMAN_RESOURCES]}>
      <div className="h-full flex flex-col gap-4 bg-background px-4 pt-4">
        <PageHeader
          variant="detail"
          entity={q as any}
          title={q.name}
          icon={IconClipboardList}
          breadcrumbs={[
            { label: "Início", href: routes.home },
            { label: "Administração" },
            { label: "Questionários", href: routes.administration.questionnaire.root },
            { label: q.name },
          ]}
          actions={actions}
          className="flex-shrink-0"
        />

        <div className="flex-1 overflow-y-auto pb-6">
          <div className="space-y-4">
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 items-stretch">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                  <CardTitle className="flex items-center gap-2">
                    <IconInfoCircle className="h-5 w-5 text-muted-foreground" />
                    Informações
                  </CardTitle>
                  <div className="flex items-center gap-2">
                    {q.isAnonymous && (
                      <Badge variant="outline" className="gap-1.5">
                        <IconEyeOff className="h-3.5 w-3.5" />
                        Anônimo
                      </Badge>
                    )}
                    <QuestionnaireStatusBadge status={q.status} />
                  </div>
                </CardHeader>
                <CardContent className="space-y-2">
                  <DetailRow label="Período" value={`${fmt(q.periodStart)} – ${fmt(q.periodEnd)}`} />
                  <DetailRow label="Perguntas" value={String(q._count?.questions ?? 0)} />
                  <DetailRow label="Fichas geradas" value={String(q._count?.entries ?? 0)} />
                  <DetailRow
                    label="Público-alvo"
                    value={
                      q.targetAllUsers
                        ? "Todos os colaboradores"
                        : `${q._count?.targetUsers ?? (q.targetUsers ?? []).length} colaborador(es)`
                    }
                  />
                  <DetailRow label="Criada por" value={q.createdBy?.name ?? "—"} />
                  {q.description && (
                    <>
                      <Separator />
                      <DetailRow label="Descrição" value={q.description} block />
                    </>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <IconClipboardList className="h-5 w-5 text-muted-foreground" />
                    Perguntas incluídas
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {perguntasByTema.length === 0 ? (
                    <span className="text-sm text-muted-foreground">Nenhuma pergunta incluída.</span>
                  ) : (
                    <Accordion type="multiple" defaultValue={perguntasByTema[0] ? [perguntasByTema[0].id] : []} className="w-full">
                      {perguntasByTema.map((tema, idx) => (
                        <AccordionItem key={tema.id} value={tema.id} className={cn("border-border/40", idx === perguntasByTema.length - 1 && "border-b-0")}>
                          <AccordionTrigger className="py-3 hover:no-underline">
                            <div className="flex flex-1 items-center justify-between gap-3 pr-3">
                              <span className="font-medium">{tema.name}</span>
                              <Badge variant="default" className="text-xs">{tema.items.length}</Badge>
                            </div>
                          </AccordionTrigger>
                          <AccordionContent>
                            <div className="flex flex-col gap-2">
                              {tema.items.map((question: any) => (
                                <div key={question.id} className="rounded-md border border-border/40 bg-muted/30 px-3 py-2 text-sm">
                                  <span className="font-medium leading-tight">{question.title}</span>
                                  {question.description && (
                                    <p className="mt-0.5 text-xs leading-snug text-muted-foreground/80">{question.description}</p>
                                  )}
                                </div>
                              ))}
                            </div>
                          </AccordionContent>
                        </AccordionItem>
                      ))}
                    </Accordion>
                  )}
                </CardContent>
              </Card>
            </div>

            {q.isAnonymous ? (
              <AnonymousResults questionnaireId={id} />
            ) : (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <IconUsers className="h-5 w-5 text-muted-foreground" />
                  Respondentes ({filteredEntries.length})
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {entries.length === 0 ? (
                  <span className="text-sm text-muted-foreground">
                    Nenhuma ficha gerada ainda. Abra o questionário para gerar as fichas.
                  </span>
                ) : (
                  <>
                    <div className="relative">
                      <IconSearch className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        value={search}
                        onChange={(v) => setSearch(typeof v === "string" ? v : v == null ? "" : String(v))}
                        placeholder="Buscar por respondente..."
                        className="pl-9"
                      />
                    </div>

                    <div className="rounded-md border border-border/40 overflow-hidden">
                      <Table>
                        <TableHeader>
                          <TableRow className="border-b border-border/40 hover:!bg-muted">
                            <TableHead className={cn(HEAD_BASE, "w-64")}>Respondente</TableHead>
                            <TableHead className={cn(HEAD_BASE, "w-40")}>Cargo</TableHead>
                            <TableHead className={cn(HEAD_BASE, "w-40")}>Setor</TableHead>
                            <TableHead className={HEAD_BASE}>Progresso</TableHead>
                            <TableHead className={cn(HEAD_BASE, "w-20 text-center")}>Nota</TableHead>
                            <TableHead className={cn(HEAD_BASE, "w-32 text-center")}>Status</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {filteredEntries.length === 0 ? (
                            <TableRow>
                              <TableCell colSpan={6} className="text-center py-10 text-muted-foreground">
                                Nenhum respondente encontrado.
                              </TableCell>
                            </TableRow>
                          ) : (
                            filteredEntries.map((e, idx) => (
                              <RespondentRow
                                key={e.id}
                                entry={e}
                                questionsCount={questionsCount}
                                rowIndex={idx}
                                onOpen={() => navigate(routes.administration.questionnaire.entry(q.id, e.id))}
                              />
                            ))
                          )}
                        </TableBody>
                      </Table>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
            )}
          </div>
        </div>

        <AlertDialog
          open={!!pendingLifecycleAction}
          onOpenChange={(o) => !o && !lifecycleAnyPending && setPendingLifecycleAction(null)}
        >
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle className="flex items-center gap-2">
                <IconAlertTriangle
                  className={cn(
                    "h-5 w-5",
                    pendingLifecycleAction && lifecycleDialogCopy[pendingLifecycleAction].destructive
                      ? "text-destructive"
                      : "text-amber-500",
                  )}
                />
                {pendingLifecycleAction ? lifecycleDialogCopy[pendingLifecycleAction].title : ""}
              </AlertDialogTitle>
              <AlertDialogDescription>
                {pendingLifecycleAction ? lifecycleDialogCopy[pendingLifecycleAction].description : ""}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={lifecycleAnyPending}>Voltar</AlertDialogCancel>
              <AlertDialogAction
                onClick={confirmLifecycleAction}
                disabled={lifecycleAnyPending}
                className={cn(
                  pendingLifecycleAction && lifecycleDialogCopy[pendingLifecycleAction].destructive
                    ? "bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    : undefined,
                )}
              >
                {pendingLifecycleAction ? lifecycleDialogCopy[pendingLifecycleAction].confirmLabel : ""}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </PrivilegeRoute>
  );
};

function RespondentRow({
  entry,
  questionsCount,
  rowIndex,
  onOpen,
}: {
  entry: any;
  questionsCount: number;
  rowIndex: number;
  onOpen: () => void;
}) {
  const answered = entry._count?.answers ?? entry.answers?.length ?? 0;
  const pct = questionsCount > 0 ? Math.round((answered / questionsCount) * 100) : 0;

  const avg = useMemo(() => {
    const scored = (entry.answers ?? [])
      .map((a: any) => (typeof a.value === "number" ? a.value : null))
      .filter((s: number | null): s is number => s != null);
    if (scored.length === 0) return null;
    return scored.reduce((a: number, b: number) => a + b, 0) / scored.length;
  }, [entry.answers]);

  const position = (entry.respondent as any)?.position?.name as string | undefined;
  const sector = (entry.respondent as any)?.sector?.name as string | undefined;

  return (
    <TableRow
      onClick={onOpen}
      className={cn(
        "!border-b-0 cursor-pointer transition-colors",
        rowIndex % 2 === 1 ? "!bg-muted/15" : "!bg-transparent",
        "hover:!bg-muted/30",
      )}
    >
      <TableCell className={cn(CELL_BASE, "w-64")}>
        <div className="font-medium">{entry.respondent?.name ?? "—"}</div>
      </TableCell>
      <TableCell className={cn(CELL_BASE, "w-40")}>
        <span className="text-sm text-foreground/80">{position ?? "—"}</span>
      </TableCell>
      <TableCell className={cn(CELL_BASE, "w-40")}>
        <span className="text-sm text-foreground/80">{sector ?? "—"}</span>
      </TableCell>
      <TableCell className={cn(CELL_BASE, "w-40")}>
        <div className="flex items-center gap-2">
          <Progress value={pct} className="h-2" />
          <span className="text-xs text-muted-foreground tabular-nums w-12 text-right">
            {answered}/{questionsCount}
          </span>
        </div>
      </TableCell>
      <TableCell className={cn(CELL_BASE, "w-20 text-center")}>
        {avg != null ? (
          <ScoreBadge score={Math.round(avg)} label={avg.toFixed(2)} size="md" />
        ) : (
          <span className="text-xs text-muted-foreground">—</span>
        )}
      </TableCell>
      <TableCell className={cn(CELL_BASE, "w-32 text-center")}>
        <QuestionnaireEntryStatusBadge status={entry.status} />
      </TableCell>
    </TableRow>
  );
}

export default QuestionnaireDetailsPage;
