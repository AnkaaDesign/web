import type { DataTableColumnDef } from "@/components/ui/datatable";
import type { Task } from "@/types";
import type { Billing, BILLING_STATUS } from "@/types/task-quote";
import { BillingStatusBadge } from "@/components/financial/billing/billing-status-badge";
import { Badge } from "@/components/ui/badge";
import { TruncatedTextWithTooltip } from "@/components/ui/truncated-text-with-tooltip";
import { BILLING_STATUS_LABELS } from "@/constants";
import { MONEY_PRIVILEGES } from "@/utils/privilege";
import { formatCurrency } from "@/utils";
import { coverageLabels, coverageSummary, orderNumbersOfTasks, quoteVehicleCount } from "@/utils/quote-tasks";
import {
  InvoiceToCustomersCell,
  MutedDash,
  PaymentMethodCell,
  billingChargedSubtotal,
  billingChargedTotal,
  billingCoveredVehicles,
  dateExportValue,
  installmentProgress,
  invoiceToCustomerNames,
  paymentMethodLabels,
  renderDateCell,
} from "@/components/financial/shared/quote-table-shared";

// ═══════════════════════════════════════════════════════════════════════════
// A LINHA É UMA COBRANÇA (`Billing`), NÃO UM VEÍCULO
//
// Era uma TAREFA, e um orçamento `JOINT` de quatro caminhões ocupava QUATRO
// linhas com o mesmo número 984, o rodapé dizia "4 resultado(s)" e o pager do
// detalhe dizia "1 / 4" — quatro linhas para UMA cobrança, que é uma coisa só:
// uma fatura, um plano de parcelas, uma NFS-e. Com `PER_TASK` as quatro linhas
// são corretas, porque ali são quatro cobranças.
//
// O que isso muda nas colunas, em uma frase cada:
//
//   · as que perguntavam ao registro da linha (logomarca, identificador,
//     cliente, finalizado em, nº do pedido) passam a AGREGAR os veículos
//     COBERTOS pela cobrança;
//   · as do dinheiro passam a somar os PAGADORES da cobrança, e some a divisão
//     `quote.total ÷ N` — com ela, o sufixo "/veíc." e o tooltip do total geral;
//   · as do estado (status, faturado em, criado em) passam a ser ESCALARES da
//     própria linha, e com isso a ordenação delas fica trivial no servidor.
// ═══════════════════════════════════════════════════════════════════════════

type CoveredTask = Task & { customerOrderNumber?: string | null };

/** Os veículos que ESTA cobrança cobre, na ordem da cobertura. */
const coveredTasks = (billing: Billing): CoveredTask[] =>
  ((billing.tasks ?? []).map((row) => row.task).filter(Boolean) as CoveredTask[]);

/** Rótulos distintos, sem brancos, na ordem em que aparecem. */
const distinct = (values: Array<string | null | undefined>): string[] => {
  const seen = new Set<string>();
  for (const value of values) {
    const v = (value ?? "").trim();
    if (v) seen.add(v);
  }
  return [...seen];
};

/** "a, b +N" — a lista inteira fica no `title` e no export. */
const overflowLabel = (values: string[]): string => {
  if (values.length <= 2) return values.join(", ");
  return `${values.slice(0, 2).join(", ")} +${values.length - 2}`;
};

/**
 * QUANDO ESTA COBRANÇA FICOU PRONTA: o MAIOR `finishedAt` da cobertura, e `null`
 * enquanto qualquer veículo estiver aberto.
 *
 * "A cobrança está pronta quando o ÚLTIMO veículo sai" — cobrar um lote de vinte
 * com dezenove prontos é cobrar trabalho que ainda não foi entregue. É o mesmo
 * critério do `deliveredOnly` do servidor (`none: { task: { finishedAt: null } }`),
 * e os dois TÊM de concordar: se a coluna mostrasse a data do primeiro, o filtro
 * "Período de Finalização" traria linhas exibindo uma data fora da faixa pedida.
 */
