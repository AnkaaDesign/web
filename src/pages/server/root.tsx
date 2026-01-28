import { routes } from "../../constants";
import { IconServer, IconSettings, IconUserCog, IconFolders, IconChartLine, IconFileText, IconRefresh, IconActivity, IconDatabaseImport, IconDatabase } from "@tabler/icons-react";
import { useNavigate } from "react-router-dom";
import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { SkeletonCard, LoadingSpinner } from "@/components/ui/loading";
import { usePageTracker } from "@/hooks/use-page-tracker";
import { PageHeader } from "@/components/ui/page-header";
import { useServerMetrics, useServerStatus } from "../../hooks";
import { DETAIL_PAGE_SPACING } from "@/lib/layout-constants";
import { cn } from "@/lib/utils";

export function ServerRootPage() {
  const navigate = useNavigate();
  const [isSpinning, setIsSpinning] = useState(false);

  // Track page access
  usePageTracker({
    title: "Servidor",
    icon: "server",
  });

  // Fetch server data
  const { data: serverMetrics, isLoading: metricsLoading, refetch: refetchMetrics } = useServerMetrics();
  const { data: serverStatus, isLoading: statusLoading, refetch: refetchStatus } = useServerStatus();

  const serverQuickAccess = [
    { title: "Serviços do Sistema", icon: IconSettings, path: routes.server.services, color: "bg-blue-500", description: "Gerenciar serviços do sistema" },
    { title: "Usuários do Sistema", icon: IconUserCog, path: routes.server.users.root, color: "bg-green-600", description: "Gerenciar usuários do sistema" },
    { title: "Pastas Compartilhadas", icon: IconFolders, path: routes.server.sharedFolders, color: "bg-purple-500", description: "Gerenciar pastas compartilhadas" },
    { title: "Sincronização de BD", icon: IconDatabase, path: routes.server.databaseSync, color: "bg-teal-500", description: "Sincronizar banco de dados Produção → Teste" },
    { title: "Métricas do Sistema", icon: IconChartLine, path: routes.server.metrics, color: "bg-orange-500", description: "Visualizar métricas do servidor" },
    { title: "Logs do Sistema", icon: IconFileText, path: routes.server.logs, color: "bg-red-600", description: "Visualizar logs do sistema" },
    { title: "Backup do Sistema", icon: IconDatabaseImport, path: routes.server.backup, color: "bg-cyan-500", description: "Gerenciar backups do sistema" },
  ];

  return (
    <div className="h-full flex flex-col bg-background">
      {/* Fixed Header */}
      <div className="flex-shrink-0 bg-background">
        <div className="px-4">
          <PageHeader
            title="Gerenciamento do Servidor"
            icon={IconServer}
            breadcrumbs={[{ label: "Início", href: routes.home }, { label: "Servidor" }]}
            actions={[
              {
                key: "refresh",
                label: "Atualizar",
                icon: IconRefresh,
                onClick: async () => {
                  setIsSpinning(true);
                  await Promise.all([refetchMetrics(), refetchStatus()]);
                  setTimeout(() => setIsSpinning(false), 500);
                },
                variant: "ghost" as const,
                className: isSpinning ? "animate-spin" : "",
              },
            ]}
          />
        </div>
      </div>

      {/* Scrollable Content */}
      <div className="flex-1 overflow-y-auto">
        <div className="px-4 py-6">
          <div className="space-y-6 pb-6">
          {/* System Status Overview */}
          <Card>
            <CardHeader className="px-8 py-6 pb-4">
              <CardTitle className="text-xl flex items-center gap-3">
                <div className="p-2 bg-green-500/10 text-green-600 dark:text-green-400 rounded-lg">
                  <IconServer className="h-5 w-5" />
                </div>
                Status do Sistema
              </CardTitle>
            </CardHeader>
            <CardContent className="px-8 py-6 pt-2">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                {/* System Health */}
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-medium text-muted-foreground">Status do Sistema</CardTitle>
                  </CardHeader>
                  <CardContent>
                    {statusLoading ? (
                      <div className="animate-pulse space-y-2">
                        <div className="h-8 bg-muted rounded-md w-16"></div>
                        <div className="h-4 bg-muted rounded-md w-20"></div>
                      </div>
                    ) : (
                      <div>
                        <div
                          className={`text-2xl font-semibold ${
                            serverStatus?.data.overall === "healthy"
                              ? "text-green-600 dark:text-green-400"
                              : serverStatus?.data.overall === "warning"
                                ? "text-amber-600 dark:text-amber-400"
                                : "text-red-600 dark:text-red-400"
                          }`}
                        >
                          {serverStatus?.data.overall === "healthy" ? "Saudável" : serverStatus?.data.overall === "warning" ? "Atenção" : "Crítico"}
                        </div>
                        <div className="text-sm text-muted-foreground mt-1">{serverStatus?.data.hostname}</div>
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* CPU Usage */}
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-medium text-muted-foreground">CPU</CardTitle>
                  </CardHeader>
                  <CardContent>
                    {metricsLoading ? (
                      <div className="animate-pulse space-y-2">
                        <div className="h-8 bg-muted rounded-md w-16"></div>
                        <div className="h-4 bg-muted rounded-md w-20"></div>
                      </div>
                    ) : (
                      <div>
                        <div className="text-2xl font-bold text-secondary-foreground">{serverMetrics?.data.cpu.usage.toFixed(1)}%</div>
                        <div className="text-sm text-muted-foreground">{serverMetrics?.data.cpu.cores} núcleos</div>
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* Memory Usage */}
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-medium text-muted-foreground">Memória</CardTitle>
                  </CardHeader>
                  <CardContent>
                    {metricsLoading ? (
                      <div className="animate-pulse space-y-2">
                        <div className="h-8 bg-muted rounded-md w-16"></div>
                        <div className="h-4 bg-muted rounded-md w-20"></div>
                      </div>
                    ) : (
                      <div>
                        <div className="text-2xl font-bold text-secondary-foreground">{serverMetrics?.data.memory.percentage.toFixed(1)}%</div>
                        <div className="text-sm text-muted-foreground">
                          {((serverMetrics?.data.memory?.used ?? 0) / 1024 / 1024 / 1024).toFixed(1)}GB /{" "}
                          {((serverMetrics?.data.memory?.total ?? 0) / 1024 / 1024 / 1024).toFixed(1)}GB
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* Disk Usage */}
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-medium text-muted-foreground">Disco</CardTitle>
                  </CardHeader>
                  <CardContent>
                    {metricsLoading ? (
                      <div className="animate-pulse space-y-2">
                        <div className="h-8 bg-muted rounded-md w-16"></div>
                        <div className="h-4 bg-muted rounded-md w-20"></div>
                      </div>
                    ) : (
                      <div>
                        <div className="text-2xl font-bold text-secondary-foreground">{serverMetrics?.data.disk.percentage.toFixed(1)}%</div>
                        <div className="text-sm text-muted-foreground">
                          {((serverMetrics?.data.disk.used ?? 0) / 1024 / 1024 / 1024).toFixed(1)}GB / {((serverMetrics?.data.disk.total ?? 0) / 1024 / 1024 / 1024).toFixed(1)}GB
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>
            </CardContent>
          </Card>

          {/* Management Tools */}
          <Card>
            <CardHeader className="px-8 py-6 pb-4">
              <CardTitle className="text-xl flex items-center gap-3">
                <div className="p-2 bg-blue-500/10 text-blue-600 dark:text-blue-400 rounded-lg">
                  <IconSettings className="h-5 w-5" />
                </div>
                Ferramentas de Administração
              </CardTitle>
            </CardHeader>
            <CardContent className="px-8 py-6 pt-2">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {serverQuickAccess.map((item) => (
                  <Card key={item.path} className="cursor-pointer hover:shadow-sm transition-all duration-200 hover:scale-[1.02]" onClick={() => navigate(item.path)}>
                    <CardContent className="p-4">
                      <div className={`${item.color} text-white p-3 rounded-lg inline-block mb-3`}>
                        <item.icon className="h-6 w-6" />
                      </div>
                      <h3 className="font-semibold text-base text-foreground mb-2">{item.title}</h3>
                      <p className="text-sm text-muted-foreground">{item.description}</p>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Services Summary */}
          <Card>
            <CardHeader className="px-8 py-6 pb-4">
              <CardTitle className="text-xl flex items-center gap-3">
                <div className="p-2 bg-purple-500/10 text-purple-600 dark:text-purple-400 rounded-lg">
                  <IconActivity className="h-5 w-5" />
                </div>
                Serviços do Sistema
              </CardTitle>
            </CardHeader>
            <CardContent className="px-8 py-6 pt-2">
              {statusLoading ? (
                <div className="animate-pulse space-y-4">
                  {Array.from({ length: 3 }).map((_, i) => (
                    <div key={i} className="flex justify-between items-center">
                      <div className="h-4 bg-gray-200 rounded w-32"></div>
                      <div className="h-6 bg-gray-200 rounded w-16"></div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">Serviços Ativos:</span>
                    <span className="font-semibold text-green-600">{serverStatus?.data.services.healthy}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">Total de Serviços:</span>
                    <span className="font-semibold text-secondary-foreground">{serverStatus?.data.services.total}</span>
                  </div>
                  {serverStatus?.data.services.critical && serverStatus.data.services.critical.length > 0 && (
                    <div className="space-y-2">
                      <span className="text-red-600 font-medium">Serviços com Problemas:</span>
                      <div className="space-y-1">
                        {serverStatus.data.services.critical.map((service, index) => (
                          <div key={index} className="flex justify-between items-center px-3 py-2 bg-destructive/10 border border-destructive/20 rounded-lg">
                            <span className="font-medium text-destructive">{service.displayName}</span>
                            <span className="text-xs px-2 py-1 bg-destructive/20 text-destructive rounded-full">{service.status}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
