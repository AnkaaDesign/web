// packages/hooks/src/useUser.ts

import { createUser, deleteUser, getUserById, getUsers, updateUser, batchCreateUsers, batchUpdateUsers, batchDeleteUsers } from "../api-client";
import type {
  UserGetManyFormData,
  UserCreateFormData,
  UserUpdateFormData,
  UserBatchCreateFormData,
  UserBatchUpdateFormData,
  UserBatchDeleteFormData,
  UserInclude,
} from "../schemas";
import type {
  UserGetUniqueResponse,
  UserGetManyResponse,
  UserCreateResponse,
  UserUpdateResponse,
  UserDeleteResponse,
  UserBatchCreateResponse,
  UserBatchUpdateResponse,
  UserBatchDeleteResponse,
} from "../types";
import type { User } from "../types";
import { changeLogKeys, positionKeys, sectorKeys, userKeys } from "./queryKeys";
import { createEntityHooks } from "./createEntityHooks";

// =====================================================
// User Service Adapter
// =====================================================

const userService = {
  getMany: (params?: UserGetManyFormData) => getUsers(params || {}),
  getById: (id: string, params?: any) => getUserById(id, params),
  create: (data: UserCreateFormData, include?: UserInclude) => createUser(data, include ? { include } : undefined),
  update: (id: string, data: UserUpdateFormData, include?: UserInclude) => updateUser(id, data, include ? { include } : undefined),
  delete: (id: string) => deleteUser(id),
  batchCreate: (data: UserBatchCreateFormData, include?: UserInclude) => batchCreateUsers(data, include ? { include } : undefined),
  batchUpdate: (data: UserBatchUpdateFormData, include?: UserInclude) => batchUpdateUsers(data, include ? { include } : undefined),
  batchDelete: (data: UserBatchDeleteFormData) => batchDeleteUsers(data),
};

// =====================================================
// Base User Hooks
// =====================================================

const baseHooks = createEntityHooks<
  UserGetManyFormData,
  UserGetManyResponse,
  UserGetUniqueResponse,
  UserCreateFormData,
  UserCreateResponse,
  UserUpdateFormData,
  UserUpdateResponse,
  UserDeleteResponse,
  UserBatchCreateFormData,
  UserBatchCreateResponse<User>,
  UserBatchUpdateFormData,
  UserBatchUpdateResponse<User>,
  UserBatchDeleteFormData,
  UserBatchDeleteResponse
>({
  queryKeys: userKeys,
  service: userService,
  staleTime: 1000 * 60 * 5, // 5 minutes
  relatedQueryKeys: [changeLogKeys, positionKeys, sectorKeys], // Invalidate related entities
});

// Export base hooks with standard names
export const useUsersInfinite = baseHooks.useInfiniteList;
export const useUsers = baseHooks.useList;
export const useUser = baseHooks.useDetail;
export const useUserMutations = baseHooks.useMutations;
export const useUserBatchMutations = baseHooks.useBatchMutations;

// =====================================================
// Specialized User Hooks
// =====================================================

export { useUserMutations as useUserCrud };
export { useUserBatchMutations as useUserBatchOperations };

// =====================================================
// Team Management Hooks
// =====================================================

/**
 * Hook to get users by managed sector (team members for a leader)
 */
export function useTeamMembers(managedSectorId?: string | null) {
  return useUsers({
    where: managedSectorId ? { sectorId: managedSectorId } : undefined,
    orderBy: { name: "asc" },
    include: {
      position: true,
      sector: true,
      managedSector: true,
    },
  });
}

/**
 * Hook to get team leaders (users with managedSectorId)
 */
export function useTeamLeaders() {
  return useUsers({
    where: { hasManagedSector: true },
    orderBy: { name: "asc" },
    include: {
      sector: true,
      managedSector: true,
      position: true,
    },
  });
}

/**
 * Hook to get users from a specific sector
 */
export function useSectorUsers(sectorId?: string | null) {
  return useUsers({
    where: sectorId ? { sectorId } : undefined,
    orderBy: { name: "asc" },
    include: {
      position: true,
      sector: true,
      managedSector: true,
    },
  });
}
