import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { ZodType } from "zod";
import {
  getMyStatisticsPreferences,
  upsertStatisticsPageConfig,
  createStatisticsPreset,
  updateStatisticsPreset,
  deleteStatisticsPreset,
} from "../../api-client";
import type { StatisticsPreset } from "../../types";
import { statisticsPreferencesKeys } from "./query-keys";

const AUTO_SAVE_DEBOUNCE_MS = 1500;

// JSON.stringify with sorted object keys, so configs compare equal regardless
// of property order (page snapshot vs stored preset).
function stableStringify(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
  const obj = value as Record<string, unknown>;
  return `{${Object.keys(obj)
    .sort()
    .map(k => `${JSON.stringify(k)}:${stableStringify(obj[k])}`)
    .join(',')}}`;
}

interface UseStatisticsPagePersistenceOptions<T extends Record<string, unknown>> {
  /** Canonical page key — use the page's route path (e.g. routes.statistics.inventory.consumption). */
  pageKey: string;
  /**
   * Zod schema validating a stored config before it is applied.
   * The config must be plain JSON: serialize Dates as ISO strings in `current`
   * and revive them inside `apply`.
   */
  schema: ZodType<T, any, any>;
  /** Memoized JSON-serializable snapshot of the page's current configurable state. */
  current: T;
  /** Applies a validated config back onto the page state (setState calls). */
  apply: (config: T) => void;
  /** Auto-save debounce in ms (default 1500). */
  debounceMs?: number;
}

interface UseStatisticsPagePersistenceReturn<T extends Record<string, unknown>> {
  /** True until the last-seen config has been fetched and applied (or determined absent/invalid). */
  isRestoring: boolean;
  /** Named presets saved for this page. */
  presets: StatisticsPreset[];
  /**
   * The preset whose config deep-equals the page's current snapshot, if any.
   * Detected by value (not by "last applied"), so it survives reloads and
   * clears automatically when the user diverges from the preset.
   */
  activePreset: StatisticsPreset | null;
  /** Saves the page's current snapshot as a new named preset. */
  savePreset: (name: string) => Promise<void>;
  /** Validates and applies a preset's config to the page. */
  applyPreset: (preset: StatisticsPreset) => boolean;
  /** Overwrites an existing preset's config with the page's current snapshot. */
  overwritePreset: (id: string) => Promise<void>;
  /** Renames a preset. */
  renamePreset: (id: string, name: string) => Promise<void>;
  /** Deletes a preset. */
  deletePreset: (id: string) => Promise<void>;
  isSavingPreset: boolean;
}

/**
 * Server-side persistence for statistics pages:
 * - On mount, fetches the user's last-seen config for `pageKey`, validates it
 *   with `schema`, and applies it once via `apply`.
 * - Afterwards, watches `current` and debounce-saves snapshots back to the API
 *   (toast suppressed — see api-client/statistics-preferences.ts).
 * - Exposes named-preset CRUD for the same page.
 */