function billingFinishedAt(billing: Billing): Date | null {
  const tasks = coveredTasks(billing);
  if (tasks.length === 0) return null;
  let latest: Date | null = null;
  for (const task of tasks) {
    if (!task.finishedAt) return null;
    const date = new Date(task.finishedAt as unknown as string);
    if (Number.isNaN(date.getTime())) return null;
    if (!latest || date.getTime() > latest.getTime()) latest = date;
  }
  return latest;
}

/**
 * O VENCIMENTO QUE INTERESSA: a parcela EM ABERTO mais antiga desta cobrança. Sem nenhuma em
 * aberto, a última — a data em que ela terminou de ser paga.
 *
 * ⚠️ Era "a parcela nº 1, qualquer que fosse o estado dela", com a justificativa de que assim toda
 * linha mostra uma data. Mostrava — a errada. Caso real, orçamento 903 (KI Distribuidora): parcela
 * 1 vence 27/08 e está PAGA, parcela 2 vence 16/09 e está VENCIDA. A linha vinha marcada "Vencido"
 * e exibia 27/08, uma data que ninguém deve, ao lado de um selo dizendo que se deve.
 *
 * ✅ SEM O RECORTE. A versão anterior tinha de filtrar os pagadores do ORÇAMENTO inteiro por
 * `billingEntry.billingId` para achar os desta linha — senão as sessenta linhas de veículo de um
 * `PER_TASK` mostravam o mesmo vencimento. `billing.customerConfigs` JÁ É o recorte, e metade
 * complicada da função some.
 */
export const findFirstInstallmentDueDate = (billing: Billing): Date | null => {
  const configs = billing.customerConfigs ?? [];
  if (configs.length === 0) return null;

  let emAberto: Date | null = null;
  let ultima: Date | null = null;
  for (const config of configs) {
    for (const installment of config.installments || []) {
      const due = installment.dueDate ? new Date(installment.dueDate as unknown as string) : null;
      if (!due || Number.isNaN(due.getTime())) continue;
      if (!ultima || due.getTime() > ultima.getTime()) ultima = due;
      // Cancelada não se deve; paga já se pagou. Nenhuma das duas é "vencimento".
      const st = (installment as { status?: string }).status;
      if (st === "PAID" || st === "CANCELLED") continue;
      if (!emAberto || due.getTime() < emAberto.getTime()) emAberto = due;
    }
  }
  return emAberto ?? ultima;
};

const moneyCell = (n: number | null) =>
  n ? <span className="text-sm font-medium whitespace-nowrap tabular-nums">{formatCurrency(n)}</span> : <MutedDash />;

const moneyExport = (n: number | null) => (n && n > 0 ? formatCurrency(n) : "");

/**
 * O NÚMERO DO PEDIDO, E O QUE FALTA DELE.
 *
 * ⚠️ A ausência é o BLOQUEIO, não um detalhe: sem o pedido a nota não sai
 * (`task-quote.ibipora-missing-order-number`). Numa cobrança conjunta de quatro
 * veículos, faltar em UM já trava a nota dos quatro — por isso a célula anuncia
 * "3 de 4" em vez de mostrar os três que existem e calar sobre o quarto.
 */
function BillingOrderNumbersCell({ billing }: { billing: Billing }) {
  const tasks = coveredTasks(billing);
  const numbers = orderNumbersOfTasks(tasks);
  const withNumber = tasks.filter((t) => (t.customerOrderNumber ?? "").trim()).length;
  const incomplete = tasks.length > 0 && withNumber < tasks.length;

  if (numbers.length === 0) return <MutedDash />;
  return (
    <span className="inline-flex items-center gap-1 min-w-0" title={numbers.join(", ")}>
      <TruncatedTextWithTooltip text={numbers.join(", ")} className="text-sm tabular-nums" />
      {incomplete && (
        <span className="text-muted-foreground text-xs shrink-0 tabular-nums" title="Veículos com nº do pedido">
          {withNumber} de {tasks.length}
        </span>
      )}
    </span>
  );
}

