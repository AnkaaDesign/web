// web/src/layouts/responsible-layout.tsx
//
// A terceira layout do app. `auth-layout` é a moldura das telas de entrada do
// funcionário; `main-layout` é o sistema interno (Header + Sidebar + eixo de
// visibilidade de preço). Nenhuma das duas serve ao portal do cliente:
//
//   • `main-layout` chama `usePricing()`, e aquele contexto lê a preferência do
//     FUNCIONÁRIO logado (`Preferences.pricesVisibleByDefault`). Para um contato
//     de cliente, o preço do próprio orçamento é sempre visível — o eixo inteiro
//     não se aplica.
//   • `Header` e `Sidebar` são navegação interna: setores, produção, estoque, DP.
//     Nada disso existe para quem está de fora.
//
// ── A NAVEGAÇÃO (20/09/2026) ────────────────────────────────────────────────
//
// Até aqui esta layout era SÓ cabeçalho, porque o portal tinha uma tela só. Com
// seis, ela precisa de navegação — e a navegação do portal é RECORTADA PELO
// PAPEL: o que a pessoa não pode fazer não aparece.
//
// É uma barra de abas horizontal, e não a `Sidebar` interna, por três razões:
// são poucas seções e uma sidebar seria moldura demais para elas; `/cliente` é
// isento do `MobileUsageGuard` (por PREFIXO), então metade destas visitas é de
// celular, onde a barra rola e a sidebar não cabe; e a sidebar interna carrega
// `navigation.ts`, que é um catálogo de telas de FUNCIONÁRIO.
import { useEffect } from "react";
import { NavLink, Outlet, useLocation } from "react-router-dom";
import {
  IconCar,
  IconFileInvoice,
  IconFilePlus,
  IconFileText,
  IconHome,
  IconLogout,
  IconShoppingCart,
  IconSignature,
} from "@tabler/icons-react";
import { useResponsibleAuth } from "@/contexts/responsible-auth-context";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { Button } from "@/components/ui/button";
import { routes } from "@/constants/routes";
import { RESPONSIBLE_ROLE } from "@/constants/enums";
import { cn } from "@/lib/utils";
import { PORTAL_CAPABILITY, capabilitiesForRoles } from "@/utils/portal-capabilities";
import { getPricingVisible, setPricingVisible } from "@/utils/pricing-visibility";

type PortalNavItem = {
  to: string;
  label: string;
  icon: typeof IconHome;
  /** Sem isto, a aba é para todo mundo que tem sessão. */
  capability?: PORTAL_CAPABILITY;
  /** Quando a aba depende de VER algo, e não de FAZER algo. */
  roles?: RESPONSIBLE_ROLE[];
  /** `end` para a raiz, senão ela fica ativa em todas as filhas. */
  end?: boolean;
};

const PORTAL_NAV: PortalNavItem[] = [
  { to: routes.customer.portal.root, label: "Início", icon: IconHome, end: true },
  { to: routes.customer.portal.orcamentos, label: "Orçamentos", icon: IconFileText },
  // A REQUISIÇÃO. Vem logo depois de Orçamentos porque é de onde um orçamento
  // nasce quando o pedido veio de fora — e some inteira para quem não abre
  // requisição (Compras, Financeiro, Gestor de Frota, Motorista).
  {
    to: routes.customer.portal.solicitar,
    label: "Solicitar",
    icon: IconFilePlus,
    capability: PORTAL_CAPABILITY.REQUEST_BUDGET,
  },
  { to: routes.customer.portal.veiculos, label: "Veículos", icon: IconCar },
  { to: routes.customer.portal.assinaturas, label: "Assinaturas", icon: IconSignature },
  {
    to: routes.customer.portal.pedidos,
    label: "Pedidos",
    icon: IconShoppingCart,
    capability: PORTAL_CAPABILITY.WRITE_PURCHASE_ORDER,
  },
  {
    to: routes.customer.portal.cobrancas,
    label: "Cobranças",
    icon: IconFileInvoice,
    // Cobrança é a seção PAYMENT do documento, e quem a recebe é o Financeiro do
    // cliente e quem assina o documento inteiro. Marketing, Gestor de Frota e
    // Motorista não a veem — no PDF também não veriam.
    roles: [
      RESPONSIBLE_ROLE.FINANCIAL,
      RESPONSIBLE_ROLE.COMMERCIAL,
      RESPONSIBLE_ROLE.SELLER,
      RESPONSIBLE_ROLE.REPRESENTATIVE,
      RESPONSIBLE_ROLE.COORDINATOR,
      RESPONSIBLE_ROLE.PURCHASING,
    ],
  },
];

