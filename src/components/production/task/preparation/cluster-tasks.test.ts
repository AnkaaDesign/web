import { describe, expect, it } from "vitest";
import { detachClusterTask, expandClusterTasks, resolveClusterActionRows, type ClusteredTask } from "./cluster-tasks";
import type { Task } from "@/types";

const task = (id: string) => ({ id, name: "SEM Limite 5,50" }) as Task;

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
