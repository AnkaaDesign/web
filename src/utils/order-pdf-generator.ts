import { formatCurrency, formatDate } from "./index";
import { COMPANY_INFO, BRAND_COLORS } from "@/config/company";

/**
 * Shared, branded PDF generator for a single purchase order ("Pedido de Compra").
 *
 * Used by the order detail view and the create/edit forms so every order document
 * looks identical and professional. Modeled on the budget PDF generator
 * (src/utils/budget-pdf-generator.ts): centralized company branding + brand colors.
 *
 * IMPORTANT: the print stylesheet uses `@page { margin: 0 }`. This is what removes
 * the browser's own print header/footer (page URL, date, title, page number) that
 * was previously bleeding into the order PDF. Page padding is handled by `.sheet`.
 */

export interface OrderPdfLineItem {
  code: string;
  name: string;
  brand?: string;
  measures?: string;
  quantity: number;
  /** Unit price. When every item has price 0/undefined the price columns are hidden. */
  unitPrice?: number;
  /** ICMS percentage (e.g. 18 for 18%). */
  icms?: number;
  /** IPI percentage. */
  ipi?: number;
}

export interface OrderPdfData {
  /**
   * Document title. Pass the order code built by `buildOrderCode()` here
   * (e.g. "Pedido 0001-01.1 - Bases"). Defaults to "Pedido de Compra".
   */
  title?: string;
  /**
   * Secondary label under the title — the document kind, e.g. "Pedido de Compra"
   * or "Solicitação de Orçamento". Rendered alongside the description.
   */
  documentType?: string;
  /** Order description / subtitle. */
  description?: string;
  supplierName?: string;
  orderDate?: Date | string | null;
  forecastDate?: Date | string | null;
  items: OrderPdfLineItem[];
  /** Freight value added to the total. */
  freight?: number;
  /** Discount percentage applied to the goods subtotal (before ICMS/IPI). */
  discount?: number;
  notes?: string | null;
  /**
   * When false, the document is a "budget request" to send to the supplier:
   * no prices, taxes, discount, freight or totals are shown — just the item
   * list (code / name / brand / measures / quantity). Defaults to true.
   */
  includePricing?: boolean;
}

/** Escape user-provided text before injecting into the print HTML. */
function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function toDate(value?: Date | string | null): Date | null {
  if (!value) return null;
  const d = value instanceof Date ? value : new Date(value);
  return isNaN(d.getTime()) ? null : d;
}

/** Format a Brazilian phone like "43 9 8428-3228" → "(43) 9 8428-3228" (mirrors the dossie footer). */
function formatPhoneWithDDD(phone: string): string {
  if (!phone) return "";
  if (phone.startsWith("(")) return phone;
  const m = phone.match(/^(\d{2})\s+(.+)$/);
  return m ? `(${m[1]}) ${m[2]}` : phone;
}

/**
 * Build the branded HTML document for an order and return it as a string.
 * Exposed separately so it can be unit-tested without opening a print window.
 */
