// packages/api-client/src/airbrushing-nfse.ts
//
// NFS-e emitida para o AEROGRAFISTA (prestador MEI) a cada aerografia concluída.
// Rotas aninhadas em /airbrushings/:id — separadas de `airbrushing.ts` porque são
// um recurso fiscal próprio, com ciclo de vida (emitir / cancelar) independente do
// CRUD da aerografia. Nenhuma delas aceita query params.

import { apiClient } from "./axiosClient";
import type {
  AirbrushingNfseGetResponse,
  AirbrushingNfseXmlResponse,
  AirbrushingNfseEmitResponse,
  AirbrushingNfseCancelResponse,
} from "../types";

// =====================
// Form Data Types
// =====================

/** Corpo do PUT /airbrushings/:id/nfse/cancel. A justificativa exige 15+ caracteres. */
export interface AirbrushingNfseCancelData {
  reasonCode: number;
  reason: string;
}

// =====================
// Airbrushing NFS-e Service Class
// =====================

export class AirbrushingNfseService {
  private readonly basePath = "/airbrushings";

  // =====================
  // Query Operations
  // =====================

  /** A nota da aerografia, ou `null` quando nenhuma foi emitida ainda. */
  async getAirbrushingNfse(airbrushingId: string): Promise<AirbrushingNfseGetResponse> {
    const response = await apiClient.get<AirbrushingNfseGetResponse>(`${this.basePath}/${airbrushingId}/nfse`);
    return response.data;
  }

  /** XML autorizado (string) + chave de acesso — o download é montado no cliente. */
  async getAirbrushingNfseXml(airbrushingId: string): Promise<AirbrushingNfseXmlResponse> {
    const response = await apiClient.get<AirbrushingNfseXmlResponse>(`${this.basePath}/${airbrushingId}/nfse/xml`);
    return response.data;
  }

  // =====================
  // Mutation Operations
  // =====================

  /** (Re)emite a nota. Também é o caminho de retentativa quando o status é ERROR. */
  async emitAirbrushingNfse(airbrushingId: string): Promise<AirbrushingNfseEmitResponse> {
    const response = await apiClient.post<AirbrushingNfseEmitResponse>(`${this.basePath}/${airbrushingId}/nfse/emit`);
    return response.data;
  }

  async cancelAirbrushingNfse(airbrushingId: string, data: AirbrushingNfseCancelData): Promise<AirbrushingNfseCancelResponse> {
    const response = await apiClient.put<AirbrushingNfseCancelResponse>(`${this.basePath}/${airbrushingId}/nfse/cancel`, data);
    return response.data;
  }
}

// =====================
// Export service instance
// =====================

export const airbrushingNfseService = new AirbrushingNfseService();

// =====================
// Export individual functions
// =====================

// Query Operations
export const getAirbrushingNfse = (airbrushingId: string) => airbrushingNfseService.getAirbrushingNfse(airbrushingId);
export const getAirbrushingNfseXml = (airbrushingId: string) => airbrushingNfseService.getAirbrushingNfseXml(airbrushingId);

// Mutation Operations
export const emitAirbrushingNfse = (airbrushingId: string) => airbrushingNfseService.emitAirbrushingNfse(airbrushingId);
export const cancelAirbrushingNfse = (airbrushingId: string, data: AirbrushingNfseCancelData) => airbrushingNfseService.cancelAirbrushingNfse(airbrushingId, data);
