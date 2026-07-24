// =====================================================
// Attention system — React hooks
// =====================================================
//
// The public surface components use. Nothing here owns the blink lifecycle — the
// engine does (see `engine.ts`); these hooks only SUBSCRIBE to a shared address's
// phase, so mounting/unmounting a row or opening a detail page never restarts or
// stops a running burst.

import { useEffect, useId, useSyncExternalStore } from "react";

import { useAttentionRegistry } from "./attention-context";
import { ATTENTION_CLIENT_ID, emitPresenceEnter, emitPresenceLeave } from "./attention-socket";
import { getAddressState, getGlobalVersion, markViewed, subscribeAddress, subscribeGlobal } from "./engine";
import { getEntityPresence, getPresenceVersion, subscribePresenceGlobal } from "./presence";
import type { AttentionEntityType, AttentionState } from "./types";
import { addressKey } from "./types";

/**
 * Register a source's entities so the engine can evaluate rules over them.
 * Call from any list/detail that loads entities (tables, the detail page). The
 * source id is stable per component instance; unmount cleans it up.
 */
export function useRegisterAttentionEntities(
  type: AttentionEntityType,
  list: ReadonlyArray<{ id: string } | undefined | null> | undefined,
): void {
  const sourceId = useId();
  const { register, unregister } = useAttentionRegistry();

  useEffect(() => {
    const clean = (list ?? []).filter((e): e is { id: string } => !!e && e.id != null);
    register(sourceId, type, clean);
    // Registered by identity of the array's contents; parents should memo their list.
  }, [register, sourceId, type, list]);

  useEffect(() => () => unregister(sourceId, type), [unregister, sourceId, type]);
}

/** Subscribe to the blink state at a given address (stable ref when unchanged). */
function useAddressState(address: string): AttentionState | null {
  return useSyncExternalStore(
    (cb) => subscribeAddress(address, cb),
    () => getAddressState(address),
    () => null,
  );
}

/** Row / detail-page level attention: active if ANY rule matches the entity. */
export function useAttention(type: AttentionEntityType, id: string | undefined): AttentionState | null {
  return useAddressState(id ? addressKey(type, id) : "");
}

/** Field-level attention: active only if a field-target rule matches this field. */
export function useAttentionField(type: AttentionEntityType, id: string | undefined, field: string): AttentionState | null {
  return useAddressState(id ? addressKey(type, id, field) : "");
}

/**
 * Re-render the caller whenever ANY attention state changes. For tables whose
 * per-row class is computed imperatively in a `getRowClassName` pass (which can't
 * call hooks per row) — pair with `attentionRowClassFor` below.
 */
export function useAttentionVersion(): number {
  return useSyncExternalStore(subscribeGlobal, getGlobalVersion, () => 0);
}

/** Non-hook row-class resolver — read live engine state for a row. */
export function attentionRowClassFor(type: AttentionEntityType, id: string | undefined): string {
  if (!id) return "";
  return attentionRowClass(getAddressState(addressKey(type, id)));
}

/**
 * Announce that the current user is editing an entity (opens an edit form, or a
 * mutating right-click action). Broadcasts presence to everyone viewing it and
 * auto-releases on unmount / tab close. `active` gates it (e.g. only while a
 * dialog is open).
 */
export function useAnnouncePresence(type: AttentionEntityType, id: string | undefined, active = true): void {
  useEffect(() => {
    if (!active || !id) return;
    emitPresenceEnter(type, id);
    const onUnload = () => emitPresenceLeave(type, id);
    window.addEventListener("beforeunload", onUnload);
    return () => {
      emitPresenceLeave(type, id);
      window.removeEventListener("beforeunload", onUnload);
    };
  }, [type, id, active]);
}

/**
 * Announce that the current user is editing a SET of entities (a mutating right-click
 * action on one or more table rows — "Copiar de outra tarefa", "Definir Setor", etc.).
 * Announces for every id while `active` (e.g. the action's modal is open) and releases
 * on close / unmount, so other users see the "is editing" indicator during the action.
 */
