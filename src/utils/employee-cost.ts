// Custo de Funcionário — pure client-side math (ACCOUNTING_AREA_CONTRACT §6).
//
// Formulas (implemented EXACTLY as specified):
//   horaNormal        = baseSalary / 220
//   HE50              = 1.5 × horaNormal × h50
//   HE100             = 2   × horaNormal × h100
//   reflexoDSR        = (HE50 + HE100) / diasUteis × (domingos + feriados)   [default 25/5]
//   remuneracao       = baseSalary + HE50 + HE100 + reflexoDSR
//   provisao13        = remuneracao / 12
//   provisaoFerias    = remuneracao / 12 × (4/3)
//   base              = remuneracao + provisao13 + provisaoFerias
//   FGTS              = 8% × base
//   provisaoMultaFGTS = 40% × FGTS                                            [toggle]
//   INSS patronal:  SIMPLES = 0
//                   ANEXO_IV = (20% + rat×fap) × base
//                   LP/REAL  = (20% + rat×fap + terceiros) × base
//   custoMensal = remuneracao + provisao13 + provisaoFerias + FGTS + multaProv
//               + INSSpatronal + benefícios
//
// All rates here are expressed as percentages (rat 1|2|3, terceiros 5.8) and
// fap as a pure multiplier (0.5–2.0).

/** Tax regime for the employer-cost simulation. */
export enum EMPLOYEE_COST_TAX_REGIME {
  /** Simples Nacional, anexos I–III/V — CPP included in the DAS (INSS patronal = 0). */
  SIMPLES = "SIMPLES",
  /** Simples Nacional Anexo IV — pays 20% CPP + RAT×FAP outside the DAS (no terceiros). */
  SIMPLES_ANEXO_IV = "SIMPLES_ANEXO_IV",
  /** Lucro Presumido / Lucro Real — 20% CPP + RAT×FAP + terceiros. */
  LUCRO_PRESUMIDO_REAL = "LUCRO_PRESUMIDO_REAL",
}

export const EMPLOYEE_COST_TAX_REGIME_LABELS: Record<EMPLOYEE_COST_TAX_REGIME, string> = {
  [EMPLOYEE_COST_TAX_REGIME.SIMPLES]: "Simples Nacional (exceto Anexo IV)",
  [EMPLOYEE_COST_TAX_REGIME.SIMPLES_ANEXO_IV]: "Simples Nacional — Anexo IV",
  [EMPLOYEE_COST_TAX_REGIME.LUCRO_PRESUMIDO_REAL]: "Lucro Presumido / Lucro Real",
};

/** Monthly divisor for the normal hourly rate (220h: 44h/week CLT standard). */
export const MONTHLY_HOUR_DIVISOR = 220;

/** Default DSR split: 25 dias úteis / 5 domingos+feriados per month. */
export const DEFAULT_DIAS_UTEIS = 25;
export const DEFAULT_DOMINGOS_FERIADOS = 5;

/** Defaults for the editable rates. */
export const DEFAULT_RAT_PCT = 2;
export const DEFAULT_FAP_FACTOR = 1.0;
export const DEFAULT_TERCEIROS_PCT = 5.8;

/** VT legal employee-discount cap: 6% of the base salary (CLT/Lei 7.418). */
export const VT_DISCOUNT_CAP_PCT = 6;

export interface EmployeeCostInput {
  /** Monthly base salary (R$). */
  baseSalary: number;
  taxRegime: EMPLOYEE_COST_TAX_REGIME;
  /** RAT percentage: 1, 2 or 3 (%). */
  ratPct: number;
  /** FAP multiplier: 0.5–2.0 (default 1.0). */
  fapFactor: number;
  /** Terceiros/Sistema S percentage (default 5.8). Only applied for LP/Real. */
  terceirosPct: number;
  /** Monthly overtime hours at +50%. */
  he50Hours: number;
  /** Monthly overtime hours at +100%. */
  he100Hours: number;
  /** Employer-paid monthly benefits total (R$). */
  benefitsMonthly: number;
  /** Whether to provision the 40% FGTS dismissal fine monthly. */
  includeFgtsFineProvision: boolean;
  /** DSR split — editable, defaults 25/5. */
  diasUteis?: number;
  domingosFeriados?: number;
}

