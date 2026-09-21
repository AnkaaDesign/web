// web/src/components/cliente/orcamento/orcamento-columns.tsx
//
// AS COLUNAS DA LISTA DE ORÇAMENTOS DO CLIENTE.
//
// ⚠️ A LINHA É UM ORÇAMENTO, não um veículo. A lista interna já pagou esse preço
// uma vez: um orçamento de quatro caminhões ocupava quatro linhas com o mesmo
// número, e o rodapé anunciava "4 resultado(s)". O portal nasce com a unidade
// certa — `GET /cliente/me/orcamentos` devolve orçamentos.
//
// ⚠️ ID DE COLUNA SEM PONTO. O id vira a propriedade CSS `--col-<id>-size` e a
// chave de persistência do layout; um alvo aninhado (`quote.statusOrder`) que o
// motor antigo aceitava aqui quebra as duas coisas.
//
// ⚠️ Rótulo e cor de estado vêm de `QUOTE_STATUS_CONFIG`, via
// `<QuoteStatusBadge>`. Este arquivo não declara cor de estado nenhuma — já
// houve TRÊS mapas divergentes nesta base.
//
// ⚠️ OS VEÍCULOS VÊM NA PRÓPRIA LINHA. `PortalBudget.vehicles` é preenchido
// tanto na lista quanto no detalhe (`budgetSelect` carrega `tasks` nos dois
// caminhos). A versão anterior desta tela pedia 300 veículos numa segunda
// consulta e os indexava por orçamento no navegador, porque o tipo antigo
// declarava que a lista só trazia `vehicleCount`. Não trazia: o dado estava lá.
//
// ⚠️ E O VALOR MORA EM `pricing`. `budget.total` (a forma plana antiga) não
// existe — `PRICING` é um GRUPO que aparece ou não aparece, e é a presença dele
// que diz se esta pessoa vê preço.
import type { DataTableColumnDef } from "@/components/ui/datatable";
import type { PortalBudget } from "@/api-client/portal";
import { QuoteStatusBadge, QUOTE_STATUS_CONFIG } from "@/components/production/task/quote/quote-status-badge";
import type { TASK_QUOTE_STATUS } from "@/types/budget";
import { formatCurrency, formatDate } from "@/utils";
import { VehicleChips, vehicleChipLabel } from "./vehicle-chips";
import { PORTAL_WAITING_TONE_CLASS, portalWaitingOn } from "./waiting-on";

const Dash = () => <span className="text-muted-foreground">—</span>;

export interface PortalBudgetColumnOptions {
  /** O papel tem a seção `VEHICLE`? Sem ela a coluna de veículos não existe. */
  canSeeVehicles: boolean;
  /**
   * O papel tem a seção `PRICING`?
   *
   * ⚠️ A coluna não fica "vazia" para quem não tem: ela NÃO É CRIADA. Uma coluna
   * "Valor" cheia de traços é pior do que coluna nenhuma — ela afirma que existe
   * um valor e que o sistema não conseguiu carregá-lo, quando a verdade é que
   * aquela pessoa não vê preço. O Marketing do cliente abre requisição e não vê
   * preço; o servidor nem manda o grupo `pricing` por isso.
   */
  canSeePricing: boolean;
}

/** O total do orçamento, ou `null` quando o recorte não traz `PRICING`. */
const totalOf = (b: PortalBudget): number | null =>
  typeof b.pricing?.total === "number" ? b.pricing.total : null;

