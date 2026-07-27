// =====================================================
// Attention system — presence store ("is-editing")
// =====================================================
//
// Module-level store of who is currently editing each entity, fed by the
// `presence:update` socket event and by the `presence:sync` snapshot taken on
// connect. Components read it via `useEntityPresence` / `useOtherEditors`.
//
// Kept separate from the blink engine: presence is a calm "someone else is here"
// ring, never a bip. It is also the system's PRIMARY override guard — the edit
// locks and the save-time confirmation both resolve through this store.

import { useSyncExternalStore } from "react";

import { ATTENTION_CLIENT_ID } from "./attention-socket";

export interface PresenceEditor {
  /** Stable per-tab id (see ATTENTION_CLIENT_ID) — how a client recognises and
   * excludes its OWN announcement, and tells "my other tab" (different clientId,
   * same userId) apart. Reliable across socket reconnects, unlike socket.id. */
  clientId: string;
  userId: string;
  userName: string;
  /** Epoch ms when this tab FIRST announced — the "when" half of "who and when is
   * editing". Preserved across refcount bumps by the gateway, so it measures the real
   * editing session rather than resetting each time another field is focused. */
  since: number;
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

/** True when two editor lists are equivalent for rendering purposes. */
function sameEditors(a: ReadonlyArray<PresenceEditor>, b: ReadonlyArray<PresenceEditor>): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (a[i].clientId !== b[i].clientId || a[i].since !== b[i].since) return false;
  }
  return true;
}

export function subscribePresenceGlobal(cb: () => void): () => void {
  globalListeners.add(cb);
  return () => globalListeners.delete(cb);
}

export function getPresenceVersion(): number {
  return globalVersion;
}

/**
 * Apply a `presence:update` payload from the socket.
 *
 * No-op updates are dropped BEFORE notifying: `globalVersion` drives a re-render of
 * every mounted table (they resolve row classes imperatively), so re-publishing an
 * unchanged list would re-render 1000-row pages across the app for nothing.
 */
export function applyPresenceUpdate(entityType: string, entityId: string, editors: PresenceEditor[]): void {
  const k = key(entityType, entityId);
  const next = editors ?? [];
  const prev = byKey.get(k) ?? EMPTY;
  if (sameEditors(prev, next)) return;

  if (next.length === 0) byKey.delete(k);
  else byKey.set(k, next);
  notify(k);
}

/**
 * Replace the whole registry from a `presence:sync` snapshot (taken on connect).
 *
 * Without this, a client that connected AFTER someone started editing saw an empty
 * registry until that editor happened to leave — the guard failed silently for the
 * person arriving second, who is exactly the one it exists to protect.
 */
export function applyPresenceSnapshot(entities: Array<{ entityType: string; entityId: string; editors: PresenceEditor[] }>): void {
  const stale = new Set(byKey.keys());
  for (const e of entities ?? []) {
    if (!e?.entityType || !e?.entityId) continue;
    const k = key(e.entityType, e.entityId);
    stale.delete(k);
    const next = e.editors ?? [];
    const prev = byKey.get(k) ?? EMPTY;
    if (sameEditors(prev, next)) continue;
    if (next.length === 0) byKey.delete(k);
    else byKey.set(k, next);
    notify(k);
  }
  // Anything the server no longer knows about is gone (e.g. released while we were
  // disconnected) — drop it rather than leaving a phantom lock on screen.
  for (const k of stale) {
    byKey.delete(k);
    notify(k);
  }
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

/** Everyone the server currently reports on this entity, including this tab. */
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

/**
 * Editors OTHER than this tab, collapsed to one entry per user (earliest `since` wins,
 * so the badge reports how long that person has really had it open).
 *
 * Excludes by `clientId`, not `userId`: your own second tab holding the same record IS
 * a real conflict — the two tabs cannot see each other's unsaved state, so one will
 * clobber the other exactly like a different person would.
 */
export function getOtherEditors(type: string, id: string | undefined): ReadonlyArray<PresenceEditor> {
  const others = getEntityPresence(type, id).filter((e) => e.clientId !== ATTENTION_CLIENT_ID);
  if (others.length <= 1) return others;
  const byUser = new Map<string, PresenceEditor>();
  for (const e of others) {
    const existing = byUser.get(e.userId);
    if (!existing || e.since < existing.since) byUser.set(e.userId, e);
  }
  return [...byUser.values()].sort((a, b) => a.since - b.since);
}

/** Hook form of {@link getOtherEditors}. Re-renders only when THIS entity changes. */
export function useOtherEditors(type: string, id: string | undefined): ReadonlyArray<PresenceEditor> {
  const editors = useEntityPresence(type, id);
  const others = editors.filter((e) => e.clientId !== ATTENTION_CLIENT_ID);
  if (others.length <= 1) return others;
  const byUser = new Map<string, PresenceEditor>();
  for (const e of others) {
    const existing = byUser.get(e.userId);
    if (!existing || e.since < existing.since) byUser.set(e.userId, e);
  }
  return [...byUser.values()].sort((a, b) => a.since - b.since);
}

/** Portuguese relative duration for a presence badge — "agora", "há 3 min", "há 2 h". */
export function formatEditingSince(since: number | undefined, now: number = Date.now()): string {
  if (!since) return "agora";
  const seconds = Math.max(0, Math.floor((now - since) / 1000));
  if (seconds < 60) return "agora";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `há ${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `há ${hours} h`;
  return `há ${Math.floor(hours / 24)} d`;
}
