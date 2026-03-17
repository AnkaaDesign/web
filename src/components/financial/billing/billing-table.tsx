import { useMemo, useCallback, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import type { Task } from "@/types";
import { useTasks } from "@/hooks";
import { routes } from "@/constants";
import { StandardizedTable } from "@/components/ui/standardized-table";
import { useTableState, convertSortConfigsToOrderBy } from "@/hooks/common/use-table-state";
import { createBillingColumns } from "./billing-columns";
import type { BillingFilters } from "./billing-filter-sheet";
import { IconFileInvoice } from "@tabler/icons-react";

interface BillingTableProps {
  className?: string;
  searchingFor?: string;
  filters?: BillingFilters;
}

export function BillingTable({ className, searchingFor, filters }: BillingTableProps) {
  const navigate = useNavigate();

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
    defaultSort: [{ column: "finishedAt", direction: "desc" }],
    sortStorageKey: "billing-table-sort",
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
      ...(sortConfigs.length > 0 && {
        orderBy: convertSortConfigsToOrderBy(sortConfigs),
      }),
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
    if (filters?.quoteStatus && filters.quoteStatus !== "all") {
      params.where = {
        ...params.where,
        quote: { status: filters.quoteStatus },
      };
    }

    // Customer filter (invoice-to customer in quote configs)
    if (filters?.customerId) {
      params.where = {
        ...params.where,
        quote: {
          ...(params.where?.quote || {}),
          customerConfigs: {
            some: { customerId: filters.customerId },
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

  const tasks = data?.data || [];
  const totalRecords = data?.meta?.totalRecords || 0;
  const totalPages = data?.meta?.totalPages || 1;

  const handleRowClick = useCallback((task: Task) => {
    navigate(routes.financial.billing.details(task.id));
  }, [navigate]);

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
