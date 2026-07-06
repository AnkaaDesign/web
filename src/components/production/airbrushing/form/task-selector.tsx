import { useMemo } from "react";
import { useTasks } from "../../../../hooks";
import { useCurrentUser } from "@/hooks/common/use-auth";
import { cn } from "@/lib/utils";
import { DataTable, type DataTableColumnDef, type DataTableFilterDef } from "@/components/ui/datatable";
import { IconCircle, IconCircleCheckFilled } from "@tabler/icons-react";
import { TRUCK_CATEGORY_LABELS, IMPLEMENT_TYPE_LABELS } from "../../../../constants";
import { createTaskPreparationColumns } from "@/components/production/task/preparation/task-prep-columns";
import type { ClusteredTask } from "@/components/production/task/preparation/cluster-tasks";
import type { Task } from "../../../../types";

/**
 * Rich include mirroring the task-preparation table (`task-prep-page` LIST_INCLUDE) so every reused
 * prep column has the data it renders — service-order progress, forecast reschedule flag, the truck
 * measures behind "Medidas", the quote billing customers ("Faturar Para"), painting, sector, etc.
 */
const LIST_INCLUDE = {
  serviceOrders: { select: { id: true, type: true, status: true, assignedToId: true, description: true, observation: true } },
  forecastHistory: {
    select: { source: true, previousDate: true, newDate: true, reason: true, createdAt: true },
    where: { source: "MANUAL", previousDate: { not: null } },
    orderBy: { createdAt: "desc" },
    take: 1,
  },
  customer: { select: { id: true, fantasyName: true, corporateName: true } },
  truck: {
    select: {
      id: true,
      plate: true,
      category: true,
      chassisNumber: true,
      implementType: true,
      leftSideMeasure: { select: { id: true, height: true, sections: { select: { id: true, width: true } } } },
      rightSideMeasure: { select: { id: true, height: true, sections: { select: { id: true, width: true } } } },
    },
  },
  quote: {
    select: {
      id: true,
      total: true,
      status: true,
      customerConfigs: { select: { customer: { select: { corporateName: true, fantasyName: true } } } },
    },
  },
  generalPainting: { select: { id: true, name: true, hex: true } },
  sector: { select: { id: true, name: true } },
  responsibles: { select: { id: true, name: true } },
} as const;

interface TaskSelectorProps {
  selectedTasks: Set<string>;
  onSelectTask: (taskId: string) => void;
  /** Unused for airbrushing (single task) — kept for interface compatibility. */
  onSelectAll?: () => void;
  className?: string;
  isSelected?: (taskId: string) => boolean;
}

/**
 * Single-select task picker for the airbrushing wizard (Step 2). Reuses the FULL task-preparation
 * column set (`createTaskPreparationColumns`) + its per-sector default layout + filters on the new
 * `DataTable` base, so it exposes exactly the same column/visibility/filter options as the Agenda /
 * task-preparation table. A leading radio column + `onRowClick` provide single selection.
 */
export const TaskSelector = ({
  selectedTasks,
  onSelectTask,
  className,
  isSelected = (taskId: string) => selectedTasks.has(taskId),
}: TaskSelectorProps) => {
  const { data: user } = useCurrentUser();
  const currentUserId = (user as { id?: string } | undefined)?.id;

  // Same display scope as the preparation page; load the whole active set for client-side
  // search/filter/sort (the API caps limit at 1000, matching the prep buckets).
  const { data, isLoading } = useTasks({
    shouldDisplayInPreparation: true,
    include: LIST_INCLUDE as never,
    limit: 1000,
    orderBy: { forecastDate: "asc" },
    refetchOnWindowFocus: false,
    staleTime: 30_000,
  } as never);

  const tasks = (((data as { data?: Task[] } | undefined)?.data ?? []) as ClusteredTask[]);

  const prepColumns = useMemo(() => createTaskPreparationColumns({ currentUserId }), [currentUserId]);

  // Prepend a single-select radio indicator; the preparation columns are reused verbatim after it.
  const columns = useMemo<DataTableColumnDef<ClusteredTask>[]>(
    () => [
      {
        id: "__select",
        header: "",
        size: 48,
        minSize: 48,
        enableSorting: false,
        enableHiding: false,
        enableResizing: false,
        meta: { headerLabel: "" },
        cell: ({ row }) =>
          isSelected(row.original.id) ? (
            <IconCircleCheckFilled className="h-5 w-5 text-primary" />
          ) : (
            <IconCircle className="h-5 w-5 text-muted-foreground/40" />
          ),
      },
      ...prepColumns,
    ],
    [prepColumns, isSelected],
  );

  // Same declarative filters as the preparation table.
  const filterDefs = useMemo<DataTableFilterDef<ClusteredTask>[]>(() => {
    const custMap = new Map<string, string>();
    for (const t of tasks) {
      if (t.customer?.id) custMap.set(t.customer.id, t.customer.corporateName || t.customer.fantasyName || t.customer.id);
    }
    const customerOptions = Array.from(custMap, ([value, label]) => ({ value, label })).sort((a, b) => a.label.localeCompare(b.label));
    return [
      { key: "forecastDate", label: "Previsão", type: "date-range", accessor: (r) => r.forecastDate },
      { key: "term", label: "Prazo", type: "date-range", accessor: (r) => r.term },
      { key: "createdAt", label: "Data de Criação", type: "date-range", accessor: (r) => r.createdAt },
      { key: "customerId", label: "Razão Social", type: "multiselect", options: customerOptions, accessor: (r) => r.customer?.id ?? "" },
      {
        key: "truckCategory",
        label: "Categoria",
        type: "multiselect",
        options: Object.entries(TRUCK_CATEGORY_LABELS).map(([value, label]) => ({ value, label })),
        accessor: (r) => r.truck?.category ?? "",
      },
      {
        key: "implementType",
        label: "Tipo de Implemento",
        type: "multiselect",
        options: Object.entries(IMPLEMENT_TYPE_LABELS).map(([value, label]) => ({ value, label })),
        accessor: (r) => r.truck?.implementType ?? "",
      },
    ];
  }, [tasks]);

  return (
    <div className={cn("flex h-full min-h-0 flex-col", className)}>
      <DataTable<ClusteredTask>
        tableId="airbrushing-task-selector"
        data={tasks}
        columns={columns}
        filterDefs={filterDefs}
        getRowId={(t) => t.id}
        onRowClick={(t) => onSelectTask(t.id)}
        isLoading={isLoading}
        enableSelection={false}
        enableShare={false}
        syncUrl={false}
        estimateRowHeight={44}
        searchPlaceholder="Buscar tarefas..."
        emptyMessage="Nenhuma tarefa encontrada. Ajuste os filtros para ver mais resultados."
        className="flex-1 min-h-0"
      />
    </div>
  );
};
