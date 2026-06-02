import {
  PDFDocument,
  StandardFonts,
  rgb,
  pushGraphicsState,
  popGraphicsState,
  scale,
  type PDFFont,
} from "pdf-lib";

// =====================================================================
// Certificado de Coleta e Destinação de Resíduos Industriais
// Pixel-faithful recreation of the UNICOR certificate (single A4 page).
// Variable fields: issue date, period (start/end), description, volume.
// Everything else (issuer, generator, signer, footer) is fixed to match
// the original document.
// =====================================================================

export interface WasteCertificateData {
  date: Date; // issue date
  periodStart: Date;
  periodEnd: Date;
  description: string; // e.g. "RESÍDUOS LIQUIDO CLASSE I"
  volume: string; // e.g. "792L"
}

// --- A4 in points ---
const PAGE_W = 595.28;
const PAGE_H = 841.89;
const MARGIN = 56;

const MONTHS_PT = [
  "Janeiro",
  "Fevereiro",
  "Março",
  "Abril",
  "Maio",
  "Junho",
  "Julho",
  "Agosto",
  "Setembro",
  "Outubro",
  "Novembro",
  "Dezembro",
];

const pad2 = (n: number) => String(n).padStart(2, "0");

const formatIssueDate = (d: Date) =>
  `Cambé,${d.getDate()} de ${MONTHS_PT[d.getMonth()]} de ${d.getFullYear()}.`;

const formatShortDate = (d: Date) =>
  `${pad2(d.getDate())}/${pad2(d.getMonth() + 1)}/${String(d.getFullYear()).slice(-2)}`;

// A run of text with a bold flag — used to build the justified body paragraph.
interface Run {
  text: string;
  bold: boolean;
}

interface Word {
  text: string;
  bold: boolean;
  width: number;
}

