import type { DataTableColumnDef } from "@/components/ui/datatable";
import type { TASK_QUOTE_STATUS, Budget } from "@/types/budget";
import { QuoteStatusBadge } from "@/components/production/task/quote/quote-status-badge";
import { TruncatedTextWithTooltip } from "@/components/ui/truncated-text-with-tooltip";
import { Badge } from "@/components/ui/badge";
import { TASK_QUOTE_STATUS_LABELS, TASK_STATUS_LABELS, getBadgeVariant } from "@/constants";
import type { TASK_STATUS } from "@/constants";
import { MONEY_PRIVILEGES } from "@/utils/privilege";
import { formatCurrency } from "@/utils";
import { MutedDash, dateExportValue, renderDateCell } from "@/components/financial/shared/quote-table-shared";
import {
  QuoteInvoiceToCustomersCell,
  QuoteOrderNumbersCell,
  earliestTaskDate,
  quoteCustomerLabel,
  quoteCustomerNames,
  quoteIdentifierLabel,
  quoteIdentifiers,
  quoteInvoiceToCustomerNames,
  quoteNameLabel,
  quoteNames,
  quoteOrderNumberLabel,
  quoteOrderNumbers,
  quoteTaskStatus,
  quoteVehiclesLoadedCount,
  taskDateSpread,
} from "./quote-row-shared";

/**
 * Columns for the Orçamentos list.
 *
 * ⚠️ A LINHA É UM ORÇAMENTO — o contrato, não um veículo.
 *
 * Era uma tarefa: um orçamento de quatro caminhões ocupava quatro linhas com o
 * MESMO número 984, o rodapé dizia "4 resultado(s)", e o dono leu quatro
 * orçamentos onde há um. A lista passou a consultar `GET /budgets`, e com
 * isso cai todo o andaime que existia só para EXPLICAR a repetição: a marca
 * "N veíc." na célula do número, o sufixo "/veíc." no valor e as divisões
 * `total ÷ N`. As colunas que perguntavam ao registro da linha (nome,
 * identificador, cliente, previsão, prazo, entrada, status da tarefa) passam a
 * AGREGAR os veículos — ver `quote-row-shared.tsx`, onde cada regra se explica.
 *
 * Column ids are deliberately dot-free — they become the `--col-<id>-size` CSS custom property
 * and the persistence key, so a nested sort target lives in BUDGET_SORT_FIELD_MAP instead of the
 * id (the legacy table used `quote.statusOrder` as the key, which the new engine cannot).
 *
 * Everything the legacy table showed stays visible by default; the columns added on top are
 * `defaultVisible: false` and reachable from "Colunas", so nobody's view changes without them
 * asking for it.
 */
const money = (value: unknown): number | null => {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
};

const moneyCell = (n: number | null) =>
  n ? <span className="text-sm font-medium whitespace-nowrap tabular-nums">{formatCurrency(n)}</span> : <MutedDash />;

const moneyExport = (value: unknown) => {
  const n = money(value);
  return n && n > 0 ? formatCurrency(n) : "";
};

/**
 * O valor de UM veículo, só para o `title` do valor do contrato.
 *
 * A célula mostra o contrato porque é o número que o cliente assinou e o que a
 * fatura conjunta cobra; a fatia fica no hover, que é onde alguém a procura
 * quando precisa conferir a proposta veículo a veículo.
 */
const perVehicleHint = (quote: Budget, total: number | null): string | undefined => {
  const n = quoteVehiclesLoadedCount(quote);
  if (!total || n <= 1) return undefined;
  return `${formatCurrency(Math.round((total / n) * 100) / 100)} por veículo — ${n} veículos`;
};

/**
 * Data agregada: o `title` diz que o número é um resumo dos N veículos.
 *
 * Sem ele a coluna afirma um prazo único num orçamento cujos quatro caminhões
 * têm quatro prazos — e quem lê não tem como saber que está vendo o mais cedo.
 */
