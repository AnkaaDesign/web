import { AIRBRUSHING_STATUS_LABELS } from "../constants";
import { AIRBRUSHING_DUE_DATE_RULE, AIRBRUSHING_STATUS } from "../constants";

export function getAirbrushingStatusLabel(status: AIRBRUSHING_STATUS): string {
  return AIRBRUSHING_STATUS_LABELS[status] || status;
}

/**
 * Prazo histórico concedido ao pintor depois que a aerografia é concluída.
 * Espelha AIRBRUSHING_DEFAULT_PAYMENT_TERM_DAYS na API.
 */
export const AIRBRUSHING_DEFAULT_PAYMENT_TERM_DAYS = 7;

export interface AirbrushingDueDateConfig {
  dueDateRule?: AIRBRUSHING_DUE_DATE_RULE | string | null;
  paymentTermDays?: number | null;
  dueDayOfMonth?: number | null;
  dueDate?: Date | string | null;
}

function spCalendarDate(value: Date | string | null | undefined): [number, number, number] | null {
  if (!value) return null;
  const date = new Date(value);
  if (isNaN(date.getTime())) return null;
  const [y, m, d] = date.toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" }).split("-").map(Number);
  return [y, m, d];
}

/** 18:00 em São Paulo = 21:00 UTC. */
function spDueInstant(year: number, month1: number, day: number): Date {
  return new Date(Date.UTC(year, month1 - 1, day, 21, 0, 0));
}

function lastDayOfMonth(year: number, month1: number): number {
  return new Date(Date.UTC(year, month1, 0)).getUTCDate();
}

/**
 * Prévia, no cliente, do vencimento que o servidor vai materializar.
 *
 * É uma CÓPIA deliberada de `resolveAirbrushingDueDate` em api/src/utils/airbrushing.ts
 * — os pacotes não compartilham código, e a regra precisa aparecer no formulário no
 * momento em que o usuário a escolhe, não só depois de salvar. A autoridade continua
 * sendo o servidor: o que a tela lê depois de salvar é sempre `airbrushing.dueDate`.
 * Ao mudar uma, mude a outra.
 */
export function resolveAirbrushingDueDate(config: AirbrushingDueDateConfig, finish: Date | string | null | undefined): Date | null {
  const rule = config.dueDateRule ?? AIRBRUSHING_DUE_DATE_RULE.DAYS_AFTER_FINISH;

  if (rule === AIRBRUSHING_DUE_DATE_RULE.FIXED_DATE) {
    if (!config.dueDate) return null;
    const fixed = new Date(config.dueDate);
    return isNaN(fixed.getTime()) ? null : fixed;
  }

  const reference = spCalendarDate(finish);
  if (!reference) return null;
  const [year, month, day] = reference;

  if (rule === AIRBRUSHING_DUE_DATE_RULE.DAY_OF_MONTH) {
    const wanted = config.dueDayOfMonth;
    if (!wanted || wanted < 1) return null;

    let dueYear = year;
    let dueMonth = month;
    let dueDay = Math.min(wanted, lastDayOfMonth(dueYear, dueMonth));

    if (dueDay < day) {
      dueMonth += 1;
      if (dueMonth > 12) {
        dueMonth = 1;
        dueYear += 1;
      }
      dueDay = Math.min(wanted, lastDayOfMonth(dueYear, dueMonth));
    }

    return spDueInstant(dueYear, dueMonth, dueDay);
  }

  const term = config.paymentTermDays ?? AIRBRUSHING_DEFAULT_PAYMENT_TERM_DAYS;
  return spDueInstant(year, month, day + term);
}