export function createPortalBudgetColumns({
  canSeeVehicles,
  canSeePricing,
}: PortalBudgetColumnOptions): DataTableColumnDef<PortalBudget>[] {
  const columns: DataTableColumnDef<PortalBudget>[] = [
    {
      // O número que o cliente cita no telefone — a forma mais rápida de achar
      // um orçamento, e a chave natural da linha.
      id: "budgetNumber",
      header: "Nº",
      accessorFn: (b) => b.budgetNumber ?? null,
      size: 90,
      minSize: 70,
      // ⚠️ SEM ordenação, e não por esquecimento: em modo servidor o motor marca
      // `manualSorting`, e a rota só entende `orderBy=fila|recentes`. Um
      // cabeçalho clicável aqui seria um controle que não faz nada — pior que
      // controle nenhum. A ordem é a de ATENÇÃO (`statusOrder`), e quem a decide
      // é o servidor.
      enableSorting: false,
      meta: {
        align: "right",
        headerLabel: "Nº",
        exportHeader: "Nº Orçamento",
        exportValue: (b) => b.budgetNumber ?? "",
      },
      cell: ({ getValue }) => {
        const n = getValue() as number | null;
        if (!n) return <Dash />;
        return <span className="text-sm font-medium tabular-nums">{n}</span>;
      },
    },
  ];

  if (canSeeVehicles) {
    columns.push({
      id: "vehicles",
      header: "Veículos",
      accessorFn: (b) => b.vehicleCount ?? 0,
      enableSorting: false,
      size: 230,
      minSize: 140,
      meta: {
        headerLabel: "Veículos",
        exportHeader: "Veículos",
        exportValue: (b) => {
          const list = b.vehicles ?? [];
          return list.length ? list.map(vehicleChipLabel) : String(b.vehicleCount ?? 0);
        },
      },
      cell: ({ row }) => (
        <VehicleChips vehicles={row.original.vehicles ?? []} count={row.original.vehicleCount} />
      ),
    });
  }

  columns.push(
    {
      id: "quoteStatus",
      header: "Estado",
      accessorFn: (b) => b.status,
      enableSorting: false,
      size: 170,
      minSize: 140,
      meta: {
        headerLabel: "Estado",
        exportHeader: "Estado",
        exportValue: (b) => QUOTE_STATUS_CONFIG[b.status as TASK_QUOTE_STATUS]?.label ?? b.status,
      },
      cell: ({ row }) => <QuoteStatusBadge status={row.original.status} size="sm" />,
    },
    {
      // A pergunta que o contato faz ao abrir o portal, respondida em duas
      // palavras. Derivada do estado — ver `waiting-on.ts`.
      id: "waitingOn",
      header: "Esperando",
      accessorFn: (b) => portalWaitingOn(b.status, b.signature).label,
      enableSorting: false,
      size: 150,
      minSize: 110,
      meta: {
        headerLabel: "Esperando",
        exportHeader: "Esperando",
        exportValue: (b) => portalWaitingOn(b.status, b.signature).detail,
      },
      cell: ({ row }) => {
        const waiting = portalWaitingOn(row.original.status, row.original.signature);
        if (!waiting.label || waiting.label === "—") return <Dash />;
        return (
          <span className={`whitespace-nowrap text-sm ${PORTAL_WAITING_TONE_CLASS[waiting.tone]}`} title={waiting.detail}>
            {waiting.label}
          </span>
        );
      },
    },
    {
      // A data que a proposta está correndo contra.
      id: "expiresAt",
      header: "Validade",
      accessorFn: (b) => b.expiresAt ?? null,
      enableSorting: false,
      size: 120,
      minSize: 100,
      meta: {
        headerLabel: "Validade",
        exportHeader: "Validade",
        exportValue: (b) => (b.expiresAt ? formatDate(b.expiresAt) : ""),
      },
      cell: ({ getValue }) => {
        const value = getValue() as string | null;
        if (!value) return <Dash />;
        return <span className="whitespace-nowrap text-sm tabular-nums">{formatDate(value)}</span>;
      },
    },
  );

  if (canSeePricing) {
    columns.push({
      id: "total",
      header: "Valor",
      accessorFn: (b) => totalOf(b),
      enableSorting: false,
      size: 140,
      minSize: 110,
      meta: {
        align: "right",
        headerLabel: "Valor",
        exportHeader: "Valor",
        exportValue: (b) => {
          const total = totalOf(b);
          return total === null ? "" : formatCurrency(total);
        },
      },
      cell: ({ getValue }) => {
        const total = getValue() as number | null;
        // ⚠️ `null` aqui é RECORTE do servidor, não "orçamento sem valor" — e é
        // também o estado normal de uma requisição, que nasce com total 0 e sem
        // nenhum item. Um `?? 0` imprimiria "R$ 0,00" e mentiria nas duas
        // leituras.
        if (total === null) return <Dash />;
        return <span className="whitespace-nowrap text-sm font-medium tabular-nums">{formatCurrency(total)}</span>;
      },
    });
  }

  return columns;
}

/**
 * O filtro de estado da lista — as opções saem de `QUOTE_STATUS_CONFIG`, na
 * ordem em que ele as declara (que é a ordem de atenção).
 *
 * ⚠️ Sem lista positiva fixa aqui: `BUDGET_QUOTE_STATUSES`, o equivalente da
 * tela interna, é ao mesmo tempo as opções do filtro, o `where` PADRÃO da lista
 * e o guard da célula — e um estado fora dela não aparece na tela de jeito
 * nenhum. No portal o servidor já escopa; o filtro só estreita.
 */
export const PORTAL_BUDGET_STATUS_OPTIONS = (Object.keys(QUOTE_STATUS_CONFIG) as TASK_QUOTE_STATUS[]).map((status) => ({
  value: status,
  label: QUOTE_STATUS_CONFIG[status].label,
}));