/**
 * AS TELAS QUE PRECISAM DE TETO — e por que esta lista existe à mão.
 *
 * O portal tem dois tipos de tela, e eles querem coisas OPOSTAS do mesmo
 * invólucro:
 *
 *   · LISTA — a tabela precisa de um pai de altura DEFINIDA para se limitar e
 *     rolar POR DENTRO, com o cabeçalho grudado e o rodapé de paginação sempre
 *     à vista. É o `h-full → flex-1 min-h-0 → overflow-auto` do `DataTable`
 *     encontrando um teto.
 *   · CARDS — o conteúdo tem de CRESCER, para que a margem de baixo caia DEPOIS
 *     da última linha. Com altura definida ela era pintada no MEIO da rolagem, e
 *     quem rolasse até o fim via o conteúdo colado na borda da janela. Medido em
 *     Cobranças: invólucro 942px, conteúdo 2985px, respiro ZERO no fim.
 *
 * ⛔ CSS NÃO DECIDE ISSO SOZINHO. Altura definida e altura que cresce são
 * mutuamente exclusivas, e `h-full` num pai de altura automática degrada para
 * `auto` — a tabela volta a empurrar a página. Não há combinação de
 * `min-h-full`, `flex-1` ou `minmax()` que sirva aos dois.
 *
 * ⚠️ E NÃO É "quem usa `DataTablePage`". Cobranças usa, e FLUI — ela desenha
 * cartões com tabelas dentro, não uma tabela que se limita. Medido a 620px de
 * janela: orçamentos/veículos/pedidos ficam em 527/527 (se limitam) e cobranças
 * em 527/3007 (transborda).
 *
 * ⚠️ TELA DE LISTA NOVA ENTRA AQUI. Esquecer não quebra nada de imediato — ela
 * só passa a rolar a página inteira em vez de a tabela, que é justamente o
 * defeito difícil de ver. `tests/e2e-portal/cenarios/05-respiro-e-rolagem.ts`
 * cobra os dois modos.
 */
const ROTAS_COM_TETO: readonly string[] = [
  routes.customer.portal.orcamentos,
  routes.customer.portal.veiculos,
  routes.customer.portal.pedidos,
];

/** Só a LISTA tem teto; o detalhe dela (`/orcamentos/:id`) é tela de cards. */
function telaComTeto(pathname: string): boolean {
  return ROTAS_COM_TETO.some(r => pathname === r || pathname === `${r}/`);
}

