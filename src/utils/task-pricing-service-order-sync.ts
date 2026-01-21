/**
 * Task Pricing and Production Service Order Bidirectional Synchronization Utilities
 *
 * This module provides synchronization logic for the frontend form between
 * TaskPricingItems and Production Service Orders. The sync happens in real-time
 * as the user edits the form.
 *
 * Sync Rules:
 * 1. Service Order (PRODUCTION) → Task Pricing Item:
 *    - description + " " + observation → pricing item description
 *    - Amount defaults to 0
 *
 * 2. Task Pricing Item → Service Order (PRODUCTION):
 *    - Find existing SO description that matches the start of pricing item
 *    - If found: SO.description = matched part, SO.observation = rest
 *    - If not found: SO.description = full text, no observation
 */

import { SERVICE_ORDER_TYPE, SERVICE_ORDER_STATUS } from '../constants';

export interface SyncServiceOrder {
  id?: string;
  description: string;
  observation?: string | null;
  type: string;
  status?: string;
  statusOrder?: number;
  assignedToId?: string | null;
  shouldSync?: boolean; // When false, this item should not participate in sync
}

export interface SyncPricingItem {
  id?: string;
  description: string;
  observation?: string | null;
  amount?: number | null;
  shouldSync?: boolean; // When false, this item should not participate in sync
}

/**
 * Combines service order description and observation into a single pricing item description.
 */
export function combineServiceOrderToPricingDescription(
  description: string | null | undefined,
  observation?: string | null,
): string {
  const trimmedDescription = (description || '').trim();
  const trimmedObservation = (observation || '').trim();

  if (!trimmedDescription) {
    return trimmedObservation;
  }

  if (!trimmedObservation) {
    return trimmedDescription;
  }

  return `${trimmedDescription} ${trimmedObservation}`;
}

/**
 * Normalizes a description for comparison purposes.
 */
export function normalizeDescription(description: string | null | undefined): string {
  if (!description) return '';
  return description.toLowerCase().trim().replace(/\s+/g, ' ');
}

/**
 * Checks if two descriptions are equivalent (case-insensitive, normalized whitespace).
 */
export function areDescriptionsEqual(desc1: string | null | undefined, desc2: string | null | undefined): boolean {
  return normalizeDescription(desc1) === normalizeDescription(desc2);
}

/**
 * Splits a pricing item description back into service order description and observation.
 *
 * Algorithm:
 * 1. Look through BOTH existing service orders AND historical descriptions
 * 2. Find the longest description that matches the START of the pricing item
 * 3. Use that as the SO description, rest as observation
 * 4. If no match found, use full pricing item description as SO description
 *
 * @param pricingDescription - The pricing item description to split
 * @param existingServiceOrders - Current task's service orders
 * @param historicalDescriptions - Historical service order descriptions from database (optional)
 */
export function splitPricingToServiceOrderDescription(
  pricingDescription: string,
  existingServiceOrders: SyncServiceOrder[],
  historicalDescriptions: string[] = [],
): { description: string; observation: string | null } {
  const trimmedPricing = pricingDescription.trim();

  if (!trimmedPricing) {
    return { description: '', observation: null };
  }

  // Collect unique descriptions from multiple sources
  const uniqueDescriptions = new Map<string, string>();

  // 1. Add historical descriptions (from database) - these take priority
  for (const desc of historicalDescriptions) {
    const trimmedDesc = (desc || '').trim();
    if (trimmedDesc) {
      const lowerDesc = trimmedDesc.toLowerCase();
      if (!uniqueDescriptions.has(lowerDesc)) {
        uniqueDescriptions.set(lowerDesc, trimmedDesc);
      }
    }
  }

  // 2. Add descriptions from current task's PRODUCTION service orders
  const productionOrders = existingServiceOrders.filter(
    so => so.type === SERVICE_ORDER_TYPE.PRODUCTION && so.description
  );

  for (const so of productionOrders) {
    const desc = (so.description || '').trim();
    if (desc) {
      const lowerDesc = desc.toLowerCase();
      if (!uniqueDescriptions.has(lowerDesc)) {
        uniqueDescriptions.set(lowerDesc, desc);
      }
    }
  }

  // Sort by length (longest first) to find the best match
  const sortedDescriptions = Array.from(uniqueDescriptions.values())
    .sort((a, b) => b.length - a.length);

  const pricingLower = trimmedPricing.toLowerCase();

  for (const soDescription of sortedDescriptions) {
    const soLower = soDescription.toLowerCase();

    // Check if pricing description starts with this SO description
    // Also ensure there's a space after the match (to avoid partial word matches)
    if (pricingLower.startsWith(soLower)) {
      const rest = trimmedPricing.substring(soDescription.length).trim();

      // Only split if the rest starts with a space in the original (word boundary)
      // This prevents "PINTURA" from matching "PINTURA GERAL" incorrectly
      const charAfterMatch = trimmedPricing.charAt(soDescription.length);
      const isWordBoundary = !charAfterMatch || charAfterMatch === ' ';

      if (isWordBoundary) {
        if (rest) {
          return {
            description: soDescription,
            observation: rest,
          };
        } else {
          return {
            description: soDescription,
            observation: null,
          };
        }
      }
    }
  }

  // No matching prefix found - use full description
  return {
    description: trimmedPricing,
    observation: null,
  };
}