/**
 * Columns for the Faturamento list. Ids are dot-free (they become `--col-<id>-size` and the
 * persistence key); the server sort keys live in BILLING_SORT_FIELD_MAP.
 *
 * ⚠️ TRÊS IDS FORAM RENOMEADOS porque o SENTIDO deles mudou: `vehicleCount` →
 * `coveredVehicles` (era "veículos do contrato", agora é "veículos que esta
 * cobrança cobra"), `quoteTotal` → `billingTotal` e `quoteSubtotal` →
 * `billingSubtotal` (eram a fatia de um veículo, agora são o que a cobrança
 * cobra), `createdAt` → `billingCreatedAt` (era quando a tarefa entrou, agora é
 * quando ESTA fatia nasceu). Herdar a preferência de coluna salva sob o id antigo
 * seria mostrar a escolha do usuário com um significado que não é o dela.
 */
export function createBillingColumns(): DataTableColumnDef<Billing>[] {
  return [
    {
      // The number people quote at each other on the phone — the fastest way to find a faturamento.
      id: "budgetNumber",
      header: "Nº Orçamento",
      accessorFn: (b) => b.quote?.budgetNumber ?? null,
      // Ordenável: `quote` é relação de-UM, e o Prisma ordena por ela.
      enableSorting: true,
      size: 120,
      minSize: 90,
      meta: { align: "right", headerLabel: "Nº Orçamento", exportHeader: "Nº Orçamento", exportValue: (b) => b.quote?.budgetNumber ?? "" },
      cell: ({ getValue }) => {
        const n = getValue() as number | null;
        return n ? <span className="text-sm font-medium tabular-nums">{n}</span> : <MutedDash />;
      },
    },
    {
      // A logomarca dos veículos COBERTOS, deduplicada. No caso normal é um nome
      // só (a mesma arte nos N caminhões); divergindo, "a, b +N".
      id: "name",
      header: "Logomarca",
      accessorFn: (b) => distinct(coveredTasks(b).map((t) => t.name)).join(", "),
      // Vem de `BillingTask` — relação de-MUITOS. O Prisma não ordena por isso, e
      // um `orderBy` que a rota não conhece é 400 (ver BILLING_SORT_FIELD_MAP).
      enableSorting: false,
      size: 220,
      minSize: 160,
      meta: {
        headerLabel: "Logomarca",
        exportHeader: "Logomarca",
        exportValue: (b) => distinct(coveredTasks(b).map((t) => t.name)).join(", "),
      },
      cell: ({ row }) => {
        const names = distinct(coveredTasks(row.original).map((t) => t.name));
        if (names.length === 0) return <MutedDash />;
        return <TruncatedTextWithTooltip text={overflowLabel(names)} className="text-sm font-medium" />;
      },
    },
    {
      // QUAIS VEÍCULOS esta cobrança cobre — a coluna que responde a pergunta do
      // dono na hora. Um `JOINT` que cobre todos lê "Todos os 4 veículos"; um
      // recorte parcial lê "78000, 78001 +2". É o mesmo rótulo que o compositor
      // de faturamento e o detalhe desenham, pelo mesmo helper.
      id: "identificador",
      header: "Identificador",
      accessorFn: (b) => coverageSummary(b, quoteVehicleCount(b.quote)),
      enableSorting: false,
      size: 180,
      minSize: 120,
      meta: {
        headerLabel: "Identificador",
        exportHeader: "Identificador",
        // O export leva a LISTA INTEIRA, nunca o "+N" da tela: uma planilha em que
        // duas das quatro séries foram substituídas por "+2" não é conferível.
        exportValue: (b) => coverageLabels(b).join(", "),
      },
      cell: ({ getValue, row }) => {
        const value = getValue() as string;
        if (!value) return <MutedDash />;
        // O tooltip traz a cobertura INTEIRA: "Todos os 4 veículos" e "78000, 78001 +2"
        // são resumos, e quem confere precisa das séries que eles escondem.
        return <TruncatedTextWithTooltip text={value} className="text-sm" tooltipText={coverageLabels(row.original).join(", ")} />;
      },
    },
    {
      // QUANTOS VEÍCULOS ESTA COBRANÇA COBRA — e não quantos o orçamento tem.
      //
      // ⚠️ MUDOU DE SENTIDO (e por isso de id). A coluna existia para explicar por
      // que sessenta linhas idênticas do Marquespan não eram sessenta orçamentos.
      // Essa repetição acabou: agora o número diz o tamanho do recorte cobrado —
      // 4 na linha do `JOINT`, 1 em cada linha do `PER_TASK`. O total do contrato
      // fica no hover, que é onde ele ainda importa.
      id: "coveredVehicles",
      header: "Veículos",
      accessorFn: (b) => billingCoveredVehicles(b),
      // `BillingTask` é relação de-muitos; contar não é ordenar.
      enableSorting: false,
      size: 100,
      minSize: 80,
      meta: {
        align: "center",
        headerLabel: "Veículos",
        exportHeader: "Veículos cobrados",
        exportValue: (b) => billingCoveredVehicles(b),
      },
      cell: ({ row }) => {
        const billing = row.original;
        const covered = billingCoveredVehicles(billing);
        const contract = quoteVehicleCount(billing.quote);
        if (contract <= 1) return <MutedDash />;
        return (
          <Badge variant="secondary" className="tabular-nums" title={`${covered} de ${contract} veículo(s) do orçamento`}>
            {covered}
          </Badge>
        );
      },
    },
    {
      // O cliente DOS VEÍCULOS cobertos — de quem é o trabalho, que nem sempre é
      // quem paga (essa é a coluna seguinte). Quase sempre um só.
      id: "customer",
      header: "Cliente",
      accessorFn: (b) => distinct(coveredTasks(b).map((t) => t.customer?.corporateName || t.customer?.fantasyName)).join(", "),
      // Relação de-MUITOS, via a cobertura. Sem seta — ver BILLING_SORT_FIELD_MAP.
      enableSorting: false,
      size: 240,
      minSize: 150,
      meta: {
        defaultVisible: false,
        headerLabel: "Cliente",
        exportHeader: "Cliente",
        exportValue: (b) => distinct(coveredTasks(b).map((t) => t.customer?.corporateName || t.customer?.fantasyName)).join(", "),
      },
      cell: ({ row }) => {
        const names = distinct(coveredTasks(row.original).map((t) => t.customer?.corporateName || t.customer?.fantasyName));
        if (names.length === 0) return <MutedDash />;
        return <TruncatedTextWithTooltip text={overflowLabel(names)} className="text-sm" tooltipText={names.join(", ")} />;
      },
    },
    {
      // QUEM PAGA esta cobrança. Ficou mais simples do que era: a célula recortava
      // os pagadores do orçamento pela cobertura do veículo da linha, e a cobrança
      // JÁ É esse recorte. Mais de um nome só no caso real — dois clientes
      // dividindo os serviços do MESMO recorte, que são dois pagadores de UMA
      // cobrança.
      id: "invoiceToCustomers",
      header: "Faturar Para",
      enableSorting: false,
      size: 300,
      minSize: 180,
      meta: {
        headerLabel: "Faturar Para",
        exportHeader: "Faturar Para",
        exportValue: (b) => invoiceToCustomerNames(b.customerConfigs),
      },
      cell: ({ row }) => <InvoiceToCustomersCell configs={row.original.customerConfigs} />,
    },
    {
      // Visível por padrão aqui: sem o pedido a nota não é emitida, então nesta
      // tela a ausência é o próprio bloqueio.
      id: "orderNumber",
      header: "N° do Pedido",
      accessorFn: (b) => orderNumbersOfTasks(coveredTasks(b)).join(", "),
      enableSorting: false,
      size: 150,
      minSize: 110,
      meta: {
        headerLabel: "N° do Pedido",
        exportHeader: "N° do Pedido",
        exportValue: (b) => orderNumbersOfTasks(coveredTasks(b)),
      },
      cell: ({ row }) => <BillingOrderNumbersCell billing={row.original} />,
    },
    {
      id: "finishedAt",
      header: "Finalizado em",
      accessorFn: (b) => billingFinishedAt(b),
      // Vem da cobertura (relação de-muitos) e é um MAX condicional; nem o Prisma
      // ordena por isso, nem a rota aceita a chave.
      enableSorting: false,
      size: 140,
      minSize: 110,
      meta: { headerLabel: "Finalizado em", exportHeader: "Finalizado em", exportValue: (b) => dateExportValue(billingFinishedAt(b)) },
      cell: ({ getValue }) => renderDateCell(getValue() as Date | null),
    },
    {
      id: "billingSubtotal",
      header: "Subtotal",
      accessorFn: (b) => billingChargedSubtotal(b),
      enableSorting: false,
      size: 140,
      minSize: 110,
      meta: {
        defaultVisible: false,
        align: "right",
        requiredPrivilege: MONEY_PRIVILEGES,
        headerLabel: "Subtotal",
        exportHeader: "Subtotal",
        exportValue: (b) => moneyExport(billingChargedSubtotal(b)),
      },
      cell: ({ getValue }) => moneyCell(getValue() as number | null),
    },
    {
      id: "billingTotal",
      header: "Valor",
      // O QUE ESTA COBRANÇA COBRA — `Σ customerConfigs[].total`, já gravado.
      //
      // ⚠️ SOME o "/veíc." e a divisão `quote.total ÷ N`. Aquilo existia porque a
      // linha era um veículo de um contrato: num orçamento de sessenta caminhões a
      // coluna afirmava R$ 730.224,00 sessenta vezes, e a divisão era o remendo. A
      // linha agora é a cobrança, e o valor dela é o que ela cobra — a soma das
      // linhas de um orçamento reconstrói o contrato por construção.
      //
      // ⚠️ SEM SETA, de propósito: `Billing` não tem coluna de valor. Ordenar por
      // `quote.total` ordenaria pelo CONTRATO, o que num `PER_TASK` de sessenta é
      // a MESMA chave para as sessenta linhas — uma seta que não ordena nada.
      accessorFn: (b) => billingChargedTotal(b),
      enableSorting: false,
      size: 140,
      minSize: 110,
      meta: {
        align: "right",
        // The route already admits only money sectors, but the gate belongs on the column: it is
        // what keeps the value out of the column picker and out of the XLSX/PDF export.
        requiredPrivilege: MONEY_PRIVILEGES,
        headerLabel: "Valor",
        exportHeader: "Valor",
        exportValue: (b) => moneyExport(billingChargedTotal(b)),
      },
      cell: ({ getValue }) => moneyCell(getValue() as number | null),
    },
    {
      // Quantas parcelas desta cobrança já foram pagas. Sem recorte nenhum: os
      // pagadores são os DELA.
      id: "installments",
      header: "Parcelas",
      accessorFn: (b) => installmentProgress(b.customerConfigs).total,
      enableSorting: false,
      size: 110,
      minSize: 90,
      meta: {
        align: "center",
        headerLabel: "Parcelas",
        exportHeader: "Parcelas (pagas/total)",
        exportValue: (b) => {
          const { paid, total } = installmentProgress(b.customerConfigs);
          return total > 0 ? `${paid}/${total}` : "";
        },
      },
      cell: ({ row }) => {
        const { paid, total } = installmentProgress(row.original.customerConfigs);
        if (total === 0) return <MutedDash />;
        const settled = paid === total;
        return (
          <span
            className={`text-sm tabular-nums ${settled ? "font-medium text-primary" : paid > 0 ? "font-medium" : "text-muted-foreground"}`}
            title={`${paid} de ${total} parcela(s) paga(s)`}
          >
            {paid}/{total}
          </span>
        );
      },
    },
    {
      // ⚠️ PERDEU A SETA na migração. A data mora duas relações abaixo
      // (`customerConfigs → installments`) e é escolhida por regra, não lida de
      // uma coluna: em `/tasks` a API a resolvia e ordenava o resultado INTEIRO em
      // memória antes de paginar. `/billings` não tem esse truque, e declarar a
      // chave assim mesmo daria 400 no clique do cabeçalho.
      id: "currentInstallmentDueDate",
      header: "Vencimento",
      accessorFn: (b) => findFirstInstallmentDueDate(b),
      enableSorting: false,
      size: 140,
      minSize: 110,
      meta: {
        headerLabel: "Vencimento",
        exportHeader: "Vencimento",
        exportValue: (b) => dateExportValue(findFirstInstallmentDueDate(b)),
      },
      cell: ({ getValue }) => renderDateCell(getValue() as Date | null),
    },
    {
      id: "billingApprovedAt",
      header: "Faturado em",
      // ESCALAR DA PRÓPRIA LINHA. Era procurado entre os pagadores e caía em
      // `TaskQuote.billingApprovedAt`, que só é gravado quando a ÚLTIMA fatia
      // fecha — cinquenta e nove veículos faturados liam "-". A cobrança carrega
      // a própria data, e por isso a coluna também ORDENA no servidor.
      accessorFn: (b) => b.approvedAt ?? null,
      enableSorting: true,
      size: 140,
      minSize: 110,
      meta: {
        defaultVisible: false,
        headerLabel: "Faturado em",
        exportHeader: "Faturado em",
        exportValue: (b) => dateExportValue(b.approvedAt ?? null),
      },
      cell: ({ getValue }) => renderDateCell(getValue() as Date | string | null),
    },
    {
      // Não há coluna "Status da Tarefa" aqui de propósito: a lista é de
      // COBRANÇAS, e a pergunta sobre entrega ("todos os veículos saíram?") é o
      // filtro "Entrega". O que o financeiro precisa ver de relance é COMO se paga.
      id: "paymentMethod",
      header: "Forma de Pagamento",
      accessorFn: (b) => paymentMethodLabels(b.customerConfigs).join(", "),
      // A forma mora numa coluna JSON (`paymentConfig`); não há escalar para
      // ordenar, nem entrada em BILLING_SORT_FIELD_MAP.
      enableSorting: false,
      size: 180,
      minSize: 140,
      meta: {
        headerLabel: "Forma de Pagamento",
        exportHeader: "Forma de Pagamento",
        exportValue: (b) => paymentMethodLabels(b.customerConfigs).join(", "),
      },
      cell: ({ row }) => <PaymentMethodCell configs={row.original.customerConfigs} />,
    },
    {
      // O ESTADO DA COBRANÇA — agora um ESCALAR DA LINHA (`Billing.status`).
      //
      // Era varrido entre os pagadores do orçamento escolhendo o de menor
      // `statusOrder`, porque a linha era um veículo e o estado ficava a três
      // relações de distância. Com a linha sendo a cobrança, todo esse aparato
      // (`taskBillingStatus`/`billingStatusOf`/`billingStatusOrderOf`) sai — e a
      // ordenação vira `statusOrder`, coluna indexada e padrão da rota.
      id: "billingStatus",
      header: "Status Faturamento",
      accessorFn: (b) => b.status ?? null,
      enableSorting: true,
      size: 190,
      minSize: 140,
      meta: {
        headerLabel: "Status Faturamento",
        exportHeader: "Status Faturamento",
        exportValue: (b) => (b.status ? (BILLING_STATUS_LABELS[b.status] ?? b.status) : ""),
      },
      cell: ({ row }) => {
        const status = row.original.status;
        if (!status) return <MutedDash />;
        const { paid, total } = installmentProgress(row.original.customerConfigs);
        return (
          <BillingStatusBadge
            status={status as BILLING_STATUS}
            size="sm"
            paidCount={total > 0 ? paid : undefined}
            totalCount={total > 0 ? total : undefined}
          />
        );
      },
    },
    {
      // ⚠️ QUANDO ESTA FATIA NASCEU — não quando a tarefa entrou, e por isso o id
      // mudou. Refatiar um orçamento (`JOINT` → `PER_TASK`) APAGA as cobranças e
      // cria outras: a data é do registro atual. Para a idade do trabalho, a
      // coluna honesta é a do orçamento, e ela não está aqui.
      id: "billingCreatedAt",
      header: "Criado em",
      accessorFn: (b) => b.createdAt ?? null,
      enableSorting: true,
      size: 130,
      minSize: 110,
      meta: {
        defaultVisible: false,
        headerLabel: "Criado em",
        exportHeader: "Criado em",
        exportValue: (b) => dateExportValue(b.createdAt ?? null),
      },
      cell: ({ getValue }) => renderDateCell(getValue() as Date | string | null),
    },
  ];
}

