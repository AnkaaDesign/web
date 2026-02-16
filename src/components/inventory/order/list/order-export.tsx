import { BaseExportPopover, type ExportColumn } from "@/components/ui/export-popover";
import type { Order } from "../../../../types";
import type { OrderGetManyFormData } from "../../../../schemas";
import { orderService } from "../../../../api-client";
import { formatCurrency, formatDate } from "../../../../utils";
import { ORDER_STATUS_LABELS } from "../../../../constants";

interface OrderExportProps {
  className?: string;
  currentItems: Order[];
  totalRecords: number;
  selectedItems?: Set<string>;
  visibleColumns: Set<string>;
  filters?: Partial<OrderGetManyFormData>;
}

// Define export columns matching the table structure
const EXPORT_COLUMNS: ExportColumn<Order>[] = [
  {
    id: "id",
    label: "CÓDIGO",
    getValue: (order) => order.id,
  },
  {
    id: "description",
    label: "DESCRIÇÃO",
    getValue: (order) => order.description || "-",
  },
  {
    id: "supplier.fantasyName",
    label: "FORNECEDOR",
    getValue: (order) => order.supplier?.fantasyName || "-",
  },
  {
    id: "itemCount",
    label: "QTD. ITENS",
    getValue: (order) => String(order.items?.length || 0),
  },
  {
    id: "status",
    label: "STATUS",
    getValue: (order) => ORDER_STATUS_LABELS[order.status] || order.status,
  },
  {
    id: "forecast",
    label: "PREVISÃO",
    getValue: (order) => (order.forecast ? formatDate(order.forecast) : "-"),
  },
  {
    id: "total",
    label: "VALOR TOTAL",
    getValue: (order) => {
      if (order.items) {
        const total = order.items.reduce((sum, item) => sum + item.orderedQuantity * item.price, 0);
        return formatCurrency(total);
      }
      return "-";
    },
  },
  {
    id: "createdAt",
    label: "CRIADO EM",
    getValue: (order) => formatDate(order.createdAt),
  },
  {
    id: "updatedAt",
    label: "FINALIZADO EM",
    getValue: (order) => (order.updatedAt ? formatDate(order.updatedAt) : "-"),
  },
  {
    id: "notes",
    label: "OBSERVAÇÕES",
    getValue: (order) => order.notes || "-",
  },
];

// Default visible columns
const DEFAULT_VISIBLE_COLUMNS = new Set(["id", "description", "supplier.fantasyName", "itemCount", "status", "forecast", "createdAt"]);

