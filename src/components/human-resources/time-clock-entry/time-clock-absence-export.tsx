import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

import { BaseExportPopover, type ExportFormat, type ExportColumn } from "@/components/ui/export-popover";
import { toast } from "@/components/ui/sonner";
import { COMPANY_INFO, BRAND_COLORS } from "@/config/company";
import { formatDate } from "@/utils";
import type { SecullumAbsenceDayRow } from "@/types";
import { getJustificativaMeta } from "@/constants";

export interface AbsenceExportRow {
  id: string;
  date: string; // ISO YYYY-MM-DD
  userName: string;
  sectorName: string;
  justificativaId: number;
  justificativaLabel: string;
  faltas: string;
  motivo: string;
  isPartialDay: boolean;
}

export function toAbsenceExportRow(r: SecullumAbsenceDayRow): AbsenceExportRow {
  const meta = getJustificativaMeta(r.JustificativaId);
  return {
    id: `${r.userId}-${r.date}-${r.JustificativaId}`,
    date: r.date,
    userName: r.userName,
    sectorName: r.sectorName ?? "",
    justificativaId: r.JustificativaId,
    justificativaLabel: meta?.label ?? r.JustificativaDescricao ?? `#${r.JustificativaId}`,
    faltas: r.faltas ?? "",
    motivo: r.Motivo ?? "",
    isPartialDay: !!r.isPartialDay,
  };
}

const EXPORT_COLUMNS: ExportColumn<AbsenceExportRow>[] = [
  { id: "userName", label: "Colaborador", getValue: (r) => r.userName },
  { id: "date", label: "Data", getValue: (r) => formatBrDate(r.date) },
  { id: "justificativaLabel", label: "Tipo", getValue: (r) => r.justificativaLabel },
  { id: "faltas", label: "Faltas", getValue: (r) => r.faltas || "-" },
];

interface TimeClockAbsenceExportProps {
  className?: string;
  currentItems: AbsenceExportRow[];
  visibleColumns?: Set<string>;
  startDate: Date;
  endDate: Date;
  filterLabel?: string;
}

function csvEscape(field: string): string {
  return `"${String(field).replace(/"/g, '""')}"`;
}

function downloadFile(content: string, mime: string, filename: string) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.style.visibility = "hidden";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

function escapeHtml(text: string | null | undefined): string {
  if (text == null) return "";
  const div = document.createElement("div");
  div.textContent = String(text);
  return div.innerHTML;
}

function formatPhoneWithDDD(phone: string): string {
  if (!phone) return "";
  if (phone.startsWith("(")) return phone;
  const m = phone.match(/^(\d{2})\s+(.+)$/);
  return m ? `(${m[1]}) ${m[2]}` : phone;
}

function formatBrDate(iso: string): string {
  if (!iso) return "";
  try {
    return format(new Date(iso), "dd/MM/yyyy", { locale: ptBR });
  } catch {
    return iso;
  }
}


