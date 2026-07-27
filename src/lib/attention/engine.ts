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
import type {
  AttentionAckPolicy,
  AttentionEntityType,
  AttentionCadence,
  AttentionMatch,
  AttentionRule,
  AttentionState,
  AttentionTarget,
} from "./types";
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

/**
 * Entity types the user is currently LOOKING AT (see `surface.ts`). Their cycles keep
 * blinking — the ring is the signal — but they do not bip: beeping at someone about a row
 * already in front of them is the single most-complained-about part of this feature.
 */
let activeSurfaces: ReadonlySet<AttentionEntityType> = new Set();

export function setActiveSurfaces(types: ReadonlySet<AttentionEntityType>): void {
  activeSurfaces = types;
}

let reconcileScheduled = false;

/**
 * Fired whenever an ack is written (a record was viewed, or a resolved match cleared its
 * cooldown). The provider uses it to refresh the SERVER summary, which is the other half of
 * the nav signal: without it the nav kept blinking for up to a poll interval after the row
 * had gone quiet, so it only appeared to settle "after a reload".
 */
const ackListeners = new Set<() => void>();

export function subscribeAckWritten(cb: () => void): () => void {
  ackListeners.add(cb);
  return () => ackListeners.delete(cb);
}

function notifyAckWritten(): void {
  ackListeners.forEach((l) => l());
}

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
 * The user "viewed" an entity (opened its detail page) → quiet it for the rule's
 * `cadence.cooldownMs`, then re-arm if it still matches.
 *
 * There is ONE quiet axis (`snoozeUntil`) for every rule and every entity type. A
 * rule's `ack` policy decides only WHEN this is called — `onView` on enter, `onExitCooldown`
 * on exit (see `useAttentionEntity`) — never whether the signal ever comes back. That
 * matters because the nav, the table row and the detail page all read the same cycle: an
 * ack that silenced one of them permanently while the others re-armed on a cooldown is
 * exactly how they came to contradict each other.
 *
 * `acknowledged` is still recorded (it is what "the user has seen this at least once"
 * means, and the server reports it) but it does NOT gate the blink.
 *
 * `opts.snapshot` lets a caller pass the entity it is about to unregister. React runs
 * unmount cleanups in DECLARATION order, so a detail page's `unregister` fires before its
 * `markViewed`; without the snapshot the predicate could not be evaluated and the ack
 * would depend on cycle-teardown timing.
 *
 * `opts.policies` restricts the write to rules with those `ack` policies, which is how one
 * mount can honour BOTH policies on the same entity: ack the `onView` rules on enter and
 * the `onExitCooldown` ones on exit. Omitted = every policy.
 */
export function markViewed(
  type: AttentionEntityType,
  id: string,
  opts: { snapshot?: unknown; policies?: ReadonlyArray<AttentionAckPolicy> } = {},
): void {
  const { snapshot, policies } = opts;
  const entity = snapshot ?? entities.get(type)?.get(id);
  const now = Date.now();
  let changed = false;
  // Write the ack to the STORE for every rule that currently matches this entity (or has a
  // live cycle). We do NOT touch cycles here — reconcile is the single authority that quiets
  // them from the store. This removes the race where the ack fired before the cycle had armed
  // (the "I opened the cut and it didn't stop" bug).
  for (const rule of rules) {
    if (rule.entityType !== type || !ruleAppliesToUser(rule)) continue;
    if (policies && !policies.includes(rule.ack)) continue;
    const key = matchKey({ ruleId: rule.id, entityType: type, entityId: id });
    const matches = entity ? evaluatePredicate(rule.predicate, entity, now) : false;
    if (!matches && !cycles.has(key)) continue; // never preemptively silence a non-matching rule
    ackStore.patch(key, { acknowledged: true, snoozeUntil: now + rule.cadence.cooldownMs });
    changed = true;
  }
  // Manual/pushed warnings for this entity quiet on view on the same single axis. They are
  // synthesised with `ack: "onView"` (see `pushedRule`), so an on-exit pass skips them —
  // a warning someone sent you is answered by OPENING the record, not by leaving it.
  for (const p of pushed.values()) {
    if (policies && !policies.includes("onView")) break;
    if (p.entityType !== type || p.entityId !== id) continue;
    ackStore.patch(matchKey({ ruleId: `push:${p.id}`, entityType: type, entityId: id }), {
      acknowledged: true,
      snoozeUntil: now + p.cadence.cooldownMs,
    });
    changed = true;
  }
  if (changed) {
    scheduleReconcile();
    notifyAckWritten();
  }
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
 * What the nav needs to know about one entity type, in the SAME vocabulary every other
 * surface uses:
 *   • `count`  — distinct entities with any attention (armed OR resting). 0 ⇒ show nothing.
 *   • `armed`  — at least one is actively blinking ⇒ the nav BLINKS. Otherwise it shows a
 *                STATIC border, mirroring a viewed row's resting ring. A resting entity is
 *                never made to VANISH from the nav; that is the whole point of the axis.
 *   • `harsh`  — highest severity present ⇒ red vs amber, mirroring the row's colour.
 */
export interface AttentionTypeSnapshot {
  count: number;
  armed: boolean;
  harsh: boolean;
}

/**
 * One pass over published state → per-type snapshot. Entity-level addresses only, so a
 * row with two field alerts counts once. Loaded entities only; the server summary carries
 * the same three numbers for entities no mounted page has registered.
 */
export function getAttentionSnapshot(): Map<AttentionEntityType, AttentionTypeSnapshot> {
  const m = new Map<AttentionEntityType, AttentionTypeSnapshot>();
  for (const [addr, st] of stateByAddress) {
    if (!st.active) continue;
    if (addr.split(":").length !== 2) continue; // `type:id` only (skip `type:id:field`)
    const cur = m.get(st.match.entityType) ?? { count: 0, armed: false, harsh: false };
    cur.count += 1;
    if (st.bursting) cur.armed = true;
    if (st.match.rule.cadence.tone === "harsh") cur.harsh = true;
    m.set(st.match.entityType, cur);
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
      if (rec && (rec.acknowledged || rec.snoozeUntil)) {
        ackStore.patch(key, { acknowledged: false, snoozeUntil: 0 });
        notifyAckWritten(); // the server's suppression list changed too
      }
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
    // ONE quiet axis for every rule and every entity type (see markViewed). Whatever
    // quieted the cycle, it re-arms on the same cooldown — so the nav, the row and the
    // detail page can never disagree about whether this entity is still asking for action.
    const snoozed = !!rec && rec.snoozeUntil > now;
    if (!snoozed) {
      if (cycle.status !== "bursting") armCycle(key); // start (or resume) blinking
    } else {
      if (cycle.status === "bursting") quietCycle(cycle);
      else cycle.status = "cooldown";
      if (cycle.wakeTimer) clearTimeout(cycle.wakeTimer);
      cycle.wakeTimer = setTimeout(() => reEvaluate(key), rec!.snoozeUntil - now + 30);
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
  if (rec && rec.snoozeUntil > now) {
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
  const onSurface = activeSurfaces.has(cycle.match.entityType);
  if (bipNow && !onSurface && cadence.soundEnabled && cadence.tone !== "none" && now >= soundSlotUntil) {
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
