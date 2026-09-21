// web/src/pages/cliente/pedidos.tsx
//
// PEDIDOS DE COMPRA — os que ESTE cliente emitiu, e como emitir mais um.
//
// ── Por que esta tela existe ────────────────────────────────────────────────
//
// O número do pedido de compra morava numa coluna de TEXTO LIVRE do orçamento.
// Cabia uma string e não cabia a relação: não dava para dizer quais caminhões
// daquele orçamento entravam em qual pedido, nem para um pedido atravessar dois
// orçamentos, nem para saber quais veículos ainda estão sem número — que é
// exatamente a pergunta que o ⛔ PORTÃO DO COMPRAS faz na hora de assinar.
// `PurchaseOrder` é a tabela que expressa isso, e esta é a tela dela.
//
// ── Quem vê e quem escreve ──────────────────────────────────────────────────
//
// A ABA já é recortada por `WRITE_PURCHASE_ORDER` no `responsible-layout`, e a
// rota de escrita é guardada pela mesma capacidade no servidor. A tela confere
// de novo antes de desenhar o botão de criar — não por desconfiança, mas porque
// um botão que sempre devolve 403 é pior do que botão nenhum.
//
// ⚠️ Esta conferência NÃO é segurança. O portão que vale é o `@PortalCapability`
// da API. Ver o cabeçalho de `utils/portal-capabilities.ts`.
//
// ── ⛔ NADA AQUI É LIDO "POR INTEIRO" ───────────────────────────────────────
//
// Esta tela rodava a tabela em modo `client` e, para isso, pedia
// `GET /cliente/me/pedidos?take=500` e `GET /cliente/me/veiculos?take=500`. O
// teto de `take` é 100 nos dois schemas: as duas requisições voltavam 400 e a
// tela abria com dois toasts vermelhos de "Parâmetros de consulta inválidos".
//
// E mesmo sem o teto, as duas perguntas que justificavam o universo já têm
// resposta melhor no servidor:
//
//  · "este número já existe?" → `?searchingFor=` na hora de digitar
//    (`usar-pedido-por-numero.ts`), e não uma lista inteira carregada antes;
//  · "quantos veículos ainda estão sem número?" → `?semPedido=true&take=1` e
//    `meta.totalRecords`. Uma linha de JSON responde o que 358 respondiam.
import { useCallback, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { IconShoppingCart, IconShoppingCartPlus } from "@tabler/icons-react";

import { DataTablePage } from "@/components/ui/datatable";
import type { DataTableColumnDef } from "@/components/ui/datatable";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useResponsibleAuth } from "@/contexts/responsible-auth-context";
import {
  usePortalPurchaseOrders,
  usePortalVehicles,
  type PortalListParams,
  type PortalPurchaseOrder,
  type PortalVehicleListParams,
} from "@/api-client/portal";
import { PORTAL_CAPABILITY, hasPortalCapability } from "@/utils/portal-capabilities";
import { PortalErrorBanner } from "@/components/cliente/portal-detail";
import { PedidoFormDialog } from "@/components/cliente/pedido-form-dialog";
import { routes } from "@/constants/routes";
import { formatDate } from "@/utils";

/** O padrão da tabela. O teto do servidor é 100. */
const DEFAULT_PAGE_SIZE = 20;

/**
 * A CONTAGEM DE PENDÊNCIA, sem carregar nada.
 *
 * `take: 1` porque só interessa `meta.totalRecords`: a faixa âmbar diz QUANTOS
 * veículos ainda estão sem número de pedido, e o diálogo é quem os lista. Pedir
 * uma página inteira para depois contar o array foi exatamente o hábito que
 * produziu o `take: 500`.
 */
const CONTAGEM_SEM_PEDIDO: PortalVehicleListParams = { take: 1, semPedido: true };

/** Identidade estável: um literal novo a cada render reconstrói o modelo de linhas. */
const getRowId = (pedido: PortalPurchaseOrder) => pedido.id;

/** O identificador humano do veículo dentro de um pedido — já resolvido no servidor. */
const vehicleLabel = (veiculo: PortalPurchaseOrder["veiculos"][number]) =>
  veiculo.label || veiculo.plate || veiculo.serialNumber || veiculo.name || "sem identificação";

