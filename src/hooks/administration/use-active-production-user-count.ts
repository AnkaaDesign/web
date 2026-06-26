import { useMemo } from "react";

import { SECTOR_PRIVILEGES } from "@/constants";
import { useUsers } from "@/hooks/personnel-department/use-user";

/**
 * Returns the live count of active (`status != DISMISSED`) users whose sector
 * has the PRODUCTION privilege. Used as the denominator for "average tasks per
 * production collaborator" defaults derived from a TASKS_COMPLETED goal.
 *
 * Returns `null` while loading or when the API does not return a meta block.
 */
export function useActiveProductionUserCount(options?: {
  /** Restrict the count to a specific subset of sectors (still production-privileged). */
  sectorIds?: string[];
  enabled?: boolean;
}): { count: number | null; isLoading: boolean } {
  const enabled = options?.enabled ?? true;
  const sectorIds = options?.sectorIds;

  const { data, isLoading } = useUsers(
    enabled
      ? {
          isActive: true,
          includeSectorPrivileges: [SECTOR_PRIVILEGES.PRODUCTION],
          ...(sectorIds && sectorIds.length > 0
            ? { sectorIds }
            : {}),
          limit: 1,
        }
      : undefined,
  );

  return useMemo(() => {
    const total = data?.meta?.totalRecords;
    return {
      count: typeof total === "number" ? total : null,
      isLoading,
    };
  }, [data?.meta?.totalRecords, isLoading]);
}
