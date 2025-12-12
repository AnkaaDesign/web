/**
 * Professional Payroll PDF Generator
 * Generates a proper Brazilian payroll slip (Contracheque/Holerite)
 */

interface PayrollPDFData {
  // Employee info
  employeeName: string;
  employeeCPF?: string;
  employeePIS?: string;
  employeePayrollNumber?: string;
  position?: string;
  sector?: string;
  admissionDate?: string;

  // Period
  month: number;
  year: number;

  // Earnings (Proventos/Vencimentos)
  baseRemuneration: number;
  overtime50Hours?: number;
  overtime50Amount?: number;
  overtime100Hours?: number;
  overtime100Amount?: number;
  nightHours?: number;
  nightDifferentialAmount?: number;
  dsrAmount?: number;
  bonusAmount?: number;

  // Deductions (Descontos)
  inssBase?: number;
  inssAmount?: number;
  irrfBase?: number;
  irrfAmount?: number;
  fgtsAmount?: number;
  absenceHours?: number;
  absenceAmount?: number;
  lateArrivalMinutes?: number;
  lateArrivalAmount?: number;
  otherDiscounts?: Array<{ description: string; amount: number }>;

  // Totals
  grossSalary: number;
  totalDiscounts: number;
  netSalary: number;

  // Company info (optional)
  companyName?: string;
  companyCNPJ?: string;
  companyAddress?: string;
}

// Helper function to convert decimal hours to HH:MM format
function formatHoursToHHMM(decimalHours: number): string {
  const hours = Math.floor(decimalHours);
  const minutes = Math.round((decimalHours - hours) * 60);
  return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
}

// Helper function to format currency
function formatCurrency(value: number): string {
  return value.toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
}

// Helper function to format CPF
function formatCPF(cpf: string): string {
  const cleaned = cpf.replace(/\D/g, '');
  if (cleaned.length !== 11) return cpf;
  return cleaned.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
}

// Helper function to format PIS
function formatPIS(pis: string): string {
  const cleaned = pis.replace(/\D/g, '');
  if (cleaned.length !== 11) return pis;
  return cleaned.replace(/(\d{3})(\d{5})(\d{2})(\d{1})/, '$1.$2.$3-$4');
}

// Month names in Portuguese
const MONTH_NAMES = [
  'JANEIRO', 'FEVEREIRO', 'MARÇO', 'ABRIL', 'MAIO', 'JUNHO',
  'JULHO', 'AGOSTO', 'SETEMBRO', 'OUTUBRO', 'NOVEMBRO', 'DEZEMBRO'
];