const COLUMNS: DataTableColumnDef<PortalPurchaseOrder>[] = [
  {
    // ⚠️ id de coluna SEM PONTO (§10).
    id: "number",
    header: "Pedido",
    accessorFn: (pedido) => pedido.number,
    size: 140,
    minSize: 100,
    meta: { headerLabel: "Pedido", exportHeader: "Nº do pedido" },
    cell: ({ row }) => <span className="text-sm font-medium">{row.original.number}</span>,
  },
  {
    id: "issuedAt",
    header: "Emitido em",
    accessorFn: (pedido) => pedido.issuedAt ?? null,
    size: 130,
    minSize: 110,
    meta: {
      align: "right",
      headerLabel: "Emitido em",
      exportHeader: "Emitido em",
      exportValue: (pedido: PortalPurchaseOrder) =>
        pedido.issuedAt ? formatDate(pedido.issuedAt) : "",
    },
    cell: ({ row }) => (
      <span className="text-sm tabular-nums">
        {row.original.issuedAt ? formatDate(row.original.issuedAt) : "—"}
      </span>
    ),
  },
  {
    id: "vehicles",
    header: "Veículos",
    // ⚠️ `veiculos`, e NÃO `tasks`. O tipo do cliente dizia `tasks` e o servidor
    // sempre mandou `veiculos`: a contagem desta coluna era `0` em todo pedido,
    // e nada nisso dava erro de compilação. A forma é a do SERVIDOR.
    accessorFn: (pedido) => pedido.veiculos?.length ?? 0,
    size: 320,
    minSize: 180,
    meta: {
      headerLabel: "Veículos",
      exportHeader: "Veículos",
      exportValue: (pedido: PortalPurchaseOrder) =>
        (pedido.veiculos ?? []).map(vehicleLabel).join(" · "),
    },
    cell: ({ row }) => {
      const veiculos = row.original.veiculos ?? [];
      if (veiculos.length === 0) return <span className="text-sm text-muted-foreground">—</span>;
      return (
        // A contagem serve para varrer a lista; os identificadores, para
        // CONFERIR. Quem abre um pedido de compra quer saber quais caminhões
        // entraram nele, e só o número não responde isso.
        <span className="flex min-w-0 items-center gap-1.5">
          <Badge variant="secondary" className="shrink-0">
            {veiculos.length}
          </Badge>
          <span className="truncate text-sm text-muted-foreground">
            {veiculos.map(vehicleLabel).join(" · ")}
          </span>
        </span>
      );
    },
  },
  {
    id: "createdAt",
    header: "Registrado em",
    accessorFn: (pedido) => pedido.createdAt ?? null,
    size: 140,
    minSize: 110,
    meta: {
      align: "right",
      headerLabel: "Registrado em",
      exportHeader: "Registrado em",
      exportValue: (pedido: PortalPurchaseOrder) =>
        pedido.createdAt ? formatDate(pedido.createdAt) : "",
    },
    cell: ({ row }) => (
      <span className="text-sm tabular-nums text-muted-foreground">
        {row.original.createdAt ? formatDate(row.original.createdAt) : "—"}
      </span>
    ),
  },
];

