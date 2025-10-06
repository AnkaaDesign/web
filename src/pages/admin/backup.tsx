import React, { useState, useCallback, useMemo, useEffect } from "react";
import { PageHeaderWithFavorite } from "@/components/ui/page-header-with-favorite";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { DateTimeInput } from "@/components/ui/date-time-input";
import { Combobox } from "@/components/ui/combobox";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
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
import { PrivilegeRoute } from "@/components/navigation/privilege-route";
import { FAVORITE_PAGES, SECTOR_PRIVILEGES } from "../../constants";
import {
  IconDatabase,
  IconPlus,
  IconDownload,
  IconClock,
  IconSettings,
  IconRefresh,
  IconTrash,
  IconAlertTriangle,
  IconCheck,
  IconX,
  IconServer,
  IconFolder,
  IconCalendar,
  IconShieldCheck,
  IconActivity,
  IconHeart,
  IconEye,
} from "@tabler/icons-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import type { BackupMetadata, ScheduledBackupJob } from "../../api-client/backup";

// Enhanced form interfaces
interface NewBackupForm {
  name: string;
  type: "database" | "files" | "full";
  description: string;
  priority: "low" | "medium" | "high" | "critical";
  compressionLevel: number;
  encrypted: boolean;
  customPaths: string[];
  usePresetPaths: boolean;
  presetPathType: "critical" | "high" | "medium" | "low";
}

interface NewScheduleForm {
  name: string;
  type: "database" | "files" | "full";
  frequency: "daily" | "weekly" | "monthly";
  time: string;
  enabled: boolean;
  priority: "low" | "medium" | "high" | "critical";
  compressionLevel: number;
  encrypted: boolean;
  usePresetPaths: boolean;
  presetPathType: "critical" | "high" | "medium" | "low";
}

// Priority options for backups
const PRIORITY_OPTIONS = [
  { value: "low", label: "Baixa" },
  { value: "medium", label: "Média" },
  { value: "high", label: "Alta" },
  { value: "critical", label: "Crítica" },
];

// Compression level options
const COMPRESSION_OPTIONS = [
  { value: 1, label: "1 - Mais rápido" },
  { value: 3, label: "3 - Rápido" },
  { value: 6, label: "6 - Padrão" },
  { value: 9, label: "9 - Melhor compressão" },
];

// Preset path options for important folders
const PRESET_PATH_OPTIONS = [
  { value: "critical", label: "Críticos (Apps principais, configs)", paths: ["/home/kennedy/ankaa", "/home/kennedy/ankaa/.env", "/home/kennedy/ankaa/apps/api/.env"] },
  { value: "high", label: "Alta prioridade (Apps, nginx, ssl)", paths: ["/home/kennedy/ankaa/apps", "/home/kennedy/ankaa/packages", "/etc/nginx", "/etc/samba", "/etc/ssl"] },
  { value: "medium", label: "Média prioridade (Docs, logs)", paths: ["/home/kennedy/ankaa/docs", "/var/log/nginx", "/var/www"] },
  { value: "low", label: "Baixa prioridade (Cache, temporários)", paths: ["/home/kennedy/ankaa/node_modules", "/tmp"] },
];

