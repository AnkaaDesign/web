import { BaseExportPopover, type ExportFormat, type ExportColumn } from "@/components/ui/export-popover";
import { toast } from "sonner";
import type { Item } from "../../../../types";
import type { ItemGetManyFormData } from "../../../../schemas";
import { formatCurrency, formatDate, formatDateTime, itemUtils } from "../../../../utils";
import { MEASURE_UNIT_LABELS, MEASURE_TYPE_LABELS, PPE_TYPE_LABELS } from "../../../../constants";
import { itemService } from "../../../../api-client";

interface PpeExportProps {
  className?: string;
  filters?: Partial<ItemGetManyFormData>;
  currentItems?: Item[];
  totalRecords?: number;
  visibleColumns?: Set<string>;
  selectedPpes?: Set<string>;
}

// Column configuration for export
const EXPORT_COLUMNS: ExportColumn<Item>[] = [
  { id: "uniCode", label: "CÓDIGO ÚNICO", getValue: (item: Item) => item.uniCode || "" },
  { id: "name", label: "NOME", getValue: (item: Item) => item.name },
  { id: "brand.name", label: "MARCA", getValue: (item: Item) => item.brand?.name || "" },
  { id: "category.name", label: "CATEGORIA", getValue: (item: Item) => item.category?.name || "" },
  { id: "ppeCA", label: "CA", getValue: (item: Item) => item.ppeCA || "" },
  { id: "ppeType", label: "TIPO EPI", getValue: (item: Item) => (item.ppeType ? PPE_TYPE_LABELS[item.ppeType] || item.ppeType : "") },
  {
    id: "measures",
    label: "MEDIDAS",
    getValue: (item: Item) => {
      if (!item.measures || item.measures.length === 0) return "";
      return item.measures
        .map((m) => {
          const typeLabel = m.measureType ? MEASURE_TYPE_LABELS[m.measureType] : "";
          const unitLabel = m.unit && MEASURE_UNIT_LABELS[m.unit] ? MEASURE_UNIT_LABELS[m.unit] : m.unit || "";
          if (m.value !== null && m.value !== undefined) {
            return unitLabel ? `${typeLabel}: ${m.value} ${unitLabel}` : `${typeLabel}: ${m.value}`;
          } else if (unitLabel) {
            return `${typeLabel}: ${unitLabel}`;
          }
          return "";
        })
        .filter(Boolean)
        .join(", ");
    },
  },
  { id: "quantity", label: "QUANTIDADE", getValue: (item: Item) => itemUtils.formatItemQuantity(item) },
  { id: "maxQuantity", label: "QTD. MÁXIMA", getValue: (item: Item) => item.maxQuantity?.toString() || "" },
  { id: "reorderPoint", label: "PONTO DE REPOSIÇÃO", getValue: (item: Item) => item.reorderPoint?.toString() || "" },
  { id: "reorderQuantity", label: "QTD. DE REPOSIÇÃO", getValue: (item: Item) => item.reorderQuantity?.toString() || "" },
  { id: "price", label: "PREÇO", getValue: (item: Item) => (item.prices?.[0]?.value ? formatCurrency(item.prices[0].value) : "") },
  { id: "totalPrice", label: "VALOR TOTAL", getValue: (item: Item) => (item.totalPrice ? formatCurrency(item.totalPrice) : "") },
  { id: "supplier.fantasyName", label: "FORNECEDOR", getValue: (item: Item) => item.supplier?.fantasyName || "" },
  { id: "barcodes", label: "CÓDIGOS DE BARRAS", getValue: (item: Item) => item.barcodes?.join(", ") || "" },
  { id: "createdAt", label: "CADASTRADO EM", getValue: (item: Item) => formatDate(new Date(item.createdAt)) },
  { id: "updatedAt", label: "ATUALIZADO EM", getValue: (item: Item) => formatDate(new Date(item.updatedAt)) },
];

