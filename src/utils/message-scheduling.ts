/**
 * Janela de exibição de uma mensagem/comunicado.
 *
 * O composer escolhe DATAS num `DateRangePicker`, e o valor que ele devolve é a
 * meia-noite LOCAL do dia. Mandar isso cru para a API gravava "Término 29/08"
 * como o PRIMEIRO instante do dia 29 — a mensagem morria na virada PARA o dia 29,
 * um dia antes do que o autor pediu. O início tem o problema espelhado: quando o
 * picker carrega a hora do clique, o comunicado só começava a aparecer no meio da
 * tarde.
 *
 * Aqui o início vira o primeiro instante do dia e o término o último. A API
 * normaliza de novo (em São Paulo, para valer para qualquer cliente) e a operação
 * é idempotente, então os dois lados concordam.
 */

/** Primeiro instante do dia (00:00:00.000 local) em ISO, ou `null` para limpar. */
export function startsAtISO(date?: Date | null): string | null {
  if (!date) return null;
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d.toISOString();
}

/** Último instante do dia (23:59:59.999 local) em ISO, ou `null` para limpar. */
export function endsAtISO(date?: Date | null): string | null {
  if (!date) return null;
  const d = new Date(date);
  d.setHours(23, 59, 59, 999);
  return d.toISOString();
}
