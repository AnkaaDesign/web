import { BaseExportPopover, type ExportFormat, type ExportColumn } from "@/components/ui/export-popover";
import { toast } from "sonner";
import { formatCurrency, formatDate } from "../../../../utils";
import { formatCPF } from "../../../../utils/formatters";

// Bonus row interface matching the list page
interface BonusRow {
  id: string;
  userId: string;
  userName: string;
  userEmail?: string;
  userCpf?: string;
  payrollNumber?: string;
  position?: { id: string; name: string; remuneration?: number; bonifiable?: boolean };
  sector?: { id: string; name: string };
  performanceLevel: number;
  status: string;
  bonusId?: string;
  bonusAmount: number;
  tasksCompleted: number;
  averageTasks: number;
  totalWeightedTasks: number;
  bonusStatus: 'live' | 'saved';
  totalDiscounts: number;
  netBonus: number;
  monthLabel?: string;
  month: number;
  year: number;
}

// Filters interface
interface BonusFiltersData {
  year?: number;
  months?: string[];
  performanceLevels?: number[];
  sectorIds?: string[];
  positionIds?: string[];
  userIds?: string[];
  excludeUserIds?: string[];
}

interface BonusExportProps {
  className?: string;
  filters?: BonusFiltersData;
  currentPageData?: BonusRow[];
  totalRecords?: number;
  selectedItems?: Set<string>;
  visibleColumns?: Set<string>;
}

// Column configuration for export
const EXPORT_COLUMNS: ExportColumn<BonusRow>[] = [
  {
    id: "payrollNumber",
    label: "Nº Folha",
    getValue: (row: BonusRow) => row.payrollNumber || "-"
  },
  {
    id: "user.name",
    label: "Nome",
    getValue: (row: BonusRow) => row.userName || ""
  },
  {
    id: "user.cpf",
    label: "CPF",
    getValue: (row: BonusRow) => row.userCpf ? formatCPF(row.userCpf) : "-"
  },
  {
    id: "position.name",
    label: "Cargo",
    getValue: (row: BonusRow) => row.position?.name || "-"
  },
  {
    id: "sector.name",
    label: "Setor",
    getValue: (row: BonusRow) => row.sector?.name || "-"
  },
  {
    id: "performanceLevel",
    label: "Performance",
    getValue: (row: BonusRow) => row.performanceLevel?.toString() || "0"
  },
  {
    id: "averageTasks",
    label: "Média",
    getValue: (row: BonusRow) => {
      const isEligible = row.position?.bonifiable && row.performanceLevel > 0;
      return isEligible ? row.averageTasks.toFixed(1) : "-";
    }
  },
  {
    id: "bonus",
    label: "Bônus",
    getValue: (row: BonusRow) => {
      const isEligible = row.position?.bonifiable && row.performanceLevel > 0;
      return isEligible ? formatCurrency(row.bonusAmount) : "Não elegível";
    }
  },
  {
    id: "netBonus",
    label: "Líquido",
    getValue: (row: BonusRow) => formatCurrency(row.netBonus)
  },
];

// Default visible columns
const DEFAULT_VISIBLE_COLUMNS = new Set([
  "payrollNumber",
  "user.name",
  "position.name",
  "performanceLevel",
  "averageTasks",
  "bonus",
  "netBonus",
]);

