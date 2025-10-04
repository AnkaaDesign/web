import type { USER_STATUS } from "../../../../constants";

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
      managedSectorId?: string | null;
      status?: USER_STATUS;
    };
  }>;
}
