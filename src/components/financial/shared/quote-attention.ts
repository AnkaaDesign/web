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

/** Quotes of the loaded tasks, ready to register. Tasks without a quote are skipped. */
export function toAttentionQuoteEntities(tasks: ReadonlyArray<Task>): AttentionQuoteEntity[] {
  const out: AttentionQuoteEntity[] = [];
  for (const task of tasks) {
    const quote = task.quote;
    // `setEntities` drops anything without an id, so a quote fetched without `id: true` in the
    // select would register nothing at all — silently, which is why the include comment says so.
    if (!quote?.id) continue;
    out.push({ ...(quote as TaskQuote), task: { id: task.id, status: task.status } });
  }
  return out;
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
