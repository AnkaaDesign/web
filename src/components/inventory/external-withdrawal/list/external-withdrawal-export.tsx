import { BaseExportPopover, type ExportColumn } from "@/components/ui/export-popover";
import type { ExternalWithdrawal } from "../../../../types";
import type { ExternalWithdrawalGetManyFormData } from "../../../../schemas";
import { externalWithdrawalService } from "../../../../api-client";
import { formatCurrency, formatDate } from "../../../../utils";
import { EXTERNAL_WITHDRAWAL_STATUS_LABELS, EXTERNAL_WITHDRAWAL_TYPE, EXTERNAL_WITHDRAWAL_TYPE_LABELS } from "../../../../constants";

interface ExternalWithdrawalExportProps {
  className?: string;
  currentItems: ExternalWithdrawal[];
  totalRecords: number;
  selectedItems: Set<string>;
  visibleColumns: Set<string>;
  filters?: Partial<ExternalWithdrawalGetManyFormData>;
}

// Define export columns matching the table structure
const EXPORT_COLUMNS: ExportColumn<ExternalWithdrawal>[] = [
  {
    id: "withdrawerName",
    label: "RETIRADO POR",
    getValue: (withdrawal) => withdrawal.withdrawerName || "-",
  },
  {
    id: "status",
    label: "STATUS",
    getValue: (withdrawal) => EXTERNAL_WITHDRAWAL_STATUS_LABELS[withdrawal.status] || withdrawal.status,
  },
  {
    id: "type",
    label: "TIPO",
    getValue: (withdrawal) => EXTERNAL_WITHDRAWAL_TYPE_LABELS[withdrawal.type] || withdrawal.type,
  },
  {
    id: "total",
    label: "VALOR TOTAL",
    getValue: (withdrawal) => {
      if (withdrawal.type === EXTERNAL_WITHDRAWAL_TYPE.CHARGEABLE && withdrawal.items) {
        const total = withdrawal.items.reduce((sum, item) => sum + item.withdrawedQuantity * (item.price || 0), 0);
        return formatCurrency(total);
      }
      return "-";
    },
  },
  {
    id: "createdAt",
    label: "CRIADO EM",
    getValue: (withdrawal) => formatDate(withdrawal.createdAt),
  },
  {
    id: "notes",
    label: "OBSERVAÇÕES",
    getValue: (withdrawal) => withdrawal.notes || "-",
  },
  {
    id: "itemCount",
    label: "QTD. ITENS",
    getValue: (withdrawal) => String(withdrawal.items?.length || 0),
  },
];

// Default visible columns
const DEFAULT_VISIBLE_COLUMNS = new Set(["withdrawerName", "status", "type", "total", "createdAt"]);

export function ExternalWithdrawalExport({ className, currentItems, totalRecords, selectedItems, visibleColumns, filters }: ExternalWithdrawalExportProps) {
  // Fetch all data when needed
  const fetchAllItems = async (): Promise<ExternalWithdrawal[]> => {
    const response = await externalWithdrawalService.getExternalWithdrawals({
      ...filters,
      limit: totalRecords,
      page: 1,
      include: {
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
  const handleExport = async (format: "csv" | "excel" | "pdf", items: ExternalWithdrawal[], columns: ExportColumn<ExternalWithdrawal>[]) => {
    let content = "";
    let filename = `retiradas_externas_${new Date().toISOString().split("T")[0]}`;

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
  const generateCSV = (data: ExternalWithdrawal[], columns: ExportColumn<ExternalWithdrawal>[]) => {
    const headers = columns.map((col) => col.label).join(",");
    const rows = data.map((withdrawal) =>
      columns
        .map((col) => {
          const value = col.getValue(withdrawal);
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
  const generateExcel = (data: ExternalWithdrawal[], columns: ExportColumn<ExternalWithdrawal>[]) => {
    const headers = columns.map((col) => col.label).join("\t");
    const rows = data.map((withdrawal) => columns.map((col) => col.getValue(withdrawal)).join("\t"));

    // Add UTF-8 BOM
    const BOM = "\uFEFF";
    return BOM + headers + "\n" + rows.join("\n");
  };

  // Generate PDF content
  const generatePDF = (data: ExternalWithdrawal[], columns: ExportColumn<ExternalWithdrawal>[]) => {
    const columnCount = columns.length;
    const isWideLayout = columnCount > 6;
    const fontSize = isWideLayout ? "11px" : "12px";
    const orientation = isWideLayout ? "landscape" : "portrait";

    const tableRows = data.map((withdrawal) => {
      const cells = columns.map((col) => {
        const value = col.getValue(withdrawal);
        let cellClass = "";
        let style = "";

        // Special styling for status
        if (col.id === "status") {
          const statusColors: Record<string, string> = {
            Ativa: "background-color: #3b82f6; color: white;",
            "Parcialmente devolvida": "background-color: #eab308; color: white;",
            "Totalmente devolvida": "background-color: #22c55e; color: white;",
            Cobrada: "background-color: #a855f7; color: white;",
            Cancelada: "background-color: #ef4444; color: white;",
          };
          style = statusColors[value] || "";
        }

        // Alignment for specific columns
        if (col.id === "total") {
          cellClass = "text-align: right;";
        } else if (col.id === "type" || col.id === "itemCount") {
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
        <title>Retiradas Externas - Exportação</title>
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
        <h1>Retiradas Externas</h1>
        <div class="info">
          Exportado em: ${new Date().toLocaleString("pt-BR")}<br>
          Total de registros: ${data.length}
        </div>
        <table>
          <thead>
            <tr>
              ${columns
                .map((col) => {
                  const align = col.id === "total" ? "text-align: right;" : col.id === "type" || col.id === "status" || col.id === "itemCount" ? "text-align: center;" : "";
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
          Sistema de Gestão - Retiradas Externas
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
    <BaseExportPopover<ExternalWithdrawal>
      className={className}
      currentItems={currentItems}
      totalRecords={totalRecords}
      selectedItems={selectedItems}
      visibleColumns={visibleColumns}
      exportColumns={EXPORT_COLUMNS}
      defaultVisibleColumns={DEFAULT_VISIBLE_COLUMNS}
      onExport={handleExport}
      onFetchAllItems={fetchAllItems}
      entityName="retirada"
      entityNamePlural="retiradas"
    />
  );
}
