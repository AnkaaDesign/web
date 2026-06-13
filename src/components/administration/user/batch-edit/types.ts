import type { CONTRACT_TYPE } from "../../../../constants";

export interface UserBatchEditFormData {
  users: Array<{
    id: string;
    data: {
      name?: string;
      email?: string | null;
      phone?: string | null;
      cpf?: string | null;
      positionId?: string | null;
      sectorId?: string | null;
      ledSectorId?: string | null;
      contractType?: CONTRACT_TYPE;
    };
  }>;
}
