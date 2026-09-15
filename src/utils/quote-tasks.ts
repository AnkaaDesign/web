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

/**
 * QUANTOS VEÍCULOS o orçamento cobre, aceitando os dois caminhos.
 *
 * `vehicleCount` é coluna em `TaskQuote` (a API a mantém em `recalcQuoteTotals`)
 * e é o ÚNICO caminho quando a tela não carregou as tarefas — o que é a regra nas
 * listas: a de Orçamentos e a de Faturamento pedem um punhado de escalares do
 * orçamento, nunca a relação de veículos. `tasks.length` continua valendo onde
 * elas vieram (o detalhe, o documento, a página pública), e é ele quem responde
 * primeiro por ser o dado bruto: uma tela que TEM os veículos não deve depender
 * de uma contagem desnormalizada.
 */
export function quoteVehicleCount(
  quote:
    | (QuoteWithTasksLike<QuoteTaskLike> & { vehicleCount?: number | null })
    | null
    | undefined,
): number {
  const loaded = quoteTasks(quote).length;
  if (loaded > 0) return loaded;
  const denormalized = Math.trunc(Number(quote?.vehicleCount ?? 0));
  return denormalized > 0 ? denormalized : 1;
}

/**
 * O valor de UM VEÍCULO a partir do total do orçamento.
 *
 * ESPELHA `perVehicleAmount` de `api/src/utils/quote-tasks.ts`.
 *
 * `quote.total` é o valor do CONTRATO: `preço por veículo × N`. Toda tela que
 * mostra uma linha por TAREFA — Orçamentos, Faturamento, Preparação, Histórico,
 * exportações — quer o valor DAQUELE veículo e lia o total dos sessenta. A soma
 * das N fatias reconstrói o contrato, então nenhum total de tela muda no
 * orçamento de um veículo, que é a esmagadora maioria.
 *
 * Onde o número que interessa é o do CONTRATO (o documento, o cabeçalho do
 * orçamento, a fatura conjunta), leia `quote.total` direto — não passe por aqui.
 */
export function perVehicleAmount(
  total: unknown,
  vehicleCount?: number | null,
): number {
  const grand = Number(total ?? 0);
  if (!Number.isFinite(grand)) return 0;
  const count = Math.max(1, Math.trunc(Number(vehicleCount ?? 1)) || 1);
  return Math.round((grand / count) * 100) / 100;
}

/**
 * O valor de UM VEÍCULO de um orçamento já carregado — o atalho das tabelas.
 *
 * Devolve `null` quando não há orçamento ou não há total, para a célula poder
 * mostrar o travessão em vez de "R$ 0,00".
 */
export function quotePerVehicleTotal(
  quote:
    | (QuoteWithTasksLike<QuoteTaskLike> & {
        total?: unknown;
        vehicleCount?: number | null;
      })
    | null
    | undefined,
): number | null {
  if (!quote) return null;
  const grand = Number(quote.total ?? 0);
  if (!Number.isFinite(grand) || grand === 0) return null;
  return perVehicleAmount(grand, quoteVehicleCount(quote));
}

// ═══════════════════════════════════════════════════════════════════════════
// A COBERTURA DE UM FATURAMENTO — quais veículos ele cobra
//
// ESPELHA a seção gêmea de `api/src/utils/quote-tasks.ts`.
//
// Era `TaskQuoteCustomerConfig.taskId`, com NULO querendo dizer "todos". Virou
// relação (`coveredTasks`) porque uma fatura pode cobrir um LOTE — vinte dos
// sessenta — e nesse caso não existe coluna que responda.
//
// ⚠️ A relação só vem quando a consulta a pede. A API injeta `coveredTasks` em
// todo caminho que devolve `customerConfigs` (ver `withCoverageInclude` lá), mas
// uma resposta vinda de cache antigo ou de uma rota pública enxuta pode chegar
// sem ela — e cobertura vazia numa conta de dinheiro é R$ 0,00 numa fatura que
// tem valor. Por isso toda função aqui trata "vazio" como "cobre tudo", nunca
// como "cobre zero".
// ═══════════════════════════════════════════════════════════════════════════

/** Uma fatia de faturamento como as respostas a trazem. */
export interface BillingConfigLike {
  id?: string;
  customerId?: string | null;
  coveredTasks?: ReadonlyArray<{
    taskId: string;
    task?: {
      id?: string;
      name?: string | null;
      serialNumber?: string | null;
      customerOrderNumber?: string | null;
      truck?: { plate?: string | null } | null;
    } | null;
  }> | null;
}

