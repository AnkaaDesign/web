import { formatCurrency, formatDate } from "./index";
import type { Task } from "../types/task";
import { generatePaymentText, generateGuaranteeText } from "./pricing-text-generators";

interface BudgetPdfOptions {
  task: Task;
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
  const expiresAt = task.pricing.expiresAt ? formatDate(task.pricing.expiresAt) : "";
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

  // Generate budget number from task ID or use a sequential number
  const budgetNumber = task.serialNumber || task.id?.slice(-4).toUpperCase() || "0000";

  // Generate payment and guarantee text
  const paymentText = generatePaymentText(task.pricing);
  const guaranteeText = generateGuaranteeText(task.pricing);

  // Get layout file URL if available
  let layoutImageDataUrl: string | null = null;
  if (task.pricing.layoutFile?.thumbnailUrl || task.pricing.layoutFile?.path) {
    try {
      const layoutUrl = task.pricing.layoutFile.thumbnailUrl || task.pricing.layoutFile.path;
      if (layoutUrl) {
        const response = await fetch(layoutUrl);
        const blob = await response.blob();
        layoutImageDataUrl = await blobToDataUrl(blob);
      }
    } catch (error) {
      console.error("Failed to load layout image:", error);
    }
  }

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
    layoutImageUrl: layoutImageDataUrl,
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

/**
 * Converts a Blob to a data URL
 */
function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
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
}

/**
 * Generates the HTML content for the budget PDF (2 pages)
 */
