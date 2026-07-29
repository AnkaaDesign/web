import { useCallback, useMemo, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { IconAlertTriangle, IconExternalLink, IconFileDescription, IconPlus } from "@tabler/icons-react";

import { DataTablePage } from "@/components/ui/datatable";
import type { DataTableFilterValues, DataTableRowAction, DataTableRowClickMeta } from "@/components/ui/datatable";
import { useTasks } from "@/hooks";
import { getTasks } from "@/api-client";
import { useReturnTo } from "@/hooks/common/use-return-to";
import { useAuth } from "@/contexts/auth-context";
import { canEditQuote } from "@/utils/permissions/quote-permissions";
import { FAVORITE_PAGES, routes } from "@/constants";
import type { Task } from "@/types";
import { attentionRowClassFor, presenceRowClassFor, useAttentionVersion, usePresenceVersion, useRegisterAttentionEntities } from "@/lib/attention";
import { cn } from "@/lib/utils";
import { useSelectedCustomers, customerIdsFromFilter, initialTableParams } from "@/components/financial/shared/quote-table-shared";
import { buildQuoteSiblingState } from "@/components/financial/shared/quote-sibling-nav";
import { toAttentionQuoteEntities } from "@/components/financial/shared/quote-attention";
import { BUDGET_DEFAULT_SORTING, buildBudgetOrderBy, createBudgetColumns } from "./budget-table-columns";
import { BUDGET_DEFAULT_PAGE_SIZE, BUDGET_LIST_INCLUDE, buildBudgetQuery, createBudgetFilterDefs } from "./budget-table-filters";

// Module-level so the identity never churns (a fresh literal would rebuild the row model).
const getRowId = (t: Task) => t.id;

/**
 * The export pages through the full filtered set rather than asking for it in one shot. The tasks
 * endpoint caps `limit` at 1000; 200 keeps each response small enough to stay responsive while
 * still finishing a few-hundred-row export in two or three round trips.
 */
const EXPORT_PAGE_SIZE = 200;

export function BudgetTablePage() {
  const navigate = useNavigate();
  const returnTo = useReturnTo();
  const { user } = useAuth();
  const canEdit = canEditQuote(user?.sector?.privileges || "");

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
      include: BUDGET_LIST_INCLUDE,
      // Budgets change under you while you look at them (someone approves one in another tab).
      refetchOnWindowFocus: "always" as const,
    }),
    [listQuery, page, pageSize],
  );

  const { data: response, isLoading, error } = useTasks(query as never);
  const tasks = useMemo(() => ((response as { data?: Task[] } | undefined)?.data ?? []) as Task[], [response]);
  const totalRecords = (response as { meta?: { totalRecords?: number } } | undefined)?.meta?.totalRecords ?? 0;

  // Attention: the rows are TASKS but the signal belongs to the TASK QUOTE. A BUDGET_APPROVED
  // quote shows up on BOTH financial lists, so both register it — otherwise the same record would
  // ring on Faturamento and sit silent here, which is exactly the kind of disagreement between
  // surfaces this system exists to prevent.
  const quoteEntities = useMemo(() => toAttentionQuoteEntities(tasks), [tasks]);
  useRegisterAttentionEntities("TASK_QUOTE", quoteEntities);
  // The row class is computed imperatively per row, so the page must re-render on any flip.
  useAttentionVersion();
  usePresenceVersion();

  const fetchAllForExport = useCallback(async (): Promise<Task[]> => {
    const all: Task[] = [];
    for (let p = 1; ; p++) {
      const res = (await getTasks({ ...listQuery, page: p, limit: EXPORT_PAGE_SIZE, include: BUDGET_LIST_INCLUDE } as never)) as
        | { data?: Task[]; meta?: { hasNextPage?: boolean } }
        | undefined;
      const rows = (res?.data ?? []) as Task[];
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

  const onRowClick = useCallback(
    (task: Task, meta: DataTableRowClickMeta) => {
      navigate(routes.financial.budget.details(task.id), {
        state: buildQuoteSiblingState({ returnTo, orderedIds: meta.orderedIds, totalRecords, listQuery }),
      });
    },
    [navigate, returnTo, totalRecords, listQuery],
  );

  const getRowClassName = useCallback(
    (task: Task) => cn(attentionRowClassFor("TASK_QUOTE", task.quote?.id), presenceRowClassFor("TASK_QUOTE", task.quote?.id)),
    [],
  );

  const rowActions = useMemo<DataTableRowAction<Task>[]>(
    () => [
      {
        key: "open-new-tab",
        label: "Abrir em nova guia",
        icon: <IconExternalLink className="h-4 w-4" />,
        hidden: (rows) => rows.length !== 1,
        onClick: (rows) => rows[0] && window.open(routes.financial.budget.details(rows[0].id), "_blank"),
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
        <DataTablePage<Task>
          title="Orçamentos"
          icon={IconFileDescription}
          favoritePage={FAVORITE_PAGES.FINANCEIRO_ORCAMENTO}
          breadcrumbs={[
            { label: "Início", href: routes.home },
            { label: "Financeiro", href: routes.financial.root },
            { label: "Orçamentos" },
          ]}
          actions={
            canEdit
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
            data: tasks,
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
            emptyMessage: "Nenhum orçamento pendente encontrado. Ajuste os filtros.",
            exportTitle: "Orçamentos",
            exportFilename: "orcamentos",
          }}
        />
      </div>
    </div>
  );
}
