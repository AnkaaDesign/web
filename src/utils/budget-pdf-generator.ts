import { formatCurrency, formatDate, toTitleCase } from "./index";
import type { Task } from "../types/task";
import { generatePaymentText, generateGuaranteeText } from "./pricing-text-generators";
import { getApiBaseUrl } from "./file";

interface BudgetPdfOptions {
  task: Task;
}

// Constants for PDF layout calculations
const PDF_CONFIG = {
  // A4 dimensions in mm
  pageWidth: 210,
  pageHeight: 297,
  // Margins
  marginTop: 12,
  marginBottom: 15,
  marginLeft: 25,
  marginRight: 25,
  // Content area
  get contentWidth() { return this.pageWidth - this.marginLeft - this.marginRight; },
  get contentHeight() { return this.pageHeight - this.marginTop - this.marginBottom; },
  // Section heights (approximate, in mm)
  headerHeight: 25,
  headerLineHeight: 2,
  titleSectionHeight: 15,
  customerSectionHeight: 25,
  sectionTitleHeight: 8,
  serviceItemHeight: 5.5,
  termsSectionHeight: 18,
  footerHeight: 22,
  signatureSectionHeight: 35,
  // Spacing
  sectionSpacing: 5,
  // Colors (deep forest green to match reference PDF)
  primaryGreen: '#0a5c1e',
  textDark: '#1a1a1a',
  textGray: '#666666',
  // Company info
  companyName: 'Ankaa Design',
  companyAddress: 'Rua: Luís Carlos Zani, 2493 - Santa Paula, Ibiporã-PR',
  companyPhone: '43 9 8428-3228',
  companyPhoneClean: '5543984283228',
  companyWebsite: 'ankaadesign.com.br',
  companyWebsiteUrl: 'https://ankaadesign.com.br',
  // Director info
  directorName: 'Sergio Rodrigues',
  directorTitle: 'Diretor Comercial',
};

/**
 * Calculate available space for services on page 1
 * and determine if we need to split services across pages
 */
function calculateServicesLayout(
  itemCount: number,
  hasDeliveryTerm: boolean,
  hasPaymentConditions: boolean,
  hasGuarantee: boolean,
  hasDiscount: boolean
): { maxItemsPage1: number; needsSplit: boolean } {
  // Available height on page 1 for services
  let usedHeight = PDF_CONFIG.headerHeight + PDF_CONFIG.headerLineHeight + PDF_CONFIG.sectionSpacing;
  usedHeight += PDF_CONFIG.titleSectionHeight; // ORÇAMENTO title
  usedHeight += PDF_CONFIG.customerSectionHeight; // Customer section
  usedHeight += PDF_CONFIG.sectionTitleHeight; // "Serviços" title

  // Calculate terms sections height
  let termsHeight = 0;
  if (hasDeliveryTerm) termsHeight += PDF_CONFIG.termsSectionHeight;
  if (hasPaymentConditions) termsHeight += PDF_CONFIG.termsSectionHeight;
  if (hasGuarantee) termsHeight += PDF_CONFIG.termsSectionHeight;

  // Totals section height
  const totalsHeight = hasDiscount ? 20 : 15;

  // Footer height
  usedHeight += PDF_CONFIG.footerHeight;

  // Calculate available space for services + totals + terms
  const availableHeight = PDF_CONFIG.contentHeight - usedHeight - termsHeight - totalsHeight - 10; // 10mm buffer

  // Calculate max items that fit
  const maxItemsPage1 = Math.floor(availableHeight / PDF_CONFIG.serviceItemHeight);
  const needsSplit = itemCount > maxItemsPage1;

  return { maxItemsPage1: Math.max(maxItemsPage1, 3), needsSplit };
}

/**
 * Generates and exports a beautifully formatted budget PDF
 * Opens a new window with print dialog for the user to save as PDF
 * Based on the Ankaa Design official template (2 pages: front + back)
 */
