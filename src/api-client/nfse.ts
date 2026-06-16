import { apiClient } from './axiosClient';

export const nfseService = {
  list: (params?: {
    dataEmissaoInicial?: string;
    dataEmissaoFinal?: string;
    situacao?: number;
    cpfCnpj?: string;
    numeroDocumentoInicial?: number;
    numeroDocumentoFinal?: number;
    page?: number;
    limit?: number;
  }) => apiClient.get('/nfse', { params }),

  detail: (elotechNfseId: number) =>
    apiClient.get(`/nfse/${elotechNfseId}`),

  getPdf: (elotechNfseId: number) =>
    apiClient.get(`/nfse/${elotechNfseId}/pdf`, { responseType: 'blob' }),

  // Current cancellation-request status + timeline at the prefeitura
  getCancellationStatus: (elotechNfseId: number) =>
    apiClient.get(`/nfse/${elotechNfseId}/cancellation`),

  // Cancel an NFS-e by its local document id — works for ANY note (incl. invoice-less orphans).
  // Registers an async cancellation request at the prefeitura (AGUARDANDO_FISCAL).
  cancelByDocument: (
    nfseDocumentId: string,
    data: { reason: string; reasonCode: number; substituteNfseNumber?: number },
  ) => apiClient.put(`/nfse/document/${nfseDocumentId}/cancel`, data),
};