export function OrderExport({ className, currentItems, totalRecords, selectedItems, visibleColumns, filters }: OrderExportProps) {
  // Fetch all data when needed
  const fetchAllItems = async (): Promise<Order[]> => {
    const response = await orderService.getOrders({
      ...filters,
      limit: totalRecords,
      page: 1,
      include: {
        supplier: true,
        items: {
          include: {
            item: true,
          },
        },
        count: {
          select: {
            items: true,
          },
        },
      },
    });
    return response?.data || [];
  };

  // Handle export based on format
  const handleExport = async (format: "csv" | "excel" | "pdf", items: Order[], columns: ExportColumn<Order>[]) => {
    let content = "";
    let filename = `pedidos_${new Date().toISOString().split("T")[0]}`;

    switch (format) {
      case "csv":
        content = generateCSV(items, columns);
        filename += ".csv";
        downloadFile(content, filename, "text/csv;charset=utf-8");
        break;

      case "excel":
        content = generateExcel(items, columns);
        filename += ".xls";
        downloadFile(content, filename, "application/vnd.ms-excel;charset=utf-8");
        break;

      case "pdf":
        generatePDF(items, columns);
        break;
    }
  };

  // Generate CSV content
  const generateCSV = (data: Order[], columns: ExportColumn<Order>[]) => {
    const headers = columns.map((col) => col.label).join(",");
    const rows = data.map((order) =>
      columns
        .map((col) => {
          const value = col.getValue(order);
          // Escape quotes and wrap in quotes if contains comma
          const escaped = String(value).replace(/"/g, '""');
          return escaped.includes(",") ? `"${escaped}"` : escaped;
        })
        .join(","),
    );

    // Add UTF-8 BOM for proper Excel encoding
    const BOM = "\uFEFF";
    return BOM + headers + "\n" + rows.join("\n");
  };

  // Generate Excel content (tab-separated)
  const generateExcel = (data: Order[], columns: ExportColumn<Order>[]) => {
    const headers = columns.map((col) => col.label).join("\t");
    const rows = data.map((order) => columns.map((col) => col.getValue(order)).join("\t"));

    // Add UTF-8 BOM
    const BOM = "\uFEFF";
    return BOM + headers + "\n" + rows.join("\n");
  };

  // Generate PDF content
  const generatePDF = (data: Order[], columns: ExportColumn<Order>[]) => {
    const columnCount = columns.length;
    const isWideLayout = columnCount > 6;
    const fontSize = isWideLayout ? "11px" : "12px";
    const orientation = isWideLayout ? "landscape" : "portrait";

    const tableRows = data.map((order) => {
      const cells = columns.map((col) => {
        const value = col.getValue(order);
        let cellClass = "";
        let style = "";

        // Special styling for status
        if (col.id === "status") {
          const statusColors: Record<string, string> = {
            Criado: "background-color: #6b7280; color: white;",
            "Parcialmente Feito": "background-color: #eab308; color: white;",
            Feito: "background-color: #22c55e; color: white;",
            Atrasado: "background-color: #f97316; color: white;",
            "Parcialmente Recebido": "background-color: #3b82f6; color: white;",
            Recebido: "background-color: #10b981; color: white;",
            Cancelado: "background-color: #ef4444; color: white;",
          };
          style = statusColors[value] || "";
        }

        // Alignment for specific columns
        if (col.id === "total") {
          cellClass = "text-align: right;";
        } else if (col.id === "itemCount") {
          cellClass = "text-align: center;";
        }

        return `<td style="padding: 8px; border: 1px solid #e5e7eb; ${cellClass} ${style}">${value}</td>`;
      });

      return `<tr>${cells.join("")}</tr>`;
    });

    const pdfContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <title>Pedidos - Exportação</title>
        <style>
          @page { size: ${orientation}; margin: 10mm; }
          body { font-family: Arial, sans-serif; font-size: ${fontSize}; }
          h1 { font-size: 18px; margin-bottom: 10px; }
          .info { margin-bottom: 10px; font-size: 11px; color: #666; }
          table { width: 100%; border-collapse: collapse; margin-top: 10px; }
          th { background-color: #f3f4f6; font-weight: bold; text-transform: uppercase; }
          th, td { padding: 8px; border: 1px solid #e5e7eb; }
          tr:nth-child(even) { background-color: #f9fafb; }
          .footer { margin-top: 20px; font-size: 10px; color: #666; text-align: center; }
        </style>
      </head>
      <body>
        <h1>Pedidos</h1>
        <div class="info">
          Exportado em: ${new Date().toLocaleString("pt-BR")}<br>
          Total de registros: ${data.length}
        </div>
        <table>
          <thead>
            <tr>
              ${columns
                .map((col) => {
                  const align = col.id === "total" ? "text-align: right;" : col.id === "itemCount" || col.id === "status" ? "text-align: center;" : "";
                  return `<th style="padding: 8px; border: 1px solid #e5e7eb; ${align}">${col.label}</th>`;
                })
                .join("")}
            </tr>
          </thead>
          <tbody>
            ${tableRows.join("")}
          </tbody>
        </table>
        <div class="footer">
          Sistema de Gestão - Pedidos
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

  // Helper function to download files
  const downloadFile = (content: string, filename: string, mimeType: string) => {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <BaseExportPopover<Order>
      className={className}
      currentItems={currentItems}
      totalRecords={totalRecords}
      selectedItems={selectedItems}
      visibleColumns={visibleColumns}
      exportColumns={EXPORT_COLUMNS}
      defaultVisibleColumns={DEFAULT_VISIBLE_COLUMNS}
      onExport={handleExport}
      onFetchAllItems={fetchAllItems}
      entityName="pedido"
      entityNamePlural="pedidos"
    />
  );
}
