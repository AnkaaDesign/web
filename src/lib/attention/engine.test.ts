// Guarantees the Attention system's three surfaces (nav / table row / detail page) always
// agree. Each of these assertions corresponds to a way they were observed to disagree:
// a cut whose row stayed red forever while its nav entry re-blinked, a task whose nav kept
// blinking after the row went quiet, and a queue that beeped at the user staring at it.

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// `vi.mock` is hoisted above the imports, so the spy has to be created in a hoisted block too.
const { playAttentionBeep } = vi.hoisted(() => ({ playAttentionBeep: vi.fn() }));
vi.mock("@/utils/nav-alert-sound", () => ({ playAttentionBeep, playAnnoyingBeep: vi.fn() }));

import { SECTOR_PRIVILEGES, CUT_STATUS, TASK_STATUS, TASK_QUOTE_STATUS } from "@/constants";
import { PINNED_CUSTOMERS } from "@/config/company";

import { createLocalAckStore } from "./ack-store";
import {
  configureAckStore,
  getAddressState,
  getAttentionSnapshot,
  markViewed,
  resetEngine,
  setEntities,
  setRemoteMatches,
  setUserPrivilege,
} from "./engine";
import { ATTENTION_RULES } from "./rules";
import { addressKey } from "./types";
import type { AttentionEntityType } from "./types";

const COOLDOWN_MS = 30 * 60 * 1000; // the cadence() default, used by every rule these tests touch

/** Let the engine's queueMicrotask reconcile run. */
const settle = () => vi.advanceTimersByTimeAsync(1);

const overdueTask = {
  id: "task-1",
  status: TASK_STATUS.IN_PRODUCTION,
  cleared: false,
  entryDate: null,
  serialNumber: "SN-1",
  // R2 "Previsão vencida sem liberação" — harsh, ack: onExitCooldown, target: forecastDate
  forecastDate: new Date("2026-01-01T00:00:00Z"),
  truck: { chassisNumber: "CH", plate: "ABC1D23" },
};

/** R0 "Recorte pendente" — harsh, ack: onView, target: row */
const pendingCut = { id: "cut-1", status: CUT_STATUS.PENDING };

function row(type: AttentionEntityType, id: string) {
  const st = getAddressState(addressKey(type, id));
  return st ? { active: st.active, bursting: st.bursting } : null;
}

function field(type: AttentionEntityType, id: string, name: string) {
  const st = getAddressState(addressKey(type, id, name));
  return st ? { active: st.active, bursting: st.bursting } : null;
}

const ARMED = { active: true, bursting: true };
const RESTING = { active: true, bursting: false };

beforeEach(async () => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-07-26T12:00:00Z"));
  playAttentionBeep.mockClear();
  resetEngine();
  // The ack store is a module singleton backed by localStorage — give each test a clean one.
  // (localStorage is absent in this environment; the store degrades to in-memory by design.)
  globalThis.localStorage?.clear?.();
  configureAckStore(createLocalAckStore());
  setUserPrivilege(SECTOR_PRIVILEGES.ADMIN);
  await settle();
});

afterEach(() => {
  resetEngine();
  vi.useRealTimers();
});

describe("TASK — ack: onExitCooldown", () => {
  it("keeps the targeted field blinking while the detail page is open, then rests on exit", async () => {
    setEntities("TASK", [overdueTask]); // the list
    await settle();
    expect(row("TASK", "task-1")).toEqual(ARMED);
    expect(field("TASK", "task-1", "forecastDate")).toEqual(ARMED);

    // Open the detail: on-view acks must NOT touch an onExitCooldown rule, so the field keeps
    // blinking — that is how the user sees WHICH field needs attention.
    markViewed("TASK", "task-1", { snapshot: overdueTask, policies: ["onView"] });
    await settle();
    expect(field("TASK", "task-1", "forecastDate")).toEqual(ARMED);

    // Leave. `useAttentionEntity` unregisters first, so the ack runs against a snapshot.
    setEntities("TASK", []);
    markViewed("TASK", "task-1", { snapshot: overdueTask, policies: ["onExitCooldown"] });
    await settle();

    setEntities("TASK", [overdueTask]); // back on the list
    await settle();
    expect(row("TASK", "task-1")).toEqual(RESTING);
    expect(field("TASK", "task-1", "forecastDate")).toEqual(RESTING);
  });

  it("acks even though the record is unregistered before markViewed runs", async () => {
    // React runs unmount cleanups in DECLARATION order, so `unregister` fires BEFORE the
    // ack. Without the snapshot the predicate could not be evaluated and the row came back
    // blinking as if never viewed.
    setEntities("TASK", [overdueTask]);
    await settle();
    setEntities("TASK", []);
    markViewed("TASK", "task-1", { snapshot: overdueTask, policies: ["onExitCooldown"] });
    await settle();
    setEntities("TASK", [overdueTask]);
    await settle();
    expect(row("TASK", "task-1")).toEqual(RESTING);
  });
});

