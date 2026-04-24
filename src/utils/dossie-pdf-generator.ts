import { formatCurrency, formatDate, toTitleCase } from "./index";
import { getApiBaseUrl } from "@/config/api";
import { COMPANY_INFO, BRAND_COLORS } from "@/config/company";
import { PDFDocument, StandardFonts, rgb, PDFPage, PDFFont } from "pdf-lib";

interface ServiceOrderFiles {
  id: string;
  description: string;
  observation?: string | null;
  position?: number | null;
  checkinFiles: Array<{ id: string; filename: string; originalName?: string }>;
  checkoutFiles: Array<{ id: string; filename: string; originalName?: string }>;
}

interface ServiceItem {
  id?: string;
  description: string;
  observation?: string | null;
  amount: number;
  discountType?: string | null;
  discountValue?: number | null;
  discountReference?: string | null;
}

export interface CompleteDossiePdfOptions {
  documentTitle: string;
  budgetNumber: string;
  corporateName: string;
  contactName: string;
  serialNumber?: string | null;
  plate?: string | null;
  chassisNumber?: string | null;
  finishedAt?: string | null;
  services: ServiceItem[];
  subtotal: number;
  discountAmount: number;
  total: number;
  hasDiscount: boolean;
  discountType?: string | null;
  discountValue?: number | null;
  discountReference?: string | null;
  paymentText: string | null;
  guaranteeText: string | null;
  layoutImageUrl: string | null;
  serviceOrders: ServiceOrderFiles[];
  bankSlipPdfUrls: string[];
  nfsePdfUrls: string[];
}

// A4 in points
const W = 595.28;
const H = 841.89;
const ML = 62; // left margin
const MR = 62; // right margin
const MT = 40; // top margin
const MB = 50; // bottom margin
const CW = W - ML - MR; // content width

// Parse hex color to rgb()
function hexToRgb(hex: string) {
  const h = hex.replace('#', '');
  return rgb(parseInt(h.slice(0, 2), 16) / 255, parseInt(h.slice(2, 4), 16) / 255, parseInt(h.slice(4, 6), 16) / 255);
}

const GREEN = hexToRgb(BRAND_COLORS.primaryGreen);
const DARK = rgb(0.2, 0.2, 0.2);
const GRAY = rgb(0.33, 0.33, 0.33);
const RED = rgb(0.86, 0.15, 0.15);
const WHITE = rgb(1, 1, 1);

const C = { ...COMPANY_INFO, ...BRAND_COLORS };

async function fetchImageBytes(url: string): Promise<Uint8Array | null> {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    return new Uint8Array(await res.arrayBuffer());
  } catch {
    return null;
  }
}

async function embedImage(doc: PDFDocument, bytes: Uint8Array) {
  // Try PNG first, fall back to JPG
  try { return await doc.embedPng(bytes); } catch {}
  try { return await doc.embedJpg(bytes); } catch {}
  return null;
}

/** Draw text that wraps within maxWidth. Returns new Y position. */
function drawWrappedText(page: PDFPage, text: string, x: number, y: number, font: PDFFont, size: number, color: ReturnType<typeof rgb>, maxWidth: number): number {
  const words = text.split(' ');
  let line = '';
  let curY = y;

  for (const word of words) {
    const testLine = line ? `${line} ${word}` : word;
    const testWidth = font.widthOfTextAtSize(testLine, size);
    if (testWidth > maxWidth && line) {
      page.drawText(line, { x, y: curY, size, font, color });
      curY -= size * 1.4;
      line = word;
    } else {
      line = testLine;
    }
  }
  if (line) {
    page.drawText(line, { x, y: curY, size, font, color });
    curY -= size * 1.4;
  }
  return curY;
}