export function BonusExport({
  className,
  filters = {},
  currentPageData = [],
  totalRecords = 0,
  selectedItems,
  visibleColumns
}: BonusExportProps) {

  // Calculate totals from current data
  const calculateTotals = (data: BonusRow[]) => {
    const totalBonus = data.reduce((sum, row) => sum + (row.bonusAmount || 0), 0);
    const totalNet = data.reduce((sum, row) => sum + (row.netBonus || 0), 0);
    const eligibleUsers = data.filter(row => row.position?.bonifiable && row.performanceLevel > 0);

    // Get weighted tasks from first eligible user (they share the same pool)
    const totalWeightedTasks = eligibleUsers.length > 0 ? eligibleUsers[0]?.totalWeightedTasks || 0 : 0;
    const avgTasks = eligibleUsers.length > 0 ? eligibleUsers[0]?.averageTasks || 0 : 0;

    return {
      totalBonus,
      totalNet,
      totalWeightedTasks,
      avgTasks,
      eligibleCount: eligibleUsers.length,
      totalCount: data.length
    };
  };

  // Get period label from filters
  const getPeriodLabel = () => {
    if (!filters.year || !filters.months || filters.months.length === 0) {
      return "Todos os períodos";
    }

    if (filters.months.length === 1) {
      const month = parseInt(filters.months[0]);
      const monthName = new Date(filters.year, month - 1).toLocaleDateString('pt-BR', { month: 'long' });
      return `${monthName.charAt(0).toUpperCase() + monthName.slice(1)} de ${filters.year}`;
    }

    return `${filters.months.length} meses de ${filters.year}`;
  };

  // Export handlers
  const handleExport = async (format: ExportFormat, items: BonusRow[], columns: ExportColumn<BonusRow>[]) => {
    const totals = calculateTotals(items);

    switch (format) {
      case "csv":
        await exportToCSV(items, columns, totals);
        break;
      case "excel":
        await exportToExcel(items, columns, totals);
        break;
      case "pdf":
        await exportToPDF(items, columns, totals);
        break;
    }

    toast.success(`Exportação ${format.toUpperCase()} concluída com sucesso!`);
  };

  const exportToCSV = async (
    items: BonusRow[],
    columns: ExportColumn<BonusRow>[],
    totals: ReturnType<typeof calculateTotals>
  ) => {
    const headers = columns.map((col) => col.label);
    const rows = items.map((item) => columns.map((col) => col.getValue(item)));

    // Add total row
    const totalRow = columns.map((col) => {
      if (col.id === "user.name") return "TOTAL";
      if (col.id === "bonus") return formatCurrency(totals.totalBonus);
      if (col.id === "netBonus") return formatCurrency(totals.totalNet);
      return "";
    });
    rows.push(totalRow);

    const csvContent = [
      headers.join(","),
      ...rows.map((row) => row.map((cell) => `"${cell}"`).join(","))
    ].join("\n");

    const blob = new Blob(["\ufeff" + csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", `bonus-${formatDate(new Date()).replace(/\//g, "-")}.csv`);
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const exportToExcel = async (
    items: BonusRow[],
    columns: ExportColumn<BonusRow>[],
    totals: ReturnType<typeof calculateTotals>
  ) => {
    const headers = columns.map((col) => col.label);
    const rows = items.map((item) => columns.map((col) => col.getValue(item)));

    // Add total row
    const totalRow = columns.map((col) => {
      if (col.id === "user.name") return "TOTAL";
      if (col.id === "bonus") return formatCurrency(totals.totalBonus);
      if (col.id === "netBonus") return formatCurrency(totals.totalNet);
      return "";
    });
    rows.push(totalRow);

    const excelContent = [headers.join("\t"), ...rows.map((row) => row.join("\t"))].join("\n");

    const blob = new Blob(["\ufeff" + excelContent], { type: "application/vnd.ms-excel;charset=utf-8;" });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", `bonus-${formatDate(new Date()).replace(/\//g, "-")}.xls`);
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const exportToPDF = async (
    items: BonusRow[],
    columns: ExportColumn<BonusRow>[],
    totals: ReturnType<typeof calculateTotals>
  ) => {
    const periodLabel = getPeriodLabel();
    const fontSize = "12px";
    const headerFontSize = "11px";
    const cellPadding = "8px 6px";
    const headerPadding = "10px 6px";

    // A4 portrait PDF matching bonus simulation format
    const pdfContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <title>Bônus - ${formatDate(new Date())}</title>
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
            padding-top: 10px;
          }

          .logo {
            width: 100px;
            height: auto;
            margin-right: 15px;
          }

          .header-info {
            flex: 1;
          }

          .info {
            color: #6b7280;
            font-size: 12px;
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
            font-size: ${fontSize};
          }

          th {
            background-color: #f9fafb;
            font-weight: 600;
            color: #374151;
            padding: ${headerPadding};
            border-bottom: 1px solid #e5e7eb;
            border-right: 1px solid #e5e7eb;
            font-size: ${headerFontSize};
            text-transform: uppercase;
            letter-spacing: 0.03em;
          }

          th:last-child {
            border-right: none;
          }

          td {
            padding: ${cellPadding};
            border-bottom: 1px solid #f3f4f6;
            border-right: 1px solid #f3f4f6;
            vertical-align: top;
          }

          td:last-child {
            border-right: none;
          }

          tbody tr:first-child td {
            border-top: none;
          }

          tbody tr:nth-child(even) {
            background-color: #fafafa;
          }

          tbody tr:last-child {
            font-weight: 700;
            background-color: #f0fdf4;
          }

          .text-left { text-align: left; }
          .text-center { text-align: center; }
          .text-right { text-align: right; }

          .font-medium { font-weight: 500; }
          .font-semibold { font-weight: 600; }

          .footer {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding-top: 15px;
            border-top: 1px solid #e5e7eb;
            color: #6b7280;
            font-size: 10px;
            background: white;
          }

          @media print {
            .footer {
              position: fixed;
              bottom: 15px;
              left: 12mm;
              right: 12mm;
            }
          }
        </style>
      </head>
      <body>
        <div class="header">
          <img src="/logo.png" alt="Logo" class="logo" />
          <div class="header-info">
            <h1 style="font-size: 20px; margin-bottom: 8px;">Relatório de Bonificação</h1>
            <div class="info">
              <p><strong>Período:</strong> ${periodLabel}</p>
              <p><strong>Tarefas Ponderadas:</strong> ${totals.totalWeightedTasks.toFixed(1)}</p>
              <p><strong>Total de colaboradores:</strong> ${totals.totalCount}</p>
              <p><strong>Média por colaborador:</strong> ${totals.avgTasks.toFixed(1)}</p>
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
                  ${columns.map((col) => `<td class="text-left">${col.getValue(item)}</td>`).join("")}
                </tr>
              `).join("")}
              <tr>
                ${columns.map((col) => {
                  if (col.id === "user.name") return `<td class="text-left">TOTAL</td>`;
                  if (col.id === "bonus") return `<td class="text-left">${formatCurrency(totals.totalBonus)}</td>`;
                  if (col.id === "netBonus") return `<td class="text-left">${formatCurrency(totals.totalNet)}</td>`;
                  return `<td></td>`;
                }).join("")}
              </tr>
            </tbody>
          </table>
        </div>

        <div class="footer">
          <div>
            <p>Relatório gerado pelo sistema Ankaa</p>
          </div>
          <div>
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

  // Filter columns based on visibility
  const effectiveVisibleColumns = visibleColumns || DEFAULT_VISIBLE_COLUMNS;
  const filteredColumns = EXPORT_COLUMNS.filter((col) => effectiveVisibleColumns.has(col.id));

  return (
    <BaseExportPopover<BonusRow>
      className={className}
      currentItems={currentPageData}
      totalRecords={totalRecords}
      selectedItems={selectedItems}
      visibleColumns={effectiveVisibleColumns}
      exportColumns={filteredColumns}
      defaultVisibleColumns={DEFAULT_VISIBLE_COLUMNS}
      onExport={handleExport}
      entityName="bônus"
      entityNamePlural="bônus"
    />
  );
}
