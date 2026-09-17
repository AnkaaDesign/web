import { TruncatedTextWithTooltip } from "@/components/ui/truncated-text-with-tooltip";
import { MutedDash } from "@/components/financial/shared/quote-table-shared";
import { dedupeConfigsByCustomer, orderNumberLabel, orderNumbersOfTasks, quoteTasks, quoteVehicleCount } from "@/utils/quote-tasks";
import type { Task } from "@/types";
import type { Budget } from "@/types/budget";

/**
 * Células e extratores da lista de ORÇAMENTOS, onde a linha é o CONTRATO.
 *
 * ⚠️ Arquivo NOVO de propósito. `quote-table-shared.tsx` continua sendo a casa
 * dos genéricos (MutedDash, as datas, os filtros de cliente) e de tudo que é
 * tipado `(task: Task)`, e o Faturamento importa dezesseis símbolos de lá
 * assumindo essa assinatura. Reescrevê-los para `(quote: Budget)` quebraria
 * aquela lista sem um único erro nesta.
 *
 * O QUE MUDA quando a linha deixa de ser um veículo: sete colunas passavam a
 * pergunta direto ao registro da linha (nome, identificador, cliente, previsão,
 * prazo, entrada, status da tarefa) e agora precisam AGREGAR os N veículos do
 * orçamento. Cada agregação abaixo diz qual pergunta responde e por que a regra
 * escolhida é a certa — porque "o primeiro da lista" é quase sempre o errado, e
 * é um erro que não aparece no orçamento de um veículo, que é a maioria.
 */

/** Os veículos do orçamento na ordem canônica, sempre como lista. */
const vehiclesOf = (quote: Budget): Task[] => quoteTasks<Task>(quote);

/**
 * QUANTOS VEÍCULOS, lendo a relação e não o desnormalizado.
 *
 * `quoteVehicleCount` faz `loaded > 0 ? loaded : (vehicleCount || 1)` e portanto
 * NÃO distingue "a consulta não trouxe as tarefas" de "não há tarefa nenhuma".
 * Nesta lista `tasks` vem SEMPRE no include, então a relação é a verdade — e a
 * diferença é visível: existem orçamentos sem veículo algum (número, valor e
 * validade, nenhuma tarefa), e pelo caminho antigo a célula anunciaria "1
 * veículo" para eles, que é a coluna afirmando algo que não existe.
 */
export function quoteVehiclesLoadedCount(quote: Budget): number {
  return Array.isArray(quote.tasks) ? quote.tasks.length : quoteVehicleCount(quote);
}

/**
 * Contrai uma lista de rótulos em "a, b +N", com a lista inteira reservada para
 * o `title`.
 *
 * ⚠️ NÃO é uma faixa. As tarefas de um orçamento nascem do produto cartesiano de
 * placas × números de série, e nada garante que as séries sejam contíguas:
 * escrever "78000–78003" afirmaria a existência do 78001 e do 78002 sem tê-los
 * visto. A contagem sozinha também não serve — ela joga fora justamente o número
 * que o operador está lendo no caminhão à frente dele.
 *
 * Mesma forma de `orderNumberLabel`, que já resolve este problema para o pedido
 * de compra.
 */
function contractedLabel(values: readonly string[], maxVisible = 2): string | null {
  if (values.length === 0) return null;
  if (values.length <= maxVisible) return values.join(", ");
  return `${values.slice(0, maxVisible).join(", ")} +${values.length - maxVisible}`;
}

// ---------------------------------------------------------------------------
// IDENTIFICADOR — série, senão placa
// ---------------------------------------------------------------------------

/** Como cada veículo se identifica no chão de fábrica: a série, senão a placa. */
export function quoteIdentifiers(quote: Budget): string[] {
  const seen = new Set<string>();
  for (const task of vehiclesOf(quote)) {
    const value = (task.serialNumber || task.truck?.plate || "").trim();
    if (value) seen.add(value);
  }
  return [...seen];
}

