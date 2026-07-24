// =====================================================
// Attention system — the blink/bip ENGINE (module-level singleton)
// =====================================================
//
// Generalizes the single-alert state machine in `use-nav-activity-alert.ts`
// into a KEYED one: many concurrent (rule × entity) cycles, each blinking a row,
// a detail page, or a single field. The lifecycle is owned HERE, not by any
// component — that is the whole reason the forecast alert "plays its full 5×
// cycle even after you open the detail page, then re-fires after the cooldown":
// navigating just re-renders a subscriber; it never touches the cycle.
//
// Per (rule,entity) cycle:  idle → bursting → cooldown → (re-evaluate) → …
//   • bursting: `blinkCount` visual pulses + (if it owns the sound slot) bips.
//   • cooldown: quiet for `cadence.cooldownMs`; then reconcile re-fires if still matching.
//   • match disappears (predicate resolved / entity unloaded): cycle torn down.
//   • `onView` rules: acknowledged (silenced) when the user opens the entity's detail page.
//
// Sound is serialized by a single global slot so ten blinking rows never play ten
// overlapping bip streams; higher-priority cycles claim the slot first.
//
// Consumers never import this directly — they use the provider + hooks in
// `attention-context.tsx` / `use-attention.ts`.

import { canAccessAnyPrivilege } from "@/utils/privilege";
import { playAttentionBeep } from "@/utils/nav-alert-sound";

import { createLocalAckStore, type AttentionAckStore } from "./ack-store";
import { evaluatePredicate } from "./predicate";
import { ATTENTION_RULES } from "./rules";
import type { AttentionEntityType, AttentionCadence, AttentionMatch, AttentionRule, AttentionState, AttentionTarget } from "./types";
import { addressKey, matchKey } from "./types";

/** A manual / server-pushed attention already targeted at this user. */
export interface PushedAttention {
  /** Server id — unique per pushed warning; also the cycle/ack key suffix. */
  id: string;
  entityType: AttentionEntityType;
  entityId: string;
  target: AttentionTarget;
  cadence: AttentionCadence;
  priority: number;
  /** Optional human note shown in tooltips / the row overlay. */
  message?: string;
  /** Who sent it (display only). */
  fromUserName?: string;
  /** Auto-expire (epoch ms); omitted = until acknowledged/dismissed. */
  expiresAt?: number;
}

type Timer = ReturnType<typeof setTimeout>;

interface Cycle {
  match: AttentionMatch;
  status: "idle" | "bursting" | "cooldown";
  bipTimers: Timer[];
  burstTimer: Timer | null;
  wakeTimer: Timer | null;
}

// ---------------------------------------------------------------------------
// Engine state (single instance)
// ---------------------------------------------------------------------------

let ackStore: AttentionAckStore = createLocalAckStore();
let rules: AttentionRule[] = ATTENTION_RULES;
let userPrivilege: string | undefined;

/** Registered entities the engine can evaluate, per type: id → entity object. */
const entities = new Map<AttentionEntityType, Map<string, unknown>>();
/**
 * Server-pushed / manual attentions already targeted at THIS user (the "send a
 * warning" feature and, later, server-side rule pushes). They bypass local
 * predicate + privilege evaluation — the server decided they apply — and flow
 * through the same cycle machinery via a synthetic rule. Keyed by their own id.
 */
const pushed = new Map<string, PushedAttention>();
/** Live cycles keyed by matchKey. */
const cycles = new Map<string, Cycle>();
/** Immutable state per address, read by subscribers. */
const stateByAddress = new Map<string, AttentionState>();
/** Per-address listeners for fine-grained re-render. */
const addressListeners = new Map<string, Set<() => void>>();
/** Global listeners + version — for consumers (tables) that read many addresses
 * imperatively in a render pass (e.g. getRowClassName) and just need to re-render
 * whenever ANY attention state changed. */
const globalListeners = new Set<() => void>();
let globalVersion = 0;

/** Global sound slot — bips are silent until now >= this (serializes bursts). */
let soundSlotUntil = 0;

let reconcileScheduled = false;

// ackStore cross-tab changes should re-reconcile (a snooze set in another tab).
ackStore.subscribe(() => scheduleReconcile());

// ---------------------------------------------------------------------------
// Public configuration API (called by the provider)
// ---------------------------------------------------------------------------

export function configureAckStore(store: AttentionAckStore): void {
  ackStore = store;
  ackStore.subscribe(() => scheduleReconcile());
  scheduleReconcile();
}

export function setRules(next: AttentionRule[]): void {
  rules = next;
  scheduleReconcile();
}

