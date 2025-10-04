import { useMemo, useState } from "react";
import { useSectors, useTasks } from "../../../../hooks";
import { TASK_STATUS, SECTOR_PRIVILEGES } from "../../../../constants";
import type { Task } from "../../../../types";
import { Card, CardContent } from "@/components/ui/card";
import { TaskScheduleTable } from "./task-schedule-table";
import { TaskScheduleEmptyState } from "./task-schedule-empty-state";
import { ColumnVisibilityManager } from "./column-visibility-manager";
import { TaskScheduleExport } from "./task-schedule-export";
import { IconSearch } from "@tabler/icons-react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { useColumnVisibility } from "@/hooks/use-column-visibility";

interface TaskScheduleContentProps {
  className?: string;
}

export function TaskScheduleContent({ className }: TaskScheduleContentProps) {
  // Default visible columns
  const defaultVisibleColumns = useMemo(
    () => new Set(["name", "customer.fantasyName", "generalPainting", "serialNumberOrPlate", "entryDate", "term", "remainingTime"]),
    []
  );

  // Visible columns state with localStorage persistence
  const { visibleColumns, setVisibleColumns } = useColumnVisibility("task-schedule-visible-columns", defaultVisibleColumns);

  // Search state
  const [searchText, setSearchText] = useState("");

  // Load production sectors
  const { data: sectorsData } = useSectors({
    where: {
      privileges: {
        in: [SECTOR_PRIVILEGES.PRODUCTION, SECTOR_PRIVILEGES.LEADER, SECTOR_PRIVILEGES.ADMIN],
      },
    },
    orderBy: { name: "asc" },
  });

  const productionSectors = sectorsData?.data || [];

  // Load tasks data - only active production tasks (excluding ON_HOLD)
  const { data: tasksData, isLoading } = useTasks({
    status: [TASK_STATUS.PENDING, TASK_STATUS.IN_PRODUCTION],
    limit: 1000,
    include: {
      sector: true,
      customer: true,
      createdBy: true,
      services: true,
      generalPainting: true,
    },
    orderBy: {
      term: "asc", // Sort by deadline
    },
  });

  const allTasks = tasksData?.data || [];

  // Filter tasks based on search
  const filteredTasks = useMemo(() => {
    if (!searchText) return allTasks;

    const searchLower = searchText.toLowerCase();
    return allTasks.filter((task) => {
      return (
        task.name?.toLowerCase().includes(searchLower) ||
        task.customer?.fantasyName?.toLowerCase().includes(searchLower) ||
        task.customer?.corporateName?.toLowerCase().includes(searchLower) ||
        task.serialNumber?.toLowerCase().includes(searchLower) ||
        task.plate?.toLowerCase().includes(searchLower) ||
        task.sector?.name?.toLowerCase().includes(searchLower)
      );
    });
  }, [allTasks, searchText]);

  // Group tasks by sector
  const tasksBySector = useMemo(() => {
    const grouped = new Map<string, Task[]>();

    // Initialize with empty arrays for each production sector
    productionSectors.forEach((sector) => {
      grouped.set(sector.id, []);
    });

    // Add undefined sector group
    grouped.set("undefined", []);

    // Group tasks
    filteredTasks.forEach((task) => {
      const sectorId = task.sectorId || "undefined";
      const tasks = grouped.get(sectorId) || [];
      tasks.push(task);
      grouped.set(sectorId, tasks);
    });

    return grouped;
  }, [filteredTasks, productionSectors]);

  if (isLoading) {
    return (
      <div className={cn("h-full flex items-center justify-center", className)}>
        <div className="text-muted-foreground">Carregando cronograma...</div>
      </div>
    );
  }

  // Check if there are any tasks
  const hasAnyTasks = allTasks.length > 0;
  const hasSectors = productionSectors.length > 0;

  return (
    <Card className={cn("h-full flex flex-col", className)}>
      <CardContent className="flex-1 flex flex-col p-6 space-y-4 overflow-hidden">
        {/* Search and controls */}
        <div className="flex flex-col gap-3 sm:flex-row">
          <div className="flex-1 relative">
            <IconSearch className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
            <Input
              type="text"
              placeholder="Buscar por nome, cliente, número de série, placa, setor..."
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              transparent={true}
              className="pl-9"
            />
          </div>
          <div className="flex gap-2">
            <TaskScheduleExport tasks={filteredTasks} visibleColumns={visibleColumns} />
            <ColumnVisibilityManager visibleColumns={visibleColumns} onColumnVisibilityChange={setVisibleColumns} />
          </div>
        </div>

        {/* Tasks section */}
        <div className="flex-1 min-h-0 overflow-y-auto">
          {!hasAnyTasks ? (
            <TaskScheduleEmptyState hasSectors={hasSectors} />
          ) : filteredTasks.length === 0 ? (
            <div className="text-center text-muted-foreground py-8">Nenhuma tarefa encontrada com os critérios de busca</div>
          ) : (
            <div className="space-y-6">
              {/* Undefined sector first if it has tasks */}
              {(() => {
                const undefinedTasks = tasksBySector.get("undefined");
                return undefinedTasks && undefinedTasks.length > 0 ? (
                  <div>
                    <h3 className="text-lg font-semibold mb-3 text-muted-foreground">Setor Indefinido</h3>
                    <TaskScheduleTable tasks={undefinedTasks} visibleColumns={visibleColumns} />
                  </div>
                ) : null;
              })()}

              {/* Production sectors */}
              {productionSectors.map((sector) => {
                const tasks = tasksBySector.get(sector.id) || [];
                if (tasks.length === 0) return null;

                return (
                  <div key={sector.id}>
                    <h3 className="text-lg font-semibold mb-3">{sector.name}</h3>
                    <TaskScheduleTable tasks={tasks} visibleColumns={visibleColumns} />
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
