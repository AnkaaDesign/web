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
 * organized by service order. Uses full-resolution file URLs (not thumbnails).
 * Opens a new window with print dialog for the user to save as PDF.
 */
export async function exportDossiePdf({ taskDisplayName, customerName, serialNumber, plate, serviceOrders }: DossiePdfOptions): Promise<void> {
  if (serviceOrders.length === 0) {
    throw new Error("Nenhum registro fotográfico encontrado no dossiê");
  }

  const apiUrl = getApiBaseUrl();
  const currentDate = formatDate(new Date());
  const whatsappLink = `https://wa.me/${COMPANY_INFO.phoneClean}`;

  // Build service order pages - each SO gets its own section, may span multiple pages
  const serviceOrdersHtml = serviceOrders.map((so) => {
    const isOutrosWithObservation = so.description === 'Outros' && !!so.observation;
    const displayDescription = isOutrosWithObservation ? so.observation : so.description;
    const checkinFiles = so.checkinFiles || [];
    const checkoutFiles = so.checkoutFiles || [];

    // Determine max count for pairing antes/depois side by side
    const maxCount = Math.max(checkinFiles.length, checkoutFiles.length);

    // Build paired photo rows (antes | depois)
    let photoPairsHtml = '';
    for (let i = 0; i < maxCount; i++) {
      const checkinFile = checkinFiles[i];
      const checkoutFile = checkoutFiles[i];

      photoPairsHtml += `
        <div class="photo-pair">
          <div class="photo-cell">
            ${checkinFile
              ? `<img src="${apiUrl}/files/serve/${checkinFile.id}" alt="${escapeHtml(checkinFile.originalName || checkinFile.filename)}" class="photo-img" />`
              : `<div class="photo-empty">—</div>`
            }
          </div>
          <div class="photo-cell">
            ${checkoutFile
              ? `<img src="${apiUrl}/files/serve/${checkoutFile.id}" alt="${escapeHtml(checkoutFile.originalName || checkoutFile.filename)}" class="photo-img" />`
              : `<div class="photo-empty">—</div>`
            }
          </div>
        </div>
      `;
    }

    return `
      <div class="service-order-block">
        <div class="so-header">
          <span class="so-title">${escapeHtml(displayDescription || 'Serviço')}</span>
          ${!isOutrosWithObservation && so.observation ? `<span class="so-obs">${escapeHtml(so.observation)}</span>` : ''}
        </div>
        <div class="photo-columns-header">
          <div class="column-label antes-label">Antes (Check-in) — ${checkinFiles.length} foto${checkinFiles.length !== 1 ? 's' : ''}</div>
          <div class="column-label depois-label">Depois (Check-out) — ${checkoutFiles.length} foto${checkoutFiles.length !== 1 ? 's' : ''}</div>
        </div>
        ${photoPairsHtml}
      </div>
    `;
  }).join('');

  // Vehicle info line
  const vehicleInfo = [
    serialNumber ? `Série: ${escapeHtml(serialNumber)}` : '',
    plate ? `Placa: ${escapeHtml(plate)}` : '',
  ].filter(Boolean).join(' | ');

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
      min-height: 297mm;
      padding: 10mm 20mm 12mm 20mm;
      display: flex;
      flex-direction: column;
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
      margin-bottom: 6mm;
      break-inside: avoid;
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

    .photo-columns-header {
      display: flex;
      gap: 2mm;
      margin-bottom: 1.5mm;
      border-bottom: 0.5px solid #ddd;
      padding: 1.5mm 0;
    }

    .column-label {
      flex: 1;
      font-size: 8.5pt;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.3px;
    }

    .antes-label {
      color: #2563eb;
    }

    .depois-label {
      color: #16a34a;
    }

    .photo-pair {
      display: flex;
      gap: 2mm;
      margin-bottom: 2mm;
      break-inside: avoid;
    }

    .photo-cell {
      flex: 1;
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

    .photo-empty {
      color: #ccc;
      font-size: 14pt;
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

      .page {
        page-break-after: auto;
      }

      .service-order-block {
        break-inside: avoid;
      }

      .photo-pair {
        break-inside: avoid;
      }
    }
  </style>
</head>
<body>
  <div class="page">
    <!-- Header -->
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

    <!-- Title -->
    <div class="document-title">${escapeHtml(taskDisplayName)}</div>
    ${customerName ? `<div class="document-subtitle">${escapeHtml(customerName)}</div>` : ''}
    ${vehicleInfo ? `<div class="vehicle-info"><strong>${vehicleInfo}</strong></div>` : ''}

    <!-- Content -->
    <div class="page-content">
      ${serviceOrdersHtml}
    </div>

    <!-- Footer -->
    <footer class="footer">
      <div class="footer-company">${COMPANY_INFO.name}</div>
      <div class="footer-info">
        ${COMPANY_INFO.address}<br />
        <a href="${whatsappLink}" class="footer-link">${COMPANY_INFO.phone}</a> |
        <a href="${COMPANY_INFO.websiteUrl}" class="footer-link">${COMPANY_INFO.website}</a>
      </div>
    </footer>
  </div>
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
    // Give images extra time to render
    const images = printWindow.document.querySelectorAll('img');
    const imagePromises = Array.from(images).map(img => {
      if (img.complete) return Promise.resolve();
      return new Promise<void>((resolve) => {
        img.onload = () => resolve();
        img.onerror = () => resolve(); // Don't block on failed images
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
