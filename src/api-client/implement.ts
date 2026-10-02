import { apiClient } from "./axiosClient";
import type { Layout } from "../types/layout";

// =====================
// Garage Availability Types
// =====================

export interface SpotOccupant {
  spotNumber: 1 | 2 | 3;
  implementId: string;
  taskName: string | null;
  implementLength: number;
}

export interface LaneAvailability {
  laneId: 'F1' | 'F2' | 'F3';
  availableSpace: number;
  currentImplements: number;
  canFit: boolean;
  nextSpotNumber: 1 | 2 | 3 | null;
  occupiedSpots: (1 | 2 | 3)[];
  spotOccupants: SpotOccupant[];
}

export interface GarageAvailability {
  garageId: 'B1' | 'B2' | 'B3';
  totalSpots: number;
  occupiedSpots: number;
  canFit: boolean;
  lanes: LaneAvailability[];
}

export interface GaragesAvailabilityResponse {
  success: boolean;
  message: string;
  data: GarageAvailability[];
}

// =====================
// Garage Availability Operations
// =====================

export const getGaragesAvailability = async (
  implementLength: number,
  excludeImplementId?: string,
): Promise<GaragesAvailabilityResponse> => {
  const response = await apiClient.get<GaragesAvailabilityResponse>(
    `/implements/garages-availability`,
    {
      params: { implementLength, excludeImplementId },
    },
  );
  return response.data;
};

// =====================
// Batch Update Spots
// =====================

export interface BatchUpdateSpotsRequest {
  updates: Array<{ implementId: string; spot: string | null }>;
}

export interface BatchUpdateSpotsResponse {
  success: boolean;
  message: string;
  data: {
    success: boolean;
    updated: number;
  };
}

export const batchUpdateSpots = async (
  updates: Array<{ implementId: string; spot: string | null }>,
): Promise<BatchUpdateSpotsResponse> => {
  const response = await apiClient.post<BatchUpdateSpotsResponse>(
    `/implements/batch-update-spots`,
    { updates },
  );
  return response.data;
};

// =====================
// Movement Request
// =====================

export interface MovementRequestData {
  taskId: string;
  implementId: string;
  taskName: string;
  fromSpot: string | null;
  toSpot: string | null;
}

export const requestMovement = async (
  data: MovementRequestData,
): Promise<{ success: boolean; message: string }> => {
  const response = await apiClient.post<{ success: boolean; message: string }>(
    `/implements/request-movement`,
    data,
  );
  return response.data;
};

// =====================
// A ARTE DO IMPLEMENTO (Modelo C, P12)
// =====================
//
// A arte é do IMPLEMENTO: sobe como RASCUNHO, vai ao cliente (`send`), e é
// decidida no portal ou, por dentro, "em nome do cliente" com nota. Reprovada só
// volta por versão nova. O orçamento e o documento de assinatura levam a
// APROVADA de cada veículo — não há mais arte "da tarefa" nem "do orçamento".

export interface ImplementLayoutResponse {
  success: boolean;
  message: string;
  data: Layout;
}

export interface ImplementLayoutsResponse {
  success: boolean;
  message: string;
  data: Layout[];
}

/** A arte do implemento, a mais velha primeiro. Fora dos papéis de arte, só a aprovada. */
export const getImplementLayouts = async (implementId: string): Promise<ImplementLayoutsResponse> => {
  const response = await apiClient.get<ImplementLayoutsResponse>(`/implements/${implementId}/layouts`);
  return response.data;
};

/** Sobe arte nova (só imagem; até 10 por vez). Nasce RASCUNHO. */
export const uploadImplementLayouts = async (
  implementId: string,
  files: File[],
): Promise<ImplementLayoutsResponse> => {
  const form = new FormData();
  files.forEach((file) => form.append("files", file));
  const response = await apiClient.post<ImplementLayoutsResponse>(`/implements/${implementId}/layouts`, form);
  return response.data;
};

/** Envia a arte ao cliente para aprovação (RASCUNHO → AGUARDANDO). */
export const sendImplementLayout = async (implementId: string, layoutId: string): Promise<ImplementLayoutResponse> => {
  const response = await apiClient.post<ImplementLayoutResponse>(
    `/implements/${implementId}/layouts/${layoutId}/send`,
  );
  return response.data;
};

/** "Aprovar em nome do cliente" — nota obrigatória (quem aprovou, por onde, quando). */
export const approveImplementLayoutOnBehalf = async (
  implementId: string,
  layoutId: string,
  note: string,
): Promise<ImplementLayoutResponse> => {
  const response = await apiClient.post<ImplementLayoutResponse>(
    `/implements/${implementId}/layouts/${layoutId}/approve-on-behalf`,
    { note },
  );
  return response.data;
};

/** Reprova a arte — nota obrigatória. Volta só por versão nova. */
export const reproveImplementLayout = async (
  implementId: string,
  layoutId: string,
  note: string,
): Promise<ImplementLayoutResponse> => {
  const response = await apiClient.post<ImplementLayoutResponse>(
    `/implements/${implementId}/layouts/${layoutId}/reprove`,
    { note },
  );
  return response.data;
};

/** Versão nova de uma arte (um arquivo). A anterior vira SUBSTITUÍDA. */
export const newImplementLayoutVersion = async (
  implementId: string,
  layoutId: string,
  file: File,
): Promise<ImplementLayoutResponse> => {
  const form = new FormData();
  form.append("files", file);
  const response = await apiClient.post<ImplementLayoutResponse>(
    `/implements/${implementId}/layouts/${layoutId}/new-version`,
    form,
  );
  return response.data;
};

/** Apaga uma arte (a API recusa a que já foi decidida). */
export const deleteImplementLayout = async (
  implementId: string,
  layoutId: string,
): Promise<{ success: boolean; message: string }> => {
  const response = await apiClient.delete<{ success: boolean; message: string }>(
    `/implements/${implementId}/layouts/${layoutId}`,
  );
  return response.data;
};

/** "Arte em lote": o MESMO arquivo (já no sistema) como rascunho em N implementos, numa transação. */
export const bulkImplementLayouts = async (
  implementIds: string[],
  fileId: string,
): Promise<{ success: boolean; message: string; data: unknown }> => {
  const response = await apiClient.post<{ success: boolean; message: string; data: unknown }>(
    `/implements/layouts/bulk`,
    { implementIds, fileId },
  );
  return response.data;
};

// =====================
// O PROJETO DO IMPLEMENTO
// =====================

/**
 * O projeto do implemento (PDFs do fabricante). `fileIds` é a lista que FICA
 * (os já gravados que continuam); `files` são os novos. É do implemento — o
 * "projeto da tarefa" (PDF cotado da arte) é outra coisa, na tarefa.
 */
export const setImplementProjectFiles = async (
  implementId: string,
  fileIds: string[],
  files: File[] = [],
): Promise<{ success: boolean; message: string; data: unknown }> => {
  const form = new FormData();
  fileIds.forEach((id) => form.append("fileIds", id));
  files.forEach((file) => form.append("implementProjectFiles", file));
  const response = await apiClient.put<{ success: boolean; message: string; data: unknown }>(
    `/implements/${implementId}/project-files`,
    form,
  );
  return response.data;
};
