import { apiClient } from "./axiosClient";

export interface BackupMetadata {
  id: string;
  name: string;
  type: "database" | "files" | "full";
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
}

export interface CreateBackupRequest {
  name: string;
  type: "database" | "files" | "full";
  description?: string;
  paths?: string[];
  priority?: "low" | "medium" | "high" | "critical";
  raidAware?: boolean;
  compressionLevel?: number;
  encrypted?: boolean;
}

export interface ScheduleBackupRequest extends CreateBackupRequest {
  enabled: boolean;
  cron: string;
}

export interface BackupSystemHealth {
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

export interface BackupVerification {
  backupId: string;
  fileExists: boolean;
  archiveIntegrity: boolean;
  sizeMatch: boolean;
  verificationTime: string;
  details: string;
}

export interface ScheduledBackupJob {
  id: string;
  name: string;
  cron: string;
  next: number;
  jobName?: string; // Full job name for internal use
  key?: string; // Job key for deletion
}

export interface BackupQueryParams {
  type?: "database" | "files" | "full";
  status?: "pending" | "in_progress" | "completed" | "failed";
  limit?: number;
}

export interface SystemHealthSummary {
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
  generateCronExpression(frequency: "daily" | "weekly" | "monthly", time: string): string {
    const [hours, minutes] = time.split(":").map(Number);

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
    if (parts.length < 5) return "Invalid cron expression";

    const [minutes, hours, dayOfMonth, month, dayOfWeek] = parts;

    if (dayOfMonth === "*" && month === "*" && dayOfWeek === "*") {
      return `Daily at ${hours.padStart(2, "0")}:${minutes.padStart(2, "0")}`;
    }

    if (dayOfMonth === "*" && month === "*" && dayOfWeek !== "*") {
      const days = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
      const dayName = days[parseInt(dayOfWeek)] || `Day ${dayOfWeek}`;
      return `Weekly on ${dayName} at ${hours.padStart(2, "0")}:${minutes.padStart(2, "0")}`;
    }

    if (dayOfMonth !== "*" && month === "*") {
      return `Monthly on day ${dayOfMonth} at ${hours.padStart(2, "0")}:${minutes.padStart(2, "0")}`;
    }

    return `At ${hours.padStart(2, "0")}:${minutes.padStart(2, "0")} (${cron})`;
  }
}

export const backupApi = new BackupApiClient();
