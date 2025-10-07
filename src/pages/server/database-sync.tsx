import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import { usePageTracker } from "@/hooks/use-page-tracker";
import { routes } from "../../constants";
import {
  IconDatabase,
  IconRefresh,
  IconClock,
  IconCheck,
  IconX,
  IconLoader,
  IconArrowRight
} from "@tabler/icons-react";
import { useToast } from "@/hooks/use-toast";
import { apiClient as api } from "../../api-client/client-exports";

interface SyncStatus {
  lastSync?: string;
  isRunning: boolean;
  lastSyncSuccess?: boolean;
  nextScheduledSync?: string;
  recentLogs?: string;
}

export function DatabaseSyncPage() {
  const { toast } = useToast();
  const [syncStatus, setSyncStatus] = useState<SyncStatus | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);

  // Track page access
  usePageTracker({
    title: "Sincronização de Banco de Dados",
    icon: "database",
  });

  const fetchSyncStatus = async () => {
    try {
      const response = await api.get("/server/database/sync-status");
      if (response.data.success) {
        setSyncStatus(response.data.data);
      }
    } catch (error: any) {
      console.error("Failed to fetch sync status:", error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchSyncStatus();
    const interval = setInterval(fetchSyncStatus, 10000); // Refresh every 10 seconds
    return () => clearInterval(interval);
  }, []);

  const handleSyncNow = async () => {
    try {
      setIsSyncing(true);
      const response = await api.post("/server/database/sync");

      if (response.data.success) {
        toast({
          title: "Sincronização Iniciada",
          description: "A sincronização do banco de dados foi iniciada com sucesso",
          variant: "default",
        });

        // Refresh status after a short delay
        setTimeout(fetchSyncStatus, 2000);
      } else {
        throw new Error(response.data.message);
      }
    } catch (error: any) {
      toast({
        title: "Erro",
        description: error.response?.data?.message || error.message || "Falha ao iniciar sincronização",
        variant: "destructive",
      });
    } finally {
      setIsSyncing(false);
    }
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return "N/A";
    const date = new Date(dateString);
    return new Intl.DateTimeFormat("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }).format(date);
  };

  return (
    <div className="flex flex-col h-full space-y-4">
      {/* Fixed Header */}
      <div className="flex-shrink-0">
        <PageHeader
          title="Sincronização de Banco de Dados"
          icon={IconDatabase}
          breadcrumbs={[
            { label: "Início", href: routes.home },
            { label: "Servidor", href: routes.server.root },
            { label: "Sincronização de BD" },
          ]}
          actions={[
            {
              key: "refresh",
              label: "Atualizar Status",
              icon: IconRefresh,
              onClick: fetchSyncStatus,
              variant: "ghost" as const,
            },
          ]}
        />
      </div>

      {/* Content Card */}
      <Card className="flex-1 flex flex-col min-h-0" level={1}>
        <CardContent className="flex-1 overflow-auto px-8 py-6 space-y-6">
          {/* Sync Overview */}
          <Card level={2}>
            <CardHeader className="px-8 py-6 pb-4">
              <CardTitle className="text-xl flex items-center gap-3">
                <div className="p-2 bg-blue-500/10 text-blue-600 dark:text-blue-400 rounded-lg">
                  <IconDatabase className="h-5 w-5" />
                </div>
                Visão Geral da Sincronização
              </CardTitle>
            </CardHeader>
            <CardContent className="px-8 py-6 pt-2">
              <div className="prose dark:prose-invert max-w-none mb-6">
                <p className="text-muted-foreground">
                  Esta ferramenta sincroniza o banco de dados de <strong>Produção</strong> para <strong>Teste</strong> de forma unidirecional.
                  Todas as alterações em produção são replicadas para o ambiente de teste, mas nada do teste afeta a produção.
                </p>
              </div>

              <div className="flex items-center gap-4 p-4 bg-blue-500/10 border border-blue-500/20 rounded-lg mb-6">
                <div className="flex-shrink-0">
                  <IconArrowRight className="h-8 w-8 text-blue-600 dark:text-blue-400" />
                </div>
                <div className="flex flex-col">
                  <span className="text-sm font-medium text-blue-600 dark:text-blue-400">Direção da Sincronização</span>
                  <span className="text-lg font-semibold text-foreground">Produção → Teste</span>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Last Sync */}
                <Card level={3}>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                      <IconClock className="h-4 w-4" />
                      Última Sincronização
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {isLoading ? (
                      <div className="animate-pulse space-y-2">
                        <div className="h-8 bg-muted rounded-md w-32"></div>
                        <div className="h-4 bg-muted rounded-md w-20"></div>
                      </div>
                    ) : (
                      <div>
                        <div className="text-lg font-semibold text-foreground">
                          {formatDate(syncStatus?.lastSync)}
                        </div>
                        {syncStatus?.lastSyncSuccess !== undefined && (
                          <div className={`flex items-center gap-2 mt-2 ${syncStatus.lastSyncSuccess ? "text-green-600" : "text-red-600"}`}>
                            {syncStatus.lastSyncSuccess ? (
                              <>
                                <IconCheck className="h-4 w-4" />
                                <span className="text-sm">Sucesso</span>
                              </>
                            ) : (
                              <>
                                <IconX className="h-4 w-4" />
                                <span className="text-sm">Falha</span>
                              </>
                            )}
                          </div>
                        )}
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* Sync Status */}
                <Card level={3}>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                      <IconLoader className="h-4 w-4" />
                      Status Atual
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {isLoading ? (
                      <div className="animate-pulse space-y-2">
                        <div className="h-8 bg-muted rounded-md w-24"></div>
                        <div className="h-4 bg-muted rounded-md w-32"></div>
                      </div>
                    ) : (
                      <div>
                        <div className={`text-lg font-semibold ${syncStatus?.isRunning ? "text-blue-600" : "text-muted-foreground"}`}>
                          {syncStatus?.isRunning ? "Em Execução" : "Inativo"}
                        </div>
                        <div className="text-sm text-muted-foreground mt-2">
                          {syncStatus?.isRunning && <span className="flex items-center gap-2"><IconLoader className="h-4 w-4 animate-spin" />Sincronizando...</span>}
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* Next Scheduled Sync */}
                <Card level={3}>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                      <IconClock className="h-4 w-4" />
                      Próxima Sincronização Agendada
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {isLoading ? (
                      <div className="animate-pulse space-y-2">
                        <div className="h-8 bg-muted rounded-md w-32"></div>
                        <div className="h-4 bg-muted rounded-md w-24"></div>
                      </div>
                    ) : (
                      <div>
                        <div className="text-lg font-semibold text-foreground">
                          {formatDate(syncStatus?.nextScheduledSync)}
                        </div>
                        <div className="text-sm text-muted-foreground mt-2">00:00 e 12:00 diariamente</div>
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* Manual Sync */}
                <Card level={3}>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-medium text-muted-foreground">Sincronização Manual</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <Button
                      onClick={handleSyncNow}
                      disabled={syncStatus?.isRunning || isSyncing}
                      className="w-full"
                      size="lg"
                    >
                      {isSyncing || syncStatus?.isRunning ? (
                        <>
                          <IconLoader className="h-4 w-4 mr-2 animate-spin" />
                          Sincronizando...
                        </>
                      ) : (
                        <>
                          <IconRefresh className="h-4 w-4 mr-2" />
                          Sincronizar Agora
                        </>
                      )}
                    </Button>
                    <p className="text-xs text-muted-foreground mt-2 text-center">
                      Inicia uma sincronização imediata de produção para teste
                    </p>
                  </CardContent>
                </Card>
              </div>
            </CardContent>
          </Card>

          {/* Recent Logs */}
          {syncStatus?.recentLogs && (
            <Card level={2}>
              <CardHeader className="px-8 py-6 pb-4">
                <CardTitle className="text-xl flex items-center gap-3">
                  <div className="p-2 bg-purple-500/10 text-purple-600 dark:text-purple-400 rounded-lg">
                    <IconClock className="h-5 w-5" />
                  </div>
                  Logs Recentes
                </CardTitle>
              </CardHeader>
              <CardContent className="px-8 py-6 pt-2">
                <div className="bg-black/5 dark:bg-white/5 rounded-lg p-4 font-mono text-xs overflow-auto max-h-96">
                  <pre className="whitespace-pre-wrap text-foreground">{syncStatus.recentLogs}</pre>
                </div>
              </CardContent>
            </Card>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
