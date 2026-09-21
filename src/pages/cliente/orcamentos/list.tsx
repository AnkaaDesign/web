// web/src/pages/cliente/orcamentos/list.tsx
//
// A LISTA DE ORÇAMENTOS DO CLIENTE.
//
// ⚠️ A LINHA É UM ORÇAMENTO, não um veículo — `GET /cliente/me/orcamentos`
// devolve orçamentos, e o rodapé conta orçamentos. A lista interna levou meses
// para chegar nisso: um orçamento de quatro caminhões ocupava quatro linhas com
// o mesmo número e o dono lia quatro contratos onde havia um.
//
// ── A ORDEM ────────────────────────────────────────────────────────────────
//
// A MESMA da lista interna: `statusOrder` e depois `queueRank` — a ordem de
// ATENÇÃO, não a cronológica. Quem decide é o SERVIDOR, e tem de ser ele:
// `PortalBudgetListParams` (page / take / searchingFor / status) não tem
// `orderBy`, e em modo servidor o motor da tabela marca `manualSorting`. Por
// isso nenhuma coluna abre ordenação — um cabeçalho clicável que não reordena
// nada é pior do que cabeçalho fixo. Ver o relatório do pacote.
//
// ── O RECORTE ──────────────────────────────────────────────────────────────
//
// A coluna de VALOR só existe para quem tem a seção `PRICING`; a de VEÍCULOS, só
// para quem tem `VEHICLE`. Não é `null` na célula: a coluna não é criada. Uma
// coluna "Valor" cheia de traços afirma que existe um número e que o sistema
// falhou em buscá-lo — quando a verdade é que aquela pessoa não vê preço.
import { useCallback, useMemo, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { IconFileText } from "@tabler/icons-react";

import { DataTablePage } from "@/components/ui/datatable";
import type { DataTableFilterDef, DataTableFilterValues } from "@/components/ui/datatable";
import { usePortalBudgets } from "@/api-client/portal";
import type { PortalBudget, PortalBudgetStatus } from "@/api-client/portal";
import { useResponsibleAuth } from "@/contexts/responsible-auth-context";
import { routes } from "@/constants/routes";
import {
  PORTAL_BUDGET_STATUS_OPTIONS,
  PortalErrorBanner,
  createPortalBudgetColumns,
  hasPortalSection,
  portalSectionsForRoles,
} from "@/components/cliente/orcamento";

/** Identidade estável: um literal novo a cada render reconstrói o modelo de linhas. */
const getRowId = (budget: PortalBudget) => budget.id;

const DEFAULT_PAGE_SIZE = 20;

/** Os valores do filtro de estado, saneados: o que vier do URL e não for estado conhecido cai fora. */
function statusFilterValue(raw: unknown): PortalBudgetStatus[] | undefined {
  if (!Array.isArray(raw) || raw.length === 0) return undefined;
  const known = new Set<string>(PORTAL_BUDGET_STATUS_OPTIONS.map((option) => option.value));
  const picked = raw.filter((value): value is PortalBudgetStatus => typeof value === "string" && known.has(value));
  return picked.length ? picked : undefined;
}

export function ClientePortalOrcamentosPage() {
  const navigate = useNavigate();
  const { responsible } = useResponsibleAuth();

  // ⚠️ Dinheiro visível: quem força é a `ResponsibleLayout`, uma vez por sessão
  // do portal. `pricing-visibility` nasce `false` (é preferência do
  // FUNCIONÁRIO, e o `PricingProvider` não existe nesta árvore), e sem aquele
  // gesto toda coluna de valor desta lista sairia `R$ ••••••` sem nenhum botão
  // capaz de revelar. Não repita o efeito aqui — ele é de sessão, não de tela.

  const roles = useMemo(() => responsible?.roles ?? [], [responsible?.roles]);
  // ⚠️ A régua da TELA (`portalSectionsForRoles`), e não a da ASSINATURA. São
  // duas — ver `components/cliente/orcamento/sections.ts`. Com a da assinatura,
  // Gestor de Frota e Motorista viam uma tabela sem coluna nenhuma além do
  // número, enquanto o servidor lhes manda veículo e andamento.
  const sections = useMemo(() => portalSectionsForRoles(roles), [roles]);
  const canSeeVehicles = hasPortalSection(sections, "VEHICLE");
  const canSeePricing = hasPortalSection(sections, "PRICING");

  // --- o que a tabela publica (busca + filtros) ---
  const [searchParams] = useSearchParams();
  // Semeado A PARTIR DO URL, não vazio: a tabela só publica o `?q=`/`?filters=`
  // já parseado por efeito, e um semente vazia dispararia uma primeira consulta
  // sem filtro nenhum em todo link compartilhado.
  const [params, setParams] = useState<{ search: string; filters: DataTableFilterValues }>(() => {
    let filters: DataTableFilterValues = {};
    try {
      filters = JSON.parse(searchParams.get("filters") ?? "{}") as DataTableFilterValues;
    } catch {
      filters = {};
    }
    return { search: searchParams.get("q") ?? "", filters };
  });
  const paramsKey = useRef("");
  const onParamsChange = useCallback((next: { search: string; filters: DataTableFilterValues }) => {
    const key = JSON.stringify(next);
    if (key === paramsKey.current) return;
    paramsKey.current = key;
    setParams(next);
  }, []);

  // --- paginação, que a própria tabela escreve no URL ---
  const pageRaw = Number(searchParams.get("page") ?? "1");
  const page = Number.isFinite(pageRaw) ? Math.max(1, pageRaw) : 1;
  const pageSizeRaw = Number(searchParams.get("pageSize") ?? String(DEFAULT_PAGE_SIZE));
  const take = Number.isFinite(pageSizeRaw) && pageSizeRaw > 0 ? pageSizeRaw : DEFAULT_PAGE_SIZE;

  const query = useMemo(
    () => ({
      page,
      take,
      searchingFor: params.search || undefined,
      status: statusFilterValue(params.filters.status),
    }),
    [page, take, params],
  );

  const { data: response, isLoading, isError, refetch, isFetching } = usePortalBudgets(query);
  const budgets = useMemo(() => response?.data ?? [], [response]);
  /**
   * ⛔ `?? 0`, E NUNCA `?? budgets.length`.
   *
   * O fallback pelo tamanho da PÁGINA era o defeito: com 20 linhas na mão e 118
   * orçamentos no universo, `rowCount = 20` faz `getPageCount()` dar 1, o
   * rodapé colapsar para "1 de 1" e o botão de avançar ficar DESABILITADO — no
   * instante exato em que o contato clica. E é pior que o zero, porque o zero
   * o `DataTable` reconhece como ausência de resposta (`effectiveRowCount`
   * guarda a última contagem conhecida) enquanto 20 é um número plausível que
   * ele tem de acreditar.
   *
   * Com `keepPreviousData` em `usePortalBudgets` a contagem anterior nem chega
   * a sumir durante a viagem — este `?? 0` é o primeiro carregamento e o cinto.
   */
  const totalRecords = response?.meta?.totalRecords ?? 0;

  // ⚠️ As etiquetas de série/placa saem da PRÓPRIA linha (`budget.vehicles`).
  // Esta tela pedia 300 veículos numa segunda consulta e os indexava por
  // orçamento no navegador, porque o tipo antigo declarava que a lista só trazia
  // `vehicleCount` — e não era verdade: `budgetSelect` carrega `tasks` na lista
  // e no detalhe. Uma consulta a menos, e nenhum teto a estourar.
  const columns = useMemo(
    () => createPortalBudgetColumns({ canSeeVehicles, canSeePricing }),
    [canSeeVehicles, canSeePricing],
  );

  const filterDefs = useMemo<DataTableFilterDef<PortalBudget>[]>(
    () => [
      {
        key: "status",
        label: "Estado",
        type: "multiselect",
        options: PORTAL_BUDGET_STATUS_OPTIONS,
        placeholder: "Todos os estados",
      },
    ],
    [],
  );

  const onRowClick = useCallback(
    (budget: PortalBudget) => navigate(routes.customer.portal.orcamento(budget.id)),
    [navigate],
  );

  return (
    // A CADEIA DE ALTURA É DA MOLDURA, e esta tela só a repassa.
    //
    // `responsible-layout` monta `h-dvh` → cabeçalho `shrink-0` → `<main>`
    // `flex-1 min-h-0` com o rolador dentro. Por isso `h-full` aqui RESOLVE, e o
    // número mágico que esta tela carregava (`h-[calc(100dvh-10rem)]`) não é
    // mais necessário — ele quebrava no dia em que o cabeçalho do portal mudasse
    // de altura, e ele mudou duas vezes.
    <div className="flex h-full flex-col gap-3">
      {/* O interceptor do portal já toastou a falha; esta faixa é o que FICA na
          tela — um toast some em 8 segundos e a tabela vazia por baixo dele
          parece "você não tem orçamentos", que é uma resposta errada e crível.
          E o caminho de volta é um BOTÃO, não um pedido para recarregar. */}
      {isError ? (
        // ⚠️ `PortalErrorBanner` — a MESMA faixa das outras cinco telas. Esta
        // montava um `div.rounded-lg.border-destructive/40` à mão enquanto
        // Assinaturas e Cobranças usavam `<Alert variant="destructive">`: duas
        // formas, duas bordas e dois fundos para a mesma frase.
        <PortalErrorBanner
          message="Não foi possível carregar seus orçamentos."
          onRetry={() => void refetch()}
          retrying={isFetching}
        />
      ) : null}

      {/* `flex-1 min-h-0` — o par obrigatório: item de flex tem `min-height:
          auto` e se recusa a encolher abaixo do conteúdo, então sem o `min-h-0`
          a rolagem vazaria para a página em vez de ficar dentro da tabela. */}
      <div className="min-h-0 flex-1">
        <DataTablePage<PortalBudget>
          title="Orçamentos"
          subtitle="Tudo que a Ankaa orçou para a sua empresa, na ordem do que espera por você."
          icon={IconFileText}
          // Migalhas em toda tela do portal menos o Início, que é a raiz. A
          // lista de Veículos já as tinha; esta e a de Pedidos não.
          breadcrumbs={[
            { label: "Início", href: routes.customer.portal.root },
            { label: "Orçamentos" },
          ]}
          // Sem `favoritePage`: o botão de favorito monta `FavoriteButton`, que
          // exige o `FavoritesProvider` do funcionário — e a árvore do portal,
          // de propósito, não o tem. Passar a prop derrubaria a tela.
          scrollHideHeader={false}
          pageClassName="p-0"
          table={{
            tableId: "portal-cliente-orcamentos",
            data: budgets,
            columns,
            filterDefs,
            getRowId,
            onRowClick,
            isLoading,
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
            searchPlaceholder: "Buscar por número, série ou placa...",
            emptyMessage: "Nenhum orçamento encontrado.",
          }}
        />
      </div>
    </div>
  );
}

export default ClientePortalOrcamentosPage;
