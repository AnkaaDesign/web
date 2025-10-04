import type { Borrow } from "../../../../types";
import { formatDate, formatDateTime } from "../../../../utils";

// Column configuration for export
export const EXPORT_COLUMNS = [
  {
    id: "id",
    label: "ID",
    getValue: (borrow: Borrow) => borrow.id,
  },
  {
    id: "item.name",
    label: "Item",
    getValue: (borrow: Borrow) => borrow.item?.name || "",
  },
  {
    id: "item.uniCode",
    label: "Código do Item",
    getValue: (borrow: Borrow) => borrow.item?.uniCode || "",
  },
  {
    id: "user.name",
    label: "Usuário",
    getValue: (borrow: Borrow) => borrow.user?.name || "",
  },
  {
    id: "user.email",
    label: "E-mail do Usuário",
    getValue: (borrow: Borrow) => borrow.user?.email || "",
  },
  {
    id: "quantity",
    label: "Quantidade",
    getValue: (borrow: Borrow) => borrow.quantity.toString(),
  },
  {
    id: "status",
    label: "Status",
    getValue: (borrow: Borrow) => (borrow.returnedAt ? "Devolvido" : "Ativo"),
  },
  {
    id: "returnedAt",
    label: "Data de Devolução",
    getValue: (borrow: Borrow) => (borrow.returnedAt ? formatDateTime(new Date(borrow.returnedAt)) : "-"),
  },
  {
    id: "createdAt",
    label: "Data de Empréstimo",
    getValue: (borrow: Borrow) => formatDateTime(new Date(borrow.createdAt)),
  },
  {
    id: "updatedAt",
    label: "Última Atualização",
    getValue: (borrow: Borrow) => formatDateTime(new Date(borrow.updatedAt)),
  },
];

// Default visible columns for export
export const DEFAULT_VISIBLE_COLUMNS = new Set(["item.name", "user.name", "quantity", "status", "createdAt"]);

export const exportToCSV = async (borrows: Borrow[], visibleColumns: Set<string>) => {
  // Get only visible columns
  const visibleExportColumns = EXPORT_COLUMNS.filter((col) => visibleColumns.has(col.id));

  // CSV headers from visible columns
  const headers = visibleExportColumns.map((col) => col.label);

  // Convert borrows to CSV rows with only visible columns
  const rows = borrows.map((borrow) =>
    visibleExportColumns.map((col) => {
      const value = col.getValue(borrow);
      // Escape quotes and wrap in quotes if contains comma, newline, or quotes
      if (value.includes(",") || value.includes("\n") || value.includes('"')) {
        return `"${value.replace(/"/g, '""')}"`;
      }
      return value;
    }),
  );

  // Create CSV content with BOM for proper UTF-8 encoding in Excel
  const csvContent = [headers.join(","), ...rows.map((row) => row.join(","))].join("\n");

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
  URL.revokeObjectURL(url);
};

export const exportToExcel = async (borrows: Borrow[], visibleColumns: Set<string>) => {
  // Get only visible columns
  const visibleExportColumns = EXPORT_COLUMNS.filter((col) => visibleColumns.has(col.id));

  // Headers from visible columns
  const headers = visibleExportColumns.map((col) => col.label);

  // Convert borrows to rows with only visible columns
  const rows = borrows.map((borrow) => visibleExportColumns.map((col) => col.getValue(borrow)));

  // Create tab-separated values for Excel
  const excelContent = [headers.join("\t"), ...rows.map((row) => row.join("\t"))].join("\n");

  // Download as .xls file with BOM for proper UTF-8 encoding
  const blob = new Blob(["\ufeff" + excelContent], { type: "application/vnd.ms-excel;charset=utf-8;" });
  const link = document.createElement("a");
  const url = URL.createObjectURL(blob);
  link.setAttribute("href", url);
  link.setAttribute("download", `emprestimos_${formatDate(new Date()).replace(/\//g, "-")}.xls`);
  link.style.visibility = "hidden";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};