/** Force a re-evaluation (e.g. after hydrating acks from the server). */
export function refreshAttention(): void {
  scheduleReconcile();
}

export function setUserPrivilege(privilege: string | undefined): void {
  if (privilege === userPrivilege) return;
  userPrivilege = privilege;
  scheduleReconcile();
}

/**
 * Replace the set of registered entities for one type coming from one SOURCE
 * (a table page, a detail page). Multiple sources are merged by the caller
 * (the provider keeps a per-source registry) before calling this.
 */
export function setEntities(type: AttentionEntityType, list: ReadonlyArray<{ id: string }>): void {
  const map = new Map<string, unknown>();
  for (const e of list) if (e && e.id != null) map.set(String(e.id), e);
  entities.set(type, map);
  scheduleReconcile();
}

/** Build the synthetic rule that carries a pushed/manual attention through the engine. */
function pushedRule(p: PushedAttention): AttentionRule {
  return {
    id: `push:${p.id}`,
    name: p.message ?? "Aviso",
    entityType: p.entityType,
    enabled: true,
    priority: p.priority,
    targetSectors: [], // already targeted at this user by the server
    predicate: { op: "notNull", field: "id" }, // unused for pushed (no local eval)
    target: p.target,
    ack: "onView",
    cadence: p.cadence,
  };
}

/** Add (or replace) a manual/server-pushed attention targeted at this user. */
export function addPushedAttention(p: PushedAttention): void {
  pushed.set(p.id, p);
  if (p.expiresAt) {
    const delay = p.expiresAt - Date.now();
    if (delay > 0) setTimeout(() => scheduleReconcile(), delay + 30);
  }
  scheduleReconcile();
}

/** Replace the entire set of pushed attentions (e.g. a socket sync snapshot). */
export function setPushedAttentions(list: ReadonlyArray<PushedAttention>): void {
  pushed.clear();
  for (const p of list) pushed.set(p.id, p);
  scheduleReconcile();
}

/** Remove a pushed attention (dismissed / cleared by server). */
export function dismissPushedAttention(id: string): void {
  if (pushed.delete(id)) scheduleReconcile();
}

/**
 * The user "viewed" an entity (opened its detail page). Quiets its currently-blinking
 * cycles per each rule's ack policy:
 *  - `onView` (cuts): acknowledge → silent until the predicate re-matches. Call this
 *    ON ENTER (opening the cut = "I'm handling it").
 *  - `onExitCooldown` (tasks): snooze for `cadence.cooldownMs` (30 min) → re-arm after.
 *    Call this ON EXIT (leaving the detail = "I've seen it, remind me later"), so while
 *    the page is open the field keeps blinking and the user can locate it.
 * Only cycles that are actively blinking are touched, so it's a no-op mid-cooldown.
 */
export function markViewed(type: AttentionEntityType, id: string): void {
  const entity = entities.get(type)?.get(id);
  const now = Date.now();
  let changed = false;
  // Write the ack to the STORE for every rule that currently matches this entity (or has a
  // live cycle). We do NOT touch cycles here — reconcile is the single authority that quiets
  // them from the store. This removes the race where the ack fired before the cycle had armed
  // (the "I opened the cut and it didn't stop" bug).
  for (const rule of rules) {
    if (rule.entityType !== type || !ruleAppliesToUser(rule)) continue;
    const key = matchKey({ ruleId: rule.id, entityType: type, entityId: id });
    const matches = entity ? evaluatePredicate(rule.predicate, entity, now) : false;
    if (!matches && !cycles.has(key)) continue; // never preemptively silence a non-matching rule
    if (rule.ack === "onView") ackStore.patch(key, { acknowledged: true });
    else ackStore.patch(key, { snoozeUntil: now + rule.cadence.cooldownMs });
    changed = true;
  }
  // Manual/pushed warnings for this entity are acknowledged on view too (they're onView).
  for (const p of pushed.values()) {
    if (p.entityType !== type || p.entityId !== id) continue;
    ackStore.patch(matchKey({ ruleId: `push:${p.id}`, entityType: type, entityId: id }), { acknowledged: true });
    changed = true;
  }
  if (changed) scheduleReconcile();
}

/** Manual snooze (e.g. a "silenciar" affordance) for a rule×entity. */
export function snooze(rule: AttentionRule, id: string, ms: number): void {
  const key = matchKey({ ruleId: rule.id, entityType: rule.entityType, entityId: id });
  ackStore.patch(key, { snoozeUntil: Date.now() + ms });
  scheduleReconcile();
}

// ---------------------------------------------------------------------------
// Subscription API (used by useSyncExternalStore in the hooks)
// ---------------------------------------------------------------------------

