// web/src/components/cliente/portal-detail.tsx
//
// O MOLDE ÚNICO DAS TELAS DE DETALHE DO PORTAL.
//
// ⛔ HAVIA TRÊS MOLDES CONCORRENTES, e o dono viu os três na mesma sessão:
// `PortalCard` (orçamento), `PortalSectionCard` (cobranças/pedidos, com título
// `font-semibold` em vez do `font-medium` da casa) e `<Card>` cru montado à mão
// nos cards de veículo. Três cabeçalhos, três corpos de letra, três respiros —
// numa área que tem SEIS telas. Agora é um só, e os outros dois delegam aqui.
//
// ⛔ E NÃO É O `DetailPage`. O portal é IRMÃO do `AuthProvider`, não filho:
// `ui/detailpage/*` chama `usePrivileges()`, `useFieldGate()` e
// `useAttentionEntity()`, e os três LANÇAM fora do provider — tela branca. O
// mesmo vale para `DataTable` (→ `useMyPreferences`) e para `PageHeader` com
// `favoritePage`. A saída não é usar o componente: é PARECER com ele usando
// primitivos que não tocam em contexto nenhum. `DetailRow` (`ui/detail-row.tsx`)
// importa só `react` + `cn` — é a linha rótulo/valor da casa, e é ela que faz
// estas telas lerem como as do lado funcionário.
//
// ── A GRADE ────────────────────────────────────────────────────────────────
//
// O `DetailPage` desenha faixas: seção larga ocupa a faixa inteira, e cada
// corrida de seções de meia largura vira duas colunas balanceadas
// (`ui/detailpage/detail-page.tsx:343-366`). `PortalBand` é essa regra à mão,
// com a mesma normalização: card de meia largura SOZINHO na faixa vira faixa
// cheia, em vez de um card torto com uma coluna vazia ao lado.
//
// ⛔ NENHUMA ALTURA CALCULADA, NENHUMA SEGUNDA ÁREA ROLÁVEL. Quem rola é o
// `<main>` da `ResponsibleLayout` (`layouts/responsible-layout.tsx:233`), de
// largura inteira. Um `calc(100dvh-Nrem)` aqui quebraria no dia em que o
// cabeçalho do portal mudar de altura — e ele já mudou uma vez, ao ganhar as
// abas. Altura natural, transborda, o `<main>` rola.
//
// ── ⚠️ A REGRA DO ÍCONE — UMA SÓ, PARA TODO O PORTAL ───────────────────────
//
// **O ÍCONE É DO CARD. A LINHA RÓTULO/VALOR NUNCA TEM ÍCONE.**
//
// O dono viu o sintoma: na Proposta só "Emitido em" tinha calendário, e
// "Número", "Cliente", "Validade", "Veículos" e "Andamento" não tinham — um
// ícone solitário no meio de cinco linhas nuas lê como erro, não como ênfase.
//
// A régua é o que a casa já faz. A tela de detalhe canônica
// (`components/production/task/detail/task-detail-page.tsx`) declara ícone em
// TODAS as suas SEÇÕES (`IconClipboardList`, `IconCalendarEvent`,
// `IconReceipt2`, `IconCash`, `IconListCheck`, …) e em NENHUM dos seus 40
// campos. O mesmo nos cards rótulo/valor escritos à mão do Departamento
// Pessoal (`benefit-info-card`, `admission/detail/user-card`,
// `termination/detail/summary-card`, `vacation-summary-card`,
// `user-benefit-info-cards`, `a1-certificate-card`): título do card com
// assunto, linhas sem ícone nenhum.
//
// Então, aqui: todo `PortalCard` recebe `icon`; nenhum `DetailRow` recebe. O
// `icon` opcional de `ui/detail-row.tsx` continua existindo para o lado
// funcionário — no portal ele não é usado.
import { Fragment, isValidElement, type ReactNode } from "react";
import type { Icon as TablerIcon } from "@tabler/icons-react";
import { Link } from "react-router-dom";
import { IconChevronRight } from "@tabler/icons-react";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

