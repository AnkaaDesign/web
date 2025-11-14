import { apiClient } from "./axiosClient";

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
  raidAware?: boolean;
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
  raidAware?: boolean;
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

class BackupApiClient {
  private api = apiClient;

  // Get all backups with optional filtering
  async getBackups(params?: BackupQueryParams): Promise<BackupMetadata[]> {
    const response = await this.api.get<{ success: boolean; data: BackupMetadata[]; message: string }>("/backups", {
      params,
    });
    return response.data.data || [];
  }

  // Get backup by ID
  async getBackupById(id: string): Promise<BackupMetadata> {
    const response = await this.api.get<{ success: boolean; data: BackupMetadata; message: string }>(`/backups/${id}`);
    return response.data.data;
  }

  // Create a new backup
  async createBackup(data: CreateBackupRequest): Promise<{ id: string; message: string }> {
    const response = await this.api.post<{ success: boolean; data: { id: string }; message: string }>("/backups", data);
    return { id: response.data.data.id, message: response.data.message };
  }

  // Restore a backup
  async restoreBackup(id: string, targetPath?: string): Promise<{ message: string }> {
    const response = await this.api.post<{ message: string }>(`/backups/${id}/restore`, { targetPath });
    return response.data;
  }

  // Delete a backup
  async deleteBackup(id: string): Promise<null> {
    const response = await this.api.delete<null>(`/backups/${id}`);
    return response.data;
  }

  // Get scheduled backups
  async getScheduledBackups(): Promise<ScheduledBackupJob[]> {
    const response = await this.api.get<{ success: boolean; data: ScheduledBackupJob[]; message: string }>("/backups/scheduled/list");
    return response.data.data || [];
  }

  // Schedule a new backup
  async scheduleBackup(data: ScheduleBackupRequest): Promise<{ message: string }> {
    const response = await this.api.post<{ message: string }>("/backups/scheduled", data);
    return response.data;
  }

  // Remove a scheduled backup
  async removeScheduledBackup(id: string): Promise<null> {
    const response = await this.api.delete<null>(`/backups/scheduled/${id}`);
    return response.data;
  }

  // Get system health status
  async getSystemHealth(): Promise<BackupSystemHealth> {
    const response = await this.api.get<{ success: boolean; data: BackupSystemHealth; message: string }>("/backups/system/health");
    return response.data.data;
  }

  // Verify backup integrity
  async verifyBackup(id: string): Promise<BackupVerification> {
    const response = await this.api.post<BackupVerification>(`/backups/system/verify/${id}`);
    return response.data;
  }

  // Get comprehensive system health summary
  async getSystemHealthSummary(): Promise<SystemHealthSummary> {
    const response = await this.api.get<{ success: boolean; data: SystemHealthSummary; message: string }>("/backups/system/health/summary");
    return response.data.data;
  }

  // Get backup priority paths
  async getPathsByPriority(priority: "low" | "medium" | "high" | "critical" = "medium"): Promise<string[]> {
    // This could be an API call in the future, for now return sensible defaults
    const pathMaps = {
      critical: ["/home/kennedy/ankaa", "/home/kennedy/ankaa/.env", "/home/kennedy/ankaa/apps/api/.env"],
      high: ["/home/kennedy/ankaa/apps", "/home/kennedy/ankaa/packages", "/home/kennedy/ankaa/scripts", "/etc/nginx", "/etc/ssl"],
      medium: ["/home/kennedy/ankaa/docs", "/home/kennedy/ankaa/test-examples", "/var/log/nginx", "/var/www"],
      low: ["/home/kennedy/ankaa/node_modules", "/home/kennedy/ankaa/.git", "/tmp"],
    };

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
        console.error("Invalid time format:", time);
        return "0 23 * * *"; // Default to 23:00 daily
      }

      const parts = timeString.split(":").map(Number);
      hours = parts[0];
      minutes = parts[1];
    }

    // Validate hours and minutes
    if (isNaN(hours) || isNaN(minutes) || hours < 0 || hours > 23 || minutes < 0 || minutes > 59) {
      console.error("Invalid time values:", { hours, minutes });
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

  // Get list of WebDAV folders available for backup
  async getWebDAVFolders(): Promise<string[]> {
    const response = await this.api.get<{ success: boolean; data: string[]; message: string }>("/backups/webdav-folders");
    return response.data.data || [];
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
