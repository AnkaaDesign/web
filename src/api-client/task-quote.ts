import { apiClient } from './axiosClient';

export const taskQuoteService = {
  // Get all quotes
  getAll: (params?: any) => apiClient.get('/task-quotes', { params }),

  // Get by ID
  getById: (id: string) => apiClient.get(`/task-quotes/${id}`),

  // Get by task ID
  getByTaskId: (taskId: string) => apiClient.get(`/task-quotes/task/${taskId}`),

  // Create
  create: (data: any) => apiClient.post('/task-quotes', data),

  // Update
  update: (id: string, data: any) => apiClient.put(`/task-quotes/${id}`, data),

  // Update status
  updateStatus: (id: string, status: string, reason?: string) =>
    apiClient.put(`/task-quotes/${id}/status`, { status, reason }),

  // Approve
  approve: (id: string) => apiClient.put(`/task-quotes/${id}/approve`),

  // Reject
  reject: (id: string, reason?: string) =>
    apiClient.put(`/task-quotes/${id}/reject`, { reason }),

  // Cancel
  cancel: (id: string) => apiClient.put(`/task-quotes/${id}/cancel`),

  // Delete
  delete: (id: string) => apiClient.delete(`/task-quotes/${id}`),

  // Get expired
  getExpired: () => apiClient.get('/task-quotes/expired/list'),

  // Get suggestion based on matching task fields
  getSuggestion: (params: { name: string; customerId: string; category: string; implementType: string }) =>
    apiClient.get('/task-quotes/suggest', { params }),

  // =====================
  // PUBLIC ENDPOINTS (No Authentication Required)
  // =====================

  // Get quote for public view (customer budget page)
  getPublic: (id: string) => apiClient.get(`/task-quotes/public/${id}`),

  // Upload customer signature (public)
  uploadPublicSignature: (id: string, file: File) => {
    const formData = new FormData();
    formData.append('signature', file);
    return apiClient.post(`/task-quotes/public/${id}/signature`, formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
  },
};
