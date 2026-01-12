import { apiClient } from './axiosClient';
import type { TaskPricing } from '@/types/task-pricing';

export const taskPricingService = {
  // Get all pricings
  getAll: (params?: any) => apiClient.get('/task-pricings', { params }),

  // Get by ID
  getById: (id: string) => apiClient.get(`/task-pricings/${id}`),

  // Get by task ID
  getByTaskId: (taskId: string) => apiClient.get(`/task-pricings/task/${taskId}`),

  // Create
  create: (data: any) => apiClient.post('/task-pricings', data),

  // Update
  update: (id: string, data: any) => apiClient.put(`/task-pricings/${id}`, data),

  // Update status
  updateStatus: (id: string, status: string, reason?: string) =>
    apiClient.put(`/task-pricings/${id}/status`, { status, reason }),

  // Approve
  approve: (id: string) => apiClient.put(`/task-pricings/${id}/approve`),

  // Reject
  reject: (id: string, reason?: string) =>
    apiClient.put(`/task-pricings/${id}/reject`, { reason }),

  // Cancel
  cancel: (id: string) => apiClient.put(`/task-pricings/${id}/cancel`),

  // Delete
  delete: (id: string) => apiClient.delete(`/task-pricings/${id}`),

  // Get expired
  getExpired: () => apiClient.get('/task-pricings/expired/list'),
};
