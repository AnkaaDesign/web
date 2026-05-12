import { BaseExportPopover, type ExportFormat, type ExportColumn } from "@/components/ui/export-popover";
import { toast } from "@/components/ui/sonner";
import { format } from "date-fns";
import { secullumService } from "@/api-client";
import { COMPANY_INFO, BRAND_COLORS } from "@/config/company";
import { formatCPF, formatPIS } from "@/utils/formatters";
import { formatDate } from "@/utils";
import type { User } from "@/types";

export interface EditExportRow {
  id: string;
  date: string;
  entry1: string;
  exit1: string;
  entry2: string;
  exit2: string;
  entry3: string;
  exit3: string;
  entry4: string;
  exit4: string;
  entry5: string;
  exit5: string;
  compensated: string;
  neutral: string;
  dayOff: string;
  freeLunch: string;
}

const EXPORT_COLUMNS: ExportColumn<EditExportRow>[] = [
  { id: "date", label: "Data", getValue: (r) => r.date },
  { id: "entry1", label: "Entrada 1", getValue: (r) => r.entry1 || "-" },
  { id: "exit1", label: "Saída 1", getValue: (r) => r.exit1 || "-" },
  { id: "entry2", label: "Entrada 2", getValue: (r) => r.entry2 || "-" },
  { id: "exit2", label: "Saída 2", getValue: (r) => r.exit2 || "-" },
  { id: "entry3", label: "Entrada 3", getValue: (r) => r.entry3 || "-" },
  { id: "exit3", label: "Saída 3", getValue: (r) => r.exit3 || "-" },
  { id: "entry4", label: "Entrada 4", getValue: (r) => r.entry4 || "-" },
  { id: "exit4", label: "Saída 4", getValue: (r) => r.exit4 || "-" },
  { id: "entry5", label: "Entrada 5", getValue: (r) => r.entry5 || "-" },
  { id: "exit5", label: "Saída 5", getValue: (r) => r.exit5 || "-" },
  { id: "compensated", label: "Compensado", getValue: (r) => r.compensated },
  { id: "neutral", label: "Neutro", getValue: (r) => r.neutral },
  { id: "dayOff", label: "Folga", getValue: (r) => r.dayOff },
  { id: "freeLunch", label: "Almoço", getValue: (r) => r.freeLunch },
];