/** Os ids dos veículos que este faturamento cobra. */
export function coveredTaskIds(config: BillingConfigLike | null | undefined): string[] {
  const rows = config?.coveredTasks;
  if (!Array.isArray(rows)) return [];
  return rows.map((r) => r.taskId);
}

/** Quantos veículos este faturamento cobra. É o multiplicador do valor da fatura. */
export function coveredTaskCount(config: BillingConfigLike | null | undefined): number {
  return coveredTaskIds(config).length;
}

/** Este faturamento cobra ESTE veículo? */
export function coversTask(
  config: BillingConfigLike | null | undefined,
  taskId: string | null | undefined,
): boolean {
  if (!taskId) return false;
  return coveredTaskIds(config).includes(taskId);
}

/**
 * COMO NOMEAR os veículos de um faturamento, na tela.
 *
 * É a resposta à pergunta que faltava: o assistente mostrava "Cliente 1",
 * "Cliente 2", "Cliente 3", "Cliente 4" — o MESMO cliente quatro vezes, sem
 * dizer de qual caminhão era cada passo. O operador editava o segundo achando
 * que era o segundo veículo.
 *
 * Devolve a lista de rótulos curtos, na ordem da cobertura: série quando existe,
 * senão placa, senão o nome da tarefa, senão o começo do id — nessa ordem porque
 * é assim que quem opera identifica um implemento.
 */
export function coverageLabels(
  config: BillingConfigLike | null | undefined,
  tasks?: ReadonlyArray<QuoteTaskLike & { truck?: { plate?: string | null } | null }> | null,
): string[] {
  const byId = new Map((tasks ?? []).map((t) => [t.id, t]));
  return (config?.coveredTasks ?? []).map((row) => {
    const t = (row.task ?? byId.get(row.taskId) ?? null) as
      | (QuoteTaskLike & { truck?: { plate?: string | null } | null })
      | null;
    return (
      (t?.serialNumber || undefined) ??
      (t?.truck?.plate || undefined) ??
      (t?.name || undefined) ??
      row.taskId.slice(0, 8)
    );
  });
}

/**
 * O rótulo de UM faturamento, em uma linha.
 *
 * `total` = quantos veículos o orçamento tem. Cobrir todos não vira lista: num
 * orçamento de sessenta caminhões, "Todos os 60 veículos" é a informação, e
 * imprimir as sessenta séries é ruído que ninguém lê.
 */
export function coverageSummary(
  config: BillingConfigLike | null | undefined,
  total: number,
  tasks?: ReadonlyArray<QuoteTaskLike & { truck?: { plate?: string | null } | null }> | null,
): string {
  const labels = coverageLabels(config, tasks);
  if (labels.length === 0) return total > 1 ? `Todos os ${total} veículos` : "Veículo único";
  if (total > 1 && labels.length === total) return `Todos os ${total} veículos`;
  if (labels.length === 1) return labels[0];
  if (labels.length <= 3) return labels.join(", ");
  return `${labels.slice(0, 2).join(", ")} +${labels.length - 2}`;
}

/**
 * As FATURAS que dizem respeito a ESTE veículo.
 *
 * Aqui a pergunta é "das N faturas deste orçamento, quais cobram ESTE
 * caminhão?". Mostrar todas na tela de um veículo faz sessenta blocos de
 * parcelas aparecerem na tarefa de cada um, com o cliente repetido sessenta
 * vezes no seletor — e o primeiro bloco, que é o do caminhão 1, sendo lido como
 * se fosse o daquele.
 */
export function configsForTask<T extends BillingConfigLike>(
  configs: readonly T[] | null | undefined,
  taskId: string | null | undefined,
): T[] {
  const all = configs ?? [];
  if (!taskId) return [...all];
  const own = all.filter((c) => coversTask(c, taskId));
  if (own.length > 0) return own;
  // Nenhuma fatura reivindica este veículo. Acontece em dois casos legítimos —
  // a tarefa acabou de ser vinculada e a cobertura ainda não foi reconciliada,
  // ou a consulta não trouxe a relação —, e nos dois a resposta útil são as
  // faturas SEM cobertura declarada, que é como a ausência sempre se leu.
  return all.filter((c) => coveredTaskCount(c) === 0);
}

