/**
 * Vector PDF generator for the "Espelho de Ponto" document.
 *
 * Produces a REAL text-based PDF (selectable/copyable) using jsPDF + jspdf-autotable,
 * mirroring the layout of the HTML reference in
 * `components/personnel-department/time-clock-entry/time-clock-entry-edit-export.tsx`
 * (header, identification card, work-schedule block, period table with DSR,
 * signatures and the Ankaa footer). One A4 page per collaborator.
 */
import { format } from "date-fns";

import { COMPANY_INFO } from "@/config/company";
import { formatCPF, formatPIS } from "@/utils/formatters";
import { formatDate } from "@/utils";
import type { BuildHtmlOptions } from "@/components/personnel-department/time-clock-entry/time-clock-entry-edit-export";

type RGB = [number, number, number];

const GREEN: RGB = [10, 92, 30]; // #0a5c1e
const DARK: RGB = [26, 26, 26]; // #1a1a1a
const GRAY: RGB = [102, 102, 102]; // #666666
const BORDER: RGB = [226, 230, 227];
const CARD_BG: RGB = [250, 252, 250];
const GRID: RGB = [228, 228, 228];
const TOTALS_BG: RGB = [231, 241, 234];
const HOLIDAY_BG: RGB = [255, 247, 232];
const HOLIDAY_FG: RGB = [180, 83, 9];
const DAYOFF_BG: RGB = [244, 244, 244];
const WEEKEND_BG: RGB = [250, 250, 250];
const ABSENCE_FG: RGB = [204, 0, 0];

// A4 portrait, mm. Margins match the print @page (9mm top/bottom, 10mm left/right).
const PAGE_W = 210;
const PAGE_H = 297;
const ML = 10;
const MR = 10;
const MT = 9;
const CONTENT_W = PAGE_W - ML - MR; // 190

