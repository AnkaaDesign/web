import { useCallback, useEffect, useRef, useState } from "react";
import { useMyPreferences } from "@/dashboard/hooks/use-my-preferences";
import type { PersistedDetailConfig } from "./detail-page-types";

/**
 * Per-user, per-detail-page layout persistence — the detail-page twin of
 * `use-table-preferences`. Built to NEVER lose a configuration change, even across
 * a temporary loss of connectivity.
 *
 * Storage model:
 * - localStorage is the instant, always-durable local copy. Each entry carries a
 *   `dirty` flag: true once a change is made, false only after the SERVER confirms it.
 * - The server (`Preferences.detailConfigsWeb[detailKey]`, via the existing Preferences
 *   entity/endpoint, written through `useMyPreferences().updateMine`) is the durable
 *   cross-device source of truth.
 *
 * Resilience guarantees mirror the table system: synchronous localStorage write,
 * debounced server save with capped-backoff retry, re-push on `online`, re-sync of a
 * previous session's unsynced changes, flush-on-unmount, and a `localDirty` flag so a
 * stale server config never clobbers a newer-but-unsynced local copy.
 */

const LS_PREFIX = "ankaa:dp:";
const SAVE_DEBOUNCE_MS = 700;
const RETRY_BASE_MS = 2_000;
const RETRY_MAX_MS = 60_000;

const lsKey = (detailKey: string) => `${LS_PREFIX}${detailKey}`;

interface StoredEntry {
  c: PersistedDetailConfig;
  /** dirty = written locally but not yet confirmed by the server. */
  d: boolean;
}

function readLocal(detailKey: string): { config: PersistedDetailConfig; dirty: boolean } | null {
  try {
    const raw = localStorage.getItem(lsKey(detailKey));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as StoredEntry | PersistedDetailConfig;
    if (parsed && typeof parsed === "object" && "c" in parsed) {
      return { config: (parsed as StoredEntry).c, dirty: !!(parsed as StoredEntry).d };
    }
    // Legacy bare-config entry (pre-dirty-flag) — treat as already synced.
    return { config: parsed as PersistedDetailConfig, dirty: false };
  } catch {
    return null;
  }
}

function writeLocal(detailKey: string, config: PersistedDetailConfig, dirty: boolean) {
  try {
    localStorage.setItem(lsKey(detailKey), JSON.stringify({ c: config, d: dirty } as StoredEntry));
  } catch {
    /* quota / private mode — the server save will still carry the value */
  }
}

export interface UseDetailPreferencesResult {
  /** localStorage-seeded config (instant). Use as the initial layout. */
  localConfig: PersistedDetailConfig | null;
  /** True if the localStorage seed holds changes NOT yet confirmed by the server. */
  localDirty: boolean;
  /** Server config for this detail page, once the user's Preferences have resolved. */
  serverConfig: PersistedDetailConfig | null;
  /** True once the server Preferences have resolved at least once. */
  isServerLoaded: boolean;
  /** Persist a layout (immediate localStorage mirror + debounced, retrying server upsert). */
  save: (config: PersistedDetailConfig) => void;
  /** Remove this detail page's saved layout from both stores (reset to defaults). */
  clear: () => void;
}

export function useDetailPreferences(detailKey: string, enabled = true): UseDetailPreferencesResult {
  const { preferences, isLoading, updateMine } = useMyPreferences();

  const [stored] = useState(() => (enabled ? readLocal(detailKey) : null));
  const localConfig = stored?.config ?? null;
  const localDirty = stored?.dirty ?? false;

  const allConfigs = (preferences?.detailConfigsWeb as Record<string, PersistedDetailConfig> | null | undefined) ?? null;
  const serverConfig = allConfigs?.[detailKey] ?? null;
  const isServerLoaded = !isLoading && !!preferences;

  // Keep the merge base + mutator in refs so the debounced/retrying flush always uses the
  // freshest Preferences (which may load AFTER a save was scheduled).
  const baseRef = useRef<Record<string, PersistedDetailConfig>>({});
  const updateRef = useRef(updateMine);
  const serverBaselineRef = useRef<string | null>(null);
  useEffect(() => {
    baseRef.current = (preferences?.detailConfigsWeb as Record<string, PersistedDetailConfig> | null | undefined) ?? {};
    updateRef.current = updateMine;
    serverBaselineRef.current = serverConfig ? JSON.stringify(serverConfig) : null;
  }, [preferences, updateMine, serverConfig]);

  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pending = useRef<PersistedDetailConfig | null>(null);
  const retryDelay = useRef(RETRY_BASE_MS);
  const lastSaved = useRef<string | null>(stored ? JSON.stringify(stored.config) : null);
  const flushRef = useRef<() => void>(() => {});
  const unmounted = useRef(false);

  const flush = useCallback(() => {
    timer.current = null;
    const cfg = pending.current;
    if (!cfg) return;
    // Merge only this detail page's key — saving one never clobbers another's layout.
    const next = { ...baseRef.current, [detailKey]: cfg };
    void Promise.resolve(updateRef.current({ detailConfigsWeb: next } as never))
      .then(() => {
        retryDelay.current = RETRY_BASE_MS;
        if (pending.current === cfg) {
          pending.current = null;
          writeLocal(detailKey, cfg, false);
        }
      })
      .catch(() => {
        // Network down / not-ready-yet: keep dirty + pending and retry with capped backoff
        // (the change is safe in localStorage). Don't reschedule after unmount — avoids an
        // orphan retry loop for a navigated-away page.
        if (unmounted.current) return;
        if (timer.current) clearTimeout(timer.current);
        timer.current = setTimeout(() => flushRef.current(), retryDelay.current);
        retryDelay.current = Math.min(retryDelay.current * 2, RETRY_MAX_MS);
      });
  }, [detailKey]);
  flushRef.current = flush;

  const save = useCallback(
    (config: PersistedDetailConfig) => {
      if (!enabled) return;
      const key = JSON.stringify(config);
      if (!pending.current) {
        if (key === lastSaved.current) return; // identical to our last write — nothing to do
        if (key === serverBaselineRef.current) {
          // Equal to the server's value (e.g. the layout the engine just hydrated) — mirror
          // it locally as clean and skip a pointless server round-trip.
          writeLocal(detailKey, config, false);
          lastSaved.current = key;
          return;
        }
      }
      lastSaved.current = key;
      pending.current = config;
      writeLocal(detailKey, config, true); // dirty until the server confirms
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(flush, SAVE_DEBOUNCE_MS);
    },
    [enabled, detailKey, flush],
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
  // Preferences row existed (first visit), or a PREVIOUS session's unsynced changes.
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
      unmounted.current = true;
      if (timer.current) {
        clearTimeout(timer.current);
        flush();
      }
    },
    [flush],
  );

  const clear = useCallback(() => {
    try {
      localStorage.removeItem(lsKey(detailKey));
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
    if (base[detailKey]) {
      const next = { ...base };
      delete next[detailKey];
      void Promise.resolve(updateRef.current({ detailConfigsWeb: next } as never)).catch(() => {});
    }
  }, [detailKey]);

  return { localConfig, localDirty, serverConfig, isServerLoaded, save, clear };
}
