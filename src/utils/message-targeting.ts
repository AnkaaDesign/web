/**
 * Message Targeting Utilities
 *
 * Helper functions to resolve targeting selections to user IDs
 */

import { getUsers } from "@/api-client";

export interface TargetingSelection {
  type: 'all' | 'specific' | 'sector' | 'position';
  userIds?: string[];
  sectorIds?: string[];
  positionIds?: string[];
}

/**
 * Resolves targeting selection to an array of user IDs
 *
 * @param targeting - The targeting selection from the form
 * @returns Array of user IDs (empty array for 'all' users)
 */
export async function resolveTargetingToUserIds(targeting: TargetingSelection): Promise<string[]> {
  // All users = empty array (backend interprets this as all users)
  if (targeting.type === 'all') {
    return [];
  }

  // Specific users = use provided user IDs
  if (targeting.type === 'specific' && targeting.userIds) {
    return targeting.userIds;
  }

  // By sector = fetch all users in those sectors
  if (targeting.type === 'sector' && targeting.sectorIds && targeting.sectorIds.length > 0) {
    const users = await getUsers({
      where: {
        sectorId: { in: targeting.sectorIds },
        isActive: true,
      },
      select: { id: true },
    });
    return (users.data || []).map(user => user.id);
  }

  // By position = fetch all users with those positions
  if (targeting.type === 'position' && targeting.positionIds && targeting.positionIds.length > 0) {
    const users = await getUsers({
      where: {
        positionId: { in: targeting.positionIds },
        isActive: true,
      },
      select: { id: true },
    });
    return (users.data || []).map(user => user.id);
  }

  // Fallback: return empty array (all users)
  return [];
}