/**
 * Gets the pricing items that should be created/exist based on PRODUCTION service orders.
 * Returns items that need to be added to pricing.
 *
 * NEW APPROACH: Since TaskPricingItem now has its own observation field,
 * we sync description → description and observation → observation separately.
 * Match is based on description only (not combined).
 */
export function getPricingItemsToAddFromServiceOrders(
  serviceOrders: SyncServiceOrder[],
  existingPricingItems: SyncPricingItem[],
): SyncPricingItem[] {
  const itemsToAdd: SyncPricingItem[] = [];
  // Match based on description only (not combined with observation)
  const existingDescriptions = new Set(
    existingPricingItems.map(item => normalizeDescription(item.description))
  );

  // CRITICAL: Also track descriptions of pricing items with shouldSync = false
  // These should never be recreated by sync
  const noSyncDescriptions = new Set(
    existingPricingItems
      .filter(item => item.shouldSync === false)
      .map(item => normalizeDescription(item.description))
  );

  for (const so of serviceOrders) {
    // Only sync PRODUCTION type with valid descriptions
    if (so.type !== SERVICE_ORDER_TYPE.PRODUCTION) continue;
    if (!so.description || so.description.trim().length < 3) continue;
    // CRITICAL: Skip service orders with shouldSync = false
    if (so.shouldSync === false) continue;

    const normalizedDesc = normalizeDescription(so.description);

    // Check if this pricing item already exists (by description only)
    // OR if it was previously deleted (shouldSync = false)
    if (!existingDescriptions.has(normalizedDesc) && !noSyncDescriptions.has(normalizedDesc)) {
      itemsToAdd.push({
        description: so.description.trim(),
        observation: so.observation || null, // Sync observation separately
        amount: 0,
      });
      // Add to set to prevent duplicates in the same batch
      existingDescriptions.add(normalizedDesc);
    }
  }

  return itemsToAdd;
}

/**
 * Gets the service orders that should be created/exist based on pricing items.
 * Returns items that need to be added to service orders.
 *
 * NEW APPROACH: Since TaskPricingItem now has its own observation field,
 * we sync description → description and observation → observation separately.
 * Match is based on description only (not combined).
 *
 * @param pricingItems - Current pricing items
 * @param existingServiceOrders - Current task's service orders
 * @param historicalDescriptions - Historical service order descriptions from database (optional, no longer used)
 */
export function getServiceOrdersToAddFromPricingItems(
  pricingItems: SyncPricingItem[],
  existingServiceOrders: SyncServiceOrder[],
  historicalDescriptions: string[] = [],
): SyncServiceOrder[] {
  const ordersToAdd: SyncServiceOrder[] = [];

  // Match based on description only (not combined with observation)
  const existingDescriptions = new Set(
    existingServiceOrders
      .filter(so => so.type === SERVICE_ORDER_TYPE.PRODUCTION)
      .map(so => normalizeDescription(so.description))
  );

  // CRITICAL: Also track descriptions of service orders with shouldSync = false
  // These should never be recreated by sync
  const noSyncDescriptions = new Set(
    existingServiceOrders
      .filter(so => so.type === SERVICE_ORDER_TYPE.PRODUCTION && so.shouldSync === false)
      .map(so => normalizeDescription(so.description))
  );

  for (const item of pricingItems) {
    if (!item.description || item.description.trim().length < 3) continue;
    // CRITICAL: Skip pricing items with shouldSync = false
    if (item.shouldSync === false) continue;

    const normalizedItemDesc = normalizeDescription(item.description);

    // Check if a matching service order already exists (by description only)
    // OR if it was previously deleted (shouldSync = false)
    if (existingDescriptions.has(normalizedItemDesc) || noSyncDescriptions.has(normalizedItemDesc)) {
      continue;
    }

    ordersToAdd.push({
      description: item.description.trim(),
      observation: item.observation || null, // Sync observation separately
      type: SERVICE_ORDER_TYPE.PRODUCTION,
      status: SERVICE_ORDER_STATUS.PENDING,
      statusOrder: 1,
    });

    // Add to set to prevent duplicates
    existingDescriptions.add(normalizedItemDesc);
  }

  return ordersToAdd;
}

