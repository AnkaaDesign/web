// =====================================================
// Attention system — acknowledgement / cooldown store
// =====================================================
//
// Persists, per (rule, entity), the "already saw it" + cooldown state so a page
// reload doesn't restart every burst and an `onView`-acknowledged alert stays
// quiet. The engine depends only on the `AttentionAckStore` interface; the
// default implementation is localStorage-backed (single device). Phase 4 swaps
// in a server-backed store (the decided `AttentionAck` model, cross-device)
// behind the same interface — no engine change required.

export interface AckRecord {
  /** Alerting suppressed until this epoch ms (cooldown window or explicit snooze). */
  snoozeUntil: number;
  /** Explicitly acknowledged (e.g. opened the detail page for an `onView` rule). */
  acknowledged: boolean;
  /** Last time a burst fired for this key (epoch ms) — dedup / diagnostics. */
  lastFiredAt: number;
}

export interface AttentionAckStore {
  get(key: string): AckRecord | undefined;
  set(key: string, rec: AckRecord): void;
  /** Merge a partial update onto the existing (or empty) record. */
  patch(key: string, patch: Partial<AckRecord>): AckRecord;
  clearAll(): void;
  /** Notify on external (cross-tab) changes so the engine can reconcile. */
  subscribe(cb: () => void): () => void;
}

const STORAGE_KEY = "ankaa-attention-ack-v1";
const EMPTY: AckRecord = { snoozeUntil: 0, acknowledged: false, lastFiredAt: 0 };

/** localStorage-backed store with an in-memory cache and cross-tab sync. */
export function createLocalAckStore(): AttentionAckStore {
  const cache = new Map<string, AckRecord>();
  const listeners = new Set<() => void>();

  const load = () => {
    try {
      const raw = typeof window !== "undefined" ? window.localStorage.getItem(STORAGE_KEY) : null;
      if (!raw) return;
      const parsed = JSON.parse(raw) as Record<string, AckRecord>;
      cache.clear();
      for (const [k, v] of Object.entries(parsed)) {
        if (v && typeof v === "object") cache.set(k, { ...EMPTY, ...v });
      }
    } catch {
      // corrupt / unavailable storage → start empty; alerts still work in-memory.
    }
  };

  const persist = () => {
    try {
      if (typeof window === "undefined") return;
      const obj: Record<string, AckRecord> = {};
      // Prune stale, expired, unacknowledged records so storage can't grow unbounded.
      const now = Date.now();
      for (const [k, v] of cache) {
        if (!v.acknowledged && v.snoozeUntil < now && now - v.lastFiredAt > 24 * 60 * 60 * 1000) continue;
        obj[k] = v;
      }
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(obj));
    } catch {
      // quota / unavailable — degrade to in-memory for this tab.
    }
  };

  load();

  if (typeof window !== "undefined") {
    window.addEventListener("storage", (e) => {
      if (e.key === STORAGE_KEY) {
        load();
        listeners.forEach((l) => l());
      }
    });
  }

  return {
    get: (key) => cache.get(key),
    set: (key, rec) => {
      cache.set(key, rec);
      persist();
    },
    patch: (key, patch) => {
      const next = { ...(cache.get(key) ?? EMPTY), ...patch };
      cache.set(key, next);
      persist();
      return next;
    },
    clearAll: () => {
      cache.clear();
      try {
        if (typeof window !== "undefined") window.localStorage.removeItem(STORAGE_KEY);
      } catch {
        /* ignore */
      }
      listeners.forEach((l) => l());
    },
    subscribe: (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
  };
}
