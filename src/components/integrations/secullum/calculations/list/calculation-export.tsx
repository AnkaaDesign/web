import { BaseExportPopover, type ExportFormat, type ExportColumn } from "@/components/ui/export-popover";
import { toast } from "sonner";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { formatDate, formatDateTime } from "../../../../../utils";

interface CalculationRow {
  id: string;
  date: string;
  entrada1?: string;
  saida1?: string;
  entrada2?: string;
  saida2?: string;
  entrada3?: string;
  saida3?: string;
  normais?: string;
  faltas?: string;
  ex50?: string;
  ex100?: string;
  ex150?: string;
  dsr?: string;
  dsrDeb?: string;
  not?: string;
  exNot?: string;
  ajuste?: string;
  abono2?: string;
  abono3?: string;
  abono4?: string;
  atras?: string;
  adian?: string;
  folga?: string;
  carga?: string;
  justPa?: string;
  tPlusMinus?: string;
  exInt?: string;
  notTot?: string;
  refeicao?: string;
}

interface CalculationExportProps {
  className?: string;
  filters: any;
  currentItems: CalculationRow[];
  totalRecords: number;
  visibleColumns: Set<string>;
  selectedItems?: Set<string>;
}

// Column configuration for export
const EXPORT_COLUMNS: ExportColumn<CalculationRow>[] = [
  { id: "date", label: "Data", getValue: (row: CalculationRow) => row.date || "" },
  { id: "entrada1", label: "Entrada 1", getValue: (row: CalculationRow) => row.entrada1 || "" },
  { id: "saida1", label: "Saída 1", getValue: (row: CalculationRow) => row.saida1 || "" },
  { id: "entrada2", label: "Entrada 2", getValue: (row: CalculationRow) => row.entrada2 || "" },
  { id: "saida2", label: "Saída 2", getValue: (row: CalculationRow) => row.saida2 || "" },
  { id: "entrada3", label: "Entrada 3", getValue: (row: CalculationRow) => row.entrada3 || "" },
  { id: "saida3", label: "Saída 3", getValue: (row: CalculationRow) => row.saida3 || "" },
  { id: "normais", label: "Normal", getValue: (row: CalculationRow) => row.normais || "" },
  { id: "faltas", label: "Faltas", getValue: (row: CalculationRow) => row.faltas || "" },
  { id: "ex50", label: "Ex50%", getValue: (row: CalculationRow) => row.ex50 || "" },
  { id: "ex100", label: "Ex100%", getValue: (row: CalculationRow) => row.ex100 || "" },
  { id: "ex150", label: "Ex150%", getValue: (row: CalculationRow) => row.ex150 || "" },
  { id: "dsr", label: "DSR", getValue: (row: CalculationRow) => row.dsr || "" },
  { id: "dsrDeb", label: "DSR.Deb", getValue: (row: CalculationRow) => row.dsrDeb || "" },
  { id: "not", label: "Not.", getValue: (row: CalculationRow) => row.not || "" },
  { id: "exNot", label: "ExNot", getValue: (row: CalculationRow) => row.exNot || "" },
  { id: "ajuste", label: "Ajuste", getValue: (row: CalculationRow) => row.ajuste || "" },
  { id: "abono2", label: "Abono2", getValue: (row: CalculationRow) => row.abono2 || "" },
  { id: "abono3", label: "Abono3", getValue: (row: CalculationRow) => row.abono3 || "" },
  { id: "abono4", label: "Abono4", getValue: (row: CalculationRow) => row.abono4 || "" },
  { id: "atras", label: "Atraso", getValue: (row: CalculationRow) => row.atras || "" },
  { id: "adian", label: "Adiant.", getValue: (row: CalculationRow) => row.adian || "" },
  { id: "folga", label: "Folga", getValue: (row: CalculationRow) => row.folga || "" },
  { id: "carga", label: "Carga", getValue: (row: CalculationRow) => row.carga || "" },
  { id: "justPa", label: "JustPa.", getValue: (row: CalculationRow) => row.justPa || "" },
  { id: "tPlusMinus", label: "T+/-", getValue: (row: CalculationRow) => row.tPlusMinus || "" },
  { id: "exInt", label: "ExInt", getValue: (row: CalculationRow) => row.exInt || "" },
  { id: "notTot", label: "Not.Tot.", getValue: (row: CalculationRow) => row.notTot || "" },
  { id: "refeicao", label: "Refeição", getValue: (row: CalculationRow) => row.refeicao || "" },
];

// Default columns if none are specified
const DEFAULT_VISIBLE_COLUMNS = new Set(["date", "entrada1", "saida1", "entrada2", "saida2", "normais", "ex50", "ex100", "dsr", "ajuste"]);

