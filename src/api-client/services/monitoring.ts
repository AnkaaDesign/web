// packages/api-client/src/services/monitoring.ts

import { apiClient } from "../axiosClient";
import type {
  // Response types from the monitoring module
  SsdHealthDataGetUniqueResponse,
  SsdHealthDataGetManyResponse,
  RaidStatusGetUniqueResponse,
  RaidStatusGetManyResponse,
  BackupMetadataGetUniqueResponse,
  BackupMetadataGetManyResponse,
  WebDavInfoGetUniqueResponse,
  WebDavInfoGetManyResponse,
  SystemMetricsGetUniqueResponse,
  // @ts-ignore - This type is used in return types
  SystemMetricsGetManyResponse,
  SystemHealthGetUniqueResponse,
  SystemHealthGetManyResponse,
  SystemServicesResponse,
  SystemUsersResponse,
  SharedFoldersResponse,
  ServiceLogsResponse,
  ServiceActionResponse,
  CreateUserRequest,
  CreateUserResponse,
  SetPasswordRequest,

  // Entity types
  // @ts-ignore - These types are used in return types
  SsdHealthData,
  // @ts-ignore - These types are used in return types
  RaidStatus,
  // @ts-ignore - These types are used in return types
  BackupMetadata,
  // @ts-ignore - These types are used in return types
  WebDavInfo,
  // @ts-ignore - These types are used in return types
  SystemMetrics,
  // @ts-ignore - These types are used in return types
  SystemHealth,
} from "../../types";

// =====================
// SSD Health Service
// =====================

export class SsdHealthService {
  private readonly basePath = "/monitoring/ssd";

  async getSsdHealthData(): Promise<SsdHealthDataGetManyResponse> {
    const response = await apiClient.get<SsdHealthDataGetManyResponse>(this.basePath);
    return response.data;
  }

  async getSsdHealthDataById(id: string): Promise<SsdHealthDataGetUniqueResponse> {
    const response = await apiClient.get<SsdHealthDataGetUniqueResponse>(`${this.basePath}/${id}`);
    return response.data;
  }

  async refreshSsdHealthData(): Promise<SsdHealthDataGetManyResponse> {
    const response = await apiClient.post<SsdHealthDataGetManyResponse>(`${this.basePath}/refresh`);
    return response.data;
  }
}

// =====================
// RAID Status Service
// =====================

export class RaidStatusService {
  private readonly basePath = "/monitoring/raid";

  async getRaidStatus(): Promise<RaidStatusGetManyResponse> {
    const response = await apiClient.get<RaidStatusGetManyResponse>(this.basePath);
    return response.data;
  }

  async getRaidStatusById(id: string): Promise<RaidStatusGetUniqueResponse> {
    const response = await apiClient.get<RaidStatusGetUniqueResponse>(`${this.basePath}/${id}`);
    return response.data;
  }

  async refreshRaidStatus(): Promise<RaidStatusGetManyResponse> {
    const response = await apiClient.post<RaidStatusGetManyResponse>(`${this.basePath}/refresh`);
    return response.data;
  }
}

// =====================
// Backup Metadata Service
// =====================

export class BackupService {
  private readonly basePath = "/monitoring/backup";

  async getBackupMetadata(): Promise<BackupMetadataGetManyResponse> {
    const response = await apiClient.get<BackupMetadataGetManyResponse>(this.basePath);
    return response.data;
  }

  async getBackupMetadataById(id: string): Promise<BackupMetadataGetUniqueResponse> {
    const response = await apiClient.get<BackupMetadataGetUniqueResponse>(`${this.basePath}/${id}`);
    return response.data;
  }

  async refreshBackupMetadata(): Promise<BackupMetadataGetManyResponse> {
    const response = await apiClient.post<BackupMetadataGetManyResponse>(`${this.basePath}/refresh`);
    return response.data;
  }

  async startBackupJob(jobId: string): Promise<ServiceActionResponse> {
    const response = await apiClient.post<ServiceActionResponse>(`${this.basePath}/jobs/${jobId}/start`);
    return response.data;
  }

  async stopBackupJob(jobId: string): Promise<ServiceActionResponse> {
    const response = await apiClient.post<ServiceActionResponse>(`${this.basePath}/jobs/${jobId}/stop`);
    return response.data;
  }

  async pauseBackupJob(jobId: string): Promise<ServiceActionResponse> {
    const response = await apiClient.post<ServiceActionResponse>(`${this.basePath}/jobs/${jobId}/pause`);
    return response.data;
  }

  async resumeBackupJob(jobId: string): Promise<ServiceActionResponse> {
    const response = await apiClient.post<ServiceActionResponse>(`${this.basePath}/jobs/${jobId}/resume`);
    return response.data;
  }
}

