import type { DataTableColumnDef } from "@/components/ui/datatable";
import type { Task } from "@/types";
import type { BILLING_STATUS } from "@/types/task-quote";
import { BillingStatusBadge } from "@/components/financial/billing/billing-status-badge";
import { Badge } from "@/components/ui/badge";
import { TruncatedTextWithTooltip } from "@/components/ui/truncated-text-with-tooltip";
import { BILLING_STATUS_LABELS } from "@/constants";
import { MONEY_PRIVILEGES } from "@/utils/privilege";
import { formatCurrency } from "@/utils";
import {
  InvoiceToCustomersCell,
  MutedDash,
  OrderNumbersCell,
  PaymentMethodCell,
  dateExportValue,
  installmentProgress,
  invoiceToCustomerNames,
  paymentMethodLabels,
  quoteOrderNumbers,
  renderDateCell,
  taskCustomerName,
  taskIdentifier,
  isMultiVehicleQuote,
  taskBillingApprovedAt,
  taskBillingStatus,
  taskQuoteSubtotal,
  taskQuoteTotal,
  taskQuoteVehicleCount,
} from "@/components/financial/shared/quote-table-shared";

/**
 * Due date of the FIRST installment (parcela nº 1) across all customer configs, regardless of its
 * status — so every task quote shows a vencimento, not only the overdue ones. Falls back
 * to the earliest due date when parcelas aren't numbered from 1.
 *
 * The API mirrors this resolution byte for byte for the `currentInstallmentDueDate` sort key
 * (`task-prisma.repository.ts` → `resolveFirstInstallmentDueDate`); keep both in sync or the
 * rendered date and the sort order disagree.
 */
export const findFirstInstallmentDueDate = (task: Task): Date | null => {
  const configs = task.quote?.customerConfigs;
  if (!configs || configs.length === 0) return null;
  let best: { number: number; due: Date } | null = null;
  for (const config of configs) {
    for (const installment of config.installments || []) {
      const due = installment.dueDate ? new Date(installment.dueDate) : null;
      if (!due) continue;
      const number = installment.number ?? Number.MAX_SAFE_INTEGER;
      if (!best || number < best.number || (number === best.number && due.getTime() < best.due.getTime())) {
        best = { number, due };
      }
    }
  }
  return best?.due ?? null;
};

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
 * Columns for the Faturamento list. Ids are dot-free (they become `--col-<id>-size` and the
 * persistence key); nested sort targets live in BILLING_SORT_FIELD_MAP.
 *
 * Everything the legacy table showed stays visible by default; the columns added on top are
 * `defaultVisible: false` and reachable from "Colunas", except Nº Orçamento, N° do Pedido and
 * Parcelas — the three the financial team asked to have in front of them.
 */