interface TimeClockEntryEditExportProps {
  className?: string;
  currentItems: EditExportRow[];
  visibleColumns?: Set<string>;
  user?: User | null;
  userId?: string | null;
  startDate?: Date | null;
  endDate?: Date | null;
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

function buildPeriodStamp(startDate?: Date | null, endDate?: Date | null): string {
  if (startDate && endDate) {
    return `${format(startDate, "yyyy-MM-dd")}_a_${format(endDate, "yyyy-MM-dd")}`;
  }
  return format(new Date(), "yyyy-MM-dd");
}

function slugify(s: string | null | undefined): string {
  if (!s) return "colaborador";
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
}

function escapeHtml(text: string | null | undefined): string {
  if (text == null) return "";
  const div = document.createElement("div");
  div.textContent = String(text);
  return div.innerHTML;
}

/** Format a Brazilian phone like "43 9 8428-3228" → "(43) 9 8428-3228". Mirrors the dossie helper. */
function formatPhoneWithDDD(phone: string): string {
  if (!phone) return "";
  if (phone.startsWith("(")) return phone;
  const m = phone.match(/^(\d{2})\s+(.+)$/);
  return m ? `(${m[1]}) ${m[2]}` : phone;
}

const DAY_NAMES_PT = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

interface CalculationDayRow {
  date: string;
  weekday: string;
  isWeekend: boolean;
  isHoliday: boolean;
  isDayOff: boolean;
  entrada1: string;
  saida1: string;
  entrada2: string;
  saida2: string;
  entrada3: string;
  saida3: string;
  carga: string;
  normais: string;
  faltas: string;
  ex50: string;
  ex100: string;
  ex150: string;
}

interface CalculationTotals {
  carga: string;
  normais: string;
  faltas: string;
  ex50: string;
  ex100: string;
  ex150: string;
}

interface HorarioInfo {
  entrada1?: string;
  saida1?: string;
  entrada2?: string;
  saida2?: string;
  entrada3?: string;
  saida3?: string;
  cargaDiaria?: string;
  cargaSemanal?: string;
  descricao?: string;
}

const EMPTY_CELL_VALUES = new Set(["", "00:00", "0:00", "-", "--", "00:00:00"]);

function cleanCell(v: unknown): string {
  if (v == null) return "";
  const s = String(v).trim();
  if (EMPTY_CELL_VALUES.has(s)) return "";
  return s;
}

function shortTime(v: unknown): string {
  const s = cleanCell(v);
  if (!s) return "";
  // Trim HH:mm:ss → HH:mm
  if (/^\d{1,2}:\d{2}:\d{2}$/.test(s)) return s.slice(0, 5);
  return s;
}

function parseSecullumCalculations(payload: any): { rows: CalculationDayRow[]; totals: CalculationTotals | null } {
  // `payload` is the axios body: { success, data: { Colunas, Linhas, Totais }, message? }.
  // Some callers may pass an already-unwrapped envelope, so accept both shapes.
  if (!payload) return { rows: [], totals: null };
  const apiResponse = payload.success !== undefined ? payload : (payload.data ?? payload);
  if (!apiResponse || apiResponse.success === false) return { rows: [], totals: null };
  const secullumData = apiResponse.data ?? apiResponse;
  if (!secullumData || !Array.isArray(secullumData.Linhas)) return { rows: [], totals: null };

  const Colunas: Array<{ Nome: string }> = secullumData.Colunas || [];
  const Linhas: any[][] = secullumData.Linhas || [];
  const Totais: any[] = secullumData.Totais || [];

  const idx = new Map<string, number>();
  Colunas.forEach((c, i) => idx.set(c.Nome, i));
  const get = (row: any[], name: string): string => {
    const i = idx.get(name);
    return i == null ? "" : (row?.[i] ?? "");
  };

  const rows: CalculationDayRow[] = Linhas.map((row) => {
    const dataField = get(row, "Data") || "";
    // Format: "DD/MM/YYYY - Seg" (or "Fer" for feriado)
    const [datePart, suffix] = dataField.split(" - ").map((s: string) => s.trim());
    const isHoliday = suffix === "Fer";
    let weekday = suffix || "";
    if (datePart) {
      const [d, m, y] = datePart.split("/").map(Number);
      if (d && m && y) {
        const dayOfWeek = new Date(y, m - 1, d).getDay();
        weekday = DAY_NAMES_PT[dayOfWeek] ?? weekday;
      }
    }
    const isWeekend = weekday === "Dom" || weekday === "Sáb";

    const entrada1 = shortTime(get(row, "Entrada 1"));
    const saida1 = shortTime(get(row, "Saída 1"));
    const entrada2 = shortTime(get(row, "Entrada 2"));
    const saida2 = shortTime(get(row, "Saída 2"));
    const entrada3 = shortTime(get(row, "Entrada 3"));
    const saida3 = shortTime(get(row, "Saída 3"));
    const folgaFlag = cleanCell(get(row, "Folga"));
    const isDayOff = !!folgaFlag && folgaFlag !== "00:00" && !entrada1 && !entrada2 && !entrada3;

    return {
      date: datePart,
      weekday,
      isWeekend,
      isHoliday,
      isDayOff,
      entrada1,
      saida1,
      entrada2,
      saida2,
      entrada3,
      saida3,
      carga: shortTime(get(row, "Carga")),
      normais: shortTime(get(row, "Normais")),
      faltas: shortTime(get(row, "Faltas")),
      ex50: shortTime(get(row, "Ex50%")),
      ex100: shortTime(get(row, "Ex100%")),
      ex150: shortTime(get(row, "Ex150%")),
    };
  });

  const totals: CalculationTotals | null = Totais.length
    ? {
        carga: shortTime(Totais[idx.get("Carga") ?? -1]),
        normais: shortTime(Totais[idx.get("Normais") ?? -1]),
        faltas: shortTime(Totais[idx.get("Faltas") ?? -1]),
        ex50: shortTime(Totais[idx.get("Ex50%") ?? -1]),
        ex100: shortTime(Totais[idx.get("Ex100%") ?? -1]),
        ex150: shortTime(Totais[idx.get("Ex150%") ?? -1]),
      }
    : null;

  return { rows, totals };
}

async function fetchHorarioForUser(user: User | null | undefined): Promise<HorarioInfo | null> {
  if (!user?.secullumId) return null;
  try {
    const empResp = await secullumService.getEmployees();
    const empList: any[] = (empResp?.data as any)?.data ?? [];
    const employee = empList.find((e: any) => String(e?.Id) === String(user.secullumId));
    const horarioId = employee?.HorarioId;
    if (!horarioId) return null;
    const horarioResp = await secullumService.getHorarioById(horarioId);
    const h: any = (horarioResp?.data as any)?.data ?? null;
    if (!h) return null;
    return {
      entrada1: shortTime(h.Entrada1),
      saida1: shortTime(h.Saida1),
      entrada2: shortTime(h.Entrada2),
      saida2: shortTime(h.Saida2),
      entrada3: shortTime(h.Entrada3),
      saida3: shortTime(h.Saida3),
      cargaDiaria: shortTime(h.CargaHorariaDiaria),
      cargaSemanal: shortTime(h.CargaHorariaSemanal),
      descricao: h.Descricao || h.Codigo || undefined,
    };
  } catch {
    return null;
  }
}

export function TimeClockEntryEditExport({
  className,
  currentItems,
  visibleColumns,
  user,
  userId,
  startDate,
  endDate,
}: TimeClockEntryEditExportProps) {
  const handleExport = async (
    fmt: ExportFormat,
    items: EditExportRow[],
    columns: ExportColumn<EditExportRow>[],
  ) => {
    const periodStamp = buildPeriodStamp(startDate, endDate);
    const userSlug = slugify(user?.name);
    const baseName = `controle-ponto_${userSlug}_${periodStamp}`;

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

    // PDF — fetch calculations (with totals) and optional horario for full report
    if (!userId || !startDate || !endDate) {
      toast.error("Selecione um colaborador e o período antes de exportar o PDF");
      return;
    }

    const loadingId = toast.loading("Gerando PDF do controle de ponto…");
    try {
      const startStr = format(startDate, "yyyy-MM-dd");
      const endStr = format(endDate, "yyyy-MM-dd");

      const [calcResp, horario] = await Promise.all([
        secullumService.getCalculations({ userId, startDate: startStr, endDate: endStr, page: 1, take: 100 }),
        fetchHorarioForUser(user),
      ]);

      const { rows, totals } = parseSecullumCalculations(calcResp?.data);

      if (!rows.length) {
        toast.dismiss(loadingId);
        toast.error("Nenhum registro encontrado para o período selecionado");
        return;
      }

      const html = buildControlePontoHtml({
        user: user ?? null,
        startDate,
        endDate,
        rows,
        totals,
        horario,
      });

      const win = window.open("", "_blank");
      if (!win) {
        toast.dismiss(loadingId);
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
      toast.dismiss(loadingId);
      toast.success("PDF gerado — janela de impressão aberta");
    } catch (err) {
      toast.dismiss(loadingId);
      const message =
        (err as any)?.response?.data?.message ||
        (err as any)?.message ||
        "Erro ao gerar PDF do controle de ponto";
      toast.error(message);
    }
  };

  return (
    <BaseExportPopover<EditExportRow>
      className={className}
      currentItems={currentItems}
      totalRecords={currentItems.length}
      visibleColumns={visibleColumns}
      exportColumns={EXPORT_COLUMNS}
      onExport={handleExport}
      entityName="registro de ponto"
      entityNamePlural="registros de ponto"
    />
  );
}

export interface BuildHtmlOptions {
  user: User | null;
  startDate: Date;
  endDate: Date;
  rows: CalculationDayRow[];
  totals: CalculationTotals | null;
  horario: HorarioInfo | null;
}

export { parseSecullumCalculations, fetchHorarioForUser };

export function buildControlePontoHtml({ user, startDate, endDate, rows, totals, horario }: BuildHtmlOptions): string {
  const periodLabel = `${format(startDate, "dd/MM/yyyy")} a ${format(endDate, "dd/MM/yyyy")}`;
  const emissionDate = formatDate(new Date());

  const userName = user?.name ?? "—";
  const cpf = user?.cpf ? formatCPF(user.cpf) : "—";
  const pis = user?.pis ? formatPIS(user.pis) : "—";
  const payrollNumber = user?.payrollNumber != null ? String(user.payrollNumber) : "—";
  const positionName = user?.position?.name ?? "—";
  const sectorName = user?.sector?.name ?? "—";
  const admissionDate = user?.effectedAt ? formatDate(user.effectedAt) : "—";

  const totalRows = rows.length;

  // Adaptive sizing: target one A4 page no matter the row count (28–32 typical).
  // Smaller numbers when there are more rows so everything fits.
  const dense = totalRows >= 28;
  const bodyFontPt = dense ? 8 : 8.5;
  const tableFontPt = dense ? 6.6 : 7.2;
  const tableHeadPt = dense ? 5.8 : 6.2;
  const rowPadY = dense ? 0.8 : 1.0; // mm
  const headPadY = dense ? 1.1 : 1.3; // mm

  // Build main table rows
  const tableRowsHtml = rows
    .map((r) => {
      const rowClasses: string[] = [];
      if (r.isHoliday) rowClasses.push("row-holiday");
      else if (r.isDayOff) rowClasses.push("row-dayoff");
      else if (r.isWeekend) rowClasses.push("row-weekend");

      let cells: string;
      if (r.isHoliday) {
        cells = Array.from({ length: 6 }, () => `<td class="cell-info">Feriado</td>`).join("");
      } else if (r.isDayOff) {
        cells = Array.from({ length: 6 }, () => `<td class="cell-info">Folga</td>`).join("");
      } else {
        cells = `
          <td>${escapeHtml(r.entrada1) || "—"}</td>
          <td>${escapeHtml(r.saida1) || "—"}</td>
          <td>${escapeHtml(r.entrada2) || "—"}</td>
          <td>${escapeHtml(r.saida2) || "—"}</td>
          <td>${escapeHtml(r.entrada3) || "—"}</td>
          <td>${escapeHtml(r.saida3) || "—"}</td>
        `;
      }

      // Date column: "dd/MM/yy - Ddd" (e.g., "01/05/26 - Seg")
      const shortDate = (() => {
        const parts = r.date.split("/");
        if (parts.length === 3) {
          const [d, m, y] = parts;
          return `${d}/${m}/${y.slice(-2)}`;
        }
        return r.date;
      })();
      const dateLabel = `${escapeHtml(shortDate)}${r.weekday ? ` - ${escapeHtml(r.weekday)}` : ""}`;

      return `
        <tr class="${rowClasses.join(" ")}">
          <td class="cell-date">${dateLabel}</td>
          ${cells}
          <td class="cell-totals">${escapeHtml(r.carga) || "—"}</td>
          <td class="cell-totals">${escapeHtml(r.normais) || "—"}</td>
          <td class="cell-totals ${r.faltas ? "cell-absence" : ""}">${escapeHtml(r.faltas) || "—"}</td>
          <td class="cell-totals">${escapeHtml(r.ex50) || "—"}</td>
          <td class="cell-totals">${escapeHtml(r.ex100) || "—"}</td>
          <td class="cell-totals">${escapeHtml(r.ex150) || "—"}</td>
        </tr>
      `;
    })
    .join("");

  const totalsRowHtml = totals
    ? `
      <tr class="row-totals">
        <td class="cell-date">TOTAIS</td>
        <td colspan="6" class="cell-totals-spacer"></td>
        <td class="cell-totals">${escapeHtml(totals.carga) || "—"}</td>
        <td class="cell-totals">${escapeHtml(totals.normais) || "—"}</td>
        <td class="cell-totals ${totals.faltas ? "cell-absence" : ""}">${escapeHtml(totals.faltas) || "—"}</td>
        <td class="cell-totals">${escapeHtml(totals.ex50) || "—"}</td>
        <td class="cell-totals">${escapeHtml(totals.ex100) || "—"}</td>
        <td class="cell-totals">${escapeHtml(totals.ex150) || "—"}</td>
      </tr>
    `
    : "";

  // Identification — compact 4-column stat strip (no Empresa).
  const identCardHtml = `
    <section class="ident">
      <div class="ident-row ident-row-primary">
        <div class="ident-item ident-name">
          <span class="ident-label">Colaborador</span>
          <span class="ident-value strong">${escapeHtml(userName)}</span>
        </div>
        <div class="ident-item">
          <span class="ident-label">Matrícula</span>
          <span class="ident-value mono strong">${escapeHtml(payrollNumber)}</span>
        </div>
      </div>
      <div class="ident-row ident-row-secondary">
        <div class="ident-item">
          <span class="ident-label">CPF</span>
          <span class="ident-value mono">${escapeHtml(cpf)}</span>
        </div>
        <div class="ident-item">
          <span class="ident-label">PIS</span>
          <span class="ident-value mono">${escapeHtml(pis)}</span>
        </div>
        <div class="ident-item">
          <span class="ident-label">Cargo</span>
          <span class="ident-value">${escapeHtml(positionName)}</span>
        </div>
        <div class="ident-item">
          <span class="ident-label">Setor</span>
          <span class="ident-value">${escapeHtml(sectorName)}</span>
        </div>
        <div class="ident-item">
          <span class="ident-label">Admissão</span>
          <span class="ident-value">${escapeHtml(admissionDate)}</span>
        </div>
      </div>
    </section>
  `;

  const horarioBlockHtml = horario ? buildHorarioBlockHtml(horario) : "";

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Controle de Ponto — ${escapeHtml(userName)}</title>
  <style>
    @page {
      size: A4;
      margin: 9mm 10mm 9mm 10mm;
    }

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
      display: flex;
      flex-direction: column;
    }

    /* ===== Header ===== */
    .header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 2mm;
      gap: 8mm;
    }

