import { IconCalendar, IconCalendarCheck, IconCalendarClock, IconCurrencyReal, IconFileText, IconHash, IconProgressCheck, IconReceipt2, IconUserDollar } from "@tabler/icons-react";

import type { DataTableFilterDef, DataTableFilterValues } from "@/components/ui/datatable";
import type { Customer } from "@/types";
import type { Budget } from "@/types/budget";
import { TASK_QUOTE_STATUS_LABELS, TASK_STATUS, TASK_STATUS_LABELS } from "@/constants";
import { MONEY_PRIVILEGES } from "@/utils/privilege";
import {
  createCustomerFilterDef,
  customerIdsFromFilter,
  orderNumberPresenceWhere,
  toNumberRange,
  toPositiveInt,
  toPrismaDateRange,
} from "@/components/financial/shared/quote-table-shared";
import { BUDGET_QUOTE_STATUSES, buildBudgetOrderBy } from "./budget-table-columns";

export const BUDGET_DEFAULT_PAGE_SIZE = 40;

/** The list is the BUDGET half of a quote's lifecycle — everything past approval belongs to Faturamento. */
// Definida em `budget-table-columns` (a coluna também precisa dela) e reexportada aqui, que é onde
// o resto do app já a procurava.
export { BUDGET_QUOTE_STATUSES } from "./budget-table-columns";

const BUDGET_QUOTE_STATUS_OPTIONS = BUDGET_QUOTE_STATUSES.map((value) => ({ value, label: TASK_QUOTE_STATUS_LABELS[value] }));

/** Task statuses a budget can legitimately sit on. CANCELLED is included — a cancelled task with a
 * live quote is exactly the kind of thing someone needs to find and close out. */
const TASK_STATUS_OPTIONS = (Object.values(TASK_STATUS) as TASK_STATUS[]).map((value) => ({
  value,
  label: TASK_STATUS_LABELS[value] ?? value,
}));

/**
 * O que a lista de ORÇAMENTOS precisa carregar. A linha é o orçamento, então o
 * include desce em vez de subir: `tasks` são os veículos que as sete colunas
 * agregadas leem, `customerConfigs` são os tomadores.
 *
 * 🔴 `customerConfigs: true`, e NÃO um `select` próprio.
 *
 * O zod do servidor só permite `customer.select` ∈ {id, fantasyName, cnpj}, e o
 * objeto interno NÃO é strict: mandar `ATTENTION_CUSTOMER_SELECT` (dez chaves,
 * com corporateName, CEP, cidade, estado, endereço, número, bairro e CPF) faria
 * o zod APAGAR oito delas em silêncio. A regra
 * `task-quote.billing-customer-incomplete` leria então todo cliente como
 * incompleto e o alerta piscaria em TODO orçamento aprovado. Com `true`, o
 * repositório monta um `customer.select` que é superconjunto do que a regra
 * precisa, inclui `responsible` e `generateInvoice`, e passa por
 * `withCoverageInclude`, que pendura `billing` com o estado e a cobertura.
 *
 * ⚠️ `tasks` aceita `boolean` ou `{ include: … }` — NÃO aceita `select`. Para ter
 * placa e cliente na linha é preciso pedir as relações inteiras; o peso é real
 * numa página com orçamentos grandes, e a saída certa (estender o schema para
 * aceitar `select` nas tarefas) fica para outra mudança.
 */
export const BUDGET_QUOTE_INCLUDE = {
  tasks: { include: { truck: true, customer: true } },
  customerConfigs: true,
} as const;