function generateBudgetHtml(data: BudgetHtmlData): string {
  // Generate services list with numbers
  const servicesHtml = data.items
    .map((item, index) => {
      const amount = typeof item.amount === "number" ? item.amount : Number(item.amount) || 0;
      const valueDisplay = formatCurrency(amount);
      return `
        <div class="service-item">
          <span class="service-desc">${index + 1} - ${escapeHtml(item.description || "Serviço")}</span>
          <span class="service-value">${valueDisplay}</span>
        </div>
      `;
    })
    .join("");

  // Generate totals section
  const hasDiscount = data.discountType !== 'NONE' && data.discountValue && data.discountValue > 0;
  const discountLabel = data.discountType === 'PERCENTAGE'
    ? `Desconto (${data.discountValue}%)`
    : 'Desconto';
  const discountAmount = data.discountType === 'PERCENTAGE'
    ? (data.subtotal * (data.discountValue || 0) / 100)
    : (data.discountValue || 0);

  const totalsHtml = `
    <div class="totals-section">
      <div class="total-row subtotal-row">
        <span class="total-label">Subtotal</span>
        <span class="total-value">${formatCurrency(data.subtotal)}</span>
      </div>
      ${hasDiscount ? `
      <div class="total-row discount-row">
        <span class="total-label">${discountLabel}</span>
        <span class="total-value discount-value">- ${formatCurrency(discountAmount)}</span>
      </div>
      ` : ''}
      <div class="total-row final-total-row">
        <span class="total-label">Total</span>
        <span class="total-value total-final">${formatCurrency(data.total)}</span>
      </div>
    </div>
  `;

  // Layout section for page 2 (only if layout exists)
  const layoutHtml = data.layoutImageUrl
    ? `
      <section class="layout-section">
        <h2 class="section-title">Layout aprovado</h2>
        <div class="layout-image-container">
          <img src="${data.layoutImageUrl}" alt="Layout aprovado" class="layout-image" />
        </div>
      </section>
    `
    : "";

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
      color: #1a1a1a;
      background: #fff;
    }

    .page {
      width: 210mm;
      height: 297mm;
      max-height: 297mm;
      padding: 12mm 25mm 15mm 25mm;
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

    /* Page 2 specific - layout page */
    .page-layout {
      /* Available height: 297mm - 12mm top - 15mm bottom = 270mm */
    }

    .page-layout .layout-section {
      /* Fill available space between header and bottom elements */
      flex: 1;
      min-height: 0; /* Allow flex shrinking */
      overflow: hidden;
    }

    .page-layout .page-bottom {
      flex-shrink: 0; /* Don't shrink footer area */
    }

    /* Header */
    .header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      margin-bottom: 4mm;
    }

    .logo {
      height: 16mm;
      width: auto;
    }

    .header-right {
      text-align: right;
    }

    .budget-number {
      font-size: 13pt;
      font-weight: bold;
      color: #1a1a1a;
      margin-bottom: 2mm;
    }

    .header-info {
      font-size: 9pt;
      color: #333;
      line-height: 1.5;
    }

    .header-info span {
      font-weight: bold;
    }

    .header-line {
      height: 0.5px;
      background: linear-gradient(to right, #555 10%, #1a8b3d);
      margin-bottom: 6mm;
    }

    /* Document Title */
    .document-title {
      font-size: 13pt;
      font-weight: bold;
      color: #1a8b3d;
      text-transform: uppercase;
      margin-bottom: 5mm;
    }

    /* Customer Info */
    .customer-section {
      margin-bottom: 4mm;
    }

    .customer-name {
      font-size: 10pt;
      color: #1a1a1a;
      margin-bottom: 2mm;
    }

    .contact-line {
      font-size: 10pt;
      color: #666;
      font-style: italic;
      margin-bottom: 2mm;
    }

    .intro-text {
      font-size: 10pt;
      color: #1a1a1a;
      line-height: 1.5;
    }

    /* Services Section */
    .services-section {
      margin-top: 5mm;
      margin-bottom: 12mm;
    }

    .section-title {
      font-size: 10pt;
      font-weight: bold;
      color: #1a1a1a;
      margin-bottom: 4mm;
    }

    .services-list {
      padding-left: 5mm;
    }

    .service-item {
      display: flex;
      justify-content: space-between;
      align-items: baseline;
      padding: 0.8mm 0;
      font-size: 10pt;
      line-height: 1.3;
    }

    .service-desc {
      color: #1a1a1a;
      flex: 1;
      padding-right: 15mm;
    }

    .service-value {
      color: #1a1a1a;
      font-weight: normal;
      white-space: nowrap;
      min-width: 70px;
      text-align: right;
    }

    /* Totals Section - No borders, just extra spacing */
    .totals-section {
      margin-top: 8mm;
      padding-left: 5mm;
    }

    .total-row {
      display: flex;
      justify-content: space-between;
      align-items: baseline;
      padding: 1.5mm 0;
      font-size: 10pt;
    }

    .total-label {
      color: #1a1a1a;
    }

    .total-value {
      color: #1a1a1a;
      font-weight: normal;
      white-space: nowrap;
      min-width: 70px;
      text-align: right;
    }

    .discount-value {
      color: #c00;
    }

    .final-total-row {
      margin-top: 1mm;
    }

    .final-total-row .total-label {
      font-weight: bold;
    }

    .total-final {
      font-weight: bold;
      font-size: 11pt;
      color: #1a8b3d;
    }

    /* Terms Sections */
    .terms-section {
      margin-bottom: 5mm;
    }

    .terms-title {
      font-size: 10pt;
      font-weight: bold;
      color: #1a1a1a;
      margin-bottom: 2mm;
    }

    .terms-content {
      font-size: 10pt;
      color: #1a1a1a;
      line-height: 1.5;
    }

    .terms-content strong {
      font-weight: bold;
    }

    /* Footer */
    .footer {
      padding-top: 4mm;
      border-top: 0.5px solid;
      border-image: linear-gradient(to right, #555 10%, #1a8b3d) 1;
    }

    /* Footer at page bottom (page 1) */
    .page > .footer {
      margin-top: auto;
    }

    .footer-company {
      font-size: 10pt;
      font-weight: bold;
      color: #1a1a1a;
      margin-bottom: 1mm;
    }

    .footer-info {
      font-size: 9pt;
      color: #333;
      line-height: 1.5;
    }

    /* Page 2 - Layout Section */
    .layout-section {
      flex: 1;
      display: flex;
      flex-direction: column;
      min-height: 0;
      overflow: hidden;
    }

    .layout-image-container {
      flex: 1;
      display: flex;
      align-items: flex-start;
      justify-content: center;
      margin-top: 3mm;
      width: 100%;
      min-height: 0;
      overflow: hidden;
    }

    .layout-image {
      width: 100%;
      max-height: 100%;
      object-fit: contain;
    }

    /* Page bottom section - contains signature and footer */
    .page-bottom {
      flex-shrink: 0;
      margin-top: auto;
    }

    /* Signature Section */
    .signature-section {
      margin-top: 8mm;
      margin-bottom: 8mm;
      padding-top: 5mm;
      display: flex;
      justify-content: space-between;
      gap: 20mm;
    }

    .signature-box {
      flex: 1;
      text-align: center;
    }

    .signature-line {
      border-top: 1px solid #1a1a1a;
      padding-top: 3mm;
    }

    .signature-name {
      font-size: 10pt;
      color: #1a1a1a;
      margin-bottom: 1mm;
    }

    .signature-title {
      font-size: 9pt;
      color: #666;
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

      .layout-section {
        flex: 1;
        min-height: 0;
        overflow: hidden;
      }

      .layout-image {
        max-height: 100%;
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
          <span>Emissão:</span> ${data.currentDate}<br />
          <span>Validade:</span> ${data.validityDays} dias
        </div>
      </div>
    </header>
    <div class="header-line"></div>

    <!-- Document Title -->
    <h1 class="document-title">ORÇAMENTO</h1>

    <!-- Customer Info -->
    <div class="customer-section">
      <div class="customer-name">À ${escapeHtml(data.corporateName)}</div>
      ${data.contactName ? `<div class="contact-line">Caro ${escapeHtml(data.contactName)}</div>` : ""}
      <p class="intro-text">Conforme solicitado, apresentamos nossa proposta de preço para execução dos serviços abaixo descriminados.</p>
    </div>

    <!-- Services -->
    <section class="services-section">
      <h2 class="section-title">Serviços</h2>
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

    <!-- Footer -->
    <footer class="footer">
      <div class="footer-company">Ankaa Design</div>
      <div class="footer-info">
        Rua: Luís Carlos Zani, 2493 - Santa Paula, Ibiporã-PR<br />
        43 9 8428-3228<br />
        ankaadesign.com.br
      </div>
    </footer>
  </div>

  <!-- Page 2 - Back (Layout + Signatures) -->
  <div class="page page-layout">
    <!-- Header -->
    <header class="header">
      <img src="/logo.png" alt="Ankaa Design" class="logo" />
      <div class="header-right">
        <div class="budget-number">Orçamento Nº ${escapeHtml(data.budgetNumber)}</div>
        <div class="header-info">
          <span>Emissão:</span> ${data.currentDate}<br />
          <span>Validade:</span> ${data.validityDays} dias
        </div>
      </div>
    </header>
    <div class="header-line"></div>

    <!-- Layout Section -->
    ${layoutHtml}

    <!-- Page Bottom: Signature + Footer -->
    <div class="page-bottom">
      <!-- Signature Section -->
      <div class="signature-section">
        <div class="signature-box">
          <div class="signature-line">
            <div class="signature-name">Sergio Rodrigues</div>
            <div class="signature-title">Diretor Comercial</div>
          </div>
        </div>
        <div class="signature-box">
          <div class="signature-line">
            <div class="signature-name">Responsável CLIENTE</div>
            <div class="signature-title"></div>
          </div>
        </div>
      </div>

      <!-- Footer -->
      <footer class="footer">
        <div class="footer-company">Ankaa Design</div>
        <div class="footer-info">
          Rua: Luís Carlos Zani, 2493 - Santa Paula, Ibiporã-PR<br />
          43 9 8428-3228<br />
          ankaadesign.com.br
        </div>
      </footer>
    </div>
  </div>
</body>
</html>
  `;
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
