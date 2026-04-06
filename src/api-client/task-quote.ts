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

  // Budget Approve (customer approved the budget: PENDING → BUDGET_APPROVED)
  approve: (id: string) => apiClient.put(`/task-quotes/${id}/budget-approve`),

  // Budget Approve (alias)
  budgetApprove: (id: string) => apiClient.put(`/task-quotes/${id}/budget-approve`),

  // Verify (financial verifies: BUDGET_APPROVED → VERIFIED_BY_FINANCIAL)
  verify: (id: string) => apiClient.put(`/task-quotes/${id}/verify`),

  // Internal Approve (final approval: VERIFIED_BY_FINANCIAL → BILLING_APPROVED)
  internalApprove: (id: string) => apiClient.put(`/task-quotes/${id}/internal-approve`),

  // Reject (sends back to PENDING with a reason)
  reject: (id: string, reason?: string) =>
    apiClient.put(`/task-quotes/${id}/status`, { status: 'PENDING', reason }),

  // Cancel (sends back to PENDING)
  cancel: (id: string) => apiClient.put(`/task-quotes/${id}/status`, { status: 'PENDING' }),

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