const renderEarliestDate = (quote: Budget, field: "term" | "forecastDate" | "entryDate") => {
  const date = earliestTaskDate(quote, field);
  if (!date) return <MutedDash />;
  const filled = taskDateSpread(quote, field);
  if (filled <= 1) return renderDateCell(date);
  return <span title={`o mais cedo de ${filled} veículos`}>{renderDateCell(date)}</span>;
};

export function createBudgetColumns(): DataTableColumnDef<Budget>[] {
  return [
    {
      // The number people quote at each other on the phone — the fastest way to find a budget.
      // Agora é a CHAVE NATURAL da linha: uma linha, um número, sem repetição
      // para explicar (foi por isso que a marca "N veíc." saiu daqui — a coluna
      // "Veículos" continua dizendo quantos são, como informação e não como
      // desculpa).
      id: "budgetNumber",
      header: "Nº Orçamento",
      accessorFn: (q) => q.budgetNumber ?? null,
      enableSorting: true,
      size: 120,
      minSize: 90,
      meta: {
        align: "right",
        headerLabel: "Nº Orçamento",
        exportHeader: "Nº Orçamento",
        exportValue: (q) => q.budgetNumber ?? "",
      },
      cell: ({ getValue }) => {
        const n = getValue() as number | null;
        if (!n) return <MutedDash />;
        return <span className="text-sm font-medium tabular-nums whitespace-nowrap">{n}</span>;
      },
    },
    {
      id: "name",
      header: "Logomarca",
      accessorFn: (q) => quoteNameLabel(q) ?? "",
      // ❌ PERDE a ordenação: `name` é campo da TAREFA, e o Prisma não ordena o
      // pai por campo de relação de LISTA. Mantê-la em BUDGET_SORT_FIELD_MAP
      // desenharia a seta no cabeçalho para uma ordem que o servidor descarta em
      // silêncio (o `orderBy` do `/budgets` não é `.strict()`).
      enableSorting: false,
      size: 240,
      minSize: 160,
      meta: { headerLabel: "Logomarca", exportHeader: "Logomarca", exportValue: (q) => quoteNames(q).join(", ") },
      cell: ({ row }) => {
        const label = quoteNameLabel(row.original);
        if (!label) return <MutedDash />;
        return <TruncatedTextWithTooltip text={label} className="text-sm font-medium" />;
      },
    },
    {
      id: "identificador",
      header: "Identificador",
      accessorFn: (q) => quoteIdentifierLabel(q) ?? "",
      enableSorting: false,
      size: 160,
      minSize: 110,
      meta: {
        headerLabel: "Identificador",
        exportHeader: "Identificador",
        // A planilha não tem hover: sai a lista INTEIRA, sem contração.
        exportValue: (q) => quoteIdentifiers(q).join(", "),
      },
      // ⚠️ UMA LINHA, ALTURA FIXA. As séries de um orçamento multiveículo NÃO
      // viram uma etiqueta por veículo empilhada na célula: a linha da tabela
      // passaria a ter altura variável (um orçamento de sessenta caminhões
      // esticaria a linha para fora da tela) e a lista deixaria de ser
      // varrível. A contração é `contractedLabel` — "90201, 90202 +1" —, a
      // mesma forma do nº do pedido, e o conjunto INTEIRO fica no hover.
      cell: ({ row }) => {
        const all = quoteIdentifiers(row.original);
        if (all.length === 0) return <MutedDash />;
        return (
          <span
            className="text-sm truncate whitespace-nowrap"
            // O título cobre QUALQUER veículo escondido, e não só o "+N": com
            // dois identificadores longos a própria célula corta por largura, e
            // o `> 2` de antes deixava essa linha sem tooltip nenhum.
            title={all.length > 1 ? all.join(", ") : undefined}
          >
            {quoteIdentifierLabel(row.original)}
          </span>
        );
      },
    },
    {
      // QUANTOS VEÍCULOS este orçamento cobre.
      //
      // Deixou de ser a explicação de um defeito (por que o número 984 aparece
      // quatro vezes) e passou a ser informação sobre a linha: o tamanho do
      // contrato. É a única coluna que GANHA com a migração.
      id: "vehicleCount",
      header: "Veículos",
      // ⚠️ Lê `tasks.length`, NUNCA `quoteVehicleCount`: existem orçamentos sem
      // tarefa nenhuma, e o desnormalizado devolve 1 para eles (default da
      // coluna no Prisma). A célula anunciaria "1 veículo" para um orçamento que
      // não tem nenhum. Ver `quoteVehiclesLoadedCount`.
      accessorFn: (q) => quoteVehiclesLoadedCount(q),
      // ✚ GANHA ordenação: `vehicleCount` é escalar do próprio Budget, e
      // ordenar por ele agora responde a uma pergunta sobre a LINHA ("os
      // contratos maiores primeiro") em vez de agrupar veículos.
      enableSorting: true,
      size: 100,
      minSize: 80,
      meta: {
        align: "center",
        headerLabel: "Veículos",
        exportHeader: "Veículos no orçamento",
        exportValue: (q) => quoteVehiclesLoadedCount(q),
      },
      cell: ({ row }) => {
        const n = quoteVehiclesLoadedCount(row.original);
        if (n === 0) return <span className="text-muted-foreground text-xs">sem veículo</span>;
        return n > 1 ? (
          <Badge variant="secondary" className="tabular-nums">
            {n}
          </Badge>
        ) : (
          <MutedDash />
        );
      },
    },
    {
      // The tasks' OWN customer — who the work is for. Often the same as the invoice-to customer,
      // but not always, which is exactly why both are available.
      id: "customer",
      header: "Cliente",
      accessorFn: (q) => quoteCustomerLabel(q) ?? "",
      // ❌ PERDE a ordenação pelo mesmo motivo de "Logomarca": o cliente é da
      // TAREFA, e são N por linha.
      enableSorting: false,
      size: 240,
      minSize: 150,
      meta: {
        defaultVisible: false,
        headerLabel: "Cliente",
        exportHeader: "Cliente",
        exportValue: (q) => quoteCustomerNames(q).join(", "),
      },
      cell: ({ row }) => {
        const names = quoteCustomerNames(row.original);
        if (names.length === 0) return <MutedDash />;
        return (
          <span title={names.length > 1 ? names.join(", ") : undefined}>
            <TruncatedTextWithTooltip text={quoteCustomerLabel(row.original) ?? ""} className="text-sm" />
          </span>
        );
      },
    },
    {
      id: "invoiceToCustomers",
      header: "Clientes",
      // No scalar to order by (it lives across customerConfigs → customer), so this column
      // is display + export only, exactly as in the table it replaces.
      enableSorting: false,
      size: 320,
      minSize: 180,
      meta: { headerLabel: "Clientes", exportHeader: "Clientes", exportValue: (q) => quoteInvoiceToCustomerNames(q) },
      cell: ({ row }) => <QuoteInvoiceToCustomersCell quote={row.original} />,
    },
    {
      // The field `task-quote.ibipora-missing-order-number` is about. Off by default here because
      // the pedido is a faturamento concern; Faturamento shows it by default.
      id: "orderNumber",
      header: "N° do Pedido",
      accessorFn: (q) => quoteOrderNumberLabel(q) ?? "",
      enableSorting: false,
      size: 140,
      minSize: 110,
      meta: {
        defaultVisible: false,
        headerLabel: "N° do Pedido",
        exportHeader: "N° do Pedido",
        exportValue: (q) => quoteOrderNumbers(q),
      },
      cell: ({ row }) => <QuoteOrderNumbersCell quote={row.original} />,
    },
    {
      id: "forecastDate",
      header: "Previsão",
      accessorFn: (q) => earliestTaskDate(q, "forecastDate"),
      enableSorting: false,
      size: 130,
      minSize: 110,
      meta: { headerLabel: "Previsão", exportHeader: "Previsão", exportValue: (q) => dateExportValue(earliestTaskDate(q, "forecastDate")) },
      cell: ({ row }) => renderEarliestDate(row.original, "forecastDate"),
    },
    {
      id: "term",
      header: "Prazo",
      accessorFn: (q) => earliestTaskDate(q, "term"),
      // ❌ PERDE a ordenação — e era o critério SECUNDÁRIO do sort padrão. Ver
      // BUDGET_DEFAULT_SORTING, que passou a usar `expiresAt` no lugar.
      enableSorting: false,
      size: 130,
      minSize: 110,
      meta: { headerLabel: "Prazo", exportHeader: "Prazo", exportValue: (q) => dateExportValue(earliestTaskDate(q, "term")) },
      cell: ({ row }) => renderEarliestDate(row.original, "term"),
    },
    {
      // The date the proposal stops being valid — the thing an Orçamento list is actually racing.
      // A rule used to blink off this field; it was removed for matching 147 rows, 74 of them
      // expired by more than 90 days. Reading the column is how you see this now.
      //
      // ✅ GANHA ordenação de verdade: é escalar do orçamento, não mais um salto
      // por relação a partir da tarefa.
      id: "expiresAt",
      header: "Validade",
      accessorFn: (q) => q.expiresAt ?? null,
      enableSorting: true,
      size: 130,
      minSize: 110,
      meta: { headerLabel: "Validade", exportHeader: "Validade", exportValue: (q) => dateExportValue(q.expiresAt) },
      cell: ({ getValue }) => renderDateCell(getValue() as Date | null),
    },
    {
      id: "entryDate",
      header: "Entrada",
      accessorFn: (q) => earliestTaskDate(q, "entryDate"),
      enableSorting: false,
      size: 130,
      minSize: 110,
      meta: {
        defaultVisible: false,
        headerLabel: "Entrada",
        exportHeader: "Entrada",
        exportValue: (q) => dateExportValue(earliestTaskDate(q, "entryDate")),
      },
      cell: ({ row }) => renderEarliestDate(row.original, "entryDate"),
    },
    {
      id: "taskStatus",
      header: "Status da Tarefa",
      // O de MENOR `statusOrder` entre os veículos — ver `quoteTaskStatus`.
      accessorFn: (q) => quoteTaskStatus(q)?.status ?? null,
      // ❌ PERDE a ordenação: o `statusOrder` é da tarefa, e são N por linha.
      enableSorting: false,
      size: 170,
      minSize: 130,
      meta: {
        defaultVisible: false,
        headerLabel: "Status da Tarefa",
        exportHeader: "Status da Tarefa",
        exportValue: (q) => {
          const s = quoteTaskStatus(q)?.status;
          return s ? (TASK_STATUS_LABELS[s as TASK_STATUS] ?? s) : "";
        },
      },
      cell: ({ row }) => {
        const resolved = quoteTaskStatus(row.original);
        if (!resolved) return <MutedDash />;
        const label = TASK_STATUS_LABELS[resolved.status as TASK_STATUS] ?? resolved.status;
        return (
          <span
            className="inline-flex items-center gap-1"
            // O badge é o estado do veículo MAIS ATRASADO. Com estados
            // divergentes, dizer só ele afirmaria que os N estão assim.
            title={resolved.distinct > 1 ? `${resolved.distinct} estados diferentes entre os veículos` : undefined}
          >
            <Badge variant={getBadgeVariant(resolved.status, "TASK")}>{label}</Badge>
            {resolved.distinct > 1 && <span className="text-muted-foreground text-xs">+{resolved.distinct - 1}</span>}
          </span>
        );
      },
    },
    {
      // O SUBTOTAL DO CONTRATO. Era `subtotal ÷ N`, porque a linha era um
      // veículo; com a linha valendo o orçamento, dividir inventaria um número
      // que não está em documento nenhum.
      id: "quoteSubtotal",
      header: "Subtotal",
      accessorFn: (q) => money(q.subtotal),
      enableSorting: true,
      size: 140,
      minSize: 110,
      meta: {
        defaultVisible: false,
        align: "right",
        requiredPrivilege: MONEY_PRIVILEGES,
        headerLabel: "Subtotal",
        exportHeader: "Subtotal",
        exportValue: (q) => moneyExport(q.subtotal),
      },
      cell: ({ getValue, row }) => {
        const value = getValue() as number | null;
        const hint = perVehicleHint(row.original, value);
        return hint ? <span title={hint}>{moneyCell(value)}</span> : moneyCell(value);
      },
    },
    {
      id: "quoteTotal",
      header: "Valor",
      // O VALOR DO CONTRATO — o número que o cliente assinou.
      //
      // Coerce defensively: the API maps Decimal → number, but a raw string must not break the cell.
      //
      // ✅ Isto também conserta o filtro "Faixa de Valor", que sempre filtrou
      // `quote.total` (o contrato) enquanto a coluna mostrava a fatia: buscar
      // "até R$ 100.000" escondia um orçamento cuja célula dizia R$ 12.170.
      accessorFn: (q) => money(q.total),
      enableSorting: true,
      size: 140,
      minSize: 110,
      meta: {
        align: "right",
        // The page itself is already money-gated, but the gate must live on the COLUMN too: it is
        // what keeps the value out of the column picker and out of the XLSX/PDF export.
        requiredPrivilege: MONEY_PRIVILEGES,
        headerLabel: "Valor",
        exportHeader: "Valor",
        exportValue: (q) => moneyExport(q.total),
      },
      cell: ({ getValue, row }) => {
        const value = getValue() as number | null;
        const hint = perVehicleHint(row.original, value);
        return hint ? <span title={hint}>{moneyCell(value)}</span> : moneyCell(value);
      },
    },
    {
      id: "guaranteeYears",
      header: "Garantia",
      accessorFn: (q) => q.guaranteeYears ?? null,
      enableSorting: false,
      size: 110,
      minSize: 90,
      meta: {
        defaultVisible: false,
        align: "center",
        headerLabel: "Garantia",
        exportHeader: "Garantia (anos)",
        exportValue: (q) => q.guaranteeYears ?? "",
      },
      cell: ({ getValue }) => {
        const y = getValue() as number | null;
        return y ? <span className="text-sm tabular-nums">{y === 1 ? "1 ano" : `${y} anos`}</span> : <MutedDash />;
      },
    },
    {
      id: "quoteStatus",
      header: "Status",
      // Renders the status, sorts by its numeric `statusOrder` mirror (see BUDGET_SORT_FIELD_MAP).
      accessorFn: (q) => q.statusOrder ?? null,
      enableSorting: true,
      size: 170,
      minSize: 130,
      meta: {
        headerLabel: "Status",
        exportHeader: "Status",
        exportValue: (q) => QUOTE_STATUS_EXPORT[q.status as TASK_QUOTE_STATUS] ?? "",
      },
      cell: ({ row }) => {
        const status = row.original.status;
        // O escopo da lista é `BUDGET_QUOTE_STATUSES`, e a guarda tem de ser ELE — não uma cópia.
        // Enquanto era a dupla literal ["PENDING", "BUDGET_APPROVED"], todo orçamento ASSINADO ou
        // AGUARDANDO REANÁLISE caía no traço: o filtro sabia dos quatro estados, a coluna sabia de
        // dois, e a tela dizia "-" para o estado que o comercial mais precisa ver.
        // Traço só sobra para o que não é estado de orçamento nenhum (um payload antigo com
        // `BUDGET_APPROVED`, por exemplo): desenhar um badge sem rótulo é pior que a ausência.
        if (!status || !BUDGET_QUOTE_STATUSES.includes(status as TASK_QUOTE_STATUS)) return <MutedDash />;
        return <QuoteStatusBadge status={status as TASK_QUOTE_STATUS} size="sm" />;
      },
    },
    {
      // ⚠️ MUDOU DE SIGNIFICADO: é quando o ORÇAMENTO foi emitido, não quando a
      // tarefa nasceu. É a leitura certa para esta tela — o orçamento é o que a
      // linha representa —, mas uma planilha antiga comparada com uma nova vai
      // mostrar datas diferentes na mesma coluna, e o motivo é este.
      id: "createdAt",
      header: "Criado em",
      accessorFn: (q) => q.createdAt ?? null,
      enableSorting: true,
      size: 130,
      minSize: 110,
      meta: { defaultVisible: false, headerLabel: "Criado em", exportHeader: "Criado em", exportValue: (q) => dateExportValue(q.createdAt) },
      cell: ({ getValue }) => renderDateCell(getValue() as Date | null),
    },
  ];
}

