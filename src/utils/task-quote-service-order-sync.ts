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
}

export interface SyncQuoteService {
  id?: string;
  description: string;
  observation?: string | null;
  amount?: number | null;
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
  const makeKey = (desc: string | null | undefined, obs: string | null | undefined): string =>
    `${normalizeDescription(desc)}|${normalizeDescription(obs)}`;
  const existingKeys = new Set(
    existingQuoteServices.map(item => makeKey(item.description, item.observation))
  );

  for (const so of serviceOrders) {
    // Only sync PRODUCTION type with valid descriptions
    if (so.type !== SERVICE_ORDER_TYPE.PRODUCTION) continue;
    if (!so.description || so.description.trim().length < 3) continue;

    const key = makeKey(so.description, so.observation);

    if (!existingKeys.has(key)) {
      servicesToAdd.push({
        description: so.description.trim(),
        observation: so.observation || null,
        amount: 0,
      });
      existingKeys.add(key);
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

  const makeKey = (desc: string | null | undefined, obs: string | null | undefined): string =>
    `${normalizeDescription(desc)}|${normalizeDescription(obs)}`;
  const existingKeys = new Set(
    existingServiceOrders
      .filter(so => so.type === SERVICE_ORDER_TYPE.PRODUCTION)
      .map(so => makeKey(so.description, so.observation))
  );

  for (const item of quoteServices) {
    if (!item.description || item.description.trim().length < 3) continue;

    const key = makeKey(item.description, item.observation);

    if (existingKeys.has(key)) {
      continue;
    }

    ordersToAdd.push({
      description: item.description.trim(),
      observation: item.observation || null,
      type: SERVICE_ORDER_TYPE.PRODUCTION,
      status: SERVICE_ORDER_STATUS.PENDING,
      statusOrder: 1,
    });

    existingKeys.add(key);
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

  return (
    areDescriptionsEqual(serviceOrder.description, quoteService.description) &&
    areDescriptionsEqual(serviceOrder.observation || '', quoteService.observation || '')
  );
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
  const productionSOs = serviceOrders.filter(
    so => so.type === SERVICE_ORDER_TYPE.PRODUCTION && so.description && so.description.trim().length >= 3,
  );

  // Count occurrences of each normalized description to detect duplicates
  const descCount = new Map<string, number>();
  for (const so of productionSOs) {
    const key = normalizeDescription(so.description);
    descCount.set(key, (descCount.get(key) ?? 0) + 1);
  }

  // Build observation map:
  // - Unique description: descKey → observation (enables propagation by description)
  // - Duplicate descriptions: descKey|obsKey → observation (identity — no cross-propagation)
  const observationMap = new Map<string, string | null>();
  for (const so of productionSOs) {
    const descKey = normalizeDescription(so.description);
    const obsValue = so.observation && so.observation.trim() ? so.observation : null;
    if (descCount.get(descKey) === 1) {
      observationMap.set(descKey, obsValue);
    } else {
      observationMap.set(`${descKey}|${normalizeDescription(obsValue)}`, obsValue);
    }
  }

  return quoteServices.map(item => {
    if (!item.description || item.description.trim().length < 3) return item;
    const descKey = normalizeDescription(item.description);
    const count = descCount.get(descKey) ?? 0;

    let lookupKey: string;
    if (count === 1) {
      lookupKey = descKey;
    } else {
      const currentObs = item.observation && item.observation.trim() ? item.observation : null;
      lookupKey = `${descKey}|${normalizeDescription(currentObs)}`;
    }

    if (!observationMap.has(lookupKey)) return item;

    const soObservation = observationMap.get(lookupKey) ?? null;
    const currentObs = item.observation && item.observation.trim() ? item.observation : null;
    if (currentObs !== soObservation) {
      return { ...item, observation: soObservation };
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
  const validQuoteServices = quoteServices.filter(
    item => item.description && item.description.trim().length >= 3,
  );

  // Count occurrences of each normalized description to detect duplicates
  const descCount = new Map<string, number>();
  for (const item of validQuoteServices) {
    const key = normalizeDescription(item.description);
    descCount.set(key, (descCount.get(key) ?? 0) + 1);
  }

  // Build observation map:
  // - Unique description: descKey → observation
  // - Duplicate descriptions: descKey|obsKey → observation (identity)
  const observationMap = new Map<string, string | null>();
  for (const item of validQuoteServices) {
    const descKey = normalizeDescription(item.description);
    const obsValue = item.observation && item.observation.trim() ? item.observation : null;
    if (descCount.get(descKey) === 1) {
      observationMap.set(descKey, obsValue);
    } else {
      observationMap.set(`${descKey}|${normalizeDescription(obsValue)}`, obsValue);
    }
  }

  return serviceOrders.map(so => {
    if (so.type !== SERVICE_ORDER_TYPE.PRODUCTION) return so;
    if (!so.description || so.description.trim().length < 3) return so;
    const descKey = normalizeDescription(so.description);
    const count = descCount.get(descKey) ?? 0;

    let lookupKey: string;
    if (count === 1) {
      lookupKey = descKey;
    } else {
      const currentObs = so.observation && so.observation.trim() ? so.observation : null;
      lookupKey = `${descKey}|${normalizeDescription(currentObs)}`;
    }

    if (!observationMap.has(lookupKey)) return so;

    const quoteObservation = observationMap.get(lookupKey) ?? null;
    const currentObs = so.observation && so.observation.trim() ? so.observation : null;
    if (currentObs !== quoteObservation) {
      return { ...so, observation: quoteObservation };
    }
    return so;
  });
}
