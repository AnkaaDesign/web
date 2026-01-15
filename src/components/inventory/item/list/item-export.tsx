import { BaseExportPopover, type ExportFormat, type ExportColumn } from "@/components/ui/export-popover";
import { toast } from "sonner";
import type { Item } from "../../../../types";
import type { ItemGetManyFormData } from "../../../../schemas";
import { formatCurrency, formatDate, formatDateTime, itemUtils } from "../../../../utils";
import { MEASURE_UNIT_LABELS } from "../../../../constants";
import { itemService } from "../../../../api-client";

interface ItemExportProps {
  className?: string;
  filters?: Partial<ItemGetManyFormData>;
  currentItems?: Item[];
  totalRecords?: number;
  visibleColumns?: Set<string>;
  selectedItems?: Set<string>;
}

// Column configuration for export - MUST match exact order from item-table-cumulative.tsx
const EXPORT_COLUMNS: ExportColumn<Item>[] = [
  { id: "uniCode", label: "Código Único", getValue: (item: Item) => item.uniCode || "" },
  { id: "name", label: "Nome", getValue: (item: Item) => item.name },
  { id: "brand.name", label: "Marca", getValue: (item: Item) => item.brand?.name || "" },
  { id: "category.name", label: "Categoria", getValue: (item: Item) => item.category?.name || "" },
  { id: "price", label: "Preço", getValue: (item: Item) => (item.prices?.[0]?.value ? formatCurrency(item.prices[0].value) : "") },
  { id: "totalPrice", label: "Valor Total", getValue: (item: Item) => (item.totalPrice ? formatCurrency(item.totalPrice) : "") },
  { id: "monthlyConsumption", label: "Consumo Mensal", getValue: (item: Item) => (item.monthlyConsumption ? item.monthlyConsumption.toLocaleString("pt-BR") : "") },
  {
    id: "monthlyConsumptionTrend",
    label: "Tendência de Consumo (%)",
    getValue: (item: Item) =>
      item.monthlyConsumptionTrendPercent !== null ? `${item.monthlyConsumptionTrendPercent > 0 ? "+" : ""}${item.monthlyConsumptionTrendPercent.toFixed(2)}%` : "",
  },
  { id: "CA", label: "CA", getValue: (item: Item) => item.ppeCA || "" },
  { id: "barcodes", label: "Códigos de Barras", getValue: (item: Item) => item.barcodes?.join(", ") || "" },
  { id: "quantity", label: "Quantidade", getValue: (item: Item) => itemUtils.formatItemQuantity(item) },
  { id: "maxQuantity", label: "Qtd. Máxima", getValue: (item: Item) => item.maxQuantity?.toString() || "" },
  { id: "reorderPoint", label: "Ponto de Reposição", getValue: (item: Item) => item.reorderPoint?.toString() || "" },
  { id: "reorderQuantity", label: "Qtd. de Reposição", getValue: (item: Item) => item.reorderQuantity?.toString() || "" },
  { id: "boxQuantity", label: "Qtd. por Caixa", getValue: (item: Item) => item.boxQuantity?.toString() || "" },
  { id: "icms", label: "ICMS", getValue: (item: Item) => (item.icms ? `${item.icms}%` : "") },
  { id: "ipi", label: "IPI", getValue: (item: Item) => (item.ipi ? `${item.ipi}%` : "") },
  {
    id: "measures",
    label: "Medidas",
    getValue: (item: Item) => {
      if (!item.measures || item.measures.length === 0) return "";
      return item.measures.map((m) => `${m.value} ${m.unit && MEASURE_UNIT_LABELS[m.unit] ? MEASURE_UNIT_LABELS[m.unit] : m.unit || ""}`).join(", ");
    },
  },
  { id: "supplier.fantasyName", label: "Fornecedor", getValue: (item: Item) => item.supplier?.fantasyName || "" },
  { id: "shouldAssignToUser", label: "Atribuir ao Usuário", getValue: (item: Item) => (item.shouldAssignToUser ? "Sim" : "Não") },
  { id: "estimatedLeadTime", label: "Prazo Estimado", getValue: (item: Item) => (item.estimatedLeadTime ? `${item.estimatedLeadTime} dias` : "") },
  { id: "isActive", label: "Status", getValue: (item: Item) => (item.isActive ? "Ativo" : "Inativo") },
  { id: "createdAt", label: "Criado em", getValue: (item: Item) => formatDate(new Date(item.createdAt)) },
  { id: "updatedAt", label: "Atualizado em", getValue: (item: Item) => formatDate(new Date(item.updatedAt)) },
];

// Default columns if none are specified
const DEFAULT_VISIBLE_COLUMNS = new Set(["uniCode", "name", "brand.name", "category.name", "quantity", "monthlyConsumption", "price", "totalPrice"]);

