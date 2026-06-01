import { useMemo, useState } from "react";
import { Navigate, useNavigate, useParams } from "react-router-dom";
import {
  IconAlertTriangle,
  IconBuildingFactory,
  IconCalendar,
  IconCalendarPlus,
  IconCalendarTime,
  IconClipboardList,
  IconEdit,
  IconHash,
  IconInfoCircle,
  IconLoader2,
  IconLock,
  IconNotes,
  IconTrash,
  IconUser,
  IconX,
} from "@tabler/icons-react";

import {
  routes,
  SECTOR_PRIVILEGES,
  ASSESSMENT_STATUS,
} from "../../../../constants";
import { formatDate, formatDateTime } from "../../../../utils";
import {
  useAssessment,
  useDeleteAssessment,
  useCloseAssessment,
  useCancelAssessment,
} from "../../../../hooks";

import { PrivilegeRoute } from "@/components/navigation/privilege-route";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { DetailRow } from "@/components/ui/detail-row";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { cn } from "@/lib/utils";
import { AssessmentStatusBadge } from "@/components/production/skill-assessment/assessment-status-badge";
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
import { EntriesTable, type PlannedEntry } from "@/components/administration/skill-assessment/entries-table";
import { usePageTracker } from "@/hooks/common/use-page-tracker";

/**
 * Flatten the AssessmentSector + evaluatees graph into one pseudo-entry per
 * evaluatee. Used to populate the Avaliações list while the campaign is still
 * in DRAFT (real AssessmentEntry rows only exist after open).
 */
function buildPlannedEntries(assessment: any): PlannedEntry[] {
  const rows: PlannedEntry[] = [];
  for (const cfg of assessment?.sectors ?? []) {
    const appraiser = cfg.appraiser ?? cfg.sector?.leader ?? null;
    for (const ev of cfg.evaluatees ?? []) {
      const user = ev.user;
      if (!user) continue;
      rows.push({
        id: `${cfg.sectorId}:${user.id}`,
        evaluatee: user,
        evaluator: appraiser,
        sectorName: cfg.sector?.name,
      });
    }
  }
  return rows;
}