// ═══════════════════════════════════════════════════════════════════════════
// "FATURAR PARA" NUMA LINHA DE TAREFA
//
// Uma tarefa é UM VEÍCULO. A pergunta que a tela da tarefa faz não é "quais
// clientes este orçamento fatura?" e sim "quem paga ESTE caminhão?".
//
// As duas coincidiam enquanto um orçamento tinha uma tarefa. Deixaram de
// coincidir no primeiro orçamento cobrado veículo a veículo: quatro caminhões de
// UM cliente têm quatro fatias, e listar todas imprimia
//
//     53.842.320 Kennedy de Campos Teixeira
//     53.842.320 Kennedy de Campos Teixeira
//     53.842.320 Kennedy de Campos Teixeira
//     53.842.320 Kennedy de Campos Teixeira
//
// no detalhe de UM veículo — o mesmo nome quatro vezes, sugerindo quatro
// tomadores onde há um, e sem dizer qual das quatro é a deste.
//
// Duas correções, e as duas são necessárias: RECORTAR pela cobertura (a fatia
// deste veículo) e DEDUPLICAR por cliente (dois serviços do mesmo tomador não
// são dois tomadores). Sobra mais de um nome só no caso real — o orçamento em
// que dois clientes distintos dividem os serviços do MESMO veículo.
// ═══════════════════════════════════════════════════════════════════════════

interface ConfigWithCustomerName extends BillingConfigLike {
  customer?: { id?: string | null; corporateName?: string | null; fantasyName?: string | null } | null;
}

/**
 * Os CLIENTES que faturam ESTE veículo, sem repetição e na ordem das fatias.
 *
 * ⚠️ Só para telas de TAREFA. Nas telas do ORÇAMENTO (assistentes, documento,
 * página pública) a pergunta é sobre o contrato inteiro, e ali listar todos os
 * clientes é o certo.
 *
 * Cobertura ausente (consulta que não pediu a relação) cai no comportamento
 * antigo por `configsForTask`: devolve as fatias sem cobertura declarada em vez
 * de nenhuma — melhor um nome a mais do que a linha vazia.
 */
export function taskInvoiceCustomerNames(
  configs: readonly ConfigWithCustomerName[] | null | undefined,
  taskId: string | null | undefined,
): string[] {
  const seen = new Set<string>();
  const names: string[] = [];
  for (const config of configsForTask(configs, taskId)) {
    const key = config.customerId ?? config.customer?.id ?? "";
    if (key && seen.has(key)) continue;
    if (key) seen.add(key);
    const name = (config.customer?.corporateName || config.customer?.fantasyName || "").trim();
    if (name) names.push(name);
  }
  return names;
}

/** O mesmo, numa linha só — o formato que as tabelas e exportações usam. */
export function taskInvoiceCustomerLabel(
  configs: readonly ConfigWithCustomerName[] | null | undefined,
  taskId: string | null | undefined,
): string {
  return taskInvoiceCustomerNames(configs, taskId).join(", ");
}

// ═══════════════════════════════════════════════════════════════════════════
// QUANTOS CLIENTES — e por que NUNCA se conta `customerConfigs.length`
//
// Antes do orçamento multitarefa havia exatamente UMA configuração por cliente,
// e `customerConfigs.length >= 2` era uma forma correta (por acidente) de
// perguntar "este orçamento tem mais de um cliente?".
//
// Com `billingSplit = PER_TASK` existe uma fatia POR VEÍCULO. Um orçamento de
// quatro caminhões para UM cliente tem QUATRO configurações — e toda leitura que
// contava fatias passou a afirmar que havia quatro clientes. O estrago medido no
// orçamento nº 0976 (4 veículos, 1 cliente, `PER_TASK`):
//
//   • Página pública: os 5 serviços eram filtrados para FORA da lista (nenhum
//     tem `invoiceToCustomerId`, e "sem cliente atribuído" só é legítimo num
//     orçamento de um cliente só). O cliente via a seção "Serviços" VAZIA e
//     "Total geral R$ 0,00" — na tela em que ele ASSINA.
//   • Revisão do faturamento: a validação de salvar exigia `invoiceToCustomerId`
//     em todo serviço e RECUSAVA o orçamento inteiro com "Serviços sem cliente
//     atribuído" — um erro impossível de corrigir, porque o seletor "Faturar
//     Para" nem aparece com um cliente só.
//   • Revisão do orçamento: aparecia um filtro "Completo / Cliente 1 / Cliente 2
//     / Cliente 3 / Cliente 4" para o MESMO cliente quatro vezes, e o bloco de
//     condições de pagamento (que exige `length === 1`) sumia.
//
// A pergunta certa é sobre CLIENTES DISTINTOS. É a mesma correção que o servidor
// já fez em `reconcileQuoteCustomerConfigs` ("a troca de cliente é detectada por
// CLIENTE, não por fatia") e o app em "Faturar Para".
// ═══════════════════════════════════════════════════════════════════════════

