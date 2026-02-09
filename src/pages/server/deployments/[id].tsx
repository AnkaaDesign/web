import { useParams, useNavigate } from "react-router-dom";
import {
  IconRocket,
  IconGitBranch,
  IconGitCommit,
  IconUser,
  IconClock,
  IconCheck,
  IconX,
  IconRotateClockwise,
  IconFileCode,
  IconHeartbeat,
  IconDatabase,
  IconWorldWww,
  IconAlertCircle,
  IconActivity,
  IconServer,
  IconRefresh,
} from "@tabler/icons-react";

import {
  routes,
  SECTOR_PRIVILEGES,
  DEPLOYMENT_STATUS,
  DEPLOYMENT_STATUS_LABELS,
  DEPLOYMENT_ENVIRONMENT_LABELS,
} from "../../../constants";
import { formatDateTime } from "../../../utils";

import { useDeploymentDetail } from "../../../hooks";
import { PrivilegeRoute } from "@/components/navigation/privilege-route";
import { PageHeader } from "@/components/ui/page-header";
import { usePageTracker } from "@/hooks/common/use-page-tracker";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";

// Format duration in milliseconds to human readable format
const formatDuration = (milliseconds: number | null | undefined): string => {
  if (!milliseconds) return "N/A";

  try {
    const seconds = Math.floor(milliseconds / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);

    if (hours > 0) {
      return `${hours}h ${minutes % 60}m ${seconds % 60}s`;
    }
    if (minutes > 0) {
      return `${minutes}m ${seconds % 60}s`;
    }
    return `${seconds}s`;
  } catch (error) {
    if (process.env.NODE_ENV !== 'production') {
      console.error("[DeploymentDetail] Error formatting duration:", error, milliseconds);
    }
    return "N/A";
  }
};

const getStatusIcon = (status: string) => {
  switch (status) {
    case DEPLOYMENT_STATUS.COMPLETED:
      return IconCheck;
    case DEPLOYMENT_STATUS.FAILED:
      return IconX;
    case DEPLOYMENT_STATUS.IN_PROGRESS:
    case DEPLOYMENT_STATUS.BUILDING:
    case DEPLOYMENT_STATUS.TESTING:
    case DEPLOYMENT_STATUS.DEPLOYING:
      return IconClock;
    case DEPLOYMENT_STATUS.ROLLED_BACK:
      return IconRotateClockwise;
    default:
      return IconRocket;
  }
};

const getStatusColor = (status: string): "default" | "destructive" | "warning" | "success" | "secondary" => {
  switch (status) {
    case DEPLOYMENT_STATUS.COMPLETED:
      return "success";
    case DEPLOYMENT_STATUS.FAILED:
      return "destructive";
    case DEPLOYMENT_STATUS.IN_PROGRESS:
    case DEPLOYMENT_STATUS.BUILDING:
    case DEPLOYMENT_STATUS.TESTING:
    case DEPLOYMENT_STATUS.DEPLOYING:
      return "warning";
    case DEPLOYMENT_STATUS.PENDING:
      return "secondary";
    case DEPLOYMENT_STATUS.ROLLED_BACK:
      return "default";
    default:
      return "default";
  }
};

const getEnvironmentColor = (environment: string): "default" | "destructive" | "warning" => {
  return environment === "PRODUCTION" ? "destructive" : "warning";
};

interface InfoRowProps {
  icon: any;
  label: string;
  value: React.ReactNode;
  valueClassName?: string;
}

const InfoRow = ({ icon: Icon, label, value, valueClassName }: InfoRowProps) => (
  <div className="space-y-1">
    <div className="flex items-center gap-2">
      <Icon className="h-4 w-4 text-muted-foreground" />
      <p className="text-sm font-medium text-muted-foreground">{label}</p>
    </div>
    <div className={valueClassName || "text-sm pl-6"}>{value}</div>
  </div>
);