export const SkillAssessmentDetailsPage = () => {
  usePageTracker({ title: "Detalhes da Campanha", icon: "clipboard-list" });
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [pendingLifecycleAction, setPendingLifecycleAction] = useState<
    "close" | "cancel" | null
  >(null);

  const closeMut = useCloseAssessment();
  const cancelMut = useCancelAssessment();

  const { data, isLoading, error } = useAssessment(id ?? "", {
    include: {
      createdBy: true,
      sectors: {
        include: {
          sector: { include: { leader: true } },
          appraiser: true,
          evaluatees: {
            include: {
              user: { include: { position: true, sector: true } },
            },
          },
          _count: { select: { evaluatees: true } },
        },
      },
      skills: { include: { skill: true } },
      topics: { include: { topic: { include: { skill: true } } } },
      _count: { select: { sectors: true, topics: true, entries: true } },
    } as any,
  } as any);

  const deleteMutation = useDeleteAssessment();

  const assessment = data?.data;

  // Sort assessment topics by skill.order ASC then topic.order ASC so they
  // appear in the same order across all surfaces (overview tab + analytics +
  // leader fill flow). Must be declared before any conditional returns to
  // respect the Rules of Hooks.
  const sortedAssessmentTopics = useMemo(() => {
    const list = [...(assessment?.topics ?? [])];
    return list.sort((a, b) => {
      const skA = a.topic?.skill?.order ?? Number.MAX_SAFE_INTEGER;
      const skB = b.topic?.skill?.order ?? Number.MAX_SAFE_INTEGER;
      if (skA !== skB) return skA - skB;
      return (a.topic?.order ?? 0) - (b.topic?.order ?? 0);
    });
  }, [assessment?.topics]);

  // Group topics by skill for the Accordion render.
  const topicsBySkill = useMemo(() => {
    const groups = new Map<
      string,
      { skillId: string; skillName: string; topics: typeof sortedAssessmentTopics }
    >();
    for (const t of sortedAssessmentTopics) {
      const sid = t.topic?.skill?.id ?? "_unknown";
      const sname = t.topic?.skill?.name ?? "Sem competência";
      const g = groups.get(sid);
      if (g) g.topics.push(t);
      else groups.set(sid, { skillId: sid, skillName: sname, topics: [t] });
    }
    return Array.from(groups.values());
  }, [sortedAssessmentTopics]);

  if (!id) return <Navigate to={routes.administration.skillAssessment.root} replace />;
  if (error) return <Navigate to={routes.administration.skillAssessment.root} replace />;
  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <IconLoader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }
  if (!assessment) return <Navigate to={routes.administration.skillAssessment.root} replace />;

  const status = assessment.status as ASSESSMENT_STATUS;
  const canEdit = status === ASSESSMENT_STATUS.DRAFT;
  const topicsCount = assessment._count?.topics ?? assessment.topics?.length ?? 0;
  // In DRAFT, entries don't exist yet — show the planned evaluatee count from
  // the per-sector configuration. After OPEN, the entries are the source of truth.
  // Using `_count.evaluatees` keeps the payload small (no full user records).
  const plannedEvaluateeCount = (assessment.sectors ?? []).reduce(
    (sum: number, s: any) => sum + (s._count?.evaluatees ?? s.evaluatees?.length ?? 0),
    0,
  );
  const evaluateesCount =
    status === ASSESSMENT_STATUS.DRAFT
      ? plannedEvaluateeCount
      : (assessment._count?.entries ?? plannedEvaluateeCount);

  const handleDelete = async () => {
    try {
      await deleteMutation.mutateAsync(id);
      // Success/error toasts handled by the axios interceptor.
      navigate(routes.administration.skillAssessment.root);
    } catch {
      // Error toast handled by the axios interceptor.
    } finally {
      setIsDeleteOpen(false);
    }
  };

  const confirmLifecycleAction = async () => {
    if (!pendingLifecycleAction) return;
    try {
      if (pendingLifecycleAction === "close") {
        await closeMut.mutateAsync(id);
      } else if (pendingLifecycleAction === "cancel") {
        await cancelMut.mutateAsync(id);
      }
    } catch (err) {
      // Success/error toasts handled by the axios interceptor.
      if (process.env.NODE_ENV !== "production") console.error(err);
    } finally {
      setPendingLifecycleAction(null);
    }
  };

  const lifecycleAnyPending = closeMut.isPending || cancelMut.isPending;
  const lifecycleDialogCopy: Record<
    "close" | "cancel",
    { title: string; description: string }
  > = {
    close: {
      title: "Fechar campanha?",
      description:
        "Esta ação encerra a coleta. Líderes não poderão mais enviar avaliações pendentes.",
    },
    cancel: {
      title: "Cancelar campanha?",
      description:
        "Esta ação invalida a campanha. As entradas existentes ficam congeladas e não recebem novas respostas.",
    },
  };

  return (
    <PrivilegeRoute requiredPrivilege={[SECTOR_PRIVILEGES.ADMIN, SECTOR_PRIVILEGES.HUMAN_RESOURCES, SECTOR_PRIVILEGES.PRODUCTION_MANAGER]}>
      <div className="h-full flex flex-col gap-4 bg-background px-4 pt-4">
        <PageHeader
          variant="detail"
          entity={assessment as any}
          title={assessment.name}
          icon={IconClipboardList}
          breadcrumbs={[
            { label: "Início", href: routes.home },
            { label: "Administração", href: routes.administration.root },
            { label: "Avaliação de Competências", href: routes.administration.skillAssessment.root },
            { label: assessment.name },
          ]}
          actions={[
            ...(canEdit
              ? [{ key: "edit", label: "Editar", icon: IconEdit, onClick: () => navigate(routes.administration.skillAssessment.edit(id)) }]
              : []),
            ...(status === ASSESSMENT_STATUS.OPEN
              ? [{
                  key: "close",
                  label: "Fechar campanha",
                  icon: IconLock,
                  variant: "outline" as const,
                  onClick: () => setPendingLifecycleAction("close"),
                  disabled: lifecycleAnyPending,
                  loading: closeMut.isPending,
                }]
              : []),
            ...(status === ASSESSMENT_STATUS.OPEN || status === ASSESSMENT_STATUS.DRAFT
              ? [{
                  key: "cancel",
                  label: "Cancelar campanha",
                  icon: IconX,
                  variant: "destructive" as const,
                  onClick: () => setPendingLifecycleAction("cancel"),
                  disabled: lifecycleAnyPending,
                  loading: cancelMut.isPending,
                }]
              : []),
            // Only CANCELLED campaigns can be deleted — DRAFT must be cancelled
            // first. This prevents accidental destruction of in-progress work.
            ...(status === ASSESSMENT_STATUS.CANCELLED
              ? [{
                  key: "delete",
                  label: "Excluir",
                  icon: IconTrash,
                  variant: "destructive" as const,
                  onClick: () => setIsDeleteOpen(true),
                  disabled: deleteMutation.isPending,
                }]
              : []),
          ]}
          className="flex-shrink-0"
        />

        <div className="flex-1 overflow-y-auto pb-6">
          <div className="space-y-4">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-stretch">
              {/* Informações — everything about the campaign in one card */}
              <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                  <CardTitle className="flex items-center gap-2">
                    <IconInfoCircle className="h-5 w-5 text-muted-foreground" />
                    Informações
                  </CardTitle>
                  <AssessmentStatusBadge status={status} />
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {/* Scope / context first */}
                    <DetailRow
                      icon={IconCalendar}
                      label="Período"
                      value={
                        <span>
                          {formatDate(assessment.periodStart)} – {formatDate(assessment.periodEnd)}
                        </span>
                      }
                    />
                    <DetailRow
                      icon={IconHash}
                      label="Tópicos"
                      value={<span className="tabular-nums">{topicsCount}</span>}
                    />
                    <DetailRow
                      icon={IconUser}
                      label="Avaliados"
                      value={
                        <span className="tabular-nums">{evaluateesCount}</span>
                      }
                    />
                    <DetailRow
                      icon={IconBuildingFactory}
                      label="Setores incluídos"
                      value={
                        (assessment.sectors ?? []).length === 0 ? (
                          <span className="text-muted-foreground">—</span>
                        ) : (
                          <span>
                            {(assessment.sectors ?? [])
                              .map((s) => s.sector?.name ?? s.sectorId)
                              .join(", ")}
                          </span>
                        )
                      }
                    />
                    <DetailRow
                      icon={IconNotes}
                      label="Descrição"
                      value={
                        assessment.description ? (
                          <span className="whitespace-pre-wrap text-right">
                            {assessment.description}
                          </span>
                        ) : (
                          <span className="text-muted-foreground italic">
                            Nenhuma descrição cadastrada.
                          </span>
                        )
                      }
                    />

                    {/* System metadata last */}
                    <DetailRow
                      icon={IconUser}
                      label="Criada por"
                      value={<span>{assessment.createdBy?.name ?? "—"}</span>}
                    />
                    <DetailRow
                      icon={IconCalendarPlus}
                      label="Criada em"
                      value={
                        <span className="text-sm">
                          {assessment.createdAt ? formatDateTime(assessment.createdAt) : "—"}
                        </span>
                      }
                    />
                    <DetailRow
                      icon={IconCalendarTime}
                      label="Atualizada em"
                      value={
                        <span className="text-sm">
                          {assessment.updatedAt ? formatDateTime(assessment.updatedAt) : "—"}
                        </span>
                      }
                    />
                  </div>
                </CardContent>
              </Card>

              {/* Tópicos incluídos — grouped by competência via accordion */}
              <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                  <CardTitle className="flex items-center gap-2">
                    <IconHash className="h-5 w-5 text-muted-foreground" />
                    Tópicos incluídos
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {topicsBySkill.length === 0 ? (
                    <span className="text-sm text-muted-foreground">Nenhum tópico.</span>
                  ) : (
                    <Accordion
                      type="multiple"
                      defaultValue={
                        topicsBySkill[0] ? [topicsBySkill[0].skillId] : []
                      }
                      className="w-full"
                    >
                      {topicsBySkill.map((group, idx) => (
                        <AccordionItem
                          key={group.skillId}
                          value={group.skillId}
                          className={cn(
                            "border-border/40",
                            idx === topicsBySkill.length - 1 && "border-b-0",
                          )}
                        >
                          <AccordionTrigger className="py-3 hover:no-underline">
                            <div className="flex flex-1 items-center justify-between pr-3">
                              <span className="font-medium">{group.skillName}</span>
                              <Badge variant="outline" className="text-xs">
                                {group.topics.length}
                              </Badge>
                            </div>
                          </AccordionTrigger>
                          <AccordionContent>
                            <div className="space-y-1.5">
                              {group.topics.map((t) => (
                                <div
                                  key={t.topicId}
                                  className="rounded-md bg-muted/50 px-3 py-2 text-sm space-y-1"
                                >
                                  <span className="font-medium leading-tight block">
                                    {t.topic?.title ?? t.topicId}
                                  </span>
                                  {t.topic?.description && (
                                    <p className="text-xs text-muted-foreground leading-snug">
                                      {t.topic.description}
                                    </p>
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

            <EntriesTable
              assessmentId={id}
              topicsCount={topicsCount}
              plannedEntries={
                status === ASSESSMENT_STATUS.DRAFT
                  ? buildPlannedEntries(assessment)
                  : undefined
              }
            />
          </div>
        </div>

        <AlertDialog
          open={!!pendingLifecycleAction}
          onOpenChange={(o) => !o && setPendingLifecycleAction(null)}
        >
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle className="flex items-center gap-2">
                <IconAlertTriangle className="h-5 w-5 text-amber-500" />
                {pendingLifecycleAction
                  ? lifecycleDialogCopy[pendingLifecycleAction].title
                  : ""}
              </AlertDialogTitle>
              <AlertDialogDescription>
                {pendingLifecycleAction
                  ? lifecycleDialogCopy[pendingLifecycleAction].description
                  : ""}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Voltar</AlertDialogCancel>
              <AlertDialogAction
                onClick={confirmLifecycleAction}
                disabled={lifecycleAnyPending}
              >
                Confirmar
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        <AlertDialog open={isDeleteOpen} onOpenChange={setIsDeleteOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle className="flex items-center gap-2">
                <IconAlertTriangle className="h-5 w-5 text-destructive" />
                Confirmar Exclusão
              </AlertDialogTitle>
              <AlertDialogDescription>
                Tem certeza que deseja excluir a campanha "{assessment.name}"?
                {(assessment._count?.entries ?? 0) > 0 && (
                  <span className="block mt-2 font-medium text-destructive">
                    Esta campanha possui {assessment._count?.entries} avaliação(ões).
                  </span>
                )}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction
                onClick={handleDelete}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                disabled={deleteMutation.isPending}
              >
                {deleteMutation.isPending ? "Excluindo..." : "Excluir"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </PrivilegeRoute>
  );
};


export default SkillAssessmentDetailsPage;
