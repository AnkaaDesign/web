/**
 * Centralized company information used across the application.
 * This is static branding/contact data for Ankaa Design.
 *
 * Used by:
 * - Budget public page (src/pages/public/budget/[id].tsx)
 * - Budget PDF generator (src/utils/budget-pdf-generator.ts)
 */
export const COMPANY_INFO = {
  name: "Ankaa Design",
  address: "Rua: Luis Carlos Zani, 2493 - Santa Paula, Ibipora-PR",
  phone: "43 9 8428-3228",
  phoneClean: "5543984283228",
  website: "ankaadesign.com.br",
  websiteUrl: "https://ankaadesign.com.br",
  directorName: "Sergio Rodrigues",
  directorTitle: "Diretor Comercial",
} as const;

/**
 * Brand colors used in budgets and PDFs.
 * Deep forest green matching the reference PDF template.
 */
export const BRAND_COLORS = {
  primaryGreen: "#0a5c1e",
  textDark: "#1a1a1a",
  textGray: "#666666",
} as const;

/**
 * Company fiscal setup — the actual tax/payroll parameters for Ankaa Design.
 *
 * Used to pre-fill the "Custo de Funcionário" simulator so the owner doesn't
 * re-enter what the company already knows. All values remain editable in the
 * tool (the simulator may model hypotheticals).
 *
 * Used by:
 * - Employee cost calculator (src/pages/tools/employee-cost-calculator.tsx)
 */
export const COMPANY_FISCAL = {
  /** Regime tributário da empresa: Lucro Presumido (compartilha o cálculo com Lucro Real). */
  taxRegime: "LUCRO_PRESUMIDO_REAL",
  /**
   * CNAE da atividade preponderante. Funilaria e pintura de veículos automotores
   * → 4520-0/02 ("Serviços de lanternagem ou funilaria e pintura de veículos
   * automotores"). CONFIRMAR contra o cartão CNPJ — define o RAT abaixo.
   */
  cnae: "4520-0/02",
  /**
   * RAT — Riscos Ambientais do Trabalho (%): 1 (leve) / 2 (médio) / 3 (grave),
   * conforme o grau de risco da atividade preponderante (CNAE). Funilaria/pintura
   * de veículos (CNAE 4520-0/02) é classificada como RISCO GRAVE → 3% (Anexo V do
   * Decreto 6.957/2009). CONFIRMAR no cartão CNPJ / com a contabilidade, pois
   * altera o custo de folha. Mantido editável por ser risco-dependente.
   */
  ratPct: 3,
  /**
   * FAP — Fator Acidentário de Prevenção: multiplicador 0,5–2,0 sobre o RAT,
   * calculado anualmente pela Previdência conforme o histórico de acidentes da
   * empresa. 1,0 = neutro (sem bônus nem malus).
   */
  fapFactor: 1.0,
  /** Terceiros / Sistema S + salário-educação (%). Padrão 5,8% para o Lucro Presumido/Real. */
  terceirosPct: 5.8,
} as const;
