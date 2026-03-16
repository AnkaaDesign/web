import { formatDate } from "./index";
import { getApiBaseUrl } from "@/config/api";
import { COMPANY_INFO, BRAND_COLORS } from "@/config/company";

interface ServiceOrderFiles {
  id: string;
  description: string;
  observation?: string | null;
  position?: number | null;
  checkinFiles: Array<{ id: string; filename: string; originalName?: string }>;
  checkoutFiles: Array<{ id: string; filename: string; originalName?: string }>;
}

interface DossiePdfOptions {
  taskDisplayName: string;
  customerName?: string;
  serialNumber?: string | null;
  plate?: string | null;
  serviceOrders: ServiceOrderFiles[];
}

/**
 * Generates and exports a Dossiê PDF with Antes (Check-in) / Depois (Check-out) photos
 * organized by service order. Each page has header, up to 2 service orders, and footer.
 * Opens a new window with print dialog for the user to save as PDF.
 */
export async function exportDossiePdf({ taskDisplayName, customerName, serialNumber, plate, serviceOrders }: DossiePdfOptions): Promise<void> {
  if (serviceOrders.length === 0) {
    throw new Error("Nenhum registro fotográfico encontrado no dossiê");
  }

  const apiUrl = getApiBaseUrl();
  const currentDate = formatDate(new Date());
  const whatsappLink = `https://wa.me/${COMPANY_INFO.phoneClean}`;

  // Vehicle info line
  const vehicleInfo = [
    serialNumber ? `Série: ${escapeHtml(serialNumber)}` : '',
    plate ? `Placa: ${escapeHtml(plate)}` : '',
  ].filter(Boolean).join(' | ');

  // Build a single photo row — all images in one row, min 3 columns
  const buildPhotoRow = (files: Array<{ id: string; filename: string; originalName?: string }>) => {
    if (files.length === 0) return '';
    const cols = Math.max(3, files.length);
    const cells = files.map(file =>
      `<div class="photo-cell"><img src="${apiUrl}/files/serve/${file.id}" alt="${escapeHtml(file.originalName || file.filename)}" class="photo-img" /></div>`
    ).join('');
    const spacers = Array(cols - files.length).fill('<div class="photo-cell photo-cell-spacer"></div>').join('');
    return `<div class="photo-row" style="grid-template-columns: repeat(${cols}, 1fr);">${cells}${spacers}</div>`;
  };

  // Build a service order block
  const buildServiceOrder = (so: ServiceOrderFiles) => {
    const isOutrosWithObservation = so.description === 'Outros' && !!so.observation;
    const displayDescription = isOutrosWithObservation ? so.observation : so.description;
    const checkinFiles = so.checkinFiles || [];
    const checkoutFiles = so.checkoutFiles || [];

    return `
      <div class="service-order-block">
        <div class="so-header">
          <span class="so-title">${escapeHtml(displayDescription || 'Serviço')}</span>
          ${!isOutrosWithObservation && so.observation ? `<span class="so-obs">${escapeHtml(so.observation)}</span>` : ''}
        </div>
        ${checkinFiles.length > 0 ? `
          <div class="section-label antes-label">Antes (Check-in)</div>
          ${buildPhotoRow(checkinFiles)}
        ` : ''}
        ${checkoutFiles.length > 0 ? `
          <div class="section-label depois-label">Depois (Check-out)</div>
          ${buildPhotoRow(checkoutFiles)}
        ` : ''}
      </div>
    `;
  };

  // Build header HTML
  const buildHeader = (showTitle: boolean) => `
    <header class="header">
      <img src="/logo.png" alt="${escapeHtml(COMPANY_INFO.name)}" class="logo" />
      <div class="header-right">
        <div class="header-title">DOSSIÊ</div>
        <div class="header-info">
          <span class="header-info-label">Data:</span> ${currentDate}
        </div>
      </div>
    </header>
    <div class="header-line"></div>
    ${showTitle ? `
      <div class="document-title">${escapeHtml(taskDisplayName)}</div>
      ${customerName ? `<div class="document-subtitle">${escapeHtml(customerName)}</div>` : ''}
      ${vehicleInfo ? `<div class="vehicle-info"><strong>${vehicleInfo}</strong></div>` : ''}
    ` : ''}
  `;

  // Build footer HTML
  const footerHtml = `
    <footer class="footer">
      <div class="footer-company">${COMPANY_INFO.name}</div>
      <div class="footer-info">
        ${COMPANY_INFO.address}<br />
        <a href="${whatsappLink}" class="footer-link">${COMPANY_INFO.phone}</a> |
        <a href="${COMPANY_INFO.websiteUrl}" class="footer-link">${COMPANY_INFO.website}</a>
      </div>
    </footer>
  `;

  // Paginate: 2 service orders per page
  const pages: string[] = [];
  for (let i = 0; i < serviceOrders.length; i += 2) {
    const isFirstPage = i === 0;
    const soBlocks = serviceOrders.slice(i, i + 2).map(buildServiceOrder).join('');
    pages.push(`
      <div class="page">
        ${buildHeader(isFirstPage)}
        <div class="page-content">
          ${soBlocks}
        </div>
        ${footerHtml}
      </div>
    `);
  }

  const htmlContent = `
<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Dossiê — ${escapeHtml(taskDisplayName)}</title>
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
      font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
      font-size: 10pt;
      line-height: 1.3;
      color: ${BRAND_COLORS.textDark};
      background: #fff;
    }

    a { color: inherit; text-decoration: none; }

    .page {
      width: 210mm;
      height: 297mm;
      padding: 10mm 20mm 12mm 20mm;
      display: flex;
      flex-direction: column;
      overflow: hidden;
      page-break-after: always;
    }

    .page:last-child {
      page-break-after: auto;
    }

    /* Header */
    .header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      margin-bottom: 2mm;
      flex-shrink: 0;
    }

    .logo {
      height: 14mm;
      width: auto;
    }

    .header-right {
      text-align: right;
    }

    .header-title {
      font-size: 13pt;
      font-weight: bold;
      color: ${BRAND_COLORS.textDark};
      margin-bottom: 1mm;
    }

    .header-info {
      font-size: 9pt;
      color: #333;
      line-height: 1.4;
    }

    .header-info-label {
      font-weight: bold;
    }

    .header-line {
      height: 1px;
      background: linear-gradient(to right, #888 0%, ${BRAND_COLORS.primaryGreen} 30%);
      margin-bottom: 4mm;
      flex-shrink: 0;
    }

    /* Document title */
    .document-title {
      font-size: 14pt;
      font-weight: bold;
      color: ${BRAND_COLORS.primaryGreen};
      margin-bottom: 1mm;
    }

    .document-subtitle {
      font-size: 10pt;
      color: ${BRAND_COLORS.textGray};
      margin-bottom: 2mm;
    }

    .vehicle-info {
      font-size: 9pt;
      color: ${BRAND_COLORS.textDark};
      margin-bottom: 5mm;
    }

    .vehicle-info strong {
      font-weight: 600;
    }

    /* Content */
    .page-content {
      flex: 1;
    }

    /* Service order block */
    .service-order-block {
      margin-bottom: 5mm;
    }

    .so-header {
      background: ${BRAND_COLORS.primaryGreen};
      color: #fff;
      padding: 2mm 3mm;
      border-radius: 1.5mm 1.5mm 0 0;
      display: flex;
      align-items: center;
      gap: 3mm;
    }

    .so-title {
      font-size: 10pt;
      font-weight: 600;
    }

    .so-obs {
      font-size: 8pt;
      opacity: 0.85;
      font-style: italic;
    }

    .section-label {
      font-size: 8.5pt;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.3px;
      margin-bottom: 1.5mm;
      margin-top: 2mm;
    }

    .antes-label {
      color: #2563eb;
    }

    .depois-label {
      color: #16a34a;
    }

    /* Photo row: CSS grid, columns set inline */
    .photo-row {
      display: grid;
      gap: 1.5mm;
      margin-bottom: 1.5mm;
    }

    .photo-cell {
      aspect-ratio: 4/3;
      overflow: hidden;
      border-radius: 1mm;
      border: 0.5px solid #e0e0e0;
      background: #f9f9f9;
      display: flex;
      align-items: center;
      justify-content: center;
    }

    .photo-img {
      width: 100%;
      height: 100%;
      object-fit: cover;
    }

    .photo-cell-spacer {
      border: none;
      background: transparent;
    }

    /* Footer */
    .footer {
      padding-top: 2mm;
      border-top: 1px solid;
      border-image: linear-gradient(to right, #888 0%, ${BRAND_COLORS.primaryGreen} 30%) 1;
      flex-shrink: 0;
      margin-top: auto;
    }

    .footer-company {
      font-size: 10pt;
      font-weight: bold;
      color: ${BRAND_COLORS.primaryGreen};
      margin-bottom: 1mm;
    }

    .footer-info {
      font-size: 8pt;
      color: #333;
      line-height: 1.5;
    }

    .footer-link {
      color: ${BRAND_COLORS.primaryGreen};
    }

    @media print {
      html, body {
        width: 210mm;
        height: auto;
        print-color-adjust: exact;
        -webkit-print-color-adjust: exact;
      }
    }
  </style>
</head>
<body>
  ${pages.join('')}
</body>
</html>
  `;

  // Open print window
  const printWindow = window.open("", "_blank");
  if (!printWindow) {
    throw new Error("Não foi possível abrir a janela de impressão. Verifique se o bloqueador de pop-ups está desativado.");
  }

  printWindow.document.write(htmlContent);
  printWindow.document.close();

  // Wait for images to load before printing
  printWindow.onload = () => {
    const images = printWindow.document.querySelectorAll('img');
    const imagePromises = Array.from(images).map(img => {
      if (img.complete) return Promise.resolve();
      return new Promise<void>((resolve) => {
        img.onload = () => resolve();
        img.onerror = () => resolve();
      });
    });

    Promise.all(imagePromises).then(() => {
      printWindow.focus();
      printWindow.print();
      printWindow.onafterprint = () => {
        printWindow.close();
      };
    });
  };
}

function escapeHtml(text: string): string {
  const div = document.createElement("div");
  div.textContent = text;
  return div.innerHTML;
}