export interface PortalCardProps {
  icon?: TablerIcon;
  title: ReactNode;
  description?: ReactNode;
  /** Ações do canto superior direito (os botões de decisão, por exemplo). */
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
  contentClassName?: string;
  /** Some com o respiro interno quando o conteúdo é uma tabela de ponta a ponta. */
  flush?: boolean;
}

/**
 * UM BLOCO DA TELA.
 *
 * ⚠️ O título é `CardTitle` — `text-base font-medium`, o mesmo de TODO card da
 * casa. Era `font-semibold` num dos moldes antigos, e a diferença aparecia
 * lado a lado na mesma tela de cobranças.
 */
export function PortalCard({
  icon: Icon,
  title,
  description,
  actions,
  children,
  className,
  contentClassName,
  flush = false,
}: PortalCardProps) {
  return (
    // ⚠️ `grow` + `CardContent flex-1` é o que permite ESTICAR até a altura do
    // vizinho de faixa — a mesma dupla de `ui/detailpage/detail-section.tsx:134`
    // e `:151`. Fora de um contêiner flex (faixa cheia, `space-y-4`) as duas
    // classes são inertes e o card fica na altura natural, como sempre esteve.
    // O conteúdo continua alinhado ao TOPO: o corpo é fluxo normal dentro do
    // `CardContent`, então a sobra vira respiro embaixo, não vão no meio.
    <Card className={cn("flex min-w-0 grow flex-col", className)}>
      {/* ⚠️ `items-center` QUANDO HÁ AÇÃO, e não `items-start`.
          O dono viu o sintoma: "Abrir veículo" pousava mais baixo que a palavra
          "Veículos" ao lado. Com `items-start`, título e botão encostam pelo
          TOPO — e como o botão é mais alto que uma linha de texto, o texto
          parece subir. Centrado, os dois compartilham a mesma linha de base
          óptica, que é o que o olho espera de um cabeçalho.

          Sem ação, `items-start` continua valendo: aí o que se alinha é o ícone
          com a primeira linha do título, e centrar afastaria o ícone de um
          título de duas linhas. */}
      <CardHeader
        className={cn(
          "flex flex-col gap-3 space-y-0 pb-3 sm:flex-row sm:justify-between",
          actions ? "sm:items-center" : "sm:items-start",
        )}
      >
        <div className="flex min-w-0 items-start gap-2">
          {Icon && <Icon className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />}
          <div className="min-w-0 space-y-1">
            <CardTitle>{title}</CardTitle>
            {description ? <CardDescription>{description}</CardDescription> : null}
          </div>
        </div>
        {actions ? <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div> : null}
      </CardHeader>
      <CardContent className={cn("flex-1", flush ? "p-0" : "pt-0", contentClassName)}>
        {children}
      </CardContent>
    </Card>
  );
}

/**
 * A PILHA DE `DetailRow`.
 *
 * `space-y-2` é o mesmo respiro do detalhe canônico da casa (ver o exemplo no
 * cabeçalho de `ui/detail-row.tsx`). Existe para que nenhuma tela invente o
 * próprio.
 */
export function PortalRows({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("space-y-2", className)}>{children}</div>;
}

/**
 * O traço de "não informado" — o MESMO de `detail-row.tsx:94`, itálico incluso.
 *
 * ⚠️ O itálico não é enfeite: é o que separa, numa varredura, o vazio do valor
 * curto de verdade ("—" como resposta do cliente). Este componente estava sem
 * ele e o `DetailRow` com ele, na mesma tela.
 */
export function PortalDash() {
  return <span className="italic text-muted-foreground">—</span>;
}