describe("TASK — R3b, plate only when there is no serial number", () => {
  /**
   * Truck already on site (entryDate given), forecast still in the future → only R3a/R3b/R3c
   * can fire. `vinPlateId` starts FILLED so these cases isolate the plate rule; R3c has its
   * own describe below.
   */
  const arrived = (over: Record<string, unknown>) => ({
    id: "task-3",
    status: TASK_STATUS.IN_PRODUCTION,
    cleared: false,
    entryDate: new Date("2026-07-01T00:00:00Z"),
    forecastDate: new Date("2026-12-01T00:00:00Z"), // not overdue → R2 silent
    serialNumber: null as string | null,
    truck: { chassisNumber: "CH", plate: null as string | null, vinPlateId: "file-1" as string | null },
    ...over,
  });

  it("blinks the plate field when the task has no serial number", async () => {
    setEntities("TASK", [arrived({ serialNumber: null })]);
    await settle();
    expect(field("TASK", "task-3", "plate")).toEqual(ARMED);
  });

  it("stays silent when the task carries a serial number", async () => {
    // The serial and the plate identify the same vehicle; a task with a serial is identified,
    // so a missing plate is not work anyone has to do.
    setEntities("TASK", [arrived({ serialNumber: "SN-3" })]);
    await settle();
    expect(row("TASK", "task-3")).toBeNull();
  });
});

describe("TASK — R3c, plaqueta photo", () => {
  /** Everything the OTHER rules want is filled in, so only R3c can fire. */
  const arrived = (over: Record<string, unknown>) => ({
    id: "task-4",
    status: TASK_STATUS.IN_PRODUCTION,
    cleared: false,
    entryDate: new Date("2026-07-01T00:00:00Z"),
    forecastDate: new Date("2026-12-01T00:00:00Z"),
    serialNumber: "SN-4",
    truck: { chassisNumber: "CH", plate: "ABC1D23", vinPlateId: null as string | null },
    ...over,
  });

  it("blinks the plaqueta field when the photo is missing", async () => {
    setEntities("TASK", [arrived({})]);
    await settle();
    expect(field("TASK", "task-4", "vinPlate")).toEqual(ARMED);
  });

  it("stays silent once the photo is attached", async () => {
    setEntities("TASK", [arrived({ truck: { chassisNumber: "CH", plate: "ABC1D23", vinPlateId: "file-9" } })]);
    await settle();
    expect(row("TASK", "task-4")).toBeNull();
  });

  it("stays silent before the truck arrives", async () => {
    // Sem data de entrada o veículo ainda não está aqui — não há plaqueta para fotografar.
    setEntities("TASK", [arrived({ entryDate: null })]);
    await settle();
    expect(field("TASK", "task-4", "vinPlate")).toBeNull();
  });

  it("stays silent on a finished task", async () => {
    setEntities("TASK", [arrived({ status: TASK_STATUS.COMPLETED })]);
    await settle();
    expect(row("TASK", "task-4")).toBeNull();
  });
});

