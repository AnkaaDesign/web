// =====================================================
// Attention system — server-backed ack store
// =====================================================
//
// Wraps the localStorage ack store (the sync working set) and mirrors every write
// to `PUT /attention/ack`, plus `hydrate()` pulls `GET /attention/ack` on login so
// cooldown / "already saw it" state follows the user across devices. localStorage
// stays as the offline cache: if the API is unreachable, everything still works
// locally and the writes simply fail silently.
//
// The engine's ack key is `matchKey` = `${ruleId}::${entityType}::${entityId}`, so
// the wire fields are recovered by splitting on "::" (none of the parts contain it).

import { apiClient } from "@/api-client/axiosClient";

import { createLocalAckStore, type AckRecord, type AttentionAckStore } from "./ack-store";
import { matchKey } from "./types";
import type { AttentionEntityType } from "./types";

export interface ServerAckStore extends AttentionAckStore {
  /** Pull the user's persisted acks and merge them into the local cache. */
  hydrate: () => Promise<void>;
}

interface AckRow {
  ruleId: string;
  entityType: string;
  entityId: string;
  snoozeUntil: number;
  acknowledged: boolean;
  lastFiredAt: number;
}

export function createServerBackedAckStore(): ServerAckStore {
  const local = createLocalAckStore();

  const put = (key: string, rec: AckRecord) => {
    const [ruleId, entityType, entityId] = key.split("::");
    if (!ruleId || !entityType || !entityId) return;
    void apiClient
      .put("/attention/ack", {
        ruleId,
        entityType,
        entityId,
        snoozeUntil: rec.snoozeUntil || null,
        acknowledged: rec.acknowledged,
        lastFiredAt: rec.lastFiredAt || null,
      })
      .catch(() => {
        // offline / server down — the localStorage cache already holds it.
      });
  };

  return {
    get: (key) => local.get(key),
    set: (key, rec) => {
      local.set(key, rec);
      put(key, rec);
    },
    patch: (key, patch) => {
      const next = local.patch(key, patch);
      put(key, next);
      return next;
    },
    clearAll: () => local.clearAll(),
    subscribe: (cb) => local.subscribe(cb),
    hydrate: async () => {
      try {
        const res = await apiClient.get("/attention/ack");
        const rows = (((res as { data?: unknown })?.data ?? res) as AckRow[]) ?? [];
        for (const row of rows) {
          if (!row?.ruleId || !row?.entityType || !row?.entityId) continue;
          const key = matchKey({
            ruleId: row.ruleId,
            entityType: row.entityType as AttentionEntityType,
            entityId: row.entityId,
          });
          local.patch(key, {
            snoozeUntil: row.snoozeUntil || 0,
            acknowledged: !!row.acknowledged,
            lastFiredAt: row.lastFiredAt || 0,
          });
        }
      } catch {
        // No server ack yet (or offline) → localStorage-only. Non-fatal.
      }
    },
  };
}
