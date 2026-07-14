import { describe, it, expect } from "vitest";
import { buildDateGroups, pruneDateGroup } from "./date-grouped-rows";

interface Leaf {
  id: string;
  date: string;
  name: string;
  amount: number;
  received: boolean;
}

const OPTS = {
  getDate: (r: Leaf) => r.date,
  getGreen: (r: Leaf) => (r.received ? r.amount : 0),
  getRed: (r: Leaf) => (r.received ? 0 : r.amount),
  getResolved: (r: Leaf) => r.received,
  direction: "desc" as const,
};

const rows: Leaf[] = [
  { id: "a", date: "2026-05-20", name: "MARCOS AURELIO", amount: 100, received: true },
  { id: "b", date: "2026-05-20", name: "PAULO BATISTA", amount: 200, received: false },
  { id: "c", date: "2026-05-20", name: "MARCOS ANTONIO", amount: 50, received: false },
];

describe("pruneDateGroup", () => {
  it("narrows a day to just the kept children and recomputes the aggregates", () => {
    const [group] = buildDateGroups(rows, OPTS);
    // Simulate a search that matched only the two "MARCOS" leaves.
    const kept = rows.filter((r) => r.name.includes("MARCOS"));

    const pruned = pruneDateGroup(group, kept, OPTS);

    expect(pruned.children).toEqual(kept);
    expect(pruned.count).toBe(2);
    expect(pruned.greenTotal).toBe(100); // only leaf "a" is received
    expect(pruned.redTotal).toBe(50); // only leaf "c" is unreceived among the kept
    expect(pruned.resolvedCount).toBe(1);
    // Identity fields carry over unchanged.
    expect(pruned.id).toBe(group.id);
    expect(pruned.dateKey).toBe(group.dateKey);
  });

  it("does not mutate the source group", () => {
    const [group] = buildDateGroups(rows, OPTS);
    const beforeCount = group.count;
    const beforeChildren = group.children.length;

    pruneDateGroup(group, [rows[0]], OPTS);

    expect(group.count).toBe(beforeCount);
    expect(group.children.length).toBe(beforeChildren);
  });
});