interface ConfigWithCustomer {
  customerId?: string | null;
  customer?: { id?: string | null } | null;
  /**
   * Declarado só para que uma fatia real seja atribuível a este tipo sem
   * disparar a checagem de propriedade excedente do TypeScript. Não é lido aqui
   * de propósito: é exatamente o campo cuja existência criou o defeito, e usá-lo
   * para contar clientes seria voltar a contar fatias.
   */
  taskId?: string | null;
}

/** O id do cliente de uma fatia, venha ele da FK ou da relação incluída. */
function customerIdOf(config: ConfigWithCustomer): string | null {
  return config.customerId ?? config.customer?.id ?? null;
}

/** Os clientes distintos cobertos pelas fatias, na ordem em que aparecem. */
export function distinctCustomerIds(
  configs: readonly ConfigWithCustomer[] | null | undefined,
): string[] {
  const seen = new Set<string>();
  for (const config of configs ?? []) {
    const id = customerIdOf(config);
    // Fatia sem cliente é registro pela metade (criação em andamento). Contá-la
    // como "outro cliente" é o mesmo erro de contar fatias, de outro jeito.
    if (id) seen.add(id);
  }
  return [...seen];
}

/** Quantos CLIENTES distintos este orçamento fatura. */
export function customerCount(
  configs: readonly ConfigWithCustomer[] | null | undefined,
): number {
  return distinctCustomerIds(configs).length;
}

/**
 * O orçamento é faturado para mais de um cliente?
 *
 * ⚠️ Use SEMPRE isto no lugar de `customerConfigs.length >= 2`. Ver o bloco
 * acima: as duas expressões coincidiam antes do multitarefa e divergem em todo
 * orçamento `PER_TASK`.
 */
export function hasMultipleCustomers(
  configs: readonly ConfigWithCustomer[] | null | undefined,
): boolean {
  return customerCount(configs) >= 2;
}

// ═══════════════════════════════════════════════════════════════════════════
// O NÚMERO DO PEDIDO DE COMPRA DO CLIENTE
//
// ESPELHA `orderNumbersOfTasks` / `orderNumberLabel` de
// `api/src/utils/quote-tasks.ts`. Mora em `Task.customerOrderNumber` — por
// VEÍCULO — desde que um orçamento passou a cobrir N caminhões. Antes era campo
// da configuração de faturamento, por CLIENTE, e os sessenta veículos eram
// obrigados a citar o mesmo pedido na nota e no boleto.
// ═══════════════════════════════════════════════════════════════════════════

interface TaskWithOrderNumber {
  customerOrderNumber?: string | null;
}

/** Os números de pedido dos veículos indicados, sem brancos e sem repetição. */
export function orderNumbersOfTasks(
  tasks: readonly TaskWithOrderNumber[] | null | undefined,
): string[] {
  const seen = new Set<string>();
  for (const t of tasks ?? []) {
    const value = (t?.customerOrderNumber ?? "").trim();
    if (value) seen.add(value);
  }
  return [...seen];
}

/**
 * UMA LINHA para a nota, o boleto e o documento.
 *
 * Um número quando é um só — o caso comum, inclusive num orçamento de sessenta
 * caminhões comprados no mesmo pedido. Vários, separados por vírgula, quando
 * diferem: a nota conjunta cobre todos, e omitir os outros faria o cliente
 * receber uma nota que não bate com nenhum pedido dele.
 */
