import { useCallback, useEffect, useRef, useState } from "react";
import { useMyPreferences } from "@/dashboard/hooks/use-my-preferences";
import type { PersistedTableConfig } from "@/components/ui/datatable/data-table-types"; // new DataTable system (dir is datatable/, see memory)

/**
 * Per-user, per-table layout persistence for the DataTable engine — built to NEVER
 * lose a configuration change, even across a temporary loss of connectivity.
 *
 * Storage model:
 * - localStorage is the instant, always-durable local copy. Each entry carries a
 *   `dirty` flag: true once a change is made, false only after the SERVER confirms it.
 * - The server (`Preferences.tableConfigsWeb[tableId]`, via the existing Preferences
 *   entity/endpoint, written through `useMyPreferences().updateMine`) is the durable
 *   cross-device source of truth.
 *
 * Resilience guarantees:
 * - A change is written to localStorage synchronously (never lost on this device).
 * - The debounced server save RETRIES with capped backoff on failure, and re-fires the
 *   moment connectivity returns (`online` event) — a temporary outage never drops it.
 * - If a previous session left unsynced (`dirty`) changes, they are re-pushed once the
 *   server is ready this session.
 * - Because local may be NEWER than the server after a failed sync, `localDirty` is
 *   exposed so the engine can refuse to let a stale server config overwrite it on load.
 *
 * Only layout lives here (column order/sizing/visibility/alignment, pinned rows, page
 * size, default sort). The transient view (sort/filter/selection/page) lives in the URL.
 */

const LS_PREFIX = "ankaa:dt:";
const SAVE_DEBOUNCE_MS = 700;
const RETRY_BASE_MS = 2_000;
const RETRY_MAX_MS = 60_000;

const lsKey = (tableId: string) => `${LS_PREFIX}${tableId}`;

interface StoredEntry {
  c: PersistedTableConfig;
  /** dirty = written locally but not yet confirmed by the server. */
  d: boolean;
}

