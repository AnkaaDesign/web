import { useMemo } from "react";
import { useTasks } from "../use-task";
import { TASK_STATUS } from "@/constants";

/**
 * Ordered sibling-task ids that drive the prev/next pager on the task detail page.
 *
 * The pager USED to depend solely on `location.state.ids` (handed in by the list/table on row-click).
 * That state is ephemeral and is lost on browser refresh, Back navigation, direct-URL entry, "open in
 * new tab", deep-links/notifications, and entry points that never pass it (calendar, related-tasks card,
 * global search). In all those cases the buttons silently disappeared.
 *
 * This hook keeps the exact `location.state.ids` as a fast-path (so paging matches what the user saw
 * when they came from a filtered/sorted list) and otherwise RECONSTRUCTS a coherent sibling set from
 * the source's canonical list query — so the pager ALWAYS renders, regardless of how the user arrived.
 *
 * `source` is the URL segment: /producao/<source>/detalhes/:id → "agenda" | "cronograma" | "historico".
 */
function siblingQueryForSource(source: string): Record<string, unknown> {
  switch (source) {
    // Cronograma list: WAITING_PRODUCTION + IN_PRODUCTION, ordered by term asc.
    case "cronograma":
      return {
        status: [TASK_STATUS.WAITING_PRODUCTION, TASK_STATUS.IN_PRODUCTION],
        orderBy: { term: "asc" },
        limit: 1000,
      };
    // Histórico list: finished tasks (completed/cancelled), most-recently-finished first.
    case "historico":
      return {
        status: [TASK_STATUS.COMPLETED, TASK_STATUS.CANCELLED],
        orderBy: { finishedAt: "desc" },
        limit: 1000,
      };
    // Agenda / preparation board: the active pipeline (production + preparation buckets combined).
    case "agenda":
    default:
      return {
        status: [TASK_STATUS.IN_PRODUCTION, TASK_STATUS.PREPARATION, TASK_STATUS.WAITING_PRODUCTION],
        orderBy: { forecastDate: "asc" },
        limit: 1000,
      };
  }
}

export function useTaskSiblingIds(source: string, currentId: string, fastPathIds?: string[]): string[] | undefined {
  const hasFastPath = Array.isArray(fastPathIds) && fastPathIds.length > 0;
  const params = useMemo(() => siblingQueryForSource(source), [source]);

  // Only hit the network when we don't already have the exact list from navigation state — the common
  // list → row-click path stays free; the fallback query fires only on the lossy entry points.
  const { data } = useTasks({
    ...params,
    enabled: !hasFastPath && !!currentId,
    // The list this backs changes infrequently relative to a detail view; avoid refetch churn while paging.
    staleTime: 60_000,
  } as never);

  return useMemo(() => {
    if (hasFastPath) return fastPathIds;
    const list = (data as { data?: Array<{ id: string }> } | undefined)?.data;
    return list ? list.map((t) => t.id) : undefined;
  }, [hasFastPath, fastPathIds, data]);
}