describe("CUT — ack: onView", () => {
  it("rests as soon as the detail page opens", async () => {
    setEntities("CUT", [pendingCut]);
    await settle();
    expect(row("CUT", "cut-1")).toEqual(ARMED);

    markViewed("CUT", "cut-1", { snapshot: pendingCut, policies: ["onView"] });
    await settle();
    expect(row("CUT", "cut-1")).toEqual(RESTING);
  });

  it("RE-ARMS after the cooldown instead of resting forever", async () => {
    // The regression this pins: `acknowledged` used to quiet an onView cycle permanently with
    // no wake timer, while the nav's own 30-min snooze expired and re-blinked. Row and nav
    // then told the user opposite things about the same cut. There is now ONE quiet axis.
    setEntities("CUT", [pendingCut]);
    await settle();
    markViewed("CUT", "cut-1", { snapshot: pendingCut, policies: ["onView"] });
    await settle();
    expect(row("CUT", "cut-1")).toEqual(RESTING);

    await vi.advanceTimersByTimeAsync(COOLDOWN_MS + 1000);
    expect(row("CUT", "cut-1")).toEqual(ARMED);
  });

  it("is not quieted by an on-exit ack pass", async () => {
    setEntities("CUT", [pendingCut]);
    await settle();
    markViewed("CUT", "cut-1", { snapshot: pendingCut, policies: ["onExitCooldown"] });
    await settle();
    expect(row("CUT", "cut-1")).toEqual(ARMED);
  });
});

describe("nav projection — getAttentionSnapshot", () => {
  it("reports armed while a row blinks and resting after it is viewed", async () => {
    setEntities("CUT", [pendingCut]);
    await settle();
    expect(getAttentionSnapshot().get("CUT")).toEqual({ count: 1, armed: true, harsh: true });

    markViewed("CUT", "cut-1", { snapshot: pendingCut, policies: ["onView"] });
    await settle();
    // count stays 1: the cut is still pending, so the nav keeps a STATIC indicator. Dropping
    // to 0 here is what made the nav vanish while the row still showed a red ring.
    expect(getAttentionSnapshot().get("CUT")).toEqual({ count: 1, armed: false, harsh: true });
  });

  it("counts an entity once even when several rules match it", async () => {
    // R2 (overdue) + R3a (no chassis) + R3b (no serial, no plate) + R3c (no plaqueta photo)
    // all fire on this one task.
    const task = {
      ...overdueTask,
      id: "task-2",
      entryDate: new Date("2026-07-01T00:00:00Z"),
      serialNumber: null,
      truck: { chassisNumber: null, plate: null },
    };
    setEntities("TASK", [task]);
    await settle();
    expect(getAttentionSnapshot().get("TASK")?.count).toBe(1);
  });

  it("tracks each entity type independently", async () => {
    setEntities("TASK", [overdueTask]);
    setEntities("CUT", [pendingCut]);
    await settle();
    markViewed("CUT", "cut-1", { snapshot: pendingCut, policies: ["onView"] });
    await settle();
    const snap = getAttentionSnapshot();
    // A resting cut must not be dragged into "armed" by an unrelated blinking task — the nav
    // used to paint one shared class over every signalling entry.
    expect(snap.get("CUT")?.armed).toBe(false);
    expect(snap.get("TASK")?.armed).toBe(true);
  });
});

describe("sound", () => {
  // The regression these pin: the bip used to be gated on "is the user looking at this entity
  // type's surface". Every page that registers entities IS that entity's surface, so the gate
  // was always closed wherever a cycle existed — the app blinked in total silence. There is no
  // surface gate on sound any more; only the ack/cooldown and the shared slot quiet it.
  it("bips as soon as a cycle arms", async () => {
    setEntities("CUT", [pendingCut]);
    await settle();
    expect(playAttentionBeep).toHaveBeenCalled();
  });

  it("bips on the entity's own queue page too", async () => {
    // Same call the cut list makes; nothing about being on /producao/recorte reaches the engine.
    setEntities("CUT", [pendingCut]);
    await settle();
    expect(playAttentionBeep).toHaveBeenCalledWith("harsh");
  });

  it("does not bip a cycle that is inside its cooldown", async () => {
    setEntities("CUT", [pendingCut]);
    await settle();
    playAttentionBeep.mockClear();
    markViewed("CUT", "cut-1", { snapshot: pendingCut, policies: ["onView"] });
    await settle();
    await vi.advanceTimersByTimeAsync(5 * 60 * 1000);
    expect(playAttentionBeep).not.toHaveBeenCalled();
  });

  it("stops the burst mid-flight when the record is opened", async () => {
    setEntities("CUT", [pendingCut]);
    await settle(); // first beep of the burst has played
    const beepsBefore = playAttentionBeep.mock.calls.length;
    markViewed("CUT", "cut-1", { snapshot: pendingCut, policies: ["onView"] });
    await settle();
    await vi.advanceTimersByTimeAsync(10_000); // the rest of the burst would have landed here
    expect(playAttentionBeep).toHaveBeenCalledTimes(beepsBefore);
  });
});

