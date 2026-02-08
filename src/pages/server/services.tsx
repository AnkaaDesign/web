import { useAuth } from "@/contexts/auth-context";
import { SECTOR_PRIVILEGES, routes } from "../../constants";
import { hasPrivilege } from "../../utils";
import { IconSettings, IconPlayerPlay, IconPlayerPause, IconPlayerStop, IconRefresh, IconEye, IconAlertCircle, IconCheck, IconX } from "@tabler/icons-react";
import { useNavigate } from "react-router-dom";
import { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { usePageTracker } from "@/hooks/common/use-page-tracker";
import { PageHeader } from "@/components/ui/page-header";
import { useSystemServices, useStartService, useStopService, useRestartService, useServiceLogs } from "../../hooks";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";

export function ServerServicesPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [selectedService, setSelectedService] = useState<string | null>(null);
  const [isLogsOpen, setIsLogsOpen] = useState(false);

  // Check admin privileges
  const isAdmin = user?.sector?.privileges ? hasPrivilege(user as any, SECTOR_PRIVILEGES.ADMIN) : false;

  // Track page access
  usePageTracker({
    title: "Serviços do Sistema",
    icon: "services",
  });

  // Hooks for service management
  const { data: services, isLoading, refetch } = useSystemServices();
  const { mutate: startService, isPending: startingService } = useStartService();
  const { mutate: stopService, isPending: stoppingService } = useStopService();
  const { mutate: restartService, isPending: restartingService } = useRestartService();
  const { data: logs, refetch: refetchLogs } = useServiceLogs(selectedService || "", undefined, {
    enabled: !!selectedService && isLogsOpen,
  });

  // Redirect if not admin
  useEffect(() => {
    if (!isAdmin) {
      navigate(routes.home);
    }
  }, [isAdmin, navigate]);

  if (!isAdmin) {
    return null;
  }

  // Get all services
  const filteredServices = services?.data || [];

  // Handle service actions
  const handleServiceAction = (action: "start" | "stop" | "restart", serviceName: string) => {
    const actions = {
      start: () =>
        startService(
          { serviceName },
          {
            onSuccess: () => {
              refetch();
            },
          },
        ),
      stop: () =>
        stopService(
          { serviceName },
          {
            onSuccess: () => {
              refetch();
            },
          },
        ),
      restart: () =>
        restartService(
          { serviceName },
          {
            onSuccess: () => {
              refetch();
            },
          },
        ),
    };

    actions[action]();
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "active":
        return <IconCheck className="h-4 w-4 text-green-700 dark:text-green-400" />;
      case "failed":
        return <IconX className="h-4 w-4 text-red-700 dark:text-red-400" />;
      case "inactive":
        return <IconPlayerPause className="h-4 w-4 text-muted-foreground" />;
      default:
        return <IconAlertCircle className="h-4 w-4 text-amber-700 dark:text-amber-400" />;
    }
  };

  const getStatusVariant = (status: string): "success" | "destructive" | "secondary" | "warning" => {
    switch (status) {
      case "active":
        return "success";
      case "failed":
        return "destructive";
      case "inactive":
        return "secondary";
      default:
        return "warning";
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case "active":
        return "Ativo";
      case "failed":
        return "Falhou";
      case "inactive":
        return "Inativo";
      default:
        return "Desconhecido";
    }
  };

  return (
    <div className="h-full flex flex-col px-4 pt-4">
      {/* Fixed Header */}
      <div className="flex-shrink-0">
        <PageHeader
          title="Serviços do Sistema"
          icon={IconSettings}
          breadcrumbs={[{ label: "Início", href: routes.home }, { label: "Servidor", href: routes.server.root }, { label: "Serviços do Sistema" }]}
          actions={[
            {
              key: "refresh",
              label: "Atualizar",
              icon: IconRefresh,
              onClick: () => {
                refetch();
              },
              variant: "outline" as const,
              disabled: isLoading,
            },
          ]}
        />
      </div>

      {/* Content Card */}
      <Card className="flex-1 flex flex-col min-h-0 mt-4">
        <CardContent className="flex-1 overflow-auto space-y-4 pb-6">
          {isLoading ? (
            <div className="space-y-4">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="flex justify-between items-center p-4 border rounded-lg">
                  <div className="space-y-2">
                    <Skeleton className="h-4 w-32" />
                    <Skeleton className="h-3 w-48" />
                  </div>
                  <div className="flex gap-2">
                    <Skeleton className="h-8 w-16" />
                    <Skeleton className="h-8 w-20" />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="space-y-4">
              {filteredServices.map((service) => (
                <div key={service.name} className="border rounded-lg p-4 hover:bg-gray-50 dark:hover:bg-gray-900/50 transition-colors">
                  <div className="flex justify-between items-center">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        {getStatusIcon(service.status)}
                        <h3 className="text-lg font-semibold text-secondary-foreground">{service.displayName}</h3>
                        <Badge variant={getStatusVariant(service.status)}>{getStatusText(service.status)}</Badge>
                        {service.enabled && (
                          <Badge variant="outline" className="text-xs">
                            Habilitado
                          </Badge>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground mb-2">{service.description || `Serviço ${service.name}`}</p>
                      <div className="text-xs text-muted-foreground space-y-1">
                        {service.pid && <div>PID: {service.pid}</div>}
                        {service.memory && <div>Memória: {service.memory}</div>}
                        {service.uptime && <div>Tempo ativo: {service.uptime}</div>}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 ml-4">
                      {/* View Logs */}
                      <Dialog
                        open={isLogsOpen && selectedService === service.name}
                        onOpenChange={(open) => {
                          if (open) {
                            setSelectedService(service.name);
                            setIsLogsOpen(true);
                          } else {
                            setIsLogsOpen(false);
                            setSelectedService(null);
                          }
                        }}
                      >
                        <DialogTrigger asChild>
                          <Button variant="outline" size="sm">
                            <IconEye className="h-4 w-4" />
                          </Button>
                        </DialogTrigger>
                        <DialogContent className="max-w-4xl max-h-[80vh]">
                          <DialogHeader>
                            <DialogTitle>Logs - {service.displayName}</DialogTitle>
                            <DialogDescription>Visualizar logs do serviço {service.name}</DialogDescription>
                          </DialogHeader>
                          <div className="space-y-4">
                            <div className="flex justify-end">
                              <Button variant="outline" size="sm" onClick={() => refetchLogs()}>
                                <IconRefresh className="h-4 w-4 mr-2" />
                                Atualizar Logs
                              </Button>
                            </div>
                            <div className="bg-gray-100 dark:bg-gray-900 p-4 rounded-lg overflow-auto max-h-96">
                              <pre className="text-xs whitespace-pre-wrap">{logs?.data || "Nenhum log disponível"}</pre>
                            </div>
                          </div>
                        </DialogContent>
                      </Dialog>

                      {/* Service Actions */}
                      {service.status === "active" ? (
                        <>
                          <Button variant="outline" size="sm" onClick={() => handleServiceAction("restart", service.name)} disabled={restartingService}>
                            <IconRefresh className="h-4 w-4 mr-1" />
                            Reiniciar
                          </Button>
                          <Button variant="destructive" size="sm" onClick={() => handleServiceAction("stop", service.name)} disabled={stoppingService}>
                            <IconPlayerStop className="h-4 w-4 mr-1" />
                            Parar
                          </Button>
                        </>
                      ) : (
                        <Button variant="default" size="sm" onClick={() => handleServiceAction("start", service.name)} disabled={startingService}>
                          <IconPlayerPlay className="h-4 w-4 mr-1" />
                          Iniciar
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
              {filteredServices.length === 0 && !isLoading && (
                <div className="text-center py-8 text-muted-foreground">Nenhum serviço disponível</div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