export async function generateWasteCertificatePdf(data: WasteCertificateData): Promise<Blob> {
  const doc = await PDFDocument.create();
  const page = doc.addPage([PAGE_W, PAGE_H]);

  const regular = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const boldItalic = await doc.embedFont(StandardFonts.HelveticaBoldOblique);
  const black = rgb(0, 0, 0);

  const textWidth = (t: string, f: PDFFont, size: number) => f.widthOfTextAtSize(t, size);

  const drawCentered = (t: string, f: PDFFont, size: number, yTop: number, color = black) => {
    const w = textWidth(t, f, size);
    page.drawText(t, { x: (PAGE_W - w) / 2, y: PAGE_H - yTop - size, size, font: f, color });
  };

  const drawRight = (t: string, f: PDFFont, size: number, yTop: number, rightX: number) => {
    const w = textWidth(t, f, size);
    page.drawText(t, { x: rightX - w, y: PAGE_H - yTop - size, size, font: f, color: black });
  };

  // ---- Header: UNICOR logotype ----
  // The original uses a condensed bold-italic face; emulate the tall/narrow
  // look by horizontally scaling Helvetica-BoldOblique (height unchanged).
  const drawCondensedCentered = (
    t: string,
    f: PDFFont,
    size: number,
    yTop: number,
    scaleX: number,
  ) => {
    const scaledWidth = textWidth(t, f, size) * scaleX;
    const x = (PAGE_W - scaledWidth) / 2;
    const y = PAGE_H - yTop - size;
    page.pushOperators(pushGraphicsState(), scale(scaleX, 1));
    page.drawText(t, { x: x / scaleX, y, size, font: f, color: black });
    page.pushOperators(popGraphicsState());
  };

  // Taller + narrower to match the original condensed logotype.
  drawCondensedCentered("UNICOR", boldItalic, 44, 52, 0.64);
  drawCentered("INDUSTRIA E COMERCIO DE TINTAS LTDA - ME", bold, 11, 102);

  // ---- Title ----
  page.drawText("CERTIFICADO DE COLETA E DESTINAÇÃO DE RESÍDUOS INDUSTRIAIS", {
    x: MARGIN,
    y: PAGE_H - 175 - 15,
    size: 14.5,
    font: bold,
    color: black,
  });

  // ---- Issue date (right-aligned) ----
  drawRight(formatIssueDate(data.date), regular, 12, 235, PAGE_W - MARGIN);

  // ---- Body paragraph (justified, mixed bold/regular) ----
  const bodyRuns: Run[] = [
    { text: "UNICOR  - Industria e Comércio de Tintas LTDA", bold: true },
    {
      text: ", localizada na rua Antônio Gupioio Sampaio, 53 - Parque Industrial Cambé - CEP 86181-345 Cambé PR, registrada no CNPJ 02.374.297/0001-80, licenciada no Instituto Ambiental do Paraná conforme nº 21185, certifica que realizou a coleta e o encaminhamento dos resíduos classe: Tinta PVC, Tinta Poliester, Desengraxantes e Thinner para reciclagem dos resíduos gerado por ",
      bold: false,
    },
    { text: "S. RODRIGUES & G. RODRIGUES LTDA", bold: true },
    {
      text: ", CNPJ 13.636.938/0001-44 situada na rua Luiz Carlos Zanni nº 2493 Jardim Santa Paula, Ibiporã PR.",
      bold: false,
    },
  ];

  const bodyLeft = 85;
  const bodyRight = PAGE_W - 85;
  const bodyWidth = bodyRight - bodyLeft;
  const bodySize = 12;
  const lineHeight = 19;
  const spaceWidthRegular = textWidth(" ", regular, bodySize);

  // Tokenize runs into words (each word keeps its boldness).
  const words: Word[] = [];
  for (const run of bodyRuns) {
    const f = run.bold ? bold : regular;
    const parts = run.text.split(" ");
    parts.forEach((p, i) => {
      // Preserve empty tokens only when they separate words inside a run.
      if (p === "" && i !== 0 && i !== parts.length - 1) return;
      if (p === "") return;
      words.push({ text: p, bold: run.bold, width: textWidth(p, f, bodySize) });
    });
  }

  // Greedy line-wrap.
  const lines: Word[][] = [];
  let current: Word[] = [];
  let currentWidth = 0;
  for (const w of words) {
    const extra = current.length === 0 ? 0 : spaceWidthRegular;
    if (currentWidth + extra + w.width > bodyWidth && current.length > 0) {
      lines.push(current);
      current = [w];
      currentWidth = w.width;
    } else {
      current.push(w);
      currentWidth += extra + w.width;
    }
  }
  if (current.length > 0) lines.push(current);

  let bodyTop = 270;
  lines.forEach((line, idx) => {
    const isLast = idx === lines.length - 1;
    const naturalWidth = line.reduce((sum, w) => sum + w.width, 0);
    const gaps = line.length - 1;
    let gap = spaceWidthRegular;
    if (!isLast && gaps > 0) {
      gap = (bodyWidth - naturalWidth) / gaps;
    }
    let x = bodyLeft;
    const y = PAGE_H - bodyTop - bodySize;
    line.forEach((w, i) => {
      page.drawText(w.text, { x, y, size: bodySize, font: w.bold ? bold : regular, color: black });
      x += w.width + (i < line.length - 1 ? gap : 0);
    });
    bodyTop += lineHeight;
  });

  // ---- Table: PERÍODO | DESCRIÇÃO | VOLUME ----
  const tableLeft = 52;
  const colWidths = [120, 288, 84];
  const tableWidth = colWidths.reduce((a, b) => a + b, 0);
  const headerH = 26;
  const rowH = 26;
  const tableTop = 470; // distance from top to the top edge of the header row
  const colX = [tableLeft, tableLeft + colWidths[0], tableLeft + colWidths[0] + colWidths[1]];

  const drawCellText = (
    t: string,
    f: PDFFont,
    size: number,
    cellIndex: number,
    rowTopY: number,
    cellH: number,
  ) => {
    const w = textWidth(t, f, size);
    const x = colX[cellIndex] + (colWidths[cellIndex] - w) / 2;
    const y = PAGE_H - rowTopY - cellH / 2 - size / 2 + 1;
    page.drawText(t, { x, y, size, font: f, color: black });
  };

  const drawTableBorders = (rowTopY: number, cellH: number) => {
    // outer rectangle for the row
    page.drawRectangle({
      x: tableLeft,
      y: PAGE_H - rowTopY - cellH,
      width: tableWidth,
      height: cellH,
      borderColor: black,
      borderWidth: 1,
      color: undefined,
    });
    // vertical separators
    page.drawLine({
      start: { x: colX[1], y: PAGE_H - rowTopY },
      end: { x: colX[1], y: PAGE_H - rowTopY - cellH },
      thickness: 1,
      color: black,
    });
    page.drawLine({
      start: { x: colX[2], y: PAGE_H - rowTopY },
      end: { x: colX[2], y: PAGE_H - rowTopY - cellH },
      thickness: 1,
      color: black,
    });
  };

  // Header row
  drawTableBorders(tableTop, headerH);
  drawCellText("PERÍODO", bold, 11, 0, tableTop, headerH);
  drawCellText("DESCRIÇÃO", bold, 11, 1, tableTop, headerH);
  drawCellText("VOLUME:", bold, 11, 2, tableTop, headerH);

  // Data row
  const dataTop = tableTop + headerH;
  drawTableBorders(dataTop, rowH);
  const periodText = `${formatShortDate(data.periodStart)} à ${formatShortDate(data.periodEnd)}`;
  drawCellText(periodText, regular, 10.5, 0, dataTop, rowH);
  drawCellText(data.description, regular, 11, 1, dataTop, rowH);
  drawCellText(data.volume, regular, 11, 2, dataTop, rowH);

  // ---- Signature ----
  const sigLineY = 700;
  const sigLineWidth = 210;
  const sigLineX = (PAGE_W - sigLineWidth) / 2;
  page.drawLine({
    start: { x: sigLineX, y: PAGE_H - sigLineY },
    end: { x: sigLineX + sigLineWidth, y: PAGE_H - sigLineY },
    thickness: 1,
    color: black,
  });
  drawCentered("Marcos Antonio Dutra", regular, 12, sigLineY + 6);

  // ---- Footer ----
  drawCentered(
    "Rua Antônio Elpidio Sampaio, 53 - Centro - Cambé PR  |  43 99632335",
    regular,
    11,
    PAGE_H - 60,
  );

  const bytes = await doc.save();
  return new Blob([bytes.buffer as ArrayBuffer], { type: "application/pdf" });
}

