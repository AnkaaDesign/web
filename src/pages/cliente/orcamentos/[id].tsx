// web/src/pages/cliente/orcamentos/[id].tsx
//
// O DETALHE DE UM ORÇAMENTO, RECORTADO PELO PAPEL.
//
// ── O molde ────────────────────────────────────────────────────────────────
//
// ⛔ ESTA TELA NÃO PODE USAR O `DetailPage`, e a tentação é grande: ela é
// literalmente uma tela de detalhe. Mas o portal é IRMÃO do `AuthProvider`, não
// filho — `ui/detailpage/detail-page.tsx` chama `usePrivileges()` e
// `useAttentionEntity()`, `detail-section.tsx` chama `useFieldGate()`,
// `inline-edit-field.tsx` chama `useAttentionField()`, e os três LANÇAM fora do
// provider. Tela branca, não degradação. O mesmo vale para `DataTable`
// (→ `useMyPreferences`) e para `PageHeader` com `favoritePage`.
//
// A saída é PARECER com ele usando primitivos que não tocam contexto nenhum:
// `PageHeader variant="detail"` (caminho puro), `ui/detail-row.tsx` (importa só
// `react` + `cn`) e `PortalBand`, que refaz à mão a grade de faixas do
// `DetailPage` (`detail-page.tsx:343-366`): conteúdo largo em faixa cheia,
// campos escalares em duas colunas balanceadas. Ver
// `components/cliente/portal-detail.tsx`.
//
// ⛔ E NENHUMA ALTURA CALCULADA. Quem rola é o `<main>` da `ResponsibleLayout`;
// a raiz daqui é `div.space-y-4` de altura natural. `h-full` na raiz encontraria
// o `h-full` do contêiner centrado e colapsaria os cards na altura da janela.
//
// ── A regra que organiza o CONTEÚDO ────────────────────────────────────────
//
// Cada bloco é uma SEÇÃO do documento, e uma seção só é desenhada quando o
// recorte do contato a inclui. Na prática:
//
//   • MARKETING vê `LAYOUT` (e `VEHICLE`, que toda coleta carrega, e `DELIVERY`,
//     que a capacidade `TRACK` implica): identidade, veículos, A ARTE, o
//     andamento — e NENHUM valor;
//   • FINANCIAL vê tudo MENOS `LAYOUT`: serviços, preço, prazo, pagamento;
//   • FLEET_MANAGER e DRIVER veem `VEHICLE` + `DELIVERY` e NÃO ASSINAM. Para
//     eles esta tela é a identidade do documento e o andamento, sem conteúdo
//     contratual.
//
// ⛔ SÃO DUAS RÉGUAS, E ELAS NÃO SÃO A MESMA. O §2 do contrato diz "uma régua,
// dois consumidores" — e é verdade para a maioria dos papéis, mas o servidor
// precisou de `portalSectionsFor` (`sectionsForRoles` ∪ o que as CAPACIDADES
// implicam) justamente porque `sectionsForRoles(['FLEET_MANAGER'])` é `[]`, e
// vazio ali significa "não assina", não "não vê". Este arquivo consulta a régua
// da TELA para desenhar e a régua da ASSINATURA para decidir se o card de
// Assinaturas existe. Ver `components/cliente/orcamento/sections.ts`.
//
// ── Como a tela decide o que desenhar ──────────────────────────────────────
//
// ⚠️ PELA EXISTÊNCIA DO GRUPO, e não por um espelho local da régua de seções.
// O servidor entrega `services`, `pricing`, `payment`, `guarantee`, `layout`
// e `delivery` como objetos que só existem dentro do recorte — a resposta É a
// régua. O espelho (`resolvePortalSections`) fica para o que NÃO vem em grupo:
// `VEHICLE`, que muda o conteúdo do card de veículos sem apagá-lo, e o "recorte
// vazio" que decide se esta pessoa assina.
//
// ⚠️ E A PÁGINA PRECISA SABER ANTES: um card que decide sozinho devolver `null`
// resolve isso no RENDER, tarde demais para a faixa de duas colunas — o item já
// ocupou a célula, e a coluna da direita fica vazia com a esquerda empilhada.
// Por isso os booleanos abaixo repetem a guarda que cada card também tem. A do
// card é a defensiva; a daqui é a que compõe a grade.
//
// ── A ORDEM, e de quem ela é ───────────────────────────────────────────────
//
// Decisão do dono: *"parte de pagamento deveria vir depois de assinaturas"*.
// E ele está certo pelo processo — só se cobra o que já foi assinado. A ordem
// desta tela é: identidade e veículos (faixa de duas colunas), ANDAMENTO,
// Serviços, Layout, Assinaturas e por último Pagamento.
//
// O ANDAMENTO é novo aqui, e também é reclamação do dono (*"nem as ordens de
// serviço"*): o servidor já mandava `vehicles[].progress` nesta resposta e
// nenhuma tela do orçamento o desenhava. Ver `orcamento-andamento-card.tsx`.
//
// ── A decisão ──────────────────────────────────────────────────────────────
//
// Em `IN_NEGOTIATION`, quem tem `APPROVE_VALUE` decide: aprovar (vai a
// `PRE_APPROVED`) ou recusar (VOLTA a `REQUESTED`, para o comercial refazer).
// Os botões vivem no cabeçalho do card da Proposta — e NÃO no da página, porque
// o `headerExtra` do `PageHeader` mora dentro de um `hidden sm:flex` e sumiria
// no celular, que é metade das visitas do portal. Ver `pre-aprovacao-actions.tsx`
// para por que a recusa precisa dizer, com todas as letras, que não é um
// cancelamento.
import { useMemo } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { IconAlertTriangle, IconFileText, IconLock } from "@tabler/icons-react";