/**
 * OS OITO ESTADOS DO ORÇAMENTO, na ordem de ATENÇÃO.
 *
 * Eram cinco até 20/09/2026, quando o portal do responsável acrescentou
 * `REQUESTED` (a requisição que o cliente abre), `IN_NEGOTIATION` (com o
 * vendedor do cliente) e `PRE_APPROVED` (ele aprovou; falta lançar as
 * assinaturas). `PENDING` continua sendo o mesmo VALOR e passou a se chamar
 * "Aguardando Assinatura".
 *
 * ⚠️ ESTA LISTA É TRÊS COISAS AO MESMO TEMPO: as opções do filtro, o
 * `where.status = { in: … }` PADRÃO da lista, e o guard da célula. Um estado
 * que não esteja aqui NÃO APARECE NA TELA de jeito nenhum — não some do
 * filtro, some da tabela.
 *
 * Mora AQUI, e não no arquivo de filtros, porque a coluna também precisa dela e
 * `budget-table-filters` já importa deste módulo — o caminho inverso seria um
 * ciclo.
 */
export const BUDGET_QUOTE_STATUSES: TASK_QUOTE_STATUS[] = [
  // ⚠️ Na ORDEM DE ATENÇÃO (`TASK_QUOTE_STATUS_ORDER`), não alfabética: esta lista
  // também desenha o seletor de filtro, e o operador lê o seletor na mesma ordem
  // em que lê a tabela.
  //
  // ⚠️ Status que NÃO estiver aqui não aparece na tela de jeito nenhum — a lista é
  // ao mesmo tempo as opções do filtro, o `where.status = { in: … }` PADRÃO e o
  // guard da célula.
  "REQUESTED",
  "EXPIRED",
  "PRE_APPROVED",
  "SIGNED",
  "IN_NEGOTIATION",
  "PENDING",
  "APPROVED",
  "CANCELLED",
] as TASK_QUOTE_STATUS[];