export interface EmployeeCostBreakdown {
  // Remuneration block
  horaNormal: number;
  he50: number;
  he100: number;
  reflexoDSR: number;
  remuneracao: number;
  // Provisions
  provisao13: number;
  provisaoFerias: number;
  /** Incidence base for FGTS/INSS = remuneracao + provisao13 + provisaoFerias. */
  base: number;
  // Charges
  fgts: number;
  provisaoMultaFgts: number;
  /** 20% CPP share of the INSS patronal (0 for SIMPLES). */
  inssPatronal20: number;
  /** RAT×FAP share of the INSS patronal (0 for SIMPLES). */
  inssRatFap: number;
  /** Terceiros share (only for Lucro Presumido/Real). */
  inssTerceiros: number;
  /** Total INSS patronal (sum of the three shares). */
  inssPatronalTotal: number;
  // Benefits + totals
  beneficios: number;
  custoMensal: number;
  custoAnual: number;
  /** custoMensal / baseSalary (0 when salary is 0). */
  multiplicador: number;
}

const safe = (n: number): number => (Number.isFinite(n) ? n : 0);

/** Full §6 employer-cost computation. Pure function. */
export function computeEmployeeCost(input: EmployeeCostInput): EmployeeCostBreakdown {
  const baseSalary = Math.max(0, safe(input.baseSalary));
  const h50 = Math.max(0, safe(input.he50Hours));
  const h100 = Math.max(0, safe(input.he100Hours));
  const beneficios = Math.max(0, safe(input.benefitsMonthly));
  const diasUteis = Math.max(1, safe(input.diasUteis ?? DEFAULT_DIAS_UTEIS));
  const domingosFeriados = Math.max(0, safe(input.domingosFeriados ?? DEFAULT_DOMINGOS_FERIADOS));

  // Remuneration
  const horaNormal = baseSalary / MONTHLY_HOUR_DIVISOR;
  const he50 = 1.5 * horaNormal * h50;
  const he100 = 2 * horaNormal * h100;
  const reflexoDSR = ((he50 + he100) / diasUteis) * domingosFeriados;
  const remuneracao = baseSalary + he50 + he100 + reflexoDSR;

  // Provisions
  const provisao13 = remuneracao / 12;
  const provisaoFerias = (remuneracao / 12) * (4 / 3);
  const base = remuneracao + provisao13 + provisaoFerias;

  // FGTS
  const fgts = 0.08 * base;
  const provisaoMultaFgts = input.includeFgtsFineProvision ? 0.4 * fgts : 0;

  // INSS patronal (decomposed)
  const ratFapRate = (Math.max(0, safe(input.ratPct)) * Math.max(0, safe(input.fapFactor))) / 100;
  const terceirosRate = Math.max(0, safe(input.terceirosPct)) / 100;

  let inssPatronal20 = 0;
  let inssRatFap = 0;
  let inssTerceiros = 0;

  if (input.taxRegime === EMPLOYEE_COST_TAX_REGIME.SIMPLES_ANEXO_IV) {
    inssPatronal20 = 0.2 * base;
    inssRatFap = ratFapRate * base;
  } else if (input.taxRegime === EMPLOYEE_COST_TAX_REGIME.LUCRO_PRESUMIDO_REAL) {
    inssPatronal20 = 0.2 * base;
    inssRatFap = ratFapRate * base;
    inssTerceiros = terceirosRate * base;
  }
  // SIMPLES (non-Anexo IV): INSS patronal = 0 — CPP is inside the DAS.

  const inssPatronalTotal = inssPatronal20 + inssRatFap + inssTerceiros;

  const custoMensal = remuneracao + provisao13 + provisaoFerias + fgts + provisaoMultaFgts + inssPatronalTotal + beneficios;
  const custoAnual = custoMensal * 12;
  const multiplicador = baseSalary > 0 ? custoMensal / baseSalary : 0;

  return {
    horaNormal,
    he50,
    he100,
    reflexoDSR,
    remuneracao,
    provisao13,
    provisaoFerias,
    base,
    fgts,
    provisaoMultaFgts,
    inssPatronal20,
    inssRatFap,
    inssTerceiros,
    inssPatronalTotal,
    beneficios,
    custoMensal,
    custoAnual,
    multiplicador,
  };
}

/**
 * VT employee-discount preview: the employer may discount at most
 * min(6% × salary, actual VT cost) from the employee.
 */
export function computeVtDiscountPreview(baseSalary: number, vtMonthlyCost: number): number {
  const salary = Math.max(0, safe(baseSalary));
  const cost = Math.max(0, safe(vtMonthlyCost));
  return Math.min((VT_DISCOUNT_CAP_PCT / 100) * salary, cost);
}

/** "1,68× o salário" style label for the multiplier badge. */
export function formatMultiplier(multiplicador: number): string {
  return `${multiplicador.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}× o salário`;
}
