import { IconClipboardList } from "@tabler/icons-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CustomerTasksTable } from "@/components/administration/customer/detail/customer-tasks-table";

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
  // Extract task IDs for filtering
  const taskIds = tasks.map(t => t.id);

  // Filter to only show these specific tasks
  const filters = taskIds.length > 0 ? {
    where: {
      id: { in: taskIds },
    },
  } : {};

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <IconClipboardList className="h-5 w-5" />
            Tarefas de {userName}
          </div>
          <Badge variant="secondary">
            {tasks.length} tarefa{tasks.length !== 1 ? "s" : ""}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="max-h-[600px] overflow-auto">
        <CustomerTasksTable
          visibleColumns={PAYROLL_DETAIL_TASK_VISIBLE_COLUMNS}
          filters={filters}
          className="border-0"
          navigationRoute="history"
        />
      </CardContent>
    </Card>
  );
}