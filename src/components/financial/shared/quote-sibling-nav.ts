import { useMemo } from "react";

import { useTasks } from "@/hooks";

/**
 * Prev/next record paging for the Orçamento and Faturamento detail pages.
 *
 * Both pages are keyed by a TASK id and both are reachable from a dozen places that know nothing
 * about a list — a notification, a deep link, the reconciliation "Orçamento vinculado" badge, the
 * home dashboard, `getTaskQuoteEditRoute` on the task detail, a refresh, Back, "abrir em nova
 * guia". The task detail solved this with `useTaskSiblingIds`: navigation state is a fast path,
 * and everything else RECONSTRUCTS the list. This is the same idea with one addition the task
 * page does not need.
 *
 * That addition: these two lists are SERVER-paginated, so `meta.orderedIds` from a row click is
 * one PAGE (40 rows), not the list. Treating it as the list would make the pager read "12 / 40" on
 * a 325-record list and dead-end at the page boundary — and because `useRecordNavigation` forwards
 * its id list as the next hop's state, that 40-id slice would then be promoted to "authoritative"
 * and never widen. So the page slice is kept only as a PLACEHOLDER (the widget appears instantly),
 * while the real list is fetched with the very query the user was looking at, handed over in
 * `listQuery`. Merging the two would be worse than either: same order means the fetch is a
 * superset, different order means the merge matches neither the screen nor the server.
 *
 * The one case with genuinely no pager is a record no list carries AND no list handed over —
 * a deep link to a task whose quote is outside the canonical query. There is no list context to
 * page through there, and inventing one would page the user somewhere they never were.
 */

/** Ordered ids come back from one request, so the pager spans at most this many records. */
const SIBLING_LIMIT = 1000;

export interface QuoteSiblingState {
  /** Where "voltar"/save should return to — preserved across every prev/next hop. */
  returnTo?: string;
  /** Ordered ids the list handed over. A page slice unless `idsComplete`. */
  ids?: string[];
  /** True only when `ids` is the WHOLE result set, not just the loaded page. */
  idsComplete?: boolean;
  /**
   * The filter/sort half of the list request (no pagination). Lets the fallback reproduce the
   * user's own filtered, searched, sorted order instead of the page's default one.
   */
  listQuery?: Record<string, unknown>;
}

export function buildQuoteSiblingState(input: {
  returnTo?: string;
  orderedIds: string[];
  totalRecords: number;
  listQuery: Record<string, unknown>;
}): QuoteSiblingState {
  const { returnTo, orderedIds, totalRecords, listQuery } = input;
  return {
    returnTo,
    ids: orderedIds,
    // `totalRecords === 0` means the count never arrived; claiming completeness then would freeze
    // the pager to whatever happened to be loaded.
    idsComplete: totalRecords > 0 && orderedIds.length >= totalRecords,
    listQuery,
  };
}

export function readQuoteSiblingState(state: unknown): QuoteSiblingState {
  if (!state || typeof state !== "object") return {};
  const s = state as QuoteSiblingState;
  return {
    returnTo: typeof s.returnTo === "string" ? s.returnTo : undefined,
    ids: Array.isArray(s.ids) ? s.ids.filter((id): id is string => typeof id === "string") : undefined,
    idsComplete: s.idsComplete === true,
    listQuery: s.listQuery && typeof s.listQuery === "object" ? s.listQuery : undefined,
  };
}

/**
 * Ordered sibling TASK ids for the pager.
 *
 * @param fallbackQuery the surface's CANONICAL list query (filter + orderBy, no pagination) — used
 *   when the user did not arrive from the list, so it must mirror that list's defaults exactly. A
 *   divergence does not error; it silently makes "next" land on a record that was not the next row.
 */
export function useQuoteSiblingIds(
  fallbackQuery: Record<string, unknown>,
  currentId: string,
  state: QuoteSiblingState,
): { ids: string[] | undefined; complete: boolean } {
  const placeholderIds = state.ids && state.ids.length > 0 ? state.ids : undefined;
  const hasFastPath = !!state.idsComplete && !!placeholderIds;

  const params = useMemo(
    () => ({ ...(state.listQuery ?? fallbackQuery), page: 1, limit: SIBLING_LIMIT }),
    // `listQuery` arrives via history state and is a fresh object per navigation; key on its
    // content so paging within one list does not refire the query.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [JSON.stringify(state.listQuery ?? fallbackQuery)],
  );

  const { data } = useTasks({
    ...params,
    enabled: !hasFastPath && !!currentId,
    // Without this `useTasks` is staleTime 0, so every prev/next hop would refetch 1000 rows.
    staleTime: 60_000,
    refetchOnWindowFocus: false,
  } as never);

  return useMemo(() => {
    if (hasFastPath) return { ids: placeholderIds, complete: true };
    const list = (data as { data?: Array<{ id: string }> } | undefined)?.data;
    // Show the page slice until the full list lands. The record under the cursor never changes —
    // only the position and the total it is counted against, which widen once (e.g. 5/40 → 85/325).
    if (!list) return { ids: placeholderIds, complete: false };
    const widened = list.map((t) => t.id);
    // The widened list is only an improvement if it actually CONTAINS this record. It may not:
    // past SIBLING_LIMIT rows, or when the user reached a record the canonical list does not carry
    // (a quote-less task routed here by `getTaskQuoteEditRoute`, a not-yet-finished task opened
    // from Faturamento). `useRecordNavigation` reports `total: 0` for an id it cannot find, which
    // would make the widget VANISH from under the cursor a moment after it appeared — strictly
    // worse than the page-scoped pager the user already had.
    if (currentId && !widened.includes(currentId)) {
      return placeholderIds ? { ids: placeholderIds, complete: false } : { ids: undefined, complete: false };
    }
    return { ids: widened, complete: true };
  }, [hasFastPath, placeholderIds, data, currentId]);
}
