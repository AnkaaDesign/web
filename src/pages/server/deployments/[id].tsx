import { useParams, useNavigate } from "react-router-dom";
import {
  IconRocket,
  IconArrowLeft,
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
} from "@tabler/icons-react";

import {
  routes,
  SECTOR_PRIVILEGES,
  DEPLOYMENT_STATUS,
  DEPLOYMENT_STATUS_LABELS,
  DEPLOYMENT_ENVIRONMENT_LABELS,
} from "../../../constants";
import { formatDateTime } from "../../../utils";

// Format duration in seconds to human readable format
const formatDuration = (seconds: number): string => {
  try {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;

    if (hours > 0) {
      return `${hours}h ${minutes}m ${secs}s`;
    }
    if (minutes > 0) {
      return `${minutes}m ${secs}s`;
    }
    return `${secs}s`;
  } catch (error) {
    console.error("[DeploymentDetail] Error formatting duration:", error, seconds);
    return "N/A";
  }
};

// Safely stringify JSON data
const safeStringify = (data: any): string => {
  try {
    if (data === null || data === undefined) {
      console.log("[DeploymentDetail] safeStringify: data is null/undefined");
      return "null";
    }
    if (typeof data === "string") {
      console.log("[DeploymentDetail] safeStringify: data is already a string");
      return data;
    }
    const result = JSON.stringify(data, null, 2);
    console.log("[DeploymentDetail] safeStringify: successfully stringified", typeof data);
    return result;
  } catch (error) {
    console.error("[DeploymentDetail] Error stringifying data:", error, data);
    return `Error serializing data: ${error instanceof Error ? error.message : "Unknown error"}`;
  }
};
import { useDeploymentDetail } from "../../../hooks";

import { PrivilegeRoute } from "@/components/navigation/privilege-route";
import { PageHeaderWithFavorite } from "@/components/ui/page-header-with-favorite";
import { usePageTracker } from "@/hooks/use-page-tracker";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";