export function CalculationExport({
  className,
  filters,
  currentItems,
  totalRecords,
  visibleColumns,
  selectedItems
}: CalculationExportProps) {
  const handleExport = async (format: ExportFormat, items: CalculationRow[], columns: ExportColumn<CalculationRow>[]) => {
    // Clean up the values before exporting
    const cleanedItems = items.map(item => ({
      ...item,
      ...Object.keys(item).reduce((acc, key) => {
        const value = (item as any)[key];
        if (!value || value === "" || value === "null") {
          (acc as any)[key] = "-";
        } else if (typeof value === "string" && value.includes("Day Off")) {
          (acc as any)[key] = "Folga";
        } else {
          (acc as any)[key] = value;
        }
        return acc;
      }, {})
    }));

    // Generate export based on format
    switch (format) {
      case "csv":
        await exportToCSV(cleanedItems, columns);
        break;
      case "excel":
        await exportToExcel(cleanedItems, columns);
        break;
      case "pdf":
        await exportToPDF(cleanedItems, columns);
        break;
    }

    toast.success(`Exportação ${format.toUpperCase()} concluída com sucesso!`);
  };

  const fetchAllItems = async (): Promise<CalculationRow[]> => {
    // For calculations, we only have current page data
    // Could be enhanced later to fetch all data from Secullum API
    return currentItems;
  };

  const exportToCSV = async (items: CalculationRow[], columns: ExportColumn<CalculationRow>[]) => {
    // CSV headers from visible columns
    const headers = columns.map((col) => col.label);

    // Convert items to CSV rows with only visible columns
    const rows = items.map((item) => columns.map((col) => col.getValue(item)));

    // Create CSV content
    const csvContent = [headers, ...rows].map((row) =>
      row.map((field) => `"${String(field).replace(/"/g, '""')}"`).join(",")
    ).join("\n");

    // Create and download the CSV
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);

    const timestamp = format(new Date(), "yyyy-MM-dd_HH-mm-ss");
    const monthLabel = filters.selectedMonth
      ? format(filters.selectedMonth, "MMMM-yyyy", { locale: ptBR })
      : "sem-periodo";

    link.setAttribute("download", `calculos-secullum_${monthLabel}_${timestamp}.csv`);
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const exportToExcel = async (items: CalculationRow[], columns: ExportColumn<CalculationRow>[]) => {
    // For now, just export as CSV since Excel requires additional libraries
    await exportToCSV(items, columns);
    toast.info("Formato Excel não disponível - arquivo exportado como CSV");
  };

  const exportToPDF = async (items: CalculationRow[], columns: ExportColumn<CalculationRow>[]) => {
    const columnCount = columns.length;

    // Dynamic font sizes and padding based on column count
    const fontSize = columnCount <= 6 ? "11px" : columnCount <= 10 ? "9px" : "8px";
    const headerFontSize = columnCount <= 6 ? "10px" : columnCount <= 10 ? "8px" : "7px";
    const cellPadding = columnCount <= 6 ? "6px 4px" : columnCount <= 10 ? "4px 3px" : "3px 2px";
    const headerPadding = columnCount <= 6 ? "8px 6px" : columnCount <= 10 ? "6px 4px" : "4px 3px";

    const monthLabel = filters.selectedMonth
      ? format(filters.selectedMonth, "MMMM 'de' yyyy", { locale: ptBR })
      : "Período não especificado";

    const pdfContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <title>Cálculos de Ponto - ${formatDate(new Date())}</title>
        <style>
          @page {
            size: A4 landscape;
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
            font-family: 'SFMono-Regular', Consolas, 'Liberation Mono', Menlo, monospace;
            font-size: ${columnCount <= 6 ? "9px" : "7px"};
          }

          tbody tr:nth-child(even) {
            background-color: #fafafa;
          }

          .text-center { text-align: center; }
          .font-medium { font-weight: 500; }

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
        </style>
      </head>
      <body>
        <div class="header">
          <img src="/logo.png" alt="Ankaa Logo" class="logo" />
          <div class="header-info">
            <div class="info">
              <p><strong>Cálculos de Ponto - ${monthLabel}</strong></p>
              <p><strong>Total de registros:</strong> ${items.length}</p>
            </div>
          </div>
        </div>

        <div class="content-wrapper">
          <table>
            <thead>
              <tr>
                ${columns.map((col) => `<th class="text-center">${col.label}</th>`).join("")}
              </tr>
            </thead>
            <tbody>
              ${items
                .map((item) => {
                  return `
                  <tr>
                    ${columns
                      .map((col) => {
                        const value = col.getValue(item) || "-";
                        return `<td class="text-center">${value}</td>`;
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
    <BaseExportPopover<CalculationRow>
      className={className}
      currentItems={currentItems}
      totalRecords={totalRecords}
      selectedItems={selectedItems}
      visibleColumns={visibleColumns}
      exportColumns={EXPORT_COLUMNS}
      defaultVisibleColumns={DEFAULT_VISIBLE_COLUMNS}
      onExport={handleExport}
      onFetchAllItems={fetchAllItems}
      entityName="cálculo"
      entityNamePlural="cálculos"
    />
  );
}