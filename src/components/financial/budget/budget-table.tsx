import { useMemo, useCallback, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import type { Task } from "@/types";
import { useTasks } from "@/hooks";
import { routes } from "@/constants";
import { StandardizedTable } from "@/components/ui/standardized-table";
import { useTableState, convertSortConfigsToOrderBy } from "@/hooks/common/use-table-state";
import { createBudgetColumns } from "./budget-columns";
import type { BudgetFilters } from "./budget-filter-sheet";
import { IconFileDescription } from "@tabler/icons-react";

interface BudgetTableProps {
  className?: string;
  searchingFor?: string;
  filters?: BudgetFilters;
}

export function BudgetTable({ className, searchingFor, filters }: BudgetTableProps) {
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
    sortStorageKey: "budget-table-sort",
    useUrlForSort: true,
  });

  const columns = useMemo(() => createBudgetColumns(), []);
  const validColumnKeys = useMemo(() => new Set(columns.filter((c) => c.sortable).map((c) => c.key)), [columns]);

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
      where: {
        status: "COMPLETED",
        quote: {
          is: { status: "PENDING" },
        },
      },
    };

    // Apply date filters
    if (filters?.finishedFrom || filters?.finishedTo) {
      params.finishedDateRange = {
        ...(filters.finishedFrom && { from: filters.finishedFrom }),
        ...(filters.finishedTo && { to: filters.finishedTo }),
      };
    }

    // Customer filter
    if (filters?.customerId) {
      params.where = {
        ...params.where,
        quote: {
          ...params.where.quote,
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
    navigate(routes.financial.budget.details(task.id));
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
        emptyMessage="Nenhum orçamento pendente encontrado"
        emptyIcon={IconFileDescription}
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
