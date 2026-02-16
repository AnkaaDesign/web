// packages/hooks/src/deployment.ts

import { deploymentService } from "../../api-client";
import { deploymentKeys } from "../common/query-keys";
import { createEntityHooks } from "../common/create-entity-hooks";

// Import proper types from packages
import type {
  Deployment,
  DeploymentIncludes,
  DeploymentGetManyParams,
  DeploymentGetManyResponse,
  DeploymentGetByIdParams,
} from "../../types";

import type {
  DeploymentCreateFormData,
  DeploymentUpdateFormData,
  DeploymentBatchCreateFormData,
  DeploymentBatchUpdateFormData,
  DeploymentBatchDeleteFormData,
} from "../../schemas";

// =====================================================
// Re-export types for convenience
// =====================================================

export type {
  Deployment,
  DeploymentIncludes as DeploymentInclude,
  DeploymentGetManyParams,
  DeploymentCreateFormData,
  DeploymentUpdateFormData,
  DeploymentBatchCreateFormData,
  DeploymentBatchUpdateFormData,
  DeploymentBatchDeleteFormData,
};

// =====================================================
// Service Adapter for Entity Factory
// =====================================================

const deploymentServiceAdapter = {
  getMany: (params?: DeploymentGetManyParams) =>
    deploymentService.getMany(params).then(response => response.data),
  getById: (id: string, params?: DeploymentGetByIdParams) =>
    deploymentService.getById(id, params).then(response => response.data),
  create: (data: DeploymentCreateFormData) =>
    deploymentService.create(data).then(response => {
      const result = response.data;
      return (result as any).data || result;
    }),
  update: (id: string, data: DeploymentUpdateFormData) =>
    deploymentService.update(id, data).then(response => {
      const result = response.data;
      return (result as any).data || result;
    }),
  delete: (id: string) =>
    deploymentService.delete(id).then(() => undefined),
  batchCreate: (data: DeploymentBatchCreateFormData) =>
    deploymentService.batchCreate(data).then(response => response.data),
  batchUpdate: (data: DeploymentBatchUpdateFormData) =>
    deploymentService.batchUpdate(data).then(response => response.data),
  batchDelete: (data: DeploymentBatchDeleteFormData) =>
    deploymentService.batchDelete(data).then(() => undefined),
};

// =====================================================
// Base Deployment Hooks using Entity Factory
// =====================================================

const baseHooks = createEntityHooks<
  DeploymentGetManyParams,
  DeploymentGetManyResponse,
  Deployment,
  DeploymentCreateFormData,
  Deployment,
  DeploymentUpdateFormData,
  Deployment,
  void, // Delete response
  DeploymentBatchCreateFormData,
  any, // Batch create response
  DeploymentBatchUpdateFormData,
  any, // Batch update response
  DeploymentBatchDeleteFormData,
  void
>({
  queryKeys: deploymentKeys,
  service: deploymentServiceAdapter,
  staleTime: 1000 * 60 * 5, // 5 minutes
  relatedQueryKeys: [],
});

// Export base hooks with standard names
export const useDeploymentsInfinite = baseHooks.useInfiniteList;
export const useDeployments = baseHooks.useList;
export const useDeploymentDetail = baseHooks.useDetail;

// Export base mutations (create, update, delete)
export const useDeploymentMutations = baseHooks.useMutations;

export const useDeploymentBatchMutations = baseHooks.useBatchMutations;

// =====================================================
// Custom Deployment Workflow Hooks
// =====================================================

import { useQuery, useMutation, useQueryClient, type UseQueryOptions } from '@tanstack/react-query';
import { DEPLOYMENT_ENVIRONMENT } from '../../constants';
import type { GitCommitInfo, DeploymentGetUniqueResponse } from '../../types';

/**
 * Hook to get available commits for deployment
 */
export function useAvailableCommits(
  limit?: number,
  options?: Omit<UseQueryOptions<{ success: boolean; message: string; data: GitCommitInfo[] }>, 'queryKey' | 'queryFn'>,
) {
  return useQuery({
    queryKey: deploymentKeys.commits(limit),
    queryFn: () => deploymentService.getAvailableCommits(limit).then(res => res.data),
    staleTime: 1000 * 60, // 1 minute
    ...options,
  });
}

/**
 * Hook to get current deployment for an environment and application
 */
export function useCurrentDeployment(
  environment: DEPLOYMENT_ENVIRONMENT,
  options?: Omit<UseQueryOptions<DeploymentGetUniqueResponse>, 'queryKey' | 'queryFn'>,
  application: string = 'WEB',
) {
  return useQuery({
    queryKey: deploymentKeys.current(application, environment),
    queryFn: () => deploymentService.getCurrentDeployment(application, environment).then(res => res.data),
    staleTime: 1000 * 30, // 30 seconds
    refetchInterval: 1000 * 30, // Refetch every 30 seconds
    ...options,
  });
}

/**
 * Hook to create a new deployment
 */
export function useCreateDeployment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ commitHash, environment, application = 'WEB' }: { commitHash: string; environment: DEPLOYMENT_ENVIRONMENT; application?: string }) =>
      deploymentService.createDeployment(commitHash, environment, application).then(res => res.data),
    onSuccess: () => {
      // Invalidate all deployment queries
      queryClient.invalidateQueries({ queryKey: deploymentKeys.all });
    },
  });
}

/**
 * Hook to cancel a deployment
 */
export function useCancelDeployment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (deploymentId: string) =>
      deploymentService.cancelDeployment(deploymentId).then(res => res.data),
    onSuccess: () => {
      // Invalidate deployment queries
      queryClient.invalidateQueries({ queryKey: deploymentKeys.all });
    },
  });
}

/**
 * Hook to stream deployment logs using SSE
 * Returns an EventSource that can be used to listen for log events
 */
export function useDeploymentLogs(deploymentId: string | null) {
  const [logs, setLogs] = React.useState<string[]>([]);
  const [isConnected, setIsConnected] = React.useState(false);
  const eventSourceRef = React.useRef<EventSource | null>(null);

  React.useEffect(() => {
    if (!deploymentId) {
      return;
    }

    const eventSource = deploymentService.streamLogs(deploymentId);

    if (!eventSource) {
      return;
    }

    eventSource.onopen = () => {
      setIsConnected(true);
    };

    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        setLogs((prev) => [...prev, data.message || event.data]);
      } catch {
        setLogs((prev) => [...prev, event.data]);
      }
    };

    eventSource.onerror = () => {
      setIsConnected(false);
      eventSource.close();
    };

    eventSourceRef.current = eventSource;

    return () => {
      eventSource.close();
      setIsConnected(false);
    };
  }, [deploymentId]);

  const clearLogs = React.useCallback(() => {
    setLogs([]);
  }, []);

  return {
    logs,
    isConnected,
    clearLogs,
  };
}

// Re-import React for hooks
import * as React from 'react';