export function TimeClockAbsenceExport({
  className,
  currentItems,
  visibleColumns,
  startDate,
  endDate,
  filterLabel,
}: TimeClockAbsenceExportProps) {
  const handleExport = async (
    fmt: ExportFormat,
    items: AbsenceExportRow[],
    columns: ExportColumn<AbsenceExportRow>[],
  ) => {
    const periodStamp = `${format(startDate, "yyyy-MM-dd")}_a_${format(endDate, "yyyy-MM-dd")}`;
    const baseName = `controle-ponto-ausencias_${periodStamp}`;

    if (fmt === "csv" || fmt === "excel") {
      const headers = columns.map((c) => c.label);
      const rows = items.map((item) => columns.map((c) => c.getValue(item)));
      const csv = [headers, ...rows]
        .map((row) => row.map(csvEscape).join(","))
        .join("\n");
      downloadFile(csv, "text/csv;charset=utf-8;", `${baseName}.csv`);
      if (fmt === "excel") {
        toast.info("Formato Excel não disponível — arquivo exportado como CSV");
      } else {
        toast.success("Exportação CSV concluída");
      }
      return;
    }

    if (!items.length) {
      toast.error("Nenhum registro para exportar");
      return;
    }

    const html = buildAbsenceOverviewHtml({
      startDate,
      endDate,
      rows: items,
      filterLabel,
    });

    const win = window.open("", "_blank");
    if (!win) {
      toast.error("Bloqueador de pop-up impediu a exportação");
      return;
    }
    win.document.write(html);
    win.document.close();
    win.onload = () => {
      win.focus();
      win.print();
      win.onafterprint = () => {
        try {
          win.close();
        } catch {
          // Ignore
        }
      };
    };
    toast.success("PDF gerado — janela de impressão aberta");
  };

  return (
    <BaseExportPopover<AbsenceExportRow>
      className={className}
      currentItems={currentItems}
      totalRecords={currentItems.length}
      visibleColumns={visibleColumns}
      exportColumns={EXPORT_COLUMNS}
      onExport={handleExport}
      entityName="ausência"
      entityNamePlural="ausências"
    />
  );
}

interface BuildAbsenceHtmlOptions {
  startDate: Date;
  endDate: Date;
  rows: AbsenceExportRow[];
  filterLabel?: string;
}

