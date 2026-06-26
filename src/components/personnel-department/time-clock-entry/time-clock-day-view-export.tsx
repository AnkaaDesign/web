import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

import { BaseExportPopover, type ExportFormat, type ExportColumn } from "@/components/ui/export-popover";
import { toast } from "@/components/ui/sonner";
import { COMPANY_INFO, BRAND_COLORS } from "@/config/company";
import { formatDate } from "@/utils";

export interface DayExportRow {
  id: string;
  userName: string;
  sectorName: string;
  entrada1: string;
  saida1: string;
  entrada2: string;
  saida2: string;
  entrada3: string;
  saida3: string;
  entrada4: string;
  saida4: string;
  entrada5: string;
  saida5: string;
  normais: string;
  faltas: string;
  ex50: string;
  ex100: string;
  ex150: string;
  dsr: string;
  dsrDeb: string;
  ajuste: string;
  atras: string;
  adian: string;
  compensated: string;
  neutral: string;
  dayOff: string;
  freeLunch: string;
}

const EXPORT_COLUMNS: ExportColumn<DayExportRow>[] = [
  { id: "userName", label: "Colaborador", getValue: (r) => r.userName },
  { id: "entrada1", label: "Entrada 1", getValue: (r) => r.entrada1 || "-" },
  { id: "saida1", label: "Saída 1", getValue: (r) => r.saida1 || "-" },
  { id: "entrada2", label: "Entrada 2", getValue: (r) => r.entrada2 || "-" },
  { id: "saida2", label: "Saída 2", getValue: (r) => r.saida2 || "-" },
  { id: "entrada3", label: "Entrada 3", getValue: (r) => r.entrada3 || "-" },
  { id: "saida3", label: "Saída 3", getValue: (r) => r.saida3 || "-" },
  { id: "normais", label: "Normais", getValue: (r) => r.normais || "-" },
  { id: "faltas", label: "Faltas", getValue: (r) => r.faltas || "-" },
  { id: "ex50", label: "Ex 50%", getValue: (r) => r.ex50 || "-" },
  { id: "ex100", label: "Ex 100%", getValue: (r) => r.ex100 || "-" },
  { id: "ex150", label: "Ex 150%", getValue: (r) => r.ex150 || "-" },
];