import { usePortalBudget, portalErrorStatus } from "@/api-client/portal";
import { useResponsibleAuth } from "@/contexts/responsible-auth-context";
import { routes } from "@/constants/routes";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { QuoteStatusBadge } from "@/components/production/task/quote/quote-status-badge";
import {
  OrcamentoAndamentoCard,
  OrcamentoAssinaturasCard,
  OrcamentoCobrancaCard,
  OrcamentoGarantiaCard,
  OrcamentoLayoutCard,
  OrcamentoDecisaoCard,
  OrcamentoPropostaCard,
  OrcamentoServicosCard,
  OrcamentoValoresCard,
  OrcamentoVeiculosCard,
  PortalBand,
  PortalBandSkeleton,
  PreAprovacaoActions,
  estOrcamentoVeiculos,
  hasPortalSection,
  orcamentoTemDecisao,
  portalEst,
  portalRoleSigns,
  resolvePortalSections,
} from "@/components/cliente/orcamento";

/**
 * ⚠️ O ESQUELETO ESPELHA A GRADE FINAL.
 *
 * Três retângulos empilhados sobre uma tela que abre em duas colunas fazem o
 * conteúdo SALTAR quando a resposta chega: ele aparece onde o cinza nunca
 * esteve. Aqui a primeira faixa já nasce com duas colunas, e as de baixo com a
 * largura inteira, como o resultado.
 */
function DetailSkeleton() {
  return (
    <div className="space-y-4">
      <PortalBandSkeleton>
        <Skeleton className="h-64 w-full rounded-xl" />
        <Skeleton className="h-48 w-full rounded-xl" />
      </PortalBandSkeleton>
      <Skeleton className="h-56 w-full rounded-xl" />
      <Skeleton className="h-40 w-full rounded-xl" />
    </div>
  );
}

