import { BaseExportPopover, type ExportFormat, type ExportColumn } from "@/components/ui/export-popover";
import { toast } from "@/components/ui/sonner";
import { taskService } from "../../../../api-client";
import { formatDate, formatDateTime, formatCurrency } from "../../../../utils";
import { TASK_STATUS, TASK_STATUS_LABELS, PAINT_FINISH_LABELS, PAINT_BRAND_LABELS, TRUCK_MANUFACTURER_LABELS } from "../../../../constants";
import type { Task } from "../../../../types";
import type { TaskGetManyFormData } from "../../../../schemas";

interface TaskScheduleExportProps {
  className?: string;
  filters?: Partial<TaskGetManyFormData>;
  currentTasks?: Task[];
  totalRecords?: number;
  visibleColumns?: Set<string>;
  selectedTasks?: Set<string>;
  tasks?: Task[]; // Allow direct tasks prop
}

// Column configuration for export - matches table columns
const EXPORT_COLUMNS: ExportColumn<Task>[] = [
  { id: "name", label: "Logomarca", getValue: (task: Task) => task.name || "" },
  { id: "customer.fantasyName", label: "Cliente", getValue: (task: Task) => task.customer?.fantasyName || "" },
  {
    id: "generalPainting",
    label: "Pintura",
    getValue: (task: Task) => {
      if (!task.generalPainting) return "";
      const parts = [];
      if (task.generalPainting.name) parts.push(task.generalPainting.name);
      if (task.generalPainting.finish) parts.push(PAINT_FINISH_LABELS[task.generalPainting.finish as keyof typeof PAINT_FINISH_LABELS]);
      if (task.generalPainting.manufacturer) parts.push(TRUCK_MANUFACTURER_LABELS[task.generalPainting.manufacturer as keyof typeof TRUCK_MANUFACTURER_LABELS]);
      else if (task.generalPainting.paintBrand?.name) parts.push(task.generalPainting.paintBrand.name);
      return parts.join(" - ");
    },
  },
  { id: "serialNumberOrPlate", label: "Nº Série/Placa", getValue: (task: Task) => task.serialNumber || task.plate || "" },
  { id: "sector.name", label: "Setor", getValue: (task: Task) => task.sector?.name || "" },
  { id: "entryDate", label: "Entrada", getValue: (task: Task) => (task.entryDate ? formatDate(task.entryDate) : "") },
  { id: "startedAt", label: "Iniciado Em", getValue: (task: Task) => (task.startedAt ? formatDate(task.startedAt) : "") },
  { id: "finishedAt", label: "Finalizado Em", getValue: (task: Task) => (task.finishedAt ? formatDate(task.finishedAt) : "") },
  { id: "term", label: "Prazo", getValue: (task: Task) => (task.term ? formatDate(task.term) : "") },
  {
    id: "remainingTime",
    label: "Tempo Restante",
    getValue: (task: Task) => {
      if (!task.term || task.status === TASK_STATUS.COMPLETED || task.status === TASK_STATUS.CANCELLED) return "-";

      const now = new Date();
      const deadline = new Date(task.term);
      const diffMs = Math.abs(deadline.getTime() - now.getTime());

      const totalSeconds = Math.floor(diffMs / 1000);
      const days = Math.floor(totalSeconds / (24 * 60 * 60));
      const hours = Math.floor((totalSeconds % (24 * 60 * 60)) / (60 * 60));
      const minutes = Math.floor((totalSeconds % (60 * 60)) / 60);
      const seconds = totalSeconds % 60;

      const formattedTime = [days.toString().padStart(2, "0"), hours.toString().padStart(2, "0"), minutes.toString().padStart(2, "0"), seconds.toString().padStart(2, "0")].join(
        ":",
      );

      const isOverdue = deadline.getTime() < now.getTime();
      return isOverdue ? `${formattedTime} (atrasado)` : formattedTime;
    },
  },
  { id: "status", label: "Status", getValue: (task: Task) => TASK_STATUS_LABELS[task.status as keyof typeof TASK_STATUS_LABELS] || task.status },
  { id: "price", label: "Preço", getValue: (task: Task) => (task.price ? formatCurrency(task.price) : "") },
  { id: "details", label: "Detalhes", getValue: (task: Task) => task.details || "" },
  { id: "createdBy.name", label: "Criado Por", getValue: (task: Task) => task.createdBy?.name || "" },
  { id: "createdAt", label: "Criado em", getValue: (task: Task) => formatDate(new Date(task.createdAt)) },
  { id: "updatedAt", label: "Atualizado em", getValue: (task: Task) => formatDate(new Date(task.updatedAt)) },
];

