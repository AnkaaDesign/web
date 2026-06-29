import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import { usePrivileges } from "@/hooks/common/use-privileges";
import { useDetailPreferences } from "./use-detail-preferences";
import type { DetailFieldDef, DetailSectionDef, PersistedDetailConfig, PrivilegeGate } from "./detail-page-types";

// ---------------------------------------------------------------------------
// Small utilities (mirrors of the DataTable engine's reconcile helpers)
// ---------------------------------------------------------------------------

/** Keep stored ids that still exist (in their order), then append any new ids. */
function reconcileOrder(stored: string[] | undefined, current: string[]): string[] {
  if (!stored || stored.length === 0) return current;
  const currentSet = new Set(current);
  const kept = stored.filter((id) => currentSet.has(id));
  const keptSet = new Set(kept);
  return [...kept, ...current.filter((id) => !keptSet.has(id))];
}

/**
 * Section-order reconcile that PRESERVES stored ids not currently present. A detail page may include
 * sections conditionally on async data (e.g. "Recortes" only once the cuts query resolves), so during
 * a cold load the section set is briefly incomplete. `reconcileOrder` would drop those absent ids,
 * then re-append the sections in DEFAULT order once their data arrives — silently destroying the
 * user's saved arrangement (and persisting the damage). Keeping absent ids in the order is harmless
 * (orderBySaved ignores ids that aren't currently rendered) and makes the saved layout survive the
 * load race. The only cost is a few stale ids lingering if a section is permanently removed in code.
 */
function mergeOrderKeepAbsent(stored: string[] | undefined, current: string[]): string[] {
  if (!stored || stored.length === 0) return current;
  const storedSet = new Set(stored);
  return [...stored, ...current.filter((id) => !storedSet.has(id))];
}

/**
 * Merge a persisted visibility map with defaults so newly-added ids appear — while PRESERVING stored
 * values for ids not currently present. A detail section (and its fields) can be briefly absent during
 * a cold load (it renders only once its async data resolves); dropping its stored visibility here and
 * then persisting would silently reset the user's show/hide choice once the section reappears. Absent
 * ids are harmless — `orderedSections` only ever reads visibility for sections in `available`.
 */
function mergeVisibility(ids: string[], defaults: Record<string, boolean>, stored?: Record<string, boolean>): Record<string, boolean> {
  const base = { ...(stored ?? {}) };
  for (const id of ids) if (!(id in base)) base[id] = defaults[id] ?? true;
  return base;
}

/** Per-section field-order map that preserves orders for sections not currently present (same
 *  cold-load-race reasoning as `mergeVisibility`/`mergeOrderKeepAbsent`). */
function mergeFieldOrder(
  stored: Record<string, string[]> | undefined,
  sections: { id: string; fields: { id: string }[] }[],
): Record<string, string[]> {
  const base: Record<string, string[]> = { ...(stored ?? {}) };
  for (const s of sections) base[s.id] = reconcileOrder(stored?.[s.id], s.fields.map((f) => f.id));
  return base;
}

function sameIds(a: string[], b: string[]): boolean {
  return a.length === b.length && a.every((id, i) => id === b[i]);
}

function orderBySaved<T extends { id: string }>(items: T[], order: string[]): T[] {
  const idx = new Map(order.map((id, i) => [id, i] as const));
  return [...items].sort((a, b) => (idx.get(a.id) ?? Infinity) - (idx.get(b.id) ?? Infinity));
}

// ---------------------------------------------------------------------------
// Public shapes
// ---------------------------------------------------------------------------

export interface ResolvedSection<TData> {
  def: DetailSectionDef<TData>;
  /** Visible + privilege-allowed fields, in the user's order. */
  fields: DetailFieldDef<TData>[];
  /** Effective grid span (user width override → section.span → 1). */
  span: 1 | 2;
  /** Explicit column for a half-width section (1 = left, 2 = right). Undefined = auto-balance. */
  column?: 1 | 2;
}

export interface ManagerSection {
  id: string;
  label: ReactNode;
  visible: boolean;
  required: boolean;
  /** Effective width (1 = half, 2 = full). */
  width: 1 | 2;
  /** Explicit column for a half-width section (1 | 2), or undefined when auto. */
  column?: 1 | 2;
  /** Field rows for the nested show/hide + reorder list, in the user's order. */
  fields: { id: string; label: ReactNode; visible: boolean; required: boolean }[];
}

export interface UseDetailLayoutParams<TData> {
  detailKey: string;
  sections: DetailSectionDef<TData>[];
  persist?: boolean;
  /**
   * Resolved per-sector starting defaults (the entry for the current user's sector), applied with
   * precedence localStorage > server config > SECTOR DEFAULT > hardcoded section/field defaults. It
   * is NEVER applied over a user's saved (server/local) config or after they've interacted.
   */
  sectorDefault?: Partial<PersistedDetailConfig>;
}