export function buildOrderPdfHtml(data: OrderPdfData): string {
  const title = data.title || "Pedido de Compra";
  const items = data.items || [];

  // Per-item money calculations.
  const rows = items.map((item) => {
    const quantity = Number(item.quantity) || 0;
    const unitPrice = Number(item.unitPrice) || 0;
    const icms = Number(item.icms) || 0;
    const ipi = Number(item.ipi) || 0;
    const subtotal = quantity * unitPrice;
    const taxAmount = subtotal * (icms / 100) + subtotal * (ipi / 100);
    return { ...item, quantity, unitPrice, icms, ipi, subtotal, taxAmount, total: subtotal + taxAmount };
  });

  const goodsSubtotal = rows.reduce((sum, r) => sum + r.subtotal, 0);
  const taxTotal = rows.reduce((sum, r) => sum + r.taxAmount, 0);
  // includePricing=false produces the supplier "budget request" version (no values at all).
  const includePricing = data.includePricing !== false;
  const hasPricing = includePricing && rows.some((r) => r.unitPrice > 0);

  const discountPercent = Number(data.discount) || 0;
  const discountAmount = discountPercent > 0 ? goodsSubtotal * (discountPercent / 100) : 0;
  const freight = Number(data.freight) || 0;
  const grandTotal = goodsSubtotal + taxTotal - discountAmount + freight;

  const orderDate = toDate(data.orderDate);
  const forecastDate = toDate(data.forecastDate);
  const now = new Date();

  // Header metadata line.
  const metaParts: string[] = [];
  if (orderDate) metaParts.push(`<strong>Data do Pedido:</strong> ${formatDate(orderDate)}`);
  // The delivery forecast ("Entrega") only makes sense on an actual purchase order.
  // A budget/quote request (includePricing=false) has no committed delivery date yet.
  if (forecastDate && includePricing) metaParts.push(`<strong>Entrega:</strong> ${formatDate(forecastDate)}`);
  metaParts.push(`<strong>Fornecedor:</strong> ${escapeHtml(data.supplierName || "-")}`);

  const itemRowsHtml = rows
    .map(
      (r, index) => `
      <tr class="${index % 2 === 1 ? "row-alt" : ""}">
        <td class="mono">${escapeHtml(r.code || "-")}</td>
        <td class="strong">${escapeHtml(r.name || "-")}</td>
        <td>${escapeHtml(r.brand || "-")}</td>
        <td>${escapeHtml(r.measures || "-")}</td>
        <td class="center">${r.quantity.toLocaleString("pt-BR")}</td>
        ${hasPricing ? `<td class="right">${formatCurrency(r.unitPrice)}</td>` : ""}
        ${hasPricing ? `<td class="right">${r.taxAmount > 0 ? formatCurrency(r.taxAmount) : "-"}</td>` : ""}
        ${hasPricing ? `<td class="right strong">${formatCurrency(r.total)}</td>` : ""}
      </tr>`,
    )
    .join("");

  // Totals block — only render rows that are relevant.
  const totalsRows: string[] = [];
  if (hasPricing) {
    totalsRows.push(`
      <div class="total-row">
        <span class="total-label">Subtotal</span>
        <span class="total-value">${formatCurrency(goodsSubtotal)}</span>
      </div>`);
    if (taxTotal > 0) {
      totalsRows.push(`
      <div class="total-row">
        <span class="total-label">Impostos (ICMS/IPI)</span>
        <span class="total-value">${formatCurrency(taxTotal)}</span>
      </div>`);
    }
    if (discountAmount > 0) {
      totalsRows.push(`
      <div class="total-row">
        <span class="total-label">Desconto (${discountPercent}%)</span>
        <span class="total-value discount-value">- ${formatCurrency(discountAmount)}</span>
      </div>`);
    }
    if (freight > 0) {
      totalsRows.push(`
      <div class="total-row">
        <span class="total-label">Frete</span>
        <span class="total-value">${formatCurrency(freight)}</span>
      </div>`);
    }
    totalsRows.push(`
      <div class="total-row final-total-row">
        <span class="total-label">Total</span>
        <span class="total-value total-final">${formatCurrency(grandTotal)}</span>
      </div>`);
  }

  const totalsHtml = totalsRows.length
    ? `<div class="totals-section">${totalsRows.join("")}</div>`
    : "";

  const notesHtml = data.notes
    ? `
      <div class="notes-section">
        <div class="notes-title">Observações</div>
        <div class="notes-body">${escapeHtml(data.notes)}</div>
      </div>`
    : "";

  return `
<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8" />
  <title>${escapeHtml(title)}</title>
  <style>
    @page { size: A4; margin: 0; }

    * { margin: 0; padding: 0; box-sizing: border-box; }

    html, body {
      font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
      font-size: 11px;
      line-height: 1.4;
      color: ${BRAND_COLORS.textDark};
      background: #fff;
    }

    /* Flex column + a page-height min-height (in mm, NOT vh — vh resolves to the on-screen
       window in print, not the A4 page) so the footer sits at the bottom on a single-page
       order; on longer orders content flows naturally and the footer follows the content. */
    .sheet { padding: 14mm 14mm 12mm 14mm; min-height: 297mm; display: flex; flex-direction: column; }
    .content { flex: 1 0 auto; }

    /* Header — logo only; company contact lives in the footer (like the dossie PDF). */
    .header {
      display: flex;
      align-items: flex-start;
      padding-bottom: 8px;
    }
    .logo { height: 18mm; width: auto; }

    .header-line {
      height: 2px;
      background: linear-gradient(to right, #888 0%, ${BRAND_COLORS.primaryGreen} 35%);
      margin: 4px 0 12px 0;
    }

    /* Title + meta */
    .doc-title {
      font-size: 16px;
      font-weight: bold;
      color: ${BRAND_COLORS.primaryGreen};
      margin-bottom: 2px;
    }
    .doc-subtitle { font-size: 12px; color: ${BRAND_COLORS.textDark}; margin-bottom: 6px; }
    .doc-meta { font-size: 10px; color: ${BRAND_COLORS.textGray}; margin-bottom: 12px; }
    .doc-meta strong { color: ${BRAND_COLORS.textDark}; }

    /* Items table */
    table { width: 100%; border-collapse: collapse; font-size: 10.5px; }
    thead th {
      background: ${BRAND_COLORS.primaryGreen};
      color: #fff;
      font-weight: 600;
      text-align: left;
      padding: 7px 6px;
      text-transform: uppercase;
      font-size: 9px;
      letter-spacing: 0.03em;
    }
    tbody td {
      padding: 6px;
      border-bottom: 1px solid #eee;
      vertical-align: top;
    }
    tbody tr.row-alt { background: #f6f8f6; }
    .mono { font-family: 'SFMono-Regular', Consolas, monospace; font-size: 10px; }
    .strong { font-weight: 600; }
    .center { text-align: center; }
    .right { text-align: right; white-space: nowrap; }

    /* Totals */
    .totals-section {
      margin-top: 10px;
      margin-left: auto;
      width: 62mm;
    }
    .total-row {
      display: flex;
      justify-content: space-between;
      align-items: baseline;
      padding: 2px 0;
      font-size: 11px;
    }
    .total-label { color: ${BRAND_COLORS.textDark}; }
    .total-value { font-weight: normal; white-space: nowrap; text-align: right; }
    .discount-value { color: #c00; }
    .final-total-row {
      margin-top: 3px;
      padding-top: 4px;
      border-top: 1px solid #ddd;
    }
    .final-total-row .total-label { font-weight: bold; }
    .total-final { font-weight: bold; font-size: 13px; color: ${BRAND_COLORS.primaryGreen}; }

    /* Notes */
    .notes-section {
      margin-top: 16px;
      padding: 10px 12px;
      background: #f6f8f6;
      border-left: 3px solid ${BRAND_COLORS.primaryGreen};
      border-radius: 4px;
    }
    .notes-title { font-weight: bold; color: ${BRAND_COLORS.primaryGreen}; margin-bottom: 3px; font-size: 11px; }
    .notes-body { white-space: pre-wrap; font-size: 10.5px; color: ${BRAND_COLORS.textDark}; }

    /* Footer — company contact, stacked, under a solid green line (matches the dossie PDF). */
    .footer {
      margin-top: 22px;
      padding-top: 10px;
      border-top: 2px solid ${BRAND_COLORS.primaryGreen};
      display: flex;
      justify-content: space-between;
      align-items: flex-end;
    }
    .footer-contact { font-size: 9px; line-height: 1.7; }
    .footer-name { font-weight: bold; color: ${BRAND_COLORS.primaryGreen}; font-size: 11px; }
    .footer-address { color: ${BRAND_COLORS.textGray}; }
    .footer-phone, .footer-site { color: ${BRAND_COLORS.primaryGreen}; }
    .footer-generated { font-size: 8px; color: ${BRAND_COLORS.textGray}; text-align: right; }
  </style>
</head>
<body>
  <div class="sheet">
    <div class="header">
      <img src="/logo.png" alt="${escapeHtml(COMPANY_INFO.name)}" class="logo" />
    </div>
    <div class="header-line"></div>

    <div class="content">
    <div class="doc-title">${escapeHtml(title)}</div>
    ${
      [data.documentType, data.description].filter(Boolean).length
        ? `<div class="doc-subtitle">${escapeHtml(
            [data.documentType, data.description].filter(Boolean).join(" — "),
          )}</div>`
        : ""
    }
    <div class="doc-meta">${metaParts.join(" &nbsp;|&nbsp; ")}</div>

    <table>
      <thead>
        <tr>
          <th>Código</th>
          <th>Nome</th>
          <th>Marca</th>
          <th>Medidas</th>
          <th class="center">Qtd.</th>
          ${hasPricing ? `<th class="right">Preço Unit.</th>` : ""}
          ${hasPricing ? `<th class="right">Impostos</th>` : ""}
          ${hasPricing ? `<th class="right">Total</th>` : ""}
        </tr>
      </thead>
      <tbody>
        ${itemRowsHtml || `<tr><td colspan="8" class="center" style="padding:16px;color:#999;">Nenhum item</td></tr>`}
      </tbody>
    </table>

    ${totalsHtml}
    ${notesHtml}
    </div>

    <div class="footer">
      <div class="footer-contact">
        <div class="footer-name">${escapeHtml(COMPANY_INFO.name)}</div>
        <div class="footer-address">${escapeHtml(COMPANY_INFO.address)}</div>
        <div class="footer-phone">${escapeHtml(formatPhoneWithDDD(COMPANY_INFO.phone))}</div>
        <div class="footer-site">${escapeHtml(COMPANY_INFO.websiteUrl || COMPANY_INFO.website)}</div>
      </div>
      <div class="footer-generated">Gerado em ${formatDate(now)} ${now.toLocaleTimeString("pt-BR")}</div>
    </div>
  </div>
</body>
</html>`;
}

/**
 * Open a print window for the given order and trigger the print dialog.
 * The window is closed automatically after printing.
 */
export function exportOrderPdf(data: OrderPdfData): void {
  const html = buildOrderPdfHtml(data);
  const printWindow = window.open("", "_blank");
  if (!printWindow) return;

  printWindow.document.write(html);
  printWindow.document.close();
  printWindow.focus();

  printWindow.onload = () => {
    printWindow.print();
    printWindow.onafterprint = () => printWindow.close();
  };
}
