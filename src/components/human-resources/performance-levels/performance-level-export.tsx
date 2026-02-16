import { BaseExportPopover, type ExportColumn, type ExportFormat } from "@/components/ui/export-popover";
import { toast } from "sonner";
import { formatDate, formatDateTime } from "../../../utils";
import { userService } from "../../../api-client";
import { USER_STATUS_LABELS, USER_STATUS } from "../../../constants";
import type { User } from "../../../types";

const EXPORT_COLUMNS: ExportColumn<User>[] = [
  { id: "payrollNumber", label: "Nº Folha", getValue: (user) => String(user.payrollNumber || "") },
  { id: "name", label: "Nome", getValue: (user) => user.name },
  { id: "email", label: "Email", getValue: (user) => user.email || "" },
  { id: "phone", label: "Telefone", getValue: (user) => user.phone || "" },
  { id: "cpf", label: "CPF", getValue: (user) => user.cpf || "" },
  { id: "pis", label: "PIS", getValue: (user) => user.pis || "" },
  { id: "position", label: "Cargo", getValue: (user) => user.position?.name || "" },
  { id: "sector", label: "Setor", getValue: (user) => user.sector?.name || "" },
  { id: "performanceLevel", label: "Nível de Desempenho", getValue: (user) => String(user.performanceLevel || "0") },
  { id: "bonus", label: "Bonificação", getValue: (_user) => "" },  // To be implemented
  { id: "status", label: "Status", getValue: (user) => USER_STATUS_LABELS[user.status] || user.status },
  { id: "createdAt", label: "Data de Cadastro", getValue: (user) => new Date(user.createdAt).toLocaleDateString("pt-BR") },
];

const DEFAULT_VISIBLE_COLUMNS = new Set([
  "payrollNumber",
  "name",
  "email",
  "position",
  "sector",
  "performanceLevel",
  "bonus",
  "status"
]);

interface PerformanceLevelExportProps {
  filters: any;
  currentUsers: User[];
  totalRecords: number;
  visibleColumns: Set<string>;
  selectedUsers: User[];
}

