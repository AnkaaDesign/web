import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useCut, useCutMutations, useCuts, useAuth } from "../../../../hooks";
import type { CutUpdateFormData } from "../../../../schemas";
import { canEditCuts } from "@/utils/permissions/entity-permissions";
import { PrivilegeRoute } from "@/components/navigation/privilege-route";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Separator } from "@/components/ui/separator";
import {
  SECTOR_PRIVILEGES,
  routes,
  CUT_STATUS,
  CUT_TYPE,
  CUT_ORIGIN,
  CUT_REQUEST_REASON,
  CUT_STATUS_LABELS,
  CUT_TYPE_LABELS,
  CUT_ORIGIN_LABELS,
  CUT_REQUEST_REASON_LABELS,
  CHANGE_LOG_ENTITY_TYPE,
  ENTITY_BADGE_CONFIG,
} from "../../../../constants";
import { formatDate, formatRelativeTime } from "../../../../utils";
import { usePageTracker } from "@/hooks/use-page-tracker";
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
import { LoadingSpinner } from "@/components/ui/loading";
import { FileItem } from "@/components/common/file";
import { ChangelogHistory } from "@/components/ui/changelog-history";
import {
  IconCut,
  IconPlayerPlay,
  IconCheck,
  IconClock,
  IconFile,
  IconAlertCircle,
  IconRefresh,
  IconHome,
  IconClipboardList,
  IconHash,
  IconArrowBack,
  IconExternalLink,
  IconInfoCircle,
  IconArrowRight,
  IconUser,
  IconBuildingFactory,
  IconScissors,
  IconReload,
  IconChevronRight,
} from "@tabler/icons-react";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";

