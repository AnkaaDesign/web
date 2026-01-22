import React, { useState, useCallback, useMemo, useEffect } from "react";
import { PageHeader } from "@/components/ui/page-header";
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
import { DropdownMenu, DropdownMenuItem, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import { PositionedDropdownMenuContent } from "@/components/ui/positioned-dropdown-menu";
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
import { formatDate } from "../../utils/date";
import type { BackupMetadata, ScheduledBackupJob } from "../../api-client/backup";
import { backupApi } from "../../api-client/backup";
import {
  useBackups,
  useScheduledBackups,
  useBackupSystemHealthSummary,
  useBackupMutations,
  useBackupUtils,
} from "@/hooks/useBackup";
import { useBackupProgress } from "@/hooks/useBackupProgress";
import { useAuth } from "@/contexts/auth-context";
import { getLocalStorage } from "@/lib/storage";
import { useTableState } from "@/hooks/use-table-state";

// Retention options for auto-delete
type RetentionPeriod = "1_day" | "3_days" | "1_week" | "2_weeks" | "1_month" | "3_months" | "6_months" | "1_year";

const RETENTION_OPTIONS: Array<{ value: RetentionPeriod; label: string; days: number }> = [
  { value: "1_day", label: "1 Dia", days: 1 },
  { value: "3_days", label: "3 Dias", days: 3 },
  { value: "1_week", label: "1 Semana", days: 7 },
  { value: "2_weeks", label: "2 Semanas", days: 14 },
  { value: "1_month", label: "1 Mês", days: 30 },
  { value: "3_months", label: "3 Meses", days: 90 },
  { value: "6_months", label: "6 Meses", days: 180 },
  { value: "1_year", label: "1 Ano", days: 365 },
];

// Enhanced form interfaces
interface NewBackupForm {
  name: string;
  type: "database" | "files" | "system" | "full";
  description: string;
  priority: "low" | "medium" | "high" | "critical";
  compressionLevel: number;
  encrypted: boolean;
  customPaths: string[];
  usePresetPaths: boolean;
  presetPathType: "critical" | "high" | "medium" | "low";
  sharedFolders: string[];
  autoDelete: {
    enabled: boolean;
    retention: RetentionPeriod;
  };
}

interface NewScheduleForm {
  name: string;
  type: "database" | "files" | "system" | "full";
  frequency: "daily" | "weekly" | "monthly";
  time: string;
  enabled: boolean;
  priority: "low" | "medium" | "high" | "critical";
  compressionLevel: number;
  encrypted: boolean;
  usePresetPaths: boolean;
  presetPathType: "critical" | "high" | "medium" | "low";
  sharedFolders: string[];
  autoDelete: {
    enabled: boolean;
    retention: RetentionPeriod;
  };
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

// Preset path options for system backups
const PRESET_PATH_OPTIONS = [
  { value: "critical", label: "Críticos (Configs principais)", paths: ["/etc/nginx", "/etc/ssl", "/home/kennedy/ankaa/.env", "/home/kennedy/ankaa/apps/api/.env"] },
  { value: "high", label: "Alta prioridade (Sistema completo)", paths: ["/etc/nginx", "/etc/ssl", "/etc/samba", "/etc/systemd/system", "/var/www"] },
  { value: "medium", label: "Média prioridade (Logs, www)", paths: ["/var/log/nginx", "/var/www"] },
  { value: "low", label: "Baixa prioridade (Temporários)", paths: ["/tmp"] },
];

const BackupManagementPage = () => {
  // Authentication state
  const { isAuthenticated } = useAuth();

  // Storage folders state (fetched dynamically from API)
  const [storageFolders, setStorageFolders] = useState<Array<{ value: string; label: string }>>([]);
  const [loadingFolders, setLoadingFolders] = useState(false);

  // Fetch storage folders on mount
  useEffect(() => {
    const fetchStorageFolders = async () => {
      if (!isAuthenticated) return;

      setLoadingFolders(true);
      try {
        const folders = await backupApi.getStorageFolders();

        if (folders && folders.length > 0) {
          const formattedFolders = folders.map(f => ({ value: f, label: f }));
          setStorageFolders(formattedFolders);
        } else {
          if (process.env.NODE_ENV !== "production") {
            console.warn("No storage folders found");
          }
          setStorageFolders([]);
        }
      } catch (error) {
        if (process.env.NODE_ENV !== "production") {
          console.error("Failed to fetch storage folders:", error);
        }
        toast.error("Erro ao carregar pastas de armazenamento");
        setStorageFolders([]);
      } finally {
        setLoadingFolders(false);
      }
    };

    fetchStorageFolders();
  }, [isAuthenticated]);

  // Fetch backups data (only when authenticated)
  const { data: backupsData, isLoading, refetch: refetchBackups } = useBackups(undefined, isAuthenticated);
  const { data: scheduledBackupsData, refetch: refetchScheduled } = useScheduledBackups(isAuthenticated);
  const { data: systemHealth, refetch: refetchHealth } = useBackupSystemHealthSummary(isAuthenticated);

  // Mutations
  const mutations = useBackupMutations();
  const {
    create: createBackupMutation,
    schedule: scheduleBackupMutation,
    delete: deleteBackupMutation,
    restore: restoreBackupMutation,
    removeScheduled: removeScheduledBackupMutation,
    verify: verifyBackupMutation,
  } = mutations;

  // Extract data with fallbacks
  const backups: BackupMetadata[] = backupsData || [];
  const scheduledBackups: ScheduledBackupJob[] = scheduledBackupsData || [];

  // Loading states from mutations
  const isCreating = createBackupMutation.isPending || scheduleBackupMutation.isPending;
  const isDeleting = deleteBackupMutation.isPending;
  const isRestoring = restoreBackupMutation.isPending;
  const isVerifying = verifyBackupMutation.isPending;

  // Utility functions
  const { formatBytes, generateCronExpression, parseCronToHuman } = useBackupUtils();

  // WebSocket listener for backup events (deleted, completed)
  // This ensures the UI updates immediately when backups change
  useEffect(() => {
    if (!isAuthenticated) return;

    const socketUrl = import.meta.env.VITE_API_URL || "http://localhost:3000";
    let socket: any = null;

    const connectSocket = async () => {
      try {
        const { io } = await import("socket.io-client");
        socket = io(`${socketUrl}/backup-progress`, {
          transports: ["websocket", "polling"],
          reconnection: true,
          reconnectionAttempts: 3,
          reconnectionDelay: 2000,
        });

        socket.on("connect", () => {
          if (process.env.NODE_ENV !== "production") {
            console.log("Connected to backup events WebSocket");
          }
        });

        // Listen for backup deletion events
        socket.on("backup-deleted", (data: { backupId: string }) => {
          if (process.env.NODE_ENV !== "production") {
            console.log("Backup deleted event:", data);
          }
          // Refetch backups to update the list
          refetchBackups();
        });

        // Listen for backup completion events
        socket.on("backup-completed", (data: { backupId: string; size: number }) => {
          if (process.env.NODE_ENV !== "production") {
            console.log("Backup completed event:", data);
          }
          // Refetch backups to update status
          refetchBackups();
          toast.success("Backup concluído com sucesso!");
        });

        socket.on("disconnect", () => {
          if (process.env.NODE_ENV !== "production") {
            console.log("Disconnected from backup events WebSocket");
          }
        });
      } catch (error) {
        if (process.env.NODE_ENV !== "production") {
          console.error("Failed to connect to backup WebSocket:", error);
        }
      }
    };

    connectSocket();

    return () => {
      if (socket) {
        socket.disconnect();
      }
    };
  }, [isAuthenticated, refetchBackups]);

  // Wrapper functions for mutations with proper typing and error handling
  const createBackup = async (data: any) => {
    try {
      const result = await createBackupMutation.mutateAsync(data);
      return result.id || null; // API returns { id, message } directly
    } catch (error: any) {
      return null;
    }
  };

  const scheduleBackup = async (data: any) => {
    try {
      await scheduleBackupMutation.mutateAsync(data);
      // Toast already shown by hook, don't duplicate
      return true;
    } catch (error: any) {
      // Toast already shown by hook, don't duplicate
      return false;
    }
  };

  const deleteBackup = async (id: string) => {
    try {
      await deleteBackupMutation.mutateAsync(id);
      return true;
    } catch (error: any) {
      return false;
    }
  };

  const restoreBackup = async (id: string, targetPath?: string) => {
    try {
      await restoreBackupMutation.mutateAsync({ id, targetPath });
      return true;
    } catch (error: any) {
      return false;
    }
  };

  const removeScheduledBackup = async (id: string) => {
    try {
      await removeScheduledBackupMutation.mutateAsync(id);
      return true;
    } catch (error: any) {
      return false;
    }
  };

  const verifyBackup = async (id: string) => {
    try {
      const result = await verifyBackupMutation.mutateAsync(id);
      return result;
    } catch (error: any) {
      return null;
    }
  };

  const refreshAll = () => {
    refetchBackups();
    refetchScheduled();
    refetchHealth();
  };

  const getStatusBadgeVariant = (status: string) => {
    switch (status) {
      case "completed":
        return "success" as const;
      case "failed":
        return "destructive" as const;
      case "in_progress":
        return "default" as const;
      case "pending":
        return "secondary" as const;
      default:
        return "default" as const;
    }
  };

  const getBackupTypeIcon = (type: string) => {
    switch (type) {
      case "database":
        return "IconDatabase";
      case "files":
        return "IconFolder";
      case "full":
        return "IconServer";
      default:
        return "IconDatabase";
    }
  };

  const getBackupTypeLabel = (type: string) => {
    switch (type) {
      case "database":
        return "Banco de Dados";
      case "files":
        return "Arquivos";
      case "system":
        return "Sistema";
      case "full":
        return "Completo";
      default:
        return "Desconhecido";
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case "completed":
        return "Concluído";
      case "failed":
        return "Falhou";
      case "in_progress":
        return "Em progresso";
      case "pending":
        return "Pendente";
      default:
        return "Desconhecido";
    }
  };

  const getFrequencyLabel = (frequency: string) => {
    switch (frequency) {
      case "daily":
        return "Diariamente";
      case "weekly":
        return "Semanalmente";
      case "monthly":
        return "Mensalmente";
      default:
        return "Desconhecido";
    }
  };

  // Dialog states
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [restoreDialogOpen, setRestoreDialogOpen] = useState(false);
  const [scheduleDialogOpen, setScheduleDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleteScheduleDialogOpen, setDeleteScheduleDialogOpen] = useState(false);
  const [verifyDialogOpen, setVerifyDialogOpen] = useState(false);

  // Context menu state for scheduled backups
  const [scheduleContextMenu, setScheduleContextMenu] = useState<{
    x: number;
    y: number;
    schedule: ScheduledBackupJob;
  } | null>(null);

  // Context menu state for existing backups (updated to support bulk operations)
  const [backupContextMenu, setBackupContextMenu] = useState<{
    x: number;
    y: number;
    backups: BackupMetadata[];
    isBulk: boolean;
  } | null>(null);

  // Selection state using table state hook
  const {
    selectedIds,
    toggleSelection,
    toggleSelectAll,
    isSelected,
    isAllSelected,
    isPartiallySelected,
    selectionCount,
    resetSelection,
  } = useTableState({
    defaultPageSize: 40,
    resetSelectionOnPageChange: false,
  });

  // Selected items
  const [selectedBackup, setSelectedBackup] = useState<BackupMetadata | null>(null);
  const [backupToDelete, setBackupToDelete] = useState<BackupMetadata[] | null>(null);
  const [scheduleToDelete, setScheduleToDelete] = useState<ScheduledBackupJob | null>(null);

  // Enhanced form states
  const [newBackup, setNewBackup] = useState<NewBackupForm>({
    name: "",
    type: "database",
    description: "",
    priority: "medium",
    compressionLevel: 6,
    encrypted: false,
    customPaths: [],
    usePresetPaths: false,
    presetPathType: "high",
    sharedFolders: [],
    autoDelete: {
      enabled: false,
      retention: "1_week",
    },
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
    usePresetPaths: false,
    presetPathType: "high",
    sharedFolders: [],
    autoDelete: {
      enabled: false,
      retention: "1_week",
    },
  });

  // Reset usePresetPaths when schedule type changes to files/full
  useEffect(() => {
    if (newSchedule.type === "files" || newSchedule.type === "full") {
      setNewSchedule((prev) => ({ ...prev, usePresetPaths: false }));
    } else if (newSchedule.type === "system") {
      setNewSchedule((prev) => ({ ...prev, usePresetPaths: true }));
    }
  }, [newSchedule.type]);

  // Reset usePresetPaths when backup type changes to files/full
  useEffect(() => {
    if (newBackup.type === "files" || newBackup.type === "full") {
      setNewBackup((prev) => ({ ...prev, usePresetPaths: false }));
    } else if (newBackup.type === "system") {
      setNewBackup((prev) => ({ ...prev, usePresetPaths: true }));
    }
  }, [newBackup.type]);

  // Utility functions
  const formatBackupDateTime = (dateString: string) => {
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

  // Custom hook for simulated progress with WebSocket real-time updates
  const useSimulatedProgress = (backupId: string, isInProgress: boolean, backupProgress?: number) => {
    const [simulatedProgress, setSimulatedProgress] = useState(15);
    const [startTimeRef] = useState(() => Date.now());

    // Get auth token for WebSocket connection
    const token = getLocalStorage("token") || undefined;

    // Use WebSocket-based real-time progress when backup is in progress
    const {
      progress: wsProgress,
      isConnected: wsConnected,
    } = useBackupProgress(isInProgress ? backupId : null, {
      token,
      onComplete: () => {
        refetchBackups(); // Refetch when backup completes
      },
      onError: (error) => {
        if (process.env.NODE_ENV !== "production") {
          console.warn("WebSocket progress error:", error);
        }
      },
    });

    // Poll for real status as fallback (less frequently when WebSocket is connected)
    useEffect(() => {
      if (!isInProgress) return;

      // Poll less frequently if WebSocket is connected
      const pollInterval = setInterval(() => {
        refetchBackups(); // Check if backup completed
      }, wsConnected ? 5000 : 2000);

      return () => clearInterval(pollInterval);
    }, [isInProgress, backupId, wsConnected]);

    useEffect(() => {
      // Reset progress when backup is no longer in progress
      if (!isInProgress) {
        setSimulatedProgress(15);
        return;
      }

      // If we have WebSocket progress, use it
      if (wsProgress && wsProgress > 0) {
        setSimulatedProgress(wsProgress);
        return;
      }

      // If backend provides real progress from polling, use it
      if (backupProgress && backupProgress > 0) {
        setSimulatedProgress(backupProgress);
        return;
      }

      const interval = setInterval(() => {
        const elapsed = Date.now() - startTimeRef;

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
          progress = Math.min(progress, 95); // Don't go above 95% (real status will update to 100%)
        }

        setSimulatedProgress(Math.round(progress));
      }, 1000); // Update every 1 second for smoother animation

      return () => clearInterval(interval);
    }, [isInProgress, backupId, backupProgress, wsProgress, startTimeRef]);

    // Priority: WebSocket > Backend polling > Simulated
    if (wsProgress && wsProgress > 0) return wsProgress;
    if (backupProgress && backupProgress > 0) return backupProgress;
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

    if (newBackup.type === "files") {
      // Files backup - shared storage folders
      if (newBackup.sharedFolders.length > 0) {
        pathsToBackup = newBackup.sharedFolders;
      }
      // If no folders selected, will backup entire shared storage directory
    } else if (newBackup.type === "system") {
      // System backup - System configuration paths
      if (newBackup.usePresetPaths) {
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
      autoDelete: newBackup.autoDelete.enabled ? newBackup.autoDelete : undefined,
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
        sharedFolders: [],
        autoDelete: {
          enabled: false,
          retention: "1_week",
        },
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

    setBackupToDelete([backup]);
    setDeleteDialogOpen(true);
  }, []);

  const confirmDeleteBackup = useCallback(async () => {
    if (!backupToDelete || backupToDelete.length === 0) return;

    const isBulk = backupToDelete.length > 1;

    try {
      if (isBulk) {
        // Delete all backups in parallel
        const promises = backupToDelete.map((b) => deleteBackup(b.id));
        await Promise.all(promises);
        resetSelection();
      } else {
        // Delete single backup
        await deleteBackup(backupToDelete[0].id);
      }

      toast.success(
        isBulk
          ? `${backupToDelete.length} backups excluídos com sucesso`
          : "Backup excluído com sucesso"
      );
      refetchBackups();
      setDeleteDialogOpen(false);
      setBackupToDelete(null);
    } catch (error) {
      console.error('Failed to delete backup:', error);
      toast.error(
        error instanceof Error
          ? `Erro ao excluir backup: ${error.message}`
          : "Erro ao excluir backup. Tente novamente."
      );
    }
  }, [backupToDelete, deleteBackup, resetSelection, refetchBackups]);

  const handleCreateSchedule = useCallback(async () => {
    try {
      if (!newSchedule.name.trim()) {
        toast.error("Nome do agendamento é obrigatório");
        return;
      }

      // Determine paths to use for scheduled backup
      let pathsToBackup: string[] | undefined;

      if (newSchedule.type === "files") {
        // Files backup - shared storage folders
        if (newSchedule.sharedFolders.length > 0) {
          pathsToBackup = newSchedule.sharedFolders;
        }
      } else if (newSchedule.type === "system") {
        // System backup - System configuration paths
        if (newSchedule.usePresetPaths) {
          const presetPaths = PRESET_PATH_OPTIONS.find((opt) => opt.value === newSchedule.presetPathType)?.paths || [];
          pathsToBackup = presetPaths;
        }
      }

      const cronExpression = generateCronExpression(newSchedule.frequency, newSchedule.time);

      // Format time for display (handle Date object from DateTimeInput)
      let timeDisplay: string;
      if (newSchedule.time instanceof Date) {
        const hours = newSchedule.time.getHours().toString().padStart(2, '0');
        const minutes = newSchedule.time.getMinutes().toString().padStart(2, '0');
        timeDisplay = `${hours}:${minutes}`;
      } else {
        timeDisplay = String(newSchedule.time);
      }

      const scheduleData = {
        name: newSchedule.name,
        type: newSchedule.type,
        description: `Backup agendado ${getFrequencyLabel(newSchedule.frequency).toLowerCase()} às ${timeDisplay}`,
        priority: newSchedule.priority,
        compressionLevel: newSchedule.compressionLevel,
        encrypted: newSchedule.encrypted,
        enabled: newSchedule.enabled,
        cron: cronExpression,
        paths: pathsToBackup,
        autoDelete: newSchedule.autoDelete.enabled ? newSchedule.autoDelete : undefined,
      };

      const success = await scheduleBackup(scheduleData);

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
          sharedFolders: [],
          autoDelete: {
            enabled: false,
            retention: "1_week",
          },
        });
      }
    } catch (error) {
      if (process.env.NODE_ENV !== "production") {
        console.error("Error in handleCreateSchedule:", error);
      }
      toast.error(`Erro ao criar agendamento: ${error.message || "Erro desconhecido"}`);
    }
  }, [newSchedule, scheduleBackup, getFrequencyLabel, generateCronExpression]);

  const handleDeleteSchedule = useCallback((schedule: ScheduledBackupJob) => {
    setScheduleToDelete(schedule);
    setDeleteScheduleDialogOpen(true);
  }, []);

  const confirmDeleteSchedule = useCallback(async () => {
    if (!scheduleToDelete) return;

    // Use the most reliable identifier: key > id > jobName
    const identifier = scheduleToDelete.key || scheduleToDelete.id || scheduleToDelete.jobName;

    if (!identifier) {
      toast.error("Não foi possível identificar o agendamento para exclusão");
      return;
    }

    const success = await removeScheduledBackup(identifier);
    if (success) {
      setDeleteScheduleDialogOpen(false);
      setScheduleToDelete(null);
    }
  }, [scheduleToDelete, removeScheduledBackup]);

  // Context menu handlers for scheduled backups
  const handleScheduleContextMenu = useCallback(
    (event: React.MouseEvent, schedule: ScheduledBackupJob) => {
      event.preventDefault();
      event.stopPropagation();

      setScheduleContextMenu({
        x: event.clientX,
        y: event.clientY,
        schedule: schedule,
      });
    },
    [],
  );

  const handleScheduleContextMenuDelete = useCallback(() => {
    if (scheduleContextMenu) {
      handleDeleteSchedule(scheduleContextMenu.schedule);
      setScheduleContextMenu(null);
    }
  }, [scheduleContextMenu, handleDeleteSchedule]);

  // Close context menus when clicking outside
  useEffect(() => {
    const handleClick = () => {
      setScheduleContextMenu(null);
      setBackupContextMenu(null);
    };
    document.addEventListener("click", handleClick);
    return () => document.removeEventListener("click", handleClick);
  }, []);

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

  // Context menu handlers for existing backups
  const handleBackupContextMenu = useCallback(
    (event: React.MouseEvent, backup: BackupMetadata) => {
      event.preventDefault();
      event.stopPropagation();

      const isBackupSelected = isSelected(backup.id);
      const hasSelection = selectionCount > 0;

      if (hasSelection && isBackupSelected) {
        // Show bulk actions for all selected backups
        const selectedBackupsList = backups.filter((b) => isSelected(b.id));
        setBackupContextMenu({
          x: event.clientX,
          y: event.clientY,
          backups: selectedBackupsList,
          isBulk: true,
        });
      } else {
        // Show actions for just the clicked backup
        setBackupContextMenu({
          x: event.clientX,
          y: event.clientY,
          backups: [backup],
          isBulk: false,
        });
      }
    },
    [backups, isSelected, selectionCount],
  );

  const handleBackupContextMenuVerify = useCallback(() => {
    if (backupContextMenu && !backupContextMenu.isBulk) {
      handleVerifyBackup(backupContextMenu.backups[0]);
      setBackupContextMenu(null);
    }
  }, [backupContextMenu, handleVerifyBackup]);

  const handleBackupContextMenuRestore = useCallback(() => {
    if (backupContextMenu && !backupContextMenu.isBulk) {
      setSelectedBackup(backupContextMenu.backups[0]);
      setRestoreDialogOpen(true);
      setBackupContextMenu(null);
    }
  }, [backupContextMenu]);

  const handleBackupContextMenuDelete = useCallback(() => {
    if (backupContextMenu) {
      setBackupToDelete(backupContextMenu.backups);
      setDeleteDialogOpen(true);
      setBackupContextMenu(null);
    }
  }, [backupContextMenu]);

  // BackupTableRow component to use the progress hook
  const BackupTableRow = ({ backup }: { backup: BackupMetadata }) => {
    const actualProgress = useSimulatedProgress(backup.id, backup.status === "in_progress", backup.progress);
    const isBackupSelected = isSelected(backup.id);

    const TypeIcon = getBackupTypeIcon(backup.type) === "IconDatabase" ? IconDatabase : getBackupTypeIcon(backup.type) === "IconFolder" ? IconFolder : IconServer;

    // Format folder/file display
    const formatPathsDisplay = () => {
      if (!backup.paths || backup.paths.length === 0) {
        // No paths specified = full backup
        return <span className="text-sm text-muted-foreground">todas</span>;
      }

      if (backup.paths.length === 1) {
        // Show single folder name
        return (
          <div className="flex items-center gap-1 text-sm text-muted-foreground">
            <IconFolder className="h-3 w-3" />
            <span>{backup.paths[0]}</span>
          </div>
        );
      }

      if (backup.paths.length === 2) {
        // Show both folder names
        return (
          <div className="flex items-center gap-1 text-sm text-muted-foreground">
            <IconFolder className="h-3 w-3" />
            <span>{backup.paths.join(", ")}</span>
          </div>
        );
      }

      // 3+ folders: show count
      return (
        <div className="flex items-center gap-1 text-sm text-muted-foreground">
          <IconFolder className="h-3 w-3" />
          <span>{backup.paths.length} pastas</span>
        </div>
      );
    };

    return (
      <TableRow
        key={backup.id}
        className={cn(
          "cursor-pointer hover:bg-muted/20",
          isBackupSelected && "bg-muted/30 hover:bg-muted/40"
        )}
        onContextMenu={(e) => handleBackupContextMenu(e, backup)}
      >
        <TableCell className="w-[50px]">
          <div className="flex items-center justify-center" onClick={(e) => e.stopPropagation()}>
            <Checkbox
              checked={isBackupSelected}
              onCheckedChange={() => toggleSelection(backup.id)}
              aria-label={`Selecionar backup ${backup.name}`}
            />
          </div>
        </TableCell>
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
            </div>
          </div>
        </TableCell>
        <TableCell>
          <div className="flex items-center gap-2">
            <TypeIcon className="h-4 w-4 text-muted-foreground" />
            {getBackupTypeLabel(backup.type)}
          </div>
        </TableCell>
        <TableCell>
          {backup.priority ? (
            <Badge variant={getPriorityBadgeVariant(backup.priority)} className="text-xs">
              {getPriorityLabel(backup.priority)}
            </Badge>
          ) : (
            <span className="text-sm text-muted-foreground">-</span>
          )}
        </TableCell>
        <TableCell>
          {formatPathsDisplay()}
        </TableCell>
        <TableCell>{formatBytes(backup.size)}</TableCell>
        <TableCell>{formatBackupDateTime(backup.createdAt)}</TableCell>
        <TableCell>
          <div className="space-y-2">
            {backup.status === "in_progress" ? (
              <div className="space-y-1">
                <Progress value={actualProgress} className="h-2" />
                <div className="text-xs text-muted-foreground">{Math.round(actualProgress)}% concluído</div>
              </div>
            ) : (
              <Badge variant={getStatusBadgeVariant(backup.status)}>{getStatusLabel(backup.status)}</Badge>
            )}
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
  ];

  return (
    <PrivilegeRoute requiredPrivilege={SECTOR_PRIVILEGES.ADMIN}>
      <div className="h-full flex flex-col px-4 pt-4">
        {/* Page Header */}
        <div className="flex-shrink-0">
          <PageHeader
            title="Gerenciamento de Backups"
            icon={IconDatabase}
            favoritePage={FAVORITE_PAGES.ADMINISTRACAO_COLABORADORES_LISTAR} // Reusing existing favorite
            breadcrumbs={[{ label: "Início", href: "/" }, { label: "Administração", href: "/administracao" }, { label: "Backups" }]}
            actions={actions}
          />
        </div>

        <div className="flex-1 overflow-y-auto pb-6 space-y-6 mt-4">
          {/* Summary Statistics */}
          {systemHealth && (
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center space-x-2">
                    <IconDatabase className="h-4 w-4 text-blue-500" />
                    <div className="text-2xl font-bold">{systemHealth.backupStats.total}</div>
                  </div>
                  <p className="text-xs text-muted-foreground">Total de Backups</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center space-x-2">
                    <IconCheck className="h-4 w-4 text-green-500" />
                    <div className="text-2xl font-bold">{systemHealth.backupStats.completed}</div>
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
                    <div className="text-2xl font-bold">{formatBytes(systemHealth.backupStats.totalSize)}</div>
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
              <div className="rounded-md border dark:border-border/40">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[50px]">
                        <div className="flex items-center justify-center">
                          <Checkbox
                            checked={isAllSelected(backups.map(b => b.id))}
                            indeterminate={isPartiallySelected(backups.map(b => b.id))}
                            onCheckedChange={() => toggleSelectAll(backups.map(b => b.id))}
                            aria-label="Selecionar todos"
                            disabled={isLoading || backups.length === 0}
                          />
                        </div>
                      </TableHead>
                      <TableHead>Nome</TableHead>
                      <TableHead>Tipo</TableHead>
                      <TableHead>Prioridade</TableHead>
                      <TableHead>Pastas/Arquivos</TableHead>
                      <TableHead>Tamanho</TableHead>
                      <TableHead>Data de Criação</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {backups.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
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
              <div className="rounded-md border dark:border-border/40">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nome</TableHead>
                      <TableHead>Tipo</TableHead>
                      <TableHead>Prioridade</TableHead>
                      <TableHead>Agendamento</TableHead>
                      <TableHead>Próxima Execução</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {scheduledBackups.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                          Nenhum backup agendado
                        </TableCell>
                      </TableRow>
                    ) : (
                      scheduledBackups.map((schedule) => {
                        const TypeIcon =
                          schedule.type === "database" ? IconDatabase :
                          schedule.type === "files" ? IconFolder :
                          schedule.type === "full" ? IconServer :
                          IconDatabase;

                        return (
                          <TableRow
                            key={schedule.id}
                            className="cursor-pointer hover:bg-muted/20"
                            onContextMenu={(e) => handleScheduleContextMenu(e, schedule)}
                          >
                            <TableCell className="font-medium">{schedule.name}</TableCell>
                            <TableCell>
                              <div className="flex items-center gap-2">
                                <TypeIcon className="h-4 w-4 text-muted-foreground" />
                                {getBackupTypeLabel(schedule.type || "database")}
                              </div>
                            </TableCell>
                            <TableCell>
                              {schedule.priority ? (
                                <Badge variant={getPriorityBadgeVariant(schedule.priority)} className="text-xs">
                                  {getPriorityLabel(schedule.priority)}
                                </Badge>
                              ) : (
                                <span className="text-sm text-muted-foreground">-</span>
                              )}
                            </TableCell>
                            <TableCell>
                              <div className="space-y-1">
                                {schedule.description && (
                                  <div className="text-sm text-muted-foreground">
                                    {schedule.description}
                                  </div>
                                )}
                                <div className="text-sm font-medium">
                                  {parseCronToHuman(schedule.cron)}
                                </div>
                              </div>
                            </TableCell>
                            <TableCell>{formatNextExecution(schedule.next)}</TableCell>
                            <TableCell>
                              <Badge variant="success">Ativo</Badge>
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
                <Input transparent id="backup-name" value={newBackup.name} onChange={(value) => setNewBackup({ ...newBackup, name: value as string })} placeholder="Ex: backup_sistema_2024-09-12" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="backup-type">Tipo de Backup</Label>
                <Combobox
                  value={newBackup.type}
                  onValueChange={(value) => setNewBackup({ ...newBackup, type: value as BackupMetadata["type"] })}
                  options={[
                    { label: "Banco de Dados", value: "database" },
                    { label: "Arquivos", value: "files" },
                    { label: "Sistema", value: "system" },
                    { label: "Backup Completo", value: "full" },
                  ]}
                  searchable={false}
                  clearable={false}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="backup-description">Descrição (Opcional)</Label>
                <Input
                  transparent
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
              {/* Folder Selection Section for Files/Full */}
              {(newBackup.type === "files" || newBackup.type === "full") && (
                <div className="space-y-4 border-t pt-4">
                  <Label>Pastas para Backup</Label>
                  <p className="text-sm text-muted-foreground">Selecione as pastas ou deixe vazio para backup completo</p>
                  <Combobox
                    value={newBackup.sharedFolders}
                    onValueChange={(value) => {
                      if (Array.isArray(value)) {
                        setNewBackup({ ...newBackup, sharedFolders: value as string[] });
                      }
                    }}
                    options={storageFolders}
                    placeholder={loadingFolders ? "Carregando pastas..." : "Selecione as pastas"}
                    emptyText="Nenhuma pasta disponível"
                    searchable={true}
                    clearable={true}
                    mode="multiple"
                    disabled={loadingFolders}
                  />
                  {newBackup.sharedFolders.length > 0 && (
                    <div className="text-xs text-muted-foreground">
                      <strong>{newBackup.sharedFolders.length} {newBackup.sharedFolders.length === 1 ? "pasta selecionada" : "pastas selecionadas"}</strong>
                    </div>
                  )}
                </div>
              )}

              {/* Folder Selection Section for System */}
              {newBackup.type === "system" && (
                <div className="space-y-4 border-t pt-4">
                  <div className="flex items-center space-x-2">
                    <Checkbox id="use-preset-paths" checked={newBackup.usePresetPaths} onCheckedChange={(checked) => setNewBackup({ ...newBackup, usePresetPaths: !!checked })} />
                    <Label htmlFor="use-preset-paths" className="text-sm font-normal">
                      Usar pastas de sistema predefinidas
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
                        <Input transparent value={customPathInput} onChange={(value) => setCustomPathInput(value as string)} placeholder="/caminho/para/pasta" />
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

              {/* Auto-Delete / Retention Section */}
              <div className="space-y-4 border-t pt-4">
                <div className="flex items-center space-x-2">
                  <Switch
                    id="backup-auto-delete"
                    checked={newBackup.autoDelete.enabled}
                    onCheckedChange={(checked) =>
                      setNewBackup({
                        ...newBackup,
                        autoDelete: { ...newBackup.autoDelete, enabled: checked },
                      })
                    }
                  />
                  <Label htmlFor="backup-auto-delete" className="text-sm font-normal">
                    <IconCalendar className="h-4 w-4 inline mr-1" />
                    Excluir automaticamente após período de retenção
                  </Label>
                </div>

                {newBackup.autoDelete.enabled && (
                  <div className="space-y-3 pl-6">
                    <div className="space-y-2">
                      <Label htmlFor="backup-retention">Período de Retenção</Label>
                      <Combobox
                        value={newBackup.autoDelete.retention}
                        onValueChange={(value) =>
                          setNewBackup({
                            ...newBackup,
                            autoDelete: { ...newBackup.autoDelete, retention: value as RetentionPeriod },
                          })
                        }
                        options={RETENTION_OPTIONS.map((opt) => ({
                          value: opt.value,
                          label: opt.label,
                        }))}
                        placeholder="Selecione o período"
                        searchable={false}
                        clearable={false}
                      />
                    </div>
                    <div className="p-3 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 rounded-md">
                      <div className="flex gap-2 text-sm text-amber-800 dark:text-amber-200">
                        <IconAlertTriangle className="h-4 w-4 flex-shrink-0 mt-0.5" />
                        <span>
                          Este backup será excluído automaticamente em{" "}
                          <strong>{RETENTION_OPTIONS.find((opt) => opt.value === newBackup.autoDelete.retention)?.label}</strong>{" "}
                          após a criação.
                        </span>
                      </div>
                    </div>
                  </div>
                )}
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
                      <span className="font-medium">Criado em:</span> {formatBackupDateTime(selectedBackup.createdAt)}
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
                  transparent
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
                      { label: "Sistema", value: "system" },
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
              {/* Folder Selection Section for Files/Full Backups */}
              {(newSchedule.type === "files" || newSchedule.type === "full") && (
                <div className="space-y-4 border-t pt-4">
                  <Label>Pastas para Backup</Label>
                  <p className="text-sm text-muted-foreground">Selecione as pastas compartilhadas ou deixe vazio para backup completo</p>
                  <Combobox
                    value={newSchedule.sharedFolders}
                    onValueChange={(value) => {
                      if (Array.isArray(value)) {
                        setNewSchedule({ ...newSchedule, sharedFolders: value as string[] });
                      }
                    }}
                    options={storageFolders}
                    placeholder={loadingFolders ? "Carregando pastas..." : "Selecione as pastas"}
                    emptyText="Nenhuma pasta disponível"
                    searchable={true}
                    clearable={true}
                    mode="multiple"
                    disabled={loadingFolders}
                  />
                  {newSchedule.sharedFolders.length > 0 && (
                    <div className="text-xs text-muted-foreground">
                      <strong>{newSchedule.sharedFolders.length} {newSchedule.sharedFolders.length === 1 ? "pasta selecionada" : "pastas selecionadas"}</strong>
                    </div>
                  )}
                </div>
              )}

              {/* Folder Selection Section for System Backups */}
              {newSchedule.type === "system" && (
                <div className="space-y-4 border-t pt-4">
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="schedule-use-preset-paths"
                      checked={newSchedule.usePresetPaths}
                      onCheckedChange={(checked) => setNewSchedule({ ...newSchedule, usePresetPaths: !!checked })}
                    />
                    <Label htmlFor="schedule-use-preset-paths" className="text-sm font-normal">
                      Usar pastas de sistema predefinidas
                    </Label>
                  </div>

                  {newSchedule.usePresetPaths ? (
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
                  ) : (
                    <div className="space-y-2">
                      <Label>Pastas compartilhadas para Backup</Label>
                      <p className="text-sm text-muted-foreground">Selecione as pastas compartilhadas para backup</p>
                      <Combobox
                        value={newSchedule.sharedFolders}
                        onValueChange={(value) => {
                          if (Array.isArray(value)) {
                            setNewSchedule({ ...newSchedule, sharedFolders: value as string[] });
                          }
                        }}
                        options={storageFolders}
                        placeholder={loadingFolders ? "Carregando pastas..." : "Selecione as pastas"}
                        emptyText="Nenhuma pasta disponível"
                        searchable={true}
                        clearable={true}
                        mode="multiple"
                        disabled={loadingFolders}
                      />
                      {newSchedule.sharedFolders.length > 0 && (
                        <div className="text-xs text-muted-foreground">
                          <strong>{newSchedule.sharedFolders.length} {newSchedule.sharedFolders.length === 1 ? "pasta selecionada" : "pastas selecionadas"}</strong>
                        </div>
                      )}
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

              {/* Auto-Delete / Retention Section */}
              <div className="space-y-4 border-t pt-4">
                <div className="flex items-center space-x-2">
                  <Switch
                    id="schedule-auto-delete"
                    checked={newSchedule.autoDelete.enabled}
                    onCheckedChange={(checked) =>
                      setNewSchedule({
                        ...newSchedule,
                        autoDelete: { ...newSchedule.autoDelete, enabled: checked },
                      })
                    }
                  />
                  <Label htmlFor="schedule-auto-delete" className="text-sm font-normal">
                    <IconCalendar className="h-4 w-4 inline mr-1" />
                    Excluir automaticamente após período de retenção
                  </Label>
                </div>

                {newSchedule.autoDelete.enabled && (
                  <div className="space-y-3 pl-6">
                    <div className="space-y-2">
                      <Label htmlFor="schedule-retention">Período de Retenção</Label>
                      <Combobox
                        value={newSchedule.autoDelete.retention}
                        onValueChange={(value) =>
                          setNewSchedule({
                            ...newSchedule,
                            autoDelete: { ...newSchedule.autoDelete, retention: value as RetentionPeriod },
                          })
                        }
                        options={RETENTION_OPTIONS.map((opt) => ({
                          value: opt.value,
                          label: opt.label,
                        }))}
                        placeholder="Selecione o período"
                        searchable={false}
                        clearable={false}
                      />
                    </div>
                    <div className="p-3 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 rounded-md">
                      <div className="flex gap-2 text-sm text-amber-800 dark:text-amber-200">
                        <IconAlertTriangle className="h-4 w-4 flex-shrink-0 mt-0.5" />
                        <span>
                          Cada backup criado por este agendamento será excluído automaticamente em{" "}
                          <strong>{RETENTION_OPTIONS.find((opt) => opt.value === newSchedule.autoDelete.retention)?.label}</strong>{" "}
                          após a criação.
                        </span>
                      </div>
                    </div>
                  </div>
                )}
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
              <AlertDialogDescription>
                {backupToDelete && backupToDelete.length > 1
                  ? `Tem certeza que deseja excluir ${backupToDelete.length} backups? Esta ação não pode ser desfeita.`
                  : `Tem certeza que deseja deletar o backup "${backupToDelete?.[0]?.name}"? Esta ação não pode ser desfeita.`}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction onClick={confirmDeleteBackup} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                Excluir
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Delete Schedule Confirmation Dialog */}
        <AlertDialog open={deleteScheduleDialogOpen} onOpenChange={setDeleteScheduleDialogOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Confirmar Exclusão de Agendamento</AlertDialogTitle>
              <AlertDialogDescription>
                Tem certeza que deseja deletar o agendamento "{scheduleToDelete?.name}"? Esta ação não pode ser desfeita e o backup agendado não será mais executado automaticamente.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction onClick={confirmDeleteSchedule} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                Deletar Agendamento
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Context Menu for Scheduled Backups */}
        <DropdownMenu open={!!scheduleContextMenu} onOpenChange={(open) => !open && setScheduleContextMenu(null)}>
          <PositionedDropdownMenuContent
            position={scheduleContextMenu}
            isOpen={!!scheduleContextMenu}
            className="w-56 ![position:fixed]"
            onCloseAutoFocus={(e) => e.preventDefault()}
          >
            <DropdownMenuItem onClick={handleScheduleContextMenuDelete} className="text-destructive">
              <IconTrash className="mr-2 h-4 w-4" />
              Excluir
            </DropdownMenuItem>
          </PositionedDropdownMenuContent>
        </DropdownMenu>

        {/* Context Menu for Existing Backups */}
        <DropdownMenu open={!!backupContextMenu} onOpenChange={(open) => !open && setBackupContextMenu(null)}>
          <PositionedDropdownMenuContent
            position={backupContextMenu}
            isOpen={!!backupContextMenu}
            className="w-56 ![position:fixed]"
            onCloseAutoFocus={(e) => e.preventDefault()}
          >
            {backupContextMenu?.isBulk && (
              <div className="px-2 py-1.5 text-sm font-semibold text-muted-foreground">
                {backupContextMenu.backups.length} backups selecionados
              </div>
            )}

            {!backupContextMenu?.isBulk && backupContextMenu?.backups[0]?.status === "completed" && (
              <>
                <DropdownMenuItem onClick={handleBackupContextMenuVerify} disabled={isVerifying}>
                  <IconEye className="mr-2 h-4 w-4" />
                  Verificar
                </DropdownMenuItem>
                <DropdownMenuItem onClick={handleBackupContextMenuRestore} disabled={isRestoring}>
                  <IconDownload className="mr-2 h-4 w-4" />
                  Restaurar
                </DropdownMenuItem>
                <DropdownMenuSeparator />
              </>
            )}
            <DropdownMenuItem
              onClick={handleBackupContextMenuDelete}
              disabled={backupContextMenu?.backups.some(b => b.status === "in_progress") || isDeleting}
              className="text-destructive"
            >
              <IconTrash className="mr-2 h-4 w-4" />
              {backupContextMenu?.isBulk && backupContextMenu.backups.length > 1 ? "Excluir selecionados" : "Deletar"}
            </DropdownMenuItem>
          </PositionedDropdownMenuContent>
        </DropdownMenu>
      </div>
    </PrivilegeRoute>
  );
};

export { BackupManagementPage };
export default BackupManagementPage;
