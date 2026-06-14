/**
 * Vacation Receipt (Recibo de Férias) PDF Generator.
 * Produces a standalone payable receipt — NOT embedded in the monthly folha.
 * Uses the same print-window approach as the other PDF generators in this repo.
 */
import { formatCurrency } from "./number";
import { formatDate } from "./date";
import type { VacationRecibo } from "../types/vacation";

export interface VacationReciboPDFData {
  recibo: VacationRecibo;
  employeeName: string;
  position?: string;
  sector?: string;
  acquisitiveStart?: Date | string | null;
  acquisitiveEnd?: Date | string | null;
  concessiveEnd?: Date | string | null;
  paymentDate?: Date | string | null;
  companyName?: string;
}

export function generateVacationReciboPDF(data: VacationReciboPDFData): void {
  const { recibo } = data;

  const earningLine = (label: string, amount: number) => `
    <tr>
      <td>${label}</td>
      <td class="text-right">${formatCurrency(amount)}</td>
      <td class="text-right">-</td>
    </tr>`;

  const deductionLine = (label: string, amount: number) => `
    <tr>
      <td>${label}</td>
      <td class="text-right">-</td>
      <td class="text-right">${formatCurrency(amount)}</td>
    </tr>`;

  // Build the line rows from the structured recibo. Falls back to the
  // explicit fields when lines[] is not present.
  const rows: string[] = [];
  if (recibo.lines && recibo.lines.length > 0) {
    for (const line of recibo.lines) {
      if (line.amount >= 0) rows.push(earningLine(line.label, line.amount));
      else rows.push(deductionLine(line.label, Math.abs(line.amount)));
    }
  } else {
    rows.push(earningLine(`Férias (${recibo.vacationDays} dias)`, recibo.baseRemuneration));
    rows.push(earningLine("1/3 Constitucional", recibo.oneThird));
    if (recibo.abonoPecuniarioDays > 0) {
      rows.push(earningLine(`Abono Pecuniário (${recibo.abonoPecuniarioDays} dias)`, recibo.abonoAmount));
      if (recibo.abonoOneThird > 0) rows.push(earningLine("1/3 sobre Abono", recibo.abonoOneThird));
    }
    if (recibo.inss > 0) rows.push(deductionLine("INSS", recibo.inss));
    if (recibo.irrf > 0) rows.push(deductionLine("IRRF", recibo.irrf));
  }

  const period =
    data.acquisitiveStart && data.acquisitiveEnd ? `${formatDate(data.acquisitiveStart as any)} a ${formatDate(data.acquisitiveEnd as any)}` : "-";

  const htmlContent = `
    <!DOCTYPE html>
    <html lang="pt-BR">
    <head>
      <meta charset="utf-8" />
      <title>Recibo de Férias — ${data.employeeName}</title>
      <style>
        @page { size: A4; margin: 16mm; }
        * { box-sizing: border-box; }
        body { font-family: Arial, Helvetica, sans-serif; color: #111; font-size: 12px; }
        h1 { font-size: 18px; margin: 0 0 4px; }
        .muted { color: #555; }
        .header { border-bottom: 2px solid #111; padding-bottom: 8px; margin-bottom: 12px; }
        .meta { display: grid; grid-template-columns: 1fr 1fr; gap: 4px 16px; margin-bottom: 16px; }
        .meta div { padding: 2px 0; }
        .meta .label { color: #555; }
        table { width: 100%; border-collapse: collapse; margin-top: 8px; }
        th, td { padding: 6px 8px; border-bottom: 1px solid #ddd; text-align: left; }
        th { background: #f3f3f3; text-transform: uppercase; font-size: 10px; }
        .text-right { text-align: right; }
        .totals { margin-top: 16px; border-top: 2px solid #111; padding-top: 8px; }
        .totals-row { display: flex; justify-content: space-between; padding: 2px 8px; }
        .net-row { display: flex; justify-content: space-between; padding: 8px; font-weight: bold; font-size: 14px; background: #f3f3f3; }
        .badge { display: inline-block; background: #b91c1c; color: #fff; padding: 1px 6px; border-radius: 4px; font-size: 10px; }
        .sign { margin-top: 48px; display: flex; justify-content: space-between; gap: 32px; }
        .sign div { flex: 1; border-top: 1px solid #111; padding-top: 4px; text-align: center; font-size: 11px; }
      </style>
    </head>
    <body>
      <div class="header">
        <h1>Recibo de Férias</h1>
        <div class="muted">${data.companyName ?? ""}</div>
      </div>

      <div class="meta">
        <div><span class="label">Colaborador:</span> <strong>${data.employeeName}</strong></div>
        <div><span class="label">Cargo:</span> ${data.position ?? "-"}</div>
        <div><span class="label">Setor:</span> ${data.sector ?? "-"}</div>
        <div><span class="label">Período aquisitivo:</span> ${period}</div>
        <div><span class="label">Limite concessivo:</span> ${data.concessiveEnd ? formatDate(data.concessiveEnd as any) : "-"}</div>
        <div><span class="label">Data de pagamento:</span> ${data.paymentDate ? formatDate(data.paymentDate as any) : "-"}</div>
        ${recibo.isDouble ? `<div><span class="badge">Férias em dobro (art. 137)</span></div>` : ""}
      </div>

      <table>
        <thead>
          <tr>
            <th>Descrição</th>
            <th class="text-right">Provento</th>
            <th class="text-right">Desconto</th>
          </tr>
        </thead>
        <tbody>
          ${rows.join("")}
        </tbody>
      </table>

      <div class="totals">
        <div class="totals-row"><span>Total de Proventos</span><span>${formatCurrency(recibo.earnings)}</span></div>
        <div class="totals-row"><span>Total de Descontos</span><span>${formatCurrency(recibo.discounts)}</span></div>
        <div class="net-row"><span>Líquido a Receber</span><span>${formatCurrency(recibo.net)}</span></div>
      </div>

      <div class="sign">
        <div>Empregador</div>
        <div>Colaborador</div>
      </div>
    </body>
    </html>
  `;

  const printWindow = window.open("", "_blank");
  if (printWindow) {
    printWindow.document.write(htmlContent);
    printWindow.document.close();
    printWindow.focus();
    printWindow.onload = () => {
      setTimeout(() => {
        printWindow.print();
      }, 250);
    };
  } else {
    alert("Por favor, permita pop-ups para gerar o recibo");
  }
}