// The bip cadence belongs to the APP, not to each cycle. Cycles now exist for every matching
// record the server reports — not just the rows on screen — so a per-cycle cadence would turn
// an ordinary backlog into a stream of beeps.
describe("sound — one slot, app-wide", () => {
  const BURST = 5 * 750; // blinkCount x intervalMs, comfortably covering one burst

  it("plays ONE burst even when many records are blinking", async () => {
    setEntities("CUT", [{ id: "cut-1", status: CUT_STATUS.PENDING }, { id: "cut-2", status: CUT_STATUS.PENDING }, { id: "cut-3", status: CUT_STATUS.PENDING }]);
    await settle();
    await vi.advanceTimersByTimeAsync(BURST);
    expect(playAttentionBeep).toHaveBeenCalledTimes(5); // one burst of 5, not three
  });

  it("gives the next minute's slot to a DIFFERENT record, so none monopolises it", async () => {
    setEntities("CUT", [{ id: "cut-1", status: CUT_STATUS.PENDING }, { id: "cut-2", status: CUT_STATUS.PENDING }]);
    await settle();
    await vi.advanceTimersByTimeAsync(BURST);
    playAttentionBeep.mockClear();
    // Nothing until the slot reopens...
    await vi.advanceTimersByTimeAsync(30_000);
    expect(playAttentionBeep).not.toHaveBeenCalled();
    // ...then exactly one more burst, from the record that has been silent longest.
    await vi.advanceTimersByTimeAsync(30_000 + BURST);
    expect(playAttentionBeep).toHaveBeenCalledTimes(5);
  });

  it("prefers the harsher, higher-priority rule when both are waiting", async () => {
    // R2 (forecast overdue, priority 30, harsh) vs R3a (missing chassis, priority 20, soft).
    setEntities("TASK", [overdueTask, { id: "task-2", status: TASK_STATUS.IN_PRODUCTION, cleared: false, entryDate: new Date("2026-07-01"), serialNumber: "SN-2", forecastDate: null, truck: { chassisNumber: null, plate: "XYZ", vinPlateId: "f1" } }]);
    await settle();
    expect(playAttentionBeep).toHaveBeenCalledWith("harsh");
    expect(playAttentionBeep).not.toHaveBeenCalledWith("soft");
  });
});