export const generatePDFContent = (borrows: Borrow[], visibleColumns: Set<string>) => {
  // Get only visible columns
  const visibleExportColumns = EXPORT_COLUMNS.filter((col) => visibleColumns.has(col.id));

  // Calculate responsive font sizes based on column count
  const columnCount = visibleExportColumns.length;
  const fontSize = columnCount <= 5 ? "12px" : columnCount <= 8 ? "10px" : "8px";
  const headerFontSize = columnCount <= 5 ? "11px" : columnCount <= 8 ? "9px" : "7px";
  const cellPadding = columnCount <= 5 ? "8px 6px" : columnCount <= 8 ? "6px 4px" : "4px 3px";
  const headerPadding = columnCount <= 5 ? "10px 6px" : columnCount <= 8 ? "8px 4px" : "6px 3px";

  return `
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
          width: ${columnCount <= 5 ? "100px" : "80px"};
          height: auto;
          margin-right: 15px;
        }
        
        .header-info {
          flex: 1;
        }
        
        .info {
          color: #6b7280;
          font-size: ${columnCount <= 5 ? "12px" : "10px"};
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
          font-size: ${columnCount <= 5 ? "10px" : "8px"};
        }
        
        .font-medium { font-weight: 500; }
        .text-muted { color: #6b7280; }
        
        /* Badge styles */
        .badge {
          display: inline-block;
          padding: 1px 6px;
          border-radius: 3px;
          font-size: ${columnCount <= 5 ? "9px" : "7px"};
          font-weight: 500;
          text-transform: uppercase;
          letter-spacing: 0.03em;
        }
        
        .badge.active {
          background-color: #dbeafe;
          color: #1d4ed8;
        }
        
        .badge.returned {
          background-color: #d1fae5;
          color: #065f46;
        }
        
        .footer {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding-top: 15px;
          border-top: 1px solid #e5e7eb;
          color: #6b7280;
          font-size: ${columnCount <= 5 ? "10px" : "8px"};
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
        ${visibleExportColumns
          .map((col, index) => {
            let width = "100px"; // default
            switch (col.id) {
              case "id":
                width = "80px";
                break;
              case "item.name":
                width = columnCount <= 5 ? "200px" : "150px";
                break;
              case "item.uniCode":
                width = "100px";
                break;
              case "user.name":
                width = columnCount <= 5 ? "150px" : "120px";
                break;
              case "user.email":
                width = "150px";
                break;
              case "quantity":
                width = "80px";
                break;
              case "status":
                width = "100px";
                break;
              case "returnedAt":
                width = "120px";
                break;
              case "createdAt":
                width = "120px";
                break;
              case "updatedAt":
                width = "120px";
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
            width: ${columnCount <= 5 ? "80px" : "60px"}; 
          }
          
          table { 
            font-size: ${columnCount <= 5 ? "9px" : "7px"};
            page-break-inside: auto;
          }
          
          th { 
            padding: ${columnCount <= 5 ? "6px 4px" : "4px 2px"};
            font-size: ${columnCount <= 5 ? "8px" : "6px"};
          }
          
          td { 
            padding: ${columnCount <= 5 ? "4px 3px" : "3px 2px"};
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
            font-size: ${columnCount <= 5 ? "8px" : "6px"};
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
            <p><strong>Total de empréstimos:</strong> ${borrows.length}</p>
            <p><strong>Empréstimos ativos:</strong> ${borrows.filter((b) => !b.returnedAt).length}</p>
            <p><strong>Empréstimos devolvidos:</strong> ${borrows.filter((b) => b.returnedAt).length}</p>
          </div>
        </div>
      </div>
      
      <div class="content-wrapper">
        <table>
          <thead>
            <tr>
              ${visibleExportColumns
                .map((col) => {
                  // Get column alignment
                  let alignment = "text-left";
                  if (["quantity"].includes(col.id)) {
                    alignment = "text-center";
                  }
                  return `<th class="${alignment}">${col.label}</th>`;
                })
                .join("")}
            </tr>
          </thead>
          <tbody>
            ${borrows
              .map((borrow) => {
                return `
                <tr>
                  ${visibleExportColumns
                    .map((col) => {
                      let value = col.getValue(borrow) || "-";
                      let className = "";

                      // Apply formatting based on column
                      switch (col.id) {
                        case "id":
                          className = "font-mono text-left";
                          break;

                        case "item.name":
                        case "user.name":
                          className = "font-medium text-left";
                          break;

                        case "item.uniCode":
                          className = "font-mono text-left";
                          break;

                        case "user.email":
                          className = "text-left text-muted";
                          break;

                        case "quantity":
                          className = "text-center font-medium";
                          break;

                        case "status":
                          const statusClass = borrow.returnedAt ? "returned" : "active";
                          value = `<span class="badge ${statusClass}">${value}</span>`;
                          className = "text-left";
                          break;

                        case "returnedAt":
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
};

export const exportToPDF = async (borrows: Borrow[], visibleColumns: Set<string>) => {
  const pdfContent = generatePDFContent(borrows, visibleColumns);

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
