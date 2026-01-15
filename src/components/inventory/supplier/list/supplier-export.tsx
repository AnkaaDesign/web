import { BaseExportPopover, type ExportFormat, type ExportColumn } from "@/components/ui/export-popover";
import { toast } from "@/components/ui/sonner";
import { supplierService } from "../../../../api-client";
import { formatCNPJ, formatDate, formatDateTime } from "../../../../utils";
import type { Supplier } from "../../../../types";
import type { SupplierGetManyFormData } from "../../../../schemas";

interface SupplierExportProps {
  className?: string;
  filters?: Partial<SupplierGetManyFormData>;
  currentSuppliers?: Supplier[];
  totalRecords?: number;
  visibleColumns?: Set<string>;
  selectedSuppliers?: Set<string>;
}

// Column configuration for export - matches table columns
const EXPORT_COLUMNS: ExportColumn<Supplier>[] = [
  { id: "fantasyName", label: "Nome Fantasia", getValue: (supplier: Supplier) => supplier.fantasyName },
  { id: "corporateName", label: "Razão Social", getValue: (supplier: Supplier) => supplier.corporateName || "" },
  { id: "cnpj", label: "CNPJ", getValue: (supplier: Supplier) => (supplier.cnpj ? formatCNPJ(supplier.cnpj) : "") },
  { id: "email", label: "Email", getValue: (supplier: Supplier) => supplier.email || "" },
  { id: "phones", label: "Telefones", getValue: (supplier: Supplier) => supplier.phones?.join(", ") || "" },
  {
    id: "address",
    label: "Endereço",
    getValue: (supplier: Supplier) => {
      const parts = [supplier.address, supplier.addressNumber, supplier.addressComplement];
      return parts.filter(Boolean).join(", ");
    },
  },
  { id: "neighborhood", label: "Bairro", getValue: (supplier: Supplier) => supplier.neighborhood || "" },
  { id: "city", label: "Cidade", getValue: (supplier: Supplier) => supplier.city || "" },
  { id: "state", label: "Estado", getValue: (supplier: Supplier) => supplier.state || "" },
  { id: "zipCode", label: "CEP", getValue: (supplier: Supplier) => supplier.zipCode || "" },
  { id: "site", label: "Site", getValue: (supplier: Supplier) => supplier.site || "" },
  { id: "_count.items", label: "Produtos", getValue: (supplier: Supplier) => supplier._count?.items?.toString() || "0" },
  { id: "_count.orders", label: "Pedidos", getValue: (supplier: Supplier) => supplier._count?.orders?.toString() || "0" },
  { id: "_count.orderRules", label: "Regras de Pedido", getValue: (supplier: Supplier) => supplier._count?.orderRules?.toString() || "0" },
  { id: "createdAt", label: "Criado em", getValue: (supplier: Supplier) => formatDate(new Date(supplier.createdAt)) },
  { id: "updatedAt", label: "Atualizado em", getValue: (supplier: Supplier) => formatDate(new Date(supplier.updatedAt)) },
];

// Default columns if none are specified
const DEFAULT_VISIBLE_COLUMNS = new Set(["fantasyName", "corporateName", "cnpj", "email", "phones", "_count.items", "_count.orders"]);

