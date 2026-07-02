import type { GlobalSearchEntity, GlobalSearchResultItem } from "@/types";

/**
 * Selection history for the spotlight — powers the "Recentes" list and the
 * frecency boost (frequently/recently opened records rank above cold ones
 * with the same server relevance).
 */

export type SpotlightEntry = Pick<GlobalSearchResultItem, "entity" | "id" | "title" | "fields" | "status" | "statusLabel" | "statusVariant" | "color">;

export interface SpotlightHistoryEntry extends SpotlightEntry {
  count: number;
  lastAt: number;
}

// v2: entries store structured `fields` (labeled) instead of a plain subtitle
// string, so recents render exactly like live results. Bumping the key
// discards stale v1 snapshots that froze the old row format.
const STORAGE_KEY = "ankaa:spotlight-history-v2";
const MAX_ENTRIES = 100;
const DAY_MS = 24 * 60 * 60 * 1000;

export function loadHistory(): SpotlightHistoryEntry[] {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return [];
    const parsed = JSON.parse(stored);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((entry) => entry && entry.entity && entry.id && entry.title && typeof entry.count === "number");
  } catch {
    return [];
  }
}

export function recordSelection(history: SpotlightHistoryEntry[], entry: SpotlightEntry): SpotlightHistoryEntry[] {
  const existing = history.find((h) => h.entity === entry.entity && h.id === entry.id);
  const updated: SpotlightHistoryEntry = {
    ...entry,
    count: (existing?.count ?? 0) + 1,
    lastAt: Date.now(),
  };
  const next = [updated, ...history.filter((h) => !(h.entity === entry.entity && h.id === entry.id))].slice(0, MAX_ENTRIES);
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    // localStorage unavailable — history just won't persist
  }
  return next;
}

export function removeFromHistory(history: SpotlightHistoryEntry[], entity: string, id: string): SpotlightHistoryEntry[] {
  const next = history.filter((h) => !(h.entity === entity && h.id === id));
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    // localStorage unavailable — removal just won't persist
  }
  return next;
}

export function getRecent(history: SpotlightHistoryEntry[], max = 8): SpotlightHistoryEntry[] {
  return [...history].sort((a, b) => b.lastAt - a.lastAt).slice(0, max);
}

function recencyFactor(lastAt: number): number {
  const days = (Date.now() - lastAt) / DAY_MS;
  if (days <= 7) return 1;
  if (days <= 30) return 0.6;
  return 0.3;
}

/** Boost for a specific record the user has opened before (max +960). */
export function frecencyBoost(history: SpotlightHistoryEntry[], entity: GlobalSearchEntity, id: string): number {
  const entry = history.find((h) => h.entity === entity && h.id === id);
  if (!entry) return 0;
  return Math.min(entry.count, 8) * 120 * recencyFactor(entry.lastAt);
}

/** Small group-level boost for entity types the user opens most (max +120). */
export function entityAffinity(history: SpotlightHistoryEntry[], entity: GlobalSearchEntity): number {
  const total = history.filter((h) => h.entity === entity).reduce((sum, h) => sum + h.count, 0);
  return Math.min(total, 20) * 6;
}
