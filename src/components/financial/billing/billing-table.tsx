import { useMemo, useCallback, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useReturnTo } from "@/hooks/common/use-return-to";
import type { Task } from "@/types";
import { useTasks } from "@/hooks";
import { routes } from "@/constants";
import { StandardizedTable } from "@/components/ui/standardized-table";
import { useTableState, convertSortConfigsToOrderBy } from "@/hooks/common/use-table-state";
import { createBillingColumns, findFirstInstallmentDueDate } from "./billing-columns";
import type { BillingFilters } from "./billing-filter-sheet";
import { IconFileInvoice } from "@tabler/icons-react";

// Vencimento's value (first installment's due date) lives two relations deep
// (quote -> customerConfigs -> installments), which Prisma can't order by
// directly — so it's excluded from the server orderBy and sorted client-side
// over the already-loaded page instead.
const CLIENT_SORT_COLUMN = "currentInstallmentDueDate";

interface BillingTableProps {
  className?: string;
  searchingFor?: string;
  filters?: BillingFilters;
}

export function BillingTable({ className, searchingFor, filters }: BillingTableProps) {
  const navigate = useNavigate();
  const returnTo = useReturnTo();

  const {
    page,
    pageSize,
    setPage,
    setPageSize,
    sortConfigs,
    setSortConfigs,
    toggleSort,
    getSortDirection,
    getSortOrder,
  } = useTableState({
    defaultPageSize: 40,
    defaultSort: [
      { column: "quote.statusOrder", direction: "asc" },
      { column: "finishedAt", direction: "desc" },
    ],
    sortStorageKey: "billing-table-sort-v2",
    useUrlForSort: true,
  });

  const columns = useMemo(() => createBillingColumns(), []);
  const validColumnKeys = useMemo(() => new Set(columns.filter((c) => c.sortable).map((c) => c.key)), [columns]);

  // Clean up stale sort configs from URL/localStorage on mount
  useEffect(() => {
    const valid = sortConfigs.filter((s) => validColumnKeys.has(s.column));
    if (valid.length !== sortConfigs.length) {
      setSortConfigs(valid);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const queryParams = useMemo(() => {
    const params: Record<string, any> = {
      page: page + 1,
      limit: pageSize,
      shouldDisplayForFinancial: true,
      ...(searchingFor && { searchingFor }),
      ...(() => {
        const serverSortConfigs = sortConfigs.filter((s) => s.column !== CLIENT_SORT_COLUMN);
        return serverSortConfigs.length > 0
          ? { orderBy: convertSortConfigsToOrderBy(serverSortConfigs) }
          : {};
      })(),
      include: {
        customer: {
          select: {
            id: true,
            fantasyName: true,
            corporateName: true,
          },
        },
        truck: {
          select: {
            chassisNumber: true,
            plate: true,
          },
        },
        quote: {
          select: {
            total: true,
            status: true,
            statusOrder: true,
            customerConfigs: {
              select: {
                customer: {
                  select: {
                    id: true,
                    fantasyName: true,
                    corporateName: true,
                  },
                },
                installments: {
                  select: {
                    id: true,
                    number: true,
                    dueDate: true,
                    status: true,
                  },
                },
              },
            },
          },
        },
      },
    };

    // Apply user-selected filters
    if (filters?.finishedFrom || filters?.finishedTo) {
      params.finishedDateRange = {
        ...(filters.finishedFrom && { from: filters.finishedFrom }),
        ...(filters.finishedTo && { to: filters.finishedTo }),
      };
    }

    // Specific quote status filter (overrides the default shouldDisplayForFinancial range)
    if (filters?.quoteStatuses && filters.quoteStatuses.length > 0) {
      params.where = {
        ...params.where,
        quote: {
          ...(params.where?.quote || {}),
          status: { in: filters.quoteStatuses },
        },
      };
    }

    // Customer filter (invoice-to customer in quote configs)
    if (filters?.customerIds && filters.customerIds.length > 0) {
      params.where = {
        ...params.where,
        quote: {
          ...(params.where?.quote || {}),
          customerConfigs: {
            some: { customerId: { in: filters.customerIds } },
          },
        },
      };
    }

    return params;
  }, [page, pageSize, searchingFor, sortConfigs, filters]);

  const { data, isLoading, error } = useTasks({
    ...queryParams,
    refetchOnWindowFocus: "always",
  });

  const rawTasks = data?.data || [];
  const totalRecords = data?.meta?.totalRecords || 0;
  const totalPages = data?.meta?.totalPages || 1;

  // Client-side pass for Vencimento (see CLIENT_SORT_COLUMN) — only reorders
  // the current page, since the underlying value can't be sorted server-side.
  const dueDateSort = sortConfigs.find((s) => s.column === CLIENT_SORT_COLUMN);
  const tasks = useMemo(() => {
    if (!dueDateSort) return rawTasks;
    const dir = dueDateSort.direction === "asc" ? 1 : -1;
    return [...rawTasks].sort((a, b) => {
      const aDate = findFirstInstallmentDueDate(a);
      const bDate = findFirstInstallmentDueDate(b);
      if (!aDate && !bDate) return 0;
      if (!aDate) return 1; // nulls last regardless of direction
      if (!bDate) return -1;
      return (aDate.getTime() - bDate.getTime()) * dir;
    });
  }, [rawTasks, dueDateSort]);

  const handleRowClick = useCallback((task: Task) => {
    navigate(routes.financial.billing.details(task.id), { state: { returnTo } });
  }, [navigate, returnTo]);

  return (
    <div className="flex-1 min-h-0 overflow-auto">
      <StandardizedTable<Task>
        columns={columns}
        data={tasks}
        getItemKey={(task) => task.id}
        onRowClick={handleRowClick}
        isLoading={isLoading}
        error={error ? true : undefined}
        emptyMessage="Nenhuma tarefa encontrada"
        emptyIcon={IconFileInvoice}
        onSort={toggleSort}
        getSortDirection={getSortDirection}
        getSortOrder={getSortOrder}
        sortConfigs={sortConfigs.map((s) => ({ field: s.column, direction: s.direction }))}
        currentPage={page}
        totalPages={totalPages}
        pageSize={pageSize}
        totalRecords={totalRecords}
        onPageChange={setPage}
        onPageSizeChange={(size) => {
          setPageSize(size);
          setPage(0);
        }}
        pageSizeOptions={[20, 40, 60, 100]}
        showPageSizeSelector
        showGoToPage
        showPageInfo
        className={className}
      />
    </div>
  );
}
