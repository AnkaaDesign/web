import { useCallback, useMemo, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { IconAlertTriangle, IconExternalLink, IconFileDescription, IconPlus } from "@tabler/icons-react";

import { DataTablePage } from "@/components/ui/datatable";
import type { DataTableFilterValues, DataTableRowAction } from "@/components/ui/datatable";
import { useBudgets } from "@/hooks";
import { getBudgets } from "@/api-client/budget";
import { useReturnTo } from "@/hooks/common/use-return-to";
import { useAuth } from "@/contexts/auth-context";
import { canCreateQuote } from "@/utils/permissions/quote-permissions";
import { FAVORITE_PAGES, routes } from "@/constants";
import type { Budget } from "@/types/budget";
import { primaryTask } from "@/utils/quote-tasks";
import { attentionRowClassFor, presenceRowClassFor, useAttentionVersion, usePresenceVersion, useRegisterAttentionEntities } from "@/lib/attention";
import { cn } from "@/lib/utils";
import { useSelectedCustomers, customerIdsFromFilter, initialTableParams } from "@/components/financial/shared/quote-table-shared";
import { buildQuoteSiblingState } from "@/components/financial/shared/quote-sibling-nav";
import { toAttentionQuoteEntitiesFromQuotes } from "@/components/financial/shared/quote-attention";
import { BUDGET_DEFAULT_SORTING, buildBudgetOrderBy, createBudgetColumns } from "./budget-table-columns";
import { BUDGET_DEFAULT_PAGE_SIZE, BUDGET_QUOTE_INCLUDE, buildBudgetQuery, createBudgetFilterDefs } from "./budget-table-filters";

/**
 * A LINHA É UM ORÇAMENTO.
 *
 * Era uma TAREFA (`useTasks` + `getRowId = t.id`), e um orçamento de quatro
 * implementos virava quatro linhas com o mesmo número 984, `meta.totalRecords = 4`
 * e um rodapé anunciando "4 resultado(s)". O dono leu quatro orçamentos porque a
 * tela desenhou quatro. A unidade da consulta mudou para `GET /budgets`, e
 * com ela o rodapé, a seleção múltipla (marcar "tudo" deixou de marcar quatro
 * coisas que são uma) e o piscar da atenção (quatro linhas compartilhando o
 * mesmo `quote.id` piscavam em coro) se consertaram sozinhos.
 */
// Module-level so the identity never churns (a fresh literal would rebuild the row model).
const getRowId = (q: Budget) => q.id;

/**
 * The export pages through the full filtered set rather than asking for it in one shot. The
 * task-quotes endpoint caps `limit` at 1000; 200 keeps each response small enough to stay
 * responsive while still finishing a few-hundred-row export in two or three round trips.
 */
const EXPORT_PAGE_SIZE = 200;

export function BudgetTablePage() {
  const navigate = useNavigate();
  const returnTo = useReturnTo();
  const { user } = useAuth();
  // CADASTRAR é outra pergunta que EDITAR: `POST /budgets` é ADMIN+COMERCIAL, e o
  // financeiro (que edita o orçamento pela tela de detalhe) não CRIA. O botão usava
  // `canEditQuote`, e o financeiro só descobria a diferença ao ser barrado pelo
  // `PrivilegeRoute` na tela seguinte — ou, pelo widget do painel, no 403 do Salvar.
  const canCreate = canCreateQuote(user?.sector?.privileges || "");

  // Server mode: page/pageSize/sort ride the URL the table writes; search + filters arrive here.
  const [searchParams] = useSearchParams();
  // Seeded FROM THE URL, not empty: the table only publishes its parsed `?q=`/`?filters=`
  // through an effect, so an empty seed fired one unfiltered request on every shared link.
  const [params, setParams] = useState(() => initialTableParams(searchParams) as { search: string; filters: DataTableFilterValues });
  const paramsKey = useRef("");
  const onParamsChange = useCallback((next: { search: string; filters: DataTableFilterValues }) => {
    const key = JSON.stringify(next);
    if (key === paramsKey.current) return;
    paramsKey.current = key;
    setParams(next);
  }, []);

  const pageRaw = Number(searchParams.get("page") ?? "1");
  const page = Number.isFinite(pageRaw) ? Math.max(1, pageRaw) : 1;
  const pageSizeRaw = Number(searchParams.get("pageSize") ?? String(BUDGET_DEFAULT_PAGE_SIZE));
  const pageSize = Number.isFinite(pageSizeRaw) && pageSizeRaw > 0 ? pageSizeRaw : BUDGET_DEFAULT_PAGE_SIZE;
  const sortParam = searchParams.get("sort");
  const sorting = useMemo<{ id: string; desc: boolean }[]>(() => {
    if (!sortParam) return [];
    try {
      const parsed = JSON.parse(sortParam);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }, [sortParam]);

  // The filter/sort half of the request, without pagination — reused by the export and handed to
  // the detail page so its prev/next pager can reproduce exactly the list the user was looking at.
  const listQuery = useMemo(
    () => ({
      ...buildBudgetQuery(params.filters, params.search),
      orderBy: buildBudgetOrderBy(sorting),
    }),
    [params, sorting],
  );

  const query = useMemo(
    () => ({
      ...listQuery,
      page,
      limit: pageSize,
      include: BUDGET_QUOTE_INCLUDE,
      // Budgets change under you while you look at them (someone approves one in another tab).
      refetchOnWindowFocus: "always" as const,
    }),
    [listQuery, page, pageSize],
  );

  const { data: response, isLoading, error } = useBudgets(query);
  const quotes = useMemo(() => ((response as { data?: Budget[] } | undefined)?.data ?? []) as Budget[], [response]);
  const totalRecords = (response as { meta?: { totalRecords?: number } } | undefined)?.meta?.totalRecords ?? 0;

  // Attention: a linha e a entidade registrada passaram a ser A MESMA COISA. Um orçamento APPROVED
  // aparece nas DUAS listas financeiras, e as duas o registram — senão o mesmo registro tocaria no
  // Faturamento e ficaria mudo aqui, que é exatamente a discordância entre telas que este sistema
  // existe para evitar.
  const quoteEntities = useMemo(() => toAttentionQuoteEntitiesFromQuotes(quotes), [quotes]);
  useRegisterAttentionEntities("TASK_QUOTE", quoteEntities);
  // The row class is computed imperatively per row, so the page must re-render on any flip.
  useAttentionVersion();
  usePresenceVersion();

  const fetchAllForExport = useCallback(async (): Promise<Budget[]> => {
    const all: Budget[] = [];
    for (let p = 1; ; p++) {
      const res = await getBudgets({ ...listQuery, page: p, limit: EXPORT_PAGE_SIZE, include: BUDGET_QUOTE_INCLUDE });
      const rows = (res?.data ?? []) as Budget[];
      all.push(...rows);
      if (res?.meta?.hasNextPage === false || rows.length < EXPORT_PAGE_SIZE) break;
      // Defensive backstop against an unbounded loop if `meta` ever goes missing.
      if (totalRecords > 0 && all.length >= totalRecords) break;
    }
    return all;
  }, [listQuery, totalRecords]);

  // Resolve the selected customers so the filter chips and the closed comboboxes read as names
  // rather than uuids (the ids come back from the URL before any search has run).
  const invoiceCustomerIds = useMemo(() => customerIdsFromFilter(params.filters.customerIds), [params.filters.customerIds]);
  const taskCustomerIds = useMemo(() => customerIdsFromFilter(params.filters.taskCustomerIds), [params.filters.taskCustomerIds]);
  const invoiceCustomers = useSelectedCustomers(invoiceCustomerIds);
  const taskCustomers = useSelectedCustomers(taskCustomerIds);

  const columns = useMemo(() => createBudgetColumns(), []);
  const filterDefs = useMemo(() => createBudgetFilterDefs({ invoiceCustomers, taskCustomers }), [invoiceCustomers, taskCustomers]);

  /**
   * As ÂNCORAS da página carregada, na ordem em que a tabela as desenhou.
   *
   * 🔴 `meta.orderedIds` é literalmente a lista de row ids, e com
   * `getRowId = q => q.id` ela virou uma lista de ids de ORÇAMENTO. Entregá-la ao
   * pager produziria `/financeiro/orcamento/detalhes/<quoteId>` — uma rota que
   * existe, casa, e carrega uma página que não acha tarefa nenhuma. Nenhum erro,
   * nenhuma pista. O pager só entende id de TAREFA, então é aqui que se traduz.
   */
  const anchorIds = useMemo(() => quotes.map((q) => primaryTask(q)?.id).filter((id): id is string => !!id), [quotes]);

  const onRowClick = useCallback(
    (quote: Budget) => {
      const anchor = primaryTask(quote)?.id;
      // ÓRFÃO: existem orçamentos sem tarefa nenhuma, e eles passaram a aparecer
      // (consultando `Budget` não há mais a junção que os escondia — é um
      // ganho: são registros com número, valor e validade que ninguém conseguia
      // achar). Sem âncora não há para onde navegar, e `details(undefined)`
      // levaria a `/detalhes/undefined`.
      if (!anchor) return;
      navigate(routes.financial.budget.details(anchor), {
        state: buildQuoteSiblingState({
          returnTo,
          orderedIds: anchorIds,
          totalRecords,
          // A completude é sobre as LINHAS (`quotes`), não sobre as âncoras: um
          // órfão é uma linha carregada que não contribui âncora, e comparar
          // `anchorIds.length >= totalRecords` faria uma página completa parecer
          // incompleta, congelando o pager numa busca que nunca melhora.
          idsCompleteOverride: totalRecords > 0 && quotes.length >= totalRecords,
          listQuery,
        }),
      });
    },
    [navigate, returnTo, totalRecords, listQuery, anchorIds, quotes.length],
  );

  const getRowClassName = useCallback(
    (quote: Budget) => cn(attentionRowClassFor("TASK_QUOTE", quote.id), presenceRowClassFor("TASK_QUOTE", quote.id)),
    [],
  );

  const rowActions = useMemo<DataTableRowAction<Budget>[]>(
    () => [
      {
        key: "open-new-tab",
        label: "Abrir em nova guia",
        icon: <IconExternalLink className="h-4 w-4" />,
        // Sem âncora a rota não existe — a ação some em vez de abrir uma guia vazia.
        hidden: (rows) => rows.length !== 1 || !primaryTask(rows[0])?.id,
        onClick: (rows) => {
          const anchor = rows[0] && primaryTask(rows[0])?.id;
          if (anchor) window.open(routes.financial.budget.details(anchor), "_blank");
        },
      },
    ],
    [],
  );

  return (
    <div className="flex h-full flex-col">
      {error ? (
        <div className="mx-4 mt-4 flex items-center gap-2 rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          <IconAlertTriangle className="h-4 w-4 shrink-0" />
          Não foi possível carregar os orçamentos. Tente novamente.
        </div>
      ) : null}

      <div className="min-h-0 flex-1">
        <DataTablePage<Budget>
          title="Orçamentos"
          icon={IconFileDescription}
          favoritePage={FAVORITE_PAGES.FINANCEIRO_ORCAMENTO}
          breadcrumbs={[
            { label: "Início", href: routes.home },
            { label: "Financeiro", href: routes.financial.root },
            { label: "Orçamentos" },
          ]}
          actions={
            canCreate
              ? [
                  {
                    key: "create",
                    label: "Cadastrar",
                    icon: IconPlus,
                    onClick: () => navigate(routes.financial.budget.create),
                    variant: "default",
                  },
                ]
              : []
          }
          table={{
            tableId: "financial-budget-list",
            data: quotes,
            columns,
            filterDefs,
            rowActions,
            getRowId,
            onRowClick,
            getRowClassName,
            isLoading,
            mode: "server",
            rowCount: totalRecords,
            onParamsChange,
            onExportFetchAll: fetchAllForExport,
            defaultSorting: BUDGET_DEFAULT_SORTING,
            defaultPageSize: BUDGET_DEFAULT_PAGE_SIZE,
            // No `sectorDefaults`: every sector that can open this page can see everything on it,
            // and the legacy table showed the same columns to all of them. Per-column
            // `defaultVisible` is what decides the starting view.
            estimateRowHeight: 44,
            searchPlaceholder: "Buscar por nome, número de série, placa, cliente...",
            emptyMessage: "Nenhum orçamento encontrado. Ajuste os filtros.",
            exportTitle: "Orçamentos",
            exportFilename: "orcamentos",
          }}
        />
      </div>
    </div>
  );
}
