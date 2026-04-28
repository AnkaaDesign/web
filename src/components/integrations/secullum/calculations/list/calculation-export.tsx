import { BaseExportPopover, type ExportFormat, type ExportColumn } from "@/components/ui/export-popover";
import { toast } from "@/components/ui/sonner";
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
    const fontSize = columnCount <= 8 ? "10px" : columnCount <= 14 ? "9px" : "8px";
    const headerFontSize = columnCount <= 8 ? "9px" : columnCount <= 14 ? "8px" : "7px";
    const cellPadding = columnCount <= 8 ? "5px 4px" : "3px 3px";
    const headerPadding = columnCount <= 8 ? "6px 4px" : "4px 3px";

    const periodLabel = (() => {
      if (filters.customStartDate && filters.customEndDate) {
        return `${formatDate(filters.customStartDate)} a ${formatDate(filters.customEndDate)}`;
      }
      if (filters.selectedMonth) {
        return format(filters.selectedMonth, "MMMM 'de' yyyy", { locale: ptBR });
      }
      return "Período não especificado";
    })();

    const pdfContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <title>Cálculos de Ponto - ${formatDate(new Date())}</title>
        <style>
          @page {
            size: A4;
            margin: 10mm;
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
            line-height: 1.2;
          }

          body {
            display: grid;
            grid-template-rows: auto 1fr auto;
            min-height: 100vh;
            padding: 0;
          }

          .header {
            margin-bottom: 12px;
            flex-shrink: 0;
          }

          .logo {
            width: 140px;
            height: auto;
            margin-bottom: 8px;
          }

          .header-info {
          }

          .header-title {
            font-size: 18px;
            font-weight: 700;
            color: #1f2937;
            margin-bottom: 4px;
          }

          .info {
            color: #6b7280;
            font-size: 10px;
          }

          .info p {
            margin: 1px 0;
          }

          .content-wrapper {
            flex: 1;
            overflow: auto;
            min-height: 0;
            padding-bottom: 35px;
          }

          table {
            width: 100%;
            border-collapse: collapse;
            font-size: ${fontSize};
          }

          th {
            background-color: hsl(142, 72%, 29%);
            font-weight: 600;
            color: #ffffff;
            padding: ${headerPadding};
            border: 1px solid hsl(142, 72%, 25%);
            font-size: ${headerFontSize};
            text-transform: uppercase;
            letter-spacing: 0.03em;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
            text-align: left;
          }

          td {
            padding: ${cellPadding};
            border-left: 1px solid #e5e7eb;
            border-right: 1px solid #e5e7eb;
            border-bottom: 1px solid #e5e7eb;
            border-top: none;
            vertical-align: middle;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
            font-family: 'SFMono-Regular', Consolas, 'Liberation Mono', Menlo, monospace;
            color: #374151;
          }

          tbody tr:nth-child(even) {
            background-color: #fafafa;
          }

          .text-left { text-align: left; }
          .text-center { text-align: center; }
          .text-right { text-align: right; }

          .footer {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding-top: 10px;
            border-top: 1px solid #e5e7eb;
            color: #6b7280;
            font-size: 9px;
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
            @page {
              size: A4;
              margin: 8mm;
            }

            .footer {
              position: fixed;
              bottom: 6mm;
              left: 6mm;
              right: 6mm;
              background: white;
              font-size: 7px;
            }

            .content-wrapper {
              padding-bottom: 50px;
            }
          }
        </style>
      </head>
      <body>
        <div class="header">
          <img src="/logo.png" alt="Ankaa Logo" class="logo" />
          <h1 class="header-title">Cálculos de Ponto</h1>
          <div class="header-info">
            <div class="info">
              <p><strong>Período:</strong> ${periodLabel}</p>
              <p><strong>Total de registros:</strong> ${items.length}</p>
              <p><strong>Colunas:</strong> ${columnCount}</p>
              <p><strong>Gerado em:</strong> ${formatDateTime(new Date())}</p>
            </div>
          </div>
        </div>

        <div class="content-wrapper">
          <table>
            <thead>
              <tr>
                ${columns.map((col) => `<th class="text-left">${col.label}</th>`).join("")}
              </tr>
            </thead>
            <tbody>
              ${items.map((item) => `
                <tr>
                  ${columns.map((col) => `<td class="text-left">${col.getValue(item) || "-"}</td>`).join("")}
                </tr>
              `).join("")}
            </tbody>
          </table>
        </div>

        <div class="footer">
          <div class="footer-left">
            <p>Cálculos de Ponto - Sistema Ankaa</p>
          </div>
          <div class="footer-right">
            <p><strong>Gerado em:</strong> ${formatDate(new Date())} ${new Date().toLocaleTimeString('pt-BR')}</p>
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