export function ClientePortalPedidosPage() {
  const { responsible } = useResponsibleAuth();
  const roles = useMemo(() => responsible?.roles ?? [], [responsible?.roles]);
  const canWrite = hasPortalCapability(roles, PORTAL_CAPABILITY.WRITE_PURCHASE_ORDER);

  // Modo servidor: página e tamanho viajam na URL que a própria tabela escreve;
  // a busca chega por `onParamsChange`.
  const [searchParams] = useSearchParams();

  // Semeado A PARTIR DA URL, não vazio: a tabela só publica o `?q=` que leu
  // através de um efeito, e um seed vazio dispararia uma busca sem filtro a
  // cada link compartilhado.
  const [params, setParams] = useState<{ search: string }>(() => ({
    search: searchParams.get("q") ?? "",
  }));
  const paramsKey = useRef("");
  const onParamsChange = useCallback((next: { search: string }) => {
    const key = JSON.stringify({ search: next.search });
    if (key === paramsKey.current) return;
    paramsKey.current = key;
    setParams({ search: next.search });
  }, []);

  const pageRaw = Number(searchParams.get("page") ?? "1");
  const page = Number.isFinite(pageRaw) ? Math.max(1, pageRaw) : 1;
  const pageSizeRaw = Number(searchParams.get("pageSize") ?? String(DEFAULT_PAGE_SIZE));
  const pageSize =
    Number.isFinite(pageSizeRaw) && pageSizeRaw > 0 ? pageSizeRaw : DEFAULT_PAGE_SIZE;

  const query = useMemo<PortalListParams>(
    () => ({
      page,
      // ⚠️ `take`, e não `limit` — e o teto é 100.
      take: pageSize,
      ...(params.search.trim() ? { searchingFor: params.search.trim() } : {}),
    }),
    [page, pageSize, params.search],
  );

  const purchaseOrders = usePortalPurchaseOrders(query);

  /**
   * A contagem da faixa âmbar — uma linha de JSON, não a frota.
   *
   * Quem não escreve pedido não vê a faixa e não paga a consulta: ela existe
   * para oferecer o conserto a quem pode fazê-lo.
   */
  const pendencia = usePortalVehicles(CONTAGEM_SEM_PEDIDO, { enabled: canWrite });
  const semPedido = pendencia.data?.meta?.totalRecords ?? 0;

  const pedidos = useMemo(() => purchaseOrders.data?.data ?? [], [purchaseOrders.data]);
  const totalRecords = purchaseOrders.data?.meta?.totalRecords ?? 0;

  const [dialogOpen, setDialogOpen] = useState(false);

  const avisoVisivel = canWrite && !purchaseOrders.isError && semPedido > 0;

  return (
    // A CADEIA DE ALTURA É DA MOLDURA (`responsible-layout`: `h-dvh` →
    // cabeçalho `shrink-0` → `<main>` `flex-1 min-h-0`), e esta tela só a
    // repassa. É o que permite a faixa de aviso aparecer e sumir sem que a
    // tabela precise saber a altura dela.
    <div className="flex h-full flex-col gap-3">
      {/* O interceptor do portal já toastou a falha; esta faixa é o que FICA na
          tela, e o caminho de volta é um BOTÃO — um toast some em 8 segundos e
          a tabela vazia por baixo dele parece "você não tem pedidos".

          ⚠️ SEM O RAMO DE "A ROTA AINDA NÃO EXISTE". Ele existiu enquanto
          `GET /cliente/me/pedidos` era só contrato; a rota está no ar e é
          fixada em `tests/portal-cliente-boot.test.ts`. Um 404 hoje só poderia
          ser falha de verdade, e anunciá-la como "ainda não publicada" mandaria
          o contato parar de procurar o pedido dele. */}
      {purchaseOrders.isError ? (
        <PortalErrorBanner
          message="Não foi possível carregar seus pedidos."
          onRetry={() => void purchaseOrders.refetch()}
          retrying={purchaseOrders.isFetching}
        />
      ) : null}

      {/* O ALERTA ÚTIL desta tela: veículo sem número é assinatura barrada mais
          tarde, para quem só tem Compras. Dizer isso aqui, com a contagem e com
          o caminho de conserto, é o que transforma a lista num lugar de trabalho
          em vez de um arquivo. */}
      {avisoVisivel ? (
        <div className="flex flex-col gap-2 rounded-lg border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm sm:flex-row sm:items-center sm:justify-between">
          <span>
            {semPedido === 1
              ? "1 veículo ainda está sem número de pedido de compra."
              : `${semPedido} veículos ainda estão sem número de pedido de compra.`}
          </span>
          <Button size="sm" className="shrink-0" onClick={() => setDialogOpen(true)}>
            <IconShoppingCartPlus className="mr-2 h-4 w-4" />
            Informar agora
          </Button>
        </div>
      ) : null}

      {/* `flex-1 min-h-0` — a tabela come o que sobra depois do aviso, sem que
          nenhum dos dois precise saber a altura do outro. Era isto que os dois
          `calc(100dvh - N)` desta tela tentavam adivinhar. */}
      <div className="min-h-0 flex-1">
        <DataTablePage<PortalPurchaseOrder>
          title="Pedidos de compra"
          subtitle="Os números de pedido que a sua empresa emitiu, e os veículos que cada um cobre."
          icon={IconShoppingCart}
          breadcrumbs={[
            { label: "Início", href: routes.customer.portal.root },
            { label: "Pedidos de compra" },
          ]}
          // Sem `favoritePage`: o botão de favorito monta `FavoriteButton`, que
          // exige o `FavoritesProvider` do funcionário — e a árvore do portal,
          // de propósito, não o tem. Passar a prop derrubaria a tela.
          scrollHideHeader={false}
          pageClassName="p-0"
          actions={
            canWrite
              ? [
                  {
                    key: "novo",
                    label: "Novo pedido",
                    icon: IconShoppingCartPlus,
                    onClick: () => setDialogOpen(true),
                  },
                ]
              : []
          }
          table={{
            tableId: "portal-cliente-pedidos",
            data: pedidos,
            columns: COLUMNS,
            getRowId,
            isLoading: purchaseOrders.isLoading,
            // Modo SERVIDOR: busca e paginação viajam para o `WHERE`. Era o modo
            // `client` que obrigava a tela a carregar o acervo inteiro antes de
            // desenhar a primeira linha.
            mode: "server",
            rowCount: totalRecords,
            onParamsChange,
            defaultPageSize: DEFAULT_PAGE_SIZE,
            estimateRowHeight: 48,
            // O layout da tabela NÃO é persistido: `useTablePreferences` grava em
            // `Preferences` do FUNCIONÁRIO, e no portal não há funcionário. Sem
            // persistência, também não faz sentido oferecer reordenar/redimensionar
            // coluna — a escolha se perderia no F5.
            persist: false,
            enableColumnReorder: false,
            enableColumnResizing: false,
            enableSelection: false,
            enableRowPinning: false,
            enableShare: false,
            searchPlaceholder: "Buscar por número do pedido, placa ou série...",
            emptyMessage: canWrite
              ? "Nenhum pedido de compra. Crie o primeiro e marque de uma vez todos os veículos que ele cobre."
              : "Nenhum pedido de compra registrado.",
            exportTitle: "Pedidos de compra",
            exportFilename: "pedidos-de-compra",
          }}
        />
      </div>

      {canWrite && <PedidoFormDialog open={dialogOpen} onOpenChange={setDialogOpen} />}
    </div>
  );
}

// `App.tsx` carrega as telas do portal por `lazy(() => import(...))`, que exige
// exportação padrão. O nome continua valendo para quem importar direto.
export default ClientePortalPedidosPage;