/** Draw the header (logo + title + date) and green line. Returns Y position after header. */
async function drawHeader(page: PDFPage, doc: PDFDocument, font: PDFFont, fontBold: PDFFont, budgetNumber: string, finishedAt?: string | null): Promise<number> {
  let y = H - MT;

  // Logo
  const logoBytes = await fetchImageBytes('/logo.png');
  if (logoBytes) {
    const logoImg = await embedImage(doc, logoBytes);
    if (logoImg) {
      const logoH = 42;
      const logoW = logoH * (logoImg.width / logoImg.height);
      page.drawImage(logoImg, { x: ML, y: y - logoH, width: logoW, height: logoH });
    }
  }

  // Right side: Dossiê number + date
  const titleText = `Dossiê Nº ${budgetNumber}`;
  const titleSize = 16;
  const titleW = fontBold.widthOfTextAtSize(titleText, titleSize);
  page.drawText(titleText, { x: W - MR - titleW, y: y - 14, size: titleSize, font: fontBold, color: DARK });

  const dateText = `Emissão: ${formatDate(new Date())}`;
  const dateSize = 9;
  const dateW = font.widthOfTextAtSize(dateText, dateSize);
  page.drawText(dateText, { x: W - MR - dateW, y: y - 28, size: dateSize, font, color: GRAY });

  if (finishedAt) {
    const finText = `Finalizado em: ${formatDate(finishedAt)}`;
    const finW = font.widthOfTextAtSize(finText, dateSize);
    page.drawText(finText, { x: W - MR - finW, y: y - 40, size: dateSize, font, color: GRAY });
  }

  y -= 52;

  // Green line
  page.drawRectangle({ x: ML, y, width: CW, height: 1, color: GREEN });
  y -= 16;

  return y;
}

/** Draw footer. Returns Y position of footer top (for content boundary). */
function drawFooter(page: PDFPage, font: PDFFont, fontBold: PDFFont) {
  const footerY = MB - 10;
  // Green line
  page.drawRectangle({ x: ML, y: footerY + 20, width: CW, height: 1, color: GREEN });
  page.drawText(C.name, { x: ML, y: footerY + 8, size: 10, font: fontBold, color: GREEN });
  page.drawText(C.address, { x: ML, y: footerY - 4, size: 8, font, color: GRAY });
  page.drawText(`${C.phone} | ${C.website}`, { x: ML, y: footerY - 14, size: 8, font, color: GREEN });
}

