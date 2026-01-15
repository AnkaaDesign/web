import { BaseExportPopover, type ExportFormat, type ExportColumn } from "@/components/ui/export-popover";
import { toast } from "sonner";
import type { Borrow } from "../../../../types";
import type { BorrowGetManyFormData } from "../../../../schemas";
import { BORROW_STATUS_LABELS } from "../../../../constants";
import { formatDate, formatDateTime } from "../../../../utils";
import { borrowService } from "../../../../api-client";

interface BorrowExportProps {
  className?: string;
  filters?: Partial<BorrowGetManyFormData>;
  currentItems?: Borrow[];
  totalRecords?: number;
  visibleColumns?: Set<string>;
  selectedBorrows?: Set<string>;
}

// Column configuration for export
const EXPORT_COLUMNS: ExportColumn<Borrow>[] = [
  { id: "item.uniCode", label: "CÓDIGO", getValue: (borrow: Borrow) => borrow.item?.uniCode || "" },
  { id: "item.name", label: "ITEM", getValue: (borrow: Borrow) => borrow.item?.name || "" },
  { id: "user.name", label: "USUÁRIO", getValue: (borrow: Borrow) => borrow.user?.name || "" },
  { id: "user.position.name", label: "CARGO", getValue: (borrow: Borrow) => borrow.user?.position?.name || "" },
  { id: "quantity", label: "QUANTIDADE", getValue: (borrow: Borrow) => borrow.quantity.toString() },
  { id: "status", label: "STATUS", getValue: (borrow: Borrow) => BORROW_STATUS_LABELS[borrow.status] || borrow.status },
  { id: "createdAt", label: "EMPRESTADO EM", getValue: (borrow: Borrow) => formatDate(new Date(borrow.createdAt)) },
  { id: "returnedAt", label: "DEVOLVIDO EM", getValue: (borrow: Borrow) => (borrow.returnedAt ? formatDate(new Date(borrow.returnedAt)) : "") },
  { id: "item.category.name", label: "CATEGORIA", getValue: (borrow: Borrow) => borrow.item?.category?.name || "" },
  { id: "item.brand.name", label: "MARCA", getValue: (borrow: Borrow) => borrow.item?.brand?.name || "" },
  { id: "updatedAt", label: "ATUALIZADO EM", getValue: (borrow: Borrow) => formatDate(new Date(borrow.updatedAt)) },
];

// Default columns if none are specified
const DEFAULT_VISIBLE_COLUMNS = new Set(["item.uniCode", "item.name", "user.name", "quantity", "status", "createdAt", "returnedAt"]);

export function BorrowExport({ className, filters = {}, currentItems = [], totalRecords = 0, visibleColumns, selectedBorrows }: BorrowExportProps) {
  const handleExport = async (format: ExportFormat, items: Borrow[], columns: ExportColumn<Borrow>[]) => {
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

  const fetchAllBorrows = async (): Promise<Borrow[]> => {
    const allBorrowsResponse = await borrowService.getBorrows({
      ...filters,
      limit: totalRecords > 0 ? totalRecords : 10000, // Limit to prevent memory issues
      include: {
        item: {
          include: {
            brand: true,
            category: true,
          },
        },
        user: {
          include: {
            position: true,
          },
        },
      },
    });

    return allBorrowsResponse.data || [];
  };

  const exportToCSV = async (items: Borrow[], columns: ExportColumn<Borrow>[]) => {
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
    link.setAttribute("download", `emprestimos_${formatDate(new Date()).replace(/\//g, "-")}.csv`);
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const exportToExcel = async (items: Borrow[], columns: ExportColumn<Borrow>[]) => {
    try {
      const XLSX = await import("xlsx");
      const data = items.map((item) => {
        const row: Record<string, any> = {};
        columns.forEach((column) => { row[column.label] = column.getValue(item); });
        return row;
      });
      const ws = XLSX.utils.json_to_sheet(data);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Empréstimos");
      const colWidths = columns.map((col) => {
        const headerLength = col.label.length;
        const maxContentLength = Math.max(...data.map((row) => String(row[col.label] || "").length), 0);
        return { wch: Math.min(Math.max(headerLength, maxContentLength) + 2, 50) };
      });
      ws["!cols"] = colWidths;
      XLSX.writeFile(wb, `emprestimos_${formatDate(new Date()).replace(/\//g, "-")}.xlsx`, {
        bookType: 'xlsx', bookSST: false, type: 'binary'
      });
    } catch (error) {
      console.error("Excel export error:", error);
      await exportToCSV(items, columns);
    }
  };

  const exportToPDF = async (items: Borrow[], columns: ExportColumn<Borrow>[]) => {
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
        <title>Empréstimos - ${formatDate(new Date())}</title>
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

          /* Column alignment classes */
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

          /* Badge styles */
          .badge {
            display: inline-block;
            padding: 1px 6px;
            border-radius: 3px;
            font-size: ${columnCount <= 6 ? "9px" : "7px"};
            font-weight: 500;
            text-transform: uppercase;
            letter-spacing: 0.03em;
          }

          .badge.active {
            background-color: #22c55e;
            color: white;
          }

          .badge.returned {
            background-color: #64748b;
            color: white;
          }

          .badge.lost {
            background-color: #ef4444;
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

          /* Dynamic column widths based on content */
          ${columns
            .map((col, index) => {
              let width = "100px"; // default
              switch (col.id) {
                case "item.uniCode":
                  width = "100px";
                  break;
                case "item.name":
                  width = columnCount <= 6 ? "200px" : "140px";
                  break;
                case "user.name":
                  width = columnCount <= 6 ? "150px" : "120px";
                  break;
                case "user.position.name":
                  width = "120px";
                  break;
                case "quantity":
                  width = "80px";
                  break;
                case "status":
                  width = "90px";
                  break;
                case "createdAt":
                case "returnedAt":
                case "updatedAt":
                  width = "90px";
                  break;
                case "item.category.name":
                case "item.brand.name":
                  width = "100px";
                  break;
                default:
                  width = "100px";
              }
              return `th:nth-child(${index + 1}), td:nth-child(${index + 1}) { width: ${width}; min-width: 60px; }`;
            })
            .join("\n")}

          /* Print optimizations */
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
              <p><strong>Total de empréstimos:</strong> ${items.length}</p>
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
                        let className = "";

                        // Apply formatting based on column
                        switch (col.id) {
                          case "item.uniCode":
                            className = "font-mono text-left";
                            break;
                          case "item.name":
                          case "user.name":
                            className = "font-medium text-left";
                            break;
                          case "status":
                            const statusClass = item.status.toLowerCase();
                            value = `<span class="badge ${statusClass}">${value}</span>`;
                            className = "text-left";
                            break;
                          case "createdAt":
                          case "returnedAt":
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
    <BaseExportPopover<Borrow>
      className={className}
      currentItems={currentItems}
      totalRecords={totalRecords}
      selectedItems={selectedBorrows}
      visibleColumns={visibleColumns}
      exportColumns={EXPORT_COLUMNS}
      defaultVisibleColumns={DEFAULT_VISIBLE_COLUMNS}
      onExport={handleExport}
      onFetchAllItems={fetchAllBorrows}
      entityName="empréstimo"
      entityNamePlural="empréstimos"
    />
  );
}