export function SupplierExport({ className, filters = {}, currentSuppliers = [], totalRecords = 0, visibleColumns, selectedSuppliers }: SupplierExportProps) {
  const handleExport = async (format: ExportFormat, suppliers: Supplier[], columns: ExportColumn<Supplier>[]) => {
    // Generate export based on format
    switch (format) {
      case "csv":
        await exportToCSV(suppliers, columns);
        break;
      case "excel":
        await exportToExcel(suppliers, columns);
        break;
      case "pdf":
        await exportToPDF(suppliers, columns);
        break;
    }

    toast.success(`Exportação ${format.toUpperCase()} concluída com sucesso!`);
  };

  const fetchAllSuppliers = async (): Promise<Supplier[]> => {
    const allSuppliersResponse = await supplierService.getSuppliers({
      ...filters,
      limit: totalRecords > 0 ? totalRecords : 10000, // Limit to prevent memory issues
      include: {
        _count: {
          select: {
            items: true,
            orders: true,
            orderRules: true,
          },
        },
      },
    });

    return allSuppliersResponse.data || [];
  };

  const exportToCSV = async (suppliers: Supplier[], columns: ExportColumn<Supplier>[]) => {
    // CSV headers from visible columns
    const headers = columns.map((col) => col.label);

    // Convert suppliers to CSV rows with only visible columns
    const rows = suppliers.map((supplier) => columns.map((col) => col.getValue(supplier)));

    // Create CSV content
    const csvContent = [headers.join(","), ...rows.map((row) => row.map((cell) => `"${cell}"`).join(","))].join("\n");

    // Download CSV
    const blob = new Blob(["\ufeff" + csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", `fornecedores_${formatDate(new Date()).replace(/\//g, "-")}.csv`);
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const exportToExcel = async (suppliers: Supplier[], columns: ExportColumn<Supplier>[]) => {
    try {
      const XLSX = await import("xlsx");
      const data = suppliers.map((supplier) => {
        const row: Record<string, any> = {};
        columns.forEach((column) => { row[column.label] = column.getValue(supplier); });
        return row;
      });
      const ws = XLSX.utils.json_to_sheet(data);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Fornecedores");
      const colWidths = columns.map((col) => {
        const headerLength = col.label.length;
        const maxContentLength = Math.max(...data.map((row) => String(row[col.label] || "").length), 0);
        return { wch: Math.min(Math.max(headerLength, maxContentLength) + 2, 50) };
      });
      ws["!cols"] = colWidths;
      XLSX.writeFile(wb, `fornecedores_${formatDate(new Date()).replace(/\//g, "-")}.xlsx`, {
        bookType: 'xlsx', bookSST: false, type: 'binary'
      });
    } catch (error) {
      console.error("Excel export error:", error);
      await exportToCSV(suppliers, columns);
  };

  const exportToPDF = async (suppliers: Supplier[], columns: ExportColumn<Supplier>[]) => {
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
        <title>Fornecedores - ${formatDate(new Date())}</title>
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
                case "fantasyName":
                  width = columnCount <= 6 ? "200px" : "140px";
                  break;
                case "corporateName":
                  width = columnCount <= 6 ? "180px" : "120px";
                  break;
                case "cnpj":
                  width = "120px";
                  break;
                case "email":
                  width = columnCount <= 6 ? "160px" : "120px";
                  break;
                case "phones":
                  width = "120px";
                  break;
                case "address":
                  width = columnCount <= 6 ? "200px" : "150px";
                  break;
                case "neighborhood":
                case "city":
                case "state":
                  width = "100px";
                  break;
                case "zipCode":
                  width = "80px";
                  break;
                case "site":
                  width = columnCount <= 6 ? "150px" : "120px";
                  break;
                case "_count.items":
                case "_count.orders":
                case "_count.orderRules":
                  width = "70px";
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
              <p><strong>Total de fornecedores:</strong> ${suppliers.length}</p>
            </div>
          </div>
        </div>
        
        <div class="content-wrapper">
          <table>
            <thead>
              <tr>
                ${columns
                  .map((col) => {
                    let alignment = "text-left";
                    if (["_count.items", "_count.orders", "_count.orderRules"].includes(col.id)) {
                      alignment = "text-center";
                    }
                    return `<th class="${alignment}">${col.label}</th>`;
                  })
                  .join("")}
              </tr>
            </thead>
            <tbody>
              ${suppliers
                .map((supplier) => {
                  return `
                  <tr>
                    ${columns
                      .map((col) => {
                        let value = col.getValue(supplier) || "-";
                        let className = "";

                        switch (col.id) {
                          case "fantasyName":
                            className = "font-medium text-left";
                            break;
                          case "corporateName":
                            className = "text-left text-muted";
                            break;
                          case "cnpj":
                            className = "font-mono text-left";
                            break;
                          case "email":
                            className = "text-left text-muted";
                            break;
                          case "phones":
                            className = "font-mono text-left";
                            break;
                          case "address":
                            className = "text-left text-muted";
                            break;
                          case "site":
                            className = "text-left text-muted";
                            break;
                          case "_count.items":
                          case "_count.orders":
                          case "_count.orderRules":
                            className = "text-center font-medium";
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
    <BaseExportPopover<Supplier>
      className={className}
      currentItems={currentSuppliers}
      totalRecords={totalRecords}
      selectedItems={selectedSuppliers}
      visibleColumns={visibleColumns}
      exportColumns={EXPORT_COLUMNS}
      defaultVisibleColumns={DEFAULT_VISIBLE_COLUMNS}
      onExport={handleExport}
      onFetchAllItems={fetchAllSuppliers}
      entityName="fornecedor"
      entityNamePlural="fornecedores"
    />
  );
}