export async function exportCompleteDossiePdf(opts: CompleteDossiePdfOptions): Promise<void> {
  const apiUrl = getApiBaseUrl();
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const fontBold = await doc.embedFont(StandardFonts.HelveticaBold);

  // ═══════════════════════════════════════
  // PAGE 1: Main dossiê info
  // ═══════════════════════════════════════
  const p1 = doc.addPage([W, H]);
  let y = await drawHeader(p1, doc, font, fontBold, opts.budgetNumber, opts.finishedAt);
  drawFooter(p1, font, fontBold);

  // Title "DOSSIÊ"
  p1.drawText('DOSSIÊ', { x: ML, y, size: 14, font: fontBold, color: GREEN });
  // Underline
  const titleW = fontBold.widthOfTextAtSize('DOSSIÊ', 14);
  p1.drawRectangle({ x: ML, y: y - 2, width: titleW, height: 0.5, color: GREEN });
  y -= 24;

  // Customer name
  const contactDisplay = opts.contactName || opts.corporateName;
  p1.drawText(`À ${contactDisplay}`, { x: ML, y, size: 11, font: fontBold, color: GREEN });
  y -= 16;

  // Intro text
  let introText = 'Prezado(a) cliente, segue o dossiê referente aos serviços realizados';
  const vehicleParts: string[] = [];
  if (opts.serialNumber) vehicleParts.push(`nº de série: ${opts.serialNumber}`);
  if (opts.plate) vehicleParts.push(`placa: ${opts.plate}`);
  if (opts.chassisNumber) vehicleParts.push(`chassi: ${opts.chassisNumber}`);
  if (vehicleParts.length) introText += ` no veículo ${vehicleParts.join(', ')}`;
  introText += '.';
  y = drawWrappedText(p1, introText, ML, y, font, 10, GRAY, CW);
  y -= 12;

  // Services
  p1.drawText('Serviços Realizados', { x: ML, y, size: 12, font: fontBold, color: GREEN });
  y -= 18;

  for (let i = 0; i < opts.services.length; i++) {
    const svc = opts.services[i];
    const amount = Number(svc.amount) || 0;
    const desc = toTitleCase(svc.description || '');
    const obs = svc.observation || '';
    const isOutros = svc.description?.trim().toLowerCase() === 'outros';
    const displayDesc = isOutros && obs ? obs : obs ? `${desc} ${obs}` : desc;

    const priceText = formatCurrency(amount);

    const svcText = `${i + 1} - ${displayDesc}`;
    // Truncate if too long
    const maxDescW = CW - 80;
    let displaySvc = svcText;
    while (font.widthOfTextAtSize(displaySvc, 10) > maxDescW && displaySvc.length > 20) {
      displaySvc = displaySvc.slice(0, -1);
    }

    p1.drawText(displaySvc, { x: ML + 12, y, size: 10, font, color: DARK });
    const priceW = font.widthOfTextAtSize(priceText, 10);
    p1.drawText(priceText, { x: W - MR - priceW, y, size: 10, font, color: DARK });
    y -= 14;
  }

  y -= 8;

  // Totals
  if (opts.hasDiscount) {
    const subLabel = 'Subtotal';
    const subVal = formatCurrency(opts.subtotal);
    p1.drawText(subLabel, { x: ML + 12, y, size: 10, font, color: GRAY });
    const subW = font.widthOfTextAtSize(subVal, 10);
    p1.drawText(subVal, { x: W - MR - subW, y, size: 10, font, color: GRAY });
    y -= 14;

    let discLabel = 'Desconto';
    if (opts.discountType === 'PERCENTAGE' && opts.discountValue) {
      discLabel = `Desconto (${opts.discountValue}%)`;
    }
    if (opts.discountReference) {
      discLabel += ` — ${opts.discountReference}`;
    }
    const discVal = `- ${formatCurrency(opts.discountAmount)}`;
    p1.drawText(discLabel, { x: ML + 12, y, size: 10, font, color: RED });
    const discW = font.widthOfTextAtSize(discVal, 10);
    p1.drawText(discVal, { x: W - MR - discW, y, size: 10, font, color: RED });
    y -= 14;

    // Separator
    p1.drawRectangle({ x: ML + 12, y: y + 10, width: CW - 12, height: 0.5, color: rgb(0.85, 0.85, 0.85) });
  }

  const totalLabel = 'Total';
  const totalVal = formatCurrency(opts.total);
  p1.drawText(totalLabel, { x: ML + 12, y, size: 13, font: fontBold, color: DARK });
  const totalW = fontBold.widthOfTextAtSize(totalVal, 13);
  p1.drawText(totalVal, { x: W - MR - totalW, y, size: 13, font: fontBold, color: GREEN });
  y -= 22;

  // Payment conditions
  if (opts.paymentText) {
    p1.drawText('Condições de pagamento', { x: ML, y, size: 12, font: fontBold, color: GREEN });
    y -= 16;
    y = drawWrappedText(p1, opts.paymentText, ML, y, font, 10, GRAY, CW);
    y -= 12;
  }

  // Guarantee
  if (opts.guaranteeText) {
    p1.drawText('Garantias', { x: ML, y, size: 12, font: fontBold, color: GREEN });
    y -= 16;
    y = drawWrappedText(p1, opts.guaranteeText, ML, y, font, 10, GRAY, CW);
    y -= 12;
  }

  // Layout image
  if (opts.layoutImageUrl) {
    const layoutBytes = await fetchImageBytes(opts.layoutImageUrl);
    if (layoutBytes) {
      const layoutImg = await embedImage(doc, layoutBytes);
      if (layoutImg) {
        p1.drawText('Layout Aprovado', { x: ML, y, size: 12, font: fontBold, color: GREEN });
        y -= 16;
        const fullImgH = CW * (layoutImg.height / layoutImg.width);
        const availableH = y - (MB + 20);
        const scale = fullImgH > availableH ? availableH / fullImgH : 1;
        const imgW = CW * scale;
        const imgH = fullImgH * scale;
        p1.drawImage(layoutImg, { x: ML, y: y - imgH, width: imgW, height: imgH });
        y -= imgH + 12;
      }
    }
  }

  // ═══════════════════════════════════════
  // PAGES 2+: Dossiê Fotográfico
  // ═══════════════════════════════════════
  const validSOs = opts.serviceOrders.filter(so => (so.checkinFiles?.length || 0) > 0 || (so.checkoutFiles?.length || 0) > 0);

  let soIndex = 0;
  let soCountOnPage = 0;
  let photoPage: PDFPage | null = null;
  let py = 0;
  for (const so of validSOs) {
    // Start new page every 2 service orders
    if (!photoPage || soCountOnPage >= 2) {
      photoPage = doc.addPage([W, H]);
      py = await drawHeader(photoPage, doc, font, fontBold, opts.budgetNumber);
      drawFooter(photoPage, font, fontBold);
      if (soIndex === 0) {
        photoPage.drawText('Dossiê Fotográfico', { x: ML, y: py, size: 12, font: fontBold, color: GREEN });
        py -= 20;
      }
      soCountOnPage = 0;
    }

    // Build title
    const baseDesc = so.description === 'Outros' && so.observation ? so.observation : (so.description || 'Serviço');
    const fullDesc = so.observation && so.description !== 'Outros' ? `${baseDesc} ${so.observation}` : baseDesc;

    const cardX = ML;
    const cardW = CW;
    const cardPad = 8; // inner padding
    const contentW = cardW - cardPad * 2; // content area inside card
    const cardStartY = py;

    // Green header bar (top of card)
    const barH = 20;
    photoPage.drawRectangle({ x: cardX, y: py - barH, width: cardW, height: barH, color: GREEN });
    photoPage.drawText(fullDesc, { x: cardX + 10, y: py - barH + 6, size: 10, font: fontBold, color: WHITE });
    py -= barH + 10;

    // Photos helper — draws inside the card padding
    const drawPhotos = async (files: Array<{ id: string }>, label: string, labelColor: ReturnType<typeof rgb>) => {
      if (!files.length || !photoPage) return;

      photoPage.drawText(label, { x: cardX + cardPad, y: py, size: 8.5, font: fontBold, color: labelColor });
      py -= 4;

      const cols = Math.max(3, Math.min(files.length, 4));
      const gap = 4;
      const cellW = (contentW - (cols - 1) * gap) / cols;
      const cellH = cellW * 0.75;

      let col = 0;
      let rowH = cellH;
      for (const f of files) {
        const imgBytes = await fetchImageBytes(`${apiUrl}/files/serve/${f.id}`);
        if (imgBytes) {
          const img = await embedImage(doc, imgBytes);
          if (img && photoPage) {
            const naturalH = cellW * (img.height / img.width);
            rowH = Math.min(naturalH, cellH);
            const x = cardX + cardPad + col * (cellW + gap);
            photoPage.drawImage(img, { x, y: py - rowH, width: cellW, height: rowH });
            col++;
            if (col >= cols) { col = 0; py -= rowH + gap; }
          }
        }
      }
      if (col > 0) py -= rowH + gap;
      py -= 8;
    };

    if (so.checkinFiles?.length) await drawPhotos(so.checkinFiles, 'ANTES', rgb(0.15, 0.39, 0.92));
    if (so.checkoutFiles?.length) await drawPhotos(so.checkoutFiles, 'DEPOIS', rgb(0.09, 0.64, 0.26));

    py -= 4;

    // Draw card border (rectangle around the entire service order block)
    const cardH = cardStartY - py;
    photoPage.drawRectangle({
      x: cardX,
      y: py,
      width: cardW,
      height: cardH,
      borderColor: rgb(0.85, 0.85, 0.85),
      borderWidth: 0.75,
      color: undefined,
    } as any);

    py -= 16; // spacing between cards
    soCountOnPage++;
    soIndex++;
  }

  // ═══════════════════════════════════════
  // PAGES N+: Bank slip PDFs (real PDF pages — selectable)
  // ═══════════════════════════════════════
  for (const url of opts.bankSlipPdfUrls) {
    try {
      const res = await fetch(url);
      if (!res.ok) continue;
      const srcDoc = await PDFDocument.load(await res.arrayBuffer());
      const pages = await doc.copyPages(srcDoc, srcDoc.getPageIndices());
      pages.forEach(p => doc.addPage(p));
    } catch { /* skip */ }
  }

  // ═══════════════════════════════════════
  // PAGES N+: NFS-e PDFs (real PDF pages — selectable)
  // ═══════════════════════════════════════
  for (const url of opts.nfsePdfUrls) {
    try {
      const res = await fetch(url);
      if (!res.ok) continue;
      const srcDoc = await PDFDocument.load(await res.arrayBuffer());
      const pages = await doc.copyPages(srcDoc, srcDoc.getPageIndices());
      pages.forEach(p => doc.addPage(p));
    } catch { /* skip */ }
  }

  // ═══════════════════════════════════════
  // Download
  // ═══════════════════════════════════════
  const pdfBytes = await doc.save();
  const blob = new Blob([pdfBytes.buffer as ArrayBuffer], { type: 'application/pdf' });
  const downloadUrl = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = downloadUrl;
  a.download = `${opts.documentTitle}.pdf`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(downloadUrl);
}

/** Legacy export */
export async function exportDossiePdf(opts: { taskDisplayName: string; customerName?: string; serialNumber?: string | null; plate?: string | null; serviceOrders: ServiceOrderFiles[] }): Promise<void> {
  await exportCompleteDossiePdf({
    documentTitle: opts.taskDisplayName, budgetNumber: '0000', corporateName: opts.customerName || '', contactName: '',
    serialNumber: opts.serialNumber, plate: opts.plate, chassisNumber: null, finishedAt: null,
    services: [], subtotal: 0, discountAmount: 0, total: 0, hasDiscount: false,
    paymentText: null, guaranteeText: null, layoutImageUrl: null, serviceOrders: opts.serviceOrders,
    bankSlipPdfUrls: [], nfsePdfUrls: [],
  });
}
