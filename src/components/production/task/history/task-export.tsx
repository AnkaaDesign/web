import { BaseExportPopover, type ExportFormat, type ExportColumn } from "@/components/ui/export-popover";
import type { Task } from "../../../../types";
import type { TaskGetManyFormData } from "../../../../schemas";
import { formatCurrency, formatDate, formatDateTime, getDurationBetweenDates } from "../../../../utils";
import { TASK_STATUS_LABELS } from "../../../../constants";
import { taskService } from "../../../../api-client";

interface TaskExportProps {
  className?: string;
  filters?: Partial<TaskGetManyFormData>;
  currentItems?: Task[];
  totalRecords?: number;
  visibleColumns?: Set<string>;
  selectedItems?: Set<string>;
}

// Column configuration for export - matching task-history-columns.tsx structure
const EXPORT_COLUMNS: ExportColumn<Task>[] = [
  { id: "name", label: "Título", getValue: (task: Task) => task.name },
  { id: "status", label: "Status", getValue: (task: Task) => TASK_STATUS_LABELS[task.status] || task.status },
  { id: "customer.fantasyName", label: "Cliente", getValue: (task: Task) => task.customer?.fantasyName || "" },
  { id: "sector.name", label: "Setor", getValue: (task: Task) => task.sector?.name || "" },
  {
    id: "services",
    label: "Serviços",
    getValue: (task: Task) => task.services?.map((s) => s.service?.name || s.description || "").join(", ") || "",
  },
  { id: "entryDate", label: "Data de Entrada", getValue: (task: Task) => (task.entryDate ? formatDate(new Date(task.entryDate)) : "") },
  { id: "startedAt", label: "Iniciado em", getValue: (task: Task) => (task.startedAt ? formatDateTime(new Date(task.startedAt)) : "") },
  { id: "finishedAt", label: "Finalizado em", getValue: (task: Task) => (task.finishedAt ? formatDateTime(new Date(task.finishedAt)) : "") },
  {
    id: "duration",
    label: "Duração",
    getValue: (task: Task) => {
      if (task.startedAt && task.finishedAt) {
        return getDurationBetweenDates(new Date(task.startedAt), new Date(task.finishedAt));
      }
      return "";
    },
  },
  {
    id: "completedBy.name",
    label: "Criado por",
    getValue: (task: Task) => {
      return task.createdBy?.name || "";
    },
  },
  { id: "observation", label: "Observação", getValue: (task: Task) => task.observation?.description || "" },
  { id: "generalPainting.name", label: "Tinta", getValue: (task: Task) => task.generalPainting?.name || "" },
  { id: "plate", label: "Placa", getValue: (task: Task) => task.plate || "" },
  { id: "createdBy.name", label: "Criado por", getValue: (task: Task) => task.createdBy?.name || "" },
  { id: "createdAt", label: "Criado em", getValue: (task: Task) => formatDate(new Date(task.createdAt)) },
  { id: "updatedAt", label: "Atualizado em", getValue: (task: Task) => formatDate(new Date(task.updatedAt)) },
];

export function TaskExport({ className, filters = {}, currentItems = [], totalRecords = 0, visibleColumns, selectedItems }: TaskExportProps) {
  const fetchAllItems = async (): Promise<Task[]> => {
    const allItems: Task[] = [];
    let page = 1;
    const pageSize = 100;

    // Fetch all pages
    while (true) {
      const response = await taskService.getTasks({
        ...filters,
        skip: Math.max(0, (page - 1) * pageSize),
        take: pageSize,
        include: {
          sector: true,
          customer: true,
          createdBy: true,
          generalPaint: true,
          services: {
            include: {
              service: true,
            },
          },
          observation: true,
        },
      });

      if (!response.data || response.data.length === 0) {
        break;
      }

      allItems.push(...response.data);

      if (response.data.length < pageSize) {
        break;
      }

      page++;
    }

    return allItems;
  };

  const createExportBlob = async (data: any[], format: ExportFormat, columns: ExportColumn<Task>[]): Promise<Blob> => {
    if (format === "csv") {
      const headers = columns.map((col) => col.label).join(",");
      const rows = data.map((row) =>
        columns
          .map((col) => {
            const value = row[col.label] || "";
            // Escape commas and quotes in CSV
            return typeof value === "string" && (value.includes(",") || value.includes('"')) ? `"${value.replace(/"/g, '""')}"` : value;
          })
          .join(","),
      );
      const csv = [headers, ...rows].join("\n");
      return new Blob([csv], { type: "text/csv;charset=utf-8;" });
    } else {
      // JSON format
      const json = JSON.stringify(data, null, 2);
      return new Blob([json], { type: "application/json;charset=utf-8;" });
    }
  };

  const suggestedFilename = () => {
    const date = new Date().toISOString().split("T")[0];
    const count = selectedItems && selectedItems.size > 0 ? selectedItems.size : totalRecords;
    return `tarefas-${count}-items-${date}`;
  };

  return (
    <BaseExportPopover
      className={className}
      currentItems={currentItems}
      totalRecords={totalRecords}
      selectedItems={selectedItems}
      visibleColumns={visibleColumns}
      exportColumns={EXPORT_COLUMNS}
      onExport={async (format: ExportFormat, items: Task[], columns: ExportColumn<Task>[]) => {
        const exportData = items.map((item) => {
          const row: Record<string, any> = {};
          columns.forEach((column) => {
            row[column.label] = column.getValue(item);
          });
          return row;
        });

        const blob = await createExportBlob(exportData, format, columns);
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = suggestedFilename() + (format === "csv" ? ".csv" : ".json");
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      }}
      onFetchAllItems={fetchAllItems}
      entityName="tarefa"
      entityNamePlural="tarefas"
    />
  );
}
