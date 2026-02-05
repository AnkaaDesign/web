import { useParams, Navigate } from "react-router-dom";
import { IconClock, IconRefresh, IconLoader2, IconCheck, IconX } from "@tabler/icons-react";

import { routes, SECTOR_PRIVILEGES } from "../../../../constants";
import { useSecullumHorarioById } from "../../../../hooks";

import { PrivilegeRoute } from "@/components/navigation/privilege-route";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { usePageTracker } from "@/hooks/use-page-tracker";

function formatTime(time?: string): string {
  if (!time) return "-";
  const parts = time.split(":");
  if (parts.length >= 2) {
    return `${parts[0]}:${parts[1]}`;
  }
  return time;
}

function formatWorkload(workload?: string): string {
  if (!workload) return "-";
  const parts = workload.split(":");
  if (parts.length >= 2) {
    const hours = parseInt(parts[0], 10);
    const minutes = parseInt(parts[1], 10);
    if (minutes === 0) {
      return `${hours}h`;
    }
    return `${hours}h ${minutes}m`;
  }
  return workload;
}

export const ScheduleDetailsPage = () => {
  usePageTracker({ title: "Detalhes do Horário", icon: "clock" });
  const { id } = useParams<{ id: string }>();

  const {
    data: response,
    isLoading,
    error,
    refetch,
  } = useSecullumHorarioById(id || "", {
    enabled: !!id,
  });

  const schedule = response?.data?.data;

  if (!id) {
    return <Navigate to={routes.humanResources.horarios.root} replace />;
  }

  if (error) {
    return (
      <PrivilegeRoute requiredPrivilege={SECTOR_PRIVILEGES.HUMAN_RESOURCES}>
        <div className="flex flex-col items-center justify-center h-full gap-4">
          <IconClock className="h-16 w-16 text-muted-foreground" />
          <p className="text-destructive">Erro ao carregar horário</p>
          <Navigate to={routes.humanResources.horarios.root} replace />
        </div>
      </PrivilegeRoute>
    );
  }

  if (isLoading) {
    return (
      <PrivilegeRoute requiredPrivilege={SECTOR_PRIVILEGES.HUMAN_RESOURCES}>
        <div className="flex items-center justify-center h-full">
          <IconLoader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </PrivilegeRoute>
    );
  }

  if (!schedule) {
    return <Navigate to={routes.humanResources.horarios.root} replace />;
  }

  return (
    <PrivilegeRoute requiredPrivilege={SECTOR_PRIVILEGES.HUMAN_RESOURCES}>
      <div className="h-full flex flex-col gap-4 bg-background px-4 pt-4 overflow-auto">
        <PageHeader
          variant="detail"
          title={schedule.Descricao || schedule.Codigo || "Horário"}
          breadcrumbs={[
            { label: "Início", href: routes.home },
            { label: "Recursos Humanos" },
            { label: "Horários", href: routes.humanResources.horarios.root },
            { label: schedule.Descricao || schedule.Codigo || "Detalhes" },
          ]}
          actions={[
            {
              key: "refresh",
              label: "Atualizar",
              icon: IconRefresh,
              onClick: () => refetch(),
            },
          ]}
        />

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 pb-8">
          {/* Status Card */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <IconClock className="h-5 w-5" />
                Informações Gerais
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                {schedule.Codigo && (
                  <div>
                    <p className="text-sm text-muted-foreground">Código</p>
                    <p className="font-mono font-medium">{schedule.Codigo}</p>
                  </div>
                )}
                <div>
                  <p className="text-sm text-muted-foreground">Descrição</p>
                  <p className="font-medium">{schedule.Descricao || "-"}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Status</p>
                  <Badge variant={schedule.Ativo ? "default" : "secondary"} className={schedule.Ativo ? "bg-green-600" : ""}>
                    {schedule.Ativo ? (
                      <><IconCheck className="h-3 w-3 mr-1" /> Ativo</>
                    ) : (
                      <><IconX className="h-3 w-3 mr-1" /> Inativo</>
                    )}
                  </Badge>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Tipo</p>
                  <Badge variant={schedule.HorarioFlexivel ? "outline" : "secondary"}>
                    {schedule.HorarioFlexivel ? "Flexível" : "Fixo"}
                  </Badge>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Workload Card */}
          <Card>
            <CardHeader>
              <CardTitle>Carga Horária</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">Carga Diária</p>
                  <p className="text-2xl font-bold">{formatWorkload(schedule.CargaHorariaDiaria)}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Carga Semanal</p>
                  <p className="text-2xl font-bold">{formatWorkload(schedule.CargaHorariaSemanal)}</p>
                </div>
              </div>
              {(schedule.ToleranciaEntrada !== undefined || schedule.ToleranciaSaida !== undefined) && (
                <div className="grid grid-cols-2 gap-4 pt-4 border-t">
                  {schedule.ToleranciaEntrada !== undefined && (
                    <div>
                      <p className="text-sm text-muted-foreground">Tolerância Entrada</p>
                      <p className="font-medium">{schedule.ToleranciaEntrada} min</p>
                    </div>
                  )}
                  {schedule.ToleranciaSaida !== undefined && (
                    <div>
                      <p className="text-sm text-muted-foreground">Tolerância Saída</p>
                      <p className="font-medium">{schedule.ToleranciaSaida} min</p>
                    </div>
                  )}
                </div>
              )}
              {schedule.TipoHorarioDescricao && (
                <div className="pt-4 border-t">
                  <p className="text-sm text-muted-foreground">Tipo de Horário</p>
                  <p className="font-medium">{schedule.TipoHorarioDescricao}</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Work Schedule Card - Full Width */}
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle>Horários de Trabalho</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* Period 1 */}
                <div className="p-4 rounded-lg bg-muted/50">
                  <h4 className="font-medium mb-3">1º Período</h4>
                  <div className="flex items-center gap-4">
                    <div className="text-center">
                      <p className="text-xs text-muted-foreground mb-1">Entrada</p>
                      <p className="text-xl font-bold">{formatTime(schedule.Entrada1)}</p>
                    </div>
                    <span className="text-muted-foreground">→</span>
                    <div className="text-center">
                      <p className="text-xs text-muted-foreground mb-1">Saída</p>
                      <p className="text-xl font-bold">{formatTime(schedule.Saida1)}</p>
                    </div>
                  </div>
                </div>

                {/* Period 2 */}
                <div className="p-4 rounded-lg bg-muted/50">
                  <h4 className="font-medium mb-3">2º Período</h4>
                  <div className="flex items-center gap-4">
                    <div className="text-center">
                      <p className="text-xs text-muted-foreground mb-1">Entrada</p>
                      <p className="text-xl font-bold">{formatTime(schedule.Entrada2)}</p>
                    </div>
                    <span className="text-muted-foreground">→</span>
                    <div className="text-center">
                      <p className="text-xs text-muted-foreground mb-1">Saída</p>
                      <p className="text-xl font-bold">{formatTime(schedule.Saida2)}</p>
                    </div>
                  </div>
                </div>

                {/* Period 3 */}
                <div className="p-4 rounded-lg bg-muted/50">
                  <h4 className="font-medium mb-3">3º Período</h4>
                  <div className="flex items-center gap-4">
                    <div className="text-center">
                      <p className="text-xs text-muted-foreground mb-1">Entrada</p>
                      <p className="text-xl font-bold">{formatTime(schedule.Entrada3)}</p>
                    </div>
                    <span className="text-muted-foreground">→</span>
                    <div className="text-center">
                      <p className="text-xs text-muted-foreground mb-1">Saída</p>
                      <p className="text-xl font-bold">{formatTime(schedule.Saida3)}</p>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </PrivilegeRoute>
  );
};

export default ScheduleDetailsPage;