export function buildCertificateFilename(data: WasteCertificateData): string {
  const m = pad2(data.date.getMonth() + 1);
  const y = data.date.getFullYear();
  return `CERTIFICADO_DESTINACAO_RESIDUOS_${m}-${y}.pdf`;
}

export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/**
 * Download a stored file by fetching its bytes and saving them as a blob.
 * Works in dev and prod alike (avoids Content-Disposition / X-Accel-Redirect
 * download-manager pitfalls). Uses the same /files/serve endpoint the preview
 * already loads successfully.
 */
export async function downloadStoredPdf(
  apiBaseUrl: string,
  fileId: string,
  filename: string,
): Promise<void> {
  const resp = await fetch(`${apiBaseUrl}/files/serve/${fileId}`);
  if (!resp.ok) throw new Error(`Falha ao baixar o arquivo (${resp.status}).`);
  const blob = await resp.blob();
  downloadBlob(blob, filename);
}

/** Build a friendly download filename from a stored certificate's date. */
export function certificateFilenameFromDate(dateIso?: string | Date | null): string {
  const d = dateIso ? new Date(dateIso) : null;
  if (d && !Number.isNaN(d.getTime())) {
    return `CERTIFICADO_DESTINACAO_RESIDUOS_${pad2(d.getMonth() + 1)}-${d.getFullYear()}.pdf`;
  }
  return "certificado-residuos.pdf";
}