export function subscribeAddress(address: string, cb: () => void): () => void {
  let set = addressListeners.get(address);
  if (!set) {
    set = new Set();
    addressListeners.set(address, set);
  }
  set.add(cb);
  return () => {
    set!.delete(cb);
    if (set!.size === 0) addressListeners.delete(address);
  };
}

export function getAddressState(address: string): AttentionState | null {
  return stateByAddress.get(address) ?? null;
}

export function subscribeGlobal(cb: () => void): () => void {
  globalListeners.add(cb);
  return () => globalListeners.delete(cb);
}

export function getGlobalVersion(): number {
  return globalVersion;
}

/**
 * Count of DISTINCT entities that are ACTIVELY BLINKING (armed), per type (entity-level
 * addresses only, so a row with two field alerts counts once). Drives the nav-menu blink.
 * Deliberately counts `st.bursting` (armed), NOT merely `st.active` — so the nav "follows"
 * the row: once a row is viewed and goes to its resting/static ring, it no longer blinks,
 * and neither does the nav. Loaded entities only; the server summary covers the rest.
 */
export function getAttentionCountsByType(): Map<AttentionEntityType, number> {
  const m = new Map<AttentionEntityType, number>();
  for (const [addr, st] of stateByAddress) {
    if (!st.active) continue; // ANY attention (armed OR resting) → the nav shows an indicator
    if (addr.split(":").length !== 2) continue; // `type:id` only (skip `type:id:field`)
    m.set(st.match.entityType, (m.get(st.match.entityType) ?? 0) + 1);
  }
  return m;
}

/**
 * Whether any entity of a type is currently ARMED (actively blinking) vs merely resting.
 * Drives whether the nav BLINKS (armed) or shows a STATIC border (resting) — so the nav
 * mirrors the row exactly: blinking row → blinking nav, resting/static row → static nav.
 */
export function getAttentionArmedByType(): Map<AttentionEntityType, boolean> {
  const m = new Map<AttentionEntityType, boolean>();
  for (const [addr, st] of stateByAddress) {
    if (!st.bursting) continue;
    if (addr.split(":").length !== 2) continue;
    m.set(st.match.entityType, true);
  }
  return m;
}

/**
 * Highest severity (`harsh` beats `soft`) currently active per type — drives the
 * nav-menu blink COLOR so it mirrors what it points to: red when any urgent (harsh)
 * rule matches, amber when everything active is routine (soft). Loaded entities only
 * (the server summary carries the same harsh flag for the unloaded/global case).
 */
