import { apiClient } from "./axiosClient";
import { BACKUP_PRIORITY_PATH_MAP } from "@/config/backup-paths";

interface BackupMetadata {
  id: string;
  name: string;
  type: "database" | "files" | "system" | "full";
  size: number;
  createdAt: string;
  status: "pending" | "in_progress" | "completed" | "failed";
  description?: string;
  paths?: string[];
  error?: string;
  priority?: "low" | "medium" | "high" | "critical";
  compressionLevel?: number;
  encrypted?: boolean;
  progress?: number; // Progress percentage (0-100)
  autoDelete?: {
    enabled: boolean;
    retention: '1_day' | '3_days' | '1_week' | '2_weeks' | '1_month' | '3_months' | '6_months' | '1_year';
    deleteAfter?: string; // ISO date string when backup should be deleted
  };
}

interface CreateBackupRequest {
  name: string;
  type: "database" | "files" | "system" | "full";
  description?: string;
  paths?: string[];
  priority?: "low" | "medium" | "high" | "critical";
  compressionLevel?: number;
  encrypted?: boolean;
  autoDelete?: {
    enabled: boolean;
    retention: '1_day' | '3_days' | '1_week' | '2_weeks' | '1_month' | '3_months' | '6_months' | '1_year';
  };
}

interface ScheduleBackupRequest extends CreateBackupRequest {
  enabled: boolean;
  cron: string;
}

interface BackupSystemHealth {
  totalBackups: number;
  completedBackups: number;
  failedBackups: number;
  inProgressBackups: number;
  totalSize: string;
  diskSpace: {
    available: string;
    used: string;
    total: string;
    usagePercent: number;
  };
  raidStatus: {
    healthy: boolean;
    details: string;
  };
  scheduledBackups: number;
  lastBackup: string | null;
  nextScheduledBackup: string | null;
}

interface BackupVerification {
  backupId: string;
  fileExists: boolean;
  archiveIntegrity: boolean;
  sizeMatch: boolean;
  verificationTime: string;
  details: string;
}

interface ScheduledBackupJob {
  id: string;
  name: string;
  type?: "database" | "files" | "system" | "full";
  cron: string;
  next: number;
  priority?: "low" | "medium" | "high" | "critical";
  description?: string;
  jobName?: string; // Full job name for internal use
  key?: string; // Job key for deletion
}

interface BackupQueryParams {
  type?: "database" | "files" | "system" | "full";
  status?: "pending" | "in_progress" | "completed" | "failed";
  limit?: number;
}

interface SystemHealthSummary {
  raidStatus: { healthy: boolean; details: string; degraded: boolean };
  diskSpace: { available: string; used: string; total: string; usagePercent: number; availableBytes: number };
  backupStats: { total: number; completed: number; failed: number; inProgress: number; totalSize: number };
  recommendations: string[];
}

// Standard API response interface
interface ApiResponse<T> {
  success: boolean;
  data: T;
  message: string;
}

// Helper to validate API responses and throw errors when success is false
function validateResponse<T>(response: ApiResponse<T>, fallbackMessage: string): T {
  if (!response.success) {
    throw new Error(response.message || fallbackMessage);
  }
  return response.data;
}

class BackupApiClient {
  private api = apiClient;

  // Get all backups with optional filtering
  async getBackups(params?: BackupQueryParams): Promise<BackupMetadata[]> {
    const response = await this.api.get<ApiResponse<BackupMetadata[]>>("/backups", {
      params,
    });
    return validateResponse(response.data, "Falha ao buscar backups") || [];
  }

  // Get backup by ID
  async getBackupById(id: string): Promise<BackupMetadata> {
    const response = await this.api.get<ApiResponse<BackupMetadata>>(`/backups/${id}`);
    return validateResponse(response.data, "Falha ao buscar backup");
  }

  // Create a new backup
  async createBackup(data: CreateBackupRequest): Promise<{ id: string; message: string }> {
    const response = await this.api.post<ApiResponse<{ id: string }>>("/backups", data);
    const result = validateResponse(response.data, "Falha ao criar backup");
    return { id: result.id, message: response.data.message };
  }

  // Restore a backup
  async restoreBackup(id: string, targetPath?: string): Promise<{ message: string }> {
    const response = await this.api.post<ApiResponse<{ message: string }>>(`/backups/${id}/restore`, { targetPath });
    validateResponse(response.data, "Falha ao restaurar backup");
    return { message: response.data.message };
  }

  // Delete a backup
  async deleteBackup(id: string): Promise<null> {
    const response = await this.api.delete<ApiResponse<null>>(`/backups/${id}`);
    validateResponse(response.data, "Falha ao excluir backup");
    return null;
  }

  // Get scheduled backups
  async getScheduledBackups(): Promise<ScheduledBackupJob[]> {
    const response = await this.api.get<ApiResponse<ScheduledBackupJob[]>>("/backups/scheduled/list");
    return validateResponse(response.data, "Falha ao buscar backups agendados") || [];
  }

  // Schedule a new backup
  async scheduleBackup(data: ScheduleBackupRequest): Promise<{ message: string }> {
    const response = await this.api.post<ApiResponse<{ message: string }>>("/backups/scheduled", data);
    validateResponse(response.data, "Falha ao agendar backup");
    return { message: response.data.message };
  }

  // Remove a scheduled backup
  async removeScheduledBackup(id: string): Promise<null> {
    const response = await this.api.delete<ApiResponse<null>>(`/backups/scheduled/${id}`);
    validateResponse(response.data, "Falha ao remover backup agendado");
    return null;
  }