// Default columns if none are specified
const DEFAULT_VISIBLE_COLUMNS = new Set(["uniCode", "name", "brand.name", "category.name", "ppeCA", "ppeType", "measures", "quantity"]);

export function PpeExport({ className, filters = {}, currentItems = [], totalRecords = 0, visibleColumns, selectedPpes }: PpeExportProps) {
  const handleExport = async (format: ExportFormat, items: Item[], columns: ExportColumn<Item>[]) => {
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

  const fetchAllPpes = async (): Promise<Item[]> => {
    const allPpesResponse = await itemService.getItems({
      ...filters,
      limit: totalRecords > 0 ? totalRecords : 10000, // Limit to prevent memory issues
      include: {
        brand: true,
        category: true,
        supplier: true,
        prices: true,
      },
    });

    return allPpesResponse.data || [];
  };

  const exportToCSV = async (items: Item[], columns: ExportColumn<Item>[]) => {
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
    link.setAttribute("download", `epis_${formatDate(new Date()).replace(/\//g, "-")}.csv`);
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const exportToExcel = async (items: Item[], columns: ExportColumn<Item>[]) => {
    try {
      const XLSX = await import("xlsx");
      const data = items.map((item) => {
        const row: Record<string, any> = {};
        columns.forEach((column) => { row[column.label] = column.getValue(item); });
        return row;
      });
      const ws = XLSX.utils.json_to_sheet(data);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "EPIs");
      const colWidths = columns.map((col) => {
        const headerLength = col.label.length;
        const maxContentLength = Math.max(...data.map((row) => String(row[col.label] || "").length), 0);
        return { wch: Math.min(Math.max(headerLength, maxContentLength) + 2, 50) };
      });
      ws["!cols"] = colWidths;
      XLSX.writeFile(wb, `epis_${formatDate(new Date()).replace(/\//g, "-")}.xlsx`, {
        bookType: 'xlsx', bookSST: false, type: 'binary'
      });
    } catch (error) {
      console.error("Excel export error:", error);
      await exportToCSV(items, columns);
    }
  };

  const exportToPDF = async (items: Item[], columns: ExportColumn<Item>[]) => {
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
        <title>EPIs - ${formatDate(new Date())}</title>
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

          /* Dynamic column widths based on content */
          ${columns
            .map((col, index) => {
              let width = "100px"; // default
              switch (col.id) {
                case "uniCode":
                  width = "100px";
                  break;
                case "name":
                  width = columnCount <= 6 ? "200px" : "140px";
                  break;
                case "brand.name":
                case "category.name":
                  width = "120px";
                  break;
                case "ppeCA":
                  width = "80px";
                  break;
                case "ppeType":
                  width = "100px";
                  break;
                case "measures":
                  width = "120px";
                  break;
                case "quantity":
                case "maxQuantity":
                case "reorderPoint":
                case "reorderQuantity":
                  width = "80px";
                  break;
                case "price":
                case "totalPrice":
                  width = "100px";
                  break;
                case "supplier.fantasyName":
                  width = "120px";
                  break;
                case "barcodes":
                  width = "120px";
                  break;
                case "createdAt":
                case "updatedAt":
                  width = "90px";
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
              <p><strong>Total de EPIs:</strong> ${items.length}</p>
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
                          case "uniCode":
                            className = "font-mono text-left";
                            break;
                          case "name":
                            className = "font-medium text-left";
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
    <BaseExportPopover<Item>
      className={className}
      currentItems={currentItems}
      totalRecords={totalRecords}
      selectedItems={selectedPpes}
      visibleColumns={visibleColumns}
      exportColumns={EXPORT_COLUMNS}
      defaultVisibleColumns={DEFAULT_VISIBLE_COLUMNS}
      onExport={handleExport}
      onFetchAllItems={fetchAllPpes}
      entityName="EPI"
      entityNamePlural="EPIs"
    />
  );
}
