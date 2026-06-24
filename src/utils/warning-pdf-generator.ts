/**
 * Advertência (Warning) PDF generator.
 *
 * Produces a formal HR warning letter using the branded HTML + window.print()
 * pattern consistent with employment-contract-pdf-generator.ts.
 */
import { formatDate } from "./date";
import { COMPANY_INFO, BRAND_COLORS } from "@/config/company";
import { WARNING_SEVERITY_LABELS, WARNING_CATEGORY_LABELS } from "../constants";
import type { WARNING_SEVERITY, WARNING_CATEGORY } from "../constants";

export interface WarningPdfData {
  collaboratorName: string;
  collaboratorPosition?: string | null;
  collaboratorSector?: string | null;
  supervisorName: string;
  supervisorPosition?: string | null;
  severity: string;
  category: string;
  reason: string;
  description?: string | null;
  suspensionDays?: number | null;
  followUpDate: Date | string;
  issueDate?: Date | string | null;
  witnesses?: Array<{ name: string; position?: string | null }>;
  hrNotes?: string | null;
}

function escapeHtml(value: string): string {
  return (value ?? "")
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

function severityLabel(severity: string): string {
  return WARNING_SEVERITY_LABELS[severity as WARNING_SEVERITY] ?? severity;
}

function categoryLabel(category: string): string {
  return WARNING_CATEGORY_LABELS[category as WARNING_CATEGORY] ?? category;
}

/** Chunk an array into groups of n */
function chunk<T>(arr: T[], n: number): T[][] {
  const result: T[][] = [];
  for (let i = 0; i < arr.length; i += n) result.push(arr.slice(i, i + n));
  return result;
}

export function buildWarningPdfHtml(data: WarningPdfData): string {
  const now = new Date();
  const followUp = toDate(data.followUpDate);
  const issued = toDate(data.issueDate) ?? now;
  const isSuspension = data.severity === "SUSPENSION";
  const witnesses = data.witnesses ?? [];

  const suspensionRow = isSuspension
    ? `<tr>
        <td class="id-label">Dias de Suspensão</td>
        <td class="id-value">${data.suspensionDays ?? 1} dia(s) — CLT art. 474</td>
      </tr>`
    : "";

  const descriptionSection = data.description
    ? `<div class="section-title">Descrição Detalhada</div>
       <p class="desc-text">${escapeHtml(data.description)}</p>`
    : "";

  // Witnesses grouped 2 per sign-row
  const witnessSignatureRows = chunk(witnesses, 2)
    .map((pair) => {
      const blocks = pair
        .map(
          (w) =>
            `<div class="sign-block">
              <div class="sign-line"></div>
              <div class="sign-label">${escapeHtml(w.name)}</div>
              <div class="sign-role">Testemunha${w.position ? ` — ${escapeHtml(w.position)}` : ""}</div>
            </div>`,
        )
        .join("");
      // Pad to 2 blocks so columns stay even
      const padded = pair.length < 2 ? blocks + `<div class="sign-block"></div>` : blocks;
      return `<div class="sign-row">${padded}</div>`;
    })
    .join("");

  const severityClass =
    data.severity === "SUSPENSION"
      ? " suspension"
      : data.severity === "FINAL_WARNING"
        ? " final"
        : data.severity === "VERBAL"
          ? " verbal"
          : "";

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8" />
  <title>Advertência — ${escapeHtml(data.collaboratorName)}</title>
  <style>
    @page { size: A4; margin: 0; }
    * { margin: 0; padding: 0; box-sizing: border-box; }
    html, body {
      font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
      font-size: 11px;
      line-height: 1.55;
      color: ${BRAND_COLORS.textDark};
      background: #fff;
    }
    .sheet { padding: 12mm 16mm 10mm 16mm; min-height: 297mm; display: flex; flex-direction: column; }
    .content { flex: 0 0 auto; }
    .spacer { flex: 1 1 auto; min-height: 18px; }

    /* Header */
    .header { display: flex; align-items: flex-start; padding-bottom: 6px; }
    .logo { height: 16mm; width: auto; }
    .header-line { height: 2px; background: linear-gradient(to right, #888 0%, ${BRAND_COLORS.primaryGreen} 35%); margin: 4px 0 14px 0; }

    /* Title */
    .doc-title { font-size: 18px; font-weight: bold; color: ${BRAND_COLORS.primaryGreen}; margin-bottom: 10px; }

    .severity-badge {
      display: inline-block;
      padding: 2px 10px;
      border-radius: 4px;
      font-size: 10px;
      font-weight: bold;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      background: ${BRAND_COLORS.primaryGreen};
      color: #fff;
      vertical-align: middle;
      margin-left: 6px;
    }
    .severity-badge.suspension { background: #b91c1c; }
    .severity-badge.final { background: #7c3aed; }
    .severity-badge.verbal { background: #d97706; }

    /* Section title */
    .section-title {
      font-size: 10.5px; font-weight: bold; text-transform: uppercase; letter-spacing: 0.05em;
      color: ${BRAND_COLORS.primaryGreen}; margin: 14px 0 6px;
      border-bottom: 1px solid #e5e7eb; padding-bottom: 3px;
    }

    /* Info table */
    table.id-table { width: 100%; border-collapse: collapse; font-size: 11px; margin-bottom: 4px; }
    table.id-table td { padding: 5px 8px; border-bottom: 1px solid #f3f4f6; vertical-align: top; }
    td.id-label { color: ${BRAND_COLORS.textGray}; width: 38%; }
    td.id-value { font-weight: 600; }
    .id-sub { font-size: 9.5px; color: ${BRAND_COLORS.textGray}; font-weight: 400; }

    /* Body text */
    .body-text {
      font-size: 11px;
      line-height: 1.65;
      color: ${BRAND_COLORS.textDark};
      text-align: justify;
      margin: 6px 0 10px;
      padding: 10px 12px;
      background: #f9fafb;
      border-left: 3px solid ${BRAND_COLORS.primaryGreen};
      border-radius: 0 4px 4px 0;
    }

    /* Plain justified paragraph (lighter than the highlighted body-text box) */
    .desc-text {
      font-size: 11px;
      line-height: 1.65;
      color: ${BRAND_COLORS.textDark};
      text-align: justify;
      margin: 4px 2px 10px;
    }

    /* Acknowledgement note — lightweight, no heavy box */
    .ack-note {
      margin-top: 12px;
      font-size: 10px;
      line-height: 1.6;
      color: ${BRAND_COLORS.textGray};
      text-align: justify;
    }
    /* Suspension legal notice keeps a subtle box (it is a formal CLT warning) */
    .ack-box {
      margin-top: 12px;
      padding: 9px 12px;
      border: 1px solid #e5e7eb;
      border-left: 3px solid #b91c1c;
      border-radius: 0 4px 4px 0;
      font-size: 10px;
      color: ${BRAND_COLORS.textDark};
      background: #fef7f7;
    }
    .ack-box strong { color: #b91c1c; }

    /* Place & date */
    .place-date { margin-top: 18px; font-size: 11px; }

    /* Closing block (place-date + signatures) sits near the bottom of the sheet */
    .closing { flex: 0 0 auto; }

    /* Signatures */
    .signatures { margin-top: 14px; }
    .sign-row {
      display: flex;
      gap: 28px;
      margin-bottom: 26px;
    }
    .sign-block { flex: 1; }
    .sign-line {
      border-top: 1px solid ${BRAND_COLORS.textDark};
      margin-bottom: 4px;
      margin-top: 32px;
    }
    .sign-label { font-weight: 600; font-size: 11px; }
    .sign-role { font-size: 10px; color: ${BRAND_COLORS.textGray}; margin-top: 1px; }

    /* RH signature — centered, constrained width */
    .sign-rh {
      display: flex;
      justify-content: center;
      margin-top: 4px;
    }
    .sign-rh .sign-block {
      flex: none;
      width: 52%;
      text-align: center;
    }
    .sign-rh .sign-label { font-weight: 700; }

    /* All sign-block text centered under line */
    .sign-block { text-align: center; }

    /* Footer */
    .footer {
      margin-top: 22px; padding-top: 10px;
      border-top: 2px solid ${BRAND_COLORS.primaryGreen};
      display: flex; justify-content: space-between; align-items: flex-end;
    }
    .footer-contact { font-size: 9px; line-height: 1.7; }
    .footer-name { font-weight: bold; color: ${BRAND_COLORS.primaryGreen}; font-size: 11px; }
    .footer-address, .footer-phone { color: ${BRAND_COLORS.textGray}; }
    .footer-site { color: ${BRAND_COLORS.primaryGreen}; }
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
      <div class="doc-title">
        Advertência
        <span class="severity-badge${severityClass}">${escapeHtml(severityLabel(data.severity))}</span>
      </div>

      <div class="section-title">Identificação</div>
      <table class="id-table">
        <tbody>
          <tr>
            <td class="id-label">Colaborador</td>
            <td class="id-value">${escapeHtml(data.collaboratorName)}</td>
          </tr>
          ${data.collaboratorPosition ? `<tr>
            <td class="id-label">Cargo do Colaborador</td>
            <td class="id-value">${escapeHtml(data.collaboratorPosition)}</td>
          </tr>` : ""}
          ${data.collaboratorSector ? `<tr>
            <td class="id-label">Setor</td>
            <td class="id-value">${escapeHtml(data.collaboratorSector)}</td>
          </tr>` : ""}
          <tr>
            <td class="id-label">Supervisor / Responsável</td>
            <td class="id-value">${escapeHtml(data.supervisorName)}</td>
          </tr>
          <tr>
            <td class="id-label">Categoria da Ocorrência</td>
            <td class="id-value">${escapeHtml(categoryLabel(data.category))}</td>
          </tr>
          ${suspensionRow}
          <tr>
            <td class="id-label">Data de Emissão</td>
            <td class="id-value">${formatDate(issued)}</td>
          </tr>
          ${followUp ? `<tr>
            <td class="id-label">Data de Acompanhamento</td>
            <td class="id-value">${formatDate(followUp)}</td>
          </tr>` : ""}
        </tbody>
      </table>

      <div class="section-title">Motivo da Advertência</div>
      <p class="body-text">${escapeHtml(data.reason)}</p>

      ${descriptionSection}

      ${isSuspension
        ? `<div class="ack-box">
            <strong>Aviso de Suspensão:</strong> Em conformidade com o art. 474 da CLT, a suspensão
            disciplinar não poderá exceder 30 (trinta) dias corridos. A aplicação de suspensão por prazo
            superior implicará rescisão injustificada do contrato de trabalho.
            O colaborador ficará suspenso por <strong>${data.suspensionDays ?? 1} dia(s)</strong>,
            iniciando na data de emissão deste documento.
          </div>`
        : ""}

      <p class="ack-note">
        O colaborador declara ter sido cientificado do conteúdo desta advertência. A recusa em
        assinar não invalida o documento, devendo as testemunhas registrarem a ocorrência no campo
        destinado à sua assinatura.
      </p>
    </div>

    <div class="spacer"></div>

    <div class="closing">
      <div class="place-date">Ibiporã-PR, ${formatDate(issued)}.</div>

      <div class="signatures">
        <!-- Row 1: Collaborator + Supervisor -->
        <div class="sign-row">
          <div class="sign-block">
            <div class="sign-line"></div>
            <div class="sign-label">${escapeHtml(data.collaboratorName)}</div>
            <div class="sign-role">Colaborador</div>
            <div class="sign-role" style="font-style:italic;">Ciente / Recusa em assinar</div>
          </div>
          <div class="sign-block">
            <div class="sign-line"></div>
            <div class="sign-label">${escapeHtml(data.supervisorName)}</div>
            <div class="sign-role">Supervisor / Responsável</div>
          </div>
        </div>

        <!-- Witness rows (2 per row) -->
        ${witnessSignatureRows}

        <!-- RH centered -->
        <div class="sign-rh">
          <div class="sign-block">
            <div class="sign-line"></div>
            <div class="sign-label">Recursos Humanos</div>
          </div>
        </div>
      </div>
    </div>

    <div class="footer">
      <div class="footer-contact">
        <div class="footer-name">${escapeHtml(COMPANY_INFO.name)}</div>
        <div class="footer-address">${escapeHtml(COMPANY_INFO.address)}</div>
        <div class="footer-phone">${escapeHtml(COMPANY_INFO.phone)}</div>
        <div class="footer-site">${escapeHtml(COMPANY_INFO.websiteUrl || COMPANY_INFO.website)}</div>
      </div>
      <div class="footer-generated">Gerado em ${formatDate(now)} ${now.toLocaleTimeString("pt-BR")}</div>
    </div>
  </div>
</body>
</html>`;
}

/**
 * Opens the warning document in a new tab for VIEWING (no print dialog).
 * The browser's own viewer lets the user print or save-as-PDF if they want.
 * Used as the on-demand preview for warnings that don't yet have a server-sealed term.
 *
 * Uses a Blob URL + anchor click rather than `window.open("")` + document.write:
 * the latter is silently suppressed by popup blockers (returns null with no prompt),
 * whereas a real-URL navigation triggered inside the user gesture is allowed.
 */
export function openWarningDocument(data: WarningPdfData): void {
  const html = buildWarningPdfHtml(data);
  const blob = new Blob([html], { type: "text/html;charset=utf-8" });
  const url = URL.createObjectURL(blob);

  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.target = "_blank";
  anchor.rel = "noopener noreferrer";
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();

  // Revoke after the new tab has had time to load the document.
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}
