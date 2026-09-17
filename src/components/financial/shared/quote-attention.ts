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
// `Omit<…, "task">`: `TaskQuote.task` é a TAREFA inteira (e está `@deprecated`
// desde o multitarefa). O que a regra de atenção avalia é um par mínimo — id e
// status —, e uma interseção com o tipo completo exigiria montar uma Task de
// verdade aqui só para satisfazer o compilador, ou voltar a `any`, que foi como
// o defeito do "mesmo `quote.id` registrado N vezes" passou sem ser visto.
export type AttentionQuoteEntity = Omit<TaskQuote, "task"> & {
  task: { id: string; status: string };
  /**
   * ALGUM VEÍCULO deste orçamento está sem número de pedido de compra.
   *
   * Derivado, e não um caminho de predicado dentro de `tasks`: o pedido mora em
   * `Task.customerOrderNumber` — por VEÍCULO — e o espelho no servidor pergunta
   * `tasks: { some: { customerOrderNumber: null } }`. Do lado do cliente as
   * tarefas do orçamento chegam como LINHAS da lista, não como relação do
   * orçamento, então a conjunção é feita aqui, uma vez, onde as linhas ainda
   * estão todas à mão.
   *
   * ⚠️ Numa lista paginada as linhas podem ser um SUBCONJUNTO dos sessenta
   * veículos. Um branco visível acende; um branco fora da página não — e é a
   * contagem do servidor (que vê todos) que sustenta o número no menu. Antes
   * disto a regra lia `customerConfigs[].orderNumber`, uma coluna que já não
   * existe, e portanto NUNCA acendia.
   */
  anyVehicleMissingOrderNumber: boolean;
};

/** `Task.customerOrderNumber` em branco — nulo e string vazia são a mesma coisa. */
function missingOrderNumber(task: { customerOrderNumber?: string | null }): boolean {
  return !(task.customerOrderNumber ?? "").trim();
}

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
    // O pedido de compra é do VEÍCULO: a falta é de QUALQUER linha do orçamento,
    // não só da que ganhou o desempate acima. Acumula antes do `continue`, senão
    // um orçamento cujo veículo concluído TEM pedido esconderia os cinquenta e
    // nove em branco.
    const missing = (existing?.anyVehicleMissingOrderNumber ?? false) || missingOrderNumber(task);
    if (existing) existing.anyVehicleMissingOrderNumber = missing;
    if (existing && existing.task.status === TASK_STATUS.COMPLETED) continue;
    if (existing && task.status !== TASK_STATUS.COMPLETED) continue;
    byQuoteId.set(quote.id, {
      ...(quote as TaskQuote),
      task: { id: task.id, status: task.status },
      anyVehicleMissingOrderNumber: missing,
    });
  }
  return [...byQuoteId.values()];
}

/**
 * Os orçamentos de uma lista cuja LINHA JÁ É O ORÇAMENTO.
 *
 * ✖ SEM o `Map` de dedupe. Ele existia porque a lista era de TAREFAS e N linhas
 * dividiam o mesmo `quote.id`: registrar uma entrada por linha registrava o mesmo
 * id N vezes e a última vencia, então o alerta passava a depender de qual veículo
 * o `map` visitou por último. Com uma linha por orçamento a unicidade é por
 * construção, e deduplicar seria resolver um problema que não existe mais.
 *
 * ✅ `anyVehicleMissingOrderNumber` FICA CORRETO. Pelo caminho antigo as linhas
 * carregadas podiam ser um SUBCONJUNTO dos sessenta veículos (a lista é
 * paginada), e um branco fora da página não acendia. Aqui os veículos chegam na
 * relação `tasks`, então a resposta é sempre sobre os N.
 *
 * ⚠️ ÓRFÃO — existe orçamento sem tarefa nenhuma, e ele PASSA a aparecer nesta
 * lista (consultando `TaskQuote` não há mais a junção que os escondia). Sem
 * veículo não há `task.status`, e as duas regras que leem esse campo exigem
 * COMPLETED, então nenhuma delas dispararia de qualquer forma — mas o registro
 * tem de existir mesmo assim, com um par vazio, senão as OUTRAS regras do
 * orçamento (cliente incompleto, por exemplo) deixam de ser avaliadas para ele.
 */
export function toAttentionQuoteEntitiesFromQuotes(quotes: ReadonlyArray<TaskQuote>): AttentionQuoteEntity[] {
  const entities: AttentionQuoteEntity[] = [];
  for (const quote of quotes) {
    // `setEntities` drops anything without an id, so a quote fetched without `id: true` in the
    // select would register nothing at all — silently, which is why the include comment says so.
    if (!quote?.id) continue;
    const vehicles = (quote.tasks ?? []) as Array<{ id: string; status: string; customerOrderNumber?: string | null }>;
    // O desempate espelha o `tasks: { some: { status: COMPLETED } }` que a regra
    // usa na API: entre os veículos, vence um que já esteja COMPLETED, se houver.
    // A regra pergunta "algum veículo já ficou pronto?" — porque num orçamento de
    // sessenta caminhões o dinheiro já está parado quando o primeiro sai — e o
    // avaliador do cliente lê `task.status`, um campo só. Escolher aqui o veículo
    // que satisfaz a regra é o que faz os dois avaliadores concordarem.
    const anchor = vehicles.find((t) => t.status === TASK_STATUS.COMPLETED) ?? vehicles[0] ?? null;
    entities.push({
      ...(quote as TaskQuote),
      task: anchor ? { id: anchor.id, status: anchor.status } : { id: "", status: "" },
      anyVehicleMissingOrderNumber: vehicles.some(missingOrderNumber),
    });
  }
  return entities;
}

/** Same shape for a single task on a detail page. */
export function toAttentionQuoteEntity(task: Task | null | undefined): AttentionQuoteEntity | null {
  if (!task?.quote?.id) return null;
  // Com a relação carregada, a pergunta é sobre os N veículos; sem ela, sobre o
  // que a tela tem — a tarefa aberta.
  const vehicles = ((task.quote as TaskQuote).tasks ?? []) as Array<{ customerOrderNumber?: string | null }>;
  return {
    ...(task.quote as TaskQuote),
    task: { id: task.id, status: task.status },
    anyVehicleMissingOrderNumber:
      vehicles.length > 0 ? vehicles.some(missingOrderNumber) : missingOrderNumber(task),
  };
}

/**
 * Same shape when the quote was loaded separately from the task — the Orçamento detail page
 * fetches them with two queries (`useTaskDetail` + `useTaskQuoteByTask`) rather than one include.
 */
export function toAttentionQuoteEntityFromParts(
  quote: { id?: string } | null | undefined,
  task: { id: string; status: string; customerOrderNumber?: string | null } | null | undefined,
): AttentionQuoteEntity | null {
  if (!quote?.id || !task?.id) return null;
  // O orçamento desta página vem com `tasks` (a lista de veículos); a tarefa
  // aberta é o recuo quando ele ainda não existe.
  const vehicles = ((quote as TaskQuote).tasks ?? []) as Array<{ customerOrderNumber?: string | null }>;
  return {
    ...(quote as TaskQuote),
    task: { id: task.id, status: task.status },
    anyVehicleMissingOrderNumber:
      vehicles.length > 0 ? vehicles.some(missingOrderNumber) : missingOrderNumber(task),
  };
}
