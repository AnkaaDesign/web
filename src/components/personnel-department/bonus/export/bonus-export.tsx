import { BaseExportPopover, type ExportFormat, type ExportColumn } from "@/components/ui/export-popover";
import { toast } from "@/components/ui/sonner";
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
  baseBonus?: number;
  tasksCompleted: number;
  averageTasks: number;
  totalWeightedTasks: number;
  totalCollaborators?: number;
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

// Column configuration for export — must mirror BonusTableComponent column keys/labels/values
const EXPORT_COLUMNS: ExportColumn<BonusRow>[] = [
  {
    id: "month",
    label: "Período",
    getValue: (row: BonusRow) => row.monthLabel || "-"
  },
  {
    id: "payrollNumber",
    label: "Nº Folha",
    getValue: (row: BonusRow) => row.payrollNumber || "-"
  },
  {
    id: "user.name",
    label: "Colaborador",
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
    label: "Desempenho",
    getValue: (row: BonusRow) => row.performanceLevel?.toString() || "0"
  },
  {
    id: "tasksCompleted",
    label: "Tarefas",
    getValue: (row: BonusRow) => (row.tasksCompleted ?? 0).toString()
  },
  {
    id: "totalWeightedTasks",
    label: "Tarefas Ponderadas",
    getValue: (row: BonusRow) => (row.totalWeightedTasks ?? 0).toFixed(1)
  },
  {
    id: "totalCollaborators",
    label: "Colaboradores",
    getValue: (row: BonusRow) => (row.totalCollaborators ?? 0).toString()
  },
  {
    id: "averageTasks",
    label: "Média",
    getValue: (row: BonusRow) => {
      const isEligible = row.position?.bonifiable && row.performanceLevel > 0;
      return isEligible ? row.averageTasks.toFixed(2) : "-";
    }
  },
  {
    id: "bonus",
    label: "Bônus Bruto",
    getValue: (row: BonusRow) => {
      const isEligible = row.position?.bonifiable && row.performanceLevel > 0;
      return isEligible ? formatCurrency(row.baseBonus ?? row.bonusAmount) : "Não elegível";
    }
  },
  {
    id: "totalDiscounts",
    label: "Ajustes",
    getValue: (row: BonusRow) => {
      if (row.totalDiscounts === 0) return "R$ 0,00";
      const prefix = row.totalDiscounts > 0 ? "+" : "-";
      return `${prefix}${formatCurrency(Math.abs(row.totalDiscounts))}`;
    }
  },
  {
    id: "netBonus",
    label: "Bônus Líquido",
    getValue: (row: BonusRow) => formatCurrency(row.netBonus)
  },
];

// Default visible columns — matches BonusListPage default visible columns
const DEFAULT_VISIBLE_COLUMNS = new Set([
  "user.name",
  "position.name",
  "performanceLevel",
  "totalWeightedTasks",
  "totalCollaborators",
  "averageTasks",
  "bonus",
  "totalDiscounts",
  "netBonus",
]);

// Relative column widths for the PDF report. Without these the browser
// auto-sizes columns based on content, which lets long names ("Pedro
// Antônio de Oliveira") and long headers ("DESEMPENHO", "COLABORADORES")
// hog space and push currency columns off the right edge. Used together
// with `table-layout: fixed` so the widths are honored. Values are
// relative weights — they're rescaled to the visible column set.
const COLUMN_WIDTH_WEIGHTS: Record<string, number> = {
  "month": 9,
  "payrollNumber": 7,
  "user.name": 18,
  "user.cpf": 11,
  "position.name": 8,
  "sector.name": 11,
  "performanceLevel": 7,
  "tasksCompleted": 7,
  "totalWeightedTasks": 8,
  "totalCollaborators": 7,
  "averageTasks": 7,
  "bonus": 11,
  "totalDiscounts": 11,
  "netBonus": 12,
};