export const ResponsibleLayout = () => {
  const { responsible, logout } = useResponsibleAuth();
  const { pathname } = useLocation();
  const comTeto = telaComTeto(pathname);

  // ── DINHEIRO VISÍVEL NO PORTAL ─────────────────────────────────────────────
  //
  // `pricing-visibility` nasce `_visible = false` e quem o liga é o
  // `PricingProvider`, lendo `Preferences.pricesVisibleByDefault` do FUNCIONÁRIO.
  // O portal é irmão daquele provider de propósito (um contato de cliente não
  // carrega o contexto de um funcionário), então sem esta linha **todo valor do
  // portal sai `R$ ••••••`** — e o cliente não tem o olho da sidebar para
  // revelá-lo, porque a sidebar é interna. A tela ficaria permanentemente
  // mascarada, sem controle e sem explicação.
  //
  // O eixo inteiro não se aplica aqui: ele existe para o operador esconder preço
  // de TERCEIROS numa tela compartilhada. O contato está vendo o preço do
  // próprio orçamento, que é o documento que ele recebeu para assinar.
  //
  // É o mesmo gesto que as páginas públicas já fazem, e que o comentário de
  // `pricing-visibility.ts` autoriza nominalmente ("except the public pages,
  // which force values on for documents that are meant to be readable").
  //
  // ⚠️ MORA NA LAYOUT, e não em cada página: montado uma vez por sessão do
  // portal, restaurado ao sair. Espalhado por página, uma tela nova nasceria
  // mascarada e ninguém saberia por quê.
  useEffect(() => {
    const anterior = getPricingVisible();
    setPricingVisible(true);
    return () => setPricingVisible(anterior);
  }, []);

  const roles = responsible?.roles ?? [];
  const capabilities = capabilitiesForRoles(roles);

  const visibleNav = PORTAL_NAV.filter((item) => {
    if (item.capability && !capabilities.includes(item.capability)) return false;
    if (item.roles && !item.roles.some((r) => roles.includes(r))) return false;
    return true;
  });

  // ── A CADEIA DE ALTURA ─────────────────────────────────────────────────────
  //
  // `h-dvh` + `shrink-0` + `flex-1 min-h-0` abaixo existem para que `h-full`
  // FUNCIONE lá dentro. `DataTable` é `h-full → flex-1 min-h-0 → overflow-auto`,
  // e sem um ancestral de altura definida esse `h-full` COLAPSA PARA ZERO: a
  // tabela some, o cabeçalho fixo não gruda e a rolagem interna não acontece.
  //
  // Sem isto cada página do portal inventava o próprio número mágico
  // (`h-[calc(100dvh-9.5rem)]`), que quebra no dia em que este cabeçalho mudar
  // de altura — e ele acabou de mudar, ao ganhar a barra de abas.
  //
  // `dvh` e não `vh`: no celular a barra do navegador entra e sai, e `vh` fixa a
  // altura na maior delas, empurrando o rodapé da tabela para fora da tela.
  //
  // `min-h-0` é o par obrigatório de `flex-1`: item de flex tem `min-height:
  // auto` por padrão e se recusa a encolher abaixo do conteúdo, então sem ele a
  // rolagem vaza para a página inteira em vez de ficar na tabela.
  return (
    <div className="flex h-dvh w-full flex-col bg-background">
      <header className="shrink-0 border-b bg-card">
        <div className="mx-auto flex w-full max-w-7xl items-center justify-between gap-4 px-4 py-3">
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold">{responsible?.name}</p>
            {responsible?.companyName && (
              <p className="truncate text-xs text-muted-foreground">{responsible.companyName}</p>
            )}
          </div>

          <div className="flex shrink-0 items-center gap-1">
            <ThemeToggle />
            <Button variant="ghost" size="sm" onClick={() => void logout()} aria-label="Sair">
              <IconLogout className="h-4 w-4" />
              <span className="ml-2 hidden sm:inline">Sair</span>
            </Button>
          </div>
        </div>

        {/* `overflow-x-auto` e não quebra de linha: no celular as abas ROLAM.
            Quebrar empurraria o conteúdo da página para baixo da dobra logo na
            abertura, que é justamente onde o contato procura o que ele veio
            fazer. */}
        <nav
          aria-label="Seções do portal"
          className="mx-auto w-full max-w-7xl overflow-x-auto px-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
          <ul className="flex min-w-max items-center gap-1 pb-px">
            {visibleNav.map(({ to, label, icon: Icon, end }) => (
              <li key={to}>
                <NavLink
                  to={to}
                  end={end}
                  className={({ isActive }) =>
                    cn(
                      "flex items-center gap-2 whitespace-nowrap border-b-2 px-3 py-2 text-sm transition-colors",
                      isActive
                        ? "border-primary font-medium text-foreground"
                        : "border-transparent text-muted-foreground hover:text-foreground",
                    )
                  }
                >
                  <Icon className="h-4 w-4 shrink-0" />
                  {label}
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>
      </header>

      {/* ⚠️ `max-w-7xl` (1280 px) e não `5xl` (1024): o portal tem TABELA, e com
          1024 a lista de orçamentos cortava a última coluna enquanto sobravam
          ~440 px de margem morta de cada lado numa tela de 1900. As três faixas
          (cabeçalho, abas, conteúdo) usam a MESMA largura — se divergirem, as
          abas deixam de se alinhar com a tabela logo abaixo delas.

          ⚠️ QUEM ROLA É O <main>, DE LARGURA INTEIRA — não o contêiner centrado.
          
          Com `overflow-y-auto` no contêiner centrado, a área que rola tinha a largura do
          CONTEÚDO: com o cursor nas margens laterais a roda do mouse não
          encontrava nada rolável e a página ficava parada. Em telas largas essa
          faixa morta é a maior parte da janela.

          ⚠️ O contêiner interno é `h-full`, NÃO `flex-1`. A diferença decide quem
          rola:

            `flex-1` = "ocupe o que sobrar, e CRESÇA com o conteúdo". A tabela
            empurrava o contêiner para além da janela, a PÁGINA inteira rolava, e
            o rodapé de paginação ia para baixo da dobra — a tabela parecia
            cortada, sem fim visível.

            `h-full` = "tenha exatamente a altura do pai". A tabela recebe uma
            altura definida, se limita a ela e rola POR DENTRO, com o cabeçalho
            grudado e o rodapé sempre à vista. É o `h-full → flex-1 min-h-0 →
            overflow-auto` do `DataTable` finalmente encontrando um teto.

          Tela de CARDS (Início, detalhes) continua funcionando: o conteúdo
          transborda a caixa e é o `<main>` quem rola — e como ele tem a largura
          inteira, a roda pega em qualquer ponto da janela. */}
      {/* ⚠️ A MARGEM VERTICAL MORA NO ELEMENTO QUE ROLA, não no invólucro.
          Ela estava em `py-6` no contêiner centrado — e aquele contêiner é
          `h-full`, isto é, tem EXATAMENTE a altura do `<main>`. Numa tela de
          CARDS o conteúdo passa dele (medido em Cobranças: invólucro 942px,
          conteúdo 2985px), e a margem de baixo era pintada aos 942 — no MEIO da
          rolagem. Quem rolasse até o fim via a última linha colada na borda da
          janela, sem respiro nenhum, e a página parecia cortada em vez de
          terminada.
          Com `py-6` aqui, a margem pertence à ÁREA ROLÁVEL: ela entra na conta
          do `scrollHeight` e aparece DEPOIS do conteúdo, em qualquer altura.
          O `h-full` do invólucro continua de pé — é ele que dá teto à tabela
          das telas de lista (ver a nota logo acima). */}
      <main className="flex min-h-0 flex-1 flex-col overflow-y-auto">
        <div
          className={cn(
            "mx-auto flex w-full max-w-7xl flex-col px-4 py-6",
            // ⚠️ `h-full` dá TETO — a tabela se limita e rola por dentro.
            // `min-h-full` deixa CRESCER — a margem de baixo cai depois da
            // última linha, em vez de ser pintada no meio da rolagem. Ver
            // `ROTAS_COM_TETO` logo acima.
            // ⚠️ `shrink-0` NO RAMO QUE FLUI, e sem ele o resto não funciona:
            // este contêiner é ITEM FLEX do `<main>`, e o `flex-shrink: 1`
            // padrão o COMPRIME de volta à altura do pai. `min-h-full` sozinho
            // não salva — `min-height: 100%` também resolve para a altura do
            // pai, e o conteúdo voltava a transbordar uma caixa de 807px.
            comTeto ? "h-full" : "min-h-full shrink-0",
          )}
        >
          <Outlet />
        </div>
      </main>
    </div>
  );
};
