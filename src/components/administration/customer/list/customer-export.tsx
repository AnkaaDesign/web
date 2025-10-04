import { BaseExportPopover, type ExportFormat, type ExportColumn } from "@/components/ui/export-popover";
import { toast } from "sonner";
import type { Customer } from "../../../../types";
import type { CustomerGetManyFormData } from "../../../../schemas";
import { formatCNPJ, formatCPF, formatPhone, formatDate, formatDateTime } from "../../../../utils";
import { customerService } from "../../../../api-client";

interface CustomerExportProps {
  className?: string;
  filters?: Partial<CustomerGetManyFormData>;
  currentCustomers?: Customer[];
  totalRecords?: number;
  visibleColumns?: Set<string>;
  selectedCustomers?: Set<string>;
}

// Column configuration for export
const EXPORT_COLUMNS: ExportColumn<Customer>[] = [
  { id: "fantasyName", label: "NOME FANTASIA", getValue: (customer: Customer) => customer.fantasyName },
  {
    id: "document",
    label: "DOCUMENTO",
    getValue: (customer: Customer) => {
      if (customer.cnpj) return formatCNPJ(customer.cnpj);
      if (customer.cpf) return formatCPF(customer.cpf);
      return "";
    },
  },
  { id: "corporateName", label: "RAZÃO SOCIAL", getValue: (customer: Customer) => customer.corporateName || "" },
  { id: "email", label: "E-MAIL", getValue: (customer: Customer) => customer.email || "" },
  { id: "phones", label: "TELEFONES", getValue: (customer: Customer) => customer.phones?.map((p) => formatPhone(p)).join("; ") || "" },
  { id: "address", label: "ENDEREÇO", getValue: (customer: Customer) => customer.address || "" },
  { id: "addressNumber", label: "NÚMERO", getValue: (customer: Customer) => customer.addressNumber || "" },
  { id: "addressComplement", label: "COMPLEMENTO", getValue: (customer: Customer) => customer.addressComplement || "" },
  { id: "neighborhood", label: "BAIRRO", getValue: (customer: Customer) => customer.neighborhood || "" },
  { id: "city", label: "CIDADE", getValue: (customer: Customer) => customer.city || "" },
  { id: "state", label: "ESTADO", getValue: (customer: Customer) => customer.state || "" },
  { id: "zipCode", label: "CEP", getValue: (customer: Customer) => customer.zipCode || "" },
  { id: "site", label: "SITE", getValue: (customer: Customer) => customer.site || "" },
  { id: "tags", label: "TAGS", getValue: (customer: Customer) => customer.tags?.join("; ") || "" },
  { id: "taskCount", label: "TAREFAS", getValue: (customer: Customer) => (customer._count?.tasks || 0).toString() },
  { id: "serviceOrderCount", label: "ORDENS DE SERVIÇO", getValue: (customer: Customer) => (customer._count?.serviceOrders || 0).toString() },
  { id: "createdAt", label: "CADASTRADO EM", getValue: (customer: Customer) => formatDate(new Date(customer.createdAt)) },
  { id: "updatedAt", label: "ATUALIZADO EM", getValue: (customer: Customer) => formatDate(new Date(customer.updatedAt)) },
];

// Default columns if none are specified
const DEFAULT_VISIBLE_COLUMNS = new Set(["fantasyName", "document", "corporateName", "email", "phones", "taskCount"]);

export function CustomerExport({ className, filters = {}, currentCustomers = [], totalRecords = 0, visibleColumns, selectedCustomers }: CustomerExportProps) {
  const handleExport = async (format: ExportFormat, items: Customer[], columns: ExportColumn<Customer>[]) => {
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

  const fetchAllCustomers = async (): Promise<Customer[]> => {
    const allCustomersResponse = await customerService.getCustomers({
      ...filters,
      limit: totalRecords > 0 ? totalRecords : 10000, // Limit to prevent memory issues
      include: {
        logo: true,
        count: true,
      },
    });

    return allCustomersResponse.data || [];
  };

  const exportToCSV = async (items: Customer[], columns: ExportColumn<Customer>[]) => {
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
    link.setAttribute("download", `clientes_${formatDate(new Date()).replace(/\//g, "-")}.csv`);
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const exportToExcel = async (items: Customer[], columns: ExportColumn<Customer>[]) => {
    // Headers from visible columns
    const headers = columns.map((col) => col.label);

    // Convert items to rows with only visible columns
    const rows = items.map((item) => columns.map((col) => col.getValue(item)));

    // Create tab-separated values for Excel
    const excelContent = [headers.join("\t"), ...rows.map((row) => row.join("\t"))].join("\n");

    // Download as .xls file
    const blob = new Blob(["\ufeff" + excelContent], { type: "application/vnd.ms-excel;charset=utf-8;" });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", `clientes_${formatDate(new Date()).replace(/\//g, "-")}.xls`);
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const exportToPDF = async (items: Customer[], columns: ExportColumn<Customer>[]) => {
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
        <title>Clientes - ${formatDate(new Date())}</title>
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
                case "corporateName":
                  width = columnCount <= 6 ? "200px" : "140px";
                  break;
                case "document":
                  width = "120px";
                  break;
                case "email":
                  width = "150px";
                  break;
                case "phones":
                  width = "130px";
                  break;
                case "city":
                case "state":
                  width = "80px";
                  break;
                case "taskCount":
                case "serviceOrderCount":
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
              <p><strong>Total de clientes:</strong> ${items.length}</p>
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
                    if (["taskCount", "serviceOrderCount"].includes(col.id)) {
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

                        // Apply formatting based on column
                        switch (col.id) {
                          case "fantasyName":
                            className = "font-medium text-left";
                            break;
                          case "document":
                            className = "font-mono text-left";
                            break;
                          case "taskCount":
                          case "serviceOrderCount":
                            const count = parseInt(value) || 0;
                            const badgeClass = count > 0 ? "default" : "secondary";
                            value = `<span class="badge ${badgeClass}">${count}</span>`;
                            className = "text-center";
                            break;
                          case "email":
                          case "phones":
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
    <BaseExportPopover<Customer>
      className={className}
      currentItems={currentCustomers}
      totalRecords={totalRecords}
      selectedItems={selectedCustomers}
      visibleColumns={visibleColumns}
      exportColumns={EXPORT_COLUMNS}
      defaultVisibleColumns={DEFAULT_VISIBLE_COLUMNS}
      onExport={handleExport}
      onFetchAllItems={fetchAllCustomers}
      entityName="cliente"
      entityNamePlural="clientes"
    />
  );
}
