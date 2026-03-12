import { apiClient } from './axiosClient';

export const invoiceService = {
  // Get all invoices
  getAll: (params?: any) => apiClient.get('/invoices', { params }),

  // Get by ID with full includes
  getById: (id: string) =>
    apiClient.get(`/invoices/${id}`, {
      params: {
        include: {
          installments: { include: { bankSlip: { include: { pdfFile: true } } } },
          nfseDocuments: true,
          customer: true,
          task: true,
        },
      },
    }),

  // Get invoices by task ID
  getByTaskId: (taskId: string) =>
    apiClient.get(`/invoices/task/${taskId}`, {
      params: {
        include: {
          installments: { include: { bankSlip: { include: { pdfFile: true } } } },
          nfseDocuments: true,
          customer: true,
        },
      },
    }),

  // Get invoices by customer ID
  getByCustomerId: (customerId: string) =>
    apiClient.get(`/invoices/customer/${customerId}`),

  // Cancel invoice
  cancel: (id: string, data?: any) =>
    apiClient.put(`/invoices/${id}/cancel`, data),

  // Regenerate boleto for installment
  regenerateBoleto: (installmentId: string) =>
    apiClient.post(`/invoices/${installmentId}/boleto/regenerate`),

  // Cancel boleto for installment
  cancelBoleto: (installmentId: string, data?: any) =>
    apiClient.put(`/invoices/${installmentId}/boleto/cancel`, data),

  // Get boleto PDF
  getBoletoPdf: (installmentId: string) =>
    apiClient.get(`/invoices/${installmentId}/boleto/pdf`, { responseType: 'blob' }),

  // Emit NFS-e for invoice
  emitNfse: (invoiceId: string) =>
    apiClient.post(`/invoices/${invoiceId}/nfse/emit`),

  // Cancel NFS-e for invoice
  cancelNfse: (invoiceId: string, data: any) =>
    apiClient.put(`/invoices/${invoiceId}/nfse/cancel`, data),
};
