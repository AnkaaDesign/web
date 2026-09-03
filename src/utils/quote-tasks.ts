/**
 * As TAREFAS de um orçamento — a fonte única sobre ordem, contagem e âncora.
 *
 * ESPELHA `api/src/utils/quote-tasks.ts`. Schemas e tipos são duplicados entre
 * os pacotes neste repositório (não compartilhados), então esta cópia tem de
 * andar junto com aquela.
 *
 * O PROBLEMA QUE ISTO RESOLVE
 *   `Task.quoteId` era `@unique`: um orçamento, uma tarefa. Mas a tela de
 *   criação já produzia N tarefas (produto cartesiano de placas × números de
 *   série) e emitia um orçamento para CADA uma. O Marquespan de 02/09 saiu como
 *   os orçamentos 642 a 701: sessenta números, sessenta PDFs, sessenta
 *   cerimônias de assinatura, todos com a mesma lista de serviços.
 *
 *   Agora o orçamento cobre os sessenta, e `quote.task` deixou de existir. Cada
 *   leitura precisa responder a UMA de três perguntas, e confundi-las é como se
 *   introduz um erro silencioso:
 *
 *     1. "Qual é a lista de veículos?"     → `quoteTasks(quote)`
 *     2. "Qual tarefa ancora este link?"   → `primaryTask(quote)`
 *     3. "Quantos veículos são?"           → `taskCount(quote)`
 *
 *   A (2) é a perigosa. Um link de navegação, um rótulo de tabela ou um nome de
 *   arquivo precisa de UMA tarefa e qualquer uma serve. Um total, um documento
 *   ou uma decisão de faturamento precisa de TODAS, e responder com a primeira
 *   ali é o defeito que faz um orçamento de sessenta caminhões cobrar por um.
 */

export interface QuoteTaskLike {
  id: string;
  createdAt?: Date | string | null;
  serialNumber?: string | null;
  name?: string | null;
}

interface QuoteWithTasksLike<T> {
  tasks?: T[] | null;
  /** @deprecated Forma anterior ao orçamento multitarefa. */
  task?: T | null;
}

/**
 * Reordena pela MESMA regra do `orderBy` da API: `createdAt`, `id` como
 * desempate.
 *
 * `createdAt` e não `serialNumber`: as tarefas nascem na ordem em que o operador
 * digitou as placas e as séries, e é essa a ordem em que ele espera relê-las na
 * tabela de veículos do documento. `id` como desempate para que a ordem seja
 * TOTAL — duas tarefas criadas no mesmo milissegundo não podem trocar de lugar
 * entre duas renderizações, senão a tela discorda do PDF.
 */
export function sortQuoteTasks<T extends QuoteTaskLike>(tasks: readonly T[]): T[] {
  return [...tasks].sort((a, b) => {
    const ta = a.createdAt ? new Date(a.createdAt).getTime() : 0;
    const tb = b.createdAt ? new Date(b.createdAt).getTime() : 0;
    if (ta !== tb) return ta - tb;
    return String(a.id).localeCompare(String(b.id));
  });
}

/**
 * As tarefas do orçamento, na ordem canônica, sempre como lista.
 *
 * Aceita as duas formas do grafo — `tasks` (atual) e `task` (respostas em cache
 * e clientes que ainda não migraram) — para que a leitura não precise saber de
 * qual delas veio o dado.
 */
export function quoteTasks<T extends QuoteTaskLike>(
  quote: QuoteWithTasksLike<T> | null | undefined,
): T[] {
  if (!quote) return [];
  if (Array.isArray(quote.tasks)) return sortQuoteTasks(quote.tasks);
  return quote.task ? [quote.task] : [];
}

/**
 * A tarefa ÂNCORA — a primeira na ordem canônica.
 *
 * Use só onde uma tarefa qualquer serve e a escolha não muda o significado: a
 * rota de detalhe (`/financeiro/orcamento/detalhes/:taskId`), o rótulo de uma
 * linha de tabela, o nome de um arquivo exportado.
 *
 * NÃO use para dinheiro, para o documento, nem para decidir o que faturar.
 */
export function primaryTask<T extends QuoteTaskLike>(
  quote: QuoteWithTasksLike<T> | null | undefined,
): T | null {
  return quoteTasks(quote)[0] ?? null;
}

/** Quantos veículos o orçamento cobre. É o "× N" do documento. */
export function taskCount(quote: QuoteWithTasksLike<QuoteTaskLike> | null | undefined): number {
  return quoteTasks(quote).length;
}

/** `true` quando o orçamento cobre mais de um veículo — o caso que muda a tela. */
export function isMultiTask(
  quote: QuoteWithTasksLike<QuoteTaskLike> | null | undefined,
): boolean {
  return taskCount(quote) > 1;
}

/**
 * Como nomear o conjunto de veículos numa linha de tabela ou num cabeçalho.
 *
 * Um veículo: o número de série, como sempre. Muitos: a contagem — "60
 * veículos" —, porque sessenta números de série numa célula de tabela não são
 * legíveis e ninguém os lê ali de qualquer forma.
 */
export function describeQuoteVehicles(
  quote: QuoteWithTasksLike<QuoteTaskLike> | null | undefined,
): string | null {
  const tasks = quoteTasks(quote);
  if (tasks.length === 0) return null;
  if (tasks.length === 1) {
    const t = tasks[0];
    return t.serialNumber ? `#${t.serialNumber}` : (t.name ?? null);
  }
  return `${tasks.length} veículos`;
}