export function buildAbsenceOverviewHtml({
  startDate,
  endDate,
  rows,
  filterLabel,
}: BuildAbsenceHtmlOptions): string {
  const periodLabel = `${format(startDate, "dd/MM/yyyy")} a ${format(endDate, "dd/MM/yyyy")}`;
  const emissionDate = formatDate(new Date());
  const totalRows = rows.length;

  const dense = totalRows >= 28;
  const bodyFontPt = dense ? 8 : 8.5;
  const tableFontPt = dense ? 6.6 : 7.2;
  const tableHeadPt = dense ? 5.8 : 6.2;
  const rowPadY = dense ? 0.8 : 1.0;
  const headPadY = dense ? 1.1 : 1.3;

  const tableRowsHtml = rows
    .map(
      (r) => `
        <tr>
          <td class="cell-user" title="${escapeHtml(r.userName)}">${escapeHtml(r.userName)}</td>
          <td class="cell-date">${escapeHtml(formatBrDate(r.date))}</td>
          <td class="cell-type">${escapeHtml(r.justificativaLabel)}</td>
          <td class="cell-hours">${escapeHtml(r.faltas) || "—"}</td>
        </tr>
      `,
    )
    .join("");

  // Distinct employees in the period (deduped by userName).
  const uniqueEmployees = new Set(rows.map((r) => r.userName)).size;

  // filterLabel intentionally unused — the filter pill on screen already conveys
  // what the user is looking at; surfacing it again as a redundant block in the
  // PDF header clutters the report.
  void filterLabel;

  const identCardHtml = `
    <section class="ident">
      <div class="ident-row">
        <div class="ident-item ident-name">
          <span class="ident-label">Período</span>
          <span class="ident-value strong">${escapeHtml(periodLabel)}</span>
        </div>
        <div class="ident-item">
          <span class="ident-label">Registros</span>
          <span class="ident-value mono strong">${totalRows}</span>
        </div>
        <div class="ident-item">
          <span class="ident-label">Colaboradores</span>
          <span class="ident-value mono strong">${uniqueEmployees}</span>
        </div>
      </div>
    </section>
  `;

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Controle de Ponto — Ausências ${escapeHtml(periodLabel)}</title>
  <style>
    @page { size: A4; margin: 9mm 10mm 9mm 10mm; }
    * { margin: 0; padding: 0; box-sizing: border-box; }
    html, body {
      width: 100%;
      font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
      font-size: ${bodyFontPt}pt;
      line-height: 1.3;
      color: ${BRAND_COLORS.textDark};
      background: #fff;
    }
    a { color: inherit; text-decoration: none; }

    .page {
      width: 100%;
      min-height: 268mm;
      display: flex;
      flex-direction: column;
    }
    .page-spacer { flex: 1 0 auto; min-height: 4mm; }

    .header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 2mm;
      gap: 8mm;
    }
    .header .logo { height: 11mm; width: auto; }
    .header-right { text-align: right; }
    .document-title {
      font-size: 11pt;
      font-weight: 700;
      color: ${BRAND_COLORS.primaryGreen};
      letter-spacing: 0.4px;
      text-transform: uppercase;
      margin-bottom: 1.2mm;
      line-height: 1;
    }
    .header-meta {
      font-size: 7.2pt;
      color: #555;
      line-height: 1.55;
    }
    .header-meta .label { font-weight: 600; color: ${BRAND_COLORS.textDark}; }
    .header-line {
      height: 1px;
      background: linear-gradient(to right, #888 0%, ${BRAND_COLORS.primaryGreen} 35%);
      margin-bottom: 3mm;
    }

    .ident {
      border: 1px solid #e2e6e3;
      border-left: 3px solid ${BRAND_COLORS.primaryGreen};
      border-radius: 2pt;
      padding: 2.4mm 3mm;
      background: #fafcfa;
      margin-bottom: 3mm;
    }
    .ident-row { display: flex; gap: 6mm; align-items: baseline; }
    .ident-item {
      display: flex;
      flex-direction: column;
      gap: 0.4mm;
      min-width: 0;
    }
    .ident-item.ident-name { flex: 1; }
    .ident-label {
      font-size: 6.8pt;
      color: ${BRAND_COLORS.textGray};
      text-transform: uppercase;
      letter-spacing: 0.5px;
      font-weight: 600;
    }
    .ident-value {
      font-size: ${bodyFontPt}pt;
      color: ${BRAND_COLORS.textDark};
      line-height: 1.25;
    }
    .ident-value.strong { font-weight: 700; font-size: ${bodyFontPt + 1}pt; }
    .ident-value.mono { font-family: 'SFMono-Regular', Consolas, 'Liberation Mono', Menlo, monospace; }

    .section-title {
      font-size: 8pt;
      font-weight: 700;
      color: ${BRAND_COLORS.primaryGreen};
      text-transform: uppercase;
      letter-spacing: 0.4px;
      margin-bottom: 1mm;
      display: flex;
      align-items: center;
      justify-content: space-between;
    }
    .section-title .meta {
      font-weight: 500;
      color: ${BRAND_COLORS.textGray};
      text-transform: none;
      letter-spacing: 0.2px;
      font-size: 7.4pt;
    }

    table.entries {
      width: 100%;
      border-collapse: collapse;
      font-size: ${tableFontPt}pt;
      font-variant-numeric: tabular-nums;
      table-layout: fixed;
    }
    table.entries th {
      background: ${BRAND_COLORS.primaryGreen};
      color: #fff;
      font-weight: 600;
      padding: ${headPadY}mm 1.6mm;
      text-align: left;
      border: 1px solid ${BRAND_COLORS.primaryGreen};
      font-size: ${tableHeadPt}pt;
      white-space: nowrap;
    }
    table.entries td {
      padding: ${rowPadY}mm 1.6mm;
      text-align: left;
      border: 1px solid #e6e6e6;
      color: ${BRAND_COLORS.textDark};
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      vertical-align: middle;
    }
    table.entries th.col-user, table.entries td.cell-user { width: 80mm; max-width: 80mm; font-weight: 600; }
    table.entries th.col-date, table.entries td.cell-date { width: 32mm; max-width: 32mm; font-variant-numeric: tabular-nums; }
    table.entries th.col-type, table.entries td.cell-type { width: 50mm; max-width: 50mm; }
    table.entries th.col-hours, table.entries td.cell-hours { width: 28mm; text-align: center; font-variant-numeric: tabular-nums; }
    table.entries tbody tr:nth-child(even) td { background: #fafafa; }

    .signatures {
      margin-top: 14mm;
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 14mm;
    }
    .signature-box { text-align: center; }
    .signature-area { height: 14mm; border-bottom: 0.5mm solid ${BRAND_COLORS.textDark}; margin-bottom: 1.4mm; }
    .signature-name { font-size: ${bodyFontPt}pt; color: ${BRAND_COLORS.textDark}; font-weight: 600; }
    .signature-role { font-size: 7pt; color: ${BRAND_COLORS.textGray}; margin-top: 0.2mm; }

    .footer { margin-top: 14mm; padding-top: 0; }
    .footer-line { height: 1px; background: ${BRAND_COLORS.primaryGreen}; margin-bottom: 2.2mm; }
    .footer-company { font-size: 10pt; font-weight: 700; color: ${BRAND_COLORS.primaryGreen}; line-height: 1; margin-bottom: 1.6mm; }
    .footer-address { font-size: 8pt; color: ${BRAND_COLORS.textGray}; line-height: 1; margin-bottom: 1.4mm; }
    .footer-phone, .footer-website { font-size: 8pt; color: ${BRAND_COLORS.primaryGreen}; line-height: 1; margin-bottom: 1.4mm; }
    .footer-website { margin-bottom: 0; }

    @media print {
      html, body { print-color-adjust: exact; -webkit-print-color-adjust: exact; }
      .page { page-break-after: avoid; }
      thead { display: table-header-group; }
      tr { page-break-inside: avoid; }
      .signatures, .footer { page-break-inside: avoid; }
    }
  </style>
</head>
<body>
  <div class="page">
    <header class="header">
      <img src="/logo.png" alt="Ankaa Design" class="logo" />
      <div class="header-right">
        <div class="document-title">Controle de Ponto · Ausências</div>
        <div class="header-meta">
          <span class="label">Período:</span> ${escapeHtml(periodLabel)}
          &nbsp;·&nbsp; <span class="label">Emissão:</span> ${escapeHtml(emissionDate)}
        </div>
      </div>
    </header>
    <div class="header-line"></div>

    ${identCardHtml}

    <section>
      <div class="section-title">
        <span>Registros do período</span>
        <span class="meta">${totalRows} ${totalRows === 1 ? "registro" : "registros"}</span>
      </div>
      <table class="entries">
        <colgroup>
          <col class="col-user" />
          <col class="col-date" />
          <col class="col-type" />
          <col class="col-hours" />
        </colgroup>
        <thead>
          <tr>
            <th class="col-user">Colaborador</th>
            <th class="col-date">Data</th>
            <th class="col-type">Tipo</th>
            <th class="col-hours">Faltas</th>
          </tr>
        </thead>
        <tbody>
          ${tableRowsHtml}
        </tbody>
      </table>
    </section>

    <div class="page-spacer"></div>

    <section class="signatures">
      <div class="signature-box">
        <div class="signature-area"></div>
        <div class="signature-name">Responsável</div>
        <div class="signature-role">Recursos Humanos</div>
      </div>
      <div class="signature-box">
        <div class="signature-area"></div>
        <div class="signature-name">Conferido em</div>
        <div class="signature-role">${escapeHtml(emissionDate)}</div>
      </div>
    </section>

    <footer class="footer">
      <div class="footer-line"></div>
      <div class="footer-company">${escapeHtml(COMPANY_INFO.name)}</div>
      <div class="footer-address">${escapeHtml(COMPANY_INFO.address)}</div>
      <div class="footer-phone">${escapeHtml(formatPhoneWithDDD(COMPANY_INFO.phone))}</div>
      <div class="footer-website">${escapeHtml(COMPANY_INFO.websiteUrl)}</div>
    </footer>
  </div>
</body>
</html>`;
}