/**
 * UM RÓTULO DE SUBGRUPO dentro de um card (o nome do pagador, "Notas fiscais").
 *
 * ⚠️ `text-sm`, nunca menor: rótulo não pode encolher abaixo do controle ao
 * lado (§10). Quem encolhe é a COR.
 */
export function PortalSubheading({ children, className }: { children: ReactNode; className?: string }) {
  return <p className={cn("text-sm font-medium text-foreground", className)}>{children}</p>;
}

// ── A ESTIMATIVA DE ALTURA ─────────────────────────────────────────────────
//
// As MESMAS constantes de `ui/detailpage/pack-rows.ts:26-30`, e pela mesma
// razão: a estimativa só decide EM QUAL COLUNA o card cai. Ela nunca é aplicada
// como altura, e errar nela custa um card fora de lugar — nunca um card torto.
/** Uma linha rótulo/valor (`DetailRow` inline), com o respiro. */
export const PORTAL_PX_FIELD = 38;
/** Um campo `block` — texto longo, lista, miniatura. */
export const PORTAL_PX_BLOCK = 64;
/** `CardHeader` (título + descrição) + os respiros do card. */
export const PORTAL_CARD_CHROME = 96;
/** O `gap-4` entre dois cards empilhados na mesma coluna. */
const PORTAL_GAP = 16;

/**
 * A altura ESTIMADA de um card do portal.
 *
 * `rows` conta `DetailRow` inline, `blocks` conta `DetailRow block`, e `extra` é
 * o que não é nem um nem outro (uma lista de links, uma tabela, uma escada) —
 * o equivalente ao `RENDER_ALLOWANCE` de `pack-rows.ts`, só que medido pelo
 * chamador, que é quem sabe quantas linhas a resposta trouxe.
 */
export function portalEst({
  rows = 0,
  blocks = 0,
  extra = 0,
}: {
  rows?: number;
  blocks?: number;
  extra?: number;
} = {}): number {
  const body = rows * PORTAL_PX_FIELD + blocks * PORTAL_PX_BLOCK + extra;
  return PORTAL_CARD_CHROME + Math.max(body, PORTAL_PX_FIELD);
}

/**
 * Um item da faixa: o card, ou o card COM a sua estimativa de altura.
 *
 * Sem estimativa o item cai na altura neutra e a faixa degrada exatamente para
 * a alternância antiga — nenhuma tela quebra por não ter sido convertida.
 */
export type PortalBandItem = ReactNode | { node: ReactNode; est: number };

/** Elemento React é objeto; só o par `{ node, est }` tem a chave `node`. */
function unpack(item: PortalBandItem): { node: ReactNode; est: number } {
  if (
    typeof item === "object" &&
    item !== null &&
    !isValidElement(item) &&
    "node" in (item as Record<string, unknown>)
  ) {
    return item as { node: ReactNode; est: number };
  }
  // A altura neutra é a de um card de quatro linhas — com TODOS os itens
  // neutros, "cai na coluna mais baixa" resolve para esquerda/direita/esquerda,
  // que é a alternância de antes.
  return { node: item as ReactNode, est: portalEst({ rows: 4 }) };
}

