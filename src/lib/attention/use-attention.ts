// =====================================================
// Attention system — React hooks
// =====================================================
//
// The public surface components use. Nothing here owns the blink lifecycle — the
// engine does (see `engine.ts`); these hooks only SUBSCRIBE to a shared address's
// phase, so mounting/unmounting a row or opening a detail page never restarts or
// stops a running burst.

import { useEffect, useId, useMemo, useRef, useSyncExternalStore } from "react";

import { useAttentionRegistry } from "./attention-context";
import { emitPresenceEnter, emitPresenceLeave } from "./attention-socket";
import { getAddressState, getGlobalVersion, markViewed, subscribeAddress, subscribeGlobal } from "./engine";
import { formatEditingSince, getOtherEditors, getPresenceVersion, subscribePresenceGlobal, useOtherEditors } from "./presence";
import { useAttentionSurface } from "./surface";
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
  return getOtherEditors(type, id).length > 0;
}

/**
 * Why an action is locked, ready to drop into a tooltip — "Ana está editando há 4 min".
 * Returns "" when nothing holds the entity, so callers can use it as both the condition
 * and the message. A disabled control with no explanation is the thing users complain
 * about; this is what makes the lock legible.
 */
export function editLockReasonFor(type: AttentionEntityType, id: string | undefined): string {
  const others = getOtherEditors(type, id);
  if (others.length === 0) return "";
  if (others.length === 1) return `${others[0].userName} está editando ${formatEditingSince(others[0].since)}`;
  return `${others.length} pessoas estão editando agora`;
}

/**
 * Hook form: the edit lock for one entity.
 *
 * This is the primary override guard's read side — a surface that can mutate the entity
 * should disable (or confirm) its mutating affordances while `locked` is true, and show
 * `reason` so the user knows who and for how long.
 */
export function useEditLock(
  type: AttentionEntityType,
  id: string | undefined,
): { locked: boolean; editors: ReadonlyArray<{ userId: string; userName: string; since: number }>; reason: string } {
  const others = useOtherEditors(type, id);
  const reason =
    others.length === 0
      ? ""
      : others.length === 1
        ? `${others[0].userName} está editando ${formatEditingSince(others[0].since)}`
        : `${others.length} pessoas estão editando agora`;
  return { locked: others.length > 0, editors: others, reason };
}

/** Non-hook presence row-class resolver — a blue "being edited" ring. Excludes the
 * caller's OWN tab (stable clientId) so an editor's own row doesn't ring for themselves. */
export function presenceRowClassFor(type: AttentionEntityType, id: string | undefined): string {
  return getOtherEditors(type, id).length > 0 ? "attention-presence-row" : "";
}

/** Re-render on any presence change (pair with presenceRowClassFor in tables). */
export function usePresenceVersion(): number {
  return useSyncExternalStore(subscribePresenceGlobal, getPresenceVersion, () => 0);
}

/**
 * THE detail-page hook: register the record, honour every rule's ack policy, and hand back
 * the record's entity-level attention state.
 *
 * This is deliberately the only supported way for a detail page to take part. Pages used to
 * wire `useRegisterAttentionEntities` plus a hand-picked `markViewed` variant themselves,
 * which meant each page silently chose its own semantics — that is exactly how the task
 * detail and the cut detail came to behave in opposite ways. The POLICY lives on the rule
 * (`AttentionRule.ack`), not in the page:
 *
 *   • `onView`         → acked on ENTER. Opening the record is the acknowledgement.
 *   • `onExitCooldown` → acked on EXIT, so the targeted field keeps blinking while you are
 *                        on the page and you can see WHICH one needs attention. Subject to
 *                        `MIN_DWELL_MS` below.
 *
 * Both then stay quiet for the rule's `cadence.cooldownMs` and re-arm together (see
 * `markViewed`), so nav + row + detail always agree.
 *
 * Registration and acking share ONE effect on purpose: as separate hooks their unmount
 * order decided whether the ack could still see the record, which is a race React's
 * cleanup ordering is not obliged to keep on our side.
 *
 * Being on a record's page also counts as a SURFACE for its entity type, so the nav stops
 * blinking the moment the page opens and does not wait out the summary poll. It has to be
 * declared here rather than left to the route, because the same detail page is reachable from
 * several routes (Agenda, Cronograma, Histórico, a customer's task table) and only some of
 * them sit under the entity's nav paths — which is why "the nav only stopped after a reload"
 * depended on how you got there. Nothing is hidden for long: step off the record and the
 * indicator is back, unchanged.
 */
/**
 * How long a record has to stay open before LEAVING it counts as having looked at it.
 *
 * `onExitCooldown` reads "you saw which field it was and you are leaving anyway" — that
 * inference only holds if you were there long enough to read anything. Since the Orçamento and
 * Faturamento detail pages gained a prev/next pager, one click is a full mount + unmount, so
 * skimming forty records with `›` would silence forty alerts for four hours with nothing fixed —
 * quietly undoing the very triage the rules exist to enforce. Below the threshold the record was
 * paged THROUGH, not read, and the alert survives untouched.
 *
 * `onView` is deliberately NOT gated: those rules mean "opening it is the acknowledgement", and
 * a hop does open it.
 */
const MIN_DWELL_MS = 2500;

export function useAttentionEntity(
  type: AttentionEntityType | undefined,
  id: string | undefined,
  entity?: unknown,
): AttentionState | null {
  const sourceId = useId();
  const { register, unregister } = useAttentionRegistry();
  // `type` is undefined on a detail page that hasn't opted in; everything below no-ops.
  useAttentionSurface(type ?? "TASK", !!type && !!id);

  // What actually gets registered: the record itself when it carries the same id (so
  // predicates can read its fields), otherwise a bare stub so at least server-pushed
  // warnings and row-level rules still address it.
  const registered = useMemo<{ id: string } | null>(() => {
    if (!id) return null;
    const candidate = entity as { id?: unknown } | null | undefined;
    if (candidate && typeof candidate === "object" && String(candidate.id ?? "") === id) return candidate as { id: string };
    return { id };
  }, [id, entity]);

  // The freshest record, read by the on-exit ack AFTER the entity has been unregistered.
  const latest = useRef<{ id: string } | null>(registered);
  latest.current = registered;

  useEffect(() => {
    if (!type || !id) return;
    const openedAt = Date.now();
    register(sourceId, type, [latest.current ?? { id }]);
    // Opening the record answers the rules that ack on view (and any manual warning on it).
    markViewed(type, id, { snapshot: latest.current, policies: ["onView"] });
    return () => {
      const snapshot = latest.current;
      unregister(sourceId, type);
      // Leaving answers the rest — evaluated against the snapshot, so it does not matter
      // that the record is already unregistered by the time this runs. Paged THROUGH rather
      // than read (see MIN_DWELL_MS) leaves the alert exactly as it was.
      if (Date.now() - openedAt < MIN_DWELL_MS) return;
      markViewed(type, id, { snapshot, policies: ["onExitCooldown"] });
    };
  }, [register, unregister, sourceId, type, id]);

  // Re-register on every refetch so predicates see current values (an inline edit that fills
  // the missing chassis must clear the blink immediately, not on the next navigation).
  useEffect(() => {
    if (type && registered) register(sourceId, type, [registered]);
  }, [register, sourceId, type, registered]);

  return useAttention(type ?? "TASK", type ? id : undefined);
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