/**
 * Rótulos em texto puro para a exportação (a célula desenha um badge).
 *
 * Derivado do mapa canônico em vez de reescrito à mão: a versão anterior listava só dois estados,
 * então a planilha saía com a coluna Status EM BRANCO exatamente nas linhas assinadas — o mesmo
 * defeito da célula, num lugar em que ninguém olha até precisar.
 */
const QUOTE_STATUS_EXPORT: Partial<Record<TASK_QUOTE_STATUS, string>> = Object.fromEntries(
  BUDGET_QUOTE_STATUSES.map((s) => [s, TASK_QUOTE_STATUS_LABELS[s]]),
) as Partial<Record<TASK_QUOTE_STATUS, string>>;

/**
 * column id → API `orderBy` entry. Ids absent here are not server-sortable.
 *
 * ⚠️ TODO ALVO AQUI TEM DE ESTAR DECLARADO no `taskQuoteOrderBySchema` do
 * servidor, que — ao contrário do `where` — NÃO é `.strict()`: uma chave não
 * declarada é APAGADA em silêncio. A coluna pareceria ordenável, a seta apareceria
 * no cabeçalho, o servidor devolveria a ordem anterior e nenhum erro seria
 * emitido. É o modo de falha mais caro dos três, e é por isso que os sete alvos
 * que a migração perdeu (`name`, `identificador`, `customer`, `forecastDate`,
 * `term`, `entryDate`, `taskStatus`) foram REMOVIDOS daqui em vez de deixados
 * apontando para campos da tarefa: o Prisma não ordena o pai por campo de relação
 * de LISTA, e não há resposta certa a inventar (qual dos sessenta prazos ordena a
 * linha?).
 */
