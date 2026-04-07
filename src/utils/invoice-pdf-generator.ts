import { formatCurrency, formatDate, toTitleCase } from "./index";
import { generatePaymentText } from "./quote-text-generators";
import { COMPANY_INFO, BRAND_COLORS } from "@/config/company";
import { getApiBaseUrl } from "@/lib/utils";

interface ServiceReportPdfOptions {
  task: any;
  invoice: any;
  customerConfig: any;
  services: any[];
  installments: any[];
  budgetNumber: number;
  /** Service orders with check-in/check-out photos */
  serviceOrders?: any[];
}

function escapeHtml(str: string): string {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}

/**
 * Generate a complete Service Report PDF (Relatório de Serviços) using browser print dialog.
 * Uses the SAME design/layout as the budget PDF but documents work performed.
 *
 * Pages:
 * 1. Service summary (services, totals, installments, payment terms)
 * 2. Layout image (if available)
 * 3+. Dossiê photos by service order (check-in / check-out)
 */
export function exportInvoicePdf(options: ServiceReportPdfOptions): void {
  const { task, invoice, customerConfig, services, installments, budgetNumber, serviceOrders } = options;
  const customer = customerConfig?.customer || customerConfig?.customerData || {};
  const customerName = customer.fantasyName || customer.corporateName || "Cliente";
  const { primaryGreen, textDark, textGray } = BRAND_COLORS;
  const apiUrl = getApiBaseUrl();
  const whatsappLink = `https://wa.me/${COMPANY_INFO.phoneClean}`;
  const formattedBudgetNumber = String(budgetNumber).padStart(4, "0");

  // Vehicle info
  const vehicleInfo = [
    task.serialNumber ? `Nº Série: ${task.serialNumber}` : null,
    task.truck?.plate ? `Placa: ${task.truck.plate}` : null,
    task.truck?.chassisNumber ? `Chassi: ${task.truck.chassisNumber}` : null,
  ].filter(Boolean).join(" | ");

  // ── Page 1: Services Summary ──
  const servicesHtml = services.map((s: any, i: number) => {
    const desc = toTitleCase(s.description || "");
    const obs = s.observation ? ` - ${s.observation}` : "";
    const amount = Number(s.amount) || 0;
    const discount = computeDiscount(s);
    const net = amount - discount;

    return `<div class="service-item">
      <span class="service-desc">${i + 1} - ${escapeHtml(desc)}${obs ? escapeHtml(obs) : ""}</span>
      <span class="service-value">${discount > 0
        ? `<span style="text-decoration:line-through;color:${textGray};font-size:8pt">${formatCurrency(amount)}</span> ${formatCurrency(net)}`
        : formatCurrency(amount)
      }</span>
    </div>`;
  }).join("");

  const totalAmount = Number(invoice?.totalAmount ?? 0);
  const subtotal = services.reduce((sum: number, s: any) => sum + (Number(s.amount) || 0), 0);
  const totalDiscount = subtotal - totalAmount;
  const hasDiscount = totalDiscount > 0.01;

  // Installments table
  const installmentsHtml = installments.length > 0 ? `
    <div class="section">
      <div class="section-title">Parcelas</div>
      <table class="data-table">
        <thead><tr><th>#</th><th>Vencimento</th><th>Valor</th><th>Status</th></tr></thead>
        <tbody>${installments.map((inst: any) => `
          <tr>
            <td>${inst.number}</td>
            <td>${formatDate(inst.dueDate)}</td>
            <td>${formatCurrency(Number(inst.amount))}</td>
            <td>${getInstallmentStatusLabel(inst.status)}</td>
          </tr>`).join("")}
        </tbody>
      </table>
    </div>` : "";

  // Payment conditions
  const paymentText = customerConfig?.customPaymentText
    || generatePaymentText({ customPaymentText: null, paymentCondition: customerConfig?.paymentCondition, total: Number(invoice?.totalAmount ?? 0) });
  const paymentHtml = paymentText ? `
    <div class="section">
      <div class="section-title">Condições de Pagamento</div>
      <div class="section-content">${escapeHtml(paymentText)}</div>
    </div>` : "";

  // ── Page 2: Layout Image (if available) ──
  const layoutFileId = task.quote?.layoutFile?.id;
  const layoutPageHtml = layoutFileId ? `
    <div class="page">
      ${buildHeader(formattedBudgetNumber, false)}
      <div class="page-content layout-page">
        <div class="section-title" style="margin-bottom:4mm">Layout Aprovado</div>
        <div class="layout-container">
          <img src="${apiUrl}/files/serve/${layoutFileId}" alt="Layout" class="layout-img" />
        </div>
      </div>
      ${buildFooter()}
    </div>` : "";

  // ── Pages 3+: Dossiê (check-in/check-out photos per service order) ──
  const productionSOs = (serviceOrders || task.serviceOrders || [])
    .filter((so: any) => (so.checkinFiles?.length > 0 || so.checkoutFiles?.length > 0))
    .sort((a: any, b: any) => (a.position ?? 0) - (b.position ?? 0));

  const dossiePages = productionSOs.map((so: any) => {
    const isOutros = so.description === "Outros" && !!so.observation;
    const desc = isOutros ? so.observation : so.description;
    const checkinFiles = so.checkinFiles || [];
    const checkoutFiles = so.checkoutFiles || [];

    const photoGrid = (files: any[], label: string, color: string) => {
      if (files.length === 0) return "";
      return `
        <div class="photo-section">
          <div class="photo-label" style="color:${color}">${label} (${files.length})</div>
          <div class="photo-grid">${files.map((f: any) =>
            `<div class="photo-cell"><img src="${apiUrl}/files/serve/${f.id}" alt="${escapeHtml(desc || 'Foto')}" class="photo-img" /></div>`
          ).join("")}</div>
        </div>`;
    };

    return `
      <div class="page">
        ${buildHeader(formattedBudgetNumber, false)}
        <div class="page-content">
          <div class="so-header">
            <span class="so-title">${escapeHtml(desc || "Serviço")}</span>
            ${!isOutros && so.observation ? `<span class="so-obs">${escapeHtml(so.observation)}</span>` : ""}
          </div>
          ${photoGrid(checkinFiles, "Antes (Check-in)", "#2563eb")}
          ${photoGrid(checkoutFiles, "Depois (Check-out)", "#16a34a")}
        </div>
        ${buildFooter()}
      </div>`;
  }).join("");

  // ── Build complete HTML document ──
  const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8">
  <title>Relatório de Serviços ${formattedBudgetNumber} - ${escapeHtml(customerName)}</title>
  <style>
    @page { size: A4; margin: 0; }
    * { margin: 0; padding: 0; box-sizing: border-box; }
    html, body { width: 210mm; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; color: ${textDark}; background: #fff; }
    a { color: inherit; text-decoration: none; }

    .page {
      width: 210mm; height: 297mm; padding: 10mm 22mm 12mm 22mm;
      display: flex; flex-direction: column; overflow: hidden;
      page-break-after: always;
    }
    .page:last-child { page-break-after: auto; }
    .page-content { flex: 1; }

    /* Header — same as budget */
    .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 2mm; flex-shrink: 0; }
    .header .logo { height: 14mm; width: auto; }
    .header-right { text-align: right; }
    .header-title { font-size: 13pt; font-weight: bold; color: ${textDark}; margin-bottom: 1mm; }
    .header-info { font-size: 9pt; color: #333; line-height: 1.4; }
    .header-info-label { font-weight: bold; }
    .header-line { height: 1px; background: linear-gradient(to right, #888 0%, ${primaryGreen} 30%); margin-bottom: 4mm; flex-shrink: 0; }

    /* Document title */
    .doc-title { text-align: center; font-size: 13pt; font-weight: bold; color: ${primaryGreen}; text-decoration: underline; margin-bottom: 3mm; letter-spacing: 2px; }

    /* Customer */
    .customer { margin-bottom: 4mm; }
    .customer-name { font-size: 11pt; font-weight: bold; margin-bottom: 1mm; }
    .customer-info { font-size: 9pt; color: ${textGray}; }

    /* Services */
    .services-title { font-size: 10pt; font-weight: bold; color: ${primaryGreen}; margin-bottom: 2mm; border-bottom: 1px solid ${primaryGreen}40; padding-bottom: 0.5mm; }
    .service-item { display: flex; justify-content: space-between; align-items: center; padding: 1.5mm 2mm; font-size: 10pt; border-bottom: 1px solid #e8e8e8; }
    .service-item:nth-child(even) { background: #f8f8f8; }
    .service-desc { flex: 1; }
    .service-value { font-weight: 600; white-space: nowrap; margin-left: 3mm; }

    /* Totals */
    .totals { margin-top: 3mm; text-align: right; }
    .total-row { padding: 1mm 2mm; font-size: 10pt; }
    .total-row.discount { color: #c00; }
    .total-row.final { font-weight: bold; font-size: 12pt; color: ${primaryGreen}; border-top: 2px solid ${primaryGreen}; padding-top: 2mm; margin-top: 1mm; }

    /* Sections */
    .section { margin-top: 4mm; }
    .section-title { font-size: 10pt; font-weight: bold; color: ${primaryGreen}; margin-bottom: 1mm; padding-bottom: 0.5mm; border-bottom: 1px solid ${primaryGreen}40; }
    .section-content { font-size: 9.5pt; line-height: 1.4; color: ${textDark}; margin-top: 1mm; }

    /* Data table (installments) */
    .data-table { width: 100%; border-collapse: collapse; font-size: 9pt; margin-top: 2mm; }
    .data-table th { text-align: left; font-weight: 600; color: ${primaryGreen}; padding: 2mm 3mm; border-bottom: 1.5px solid ${primaryGreen}; }
    .data-table td { padding: 1.5mm 3mm; border-bottom: 1px solid #e8e8e8; }
    .data-table tr:nth-child(even) td { background: #f8f8f8; }

    /* Layout page */
    .layout-page { display: flex; flex-direction: column; }
    .layout-container { flex: 1; display: flex; align-items: center; justify-content: center; }
    .layout-img { max-width: 100%; max-height: 220mm; object-fit: contain; }

    /* Dossiê pages */
    .so-header { background: ${primaryGreen}; color: #fff; padding: 2mm 3mm; border-radius: 1.5mm 1.5mm 0 0; display: flex; align-items: center; gap: 3mm; }
    .so-title { font-size: 10pt; font-weight: 600; }
    .so-obs { font-size: 8pt; opacity: 0.85; font-style: italic; }
    .photo-section { margin-top: 3mm; }
    .photo-label { font-size: 8.5pt; font-weight: 600; text-transform: uppercase; letter-spacing: 0.3px; margin-bottom: 1.5mm; }
    .photo-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 2mm; }
    .photo-cell { aspect-ratio: 4/3; overflow: hidden; border-radius: 1mm; border: 0.5px solid #e0e0e0; background: #f9f9f9; }
    .photo-img { width: 100%; height: 100%; object-fit: cover; }

    /* Footer — same as budget */
    .footer { padding-top: 2mm; border-top: 1px solid; border-image: linear-gradient(to right, #888 0%, ${primaryGreen} 30%) 1; flex-shrink: 0; margin-top: auto; }
    .footer-company { font-size: 10pt; font-weight: bold; color: ${primaryGreen}; margin-bottom: 1mm; }
    .footer-info { font-size: 8pt; color: #333; line-height: 1.5; }
    .footer-link { color: ${primaryGreen}; }

    @media print { html, body { width: 210mm; height: auto; print-color-adjust: exact; -webkit-print-color-adjust: exact; } }
  </style>
</head>
<body>
  <!-- Page 1: Service Summary -->
  <div class="page">
    ${buildHeader(formattedBudgetNumber, true)}
    <div class="page-content">
      <div class="doc-title">RELATÓRIO DE SERVIÇOS</div>

      <div class="customer">
        <div class="customer-name">${escapeHtml(customerName)}</div>
        ${customer.cnpj ? `<div class="customer-info">CNPJ: ${customer.cnpj}</div>` : ""}
        ${vehicleInfo ? `<div class="customer-info">${escapeHtml(vehicleInfo)}</div>` : ""}
        ${task.finishedAt ? `<div class="customer-info">Finalizado em: ${formatDate(task.finishedAt)}</div>` : ""}
      </div>

      <div class="services-title">Serviços Realizados</div>
      ${servicesHtml}

      <div class="totals">
        ${hasDiscount ? `
          <div class="total-row">Subtotal: ${formatCurrency(subtotal)}</div>
          <div class="total-row discount">Desconto: -${formatCurrency(totalDiscount)}</div>
        ` : ""}
        <div class="total-row final">TOTAL: ${formatCurrency(totalAmount)}</div>
      </div>

      ${installmentsHtml}
      ${paymentHtml}
    </div>
    ${buildFooter()}
  </div>

  ${layoutPageHtml}
  ${dossiePages}
</body>
</html>`;

  const printWindow = window.open("", "_blank");
  if (!printWindow) return;
  printWindow.document.write(html);
  printWindow.document.close();

  // Wait for images to load before printing
  printWindow.onload = () => {
    const images = printWindow.document.querySelectorAll("img");
    const imagePromises = Array.from(images).map((img) => {
      if (img.complete) return Promise.resolve();
      return new Promise<void>((resolve) => {
        img.onload = () => resolve();
        img.onerror = () => resolve();
      });
    });
    Promise.all(imagePromises).then(() => {
      printWindow.focus();
      printWindow.print();
      printWindow.onafterprint = () => printWindow.close();
    });
  };

  function buildHeader(number: string, showDate: boolean): string {
    return `
      <header class="header">
        <img src="/logo.png" alt="${COMPANY_INFO.name}" class="logo" />
        <div class="header-right">
          <div class="header-title">RELATÓRIO Nº ${number}</div>
          ${showDate ? `<div class="header-info"><span class="header-info-label">Data:</span> ${formatDate(new Date())}</div>` : ""}
          ${task.finishedAt && showDate ? `<div class="header-info"><span class="header-info-label">Finalizado:</span> ${formatDate(task.finishedAt)}</div>` : ""}
        </div>
      </header>
      <div class="header-line"></div>`;
  }

  function buildFooter(): string {
    return `
      <footer class="footer">
        <div class="footer-company">${COMPANY_INFO.name}</div>
        <div class="footer-info">
          ${COMPANY_INFO.address}<br />
          <a href="${whatsappLink}" class="footer-link">${COMPANY_INFO.phone}</a> |
          <a href="${COMPANY_INFO.websiteUrl}" class="footer-link">${COMPANY_INFO.website}</a>
        </div>
      </footer>`;
  }
}

function computeDiscount(service: any): number {
  const amount = Number(service.amount) || 0;
  const discountValue = Number(service.discountValue) || 0;
  if (!discountValue || service.discountType === "NONE") return 0;
  if (service.discountType === "PERCENTAGE") return amount * discountValue / 100;
  return Math.min(discountValue, amount);
}

function getInstallmentStatusLabel(status: string): string {
  const labels: Record<string, string> = {
    PENDING: "Pendente",
    PROCESSING: "Processando",
    PAID: "Paga",
    OVERDUE: "Vencida",
    CANCELLED: "Cancelada",
  };
  return labels[status] || status;
}