// Currency columns right-align so values like "R$ 1.234,56" line up by
// decimal. Plain count/score columns (Desempenho, Tarefas, Colaboradores,
// Média) stay left-aligned to match the in-app table style.
const NUMERIC_COLUMN_IDS = new Set([
  "bonus",
  "totalDiscounts",
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
    const totalBaseBonus = data.reduce((sum, row) => sum + (row.baseBonus ?? row.bonusAmount ?? 0), 0);
    const totalNet = data.reduce((sum, row) => sum + (row.netBonus || 0), 0);
    const totalDiscounts = data.reduce((sum, row) => sum + (row.totalDiscounts || 0), 0);
    const eligibleUsers = data.filter(row => row.position?.bonifiable && row.performanceLevel > 0);

    // Get weighted tasks from first eligible user (they share the same pool)
    const totalWeightedTasks = eligibleUsers.length > 0 ? eligibleUsers[0]?.totalWeightedTasks || 0 : 0;
    const avgTasks = eligibleUsers.length > 0 ? eligibleUsers[0]?.averageTasks || 0 : 0;

    return {
      totalBaseBonus,
      totalNet,
      totalDiscounts,
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
      if (col.id === "bonus") return formatCurrency(totals.totalBaseBonus);
      if (col.id === "totalDiscounts") {
        if (totals.totalDiscounts === 0) return "R$ 0,00";
        const prefix = totals.totalDiscounts > 0 ? "+" : "-";
        return `${prefix}${formatCurrency(Math.abs(totals.totalDiscounts))}`;
      }
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
      if (col.id === "bonus") return formatCurrency(totals.totalBaseBonus);
      if (col.id === "totalDiscounts") {
        if (totals.totalDiscounts === 0) return "R$ 0,00";
        const prefix = totals.totalDiscounts > 0 ? "+" : "-";
        return `${prefix}${formatCurrency(Math.abs(totals.totalDiscounts))}`;
      }
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
    const fontSize = "11px";
    const headerFontSize = "10px";
    const cellPadding = "7px 6px";
    const headerPadding = "9px 6px";

    // Rescale the static weights to 100% across only the visible columns.
    const totalWeight = columns.reduce(
      (sum, col) => sum + (COLUMN_WIDTH_WEIGHTS[col.id] ?? 9),
      0,
    );
    const colWidthPct = (id: string) =>
      `${(((COLUMN_WIDTH_WEIGHTS[id] ?? 9) / totalWeight) * 100).toFixed(3)}%`;
    const cellAlignClass = (id: string) =>
      NUMERIC_COLUMN_IDS.has(id) ? "text-right" : "text-left";

    // A4 portrait PDF matching task history format
    const pdfContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <title>Bônus - ${formatDate(new Date())}</title>
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
            table-layout: fixed;
          }

          th {
            background-color: #f9fafb;
            font-weight: 600;
            color: #374151;
            padding: ${headerPadding};
            border: 1px solid #e5e7eb;
            border-bottom: 1px solid #d1d5db;
            font-size: ${headerFontSize};
            text-transform: uppercase;
            letter-spacing: 0.03em;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
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
          <h1 class="header-title">Relatório de Bonificação</h1>
          <div class="header-info">
            <div class="info">
              <p><strong>Período:</strong> ${periodLabel}</p>
              <p><strong>Tarefas Ponderadas:</strong> ${totals.totalWeightedTasks.toFixed(1)}</p>
              <p><strong>Total de colaboradores:</strong> ${totals.totalCount}</p>
              <p><strong>Média por colaborador:</strong> ${totals.avgTasks.toFixed(2)}</p>
            </div>
          </div>
        </div>

        <div class="content-wrapper">
          <table>
            <colgroup>
              ${columns.map((col) => `<col style="width: ${colWidthPct(col.id)};" />`).join("")}
            </colgroup>
            <thead>
              <tr>
                ${columns
                  .map((col) => `<th class="${cellAlignClass(col.id)}">${col.label}</th>`)
                  .join("")}
              </tr>
            </thead>
            <tbody>
              ${items.map((item) => `
                <tr>
                  ${columns
                    .map(
                      (col) =>
                        `<td class="${cellAlignClass(col.id)}">${col.getValue(item)}</td>`,
                    )
                    .join("")}
                </tr>
              `).join("")}
              <tr>
                ${columns.map((col) => {
                  const align = cellAlignClass(col.id);
                  if (col.id === "user.name") return `<td class="text-left">TOTAL</td>`;
                  if (col.id === "bonus") return `<td class="${align}">${formatCurrency(totals.totalBaseBonus)}</td>`;
                  if (col.id === "totalDiscounts") {
                    if (totals.totalDiscounts === 0) return `<td class="${align}">R$ 0,00</td>`;
                    const prefix = totals.totalDiscounts > 0 ? "+" : "-";
                    return `<td class="${align}">${prefix}${formatCurrency(Math.abs(totals.totalDiscounts))}</td>`;
                  }
                  if (col.id === "netBonus") return `<td class="${align}">${formatCurrency(totals.totalNet)}</td>`;
                  return `<td></td>`;
                }).join("")}
              </tr>
            </tbody>
          </table>
        </div>

        <div class="footer">
          <div class="footer-left">
            <p>Relatório de Bonificação - Sistema Ankaa</p>
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
