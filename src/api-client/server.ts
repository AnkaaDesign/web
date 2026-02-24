// packages/api-client/src/server.ts

import { apiClient } from "./axiosClient";
import type {
  // Schema types (for parameters)
  ServiceAction,
  ServiceLogsQuery,
  CreateUserFormData,
  SetUserPasswordFormData,
} from "../schemas";
import type {
  // Interface types (for responses)
  SystemServiceResponse,
  SystemMetricsResponse,
  SystemUsersResponse,
  SharedFoldersResponse,
  ServiceLogsResponse,
  SystemStatusResponse,
  CreateUserResponse,
  ActionResponse,
} from "../schemas";
import type { CpuTemperatureResponse, SsdHealthData } from "../types";

// =====================
// Server Service Class
// =====================

export class ServerService {
  private readonly basePath = "/server";

  // =====================
  // System Services Operations
  // =====================

  async getServices(): Promise<SystemServiceResponse> {
    const response = await apiClient.get<SystemServiceResponse>(`${this.basePath}/services`);
    return response.data;
  }

  async startService(data: ServiceAction): Promise<ActionResponse> {
    const response = await apiClient.post<ActionResponse>(`${this.basePath}/services/${data.serviceName}/start`);
    return response.data;
  }

  async stopService(data: ServiceAction): Promise<ActionResponse> {
    const response = await apiClient.post<ActionResponse>(`${this.basePath}/services/${data.serviceName}/stop`);
    return response.data;
  }

  async restartService(data: ServiceAction): Promise<ActionResponse> {
    const response = await apiClient.post<ActionResponse>(`${this.basePath}/services/${data.serviceName}/restart`);
    return response.data;
  }

  async getServiceLogs(serviceName: string, params?: ServiceLogsQuery): Promise<ServiceLogsResponse> {
    const response = await apiClient.get<ServiceLogsResponse>(`${this.basePath}/services/${serviceName}/logs`, {
      params,
    });
    return response.data;
  }

  // =====================
  // System Metrics Operations
  // =====================

  async getMetrics(): Promise<SystemMetricsResponse> {
    const response = await apiClient.get<SystemMetricsResponse>(`${this.basePath}/metrics`);
    return response.data;
  }

  async getCpuTemperature(): Promise<CpuTemperatureResponse> {
    const response = await apiClient.get<CpuTemperatureResponse>(`${this.basePath}/temperature`);
    return response.data;
  }

  async getSsdHealth(): Promise<{ success: boolean; message: string; data?: SsdHealthData[]; error?: string }> {
    const response = await apiClient.get<{ success: boolean; message: string; data?: SsdHealthData[]; error?: string }>(`${this.basePath}/ssd-health`);
    return response.data;
  }

  async getRaidStatus(): Promise<{ success: boolean; message: string; data?: any; error?: string }> {
    const response = await apiClient.get<{ success: boolean; message: string; data?: any; error?: string }>(`${this.basePath}/raid-status`);
    return response.data;
  }

  async refreshRaidStatus(): Promise<{ success: boolean; message: string; data?: any; error?: string }> {
    const response = await apiClient.post<{ success: boolean; message: string; data?: any; error?: string }>(`${this.basePath}/raid-status/refresh`);
    return response.data;
  }

  // =====================
  // System Status Operations
  // =====================

  async getStatus(): Promise<SystemStatusResponse> {
    const response = await apiClient.get<SystemStatusResponse>(`${this.basePath}/status`);
    return response.data;
  }

  // =====================
  // System Users Operations
  // =====================

  async getUsers(): Promise<SystemUsersResponse> {
    const response = await apiClient.get<SystemUsersResponse>(`${this.basePath}/users`);
    return response.data;
  }

  async createUser(data: CreateUserFormData): Promise<CreateUserResponse> {
    const response = await apiClient.post<CreateUserResponse>(`${this.basePath}/users`, data);
    return response.data;
  }

  async deleteUser(username: string): Promise<ActionResponse> {
    const response = await apiClient.delete<ActionResponse>(`${this.basePath}/users/${username}`);
    return response.data;
  }

  async setUserPassword(username: string, data: SetUserPasswordFormData): Promise<ActionResponse> {
    const response = await apiClient.put<ActionResponse>(`${this.basePath}/users/${username}/password`, data);
    return response.data;
  }

  // =====================
  // Shared Folders Operations
  // =====================

  async getSharedFolders(): Promise<SharedFoldersResponse> {
    const response = await apiClient.get<SharedFoldersResponse>(`${this.basePath}/shared-folders`);
    return response.data;
  }

  async getSharedFolderContents(
    folderName: string,
    subPath?: string,
  ): Promise<{
    success: boolean;
    message: string;
    data: {
      files: Array<{
        name: string;
        type: "file" | "directory";
        size: string;
        lastModified: Date;
        permissions: string;
        owner: string;
        group: string;
        remoteUrl?: string;
        fileCount?: number;
        folderCount?: number;
        // Database file fields (when matched)
        dbFileId?: string;
        dbFilePath?: string;
        dbThumbnailUrl?: string | null;
        dbMimeType?: string;
        dbFileSize?: number;
      }>;
      totalFiles: number;
      totalSize: string;
      parentPath?: string;
    };
  }> {
    const params = subPath ? { subPath } : {};
    const response = await apiClient.get(`${this.basePath}/shared-folders/${encodeURIComponent(folderName)}/contents`, { params });
    return response.data;
  }
}

// =====================
// Export service instance
// =====================

export const serverService = new ServerService();

// =====================
// Export individual functions
// =====================

// System Services
export const getSystemServices = () => serverService.getServices();
export const startSystemService = (data: ServiceAction) => serverService.startService(data);
export const stopSystemService = (data: ServiceAction) => serverService.stopService(data);
export const restartSystemService = (data: ServiceAction) => serverService.restartService(data);
export const getSystemServiceLogs = (serviceName: string, params?: ServiceLogsQuery) => serverService.getServiceLogs(serviceName, params);

// System Metrics
export const getSystemMetrics = () => serverService.getMetrics();
export const getCpuTemperature = () => serverService.getCpuTemperature();
export const getSsdHealth = () => serverService.getSsdHealth();
export const getRaidStatus = () => serverService.getRaidStatus();
export const refreshRaidStatus = () => serverService.refreshRaidStatus();

// System Status
export const getSystemStatus = () => serverService.getStatus();

// System Users
export const getSystemUsers = () => serverService.getUsers();
export const createSystemUser = (data: CreateUserFormData) => serverService.createUser(data);
export const deleteSystemUser = (username: string) => serverService.deleteUser(username);
export const setSystemUserPassword = (username: string, data: SetUserPasswordFormData) => serverService.setUserPassword(username, data);

// Shared Folders
export const getSharedFolders = () => serverService.getSharedFolders();
export const getSharedFolderContents = (folderName: string, subPath?: string) => serverService.getSharedFolderContents(folderName, subPath);
