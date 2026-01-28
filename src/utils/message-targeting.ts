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
 * @throws Error if targeting type requires selection but none provided
 */
export async function resolveTargetingToUserIds(targeting: TargetingSelection): Promise<string[]> {
  // All users = empty array (backend interprets this as all users)
  if (targeting.type === 'all') {
    return [];
  }

  // Specific users = use provided user IDs
  if (targeting.type === 'specific') {
    if (!targeting.userIds || targeting.userIds.length === 0) {
      throw new Error('Selecione pelo menos um usuário para enviar a mensagem');
    }
    return targeting.userIds;
  }

  // By sector = fetch all users in those sectors
  if (targeting.type === 'sector') {
    if (!targeting.sectorIds || targeting.sectorIds.length === 0) {
      throw new Error('Selecione pelo menos um setor para enviar a mensagem');
    }
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
  if (targeting.type === 'position') {
    if (!targeting.positionIds || targeting.positionIds.length === 0) {
      throw new Error('Selecione pelo menos um cargo para enviar a mensagem');
    }
    const users = await getUsers({
      where: {
        positionId: { in: targeting.positionIds },
        isActive: true,
      },
      select: { id: true },
    });
    return (users.data || []).map(user => user.id);
  }

  // Should never reach here, but throw error to be safe
  throw new Error('Tipo de público inválido');
}
