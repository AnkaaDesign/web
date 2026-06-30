import { formatDate } from "@/utils/date";
import { COMPANY_INFO } from "@/config/company";
import { columnHeaderText, rawColumnValue, valueToString } from "./data-table-utils";
import type { DataTableColumnDef } from "./data-table-types";

const BRAND_GREEN: [number, number, number] = [10, 92, 30]; // #0a5c1e
const TEXT_DARK: [number, number, number] = [26, 26, 26]; // #1a1a1a
const TEXT_GRAY: [number, number, number] = [102, 102, 102]; // #666666

function stamp(): string {
  return formatDate(new Date()).replace(/\//g, "-");
}

/** A plain-text cell value used for BOTH pdf and xlsx. Multi-value cells join with ", ". */
function textCell<TData>(col: DataTableColumnDef<TData>, row: TData): string {
  const v = rawColumnValue(col, row);
  if (Array.isArray(v)) return v.map((x) => valueToString(x)).join(", ");
  return valueToString(v);
}

/** "43 9 8428-3228" → "(43) 9 8428-3228" (matches the dossiê/budget PDFs). Idempotent. */
function formatPhone(phone: string): string {
  if (!phone) return "";
  if (phone.startsWith("(")) return phone;
  return phone.replace(/^(\d{2})\s+(.+)$/, "($1) $2");
}

async function loadLogo(): Promise<{ dataUrl: string; w: number; h: number } | null> {
  try {
    const res = await fetch("/logo.png");
    if (!res.ok) return null;
    const blob = await res.blob();
    const dataUrl = await new Promise<string>((resolve, reject) => {
      const r = new FileReader();
      r.onload = () => resolve(r.result as string);
      r.onerror = reject;
      r.readAsDataURL(blob);
    });
    const dims = await new Promise<{ w: number; h: number }>((resolve) => {
      const img = new Image();
      img.onload = () => resolve({ w: img.naturalWidth || 1, h: img.naturalHeight || 1 });
      img.onerror = () => resolve({ w: 1, h: 1 });
      img.src = dataUrl;
    });
    return { dataUrl, ...dims };
  } catch {
    return null;
  }
}

export interface ExportRequest<TData> {
  rows: TData[];
  /** Columns to export, in the chosen order. */
  columns: DataTableColumnDef<TData>[];
  /** Base filename (no extension / date). */
  filename: string;
  /** Document title shown in the PDF. */
  title: string;
}

export async function exportToXlsx<TData>({ rows, columns, filename, title }: ExportRequest<TData>): Promise<void> {
  const XLSX = await import("xlsx");
  const headers = columns.map((c) => columnHeaderText(c));
  // Every cell is written as TEXT so Excel left-aligns ALL of them (community xlsx can't
  // write alignment styles, and numeric cells would otherwise right-align). Per request:
  // the spreadsheet is always left-aligned regardless of the column's on-screen alignment.
  const aoa: string[][] = [headers, ...rows.map((row) => columns.map((col) => textCell(col, row)))];

  const ws = XLSX.utils.aoa_to_sheet(aoa);
  // Auto column widths.
  ws["!cols"] = columns.map((col, i) => {
    const headerLen = headers[i].length;
    const maxLen = rows.reduce((m, row) => Math.max(m, textCell(col, row).length), headerLen);
    return { wch: Math.min(Math.max(maxLen + 2, 8), 60) };
  });

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, title.slice(0, 31) || "Dados");
  XLSX.writeFile(wb, `${filename}_${stamp()}.xlsx`);
}

