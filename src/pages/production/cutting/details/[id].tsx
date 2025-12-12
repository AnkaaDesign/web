import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useCut, useCutMutations, useCuts, useAuth } from "../../../../hooks";
import type { CutUpdateFormData } from "../../../../schemas";
import { canEditCuts } from "@/utils/permissions/entity-permissions";
import { PrivilegeRoute } from "@/components/navigation/privilege-route";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
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
    <PrivilegeRoute requiredPrivilege={[SECTOR_PRIVILEGES.PRODUCTION, SECTOR_PRIVILEGES.WAREHOUSE, SECTOR_PRIVILEGES.DESIGNER, SECTOR_PRIVILEGES.ADMIN]}>
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
          {/* Basic Info Card with File Preview */}
          <Card className="border flex flex-col animate-in fade-in-50 duration-700" level={1}>
            <CardHeader className="pb-6">
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <IconScissors className="h-5 w-5 text-muted-foreground" />
                  Informações Gerais
                </CardTitle>
                <Badge variant={getStatusBadgeVariant(cut.status as CUT_STATUS)}>
                  {CUT_STATUS_LABELS[cut.status as CUT_STATUS]}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="pt-0 flex-1">
              <div className="grid grid-cols-1 md:grid-cols-[auto_1fr] gap-6 items-center">
                {/* Left: File Preview */}
                {cut.file ? (
                  <FileItem
                    file={cut.file}
                    viewMode="grid"
                  />
                ) : (
                  <div className="text-center py-8 text-muted-foreground bg-muted/30 rounded-lg">
                    <IconFile className="h-12 w-12 mx-auto mb-2 opacity-50" />
                    <p>Nenhum arquivo associado</p>
                  </div>
                )}

                {/* Right: Field-Value Rows */}
                <div className="space-y-4">
                  {/* Origin */}
                  <div className="flex justify-between items-center bg-muted/50 rounded-lg px-4 py-2.5">
                    <span className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                      <IconArrowBack className="h-4 w-4" />
                      Origem
                    </span>
                    <span className="text-sm font-semibold text-foreground">{CUT_ORIGIN_LABELS[cut.origin as CUT_ORIGIN]}</span>
                  </div>

                  {/* Type */}
                  <div className="flex justify-between items-center bg-muted/50 rounded-lg px-4 py-2.5">
                    <span className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                      <IconHash className="h-4 w-4" />
                      Tipo
                    </span>
                    <span className="text-sm font-semibold text-foreground">{CUT_TYPE_LABELS[cut.type as CUT_TYPE]}</span>
                  </div>

                  {/* Duration */}
                  <div className="flex justify-between items-center bg-muted/50 rounded-lg px-4 py-2.5">
                    <span className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                      <IconClock className="h-4 w-4" />
                      Tempo de Execução
                    </span>
                    <span className={cn("text-sm font-semibold", getDuration() ? "text-foreground" : "text-muted-foreground italic")}>
                      {getDuration() || "Não iniciado"}
                    </span>
                  </div>

                  {/* Recut Reason */}
                  {cut.reason && (
                    <div className="flex justify-between items-center bg-orange-50 dark:bg-orange-900/20 rounded-lg px-4 py-2.5 border border-orange-200 dark:border-orange-800">
                      <span className="text-sm font-medium text-orange-700 dark:text-orange-300 flex items-center gap-2">
                        <IconAlertCircle className="h-4 w-4" />
                        Motivo do Retrabalho
                      </span>
                      <span className="text-sm font-semibold text-orange-600 dark:text-orange-400">{CUT_REQUEST_REASON_LABELS[cut.reason as CUT_REQUEST_REASON]}</span>
                    </div>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Task Information Card */}
          <Card className="border flex flex-col animate-in fade-in-50 duration-800" level={1}>
            <CardHeader className="pb-6">
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <IconClipboardList className="h-5 w-5 text-muted-foreground" />
                  Informações da Tarefa
                </CardTitle>
                {cut.task && (
                  <Button variant="outline" size="sm" onClick={() => navigate(routes.production.schedule.details(cut.task!.id))}>
                    <IconExternalLink className="h-4 w-4 mr-2" />
                    Ver Tarefa
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent className="pt-0 flex-1">
              {cut.task ? (
                <div className="space-y-4">
                  {/* Task Name */}
                  <div className="flex justify-between items-center bg-muted/50 rounded-lg px-4 py-2.5">
                    <span className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                      <IconClipboardList className="h-4 w-4" />
                      Nome da Tarefa
                    </span>
                    <span className="text-sm font-semibold text-foreground">{cut.task.name}</span>
                  </div>

                  {/* Serial Number */}
                  {cut.task.serialNumber && (
                    <div className="flex justify-between items-center bg-muted/50 rounded-lg px-4 py-2.5">
                      <span className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                        <IconHash className="h-4 w-4" />
                        Número de Série
                      </span>
                      <span className="text-sm font-semibold text-foreground font-mono">{cut.task.serialNumber}</span>
                    </div>
                  )}

                  {/* Customer */}
                  {cut.task.customer && (
                    <div className="flex justify-between items-center bg-muted/50 rounded-lg px-4 py-2.5">
                      <span className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                        <IconUser className="h-4 w-4" />
                        Cliente
                      </span>
                      <span className="text-sm font-semibold text-foreground">{cut.task.customer.fantasyName}</span>
                    </div>
                  )}

                  {/* Sector */}
                  {cut.task.sector && (
                    <div className="flex justify-between items-center bg-muted/50 rounded-lg px-4 py-2.5">
                      <span className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                        <IconBuildingFactory className="h-4 w-4" />
                        Setor
                      </span>
                      <span className="text-sm font-semibold text-foreground">{cut.task.sector.name}</span>
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <IconClipboardList className="h-12 w-12 mx-auto mb-2 opacity-50" />
                  <p>Nenhuma tarefa associada</p>
                </div>
              )}
            </CardContent>
          </Card>

        </div>

        {/* Child Cuts (Recuts) Section - Full width if exists */}
        {cut.childCuts && cut.childCuts.length > 0 && (
          <Card className="border flex flex-col animate-in fade-in-50 duration-900" level={1}>
            <CardHeader className="pb-6">
              <CardTitle className="flex items-center gap-2">
                <IconReload className="h-5 w-5 text-muted-foreground" />
                Retrabalhos Realizados
                <Badge variant="secondary" className="ml-2">
                  {cut.childCuts.length}
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0 flex-1">
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {cut.childCuts.map((childCut) => (
                  <div
                    key={childCut.id}
                    className="bg-muted/50 rounded-lg px-4 py-3 hover:bg-muted/70 transition-colors cursor-pointer"
                    onClick={() => navigate(routes.production.cutting.details(childCut.id))}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 flex-1">
                        <IconScissors className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm font-medium truncate">{childCut.file?.filename || "Recorte"}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant={getStatusBadgeVariant(childCut.status as CUT_STATUS)} className="text-xs">
                          {CUT_STATUS_LABELS[childCut.status as CUT_STATUS]}
                        </Badge>
                        <IconChevronRight className="h-4 w-4 text-muted-foreground" />
                      </div>
                    </div>

                    {childCut.reason && (
                      <div className="flex items-center gap-1 mt-2">
                        <IconAlertCircle className="h-3 w-3 text-orange-500" />
                        <span className="text-xs text-orange-600">{CUT_REQUEST_REASON_LABELS[childCut.reason as CUT_REQUEST_REASON]}</span>
                      </div>
                    )}

                    <div className="text-xs text-muted-foreground mt-2">
                      Criado {formatRelativeTime(childCut.createdAt)}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Other Cuts and Changelog Row - 1/2 each */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Other Cuts from Same Task */}
          <Card className={cn("border flex flex-col animate-in fade-in-50 duration-850", otherTaskCuts.length === 0 ? "lg:col-span-2" : "")} level={1}>
            {otherTaskCuts.length > 0 ? (
              <>
                <CardHeader className="pb-6">
                  <CardTitle className="flex items-center gap-2">
                    <IconScissors className="h-5 w-5 text-muted-foreground" />
                    Outros Recortes da Tarefa
                    <Badge variant="secondary" className="ml-2">
                      {otherTaskCuts.length}
                    </Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-0 flex-1">
                  <div className="space-y-2 max-h-64 overflow-y-auto">
                    {otherTaskCuts.map((otherCut) => (
                      <div
                        key={otherCut.id}
                        className="flex items-center justify-between bg-muted/50 rounded-lg px-4 py-2.5 hover:bg-muted/70 transition-colors cursor-pointer"
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
                </CardContent>
              </>
            ) : (
              <ChangelogHistory
                entityType={CHANGE_LOG_ENTITY_TYPE.CUT}
                entityId={cut.id}
                entityName={cut.file?.filename || "Recorte"}
                entityCreatedAt={cut.createdAt}
                maxHeight="400px"
                className="h-full"
              />
            )}
          </Card>

          {/* Changelog Section - Only show if there are other cuts */}
          {otherTaskCuts.length > 0 && (
            <Card className="border flex flex-col animate-in fade-in-50 duration-1000" level={1}>
              <ChangelogHistory
                entityType={CHANGE_LOG_ENTITY_TYPE.CUT}
                entityId={cut.id}
                entityName={cut.file?.filename || "Recorte"}
                entityCreatedAt={cut.createdAt}
                maxHeight="400px"
                className="h-full"
              />
            </Card>
          )}
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
