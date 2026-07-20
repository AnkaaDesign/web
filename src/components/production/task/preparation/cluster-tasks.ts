import { groupSequentialTasks } from "@/components/production/task/history/task-grouping-utils";
import type { Task } from "@/types";

/**
 * A task row that may represent a name-similarity CLUSTER. When `__children` is set, the row is the
 * cluster's first task (the parent); `__group` holds every task in the cluster (parent + children).
 * The DataTable's `getSubRows` returns `__children` so the cluster expands into individual rows, and
 * a collapsed parent's cells aggregate over `__group`.
 */
export type ClusteredTask = Task & { __children?: Task[]; __group?: Task[] };

/**
 * Group consecutive tasks with near-identical names (Levenshtein ≥ 0.95, runs of ≥ 3) into a parent
 * carrying its siblings as children — mirrors the legacy preparation grouping, but as a flat
 * parent→children array the new DataTable can render natively. Sort order is preserved.
 */
export function clusterTasks(tasks: Task[]): ClusteredTask[] {
  const groups = groupSequentialTasks(tasks, 3, 0.95);
  const out: ClusteredTask[] = [];
  for (let i = 0; i < groups.length; i++) {
    const g = groups[i];
    if (g.type === "group-first" && g.task) {
      const children = groups[i + 1]?.collapsedTasks ?? [];
      out.push({ ...g.task, __children: children, __group: [g.task, ...children] });
      i++; // the paired "group-collapsed" entry is consumed here
    } else if (g.type === "single" && g.task) {
      out.push(g.task);
    }
  }
  return out;
}

/**
 * Expand cluster rows to the underlying task objects they stand for. A collapsed cluster parent
 * represents its whole `__group` (parent + children); a plain row is just itself. De-duplicated by
 * id so an expanded cluster whose children are ALSO individually selected can't double-count.
 *
 * Every bulk/batch context-menu action MUST route its rows through this: `rows.map(r => r.id)`
 * reads only a cluster parent's own id, silently dropping its siblings — so acting on a 3-task
 * cluster would hit only the parent (the "updates just 1 of 3" bug).
 */
export function expandClusterTasks(rows: ClusteredTask[]): Task[] {
  const seen = new Set<string>();
  const out: Task[] = [];
  for (const r of rows) {
    for (const t of r.__group ?? [r]) {
      if (seen.has(t.id)) continue;
      seen.add(t.id);
      out.push(t);
    }
  }
  return out;
}

/** Ids of {@link expandClusterTasks} — for bulk actions that only need the task ids. */
export function expandClusterTaskIds(rows: ClusteredTask[]): string[] {
  return expandClusterTasks(rows).map((t) => t.id);
}
