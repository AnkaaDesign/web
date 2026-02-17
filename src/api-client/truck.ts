import { apiClient } from "./axiosClient";

// =====================
// Garage Availability Types
// =====================

export interface SpotOccupant {
  spotNumber: 1 | 2 | 3;
  truckId: string;
  taskName: string | null;
  truckLength: number;
}

export interface LaneAvailability {
  laneId: 'F1' | 'F2' | 'F3';
  availableSpace: number;
  currentTrucks: number;
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
  truckLength: number,
  excludeTruckId?: string,
): Promise<GaragesAvailabilityResponse> => {
  const response = await apiClient.get<GaragesAvailabilityResponse>(
    `/trucks/garages-availability`,
    {
      params: { truckLength, excludeTruckId },
    },
  );
  return response.data;
};
