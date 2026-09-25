import { apiClient } from "./axiosClient";

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
