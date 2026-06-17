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