export function createBillingColumns(): DataTableColumnDef<Task>[] {
  return [
    {
      // The number people quote at each other on the phone — the fastest way to find a faturamento.
      id: "budgetNumber",
      header: "Nº Orçamento",
      accessorFn: (t) => t.quote?.budgetNumber ?? null,
      enableSorting: true,
      size: 120,
      minSize: 90,
      meta: { align: "right", headerLabel: "Nº Orçamento", exportHeader: "Nº Orçamento", exportValue: (t) => t.quote?.budgetNumber ?? "" },
      cell: ({ getValue }) => {
        const n = getValue() as number | null;
        return n ? <span className="text-sm font-medium tabular-nums">{n}</span> : <MutedDash />;
      },
    },
    {
      id: "name",
      header: "Logomarca",
      accessorKey: "name",
      enableSorting: true,
      size: 220,
      minSize: 160,
      meta: { headerLabel: "Logomarca", exportHeader: "Logomarca", exportValue: (t) => t.name || "" },
      cell: ({ row }) => <TruncatedTextWithTooltip text={row.original.name} className="text-sm font-medium" />,
    },
    {
      id: "identificador",
      header: "Identificador",
      accessorFn: (t) => taskIdentifier(t),
      enableSorting: true,
      size: 130,
      minSize: 100,
      meta: { headerLabel: "Identificador", exportHeader: "Identificador", exportValue: (t) => taskIdentifier(t) },
      cell: ({ getValue }) => {
        const value = getValue() as string;
        return value ? <span className="text-sm truncate">{value}</span> : <MutedDash />;
      },
    },
    {
      // QUANTOS VEÍCULOS este orçamento cobre.
      //
      // A linha é uma tarefa, e um orçamento multitarefa aparece em N linhas com
      // o mesmo número: sem esta coluna, sessenta linhas idênticas do Marquespan
      // pareciam sessenta orçamentos, e a coluna Valor — que agora mostra o valor
      // de UM veículo — não tinha como se explicar. Visível por padrão apenas
      // onde a decisão de faturar acontece; nas duas tabelas ela sai no export.
      id: "vehicleCount",
      header: "Veículos",
      accessorFn: (t) => taskQuoteVehicleCount(t),
      // O escalar existe (`TaskQuote.vehicleCount`), mas ordenar a lista de
      // TAREFAS por ele agruparia veículos do mesmo orçamento sem dizer nada
      // sobre a linha. Fica como leitura.
      enableSorting: false,
      size: 100,
      minSize: 80,
      meta: {
        align: "center",
        headerLabel: "Veículos",
        exportHeader: "Veículos no orçamento",
        exportValue: (t) => taskQuoteVehicleCount(t),
      },
      cell: ({ row }) => {
        const n = taskQuoteVehicleCount(row.original);
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
      // The task's OWN customer — who the work was for, which is not always who is invoiced.
      id: "customer",
      header: "Cliente",
      accessorFn: (t) => taskCustomerName(t),
      enableSorting: true,
      size: 240,
      minSize: 150,
      meta: { defaultVisible: false, headerLabel: "Cliente", exportHeader: "Cliente", exportValue: (t) => taskCustomerName(t) },
      cell: ({ getValue }) => {
        const v = getValue() as string;
        return v ? <TruncatedTextWithTooltip text={v} className="text-sm" /> : <MutedDash />;
      },
    },
    {
      id: "invoiceToCustomers",
      header: "Faturar Para",
      enableSorting: false,
      size: 300,
      minSize: 180,
      meta: { headerLabel: "Faturar Para", exportHeader: "Faturar Para", exportValue: (t) => invoiceToCustomerNames(t) },
      cell: ({ row }) => <InvoiceToCustomersCell task={row.original} />,
    },
    {
      // Visible by default here: without the pedido the nota cannot be issued, so on Faturamento
      // its absence is the blocker itself (see `task-quote.ibipora-missing-order-number`).
      id: "orderNumber",
      header: "N° do Pedido",
      accessorFn: (t) => quoteOrderNumbers(t).join(", "),
      enableSorting: false,
      size: 140,
      minSize: 110,
      meta: { headerLabel: "N° do Pedido", exportHeader: "N° do Pedido", exportValue: (t) => quoteOrderNumbers(t) },
      cell: ({ row }) => <OrderNumbersCell task={row.original} />,
    },
    {
      id: "finishedAt",
      header: "Finalizado em",
      accessorKey: "finishedAt",
      enableSorting: true,
      size: 140,
      minSize: 110,
      meta: { headerLabel: "Finalizado em", exportHeader: "Finalizado em", exportValue: (t) => dateExportValue(t.finishedAt) },
      cell: ({ row }) => renderDateCell(row.original.finishedAt),
    },
    {
      id: "quoteSubtotal",
      header: "Subtotal",
      accessorFn: (t) => taskQuoteSubtotal(t),
      enableSorting: true,
      size: 140,
      minSize: 110,
      meta: {
        defaultVisible: false,
        align: "right",
        requiredPrivilege: MONEY_PRIVILEGES,
        headerLabel: "Subtotal",
        exportHeader: "Subtotal",
        exportValue: (t) => moneyExport(taskQuoteSubtotal(t)),
      },
      cell: ({ getValue }) => moneyCell(getValue() as number | null),
    },
    {
      id: "quoteTotal",
      header: "Valor",
      // A FATIA DESTE VEÍCULO. `quote.total` é o valor do CONTRATO
      // (`por veículo × N`) e a linha é um veículo: num orçamento de sessenta
      // caminhões a coluna afirmava R$ 730.224,00 sessenta vezes. A soma das
      // fatias reconstrói o contrato, e num orçamento de um veículo — a maioria —
      // o número não muda.
      accessorFn: (t) => taskQuoteTotal(t),
      enableSorting: true,
      size: 140,
      minSize: 110,
      meta: {
        align: "right",
        // The route already admits only money sectors, but the gate belongs on the column: it is
        // what keeps the value out of the column picker and out of the XLSX/PDF export.
        requiredPrivilege: MONEY_PRIVILEGES,
        headerLabel: "Valor",
        exportHeader: "Valor",
        exportValue: (t) => moneyExport(taskQuoteTotal(t)),
      },
      cell: ({ getValue, row }) => {
        const value = getValue() as number | null;
        const task = row.original;
        if (!isMultiVehicleQuote(task)) return moneyCell(value);
        // O valor é o de UM veículo; o contrato inteiro fica no hover, porque é o
        // número que o cliente assinou e o que a fatura conjunta cobra.
        const count = taskQuoteVehicleCount(task);
        const grand = money(task.quote?.total);
        return (
          <span
            className="inline-flex items-center gap-1 justify-end w-full"
            title={grand ? `Total geral ${formatCurrency(grand)} — ${count} veículos` : undefined}
          >
            {moneyCell(value)}
            <span className="text-muted-foreground text-xs shrink-0 tabular-nums">/veíc.</span>
          </span>
        );
      },
    },
    {
      // Collections progress at a glance: how many parcelas are settled out of how many exist,
      // across every customer config on the quote. Not server-sortable (it lives two relations
      // deep and would need the same in-memory pass `currentInstallmentDueDate` uses).
      id: "installments",
      header: "Parcelas",
      accessorFn: (t) => {
        const { total } = installmentProgress(t);
        return total;
      },
      enableSorting: false,
      size: 110,
      minSize: 90,
      meta: {
        align: "center",
        headerLabel: "Parcelas",
        exportHeader: "Parcelas (pagas/total)",
        exportValue: (t) => {
          const { paid, total } = installmentProgress(t);
          return total > 0 ? `${paid}/${total}` : "";
        },
      },
      cell: ({ row }) => {
        const { paid, total } = installmentProgress(row.original);
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
      // Computed key: the due date lives two relations deep, so the API resolves it and sorts the
      // WHOLE result set in memory before paginating. Server mode is therefore mandatory here, and
      // this column deliberately stays out of the default sort (it forces a full scan).
      id: "currentInstallmentDueDate",
      header: "Vencimento",
      accessorFn: (t) => findFirstInstallmentDueDate(t),
      enableSorting: true,
      size: 140,
      minSize: 110,
      meta: {
        headerLabel: "Vencimento",
        exportHeader: "Vencimento",
        exportValue: (t) => dateExportValue(findFirstInstallmentDueDate(t)),
      },
      cell: ({ getValue }) => renderDateCell(getValue() as Date | null),
    },
    {
      id: "billingApprovedAt",
      header: "Faturado em",
      // A aprovação é por FATIA: com `PER_TASK` o caminhão 12 pode estar faturado
      // enquanto o 13 não está, e `TaskQuote.billingApprovedAt` só é gravado
      // quando a última fecha — cinquenta e nove veículos faturados liam "-".
      accessorFn: (t) => taskBillingApprovedAt(t),
      enableSorting: true,
      size: 140,
      minSize: 110,
      meta: {
        defaultVisible: false,
        headerLabel: "Faturado em",
        exportHeader: "Faturado em",
        exportValue: (t) => dateExportValue(taskBillingApprovedAt(t)),
      },
      cell: ({ getValue }) => renderDateCell(getValue() as Date | null),
    },
    {
      // No "Status da Tarefa" column here on purpose: this list is scoped to finished tasks by
      // default (the `taskStatus` FILTER still exists to widen that), so the column would read
      // "Finalizado" on nearly every row. What the financial team actually needs at a glance is
      // HOW the quote gets paid.
      id: "paymentMethod",
      header: "Forma de Pagamento",
      accessorFn: (t) => paymentMethodLabels(t).join(", "),
      // Payment shape lives in a JSON column (`paymentConfig`) on the config, so there is no
      // scalar for the API to order by — hence no entry in BILLING_SORT_FIELD_MAP either.
      enableSorting: false,
      size: 180,
      minSize: 140,
      meta: {
        headerLabel: "Forma de Pagamento",
        exportHeader: "Forma de Pagamento",
        exportValue: (t) => paymentMethodLabels(t).join(", "),
      },
      cell: ({ row }) => <PaymentMethodCell task={row.original} />,
    },
    {
      // O ESTADO DA COBRANÇA — `billing.status`, e não `quote.status`.
      //
      // Lia o orçamento porque o ciclo do pagamento morava lá dentro. Duas consequências, e a
      // segunda é a que matava a coluna: um orçamento com uma fatia liquidada e outra vencida
      // tinha de escolher UM estado para as duas, e depois do encolhimento do enum do orçamento
      // toda linha desta lista leria "Aprovado".
      //
      // ⚠️ É o estado da fatia DESTA LINHA (a que cobre este veículo), não o do orçamento: ver
      // `taskBillingStatus`.
      id: "billingStatus",
      header: "Status Faturamento",
      accessorFn: (t) => taskBillingStatus(t),
      // ORDENÁVEL NO SERVIDOR — pelo caminho curto, não por chave computada.
      //
      // Esta coluna passou um tempo sem ordenação porque o caminho parecia atravessar relação de
      // MUITOS (task → quote → customerConfigs → billing), e `orderBy` do Prisma não atravessa
      // isso. Havia um caminho mais curto e de-UM o tempo todo: `task → billingEntry → billing`,
      // que o banco garante único (`BillingTask.@@unique([taskId])`). Faltava só a relação estar
      // DECLARADA como `BillingTask?` em vez de `BillingTask[]` — enquanto era lista, o Prisma a
      // tratava como de-muitos e se recusava a ordenar por ela.
      //
      // Ordena por `statusOrder`, o espelho numérico, e não pelo `status`: alfabeticamente
      // "APPROVED" viria antes de "OVERDUE", que é o contrário da ordem da atenção.
      enableSorting: true,
      size: 190,
      minSize: 140,
      meta: {
        headerLabel: "Status Faturamento",
        exportHeader: "Status Faturamento",
        exportValue: (t) => {
          const status = taskBillingStatus(t);
          return status ? (BILLING_STATUS_LABELS[status] ?? status) : "";
        },
      },
      cell: ({ row }) => {
        const status = taskBillingStatus(row.original);
        // Traço aqui significa "esta consulta não trouxe o estado" (um include sem
        // `billing.status`), não "não há cobrança": o servidor só devolve tarefa nesta lista
        // quando o orçamento passou da aprovação comercial.
        if (!status) return <MutedDash />;
        const { paid, total } = installmentProgress(row.original);
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
      id: "createdAt",
      header: "Criado em",
      accessorKey: "createdAt",
      enableSorting: true,
      size: 130,
      minSize: 110,
      meta: { defaultVisible: false, headerLabel: "Criado em", exportHeader: "Criado em", exportValue: (t) => dateExportValue(t.createdAt) },
      cell: ({ row }) => renderDateCell(row.original.createdAt),
    },
  ];
}

/** column id → API `orderBy` entry. Ids absent here are not server-sortable. */
export const BILLING_SORT_FIELD_MAP: Record<string, (dir: "asc" | "desc") => Record<string, unknown>> = {
  budgetNumber: (d) => ({ quote: { budgetNumber: d } }),
  name: (d) => ({ name: d }),
  identificador: (d) => ({ serialNumber: { sort: d, nulls: "last" } }),
  // Sorts by what the cell RENDERS (`corporateName || fantasyName`). Ordering by `fantasyName`
  // while showing `corporateName` made the column read as unsorted on most rows.
  customer: (d) => ({ customer: { corporateName: { sort: d, nulls: "last" } } }),
  finishedAt: (d) => ({ finishedAt: d }),
  quoteSubtotal: (d) => ({ quote: { subtotal: d } }),
  quoteTotal: (d) => ({ quote: { total: d } }),
  // Whitelisted by the API as a computed key (`taskOrderByFieldsSchema`); nulls go last on its side.
  currentInstallmentDueDate: (d) => ({ currentInstallmentDueDate: d }),
  billingApprovedAt: (d) => ({ quote: { billingApprovedAt: { sort: d, nulls: "last" } } }),
  // O CAMINHO CURTO: `task → billingEntry → billing`, de-UM em toda a extensão porque o banco
  // garante um faturamento por veículo. Ordena pelo espelho numérico — alfabeticamente "APPROVED"
  // viria antes de "OVERDUE", que é o inverso da ordem da atenção.
  billingStatus: (d) => ({ billingEntry: { billing: { statusOrder: d } } }),
  createdAt: (d) => ({ createdAt: d }),
};

/**
 * Default sort, stated twice on purpose — once as TanStack sorting state (the header arrows at
 * cold mount, when nothing is in the URL) and once as `buildBillingOrderBy([])`. They must agree.
 *
 * ⚠️ ERA `quoteStatus asc` — a ordem da ação pendente do ORÇAMENTO. Com o ciclo do pagamento fora
 * daquele enum, essa ordenação agruparia a lista inteira num valor só ("Aprovado"). O padrão agora
 * é o estado da COBRANÇA, que é a ordem da atenção desta tela: vencido → pendente → parcial →
 * aprovado → liquidado. Desempata pelo entregue há mais tempo, que é o que espera cobrança há mais
 * tempo.
 */
export const BILLING_DEFAULT_SORTING: { id: string; desc: boolean }[] = [
  { id: "billingStatus", desc: false },
  { id: "finishedAt", desc: true },
];

export function buildBillingOrderBy(sorting: { id: string; desc: boolean }[]): Record<string, unknown> | Record<string, unknown>[] {
  const entries = sorting
    .map((s) => BILLING_SORT_FIELD_MAP[s.id]?.(s.desc ? "desc" : "asc"))
    .filter((e): e is Record<string, unknown> => !!e);
  if (entries.length === 0) {
    return [{ billingEntry: { billing: { statusOrder: "asc" } } }, { finishedAt: "desc" }];
  }
  return entries.length === 1 ? entries[0] : entries;
}
