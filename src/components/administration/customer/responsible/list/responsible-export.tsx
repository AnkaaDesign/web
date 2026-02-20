import { BaseExportPopover, type ExportFormat, type ExportColumn } from "@/components/ui/export-popover";
import { toast } from "sonner";
import type { Responsible } from "@/types/responsible";
import type { ResponsibleGetManyFormData } from "@/types/responsible";
import { RESPONSIBLE_ROLE_LABELS } from "@/types/responsible";
import { formatBrazilianPhone, formatDate, formatDateTime } from "@/utils";
import { responsibleService } from "@/services/responsibleService";

interface ResponsibleExportProps {
  className?: string;
  filters?: Partial<ResponsibleGetManyFormData>;
  currentResponsibles?: Responsible[];
  totalRecords?: number;
  visibleColumns?: Set<string>;
  selectedResponsibles?: Set<string>;
}

// Column configuration for export
const EXPORT_COLUMNS: ExportColumn<Responsible>[] = [
  { id: "name", label: "NOME", getValue: (resp: Responsible) => resp.name },
  { id: "role", label: "FUNÇÃO", getValue: (resp: Responsible) => RESPONSIBLE_ROLE_LABELS[resp.role] || resp.role },
  { id: "company", label: "EMPRESA", getValue: (resp: Responsible) => resp.company?.corporateName || resp.company?.fantasyName || "" },
  { id: "phone", label: "TELEFONE", getValue: (resp: Responsible) => formatBrazilianPhone(resp.phone || "") },
  { id: "email", label: "E-MAIL", getValue: (resp: Responsible) => resp.email || "" },
  { id: "access", label: "ACESSO", getValue: (resp: Responsible) => (resp.email && resp.password ? "Com acesso" : "Sem acesso") },
  { id: "isActive", label: "STATUS", getValue: (resp: Responsible) => (resp.isActive ? "Ativo" : "Inativo") },
  { id: "createdAt", label: "CRIADO EM", getValue: (resp: Responsible) => resp.createdAt ? formatDate(new Date(resp.createdAt)) : "" },
];

// Default columns if none are specified
const DEFAULT_VISIBLE_COLUMNS = new Set(["name", "role", "company", "phone", "email", "isActive"]);

export function ResponsibleExport({ className, filters = {}, currentResponsibles = [], totalRecords = 0, visibleColumns, selectedResponsibles }: ResponsibleExportProps) {
  const handleExport = async (format: ExportFormat, items: Responsible[], columns: ExportColumn<Responsible>[]) => {
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

  const fetchAllResponsibles = async (): Promise<Responsible[]> => {
    const allResponsiblesResponse = await responsibleService.getAll({
      ...filters,
      pageSize: totalRecords > 0 ? totalRecords : 10000, // Limit to prevent memory issues
    });

    return allResponsiblesResponse.data || [];
  };

  const exportToCSV = async (items: Responsible[], columns: ExportColumn<Responsible>[]) => {
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
    link.setAttribute("download", `responsaveis_${formatDate(new Date()).replace(/\//g, "-")}.csv`);
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const exportToExcel = async (items: Responsible[], columns: ExportColumn<Responsible>[]) => {
    try {
      // Dynamically import xlsx library
      const XLSX = await import("xlsx");

      // Prepare data for Excel - create array of objects with column labels as keys
      const data = items.map((item) => {
        const row: Record<string, any> = {};
        columns.forEach((column) => {
          row[column.label] = column.getValue(item);
        });
        return row;
      });

      // Create worksheet from data
      const ws = XLSX.utils.json_to_sheet(data);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Responsáveis");

      // Auto-size columns based on content
      const maxWidth = 50;
      const colWidths = columns.map((col) => {
        const headerLength = col.label.length;
        const maxContentLength = Math.max(
          ...data.map((row) => String(row[col.label] || "").length),
          0
        );
        const width = Math.max(headerLength, maxContentLength);
        return { wch: Math.min(width + 2, maxWidth) };
      });
      ws["!cols"] = colWidths;

      // Write file with proper .xlsx extension and UTF-8 encoding
      XLSX.writeFile(wb, `responsaveis_${formatDate(new Date()).replace(/\//g, "-")}.xlsx`, {
        bookType: 'xlsx',
        bookSST: false,
        type: 'binary'
      });
    } catch (error) {
      console.error("Excel export error:", error);
      // Fallback to CSV if XLSX fails
      await exportToCSV(items, columns);
    }
  };

  const exportToPDF = async (items: Responsible[], columns: ExportColumn<Responsible>[]) => {
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
        <title>Responsáveis - ${formatDate(new Date())}</title>
        <style>
          @page {
            size: A4;
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

          .badge {
            display: inline-block;
            padding: 1px 6px;
            border-radius: 3px;
            font-size: ${columnCount <= 6 ? "9px" : "7px"};
            font-weight: 500;
            text-transform: uppercase;
            letter-spacing: 0.03em;
          }

          .badge.default {
            background-color: #1f2937;
            color: white;
          }

          .badge.secondary {
            background-color: #f3f4f6;
            color: #6b7280;
          }

          .badge.success {
            background-color: #10b981;
            color: white;
          }

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

          @media print {
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
              bottom: 15px;
              left: 12mm;
              right: 12mm;
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
            <div class="info">
              <p><strong>Data:</strong> ${formatDate(new Date())}</p>
              <p><strong>Total de responsáveis:</strong> ${items.length}</p>
            </div>
          </div>
        </div>

        <div class="content-wrapper">
          <table>
            <thead>
              <tr>
                ${columns
                  .map((col) => {
                    return `<th class="text-left">${col.label}</th>`;
                  })
                  .join("")}
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
                        let className = "text-left";

                        // Apply formatting based on column
                        switch (col.id) {
                          case "name":
                            className = "font-medium text-left";
                            break;
                          case "isActive":
                            const badgeClass = value === "Ativo" ? "success" : "secondary";
                            value = `<span class="badge ${badgeClass}">${value}</span>`;
                            break;
                          case "email":
                          case "phone":
                          case "createdAt":
                            className = "text-left text-muted";
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
        </div>

        <div class="footer">
          <div class="footer-left">
            <p>Relatório gerado pelo sistema Ankaa</p>
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
    <BaseExportPopover<Responsible>
      className={className}
      currentItems={currentResponsibles}
      totalRecords={totalRecords}
      selectedItems={selectedResponsibles}
      visibleColumns={visibleColumns}
      exportColumns={EXPORT_COLUMNS}
      defaultVisibleColumns={DEFAULT_VISIBLE_COLUMNS}
      onExport={handleExport}
      onFetchAllItems={fetchAllResponsibles}
      entityName="responsável"
      entityNamePlural="responsáveis"
    />
  );
}
