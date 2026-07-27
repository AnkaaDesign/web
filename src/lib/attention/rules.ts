// =====================================================
// Attention system — rule registry (code-defined, Phase 1)
// =====================================================
//
// Rules are DATA. In Phase 1 they live here as typed constants (fast to ship,
// proves the engine); Phase 3 moves them behind an `AttentionRule` table + admin
// editor and this module becomes the seed / fallback. The engine and the config
// UI both consume the same `AttentionRule` shape, so nothing downstream changes
// when the source flips from code to DB.
//
// Field names are the REAL task fields (verified): Task.cleared:boolean,
// Task.entryDate, Task.forecastDate, Task.serialNumber; chassis/plate live on the
// related truck (truck.chassisNumber / truck.plate). Field targets name the
// DetailFieldDef id / DataTable column id so the exact field blinks.
//
// `truck.vinPlate` (Plaqueta) deliberately has NO rule: a missing plaqueta is not
// something anyone has to act on, and it fired on nearly every in-flight task.

import { SECTOR_PRIVILEGES, CUT_STATUS, TASK_STATUS } from "@/constants";

import type { AttentionCadence, AttentionRule, PredicateNode } from "./types";
import { NOW_SENTINEL } from "./types";

/**
 * Every TASK rule below implicitly means "...and this is still in flight" — a
 * COMPLETED or CANCELLED task's missing chassis/plate or overdue forecast is
 * history, not something to act on. Wrap each rule's real predicate with this so
 * a finished task can never light up (verified against prod data: without this
 * guard R2/R3a/R3b matched ~1900 already-COMPLETED tasks each).
 */
function whileInFlight(node: PredicateNode): PredicateNode {
  return {
    op: "and",
    nodes: [{ op: "ne", field: "status", value: TASK_STATUS.COMPLETED }, { op: "ne", field: "status", value: TASK_STATUS.CANCELLED }, node],
  };
}

/** Sensible cadence defaults; individual rules override what they need. */
function cadence(overrides: Partial<AttentionCadence> = {}): AttentionCadence {
  return {
    blinkCount: 5, // "blink/bip the 5x it will do"
    intervalMs: 750, // bip spacing; ~= pulseMs so blink and bip stay in step
    pulseMs: 750,
    soundEnabled: true,
    tone: "soft",
    cooldownMs: 30 * 60 * 1000, // the hardcoded-30min, now per rule
    ...overrides,
  };
}

/**
 * The Phase-1 rule set. Order is irrelevant (matches are keyed by rule id);
 * `priority` breaks ties when several rules hit the same address.
 */
export const ATTENTION_RULES: AttentionRule[] = [
  // R1 — cleared but no entry date yet → nudge logistics/prod-manager on the forecast.
  {
    id: "task.cleared-without-entry",
    name: "Liberado sem data de entrada",
    entityType: "TASK",
    enabled: true,
    priority: 10,
    targetSectors: [SECTOR_PRIVILEGES.LOGISTIC, SECTOR_PRIVILEGES.PRODUCTION_MANAGER],
    predicate: whileInFlight({
      op: "and",
      nodes: [
        { op: "isTrue", field: "cleared" },
        { op: "isNull", field: "entryDate" },
      ],
    }),
    target: { level: "field", field: "forecastDate" },
    ack: "onExitCooldown",
    cadence: cadence({ tone: "soft" }),
  },

  // R2 — forecast date passed and it is NOT cleared → higher urgency, harsh tone.
  {
    id: "task.forecast-overdue-not-cleared",
    name: "Previsão vencida sem liberação",
    entityType: "TASK",
    enabled: true,
    priority: 30,
    targetSectors: [SECTOR_PRIVILEGES.LOGISTIC, SECTOR_PRIVILEGES.PRODUCTION_MANAGER],
    predicate: whileInFlight({
      op: "and",
      nodes: [
        { op: "lt", field: "forecastDate", value: NOW_SENTINEL },
        { op: "isFalse", field: "cleared" },
      ],
    }),
    target: { level: "field", field: "forecastDate" },
    ack: "onExitCooldown",
    cadence: cadence({ tone: "harsh" }),
  },

  // R3a — truck is here (entry given) but the CHASSIS is missing → blink the chassis field.
  // Split from the plate rule so each blinks the field that is ACTUALLY empty (blinking a
  // filled chassis just because the plate is missing is misleading).
  {
    id: "task.entry-without-chassis",
    name: "Entrada sem chassi",
    entityType: "TASK",
    enabled: true,
    priority: 20,
    targetSectors: [SECTOR_PRIVILEGES.LOGISTIC, SECTOR_PRIVILEGES.PRODUCTION_MANAGER],
    predicate: whileInFlight({
      op: "and",
      nodes: [
        { op: "notNull", field: "entryDate" },
        { op: "isNull", field: "truck.chassisNumber" },
      ],
    }),
    target: { level: "field", field: "chassisNumber" },
    ack: "onExitCooldown",
    cadence: cadence({ tone: "soft" }),
  },

  // R3b — truck is here but the PLATE (truck.plate) is missing → blink the plate field.
  //
  // Gated on the task having NO serial number: the serial and the plate are two ways of
  // identifying the same vehicle, and a task that already carries a serial is identified.
  // Nagging for a plate it will never have is the kind of permanently-unresolvable alert
  // that teaches people to ignore the whole system.
  {
    id: "task.entry-without-plate",
    name: "Entrada sem placa",
    entityType: "TASK",
    enabled: true,
    priority: 20,
    targetSectors: [SECTOR_PRIVILEGES.LOGISTIC, SECTOR_PRIVILEGES.PRODUCTION_MANAGER],
    predicate: whileInFlight({
      op: "and",
      nodes: [
        { op: "notNull", field: "entryDate" },
        { op: "isNull", field: "serialNumber" },
        { op: "isNull", field: "truck.plate" },
      ],
    }),
    target: { level: "field", field: "plate" },
    ack: "onExitCooldown",
    cadence: cadence({ tone: "soft" }),
  },

  // R0 — the (previously hardcoded) cut signal, now expressible as a rule for
  // ROW-level blink on the cut table. The nav-menu aggregate alert still runs via
  // its existing path (use-nav-activity) untouched; this is additive.
  {
    id: "cut.pending",
    name: "Recorte pendente",
    entityType: "CUT",
    enabled: true,
    priority: 15,
    targetSectors: [SECTOR_PRIVILEGES.WAREHOUSE],
    predicate: { op: "eq", field: "status", value: CUT_STATUS.PENDING },
    target: { level: "row" },
    ack: "onView",
    cadence: cadence({ tone: "harsh", cooldownMs: 30 * 60 * 1000 }),
  },
];

/** Fast lookup by id (config UI / server sync will keep this in step later). */
export const ATTENTION_RULES_BY_ID: ReadonlyMap<string, AttentionRule> = new Map(ATTENTION_RULES.map((r) => [r.id, r]));
