import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { TimeClockEntry } from "@/types/time-clock";
import { formatDate, formatDateTime } from "../../../utils";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { IconClock, IconUser, IconMapPin, IconDeviceMobile } from "@tabler/icons-react";

interface TimeClockEntryDetailModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  entry: TimeClockEntry | null;
}

export function TimeClockEntryDetailModal({ open, onOpenChange, entry }: TimeClockEntryDetailModalProps) {
  if (!entry) return null;

  const getDayTypeLabel = (): string => {
    if (entry.dayOff) return "Folga";
    if (entry.compensated) return "Compensado";
    if (entry.neutral) return "Neutro";
    return "Normal";
  };

  const getDayTypeColor = (): string => {
    if (entry.dayOff) return "destructive";
    if (entry.compensated) return "warning";
    if (entry.neutral) return "secondary";
    return "default";
  };

  const getSourceLabel = (): string => {
    const sourceLabels: Record<string, string> = {
      MANUAL: "Manual",
      SECULLUM: "Secullum",
      DEVICE: "Dispositivo",
      MOBILE: "Mobile",
      WEB: "Web",
    };
    return sourceLabels[entry.source] || entry.source;
  };

  const getSyncStatusLabel = (): string | null => {
    if (!entry.secullumSyncStatus) return null;
    const statusLabels: Record<string, string> = {
      PENDING: "Pendente",
      SYNCED: "Sincronizado",
      ERROR: "Erro",
      CONFLICT: "Conflito",
    };
    return statusLabels[entry.secullumSyncStatus] || entry.secullumSyncStatus;
  };

  const getSyncStatusColor = (): string => {
    if (!entry.secullumSyncStatus) return "default";
    const statusColors: Record<string, string> = {
      PENDING: "warning",
      SYNCED: "success",
      ERROR: "destructive",
      CONFLICT: "destructive",
    };
    return statusColors[entry.secullumSyncStatus] || "default";
  };

  const timeFields = [
    { label: "Entrada 1", value: entry.entry1 },
    { label: "Saída 1", value: entry.exit1 },
    { label: "Entrada 2", value: entry.entry2 },
    { label: "Saída 2", value: entry.exit2 },
    { label: "Entrada 3", value: entry.entry3 },
    { label: "Saída 3", value: entry.exit3 },
    { label: "Entrada 4", value: entry.entry4 },
    { label: "Saída 4", value: entry.exit4 },
    { label: "Entrada 5", value: entry.entry5 },
    { label: "Saída 5", value: entry.exit5 },
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[85vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>Detalhes do Registro de Ponto</DialogTitle>
        </DialogHeader>

        <Tabs defaultValue="details" className="flex-1 overflow-hidden">
          <TabsList>
            <TabsTrigger value="details">Detalhes</TabsTrigger>
          </TabsList>

          <TabsContent value="details" className="mt-4 space-y-4 overflow-y-auto max-h-[calc(85vh-8rem)]">
            {/* Basic Information */}
            <Card>
              <CardContent className="pt-6">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <p className="text-sm text-muted-foreground">Data</p>
                    <p className="font-medium">{formatDate(entry.date)}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-sm text-muted-foreground">Funcionário</p>
                    <div className="flex items-center gap-2">
                      <IconUser className="h-4 w-4 text-muted-foreground" />
                      <p className="font-medium">{entry.user?.name || "—"}</p>
                    </div>
                  </div>
                  <div className="space-y-1">
                    <p className="text-sm text-muted-foreground">Tipo do Dia</p>
                    <Badge variant={getDayTypeColor() as any}>{getDayTypeLabel()}</Badge>
                  </div>
                  <div className="space-y-1">
                    <p className="text-sm text-muted-foreground">Origem</p>
                    <div className="flex items-center gap-2">
                      <IconDeviceMobile className="h-4 w-4 text-muted-foreground" />
                      <p className="font-medium">{getSourceLabel()}</p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Time Records */}
            <Card>
              <CardContent className="pt-6">
                <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                  <IconClock className="h-5 w-5" />
                  Horários Registrados
                </h3>
                <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                  {timeFields.map((field) => (
                    <div key={field.label} className="space-y-1">
                      <p className="text-sm text-muted-foreground">{field.label}</p>
                      <p className="font-medium text-lg">{field.value || "—"}</p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Work Hours Summary */}
            {(entry.workedHours || entry.extraHours || entry.missingHours) && (
              <Card>
                <CardContent className="pt-6">
                  <h3 className="text-lg font-semibold mb-4">Resumo de Horas</h3>
                  <div className="grid grid-cols-3 gap-4">
                    <div className="space-y-1">
                      <p className="text-sm text-muted-foreground">Horas Trabalhadas</p>
                      <p className="font-medium text-lg">{entry.workedHours || "00:00"}</p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-sm text-muted-foreground">Horas Extras</p>
                      <p className="font-medium text-lg">{entry.extraHours || "00:00"}</p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-sm text-muted-foreground">Horas Falta</p>
                      <p className="font-medium text-lg">{entry.missingHours || "00:00"}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Additional Flags */}
            <Card>
              <CardContent className="pt-6">
                <h3 className="text-lg font-semibold mb-4">Configurações Especiais</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Almoço Livre</span>
                    <Badge variant={entry.freeLunch ? "default" : "outline"}>{entry.freeLunch ? "Sim" : "Não"}</Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Tem Foto</span>
                    <Badge variant={entry.hasPhoto ? "default" : "outline"}>{entry.hasPhoto ? "Sim" : "Não"}</Badge>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Location Information */}
            {(entry.latitude || entry.longitude || entry.address) && (
              <Card>
                <CardContent className="pt-6">
                  <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                    <IconMapPin className="h-5 w-5" />
                    Localização
                  </h3>
                  <div className="space-y-2">
                    {entry.address && (
                      <div>
                        <p className="text-sm text-muted-foreground">Endereço</p>
                        <p className="font-medium">{entry.address}</p>
                      </div>
                    )}
                    {entry.latitude && entry.longitude && (
                      <div>
                        <p className="text-sm text-muted-foreground">Coordenadas</p>
                        <p className="font-medium">
                          {entry.latitude}, {entry.longitude}
                          {entry.accuracy && ` (±${entry.accuracy}m)`}
                        </p>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Observations and Justifications */}
            {(entry.observations || entry.justification) && (
              <Card>
                <CardContent className="pt-6">
                  <h3 className="text-lg font-semibold mb-4">Observações</h3>
                  <div className="space-y-4">
                    {entry.observations && (
                      <div>
                        <p className="text-sm text-muted-foreground">Observação</p>
                        <p className="text-sm">{entry.observations}</p>
                      </div>
                    )}
                    {entry.justification && (
                      <div>
                        <p className="text-sm text-muted-foreground">Justificativa</p>
                        <p className="text-sm">{entry.justification}</p>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Sync Status */}
            {entry.secullumSyncStatus && (
              <Card>
                <CardContent className="pt-6">
                  <h3 className="text-lg font-semibold mb-4">Status de Sincronização</h3>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-sm">Status</span>
                      <Badge variant={getSyncStatusColor() as any}>{getSyncStatusLabel()}</Badge>
                    </div>
                    {entry.syncAttempts && entry.syncAttempts > 0 && (
                      <div className="flex items-center justify-between">
                        <span className="text-sm">Tentativas de Sincronização</span>
                        <span className="font-medium">{entry.syncAttempts}</span>
                      </div>
                    )}
                    {entry.lastSyncError && (
                      <div>
                        <p className="text-sm text-muted-foreground">Último Erro</p>
                        <p className="text-sm text-destructive">{entry.lastSyncError}</p>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Metadata */}
            <Card>
              <CardContent className="pt-6">
                <h3 className="text-lg font-semibold mb-4">Informações do Sistema</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <p className="text-sm text-muted-foreground">Criado em</p>
                    <p className="font-medium">{formatDateTime(entry.createdAt)}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-sm text-muted-foreground">Atualizado em</p>
                    <p className="font-medium">{formatDateTime(entry.updatedAt)}</p>
                  </div>
                  {entry.deviceId && (
                    <div className="space-y-1">
                      <p className="text-sm text-muted-foreground">ID do Dispositivo</p>
                      <p className="font-medium font-mono text-xs">{entry.deviceId}</p>
                    </div>
                  )}
                  {entry.secullumRecordId && (
                    <div className="space-y-1">
                      <p className="text-sm text-muted-foreground">ID Secullum</p>
                      <p className="font-medium">{entry.secullumRecordId}</p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