/** "78000" num veículo; "78000, 78001 +2" em quatro. Lista completa no `title`. */
export function quoteIdentifierLabel(quote: Budget): string | null {
  return contractedLabel(quoteIdentifiers(quote));
}

// ---------------------------------------------------------------------------
// LOGOMARCA — o que o orçamento vende
// ---------------------------------------------------------------------------

/**
 * Os nomes DISTINTOS das tarefas.
 *
 * Num orçamento multitarefa a logomarca é a mesma nos N veículos — é ela que o
 * orçamento vende, e os N caminhões recebem a mesma arte. Listar os N nomes
 * imprimiria "Marquespan / Marquespan +58" numa coluna cuja resposta é uma
 * palavra. Sobra mais de um nome só quando os veículos foram batizados
 * diferente, e aí a divergência É a informação.
 */
export function quoteNames(quote: Budget): string[] {
  const seen = new Set<string>();
  for (const task of vehiclesOf(quote)) {
    const name = (task.name ?? "").trim();
    if (name) seen.add(name);
  }
  return [...seen];
}

export function quoteNameLabel(quote: Budget): string | null {
  return contractedLabel(quoteNames(quote), 1);
}

// ---------------------------------------------------------------------------
// CLIENTE DA TAREFA — para quem é o trabalho
// ---------------------------------------------------------------------------

/**
 * Os clientes distintos dos veículos — quem recebe o trabalho, que não é
 * necessariamente quem paga (essa é a coluna "Clientes", das fatias de
 * faturamento). Num orçamento multitarefa o cliente da obra é quase sempre um só.
 */
export function quoteCustomerNames(quote: Budget): string[] {
  const seen = new Set<string>();
  for (const task of vehiclesOf(quote)) {
    const name = (task.customer?.corporateName || task.customer?.fantasyName || "").trim();
    if (name) seen.add(name);
  }
  return [...seen];
}

export function quoteCustomerLabel(quote: Budget): string | null {
  return contractedLabel(quoteCustomerNames(quote), 1);
}

// ---------------------------------------------------------------------------
// FATURAR PARA — os tomadores DO ORÇAMENTO
// ---------------------------------------------------------------------------

/**
 * Os clientes que faturam este orçamento, sem repetição.
 *
 * ✖ Some o recorte por tarefa (`configsForTask`): ele existia porque a linha era
 * UM veículo e, com `billingSplit = PER_TASK`, um orçamento de sessenta
 * caminhões tem sessenta fatias do MESMO cliente — a célula da linha do caminhão
 * 12 tinha de achar a dele. Com a linha valendo o contrato, a pergunta certa é
 * "quem paga este orçamento?", e a resposta é a lista deduplicada por CLIENTE.
 */
export function quoteInvoiceToCustomerNames(quote: Budget): string[] {
  const { configs } = dedupeConfigsByCustomer(quote.customerConfigs ?? []);
  const names = configs.map((c) => (c.customer?.corporateName || c.customer?.fantasyName || "").trim()).filter(Boolean);
  return [...new Set(names)];
}

/** Dois nomes lado a lado e um marcador `+N` — a mesma forma da célula que substitui. */
export function QuoteInvoiceToCustomersCell({ quote }: { quote: Budget }) {
  const names = quoteInvoiceToCustomerNames(quote);
  if (names.length === 0) return <MutedDash />;
  if (names.length === 1) return <TruncatedTextWithTooltip text={names[0]} className="text-sm" />;
  return (
    <div className="flex items-center gap-1 min-w-0" title={names.join(", ")}>
      <span className="text-sm truncate max-w-[45%]">{names[0]}</span>
      <span className="text-muted-foreground text-sm shrink-0">/</span>
      <span className="text-sm truncate max-w-[45%]">{names[1]}</span>
      {names.length > 2 && <span className="text-muted-foreground text-xs shrink-0">+{names.length - 2}</span>}
    </div>
  );
}

