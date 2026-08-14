// packages/api-client/src/fiscal-emitter.ts
//
// Identidade fiscal do PRESTADOR (o aerografista MEI) + o certificado A1 com o qual
// a NFS-e nacional é assinada. Nenhuma rota daqui aceita query params — não há
// `params` para o paramsSerializer serializar, então o cuidado com objetos aninhados
// (que viram string e derrubam a validação do servidor) não se aplica aqui.

import { apiClient } from "./axiosClient";
import type {
  FiscalEmitterGetResponse,
  FiscalEmitterProfileResponse,
  FiscalCertificateResponse,
  FiscalCertificateGetManyResponse,
} from "../types";

// =====================
// Form Data Types
// =====================

/**
 * Corpo do PUT /fiscal-emitters/:userId (upsert do perfil). Campos planos apenas.
 * `cTribNac`, `serviceDescription` e `serie` têm DEFAULT no banco e não aceitam null —
 * omita a chave em vez de mandar null quando o campo vier vazio do formulário.
 */
export interface FiscalEmitterUpsertData {
  cnpj: string;
  corporateName: string;
  tradeName?: string | null;
  municipalRegistration?: string | null;
  municipalityIbgeCode: string;
  opSimpNac?: number;
  regEspTrib?: number;
  cTribNac?: string;
  cTribMun?: string | null;
  serviceDescription?: string;
  serie?: string;
  environment?: number;
  emissionEnabled?: boolean;
}

// =====================
// Fiscal Emitter Service Class
// =====================

export class FiscalEmitterService {
  private readonly basePath = "/fiscal-emitters";
  /** O revoke mora fora do escopo do usuário — a rota é do próprio certificado. */
  private readonly certificatePath = "/fiscal-certificates";

  // =====================
  // Query Operations
  // =====================

  /** Perfil + certificado ativo + sugestão de preenchimento (quando ainda não há perfil). */
  async getFiscalEmitter(userId: string): Promise<FiscalEmitterGetResponse> {
    const response = await apiClient.get<FiscalEmitterGetResponse>(`${this.basePath}/${userId}`);
    return response.data;
  }

  async getFiscalCertificates(userId: string): Promise<FiscalCertificateGetManyResponse> {
    const response = await apiClient.get<FiscalCertificateGetManyResponse>(`${this.basePath}/${userId}/certificates`);
    return response.data;
  }

  // =====================
  // Mutation Operations
  // =====================

  async upsertFiscalEmitter(userId: string, data: FiscalEmitterUpsertData): Promise<FiscalEmitterProfileResponse> {
    const response = await apiClient.put<FiscalEmitterProfileResponse>(`${this.basePath}/${userId}`, data);
    return response.data;
  }

  /** Liga/desliga a emissão automática sem tocar no resto do perfil. */
  async setEmissionEnabled(userId: string, enabled: boolean): Promise<FiscalEmitterProfileResponse> {
    const response = await apiClient.put<FiscalEmitterProfileResponse>(`${this.basePath}/${userId}/emission`, { enabled });
    return response.data;
  }

  /**
   * Envia o .pfx/.p12 + senha. Multipart obrigatório: o binário do certificado nunca
   * trafega em JSON. A senha é guardada cifrada no servidor e NUNCA é devolvida.
   */
  async uploadFiscalCertificate(userId: string, file: File, password: string): Promise<FiscalCertificateResponse> {
    const formData = new FormData();
    formData.append("certificate", file);
    formData.append("password", password);

    const response = await apiClient.post<FiscalCertificateResponse>(`${this.basePath}/${userId}/certificate`, formData, {
      headers: { "Content-Type": "multipart/form-data" },
    });
    return response.data;
  }

  async revokeFiscalCertificate(certificateId: string): Promise<FiscalCertificateResponse> {
    const response = await apiClient.delete<FiscalCertificateResponse>(`${this.certificatePath}/${certificateId}`);
    return response.data;
  }
}

// =====================
// Export service instance
// =====================

export const fiscalEmitterService = new FiscalEmitterService();

// =====================
// Export individual functions
// =====================

// Query Operations
export const getFiscalEmitter = (userId: string) => fiscalEmitterService.getFiscalEmitter(userId);
export const getFiscalCertificates = (userId: string) => fiscalEmitterService.getFiscalCertificates(userId);

// Mutation Operations
export const upsertFiscalEmitter = (userId: string, data: FiscalEmitterUpsertData) => fiscalEmitterService.upsertFiscalEmitter(userId, data);
export const setFiscalEmissionEnabled = (userId: string, enabled: boolean) => fiscalEmitterService.setEmissionEnabled(userId, enabled);
export const uploadFiscalCertificate = (userId: string, file: File, password: string) => fiscalEmitterService.uploadFiscalCertificate(userId, file, password);
export const revokeFiscalCertificate = (certificateId: string) => fiscalEmitterService.revokeFiscalCertificate(certificateId);