export function getAttentionSeverityByType(): Map<AttentionEntityType, "harsh" | "soft"> {
  const m = new Map<AttentionEntityType, "harsh" | "soft">();
  for (const [addr, st] of stateByAddress) {
    if (!st.active) continue; // color reflects the whole active set (armed + resting)
    if (addr.split(":").length !== 2) continue; // entity-level addresses only
    const tone = st.match.rule.cadence.tone === "harsh" ? "harsh" : "soft";
    if (tone === "harsh" || !m.has(st.match.entityType)) m.set(st.match.entityType, tone);
  }
  return m;
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

function ruleAppliesToUser(rule: AttentionRule): boolean {
  if (!rule.enabled) return false;
  if (rule.targetSectors.length === 0) return true; // untargeted = everyone
  if (!userPrivilege) return false;
  return canAccessAnyPrivilege(userPrivilege as never, rule.targetSectors as never);
}

/** Coalesce reconciles fired in the same tick (many setEntities in one render). */
function scheduleReconcile(): void {
  if (reconcileScheduled) return;
  reconcileScheduled = true;
  queueMicrotask(() => {
    reconcileScheduled = false;
    reconcile();
  });
}

function notify(address: string): void {
  addressListeners.get(address)?.forEach((l) => l());
}

/** Recompute matches, drive cycles, and republish per-address state. */
function reconcile(): void {
  const now = Date.now();

  // 1) Evaluate rules over registered entities → current matches.
  const matched = new Map<string, AttentionMatch>();
  for (const rule of rules) {
    if (!ruleAppliesToUser(rule)) continue;
    const byId = entities.get(rule.entityType);
    if (!byId) continue;
    for (const [id, entity] of byId) {
      if (!evaluatePredicate(rule.predicate, entity, now)) continue;
      matched.set(matchKey({ ruleId: rule.id, entityType: rule.entityType, entityId: id }), {
        ruleId: rule.id,
        entityType: rule.entityType,
        entityId: id,
        target: rule.target,
        rule,
      });
    }
  }

  // 1b) Add manual / server-pushed attentions (already targeted at this user).
  for (const p of pushed.values()) {
    if (p.expiresAt && p.expiresAt <= now) continue;
    const rule = pushedRule(p);
    matched.set(matchKey({ ruleId: rule.id, entityType: p.entityType, entityId: p.entityId }), {
      ruleId: rule.id,
      entityType: p.entityType,
      entityId: p.entityId,
      target: p.target,
      rule,
    });
  }

  // 2) Tear down cycles whose match disappeared.
  for (const [key, cycle] of cycles) {
    if (matched.has(key)) continue;
    const { entityType, entityId } = cycle.match;
    // RESOLVED (entity still loaded, but predicate now false) → clear ack + snooze so a
    // future recurrence re-alerts immediately. UNREGISTERED (entity no longer loaded, e.g.
    // navigated to another page) → KEEP the ack/snooze so returning respects the cooldown
    // and doesn't re-bip. (This is what stops "it bips every time I open the table".)
    const stillLoaded = entities.get(entityType)?.has(entityId) ?? false;
    teardownCycle(key, cycle);
    cycles.delete(key);
    if (stillLoaded) {
      const rec = ackStore.get(key);
      if (rec && (rec.acknowledged || rec.snoozeUntil)) ackStore.patch(key, { acknowledged: false, snoozeUntil: 0 });
    }
  }

  // 3) Drive EVERY matched cycle to its desired state (idempotent — no dependence on
  //    "newly created", so a view/ack written to the store is always honored on the next
  //    reconcile regardless of timing). armed ⇔ matches AND not acknowledged AND not snoozed.
  const matchList = [...matched.values()].sort((a, b) => b.rule.priority - a.rule.priority);
  for (const match of matchList) {
    const key = matchKey(match);
    let cycle = cycles.get(key);
    if (!cycle) {
      cycle = { match, status: "idle", bipTimers: [], burstTimer: null, wakeTimer: null };
      cycles.set(key, cycle);
    } else {
      cycle.match = match; // freshest entity snapshot
    }
    const rec = ackStore.get(key);
    const snoozed = !!rec && rec.snoozeUntil > now;
    const acked = !!rec?.acknowledged;
    if (!snoozed && !acked) {
      if (cycle.status !== "bursting") armCycle(key); // start (or resume) blinking
    } else {
      if (cycle.status === "bursting") quietCycle(cycle);
      else cycle.status = "cooldown";
      // A snoozed (onExitCooldown) cycle re-arms when the snooze expires; an acknowledged
      // (onView) cycle stays quiet until the predicate resolves (no wake).
      if (snoozed && !acked) {
        if (cycle.wakeTimer) clearTimeout(cycle.wakeTimer);
        cycle.wakeTimer = setTimeout(() => reEvaluate(key), rec!.snoozeUntil - now + 30);
      }
    }
  }

  // 4) Republish per-address state and notify only changed addresses.
  publish();
}

/** A cooled-down cycle's wake fired → re-arm (blink again) if still matching + un-acked. */
function reEvaluate(key: string): void {
  const cycle = cycles.get(key);
  if (!cycle) return;
  cycle.wakeTimer = null;
  const rec = ackStore.get(key);
  const now = Date.now();
  if (rec?.acknowledged || (rec && rec.snoozeUntil > now)) {
    cycle.status = "cooldown";
    publish();
    return;
  }
  armCycle(key);
  publish();
}

/** How often an armed cycle repeats its bip burst (the visual blink is continuous). */
const BIP_REPEAT_MS = 60 * 1000;

/**
 * ARM a cycle: it BLINKS CONTINUOUSLY (the CSS `-burst` class loops while status is
 * "bursting") and bips PERIODICALLY. The bip is gated by `lastFiredAt` so navigating
 * away and back does NOT re-bip immediately (only the visual blink resumes) — the bip
 * fires at most once per BIP_REPEAT_MS per entity, like the nav alert. Viewing the entity
 * (markViewed → ack) or resolving the predicate is what stops it.
 */
function armCycle(key: string): void {
  const cycle = cycles.get(key);
  if (!cycle || cycle.status === "bursting") return;
  cycle.status = "bursting";
  const rec = ackStore.get(key);
  const sinceLastBip = Date.now() - (rec?.lastFiredAt ?? 0);
  if (sinceLastBip >= BIP_REPEAT_MS) {
    scheduleBip(key, true); // been quiet a while → bip now
  } else {
    scheduleBip(key, false, BIP_REPEAT_MS - sinceLastBip); // bipped recently → wait, no re-bip
  }
}

/** Play one bip burst (if `bipNow` and it wins the shared sound slot) and schedule the next. */
function scheduleBip(key: string, bipNow: boolean, delayMs = BIP_REPEAT_MS): void {
  const cycle = cycles.get(key);
  if (!cycle || cycle.status !== "bursting") return;
  const { cadence } = cycle.match.rule;
  const now = Date.now();
  if (bipNow && cadence.soundEnabled && cadence.tone !== "none" && now >= soundSlotUntil) {
    const burstMs = Math.max(1, cadence.blinkCount) * cadence.intervalMs;
    soundSlotUntil = now + burstMs;
    ackStore.patch(key, { lastFiredAt: now });
    cycle.bipTimers.forEach(clearTimeout);
    cycle.bipTimers = [];
    for (let i = 0; i < cadence.blinkCount; i++) {
      cycle.bipTimers.push(setTimeout(() => playAttentionBeep(cadence.tone), i * cadence.intervalMs));
    }
  }
  if (cycle.burstTimer) clearTimeout(cycle.burstTimer);
  cycle.burstTimer = setTimeout(() => scheduleBip(key, true), delayMs);
}

/** Stop an armed cycle's blink + bips (shared by markViewed's two policies). */
function quietCycle(cycle: Cycle): void {
  cycle.bipTimers.forEach(clearTimeout);
  cycle.bipTimers = [];
  if (cycle.burstTimer) {
    clearTimeout(cycle.burstTimer);
    cycle.burstTimer = null;
  }
  cycle.status = "cooldown";
}

function teardownCycle(_key: string, cycle: Cycle): void {
  cycle.bipTimers.forEach(clearTimeout);
  cycle.bipTimers = [];
  if (cycle.burstTimer) clearTimeout(cycle.burstTimer);
  if (cycle.wakeTimer) clearTimeout(cycle.wakeTimer);
  cycle.burstTimer = null;
  cycle.wakeTimer = null;
  cycle.status = "idle";
}

/**
 * Rebuild `stateByAddress` from live cycles and notify addresses whose state
 * actually changed. Row/detail addresses aggregate every match on the entity
 * (highest priority wins as representative; bursting if ANY is bursting); field
 * addresses reflect the matching field-target rule.
 */
function publish(): void {
  const next = new Map<string, AttentionState>();

  const consider = (address: string, match: AttentionMatch, bursting: boolean) => {
    const existing = next.get(address);
    // Higher priority wins the representative slot; bursting is OR-ed in.
    if (!existing || match.rule.priority > existing.match.rule.priority) {
      next.set(address, { active: true, bursting: bursting || existing?.bursting || false, match });
    } else if (bursting && !existing.bursting) {
      next.set(address, { ...existing, bursting: true });
    }
  };

  for (const cycle of cycles.values()) {
    const bursting = cycle.status === "bursting";
    const { entityType, entityId, target } = cycle.match;
    // Row/detail address: any match on the entity lights the row + detail page.
    consider(addressKey(entityType, entityId), cycle.match, bursting);
    // Field address: only field-target rules light a specific field.
    if (target.level === "field") {
      consider(addressKey(entityType, entityId, target.field), cycle.match, bursting);
    }
  }

  // Diff against current published state → notify only changed addresses.
  const changed = new Set<string>();
  for (const [address, st] of next) {
    const prev = stateByAddress.get(address);
    if (!prev || prev.active !== st.active || prev.bursting !== st.bursting || prev.match.ruleId !== st.match.ruleId) {
      changed.add(address);
    }
  }
  for (const address of stateByAddress.keys()) if (!next.has(address)) changed.add(address);

  // Commit, PRESERVING object references for unchanged addresses. useSyncExternalStore
  // requires getSnapshot to return a stable value when nothing changed; rebuilding a
  // fresh object every reconcile would otherwise loop re-renders / trip the cache check.
  const committed = new Map<string, AttentionState>();
  for (const [address, st] of next) {
    committed.set(address, changed.has(address) ? st : stateByAddress.get(address) ?? st);
  }
  stateByAddress.clear();
  for (const [address, st] of committed) stateByAddress.set(address, st);
  for (const address of changed) notify(address);
  if (changed.size > 0) {
    globalVersion++;
    globalListeners.forEach((l) => l());
  }
}

/** Full teardown (logout / provider unmount). */
export function resetEngine(): void {
  for (const [key, cycle] of cycles) teardownCycle(key, cycle);
  cycles.clear();
  entities.clear();
  pushed.clear();
  soundSlotUntil = 0;
  const addrs = [...stateByAddress.keys()];
  stateByAddress.clear();
  addrs.forEach(notify);
}