export function ClientePortalOrcamentoDetalhePage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { responsible } = useResponsibleAuth();

  // ⚠️ Dinheiro visível é responsabilidade da `ResponsibleLayout` (uma vez por
  // sessão do portal), não desta tela. Ver o comentário lá.
  const { data, isLoading, isError, error, refetch, isFetching } = usePortalBudget(id);
  const budget = data?.data;

  const roles = useMemo(() => responsible?.roles ?? [], [responsible?.roles]);
  // A lista do SERVIDOR manda quando vem; o espelho local é o recuo. Ver
  // `components/cliente/orcamento/sections.ts`.
  const sections = useMemo(() => resolvePortalSections(roles, budget?.sections), [roles, budget?.sections]);

  const canSeeVehicles = hasPortalSection(sections, "VEHICLE");
  const signs = portalRoleSigns(roles);

  const backToList = () => navigate(routes.customer.portal.orcamentos);

  const titulo = budget?.budgetNumber ? `Orçamento nº ${budget.budgetNumber}` : "Orçamento";
  const header = (
    <PageHeader
      variant="detail"
      // ⚠️ O ESTADO AO LADO DO TÍTULO, e com a COR canônica do orçamento.
      //
      // A prop `status` do `PageHeader` aceita só as quatro variantes neutras de
      // `Badge`, e o estado do orçamento tem mapa de cor próprio e único
      // (`QUOTE_STATUS_CONFIG`) — "Assinado" é verde nas duas telas da casa por
      // decisão do dono. Passar o badge dentro do título preserva a cor certa
      // sem tocar em `ui/page-header.tsx`.
      title={
        budget ? (
          <span className="flex flex-wrap items-center gap-2">
            {titulo}
            <QuoteStatusBadge status={budget.status} />
          </span>
        ) : (
          titulo
        )
      }
      icon={IconFileText}
      breadcrumbs={[
        { label: "Início", href: routes.customer.portal.root },
        { label: "Orçamentos", href: routes.customer.portal.orcamentos },
        { label: titulo },
      ]}
    />
  );

  if (isLoading) {
    return (
      <div className="space-y-4">
        {header}
        <DetailSkeleton />
      </div>
    );
  }

  if (isError || !budget) {
    // ⚠️ `error._statusCode`, nunca `error.response.status` — é a convenção da
    // casa, e `portalErrorStatus` a aplica com o recuo certo.
    const status = portalErrorStatus(error);
    const forbidden = status === 403;
    const missing = status === 404;
    // Só faz sentido reoferecer a tentativa quando o erro é transitório: num 403
    // ou num 404 o botão devolveria a mesma resposta, e oferecê-lo sugere que
    // insistir resolve.
    const retriable = !forbidden && !missing;
    return (
      <div className="space-y-4">
        {header}
        <Card>
          <CardContent>
            <EmptyState
              icon={forbidden ? <IconLock className="h-8 w-8" /> : <IconAlertTriangle className="h-8 w-8" />}
              title={
                forbidden
                  ? "Este orçamento não está no seu acesso"
                  : missing
                    ? "Orçamento não encontrado"
                    : "Não foi possível abrir este orçamento"
              }
              description={
                forbidden
                  ? "O seu perfil de contato não alcança este documento. Fale com o seu contato comercial na Ankaa."
                  : missing
                    ? "O endereço pode estar velho, ou o orçamento saiu do ar."
                    : "Tente novamente em instantes."
              }
              action={
                retriable ? (
                  <Button variant="outline" onClick={() => void refetch()} disabled={isFetching}>
                    Tentar de novo
                  </Button>
                ) : undefined
              }
            />
          </CardContent>
        </Card>
      </div>
    );
  }

  /**
   * NENHUM bloco de conteúdo para este papel.
   *
   * É o caso real do Gestor de Frota e do Motorista: recorte vazio. Em vez de
   * cinco cards vazios, um aviso que diz a verdade — o perfil dele é operacional
   * (identificação e acompanhamento do veículo), e não contratual.
   */
  const hasAnyBlock =
    canSeeVehicles || !!budget.services || !!budget.payment || !!budget.layout || signs;

  // ── Quem existe nesta tela, decidido AQUI e não no render de cada card ────
  const guarantee = budget.guarantee;
  const request = budget.request;
  // Só para a estimativa de altura da faixa — quem desenha estas linhas é o
  // próprio card da Proposta.
  const delivery = budget.delivery;
  const temVeiculos =
    canSeeVehicles && ((budget.vehicles ?? []).length > 0 || budget.status === "REQUESTED");
  // Com `SERVICES` no recorte, subtotal e total são o rodapé da tabela de
  // serviços. Este card só existe para o recorte que traz preço SEM a lista.
  const temValores = !!budget.pricing && !budget.services;
  const temGarantia = !!guarantee && (guarantee.years !== null || !!guarantee.text);
  // ⛔ SÓ QUANDO HÁ DECISÃO. Era "quando há QUALQUER COISA da requisição", e o
  // briefing sozinho — o caso normal de um orçamento em REQUISIÇÃO — bastava
  // para desenhar um card completo com uma linha dentro. O briefing e a
  // logomarca foram para a Proposta, que é o card do mesmo assunto; aqui ficou
  // o carimbo de decisão, que é outro.
  const temDecisao = orcamentoTemDecisao(budget);
  const temServicos = !!budget.services && (budget.services.length > 0 || budget.status === "REQUESTED");

  return (
    <div className="space-y-4">
      {header}

      {/* ── FAIXA DE DUAS COLUNAS — o que é campo escalar ─────────────────── */}
      {/* ⚠️ CADA CARD VIAJA COM A SUA ALTURA ESTIMADA.
          A faixa não alterna mais esquerda/direita: ela põe cada card na coluna
          mais BAIXA, como `balanceColumns` (`ui/detailpage/pack-rows.ts`) faz no
          `DetailPage`. Só que aqui o número de linhas de cada card é o RECORTE
          do contato — ele muda por papel e por estado —, então quem conta as
          linhas é esta tela, que tem a resposta na mão. A estimativa decide
          COLUNA e nada mais; errar nela custa um card fora de lugar, nunca um
          card torto. */}
      <PortalBand
        items={[
          {
            node: (
              <OrcamentoPropostaCard
                budget={budget}
                actions={
                  <PreAprovacaoActions
                    budgetId={budget.id}
                    status={budget.status}
                    roles={roles}
                    canApproveValue={budget.canApproveValue}
                    // Decidido: a lista é o lugar certo para voltar — o orçamento saiu
                    // de "esperando por você" e a próxima pergunta é "o que mais falta?".
                    onDecided={backToList}
                  />
                }
              />
            ),
            // Número, Cliente, Emitido em, Validade, Veículos — sempre; depois
            // Andamento, Prazo, Paralelo, Solicitado em e Logomarca, cada um sob
            // a sua condição. O briefing é o único `block`.
            est: portalEst({
              rows:
                5 +
                (budget.milestoneLabel ? 1 : 0) +
                (delivery && delivery.customForecastDays !== null ? 1 : 0) +
                (delivery && delivery.simultaneousTasks !== null ? 1 : 0) +
                (request?.requestedAt ? 1 : 0) +
                (request?.logoName ? 1 : 0),
              blocks: request?.briefing ? 1 : 0,
            }),
          },
          temVeiculos
            ? {
                // ⛔ SEM `vehicleCount` — o contador é uma LINHA da Proposta
                // ("Veículos"), e dizê-lo de novo na descrição deste card era a
                // duplicação que o dono mandou remover.
                node: <OrcamentoVeiculosCard vehicles={budget.vehicles} status={budget.status} />,
                est: portalEst({ extra: estOrcamentoVeiculos(budget.vehicles) }),
              }
            : null,
          temValores
            ? { node: <OrcamentoValoresCard budget={budget} />, est: portalEst({ rows: 2 }) }
            : null,
          temDecisao
            ? {
                node: <OrcamentoDecisaoCard budget={budget} />,
                est: portalEst({
                  rows:
                    (request?.preApprovedAt ? 1 : 0) +
                    (request?.refusedAt ? 1 : 0) +
                    (request?.preApprovedBy?.name || request?.refusedBy?.name ? 1 : 0),
                  blocks: request?.decisionNote ? 1 : 0,
                }),
              }
            : null,
          temGarantia
            ? {
                node: <OrcamentoGarantiaCard budget={budget} />,
                est: portalEst({
                  rows: guarantee?.years !== null && guarantee?.years !== undefined ? 1 : 0,
                  blocks: guarantee?.text ? 1 : 0,
                }),
              }
            : null,
        ]}
      />

      {/* ── FAIXA CHEIA — o que é tabela, linha do tempo ou miniatura ────────
          Os cinco decidem sozinhos se existem, e a régua é a RESPOSTA:
          Andamento pela presença de `progress` em algum veículo, Serviços,
          Layout e Pagamento pela presença do grupo que o recorte do servidor
          criou, Assinaturas pelo recorte NÃO-vazio. Devolvendo `null`, não
          sobra elemento nenhum na pilha — o `space-y-4` conta elementos do DOM.

          ⛔ PAGAMENTO É O ÚLTIMO, depois de Assinaturas, por decisão do dono. */}
      <OrcamentoAndamentoCard vehicles={budget.vehicles} />
      {temServicos && <OrcamentoServicosCard budget={budget} />}
      <OrcamentoLayoutCard budget={budget} />
      <OrcamentoAssinaturasCard budgetId={budget.id} roles={roles} />
      <OrcamentoCobrancaCard budget={budget} />

      {!hasAnyBlock && (
        <Card>
          <CardContent>
            <EmptyState
              icon={<IconLock className="h-8 w-8" />}
              title="Seu perfil vê apenas o cabeçalho deste orçamento"
              description="Gestor de Frota e Motorista acompanham o veículo — série, placa, chassi e andamento — e não o conteúdo contratual. A seção Veículos do portal é onde o seu trabalho está."
            />
          </CardContent>
        </Card>
      )}
    </div>
  );
}

export default ClientePortalOrcamentoDetalhePage;