/**
 * A FAIXA DE MEIA LARGURA — duas colunas balanceadas POR ALTURA a partir do `lg`.
 *
 * ⛔ ERA ALTERNÂNCIA PURA (`index % 2`), e o dono viu o resultado: Proposta e
 * "A requisição" empilhadas à esquerda, "Veículos" sozinho à direita com uma
 * linha, e uns 400px de nada embaixo dele. Alternar só balanceia quando os
 * cards têm a mesma altura, e nesta tela eles nunca têm — o número de linhas de
 * cada card é o RECORTE do contato, que muda por papel e por estado.
 *
 * Agora é a regra do sistema: `balanceColumns` (`ui/detailpage/pack-rows.ts`)
 * coloca cada card, NA ORDEM DE LEITURA, na coluna que estiver mais BAIXA no
 * momento, usando altura estimada por contagem de campos. Mesmas constantes,
 * mesmo critério.
 *
 * ⚠️ E AS DUAS COLUNAS TÊM A MESMA ALTURA. Decisão do dono, com o print na mão:
 * *"ter a mesma altura, em todos os casos"*. Balancear por estimativa escolhe a
 * coluna; ela nunca fecha a diferença sozinha, porque as linhas reais nunca têm
 * a altura estimada. Quem fecha é o layout, e é o mesmo do `DetailPage`
 * (`ui/detailpage/detail-page.tsx:343-366`): a faixa é `flex items-stretch`,
 * cada coluna é `flex min-w-0 flex-1 flex-col`, e cada card cresce (`grow` +
 * `CardContent flex-1`, ver `PortalCard`) até a altura do mais alto. A sobra
 * vira respiro EMBAIXO do conteúdo — o corpo continua encostado no topo.
 *
 * E a MESMA normalização de antes: card sozinho na faixa vira faixa cheia, em
 * vez de meia coluna com um vão ao lado. Isso acontece de verdade e com
 * frequência — o recorte do contato de MARKETING apaga preço, prazo e garantia
 * de uma vez.
 */
export function PortalBand({ items, className }: { items: PortalBandItem[]; className?: string }) {
  const cards = items
    .map(unpack)
    .filter(({ node }) => node !== null && node !== undefined && node !== false);
  if (cards.length === 0) return null;
  if (cards.length === 1) return <>{cards[0].node}</>;

  const left: ReactNode[] = [];
  const right: ReactNode[] = [];
  let lh = 0;
  let rh = 0;
  for (const { node, est } of cards) {
    if (lh <= rh) {
      lh += (left.length ? PORTAL_GAP : 0) + est;
      left.push(node);
    } else {
      rh += (right.length ? PORTAL_GAP : 0) + est;
      right.push(node);
    }
  }

  return (
    // ⛔ `flex`, não `grid`: a coluna precisa ser um contêiner flex para o `grow`
    // do card valer. Abaixo do `lg` as duas colunas empilham (`flex-col`) e cada
    // card volta à altura natural — esticar no celular não significa nada,
    // porque lá não há vizinho ao lado.
    <div className={cn("flex flex-col items-stretch gap-4 lg:flex-row", className)}>
      {[left, right].map((col, ci) => (
        <div key={ci} className="flex min-w-0 flex-1 flex-col gap-4">
          {/* ⚠️ `Fragment`, e não um `div` embrulhando cada card: um nó a mais
              aqui seria o filho flex da coluna, e o `grow` do card pararia nele
              — o card voltaria à altura natural dentro de um invólucro esticado. */}
          {col.map((card, index) => (
            <Fragment key={index}>{card}</Fragment>
          ))}
        </div>
      ))}
    </div>
  );
}

/**
 * O ESQUELETO DA FAIXA DE DUAS COLUNAS.
 *
 * ⚠️ Espelha a GRADE FINAL, e não três retângulos empilhados. O esqueleto que
 * não espelha o resultado faz a tela SALTAR quando a resposta chega — o
 * conteúdo aparece onde o cinza nunca esteve.
 */
export function PortalBandSkeleton({ children }: { children: ReactNode }) {
  return <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-2">{children}</div>;
}

/**
 * UMA LINHA QUE LEVA A ALGUM LUGAR — dentro de um card.
 *
 * ⛔ HAVIA DUAS PELES PARA A MESMA COISA, e as duas na mesma sessão: a lista de
 * veículos do orçamento usava `bg-muted/50 rounded-lg px-4 py-2.5` (a pele do
 * `DetailRow` da casa) e as três listas do Início usavam
 * `border border-border px-3 py-2.5`. Uma linha contornada ao lado de uma linha
 * preenchida, com o mesmo papel — "clique para abrir" —, lê como dois
 * componentes diferentes.
 *
 * Venceu a do `DetailRow` (`ui/detail-row.tsx:68-75`): é a linha rótulo/valor
 * de toda tela de detalhe do lado funcionário, e é o que faz um card do portal
 * pertencer visualmente ao card de campos ao lado dele.
 *
 * `title` é a linha de cima (o identificador), `detail` a de baixo (o contexto)
 * e `trailing` o que fica preso à direita — badge, data, o que for. A seta é
 * sempre a última coisa: ela é a promessa de que a linha navega.
 */
