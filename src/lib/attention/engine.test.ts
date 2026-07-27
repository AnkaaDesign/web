// Guarantees the Attention system's three surfaces (nav / table row / detail page) always
// agree. Each of these assertions corresponds to a way they were observed to disagree:
// a cut whose row stayed red forever while its nav entry re-blinked, a task whose nav kept
// blinking after the row went quiet, and a queue that beeped at the user staring at it.

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// `vi.mock` is hoisted above the imports, so the spy has to be created in a hoisted block too.
const { playAttentionBeep } = vi.hoisted(() => ({ playAttentionBeep: vi.fn() }));
vi.mock("@/utils/nav-alert-sound", () => ({ playAttentionBeep, playAnnoyingBeep: vi.fn() }));

import { SECTOR_PRIVILEGES, CUT_STATUS, TASK_STATUS } from "@/constants";

import { createLocalAckStore } from "./ack-store";
import { configureAckStore, getAddressState, getAttentionSnapshot, markViewed, resetEngine, setEntities, setUserPrivilege } from "./engine";
import { addressKey } from "./types";
import type { AttentionEntityType } from "./types";

const COOLDOWN_MS = 30 * 60 * 1000; // every rule in rules.ts uses the 30-min default

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
  /** Truck already on site (entryDate given), forecast still in the future → only R3a/R3b can fire. */
  const arrived = (over: Record<string, unknown>) => ({
    id: "task-3",
    status: TASK_STATUS.IN_PRODUCTION,
    cleared: false,
    entryDate: new Date("2026-07-01T00:00:00Z"),
    forecastDate: new Date("2026-12-01T00:00:00Z"), // not overdue → R2 silent
    serialNumber: null as string | null,
    truck: { chassisNumber: "CH", plate: null as string | null, vinPlate: null as string | null },
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

  it("has no rule for vinPlate (Plaqueta)", async () => {
    // Everything the rules care about is filled in; only the plaqueta is empty → nothing.
    setEntities("TASK", [arrived({ serialNumber: "SN-3", truck: { chassisNumber: "CH", plate: "ABC1D23", vinPlate: null } })]);
    await settle();
    expect(row("TASK", "task-3")).toBeNull();
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
    // R2 (overdue) + R3a (no chassis) + R3b (no serial, no plate) all fire on this one task.
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
