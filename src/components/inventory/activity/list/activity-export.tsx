import { BaseExportPopover, type ExportFormat, type ExportColumn } from "@/components/ui/export-popover";
import { toast } from "@/components/ui/sonner";
import { activityService } from "../../../../api-client";
import { formatDateTime } from "../../../../utils";
import { ACTIVITY_REASON_LABELS, ACTIVITY_OPERATION_LABELS, ACTIVITY_OPERATION } from "../../../../constants";
import type { Activity } from "../../../../types";
import type { ActivityGetManyFormData } from "../../../../schemas";

interface ActivityExportProps {
  className?: string;
  filters?: Partial<ActivityGetManyFormData>;
  currentActivities?: Activity[];
  totalRecords?: number;
  visibleColumns?: Set<string>;
  selectedActivities?: Set<string>;
}

// Format quantity with 2 decimals only if needed
function formatQuantity(value: number): string {
  // Check if the number has decimals
  if (value % 1 === 0) {
    return value.toString();
  }
  // Format with 2 decimals and use pt-BR locale
  return value.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

const EXPORT_COLUMNS: ExportColumn<Activity>[] = [
  { id: "item.uniCode", label: "Código", getValue: (activity: Activity) => activity.item?.uniCode || "" },
  { id: "item.name", label: "Item", getValue: (activity: Activity) => activity.item?.name || "" },
  { id: "operation", label: "Operação", getValue: (activity: Activity) => (activity.operation ? ACTIVITY_OPERATION_LABELS[activity.operation] : "") },
  {
    id: "quantity",
    label: "Quantidade",
    getValue: (activity: Activity) => {
      const sign = activity.operation === ACTIVITY_OPERATION.INBOUND ? "+" : "-";
      return sign + formatQuantity(Math.abs(activity.quantity));
    },
  },
  { id: "reason", label: "Motivo", getValue: (activity: Activity) => (activity.reason ? ACTIVITY_REASON_LABELS[activity.reason] : "") },
  { id: "user.name", label: "Usuário", getValue: (activity: Activity) => activity.user?.name || "" },
  { id: "order.id", label: "Pedido", getValue: (activity: Activity) => activity.order?.id || "" },
  { id: "createdAt", label: "Data/Hora", getValue: (activity: Activity) => formatDateTime(new Date(activity.createdAt)) },
];

const DEFAULT_VISIBLE_COLUMNS = new Set(["item.uniCode", "item.name", "operation", "quantity", "reason", "user.name", "createdAt"]);

export function ActivityExport({ className, filters, currentActivities = [], totalRecords = 0, visibleColumns, selectedActivities }: ActivityExportProps) {
  const fetchAllActivities = async (): Promise<Activity[]> => {
    try {
      const allActivities: Activity[] = [];
      let page = 1;
      let hasMore = true;

      while (hasMore) {
        const response = await activityService.getActivities({
          ...filters,
          page,
          limit: 100,
          include: {
            item: true,
            user: true,
            order: true,
          },
        });

        if (response.data) {
          allActivities.push(...response.data);
        }

        hasMore = response.meta?.hasNextPage || false;
        page++;
      }

      return allActivities;
    } catch (error) {
      if (process.env.NODE_ENV !== 'production') {
        console.error("Error fetching all activities:", error);
      }
      toast.error("Erro ao buscar atividades para exportação");
      throw error;
    }
  };

  const handleExport = async (format: ExportFormat, items: Activity[], columns: ExportColumn<Activity>[]) => {
    try {
      // Generate export based on format
      switch (format) {
        case "csv":
          await exportToCSV(items, columns);
          break;
        case "excel":
          await exportToExcel(items, columns);
          break;
        case "pdf":
          await exportToPDF(items, columns);
          break;
      }

      toast.success(`Exportação ${format.toUpperCase()} concluída com sucesso!`);
    } catch (error) {
      if (process.env.NODE_ENV !== 'production') {
        console.error("Export error:", error);
      }
      toast.error("Erro ao exportar dados");
      throw error;
    }
  };

  const exportToCSV = async (items: Activity[], columns: ExportColumn<Activity>[]) => {
    // CSV headers from visible columns
    const headers = columns.map((col) => col.label);

    // Convert items to CSV rows with only visible columns
    const rows = items.map((item) => columns.map((col) => col.getValue(item)));

    // Create CSV content
    const csvContent = [headers.join(","), ...rows.map((row) => row.map((cell) => `"${cell}"`).join(","))].join("\n");

    // Download CSV
    const blob = new Blob(["\ufeff" + csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", `atividades_${formatDateTime(new Date()).replace(/[\/:\s]/g, "-")}.csv`);
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const exportToExcel = async (items: Activity[], columns: ExportColumn<Activity>[]) => {
    try {
      const XLSX = await import("xlsx");
      const data = items.map((item) => {
        const row: Record<string, any> = {};
        columns.forEach((column) => { row[column.label] = column.getValue(item); });
        return row;
      });
      const ws = XLSX.utils.json_to_sheet(data);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Atividades");
      const colWidths = columns.map((col) => {
        const headerLength = col.label.length;
        const maxContentLength = Math.max(...data.map((row) => String(row[col.label] || "").length), 0);
        return { wch: Math.min(Math.max(headerLength, maxContentLength) + 2, 50) };
      });
      ws["!cols"] = colWidths;
      XLSX.writeFile(wb, `atividades_${formatDateTime(new Date()).replace(/[\/:\s]/g, "-")}.xlsx`, {
        bookType: 'xlsx', bookSST: false, type: 'binary'
      });
    } catch (error) {
      console.error("Excel export error:", error);
      await exportToCSV(items, columns);
    URL.revokeObjectURL(url);
  };

  const exportToPDF = async (items: Activity[], columns: ExportColumn<Activity>[]) => {
    // Calculate responsive font sizes based on column count
    const columnCount = columns.length;
    const fontSize = columnCount <= 6 ? "11px" : columnCount <= 10 ? "9px" : "7px";
    const headerFontSize = columnCount <= 6 ? "10px" : columnCount <= 10 ? "8px" : "6px";
    const cellPadding = columnCount <= 6 ? "6px 4px" : columnCount <= 10 ? "4px 3px" : "3px 2px";
    const headerPadding = columnCount <= 6 ? "8px 4px" : columnCount <= 10 ? "6px 3px" : "4px 2px";

    // A4 optimized PDF with proper formatting
    const pdfContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <title>Atividades - ${formatDateTime(new Date())}</title>
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
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
            background: white;
            font-size: ${fontSize};
            line-height: 1.3;
          }

          .header {
            display: flex;
            align-items: center;
            margin-bottom: 15px;
            padding-bottom: 10px;
            border-bottom: 2px solid #e5e7eb;
          }

          .logo {
            width: ${columnCount <= 6 ? "80px" : "60px"};
            height: auto;
            margin-right: 15px;
          }

          .header-info {
            flex: 1;
          }

          .info {
            color: #6b7280;
            font-size: ${columnCount <= 6 ? "10px" : "8px"};
          }

          .info p {
            margin: 2px 0;
          }

          table {
            width: 100%;
            border-collapse: collapse;
            border: 1px solid #e5e7eb;
            font-size: ${fontSize};
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
            text-align: left;
          }

          td {
            padding: ${cellPadding};
            border-bottom: 1px solid #f3f4f6;
            border-right: 1px solid #f3f4f6;
            vertical-align: top;
          }

          tbody tr:nth-child(even) {
            background-color: #fafafa;
          }

          .footer {
            display: flex;
            justify-content: space-between;
            margin-top: 15px;
            padding-top: 10px;
            border-top: 1px solid #e5e7eb;
            color: #6b7280;
            font-size: ${columnCount <= 6 ? "9px" : "7px"};
          }

          @media print {
            .header { margin-bottom: 10px; padding-bottom: 8px; }
            table { page-break-inside: auto; }
            tr { page-break-inside: avoid; page-break-after: auto; }
            thead { display: table-header-group; }
          }
        </style>
      </head>
      <body>
        <div class="header">
          <img src="/logo.png" alt="Ankaa Logo" class="logo" />
          <div class="header-info">
            <div class="info">
              <p><strong>Data:</strong> ${formatDateTime(new Date())}</p>
              <p><strong>Total de atividades:</strong> ${items.length}</p>
            </div>
          </div>
        </div>

        <table>
          <thead>
            <tr>
              ${columns.map((col) => `<th>${col.label}</th>`).join("")}
            </tr>
          </thead>
          <tbody>
            ${items
              .map(
                (item) => `
              <tr>
                ${columns.map((col) => `<td>${col.getValue(item) || "-"}</td>`).join("")}
              </tr>
            `,
              )
              .join("")}
          </tbody>
        </table>

        <div class="footer">
          <div>Relatório gerado pelo sistema Ankaa</div>
          <div><strong>Gerado em:</strong> ${formatDateTime(new Date())}</div>
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

  // Filter items based on selection
  const getItemsToExport = () => {
    if (selectedActivities && selectedActivities.size > 0) {
      return currentActivities.filter((activity) => selectedActivities.has(activity.id));
    }
    return currentActivities;
  };

  return (
    <BaseExportPopover
      className={className}
      currentItems={getItemsToExport()}
      totalRecords={totalRecords}
      selectedItems={selectedActivities}
      visibleColumns={visibleColumns}
      exportColumns={EXPORT_COLUMNS}
      defaultVisibleColumns={DEFAULT_VISIBLE_COLUMNS}
      onExport={handleExport}
      onFetchAllItems={fetchAllActivities}
      entityName="atividade"
      entityNamePlural="atividades"
    />
  );
}