export const CuttingDetailsPage = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { update } = useCutMutations();
  const [isUpdating, setIsUpdating] = useState(false);
  const [statusChangeDialogOpen, setStatusChangeDialogOpen] = useState(false);
  const [pendingStatus, setPendingStatus] = useState<CUT_STATUS | null>(null);

  // Permission checks
  const canEdit = canEditCuts(user);

  // Fetch cut details with all relations
  const {
    data: response,
    isLoading,
    error,
    refetch,
  } = useCut(id!, {
    enabled: !!id,
    include: {
      file: true,
      task: {
        include: {
          customer: true,
          sector: true,
        },
      },
      parentCut: {
        include: {
          file: true,
        },
      },
      childCuts: {
        include: {
          file: true,
        },
      },
    },
  });

  const cut = response?.data;

  // Fetch other cuts from the same task
  const { data: taskCutsResponse } = useCuts({
    where: {
      taskId: cut?.taskId,
      id: {
        not: cut?.id,
      },
    },
    include: {
      file: true,
    },
    orderBy: {
      createdAt: "desc",
    },
    take: 10,
    enabled: !!cut?.taskId,
  });

  const otherTaskCuts = taskCutsResponse?.data || [];

  // Track page access
  usePageTracker({
    title: cut ? `Recorte: ${cut.file?.filename || "Sem nome"}` : "Detalhes do Recorte",
    icon: "cut",
  });

  // Status change handlers
  const handleStatusChange = (newStatus: CUT_STATUS) => {
    if (!cut) return;

    // Validate transition
    const validTransitions: Record<CUT_STATUS, CUT_STATUS[]> = {
      [CUT_STATUS.PENDING]: [CUT_STATUS.CUTTING],
      [CUT_STATUS.CUTTING]: [CUT_STATUS.COMPLETED],
      [CUT_STATUS.COMPLETED]: [],
    };

    if (!validTransitions[cut.status as CUT_STATUS]?.includes(newStatus)) {
      toast.error("Transição de status inválida");
      return;
    }

    setPendingStatus(newStatus);
    setStatusChangeDialogOpen(true);
  };

  const confirmStatusChange = async () => {
    if (!cut || !pendingStatus) return;

    setIsUpdating(true);
    try {
      const updateData: Partial<CutUpdateFormData> = { status: pendingStatus };

      // Add required dates based on status
      if (pendingStatus === CUT_STATUS.CUTTING && !cut.startedAt) {
        updateData.startedAt = new Date();
      }
      if (pendingStatus === CUT_STATUS.COMPLETED && !cut.completedAt) {
        updateData.completedAt = new Date();
      }

      await update({ id: cut.id, data: updateData });
      setStatusChangeDialogOpen(false);
      toast.success("Status do recorte atualizado com sucesso!");
    } catch (error) {
      console.error("Error updating cut status:", error);
      toast.error("Erro ao atualizar status do recorte");
    } finally {
      setIsUpdating(false);
    }
  };

  // Get status badge variant
  const getStatusBadgeVariant = (status: CUT_STATUS) => {
    return (ENTITY_BADGE_CONFIG.CUT[status] || "default") as any;
  };

  // Calculate duration
  const getDuration = () => {
    if (!cut?.startedAt) return null;
    const start = new Date(cut.startedAt);
    const end = cut.completedAt ? new Date(cut.completedAt) : new Date();
    const diff = end.getTime() - start.getTime();
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    if (hours > 0) {
      return `${hours}h ${minutes}min`;
    }
    return `${minutes} minutos`;
  };

  // Loading state
  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-24 w-full rounded-lg" />
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Skeleton className="h-96 rounded-lg" />
          <Skeleton className="h-96 rounded-lg" />
          <Skeleton className="h-64 rounded-lg" />
          <Skeleton className="h-64 rounded-lg" />
        </div>
      </div>
    );
  }

  // Error or not found state
  if (error || !cut) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] animate-in fade-in-50 duration-500">
        <div className="text-center px-4 max-w-md mx-auto space-y-4">
          <div className="inline-flex p-4 bg-red-100 dark:bg-red-900/20 rounded-full mb-4">
            <IconAlertCircle className="h-10 w-10 text-red-600 dark:text-red-400" />
          </div>
          <h2 className="text-2xl font-semibold">Recorte não encontrado</h2>
          <p className="text-muted-foreground">O recorte que você está procurando não existe ou foi removido.</p>
          <div className="flex gap-2 justify-center">
            <Button onClick={() => navigate(routes.production.cutting.list)} variant="outline">
              <IconCut className="h-4 w-4 mr-2" />
              Voltar para lista
            </Button>
            <Button onClick={() => navigate(routes.production.root)}>
              <IconHome className="h-4 w-4 mr-2" />
              Ir para produção
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <PrivilegeRoute requiredPrivilege={[SECTOR_PRIVILEGES.PRODUCTION, SECTOR_PRIVILEGES.WAREHOUSE, SECTOR_PRIVILEGES.DESIGNER, SECTOR_PRIVILEGES.LEADER, SECTOR_PRIVILEGES.ADMIN]}>
      <div className="space-y-6">
        <div className="animate-in fade-in-50 duration-500">
          <PageHeader
            variant="detail"
            title={cut.file?.filename || "Recorte"}
            icon={IconCut}
            breadcrumbs={[
              { label: "Início", href: routes.home },
              { label: "Produção", href: routes.production.root },
              { label: "Recortes", href: routes.production.cutting.list },
              { label: cut.file?.filename || "Recorte" },
            ]}
            actions={[
              {
                key: "refresh",
                label: "Atualizar",
                icon: IconRefresh,
                onClick: () => refetch(),
              },
              ...(canEdit && cut.status === CUT_STATUS.PENDING
                ? [
                    {
                      key: "start",
                      label: "Iniciar Corte",
                      icon: IconPlayerPlay,
                      onClick: () => handleStatusChange(CUT_STATUS.CUTTING),
                      variant: "default" as const,
                    },
                  ]
                : []),
              ...(canEdit && cut.status === CUT_STATUS.CUTTING
                ? [
                    {
                      key: "complete",
                      label: "Finalizar Corte",
                      icon: IconCheck,
                      onClick: () => handleStatusChange(CUT_STATUS.COMPLETED),
                      variant: "default" as const,
                    },
                  ]
                : []),
            ]}
          />
        </div>
        {/* Main Information Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Basic Info Card */}
          <Card className="border-2 shadow-lg animate-in fade-in-50 duration-700">
            <CardHeader className="pb-6">
              <div className="flex items-start justify-between">
                <div className="space-y-1">
                  <CardTitle className="text-2xl font-bold flex items-center gap-2">
                    <IconScissors className="h-6 w-6 text-primary" />
                    Informações Básicas
                  </CardTitle>
                  <CardDescription>Detalhes do processo de corte</CardDescription>
                </div>
                <Badge variant={getStatusBadgeVariant(cut.status as CUT_STATUS)} className="text-sm px-3 py-1">
                  {CUT_STATUS_LABELS[cut.status as CUT_STATUS]}
                </Badge>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Left Column: Information */}
                <div className="space-y-4">
                  {/* Basic Information */}
                  <div className="space-y-4">
                    {/* Origin */}
                    <div className="space-y-1">
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <IconArrowBack className="h-4 w-4" />
                        <span>Origem</span>
                      </div>
                      <p className="font-semibold">{CUT_ORIGIN_LABELS[cut.origin as CUT_ORIGIN]}</p>
                    </div>

                    {/* Type */}
                    <div className="space-y-1">
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <IconHash className="h-4 w-4" />
                        <span>Tipo</span>
                      </div>
                      <p className="font-semibold">{CUT_TYPE_LABELS[cut.type as CUT_TYPE]}</p>
                    </div>

                    {/* Duration */}
                    <div className="space-y-1">
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <IconClock className="h-4 w-4" />
                        <span>Tempo de Execução</span>
                      </div>
                      <p className="font-semibold">{getDuration() || "Não iniciado"}</p>
                    </div>
                  </div>

                  {/* Recut Reason */}
                  {cut.reason && (
                    <>
                      <Separator />
                      <div className="space-y-2">
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <IconAlertCircle className="h-4 w-4 text-orange-500" />
                          <span>Motivo do Retrabalho</span>
                        </div>
                        <p className="font-semibold text-orange-600">{CUT_REQUEST_REASON_LABELS[cut.reason as CUT_REQUEST_REASON]}</p>
                      </div>
                    </>
                  )}

                  {/* Parent Cut (if recut) */}
                  {cut.parentCut && (
                    <>
                      <Separator />
                      <div className="rounded-lg bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 p-4 space-y-3">
                        <div className="flex items-center gap-2 text-sm font-medium text-yellow-800 dark:text-yellow-200">
                          <IconReload className="h-4 w-4" />
                          <span>Este é um Retrabalho</span>
                        </div>
                        <div className="flex items-start justify-between">
                          <div className="space-y-1">
                            <p className="font-semibold">{cut.parentCut.file?.filename || "Recorte Original"}</p>
                            <p className="text-sm text-muted-foreground">Criado em {formatDate(cut.parentCut.createdAt)}</p>
                          </div>
                          <Button variant="outline" size="sm" onClick={() => navigate(routes.production.cutting.details(cut.parentCut!.id))}>
                            Ver Original
                            <IconExternalLink className="h-4 w-4 ml-2" />
                          </Button>
                        </div>
                      </div>
                    </>
                  )}
                </div>

                {/* Right Column: File Preview */}
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                    <IconFile className="h-4 w-4" />
                    <span>Arquivo de Corte</span>
                  </div>
                  {cut.file ? (
                    <div className="flex justify-center lg:justify-start">
                      <FileItem
                        file={cut.file}
                        viewMode="grid"
                      />
                    </div>
                  ) : (
                    <div className="text-center py-8 text-muted-foreground bg-muted/30 rounded-lg">
                      <IconFile className="h-12 w-12 mx-auto mb-2 opacity-50" />
                      <p>Nenhum arquivo associado</p>
                    </div>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Task Information Card */}
          <Card className="border-2 shadow-lg animate-in fade-in-50 duration-800">
            <CardHeader className="pb-6">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-2xl font-bold flex items-center gap-2">
                    <IconClipboardList className="h-6 w-6 text-primary" />
                    Informações da Tarefa
                  </CardTitle>
                  <CardDescription>Detalhes da tarefa relacionada</CardDescription>
                </div>
                {cut.task && (
                  <Button variant="ghost" size="sm" onClick={() => navigate(routes.production.schedule.details(cut.task!.id))} className="text-xs">
                    <IconExternalLink className="h-3 w-3 mr-1" />
                    Ver detalhes
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {cut.task ? (
                <>
                  {/* Task Details */}
                  <div className="space-y-3">
                    <div className="space-y-1">
                      <p className="text-sm text-muted-foreground">Nome da Tarefa</p>
                      <p className="font-semibold text-lg">{cut.task.name}</p>
                    </div>

                    {cut.task.customer && (
                      <div className="space-y-1">
                        <p className="text-sm text-muted-foreground flex items-center gap-1">
                          <IconUser className="h-3 w-3" />
                          Cliente
                        </p>
                        <p className="font-semibold">{cut.task.customer.fantasyName}</p>
                      </div>
                    )}

                    {cut.task.sector && (
                      <div className="space-y-1">
                        <p className="text-sm text-muted-foreground flex items-center gap-1">
                          <IconBuildingFactory className="h-3 w-3" />
                          Setor
                        </p>
                        <p className="font-semibold">{cut.task.sector.name}</p>
                      </div>
                    )}
                  </div>

                  {/* Other Cuts from Same Task */}
                  {otherTaskCuts.length > 0 && (
                    <>
                      <Separator />
                      <div className="space-y-3">
                        <h4 className="font-semibold text-sm flex items-center gap-2">
                          <IconScissors className="h-4 w-4" />
                          Outros Recortes da Mesma Tarefa
                          <Badge variant="secondary" className="ml-1">
                            {otherTaskCuts.length}
                          </Badge>
                        </h4>
                        <div className="space-y-2 max-h-48 overflow-y-auto">
                          {otherTaskCuts.map((otherCut) => (
                            <div
                              key={otherCut.id}
                              className="flex items-center justify-between p-2 rounded-lg border hover:bg-muted/50 transition-colors cursor-pointer"
                              onClick={() => navigate(routes.production.cutting.details(otherCut.id))}
                            >
                              <div className="flex items-center gap-2 flex-1">
                                <IconFile className="h-4 w-4 text-muted-foreground" />
                                <span className="text-sm font-medium truncate">{otherCut.file?.filename || "Sem nome"}</span>
                              </div>
                              <div className="flex items-center gap-2">
                                <Badge variant={getStatusBadgeVariant(otherCut.status as CUT_STATUS)} className="text-xs">
                                  {CUT_STATUS_LABELS[otherCut.status as CUT_STATUS]}
                                </Badge>
                                <IconChevronRight className="h-4 w-4 text-muted-foreground" />
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </>
                  )}
                </>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <IconClipboardList className="h-12 w-12 mx-auto mb-2 opacity-50" />
                  <p>Nenhuma tarefa associada</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Child Cuts and Changelog Row */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Child Cuts (Recuts) Section */}
          {cut.childCuts && cut.childCuts.length > 0 && (
            <Card className="border shadow-md animate-in fade-in-50 duration-900">
              <CardHeader>
                <CardTitle className="text-lg font-bold flex items-center gap-2">
                  <IconReload className="h-5 w-5 text-primary" />
                  Retrabalhos Realizados
                  <Badge variant="secondary" className="ml-2">
                    {cut.childCuts.length}
                  </Badge>
                </CardTitle>
                <CardDescription>Histórico de retrabalhos baseados neste corte</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {cut.childCuts.map((childCut) => (
                    <div
                      key={childCut.id}
                      className="border rounded-lg p-4 hover:bg-muted/50 transition-colors cursor-pointer"
                      onClick={() => navigate(routes.production.cutting.details(childCut.id))}
                    >
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex items-center gap-2">
                          <IconScissors className="h-4 w-4 text-muted-foreground" />
                          <h4 className="font-semibold text-sm">{childCut.file?.filename || "Recorte"}</h4>
                        </div>
                        <Badge variant={getStatusBadgeVariant(childCut.status as CUT_STATUS)} className="text-xs">
                          {CUT_STATUS_LABELS[childCut.status as CUT_STATUS]}
                        </Badge>
                      </div>

                      {childCut.reason && (
                        <div className="flex items-center gap-1 mb-2">
                          <IconAlertCircle className="h-3 w-3 text-orange-500" />
                          <span className="text-xs text-orange-600">{CUT_REQUEST_REASON_LABELS[childCut.reason as CUT_REQUEST_REASON]}</span>
                        </div>
                      )}

                      <div className="flex items-center justify-between text-xs text-muted-foreground">
                        <span>Criado {formatRelativeTime(childCut.createdAt)}</span>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 text-xs"
                          onClick={(e) => {
                            e.stopPropagation();
                            navigate(routes.production.cutting.details(childCut.id));
                          }}
                        >
                          Ver Detalhes
                          <IconChevronRight className="h-3 w-3 ml-1" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Changelog Section */}
          <div className={cn("animate-in fade-in-50 duration-1000", !cut.childCuts || cut.childCuts.length === 0 ? "lg:col-span-2" : "")}>
            <ChangelogHistory
              entityType={CHANGE_LOG_ENTITY_TYPE.CUT}
              entityId={cut.id}
              entityName={cut.file?.filename || "Recorte"}
              entityCreatedAt={cut.createdAt}
              maxHeight="400px"
            />
          </div>
        </div>

        {/* Status Change Dialog */}
        <AlertDialog open={statusChangeDialogOpen} onOpenChange={setStatusChangeDialogOpen}>
          <AlertDialogContent className="max-w-lg">
            <AlertDialogHeader>
              <AlertDialogTitle className="text-xl">Confirmar Mudança de Status</AlertDialogTitle>
              <AlertDialogDescription className="text-base">Você está prestes a alterar o status do recorte.</AlertDialogDescription>
            </AlertDialogHeader>
            {pendingStatus && (
              <div className="rounded-lg bg-muted p-4 my-4 space-y-3">
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-muted-foreground">Arquivo:</span>
                    <p className="font-medium mt-1">{cut.file?.filename || "Sem nome"}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Tipo:</span>
                    <p className="font-medium mt-1">{CUT_TYPE_LABELS[cut.type as CUT_TYPE]}</p>
                  </div>
                </div>
                <Separator />
                <div className="flex items-center justify-between">
                  <div className="space-y-1">
                    <p className="text-sm text-muted-foreground">Status Atual</p>
                    <Badge variant={getStatusBadgeVariant(cut.status as CUT_STATUS)}>{CUT_STATUS_LABELS[cut.status as CUT_STATUS]}</Badge>
                  </div>
                  <IconArrowRight className="h-5 w-5 text-muted-foreground" />
                  <div className="space-y-1">
                    <p className="text-sm text-muted-foreground">Novo Status</p>
                    <Badge variant={getStatusBadgeVariant(pendingStatus)}>{CUT_STATUS_LABELS[pendingStatus]}</Badge>
                  </div>
                </div>
                {pendingStatus === CUT_STATUS.COMPLETED && (
                  <div className="text-sm text-muted-foreground bg-green-50 dark:bg-green-950 p-3 rounded-md">
                    <IconInfoCircle className="h-4 w-4 inline mr-2 text-green-500" />O horário de conclusão será registrado automaticamente.
                  </div>
                )}
              </div>
            )}
            <AlertDialogFooter>
              <AlertDialogCancel disabled={isUpdating}>Cancelar</AlertDialogCancel>
              <AlertDialogAction onClick={confirmStatusChange} disabled={isUpdating}>
                {isUpdating ? (
                  <>
                    <LoadingSpinner className="mr-2 h-4 w-4" />
                    Processando...
                  </>
                ) : (
                  "Confirmar Mudança"
                )}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </PrivilegeRoute>
  );
};

export default CuttingDetailsPage;
