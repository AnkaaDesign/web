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

  getPdfUrl: (elotechNfseId: number) =>
    `/nfse/${elotechNfseId}/pdf`,
};
