import React from "react";
import { useNavigate } from "react-router-dom";
import type { Task } from "../../../../types";
import type { TaskGetManyFormData } from "../../../../schemas";
import { TASK_STATUS, routes } from "../../../../constants";
import { useTableFilters } from "@/hooks/use-table-filters";
import { useTableState } from "@/hooks/use-table-state";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TableSearchInput } from "@/components/ui/table-search-input";
import { Button } from "@/components/ui/button";
import { ShowSelectedToggle } from "@/components/ui/show-selected-toggle";
import { CustomerTasksTable } from "./customer-tasks-table";
import { ColumnVisibilityManager } from "@/components/production/task/history/column-visibility-manager";
import { createTaskHistoryColumns } from "@/components/production/task/history/task-history-columns";
import { cn } from "@/lib/utils";
import { useColumnVisibility } from "@/hooks/use-column-visibility";
import { IconChecklist } from "@tabler/icons-react";

interface CustomerTasksListProps {
  className?: string;
  customerId: string;
  customerName?: string;
  navigationRoute?: 'history' | 'onHold' | 'schedule';
}

const DEFAULT_PAGE_SIZE = 40;

export function CustomerTasksList({
  className,
  customerId,
  customerName,
  navigationRoute = 'history',
}: CustomerTasksListProps) {
  const navigate = useNavigate();
  // Get table state for selected tasks functionality
  const { selectionCount, showSelectedOnly, toggleShowSelectedOnly } = useTableState({
    defaultPageSize: DEFAULT_PAGE_SIZE,
    resetSelectionOnPageChange: false,
  });

  // Filter state management with search only (no other filters)
  const {
    searchingFor,
    displaySearchText,
    setSearch,
    queryFilters: baseQueryFilters,
  } = useTableFilters<TaskGetManyFormData>({
    defaultFilters: {
      status: [TASK_STATUS.COMPLETED],
    },
    searchDebounceMs: 300,
    searchParamName: "customerTaskSearch",
    excludeFromUrl: ["limit", "orderBy"],
  });

  // Default visible columns
  const defaultVisibleColumns = React.useMemo(
    () =>
      new Set([
        "name",
        "customer.fantasyName",
        "generalPainting",
        "sector.name",
        "serialNumber",
        "finishedAt",
      ]),
    []
  );

  // Column visibility state with localStorage persistence
  const { visibleColumns, setVisibleColumns } = useColumnVisibility(
    "customer-detail-tasks-visible-columns",
    defaultVisibleColumns
  );

  // Table data for tracking
  const [tableData, setTableData] = React.useState<{ items: Task[]; totalRecords: number }>({
    items: [],
    totalRecords: 0,
  });

  // Get all columns for visibility manager
  const allColumns = React.useMemo(() => createTaskHistoryColumns(), []);

  // Prepare final query filters - always filter by customerId
  // baseQueryFilters already includes searchingFor from useTableFilters
  const queryFilters = React.useMemo(() => {
    return {
      ...baseQueryFilters,
      where: {
        ...baseQueryFilters.where,  // Preserve any existing where conditions
        customerId: customerId,
      },
      status: [TASK_STATUS.COMPLETED],
      searchingFor: baseQueryFilters.searchingFor,  // Explicitly preserve searchingFor
    };
  }, [baseQueryFilters, customerId]);

  // Handle table data changes
  const handleTableDataChange = React.useCallback((data: { items: Task[]; totalRecords: number }) => {
    setTableData(data);
  }, []);

  return (
    <Card className={cn("h-full flex flex-col shadow-sm border border-border w-full", className)}>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <IconChecklist className="h-5 w-5" />
            Tarefas do Cliente
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => navigate(`${routes.production.schedule.list}?customerId=${customerId}${customerName ? `&customerName=${encodeURIComponent(customerName)}` : ''}`)}
          >
            Ver todas as tarefas
          </Button>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Search and controls */}
        <div className="flex flex-col gap-3 sm:flex-row">
          <TableSearchInput
            value={displaySearchText}
            onChange={setSearch}
            placeholder="Buscar por nome, número de série, placa..."
            isPending={displaySearchText !== searchingFor}
          />
          <div className="flex gap-2">
            <ShowSelectedToggle
              showSelectedOnly={showSelectedOnly}
              onToggle={toggleShowSelectedOnly}
              selectionCount={selectionCount}
            />
            <ColumnVisibilityManager
              columns={allColumns}
              visibleColumns={visibleColumns}
              onVisibilityChange={setVisibleColumns}
            />
          </div>
        </div>

        {/* Table - CustomerTasksTable already has min-h-[400px] max-h-[800px] built-in */}
        <CustomerTasksTable
          filters={queryFilters}
          visibleColumns={visibleColumns}
          onDataChange={handleTableDataChange}
          navigationRoute={navigationRoute}
        />
      </CardContent>
    </Card>
  );
}
