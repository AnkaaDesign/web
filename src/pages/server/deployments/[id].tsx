import { useParams, useNavigate } from "react-router-dom";
import { IconRocket, IconArrowLeft } from "@tabler/icons-react";

import { routes, SECTOR_PRIVILEGES, DEPLOYMENT_STATUS_LABELS, DEPLOYMENT_ENVIRONMENT_LABELS } from "../../../constants";
import { formatDateTime } from "../../../utils";
import { useDeploymentDetail } from "../../../hooks";

import { PrivilegeRoute } from "@/components/navigation/privilege-route";
import { PageHeaderWithFavorite } from "@/components/ui/page-header-with-favorite";
import { usePageTracker } from "@/hooks/use-page-tracker";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export const DeploymentDetailPage = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  usePageTracker({
    title: "Detalhes da Implantação",
    icon: "rocket",
  });

  const { data: deployment, isLoading } = useDeploymentDetail(id!);

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

  return (
    <PrivilegeRoute requiredPrivilege={SECTOR_PRIVILEGES.ADMIN}>
      <div className="flex flex-col h-full space-y-4">
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

        <div className="grid gap-4 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Informações Gerais</CardTitle>
              <CardDescription>Detalhes da implantação</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <div className="text-sm font-medium text-muted-foreground">Ambiente</div>
                <Badge className="mt-1" variant={deployment.environment === "PRODUCTION" ? "destructive" : "warning"}>
                  {DEPLOYMENT_ENVIRONMENT_LABELS[deployment.environment] || deployment.environment || "N/A"}
                </Badge>
              </div>

              <div>
                <div className="text-sm font-medium text-muted-foreground">Status</div>
                <Badge className="mt-1">{DEPLOYMENT_STATUS_LABELS[deployment.status] || deployment.status || "N/A"}</Badge>
              </div>

              <div>
                <div className="text-sm font-medium text-muted-foreground">Commit SHA</div>
                <div className="mt-1 font-mono text-sm">{deployment.commitSha}</div>
              </div>

              <div>
                <div className="text-sm font-medium text-muted-foreground">Branch</div>
                <div className="mt-1">{deployment.branch}</div>
              </div>

              {deployment.version && (
                <div>
                  <div className="text-sm font-medium text-muted-foreground">Versão</div>
                  <div className="mt-1">{deployment.version}</div>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Timeline</CardTitle>
              <CardDescription>Histórico da implantação</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {deployment.startedAt && (
                <div>
                  <div className="text-sm font-medium text-muted-foreground">Iniciado em</div>
                  <div className="mt-1">{formatDateTime(deployment.startedAt) || "N/A"}</div>
                </div>
              )}

              {deployment.completedAt && (
                <div>
                  <div className="text-sm font-medium text-muted-foreground">Concluído em</div>
                  <div className="mt-1">{formatDateTime(deployment.completedAt) || "N/A"}</div>
                </div>
              )}

              {deployment.rolledBackAt && (
                <div>
                  <div className="text-sm font-medium text-muted-foreground">Revertido em</div>
                  <div className="mt-1">{formatDateTime(deployment.rolledBackAt) || "N/A"}</div>
                </div>
              )}

              <div>
                <div className="text-sm font-medium text-muted-foreground">Implantado por</div>
                <div className="mt-1">{deployment.user?.name || "Sistema"}</div>
                {deployment.user?.position && (
                  <div className="text-xs text-muted-foreground">{deployment.user.position.name}</div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {deployment.deploymentLog && (
          <Card>
            <CardHeader>
              <CardTitle>Log da Implantação</CardTitle>
              <CardDescription>Saída do processo de implantação</CardDescription>
            </CardHeader>
            <CardContent>
              <pre className="p-4 bg-muted rounded-md overflow-x-auto text-xs font-mono">
                {deployment.deploymentLog}
              </pre>
            </CardContent>
          </Card>
        )}

        {deployment.healthCheckUrl && (
          <Card>
            <CardHeader>
              <CardTitle>Health Check</CardTitle>
              <CardDescription>Verificação de saúde da aplicação</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <div className="text-sm font-medium text-muted-foreground">URL</div>
                <div className="mt-1">{deployment.healthCheckUrl}</div>
              </div>

              {deployment.healthCheckStatus && (
                <div>
                  <div className="text-sm font-medium text-muted-foreground">Status</div>
                  <Badge className="mt-1">{deployment.healthCheckStatus}</Badge>
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </PrivilegeRoute>
  );
};