    .header .logo {
      height: 11mm;
      width: auto;
    }

    .header-right {
      text-align: right;
    }

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

    /* ===== Identification strip ===== */
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

    .ident-row-primary {
      margin-bottom: 1.8mm;
      padding-bottom: 1.8mm;
      border-bottom: 1px dashed #d6dcd8;
    }

    .ident-item {
      display: flex;
      flex-direction: column;
      gap: 0.4mm;
      min-width: 0;
    }

    .ident-item.ident-name {
      flex: 1;
    }

    .ident-row-secondary .ident-item {
      flex: 1;
    }

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

    /* ===== Horario block (optional) ===== */
    .horario {
      margin-bottom: 3mm;
    }
    .horario-title {
      font-size: 7.6pt;
      font-weight: 700;
      color: ${BRAND_COLORS.primaryGreen};
      text-transform: uppercase;
      letter-spacing: 0.4px;
      margin-bottom: 1mm;
    }
    .horario-table {
      width: 100%;
      border-collapse: collapse;
      font-size: ${tableFontPt}pt;
      font-variant-numeric: tabular-nums;
    }
    .horario-table th, .horario-table td {
      padding: 0.8mm 1.6mm;
      text-align: center;
      border: 1px solid #e6e6e6;
    }
    .horario-table th {
      background: #f3f5f4;
      font-weight: 600;
      font-size: 6.8pt;
      text-transform: uppercase;
      letter-spacing: 0.3px;
      color: ${BRAND_COLORS.textDark};
    }
    .horario-table td.label {
      text-align: left;
      font-weight: 600;
      background: #fafafa;
      width: 18mm;
    }
    .horario-table td.muted {
      color: ${BRAND_COLORS.textGray};
      font-style: italic;
    }

