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
  truckCategory?: string | null;
  truckImplementType?: string | null;
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
const MT = 28; // top margin (tightened from 40 — was too much whitespace above header)
const MB = 50; // bottom margin
const CW = W - ML - MR; // content width
const CARD_RADIUS = 6; // SO card / title-bar corner radius

/** SVG path with all four corners rounded. SVG uses Y-down. */
function roundedRectAllPath(w: number, h: number, r: number): string {
  return [
    `M ${r} 0`,
    `L ${w - r} 0`,
    `A ${r} ${r} 0 0 1 ${w} ${r}`,
    `L ${w} ${h - r}`,
    `A ${r} ${r} 0 0 1 ${w - r} ${h}`,
    `L ${r} ${h}`,
    `A ${r} ${r} 0 0 1 0 ${h - r}`,
    `L 0 ${r}`,
    `A ${r} ${r} 0 0 1 ${r} 0`,
    'Z',
  ].join(' ');
}

/** SVG path with only the bottom corners rounded (top is square). */
function roundedRectBottomPath(w: number, h: number, r: number): string {
  return [
    `M 0 0`,
    `L ${w} 0`,
    `L ${w} ${h - r}`,
    `A ${r} ${r} 0 0 1 ${w - r} ${h}`,
    `L ${r} ${h}`,
    `A ${r} ${r} 0 0 1 0 ${h - r}`,
    'Z',
  ].join(' ');
}

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

/** Measure how tall a wrapped text block will be without drawing it.
 *  Used by the adaptive layout planner to know what slack remains. */
function measureWrappedHeight(text: string, font: PDFFont, size: number, maxWidth: number): number {
  if (!text) return 0;
  const words = text.split(' ');
  let line = '';
  let lines = 0;
  for (const word of words) {
    const testLine = line ? `${line} ${word}` : word;
    if (font.widthOfTextAtSize(testLine, size) > maxWidth && line) {
      lines += 1;
      line = word;
    } else {
      line = testLine;
    }
  }
  if (line) lines += 1;
  return lines * size * 1.4;
}

/** Clamp a value into [min, max]. */
const clamp = (n: number, min: number, max: number) => Math.max(min, Math.min(max, n));

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

  y -= 46;

  // Green line
  page.drawRectangle({ x: ML, y, width: CW, height: 1, color: GREEN });
  y -= 16;

  return y;
}

/** Format a Brazilian phone like "43 9 8428-3228" → "(43) 9 8428-3228". Idempotent. */
function formatPhoneWithDDD(phone: string): string {
  if (!phone) return '';
  if (phone.startsWith('(')) return phone;
  const m = phone.match(/^(\d{2})\s+(.+)$/);
  return m ? `(${m[1]}) ${m[2]}` : phone;
}