export async function generatePayrollPDF(data: PayrollPDFData): Promise<void> {
  const monthName = MONTH_NAMES[data.month - 1] || '';

  // Build earnings rows
  const earningsRows: string[] = [];

  // Base remuneration
  earningsRows.push(`
    <tr>
      <td class="desc">Salário Base</td>
      <td class="ref">-</td>
      <td class="amount">${formatCurrency(data.baseRemuneration)}</td>
    </tr>
  `);

  // Overtime 50%
  if (data.overtime50Amount && data.overtime50Amount > 0) {
    earningsRows.push(`
      <tr>
        <td class="desc">Horas Extras 50%</td>
        <td class="ref">${formatHoursToHHMM(data.overtime50Hours || 0)}</td>
        <td class="amount">${formatCurrency(data.overtime50Amount)}</td>
      </tr>
    `);
  }

  // Overtime 100%
  if (data.overtime100Amount && data.overtime100Amount > 0) {
    earningsRows.push(`
      <tr>
        <td class="desc">Horas Extras 100%</td>
        <td class="ref">${formatHoursToHHMM(data.overtime100Hours || 0)}</td>
        <td class="amount">${formatCurrency(data.overtime100Amount)}</td>
      </tr>
    `);
  }

  // Night differential
  if (data.nightDifferentialAmount && data.nightDifferentialAmount > 0) {
    earningsRows.push(`
      <tr>
        <td class="desc">Adicional Noturno</td>
        <td class="ref">${formatHoursToHHMM(data.nightHours || 0)}</td>
        <td class="amount">${formatCurrency(data.nightDifferentialAmount)}</td>
      </tr>
    `);
  }

  // DSR
  if (data.dsrAmount && data.dsrAmount > 0) {
    earningsRows.push(`
      <tr>
        <td class="desc">DSR - Repouso Remunerado</td>
        <td class="ref">-</td>
        <td class="amount">${formatCurrency(data.dsrAmount)}</td>
      </tr>
    `);
  }

  // Bonus
  if (data.bonusAmount && data.bonusAmount > 0) {
    earningsRows.push(`
      <tr>
        <td class="desc">Bônus por Desempenho</td>
        <td class="ref">-</td>
        <td class="amount">${formatCurrency(data.bonusAmount)}</td>
      </tr>
    `);
  }

  // Build deductions rows
  const deductionsRows: string[] = [];

  // INSS
  if (data.inssAmount && data.inssAmount > 0) {
    deductionsRows.push(`
      <tr>
        <td class="desc">INSS - Previdência Social</td>
        <td class="ref">Base: ${formatCurrency(data.inssBase || 0)}</td>
        <td class="amount negative">${formatCurrency(data.inssAmount)}</td>
      </tr>
    `);
  }

  // IRRF
  if (data.irrfAmount && data.irrfAmount > 0) {
    deductionsRows.push(`
      <tr>
        <td class="desc">IRRF - Imposto de Renda</td>
        <td class="ref">Base: ${formatCurrency(data.irrfBase || 0)}</td>
        <td class="amount negative">${formatCurrency(data.irrfAmount)}</td>
      </tr>
    `);
  }

  // Absences
  if (data.absenceAmount && data.absenceAmount > 0) {
    deductionsRows.push(`
      <tr>
        <td class="desc">Faltas</td>
        <td class="ref">${formatHoursToHHMM(data.absenceHours || 0)}</td>
        <td class="amount negative">${formatCurrency(data.absenceAmount)}</td>
      </tr>
    `);
  }

  // Late arrivals
  if (data.lateArrivalAmount && data.lateArrivalAmount > 0) {
    const lateHours = (data.lateArrivalMinutes || 0) / 60;
    deductionsRows.push(`
      <tr>
        <td class="desc">Atrasos</td>
        <td class="ref">${formatHoursToHHMM(lateHours)}</td>
        <td class="amount negative">${formatCurrency(data.lateArrivalAmount)}</td>
      </tr>
    `);
  }

  // Other discounts
  if (data.otherDiscounts && data.otherDiscounts.length > 0) {
    data.otherDiscounts.forEach(discount => {
      deductionsRows.push(`
        <tr>
          <td class="desc">${discount.description}</td>
          <td class="ref">-</td>
          <td class="amount negative">${formatCurrency(discount.amount)}</td>
        </tr>
      `);
    });
  }

  // FGTS (informativo - não é desconto do funcionário)
  const fgtsRow = data.fgtsAmount && data.fgtsAmount > 0 ? `
    <tr class="info-row">
      <td class="desc">FGTS - 8% (Depósito do Empregador)</td>
      <td class="ref">Informativo</td>
      <td class="amount">${formatCurrency(data.fgtsAmount)}</td>
    </tr>
  ` : '';

  // Generate HTML
  const htmlContent = `
    <!DOCTYPE html>
    <html lang="pt-BR">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Folha de Pagamento - ${data.employeeName} - ${monthName}/${data.year}</title>
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

        html, body {
          height: 100vh;
          width: 100vw;
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
          background: white;
          font-size: 11px;
          line-height: 1.3;
        }

        body {
          display: grid;
          grid-template-rows: auto 1fr auto;
          min-height: 100vh;
          padding: 0;
        }

        .header {
          display: flex;
          align-items: center;
          margin-bottom: 20px;
          padding-top: 10px;
        }

        .logo {
          width: 100px;
          height: auto;
          margin-right: 15px;
        }

        .header-info {
          flex: 1;
        }

        .header-info h1 {
          font-size: 18px;
          margin-bottom: 5px;
        }

        .info {
          color: #6b7280;
          font-size: 11px;
        }

        .info p {
          margin: 2px 0;
        }

        .content-wrapper {
          flex: 1;
          overflow: auto;
          min-height: 0;
          padding-bottom: 40px;
        }

        .employee-info {
          margin-bottom: 15px;
          padding: 12px;
          background: #f9fafb;
          border: 1px solid #e5e7eb;
        }

        .employee-info h2 {
          font-size: 11px;
          font-weight: 600;
          margin-bottom: 8px;
          color: #374151;
        }

        .info-grid {
          display: grid;
          grid-template-columns: 1fr 1fr 1fr;
          gap: 8px;
          font-size: 10px;
        }

        .info-item {
          display: flex;
          gap: 4px;
        }

        .info-item .label {
          font-weight: 600;
        }

        table {
          width: 100%;
          border-collapse: collapse;
          font-size: 11px;
          margin-bottom: 12px;
        }

        th {
          background-color: #f9fafb;
          font-weight: 600;
          color: #374151;
          padding: 8px 6px;
          border-bottom: 1px solid #e5e7eb;
          font-size: 10px;
          text-transform: uppercase;
          letter-spacing: 0.03em;
        }

        th:first-child {
          text-align: left;
        }

        th:nth-child(2) {
          text-align: left;
          width: 20%;
        }

        th:nth-child(3) {
          text-align: right;
          width: 25%;
        }

        td {
          padding: 8px 6px;
          border-bottom: 1px solid #f3f4f6;
          vertical-align: top;
        }

        td.ref {
          text-align: left;
          color: #6b7280;
          font-size: 10px;
        }

        td.amount {
          text-align: right;
          font-weight: 600;
        }

        td.amount.negative {
          color: #dc2626;
        }

        tbody tr:nth-child(even) {
          background-color: #fafafa;
        }

        tbody tr.info-row {
          background: #eff6ff;
          font-style: italic;
        }

        .totals {
          margin-top: 15px;
        }

        .totals .net-row {
          background: hsl(142, 72%, 29%);
          color: #fff;
          padding: 12px 16px;
          display: flex;
          justify-content: space-between;
          font-weight: 700;
          font-size: 14px;
        }

        .totals .net-row .total-value {
          font-size: 16px;
        }

        @media print {
          body {
            print-color-adjust: exact;
            -webkit-print-color-adjust: exact;
          }
        }
      </style>
    </head>
    <body>
      <div class="header">
        <img src="/logo.png" alt="Logo" class="logo" />
        <div class="header-info">
          <h1>Folha de Pagamento</h1>
          <div class="info">
            <p><strong>Período:</strong> ${monthName}/${data.year}</p>
          </div>
        </div>
      </div>

      <div class="content-wrapper">
        <div class="employee-info">
          <h2>Dados do Colaborador</h2>
          <div class="info-grid">
            <div class="info-item">
              <span class="label">Nome:</span>
              <span>${data.employeeName}</span>
            </div>
            ${data.employeeCPF ? `
              <div class="info-item">
                <span class="label">CPF:</span>
                <span>${formatCPF(data.employeeCPF)}</span>
              </div>
            ` : ''}
            ${data.employeePIS ? `
              <div class="info-item">
                <span class="label">PIS:</span>
                <span>${formatPIS(data.employeePIS)}</span>
              </div>
            ` : ''}
            ${data.employeePayrollNumber ? `
              <div class="info-item">
                <span class="label">Matrícula:</span>
                <span>${data.employeePayrollNumber}</span>
              </div>
            ` : ''}
            ${data.position ? `
              <div class="info-item">
                <span class="label">Cargo:</span>
                <span>${data.position}</span>
              </div>
            ` : ''}
            ${data.sector ? `
              <div class="info-item">
                <span class="label">Setor:</span>
                <span>${data.sector}</span>
              </div>
            ` : ''}
          </div>
        </div>

        <table>
          <thead>
            <tr>
              <th class="text-left">Descrição</th>
              <th class="text-center">Ref.</th>
              <th class="text-right">Valor</th>
            </tr>
          </thead>
          <tbody>
            ${earningsRows.join('')}
            ${deductionsRows.join('')}
            ${fgtsRow}
          </tbody>
        </table>

        <div class="totals">
          <div class="net-row">
            <span>Valor Líquido:</span>
            <span class="total-value">${formatCurrency(data.netSalary)}</span>
          </div>
        </div>
      </div>
    </body>
    </html>
  `;

  // Open print dialog
  const printWindow = window.open('', '_blank');
  if (printWindow) {
    printWindow.document.write(htmlContent);
    printWindow.document.close();
    printWindow.focus();

    // Wait for content to load before printing
    printWindow.onload = () => {
      setTimeout(() => {
        printWindow.print();
      }, 250);
    };
  } else {
    alert('Por favor, permita pop-ups para gerar o PDF');
  }
}