function readLocal(tableId: string): { config: PersistedTableConfig; dirty: boolean } | null {
  try {
    const raw = localStorage.getItem(lsKey(tableId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as StoredEntry | PersistedTableConfig;
    if (parsed && typeof parsed === "object" && "c" in parsed) {
      return { config: (parsed as StoredEntry).c, dirty: !!(parsed as StoredEntry).d };
    }
    // Legacy bare-config entry (pre-dirty-flag) — treat as already synced.
    return { config: parsed as PersistedTableConfig, dirty: false };
  } catch {
    return null;
  }
}

function writeLocal(tableId: string, config: PersistedTableConfig, dirty: boolean) {
  try {
    localStorage.setItem(lsKey(tableId), JSON.stringify({ c: config, d: dirty } as StoredEntry));
  } catch {
    /* quota / private mode — the server save will still carry the value */
  }
}

export interface UseTablePreferencesResult {
  /** localStorage-seeded config (instant). Use as the initial layout. */
  localConfig: PersistedTableConfig | null;
  /** True if the localStorage seed holds changes NOT yet confirmed by the server. */
  localDirty: boolean;
  /** Server config for this table, once the user's Preferences have resolved. */
  serverConfig: PersistedTableConfig | null;
  /** True once the server Preferences have resolved at least once. */
  isServerLoaded: boolean;
  /** Persist a layout (immediate localStorage mirror + debounced, retrying server upsert). */
  save: (config: PersistedTableConfig) => void;
  /** Remove this table's saved layout from both stores (reset to defaults). */
  clear: () => void;
}

export function useTablePreferences(tableId: string, enabled = true): UseTablePreferencesResult {
  const { preferences, isLoading, updateMine } = useMyPreferences();

  const [stored] = useState(() => (enabled ? readLocal(tableId) : null));
  const localConfig = stored?.config ?? null;
  const localDirty = stored?.dirty ?? false;

  const allConfigs = (preferences?.tableConfigsWeb as Record<string, PersistedTableConfig> | null | undefined) ?? null;
  const serverConfig = allConfigs?.[tableId] ?? null;
  const isServerLoaded = !isLoading && !!preferences;

  // Keep the merge base + mutator in refs so the debounced/retrying flush always uses the
  // freshest Preferences (which may load AFTER a save was scheduled).
  const baseRef = useRef<Record<string, PersistedTableConfig>>({});
  const updateRef = useRef(updateMine);
  const serverBaselineRef = useRef<string | null>(null);
  useEffect(() => {
    baseRef.current = (preferences?.tableConfigsWeb as Record<string, PersistedTableConfig> | null | undefined) ?? {};
    updateRef.current = updateMine;
    serverBaselineRef.current = serverConfig ? JSON.stringify(serverConfig) : null;
  }, [preferences, updateMine, serverConfig]);

  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pending = useRef<PersistedTableConfig | null>(null);
  const retryDelay = useRef(RETRY_BASE_MS);
  const lastSaved = useRef<string | null>(stored ? JSON.stringify(stored.config) : null);
  const flushRef = useRef<() => void>(() => {});

  const flush = useCallback(() => {
    timer.current = null;
    const cfg = pending.current;
    if (!cfg) return;
    // Merge only this table's key — saving one table never clobbers another's layout.
    // updateMine rejects until the Preferences row exists (it self-creates); the catch
    // below reschedules, so a save issued before load simply retries until ready.
    const next = { ...baseRef.current, [tableId]: cfg };
    void Promise.resolve(updateRef.current({ tableConfigsWeb: next } as never))
      .then(() => {
        retryDelay.current = RETRY_BASE_MS;
        // Only clear dirty if no NEWER change was queued while this request was in flight.
        if (pending.current === cfg) {
          pending.current = null;
          writeLocal(tableId, cfg, false);
        }
      })
      .catch(() => {
        // Network down / not-ready-yet: keep dirty + pending and retry with capped
        // backoff. The change is already safe in localStorage, so it is never lost.
        if (timer.current) clearTimeout(timer.current);
        timer.current = setTimeout(() => flushRef.current(), retryDelay.current);
        retryDelay.current = Math.min(retryDelay.current * 2, RETRY_MAX_MS);
      });
  }, [tableId]);
  flushRef.current = flush;

  const save = useCallback(
    (config: PersistedTableConfig) => {
      if (!enabled) return;
      const key = JSON.stringify(config);
      if (!pending.current) {
        if (key === lastSaved.current) return; // identical to our last write — nothing to do
        if (key === serverBaselineRef.current) {
          // Equal to the server's value (e.g. the layout the engine just hydrated from the
          // server) — mirror it locally as clean and skip a pointless server round-trip.
          writeLocal(tableId, config, false);
          lastSaved.current = key;
          return;
        }
      }
      lastSaved.current = key;
      pending.current = config;
      writeLocal(tableId, config, true); // dirty until the server confirms
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(flush, SAVE_DEBOUNCE_MS);
    },
    [enabled, tableId, flush],
  );

  // Re-push the moment connectivity returns.
  useEffect(() => {
    const onOnline = () => {
      if (!pending.current) return;
      if (timer.current) clearTimeout(timer.current);
      retryDelay.current = RETRY_BASE_MS;
      timer.current = setTimeout(flush, 0);
    };
    window.addEventListener("online", onOnline);
    return () => window.removeEventListener("online", onOnline);
  }, [flush]);

  // Once the server is ready, push anything outstanding: a change queued before the
  // Preferences row existed (first visit), or a PREVIOUS session's unsynced (dirty) changes.
  const reSynced = useRef(false);
  useEffect(() => {
    if (reSynced.current || !isServerLoaded || !enabled) return;
    reSynced.current = true;
    if (!pending.current && localDirty && localConfig) pending.current = localConfig;
    if (pending.current) {
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(flush, 0);
    }
  }, [isServerLoaded, enabled, localDirty, localConfig, flush]);

  // Flush any pending save when the component unmounts (SPA navigation mid-debounce).
  useEffect(
    () => () => {
      if (timer.current) {
        clearTimeout(timer.current);
        flush();
      }
    },
    [flush],
  );

  const clear = useCallback(() => {
    try {
      localStorage.removeItem(lsKey(tableId));
    } catch {
      /* ignore */
    }
    pending.current = null;
    lastSaved.current = null;
    if (timer.current) {
      clearTimeout(timer.current);
      timer.current = null;
    }
    const base = baseRef.current;
    if (base[tableId]) {
      const next = { ...base };
      delete next[tableId];
      void Promise.resolve(updateRef.current({ tableConfigsWeb: next } as never)).catch(() => {});
    }
  }, [tableId]);

  return { localConfig, localDirty, serverConfig, isServerLoaded, save, clear };
}
