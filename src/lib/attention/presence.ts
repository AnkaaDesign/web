// =====================================================
// Attention system — presence store ("is-editing")
// =====================================================
//
// Module-level store of who is currently editing each entity, fed by the
// `presence:update` socket event. Components read it via `useEntityPresence`.
// Kept separate from the blink engine: presence is a calm "someone else is here"
// ring, never a bip.

import { useSyncExternalStore } from "react";

export interface PresenceEditor {
  userId: string;
  userName: string;
}

const EMPTY: ReadonlyArray<PresenceEditor> = [];
const byKey = new Map<string, ReadonlyArray<PresenceEditor>>();
const listeners = new Map<string, Set<() => void>>();
const globalListeners = new Set<() => void>();
let globalVersion = 0;

function key(type: string, id: string): string {
  return `${type}:${id}`;
}

function notify(k: string): void {
  listeners.get(k)?.forEach((l) => l());
  globalVersion++;
  globalListeners.forEach((l) => l());
}

export function subscribePresenceGlobal(cb: () => void): () => void {
  globalListeners.add(cb);
  return () => globalListeners.delete(cb);
}

export function getPresenceVersion(): number {
  return globalVersion;
}

/** Apply a `presence:update` payload from the socket. */
export function applyPresenceUpdate(entityType: string, entityId: string, editors: PresenceEditor[]): void {
  const k = key(entityType, entityId);
  if (!editors || editors.length === 0) byKey.delete(k);
  else byKey.set(k, editors);
  notify(k);
}

/** Clear all presence (socket disconnect / logout). */
export function clearPresence(): void {
  const keys = [...byKey.keys()];
  byKey.clear();
  keys.forEach(notify);
}

function subscribe(k: string, cb: () => void): () => void {
  let set = listeners.get(k);
  if (!set) {
    set = new Set();
    listeners.set(k, set);
  }
  set.add(cb);
  return () => {
    set!.delete(cb);
    if (set!.size === 0) listeners.delete(k);
  };
}

/**
 * Who is editing this entity right now (excluding, by convention, nobody — the
 * server already de-dupes by user). Returns a stable empty array when none.
 */
export function useEntityPresence(type: string, id: string | undefined): ReadonlyArray<PresenceEditor> {
  const k = id ? key(type, id) : "";
  return useSyncExternalStore(
    (cb) => (k ? subscribe(k, cb) : () => {}),
    () => (k ? byKey.get(k) ?? EMPTY : EMPTY),
    () => EMPTY,
  );
}

/** Non-hook read for imperative call sites (e.g. table getRowClassName). */
export function getEntityPresence(type: string, id: string | undefined): ReadonlyArray<PresenceEditor> {
  return id ? byKey.get(key(type, id)) ?? EMPTY : EMPTY;
}