/** Strip protocol from a URL for tighter display: "https://x.com" → "x.com". */
function stripProtocol(url: string): string {
  return (url || '').replace(/^https?:\/\//i, '');
}

/** Y of the top of the footer band — content must stop above this.
 *  Footer now has 4 stacked rows (line, name, address, phone, website) so we
 *  reserve a bit more vertical room than before. */
const FOOTER_TOP_Y = MB + 38;

/** Draw footer. Phone and website are on separate rows for clarity. */
function drawFooter(page: PDFPage, font: PDFFont, fontBold: PDFFont) {
  // Anchor the green line slightly higher so the 4 stacked rows fit comfortably
  // above the page edge without crowding.
  const lineY = MB + 26;
  page.drawRectangle({ x: ML, y: lineY, width: CW, height: 1, color: GREEN });
  page.drawText(C.name, { x: ML, y: lineY - 14, size: 10, font: fontBold, color: GREEN });
  page.drawText(C.address, { x: ML, y: lineY - 26, size: 8, font, color: GRAY });
  const phoneFmt = formatPhoneWithDDD(C.phone);
  page.drawText(phoneFmt, { x: ML, y: lineY - 38, size: 8, font, color: GREEN });
  page.drawText(C.websiteUrl || `https://${stripProtocol(C.website)}`, {
    x: ML,
    y: lineY - 50,
    size: 8,
    font,
    color: GREEN,
  });
}

export async function exportCompleteDossiePdf(opts: CompleteDossiePdfOptions): Promise<void> {
  const apiUrl = getApiBaseUrl();
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const fontBold = await doc.embedFont(StandardFonts.HelveticaBold);

  // ═══════════════════════════════════════
  // PAGE 1: Main dossiê info — adaptive layout
  // ═══════════════════════════════════════
  // Strategy:
  //  1. Build the intro text and measure heights of every section that will render.
  //  2. Subtract the mandatory content from the available content area to get "slack".
  //  3. Distribute slack as inter-section padding (clamped to comfortable min/max),
  //     so a short dossier fills the page nicely and a packed dossier still fits.
  //  4. Render with the computed paddings.
  //
  // Spacing buckets that consume slack (in priority order):
  //  - inter-service spacing (visual breath between line items)
  //  - inter-section spacing (between the major blocks)
  //  - pre-/post-separator spacing in the totals block (this is the
  //    cramped area in the original layout and gets first claim on slack)

  const p1 = doc.addPage([W, H]);
  let y = await drawHeader(p1, doc, font, fontBold, opts.budgetNumber, opts.finishedAt);
  drawFooter(p1, font, fontBold);

  // Build intro text up-front so we can measure it.
  let introText = 'Prezado(a) cliente, segue o dossiê referente aos serviços realizados';
  const vehicleParts: string[] = [];
  if (opts.serialNumber) vehicleParts.push(`nº de série: ${opts.serialNumber}`);
  if (opts.plate) vehicleParts.push(`placa: ${opts.plate}`);
  if (opts.chassisNumber) vehicleParts.push(`chassi: ${opts.chassisNumber}`);
  if (opts.truckCategory) vehicleParts.push(`categoria: ${opts.truckCategory}`);
  if (opts.truckImplementType) vehicleParts.push(`implemento: ${opts.truckImplementType}`);
  if (vehicleParts.length) introText += ` no veículo ${vehicleParts.join(', ')}`;
  introText += '.';

  // Pre-truncate service rows so we know their final width.
  const renderedServices = opts.services.map((svc, i) => {
    const desc = toTitleCase(svc.description || '');
    const obs = svc.observation || '';
    const isOutros = svc.description?.trim().toLowerCase() === 'outros';
    const displayDesc = isOutros && obs ? obs : obs ? `${desc} ${obs}` : desc;
    let displaySvc = `${i + 1} - ${displayDesc}`;
    const maxDescW = CW - 80;
    while (font.widthOfTextAtSize(displaySvc, 10) > maxDescW && displaySvc.length > 20) {
      displaySvc = displaySvc.slice(0, -1);
    }
    return { displaySvc, priceText: formatCurrency(Number(svc.amount) || 0) };
  });

  // Mandatory section heights (text lines only; padding distributed below).
  const titleH = 14 + 2;                              // "DOSSIÊ" + 0.5pt underline
  const salutationH = opts.contactName ? 14 : 0;      // 11pt × 1.4 ≈ 14pt
  const introH = measureWrappedHeight(introText, font, 10, CW);
  const servicesHeaderH = 12;
  const servicesH = renderedServices.length * 12;     // 10pt text, padding added separately
  const totalsBlockH =
    (opts.hasDiscount ? 12 + 12 + 1 : 0) + // subtotal + discount + separator (1pt)
    13;                                    // Total at 13pt
  const paymentH = opts.paymentText
    ? 13 + measureWrappedHeight(opts.paymentText, font, 10, CW)
    : 0;
  const guaranteeH = opts.guaranteeText
    ? 13 + measureWrappedHeight(opts.guaranteeText, font, 10, CW)
    : 0;
  // Layout image gets whatever vertical space is left after every other section
  // (capped to its natural ratio at the assigned width). Reserve a minimum.
  const minLayoutImgH = opts.layoutImageUrl ? 80 : 0;

  // Number of inter-section gaps (inserted between every pair of present sections).
  const sectionsPresent = [
    true,                       // title
    !!opts.contactName,         // salutation
    introH > 0,                 // intro
    true,                       // services header
    renderedServices.length > 0, // services block
    true,                       // totals block
    !!opts.paymentText,         // payment
    !!opts.guaranteeText,       // guarantee
    !!opts.layoutImageUrl,      // layout image
  ].filter(Boolean).length;
  const interSectionGapCount = Math.max(0, sectionsPresent - 1);

  const mandatoryH =
    titleH + salutationH + introH + servicesHeaderH + servicesH +
    totalsBlockH + paymentH + guaranteeH + minLayoutImgH;

  const availableH = y - FOOTER_TOP_Y;
  // Totals-block clearances (must be larger than the cap-height of the next
  // baseline so the rule doesn't draw through the next text).
  const PRE_SEP_MIN = 8;   // gap below the Discount line before the rule
  const POST_SEP_MIN = 16; // gap above the Total baseline; > 13pt-bold cap-height (~9.4pt)

  // Spacing strategy:
  // - "tight" pads for typographic pairs (title↔salutation↔intro). Letter-format
  //   pages keep these visually close even when the page has lots of slack.
  // - "section" pads for major breaks (intro→services, services→totals,
  //   totals→payment, payment→guarantee, guarantee→layout). These absorb slack.
  // - When a layout image is present, the image itself absorbs most of the slack
  //   (it grows to fill the leftover vertical space), so we cap section pad lower.
  const layoutImagePresent = !!opts.layoutImageUrl;
  const TIGHT_PAD = 10;                              // title↔salutation↔intro
  const SECTION_MAX = layoutImagePresent ? 14 : 22;  // looser when no image to fill space
  const SECTION_MIN = 12;

  // Count "tight" gaps that exist (title→salutation when contactName, salutation→intro
  // when both are present, otherwise title→intro counts as one tight pair).
  const tightGapCount =
    (opts.contactName ? 1 : 0) +   // title → salutation
    (opts.contactName && introH > 0 ? 1 : 0) + // salutation → intro
    (!opts.contactName && introH > 0 ? 1 : 0); // title → intro
  const sectionGapCount = Math.max(0, interSectionGapCount - tightGapCount);

  const cramFloor =
    (interSectionGapCount * SECTION_MIN) +
    (opts.hasDiscount ? PRE_SEP_MIN + POST_SEP_MIN : 0);
  const fixedTightSpace = tightGapCount * TIGHT_PAD;
  const slack = Math.max(0, availableH - mandatoryH - cramFloor - fixedTightSpace);

  // Tiny inter-service breath so service lines don't feel jammed even when slack
  // is small. Cap at 2pt so long lists stay compact.
  const serviceCount = Math.max(1, renderedServices.length);
  const interServicePad = clamp(slack * 0.08 / serviceCount, 0, 2);
  const remainingSlack = slack - interServicePad * serviceCount;
  const sectionPad = sectionGapCount > 0
    ? clamp(SECTION_MIN + remainingSlack / sectionGapCount, SECTION_MIN, SECTION_MAX)
    : SECTION_MIN;

  // Title "DOSSIÊ"
  p1.drawText('DOSSIÊ', { x: ML, y, size: 14, font: fontBold, color: GREEN });
  const titleW = fontBold.widthOfTextAtSize('DOSSIÊ', 14);
  p1.drawRectangle({ x: ML, y: y - 2, width: titleW, height: 0.5, color: GREEN });
  y -= titleH + TIGHT_PAD;

  if (opts.contactName) {
    p1.drawText(`À ${opts.contactName}`, { x: ML, y, size: 11, font: fontBold, color: GREEN });
    y -= salutationH + TIGHT_PAD;
  }

  // Intro paragraph — closes the letter-format header.
  y = drawWrappedText(p1, introText, ML, y, font, 10, GRAY, CW);
  y -= sectionPad;

  // Services header — tighter to its list (caption-style).
  p1.drawText('Serviços Realizados', { x: ML, y, size: 12, font: fontBold, color: GREEN });
  y -= servicesHeaderH + clamp(sectionPad * 0.5, 6, 12);

  // Service items
  for (const svc of renderedServices) {
    p1.drawText(svc.displaySvc, { x: ML + 12, y, size: 10, font, color: DARK });
    const priceW = font.widthOfTextAtSize(svc.priceText, 10);
    p1.drawText(svc.priceText, { x: W - MR - priceW, y, size: 10, font, color: DARK });
    y -= 12 + interServicePad; // 12pt line + adaptive breath
  }

  // Pre-totals breath (small, since totals follow services as a unit)
  y -= clamp(sectionPad * 0.5, 6, 12);

  // Totals — fixed comfortable spacing here; this is the previously cramped area.
  if (opts.hasDiscount) {
    const subVal = formatCurrency(opts.subtotal);
    p1.drawText('Subtotal', { x: ML + 12, y, size: 10, font, color: GRAY });
    const subW = font.widthOfTextAtSize(subVal, 10);
    p1.drawText(subVal, { x: W - MR - subW, y, size: 10, font, color: GRAY });
    y -= 14;

    let discLabel = 'Desconto';
    if (opts.discountType === 'PERCENTAGE' && opts.discountValue) {
      discLabel = `Desconto (${opts.discountValue}%)`;
    }
    if (opts.discountReference) discLabel += ` — ${opts.discountReference}`;
    const discVal = `- ${formatCurrency(opts.discountAmount)}`;
    p1.drawText(discLabel, { x: ML + 12, y, size: 10, font, color: RED });
    const discW = font.widthOfTextAtSize(discVal, 10);
    p1.drawText(discVal, { x: W - MR - discW, y, size: 10, font, color: RED });

    // Pre-separator breath, then the rule, then post-separator breath, then Total.
    y -= 12 + PRE_SEP_MIN;
    p1.drawRectangle({ x: ML + 12, y, width: CW - 12, height: 0.5, color: rgb(0.85, 0.85, 0.85) });
    y -= POST_SEP_MIN;
  } else {
    y -= 4;
  }

  // Total row — anchor baseline at y for the largest text on the page.
  const totalVal = formatCurrency(opts.total);
  p1.drawText('Total', { x: ML + 12, y, size: 13, font: fontBold, color: DARK });
  const totalW = fontBold.widthOfTextAtSize(totalVal, 13);
  p1.drawText(totalVal, { x: W - MR - totalW, y, size: 13, font: fontBold, color: GREEN });
  y -= 13 + sectionPad;

  // Payment conditions
  if (opts.paymentText) {
    p1.drawText('Condições de pagamento', { x: ML, y, size: 12, font: fontBold, color: GREEN });
    y -= 14;
    y = drawWrappedText(p1, opts.paymentText, ML, y, font, 10, GRAY, CW);
    y -= sectionPad;
  }

  // Guarantee
  if (opts.guaranteeText) {
    p1.drawText('Garantias', { x: ML, y, size: 12, font: fontBold, color: GREEN });
    y -= 14;
    y = drawWrappedText(p1, opts.guaranteeText, ML, y, font, 10, GRAY, CW);
    y -= sectionPad;
  }

  // Layout image — uses whatever vertical space is left, contains aspect ratio,
  // and centers horizontally inside the content column.
  if (opts.layoutImageUrl) {
    const layoutBytes = await fetchImageBytes(opts.layoutImageUrl);
    if (layoutBytes) {
      const layoutImg = await embedImage(doc, layoutBytes);
      if (layoutImg) {
        p1.drawText('Layout Aprovado', { x: ML, y, size: 12, font: fontBold, color: GREEN });
        y -= 16;
        const availableImgH = y - FOOTER_TOP_Y;
        const naturalRatio = layoutImg.width / layoutImg.height;
        let drawW = CW;
        let drawH = CW / naturalRatio;
        if (drawH > availableImgH) {
          drawH = availableImgH;
          drawW = availableImgH * naturalRatio;
        }
        const offsetX = (CW - drawW) / 2;
        p1.drawImage(layoutImg, { x: ML + offsetX, y: y - drawH, width: drawW, height: drawH });
        y -= drawH;
      }
    }
  }

  // ═══════════════════════════════════════
  // PAGES 2+: Dossiê Fotográfico
  // ═══════════════════════════════════════
  const validSOs = opts.serviceOrders.filter(so => (so.checkinFiles?.length || 0) > 0 || (so.checkoutFiles?.length || 0) > 0);

  // ─────────────────────────────────────────────────────────────────────────
  // Photo pages — one SO per page. Antes/Depois split the page content
  // equally and photos are bounded inside their slot (object-fit: contain),
  // so they never overflow the footer regardless of natural aspect ratio.
  // ─────────────────────────────────────────────────────────────────────────

  for (let soIndex = 0; soIndex < validSOs.length; soIndex++) {
    const so = validSOs[soIndex];

    const photoPage = doc.addPage([W, H]);
    let py = await drawHeader(photoPage, doc, font, fontBold, opts.budgetNumber);
    drawFooter(photoPage, font, fontBold);
    if (soIndex === 0) {
      photoPage.drawText('Dossiê Fotográfico', { x: ML, y: py, size: 12, font: fontBold, color: GREEN });
      py -= 20;
    }

    const baseDesc = so.description === 'Outros' && so.observation ? so.observation : (so.description || 'Serviço');
    const fullDesc = so.observation && so.description !== 'Outros' ? `${baseDesc} ${so.observation}` : baseDesc;

    const cardX = ML;
    const cardW = CW;
    const cardPad = 8;
    const contentW = cardW - cardPad * 2;
    const cardStartY = py;

    // Draw the SO card as one unified rounded shape:
    //   1. Whole card filled green with all-corner rounding + gray border.
    //   2. White rectangle overlaying the body (below the bar) with rounded
    //      bottom corners only — this hides the green except for the title bar.
    // Because both fills are clipped by the same outer card shape, the green
    // bar's corners cannot drift from the card border's corners.
    const barH = 20;
    const cardBottom = FOOTER_TOP_Y;
    const fullCardH = cardStartY - cardBottom;
    const bodyH = fullCardH - barH;

    photoPage.drawSvgPath(roundedRectAllPath(cardW, fullCardH, CARD_RADIUS), {
      x: cardX,
      y: cardStartY,
      color: GREEN,
      borderColor: rgb(0.85, 0.85, 0.85),
      borderWidth: 0.75,
    });
    photoPage.drawSvgPath(roundedRectBottomPath(cardW, bodyH, CARD_RADIUS), {
      x: cardX,
      y: cardStartY - barH,
      color: rgb(1, 1, 1),
      borderWidth: 0,
    });

    photoPage.drawText(fullDesc, { x: cardX + 10, y: py - barH + 6, size: 10, font: fontBold, color: WHITE });
    py -= barH + 10;

    // Compute slot heights for Antes / Depois inside this card.
    const checkinCount = so.checkinFiles?.length || 0;
    const checkoutCount = so.checkoutFiles?.length || 0;
    const sectionsCount = (checkinCount > 0 ? 1 : 0) + (checkoutCount > 0 ? 1 : 0);
    const labelH = 12;
    const postLabelGap = 6;
    const interSectionGap = 14; // breathing room between Antes's last photo and the DEPOIS label
    const cardContentBottom = FOOTER_TOP_Y;
    const interSectionTotal = Math.max(0, sectionsCount - 1) * interSectionGap;
    const photosTotalH = (py - cardContentBottom) - sectionsCount * (labelH + postLabelGap) - interSectionTotal - 4;
    const perSlotH = sectionsCount > 0 ? photosTotalH / sectionsCount : 0;

    const drawPhotosInSlot = async (files: { id: string }[], label: string, labelColor: ReturnType<typeof rgb>, slotH: number) => {
      if (!files.length || slotH <= 20) return;

      photoPage.drawText(label, { x: cardX + cardPad, y: py, size: 8.5, font: fontBold, color: labelColor });
      py -= labelH;

      const cols = files.length === 1 ? 1 : 2;
      const gap = 6;
      const cellW = (contentW - (cols - 1) * gap) / cols;
      const rows = Math.ceil(files.length / cols);
      const cellH = (slotH - (rows - 1) * gap) / rows;

      for (let i = 0; i < files.length; i += cols) {
        const rowFiles = files.slice(i, i + cols);
        for (let c = 0; c < rowFiles.length; c++) {
          const f = rowFiles[c];
          const imgBytes = await fetchImageBytes(`${apiUrl}/files/serve/${f.id}`);
          if (!imgBytes) continue;
          const img = await embedImage(doc, imgBytes);
          if (!img) continue;
          const ratio = img.width / img.height;
          let drawW = cellW;
          let drawH = cellW / ratio;
          if (drawH > cellH) {
            drawH = cellH;
            drawW = cellH * ratio;
          }
          const cellX = cardX + cardPad + c * (cellW + gap);
          photoPage.drawImage(img, { x: cellX, y: py - drawH, width: drawW, height: drawH });
        }
        py -= cellH + gap;
      }
      py -= postLabelGap;
    };

    if (checkinCount > 0) await drawPhotosInSlot(so.checkinFiles, 'ANTES', rgb(0.15, 0.39, 0.92), perSlotH);
    if (checkinCount > 0 && checkoutCount > 0) py -= interSectionGap;
    if (checkoutCount > 0) await drawPhotosInSlot(so.checkoutFiles, 'DEPOIS', rgb(0.09, 0.64, 0.26), perSlotH);

    // Card border + green bar are already drawn at the top of the loop using a
    // single unified shape, so nothing else to do here.
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
export async function exportDossiePdf(opts: { taskDisplayName: string; customerName?: string; serialNumber?: string | null; plate?: string | null; truckCategory?: string | null; truckImplementType?: string | null; serviceOrders: ServiceOrderFiles[] }): Promise<void> {
  await exportCompleteDossiePdf({
    documentTitle: opts.taskDisplayName, budgetNumber: '0000', corporateName: opts.customerName || '', contactName: '',
    serialNumber: opts.serialNumber, plate: opts.plate, chassisNumber: null,
    truckCategory: opts.truckCategory ?? null, truckImplementType: opts.truckImplementType ?? null,
    finishedAt: null,
    services: [], subtotal: 0, discountAmount: 0, total: 0, hasDiscount: false,
    paymentText: null, guaranteeText: null, layoutImageUrl: null, serviceOrders: opts.serviceOrders,
    bankSlipPdfUrls: [], nfsePdfUrls: [],
  });
}