interface TimeClockDayViewExportProps {
  className?: string;
  currentItems: DayExportRow[];
  visibleColumns?: Set<string>;
  date: Date;
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

export function TimeClockDayViewExport({
  className,
  currentItems,
  visibleColumns,
  date,
}: TimeClockDayViewExportProps) {
  const handleExport = async (
    fmt: ExportFormat,
    items: DayExportRow[],
    columns: ExportColumn<DayExportRow>[],
  ) => {
    const dateStamp = format(date, "yyyy-MM-dd");
    const baseName = `controle-ponto-dia_${dateStamp}`;

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

    const html = buildControlePontoDayHtml({ date, rows: items });

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
    <BaseExportPopover<DayExportRow>
      className={className}
      currentItems={currentItems}
      totalRecords={currentItems.length}
      visibleColumns={visibleColumns}
      exportColumns={EXPORT_COLUMNS}
      onExport={handleExport}
      entityName="registro do dia"
      entityNamePlural="registros do dia"
    />
  );
}

interface BuildDayHtmlOptions {
  date: Date;
  rows: DayExportRow[];
}

const EMPTY_CELL_VALUES = new Set(["", "00:00", "0:00", "-", "--", "00:00:00"]);
const cellOrDash = (v: string | undefined | null): string => {
  if (v == null) return "—";
  const s = String(v).trim();
  return EMPTY_CELL_VALUES.has(s) ? "—" : s;
};

export function buildControlePontoDayHtml({ date, rows }: BuildDayHtmlOptions): string {
  const dateLabel = format(date, "dd/MM/yyyy", { locale: ptBR });
  const weekday = format(date, "EEEE", { locale: ptBR });
  const weekdayCap = weekday.charAt(0).toUpperCase() + weekday.slice(1);
  const emissionDate = formatDate(new Date());

  const totalRows = rows.length;
  const dense = totalRows >= 20;
  // Smaller fonts than the per-employee report — day view is wider (many columns)
  // and packs more rows, so values benefit from tighter typography.
  const bodyFontPt = dense ? 7.2 : 7.8;
  const tableFontPt = dense ? 5.8 : 6.4;
  const tableHeadPt = dense ? 5.2 : 5.6;
  const rowPadY = dense ? 0.6 : 0.8;
  const headPadY = dense ? 0.9 : 1.1;

  const tableRowsHtml = rows
    .map(
      (r) => `
        <tr>
          <td class="cell-user" title="${escapeHtml(r.userName)}">${escapeHtml(r.userName)}</td>
          <td>${escapeHtml(cellOrDash(r.entrada1))}</td>
          <td>${escapeHtml(cellOrDash(r.saida1))}</td>
          <td>${escapeHtml(cellOrDash(r.entrada2))}</td>
          <td>${escapeHtml(cellOrDash(r.saida2))}</td>
          <td>${escapeHtml(cellOrDash(r.entrada3))}</td>
          <td>${escapeHtml(cellOrDash(r.saida3))}</td>
          <td class="cell-totals">${escapeHtml(cellOrDash(r.normais))}</td>
          <td class="cell-totals ${r.faltas && r.faltas.trim() && r.faltas.trim() !== "-" ? "cell-absence" : ""}">${escapeHtml(cellOrDash(r.faltas))}</td>
          <td class="cell-totals">${escapeHtml(cellOrDash(r.ex50))}</td>
          <td class="cell-totals">${escapeHtml(cellOrDash(r.ex100))}</td>
          <td class="cell-totals">${escapeHtml(cellOrDash(r.ex150))}</td>
        </tr>
      `,
    )
    .join("");

  const identCardHtml = `
    <section class="ident">
      <div class="ident-row ident-row-primary">
        <div class="ident-item ident-name">
          <span class="ident-label">Data</span>
          <span class="ident-value strong">${escapeHtml(dateLabel)} · ${escapeHtml(weekdayCap)}</span>
        </div>
        <div class="ident-item">
          <span class="ident-label">Colaboradores</span>
          <span class="ident-value mono strong">${totalRows}</span>
        </div>
      </div>
    </section>
  `;

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Controle de Ponto — Dia ${escapeHtml(dateLabel)}</title>
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
      min-height: 268mm; /* slightly under A4 printable area (279mm) — leaves safety buffer */
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
    .header-meta .label {
      font-weight: 600;
      color: ${BRAND_COLORS.textDark};
    }
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
    .ident-row {
      display: flex;
      gap: 6mm;
      align-items: baseline;
    }
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
      text-align: center;
      border: 1px solid ${BRAND_COLORS.primaryGreen};
      font-size: ${tableHeadPt}pt;
      white-space: nowrap;
    }
    table.entries td {
      padding: ${rowPadY}mm 1.4mm;
      text-align: center;
      border: 1px solid #e6e6e6;
      color: ${BRAND_COLORS.textDark};
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    table.entries th.col-user, table.entries td.cell-user {
      width: 40mm;
      text-align: left;
      padding-left: 2mm;
      font-weight: 600;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      max-width: 40mm;
    }
    table.entries th.col-clock { width: 13mm; }
    table.entries th.col-totals, table.entries td.cell-totals { width: 12mm; }
    table.entries td.cell-absence { color: #c00; font-weight: 600; }
    table.entries tbody tr:nth-child(even) td { background: #fafafa; }

    .signatures {
      margin-top: 14mm;
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 14mm;
    }
    .signature-box { text-align: center; }
    .signature-area {
      height: 14mm;
      border-bottom: 0.5mm solid ${BRAND_COLORS.textDark};
      margin-bottom: 1.4mm;
    }
    .signature-name {
      font-size: ${bodyFontPt}pt;
      color: ${BRAND_COLORS.textDark};
      font-weight: 600;
    }
    .signature-role {
      font-size: 7pt;
      color: ${BRAND_COLORS.textGray};
      margin-top: 0.2mm;
    }

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
        <div class="document-title">Controle de Ponto · Visão Diária</div>
        <div class="header-meta">
          <span class="label">Data:</span> ${escapeHtml(dateLabel)}
          &nbsp;·&nbsp; <span class="label">Emissão:</span> ${escapeHtml(emissionDate)}
        </div>
      </div>
    </header>
    <div class="header-line"></div>

    ${identCardHtml}

    <section>
      <div class="section-title">
        <span>Registros do dia</span>
        <span class="meta">${totalRows} ${totalRows === 1 ? "colaborador" : "colaboradores"}</span>
      </div>
      <table class="entries">
        <colgroup>
          <col class="col-user" />
          <col class="col-clock" />
          <col class="col-clock" />
          <col class="col-clock" />
          <col class="col-clock" />
          <col class="col-clock" />
          <col class="col-clock" />
          <col class="col-totals" />
          <col class="col-totals" />
          <col class="col-totals" />
          <col class="col-totals" />
          <col class="col-totals" />
        </colgroup>
        <thead>
          <tr>
            <th class="col-user">Colaborador</th>
            <th class="col-clock">Entrada 1</th>
            <th class="col-clock">Saída 1</th>
            <th class="col-clock">Entrada 2</th>
            <th class="col-clock">Saída 2</th>
            <th class="col-clock">Entrada 3</th>
            <th class="col-clock">Saída 3</th>
            <th class="col-totals">Normais</th>
            <th class="col-totals">Faltas</th>
            <th class="col-totals">Ex 50%</th>
            <th class="col-totals">Ex 100%</th>
            <th class="col-totals">Ex 150%</th>
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
        <div class="signature-role">Departamento Pessoal</div>
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