export function PerformanceLevelExport({
  filters,
  currentUsers,
  totalRecords,
  visibleColumns,
  selectedUsers,
}: PerformanceLevelExportProps) {

  const handleExport = async (format: ExportFormat, items: User[], columns: ExportColumn<User>[]) => {
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
  };

  const fetchAllUsers = async (): Promise<User[]> => {
    const allUsersResponse = await userService.getUsers({
      ...filters,
      limit: totalRecords > 0 ? totalRecords : 10000, // Limit to prevent memory issues
      include: {
        position: true,
        sector: true,
      },
    });

    return allUsersResponse.data || [];
  };

  const exportToCSV = async (items: User[], columns: ExportColumn<User>[]) => {
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
    link.setAttribute("download", `niveis_desempenho_${formatDate(new Date()).replace(/\//g, "-")}.csv`);
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const exportToExcel = async (items: User[], columns: ExportColumn<User>[]) => {
    try {
      const XLSX = await import("xlsx");
      const data = items.map((item) => {
        const row: Record<string, any> = {};
        columns.forEach((column) => { row[column.label] = column.getValue(item); });
        return row;
      });
      const ws = XLSX.utils.json_to_sheet(data);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Níveis Desempenho");
      const colWidths = columns.map((col) => {
        const headerLength = col.label.length;
        const maxContentLength = Math.max(...data.map((row) => String(row[col.label] || "").length), 0);
        return { wch: Math.min(Math.max(headerLength, maxContentLength) + 2, 50) };
      });
      ws["!cols"] = colWidths;
      XLSX.writeFile(wb, `niveis_desempenho_${formatDate(new Date()).replace(/\//g, "-")}.xlsx`, {
        bookType: 'xlsx', bookSST: false, type: 'binary'
      });
    } catch (error) {
      console.error("Excel export error:", error);
      await exportToCSV(items, columns);
    }
  };

  const exportToPDF = async (items: User[], columns: ExportColumn<User>[]) => {
    // Calculate responsive font sizes based on column count
    const columnCount = columns.length;
    const fontSize = columnCount <= 6 ? "12px" : columnCount <= 10 ? "10px" : "8px";
    const headerFontSize = columnCount <= 6 ? "11px" : columnCount <= 10 ? "9px" : "7px";
    const cellPadding = columnCount <= 6 ? "8px 6px" : columnCount <= 10 ? "6px 4px" : "4px 3px";

    // PDF content with proper formatting
    const pdfContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <title>Níveis de Desempenho - ${formatDate(new Date())}</title>
        <style>
          @page { size: A4; margin: 12mm; }
          * { box-sizing: border-box; margin: 0; padding: 0; }
          body {
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
            font-size: ${fontSize};
            line-height: 1.3;
          }
          .header {
            display: flex;
            align-items: center;
            margin-bottom: 20px;
            padding-bottom: 15px;
            border-bottom: 2px solid #e5e7eb;
          }
          .header-info { flex: 1; }
          .info { color: #6b7280; font-size: ${columnCount <= 6 ? "12px" : "10px"}; }
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
            padding: ${cellPadding};
            border-bottom: 2px solid #e5e7eb;
            font-size: ${headerFontSize};
            text-transform: uppercase;
            text-align: left;
          }
          td {
            padding: ${cellPadding};
            border-bottom: 1px solid #f3f4f6;
            vertical-align: top;
          }
          tbody tr:nth-child(even) { background-color: #fafafa; }
          .badge {
            display: inline-block;
            padding: 1px 6px;
            border-radius: 3px;
            font-size: ${columnCount <= 6 ? "9px" : "7px"};
            font-weight: 500;
            text-transform: uppercase;
          }
          .badge-active { background-color: #10b981; color: white; }
          .badge-inactive { background-color: #6b7280; color: white; }
          .performance {
            display: inline-block;
            padding: 2px 8px;
            background-color: #f3f4f6;
            border-radius: 4px;
            font-weight: 600;
          }
          .footer {
            margin-top: 20px;
            padding-top: 15px;
            border-top: 1px solid #e5e7eb;
            color: #6b7280;
            font-size: ${columnCount <= 6 ? "10px" : "8px"};
            display: flex;
            justify-content: space-between;
          }
          @media print {
            body { font-size: ${columnCount <= 6 ? "9px" : "7px"}; }
            th { font-size: ${columnCount <= 6 ? "8px" : "6px"}; }
            td { padding: ${columnCount <= 6 ? "4px 3px" : "3px 2px"}; }
          }
        </style>
      </head>
      <body>
        <div class="header">
          <div class="header-info">
            <h1 style="font-size: 18px; margin-bottom: 8px;">Níveis de Desempenho dos Colaboradores</h1>
            <div class="info">
              <p><strong>Data:</strong> ${formatDate(new Date())}</p>
              <p><strong>Total de colaboradores:</strong> ${items.length}</p>
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
              .map((item) => {
                return `
                <tr>
                  ${columns
                    .map((col) => {
                      let value = col.getValue(item) || "-";
                      let className = "";

                      // Apply formatting based on column
                      switch (col.id) {
                        case "status":
                          const statusClass = item.status === USER_STATUS.EFFECTED ? "badge-active" : "badge-inactive";
                          value = `<span class="badge ${statusClass}">${value}</span>`;
                          break;
                        case "performanceLevel":
                          value = `<span class="performance">${value}</span>`;
                          break;
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

        <div class="footer">
          <div>
            <p>Relatório gerado pelo sistema Ankaa</p>
          </div>
          <div>
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

  // Convert selected users to Set<string> of IDs
  const selectedUserIds = new Set(selectedUsers.map(user => user.id));

  return (
    <BaseExportPopover
      currentItems={currentUsers}
      totalRecords={totalRecords}
      selectedItems={selectedUserIds}
      visibleColumns={visibleColumns}
      exportColumns={EXPORT_COLUMNS}
      defaultVisibleColumns={DEFAULT_VISIBLE_COLUMNS}
      onExport={handleExport}
      onFetchAllItems={fetchAllUsers}
      entityName="colaborador"
      entityNamePlural="colaboradores"
    />
  );
}