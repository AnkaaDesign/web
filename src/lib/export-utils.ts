import { formatDate, formatDateTime } from "../utils";

interface ExportToExcelOptions {
  sheetName?: string;
  sectorHeaders?: boolean;
}

interface ExportToPDFOptions {
  title?: string;
  orientation?: "portrait" | "landscape";
  sectorHeaders?: boolean;
}

export const exportToCSV = (data: any[], filename: string) => {
  if (!data || data.length === 0) return;

  // Extract headers from the first data row
  const headers = Object.keys(data[0]).filter((key) => key !== "isSectorHeader" && key !== "sectorName");

  // Create CSV content
  const csvRows = [];

  // Add headers
  csvRows.push(headers.map((header) => `"${header}"`).join(","));

  // Add data rows
  data.forEach((row) => {
    if (row.isSectorHeader) {
      // Add sector header as a merged row
      csvRows.push(`"${row.sectorName}"` + ',""'.repeat(headers.length - 1));
    } else {
      const values = headers.map((header) => {
        const value = row[header] ?? "";
        // Escape quotes and wrap in quotes if contains comma, newline, or quotes
        const stringValue = String(value);
        if (stringValue.includes(",") || stringValue.includes("\n") || stringValue.includes('"')) {
          return `"${stringValue.replace(/"/g, '""')}"`;
        }
        return `"${stringValue}"`;
      });
      csvRows.push(values.join(","));
    }
  });

  // Create CSV content with BOM for proper UTF-8 encoding
  const csvContent = csvRows.join("\n");

  // Download CSV
  const blob = new Blob(["\ufeff" + csvContent], { type: "text/csv;charset=utf-8;" });
  const link = document.createElement("a");
  const url = URL.createObjectURL(blob);
  link.setAttribute("href", url);
  link.setAttribute("download", `${filename}_${formatDate(new Date()).replace(/\//g, "-")}.csv`);
  link.style.visibility = "hidden";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};

export const exportToExcel = (data: any[], filename: string, options: ExportToExcelOptions = {}) => {
  if (!data || data.length === 0) return;

  // Extract headers from the first data row
  const headers = Object.keys(data[0]).filter((key) => key !== "isSectorHeader" && key !== "sectorName");

  // Create tab-separated values content
  const rows = [];

  // Add headers
  rows.push(headers.join("\t"));

  // Add data rows
  data.forEach((row) => {
    if (row.isSectorHeader && options.sectorHeaders) {
      // Add sector header as a merged row
      rows.push(row.sectorName + "\t".repeat(headers.length - 1));
    } else if (!row.isSectorHeader) {
      const values = headers.map((header) => String(row[header] ?? ""));
      rows.push(values.join("\t"));
    }
  });

  const excelContent = rows.join("\n");

  // Download as .xls file with BOM for proper UTF-8 encoding
  const blob = new Blob(["\ufeff" + excelContent], { type: "application/vnd.ms-excel;charset=utf-8;" });
  const link = document.createElement("a");
  const url = URL.createObjectURL(blob);
  link.setAttribute("href", url);
  link.setAttribute("download", `${filename}_${formatDate(new Date()).replace(/\//g, "-")}.xls`);
  link.style.visibility = "hidden";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};

export const exportToPDF = (data: any[], _filename: string, options: ExportToPDFOptions = {}) => {
  if (!data || data.length === 0) return;

  const { title = "Relatório", orientation = "portrait", sectorHeaders = false } = options;

  // Extract headers from the first data row
  const headers = Object.keys(data[0]).filter((key) => key !== "isSectorHeader" && key !== "sectorName");

  // Get the logo URL (relative to the base URL)
  const logoUrl = `${window.location.origin}/logo.png`;

  // Generate HTML content
  const htmlContent = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <title>${title} - ${formatDate(new Date())}</title>
      <style>
        @page {
          size: A4 ${orientation};
          margin: 15mm;
        }

        * {
          box-sizing: border-box;
          margin: 0;
          padding: 0;
        }

        body {
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
          font-size: 11px;
          line-height: 1.4;
          color: #333;
        }

        .header {
          margin-bottom: 20px;
          padding-bottom: 10px;
          border-bottom: 2px solid #e5e7eb;
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
        }

        .header-content {
          flex: 1;
        }

        .logo {
          width: 80px;
          height: auto;
          margin-left: 20px;
        }

        h1 {
          font-size: 18px;
          margin-bottom: 5px;
        }

        .info {
          color: #6b7280;
          font-size: 10px;
        }
        
        table {
          width: 100%;
          border-collapse: collapse;
          margin-top: 10px;
          font-size: 10px;
        }
        
        th {
          background-color: #f3f4f6;
          font-weight: 600;
          padding: 8px 6px;
          border: 1px solid #e5e7eb;
          text-align: left;
        }
        
        td {
          padding: 6px;
          border: 1px solid #e5e7eb;
          vertical-align: top;
        }
        
        .sector-header {
          background-color: #e5e7eb;
          font-weight: bold;
          text-align: center;
          padding: 10px;
        }
        
        tbody tr:nth-child(even) {
          background-color: #fafafa;
        }
        
        .footer {
          margin-top: 20px;
          padding-top: 10px;
          border-top: 1px solid #e5e7eb;
          color: #6b7280;
          font-size: 9px;
          text-align: center;
        }
        
        @media print {
          body { margin: 0; }
          .header { page-break-after: avoid; }
          table { page-break-inside: auto; }
          tr { page-break-inside: avoid; page-break-after: auto; }
          thead { display: table-header-group; }
        }
      </style>
    </head>
    <body>
      <div class="header">
        <div class="header-content">
          <h1>${title}</h1>
          <div class="info">
            <p>Data: ${formatDate(new Date())}</p>
            <p>Total de registros: ${data.filter((d) => !d.isSectorHeader).length}</p>
          </div>
        </div>
        <img src="${logoUrl}" alt="Logo" class="logo" />
      </div>
      
      <table>
        <thead>
          <tr>
            ${headers.map((header) => `<th>${header}</th>`).join("")}
          </tr>
        </thead>
        <tbody>
          ${data
            .map((row) => {
              if (row.isSectorHeader && sectorHeaders) {
                return `<tr><td colspan="${headers.length}" class="sector-header">${row.sectorName}</td></tr>`;
              } else if (!row.isSectorHeader) {
                return `
                <tr>
                  ${headers.map((header) => `<td>${row[header] ?? "-"}</td>`).join("")}
                </tr>
              `;
              }
              return "";
            })
            .join("")}
        </tbody>
      </table>
      
      <div class="footer">
        <p>Relatório gerado pelo sistema Ankaa em ${formatDateTime(new Date())}</p>
      </div>
    </body>
    </html>
  `;

  // Open print window
  const printWindow = window.open("", "_blank");
  if (printWindow) {
    printWindow.document.write(htmlContent);
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