export function createBudgetFilterDefs(opts: { invoiceCustomers: Customer[]; taskCustomers: Customer[] }): DataTableFilterDef<Budget>[] {
  return [
    {
      key: "budgetNumber",
      label: "Nº do Orçamento",
      type: "text",
      icon: <IconHash className="h-4 w-4" />,
      placeholder: "Ex: 557",
    },
    {
      key: "quoteStatuses",
      label: "Status do Orçamento",
      type: "multiselect",
      icon: <IconReceipt2 className="h-4 w-4" />,
      placeholder: "Selecione o status...",
      options: BUDGET_QUOTE_STATUS_OPTIONS,
    },
    {
      key: "taskStatuses",
      label: "Status da Tarefa",
      type: "multiselect",
      icon: <IconProgressCheck className="h-4 w-4" />,
      placeholder: "Selecione o status...",
      options: TASK_STATUS_OPTIONS,
    },
    // ⚠️ `createCustomerFilterDef` mora na shared e devolve `DataTableFilterDef<Task>`
    // porque o Faturamento — que ainda lista TAREFAS — depende dessa assinatura.
    // O `accessor` que torna o tipo contravariante só é lido em modo CLIENTE, e
    // as duas listas rodam em modo servidor: aqui o def é puro metadado de
    // formulário. Trocar a assinatura na shared quebraria a outra lista sem
    // produzir um único erro nesta.
    createCustomerFilterDef({
      key: "customerIds",
      label: "Faturar Para (Cliente)",
      queryKey: "customers-budget-invoice-filter",
      selectedOptions: opts.invoiceCustomers,
    }) as unknown as DataTableFilterDef<Budget>,
    createCustomerFilterDef({
      key: "taskCustomerIds",
      label: "Cliente da Tarefa",
      queryKey: "customers-budget-task-filter",
      selectedOptions: opts.taskCustomers,
      icon: <IconUserDollar className="h-4 w-4" />,
    }) as unknown as DataTableFilterDef<Budget>,
    {
      key: "totalRange",
      label: "Faixa de Valor",
      type: "number-range",
      currency: true,
      icon: <IconCurrencyReal className="h-4 w-4" />,
      // The value itself is money — a user who cannot see the column must not be able to
      // binary-search it with a range filter either.
      requiredPrivilege: MONEY_PRIVILEGES,
    },
    {
      key: "hasOrderNumber",
      label: "N° do Pedido",
      type: "boolean",
      icon: <IconFileText className="h-4 w-4" />,
      placeholder: "Todos",
      formatValue: (v) => (v === true || v === "true" ? "Com N° do Pedido" : "Sem N° do Pedido"),
    },
    {
      key: "expiresAtRange",
      label: "Período de Validade",
      type: "date-range",
      icon: <IconCalendarClock className="h-4 w-4" />,
    },
    {
      key: "termRange",
      label: "Prazo de Entrega",
      type: "date-range",
      icon: <IconCalendarCheck className="h-4 w-4" />,
    },
    {
      key: "forecastDateRange",
      label: "Previsão de Liberação",
      type: "date-range",
      icon: <IconCalendar className="h-4 w-4" />,
    },
    {
      key: "entryDateRange",
      label: "Período de Entrada",
      type: "date-range",
      icon: <IconCalendar className="h-4 w-4" />,
    },
    {
      key: "finishedDateRange",
      label: "Período de Finalização",
      type: "date-range",
      icon: <IconCalendar className="h-4 w-4" />,
    },
    {
      key: "createdAtRange",
      label: "Período de Criação",
      type: "date-range",
      icon: <IconCalendar className="h-4 w-4" />,
    },
  ];
}

const stringList = (value: unknown): string[] =>
  Array.isArray(value) ? value.filter((s): s is string => typeof s === "string") : [];

/**
 * Filter values + global search → a `where` de TASK-QUOTE (modo servidor).
 *
 * ⚠️ REESCRITO DO ZERO, e não adaptado, de propósito.
 *
 * A versão anterior consultava `GET /tasks` e usava SEIS parâmetros de primeira
 * classe daquela rota — `status`, `customerIds`, `termRange`,
 * `forecastDateRange`, `entryDateRange`, `finishedDateRange`, `createdAtRange`.
 * Nenhum deles existe em `/budgets`, e o topo do schema de lá NÃO é
 * `.strict()`: uma chave desconhecida é APAGADA em silêncio. Um filtro esquecido
 * não daria erro — daria 200 com o filtro simplesmente não aplicado, que é a
 * pior forma de errar numa tela que alguém usa para decidir o que cobrar.
 * Adaptar o código antigo era exatamente o caminho para deixar uma para trás.
 *
 * As duas regras que organizam tudo abaixo:
 *
 *  1. O que é do CONTRATO vai no topo do `where` (status, número, total,
 *     validade, criação, tomadores).
 *  2. O que é do VEÍCULO vai em `tasks: { some: … }`. Essa chave é
 *     `z.record(z.any())` no servidor: o conteúdo passa inteiro para o Prisma,
 *     sem validação e sem tradução — todo filtro de tarefa cabe ali sem uma
 *     linha de API.
 *
 * 🔴 NENHUM `OR` no topo do `where`. `searchingFor` monta o dele e SOBRESCREVE o
 * que estiver lá: um `OR` nosso desapareceria assim que o usuário digitasse na
 * busca. É por isso que "Sem N° do Pedido" — que é um `OR` — vai dentro de
 * `tasks.some`, e não solto.
 */