/**
 * column id → a CHAVE de ordenação de `GET /billings`.
 *
 * 🔴 TRÊS LUGARES TÊM DE CONCORDAR, ou a tela quebra em silêncio (ou com 400):
 * o `enableSorting` da coluna, este mapa, e o whitelist da rota
 * (`BILLING_ORDER_BY_FIELDS` no serviço). A rota LANÇA 400 para uma chave que não
 * conhece — de propósito, para que um campo inexistente não vire 500 do Prisma —,
 * e a tabela então não renderiza linha nenhuma.
 *
 * ⚠️ Não é mais um objeto de `orderBy` do Prisma: a rota recebe NOMES
 * (`statusOrder`, `createdAt`, `approvedAt`, `budgetNumber`), com a direção colada
 * (`budgetNumber:desc`). Mandar o objeto aninhado que a lista de tarefas mandava
 * seria 400 na primeira renderização.
 *
 * O que NÃO está aqui, e por quê: nome, identificador, cliente e "finalizado em"
 * vêm da cobertura, que é relação de-MUITOS (o Prisma não ordena por ela); o valor
 * é a soma dos pagadores e o `Billing` não tem coluna de valor; o vencimento é
 * chave computada, que só existia na rota de tarefas.
 */
export const BILLING_SORT_FIELD_MAP: Record<string, string> = {
  budgetNumber: "budgetNumber",
  billingApprovedAt: "approvedAt",
  billingStatus: "statusOrder",
  billingCreatedAt: "createdAt",
};

