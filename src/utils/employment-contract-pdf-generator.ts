/**
 * Contrato de Trabalho (CLT) PDF generator.
 *
 * Produces a branded standalone employment-contract document for an admission,
 * using the same print-window approach + company branding as the other PDF
 * generators in this repo (order-pdf-generator.ts, vacation-recibo-pdf-generator.ts).
 *
 * Parties:
 *   - Empregadora: company branding from @/config/company (COMPANY_INFO).
 *   - Empregado: collaborator data (name / CPF / cargo / setor) + current vínculo
 *     (EmploymentContract) fields (salário, admissão, modalidade, experiência).
 *
 * NOTE on jornada: the data model does not store a per-position/per-contract
 * working schedule (jornada), so the contract renders the canonical CLT default
 * ("44 horas semanais") unless an explicit `jornada` string is passed in.
 */
import { formatCurrency } from "./number";
import { formatDate } from "./date";
import { formatCPF } from "./formatters";
import { COMPANY_INFO, BRAND_COLORS } from "@/config/company";
import {
  CONTRACT_TYPE_LABELS,
  CONTRACT_STATUS_LABELS,
  EMPLOYEE_TYPE_LABELS,
  type CONTRACT_TYPE,
  type CONTRACT_STATUS,
  type EMPLOYEE_TYPE,
} from "../constants";