/**
 * Checks if a service order matches a pricing item (by description only).
 * NEW APPROACH: Match based on description only since observation is now a separate field.
 */
export function isServiceOrderMatchingPricingItem(
  serviceOrder: SyncServiceOrder,
  pricingItem: SyncPricingItem,
): boolean {
  if (serviceOrder.type !== SERVICE_ORDER_TYPE.PRODUCTION) {
    return false;
  }

  return areDescriptionsEqual(serviceOrder.description, pricingItem.description);
}

/**
 * Syncs observations from service orders to matching pricing items.
 * Returns updated pricing items array with observations synced.
 *
 * IMPORTANT: Only syncs when the source HAS an observation.
 * If the service order has no observation, the pricing item's observation is preserved.
 */
export function syncObservationsFromServiceOrdersToPricing(
  serviceOrders: SyncServiceOrder[],
  pricingItems: SyncPricingItem[],
): SyncPricingItem[] {
  // Create a map of normalized description -> observation from service orders
  // ONLY include entries that actually have an observation value
  const soObservationMap = new Map<string, string>();
  for (const so of serviceOrders) {
    if (so.type !== SERVICE_ORDER_TYPE.PRODUCTION) continue;
    if (!so.description || so.description.trim().length < 3) continue;
    // Only add to map if the service order actually HAS an observation
    if (so.observation && so.observation.trim()) {
      const normalizedDesc = normalizeDescription(so.description);
      soObservationMap.set(normalizedDesc, so.observation);
    }
  }

  // Update pricing items with matching observations
  return pricingItems.map(item => {
    if (!item.description || item.description.trim().length < 3) return item;
    const normalizedDesc = normalizeDescription(item.description);
    if (soObservationMap.has(normalizedDesc)) {
      const soObservation = soObservationMap.get(normalizedDesc)!;
      // Only update if observation differs
      if (item.observation !== soObservation) {
        return { ...item, observation: soObservation };
      }
    }
    return item;
  });
}

/**
 * Syncs observations from pricing items to matching service orders.
 * Returns updated service orders array with observations synced.
 *
 * IMPORTANT: Only syncs when the source HAS an observation.
 * If the pricing item has no observation, the service order's observation is preserved.
 */
export function syncObservationsFromPricingToServiceOrders(
  pricingItems: SyncPricingItem[],
  serviceOrders: SyncServiceOrder[],
): SyncServiceOrder[] {
  // Create a map of normalized description -> observation from pricing items
  // ONLY include entries that actually have an observation value
  const pricingObservationMap = new Map<string, string>();
  for (const item of pricingItems) {
    if (!item.description || item.description.trim().length < 3) continue;
    // Only add to map if the pricing item actually HAS an observation
    if (item.observation && item.observation.trim()) {
      const normalizedDesc = normalizeDescription(item.description);
      pricingObservationMap.set(normalizedDesc, item.observation);
    }
  }

  // Update service orders with matching observations
  return serviceOrders.map(so => {
    if (so.type !== SERVICE_ORDER_TYPE.PRODUCTION) return so;
    if (!so.description || so.description.trim().length < 3) return so;
    const normalizedDesc = normalizeDescription(so.description);
    if (pricingObservationMap.has(normalizedDesc)) {
      const pricingObservation = pricingObservationMap.get(normalizedDesc)!;
      // Only update if observation differs
      if (so.observation !== pricingObservation) {
        return { ...so, observation: pricingObservation };
      }
    }
    return so;
  });
}
