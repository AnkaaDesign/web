import { describe, expect, it } from "vitest";
import { clusterTasks, detachClusterTask, expandClusterTasks, resolveClusterActionRows, type ClusteredTask } from "./cluster-tasks";
import type { Task } from "@/types";

const task = (id: string) => ({ id, name: "SEM Limite 5,50" }) as Task;

/** A task with a name and an optional forecast date ("Previsão"). */
const named = (id: string, name: string, forecastDate?: string) =>
  ({ id, name, ...(forecastDate ? { forecastDate: new Date(forecastDate) } : {}) }) as Task;

/** A cluster parent as `clusterTasks` builds it: itself + siblings carried on `__group`. */
const cluster = (ids: string[]): ClusteredTask => {
  const [first, ...rest] = ids.map(task);
  return { ...first, __children: rest, __group: [first, ...rest] };
};

/** The subset of a TanStack `Row` that `resolveClusterActionRows` reads. */
const row = (original: ClusteredTask, { canExpand = true, expanded = false } = {}) => ({
  original,
  getCanExpand: () => canExpand && !!original.__children?.length,
  getIsExpanded: () => expanded,
});

describe("cluster action targeting", () => {
  const parent = cluster(["a", "b", "c"]);

  it("a COLLAPSED parent stands for its whole group", () => {
    const rows = resolveClusterActionRows(row(parent, { expanded: false }));
    expect(expandClusterTasks(rows).map((t) => t.id)).toEqual(["a", "b", "c"]);
  });

  it("an EXPANDED parent stands for ONLY itself", () => {
    // The regression: right-clicking the first row of an expanded group used to hit every sibling,
    // which is how one "Dar Entrada" marked 40 tasks.
    const rows = resolveClusterActionRows(row(parent, { expanded: true }));
    expect(expandClusterTasks(rows).map((t) => t.id)).toEqual(["a"]);
  });

  it("a plain (non-cluster) row stands for itself either way", () => {
    const single = task("z") as ClusteredTask;
    expect(expandClusterTasks(resolveClusterActionRows(row(single))).map((t) => t.id)).toEqual(["z"]);
    expect(expandClusterTasks(resolveClusterActionRows(row(single, { expanded: true }))).map((t) => t.id)).toEqual(["z"]);
  });

  it("detachClusterTask drops the sibling linkage without touching the task fields", () => {
    const detached = detachClusterTask(parent) as ClusteredTask;
    expect(detached.__group).toBeUndefined();
    expect(detached.__children).toBeUndefined();
    expect(detached.id).toBe("a");
    expect(detached.name).toBe(parent.name);
  });

  it("expandClusterTasks still de-duplicates a parent selected alongside its children", () => {
    const ids = expandClusterTasks([parent, task("b") as ClusteredTask, task("c") as ClusteredTask]).map((t) => t.id);
    expect(ids).toEqual(["a", "b", "c"]);
  });
});

describe("clusterTasks only groups tasks WITHOUT a Previsão", () => {
  /** Each row as `id(+N)` — `+N` marks a cluster parent hiding N siblings. */
  const shape = (rows: ClusteredTask[]) =>
    rows.map((r) => (r.__children?.length ? `${r.id}+${r.__children.length}` : r.id));

  it("clusters a run of similar names with no forecast date", () => {
    const rows = clusterTasks([named("a", "Framento"), named("b", "Framento"), named("c", "Framento")]);
    expect(shape(rows)).toEqual(["a+2"]);
    expect(expandClusterTasks(rows).map((t) => t.id)).toEqual(["a", "b", "c"]);
  });

  it("does NOT cluster the same run once the forecast dates are filled", () => {
    // The regression: a collapsed parent shows only its OWN Previsão and drags its siblings along
    // when the table sorts by that column, so filled forecasts must stay on their own rows.
    const rows = clusterTasks([
      named("a", "Framento", "2026-08-17T18:00:00"),
      named("b", "Framento", "2026-08-17T18:00:00"),
      named("c", "Framento", "2026-08-18T18:00:00"),
    ]);
    expect(shape(rows)).toEqual(["a", "b", "c"]);
  });

  it("a forecast in the middle breaks the run without swallowing it", () => {
    const rows = clusterTasks([
      named("a", "Framento"),
      named("b", "Framento", "2026-08-17T18:00:00"),
      named("c", "Framento"),
      named("d", "Framento"),
      named("e", "Framento"),
    ]);
    expect(shape(rows)).toEqual(["a", "b", "c+2"]);
  });

  it("keeps forecast rows in their sorted position around a cluster", () => {
    const rows = clusterTasks([
      named("early", "Rodobeca 14,70", "2026-08-14T17:00:00"),
      named("a", "Marquespan 9,50"),
      named("b", "Marquespan 9,50"),
      named("c", "Marquespan 9,50"),
      named("late", "Nimbus", "2026-08-31T18:00:00"),
    ]);
    expect(shape(rows)).toEqual(["early", "a+2", "late"]);
  });
});