export interface EmploymentContractPdfData {
  /** Collaborator full name. */
  employeeName: string;
  /** Collaborator CPF (raw or formatted). */
  cpf?: string | null;
  /** Cargo (position name). */
  position?: string | null;
  /** Setor (sector name). */
  sector?: string | null;
  /** Monthly base salary in R$. When null, rendered as "a combinar". */
  monthlySalary?: number | null;
  /** Hire date / data de admissão. */
  admissionDate?: Date | string | null;
  /** Worker category (CLT / Estagiário / Terceirizado…). */
  employeeType?: EMPLOYEE_TYPE | null;
  /** Legal contract modality (prazo indeterminado / determinado…). CLT only. */
  contractType?: CONTRACT_TYPE | null;
  /** Contract status (em experiência / ativo…). */
  contractStatus?: CONTRACT_STATUS | null;
  /** Working schedule text. Defaults to the canonical CLT "44 horas semanais". */
  jornada?: string | null;
  /** Experience period bounds (período de experiência), when applicable. */
  exp1StartAt?: Date | string | null;
  exp1EndAt?: Date | string | null;
  exp2StartAt?: Date | string | null;
  exp2EndAt?: Date | string | null;
  /** Provider company (terceirizado / PJ). */
  providerName?: string | null;
  providerCnpj?: string | null;
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

/** Format a Brazilian phone like "43 9 8428-3228" → "(43) 9 8428-3228". */
function formatPhoneWithDDD(phone: string): string {
  if (!phone) return "";
  if (phone.startsWith("(")) return phone;
  const m = phone.match(/^(\d{2})\s+(.+)$/);
  return m ? `(${m[1]}) ${m[2]}` : phone;
}

function periodRange(start?: Date | string | null, end?: Date | string | null): string {
  const s = toDate(start);
  const e = toDate(end);
  if (s && e) return `${formatDate(s)} a ${formatDate(e)}`;
  if (s) return `a partir de ${formatDate(s)}`;
  if (e) return `até ${formatDate(e)}`;
  return "";
}

/**
 * Build the branded HTML document for an employment contract and return it as a
 * string. Exposed separately so it can be unit-tested without a print window.
 */
export function buildEmploymentContractPdfHtml(data: EmploymentContractPdfData): string {
  const now = new Date();
  const admission = toDate(data.admissionDate);
  const isProvider = !!data.providerName || !!data.providerCnpj;

  const employeeTypeLabel = data.employeeType ? EMPLOYEE_TYPE_LABELS[data.employeeType] || data.employeeType : "-";
  const contractTypeLabel = data.contractType ? CONTRACT_TYPE_LABELS[data.contractType] || data.contractType : "-";
  const contractStatusLabel = data.contractStatus ? CONTRACT_STATUS_LABELS[data.contractStatus] || data.contractStatus : "-";
  const salaryText = typeof data.monthlySalary === "number" && data.monthlySalary > 0 ? formatCurrency(data.monthlySalary) : "a combinar";
  const jornada = data.jornada || "44 (quarenta e quatro) horas semanais";
  const cpfText = data.cpf ? formatCPF(data.cpf) : "-";

  // Identification rows (dl-style key/value grid).
  const idRows: Array<[string, string]> = [
    ["Nome", escapeHtml(data.employeeName || "-")],
    ["CPF", escapeHtml(cpfText)],
    ["Cargo", escapeHtml(data.position || "-")],
    ["Setor", escapeHtml(data.sector || "-")],
    ["Categoria", escapeHtml(employeeTypeLabel)],
    ["Modalidade do contrato", escapeHtml(isProvider ? "—" : contractTypeLabel)],
    ["Situação do vínculo", escapeHtml(contractStatusLabel)],
    ["Data de admissão", admission ? formatDate(admission) : "-"],
    ["Salário mensal", escapeHtml(salaryText)],
    ["Jornada de trabalho", escapeHtml(jornada)],
  ];
  if (isProvider) {
    idRows.push(["Empresa prestadora", escapeHtml(data.providerName || "-")]);
    if (data.providerCnpj) idRows.push(["CNPJ da prestadora", escapeHtml(data.providerCnpj)]);
  }

  const exp1 = periodRange(data.exp1StartAt, data.exp1EndAt);
  const exp2 = periodRange(data.exp2StartAt, data.exp2EndAt);
  const experienceParts = [exp1, exp2].filter(Boolean);

  const idRowsHtml = idRows
    .map(
      ([label, value]) => `
      <tr>
        <td class="id-label">${label}</td>
        <td class="id-value">${value}</td>
      </tr>`,
    )
    .join("");

  // Contract clauses (cláusulas) — concise CLT boilerplate parameterized by the
  // collaborator data above.
  const clauses: string[] = [
    `<strong>Cláusula 1ª — Das partes.</strong> São partes deste instrumento, de um lado <strong>${escapeHtml(
      COMPANY_INFO.name,
    )}</strong>, doravante denominada EMPREGADORA, e de outro lado <strong>${escapeHtml(
      data.employeeName || "-",
    )}</strong>, inscrito(a) no CPF sob o nº ${escapeHtml(cpfText)}, doravante denominado(a) EMPREGADO(A).`,
    `<strong>Cláusula 2ª — Da função.</strong> O(a) EMPREGADO(A) é admitido(a) para exercer a função de <strong>${escapeHtml(
      data.position || "-",
    )}</strong>, no setor de ${escapeHtml(data.sector || "-")}, sob o regime ${escapeHtml(employeeTypeLabel)}${
      isProvider ? "" : `, na modalidade de contrato por <strong>${escapeHtml(contractTypeLabel)}</strong>`
    }.`,
    `<strong>Cláusula 3ª — Da vigência.</strong> O presente contrato vigora a partir de <strong>${
      admission ? formatDate(admission) : "-"
    }</strong> (data de admissão).${
      experienceParts.length
        ? ` Fica estabelecido período de experiência: ${experienceParts.map((p) => escapeHtml(p)).join("; ")}.`
        : ""
    }`,
    `<strong>Cláusula 4ª — Da remuneração.</strong> Pela prestação dos serviços, o(a) EMPREGADO(A) perceberá a remuneração mensal de <strong>${escapeHtml(
      salaryText,
    )}</strong>, paga na forma e nas datas estabelecidas pela EMPREGADORA, observada a legislação aplicável.`,
    `<strong>Cláusula 5ª — Da jornada.</strong> A jornada de trabalho será de <strong>${escapeHtml(
      jornada,
    )}</strong>, observados os limites e intervalos previstos na Consolidação das Leis do Trabalho (CLT).`,
    `<strong>Cláusula 6ª — Das disposições gerais.</strong> Aplicam-se a este contrato as disposições da CLT, das convenções/acordos coletivos da categoria e demais normas internas da EMPREGADORA, comprometendo-se as partes a cumpri-las integralmente.`,
  ];

  const clausesHtml = clauses.map((c) => `<p class="clause">${c}</p>`).join("");

  return `
<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8" />
  <title>Contrato de Trabalho — ${escapeHtml(data.employeeName || "")}</title>
  <style>
    @page { size: A4; margin: 0; }

    * { margin: 0; padding: 0; box-sizing: border-box; }

    html, body {
      font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
      font-size: 11px;
      line-height: 1.5;
      color: ${BRAND_COLORS.textDark};
      background: #fff;
    }

    .sheet { padding: 14mm 14mm 12mm 14mm; min-height: 297mm; display: flex; flex-direction: column; }
    .content { flex: 1 0 auto; }

    .header { display: flex; align-items: flex-start; padding-bottom: 8px; }
    .logo { height: 18mm; width: auto; }
    .header-line { height: 2px; background: linear-gradient(to right, #888 0%, ${BRAND_COLORS.primaryGreen} 35%); margin: 4px 0 12px 0; }

    .doc-title { font-size: 16px; font-weight: bold; color: ${BRAND_COLORS.primaryGreen}; margin-bottom: 2px; }
    .doc-subtitle { font-size: 12px; color: ${BRAND_COLORS.textDark}; margin-bottom: 12px; }

    .section-title {
      font-size: 11px; font-weight: bold; text-transform: uppercase; letter-spacing: 0.04em;
      color: ${BRAND_COLORS.primaryGreen}; margin: 14px 0 6px;
    }

    table.id-table { width: 100%; border-collapse: collapse; font-size: 11px; }
    table.id-table td { padding: 5px 8px; border-bottom: 1px solid #eee; vertical-align: top; }
    td.id-label { color: ${BRAND_COLORS.textGray}; width: 42%; }
    td.id-value { font-weight: 600; }

    .clause { margin: 8px 0; text-align: justify; font-size: 11px; }
    .clause strong { color: ${BRAND_COLORS.textDark}; }

    .sign { margin-top: 40px; display: flex; justify-content: space-between; gap: 32px; }
    .sign div { flex: 1; border-top: 1px solid ${BRAND_COLORS.textDark}; padding-top: 6px; text-align: center; font-size: 10.5px; }

    .place-date { margin-top: 28px; font-size: 11px; }

    .footer {
      margin-top: 22px; padding-top: 10px; border-top: 2px solid ${BRAND_COLORS.primaryGreen};
      display: flex; justify-content: space-between; align-items: flex-end;
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
      <div class="doc-title">Contrato Individual de Trabalho</div>
      <div class="doc-subtitle">${escapeHtml(COMPANY_INFO.name)}</div>

      <div class="section-title">Identificação das Partes</div>
      <table class="id-table">
        <tbody>${idRowsHtml}</tbody>
      </table>

      <div class="section-title">Cláusulas</div>
      ${clausesHtml}

      <div class="place-date">Ibiporã-PR, ${formatDate(now)}.</div>

      <div class="sign">
        <div>${escapeHtml(COMPANY_INFO.name)}<br/>(Empregadora)</div>
        <div>${escapeHtml(data.employeeName || "-")}<br/>(Empregado(a))</div>
      </div>
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
 * Open a print window for the employment contract and trigger the print dialog.
 */
export function generateEmploymentContractPDF(data: EmploymentContractPdfData): void {
  const html = buildEmploymentContractPdfHtml(data);
  const printWindow = window.open("", "_blank");
  if (!printWindow) {
    alert("Por favor, permita pop-ups para gerar o contrato de trabalho");
    return;
  }
  printWindow.document.write(html);
  printWindow.document.close();
  printWindow.focus();
  printWindow.onload = () => {
    setTimeout(() => {
      printWindow.print();
    }, 250);
  };
}
