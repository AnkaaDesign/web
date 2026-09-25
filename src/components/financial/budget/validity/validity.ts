/**
 * A VALIDADE DA PROPOSTA — as contas, sem tela.
 *
 * Espelho de `api/src/utils/budget-validity.ts`. O servidor grava o fim do dia
 * em São Paulo; aqui as datas são no fuso do navegador, que é o mesmo para quem
 * usa o sistema, e servem para mostrar e para calcular o que se manda.
 *
 * Tudo conta a partir de HOJE, e não soma sobre a data antiga, exceto quando a
 * tela diz "estender a validade atual": num orçamento vencido há três meses,
 * "mais 30 dias" continuaria no passado.
 */

export const QUOTE_VALIDITY_OPTIONS = [15, 30, 60, 90] as const;

/** Os acréscimos oferecidos sobre uma validade que ainda vale. */
export const QUOTE_VALIDITY_EXTENSIONS = [15, 30] as const;

const DAY_MS = 24 * 60 * 60 * 1000;

/** O último instante do dia (é assim que `expiresAt` é gravado). */
export function endOfDay(date: Date): Date {
  const d = new Date(date);
  d.setHours(23, 59, 59, 999);
  return d;
}

/** O fim do dia daqui a `days` dias. */
export function quoteValidityEnd(days: number, now: Date = new Date()): Date {
  const d = new Date(now);
  d.setDate(d.getDate() + days);
  return endOfDay(d);
}

/** A validade atual somada de `days` dias. */
export function extendValidity(current: Date, days: number): Date {
  return endOfDay(new Date(current.getTime() + days * DAY_MS));
}

/** A validade já passou? */
export function isQuoteValidityExpired(expiresAt: Date | string | null | undefined): boolean {
  if (!expiresAt) return false;
  return new Date(expiresAt).getTime() < Date.now();
}

/** Dias de calendário entre hoje e a data (negativo = já passou). */
export function daysFromToday(date: Date | string): number {
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  const alvo = new Date(date);
  alvo.setHours(0, 0, 0, 0);
  return Math.round((alvo.getTime() - hoje.getTime()) / DAY_MS);
}

/** "Faltam 12 dias", "Vence hoje", "Vencida há 91 dias". */
export function describeValidity(expiresAt: Date | string): string {
  const n = daysFromToday(expiresAt);
  const dias = (k: number) => `${k} ${k === 1 ? "dia" : "dias"}`;
  if (n < 0 || isQuoteValidityExpired(expiresAt)) return `Vencida há ${dias(Math.max(1, Math.abs(n)))}`;
  if (n === 0) return "Vence hoje";
  return `Faltam ${dias(n)}`;
}