export async function exportBudgetPdf({ task }: BudgetPdfOptions): Promise<void> {
  if (!task.pricing || !task.pricing.items || task.pricing.items.length === 0) {
    throw new Error("Nenhum item de precificação encontrado");
  }

  // Get customer info
  const corporateName = task.customer?.corporateName || task.customer?.fantasyName || "Cliente";
  const contactName = task.negotiatingWith?.name || "";

  // Get dates
  const currentDate = formatDate(new Date());
  const termDate = task.term ? formatDate(task.term) : "";

  // Calculate validity in days (based on date difference, ignoring time)
  const validityDays = task.pricing.expiresAt
    ? (() => {
        const today = new Date();
        const expires = new Date(task.pricing.expiresAt);
        // Reset time to midnight for accurate day calculation
        today.setHours(0, 0, 0, 0);
        expires.setHours(0, 0, 0, 0);
        return Math.round((expires.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
      })()
    : 30;

  // Format budget number with leading zeros (e.g., "0042")
  const budgetNumber = task.pricing.budgetNumber
    ? String(task.pricing.budgetNumber).padStart(4, '0')
    : task.serialNumber || "0000";

  // Generate payment and guarantee text
  const paymentText = generatePaymentText(task.pricing);
  const guaranteeText = generateGuaranteeText(task.pricing);

  // Get layout file URL if available - use direct URL (no fetch needed)
  // The <img> tag in the print window will load the image directly without CORS restrictions
  const apiBaseUrl = getApiBaseUrl();
  const layoutImageUrl: string | null = task.pricing.layoutFile?.id
    ? `${apiBaseUrl}/files/serve/${task.pricing.layoutFile.id}`
    : null;

  // Get customer signature URL if available - use direct URL (no fetch needed)
  const signatureImageUrl: string | null = task.pricing.customerSignature?.id
    ? `${apiBaseUrl}/files/serve/${task.pricing.customerSignature.id}`
    : null;

  const htmlContent = generateBudgetHtml({
    corporateName,
    contactName,
    currentDate,
    validityDays,
    budgetNumber,
    items: task.pricing.items,
    subtotal: task.pricing.subtotal,
    discountType: task.pricing.discountType,
    discountValue: task.pricing.discountValue,
    total: task.pricing.total,
    termDate,
    paymentText,
    guaranteeText,
    layoutImageUrl,
    customerSignatureUrl: signatureImageUrl,
  });

  // Open print window
  const printWindow = window.open("", "_blank");
  if (!printWindow) {
    throw new Error("Não foi possível abrir a janela de impressão. Verifique se o bloqueador de pop-ups está desativado.");
  }

  printWindow.document.write(htmlContent);
  printWindow.document.close();

  // Trigger print dialog
  printWindow.onload = () => {
    printWindow.focus();
    printWindow.print();

    // Close window after print dialog
    printWindow.onafterprint = () => {
      printWindow.close();
    };
  };
}

interface BudgetHtmlData {
  corporateName: string;
  contactName: string;
  currentDate: string;
  validityDays: number;
  budgetNumber: string;
  items: any[];
  subtotal: number;
  discountType: string;
  discountValue: number | null;
  total: number;
  termDate: string;
  paymentText: string;
  guaranteeText: string;
  layoutImageUrl: string | null;
  customerSignatureUrl: string | null;
}

/**
 * Generates the HTML content for the budget PDF (2 pages)
 */
function generateBudgetHtml(data: BudgetHtmlData): string {
  // Calculate layout
  const hasDiscount = data.discountType !== 'NONE' && data.discountValue && data.discountValue > 0;
  const { maxItemsPage1 } = calculateServicesLayout(
    data.items.length,
    !!data.termDate,
    !!data.paymentText,
    !!data.guaranteeText,
    hasDiscount
  );

  // Generate services list with numbers
  // Description + observation shown inline (e.g., "Pintura Geral Azul Firenze")
  // All text is displayed in Title Case
  const servicesHtml = data.items
    .map((item, index) => {
      const amount = typeof item.amount === "number" ? item.amount : Number(item.amount) || 0;
      const valueDisplay = formatCurrency(amount);
      // Combine description and observation inline (Title Case)
      const description = toTitleCase(item.description || "Serviço");
      const observation = item.observation ? toTitleCase(item.observation) : "";
      const descriptionWithObs = observation ? `${description} ${observation}` : description;
      return `
        <div class="service-item">
          <span class="service-desc">${index + 1} - ${escapeHtml(descriptionWithObs)}</span>
          <span class="service-value">${valueDisplay}</span>
        </div>
      `;
    })
    .join("");

  // Generate totals section (only shown when there's discount)
  const discountLabel = data.discountType === 'PERCENTAGE'
    ? `Desconto (${data.discountValue}%)`
    : 'Desconto';
  const discountAmount = data.discountType === 'PERCENTAGE'
    ? (data.subtotal * (data.discountValue || 0) / 100)
    : (data.discountValue || 0);

  // Only show totals section if there's a discount, otherwise just show total after services
  const totalsHtml = hasDiscount ? `
    <div class="totals-section">
      <div class="total-row subtotal-row">
        <span class="total-label">Subtotal</span>
        <span class="total-value">${formatCurrency(data.subtotal)}</span>
      </div>
      <div class="total-row discount-row">
        <span class="total-label">${discountLabel}</span>
        <span class="total-value discount-value">- ${formatCurrency(discountAmount)}</span>
      </div>
      <div class="total-row final-total-row">
        <span class="total-label">Total</span>
        <span class="total-value total-final">${formatCurrency(data.total)}</span>
      </div>
    </div>
  ` : '';

  // Layout section for page 2 (only if layout exists)
  const layoutHtml = data.layoutImageUrl
    ? `
      <section class="layout-section">
        <h2 class="section-title-green">Layout aprovado</h2>
        <div class="layout-image-container">
          <img src="${data.layoutImageUrl}" alt="Layout aprovado" class="layout-image" />
        </div>
      </section>
    `
    : "";

  // Customer signature image
  const customerSignatureHtml = data.customerSignatureUrl
    ? `<img src="${data.customerSignatureUrl}" alt="Assinatura do Cliente" class="signature-image" />`
    : '';

  // WhatsApp link
  const whatsappLink = `https://wa.me/${PDF_CONFIG.companyPhoneClean}`;

  return `
<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Orçamento Nº ${data.budgetNumber} - ${data.corporateName}</title>
  <style>
    @page {
      size: A4;
      margin: 0;
    }

    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }

    html, body {
      width: 210mm;
      height: 297mm;
      font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
      font-size: 10pt;
      line-height: 1.4;
      color: ${PDF_CONFIG.textDark};
      background: #fff;
    }

    a {
      color: inherit;
      text-decoration: none;
    }

    a:hover {
      text-decoration: underline;
    }

    .page {
      width: 210mm;
      height: 297mm;
      max-height: 297mm;
      padding: ${PDF_CONFIG.marginTop}mm ${PDF_CONFIG.marginRight}mm ${PDF_CONFIG.marginBottom}mm ${PDF_CONFIG.marginLeft}mm;
      display: flex;
      flex-direction: column;
      page-break-after: always;
      page-break-inside: avoid;
      overflow: hidden;
      position: relative;
    }

    .page:last-child {
      page-break-after: auto;
    }

    /* Header */
    .header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      margin-bottom: 4mm;
      flex-shrink: 0;
    }

    .logo {
      height: 18mm;
      width: auto;
    }

    .header-right {
      text-align: right;
    }

    .budget-number {
      font-size: 14pt;
      font-weight: bold;
      color: ${PDF_CONFIG.textDark};
      margin-bottom: 2mm;
    }

    .header-info {
      font-size: 9pt;
      color: #333;
      line-height: 1.6;
    }

    .header-info-label {
      font-weight: bold;
    }

    .header-line {
      height: 1px;
      background: linear-gradient(to right, #888 0%, ${PDF_CONFIG.primaryGreen} 30%);
      margin-bottom: 8mm;
      flex-shrink: 0;
    }

    /* Document Title */
    .document-title {
      font-size: 14pt;
      font-weight: bold;
      color: ${PDF_CONFIG.primaryGreen};
      text-decoration: underline;
      text-underline-offset: 2px;
      margin-bottom: 6mm;
      flex-shrink: 0;
    }

    /* Customer Info */
    .customer-section {
      margin-bottom: 6mm;
      flex-shrink: 0;
    }

    .customer-name {
      font-size: 10pt;
      font-weight: bold;
      color: ${PDF_CONFIG.primaryGreen};
      margin-bottom: 2mm;
    }

    .contact-line {
      font-size: 10pt;
      color: ${PDF_CONFIG.textDark};
      margin-bottom: 2mm;
    }

    .intro-text {
      font-size: 10pt;
      color: ${PDF_CONFIG.textDark};
      line-height: 1.5;
    }

    /* Services Section */
    .services-section {
      margin-bottom: 8mm;
      flex-shrink: 0;
    }

    .section-title-green {
      font-size: 11pt;
      font-weight: bold;
      color: ${PDF_CONFIG.primaryGreen};
      margin-bottom: 4mm;
    }

    .services-list {
      padding-left: 5mm;
    }

    .service-item {
      display: flex;
      justify-content: space-between;
      align-items: baseline;
      padding: 1.2mm 0;
      font-size: 10pt;
      line-height: 1.4;
    }

    .service-desc {
      color: ${PDF_CONFIG.textDark};
      flex: 1;
      padding-right: 10mm;
    }

    .service-value {
      color: ${PDF_CONFIG.textDark};
      font-weight: normal;
      white-space: nowrap;
      min-width: 80px;
      text-align: right;
    }

    /* Totals Section */
    .totals-section {
      margin-top: 6mm;
      padding-left: 5mm;
      flex-shrink: 0;
    }

    .total-row {
      display: flex;
      justify-content: space-between;
      align-items: baseline;
      padding: 1mm 0;
      font-size: 10pt;
    }

    .total-label {
      color: ${PDF_CONFIG.textDark};
    }

    .total-value {
      color: ${PDF_CONFIG.textDark};
      font-weight: normal;
      white-space: nowrap;
      min-width: 80px;
      text-align: right;
    }

    .discount-value {
      color: #c00;
    }

    .final-total-row {
      margin-top: 2mm;
      padding-top: 2mm;
      border-top: 1px solid #ddd;
    }

    .final-total-row .total-label {
      font-weight: bold;
    }

    .total-final {
      font-weight: bold;
      font-size: 11pt;
      color: ${PDF_CONFIG.primaryGreen};
    }

    /* Terms Sections */
    .terms-section {
      margin-bottom: 6mm;
      flex-shrink: 0;
    }

    .terms-title {
      font-size: 11pt;
      font-weight: bold;
      color: ${PDF_CONFIG.primaryGreen};
      margin-bottom: 2mm;
    }

    .terms-content {
      font-size: 10pt;
      color: ${PDF_CONFIG.textDark};
      line-height: 1.5;
    }

    .terms-content strong {
      font-weight: bold;
    }

    /* Content area that can flex */
    .page-content {
      flex: 1;
      display: flex;
      flex-direction: column;
      min-height: 0;
    }

    /* Footer */
    .footer {
      padding-top: 4mm;
      border-top: 1px solid;
      border-image: linear-gradient(to right, #888 0%, ${PDF_CONFIG.primaryGreen} 30%) 1;
      flex-shrink: 0;
      margin-top: auto;
    }

    .footer-company {
      font-size: 11pt;
      font-weight: bold;
      color: ${PDF_CONFIG.primaryGreen};
      margin-bottom: 1mm;
    }

    .footer-info {
      font-size: 9pt;
      color: #333;
      line-height: 1.6;
    }

    .footer-link {
      color: ${PDF_CONFIG.primaryGreen};
    }

    /* Page 2 - Layout Section */
    .layout-section {
      flex: 1;
      display: flex;
      flex-direction: column;
      min-height: 0;
      overflow: hidden;
      margin-bottom: 5mm;
    }

    .layout-image-container {
      flex: 1;
      display: flex;
      align-items: flex-start;
      justify-content: center;
      margin-top: 4mm;
      width: 100%;
      min-height: 0;
      overflow: hidden;
    }

    .layout-image {
      width: 100%;
      height: auto;
      max-height: 100%;
      object-fit: contain;
      object-position: center top;
    }

    /* Signature Section */
    .signature-section {
      margin-top: 10mm;
      margin-bottom: 10mm;
      display: flex;
      justify-content: space-between;
      gap: 30mm;
      flex-shrink: 0;
    }

    .signature-box {
      flex: 1;
      text-align: center;
    }

    .signature-image-container {
      height: 15mm;
      display: flex;
      align-items: flex-end;
      justify-content: center;
      margin-bottom: 2mm;
    }

    .signature-image {
      max-height: 15mm;
      max-width: 50mm;
      object-fit: contain;
    }

    .signature-line {
      border-top: 1px solid ${PDF_CONFIG.textDark};
      padding-top: 3mm;
    }

    .signature-name {
      font-size: 10pt;
      color: ${PDF_CONFIG.textDark};
      margin-bottom: 1mm;
    }

    .signature-title {
      font-size: 9pt;
      color: ${PDF_CONFIG.textGray};
    }

    @media print {
      html, body {
        width: 210mm;
        height: auto;
        print-color-adjust: exact;
        -webkit-print-color-adjust: exact;
      }

      .page {
        width: 210mm;
        height: 297mm;
        max-height: 297mm;
        page-break-after: always;
        page-break-inside: avoid;
        overflow: hidden;
      }

      .page:last-child {
        page-break-after: auto;
      }

      a {
        color: inherit !important;
        text-decoration: none !important;
      }
    }
  </style>
</head>
<body>
  <!-- Page 1 - Front -->
  <div class="page">
    <!-- Header -->
    <header class="header">
      <img src="/logo.png" alt="Ankaa Design" class="logo" />
      <div class="header-right">
        <div class="budget-number">Orçamento Nº ${escapeHtml(data.budgetNumber)}</div>
        <div class="header-info">
          <span class="header-info-label">Emissão:</span> ${data.currentDate}<br />
          <span class="header-info-label">Validade:</span> ${data.validityDays} dias
        </div>
      </div>
    </header>
    <div class="header-line"></div>

    <!-- Content Area -->
    <div class="page-content">
      <!-- Document Title -->
      <h1 class="document-title">ORÇAMENTO</h1>

      <!-- Customer Info -->
      <div class="customer-section">
        <div class="customer-name">À ${escapeHtml(corporateName(data.corporateName))}</div>
        ${data.contactName ? `<div class="contact-line">Caro ${escapeHtml(data.contactName)}</div>` : ""}
        <p class="intro-text">Conforme solicitado, apresentamos nossa proposta de preço para execução dos serviços abaixo descriminados.</p>
      </div>

      <!-- Services -->
      <section class="services-section">
        <h2 class="section-title-green">Serviços</h2>
        <div class="services-list">
          ${servicesHtml}
        </div>
        ${totalsHtml}
      </section>

      <!-- Delivery Term -->
      ${data.termDate ? `
      <section class="terms-section">
        <h2 class="terms-title">Prazo de entrega</h2>
        <p class="terms-content">O prazo de entrega é de ${data.termDate}, desde que o implemento esteja nas condições previamente informada e não haja alterações nos serviços descritos.</p>
      </section>
      ` : ""}

      <!-- Payment Terms -->
      ${data.paymentText ? `
      <section class="terms-section">
        <h2 class="terms-title">Condições de pagamento</h2>
        <p class="terms-content">${escapeHtml(data.paymentText)}</p>
      </section>
      ` : ""}

      <!-- Guarantee -->
      ${data.guaranteeText ? `
      <section class="terms-section">
        <h2 class="terms-title">Garantias</h2>
        <p class="terms-content">${formatGuaranteeHtml(data.guaranteeText)}</p>
      </section>
      ` : ""}
    </div>

    <!-- Footer -->
    <footer class="footer">
      <div class="footer-company">${PDF_CONFIG.companyName}</div>
      <div class="footer-info">
        ${PDF_CONFIG.companyAddress}<br />
        <a href="${whatsappLink}" class="footer-link">${PDF_CONFIG.companyPhone}</a><br />
        <a href="${PDF_CONFIG.companyWebsiteUrl}" class="footer-link">${PDF_CONFIG.companyWebsite}</a>
      </div>
    </footer>
  </div>

  <!-- Page 2 - Back (Layout + Signatures) -->
  <div class="page">
    <!-- Header -->
    <header class="header">
      <img src="/logo.png" alt="Ankaa Design" class="logo" />
      <div class="header-right">
        <div class="budget-number">Orçamento Nº ${escapeHtml(data.budgetNumber)}</div>
        <div class="header-info">
          <span class="header-info-label">Emissão:</span> ${data.currentDate}<br />
          <span class="header-info-label">Validade:</span> ${data.validityDays} dias
        </div>
      </div>
    </header>
    <div class="header-line"></div>

    <!-- Content Area -->
    <div class="page-content">
      <!-- Layout Section -->
      ${layoutHtml}
    </div>

    <!-- Signature Section -->
    <div class="signature-section">
      <div class="signature-box">
        <div class="signature-image-container">
          <img src="/sergio-signature.webp" alt="Assinatura Sergio Rodrigues" class="signature-image" style="margin-top: 12mm;" />
        </div>
        <div class="signature-line">
          <div class="signature-name">${PDF_CONFIG.directorName}</div>
          <div class="signature-title">${PDF_CONFIG.directorTitle}</div>
        </div>
      </div>
      <div class="signature-box">
        <div class="signature-image-container">
          ${customerSignatureHtml}
        </div>
        <div class="signature-line">
          <div class="signature-name">Responsável CLIENTE</div>
          <div class="signature-title"></div>
        </div>
      </div>
    </div>

    <!-- Footer -->
    <footer class="footer">
      <div class="footer-company">${PDF_CONFIG.companyName}</div>
      <div class="footer-info">
        ${PDF_CONFIG.companyAddress}<br />
        <a href="${whatsappLink}" class="footer-link">${PDF_CONFIG.companyPhone}</a><br />
        <a href="${PDF_CONFIG.companyWebsiteUrl}" class="footer-link">${PDF_CONFIG.companyWebsite}</a>
      </div>
    </footer>
  </div>
</body>
</html>
  `;
}

/**
 * Format corporate name - add brackets if not already present
 */
function corporateName(name: string): string {
  if (name.startsWith('[') && name.endsWith(']')) {
    return name;
  }
  return name;
}

/**
 * Escapes HTML special characters
 */
function escapeHtml(text: string): string {
  const div = document.createElement("div");
  div.textContent = text;
  return div.innerHTML;
}

/**
 * Formats guarantee text with bold years
 * Looks for patterns like "X anos" and wraps them in <strong>
 */
function formatGuaranteeHtml(text: string): string {
  // First escape the text
  const escaped = escapeHtml(text);
  // Then make the years bold (e.g., "3 anos", "5 anos", "10 anos", "15 anos")
  return escaped.replace(/(\d+)\s*(anos?)/gi, '<strong>$1 $2</strong>');
}