export function buildBudgetQuery(filters: DataTableFilterValues, search: string): Record<string, unknown> {
  const q: Record<string, unknown> = {};

  const quoteStatuses = stringList(filters.quoteStatuses);
  const where: Record<string, unknown> = {
    // Narrowing WITHIN the list's own scope: an explicit status pick can only ever be a subset
    // dos cinco estados do orçamento, never a way out of it.
    status: { in: quoteStatuses.length > 0 ? quoteStatuses : BUDGET_QUOTE_STATUSES },
  };

  const budgetNumber = toPositiveInt(filters.budgetNumber);
  if (budgetNumber != null) where.budgetNumber = budgetNumber;

  const customerIds = customerIdsFromFilter(filters.customerIds);
  if (customerIds.length > 0) where.customerConfigs = { some: { customerId: { in: customerIds } } };

  const totalRange = toNumberRange(filters.totalRange);
  if (totalRange) where.total = totalRange;

  const expiresAt = toPrismaDateRange(filters.expiresAtRange);
  if (expiresAt) where.expiresAt = expiresAt;

  // ⚠️ MUDOU DE SIGNIFICADO junto com a coluna: é a criação do ORÇAMENTO, não a
  // da tarefa. É a leitura certa para uma lista de orçamentos, mas quem salvou
  // um link com este filtro vai receber um recorte diferente do de ontem.
  const createdAt = toPrismaDateRange(filters.createdAtRange);
  if (createdAt) where.createdAt = createdAt;

  // --- o que é do VEÍCULO ---------------------------------------------------
  // Um único nó `some`: as condições valem para O MESMO veículo, que é a
  // leitura que o operador espera ("tem algum caminhão em produção com prazo
  // nesta semana?"). Espalhá-las em `some` separados responderia a outra
  // pergunta — um caminhão em produção E outro, qualquer, com aquele prazo.
  const vehicle: Record<string, unknown> = {};

  const taskStatuses = stringList(filters.taskStatuses);
  // 🔴 Vai aqui e NUNCA como `status` de topo: no `/budgets` o `status` do
  // topo é o enum do ORÇAMENTO (valor único), e mandar um array de status de
  // TAREFA para ele devolve 400 e derruba a tela inteira.
  if (taskStatuses.length > 0) vehicle.status = { in: taskStatuses };

  const taskCustomerIds = customerIdsFromFilter(filters.taskCustomerIds);
  if (taskCustomerIds.length > 0) vehicle.customerId = { in: taskCustomerIds };

  const term = toPrismaDateRange(filters.termRange);
  if (term) vehicle.term = term;

  const forecast = toPrismaDateRange(filters.forecastDateRange);
  if (forecast) vehicle.forecastDate = forecast;

  const entry = toPrismaDateRange(filters.entryDateRange);
  if (entry) vehicle.entryDate = entry;

  const finished = toPrismaDateRange(filters.finishedDateRange);
  if (finished) vehicle.finishedAt = finished;

  const and: Record<string, unknown>[] = [];
  if (Object.keys(vehicle).length > 0) and.push({ tasks: { some: vehicle } });

  // Ramo PRÓPRIO, e não fundido no `some` acima: fundir significaria "o mesmo
  // veículo satisfaz o status, o prazo E a falta de pedido", que é mais estrito
  // e muda em silêncio o que os outros filtros querem dizer. A semântica de
  // `orderNumberPresenceWhere` (`some` em vez de `none` — um orçamento em que só
  // UM caminhão está sem pedido ainda é um orçamento a cobrar) sobe um nível e
  // continua certa.
  const orderNumberWhere = orderNumberPresenceWhere(filters.hasOrderNumber);
  if (orderNumberWhere) and.push({ tasks: { some: orderNumberWhere } });

  if (and.length > 0) where.AND = and;

  q.where = where;
  if (search) q.searchingFor = search;

  return q;
}

/**
 * The list with no filters, no search and its default sort — what the detail page's prev/next
 * pager falls back to when the user did not arrive from the list (a notification, a deep link, a
 * refresh, "abrir em nova guia"). It MUST stay a faithful mirror of the list's own defaults: a
 * divergence does not error, it just makes "próximo" land on a record that was not the next row.
 *
 * 🔴 É um `where` de TASK-QUOTE, e só pode ser enviado para `GET /budgets`.
 * Mandá-lo para `/tasks` — que é o que o pager fazia — devolve 400: o
 * `taskWhereSchema` é `.strict()` e recusa `tasks` e `budgetNumber`. Ver
 * `useBudgetSiblingIds`, que é quem o consome.
 */
export const BUDGET_FALLBACK_LIST_QUERY: Record<string, unknown> = {
  ...buildBudgetQuery({}, ""),
  orderBy: buildBudgetOrderBy([]),
};