function formatPhoneWithDDD(phone: string): string {
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

function shortDate(date: string): string {
  const parts = date.split("/");
  if (parts.length === 3) {
    const [d, m, y] = parts;
    return `${d}/${m}/${y.slice(-2)}`;
  }
  return date;
}

/** Build the single weekday schedule string, e.g. "07:15 – 11:30 · 13:00 – 17:30". */
function weekdaySchedule(h: NonNullable<BuildHtmlOptions["horario"]>): string {
  const cell = (v?: string) => (v && v.length > 0 ? v : "—");
  const segments = [
    `${cell(h.entrada1)} – ${cell(h.saida1)}`,
    h.entrada2 ? `${cell(h.entrada2)} – ${cell(h.saida2)}` : "",
    h.entrada3 ? `${cell(h.entrada3)} – ${cell(h.saida3)}` : "",
  ].filter(Boolean);
  return segments.join(" · ");
}

interface Assets {
  autoTable: (doc: any, opts: Record<string, unknown>) => void;
  logo: { dataUrl: string; w: number; h: number } | null;
}

function drawEspelhoPage(doc: any, { autoTable, logo }: Assets, item: BuildHtmlOptions) {
  const { user, startDate, endDate, rows, totals, horario } = item;

  const userName = user?.name ?? "—";
  const cpf = user?.cpf ? formatCPF(user.cpf) : "—";
  const pis = user?.pis ? formatPIS(user.pis) : "—";
  const payrollNumber = user?.payrollNumber != null ? String(user.payrollNumber) : "—";
  const positionName = user?.position?.name ?? "—";
  const sectorName = user?.sector?.name ?? "—";
  const admissionDate = user?.currentContract?.admissionDate
    ? formatDate(user.currentContract.admissionDate)
    : user?.currentContract?.effectedAt
      ? formatDate(user.currentContract.effectedAt)
      : "—";
  const periodLabel = `${format(startDate, "dd/MM/yyyy")} a ${format(endDate, "dd/MM/yyyy")}`;
  const emission = formatDate(new Date());

  // ===== Header =====
  let y = MT;
  if (logo) {
    const h = 11;
    const w = h * (logo.w / logo.h);
    doc.addImage(logo.dataUrl, "PNG", ML, y, w, h);
  }
  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.setTextColor(...GREEN);
  doc.text("ESPELHO DE PONTO", PAGE_W - MR, y + 5, { align: "right" });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);
  doc.setTextColor(...GRAY);
  doc.text(`Período: ${periodLabel}   ·   Emissão: ${emission}`, PAGE_W - MR, y + 10, { align: "right" });

  const headerLineY = y + 14;
  doc.setDrawColor(...GREEN);
  doc.setLineWidth(0.4);
  doc.line(ML, headerLineY, PAGE_W - MR, headerLineY);

  // ===== Identification card =====
  const identY = headerLineY + 4;
  const identH = 24;
  doc.setFillColor(...CARD_BG);
  doc.setDrawColor(...BORDER);
  doc.setLineWidth(0.2);
  doc.roundedRect(ML, identY, CONTENT_W, identH, 1, 1, "FD");
  // Green left accent bar.
  doc.setFillColor(...GREEN);
  doc.rect(ML, identY, 1, identH, "F");

  const ix = ML + 4;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(6.2);
  doc.setTextColor(...GRAY);
  doc.text("COLABORADOR", ix, identY + 4);
  doc.setFontSize(11);
  doc.setTextColor(...DARK);
  doc.text(userName, ix, identY + 9);

  // Dashed separator.
  doc.setDrawColor(...BORDER);
  doc.setLineWidth(0.2);
  doc.setLineDashPattern([0.6, 0.6], 0);
  doc.line(ix, identY + 11.5, ML + CONTENT_W - 4, identY + 11.5);
  doc.setLineDashPattern([], 0);

  const fields: Array<[string, string]> = [
    ["MATRÍCULA", payrollNumber],
    ["CPF", cpf],
    ["PIS", pis],
    ["CARGO", positionName],
    ["SETOR", sectorName],
    ["ADMISSÃO", admissionDate],
  ];
  const colW = (CONTENT_W - 8) / fields.length;
  fields.forEach(([label, value], i) => {
    const x = ix + i * colW;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(6);
    doc.setTextColor(...GRAY);
    doc.text(label, x, identY + 15.5);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(...DARK);
    const lines = doc.splitTextToSize(value, colW - 1.5).slice(0, 2);
    doc.text(lines, x, identY + 19.5);
  });

  let cursorY = identY + identH + 5;

  // ===== Work-schedule block =====
  if (horario) {
    const titleBits = ["HORÁRIO DE TRABALHO"];
    if (horario.descricao) titleBits.push(horario.descricao.toUpperCase());
    if (horario.cargaSemanal) titleBits.push(`${horario.cargaSemanal}/SEMANA`);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7.6);
    doc.setTextColor(...GREEN);
    doc.text(titleBits.join(" · "), ML, cursorY);

    const sched = weekdaySchedule(horario);
    autoTable(doc, {
      startY: cursorY + 1.5,
      margin: { left: ML, right: MR },
      theme: "grid",
      head: [["SEG", "TER", "QUA", "QUI", "SEX", "SÁB", "DOM"]],
      body: [[sched, sched, sched, sched, sched, "Horas extras", "Folga"]],
      styles: {
        font: "helvetica",
        fontSize: 5.2,
        cellPadding: { top: 0.8, bottom: 0.8, left: 0.6, right: 0.6 },
        halign: "center",
        valign: "middle",
        lineColor: GRID,
        lineWidth: 0.1,
        textColor: DARK,
        overflow: "ellipsize",
      },
      headStyles: {
        fillColor: [243, 245, 244] as RGB,
        textColor: DARK,
        fontStyle: "bold",
        fontSize: 6.4,
      },
      didParseCell: (data: any) => {
        if (data.section === "body" && data.column.index >= 5) {
          data.cell.styles.textColor = GRAY;
          data.cell.styles.fontStyle = "italic";
        }
      },
    });
    cursorY = doc.lastAutoTable.finalY + 5;
  }

  // ===== Period records table =====
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.setTextColor(...GREEN);
  doc.text("REGISTROS DO PERÍODO", ML, cursorY);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.4);
  doc.setTextColor(...GRAY);
  doc.text(`${rows.length} ${rows.length === 1 ? "dia" : "dias"}`, PAGE_W - MR, cursorY, { align: "right" });

  const head = [[
    "Data", "Entrada 1", "Saída 1", "Entrada 2", "Saída 2", "Entrada 3", "Saída 3",
    "Normais", "Faltas", "Ex 50%", "Ex 100%", "Ex 150%", "DSR",
  ]];

  type RowMeta = { bg: RGB | null; holiday: boolean; dayoff: boolean; hasFaltas: boolean; collapsed: boolean };
  const rowMeta: RowMeta[] = [];

  const body = rows.map((r) => {
    // A holiday / day-off row only collapses to a single "Feriado"/"Folga" label cell when the
    // employee did NOT clock in. If punches exist (a worked holiday / worked day-off) show the real
    // entrada/saída marcações like a normal day — the day still reads as holiday/folga via its row
    // background + date label, but the marcações must not be hidden.
    const hasPunches = !!(r.entrada1 || r.saida1 || r.entrada2 || r.saida2 || r.entrada3 || r.saida3);
    const collapsed = (r.isHoliday || r.isDayOff) && !hasPunches;
    const meta: RowMeta = {
      bg: r.isHoliday ? HOLIDAY_BG : r.isDayOff ? DAYOFF_BG : r.isWeekend ? WEEKEND_BG : null,
      holiday: r.isHoliday,
      dayoff: r.isDayOff,
      hasFaltas: !!r.faltas,
      collapsed,
    };
    rowMeta.push(meta);
    const dateLabel = `${shortDate(r.date)}${r.weekday ? ` - ${r.weekday}` : ""}`;
    const tail = [
      r.normais || "—", r.faltas || "—", r.ex50 || "—", r.ex100 || "—", r.ex150 || "—", r.dsr || "—",
    ];
    if (collapsed) {
      return [
        dateLabel,
        { content: r.isHoliday ? "Feriado" : "Folga", colSpan: 6 },
        ...tail,
      ];
    }
    return [
      dateLabel,
      r.entrada1 || "—", r.saida1 || "—", r.entrada2 || "—", r.saida2 || "—", r.entrada3 || "—", r.saida3 || "—",
      ...tail,
    ];
  });

  const foot = totals
    ? [[
        { content: "TOTAIS", styles: { halign: "left" } },
        { content: "", colSpan: 6 },
        totals.normais || "—", totals.faltas || "—", totals.ex50 || "—", totals.ex100 || "—", totals.ex150 || "—", totals.dsr || "—",
      ]]
    : undefined;

  autoTable(doc, {
    startY: cursorY + 1.5,
    margin: { left: ML, right: MR, bottom: 45 },
    theme: "grid",
    head,
    body,
    foot,
    styles: {
      font: "helvetica",
      fontSize: 6,
      cellPadding: { top: 0.5, bottom: 0.5, left: 0.5, right: 0.5 },
      halign: "center",
      valign: "middle",
      lineColor: GRID,
      lineWidth: 0.1,
      textColor: DARK,
      overflow: "ellipsize",
    },
    headStyles: {
      fillColor: GREEN,
      textColor: [255, 255, 255] as RGB,
      fontStyle: "bold",
      fontSize: 5.8,
      halign: "center",
    },
    footStyles: {
      fillColor: TOTALS_BG,
      textColor: GREEN,
      fontStyle: "bold",
      fontSize: 6,
      halign: "center",
      lineColor: GRID,
      lineWidth: 0.1,
    },
    columnStyles: {
      0: { cellWidth: 22, halign: "left" },
      1: { cellWidth: 13 }, 2: { cellWidth: 13 }, 3: { cellWidth: 13 },
      4: { cellWidth: 13 }, 5: { cellWidth: 13 }, 6: { cellWidth: 13 },
      7: { cellWidth: 15 }, 8: { cellWidth: 15 }, 9: { cellWidth: 15 },
      10: { cellWidth: 15 }, 11: { cellWidth: 15 }, 12: { cellWidth: 15 },
    },
    didParseCell: (data: any) => {
      if (data.section !== "body") return;
      const meta = rowMeta[data.row.index];
      if (!meta) return;
      if (meta.bg) data.cell.styles.fillColor = meta.bg;
      // Only the COLLAPSED label cell (column 1 of a no-punch holiday/day-off row) gets the italic
      // label styling — a worked holiday/day-off renders real punches there, which must stay normal.
      if (meta.collapsed && data.column.index === 1) {
        data.cell.styles.fontStyle = "italic";
        data.cell.styles.textColor = meta.holiday ? HOLIDAY_FG : GRAY;
      }
      if (data.column.index === 8 && meta.hasFaltas) {
        data.cell.styles.textColor = ABSENCE_FG;
        data.cell.styles.fontStyle = "bold";
      }
    },
  });

  let afterTableY = doc.lastAutoTable.finalY + 3;

  // ===== Legend =====
  const drawChip = (x: number, label: string, bg: RGB, fg: RGB) => {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(6);
    const w = doc.getTextWidth(label) + 2.4;
    doc.setFillColor(...bg);
    doc.roundedRect(x, afterTableY - 2.6, w, 3.6, 0.6, 0.6, "F");
    doc.setTextColor(...fg);
    doc.text(label, x + 1.2, afterTableY);
    return x + w + 1.4;
  };
  const drawDesc = (x: number, text: string) => {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(6.4);
    doc.setTextColor(...GRAY);
    doc.text(text, x, afterTableY);
    return x + doc.getTextWidth(text) + 3;
  };
  if (afterTableY < PAGE_H - 50) {
    let lx = ML;
    lx = drawChip(lx, "Folga", [246, 246, 246], DARK);
    lx = drawDesc(lx, "sem expediente");
    lx = drawChip(lx, "Feriado", HOLIDAY_BG, HOLIDAY_FG);
    lx = drawDesc(lx, "dia não trabalhado");
    lx = drawChip(lx, "Faltas", [253, 233, 233], ABSENCE_FG);
    drawDesc(lx, "em vermelho indicam horas não trabalhadas");
  }

  // ===== Signatures (anchored near the bottom) =====
  const sigLineY = PAGE_H - 47;
  const leftCx = ML + CONTENT_W * 0.25;
  const rightCx = ML + CONTENT_W * 0.75;
  const half = CONTENT_W * 0.34 / 2;
  doc.setDrawColor(...DARK);
  doc.setLineWidth(0.3);
  doc.line(leftCx - half, sigLineY, leftCx + half, sigLineY);
  doc.line(rightCx - half, sigLineY, rightCx + half, sigLineY);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.setTextColor(...DARK);
  doc.text(userName, leftCx, sigLineY + 4, { align: "center" });
  doc.text("Responsável", rightCx, sigLineY + 4, { align: "center" });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7);
  doc.setTextColor(...GRAY);
  doc.text("Colaborador", leftCx, sigLineY + 7.5, { align: "center" });
  doc.text("Departamento Pessoal", rightCx, sigLineY + 7.5, { align: "center" });

  // ===== Footer =====
  const footY = PAGE_H - 24;
  doc.setDrawColor(...GREEN);
  doc.setLineWidth(0.4);
  doc.line(ML, footY, PAGE_W - MR, footY);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(...GREEN);
  doc.text(COMPANY_INFO.name, ML, footY + 4.5);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(...GRAY);
  doc.text(COMPANY_INFO.address, ML, footY + 9);
  doc.setTextColor(...GREEN);
  doc.text(formatPhoneWithDDD(COMPANY_INFO.phone), ML, footY + 13);
  doc.text(COMPANY_INFO.websiteUrl, ML, footY + 17);
}

export interface EspelhoRenderer {
  /** Create a fresh empty A4 portrait jsPDF document. */
  newDoc: () => any;
  /** Draw one collaborator's espelho onto the document's current page. */
  drawPage: (doc: any, item: BuildHtmlOptions) => void;
  /** Append a new blank page (call before drawing the 2nd+ collaborator). */
  addPage: (doc: any) => void;
}

/**
 * Loads jsPDF + jspdf-autotable + the logo ONCE and returns helpers to build the
 * espelho. Reuse the returned renderer across many collaborators (zip or single
 * multi-page output) so assets aren't re-fetched per document.
 */
export async function createEspelhoRenderer(): Promise<EspelhoRenderer> {
  const [{ jsPDF }, autoTableMod] = await Promise.all([import("jspdf"), import("jspdf-autotable")]);
  const autoTable = ((autoTableMod as any).default ?? autoTableMod) as Assets["autoTable"];
  const logo = await loadLogo();
  const assets: Assets = { autoTable, logo };
  return {
    newDoc: () => new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" }),
    drawPage: (doc, item) => drawEspelhoPage(doc, assets, item),
    addPage: (doc) => doc.addPage(),
  };
}
