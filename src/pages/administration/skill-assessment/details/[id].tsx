import { useMemo, useState } from "react";
import { Navigate, useNavigate, useParams } from "react-router-dom";
import {
  IconAlertTriangle,
  IconCalendar,
  IconCalendarPlus,
  IconCalendarTime,
  IconCategory,
  IconChartBar,
  IconClipboardList,
  IconEdit,
  IconHash,
  IconInfoCircle,
  IconLoader2,
  IconLock,
  IconRefresh,
  IconTrash,
  IconUser,
  IconUsers,
  IconX,
} from "@tabler/icons-react";

import {
  routes,
  SECTOR_PRIVILEGES,
  ASSESSMENT_STATUS,
  ASSESSMENT_STATUS_LABELS,
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
import { EntriesTable } from "@/components/administration/skill-assessment/entries-table";
import { CampaignAnalytics } from "@/components/administration/skill-assessment/campaign-analytics";
import { usePageTracker } from "@/hooks/common/use-page-tracker";
import { toast } from "@/components/ui/sonner";

function statusBadge(s: ASSESSMENT_STATUS) {
  const label = ASSESSMENT_STATUS_LABELS[s];
  switch (s) {
    case ASSESSMENT_STATUS.OPEN:
      return <Badge className="bg-blue-600 hover:bg-blue-700">{label}</Badge>;
    case ASSESSMENT_STATUS.CLOSED:
      return <Badge className="bg-emerald-600 hover:bg-emerald-700">{label}</Badge>;
    case ASSESSMENT_STATUS.CANCELLED:
      return <Badge variant="secondary">{label}</Badge>;
    case ASSESSMENT_STATUS.DRAFT:
    default:
      return <Badge variant="outline">{label}</Badge>;
  }
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

  const { data, isLoading, error, refetch, isRefetching } = useAssessment(id ?? "", {
    include: {
      createdBy: true,
      sectors: { include: { sector: true } },
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

  const handleDelete = async () => {
    try {
      await deleteMutation.mutateAsync(id);
      toast.success("Campanha excluída");
      navigate(routes.administration.skillAssessment.root);
    } catch (err) {
      toast.error("Erro ao excluir campanha");
    } finally {
      setIsDeleteOpen(false);
    }
  };

  const confirmLifecycleAction = async () => {
    if (!pendingLifecycleAction) return;
    try {
      if (pendingLifecycleAction === "close") {
        await closeMut.mutateAsync(id);
        toast.success("Campanha fechada.");
      } else if (pendingLifecycleAction === "cancel") {
        await cancelMut.mutateAsync(id);
        toast.success("Campanha cancelada.");
      }
    } catch (err) {
      toast.error("Erro ao alterar status da campanha");
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
            { label: "Administração" },
            { label: "Avaliação de Competências", href: routes.administration.skillAssessment.root },
            { label: assessment.name },
          ]}
          actions={[
            { key: "refresh", label: "Atualizar", icon: IconRefresh, onClick: () => refetch(), loading: isRefetching },
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
            { key: "delete", label: "Excluir", icon: IconTrash, onClick: () => setIsDeleteOpen(true), disabled: deleteMutation.isPending },
          ]}
          className="flex-shrink-0"
        />

        <div className="flex-1 overflow-y-auto pb-6">
          <Tabs defaultValue="overview" className="space-y-4">
            <TabsList>
              <TabsTrigger value="overview">Visão Geral</TabsTrigger>
              <TabsTrigger value="entries">Avaliações</TabsTrigger>
              <TabsTrigger value="analytics">
                <IconChartBar className="h-4 w-4 mr-2" />
                Análises
              </TabsTrigger>
            </TabsList>

            <TabsContent value="overview" className="space-y-4">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {/* Informações Card — status, período, autor, datas do sistema */}
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between">
                    <CardTitle className="flex items-center gap-2">
                      <IconInfoCircle className="h-5 w-5 text-muted-foreground" />
                      Informações
                    </CardTitle>
                    {statusBadge(status)}
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
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

                {/* Descrição Card */}
                <Card>
                  <CardHeader>
                    <CardTitle>Descrição</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm whitespace-pre-wrap text-foreground/90">
                      {assessment.description || (
                        <span className="text-muted-foreground italic">
                          Nenhuma descrição cadastrada.
                        </span>
                      )}
                    </p>
                  </CardContent>
                </Card>
              </div>

              {/* Resumo Card — now full-width since lifecycle actions moved to PageHeader */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <IconCategory className="h-5 w-5 text-muted-foreground" />
                    Resumo
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    <DetailRow
                      icon={IconUsers}
                      label="Setores"
                      value={
                        <span className="font-mono">
                          {assessment._count?.sectors ?? 0}
                        </span>
                      }
                    />
                    <DetailRow
                      icon={IconHash}
                      label="Tópicos"
                      value={<span className="font-mono">{topicsCount}</span>}
                    />
                    <DetailRow
                      icon={IconUser}
                      label="Avaliados"
                      value={
                        <span className="font-mono">
                          {assessment._count?.entries ?? 0}
                        </span>
                      }
                    />
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Setores incluídos</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-wrap gap-2">
                    {(assessment.sectors ?? []).map((s) => (
                      <Badge key={s.sectorId} variant="outline">
                        {s.sector?.name ?? s.sectorId}
                      </Badge>
                    ))}
                    {(assessment.sectors ?? []).length === 0 && (
                      <span className="text-sm text-muted-foreground">Nenhum setor.</span>
                    )}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Tópicos incluídos</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {sortedAssessmentTopics.length === 0 ? (
                      <span className="text-sm text-muted-foreground">Nenhum tópico.</span>
                    ) : (
                      sortedAssessmentTopics.map((t) => (
                        <div
                          key={t.topicId}
                          className="flex items-center justify-between rounded-md bg-muted/50 px-4 py-2.5 text-sm"
                        >
                          <div className="font-medium">{t.topic?.title ?? t.topicId}</div>
                          {t.topic?.skill && (
                            <Badge variant="outline" className="text-xs">
                              {t.topic.skill.name}
                            </Badge>
                          )}
                        </div>
                      ))
                    )}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="entries">
              <EntriesTable assessmentId={id} topicsCount={topicsCount} />
            </TabsContent>

            <TabsContent value="analytics">
              <CampaignAnalytics assessmentId={id} />
            </TabsContent>
          </Tabs>
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