export function PortalRowLink({
  to,
  title,
  detail,
  trailing,
  className,
}: {
  to: string;
  title: ReactNode;
  detail?: ReactNode;
  trailing?: ReactNode;
  className?: string;
}) {
  return (
    <Link
      to={to}
      className={cn(
        "flex items-center justify-between gap-3 rounded-lg bg-muted/50 px-4 py-2.5 transition-colors hover:bg-muted",
        className,
      )}
    >
      <div className="min-w-0 space-y-0.5">
        <div className="truncate text-sm font-medium text-foreground">{title}</div>
        {detail ? <div className="truncate text-sm text-muted-foreground">{detail}</div> : null}
      </div>
      <div className="flex shrink-0 items-center gap-2">
        {trailing}
        <IconChevronRight className="h-4 w-4 text-muted-foreground" aria-hidden />
      </div>
    </Link>
  );
}

/**
 * O ESQUELETO DE UM CARD DO PORTAL.
 *
 * ⛔ Assinaturas e Cobranças desenhavam este mesmo retângulo à mão, cada uma com
 * a sua cópia (`Card > CardContent.space-y-3.py-6` + três `Skeleton` de larguras
 * escolhidas ali). Duas cópias do mesmo cinza é como duas telas irmãs começam a
 * divergir sem ninguém decidir nada.
 *
 * ⚠️ Ele tem a FORMA do card cheio — cabeçalho, descrição, corpo —, e não uma
 * barra genérica: esqueleto que não espelha o resultado faz a tela saltar
 * quando a resposta chega.
 */
export function PortalCardSkeleton({ rows = 2 }: { rows?: number }) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <Skeleton className="h-5 w-48" />
        <Skeleton className="mt-2 h-4 w-72 max-w-full" />
      </CardHeader>
      <CardContent className="space-y-2 pt-0">
        {Array.from({ length: rows }, (_, index) => (
          <Skeleton key={index} className="h-12 w-full" />
        ))}
      </CardContent>
    </Card>
  );
}

/**
 * A FALHA QUE FICA NA TELA, com o caminho de volta ao lado.
 *
 * ⛔ HAVIA DUAS FORMAS PARA ESTA MESMA FAIXA: `<Alert variant="destructive">`
 * (Assinaturas, Cobranças) e um `div.rounded-lg.border-destructive/40` montado à
 * mão (Orçamentos, Veículos, Pedidos). A segunda reimplementava a primeira com
 * outra borda e outro fundo — e `ui/alert.tsx` importa só `react`, `cn` e
 * ícones, então nunca houve motivo de contexto para evitá-la.
 *
 * ⚠️ O interceptor de `api-client/portal.ts` JÁ toastou a falha. O que esta
 * faixa acrescenta é permanência e caminho: um toast some em 8 segundos e a
 * lista vazia por baixo dele parece "você não tem nada", que é a resposta errada
 * mais crível possível.
 */
export function PortalErrorBanner({
  message,
  onRetry,
  retrying,
}: {
  message: ReactNode;
  onRetry?: () => void;
  retrying?: boolean;
}) {
  return (
    <Alert variant="destructive">
      <AlertDescription className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <span>{message}</span>
        {onRetry ? (
          <Button
            variant="outline"
            size="sm"
            className="shrink-0"
            onClick={onRetry}
            disabled={retrying}
          >
            Tentar de novo
          </Button>
        ) : null}
      </AlertDescription>
    </Alert>
  );
}
