import { formatCurrency, formatDate } from "./index";
import type { Task } from "../types/task";
import type { FileWithPreview } from "../types/file";

interface BudgetPdfOptions {
  task: Task;
  notes?: string;
  images?: FileWithPreview[];
}

/**
 * Generates and exports a beautifully formatted budget PDF
 * Opens a new window with print dialog for the user to save as PDF
 */
export async function exportBudgetPdf({ task, notes, images }: BudgetPdfOptions): Promise<void> {
  if (!task.pricing || !task.pricing.items || task.pricing.items.length === 0) {
    throw new Error("Nenhum item de precificação encontrado");
  }

  const customerName = task.customer?.corporateName || task.customer?.fantasyName || "Cliente";
  const customerCnpj = task.customer?.cnpj || "";
  const currentDate = formatDate(new Date());
  const expiresAt = task.pricing.expiresAt ? formatDate(task.pricing.expiresAt) : "";

  // Calculate discount display
  const hasDiscount = task.pricing.discountType && task.pricing.discountType !== "NONE";
  let discountDisplay = "";
  if (hasDiscount && task.pricing.discountValue) {
    if (task.pricing.discountType === "PERCENTAGE") {
      discountDisplay = `${task.pricing.discountValue}%`;
    } else {
      discountDisplay = formatCurrency(task.pricing.discountValue);
    }
  }

  const discountAmount = hasDiscount && task.pricing.discountValue
    ? (task.pricing.discountType === "PERCENTAGE"
      ? (task.pricing.subtotal * task.pricing.discountValue) / 100
      : task.pricing.discountValue)
    : 0;

  // Convert images to base64 for embedding
  const imageDataUrls: string[] = [];
  if (images && images.length > 0) {
    for (const image of images) {
      try {
        // If image has preview (FileReader already loaded it)
        if (image.preview) {
          imageDataUrls.push(image.preview);
        } else if (image.thumbnailUrl) {
          // Try to load from thumbnail URL
          const response = await fetch(image.thumbnailUrl);
          const blob = await response.blob();
          const dataUrl = await blobToDataUrl(blob);
          imageDataUrls.push(dataUrl);
        } else if (image instanceof File) {
          // Load file as data URL
          const dataUrl = await fileToDataUrl(image as any);
          imageDataUrls.push(dataUrl);
        }
      } catch (error) {
        console.error("Failed to load image:", error);
      }
    }
  }

  const htmlContent = generateBudgetHtml({
    customerName,
    customerCnpj,
    currentDate,
    expiresAt,
    items: task.pricing.items,
    subtotal: task.pricing.subtotal,
    discountType: task.pricing.discountType || "NONE",
    discountDisplay,
    discountAmount,
    total: task.pricing.total,
    notes,
    images: imageDataUrls,
    taskTitle: task.title,
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
 * Converts a File to a data URL
 */
function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
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
  customerName: string;
  customerCnpj: string;
  currentDate: string;
  expiresAt: string;
  items: any[];
  subtotal: number;
  discountType: string;
  discountDisplay: string;
  discountAmount: number;
  total: number;
  notes?: string;
  images?: string[];
  taskTitle: string;
}

/**
 * Generates the HTML content for the budget PDF
 */
function generateBudgetHtml(data: BudgetHtmlData): string {
  const itemsHtml = data.items
    .map(
      (item, index) => `
      <tr style="${index % 2 === 0 ? "background-color: #ffffff;" : "background-color: #fafafa;"}">
        <td style="padding: 14px 16px; border-bottom: 1px solid #e5e7eb; text-align: left;">
          ${item.description || "Serviço"}
        </td>
        <td style="padding: 14px 16px; border-bottom: 1px solid #e5e7eb; text-align: right; font-weight: 500;">
          ${formatCurrency(typeof item.amount === "number" ? item.amount : Number(item.amount) || 0)}
        </td>
      </tr>
    `
    )
    .join("");

  const notesHtml = data.notes
    ? `
    <div style="margin-top: 32px; padding: 20px; background-color: #f9fafb; border-left: 4px solid #3b82f6; border-radius: 4px;">
      <h3 style="margin: 0 0 12px 0; font-size: 14px; font-weight: 600; color: #374151;">Observações</h3>
      <p style="margin: 0; font-size: 13px; color: #4b5563; line-height: 1.6; white-space: pre-wrap;">${escapeHtml(data.notes)}</p>
    </div>
  `
    : "";

  const imagesHtml = data.images && data.images.length > 0
    ? `
    <div style="margin-top: 32px; page-break-before: always;">
      <h3 style="margin: 0 0 16px 0; font-size: 16px; font-weight: 600; color: #111827; border-bottom: 2px solid #e5e7eb; padding-bottom: 8px;">
        Imagens do Projeto
      </h3>
      <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 16px;">
        ${data.images.map((imageUrl) => `
          <div style="border: 1px solid #e5e7eb; border-radius: 8px; overflow: hidden; background-color: #ffffff;">
            <img
              src="${imageUrl}"
              alt="Imagem do projeto"
              style="width: 100%; height: auto; display: block; object-fit: contain; max-height: 400px;"
            />
          </div>
        `).join("")}
      </div>
    </div>
  `
    : "";

  return `
<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Orçamento - ${data.customerName}</title>
  <style>
    @page {
      size: A4;
      margin: 12mm;
    }

    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }

    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
      font-size: 12px;
      line-height: 1.5;
      color: #111827;
      background: #ffffff;
    }

    .container {
      max-width: 210mm;
      margin: 0 auto;
      padding: 20px;
    }

    .header {
      display: grid;
      grid-template-columns: 1fr auto;
      gap: 24px;
      align-items: start;
      margin-bottom: 32px;
      padding-bottom: 20px;
      border-bottom: 3px solid #3b82f6;
    }

    .logo {
      width: 140px;
      height: auto;
      object-fit: contain;
    }

    .header-info {
      text-align: right;
    }

    .document-title {
      font-size: 24px;
      font-weight: 700;
      color: #111827;
      margin-bottom: 8px;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }

    .header-meta {
      font-size: 11px;
      color: #6b7280;
      line-height: 1.6;
    }

    .customer-info {
      background-color: #f9fafb;
      padding: 20px;
      border-radius: 8px;
      margin-bottom: 24px;
      border: 1px solid #e5e7eb;
    }

    .customer-info h2 {
      font-size: 14px;
      font-weight: 600;
      color: #374151;
      margin-bottom: 12px;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }

    .customer-info p {
      font-size: 13px;
      color: #4b5563;
      margin-bottom: 4px;
    }

    .info-label {
      font-weight: 600;
      color: #374151;
    }

    table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 24px;
      border: 1px solid #e5e7eb;
      border-radius: 8px;
      overflow: hidden;
    }

    thead {
      background-color: #f3f4f6;
    }

    th {
      padding: 14px 16px;
      text-align: left;
      font-size: 11px;
      font-weight: 700;
      color: #374151;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      border-bottom: 2px solid #d1d5db;
    }

    th:last-child {
      text-align: right;
    }

    td {
      padding: 14px 16px;
      font-size: 13px;
    }

    .summary-section {
      background-color: #ffffff;
      border: 2px solid #e5e7eb;
      border-radius: 8px;
      padding: 20px;
      margin-top: 24px;
    }

    .summary-row {
      display: flex;
      justify-content: space-between;
      padding: 10px 0;
      font-size: 13px;
      border-bottom: 1px solid #f3f4f6;
    }

    .summary-row:last-child {
      border-bottom: none;
    }

    .summary-label {
      font-weight: 500;
      color: #4b5563;
    }

    .summary-value {
      font-weight: 600;
      color: #111827;
    }

    .summary-row.discount {
      color: #dc2626;
    }

    .summary-row.discount .summary-label,
    .summary-row.discount .summary-value {
      color: #dc2626;
    }

    .summary-row.total {
      margin-top: 12px;
      padding-top: 16px;
      border-top: 2px solid #d1d5db;
      font-size: 18px;
    }

    .summary-row.total .summary-label {
      font-weight: 700;
      color: #111827;
      text-transform: uppercase;
    }

    .summary-row.total .summary-value {
      font-size: 22px;
      font-weight: 700;
      color: #3b82f6;
    }

    .footer {
      margin-top: 48px;
      padding-top: 20px;
      border-top: 1px solid #e5e7eb;
      text-align: center;
      color: #9ca3af;
      font-size: 10px;
      page-break-inside: avoid;
    }

    @media print {
      body {
        print-color-adjust: exact;
        -webkit-print-color-adjust: exact;
      }

      .page-break {
        page-break-before: always;
      }
    }
  </style>
</head>
<body>
  <div class="container">
    <!-- Header -->
    <div class="header">
      <div>
        <h1 class="document-title">Orçamento</h1>
        <div class="header-meta">
          <p><strong>${data.taskTitle}</strong></p>
        </div>
      </div>
      <img src="/logo.png" alt="Logo da Empresa" class="logo" />
    </div>

    <!-- Customer Information -->
    <div class="customer-info">
      <h2>Informações do Cliente</h2>
      <p><span class="info-label">Razão Social:</span> ${escapeHtml(data.customerName)}</p>
      ${data.customerCnpj ? `<p><span class="info-label">CNPJ:</span> ${formatCnpj(data.customerCnpj)}</p>` : ""}
      <p><span class="info-label">Data de Emissão:</span> ${data.currentDate}</p>
      ${data.expiresAt ? `<p><span class="info-label">Válido até:</span> ${data.expiresAt}</p>` : ""}
    </div>

    <!-- Items Table -->
    <table>
      <thead>
        <tr>
          <th>Descrição do Serviço</th>
          <th style="text-align: right;">Valor</th>
        </tr>
      </thead>
      <tbody>
        ${itemsHtml}
      </tbody>
    </table>

    <!-- Summary Section -->
    <div class="summary-section">
      <div class="summary-row">
        <span class="summary-label">Subtotal</span>
        <span class="summary-value">${formatCurrency(data.subtotal)}</span>
      </div>

      ${data.discountType !== "NONE" && data.discountAmount > 0 ? `
        <div class="summary-row discount">
          <span class="summary-label">Desconto (${data.discountDisplay})</span>
          <span class="summary-value">- ${formatCurrency(data.discountAmount)}</span>
        </div>
      ` : ""}

      <div class="summary-row total">
        <span class="summary-label">Valor Total</span>
        <span class="summary-value">${formatCurrency(data.total)}</span>
      </div>
    </div>

    <!-- Notes -->
    ${notesHtml}

    <!-- Images -->
    ${imagesHtml}

    <!-- Footer -->
    <div class="footer">
      <p>Orçamento gerado pelo sistema Ankaa Design</p>
      <p>Data de geração: ${new Date().toLocaleString("pt-BR")}</p>
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
 * Formats CNPJ (Brazilian company registration number)
 */
function formatCnpj(cnpj: string): string {
  const cleaned = cnpj.replace(/\D/g, "");
  if (cleaned.length !== 14) return cnpj;
  return cleaned.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, "$1.$2.$3/$4-$5");
}