const BackupManagementPage = () => {
  // Mock data for backup management
  const backups: BackupMetadata[] = [];
  const scheduledBackups: ScheduledBackupJob[] = [];
  const systemHealth = null;
  const isLoading = false;
  const isCreating = false;
  const isDeleting = false;
  const isRestoring = false;
  const isVerifying = false;
  const createBackup = async () => null;
  const scheduleBackup = async () => false;
  const deleteBackup = async () => false;
  const restoreBackup = async () => false;
  const removeScheduledBackup = async () => false;
  const verifyBackup = async () => null;
  const refreshAll = () => {};
  const formatBytes = (bytes: number) => `${bytes} bytes`;
  const getStatusBadgeVariant = () => "default" as const;
  const getBackupTypeIcon = () => "IconDatabase";
  const getBackupTypeLabel = () => "Database";
  const getStatusLabel = () => "Unknown";
  const getFrequencyLabel = () => "Unknown";
  const generateCronExpression = () => "0 0 * * *";
  const parseCronToHuman = () => "Daily";

  // Dialog states
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [restoreDialogOpen, setRestoreDialogOpen] = useState(false);
  const [scheduleDialogOpen, setScheduleDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [verifyDialogOpen, setVerifyDialogOpen] = useState(false);

  // Selected items
  const [selectedBackup, setSelectedBackup] = useState<BackupMetadata | null>(null);
  const [backupToDelete, setBackupToDelete] = useState<BackupMetadata | null>(null);

  // Enhanced form states
  const [newBackup, setNewBackup] = useState<NewBackupForm>({
    name: "",
    type: "database",
    description: "",
    priority: "medium",
    compressionLevel: 6,
    encrypted: false,
    customPaths: [],
    usePresetPaths: true,
    presetPathType: "high",
  });

  // Custom path input state
  const [customPathInput, setCustomPathInput] = useState("");

  const [newSchedule, setNewSchedule] = useState<NewScheduleForm>({
    name: "",
    type: "database",
    frequency: "daily",
    time: "23:00",
    enabled: true,
    priority: "medium",
    compressionLevel: 6,
    encrypted: false,
    usePresetPaths: true,
    presetPathType: "high",
  });

  // Utility functions
  const formatDate = (dateString: string) => {
    if (!dateString || dateString === "Invalid Date" || dateString === "") {
      return "Data inválida";
    }

    const date = new Date(dateString);
    if (isNaN(date.getTime())) {
      return "Data inválida";
    }

    return date.toLocaleString("pt-BR", {
      timeZone: "America/Sao_Paulo",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
  };

  // Format next execution timestamp for scheduled backups
  const formatNextExecution = (timestamp: number) => {
    if (!timestamp || timestamp <= 0) {
      return "Não definido";
    }

    const date = new Date(timestamp);
    if (isNaN(date.getTime())) {
      return "Data inválida";
    }

    return date.toLocaleString("pt-BR", {
      timeZone: "America/Sao_Paulo",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      weekday: "short",
    });
  };

  const getPriorityBadgeVariant = (priority?: string) => {
    switch (priority) {
      case "critical":
        return "error";
      case "high":
        return "warning";
      case "medium":
        return "default";
      case "low":
        return "inactive";
      default:
        return "default";
    }
  };

  const getPriorityLabel = (priority?: string) => {
    switch (priority) {
      case "critical":
        return "Crítica";
      case "high":
        return "Alta";
      case "medium":
        return "Média";
      case "low":
        return "Baixa";
      default:
        return "Não definida";
    }
  };

  // Custom hook for simulated progress when backend doesn't provide real progress
  const useSimulatedProgress = (backupId: string, isInProgress: boolean) => {
    const [simulatedProgress, setSimulatedProgress] = useState(15);

    useEffect(() => {
      if (!isInProgress) {
        setSimulatedProgress(15);
        return;
      }

      const startTime = Date.now();
      const interval = setInterval(() => {
        const elapsed = Date.now() - startTime;

        // Simulate realistic progress curve
        let progress = 15;
        if (elapsed < 10000) {
          // First 10 seconds: 15-30%
          progress = 15 + (elapsed / 10000) * 15;
        } else if (elapsed < 30000) {
          // Next 20 seconds: 30-60%
          progress = 30 + ((elapsed - 10000) / 20000) * 30;
        } else if (elapsed < 60000) {
          // Next 30 seconds: 60-85%
          progress = 60 + ((elapsed - 30000) / 30000) * 25;
        } else {
          // After 1 minute: slowly approach 95%
          progress = 85 + ((elapsed - 60000) / 30000) * 10;
          progress = Math.min(progress, 95); // Don't go above 95%
        }

        setSimulatedProgress(Math.round(progress));
      }, 2000); // Update every 2 seconds

      return () => clearInterval(interval);
    }, [isInProgress, backupId]);

    return simulatedProgress;
  };

  // Action handlers
  const handleCreateBackup = useCallback(async () => {
    if (!newBackup.name.trim()) {
      toast.error("Nome do backup é obrigatório");
      return;
    }

    // Determine paths to use
    let pathsToBackup: string[] | undefined;

    if (newBackup.type === "files" || newBackup.type === "full") {
      if (newBackup.usePresetPaths) {
        // Get preset paths from the API client
        const presetPaths = PRESET_PATH_OPTIONS.find((opt) => opt.value === newBackup.presetPathType)?.paths || [];
        pathsToBackup = presetPaths;
      } else if (newBackup.customPaths.length > 0) {
        pathsToBackup = newBackup.customPaths;
      }
    }

    const backupId = await createBackup({
      name: newBackup.name,
      type: newBackup.type,
      description: newBackup.description,
      priority: newBackup.priority,
      compressionLevel: newBackup.compressionLevel,
      encrypted: newBackup.encrypted,
      paths: pathsToBackup,
    });

    if (backupId) {
      setCreateDialogOpen(false);
      setNewBackup({
        name: "",
        type: "database",
        description: "",
        priority: "medium",
        compressionLevel: 6,
        encrypted: false,
        customPaths: [],
        usePresetPaths: true,
        presetPathType: "high",
      });
      setCustomPathInput("");
    }
  }, [newBackup, createBackup]);

  const handleRestoreBackup = useCallback(async () => {
    if (!selectedBackup) return;

    const success = await restoreBackup(selectedBackup.id);
    if (success) {
      setRestoreDialogOpen(false);
      setSelectedBackup(null);
    }
  }, [selectedBackup, restoreBackup]);

  const handleDeleteBackup = useCallback((backup: BackupMetadata) => {
    if (backup.status === "in_progress") {
      toast.error("Não é possível deletar um backup em progresso");
      return;
    }

    setBackupToDelete(backup);
    setDeleteDialogOpen(true);
  }, []);

  const confirmDeleteBackup = useCallback(async () => {
    if (!backupToDelete) return;

    const success = await deleteBackup(backupToDelete.id);
    if (success) {
      setDeleteDialogOpen(false);
      setBackupToDelete(null);
    }
  }, [backupToDelete, deleteBackup]);

  const handleCreateSchedule = useCallback(async () => {
    if (!newSchedule.name.trim()) {
      toast.error("Nome do agendamento é obrigatório");
      return;
    }

    // Determine paths to use for scheduled backup
    let pathsToBackup: string[] | undefined;

    if (newSchedule.type === "files" || newSchedule.type === "full") {
      if (newSchedule.usePresetPaths) {
        // Get preset paths
        const presetPaths = PRESET_PATH_OPTIONS.find((opt) => opt.value === newSchedule.presetPathType)?.paths || [];
        pathsToBackup = presetPaths;
      }
    }

    const success = await scheduleBackup({
      name: newSchedule.name,
      type: newSchedule.type,
      description: `Backup agendado ${getFrequencyLabel(newSchedule.frequency).toLowerCase()} às ${newSchedule.time}`,
      priority: newSchedule.priority,
      compressionLevel: newSchedule.compressionLevel,
      encrypted: newSchedule.encrypted,
      enabled: newSchedule.enabled,
      cron: generateCronExpression(newSchedule.frequency, newSchedule.time),
      paths: pathsToBackup,
    });

    if (success) {
      setScheduleDialogOpen(false);
      setNewSchedule({
        name: "",
        type: "database",
        frequency: "daily",
        time: "23:00",
        enabled: true,
        priority: "medium",
        compressionLevel: 6,
        encrypted: false,
        usePresetPaths: true,
        presetPathType: "high",
      });
    }
  }, [newSchedule, scheduleBackup, getFrequencyLabel, generateCronExpression]);

  const handleDeleteSchedule = useCallback(
    async (schedule: ScheduledBackupJob) => {
      const confirmed = window.confirm(`Tem certeza que deseja deletar o agendamento "${schedule.name}"?`);

      if (!confirmed) return;

      // Use the most reliable identifier: key > id > jobName
      const identifier = schedule.key || schedule.id || schedule.jobName;

      if (!identifier) {
        toast.error("Não foi possível identificar o agendamento para exclusão");
        return;
      }

      const success = await removeScheduledBackup(identifier);
      if (success) {
        // Refresh scheduled backups list is handled by the hook
      }
    },
    [removeScheduledBackup],
  );

  const handleVerifyBackup = useCallback(
    async (backup: BackupMetadata) => {
      setSelectedBackup(backup);
      const verification = await verifyBackup(backup.id);
      if (verification) {
        // Results are shown in toast by the hook
      }
    },
    [verifyBackup],
  );

  // BackupTableRow component to use the progress hook
  const BackupTableRow = ({ backup }: { backup: BackupMetadata }) => {
    const simulatedProgress = useSimulatedProgress(backup.id, backup.status === "in_progress");
    const actualProgress = backup.progress || simulatedProgress;

    const TypeIcon = getBackupTypeIcon(backup.type) === "IconDatabase" ? IconDatabase : getBackupTypeIcon(backup.type) === "IconFolder" ? IconFolder : IconServer;

    return (
      <TableRow key={backup.id}>
        <TableCell>
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <div className="font-medium">{backup.name}</div>
              {backup.encrypted && (
                <Badge variant="secondary" className="text-xs">
                  <IconShieldCheck className="h-3 w-3 mr-1" />
                  Criptografado
                </Badge>
              )}
              {backup.priority && (
                <Badge variant={getPriorityBadgeVariant(backup.priority)} className="text-xs">
                  {getPriorityLabel(backup.priority)}
                </Badge>
              )}
            </div>
            <div className="text-sm text-muted-foreground space-y-1">
              {backup.description && <div>{backup.description}</div>}
              {backup.paths && backup.paths.length > 0 && (
                <div className="flex items-center gap-1">
                  <IconFolder className="h-3 w-3" />
                  <span>{backup.paths.length === 1 ? backup.paths[0] : `${backup.paths.length} pastas incluídas`}</span>
                </div>
              )}
            </div>
          </div>
        </TableCell>
        <TableCell>
          <div className="flex items-center gap-2">
            <TypeIcon className="h-4 w-4 text-muted-foreground" />
            {getBackupTypeLabel(backup.type)}
          </div>
        </TableCell>
        <TableCell>{formatBytes(backup.size)}</TableCell>
        <TableCell>{formatDate(backup.createdAt)}</TableCell>
        <TableCell>
          <div className="space-y-2">
            <Badge variant={getStatusBadgeVariant(backup.status)}>{getStatusLabel(backup.status)}</Badge>
            {backup.status === "in_progress" && (
              <div className="space-y-1">
                <Progress value={actualProgress} className="h-2" />
                <div className="text-xs text-muted-foreground">{backup.progress ? `${Math.round(backup.progress)}% concluído` : `${actualProgress}% concluído (simulado)`}</div>
              </div>
            )}
          </div>
        </TableCell>
        <TableCell className="text-right">
          <div className="flex justify-end gap-2">
            {backup.status === "completed" && (
              <>
                <Button size="sm" variant="outline" onClick={() => handleVerifyBackup(backup)} disabled={isVerifying}>
                  <IconEye className="h-4 w-4" />
                  Verificar
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    setSelectedBackup(backup);
                    setRestoreDialogOpen(true);
                  }}
                  disabled={isRestoring}
                >
                  <IconDownload className="h-4 w-4" />
                  Restaurar
                </Button>
              </>
            )}
            <Button size="sm" variant="destructive" onClick={() => handleDeleteBackup(backup)} disabled={backup.status === "in_progress" || isDeleting}>
              <IconTrash className="h-4 w-4" />
              Deletar
            </Button>
          </div>
        </TableCell>
      </TableRow>
    );
  };

  // Page header actions
  const actions = [
    {
      key: "create",
      label: "Novo Backup",
      icon: IconPlus,
      onClick: () => setCreateDialogOpen(true),
      variant: "default" as const,
    },
    {
      key: "schedule",
      label: "Agendar Backup",
      icon: IconClock,
      onClick: () => setScheduleDialogOpen(true),
      variant: "outline" as const,
    },
    {
      key: "refresh",
      label: "Atualizar",
      icon: IconRefresh,
      onClick: refreshAll,
      variant: "ghost" as const,
    },
  ];

  return (
    <PrivilegeRoute requiredPrivilege={SECTOR_PRIVILEGES.ADMIN}>
      <div className="flex flex-col h-full space-y-6">
        {/* Page Header */}
        <div className="flex-shrink-0">
          <PageHeaderWithFavorite
            title="Gerenciamento de Backups"
            icon={IconDatabase}
            favoritePage={FAVORITE_PAGES.ADMINISTRACAO_COLABORADORES_LISTAR} // Reusing existing favorite
            breadcrumbs={[{ label: "Início", href: "/" }, { label: "Administração", href: "/administracao" }, { label: "Backups" }]}
            actions={actions}
          />
        </div>

        <div className="flex-1 min-h-0 space-y-6">
          {/* Summary Statistics */}
          {systemHealth && (
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center space-x-2">
                    <IconDatabase className="h-4 w-4 text-blue-500" />
                    <div className="text-2xl font-bold">{systemHealth.totalBackups}</div>
                  </div>
                  <p className="text-xs text-muted-foreground">Total de Backups</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center space-x-2">
                    <IconCheck className="h-4 w-4 text-green-500" />
                    <div className="text-2xl font-bold">{systemHealth.completedBackups}</div>
                  </div>
                  <p className="text-xs text-muted-foreground">Concluídos</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center space-x-2">
                    <IconClock className="h-4 w-4 text-orange-500" />
                    <div className="text-2xl font-bold">{scheduledBackups.length}</div>
                  </div>
                  <p className="text-xs text-muted-foreground">Agendados</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center space-x-2">
                    <IconServer className="h-4 w-4 text-purple-500" />
                    <div className="text-2xl font-bold">{systemHealth.totalSize}</div>
                  </div>
                  <p className="text-xs text-muted-foreground">Tamanho Total</p>
                </CardContent>
              </Card>
            </div>
          )}

          {/* Backup List */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <IconDatabase className="h-5 w-5" />
                Backups Existentes
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nome</TableHead>
                      <TableHead>Tipo</TableHead>
                      <TableHead>Tamanho</TableHead>
                      <TableHead>Data de Criação</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {backups.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                          Nenhum backup encontrado
                        </TableCell>
                      </TableRow>
                    ) : (
                      backups.map((backup) => <BackupTableRow key={backup.id} backup={backup} />)
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>

          {/* Scheduled Backups */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <IconClock className="h-5 w-5" />
                Backups Agendados
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nome</TableHead>
                      <TableHead>Tipo</TableHead>
                      <TableHead>Frequência</TableHead>
                      <TableHead>Horário</TableHead>
                      <TableHead>Próxima Execução</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {scheduledBackups.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                          Nenhum backup agendado
                        </TableCell>
                      </TableRow>
                    ) : (
                      scheduledBackups.map((schedule) => {
                        const TypeIcon = IconDatabase; // Simplified for now
                        return (
                          <TableRow key={schedule.id}>
                            <TableCell className="font-medium">{schedule.name}</TableCell>
                            <TableCell>
                              <div className="flex items-center gap-2">
                                <TypeIcon className="h-4 w-4 text-muted-foreground" />
                                Database
                              </div>
                            </TableCell>
                            <TableCell>{parseCronToHuman(schedule.cron)}</TableCell>
                            <TableCell>{schedule.cron}</TableCell>
                            <TableCell>{formatNextExecution(schedule.next)}</TableCell>
                            <TableCell>
                              <Badge variant="success">Ativo</Badge>
                            </TableCell>
                            <TableCell className="text-right">
                              <div className="flex justify-end gap-2">
                                <Button size="sm" variant="destructive" onClick={() => handleDeleteSchedule(schedule)}>
                                  <IconTrash className="h-4 w-4" />
                                  Deletar
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        );
                      })
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Create Backup Dialog */}
        <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
          <DialogContent className="sm:max-w-[500px]">
            <DialogHeader>
              <DialogTitle>Criar Novo Backup</DialogTitle>
              <DialogDescription>Crie um backup do sistema especificando o tipo e configurações desejadas.</DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="backup-name">Nome do Backup</Label>
                <Input id="backup-name" value={newBackup.name} onChange={(value) => setNewBackup({ ...newBackup, name: value as string })} placeholder="Ex: backup_sistema_2024-09-12" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="backup-type">Tipo de Backup</Label>
                <Combobox
                  value={newBackup.type}
                  onValueChange={(value) => setNewBackup({ ...newBackup, type: value as BackupMetadata["type"] })}
                  options={[
                    { label: "Banco de Dados", value: "database" },
                    { label: "Arquivos", value: "files" },
                    { label: "Backup Completo", value: "full" },
                  ]}
                  searchable={false}
                  clearable={false}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="backup-description">Descrição (Opcional)</Label>
                <Input
                  id="backup-description"
                  value={newBackup.description}
                  onChange={(value) => setNewBackup({ ...newBackup, description: value as string })}
                  placeholder="Descrição do backup..."
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="backup-priority">Prioridade</Label>
                  <Combobox
                    value={newBackup.priority}
                    onValueChange={(value) => setNewBackup({ ...newBackup, priority: (value as NewBackupForm["priority"]) || "medium" })}
                    options={PRIORITY_OPTIONS}
                    placeholder="Selecione a prioridade"
                    searchable={false}
                    clearable={false}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="backup-compression">Compressão</Label>
                  <Combobox
                    value={newBackup.compressionLevel.toString()}
                    onValueChange={(value) => setNewBackup({ ...newBackup, compressionLevel: parseInt(value || "6") })}
                    options={COMPRESSION_OPTIONS.map((opt) => ({
                      value: opt.value.toString(),
                      label: opt.label,
                    }))}
                    placeholder="Selecione o nível"
                    searchable={false}
                    clearable={false}
                  />
                </div>
              </div>
              {/* Folder Selection Section */}
              {(newBackup.type === "files" || newBackup.type === "full") && (
                <div className="space-y-4 border-t pt-4">
                  <div className="flex items-center space-x-2">
                    <Checkbox id="use-preset-paths" checked={newBackup.usePresetPaths} onCheckedChange={(checked) => setNewBackup({ ...newBackup, usePresetPaths: !!checked })} />
                    <Label htmlFor="use-preset-paths" className="text-sm font-normal">
                      Usar pastas predefinidas por prioridade
                    </Label>
                  </div>

                  {newBackup.usePresetPaths && (
                    <div className="space-y-2">
                      <Label htmlFor="preset-path-type">Prioridade das Pastas</Label>
                      <Combobox
                        value={newBackup.presetPathType}
                        onValueChange={(value) => setNewBackup({ ...newBackup, presetPathType: (value as "critical" | "high" | "medium" | "low") || "high" })}
                        options={PRESET_PATH_OPTIONS.map((opt) => ({
                          value: opt.value,
                          label: opt.label,
                        }))}
                        placeholder="Selecione a prioridade"
                        searchable={false}
                        clearable={false}
                      />
                      <div className="text-xs text-muted-foreground">
                        <strong>Pastas incluídas:</strong>
                        <ul className="mt-1 list-disc list-inside space-y-0.5">
                          {PRESET_PATH_OPTIONS.find((opt) => opt.value === newBackup.presetPathType)
                            ?.paths.slice(0, 3)
                            .map((path, idx) => (
                              <li key={idx}>{path}</li>
                            ))}
                          {PRESET_PATH_OPTIONS.find((opt) => opt.value === newBackup.presetPathType)?.paths.length > 3 && (
                            <li>... e mais {PRESET_PATH_OPTIONS.find((opt) => opt.value === newBackup.presetPathType)?.paths.length - 3} pastas</li>
                          )}
                        </ul>
                      </div>
                    </div>
                  )}

                  {!newBackup.usePresetPaths && (
                    <div className="space-y-3">
                      <Label>Pastas Personalizadas</Label>
                      <div className="flex gap-2">
                        <Input value={customPathInput} onChange={(value) => setCustomPathInput(value as string)} placeholder="/caminho/para/pasta" />
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            if (customPathInput.trim() && !newBackup.customPaths.includes(customPathInput.trim())) {
                              setNewBackup({
                                ...newBackup,
                                customPaths: [...newBackup.customPaths, customPathInput.trim()],
                              });
                              setCustomPathInput("");
                            }
                          }}
                        >
                          <IconPlus className="h-4 w-4" />
                          Adicionar
                        </Button>
                      </div>

                      {newBackup.customPaths.length > 0 && (
                        <div className="space-y-2">
                          <div className="text-sm font-medium">Pastas selecionadas:</div>
                          <div className="space-y-1">
                            {newBackup.customPaths.map((path, idx) => (
                              <div key={idx} className="flex items-center justify-between text-sm bg-muted/50 px-2 py-1 rounded">
                                <span>{path}</span>
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => {
                                    setNewBackup({
                                      ...newBackup,
                                      customPaths: newBackup.customPaths.filter((_, i) => i !== idx),
                                    });
                                  }}
                                >
                                  <IconX className="h-3 w-3" />
                                </Button>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              <div className="flex items-center space-x-2">
                <Switch id="backup-encrypted" checked={newBackup.encrypted} onCheckedChange={(checked) => setNewBackup({ ...newBackup, encrypted: checked })} />
                <Label htmlFor="backup-encrypted" className="text-sm font-normal">
                  Criptografar backup (requer senha GPG configurada)
                </Label>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setCreateDialogOpen(false)}>
                Cancelar
              </Button>
              <Button onClick={handleCreateBackup} disabled={isCreating}>
                {isCreating ? "Criando..." : "Criar Backup"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Restore Backup Dialog */}
        <Dialog open={restoreDialogOpen} onOpenChange={setRestoreDialogOpen}>
          <DialogContent className="sm:max-w-[500px]">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <IconAlertTriangle className="h-5 w-5 text-amber-500" />
                Restaurar Backup
              </DialogTitle>
              <DialogDescription>
                Esta ação irá restaurar o sistema usando o backup selecionado.
                <strong className="text-foreground"> Esta operação não pode ser desfeita.</strong>
              </DialogDescription>
            </DialogHeader>
            {selectedBackup && (
              <div className="py-4 space-y-3">
                <div className="p-4 border rounded-lg bg-muted/50">
                  <div className="space-y-2">
                    <div>
                      <span className="font-medium">Backup:</span> {selectedBackup.name}
                    </div>
                    <div>
                      <span className="font-medium">Tipo:</span> {getBackupTypeLabel(selectedBackup.type)}
                    </div>
                    <div>
                      <span className="font-medium">Tamanho:</span> {selectedBackup.size}
                    </div>
                    <div>
                      <span className="font-medium">Criado em:</span> {formatDate(selectedBackup.createdAt)}
                    </div>
                  </div>
                </div>
                <div className="p-4 border border-amber-200 rounded-lg bg-amber-50 dark:bg-amber-950/20">
                  <div className="flex gap-2">
                    <IconAlertTriangle className="h-4 w-4 text-amber-600 flex-shrink-0 mt-0.5" />
                    <div className="text-sm text-amber-800 dark:text-amber-200">
                      <strong>Atenção:</strong> A restauração irá substituir os dados atuais do sistema. Certifique-se de que este é o backup correto antes de continuar.
                    </div>
                  </div>
                </div>
              </div>
            )}
            <DialogFooter>
              <Button variant="outline" onClick={() => setRestoreDialogOpen(false)}>
                Cancelar
              </Button>
              <Button variant="destructive" onClick={handleRestoreBackup} disabled={isRestoring}>
                {isRestoring ? "Restaurando..." : "Confirmar Restauração"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Schedule Backup Dialog */}
        <Dialog open={scheduleDialogOpen} onOpenChange={setScheduleDialogOpen}>
          <DialogContent className="sm:max-w-[500px]">
            <DialogHeader>
              <DialogTitle>Agendar Backup</DialogTitle>
              <DialogDescription>Configure um backup automático que será executado de acordo com a frequência especificada.</DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="schedule-name">Nome do Agendamento</Label>
                <Input
                  id="schedule-name"
                  value={newSchedule.name}
                  onChange={(value) => setNewSchedule({ ...newSchedule, name: value as string })}
                  placeholder="Ex: Backup Diário do Sistema"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="schedule-type">Tipo</Label>
                  <Combobox
                    value={newSchedule.type}
                    onValueChange={(value) => setNewSchedule({ ...newSchedule, type: value as BackupMetadata["type"] })}
                    options={[
                      { label: "Banco de Dados", value: "database" },
                      { label: "Arquivos", value: "files" },
                      { label: "Backup Completo", value: "full" },
                    ]}
                    searchable={false}
                    clearable={false}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="schedule-frequency">Frequência</Label>
                  <Combobox
                    value={newSchedule.frequency}
                    onValueChange={(value) => setNewSchedule({ ...newSchedule, frequency: value as "daily" | "weekly" | "monthly" })}
                    options={[
                      { label: "Diário", value: "daily" },
                      { label: "Semanal", value: "weekly" },
                      { label: "Mensal", value: "monthly" },
                    ]}
                    searchable={false}
                    clearable={false}
                  />
                </div>
              </div>
              {/* Folder Selection Section for Scheduled Backups */}
              {(newSchedule.type === "files" || newSchedule.type === "full") && (
                <div className="space-y-4 border-t pt-4">
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="schedule-use-preset-paths"
                      checked={newSchedule.usePresetPaths}
                      onCheckedChange={(checked) => setNewSchedule({ ...newSchedule, usePresetPaths: !!checked })}
                    />
                    <Label htmlFor="schedule-use-preset-paths" className="text-sm font-normal">
                      Usar pastas predefinidas por prioridade
                    </Label>
                  </div>

                  {newSchedule.usePresetPaths && (
                    <div className="space-y-2">
                      <Label htmlFor="schedule-preset-path-type">Prioridade das Pastas</Label>
                      <Combobox
                        value={newSchedule.presetPathType}
                        onValueChange={(value) => setNewSchedule({ ...newSchedule, presetPathType: value as "critical" | "high" | "medium" | "low" })}
                        options={PRESET_PATH_OPTIONS}
                        searchable={false}
                        clearable={false}
                      />
                      <div className="text-xs text-muted-foreground">
                        <strong>Pastas incluídas:</strong>
                        <ul className="mt-1 list-disc list-inside space-y-0.5">
                          {PRESET_PATH_OPTIONS.find((opt) => opt.value === newSchedule.presetPathType)
                            ?.paths.slice(0, 3)
                            .map((path, idx) => (
                              <li key={idx}>{path}</li>
                            ))}
                          {PRESET_PATH_OPTIONS.find((opt) => opt.value === newSchedule.presetPathType)?.paths.length > 3 && (
                            <li>... e mais {PRESET_PATH_OPTIONS.find((opt) => opt.value === newSchedule.presetPathType)?.paths.length - 3} pastas</li>
                          )}
                        </ul>
                      </div>
                    </div>
                  )}
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="schedule-priority">Prioridade</Label>
                  <Combobox
                    value={newSchedule.priority}
                    onValueChange={(value) => setNewSchedule({ ...newSchedule, priority: value as NewScheduleForm["priority"] })}
                    options={PRIORITY_OPTIONS}
                    searchable={false}
                    clearable={false}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="schedule-compression">Compressão</Label>
                  <Combobox
                    value={newSchedule.compressionLevel.toString()}
                    onValueChange={(value) => setNewSchedule({ ...newSchedule, compressionLevel: parseInt(value) })}
                    options={COMPRESSION_OPTIONS.map((opt) => ({
                      label: opt.label,
                      value: opt.value.toString(),
                    }))}
                    searchable={false}
                    clearable={false}
                  />
                </div>
              </div>

              <div className="flex items-center space-x-2">
                <Switch id="schedule-encrypted" checked={newSchedule.encrypted} onCheckedChange={(checked) => setNewSchedule({ ...newSchedule, encrypted: checked })} />
                <Label htmlFor="schedule-encrypted" className="text-sm font-normal">
                  Criptografar backup (requer senha GPG configurada)
                </Label>
              </div>

              <div className="space-y-2">
                <Label htmlFor="schedule-time">Horário de Execução</Label>
                <DateTimeInput mode="time" value={newSchedule.time} onChange={(value) => setNewSchedule({ ...newSchedule, time: value })} />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setScheduleDialogOpen(false)}>
                Cancelar
              </Button>
              <Button onClick={handleCreateSchedule} disabled={isCreating}>
                {isCreating ? "Criando..." : "Criar Agendamento"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Delete Confirmation Dialog */}
        <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Confirmar Exclusão</AlertDialogTitle>
              <AlertDialogDescription>Tem certeza que deseja deletar o backup "{backupToDelete?.name}"? Esta ação não pode ser desfeita.</AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction onClick={confirmDeleteBackup} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                Deletar
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </PrivilegeRoute>
  );
};

export { BackupManagementPage };
export default BackupManagementPage;
