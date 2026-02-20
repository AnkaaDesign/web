import { BaseExportPopover, type ExportFormat, type ExportColumn } from "@/components/ui/export-popover";
import { toast } from "@/components/ui/sonner";
import type { Task } from "../../../../types";
import type { TaskGetManyFormData } from "../../../../schemas";
import { formatDate, formatDateTime, getDurationBetweenDates } from "../../../../utils";
import { TASK_STATUS, TASK_STATUS_LABELS, COMMISSION_STATUS_LABELS, COMMISSION_STATUS } from "../../../../constants";
import { taskService } from "../../../../api-client";

// Format date as dd/mm/yy for PDF export
const formatShortDate = (date: Date | string | null | undefined): string => {
  if (!date) return "-";
  const d = typeof date === "string" ? new Date(date) : date;
  if (isNaN(d.getTime())) return "-";

  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = String(d.getFullYear()).slice(-2);

  return `${day}/${month}/${year}`;
};

// Format datetime as dd/mm/yy - HH:mm for PDF export
const formatShortDateTime = (date: Date | string | null | undefined): string => {
  if (!date) return "-";
  const d = typeof date === "string" ? new Date(date) : date;
  if (isNaN(d.getTime())) return "-";

  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = String(d.getFullYear()).slice(-2);
  const hours = String(d.getHours()).padStart(2, '0');
  const minutes = String(d.getMinutes()).padStart(2, '0');

  return `${day}/${month}/${year} - ${hours}:${minutes}`;
};

// Get period label from filters
const getPeriodLabel = (filters: Partial<TaskGetManyFormData>): string => {
  // Check for finishedDateRange (from/to format used in UI)
  const finishedDateRange = (filters as any).finishedDateRange as { from?: Date; to?: Date } | undefined;

  if (finishedDateRange?.from && finishedDateRange?.to) {
    return `${formatShortDate(finishedDateRange.from)} a ${formatShortDate(finishedDateRange.to)}`;
  }

  if (finishedDateRange?.from) {
    return `A partir de ${formatShortDate(finishedDateRange.from)}`;
  }

  if (finishedDateRange?.to) {
    return `Até ${formatShortDate(finishedDateRange.to)}`;
  }

  // Check for finishedAt (gte/lte format used in API)
  const finishedAt = filters.finishedAt as { gte?: Date; lte?: Date } | undefined;

  if (finishedAt?.gte && finishedAt?.lte) {
    return `${formatShortDate(finishedAt.gte)} a ${formatShortDate(finishedAt.lte)}`;
  }

  if (finishedAt?.gte) {
    return `A partir de ${formatShortDate(finishedAt.gte)}`;
  }

  if (finishedAt?.lte) {
    return `Até ${formatShortDate(finishedAt.lte)}`;
  }

  // Check for entryDateRange as fallback
  const entryDateRange = (filters as any).entryDateRange as { from?: Date; to?: Date } | undefined;

  if (entryDateRange?.from && entryDateRange?.to) {
    return `${formatShortDate(entryDateRange.from)} a ${formatShortDate(entryDateRange.to)}`;
  }

  return "Todos os períodos";
};

// Calculate commission statistics from tasks
const getCommissionStats = (tasks: Task[]) => {
  const stats = {
    total: tasks.length,
    fullCommission: 0,
    partialCommission: 0,
    noCommission: 0,
    suspendedCommission: 0,
    weighted: 0, // Ponderadas: full (1.0) + partial (0.5)
  };

  tasks.forEach((task) => {
    switch (task.commission) {
      case COMMISSION_STATUS.FULL_COMMISSION:
        stats.fullCommission++;
        stats.weighted += 1;
        break;
      case COMMISSION_STATUS.PARTIAL_COMMISSION:
        stats.partialCommission++;
        stats.weighted += 0.5;
        break;
      case COMMISSION_STATUS.NO_COMMISSION:
        stats.noCommission++;
        break;
      case COMMISSION_STATUS.SUSPENDED_COMMISSION:
        stats.suspendedCommission++;
        break;
    }
  });

  return stats;
};

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
  { id: "customer.fantasyName", label: "Razão Social", getValue: (task: Task) => task.customer?.corporateName || task.customer?.fantasyName || "" },
  { id: "identificador", label: "Identificador", getValue: (task: Task) => task.serialNumber || task.truck?.plate || "" },
  { id: "sector.name", label: "Setor", getValue: (task: Task) => task.sector?.name || "" },
  {
    id: "serviceOrders",
    label: "Serviços",
    getValue: (task: Task) => task.serviceOrders?.map((s) => s.service?.name || s.description || "").join(", ") || "",
  },
  { id: "entryDate", label: "Data de Entrada", getValue: (task: Task) => (task.entryDate ? formatDate(new Date(task.entryDate)) : "") },
  { id: "forecastDate", label: "Previsão", getValue: (task: Task) => (task.forecastDate ? formatDate(new Date(task.forecastDate)) : "") },
  { id: "term", label: "Prazo", getValue: (task: Task) => (task.term ? formatDate(new Date(task.term)) : "") },
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
    id: "createdBy.name",
    label: "Criado por",
    getValue: (task: Task) => {
      return task.createdBy?.name || "";
    },
  },
  { id: "observation", label: "Observação", getValue: (task: Task) => task.observation?.description || "" },
  { id: "generalPainting.name", label: "Pintura Geral", getValue: (task: Task) => task.generalPainting?.name || "" },
  { id: "details", label: "Detalhes", getValue: (task: Task) => task.details || "" },
  { id: "commission", label: "Comissão", getValue: (task: Task) => task.commission ? COMMISSION_STATUS_LABELS[task.commission] || task.commission : "" },
  { id: "createdAt", label: "Criado em", getValue: (task: Task) => formatDate(new Date(task.createdAt)) },
  { id: "updatedAt", label: "Atualizado em", getValue: (task: Task) => formatDate(new Date(task.updatedAt)) },
];