export function useStatisticsPagePersistence<T extends Record<string, unknown>>({
  pageKey,
  schema,
  current,
  apply,
  debounceMs = AUTO_SAVE_DEBOUNCE_MS,
}: UseStatisticsPagePersistenceOptions<T>): UseStatisticsPagePersistenceReturn<T> {
  const queryClient = useQueryClient();
  const [isRestored, setIsRestored] = useState(false);

  // Keep latest apply/schema in refs so the restore effect runs exactly once per page.
  const applyRef = useRef(apply);
  applyRef.current = apply;
  const schemaRef = useRef<ZodType<T, any, any>>(schema);
  schemaRef.current = schema;

  // Serialized form of the last config we know to be persisted server-side.
  const lastPersistedRef = useRef<string | null>(null);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const { data, isError } = useQuery({
    queryKey: statisticsPreferencesKeys.byPage(pageKey),
    queryFn: () => getMyStatisticsPreferences(pageKey),
    staleTime: 1000 * 60 * 5,
    gcTime: 1000 * 60 * 15,
    retry: 1,
  });

  // ---------- Restore last-seen config (once) ----------
  useEffect(() => {
    if (isRestored) return;
    if (isError) {
      // Could not load preferences — fall back to page defaults and allow saving.
      setIsRestored(true);
      return;
    }
    if (!data) return;

    const stored = data.data?.pageConfigs?.[0]?.lastConfig;
    if (stored && typeof stored === "object") {
      const parsed = schemaRef.current.safeParse(stored);
      if (parsed.success) {
        lastPersistedRef.current = JSON.stringify(parsed.data);
        applyRef.current(parsed.data);
      }
      // Invalid/stale config (e.g. removed enum value) → silently keep defaults.
    }
    setIsRestored(true);
  }, [data, isError, isRestored]);

  // ---------- Auto-save current snapshot (debounced) ----------
  const upsertMutation = useMutation({
    mutationFn: upsertStatisticsPageConfig,
  });
  const upsertRef = useRef(upsertMutation.mutate);
  upsertRef.current = upsertMutation.mutate;

  const serializedCurrent = useMemo(() => JSON.stringify(current), [current]);

  useEffect(() => {
    if (!isRestored) return;
    if (serializedCurrent === lastPersistedRef.current) return;

    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      lastPersistedRef.current = serializedCurrent;
      upsertRef.current({ pageKey, config: JSON.parse(serializedCurrent) });
    }, debounceMs);

    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    };
  }, [serializedCurrent, isRestored, pageKey, debounceMs]);

  // ---------- Presets ----------
  const presets = useMemo(() => data?.data?.presets ?? [], [data]);

  const activePreset = useMemo(() => {
    const currentKey = stableStringify(current);
    return (
      presets.find(p => {
        const parsed = schemaRef.current.safeParse(p.config);
        return parsed.success && stableStringify(parsed.data) === currentKey;
      }) ?? null
    );
  }, [presets, current]);

  const invalidate = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: statisticsPreferencesKeys.all });
  }, [queryClient]);

  const createPresetMutation = useMutation({
    mutationFn: createStatisticsPreset,
    onSuccess: invalidate,
  });
  const updatePresetMutation = useMutation({
    mutationFn: ({ id, ...payload }: { id: string; name?: string; config?: Record<string, unknown> }) =>
      updateStatisticsPreset(id, payload),
    onSuccess: invalidate,
  });
  const deletePresetMutation = useMutation({
    mutationFn: deleteStatisticsPreset,
    onSuccess: invalidate,
  });

  const savePreset = useCallback(
    async (name: string) => {
      await createPresetMutation.mutateAsync({ pageKey, name, config: JSON.parse(serializedCurrent) });
    },
    [createPresetMutation, pageKey, serializedCurrent],
  );

  const applyPreset = useCallback((preset: StatisticsPreset): boolean => {
    const parsed = schemaRef.current.safeParse(preset.config);
    if (!parsed.success) return false;
    applyRef.current(parsed.data);
    return true;
  }, []);

  const overwritePreset = useCallback(
    async (id: string) => {
      await updatePresetMutation.mutateAsync({ id, config: JSON.parse(serializedCurrent) });
    },
    [updatePresetMutation, serializedCurrent],
  );

  const renamePreset = useCallback(
    async (id: string, name: string) => {
      await updatePresetMutation.mutateAsync({ id, name });
    },
    [updatePresetMutation],
  );

  const deletePresetFn = useCallback(
    async (id: string) => {
      await deletePresetMutation.mutateAsync(id);
    },
    [deletePresetMutation],
  );

  return {
    isRestoring: !isRestored,
    presets,
    activePreset,
    savePreset,
    applyPreset,
    overwritePreset,
    renamePreset,
    deletePreset: deletePresetFn,
    isSavingPreset: createPresetMutation.isPending,
  };
}
