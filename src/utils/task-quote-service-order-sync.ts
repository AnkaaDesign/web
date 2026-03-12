/**
 * Task Quote and Production Service Order Bidirectional Synchronization Utilities
 *
 * This module provides synchronization logic for the frontend form between
 * TaskQuoteServices and Production Service Orders. The sync happens in real-time
 * as the user edits the form.
 *
 * Sync Rules (1:1 mapping):
 * 1. Service Order (PRODUCTION) → Task Quote Service:
 *    - description → description, observation → observation (separately)
 *    - Amount defaults to 0
 *
 * 2. Task Quote Service → Service Order (PRODUCTION):
 *    - description → description, observation → observation (separately)
 *    - Match is based on description only
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

export interface SyncQuoteService {
  id?: string;
  description: string;
  observation?: string | null;
  amount?: number | null;
  shouldSync?: boolean; // When false, this service should not participate in sync
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
 * Gets the quote services that should be created/exist based on PRODUCTION service orders.
 * Returns services that need to be added to quote.
 *
 * NEW APPROACH: Since TaskQuoteService now has its own observation field,
 * we sync description → description and observation → observation separately.
 * Match is based on description only (not combined).
 */
export function getQuoteServicesToAddFromServiceOrders(
  serviceOrders: SyncServiceOrder[],
  existingQuoteServices: SyncQuoteService[],
): SyncQuoteService[] {
  const servicesToAdd: SyncQuoteService[] = [];
  // Match based on description only (not combined with observation)
  const existingDescriptions = new Set(
    existingQuoteServices.map(item => normalizeDescription(item.description))
  );

  // CRITICAL: Also track descriptions of quote services with shouldSync = false
  // These should never be recreated by sync
  const noSyncDescriptions = new Set(
    existingQuoteServices
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

    // Check if this quote service already exists (by description only)
    // OR if it was previously deleted (shouldSync = false)
    if (!existingDescriptions.has(normalizedDesc) && !noSyncDescriptions.has(normalizedDesc)) {
      servicesToAdd.push({
        description: so.description.trim(),
        observation: so.observation || null, // Sync observation separately
        amount: 0,
      });
      // Add to set to prevent duplicates in the same batch
      existingDescriptions.add(normalizedDesc);
    }
  }

  return servicesToAdd;
}

/**
 * Gets the service orders that should be created/exist based on quote services.
 * Returns services that need to be added to service orders.
 *
 * NEW APPROACH: Since TaskQuoteService now has its own observation field,
 * we sync description → description and observation → observation separately.
 * Match is based on description only (not combined).
 *
 * @param quoteServices - Current quote services
 * @param existingServiceOrders - Current task's service orders
 * @param historicalDescriptions - Historical service order descriptions from database (optional, no longer used)
 */
export function getServiceOrdersToAddFromQuoteServices(
  quoteServices: SyncQuoteService[],
  existingServiceOrders: SyncServiceOrder[],
  _historicalDescriptions: string[] = [],
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

  for (const item of quoteServices) {
    if (!item.description || item.description.trim().length < 3) continue;
    // CRITICAL: Skip quote services with shouldSync = false
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
 * Checks if a service order matches a quote service (by description only).
 * NEW APPROACH: Match based on description only since observation is now a separate field.
 */
export function isServiceOrderMatchingQuoteService(
  serviceOrder: SyncServiceOrder,
  quoteService: SyncQuoteService,
): boolean {
  if (serviceOrder.type !== SERVICE_ORDER_TYPE.PRODUCTION) {
    return false;
  }

  return areDescriptionsEqual(serviceOrder.description, quoteService.description);
}

/**
 * Syncs observations from service orders to matching quote services.
 * Returns updated quote services array with observations synced.
 *
 * This function propagates both set and cleared observations.
 * If the service order's observation is empty/null, it will clear the quote service's observation.
 */
export function syncObservationsFromServiceOrdersToQuote(
  serviceOrders: SyncServiceOrder[],
  quoteServices: SyncQuoteService[],
): SyncQuoteService[] {
  // Create a map of normalized description -> observation from service orders
  // Include ALL matched descriptions, even with empty observations
  const soObservationMap = new Map<string, string | null>();
  for (const so of serviceOrders) {
    if (so.type !== SERVICE_ORDER_TYPE.PRODUCTION) continue;
    if (!so.description || so.description.trim().length < 3) continue;
    const normalizedDesc = normalizeDescription(so.description);
    // Store the observation value (or null if empty)
    const observationValue = so.observation && so.observation.trim() ? so.observation : null;
    soObservationMap.set(normalizedDesc, observationValue);
  }

  // Update quote services with matching observations
  return quoteServices.map(item => {
    if (!item.description || item.description.trim().length < 3) return item;
    const normalizedDesc = normalizeDescription(item.description);
    if (soObservationMap.has(normalizedDesc)) {
      const soObservation = soObservationMap.get(normalizedDesc);
      // Only update if observation differs (including clearing)
      const currentObs = item.observation && item.observation.trim() ? item.observation : null;
      if (currentObs !== soObservation) {
        return { ...item, observation: soObservation };
      }
    }
    return item;
  });
}

/**
 * Syncs observations from quote services to matching service orders.
 * Returns updated service orders array with observations synced.
 *
 * This function propagates both set and cleared observations.
 * If the quote service's observation is empty/null, it will clear the service order's observation.
 */
export function syncObservationsFromQuoteToServiceOrders(
  quoteServices: SyncQuoteService[],
  serviceOrders: SyncServiceOrder[],
): SyncServiceOrder[] {
  // Create a map of normalized description -> observation from quote services
  // Include ALL matched descriptions, even with empty observations
  const quoteObservationMap = new Map<string, string | null>();
  for (const item of quoteServices) {
    if (!item.description || item.description.trim().length < 3) continue;
    const normalizedDesc = normalizeDescription(item.description);
    // Store the observation value (or null if empty)
    const observationValue = item.observation && item.observation.trim() ? item.observation : null;
    quoteObservationMap.set(normalizedDesc, observationValue);
  }

  // Update service orders with matching observations
  return serviceOrders.map(so => {
    if (so.type !== SERVICE_ORDER_TYPE.PRODUCTION) return so;
    if (!so.description || so.description.trim().length < 3) return so;
    const normalizedDesc = normalizeDescription(so.description);
    if (quoteObservationMap.has(normalizedDesc)) {
      const quoteObservation = quoteObservationMap.get(normalizedDesc);
      // Only update if observation differs (including clearing)
      const currentObs = so.observation && so.observation.trim() ? so.observation : null;
      if (currentObs !== quoteObservation) {
        return { ...so, observation: quoteObservation };
      }
    }
    return so;
  });
}