// =====================
// WebDAV Service
// =====================

export class WebDavService {
  private readonly basePath = "/monitoring/webdav";

  async getWebDavInfo(): Promise<WebDavInfoGetManyResponse> {
    const response = await apiClient.get<WebDavInfoGetManyResponse>(this.basePath);
    return response.data;
  }

  async getWebDavInfoById(id: string): Promise<WebDavInfoGetUniqueResponse> {
    const response = await apiClient.get<WebDavInfoGetUniqueResponse>(`${this.basePath}/${id}`);
    return response.data;
  }

  async refreshWebDavInfo(): Promise<WebDavInfoGetManyResponse> {
    const response = await apiClient.post<WebDavInfoGetManyResponse>(`${this.basePath}/refresh`);
    return response.data;
  }

  async syncWebDavFolder(id: string, folderPath: string): Promise<ServiceActionResponse> {
    const response = await apiClient.post<ServiceActionResponse>(`${this.basePath}/${id}/sync`, {
      folderPath,
    });
    return response.data;
  }
}

// =====================
// Server Monitoring Service (existing endpoints)
// =====================

export class ServerMonitoringService {
  private readonly basePath = "/server";

  // =====================
  // System Services
  // =====================

  async getServices(): Promise<SystemServicesResponse> {
    const response = await apiClient.get<SystemServicesResponse>(`${this.basePath}/services`);
    return response.data;
  }

  async restartService(serviceName: string): Promise<ServiceActionResponse> {
    const response = await apiClient.post<ServiceActionResponse>(`${this.basePath}/services/${serviceName}/restart`);
    return response.data;
  }

  async startService(serviceName: string): Promise<ServiceActionResponse> {
    const response = await apiClient.post<ServiceActionResponse>(`${this.basePath}/services/${serviceName}/start`);
    return response.data;
  }

  async stopService(serviceName: string): Promise<ServiceActionResponse> {
    const response = await apiClient.post<ServiceActionResponse>(`${this.basePath}/services/${serviceName}/stop`);
    return response.data;
  }

  async getServiceLogs(serviceName: string, lines?: number): Promise<ServiceLogsResponse> {
    const params = lines ? { lines: lines.toString() } : undefined;
    const response = await apiClient.get<ServiceLogsResponse>(`${this.basePath}/services/${serviceName}/logs`, {
      params,
    });
    return response.data;
  }

  // =====================
  // System Metrics
  // =====================

  async getMetrics(): Promise<SystemMetricsGetUniqueResponse> {
    const response = await apiClient.get<SystemMetricsGetUniqueResponse>(`${this.basePath}/metrics`);
    return response.data;
  }

  // =====================
  // System Users
  // =====================

  async getUsers(): Promise<SystemUsersResponse> {
    const response = await apiClient.get<SystemUsersResponse>(`${this.basePath}/users`);
    return response.data;
  }

  async createUser(userData: CreateUserRequest): Promise<CreateUserResponse> {
    const response = await apiClient.post<CreateUserResponse>(`${this.basePath}/users`, userData);
    return response.data;
  }

  async setUserPassword(username: string, passwordData: SetPasswordRequest): Promise<ServiceActionResponse> {
    const response = await apiClient.post<ServiceActionResponse>(`${this.basePath}/users/${username}/password`, passwordData);
    return response.data;
  }

  // =====================
  // Shared Folders
  // =====================

  async getSharedFolders(): Promise<SharedFoldersResponse> {
    const response = await apiClient.get<SharedFoldersResponse>(`${this.basePath}/shared-folders`);
    return response.data;
  }

  // =====================
  // System Status (comprehensive overview)
  // =====================

  async getSystemStatus(): Promise<SystemHealthGetUniqueResponse> {
    const response = await apiClient.get<SystemHealthGetUniqueResponse>(`${this.basePath}/status`);
    return response.data;
  }

  // =====================
  // Hardware Monitoring
  // =====================

  async getRaidStatus(): Promise<ServiceActionResponse & { data?: any }> {
    const response = await apiClient.get<ServiceActionResponse & { data?: any }>(`${this.basePath}/raid-status`);
    return response.data;
  }

  async getRaidStatusById(arrayName: string): Promise<ServiceActionResponse & { data?: any }> {
    const response = await apiClient.get<ServiceActionResponse & { data?: any }>(`${this.basePath}/raid-status/${arrayName}`);
    return response.data;
  }

  async refreshRaidStatus(): Promise<ServiceActionResponse & { data?: any }> {
    const response = await apiClient.post<ServiceActionResponse & { data?: any }>(`${this.basePath}/raid-status/refresh`);
    return response.data;
  }