// The bug this whole layer exists for: the engine could only see records a mounted page had
// registered, and a blink/bip cycle only exists for a match — so on any page that loads neither
// tasks nor cuts there was nothing in existence to make a sound. The nav ring lit up (it read
// plain counts from the server) while the app stayed silent, i.e. the signal was audible only
// where the rows were already visible.
describe("remote matches — the server's half of the match set", () => {
  const remoteCut = { ruleId: "cut.pending", entityType: "CUT" as const, entityId: "cut-9" };
  /** A server whose mirror implements every client rule and truncated nothing. */
  const ALL_EVALUATED = { evaluatedRuleIds: ATTENTION_RULES.map((r) => r.id), truncatedTypes: [] as string[] };

  it("blinks AND bips for a record no page has loaded", async () => {
    setRemoteMatches([remoteCut], ALL_EVALUATED);
    await settle();
    expect(row("CUT", "cut-9")).toEqual(ARMED);
    expect(playAttentionBeep).toHaveBeenCalledWith("harsh");
  });

  it("reaches the nav projection like any other match", async () => {
    setRemoteMatches([remoteCut], ALL_EVALUATED);
    await settle();
    expect(getAttentionSnapshot().get("CUT")).toEqual({ count: 1, armed: true, harsh: true });
  });

  it("lights the rule's own FIELD, not just the row", async () => {
    // Target/cadence/priority are recovered from the local rule registry by id — none of that
    // travels over the wire, which is what keeps a remote match the same kind of thing as a
    // locally-evaluated one.
    setRemoteMatches([{ ruleId: "task.forecast-overdue-not-cleared", entityType: "TASK", entityId: "task-7" }], ALL_EVALUATED);
    await settle();
    expect(field("TASK", "task-7", "forecastDate")).toEqual(ARMED);
  });

  it("ignores a rule id it does not know", async () => {
    setRemoteMatches([{ ruleId: "cut.invented-by-a-newer-server", entityType: "CUT", entityId: "cut-9" }], ALL_EVALUATED);
    await settle();
    expect(row("CUT", "cut-9")).toBeNull();
  });

  it("yields to the LOCAL evaluation once the record is on screen", async () => {
    // A poll is up to a minute old. An inline edit that resolves the rule has to stop the blink
    // now, not when the next fetch lands — so a loaded record is always evaluated locally.
    const fixed = { ...overdueTask, cleared: true, entryDate: new Date("2026-07-20"), truck: { chassisNumber: "CH", plate: "ABC1D23", vinPlateId: "file-1" } };
    setRemoteMatches([{ ruleId: "task.forecast-overdue-not-cleared", entityType: "TASK", entityId: overdueTask.id }], ALL_EVALUATED);
    await settle();
    expect(row("TASK", overdueTask.id)).toEqual(ARMED);

    setEntities("TASK", [fixed]);
    await settle();
    expect(row("TASK", overdueTask.id)).toBeNull();
  });

  it("treats absence from a COMPLETE list as resolution, so a recurrence re-alerts", async () => {
    setRemoteMatches([remoteCut], ALL_EVALUATED);
    await settle();
    markViewed("CUT", "cut-9", { snapshot: { id: "cut-9", status: CUT_STATUS.PENDING }, policies: ["onView"] });
    await settle();
    expect(row("CUT", "cut-9")).toEqual(RESTING);

    setRemoteMatches([], ALL_EVALUATED); // server sees no pending cuts at all → it was dealt with
    await settle();
    expect(row("CUT", "cut-9")).toBeNull();

    setRemoteMatches([remoteCut], ALL_EVALUATED); // it comes back → blinks again, old ack discarded
    await settle();
    expect(row("CUT", "cut-9")).toEqual(ARMED);
  });

  it("keeps the cooldown when the list was TRUNCATED, because absence proves nothing there", async () => {
    setRemoteMatches([remoteCut], ALL_EVALUATED);
    await settle();
    markViewed("CUT", "cut-9", { snapshot: { id: "cut-9", status: CUT_STATUS.PENDING }, policies: ["onView"] });
    await settle();

    // Dropped out of a capped list — it may simply be past the cap. Clearing the ack here would
    // re-arm and re-bip a record the user has already dealt with.
    setRemoteMatches([{ ruleId: "cut.pending", entityType: "CUT", entityId: "cut-other" }], { ...ALL_EVALUATED, truncatedTypes: ["CUT"] });
    await settle();
    setRemoteMatches([remoteCut], { ...ALL_EVALUATED, truncatedTypes: ["CUT"] });
    await settle();
    expect(row("CUT", "cut-9")).toEqual(RESTING);
  });

  it("keeps the cooldown for a rule the SERVER does not implement", async () => {
    // The rule conditions are mirrored by hand across TypeScript and Prisma. If a rule the
    // server never runs had its absence read as resolution, every drift would clear the
    // cooldown and the record would blink and bip again — the exact churn this guard prevents.
    // `evaluatedRuleIds` is the server admitting what it actually looked for.
    setEntities("CUT", [pendingCut]);
    await settle();
    markViewed("CUT", "cut-1", { snapshot: pendingCut, policies: ["onView"] });
    await settle();
    expect(row("CUT", "cut-1")).toEqual(RESTING);

    setEntities("CUT", []); // leave the cut list
    setRemoteMatches([], { evaluatedRuleIds: ["task.forecast-overdue-not-cleared"], truncatedTypes: [] });
    await settle();

    setEntities("CUT", [pendingCut]); // come back — still resting, not re-armed
    await settle();
    expect(row("CUT", "cut-1")).toEqual(RESTING);
  });

  it("does not treat a not-yet-answered poll as resolution", async () => {
    setEntities("CUT", [pendingCut]);
    await settle();
    markViewed("CUT", "cut-1", { snapshot: pendingCut, policies: ["onView"] });
    await settle();
    setEntities("CUT", []);
    await settle(); // no setRemoteMatches at all: the request has not landed
    setEntities("CUT", [pendingCut]);
    await settle();
    expect(row("CUT", "cut-1")).toEqual(RESTING);
  });

  it("drops every remote match when the set comes back empty", async () => {
    setRemoteMatches([remoteCut], ALL_EVALUATED);
    await settle();
    setRemoteMatches([], ALL_EVALUATED);
    await settle();
    expect(getAttentionSnapshot().get("CUT")).toBeUndefined();
  });
});