const getStatusIcon = (status: string) => {
  switch (status) {
    case DEPLOYMENT_STATUS.COMPLETED:
      return <IconCheck className="h-4 w-4" />;
    case DEPLOYMENT_STATUS.FAILED:
      return <IconX className="h-4 w-4" />;
    case DEPLOYMENT_STATUS.IN_PROGRESS:
    case DEPLOYMENT_STATUS.BUILDING:
    case DEPLOYMENT_STATUS.TESTING:
    case DEPLOYMENT_STATUS.DEPLOYING:
      return <IconClock className="h-4 w-4 animate-pulse" />;
    case DEPLOYMENT_STATUS.ROLLED_BACK:
      return <IconRotateClockwise className="h-4 w-4" />;
    default:
      return <IconRocket className="h-4 w-4" />;
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

const InfoRow = ({ icon: Icon, label, value, valueClassName }: { icon: any; label: string; value: React.ReactNode; valueClassName?: string }) => (
  <div className="flex items-start gap-3">
    <div className="mt-0.5">
      <Icon className="h-4 w-4 text-muted-foreground" />
    </div>
    <div className="flex-1 space-y-1">
      <p className="text-sm font-medium text-muted-foreground">{label}</p>
      <div className={valueClassName || "text-sm"}>{value}</div>
    </div>
  </div>
);

export const DeploymentDetailPage = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  console.log("[DeploymentDetail] Component mounted with id:", id);

  usePageTracker({
    title: "Detalhes da Implantação",
    icon: "rocket",
  });

  const { data: response, isLoading } = useDeploymentDetail(id!, {
    include: {
      user: {
        include: {
          position: true,
        },
      },
    },
  });

  const deployment = response?.data;

  console.log("[DeploymentDetail] Response data:", {
    hasResponse: !!response,
    hasDeployment: !!deployment,
    isLoading,
    deploymentKeys: deployment ? Object.keys(deployment) : [],
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-muted-foreground">Carregando...</div>
      </div>
    );
  }

  if (!deployment) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-muted-foreground">Implantação não encontrada</div>
      </div>
    );
  }

  // Calculate duration if we have both timestamps
  const duration =
    deployment.startedAt && deployment.completedAt
      ? Math.floor((new Date(deployment.completedAt).getTime() - new Date(deployment.startedAt).getTime()) / 1000)
      : null;

  console.log("[DeploymentDetail] Calculated duration:", duration, {
    startedAt: deployment.startedAt,
    completedAt: deployment.completedAt,
  });

  return (
    <PrivilegeRoute requiredPrivilege={SECTOR_PRIVILEGES.ADMIN}>
      <div className="flex flex-col h-full overflow-hidden">
        <PageHeaderWithFavorite
          title="Detalhes da Implantação"
          icon={IconRocket}
          breadcrumbs={[
            { label: "Início", href: routes.home },
            { label: "Servidor", href: routes.server.root },
            { label: "Implantações", href: routes.server.deployments.root },
            { label: "Detalhes" },
          ]}
          actions={[
            {
              key: "back",
              label: "Voltar",
              onClick: () => navigate(routes.server.deployments.root),
              variant: "outline" as const,
              icon: <IconArrowLeft className="h-4 w-4" />,
            },
          ]}
        />

        <div className="flex-1 overflow-auto px-4 pb-4">
          <div className="space-y-4">
            {/* Overview Section */}
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      <span>Visão Geral</span>
                      {deployment.status ? getStatusIcon(deployment.status) : null}
                    </CardTitle>
                    <CardDescription>Informações principais da implantação</CardDescription>
                  </div>
                  <div className="flex gap-2">
                    <Badge variant={deployment.environment ? getEnvironmentColor(deployment.environment) : "default"}>
                      <span>{deployment.environment ? String(DEPLOYMENT_ENVIRONMENT_LABELS[deployment.environment] || deployment.environment) : "N/A"}</span>
                    </Badge>
                    <Badge variant={deployment.status ? getStatusColor(deployment.status) : "default"} className="gap-1">
                      {deployment.status ? getStatusIcon(deployment.status) : null}
                      <span>{deployment.status ? String(DEPLOYMENT_STATUS_LABELS[deployment.status] || deployment.status) : "N/A"}</span>
                    </Badge>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid gap-6 md:grid-cols-2">
                  <div className="space-y-4">
                    <InfoRow
                      icon={IconGitCommit}
                      label="Commit SHA"
                      value={
                        <div className="space-y-1">
                          <code className="rounded bg-muted px-2 py-1 text-xs font-mono">{String(deployment.commitSha || "N/A")}</code>
                          {deployment.commitMessage && (
                            <p className="text-xs text-muted-foreground">{String(deployment.commitMessage)}</p>
                          )}
                        </div>
                      }
                    />

                    <InfoRow
                      icon={IconGitBranch}
                      label="Branch"
                      value={
                        <div className="space-y-1">
                          <p>{String(deployment.branch || "N/A")}</p>
                          {deployment.commitAuthor && (
                            <p className="text-xs text-muted-foreground">Author: {String(deployment.commitAuthor)}</p>
                          )}
                        </div>
                      }
                    />

                    {deployment.version && (
                      <InfoRow
                        icon={IconFileCode}
                        label="Versão"
                        value={<code className="rounded bg-muted px-2 py-1 text-xs font-mono">{String(deployment.version)}</code>}
                      />
                    )}

                    {deployment.application && (
                      <InfoRow
                        icon={IconWorldWww}
                        label="Aplicação"
                        value={<Badge variant="outline">{String(deployment.application)}</Badge>}
                      />
                    )}
                  </div>

                  <div className="space-y-4">
                    <InfoRow
                      icon={IconUser}
                      label="Implantado por"
                      value={
                        <div className="space-y-1">
                          <p>{String(deployment.user?.name || deployment.deployedBy || "Sistema")}</p>
                          {deployment.user?.position?.name && (
                            <p className="text-xs text-muted-foreground">{String(deployment.user.position.name)}</p>
                          )}
                          {deployment.user?.email && (
                            <p className="text-xs text-muted-foreground">{String(deployment.user.email)}</p>
                          )}
                        </div>
                      }
                    />

                    {deployment.previousCommit && (
                      <InfoRow
                        icon={IconGitCommit}
                        label="Commit Anterior"
                        value={<code className="rounded bg-muted px-2 py-1 text-xs font-mono">{String(deployment.previousCommit)}</code>}
                      />
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Timeline Section */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <IconClock className="h-5 w-5" />
                  Timeline
                </CardTitle>
                <CardDescription>Histórico de eventos da implantação</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
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

                    {deployment.rolledBackAt && (
                      <InfoRow
                        icon={IconRotateClockwise}
                        label="Revertido em"
                        value={formatDateTime(deployment.rolledBackAt)}
                      />
                    )}
                  </div>

                  {duration !== null && duration !== undefined ? (
                    <>
                      <Separator />
                      <InfoRow
                        icon={IconClock}
                        label="Duração Total"
                        value={
                          <Badge variant="outline" className="gap-1">
                            <IconClock className="h-3 w-3" />
                            <span>{formatDuration(duration)}</span>
                          </Badge>
                        }
                      />
                    </>
                  ) : null}
                </div>
              </CardContent>
            </Card>

            {/* Health Check Section */}
            {deployment.healthCheckUrl && (
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
                    <InfoRow
                      icon={IconWorldWww}
                      label="URL"
                      value={
                        <a
                          href={String(deployment.healthCheckUrl || "")}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-primary hover:underline break-all"
                        >
                          {String(deployment.healthCheckUrl)}
                        </a>
                      }
                    />

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

            {/* Deployment Log Section */}
            {deployment.deploymentLog && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <IconFileCode className="h-5 w-5" />
                    Log da Implantação
                  </CardTitle>
                  <CardDescription>Saída do processo de implantação</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="rounded-md border bg-muted/50">
                    <pre className="p-4 overflow-x-auto text-xs font-mono max-h-96 overflow-y-auto">
                      {String(deployment.deploymentLog)}
                    </pre>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Rollback Data Section */}
            {deployment.rollbackData && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <IconDatabase className="h-5 w-5" />
                    Dados de Rollback
                  </CardTitle>
                  <CardDescription>Informações para reversão da implantação</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="rounded-md border bg-muted/50">
                    <pre className="p-4 overflow-x-auto text-xs font-mono">
                      {safeStringify(deployment.rollbackData)}
                    </pre>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Metadata Section */}
            <Card>
              <CardHeader>
                <CardTitle>Metadados</CardTitle>
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

                  <InfoRow icon={IconDatabase} label="ID" value={<code className="text-xs">{deployment.id}</code>} />
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </PrivilegeRoute>
  );
};
