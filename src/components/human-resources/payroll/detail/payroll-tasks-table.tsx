import React, { useState, useMemo, useCallback, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { IconClipboardList } from "@tabler/icons-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { TableSearchInput } from "@/components/ui/table-search-input";
import { CustomerTasksTable } from "@/components/administration/customer/detail/customer-tasks-table";
import { ColumnVisibilityManager } from "@/components/production/task/list/column-visibility-manager";
import { createTaskHistoryColumns } from "@/components/production/task/history/task-history-columns";
import { useColumnVisibility } from "@/hooks/common/use-column-visibility";
import { routes } from "@/constants";

interface PayrollTasksTableProps {
  tasks: any[];
  userName?: string;
}

// Define comprehensive visible columns for payroll detail view
const PAYROLL_DETAIL_TASK_VISIBLE_COLUMNS = new Set([
  "name",
  "customer.fantasyName",
  "status",
  "finishedAt",
  "createdBy.name",
  "commission",
]);

export function PayrollTasksTable({ tasks, userName = "Funcionário" }: PayrollTasksTableProps) {
  const navigate = useNavigate();
  const [searchText, setSearchText] = useState("");
  const [isPending, setIsPending] = useState(false);

  // Create columns for column visibility manager
  const columns = useMemo(() => createTaskHistoryColumns(), []);

  // Visible columns state with localStorage persistence
  const { visibleColumns, setVisibleColumns } = useColumnVisibility(
    "payroll-detail-tasks-visible-columns",
    PAYROLL_DETAIL_TASK_VISIBLE_COLUMNS
  );

  // Extract task IDs for filtering
  const taskIds = tasks.map(t => t.id);

  // Debounce search text
  const [debouncedSearch, setDebouncedSearch] = useState("");

  useEffect(() => {
    setIsPending(true);
    const timer = setTimeout(() => {
      setDebouncedSearch(searchText);
      setIsPending(false);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchText]);

  // Filter to only show these specific tasks with API-based search
  const filters = useMemo(() => {
    return {
      where: {
        id: { in: taskIds.length > 0 ? taskIds : ["__NO_RESULTS__"] },
      },
      searchingFor: debouncedSearch.trim() || undefined, // API expects 'searchingFor' parameter
    };
  }, [taskIds, debouncedSearch]);

  // Handle navigation to full tasks page
  const handleViewAllTasks = useCallback(() => {
    navigate(routes.production.history.list);
  }, [navigate]);

  return (
    <Card className="w-full">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <IconClipboardList className="h-5 w-5" />
            Tarefas de {userName}
          </CardTitle>
          <Button
            variant="outline"
            size="sm"
            onClick={handleViewAllTasks}
          >
            Ver todas as tarefas
          </Button>
        </div>

        {/* Search and Column Visibility Controls */}
        <div className="flex flex-col gap-3 sm:flex-row mt-4">
          <TableSearchInput
            value={searchText}
            onChange={setSearchText}
            placeholder="Buscar por nome, cliente, número de série..."
            isPending={isPending}
          />
          <div className="flex gap-2">
            <ColumnVisibilityManager
              columns={columns}
              visibleColumns={visibleColumns}
              onVisibilityChange={setVisibleColumns}
            />
          </div>
        </div>
      </CardHeader>
      <CardContent className="px-6 pb-6 pt-6">
        {/* Tasks Table - Add horizontal padding to prevent edges touching */}
        <CustomerTasksTable
          visibleColumns={visibleColumns}
          filters={filters}
          navigationRoute="history"
        />
      </CardContent>
    </Card>
  );
}