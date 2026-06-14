// Art. 130 CLT — vacation day scale by unjustified absences in the período aquisitivo.
// 0–5 faltas → 30 dias; 6–14 → 24; 15–23 → 18; 24–32 → 12; >32 → 0.
export function entitledDaysFromAbsences(unjustifiedAbsences: number): number {
  const a = Math.max(0, Math.floor(unjustifiedAbsences || 0));
  if (a <= 5) return 30;
  if (a <= 14) return 24;
  if (a <= 23) return 18;
  if (a <= 32) return 12;
  return 0;
}

/** Períodos aquisitivo (12m) e concessivo (12m após o aquisitivo) a partir da admissão. */
export function deriveVacationPeriods(admissionDate: Date): { acquisitiveStart: Date; acquisitiveEnd: Date; concessiveEnd: Date } {
  const acquisitiveStart = new Date(admissionDate);
  const acquisitiveEnd = new Date(acquisitiveStart);
  acquisitiveEnd.setFullYear(acquisitiveEnd.getFullYear() + 1);
  acquisitiveEnd.setDate(acquisitiveEnd.getDate() - 1);
  // Período concessivo: 12 meses subsequentes ao término do aquisitivo (art. 134).
  const concessiveEnd = new Date(acquisitiveEnd);
  concessiveEnd.setFullYear(concessiveEnd.getFullYear() + 1);
  return { acquisitiveStart, acquisitiveEnd, concessiveEnd };
}

export interface FracionamentoPeriod {
  startDate: Date | null;
  days: number | string;
}

export interface FracionamentoValidation {
  ok: boolean;
  errors: string[];
}

/**
 * Reforma 2017 (CLT art. 134 §1º): até 3 períodos; um deles ≥ 14 dias corridos;
 * os demais ≥ 5 dias corridos cada. Soma deve respeitar os dias gozados de direito.
 */
export function validateFracionamento(periods: FracionamentoPeriod[], vacationDaysToSplit: number): FracionamentoValidation {
  const errors: string[] = [];
  const filled = periods.filter((p) => p.startDate || (p.days !== "" && p.days != null));

  if (filled.length === 0) {
    return { ok: true, errors: [] };
  }

  if (filled.length > 3) {
    errors.push("O fracionamento é limitado a 3 períodos (CLT art. 134 §1º).");
  }

  const dayValues = filled.map((p) => Number(p.days) || 0);

  if (dayValues.some((d) => d <= 0)) {
    errors.push("Cada período deve ter ao menos 1 dia.");
  }

  if (filled.length > 1) {
    const hasFourteen = dayValues.some((d) => d >= 14);
    if (!hasFourteen) {
      errors.push("Ao fracionar, um dos períodos deve ter no mínimo 14 dias corridos.");
    }
    const othersOk = dayValues.filter((d) => d < 14).every((d) => d >= 5);
    if (!othersOk) {
      errors.push("Os demais períodos devem ter no mínimo 5 dias corridos cada.");
    }
  }

  if (filled.some((p) => !p.startDate)) {
    errors.push("Informe a data de início de cada período.");
  }

  const total = dayValues.reduce((sum, d) => sum + d, 0);
  if (vacationDaysToSplit > 0 && total !== vacationDaysToSplit) {
    errors.push(`A soma dos períodos (${total} dias) deve igualar os dias de gozo (${vacationDaysToSplit} dias).`);
  }

  return { ok: errors.length === 0, errors };
}
