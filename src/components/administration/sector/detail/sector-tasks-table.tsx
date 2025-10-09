import { IconClipboardList } from "@tabler/icons-react";

import type { Sector } from "../../../../types";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CustomerTasksTable } from "@/components/administration/customer/detail/customer-tasks-table";

interface SectorTasksTableProps {
  sector: Sector;
}

// Define comprehensive visible columns for sector detail view
const SECTOR_DETAIL_TASK_VISIBLE_COLUMNS = new Set([
  "name",
  "customer.fantasyName",
  "status",
  "finishedAt",
  "createdBy.name",
]);

export function SectorTasksTable({ sector }: SectorTasksTableProps) {
  // Filter to only show tasks from this sector
  const filters = {
    where: {
      sectorId: sector.id,
    },
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <IconClipboardList className="h-5 w-5" />
            Tarefas do Setor
          </div>
          <Badge variant="secondary">
            {sector._count?.tasks || 0} tarefa{(sector._count?.tasks || 0) !== 1 ? "s" : ""}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <CustomerTasksTable
          visibleColumns={SECTOR_DETAIL_TASK_VISIBLE_COLUMNS}
          filters={filters}
          className="border-0"
          navigationRoute="history"
        />
      </CardContent>
    </Card>
  );
}
