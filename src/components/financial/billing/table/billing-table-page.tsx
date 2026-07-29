import { useCallback, useMemo, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { IconAlertTriangle, IconExternalLink, IconFileInvoice, IconRefresh } from "@tabler/icons-react";

import { DataTablePage } from "@/components/ui/datatable";
import type { DataTableFilterValues, DataTableRowAction, DataTableRowClickMeta } from "@/components/ui/datatable";
import { useTasks } from "@/hooks";
import { getTasks } from "@/api-client";
import { useReturnTo } from "@/hooks/common/use-return-to";
import { useUserPrivileges } from "@/hooks/common/use-auth";
import { useReconcileBoletos } from "@/hooks/production/use-invoice";
import { useToast } from "@/hooks/common/use-toast";
import { attentionRowClassFor, presenceRowClassFor, useAttentionVersion, usePresenceVersion, useRegisterAttentionEntities } from "@/lib/attention";
import { cn } from "@/lib/utils";
import { FAVORITE_PAGES, SECTOR_PRIVILEGES, routes } from "@/constants";
import type { Task } from "@/types";
import { customerIdsFromFilter, initialTableParams, useSelectedCustomers } from "@/components/financial/shared/quote-table-shared";
import { buildQuoteSiblingState } from "@/components/financial/shared/quote-sibling-nav";
import { toAttentionQuoteEntities } from "@/components/financial/shared/quote-attention";
import { BILLING_DEFAULT_SORTING, buildBillingOrderBy, createBillingColumns } from "./billing-table-columns";
import { BILLING_DEFAULT_PAGE_SIZE, BILLING_LIST_INCLUDE, buildBillingQuery, createBillingFilterDefs } from "./billing-table-filters";

const getRowId = (t: Task) => t.id;

/**
 * The export pages through the full filtered set rather than asking for it in one shot. The tasks
 * endpoint caps `limit` at 1000; 200 keeps each response small enough to stay responsive while
 * still finishing a few-hundred-row export in two or three round trips.
 */
const EXPORT_PAGE_SIZE = 200;

export function BillingTablePage() {
  const navigate = useNavigate();
  const returnTo = useReturnTo();
  const { toast } = useToast();

  const privileges = useUserPrivileges();
  const canReconcile = privileges?.includes(SECTOR_PRIVILEGES.ADMIN) || privileges?.includes(SECTOR_PRIVILEGES.FINANCIAL);
  const { mutate: reconcile, isPending: isReconciling } = useReconcileBoletos();

  const handleReconcile = useCallback(() => {
    reconcile(undefined, {
      onSuccess: (data) => {
        toast({
          title: "Conciliação concluída",
          description:
            data.reconciled > 0
              ? `${data.reconciled} boleto(s) reconciliado(s) de ${data.total} pagamento(s) encontrado(s) nos últimos 14 dias.`
              : `Nenhum boleto novo encontrado. ${data.total} pagamento(s) verificado(s) nos últimos 14 dias.`,
        });
      },
    });
  }, [reconcile, toast]);

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
  const pageSizeRaw = Number(searchParams.get("pageSize") ?? String(BILLING_DEFAULT_PAGE_SIZE));
  const pageSize = Number.isFinite(pageSizeRaw) && pageSizeRaw > 0 ? pageSizeRaw : BILLING_DEFAULT_PAGE_SIZE;
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
  // the detail page so its prev/next pager reproduces exactly the list the user was looking at.
  const listQuery = useMemo(
    () => ({
      ...buildBillingQuery(params.filters, params.search),
      orderBy: buildBillingOrderBy(sorting),
    }),
    [params, sorting],
  );

  const query = useMemo(
    () => ({
      ...listQuery,
      page,
      limit: pageSize,
      include: BILLING_LIST_INCLUDE,
      // Boletos get paid and quotes get approved while this list is open in another tab.
      refetchOnWindowFocus: "always" as const,
    }),
    [listQuery, page, pageSize],
  );

  const { data: response, isLoading, error } = useTasks(query as never);
  const tasks = useMemo(() => ((response as { data?: Task[] } | undefined)?.data ?? []) as Task[], [response]);
  const totalRecords = (response as { meta?: { totalRecords?: number } } | undefined)?.meta?.totalRecords ?? 0;

  // Attention: the rows are TASKS but the signal belongs to the TASK QUOTE — that is the entity
  // whose nav home is Faturamento/Orçamento and whose id the detail page acks. Registering the
  // quotes locally (rather than relying on the server summary) is what makes the ring clear the
  // instant someone fills the missing field, instead of on the next 60s poll.
  const quoteEntities = useMemo(() => toAttentionQuoteEntities(tasks), [tasks]);
  useRegisterAttentionEntities("TASK_QUOTE", quoteEntities);
  // The row class is computed imperatively per row, so the page must re-render on any flip.
  useAttentionVersion();
  usePresenceVersion();

  const fetchAllForExport = useCallback(async (): Promise<Task[]> => {
    const all: Task[] = [];
    for (let p = 1; ; p++) {
      const res = (await getTasks({ ...listQuery, page: p, limit: EXPORT_PAGE_SIZE, include: BILLING_LIST_INCLUDE } as never)) as
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

  const columns = useMemo(() => createBillingColumns(), []);
  const filterDefs = useMemo(() => createBillingFilterDefs({ invoiceCustomers, taskCustomers }), [invoiceCustomers, taskCustomers]);

  const onRowClick = useCallback(
    (task: Task, meta: DataTableRowClickMeta) => {
      navigate(routes.financial.billing.details(task.id), {
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
        onClick: (rows) => rows[0] && window.open(routes.financial.billing.details(rows[0].id), "_blank"),
      },
    ],
    [],
  );

  return (
    <div className="flex h-full flex-col">
      {error ? (
        <div className="mx-4 mt-4 flex items-center gap-2 rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          <IconAlertTriangle className="h-4 w-4 shrink-0" />
          Não foi possível carregar o faturamento. Tente novamente.
        </div>
      ) : null}

      <div className="min-h-0 flex-1">
        <DataTablePage<Task>
          title="Faturamento"
          icon={IconFileInvoice}
          favoritePage={FAVORITE_PAGES.FINANCEIRO_FATURAMENTO}
          breadcrumbs={[
            { label: "Início", href: routes.home },
            { label: "Financeiro", href: routes.financial.root },
            { label: "Faturamento" },
          ]}
          actions={
            canReconcile
              ? [
                  {
                    key: "reconcile",
                    label: "Conciliar Boletos",
                    icon: IconRefresh,
                    onClick: handleReconcile,
                    loading: isReconciling,
                    variant: "outline",
                  },
                ]
              : []
          }
          table={{
            tableId: "financial-billing-list",
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
            defaultSorting: BILLING_DEFAULT_SORTING,
            defaultPageSize: BILLING_DEFAULT_PAGE_SIZE,
            // No `sectorDefaults`: every sector that can open this page can see everything on it,
            // and the legacy table showed the same columns to all of them. Per-column
            // `defaultVisible` is what decides the starting view.
            estimateRowHeight: 44,
            searchPlaceholder: "Buscar por nome, número de série, placa, cliente...",
            emptyMessage: "Nenhuma tarefa encontrada. Ajuste os filtros.",
            exportTitle: "Faturamento",
            exportFilename: "faturamento",
          }}
        />
      </div>
    </div>
  );
}
