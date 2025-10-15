import { IconClipboardList } from "@tabler/icons-react";

import type { Paint } from "../../../../types";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CustomerTasksTable } from "@/components/administration/customer/detail/customer-tasks-table";

interface PaintTasksTableProps {
  paint: Paint;
}

// Define comprehensive visible columns for paint detail view
const PAINT_DETAIL_TASK_VISIBLE_COLUMNS = new Set([
  "name",
  "customer.fantasyName",
  "status",
  "finishedAt",
  "createdBy.name",
]);

export function PaintTasksTable({ paint }: PaintTasksTableProps) {
  // Combine general paintings and logo tasks
  const allTasks = [
    ...(paint.generalPaintings || []),
    ...(paint.logoTasks || []),
  ];

  // Filter to only show tasks from this paint
  const filters = {
    where: {
      OR: [
        { generalPaintingId: paint.id },
        { logoPaintId: paint.id },
      ],
    },
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <IconClipboardList className="h-5 w-5" />
            Histórico de Uso
          </div>
          <Badge variant="secondary">
            {allTasks.length} tarefa{allTasks.length !== 1 ? "s" : ""}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <CustomerTasksTable
          visibleColumns={PAINT_DETAIL_TASK_VISIBLE_COLUMNS}
          filters={filters}
          className="border-0"
          navigationRoute="history"
        />
      </CardContent>
    </Card>
  );
}