// Default columns if none are specified
const DEFAULT_VISIBLE_COLUMNS = new Set(["name", "customer.fantasyName", "generalPainting", "serialNumberOrPlate", "entryDate", "term", "remainingTime"]);

export function TaskScheduleExport({ className, filters = {}, currentTasks = [], totalRecords = 0, visibleColumns, selectedTasks, tasks }: TaskScheduleExportProps) {
  // Use direct tasks prop if provided, otherwise use currentTasks
  const effectiveTasks = tasks || currentTasks;
  const effectiveTotalRecords = tasks ? tasks.length : totalRecords;

  const handleExport = async (format: ExportFormat, tasks: Task[], columns: ExportColumn<Task>[]) => {
    // Generate export based on format
    switch (format) {
      case "csv":
        await exportToCSV(tasks, columns);
        break;
      case "excel":
        await exportToExcel(tasks, columns);
        break;
      case "pdf":
        await exportToPDF(tasks, columns);
        break;
    }

    toast.success(`Exportação ${format.toUpperCase()} concluída com sucesso!`);
  };

  const fetchAllTasks = async (): Promise<Task[]> => {
    // If we have direct tasks, return them
    if (tasks) return tasks;

    // Otherwise fetch from API
    const allTasksResponse = await taskService.getTasks({
      ...filters,
      limit: effectiveTotalRecords > 0 ? effectiveTotalRecords : 10000, // Limit to prevent memory issues
      include: {
        sector: true,
        customer: true,
        createdBy: true,
        services: true,
        generalPainting: true,
      },
    });

    return allTasksResponse.data || [];
  };

  const exportToCSV = async (tasks: Task[], columns: ExportColumn<Task>[]) => {
    // CSV headers from visible columns
    const headers = columns.map((col) => col.label);

    // Convert tasks to CSV rows with only visible columns
    const rows = tasks.map((task) => columns.map((col) => col.getValue(task)));

    // Create CSV content
    const csvContent = [headers.join(","), ...rows.map((row) => row.map((cell) => `"${cell}"`).join(","))].join("\n");

    // Download CSV
    const blob = new Blob(["\ufeff" + csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", `cronograma_${formatDate(new Date()).replace(/\//g, "-")}.csv`);
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const exportToExcel = async (tasks: Task[], columns: ExportColumn<Task>[]) => {
    // Headers from visible columns
    const headers = columns.map((col) => col.label);

    // Convert tasks to rows with only visible columns
    const rows = tasks.map((task) => columns.map((col) => col.getValue(task)));

    // Create tab-separated values for Excel
    const excelContent = [headers.join("\t"), ...rows.map((row) => row.join("\t"))].join("\n");

    // Download as .xls file
    const blob = new Blob(["\ufeff" + excelContent], { type: "application/vnd.ms-excel;charset=utf-8;" });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", `cronograma_${formatDate(new Date()).replace(/\//g, "-")}.xls`);
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const exportToPDF = async (tasks: Task[], columns: ExportColumn<Task>[]) => {
    // Calculate responsive font sizes based on column count
    const columnCount = columns.length;
    const fontSize = columnCount <= 6 ? "12px" : columnCount <= 10 ? "10px" : "8px";
    const headerFontSize = columnCount <= 6 ? "11px" : columnCount <= 10 ? "9px" : "7px";
    const cellPadding = columnCount <= 6 ? "8px 6px" : columnCount <= 10 ? "6px 4px" : "4px 3px";
    const headerPadding = columnCount <= 6 ? "10px 6px" : columnCount <= 10 ? "8px 4px" : "6px 3px";

    // A4 optimized PDF with proper formatting
    const pdfContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <title>Cronograma - ${formatDate(new Date())}</title>
        <style>
          @page {
            size: A4 landscape;
            margin: 12mm;
          }
          
          * { 
            box-sizing: border-box; 
            margin: 0;
            padding: 0;
          }
          
          html, body { 
            height: 100vh;
            width: 100vw;
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
            background: white;
            font-size: ${fontSize};
            line-height: 1.3;
            overflow-x: auto;
          }
          
          body {
            display: grid;
            grid-template-rows: auto 1fr auto;
            min-height: 100vh;
            padding: 0;
          }
          
          .header {
            display: flex;
            align-items: center;
            margin-bottom: 20px;
            padding-bottom: 15px;
            border-bottom: 2px solid #e5e7eb;
            flex-shrink: 0;
          }
          
          .logo {
            width: ${columnCount <= 6 ? "100px" : "80px"};
            height: auto;
            margin-right: 15px;
          }
          
          .header-info {
            flex: 1;
          }
          
          .header-title {
            font-size: ${columnCount <= 6 ? "24px" : "20px"};
            font-weight: 700;
            color: #1f2937;
            margin-bottom: 5px;
          }
          
          .info {
            color: #6b7280;
            font-size: ${columnCount <= 6 ? "12px" : "10px"};
          }
          
          .info p {
            margin: 2px 0;
          }
          
          .content-wrapper {
            flex: 1;
            overflow: auto;
            min-height: 0;
            padding-bottom: 40px;
          }
          
          table {
            width: 100%;
            border-collapse: collapse;
            border: 1px solid #e5e7eb;
            font-size: ${fontSize};
            table-layout: fixed;
            word-wrap: break-word;
          }
          
          th {
            background-color: #f9fafb;
            font-weight: 600;
            color: #374151;
            padding: ${headerPadding};
            border-bottom: 2px solid #e5e7eb;
            border-right: 1px solid #e5e7eb;
            font-size: ${headerFontSize};
            text-transform: uppercase;
            letter-spacing: 0.03em;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
          }
          
          td {
            padding: ${cellPadding};
            border-bottom: 1px solid #f3f4f6;
            border-right: 1px solid #f3f4f6;
            vertical-align: top;
            word-wrap: break-word;
            overflow: hidden;
          }
          
          tbody tr:nth-child(even) {
            background-color: #fafafa;
          }
          
          /* Status styles */
          .status-pending { color: #f59e0b; }
          .status-production { color: #3b82f6; }
          .status-completed { color: #10b981; }
          .status-cancelled { color: #ef4444; }
          
          .text-left { text-align: left; }
          .text-center { text-align: center; }
          .text-right { text-align: right; }
          
          .font-mono {
            font-family: 'SFMono-Regular', Consolas, 'Liberation Mono', Menlo, monospace;
            font-size: ${columnCount <= 6 ? "10px" : "8px"};
          }
          
          .font-medium { font-weight: 500; }
          .font-semibold { font-weight: 600; }
          .text-muted { color: #6b7280; }
          
          .footer {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding-top: 15px;
            border-top: 1px solid #e5e7eb;
            color: #6b7280;
            font-size: ${columnCount <= 6 ? "10px" : "8px"};
            flex-shrink: 0;
            background: white;
          }
          
          .footer-left {
            flex: 1;
          }
          
          .footer-right {
            text-align: right;
          }
          
          /* Dynamic column widths */
          ${columns
            .map((col, index) => {
              let width = "120px"; // default
              switch (col.id) {
                case "name":
                  width = columnCount <= 6 ? "200px" : "150px";
                  break;
                case "customer.fantasyName":
                  width = "150px";
                  break;
                case "generalPainting":
                  width = "180px";
                  break;
                case "serialNumberOrPlate":
                  width = "120px";
                  break;
                case "sector.name":
                  width = "100px";
                  break;
                case "entryDate":
                case "startedAt":
                case "finishedAt":
                case "term":
                  width = "90px";
                  break;
                case "remainingTime":
                  width = "130px";
                  break;
                case "status":
                  width = "80px";
                  break;
                case "price":
                  width = "90px";
                  break;
                case "details":
                  width = columnCount <= 6 ? "200px" : "150px";
                  break;
                default:
                  width = "100px";
              }
              return `th:nth-child(${index + 1}), td:nth-child(${index + 1}) { width: ${width}; min-width: 60px; }`;
            })
            .join("\n")}
          
          /* Print optimizations */
          @media print {
            @page {
              size: A4 landscape;
              margin: 8mm;
            }
            
            html, body {
              width: 100%;
              height: 100%;
              overflow: visible;
            }
            
            body {
              display: block;
              min-height: 100vh;
              position: relative;
              padding-bottom: 50px;
            }
            
            .header { 
              margin-bottom: 15px; 
              padding-bottom: 10px;
            }
            
            .logo { 
              width: ${columnCount <= 6 ? "80px" : "60px"}; 
            }
            
            table { 
              font-size: ${columnCount <= 6 ? "9px" : "7px"};
              page-break-inside: auto;
            }
            
            th { 
              padding: ${columnCount <= 6 ? "6px 4px" : "4px 2px"};
              font-size: ${columnCount <= 6 ? "8px" : "6px"};
            }
            
            td { 
              padding: ${columnCount <= 6 ? "4px 3px" : "3px 2px"};
            }
            
            tr {
              page-break-inside: avoid;
              page-break-after: auto;
            }
            
            thead {
              display: table-header-group;
            }
            
            .footer {
              position: fixed;
              bottom: 8mm;
              left: 8mm;
              right: 8mm;
              background: white;
              font-size: ${columnCount <= 6 ? "8px" : "6px"};
            }
            
            .content-wrapper {
              padding-bottom: 60px;
            }
          }
        </style>
      </head>
      <body>
        <div class="header">
          <img src="/logo.png" alt="Ankaa Logo" class="logo" />
          <div class="header-info">
            <h1 class="header-title">Cronograma de Produção</h1>
            <div class="info">
              <p><strong>Data:</strong> ${formatDate(new Date())}</p>
              <p><strong>Total de tarefas:</strong> ${tasks.length}</p>
            </div>
          </div>
        </div>
        
        <div class="content-wrapper">
          <table>
            <thead>
              <tr>
                ${columns
                  .map((col) => {
                    // Get column alignment
                    let alignment = "text-left";
                    if (["price", "remainingTime"].includes(col.id)) {
                      alignment = "text-right";
                    } else if (["status"].includes(col.id)) {
                      alignment = "text-center";
                    }
                    return `<th class="${alignment}">${col.label}</th>`;
                  })
                  .join("")}
              </tr>
            </thead>
            <tbody>
              ${tasks
                .map((task) => {
                  return `
                  <tr>
                    ${columns
                      .map((col) => {
                        let value = col.getValue(task) || "-";
                        let className = "";

                        // Apply formatting based on column
                        switch (col.id) {
                          case "name":
                            className = "font-medium text-left";
                            break;
                          case "customer.fantasyName":
                            className = "text-left";
                            break;
                          case "generalPainting":
                            className = "text-left";
                            break;
                          case "serialNumberOrPlate":
                            className = "font-mono text-left";
                            break;
                          case "sector.name":
                            className = "text-left";
                            break;
                          case "entryDate":
                          case "startedAt":
                          case "finishedAt":
                          case "term":
                            className = "text-left text-muted";
                            break;
                          case "remainingTime":
                            className = "font-mono text-right";
                            if (value.includes("atrasado")) {
                              className += " text-red-600";
                            }
                            break;
                          case "status":
                            className = "text-center font-medium";
                            // Add status color classes
                            if (task.status === TASK_STATUS.PENDING) className += " status-pending";
                            else if (task.status === TASK_STATUS.IN_PRODUCTION) className += " status-production";
                            else if (task.status === TASK_STATUS.COMPLETED) className += " status-completed";
                            else if (task.status === TASK_STATUS.CANCELLED) className += " status-cancelled";
                            break;
                          case "price":
                            className = "text-right font-medium";
                            break;
                          case "details":
                            className = "text-left text-muted";
                            break;
                          case "createdBy.name":
                            className = "text-left";
                            break;
                          case "createdAt":
                          case "updatedAt":
                            className = "text-left text-muted";
                            break;
                          default:
                            className = "text-left";
                        }

                        return `<td class="${className}">${value}</td>`;
                      })
                      .join("")}
                  </tr>
                `;
                })
                .join("")}
            </tbody>
          </table>
        </div>
        
        <div class="footer">
          <div class="footer-left">
            <p>Cronograma de Produção - Sistema Ankaa</p>
          </div>
          <div class="footer-right">
            <p><strong>Gerado em:</strong> ${formatDateTime(new Date())}</p>
          </div>
        </div>
      </body>
      </html>
    `;

    const printWindow = window.open("", "_blank");
    if (printWindow) {
      printWindow.document.write(pdfContent);
      printWindow.document.close();
      printWindow.focus();

      printWindow.onload = () => {
        printWindow.print();
        printWindow.onafterprint = () => {
          printWindow.close();
        };
      };
    }
  };

  return (
    <BaseExportPopover<Task>
      className={className}
      currentItems={effectiveTasks}
      totalRecords={effectiveTotalRecords}
      selectedItems={selectedTasks}
      visibleColumns={visibleColumns}
      exportColumns={EXPORT_COLUMNS}
      defaultVisibleColumns={DEFAULT_VISIBLE_COLUMNS}
      onExport={handleExport}
      onFetchAllItems={fetchAllTasks}
      entityName="tarefa"
      entityNamePlural="tarefas"
    />
  );
}