export const DeploymentDetailPage = () => {
  const { id } = useParams<{ id: string }>();

  usePageTracker({
    title: "Detalhes da Implantação",
    icon: "rocket",
  });

  const { data: response, isLoading, refetch } = useDeploymentDetail(id!, {
    include: {
      app: true,
      gitCommit: {
        include: {
          repository: true,
        },
      },
      user: {
        include: {
          position: true,
        },
      },
    },
  });

  const deployment = response?.data;

  const handleRefresh = () => {
    refetch();
  };

  if (isLoading) {
    return (
      <PrivilegeRoute requiredPrivilege={SECTOR_PRIVILEGES.ADMIN}>
        <div className="flex items-center justify-center p-8">
          <Skeleton className="h-32 w-full max-w-lg" />
        </div>
      </PrivilegeRoute>
    );
  }

  if (!deployment) {
    return (
      <PrivilegeRoute requiredPrivilege={SECTOR_PRIVILEGES.ADMIN}>
        <Alert variant="destructive">
          <IconAlertCircle className="h-4 w-4" />
          <AlertDescription>Implantação não encontrada</AlertDescription>
        </Alert>
      </PrivilegeRoute>
    );
  }

  const StatusIcon = deployment.status ? getStatusIcon(deployment.status) : IconRocket;

  return (
    <PrivilegeRoute requiredPrivilege={SECTOR_PRIVILEGES.ADMIN}>
      <div className="space-y-6">
        <PageHeader
          variant="detail"
          title={deployment.app?.displayName || "Implantação"}
          icon={IconRocket}
          breadcrumbs={[
            { label: "Início", href: routes.home },
            { label: "Servidor", href: routes.server.root },
            { label: "Implantações", href: routes.server.deployments.root },
            { label: "Detalhes" },
          ]}
          actions={[
            {
              key: "refresh",
              label: "Atualizar",
              icon: IconRefresh,
              onClick: handleRefresh,
            },
          ]}
        />

        {/* Status and Environment Overview */}
        <div className="grid gap-6 md:grid-cols-2">
              {/* Status Card */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <StatusIcon className="h-5 w-5" />
                    Status da Implantação
                  </CardTitle>
                  <CardDescription>Estado atual do processo</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">Status</span>
                      <Badge variant={deployment.status ? getStatusColor(deployment.status) : "default"} className="gap-1">
                        <StatusIcon className="h-3 w-3" />
                        <span>{deployment.status ? String(DEPLOYMENT_STATUS_LABELS[deployment.status] || deployment.status) : "N/A"}</span>
                      </Badge>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">Ambiente</span>
                      <Badge variant={deployment.environment ? getEnvironmentColor(deployment.environment) : "default"}>
                        {deployment.environment ? String(DEPLOYMENT_ENVIRONMENT_LABELS[deployment.environment] || deployment.environment) : "N/A"}
                      </Badge>
                    </div>
                    {deployment.triggeredBy && (
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-muted-foreground">Tipo de Trigger</span>
                        <Badge variant="outline">{String(deployment.triggeredBy)}</Badge>
                      </div>
                    )}
                    {deployment.buildNumber && (
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-muted-foreground">Build Number</span>
                        <span className="text-sm font-medium">#{deployment.buildNumber}</span>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>

              {/* Application Info */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <IconServer className="h-5 w-5" />
                    Informações da Aplicação
                  </CardTitle>
                  <CardDescription>Detalhes do sistema implantado</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <InfoRow
                      icon={IconWorldWww}
                      label="Aplicação"
                      value={<span className="font-medium">{deployment.app?.displayName || "N/A"}</span>}
                    />
                    {deployment.app?.appType && (
                      <InfoRow
                        icon={IconServer}
                        label="Tipo"
                        value={<Badge variant="outline">{String(deployment.app.appType)}</Badge>}
                      />
                    )}
                    {deployment.version && (
                      <InfoRow
                        icon={IconFileCode}
                        label="Versão"
                        value={<code className="rounded bg-muted px-2 py-1 text-xs font-mono">{String(deployment.version)}</code>}
                      />
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Git Commit Information */}
            {deployment.gitCommit && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <IconGitCommit className="h-5 w-5" />
                    Informações do Commit
                  </CardTitle>
                  <CardDescription>Código-fonte implantado</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid gap-6 md:grid-cols-2">
                    <div className="space-y-4">
                      <InfoRow
                        icon={IconGitCommit}
                        label="Hash"
                        value={
                          <code className="rounded bg-muted px-2 py-1 text-xs font-mono">
                            {String(deployment.gitCommit.shortHash || deployment.gitCommit.hash)}
                          </code>
                        }
                      />
                      <InfoRow
                        icon={IconGitBranch}
                        label="Branch"
                        value={<Badge variant="outline">{String(deployment.gitCommit.branch || "N/A")}</Badge>}
                      />
                      {deployment.gitCommit.tags && deployment.gitCommit.tags.length > 0 && (
                        <InfoRow
                          icon={IconFileCode}
                          label="Tags"
                          value={
                            <div className="flex gap-1 flex-wrap">
                              {deployment.gitCommit.tags.map((tag: string) => (
                                <Badge key={tag} variant="secondary" className="text-xs">
                                  {tag}
                                </Badge>
                              ))}
                            </div>
                          }
                        />
                      )}
                    </div>
                    <div className="space-y-4">
                      <InfoRow
                        icon={IconUser}
                        label="Autor"
                        value={
                          <div className="space-y-1">
                            <p className="font-medium">{String(deployment.gitCommit.author || "N/A")}</p>
                            {deployment.gitCommit.authorEmail && (
                              <p className="text-xs text-muted-foreground">{String(deployment.gitCommit.authorEmail)}</p>
                            )}
                          </div>
                        }
                      />
                      {deployment.gitCommit.message && (
                        <InfoRow
                          icon={IconFileCode}
                          label="Mensagem"
                          value={<p className="text-sm">{String(deployment.gitCommit.message)}</p>}
                        />
                      )}
                      {(deployment.gitCommit.filesChanged || deployment.gitCommit.insertions || deployment.gitCommit.deletions) && (
                        <InfoRow
                          icon={IconActivity}
                          label="Alterações"
                          value={
                            <div className="text-xs space-y-1">
                              {deployment.gitCommit.filesChanged && (
                                <p>{deployment.gitCommit.filesChanged} arquivo(s) alterado(s)</p>
                              )}
                              <p className="space-x-2">
                                {deployment.gitCommit.insertions !== undefined && (
                                  <span className="text-green-600">+{deployment.gitCommit.insertions}</span>
                                )}
                                {deployment.gitCommit.deletions !== undefined && (
                                  <span className="text-red-600">-{deployment.gitCommit.deletions}</span>
                                )}
                              </p>
                            </div>
                          }
                        />
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Timeline and Execution Details */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <IconClock className="h-5 w-5" />
                  Timeline de Execução
                </CardTitle>
                <CardDescription>Histórico temporal da implantação</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid gap-6 md:grid-cols-3">
                  <InfoRow
                    icon={IconClock}
                    label="Iniciado em"
                    value={deployment.startedAt ? formatDateTime(deployment.startedAt) : "-"}
                  />
                  <InfoRow
                    icon={deployment.status === DEPLOYMENT_STATUS.COMPLETED ? IconCheck : IconClock}
                    label="Concluído em"
                    value={deployment.completedAt ? formatDateTime(deployment.completedAt) : "-"}
                  />
                  {deployment.duration && (
                    <InfoRow
                      icon={IconClock}
                      label="Duração"
                      value={
                        <Badge variant="outline" className="gap-1">
                          <IconClock className="h-3 w-3" />
                          {formatDuration(deployment.duration)}
                        </Badge>
                      }
                    />
                  )}
                </div>

                {deployment.rolledBackAt && (
                  <>
                    <Separator className="my-4" />
                    <InfoRow
                      icon={IconRotateClockwise}
                      label="Revertido em"
                      value={formatDateTime(deployment.rolledBackAt)}
                    />
                  </>
                )}

                {deployment.user && (
                  <>
                    <Separator className="my-4" />
                    <InfoRow
                      icon={IconUser}
                      label="Implantado por"
                      value={
                        <div className="space-y-1">
                          <p className="font-medium">{String(deployment.user.name)}</p>
                          {deployment.user.position?.name && (
                            <p className="text-xs text-muted-foreground">{String(deployment.user.position.name)}</p>
                          )}
                          {deployment.user.email && (
                            <p className="text-xs text-muted-foreground">{String(deployment.user.email)}</p>
                          )}
                        </div>
                      }
                    />
                  </>
                )}
              </CardContent>
            </Card>

            {/* Health Check */}
            {(deployment.healthCheckUrl || deployment.healthCheckStatus) && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <IconHeartbeat className="h-5 w-5" />
                    Health Check
                  </CardTitle>
                  <CardDescription>Verificação de saúde da aplicação</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid gap-6 md:grid-cols-2">
                    {deployment.healthCheckUrl && (
                      <InfoRow
                        icon={IconWorldWww}
                        label="URL"
                        value={
                          <a
                            href={String(deployment.healthCheckUrl)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-primary hover:underline break-all text-sm"
                          >
                            {String(deployment.healthCheckUrl)}
                          </a>
                        }
                      />
                    )}
                    {deployment.healthCheckStatus && (
                      <InfoRow
                        icon={deployment.healthCheckStatus === "healthy" ? IconCheck : IconX}
                        label="Status"
                        value={
                          <Badge variant={deployment.healthCheckStatus === "healthy" ? "success" : "destructive"}>
                            {String(deployment.healthCheckStatus)}
                          </Badge>
                        }
                      />
                    )}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Error Information */}
            {deployment.errorMessage && (
              <Card className="border-destructive">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-destructive">
                    <IconAlertCircle className="h-5 w-5" />
                    Erro
                  </CardTitle>
                  <CardDescription>Informações sobre a falha na implantação</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="rounded-md border border-destructive bg-destructive/10 p-4">
                      <p className="text-sm text-destructive font-medium">{String(deployment.errorMessage)}</p>
                    </div>
                    {deployment.errorStack && (
                      <div className="rounded-md border bg-muted/50">
                        <pre className="p-4 overflow-x-auto text-xs font-mono max-h-64 overflow-y-auto">
                          {String(deployment.errorStack)}
                        </pre>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Deployment Logs */}
            {(deployment.deploymentLog || deployment.buildLog) && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <IconFileCode className="h-5 w-5" />
                    Logs
                  </CardTitle>
                  <CardDescription>Saída do processo de implantação</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {deployment.buildLog && (
                      <div>
                        <p className="text-sm font-medium mb-2">Build Log</p>
                        <div className="rounded-md border bg-muted/50">
                          <pre className="p-4 overflow-x-auto text-xs font-mono max-h-96 overflow-y-auto">
                            {String(deployment.buildLog)}
                          </pre>
                        </div>
                      </div>
                    )}
                    {deployment.deploymentLog && (
                      <div>
                        <p className="text-sm font-medium mb-2">Deployment Log</p>
                        <div className="rounded-md border bg-muted/50">
                          <pre className="p-4 overflow-x-auto text-xs font-mono max-h-96 overflow-y-auto">
                            {String(deployment.deploymentLog)}
                          </pre>
                        </div>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Metadata */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <IconDatabase className="h-5 w-5" />
                  Metadados
                </CardTitle>
                <CardDescription>Informações do sistema</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid gap-6 md:grid-cols-3">
                  <InfoRow
                    icon={IconClock}
                    label="Criado em"
                    value={deployment.createdAt ? formatDateTime(deployment.createdAt) : "-"}
                  />
                  <InfoRow
                    icon={IconClock}
                    label="Atualizado em"
                    value={deployment.updatedAt ? formatDateTime(deployment.updatedAt) : "-"}
                  />
                  <InfoRow
                    icon={IconDatabase}
                    label="ID"
                    value={<code className="text-xs break-all">{deployment.id}</code>}
                  />
                </div>
              </CardContent>
            </Card>
      </div>
    </PrivilegeRoute>
  );
};
