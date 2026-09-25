import { AIRBRUSHING_STATUS_LABELS } from "../constants";
import { AIRBRUSHING_DUE_DATE_RULE, AIRBRUSHING_STATUS, EXECUTION_TIME_UNIT } from "../constants";
import { formatDate, formatDateTime } from "./date";
import { formatCurrency } from "./number";

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

// =============================================================================
// Tempo de execução — espelha api/src/utils/airbrushing-quote.ts
// =============================================================================

// `string` aceito: formulários guardam a unidade como texto; tudo que não é HOURS conta como dias.
type ExecutionUnit = EXECUTION_TIME_UNIT | `${EXECUTION_TIME_UNIT}` | string;

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;

/**
 * Término previsto a partir do início previsto e do tempo de execução — a MESMA
 * regra da API. DIAS contam o dia do início ("começa dia 29, 2 dias → termina dia
 * 30"); HORAS somam ao horário do início. Sem início ou sem tempo, não há término.
 */
export function computeExpectedFinishDate(
  startDate: Date | string | null | undefined,
  executionTime: number | null | undefined,
  unit: ExecutionUnit | null | undefined,
): Date | null {
  if (!startDate || !executionTime || executionTime <= 0 || !unit) return null;
  const start = new Date(startDate);
  if (Number.isNaN(start.getTime())) return null;
  if (unit === EXECUTION_TIME_UNIT.HOURS) return new Date(start.getTime() + executionTime * HOUR_MS);
  return new Date(start.getTime() + (executionTime - 1) * DAY_MS);
}

/** "1 dia", "3 dias", "1 hora", "8 horas" — vazio quando não há tempo. */
export function formatExecutionTime(executionTime: number | null | undefined, unit: ExecutionUnit | null | undefined): string {
  if (!executionTime || !unit) return "";
  const hours = unit === EXECUTION_TIME_UNIT.HOURS;
  const word = hours ? (executionTime === 1 ? "hora" : "horas") : executionTime === 1 ? "dia" : "dias";
  return `${executionTime} ${word}`;
}

/**
 * Término previsto formatado: só a data em DIAS, data e hora em HORAS (é quando o
 * horário muda). Vazio quando não há o que calcular.
 */
export function formatExpectedFinishDate(
  startDate: Date | string | null | undefined,
  executionTime: number | null | undefined,
  unit: ExecutionUnit | null | undefined,
): string {
  const finish = computeExpectedFinishDate(startDate, executionTime, unit);
  if (!finish) return "";
  return unit === EXECUTION_TIME_UNIT.HOURS ? formatDateTime(finish) : formatDate(finish);
}

/**
 * Condições de uma negociação: "R$ 820,00 · 2 dias" (`separator` padrão) ou
 * "R$ 820,00 em 2 dias" (`" em "`). Negociação antiga sem tempo mostra só o valor.
 */
export function formatQuoteTerms(
  amount: number | null | undefined,
  executionTime: number | null | undefined,
  unit: ExecutionUnit | null | undefined,
  separator = " · ",
): string {
  const money = amount === null || amount === undefined || !Number.isFinite(amount) ? "" : formatCurrency(amount);
  const time = formatExecutionTime(executionTime, unit);
  if (money && time) return `${money}${separator}${time}`;
  return money || time;
}