export function orderNumberLabel(
  tasks: readonly TaskWithOrderNumber[] | null | undefined,
  maxLength?: number,
): string | null {
  const numbers = orderNumbersOfTasks(tasks);
  if (numbers.length === 0) return null;
  const full = numbers.join(", ");
  if (!maxLength || full.length <= maxLength) return full;

  const kept: string[] = [];
  for (const n of numbers) {
    const candidate = [...kept, n].join(", ");
    // `+ 5` reserva o " (+N)" que fecha a linha.
    if (candidate.length + 5 > maxLength) break;
    kept.push(n);
  }
  if (kept.length === 0) return numbers[0].slice(0, maxLength);
  const rest = numbers.length - kept.length;
  return rest > 0 ? `${kept.join(", ")} (+${rest})` : kept.join(", ");
}

/**
 * COMO CHAMAR UM VEÍCULO numa linha de formulário.
 *
 * A tabela de pedidos de compra precisa identificar o caminhão para quem digita
 * — e num orçamento de sessenta a coluna é a única coisa que distingue uma linha
 * da seguinte. Série e placa são o que o operador tem na mão (a nota de entrada,
 * o documento do veículo); o nome da tarefa é o recuo quando nenhum dos dois foi
 * preenchido, e o índice é o último recurso para que a linha nunca fique anônima.
 */
export function vehicleRowLabel(
  task: {
    serialNumber?: string | null;
    name?: string | null;
    truck?: { plate?: string | null } | null;
  } | null
  | undefined,
  index: number,
): string {
  const parts: string[] = [];
  const serial = (task?.serialNumber ?? "").trim();
  const plate = (task?.truck?.plate ?? "").trim();
  if (serial) parts.push(`#${serial}`);
  if (plate) parts.push(plate.toUpperCase());
  if (parts.length > 0) return parts.join(" · ");
  const name = (task?.name ?? "").trim();
  return name || `Veículo ${index + 1}`;
}

// ═══════════════════════════════════════════════════════════════════════════
// AS FATURAS × OS CLIENTES — duas leituras da mesma lista
//
// `customerConfigs` é a lista de FATURAS. Os assistentes de orçamento, porém,
// têm um passo por CLIENTE: as condições comerciais (desconto, prazo, gerar
// NF/boleto) são do negócio, e o negócio é com o cliente — não com cada fatura.
//
// Enquanto havia uma fatura por cliente as duas listas coincidiam, e os
// assistentes mapeavam 1:1. Deixaram de coincidir no primeiro orçamento cobrado
// veículo a veículo: quatro caminhões de UM cliente viraram quatro passos
// "Cliente 1..4", todos com o mesmo nome, e o save reenviava os quatro — o
// último gravando por cima dos outros três.
//
// A separação certa é esta: um passo por CLIENTE, e a repartição dos veículos
// num campo só do orçamento.
// ═══════════════════════════════════════════════════════════════════════════

export interface DedupedConfigs<T> {
  /** Uma fatura por CLIENTE — a primeira dele, que carrega as condições. */
  configs: T[];
  /**
   * A PARTIÇÃO dos veículos, lida das faturas do PRIMEIRO cliente.
   *
   * Do primeiro e não da união: a repartição é a mesma para todos os clientes
   * (cada um cobra os mesmos veículos, só que pelos serviços dele), e unir as
   * coberturas de dois clientes produziria cada veículo duas vezes.
   */
  coverageGroups: string[][];
}

/**
 * Agrupa as faturas por cliente e extrai a repartição dos veículos.
 *
 * Preserva a ordem de chegada — a ordem em que as faturas foram criadas, que é
 * a ordem em que a tela as lista e a ordem dos lotes no documento.
 */
export function dedupeConfigsByCustomer<T extends BillingConfigLike>(
  configs: readonly T[] | null | undefined,
): DedupedConfigs<T> {
  const byCustomer = new Map<string, T[]>();
  const order: string[] = [];
  for (const config of configs ?? []) {
    const id = config.customerId ?? "";
    if (!byCustomer.has(id)) {
      byCustomer.set(id, []);
      order.push(id);
    }
    byCustomer.get(id)!.push(config);
  }

  const first = order.length > 0 ? (byCustomer.get(order[0]) ?? []) : [];
  return {
    configs: order.map((id) => byCustomer.get(id)![0]),
    // Fatura sem cobertura declarada não vira lote: ela é o registro que nasceu
    // antes do vínculo com a tarefa, e transformá-la num lote vazio faria o
    // controle mostrar "Lote 1: 0 veículos".
    coverageGroups: first.map((c) => coveredTaskIds(c)).filter((g) => g.length > 0),
  };
}