export function ItemExport({ className, filters = {}, currentItems = [], totalRecords = 0, visibleColumns, selectedItems }: ItemExportProps) {
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

  const fetchAllItems = async (): Promise<Item[]> => {
    const allItemsResponse = await itemService.getItems({
      ...filters,
      limit: totalRecords > 0 ? totalRecords : 10000, // Limit to prevent memory issues
      include: {
        brand: true,
        category: true,
        supplier: true,
        prices: true,
      },
    });

    return allItemsResponse.data || [];
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
    link.setAttribute("download", `produtos_${formatDate(new Date()).replace(/\//g, "-")}.csv`);
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
      XLSX.utils.book_append_sheet(wb, ws, "Produtos");
      const colWidths = columns.map((col) => {
        const headerLength = col.label.length;
        const maxContentLength = Math.max(...data.map((row) => String(row[col.label] || "").length), 0);
        return { wch: Math.min(Math.max(headerLength, maxContentLength) + 2, 50) };
      });
      ws["!cols"] = colWidths;
      XLSX.writeFile(wb, `produtos_${formatDate(new Date()).replace(/\//g, "-")}.xlsx`, {
        bookType: 'xlsx', bookSST: false, type: 'binary'
      });
    } catch (error) {
      console.error("Excel export error:", error);
      await exportToCSV(items, columns);
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
        <title>Produtos - ${formatDate(new Date())}</title>
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
          
          /* Stock status indicator */
          .stock-indicator {
            display: inline-flex;
            align-items: center;
            gap: 4px;
            justify-content: flex-start;
          }
          
          .status-dot {
            width: 6px;
            height: 6px;
            border-radius: 50%;
            flex-shrink: 0;
          }
          
          .status-dot.red { background-color: #ef4444; }
          .status-dot.orange { background-color: #f97316; }
          .status-dot.green { background-color: #22c55e; }
          .status-dot.gray { background-color: #9ca3af; }
          
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
          
          .badge.default {
            background-color: #1f2937;
            color: white;
          }
          
          .badge.secondary {
            background-color: #f3f4f6;
            color: #6b7280;
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
                case "uniCode":
                case "CA":
                  width = "80px";
                  break;
                case "name":
                  width = columnCount <= 6 ? "200px" : "140px";
                  break;
                case "brand.name":
                case "category.name":
                  width = "120px";
                  break;
                case "price":
                case "totalPrice":
                case "monthlyConsumption":
                  width = "90px";
                  break;
                case "quantity":
                case "maxQuantity":
                  width = "70px";
                  break;
                case "barcodes":
                  width = columnCount <= 6 ? "150px" : "100px";
                  break;
                case "supplier.fantasyName":
                  width = "130px";
                  break;
                case "measureUnit":
                case "isActive":
                  width = "80px";
                  break;
                case "shouldAssignToUser":
                  width = "90px";
                  break;
                case "estimatedLeadTime":
                  width = "80px";
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
              <p><strong>Total de produtos:</strong> ${items.length}</p>
            </div>
          </div>
        </div>
        
        <div class="content-wrapper">
          <table>
            <thead>
              <tr>
                ${columns
                  .map((col) => {
                    // Get column alignment matching the table component
                    let alignment = "text-left";
                    if (["monthlyConsumption", "maxQuantity", "reorderPoint", "reorderQuantity", "boxQuantity", "icms", "ipi", "measureValue"].includes(col.id)) {
                      alignment = "text-right";
                    } else if (["measureUnit"].includes(col.id)) {
                      alignment = "text-center";
                    }
                    return `<th class="${alignment}">${col.label}</th>`;
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

                        // Apply exact formatting from table component
                        switch (col.id) {
                          case "uniCode":
                          case "CA":
                            className = "font-mono text-left";
                            break;

                          case "name":
                            className = "font-medium text-left";
                            break;

                          case "brand.name":
                          case "category.name":
                            className = "text-left";
                            break;

                          case "price":
                            className = "text-left font-medium";
                            break;

                          case "totalPrice":
                            className = "text-left font-semibold";
                            break;

                          case "monthlyConsumption":
                            className = "text-right";
                            break;

                          case "barcodes":
                            className = "font-mono text-left";
                            break;

                          case "quantity":
                            const quantity = item.quantity || 0;
                            let statusClass = "gray";
                            if (quantity === 0) statusClass = "red";
                            else if (item.reorderPoint && quantity <= item.reorderPoint) statusClass = "orange";
                            else if (item.reorderPoint || item.maxQuantity) statusClass = "green";

                            value = `<div class="stock-indicator text-left">
                            <span class="font-medium">${quantity.toLocaleString("pt-BR")}</span>
                            <span class="status-dot ${statusClass}"></span>
                          </div>`;
                            className = "";
                            break;

                          case "maxQuantity":
                          case "reorderPoint":
                          case "reorderQuantity":
                          case "boxQuantity":
                            className = "text-right text-muted";
                            break;

                          case "icms":
                          case "ipi":
                            className = "text-right text-muted";
                            break;

                          case "measureValue":
                            className = "text-right text-muted";
                            break;

                          case "measureUnit":
                            className = "text-center";
                            break;

                          case "supplier.fantasyName":
                            className = "text-left";
                            break;

                          case "shouldAssignToUser":
                            const assignBadge = item.shouldAssignToUser ? "default" : "secondary";
                            const assignText = item.shouldAssignToUser ? "Sim" : "Não";
                            value = `<span class="badge ${assignBadge}">${assignText}</span>`;
                            className = "text-left";
                            break;

                          case "estimatedLeadTime":
                            className = "text-left text-muted";
                            break;

                          case "isActive":
                            const statusBadge = item.isActive ? "default" : "secondary";
                            const statusText = item.isActive ? "Ativo" : "Inativo";
                            value = `<span class="badge ${statusBadge}">${statusText}</span>`;
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
      selectedItems={selectedItems}
      visibleColumns={visibleColumns}
      exportColumns={EXPORT_COLUMNS}
      defaultVisibleColumns={DEFAULT_VISIBLE_COLUMNS}
      onExport={handleExport}
      onFetchAllItems={fetchAllItems}
      entityName="item"
      entityNamePlural="itens"
    />
  );
}