export const BUDGET_SORT_FIELD_MAP: Record<string, (dir: "asc" | "desc") => Record<string, unknown>> = {
  budgetNumber: (d) => ({ budgetNumber: d }),
  vehicleCount: (d) => ({ vehicleCount: d }),
  expiresAt: (d) => ({ expiresAt: d }),
  quoteSubtotal: (d) => ({ subtotal: d }),
  quoteTotal: (d) => ({ total: d }),
  quoteStatus: (d) => ({ statusOrder: d }),
  createdAt: (d) => ({ createdAt: d }),
};

/**
 * A FILA — "primeiro os mais antigos pendentes, depois os mais novos aprovados".
 *
 * As duas metades correm em DIREÇÕES OPOSTAS, e é isso que nenhuma ordenação de
 * colunas com direção fixa consegue dizer. Um pendente antigo é uma proposta
 * esquecida: o mais velho é o mais urgente. Um aprovado é trabalho resolvido: o
 * que interessa é o que acabou de entrar.
 *
 * Quem carrega a inversão é `queueRank`, coluna GERADA pelo banco (migração
 * `20260917210000_fila_do_orcamento`): o instante de criação em segundos, negado
 * para APPROVED e CANCELLED. Por isso as duas chaves saem daqui `asc`.
 *
 * ⚠️ `queueRank` NÃO É COLUNA DA TABELA, e é de propósito. O estado de ordenação
 * do TanStack desenha setas nos cabeçalhos; uma seta em "Criado em" apontando
 * para cima seria MENTIRA na metade aprovada, que vem do mais novo. O padrão
 * declara só o status — que é verdade — e o desempate viaja invisível, sem
 * cabeçalho que o contradiga.
 */
