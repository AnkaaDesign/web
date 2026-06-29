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
