import { useMemo } from "react";

import { useTasks, useTaskQuotes } from "@/hooks";
import { primaryTask } from "@/utils/quote-tasks";

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
  /**
   * A completude, quando ela NÃO se lê de `orderedIds.length`.
   *
   * Aditivo, e existe por causa de uma lista só: a de Orçamentos, cuja linha é o
   * ORÇAMENTO e cujos ids são traduzidos para TAREFAS ÂNCORA antes de chegar
   * aqui. Um orçamento sem veículo é uma linha carregada que não contribui
   * âncora, então `orderedIds.length >= totalRecords` diria "incompleto" numa
   * página inteira — e o pager ficaria refazendo uma busca que nunca melhora. A
   * pergunta certa é sobre as LINHAS, e só quem as tem pode respondê-la.
   */
  idsCompleteOverride?: boolean;
}): QuoteSiblingState {
  const { returnTo, orderedIds, totalRecords, listQuery, idsCompleteOverride } = input;
  return {
    returnTo,
    ids: orderedIds,
    // `totalRecords === 0` means the count never arrived; claiming completeness then would freeze
    // the pager to whatever happened to be loaded.
    idsComplete: idsCompleteOverride ?? (totalRecords > 0 && orderedIds.length >= totalRecords),
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

/**
 * O pager da lista de ORÇAMENTOS, que agora tem UMA LINHA POR ORÇAMENTO.
 *
 * ✅ O QUE ISTO CONSERTA: pelo caminho antigo o pager percorria TAREFAS, então num
 * orçamento de quatro veículos apertar "próximo" quatro vezes seguidas mostrava
 * QUATRO VEZES O MESMO ORÇAMENTO — a mesma tela, o mesmo número, quatro passos
 * que não andavam. Percorrendo orçamentos, quatro viram um.
 *
 * ⚠️ Mas a ROTA continua sendo por TAREFA (`/financeiro/orcamento/detalhes/:taskId`),
 * então os ids entregues ao pager têm de ser de TAREFA ÂNCORA — a primeira na
 * ordem canônica, via `primaryTask`. Entregar ids de ORÇAMENTO produziria
 * `/detalhes/<quoteId>`, que carrega uma página vazia sem emitir erro nenhum.
 *
 * ⚠️ Função NOVA em vez de um parâmetro em `useQuoteSiblingIds`: o Faturamento
 * ainda lista tarefas e chama aquela com um `where` de Task. Mudar a assinatura
 * de lá é o caminho mais curto para mandar um `where` de TaskQuote para `/tasks`,
 * que é 400 na cara — ou, pior, filtro mudo.
 */
export function useBudgetSiblingIds(
  fallbackQuery: Record<string, unknown>,
  currentTaskId: string,
  state: QuoteSiblingState,
): { ids: string[] | undefined; complete: boolean } {
  const placeholderIds = state.ids && state.ids.length > 0 ? state.ids : undefined;
  const hasFastPath = !!state.idsComplete && !!placeholderIds;

  const params = useMemo(
    // `tasks: true` é o mínimo que responde "qual é a âncora?": `primaryTask`
    // ordena por `createdAt` com o `id` como desempate, e os dois são escalares
    // da tarefa. Sem o include não haveria id de tarefa nenhum na resposta.
    () => ({ ...(state.listQuery ?? fallbackQuery), page: 1, limit: SIBLING_LIMIT, include: { tasks: true } }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [JSON.stringify(state.listQuery ?? fallbackQuery)],
  );

  const { data } = useTaskQuotes({
    ...params,
    enabled: !hasFastPath && !!currentTaskId,
    // Sem isto o hook é staleTime 0 e cada salto refaria a busca de 1000 linhas.
    staleTime: 60_000,
    refetchOnWindowFocus: false,
  });

  return useMemo(() => {
    if (hasFastPath) return { ids: placeholderIds, complete: true };
    const list = (data as { data?: Array<{ id: string; tasks?: Array<{ id: string; createdAt?: Date | string | null }> }> } | undefined)?.data;
    if (!list) return { ids: placeholderIds, complete: false };
    // Órfãos (orçamento sem veículo) não contribuem âncora e simplesmente não
    // entram no pager — não há tarefa para onde navegar.
    const widened = list.map((q) => primaryTask(q)?.id).filter((id): id is string => !!id);
    if (currentTaskId && !widened.includes(currentTaskId)) {
      return placeholderIds ? { ids: placeholderIds, complete: false } : { ids: undefined, complete: false };
    }
    return { ids: widened, complete: true };
  }, [hasFastPath, placeholderIds, data, currentTaskId]);
}