  async refreshSsdHealth(): Promise<ServiceActionResponse & { data?: any }> {
    const response = await apiClient.post<ServiceActionResponse & { data?: any }>(`${this.basePath}/ssd-health/refresh`);
    return response.data;
  }
}

// =====================
// System Health Service (comprehensive monitoring)
// =====================

export class SystemHealthService {
  private readonly basePath = "/monitoring/health";

  async getSystemHealth(): Promise<SystemHealthGetUniqueResponse> {
    const response = await apiClient.get<SystemHealthGetUniqueResponse>(this.basePath);
    return response.data;
  }

  async refreshSystemHealth(): Promise<SystemHealthGetUniqueResponse> {
    const response = await apiClient.post<SystemHealthGetUniqueResponse>(`${this.basePath}/refresh`);
    return response.data;
  }

  async getHealthHistory(hours: number = 24): Promise<SystemHealthGetManyResponse> {
    const response = await apiClient.get<SystemHealthGetManyResponse>(`${this.basePath}/history`, {
      params: { hours },
    });
    return response.data;
  }
}

// =====================
// Export service instances
// =====================

export const ssdHealthService = new SsdHealthService();
export const raidStatusService = new RaidStatusService();
export const backupService = new BackupService();
export const webDavService = new WebDavService();
export const serverMonitoringService = new ServerMonitoringService();
export const systemHealthService = new SystemHealthService();

// =====================
// Export individual functions for SSD Health
// =====================

export const getSsdHealthData = () => ssdHealthService.getSsdHealthData();
export const getSsdHealthDataById = (id: string) => ssdHealthService.getSsdHealthDataById(id);
export const refreshSsdHealthData = () => ssdHealthService.refreshSsdHealthData();

// =====================
// Export individual functions for RAID Status
// =====================

export const getRaidStatus = () => raidStatusService.getRaidStatus();
export const getRaidStatusById = (id: string) => raidStatusService.getRaidStatusById(id);
export const refreshRaidStatus = () => raidStatusService.refreshRaidStatus();

// =====================
// Export individual functions for Backup
// =====================

export const getBackupMetadata = () => backupService.getBackupMetadata();
export const getBackupMetadataById = (id: string) => backupService.getBackupMetadataById(id);
export const refreshBackupMetadata = () => backupService.refreshBackupMetadata();
export const startBackupJob = (jobId: string) => backupService.startBackupJob(jobId);
export const stopBackupJob = (jobId: string) => backupService.stopBackupJob(jobId);
export const pauseBackupJob = (jobId: string) => backupService.pauseBackupJob(jobId);
export const resumeBackupJob = (jobId: string) => backupService.resumeBackupJob(jobId);

// =====================
// Export individual functions for WebDAV
// =====================

export const getWebDavInfo = () => webDavService.getWebDavInfo();
export const getWebDavInfoById = (id: string) => webDavService.getWebDavInfoById(id);
export const refreshWebDavInfo = () => webDavService.refreshWebDavInfo();
export const syncWebDavFolder = (id: string, folderPath: string) => webDavService.syncWebDavFolder(id, folderPath);

// =====================
// Export individual functions for Server Monitoring
// =====================

export const getServices = () => serverMonitoringService.getServices();
export const restartService = (serviceName: string) => serverMonitoringService.restartService(serviceName);
export const startService = (serviceName: string) => serverMonitoringService.startService(serviceName);
export const stopService = (serviceName: string) => serverMonitoringService.stopService(serviceName);
export const getServiceLogs = (serviceName: string, lines?: number) => serverMonitoringService.getServiceLogs(serviceName, lines);
export const getMetrics = () => serverMonitoringService.getMetrics();
export const getSystemUsers = () => serverMonitoringService.getUsers();
export const createSystemUser = (userData: CreateUserRequest) => serverMonitoringService.createUser(userData);
export const setSystemUserPassword = (username: string, passwordData: SetPasswordRequest) => serverMonitoringService.setUserPassword(username, passwordData);
export const getSharedFolders = () => serverMonitoringService.getSharedFolders();
export const getSystemStatus = () => serverMonitoringService.getSystemStatus();

// =====================
// Export individual functions for System Health
// =====================

export const getSystemHealth = () => systemHealthService.getSystemHealth();
export const refreshSystemHealth = () => systemHealthService.refreshSystemHealth();
export const getHealthHistory = (hours: number = 24) => systemHealthService.getHealthHistory(hours);

// =====================
// Export individual functions for Server Hardware Monitoring
// =====================

export const getServerRaidStatus = () => serverMonitoringService.getRaidStatus();
export const getServerRaidStatusById = (arrayName: string) => serverMonitoringService.getRaidStatusById(arrayName);
export const refreshServerRaidStatus = () => serverMonitoringService.refreshRaidStatus();
export const refreshSsdHealth = () => serverMonitoringService.refreshSsdHealth();