export async function exportToPdf<TData>({ rows, columns, filename, title }: ExportRequest<TData>): Promise<void> {
  const [{ jsPDF }, autoTableMod] = await Promise.all([import("jspdf"), import("jspdf-autotable")]);
  const autoTable = (autoTableMod.default ?? autoTableMod) as unknown as (
    doc: unknown,
    opts: Record<string, unknown>,
  ) => void;

  // Always a standard portrait A4 sheet (matches the dossiê / budget documents).
  const doc = new jsPDF({ orientation: "portrait", unit: "pt", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const M = 24; // left/right margin (tightened per request; header/footer align to it)
  // Scale the table down as columns grow so a wide table still fits the A4 width.
  const fontSize = columns.length > 7 ? 7 : columns.length > 5 ? 8 : 9;
  const cellPadding = columns.length > 7 ? 3 : 4;

  const logo = await loadLogo();
  const issued = formatDate(new Date());
  const phone = formatPhone(COMPANY_INFO.phone);

  // Header + footer are redrawn on EVERY page (didDrawPage) so multi-page exports match
  // the dossiê / budget layout: logo left, title + emissão date right, a green rule, and a
  // footer with the company block (name/address/phone/site) + page number.
  const drawHeader = () => {
    const top = 22;
    if (logo) {
      const h = 32;
      const w = h * (logo.w / logo.h);
      doc.addImage(logo.dataUrl, "PNG", M, top, w, h);
    }
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.setTextColor(...TEXT_DARK);
    doc.text(title, pageW - M, top + 10, { align: "right" });
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(...TEXT_GRAY);
    doc.text(`Emissão: ${issued}`, pageW - M, top + 22, { align: "right" });
    doc.text(`${rows.length} registro(s)`, pageW - M, top + 32, { align: "right" });
    const lineY = top + 44;
    doc.setDrawColor(...BRAND_GREEN);
    doc.setLineWidth(1);
    doc.line(M, lineY, pageW - M, lineY);
  };

  const drawFooter = () => {
    const lineY = pageH - 54;
    doc.setDrawColor(...BRAND_GREEN);
    doc.setLineWidth(1);
    doc.line(M, lineY, pageW - M, lineY);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.setTextColor(...BRAND_GREEN);
    doc.text(COMPANY_INFO.name, M, lineY + 13);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(...TEXT_GRAY);
    doc.text(COMPANY_INFO.address, M, lineY + 23);
    doc.setTextColor(...BRAND_GREEN);
    doc.text(phone, M, lineY + 33);
    doc.text(COMPANY_INFO.websiteUrl, M, lineY + 43);
  };

  autoTable(doc, {
    head: [columns.map((c) => columnHeaderText(c))],
    body: rows.map((row) => columns.map((col) => textCell(col, row))),
    margin: { top: 74, bottom: 64, left: M, right: M },
    // One line per row (truncate with "…", never wrap) + horizontal rules ONLY — the
    // per-side lineWidth draws a bottom rule on each cell, so there are NO vertical borders.
    styles: {
      fontSize,
      cellPadding,
      overflow: "ellipsize",
      textColor: TEXT_DARK,
      lineColor: [225, 228, 225],
      lineWidth: { top: 0, right: 0, bottom: 0.5, left: 0 },
    },
    headStyles: { fillColor: BRAND_GREEN, textColor: 255, fontStyle: "bold", lineWidth: { top: 0, right: 0, bottom: 0, left: 0 } },
    alternateRowStyles: { fillColor: [246, 248, 246] },
    theme: "plain",
    didDrawPage: () => {
      drawHeader();
      drawFooter();
    },
  });

  // Stamp "Página X de Y" once the total page count is known (right side of the footer band).
  const total = doc.getNumberOfPages();
  for (let i = 1; i <= total; i++) {
    doc.setPage(i);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(...TEXT_GRAY);
    doc.text(`Página ${i} de ${total}`, pageW - M, pageH - 54 + 13, { align: "right" });
  }

  doc.save(`${filename}_${stamp()}.pdf`);
}

/** Copy the current view URL (which encodes sort/filter/selection/page) to the clipboard. */
export async function copyShareLink(): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(window.location.href);
    return true;
  } catch {
    return false;
  }
}
