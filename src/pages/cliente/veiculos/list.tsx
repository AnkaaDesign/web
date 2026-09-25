// web/src/pages/cliente/veiculos/list.tsx
//
// A FROTA DO CLIENTE — uma linha por VEÍCULO.
//
// ⚠️ A unidade aqui é o veículo, e isso é o oposto da lista de ORÇAMENTOS, onde
// a linha é o contrato. Não é inconsistência: o contato que abre esta tela está
// procurando um caminhão ("o da placa tal"), não um documento. Um orçamento de
// quatro caminhões ocupa quatro linhas aqui, de propósito.
//
// O que a tela existe para resolver: VEÍCULO SEM PLACA OU SEM CHASSI. Esses dois
// números a Ankaa não tem como saber, e sem eles não sai NFS-e nem entrega. Por
// isso a falta é um ESTADO desenhado (célula âmbar e linha tingida), e não uma
// célula vazia que se confunde com "ainda não perguntamos".
//
// ── O QUE A ROTA ENTENDE, E SÓ ISSO ────────────────────────────────────────
//
// ⛔ `portalVehicleListQuerySchema` declara `page`, `take`, `searchingFor`,
// `semPedido` e `orderBy`. MAIS NADA — e nada em zod é `.strict()` neste
// repositório, então chave desconhecida some em SILÊNCIO, com 200.
//
// Esta tela mandava três coisas que o servidor descartava sem avisar:
//   · `limit` em vez de `take` → toda página voltava com 20 linhas, e o seletor
//     de tamanho de página não fazia nada;
//   · `missingIdentity` e `inProduction` → a gaveta marcava, o chip aparecia, e
//     a lista voltava INTEIRA. O contato concluía que a empresa não tem veículo
//     pendente, que é a resposta errada mais crível possível. Os dois filtros
//     saíram: filtro novo aqui só depois de existir lá (era a doutrina escrita
//     neste arquivo, e ela valia);
//   · `orderBy` no formato do PRISMA (`{ implement: { plate: 'asc' } }`) → o zod
//     esperava um enum de duas palavras e devolvia 400 no primeiro clique de
//     cabeçalho.
//
// ── A ORDENAÇÃO, agora que ela existe ──────────────────────────────────────
//
// O `orderBy` desta rota é a lista de `campo:direção` da allowlist
// `PORTAL_VEHICLE_SORT_FIELDS` (`portal-read.controller.ts`) — e NÃO o par
// `fila|recentes` da rota de orçamentos, que é a ordem de ATENÇÃO do contrato.
// A tradução id-de-coluna → campo mora em `VEICULO_SORT_FIELD_MAP`, ao lado das
// colunas; o servidor recorta a ordenação pela MESMA régua de seção que recorta
// o dado (quem não vê placa não ordena por placa).
//
// ⛔ Nenhuma coluna de §9 mora aqui — nem tempo trabalhado, nem responsável
// interno, nem pausa, nem vaga, nem prazo (`Task.term` é compromisso INTERNO;
// o que o cliente vê é a PREVISÃO). E nem `Task.status`, que o servidor retira.
import { useCallback, useMemo, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { IconCar } from "@tabler/icons-react";

import {
  usePortalVehicles,
  type PortalVehicleListParams,
  type PortalVehicleDetail,
} from "@/api-client/portal";
import { DataTablePage } from "@/components/ui/datatable";
import { routes } from "@/constants";
import { useResponsibleAuth } from "@/contexts/responsible-auth-context";
import {
  PORTAL_VEICULOS_DEFAULT_SORTING,
  buildVeiculoOrderBy,
  createPortalVeiculoColumns,
  portalVeiculoRowClassName,
} from "@/components/cliente/veiculo/veiculo-table-columns";
import {
  PortalErrorBanner,
  hasPortalSection,
  portalSectionsForRoles,
} from "@/components/cliente/orcamento";

const DEFAULT_PAGE_SIZE = 20;

/** Identidade de módulo: um literal novo a cada render reconstrói o row model. */
const getRowId = (row: PortalVehicleDetail) => row.id;

export function ClientePortalVeiculosPage() {
  const navigate = useNavigate();
  const { responsible } = useResponsibleAuth();

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

  /**
   * A ORDEM TAMBÉM VEM DA URL — é ela, e não o estado interno da tabela, que
   * monta a consulta.
   *
   * O motor escreve `?sort=[{"id":"plate","desc":false}]` num `writeUrl` que
   * ACUMULA (`useUrlParams`), na MESMA escrita em que apaga o `page` — as duas
   * coisas num tick só, porque `setSearchParams` do react-router não acumula e
   * a segunda chamada apagaria a primeira. Era assim que a ordenação "girava a
   * seta e o servidor devolvia a ordem antiga" (armadilha nº 2 de
   * `pagination-url-sync.test.tsx`).
   */
  const sortParam = searchParams.get("sort");
  const sorting = useMemo<Array<{ id: string; desc: boolean }>>(() => {
    if (!sortParam) return [];
    try {
      const parsed = JSON.parse(sortParam);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }, [sortParam]);

  const query = useMemo<PortalVehicleListParams>(() => {
    const orderBy = buildVeiculoOrderBy(sorting);
    return {
      page,
      // ⚠️ `take`, e não `limit`. Ver o cabeçalho.
      take: pageSize,
      ...(params.search.trim() ? { searchingFor: params.search.trim() } : {}),
      // Lista vazia é OMITIDA, não mandada vazia: `orderBy=` sem valor é uma
      // chave a mais na `queryKey` e uma a mais na query string, para dizer
      // exatamente o que a ausência já diz.
      ...(orderBy.length ? { orderBy } : {}),
    };
  }, [page, pageSize, params.search, sorting]);

  const { data: response, isLoading, error, refetch, isFetching } = usePortalVehicles(query);

  const veiculos = useMemo(() => response?.data ?? [], [response]);
  /**
   * ⛔ `?? 0`, E NUNCA `?? veiculos.length`.
   *
   * O fallback pelo tamanho da página é o defeito que faz o rodapé mentir: com
   * 20 linhas na mão e 358 no universo, `rowCount = 20` colapsa o rodapé para
   * "1 de 1" e desabilita o avançar. O zero é honesto — é "ainda não sei" —, e
   * o `DataTable` já o trata como ausência de resposta (`effectiveRowCount`)
   * enquanto `keepPreviousData` mantém a contagem anterior viva.
   */
  const totalRecords = response?.meta?.totalRecords ?? 0;

  /**
   * O RECORTE. A lista do SERVIDOR manda (cada linha traz `sections`); o espelho
   * local é o recuo para a resposta vazia ou ainda não chegada.
   *
   * ⚠️ Sem `VEHICLE` não há identidade a desenhar, e sem `DELIVERY` não há etapa
   * nem previsão — as colunas não ficam vazias: elas NÃO SÃO CRIADAS. Uma coluna
   * "Placa" cheia de avisos âmbar afirma que a frota inteira está pendente,
   * quando a verdade é que aquela pessoa não vê placa.
   */
  const sections = useMemo(
    () => portalSectionsForRoles(responsible?.roles ?? []),
    [responsible?.roles],
  );
  const canSeeIdentity = hasPortalSection(veiculos[0]?.sections ?? sections, "VEHICLE");
  const canSeeProgress = hasPortalSection(veiculos[0]?.sections ?? sections, "DELIVERY");

  const columns = useMemo(
    () => createPortalVeiculoColumns({ canSeeIdentity, canSeeProgress }),
    [canSeeIdentity, canSeeProgress],
  );

  // ⛔ AQUI MORAVA O CONTADOR "N veículos nesta página aguardam identificação",
  // e o dono mandou tirá-lo — não escondê-lo atrás de uma condição. A frase
  // contava a PÁGINA e não o universo (o servidor não manda contador de
  // pendência nenhum), então ela dizia "20" tanto para quem tem 20 pendências
  // quanto para quem tem 358 — e mudava a cada clique no rodapé. O sinal de
  // pendência não se perdeu: continua na célula âmbar de placa/chassi e na
  // linha tingida, que é onde ele diz QUAL veículo, que é a pergunta útil.

  const onRowClick = useCallback(
    (row: PortalVehicleDetail) => {
      navigate(routes.customer.portal.veiculo(row.id));
    },
    [navigate],
  );

  return (
    // `h-full`, E NÃO UM NÚMERO MÁGICO.
    //
    // A `DataTable` (fora do modo `autoHeight`) só rola por dentro quando tem
    // ALTURA LIMITADA: ela é `h-full` sobre uma cadeia `flex-1 min-h-0` que
    // termina num `overflow-auto`. A `responsible-layout` agora fornece essa
    // cadeia — `h-dvh` → cabeçalho `shrink-0` → `<main>` `flex-1 min-h-0` —,
    // então `h-full` aqui resolve para uma altura definida de verdade.
    //
    // O `h-[calc(100dvh-9.5rem)]` que esta tela carregava dependia de o
    // cabeçalho do portal medir exatamente 9,5rem; ele mudou duas vezes (a
    // última ao ganhar a barra de abas), e a cada vez a tabela passava a medir
    // errado sem ninguém tocar neste arquivo.
    //
    // `autoHeight` continua fora de questão: ele DESLIGA a paginação
    // (`data-table.tsx` faz `enablePagination && !autoHeight`), o que numa lista
    // em modo servidor prenderia o contato na primeira página.
    <div className="flex h-full flex-col gap-3">
      {/* O interceptor do portal já toastou a falha; esta faixa é o que FICA na
          tela, porque um toast some e a tabela vazia por baixo dele parece
          "você não tem veículos" — que é uma resposta errada e crível. E o
          caminho de volta é um BOTÃO, não um pedido para recarregar. */}
      {error ? (
        <PortalErrorBanner
          message="Não foi possível carregar os veículos."
          onRetry={() => void refetch()}
          retrying={isFetching}
        />
      ) : null}

      <div className="min-h-0 flex-1">
        <DataTablePage<PortalVehicleDetail>
          title="Veículos"
          icon={IconCar}
          breadcrumbs={[
            { label: "Início", href: routes.customer.portal.root },
            { label: "Veículos" },
          ]}
          // Sem `favoritePage`: o botão de favorito monta `FavoriteButton`, que
          // exige o `FavoritesProvider` do funcionário — e a árvore do portal,
          // de propósito, não o tem. Passar a prop derrubaria a tela.
          scrollHideHeader={false}
          pageClassName="p-0"
          table={{
            tableId: "portal-cliente-veiculos",
            data: veiculos,
            columns,
            getRowId,
            onRowClick,
            getRowClassName: portalVeiculoRowClassName,
            isLoading,
            mode: "server",
            rowCount: totalRecords,
            onParamsChange,
            defaultSorting: PORTAL_VEICULOS_DEFAULT_SORTING,
            defaultPageSize: DEFAULT_PAGE_SIZE,
            estimateRowHeight: 44,
            // O layout da tabela NÃO é persistido: `useTablePreferences` grava em
            // `Preferences` do FUNCIONÁRIO, e no portal não há funcionário. Sem
            // persistência, também não faz sentido oferecer reordenar/redimensionar
            // coluna — a escolha se perderia no F5.
            persist: false,
            enableColumnReorder: false,
            enableColumnResizing: false,
            // Seleção múltipla não tem ação nenhuma nesta tela — a coluna de
            // marcação só ocuparia largura num celular, que é de onde metade
            // destas visitas chega (`/cliente/*` é isento do MobileUsageGuard).
            enableSelection: false,
            enableRowPinning: false,
            enableShare: false,
            searchPlaceholder: "Buscar por série, placa, chassi ou pedido...",
            emptyMessage:
              "Nenhum veículo encontrado. Os veículos aparecem aqui assim que um orçamento é aberto para a sua empresa.",
            exportTitle: "Veículos",
            exportFilename: "veiculos",
          }}
        />
      </div>
    </div>
  );
}

export default ClientePortalVeiculosPage;