describe("resolution", () => {
  it("clears the cooldown when the predicate stops matching, so a recurrence re-alerts", async () => {
    setEntities("CUT", [pendingCut]);
    await settle();
    markViewed("CUT", "cut-1", { snapshot: pendingCut, policies: ["onView"] });
    await settle();
    expect(row("CUT", "cut-1")).toEqual(RESTING);

    // Someone starts the cut → no longer PENDING → no attention at all.
    const startedCut = { ...pendingCut, status: CUT_STATUS.CUTTING };
    setEntities("CUT", [startedCut]);
    await settle();
    expect(row("CUT", "cut-1")).toBeNull();

    // It goes back to PENDING (recut) → blinks again immediately, not silenced by the old ack.
    setEntities("CUT", [pendingCut]);
    await settle();
    expect(row("CUT", "cut-1")).toEqual(ARMED);
  });
});

// Regression cover for `task-quote.ibipora-missing-order-number` — the first rule that requires
// a COMPLETED task (so it must NOT go through `whileInFlight`) and the first that quantifies over
// a to-many relation (`some` over customerConfigs).
describe("TASK_QUOTE — Ibiporã sem N° do Pedido", () => {
  const OTHER_CUSTOMER = "11111111-1111-1111-1111-111111111111";

  const quote = (over: Record<string, unknown> = {}) => ({
    id: "quote-1",
    // BUDGET_APPROVED, not BILLING_APPROVED: the rule now stops once the quote has been billed,
    // because at that point the nota is out and the pedido number can no longer block it. That
    // narrowing is what removed eleven long-settled Ibiporã quotes from the Faturamento list.
    status: TASK_QUOTE_STATUS.BUDGET_APPROVED,
    task: { id: "task-9", status: TASK_STATUS.COMPLETED },
    customerConfigs: [
      { id: "cfg-other", customerId: OTHER_CUSTOMER, orderNumber: null, generateInvoice: true },
      { id: "cfg-ibipora", customerId: PINNED_CUSTOMERS.IBIPORA, orderNumber: null, generateInvoice: true },
    ],
    ...over,
  });

  it("blinks the orderNumber field of a finished task billed to Ibiporã", async () => {
    setEntities("TASK_QUOTE", [quote()]);
    await settle();
    expect(field("TASK_QUOTE", "quote-1", "orderNumber")).toEqual(ARMED);
  });

  it("stays silent while the task is still in flight", async () => {
    setEntities("TASK_QUOTE", [quote({ task: { id: "task-9", status: TASK_STATUS.IN_PRODUCTION } })]);
    await settle();
    expect(row("TASK_QUOTE", "quote-1")).toBeNull();
  });

  it("treats an empty-string order number as missing", async () => {
    setEntities("TASK_QUOTE", [quote({ customerConfigs: [{ id: "cfg-ibipora", customerId: PINNED_CUSTOMERS.IBIPORA, orderNumber: "", generateInvoice: true }] })]);
    await settle();
    expect(field("TASK_QUOTE", "quote-1", "orderNumber")).toEqual(ARMED);
  });

  it("stops the moment the number is filled in", async () => {
    setEntities("TASK_QUOTE", [quote({ customerConfigs: [{ id: "cfg-ibipora", customerId: PINNED_CUSTOMERS.IBIPORA, orderNumber: "12345", generateInvoice: true }] })]);
    await settle();
    expect(row("TASK_QUOTE", "quote-1")).toBeNull();
  });

  it("ignores another customer's missing order number", async () => {
    setEntities("TASK_QUOTE", [quote({ customerConfigs: [{ id: "cfg-other", customerId: OTHER_CUSTOMER, orderNumber: null, generateInvoice: true }] })]);
    await settle();
    expect(row("TASK_QUOTE", "quote-1")).toBeNull();
  });

  it("does not fire when the config was selected without orderNumber", async () => {
    // The `notNull id` guard inside the `some`. `isNull` cannot tell "the column is empty" from
    // "this key was never selected", so without the guard a select that forgot `orderNumber` would
    // light up EVERY finished Ibiporã quote. A config with no `id` is by definition one the query
    // did not select properly, so it must count as no evidence rather than as a missing number.
    setEntities("TASK_QUOTE", [quote({ customerConfigs: [{ customerId: PINNED_CUSTOMERS.IBIPORA, generateInvoice: true }] })]);
    await settle();
    expect(row("TASK_QUOTE", "quote-1")).toBeNull();
    expect(field("TASK_QUOTE", "quote-1", "orderNumber")).toBeNull();
  });

  it("does not fire when customerConfigs was left out of the include", async () => {
    // An absent collection is a missing include, never evidence — `some` returns false for it.
    setEntities("TASK_QUOTE", [quote({ customerConfigs: undefined })]);
    await settle();
    expect(row("TASK_QUOTE", "quote-1")).toBeNull();
  });

  it("stays silent on a cancelled quote", async () => {
    setEntities("TASK_QUOTE", [quote({ status: TASK_QUOTE_STATUS.CANCELLED })]);
    await settle();
    expect(row("TASK_QUOTE", "quote-1")).toBeNull();
  });

  // The regression that made the Faturamento list unreadable: the rule used to say "not
  // CANCELLED", which let every post-invoice status through. Quotes whose nota was issued and
  // whose money had been in the bank for months went on blinking, and nobody could act on them.
  it.each([
    TASK_QUOTE_STATUS.BILLING_APPROVED,
    TASK_QUOTE_STATUS.UPCOMING,
    TASK_QUOTE_STATUS.DUE,
    TASK_QUOTE_STATUS.PARTIAL,
    TASK_QUOTE_STATUS.SETTLED,
  ])("stays silent once the quote has been billed (%s)", async (status) => {
    setEntities("TASK_QUOTE", [quote({ status })]);
    await settle();
    expect(row("TASK_QUOTE", "quote-1")).toBeNull();
  });

  it("stays silent when Ibiporã's config will not produce a nota", async () => {
    // No invoice means nowhere to print the pedido de compra.
    setEntities("TASK_QUOTE", [
      quote({ customerConfigs: [{ id: "cfg-ibipora", customerId: PINNED_CUSTOMERS.IBIPORA, orderNumber: null, generateInvoice: false }] }),
    ]);
    await settle();
    expect(row("TASK_QUOTE", "quote-1")).toBeNull();
  });
});