    /* ===== Main entries table ===== */
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
      letter-spacing: 0;
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

    /* Column widths — sum to 100% */
    table.entries th.col-date, table.entries td.cell-date { width: 27mm; text-align: left; padding-left: 2mm; }
    table.entries th.col-clock, table.entries td.cell-clock { width: 12.5mm; }
    table.entries th.col-totals, table.entries td.cell-totals { width: 12mm; }

    table.entries td.cell-date { font-weight: 600; font-variant-numeric: tabular-nums; }
    table.entries td.cell-totals-spacer { background: inherit; border-top: inherit; }

    table.entries td.cell-info {
      color: ${BRAND_COLORS.textGray};
      font-style: italic;
      background: #fafafa;
      letter-spacing: 0.4px;
      text-transform: uppercase;
      font-size: ${Math.max(5.2, tableFontPt - 1.8)}pt;
    }

    table.entries tr.row-holiday td { background: #fff7e8; }
    table.entries tr.row-holiday td.cell-info {
      color: #b45309;
      font-weight: 600;
      background: #fff7e8;
    }

    table.entries tr.row-dayoff td { background: #f6f6f6; }
    table.entries tr.row-dayoff td.cell-info {
      color: ${BRAND_COLORS.textGray};
      background: #f6f6f6;
    }

    table.entries tr.row-weekend td { background: #fafafa; }

    table.entries td.cell-absence {
      color: #c00;
      font-weight: 600;
    }

    table.entries tr.row-totals td {
      background: #e7f1ea;
      font-weight: 700;
      color: ${BRAND_COLORS.primaryGreen};
      border-top: 1.6px solid ${BRAND_COLORS.primaryGreen};
      padding-top: ${rowPadY + 0.2}mm;
      padding-bottom: ${rowPadY + 0.2}mm;
    }

    table.entries tr.row-totals td.cell-date {
      text-align: left;
      letter-spacing: 0.6px;
      padding-left: 2mm;
    }
    table.entries tr.row-totals td.cell-totals-spacer {
      background: #e7f1ea;
    }

    /* ===== Legend ===== */
    .legend {
      margin-top: 1.6mm;
      font-size: 6.8pt;
      color: ${BRAND_COLORS.textGray};
      line-height: 1.5;
    }
    .legend .chip {
      display: inline-block;
      padding: 0.3mm 1.6mm;
      border-radius: 2pt;
      margin-right: 1.5mm;
      font-weight: 600;
      color: ${BRAND_COLORS.textDark};
    }
    .chip.chip-off { background: #f6f6f6; }
    .chip.chip-holiday { background: #fff7e8; color: #b45309; }
    .chip.chip-absence { background: #fde9e9; color: #c00; }

    /* ===== Signatures ===== */
    .signatures {
      margin-top: 10mm;
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 14mm;
    }

    .signature-box { text-align: center; }

    .signature-line {
      border-top: 1px solid ${BRAND_COLORS.textDark};
      padding-top: 1.4mm;
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

    /* ===== Footer (matches dossie pdf) ===== */
    .footer {
      margin-top: 8mm;
      padding-top: 0;
    }
    .footer-line {
      height: 1px;
      background: ${BRAND_COLORS.primaryGreen};
      margin-bottom: 2.2mm;
    }
    .footer-company {
      font-size: 10pt;
      font-weight: 700;
      color: ${BRAND_COLORS.primaryGreen};
      line-height: 1;
      margin-bottom: 1.6mm;
    }
    .footer-address {
      font-size: 8pt;
      color: ${BRAND_COLORS.textGray};
      line-height: 1;
      margin-bottom: 1.4mm;
    }
    .footer-phone, .footer-website {
      font-size: 8pt;
      color: ${BRAND_COLORS.primaryGreen};
      line-height: 1;
      margin-bottom: 1.4mm;
    }
    .footer-website { margin-bottom: 0; }
    .footer a { color: inherit; text-decoration: none; }

    @media print {
      html, body {
        print-color-adjust: exact;
        -webkit-print-color-adjust: exact;
      }
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
        <div class="document-title">Controle de Ponto</div>
        <div class="header-meta">
          <span class="label">Período:</span> ${escapeHtml(periodLabel)}
          &nbsp;·&nbsp; <span class="label">Emissão:</span> ${escapeHtml(emissionDate)}
        </div>
      </div>
    </header>
    <div class="header-line"></div>

    ${identCardHtml}
    ${horarioBlockHtml}

    <section>
      <div class="section-title">
        <span>Registros do período</span>
        <span class="meta">${totalRows} ${totalRows === 1 ? "dia" : "dias"}</span>
      </div>
      <table class="entries">
        <colgroup>
          <col class="col-date" />
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
          <col class="col-totals" />
        </colgroup>
        <thead>
          <tr>
            <th class="col-date">Data</th>
            <th class="col-clock">Entrada 1</th>
            <th class="col-clock">Saída 1</th>
            <th class="col-clock">Entrada 2</th>
            <th class="col-clock">Saída 2</th>
            <th class="col-clock">Entrada 3</th>
            <th class="col-clock">Saída 3</th>
            <th class="col-totals">Carga</th>
            <th class="col-totals">Normais</th>
            <th class="col-totals">Faltas</th>
            <th class="col-totals">Ex 50%</th>
            <th class="col-totals">Ex 100%</th>
            <th class="col-totals">Ex 150%</th>
          </tr>
        </thead>
        <tbody>
          ${tableRowsHtml}
          ${totalsRowHtml}
        </tbody>
      </table>

      <div class="legend">
        <span class="chip chip-off">Folga</span> sem expediente
        <span class="chip chip-holiday" style="margin-left:3mm">Feriado</span> dia não trabalhado
        <span class="chip chip-absence" style="margin-left:3mm">Faltas</span> em vermelho indicam horas não trabalhadas
      </div>
    </section>

    <section class="signatures">
      <div class="signature-box">
        <div class="signature-line">
          <div class="signature-name">${escapeHtml(userName)}</div>
          <div class="signature-role">Colaborador</div>
        </div>
      </div>
      <div class="signature-box">
        <div class="signature-line">
          <div class="signature-name">Responsável</div>
          <div class="signature-role">Recursos Humanos</div>
        </div>
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

function buildHorarioBlockHtml(horario: HorarioInfo): string {
  const has = (v?: string) => !!v && v.length > 0;
  const cell = (v?: string) => (has(v) ? escapeHtml(v!) : "—");
  const segments = [
    `${cell(horario.entrada1)} – ${cell(horario.saida1)}`,
    has(horario.entrada2) ? `${cell(horario.entrada2)} – ${cell(horario.saida2)}` : "",
    has(horario.entrada3) ? `${cell(horario.entrada3)} – ${cell(horario.saida3)}` : "",
  ].filter(Boolean);
  const weekdaySchedule = segments.join(" · ");

  const titleBits: string[] = ["Horário de Trabalho"];
  if (horario.descricao) titleBits.push(escapeHtml(horario.descricao));
  if (horario.cargaSemanal) titleBits.push(`${escapeHtml(horario.cargaSemanal)}/semana`);

  return `
    <section class="horario">
      <div class="horario-title">${titleBits.join(" · ")}</div>
      <table class="horario-table">
        <thead>
          <tr>
            <th>Seg</th>
            <th>Ter</th>
            <th>Qua</th>
            <th>Qui</th>
            <th>Sex</th>
            <th>Sáb</th>
            <th>Dom</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>${weekdaySchedule}</td>
            <td>${weekdaySchedule}</td>
            <td>${weekdaySchedule}</td>
            <td>${weekdaySchedule}</td>
            <td>${weekdaySchedule}</td>
            <td class="muted">Horas extras</td>
            <td class="muted">Folga</td>
          </tr>
        </tbody>
      </table>
    </section>
  `;
}