// Default visible columns for agenda
const DEFAULT_VISIBLE_COLUMNS = new Set(["name", "customer.fantasyName", "identificador", "forecastDate", "serviceOrders"]);

export function TaskExport({ className, filters = {}, currentItems = [], totalRecords = 0, visibleColumns, selectedItems }: TaskExportProps) {
  const fetchAllItems = async (): Promise<Task[]> => {
    const allItems: Task[] = [];
    let page = 1;
    const pageSize = 100;

    // Fetch all pages
    while (true) {
      const response = await taskService.getTasks({
        ...filters,
        page,
        limit: pageSize,
        include: {
          sector: true,
          customer: true,
          createdBy: true,
          generalPainting: true,
          truck: true,
          serviceOrders: {
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
        await exportToPDF(tasks, columns, filters);
        break;
    }

    toast.success(`Exportação ${format.toUpperCase()} concluída com sucesso!`);
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
    link.setAttribute("download", `historico_de_tarefas_${formatDate(new Date()).replace(/\//g, "-")}.csv`);
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const exportToExcel = async (tasks: Task[], columns: ExportColumn<Task>[]) => {
    try {
      // Dynamically import xlsx library
      const XLSX = await import("xlsx");

      // Prepare data for Excel - create array of objects with column labels as keys
      const data = tasks.map((task) => {
        const row: Record<string, any> = {};
        columns.forEach((column) => {
          row[column.label] = column.getValue(task);
        });
        return row;
      });

      // Create worksheet from data
      const ws = XLSX.utils.json_to_sheet(data);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Histórico de Tarefas");

      // Auto-size columns based on content
      const maxWidth = 50;
      const colWidths = columns.map((col) => {
        // Calculate max width based on header and content
        const headerLength = col.label.length;
        const maxContentLength = Math.max(
          ...data.map((row) => String(row[col.label] || "").length),
          0
        );
        const width = Math.max(headerLength, maxContentLength);
        return { wch: Math.min(width + 2, maxWidth) };
      });
      ws["!cols"] = colWidths;

      // Write file with proper .xlsx extension and options for UTF-8
      XLSX.writeFile(wb, `historico_de_tarefas_${formatDate(new Date()).replace(/\//g, "-")}.xlsx`, {
        bookType: 'xlsx',
        bookSST: false,
        type: 'binary'
      });

      toast.success("Arquivo Excel exportado com sucesso!");
    } catch (error) {
      console.error("Excel export error:", error);
      // Fallback to CSV if XLSX fails
      await exportToCSV(tasks, columns);
      toast.error("Erro ao exportar Excel, exportado como CSV");
    }
  };

  const exportToPDF = async (tasks: Task[], columns: ExportColumn<Task>[], exportFilters: Partial<TaskGetManyFormData>) => {
    // Calculate responsive font sizes based on column count
    const columnCount = columns.length;
    const fontSize = columnCount <= 6 ? "11px" : columnCount <= 10 ? "9px" : "7px";
    const headerFontSize = columnCount <= 6 ? "10px" : columnCount <= 10 ? "8px" : "6px";
    const cellPadding = columnCount <= 6 ? "6px 5px" : columnCount <= 10 ? "5px 4px" : "3px 2px";
    const periodLabel = getPeriodLabel(exportFilters);
    const headerPadding = columnCount <= 6 ? "8px 5px" : columnCount <= 10 ? "6px 4px" : "4px 2px";

    // Check if commission column is visible
    const hasCommissionColumn = columns.some((col) => col.id === "commission");
    const commissionStats = hasCommissionColumn ? getCommissionStats(tasks) : null;

    // Format values for PDF with short dates
    const getFormattedValue = (task: Task, col: ExportColumn<Task>): string => {
      // Use short date format for date columns
      switch (col.id) {
        case "entryDate":
          return task.entryDate ? formatShortDate(new Date(task.entryDate)) : "-";
        case "forecastDate":
          return task.forecastDate ? formatShortDate(new Date(task.forecastDate)) : "-";
        case "term":
          return task.term ? formatShortDate(new Date(task.term)) : "-";
        case "startedAt":
          return task.startedAt ? formatShortDateTime(new Date(task.startedAt)) : "-";
        case "finishedAt":
          return task.finishedAt ? formatShortDateTime(new Date(task.finishedAt)) : "-";
        case "createdAt":
          return formatShortDate(new Date(task.createdAt));
        case "updatedAt":
          return formatShortDate(new Date(task.updatedAt));
        default:
          return col.getValue(task) || "-";
      }
    };

    // A4 optimized PDF with proper formatting
    const pdfContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <title>Histórico de Tarefas - ${formatShortDate(new Date())}</title>
        <style>
          @page {
            size: A4 ${columnCount > 8 ? "landscape" : "portrait"};
            margin: 10mm;
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
            line-height: 1.2;
            overflow-x: auto;
          }

          body {
            display: grid;
            grid-template-rows: auto 1fr auto;
            min-height: 100vh;
            padding: 0;
          }

          .header {
            margin-bottom: 12px;
            flex-shrink: 0;
          }

          .logo {
            width: ${columnCount <= 6 ? "140px" : "110px"};
            height: auto;
            margin-bottom: 8px;
          }

          .header-info {
          }

          .header-title {
            font-size: ${columnCount <= 6 ? "18px" : "15px"};
            font-weight: 700;
            color: #1f2937;
            margin-bottom: 4px;
          }

          .info {
            color: #6b7280;
            font-size: ${columnCount <= 6 ? "10px" : "8px"};
          }

          .info p {
            margin: 1px 0;
          }


          .content-wrapper {
            flex: 1;
            overflow: auto;
            min-height: 0;
            padding-bottom: 35px;
          }

          table {
            width: 100%;
            border-collapse: collapse;
            font-size: ${fontSize};
            table-layout: fixed;
          }

          th {
            background-color: #f9fafb;
            font-weight: 600;
            color: #374151;
            padding: ${headerPadding};
            border: 1px solid #e5e7eb;
            border-bottom: 1px solid #d1d5db;
            font-size: ${headerFontSize};
            text-transform: uppercase;
            letter-spacing: 0.03em;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
          }

          td {
            padding: ${cellPadding};
            border-left: 1px solid #e5e7eb;
            border-right: 1px solid #e5e7eb;
            border-bottom: 1px solid #e5e7eb;
            border-top: none;
            vertical-align: middle;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
            max-width: 0;
          }

          tbody tr:nth-child(even) {
            background-color: #fafafa;
          }

          /* Status styles */
          .status-preparation { color: #f59e0b; }
          .status-waiting { color: #3b82f6; }
          .status-production { color: #8b5cf6; }
          .status-completed { color: #10b981; }
          .status-cancelled { color: #ef4444; }

          .text-left { text-align: left; }
          .text-center { text-align: center; }
          .text-right { text-align: right; }

          .font-mono {
            font-family: 'SFMono-Regular', Consolas, 'Liberation Mono', Menlo, monospace;
            font-size: ${columnCount <= 6 ? "9px" : "7px"};
          }

          .font-medium { font-weight: 500; }
          .font-semibold { font-weight: 600; }
          .text-muted { color: #6b7280; }

          .footer {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding-top: 10px;
            border-top: 1px solid #e5e7eb;
            color: #6b7280;
            font-size: ${columnCount <= 6 ? "9px" : "7px"};
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
              let width = "100px"; // default
              switch (col.id) {
                case "name":
                  width = columnCount <= 6 ? "180px" : "130px";
                  break;
                case "customer.fantasyName":
                  width = columnCount <= 6 ? "140px" : "110px";
                  break;
                case "identificador":
                  width = columnCount <= 6 ? "100px" : "80px";
                  break;
                case "sector.name":
                  width = columnCount <= 6 ? "90px" : "70px";
                  break;
                case "serviceOrders":
                  width = columnCount <= 6 ? "160px" : "120px";
                  break;
                case "entryDate":
                case "forecastDate":
                case "term":
                case "createdAt":
                case "updatedAt":
                  width = columnCount <= 6 ? "70px" : "60px";
                  break;
                case "startedAt":
                case "finishedAt":
                  width = columnCount <= 6 ? "95px" : "80px";
                  break;
                case "status":
                  width = columnCount <= 6 ? "75px" : "60px";
                  break;
                case "commission":
                  width = columnCount <= 6 ? "90px" : "75px";
                  break;
                case "details":
                case "observation":
                  width = columnCount <= 6 ? "150px" : "110px";
                  break;
                case "price":
                  width = columnCount <= 6 ? "85px" : "70px";
                  break;
                case "duration":
                  width = columnCount <= 6 ? "70px" : "55px";
                  break;
                default:
                  width = columnCount <= 6 ? "90px" : "70px";
              }
              return `th:nth-child(${index + 1}), td:nth-child(${index + 1}) { width: ${width}; min-width: 40px; }`;
            })
            .join("\n")}

          /* Print optimizations */
          @media print {
            @page {
              size: A4 ${columnCount > 8 ? "landscape" : "portrait"};
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
              padding-bottom: 45px;
            }

            .header {
              margin-bottom: 10px;
            }

            .logo {
              width: ${columnCount <= 6 ? "110px" : "90px"};
              margin-bottom: 6px;
            }

            table {
              font-size: ${columnCount <= 6 ? "8px" : "6px"};
              page-break-inside: auto;
            }

            th {
              padding: ${columnCount <= 6 ? "5px 3px" : "3px 2px"};
              font-size: ${columnCount <= 6 ? "7px" : "5px"};
            }

            td {
              padding: ${columnCount <= 6 ? "4px 3px" : "2px 2px"};
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
              bottom: 6mm;
              left: 6mm;
              right: 6mm;
              background: white;
              font-size: ${columnCount <= 6 ? "7px" : "5px"};
            }

            .content-wrapper {
              padding-bottom: 50px;
            }
          }
        </style>
      </head>
      <body>
        <div class="header">
          <img src="/logo.png" alt="Ankaa Logo" class="logo" />
          <h1 class="header-title">Histórico de Tarefas</h1>
          <div class="header-info">
            <div class="info">
              <p><strong>Período:</strong> ${periodLabel}</p>
              ${
                commissionStats
                  ? `
                <p><strong>Total de tarefas:</strong> ${commissionStats.total}</p>
                <p><strong>Comissão Integral:</strong> ${commissionStats.fullCommission}</p>
                <p><strong>Comissão Parcial:</strong> ${commissionStats.partialCommission}</p>
                <p><strong>Sem Comissão:</strong> ${commissionStats.noCommission}</p>
                <p><strong>Suspensas:</strong> ${commissionStats.suspendedCommission}</p>
                <p><strong>Tarefas Ponderadas:</strong> ${commissionStats.weighted.toFixed(1)}</p>
              `
                  : `
                <p><strong>Total de tarefas:</strong> ${tasks.length}</p>
              `
              }
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
                    if (["price"].includes(col.id)) {
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
                        let value = getFormattedValue(task, col);
                        let className = "";

                        // Apply formatting based on column
                        switch (col.id) {
                          case "name":
                            className = "font-medium text-left";
                            break;
                          case "customer.fantasyName":
                            className = "text-left";
                            break;
                          case "identificador":
                            className = "font-mono text-left";
                            break;
                          case "sector.name":
                            className = "text-left";
                            break;
                          case "serviceOrders":
                            className = "text-left text-muted";
                            break;
                          case "entryDate":
                          case "forecastDate":
                          case "term":
                          case "startedAt":
                          case "finishedAt":
                          case "createdAt":
                          case "updatedAt":
                            className = "text-left text-muted";
                            break;
                          case "status":
                            className = "text-center font-medium";
                            // Add status color classes
                            if (task.status === TASK_STATUS.PREPARATION) className += " status-preparation";
                            else if (task.status === TASK_STATUS.WAITING_PRODUCTION) className += " status-waiting";
                            else if (task.status === TASK_STATUS.IN_PRODUCTION) className += " status-production";
                            else if (task.status === TASK_STATUS.COMPLETED) className += " status-completed";
                            else if (task.status === TASK_STATUS.CANCELLED) className += " status-cancelled";
                            break;
                          case "commission":
                            className = "text-left";
                            break;
                          case "details":
                          case "observation":
                            className = "text-left text-muted";
                            break;
                          case "price":
                            className = "text-right font-medium";
                            break;
                          case "createdBy.name":
                            className = "text-left";
                            break;
                          case "duration":
                            className = "text-center font-mono";
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
            <p>Histórico de Tarefas - Sistema Ankaa</p>
          </div>
          <div class="footer-right">
            <p><strong>Gerado em:</strong> ${formatShortDateTime(new Date())}</p>
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
      currentItems={currentItems}
      totalRecords={totalRecords}
      selectedItems={selectedItems}
      visibleColumns={visibleColumns}
      exportColumns={EXPORT_COLUMNS}
      defaultVisibleColumns={DEFAULT_VISIBLE_COLUMNS}
      onExport={handleExport}
      onFetchAllItems={fetchAllItems}
      entityName="tarefa"
      entityNamePlural="tarefas"
    />
  );
}