// Cover for `task-quote.billing-customer-incomplete` — the other half of "what actually blocks an
// invoice", and the first rule whose predicate is GENERATED from a shared list
// (`NFSE_REQUIRED_CUSTOMER_FIELDS`) rather than written out.
describe("TASK_QUOTE — cadastro do cliente incompleto", () => {
  const OTHER_CUSTOMER = "11111111-1111-1111-1111-111111111111";

  /** A customer that can receive an NFS-e: every required field present. */
  const completeCustomer = {
    id: "customer-1",
    cnpj: "12345678000199",
    cpf: null,
    fantasyName: "Cliente",
    corporateName: "Cliente LTDA",
    zipCode: "86200-000",
    city: "Ibiporã",
    state: "PR",
    address: "Rua X",
    addressNumber: "100",
    neighborhood: "Centro",
  };

  const quote = (customerOver: Record<string, unknown> = {}, over: Record<string, unknown> = {}) => ({
    id: "quote-2",
    status: TASK_QUOTE_STATUS.BUDGET_APPROVED,
    task: { id: "task-10", status: TASK_STATUS.COMPLETED },
    customerConfigs: [{ customerId: OTHER_CUSTOMER, generateInvoice: true, customer: { ...completeCustomer, ...customerOver } }],
    ...over,
  });

  it("stays silent when the cadastro is complete", async () => {
    setEntities("TASK_QUOTE", [quote()]);
    await settle();
    expect(row("TASK_QUOTE", "quote-2")).toBeNull();
  });

  it.each([
    ["corporateName", { corporateName: null }],
    ["zipCode", { zipCode: "" }],
    ["city", { city: null }],
    ["state", { state: "" }],
    ["address", { address: null }],
    ["addressNumber", { addressNumber: "" }],
    ["neighborhood", { neighborhood: null }],
    ["fantasyName", { fantasyName: "" }],
  ])("blinks the customerData field when %s is missing", async (_label, over) => {
    setEntities("TASK_QUOTE", [quote(over)]);
    await settle();
    expect(field("TASK_QUOTE", "quote-2", "customerData")).toEqual(ARMED);
  });

  it("needs BOTH documents missing before it fires", async () => {
    // Either one satisfies the requirement, so a CPF-only customer is complete.
    setEntities("TASK_QUOTE", [quote({ cnpj: null, cpf: "12345678901" })]);
    await settle();
    expect(row("TASK_QUOTE", "quote-2")).toBeNull();

    setEntities("TASK_QUOTE", [quote({ cnpj: null, cpf: null })]);
    await settle();
    expect(field("TASK_QUOTE", "quote-2", "customerData")).toEqual(ARMED);
  });

  it("ignores a config that will not produce a nota", async () => {
    setEntities("TASK_QUOTE", [quote({ cnpj: null, cpf: null }, {
      customerConfigs: [{ customerId: OTHER_CUSTOMER, generateInvoice: false, customer: { ...completeCustomer, cnpj: null, cpf: null } }],
    })]);
    await settle();
    expect(row("TASK_QUOTE", "quote-2")).toBeNull();
  });

  it("stays silent once the quote has been billed", async () => {
    // Past BUDGET_APPROVED the nota is already out, so the cadastro was necessarily good enough.
    setEntities("TASK_QUOTE", [quote({ cnpj: null, cpf: null }, { status: TASK_QUOTE_STATUS.SETTLED })]);
    await settle();
    expect(row("TASK_QUOTE", "quote-2")).toBeNull();
  });

  it("stays silent while the task is still in flight", async () => {
    setEntities("TASK_QUOTE", [quote({ cnpj: null, cpf: null }, { task: { id: "task-10", status: TASK_STATUS.IN_PRODUCTION } })]);
    await settle();
    expect(row("TASK_QUOTE", "quote-2")).toBeNull();
  });

  it("does not fire when the customer relation was left out of the include", async () => {
    // Same principle as the missing `customerConfigs`: an absent include is not evidence. Here it
    // matters more, because the LIST query decides it — a quote fetched without these columns must
    // not read as "cadastro complete" OR as "everything is broken".
    setEntities("TASK_QUOTE", [quote({}, { customerConfigs: [{ customerId: OTHER_CUSTOMER, generateInvoice: true }] })]);
    await settle();
    expect(row("TASK_QUOTE", "quote-2")).toBeNull();
  });
});
