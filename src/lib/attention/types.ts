// =====================================================
// Attention system — shared types
// =====================================================
//
// The Attention system blinks + bips a table ROW, a DETAIL page, or a single
// FIELD when a configurable business rule matches an entity (e.g. "task is
// cleared but has no entry date yet"). Rules are DATA (a serializable predicate
// + target + cadence), so the exact same descriptors can be evaluated on the
// client (which row/field to blink among loaded rows) and — later — on the
// server (nav badge, time-triggers). This file is the single source of truth
// for those descriptor shapes.
//
// Design note: the blink+bip LIFECYCLE is owned by a top-level engine keyed by
// `${ruleId}:${entityType}:${entityId}` — NOT by the row/field component. That
// is what lets a burst "play its full N cycles even after the user opens the
// detail page, then re-fire after a cooldown". Components only SUBSCRIBE to the
// shared phase (see `engine.ts` / `use-attention.ts`).

/** Entity kinds the attention system understands. Extend as rules are added. */
export type AttentionEntityType = "TASK" | "CUT";

export type PredicatePrimitive = string | number | boolean | null;

/** The sentinel that a predicate value resolves to "now" (epoch ms) at eval time. */
export const NOW_SENTINEL = "$now" as const;

/**
 * A serializable predicate over an entity. Field paths are dotted
 * (`truck.chassisNumber`) so related-record fields work. Date/`$now`
 * comparisons coerce both sides to epoch ms.
 */
export type PredicateNode =
  | { op: "and" | "or"; nodes: PredicateNode[] }
  | { op: "not"; node: PredicateNode }
  | { op: "eq" | "ne" | "gt" | "lt" | "gte" | "lte"; field: string; value: PredicatePrimitive | typeof NOW_SENTINEL }
  | { op: "isNull" | "notNull"; field: string }
  | { op: "isTrue" | "isFalse"; field: string };

/** Where the blink is applied. `field` names the DetailFieldDef id / column id. */
export type AttentionTarget = { level: "row" } | { level: "detail" } | { level: "field"; field: string };

/**
 * Stop policy — the crux of the forecast example:
 *  - `onView`         → silence when the user opens the entity's detail page (old cut behaviour).
 *  - `onResolve`      → silence only when the predicate becomes false (forecast updated / entry given).
 *  - `cycleThenCooldown` → always play the full burst, go quiet, wait `cooldownMs`, re-fire while
 *                          still matching. Opening the detail page does NOT stop it. Composes with
 *                          `onResolve` implicitly: a resolved predicate drops the match entirely.
 */
export type AttentionAckPolicy = "onView" | "onResolve" | "cycleThenCooldown";

export type AttentionTone = "harsh" | "soft" | "none";

export interface AttentionCadence {
  /** Number of blink pulses / bips per burst (was the cut alert's 3–5). */
  blinkCount: number;
  /** Spacing between bips inside a burst, ms (was BEEP_SPACING_MS = 800). */
  intervalMs: number;
  /** Duration of a single visual pulse, ms — kept ~= intervalMs so blink and bip align. */
  pulseMs: number;
  /** Play sound during the burst. Per-rule; user-mutable. */
  soundEnabled: boolean;
  /** Sound character; harsh reserved for high-priority rules. */
  tone: AttentionTone;
  /** Quiet window before a `cycleThenCooldown` rule re-fires, ms (was SNOOZE_MS = 30min). */
  cooldownMs: number;
}

export interface AttentionRule {
  /** Stable id — also the localStorage / server ack key prefix. */
  id: string;
  /** Human label for the config UI. */
  name: string;
  entityType: AttentionEntityType;
  enabled: boolean;
  /** Higher wins when several rules target the same address. */
  priority: number;
  /** SECTOR_PRIVILEGES values whose users should see this (ADMIN always inherits). */
  targetSectors: string[];
  predicate: PredicateNode;
  target: AttentionTarget;
  ack: AttentionAckPolicy;
  cadence: AttentionCadence;
}

/** A concrete rule↔entity hit produced by evaluating rules over loaded entities. */
export interface AttentionMatch {
  ruleId: string;
  entityType: AttentionEntityType;
  entityId: string;
  target: AttentionTarget;
  rule: AttentionRule;
}

/** The phase a subscriber (row/field/detail) reads for a given address. */
export interface AttentionState {
  /** A rule currently matches this address. */
  active: boolean;
  /** Currently inside a blink/bip burst (drives the animation class). */
  bursting: boolean;
  match: AttentionMatch;
}

/** Address of a blink target: `type:id` for row/detail, `type:id:field` for a field. */
export function addressKey(type: AttentionEntityType, id: string, field?: string): string {
  return field ? `${type}:${id}:${field}` : `${type}:${id}`;
}

/** Unique key for one rule firing on one entity (the engine's per-cycle key). */
export function matchKey(m: { ruleId: string; entityType: AttentionEntityType; entityId: string }): string {
  return `${m.ruleId}::${m.entityType}::${m.entityId}`;
}