export function useAnnouncePresenceForIds(type: AttentionEntityType, ids: ReadonlyArray<string> | undefined, active = true): void {
  const key = active && ids?.length ? ids.join(",") : "";
  useEffect(() => {
    if (!key) return;
    const list = key.split(",");
    list.forEach((id) => emitPresenceEnter(type, id));
    const onUnload = () => list.forEach((id) => emitPresenceLeave(type, id));
    window.addEventListener("beforeunload", onUnload);
    return () => {
      list.forEach((id) => emitPresenceLeave(type, id));
      window.removeEventListener("beforeunload", onUnload);
    };
  }, [type, key]);
}

/** Non-hook: are there OTHER editors (not this tab) on the entity? For table row-action
 * `disabled` predicates that lock "Editar" while someone else has it open. */
export function hasOtherEditors(type: AttentionEntityType, id: string | undefined): boolean {
  return getEntityPresence(type, id).some((e) => e.clientId !== ATTENTION_CLIENT_ID);
}

/** Non-hook presence row-class resolver — a blue "being edited" ring. Excludes the
 * caller's OWN tab (stable clientId) so an editor's own row doesn't ring for themselves. */
export function presenceRowClassFor(type: AttentionEntityType, id: string | undefined): string {
  return getEntityPresence(type, id).some((e) => e.clientId !== ATTENTION_CLIENT_ID) ? "attention-presence-row" : "";
}

/** Re-render on any presence change (pair with presenceRowClassFor in tables). */
export function usePresenceVersion(): number {
  return useSyncExternalStore(subscribePresenceGlobal, getPresenceVersion, () => 0);
}

/**
 * Quiet an entity's `onView` rules when its detail page OPENS (ack on ENTER). Used by
 * cuts: opening a cut = "I'm handling it" → its row stops blinking. `onExitCooldown`
 * rules ignore this (they stop on exit instead) — see useMarkAttentionViewedOnExit.
 */
export function useMarkAttentionViewed(type: AttentionEntityType, id: string | undefined): void {
  useEffect(() => {
    if (id) markViewed(type, id);
  }, [type, id]);
}

/**
 * Quiet an entity's `onExitCooldown` rules when its detail page CLOSES (ack on EXIT /
 * id change). Used by tasks: while the page is open the field keeps blinking so you can
 * see WHICH field needs attention; on leaving it snoozes for the rule's cooldown (30 min)
 * and re-arms afterwards. MUST be declared AFTER useRegisterAttentionEntities so its
 * cleanup runs first (while the cycle is still alive) — React cleans effects up in reverse.
 */
export function useMarkAttentionViewedOnExit(type: AttentionEntityType, id: string | undefined): void {
  useEffect(() => {
    if (!id) return;
    return () => markViewed(type, id);
  }, [type, id]);
}

// ---------------------------------------------------------------------------
// className helpers — map a blink state to the CSS classes (see index.css).
// Additive: callers merge these via cn() so nothing else about the row/field changes.
// ---------------------------------------------------------------------------

/** Row-level class: a steady ring when attention is present, pulsing during a burst. */
export function attentionRowClass(state: AttentionState | null): string {
  if (!state?.active) return "";
  const harsh = state.match.rule.cadence.tone === "harsh";
  const ring = harsh ? "attention-row-ring-harsh" : "attention-row-ring-soft";
  return state.bursting ? `${ring} attention-row-burst` : ring;
}

/** Field-level class: highlights the field, blinking during a burst. */
export function attentionFieldClass(state: AttentionState | null): string {
  if (!state?.active) return "";
  const harsh = state.match.rule.cadence.tone === "harsh";
  const base = harsh ? "attention-field-harsh" : "attention-field-soft";
  return state.bursting ? `${base} attention-field-burst` : base;
}
