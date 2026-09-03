import { TASK_STATUS } from "@/constants";
import type { Task } from "@/types";
import type { TaskQuote } from "@/types/task-quote";

/**
 * The shape the attention engine evaluates TASK_QUOTE rules against.
 *
 * The financial lists are lists of TASKS, but the signal belongs to the QUOTE: TASK_QUOTE is the
 * entity whose nav home is Orçamento/Faturamento and whose id the detail page acks. Registering
 * tasks instead would light Agenda/Cronograma and let the production task detail silently ack a
 * financial alert nobody in production ever saw.
 *
 * The parent task's `status` is carried ON the quote rather than fetched through an inverted
 * quote → task include, so the predicate path is `task.status` — byte-identical to the
 * `where: { task: { status } }` the API mirror uses. One rule, one path, two evaluators.
 */
export type AttentionQuoteEntity = TaskQuote & { task: { id: string; status: string } };

/**
 * Quotes of the loaded tasks, ready to register. Tasks without a quote are skipped.
 *
 * UM ORÇAMENTO, UMA ENTRADA — mesmo quando ele aparece em sessenta linhas.
 *
 * Desde o orçamento multitarefa, N tarefas dividem o MESMO `quote.id`. Como a
 * entidade registrada é o orçamento, empurrar uma entrada por linha registraria
 * o mesmo id N vezes e a última venceria: o alerta do orçamento passaria a
 * depender de qual veículo o `map` visitou por último — o mesmo orçamento
 * piscaria ou não conforme a ordenação da tabela.
 *
 * O desempate espelha o `tasks: { some: { status: COMPLETED } }` que a regra usa
 * na API: entre as tarefas do orçamento, vence uma que já esteja COMPLETED, se
 * houver. A regra pergunta "algum veículo já ficou pronto?" — porque num
 * orçamento de sessenta caminhões o dinheiro já está parado quando o primeiro
 * sai —, e o avaliador do cliente lê `task.status`, um campo só. Escolher aqui a
 * tarefa que satisfaz a regra é o que faz os dois avaliadores concordarem.
 */
export function toAttentionQuoteEntities(tasks: ReadonlyArray<Task>): AttentionQuoteEntity[] {
  const byQuoteId = new Map<string, AttentionQuoteEntity>();
  for (const task of tasks) {
    const quote = task.quote;
    // `setEntities` drops anything without an id, so a quote fetched without `id: true` in the
    // select would register nothing at all — silently, which is why the include comment says so.
    if (!quote?.id) continue;
    const existing = byQuoteId.get(quote.id);
    // Primeira linha do orçamento, ou a que troca um veículo não-concluído por
    // um concluído. Nunca o contrário: uma vez que o `some` está satisfeito,
    // nenhuma linha seguinte pode desfazê-lo.
    if (existing && existing.task.status === TASK_STATUS.COMPLETED) continue;
    if (existing && task.status !== TASK_STATUS.COMPLETED) continue;
    byQuoteId.set(quote.id, {
      ...(quote as TaskQuote),
      task: { id: task.id, status: task.status },
    });
  }
  return [...byQuoteId.values()];
}

/** Same shape for a single task on a detail page. */
export function toAttentionQuoteEntity(task: Task | null | undefined): AttentionQuoteEntity | null {
  if (!task?.quote?.id) return null;
  return { ...(task.quote as TaskQuote), task: { id: task.id, status: task.status } };
}

/**
 * Same shape when the quote was loaded separately from the task — the Orçamento detail page
 * fetches them with two queries (`useTaskDetail` + `useTaskQuoteByTask`) rather than one include.
 */
export function toAttentionQuoteEntityFromParts(
  quote: { id?: string } | null | undefined,
  task: { id: string; status: string } | null | undefined,
): AttentionQuoteEntity | null {
  if (!quote?.id || !task?.id) return null;
  return { ...(quote as TaskQuote), task: { id: task.id, status: task.status } };
}
