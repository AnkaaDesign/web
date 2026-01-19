import { useState } from "react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { IconDownload, IconFileTypeCsv, IconFileTypeXls } from "@tabler/icons-react";
import { useToast } from "@/hooks/use-toast";
import { formatDate, formatDateTime, formatCurrency, getTaskStatusLabel } from "../../../../utils";
import type { Task } from "../../../../types";
import type { TaskGetManyFormData } from "../../../../schemas";
import { taskService } from "../../../../api-client";
import { createTaskColumns } from "./task-table-columns";

interface TaskExportProps {
  filters: Partial<TaskGetManyFormData>;
  currentItems: Task[];
  totalRecords: number;
  visibleColumns: Set<string>;
}

export function TaskExport({ filters, currentItems, totalRecords, visibleColumns }: TaskExportProps) {
  const { toast } = useToast();
  const [isExporting, setIsExporting] = useState(false);

  const columns = createTaskColumns().filter((col) => visibleColumns.has(col.id));

  const handleExportCurrentPage = async (format: "csv" | "xlsx") => {
    try {
      setIsExporting(true);

      // Prepare data
      const data = currentItems.map((task) => {
        const row: any = {};

        columns.forEach((column) => {
          const value = column.accessorFn ? column.accessorFn(task) : (task as any)[column.accessorKey || column.id];

          // Format values based on column
          switch (column.id) {
            case "status":
              row[column.header] = getTaskStatusLabel(value);
              break;
            case "price":
              row[column.header] = value ? formatCurrency(value) : "";
              break;
            case "entryDate":
            case "term":
            case "startedAt":
            case "finishedAt":
              row[column.header] = value ? formatDate(value) : "";
              break;
            case "createdAt":
            case "updatedAt":
              row[column.header] = value ? formatDateTime(value) : "";
              break;
            case "customer.fantasyName":
              row[column.header] = task.customer?.fantasyName || "";
              break;
            case "sector.name":
              row[column.header] = task.sector?.name || "";
              break;
            case "createdBy.name":
              row[column.header] = task.createdBy?.name || "";
              break;
            case "services":
              row[column.header] = task.serviceOrders?.length || 0;
              break;
            case "hasArtworks":
              row[column.header] = (task.artworks?.length || 0) > 0 ? "Sim" : "Não";
              break;
            case "hasObservation":
              row[column.header] = task.observation ? "Sim" : "Não";
              break;
            default:
              row[column.header] = value || "";
          }
        });

        return row;
      });

      if (format === "csv") {
        exportToCSV(data, "tarefas-pagina-atual");
      } else {
        await exportToExcel(data, "tarefas-pagina-atual");
      }

      toast({
        title: "Exportação concluída",
        description: `${currentItems.length} tarefas exportadas com sucesso.`,
      });
    } catch (error) {
      if (process.env.NODE_ENV !== 'production') {
        console.error("Export error:", error);
      }
      toast({
        title: "Erro na exportação",
        description: "Não foi possível exportar os dados.",
        variant: "error",
      });
    } finally {
      setIsExporting(false);
    }
  };

  const handleExportAll = async (format: "csv" | "xlsx") => {
    try {
      setIsExporting(true);

      toast({
        title: "Exportando dados",
        description: `Exportando ${totalRecords} tarefas...`,
      });

      // Fetch all data
      const allItems: Task[] = [];
      let page = 1;
      const pageSize = 100;

      while (allItems.length < totalRecords) {
        const response = await taskService.getTasks({
          ...filters,
          page,
          limit: pageSize,
          include: {
            sector: true,
            customer: true,
            createdBy: true,
            serviceOrders: true,
            files: true,
            observation: true,
          },
        });

        if (response.data) {
          allItems.push(...response.data);
        }

        if (!response.meta?.hasNextPage) break;
        page++;
      }

      // Prepare data
      const data = allItems.map((task) => {
        const row: any = {};

        columns.forEach((column) => {
          const value = column.accessorFn ? column.accessorFn(task) : (task as any)[column.accessorKey || column.id];

          // Format values based on column
          switch (column.id) {
            case "status":
              row[column.header] = getTaskStatusLabel(value);
              break;
            case "price":
              row[column.header] = value ? formatCurrency(value) : "";
              break;
            case "entryDate":
            case "term":
            case "startedAt":
            case "finishedAt":
              row[column.header] = value ? formatDate(value) : "";
              break;
            case "createdAt":
            case "updatedAt":
              row[column.header] = value ? formatDateTime(value) : "";
              break;
            case "customer.fantasyName":
              row[column.header] = task.customer?.fantasyName || "";
              break;
            case "sector.name":
              row[column.header] = task.sector?.name || "";
              break;
            case "createdBy.name":
              row[column.header] = task.createdBy?.name || "";
              break;
            case "services":
              row[column.header] = task.serviceOrders?.length || 0;
              break;
            case "hasArtworks":
              row[column.header] = (task.artworks?.length || 0) > 0 ? "Sim" : "Não";
              break;
            case "hasObservation":
              row[column.header] = task.observation ? "Sim" : "Não";
              break;
            default:
              row[column.header] = value || "";
          }
        });

        return row;
      });

      if (format === "csv") {
        exportToCSV(data, "tarefas-todas");
      } else {
        await exportToExcel(data, "tarefas-todas");
      }

      toast({
        title: "Exportação concluída",
        description: `${allItems.length} tarefas exportadas com sucesso.`,
      });
    } catch (error) {
      if (process.env.NODE_ENV !== 'production') {
        console.error("Export error:", error);
      }
      toast({
        title: "Erro na exportação",
        description: "Não foi possível exportar os dados.",
        variant: "error",
      });
    } finally {
      setIsExporting(false);
    }
  };

  const exportToCSV = (data: any[], filename: string) => {
    if (data.length === 0) return;

    const headers = Object.keys(data[0]);
    const csvContent = [
      headers.join(","),
      ...data.map((row) =>
        headers
          .map((header) => {
            const value = row[header];
            // Escape quotes and wrap in quotes if contains comma or quotes
            const stringValue = String(value || "");
            if (stringValue.includes(",") || stringValue.includes('"')) {
              return `"${stringValue.replace(/"/g, '""')}"`;
            }
            return stringValue;
          })
          .join(","),
      ),
    ].join("\n");

    const blob = new Blob(["\ufeff" + csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `${filename}_${formatDate(new Date()).replace(/\//g, "-")}.csv`;
    link.click();
    URL.revokeObjectURL(link.href);
  };

  const exportToExcel = async (data: any[], filename: string) => {
    try {
      // Dynamically import xlsx
      const XLSX = await import("xlsx");

      const ws = XLSX.utils.json_to_sheet(data);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Tarefas");

      // Auto-size columns
      const colWidths = columns.map(() => ({ wch: 20 }));
      ws["!cols"] = colWidths;

      XLSX.writeFile(wb, `${filename}_${formatDate(new Date()).replace(/\//g, "-")}.xlsx`, {
        bookType: 'xlsx', bookSST: false, type: 'binary'
      });
    } catch (error) {
      if (process.env.NODE_ENV !== 'production') {
        console.error("Excel export error:", error);
      }
      // Fallback to CSV
      exportToCSV(data, filename);
      toast({
        title: "Aviso",
        description: "Exportado como CSV (Excel não disponível).",
      });
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="default" disabled={isExporting} className="group">
          <IconDownload className="h-4 w-4 text-muted-foreground group-hover:text-foreground transition-colors" />
          <span className="text-foreground">Exportar</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel>Exportar Dados</DropdownMenuLabel>
        <DropdownMenuSeparator />

        <DropdownMenuItem onClick={() => handleExportCurrentPage("csv")} disabled={isExporting}>
          <IconFileTypeCsv className="h-4 w-4 mr-2" />
          Página atual (CSV)
        </DropdownMenuItem>

        <DropdownMenuItem onClick={() => handleExportCurrentPage("xlsx")} disabled={isExporting}>
          <IconFileTypeXls className="h-4 w-4 mr-2" />
          Página atual (Excel)
        </DropdownMenuItem>

        <DropdownMenuSeparator />

        <DropdownMenuItem onClick={() => handleExportAll("csv")} disabled={isExporting}>
          <IconFileTypeCsv className="h-4 w-4 mr-2" />
          Todos os dados (CSV)
          {totalRecords > 0 && <span className="ml-auto text-xs text-muted-foreground">{totalRecords} itens</span>}
        </DropdownMenuItem>

        <DropdownMenuItem onClick={() => handleExportAll("xlsx")} disabled={isExporting}>
          <IconFileTypeXls className="h-4 w-4 mr-2" />
          Todos os dados (Excel)
          {totalRecords > 0 && <span className="ml-auto text-xs text-muted-foreground">{totalRecords} itens</span>}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
