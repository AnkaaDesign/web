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
// É uma barra de abas horizontal, e não a `Sidebar` interna, por duas razões:
// são poucas seções e uma sidebar seria moldura demais para elas; e a sidebar
// interna carrega `navigation.ts`, que é um catálogo de telas de FUNCIONÁRIO.
//
// ── NO CELULAR (02/10/2026) ─────────────────────────────────────────────────
//
// O portal é usado no navegador do celular. Lá a barra de abas ROLAVA de lado e
// escondia metade das seções (a 390 px só cabiam Início, Orçamentos, Solicitar
// e meio Veículos). Abaixo de `md` a navegação é uma BARRA FIXA EMBAIXO, ao
// alcance do polegar: as quatro primeiras seções e "Mais", que abre o resto
// (com o tema e o Sair). Do `md` para cima, as abas de sempre.
import { useEffect, useState } from "react";
import { NavLink, Outlet, useLocation } from "react-router-dom";
import {
  IconCar,
  IconDots,
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
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { usePortalMobile } from "@/components/cliente/use-portal-mobile";
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

/** Quantas seções cabem na barra do celular antes do "Mais". */
const BARRA_MOVEL_DIRETAS = 4;

export const ResponsibleLayout = () => {
  const { responsible, logout } = useResponsibleAuth();
  const { pathname } = useLocation();
  const mobile = usePortalMobile();
  // ⚠️ NO CELULAR NÃO HÁ TETO: a lista vira cartões, e cartões CRESCEM — quem
  // rola é a página, como em toda tela de celular. Teto com rolagem interna
  // num telefone é uma janelinha rolando dentro de outra.
  const comTeto = !mobile && telaComTeto(pathname);
  const [maisAberto, setMaisAberto] = useState(false);
  // Navegar fecha o "Mais".
  useEffect(() => setMaisAberto(false), [pathname]);

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
    <div className="portal-toque flex h-dvh w-full flex-col bg-background">
      {/* ⚠️ O SEPARADOR É UMA COSTURA, NÃO UM TRAÇO — decisão do dono, olhando o
          portal no escuro. Eram TRÊS valores empilhados em 4 pixels: a página é
          `--background` 11%, o cabeçalho é `--card` 15% e a borda cheia é
          `--border` 22%. O degrau de fundo (11→15) já separa as duas faixas
          sozinho; a borda por cima dele saltava mais 7 pontos e virava a linha
          mais clara da tela, logo acima do conteúdo que a pessoa veio ler.
          A meia opacidade a devolve a ~18% — ela some no escuro e continua
          fazendo o trabalho no claro, onde o degrau de fundo é quase nada
          (branco contra 98%). */}
      <header className="shrink-0 border-b border-border/50 bg-card">
        <div className="mx-auto flex w-full max-w-7xl items-center justify-between gap-4 px-4 py-3">
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold">{responsible?.name}</p>
            {responsible?.companyName && (
              <p className="truncate text-xs text-muted-foreground">{responsible.companyName}</p>
            )}
          </div>

          {/* No celular o tema e o Sair moram no "Mais" da barra de baixo. */}
          <div className="hidden shrink-0 items-center gap-1 md:flex">
            <ThemeToggle />
            <Button variant="ghost" size="sm" onClick={() => void logout()} aria-label="Sair">
              <IconLogout className="h-4 w-4" />
              <span className="ml-2">Sair</span>
            </Button>
          </div>
        </div>

        {/* As abas — só do `md` para cima. No celular a navegação é a barra
            fixa de baixo (ver o fim desta moldura). */}
        <nav
          aria-label="Seções do portal"
          className="mx-auto hidden w-full max-w-7xl overflow-x-auto px-2 [scrollbar-width:none] md:block [&::-webkit-scrollbar]:hidden"
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
            // `pb-24` no celular: o respiro da barra fixa de baixo, mais a área
            // segura do iPhone — senão o último cartão fica atrás dela.
            "mx-auto flex w-full max-w-7xl flex-col px-4 pt-6 pb-[calc(5.5rem+env(safe-area-inset-bottom))] md:py-6",
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

      {/* ── A BARRA DE BAIXO, SÓ NO CELULAR ─────────────────────────────── */}
      <nav
        aria-label="Seções do portal"
        className="fixed inset-x-0 bottom-0 z-40 border-t border-border/50 bg-card pb-[env(safe-area-inset-bottom)] md:hidden"
      >
        <ul className="mx-auto flex max-w-lg items-stretch justify-around">
          {(visibleNav.length > BARRA_MOVEL_DIRETAS + 1
            ? visibleNav.slice(0, BARRA_MOVEL_DIRETAS)
            : visibleNav
          ).map(({ to, label, icon: Icon, end }) => (
            <li key={to} className="flex-1">
              <NavLink
                to={to}
                end={end}
                data-touch
                className={({ isActive }) =>
                  cn(
                    "flex h-16 flex-col items-center justify-center gap-1 text-xs transition-colors",
                    isActive ? "font-medium text-primary" : "text-muted-foreground",
                  )
                }
              >
                <Icon className="h-5 w-5" />
                <span className="max-w-full truncate px-1">{label}</span>
              </NavLink>
            </li>
          ))}
          {visibleNav.length > BARRA_MOVEL_DIRETAS + 1 ? (
            <li className="flex-1">
              <button
                type="button"
                onClick={() => setMaisAberto(true)}
                aria-haspopup="dialog"
                aria-expanded={maisAberto}
                className={cn(
                  "flex h-16 w-full flex-col items-center justify-center gap-1 text-xs transition-colors",
                  visibleNav
                    .slice(BARRA_MOVEL_DIRETAS)
                    .some((item) => pathname.startsWith(item.to))
                    ? "font-medium text-primary"
                    : "text-muted-foreground",
                )}
              >
                <IconDots className="h-5 w-5" />
                Mais
              </button>
            </li>
          ) : null}
        </ul>
      </nav>

      <Sheet open={maisAberto} onOpenChange={setMaisAberto}>
        <SheetContent side="bottom" aria-describedby={undefined} className="pb-[max(1rem,env(safe-area-inset-bottom))]">
          <SheetHeader>
            <SheetTitle>Mais</SheetTitle>
          </SheetHeader>
          <ul className="mt-2 space-y-1">
            {(visibleNav.length > BARRA_MOVEL_DIRETAS + 1 ? visibleNav.slice(BARRA_MOVEL_DIRETAS) : []).map(
              ({ to, label, icon: Icon, end }) => (
                <li key={to}>
                  <NavLink
                    to={to}
                    end={end}
                    data-touch
                    className={({ isActive }) =>
                      cn(
                        "flex h-12 items-center gap-3 rounded-lg px-3 text-base",
                        isActive ? "bg-muted font-medium text-foreground" : "text-foreground hover:bg-muted",
                      )
                    }
                  >
                    <Icon className="h-5 w-5 text-muted-foreground" />
                    {label}
                  </NavLink>
                </li>
              ),
            )}
          </ul>
          <div className="mt-4 flex items-center justify-between gap-3 border-t border-border/50 pt-4">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <ThemeToggle />
              Tema
            </div>
            <Button variant="outline" className="h-11" onClick={() => void logout()}>
              <IconLogout className="mr-2 h-4 w-4" />
              Sair
            </Button>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
};
