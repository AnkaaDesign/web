import { useCallback, useMemo } from "react";
import { useTasks } from "../../../../hooks";
import { useCurrentUser } from "@/hooks/common/use-auth";
import { cn } from "@/lib/utils";
import { DataTable, type DataTableFilterDef } from "@/components/ui/datatable";
import { TRUCK_CATEGORY_LABELS, IMPLEMENT_TYPE_LABELS } from "../../../../constants";
import { createTaskPreparationColumns } from "@/components/production/task/preparation/task-prep-columns";
import type { ClusteredTask } from "@/components/production/task/preparation/cluster-tasks";
import type { Task } from "../../../../types";

/**
 * Referentially STABLE row-id accessor. TanStack requires `getRowId` to be stable — an inline
 * `(t) => t.id` is a new function every render, which makes the DataTable rebuild its row model and
 * corrupts the row-selection map (selecting one row scrambles/duplicates the whole selection). Must
 * live at module scope so it never changes identity.
 */
const getTaskRowId = (t: ClusteredTask) => t.id;

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
  customer: { select: { id: true, fantasyName: true, corporateName: true, logo: true } },
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
  /** Currently-selected task ids. Seeds the table's selection on mount (mirror of the parent state). */
  selectedTaskIds: string[];
  /**
   * Fired when the selection changes, with the selected task ids AND the matching task rows (so a
   * caller can read per-task context — customer, sector — without a second fetch).
   */
  onSelectionChange: (taskIds: string[], tasks: ClusteredTask[]) => void;
  /** "multiple" (default) for the copy-config-per-task flow; "single" for a one-task picker. */
  selectionMode?: "single" | "multiple";
  className?: string;
}

/**
 * Reusable task picker built on the shared `DataTable` NATIVE selection (the canonical `Checkbox`
 * column — so it matches every other table, stays out of the column manager, and supports multi- or
 * single-select). Reuses the FULL task-preparation column set (`createTaskPreparationColumns`) + its
 * filters, so it exposes exactly the same column/visibility/filter options as the Agenda /
 * task-preparation table. The DataTable owns selection; the parent mirrors it via `onSelectionChange`
 * and seeds it via `selectedTaskIds`.
 *
 * Used by the airbrushing wizard (copy one config across the selected tasks) and intended for reuse
 * by any "pick N tasks, then act on each" flow.
 */
export const TaskSelector = ({
  selectedTaskIds,
  onSelectionChange,
  selectionMode = "multiple",
  className,
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

  // Memoize so an unrelated re-render never hands DataTable a fresh `data` array — a new reference
  // rebuilds the TanStack row model and remounts every row, which re-triggers the virtualizer's
  // measure→notify cycle (the row-model churn behind "Maximum update depth exceeded").
  const tasks = useMemo(
    () => (((data as { data?: Task[] } | undefined)?.data ?? []) as ClusteredTask[]),
    [data],
  );

  // The preparation columns are reused verbatim — the leading selection column is the DataTable's
  // native (canonical `Checkbox`) column, not a custom column def, so it never leaks into the
  // column manager and always matches the rest of the app.
  const columns = useMemo(() => createTaskPreparationColumns({ currentUserId }), [currentUserId]);

  // Map the native selection (ids) back to the task rows the parent needs (customer/sector context).
  const handleSelectionChange = useCallback(
    (ids: string[]) => {
      const byId = new Map(tasks.map((t) => [t.id, t] as const));
      onSelectionChange(
        ids,
        ids.map((id) => byId.get(id)).filter((t): t is ClusteredTask => !!t),
      );
    },
    [tasks, onSelectionChange],
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
        getRowId={getTaskRowId}
        isLoading={isLoading}
        enableSelection
        enableMultiRowSelection={selectionMode !== "single"}
        selectOnRowClick
        initialSelectedIds={selectedTaskIds}
        onSelectionChange={handleSelectionChange}
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