export const BUDGET_DEFAULT_SORTING: { id: string; desc: boolean }[] = [{ id: "quoteStatus", desc: false }];

/**
 * ⚠️ O desempate é acrescentado SEMPRE, inclusive sobre uma ordenação escolhida
 * pelo usuário — e não só por causa da fila. Sem uma última chave única e
 * estável, duas linhas de mesmo valor (dois orçamentos do mesmo dia, dois com o
 * mesmo total) trocam de lugar entre uma página e outra, e a paginação passa a
 * repetir uma linha na página 2 e sumir com outra. `queueRank` é derivado de
 * `createdAt`, que é praticamente único aqui.
 *
 * Quem ordena explicitamente por "Criado em" já recebe o desempate redundante —
 * inofensivo, porque nesse caso ele concorda com a chave anterior.
 */
export function buildBudgetOrderBy(sorting: { id: string; desc: boolean }[]): Record<string, unknown> | Record<string, unknown>[] {
  const entries = sorting
    .map((s) => BUDGET_SORT_FIELD_MAP[s.id]?.(s.desc ? "desc" : "asc"))
    .filter((e): e is Record<string, unknown> => !!e);
  if (entries.length === 0) return [{ statusOrder: "asc" }, { queueRank: "asc" }];
  return [...entries, { queueRank: "asc" }];
}