// ---------------------------------------------------------------------------
// N° DO PEDIDO — do VEÍCULO, agregado na linha do contrato
// ---------------------------------------------------------------------------

/** Os pedidos de compra dos veículos, sem brancos e sem repetição. */
export const quoteOrderNumbers = (quote: Budget): string[] => orderNumbersOfTasks(vehiclesOf(quote));

/**
 * Uma linha só. `orderNumberLabel` já resolve este problema — dedupe e contração
 * em "(+N)" por comprimento — e é o mesmo rótulo que a nota, o boleto e o
 * documento imprimem; reusá-lo é o que impede a lista de inventar um terceiro
 * jeito de escrever o mesmo campo.
 */
export const quoteOrderNumberLabel = (quote: Budget): string | null => orderNumberLabel(vehiclesOf(quote), 40);

export function QuoteOrderNumbersCell({ quote }: { quote: Budget }) {
  const numbers = quoteOrderNumbers(quote);
  if (numbers.length === 0) return <MutedDash />;
  return <TruncatedTextWithTooltip text={quoteOrderNumberLabel(quote) ?? ""} className="text-sm tabular-nums" />;
}

// ---------------------------------------------------------------------------
// DATAS — a MAIS CEDO entre os veículos
// ---------------------------------------------------------------------------

type QuoteTaskDateField = "term" | "forecastDate" | "entryDate";

/**
 * A data MAIS CEDO entre os veículos, nulos ignorados.
 *
 * O prazo é uma PROMESSA, e a primeira a vencer é a que cobra. Mostrar a maior
 * data faria a lista anunciar folga num orçamento cujo primeiro caminhão já está
 * atrasado — e é exatamente nessa linha que alguém precisaria bater o olho.
 * Mesma regra para a previsão e para a entrada, para que as três colunas contem
 * a história do mesmo veículo: o mais adiantado no relógio.
 *
 * `null` quando não há veículo ou todos estão sem a data.
 */
export function earliestTaskDate(quote: Budget, field: QuoteTaskDateField): Date | null {
  let earliest: Date | null = null;
  for (const task of vehiclesOf(quote)) {
    const raw = task[field];
    if (!raw) continue;
    const date = new Date(raw);
    if (Number.isNaN(date.getTime())) continue;
    if (!earliest || date.getTime() < earliest.getTime()) earliest = date;
  }
  return earliest;
}

/** Quantos veículos têm ESTA data preenchida — o que decide se vale explicar no `title`. */
export function taskDateSpread(quote: Budget, field: QuoteTaskDateField): number {
  return vehiclesOf(quote).filter((t) => !!t[field]).length;
}

// ---------------------------------------------------------------------------
// STATUS DA TAREFA — o veículo mais atrasado descreve o orçamento
// ---------------------------------------------------------------------------

/**
 * O status de MENOR `statusOrder` entre os veículos.
 *
 * Mesma doutrina de `taskBillingStatus`: vence o que pede ação mais cedo. Num
 * orçamento de quatro caminhões com três prontos e um ainda em produção, o
 * orçamento não está pronto — e escolher o status do primeiro veículo da ordem
 * canônica faria a resposta depender de qual placa foi digitada primeiro.
 *
 * `distinct` conta quantos estados diferentes existem, para a célula poder dizer
 * no `title` que o badge é um resumo e não o estado de todos.
 */
export function quoteTaskStatus(quote: Budget): { status: string; distinct: number } | null {
  let best: { status: string; order: number } | null = null;
  const seen = new Set<string>();
  for (const task of vehiclesOf(quote)) {
    if (!task.status) continue;
    seen.add(task.status);
    const order = typeof task.statusOrder === "number" ? task.statusOrder : Number.MAX_SAFE_INTEGER;
    if (!best || order < best.order) best = { status: task.status, order };
  }
  return best ? { status: best.status, distinct: seen.size } : null;
}