export interface UseDetailLayoutResult<TData> {
  /** Ordered, visible sections, each carrying its visible fields + effective span/column. */
  orderedSections: ResolvedSection<TData>[];
  /** All privilege-allowed sections in user order — drives the customize manager. */
  managerSections: ManagerSection[];
  sectionOrder: string[];
  setSectionOrder: (order: string[]) => void;
  toggleSection: (id: string) => void;
  toggleField: (id: string) => void;
  setSectionWidth: (id: string, width: 1 | 2) => void;
  /** Pin a half-width section to a column (1 | 2), or null to auto-balance. */
  setSectionColumn: (id: string, column: 1 | 2 | null) => void;
  setSectionFieldOrder: (sectionId: string, order: string[]) => void;
  /** Show/hide every (non-required) section at once. */
  setAllSections: (visible: boolean) => void;
  resetLayout: () => void;
  visibleCount: number;
  totalCount: number;
}

/**
 * Headless engine for the detail page — the analog of `useDataTable`. Owns section order +
 * section/field visibility + per-section field order + width + explicit column, hydrated with
 * precedence localStorage > server > defaults, persisted (debounced) to
 * Preferences.detailConfigsWeb[detailKey]. Privilege-gated sections/fields are removed first.
 */
export function useDetailLayout<TData>(params: UseDetailLayoutParams<TData>): UseDetailLayoutResult<TData> {
  const { detailKey, sections, persist = true, sectorDefault } = params;
  const { canAccess, currentPrivilege, isAuthenticated } = usePrivileges();
  const isAllowed = (gate?: PrivilegeGate) => !gate || canAccess(gate);

  // 1) Privilege filter: drop gated sections + fields ENTIRELY (memoized on currentPrivilege).
  const available = useMemo(
    () =>
      sections
        .filter((s) => isAllowed(s.requiredPrivilege))
        .map((s) => ({ ...s, fields: (s.fields ?? []).filter((f) => isAllowed(f.requiredPrivilege)) })),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [sections, currentPrivilege],
  );

  const sectionIds = useMemo(() => available.map((s) => s.id), [available]);
  const fieldIds = useMemo(() => available.flatMap((s) => s.fields.map((f) => f.id)), [available]);
  const requiredSections = useMemo(() => new Set(available.filter((s) => s.required).map((s) => s.id)), [available]);
  const requiredFields = useMemo(
    () => new Set(available.flatMap((s) => s.fields.filter((f) => f.required).map((f) => f.id))),
    [available],
  );

  const defaultSectionVis = useMemo(() => Object.fromEntries(available.map((s) => [s.id, s.defaultVisible !== false])), [available]);
  const defaultFieldVis = useMemo(
    () => Object.fromEntries(available.flatMap((s) => s.fields.map((f) => [f.id, f.defaultVisible !== false]))),
    [available],
  );
  const defaultSpan = useMemo(() => {
    const m = new Map<string, 1 | 2>();
    for (const s of available) m.set(s.id, s.span === 2 ? 2 : 1);
    return m;
  }, [available]);
  const defaultFieldOrder = useMemo(() => {
    const m: Record<string, string[]> = {};
    for (const s of available) m[s.id] = s.fields.map((f) => f.id);
    return m;
  }, [available]);

  const prefs = useDetailPreferences(detailKey, persist);
  const { localConfig, localDirty, serverConfig, isServerLoaded } = prefs;

  // 2) Controlled state (seeded: localStorage > sector default > hardcoded defaults).
  const [sectionOrder, setSectionOrderState] = useState<string[]>(() =>
    mergeOrderKeepAbsent(localConfig?.sectionOrder ?? sectorDefault?.sectionOrder, sectionIds),
  );
  const [sectionVisibility, setSectionVisibility] = useState<Record<string, boolean>>(() =>
    mergeVisibility(sectionIds, defaultSectionVis, localConfig?.sectionVisibility ?? sectorDefault?.sectionVisibility),
  );
  const [fieldVisibility, setFieldVisibility] = useState<Record<string, boolean>>(() =>
    mergeVisibility(fieldIds, defaultFieldVis, localConfig?.fieldVisibility ?? sectorDefault?.fieldVisibility),
  );
  const [widths, setWidths] = useState<Record<string, 1 | 2>>(() => ({ ...(localConfig?.widths ?? sectorDefault?.widths ?? {}) }));
  const [columnsMap, setColumnsMap] = useState<Record<string, 1 | 2>>(() => ({ ...(localConfig?.columns ?? sectorDefault?.columns ?? {}) }));
  const [fieldOrder, setFieldOrder] = useState<Record<string, string[]>>(() =>
    mergeFieldOrder(localConfig?.fieldOrder ?? sectorDefault?.fieldOrder, available),
  );

  const userInteracted = useRef(false);
  const serverApplied = useRef(false);
  // Whether the server returned a saved config — gates the sector-default effect so a sector default
  // can NEVER apply over a user's saved (server) layout.
  const serverHadConfig = useRef(false);
  const sectorApplied = useRef(false);
  const [ready, setReady] = useState(false);

  // 3) Reconcile when the available set changes (privilege resolves async, etc.).
  const prevSecIds = useRef(sectionIds);
  const prevFieldIds = useRef(fieldIds);
  useEffect(() => {
    if (!sameIds(prevSecIds.current, sectionIds)) {
      setSectionOrderState((o) => mergeOrderKeepAbsent(o, sectionIds));
      setSectionVisibility((v) => mergeVisibility(sectionIds, defaultSectionVis, v));
      prevSecIds.current = sectionIds;
    }
    if (!sameIds(prevFieldIds.current, fieldIds)) {
      setFieldVisibility((v) => mergeVisibility(fieldIds, defaultFieldVis, v));
      setFieldOrder((prev) => mergeFieldOrder(prev, available));
      prevFieldIds.current = fieldIds;
    }
  }, [available, sectionIds, fieldIds, defaultSectionVis, defaultFieldVis]);

  // 4) Server precedence — apply once it loads, gated on the user (privilege) being resolved so a
  //    cold-load race can't hydrate/persist against an incomplete (ungated-only) section set.
  useEffect(() => {
    if (serverApplied.current || !isServerLoaded || !isAuthenticated) return;
    serverApplied.current = true;
    const cfg: PersistedDetailConfig | null = serverConfig;
    serverHadConfig.current = !!cfg;
    if (cfg && !userInteracted.current && !localDirty) {
      setSectionOrderState(mergeOrderKeepAbsent(cfg.sectionOrder, sectionIds));
      setSectionVisibility(mergeVisibility(sectionIds, defaultSectionVis, cfg.sectionVisibility));
      setFieldVisibility(mergeVisibility(fieldIds, defaultFieldVis, cfg.fieldVisibility));
      setWidths({ ...(cfg.widths ?? {}) });
      setColumnsMap({ ...(cfg.columns ?? {}) });
      setFieldOrder(mergeFieldOrder(cfg.fieldOrder, available));
    }
    setReady(true);
  }, [available, isServerLoaded, isAuthenticated, serverConfig, localDirty, sectionIds, fieldIds, defaultSectionVis, defaultFieldVis]);

  // 4b) Sector default (one-shot): `currentPrivilege` resolves async, so the useState seed may have
  //     run before `sectorDefault` was available. Apply it to in-memory state once the privilege +
  //     server load settle — ONLY when there is no server config, no local config, and the user
  //     hasn't interacted. Below server/local/user in precedence; never forces a save.
  useEffect(() => {
    if (sectorApplied.current) return;
    if (!isAuthenticated || !serverApplied.current) return;
    sectorApplied.current = true;
    if (serverHadConfig.current || localConfig || userInteracted.current || localDirty || !sectorDefault) return;
    if (sectorDefault.sectionOrder) setSectionOrderState(mergeOrderKeepAbsent(sectorDefault.sectionOrder, sectionIds));
    if (sectorDefault.sectionVisibility) setSectionVisibility(mergeVisibility(sectionIds, defaultSectionVis, sectorDefault.sectionVisibility));
    if (sectorDefault.fieldVisibility) setFieldVisibility(mergeVisibility(fieldIds, defaultFieldVis, sectorDefault.fieldVisibility));
    if (sectorDefault.fieldOrder) setFieldOrder(mergeFieldOrder(sectorDefault.fieldOrder, available));
    if (sectorDefault.widths) setWidths({ ...sectorDefault.widths });
    if (sectorDefault.columns) setColumnsMap({ ...sectorDefault.columns });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated, ready, sectorDefault, localConfig, localDirty, available, sectionIds, fieldIds, defaultSectionVis, defaultFieldVis]);

  // 5) Persist (debounced inside the hook) once the server baseline is known.
  useEffect(() => {
    if (!persist || !ready) return;
    prefs.save({ sectionOrder, sectionVisibility, fieldVisibility, fieldOrder, widths, columns: columnsMap });
    // prefs.save is stable; intentionally excluded to avoid resave loops.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [persist, ready, sectionOrder, sectionVisibility, fieldVisibility, fieldOrder, widths, columnsMap]);

  // --- Mutators (every one marks userInteracted so server load won't clobber) ---
  const toggleSection = useCallback(
    (id: string) => {
      if (requiredSections.has(id)) return; // required sections can't be hidden
      userInteracted.current = true;
      setSectionVisibility((v) => ({ ...v, [id]: !(v[id] ?? true) }));
    },
    [requiredSections],
  );
  const toggleField = useCallback(
    (id: string) => {
      if (requiredFields.has(id)) return;
      userInteracted.current = true;
      setFieldVisibility((v) => ({ ...v, [id]: !(v[id] ?? true) }));
    },
    [requiredFields],
  );
  const setSectionOrder = useCallback((order: string[]) => {
    userInteracted.current = true;
    setSectionOrderState(order);
  }, []);
  const setSectionWidth = useCallback((id: string, width: 1 | 2) => {
    userInteracted.current = true;
    setWidths((w) => ({ ...w, [id]: width }));
  }, []);
  const setSectionColumn = useCallback((id: string, column: 1 | 2 | null) => {
    userInteracted.current = true;
    setColumnsMap((c) => {
      const next = { ...c };
      if (column == null) delete next[id];
      else next[id] = column;
      return next;
    });
  }, []);
  const setSectionFieldOrder = useCallback((sectionId: string, order: string[]) => {
    userInteracted.current = true;
    setFieldOrder((prev) => ({ ...prev, [sectionId]: order }));
  }, []);
  const setAllSections = useCallback(
    (visible: boolean) => {
      userInteracted.current = true;
      setSectionVisibility(() => {
        const next: Record<string, boolean> = {};
        for (const s of available) next[s.id] = visible || !!s.required; // required stay visible
        return next;
      });
    },
    [available],
  );

  const resetLayout = useCallback(() => {
    userInteracted.current = true;
    // "Restaurar padrão" resets to the SECTOR default when present (so existing users can adopt it),
    // falling back to the hardcoded defaults per field. Persistence is cleared either way.
    setSectionOrderState(sectorDefault?.sectionOrder ? mergeOrderKeepAbsent(sectorDefault.sectionOrder, sectionIds) : sectionIds);
    setSectionVisibility(sectorDefault?.sectionVisibility ? mergeVisibility(sectionIds, defaultSectionVis, sectorDefault.sectionVisibility) : defaultSectionVis);
    setFieldVisibility(sectorDefault?.fieldVisibility ? mergeVisibility(fieldIds, defaultFieldVis, sectorDefault.fieldVisibility) : defaultFieldVis);
    setWidths({ ...(sectorDefault?.widths ?? {}) });
    setColumnsMap({ ...(sectorDefault?.columns ?? {}) });
    setFieldOrder(sectorDefault?.fieldOrder ? mergeFieldOrder(sectorDefault.fieldOrder, available) : defaultFieldOrder);
    prefs.clear();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sectionIds, fieldIds, defaultSectionVis, defaultFieldVis, defaultFieldOrder, sectorDefault, available]);

  // --- Derived ---
  const effectiveSpan = useCallback((id: string): 1 | 2 => widths[id] ?? defaultSpan.get(id) ?? 1, [widths, defaultSpan]);
  const orderFields = useCallback(
    (sectionId: string, fields: DetailFieldDef<TData>[]) => (fieldOrder[sectionId] ? orderBySaved(fields, fieldOrder[sectionId]) : fields),
    [fieldOrder],
  );

  const orderedSections = useMemo<ResolvedSection<TData>[]>(
    () =>
      orderBySaved(available, sectionOrder)
        .filter((s) => sectionVisibility[s.id] !== false)
        .map((s) => ({
          def: s,
          fields: orderFields(s.id, s.fields.filter((f) => fieldVisibility[f.id] !== false)),
          span: effectiveSpan(s.id),
          column: columnsMap[s.id],
        })),
    [available, sectionOrder, sectionVisibility, fieldVisibility, effectiveSpan, orderFields, columnsMap],
  );

  const managerSections = useMemo<ManagerSection[]>(
    () =>
      orderBySaved(available, sectionOrder).map((s) => ({
        id: s.id,
        label: s.label,
        visible: sectionVisibility[s.id] !== false,
        required: !!s.required,
        width: effectiveSpan(s.id),
        column: columnsMap[s.id],
        fields: orderFields(s.id, s.fields).map((f) => ({
          id: f.id,
          label: f.label,
          visible: fieldVisibility[f.id] !== false,
          required: !!f.required,
        })),
      })),
    [available, sectionOrder, sectionVisibility, fieldVisibility, effectiveSpan, orderFields, columnsMap],
  );

  const visibleCount = managerSections.filter((s) => s.visible).length;
  const totalCount = managerSections.length;

  return {
    orderedSections,
    managerSections,
    sectionOrder,
    setSectionOrder,
    toggleSection,
    toggleField,
    setSectionWidth,
    setSectionColumn,
    setSectionFieldOrder,
    setAllSections,
    resetLayout,
    visibleCount,
    totalCount,
  };
}