  // Get system health status
  async getSystemHealth(): Promise<BackupSystemHealth> {
    const response = await this.api.get<ApiResponse<BackupSystemHealth>>("/backups/system/health");
    return validateResponse(response.data, "Falha ao buscar status do sistema");
  }

  // Verify backup integrity
  async verifyBackup(id: string): Promise<BackupVerification> {
    const response = await this.api.post<ApiResponse<BackupVerification>>(`/backups/system/verify/${id}`);
    return validateResponse(response.data, "Falha ao verificar integridade do backup");
  }

  // Get comprehensive system health summary
  async getSystemHealthSummary(): Promise<SystemHealthSummary> {
    const response = await this.api.get<ApiResponse<SystemHealthSummary>>("/backups/system/health/summary");
    return validateResponse(response.data, "Falha ao buscar resumo de saúde do sistema");
  }

  // Get backup priority paths
  async getPathsByPriority(priority: "low" | "medium" | "high" | "critical" = "medium"): Promise<string[]> {
    // This could be an API call in the future, for now return sensible defaults
    // Paths are centralized in @/config/backup-paths.ts
    const pathMaps = BACKUP_PRIORITY_PATH_MAP;

    switch (priority) {
      case "critical":
        return [...pathMaps.critical];
      case "high":
        return [...pathMaps.critical, ...pathMaps.high];
      case "medium":
        return [...pathMaps.critical, ...pathMaps.high, ...pathMaps.medium];
      case "low":
        return [...pathMaps.critical, ...pathMaps.high, ...pathMaps.medium, ...pathMaps.low];
      default:
        return [...pathMaps.high];
    }
  }

  // Format bytes utility
  formatBytes(bytes: number): string {
    // Handle null, undefined, or non-numeric values
    if (bytes === null || bytes === undefined || isNaN(bytes) || bytes < 0) {
      return "0 B";
    }

    if (bytes === 0) return "0 B";

    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB", "TB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));

    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  }

  // Generate cron expression helpers
  generateCronExpression(frequency: "daily" | "weekly" | "monthly", time: string | number | null | Date): string {
    let hours: number;
    let minutes: number;

    // Handle Date object (from DateTimeInput component)
    if (time instanceof Date) {
      hours = time.getHours();
      minutes = time.getMinutes();
    } else {
      // Ensure time is a valid string
      const timeString = time ? String(time) : "23:00";

      // Validate time format
      if (!timeString.includes(":")) {
        if (process.env.NODE_ENV !== 'production') {
          console.error("Invalid time format:", time);
        }
        return "0 23 * * *"; // Default to 23:00 daily
      }

      const parts = timeString.split(":").map(Number);
      hours = parts[0];
      minutes = parts[1];
    }

    // Validate hours and minutes
    if (isNaN(hours) || isNaN(minutes) || hours < 0 || hours > 23 || minutes < 0 || minutes > 59) {
      if (process.env.NODE_ENV !== 'production') {
        console.error("Invalid time values:", { hours, minutes });
      }
      return "0 23 * * *"; // Default to 23:00 daily
    }

    switch (frequency) {
      case "daily":
        return `${minutes} ${hours} * * *`;
      case "weekly":
        return `${minutes} ${hours} * * 0`; // Every Sunday
      case "monthly":
        return `${minutes} ${hours} 1 * *`; // First day of month
      default:
        return `${minutes} ${hours} * * *`;
    }
  }

  // Parse cron expression to human readable
  parseCronToHuman(cron: string): string {
    const parts = cron.split(" ");
    if (parts.length < 5) return "Expressão cron inválida";

    const [minutes, hours, dayOfMonth, month, dayOfWeek] = parts;

    if (dayOfMonth === "*" && month === "*" && dayOfWeek === "*") {
      return `Diariamente às ${hours.padStart(2, "0")}:${minutes.padStart(2, "0")}`;
    }

    if (dayOfMonth === "*" && month === "*" && dayOfWeek !== "*") {
      const days = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];
      const dayName = days[parseInt(dayOfWeek)] || `Dia ${dayOfWeek}`;
      return `Semanalmente às ${dayName} às ${hours.padStart(2, "0")}:${minutes.padStart(2, "0")}`;
    }

    if (dayOfMonth !== "*" && month === "*") {
      return `Mensalmente no dia ${dayOfMonth} às ${hours.padStart(2, "0")}:${minutes.padStart(2, "0")}`;
    }

    return `Às ${hours.padStart(2, "0")}:${minutes.padStart(2, "0")} (${cron})`;
  }

  // Get list of storage folders available for backup
  async getStorageFolders(): Promise<string[]> {
    const response = await this.api.get<ApiResponse<string[]>>("/backups/storage-folders");
    return validateResponse(response.data, "Falha ao buscar pastas de armazenamento") || [];
  }

  // Get backup history (deleted backups)
  async getBackupHistory(): Promise<BackupMetadata[]> {
    const response = await this.api.get<ApiResponse<BackupMetadata[]>>("/backups/history");
    return validateResponse(response.data, "Falha ao buscar histórico de backups") || [];
  }

  // Permanently delete a backup (hard delete)
  async hardDeleteBackup(id: string): Promise<void> {
    await this.api.delete<ApiResponse<void>>(`/backups/${id}/hard`);
  }
}

export const backupApi = new BackupApiClient();

// Export types
export type {
  BackupMetadata,
  CreateBackupRequest,
  ScheduleBackupRequest,
  BackupSystemHealth,
  BackupVerification,
  ScheduledBackupJob,
  BackupQueryParams,
  SystemHealthSummary,
};