/**
 * Default sort, stated twice on purpose — once as TanStack sorting state (the header arrows at
 * cold mount, when nothing is in the URL) and once as `buildBillingOrderBy([])`. They must agree.
 *
 * ⚠️ ERA `[billingStatus asc, finishedAt desc]`, e `finishedAt` MORREU como chave de
 * ordenação: ele vem da cobertura, relação de-muitos. Deixado como estava, o
 * PRIMEIRO carregamento da lista mandaria uma ordenação que a rota recusa com 400
 * — a tela abriria vazia sem nenhum filtro aplicado. O desempate não se perde: o
 * serviço acrescenta `createdAt desc` e `id` ao fim de toda ordenação, justamente
 * para que duas cobranças empatadas não troquem de posição entre duas páginas.
 */
export const BILLING_DEFAULT_SORTING: { id: string; desc: boolean }[] = [{ id: "billingStatus", desc: false }];

/** Estado de ordenação da tabela → o `orderBy` da rota, como lista de `chave:direção`. */
export function buildBillingOrderBy(sorting: { id: string; desc: boolean }[]): string[] {
  const entries = sorting
    .map((s) => {
      const field = BILLING_SORT_FIELD_MAP[s.id];
      return field ? `${field}:${s.desc ? "desc" : "asc"}` : null;
    })
    .filter((e): e is string => !!e);
  // Uma coluna sem entrada no mapa cai aqui e a lista volta ao padrão, em vez de
  // mandar um nome que a rota recusa — é o que torna um `?sort=` salvo de um id
  // que já não existe inofensivo.
  return entries.length > 0 ? entries : ["statusOrder:asc"];
}
