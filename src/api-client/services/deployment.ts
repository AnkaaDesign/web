import { apiClient } from '../axiosClient';

// Import proper types from packages
import type {
  Deployment,
  DeploymentIncludes,
  DeploymentGetManyParams,
  DeploymentGetManyResponse,
  DeploymentGetByIdParams,
  DeploymentCreateResponse,
  DeploymentUpdateResponse,
  DeploymentDeleteResponse,
  DeploymentBatchResponse,
  GitCommitInfo,
  DeploymentGetUniqueResponse,
} from '../../types';

import type {
  DeploymentCreateFormData,
  DeploymentUpdateFormData,
  DeploymentBatchCreateFormData,
  DeploymentBatchUpdateFormData,
  DeploymentBatchDeleteFormData,
} from '../../schemas';

import { DEPLOYMENT_ENVIRONMENT } from '../../constants';

export const deploymentService = {
  // Standard CRUD operations
  getMany: (params?: DeploymentGetManyParams) =>
    apiClient.get<DeploymentGetManyResponse>('/deployments', { params }),

  getById: (id: string, params?: DeploymentGetByIdParams) =>
    apiClient.get<Deployment>(`/deployments/${id}`, { params }),

  create: (data: DeploymentCreateFormData) =>
    apiClient.post<DeploymentCreateResponse>('/deployments', data),

  update: (id: string, data: DeploymentUpdateFormData) =>
    apiClient.put<DeploymentUpdateResponse>(`/deployments/${id}`, data),

  delete: (id: string) =>
    apiClient.delete<DeploymentDeleteResponse>(`/deployments/${id}`),

  // Batch operations
  batchCreate: (data: DeploymentBatchCreateFormData) =>
    apiClient.post<DeploymentBatchResponse>('/deployments/batch', data),

  batchUpdate: (data: DeploymentBatchUpdateFormData) =>
    apiClient.put<DeploymentBatchResponse>('/deployments/batch', data),

  batchDelete: (data: DeploymentBatchDeleteFormData) =>
    apiClient.delete<DeploymentBatchResponse>('/deployments/batch', { data }),

  // New deployment workflow operations
  createDeployment: (commitHash: string, environment: DEPLOYMENT_ENVIRONMENT) =>
    apiClient.post<DeploymentCreateResponse>(`/deployments/deploy/${commitHash}`, { environment }),

  getCurrentDeployment: (environment: DEPLOYMENT_ENVIRONMENT, params?: DeploymentGetByIdParams) =>
    apiClient.get<DeploymentGetUniqueResponse>(`/deployments/current/${environment}`, { params }),

  getAvailableCommits: (limit?: number) =>
    apiClient.get<{ success: boolean; message: string; data: GitCommitInfo[] }>('/deployments/commits/list', {
      params: { limit },
    }),

  cancelDeployment: (id: string) =>
    apiClient.post<DeploymentUpdateResponse>(`/deployments/${id}/cancel`),

  streamLogs: (id: string) => {
    // Return an EventSource for SSE
    if (typeof window !== 'undefined') {
      return new EventSource(`${apiClient.defaults.baseURL}/deployments/${id}/logs`);
    }
    return null;
  },
};

// Export the types for use in hooks
export type {
  Deployment,
  DeploymentIncludes,
  DeploymentGetManyParams,
  DeploymentGetManyResponse,
  DeploymentGetByIdParams,
  DeploymentCreateResponse,
  DeploymentUpdateResponse,
  DeploymentDeleteResponse,
  DeploymentBatchResponse,
};

// Re-export form data types from schemas package
export type {
  DeploymentCreateFormData,
  DeploymentUpdateFormData,
  DeploymentBatchCreateFormData,
  DeploymentBatchUpdateFormData,
  DeploymentBatchDeleteFormData,
} from '../../schemas';
