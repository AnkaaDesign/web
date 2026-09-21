// web/src/pages/cliente/painel.tsx
//
// INÍCIO — a única pergunta que esta tela responde é "O QUE ESPERA POR MIM".
//
// Não é um dashboard. Não há gráfico, não há histórico e não há nada que o
// contato possa apenas contemplar: cada bloco abaixo ou é uma contagem que ele
// usa para decidir onde clicar, ou é uma lista de coisas que estão paradas
// esperando um ato DELE. Tudo o mais mora nas seções da barra de navegação.
//
// ── O recorte ───────────────────────────────────────────────────────────────
//
// O que aparece depende do PAPEL, por `capabilitiesForRoles`. O servidor já
// recorta (`GET /cliente/me/resumo` devolve `preApprovals: []` a quem não
// pré-aprova), e a tela confere de novo — não por desconfiança, mas porque um
// card com título e lista vazia é pior do que card nenhum: ele afirma que existe
// um trabalho que aquela pessoa nunca poderá fazer.
//
// ⚠️ A conferência daqui NÃO é segurança. O portão que vale é o
// `@PortalCapability` da API. Ver o cabeçalho de `utils/portal-capabilities.ts`.
//
// ── Cor e rótulo de estado ──────────────────────────────────────────────────
//
// Vêm de `QUOTE_STATUS_CONFIG`, a fonte única. Já houve TRÊS mapas de cor de
// estado de orçamento nesta base e os três divergiram — "Assinado" saía verde
// numa tela e verde-água em duas outras. Este arquivo não declara cor nenhuma.
import { useMemo } from "react";
import { Link } from "react-router-dom";
import {
  IconAlertTriangle,
  IconChecklist,
  IconFilePlus,
  IconInbox,
  IconProgress,
} from "@tabler/icons-react";

import { useResponsibleAuth } from "@/contexts/responsible-auth-context";
import { usePortalSummary } from "@/api-client/portal";
import type {
  PortalSummaryBudget,
  PortalSummaryEnvelope,
  PortalSummaryVehicle,
} from "@/api-client/portal";
import {
  PORTAL_CAPABILITY,
  capabilitiesForRoles,
} from "@/utils/portal-capabilities";
import { QUOTE_STATUS_CONFIG } from "@/components/production/task/quote/quote-status-badge";
import { TASK_QUOTE_STATUS_ORDER } from "@/constants/sortOrders";
import type { TASK_QUOTE_STATUS } from "@/types/budget";
import { routes } from "@/constants/routes";
import { formatCurrency, formatDate } from "@/utils";
import { usePricingVisible } from "@/hooks/common/use-pricing-visible";

import { PageHeader } from "@/components/ui/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import {
  PortalCard,
  PortalCardSkeleton,
  PortalRowLink,
  PortalSubheading,
} from "@/components/cliente/portal-detail";

/** Rótulos dos papéis. Espelha `RESPONSIBLE_ROLE_LABELS` da API. */
const ROLE_LABELS: Record<string, string> = {
  COMMERCIAL: "Comercial",
  SELLER: "Vendedor",
  REPRESENTATIVE: "Representante",
  COORDINATOR: "Coordenador",
  PURCHASING: "Compras",
  MARKETING: "Marketing",
  FINANCIAL: "Financeiro",
  FLEET_MANAGER: "Gestor de Frota",
  DRIVER: "Motorista",
};

// =====================================================
// Peças
// =====================================================

// ⛔ AS DUAS PEÇAS QUE MORAVAM AQUI SAÍRAM, e as duas eram MOLDE DUPLICADO.
//
// `RowLink` desenhava `border border-border px-3 py-2.5`; a lista de veículos
// do orçamento desenhava `bg-muted/50 rounded-lg px-4 py-2.5`. Mesma promessa
// — "clique para abrir" —, duas peles, e o dono via as duas na mesma sessão.
// Agora é `PortalRowLink`, com a pele do `DetailRow` da casa.
//
// `SectionCard` era o QUARTO molde de card desta área (depois de `PortalCard`,
// `PortalSectionCard` e o `<Card>` cru dos veículos): mesmo cabeçalho, mesmo
// ícone à esquerda, mesmo `CardTitle` — reescritos. Agora é `PortalCard`, o
// molde único de `components/cliente/portal-detail.tsx`.

/**
 * O identificador humano do veículo do RESUMO: placa, senão série, senão o nome.
 *
 * ⚠️ `PortalSummaryVehicle` é PLANO de verdade — o `select` de `resumo` escolhe
 * `{ taskId, name, serialNumber, plate, startedAt, forecastDate, budget }` à
 * mão. Não confundir com `PortalVehicle`, cuja identidade é um GRUPO recortável
 * (`portalVehicleLabel`). São duas respostas diferentes da mesma API.
 */
function vehicleLabel(vehicle: PortalSummaryVehicle): string {
  return vehicle.plate || vehicle.serialNumber || vehicle.name || "Veículo sem identificação";
}

// =====================================================
// A tela
// =====================================================

export default function ClientePainelPage() {
  const { responsible } = useResponsibleAuth();

  const roles = useMemo(() => responsible?.roles ?? [], [responsible?.roles]);
  const capabilities = useMemo(() => capabilitiesForRoles(roles), [roles]);

  const canRequestBudget = capabilities.includes(PORTAL_CAPABILITY.REQUEST_BUDGET);
  const canWriteVehicleIdentity = capabilities.includes(
    PORTAL_CAPABILITY.WRITE_VEHICLE_IDENTITY,
  );

  /**
   * ⚠️ DINHEIRO VISÍVEL — quem LIGA é a `ResponsibleLayout`, uma vez por sessão.
   *
   * O eixo "mostrar/ocultar valores" nasce DESLIGADO (`pricing-visibility.ts`,
   * `_visible = false`) porque quem o liga no app interno é o `PricingProvider`,
   * que lê a preferência do FUNCIONÁRIO e não existe na árvore do portal. A
   * moldura do portal faz o gesto e o restaura ao desmontar; esta tela NÃO o
   * duplica — dois donos do mesmo valor global se desfazem na ordem errada e a
   * última desmontagem restaura o valor de antes da PRIMEIRA.
   *
   * O que esta tela faz é SE INSCREVER: `formatCurrency` lê a bandeira como
   * valor de módulo, fora do React, e a moldura a liga num efeito — depois do
   * primeiro render. Com a resposta já no cache do react-query não viria render
   * nenhum e os pontinhos ficariam na tela; `useSyncExternalStore` transforma a
   * virada da bandeira no gatilho do re-render.
   */
  void usePricingVisible();

  const { data, isLoading, isError, refetch, isFetching } = usePortalSummary();
  const summary = data?.data;

  /**
   * Contadores na ordem de ATENÇÃO — a mesma de `statusOrder`, que é a ordem em
   * que as listas internas já saem. Estado sem nenhum orçamento não vira tile:
   * sete zeros na frente de um número que importa é ruído.
   *
   * ⚠️ A FONTE É `budgets.byStatus`, um REGISTRO com TODAS as oito chaves
   * presentes e zeradas — não um array `statusCounts[]`. O servidor o preenche
   * assim de propósito (contador ausente viraria `undefined` na tela e "—" onde
   * deveria estar "0"); quem filtra os zeros é esta linha, e é uma decisão de
   * tela, não de dado.
   */
  const statusCounts = useMemo(() => {
    const byStatus = summary?.budgets?.byStatus ?? {};
    return (Object.entries(byStatus) as Array<[string, number]>)
      .filter(([status, count]) => count > 0 && !!QUOTE_STATUS_CONFIG[status as TASK_QUOTE_STATUS])
      .sort(
        (a, b) =>
          (TASK_QUOTE_STATUS_ORDER[a[0] as TASK_QUOTE_STATUS] ?? 99) -
          (TASK_QUOTE_STATUS_ORDER[b[0] as TASK_QUOTE_STATUS] ?? 99),
      )
      .map(([status, count]) => ({ status, count }));
  }, [summary?.budgets?.byStatus]);

  /**
   * ⚠️ `waitingOnMe`, e o grupo diz sozinho se é meu.
   *
   * `available: false` significa "este trabalho não é seu" (o servidor já nem
   * consultou) e é diferente de `total: 0` ("é seu e está vazio"). Antes a tela
   * conferia a capacidade por conta própria e lia `waitingOnYou` — um nome que a
   * resposta nunca teve, então TODOS os três grupos chegavam `undefined` e o
   * Início dizia "nada esperando por você" para quem tinha decisão parada.
   *
   * ⛔ E NÃO HÁ GRUPO DE "VEÍCULOS SEM IDENTIFICAÇÃO". O servidor não o calcula:
   * `resumo` tem `preApproval`, `signatures` e `inProduction`, e mais nada. O
   * card que existia aqui nunca desenhou uma linha. Quem responde "o que falta
   * identificar?" é a tela de Veículos, que é onde o conserto acontece — e é
   * para lá que o rodapé aponta. Relatado como lacuna da API.
   */
  const preApprovalGroup = summary?.waitingOnMe?.preApproval;
  const signatureGroup = summary?.waitingOnMe?.signatures;
  const inProductionGroup = summary?.waitingOnMe?.inProduction;

  const preApprovals: PortalSummaryBudget[] = preApprovalGroup?.available
    ? (preApprovalGroup.budgets ?? [])
    : [];
  const signatures: PortalSummaryEnvelope[] = signatureGroup?.available
    ? (signatureGroup.envelopes ?? [])
    : [];
  const inProduction: PortalSummaryVehicle[] = inProductionGroup?.available
    ? (inProductionGroup.vehicles ?? [])
    : [];

  const waitingCount = preApprovals.length + signatures.length;

  const firstName = responsible?.name?.trim().split(/\s+/)[0] ?? "";

  return (
    <div className="space-y-4">
      <PageHeader
        title={firstName ? `Olá, ${firstName}` : "Início"}
        // Empresa e PAPÉIS no subtítulo, dentro do card do cabeçalho — e não
        // numa faixa solta abaixo dele. Cada seção desta tela mora no seu card
        // contornado, e uma fileira de etiquetas flutuando entre dois cards é
        // justamente o scroll contínuo que a preferência do dono proíbe.
        //
        // Os papéis ficam à vista porque respondem sozinhos a pergunta que o
        // suporte mais recebe: "por que o fulano vê preço e eu não?".
        subtitle={
          <div className="space-y-1.5">
            {responsible?.companyName && <p>{responsible.companyName}</p>}
            {roles.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {roles.map((role) => (
                  <Badge key={role} variant="secondary">
                    {ROLE_LABELS[role] ?? role}
                  </Badge>
                ))}
              </div>
            )}
          </div>
        }
        icon={IconChecklist}
        actions={[
          {
            key: "refresh",
            label: "Atualizar",
            onClick: () => void refetch(),
            loading: isFetching,
          },
        ]}
      />

      {/* A CHAMADA PARA A REQUISIÇÃO — só para quem pode abrir uma.
          É a razão de ser do portal para o Comercial, o Vendedor, o
          Representante, o Coordenador e o Marketing do cliente; fica acima de
          tudo que é fila, porque começar um trabalho novo não pode depender de
          rolar a página até o fim. */}
      {canRequestBudget && (
        <Card className="border-primary/40 bg-primary/5">
          <CardContent className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <p className="text-base font-semibold">Precisa de um orçamento?</p>
              <p className="text-sm text-muted-foreground">
                Descreva o serviço, informe os veículos e envie as imagens de referência. Nosso
                comercial recebe na hora.
              </p>
            </div>
            <Button asChild className="shrink-0">
              <Link to={routes.customer.portal.solicitar}>
                <IconFilePlus className="mr-2 h-4 w-4" />
                Solicitar orçamento
              </Link>
            </Button>
          </CardContent>
        </Card>
      )}

      {isLoading ? (
        <PainelSkeleton />
      ) : isError ? (
        // Sem toast: o interceptor do cliente do portal já toastou o erro. O que
        // falta aqui é o caminho de volta, e toast não é caminho de volta.
        <Card>
          <CardContent>
            <EmptyState
              icon={<IconAlertTriangle className="h-10 w-10" />}
              title="Não foi possível carregar seu painel"
              description="Pode ter sido a conexão. Tente de novo em instantes."
              action={
                <Button variant="outline" onClick={() => void refetch()}>
                  Tentar de novo
                </Button>
              }
            />
          </CardContent>
        </Card>
      ) : (
        <>
          {/* ── Contadores ─────────────────────────────────────────────── */}
          <PortalCard
            icon={IconInbox}
            title="Seus orçamentos"
            description="Quantos estão em cada etapa. Clique para abrir a lista já filtrada."
          >
            {statusCounts.length === 0 ? (
              <EmptyState
                title="Nenhum orçamento ainda"
                description={
                  canRequestBudget
                    ? "Quando você solicitar o primeiro, ele aparece aqui."
                    : "Assim que houver um orçamento para a sua empresa, ele aparece aqui."
                }
              />
            ) : (
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
                {statusCounts.map(({ status, count }) => {
                  const config = QUOTE_STATUS_CONFIG[status as TASK_QUOTE_STATUS];
                  return (
                    <Link
                      key={status}
                      to={`${routes.customer.portal.orcamentos}?status=${status}`}
                      // A MESMA pele das linhas clicáveis do portal
                      // (`PortalRowLink`, e o `DetailRow` da casa antes dela):
                      // preenchida, não contornada. Contorno ao lado de
                      // preenchimento, com o mesmo papel, lê como dois
                      // componentes diferentes na mesma tela.
                      className="flex flex-col gap-2 rounded-lg bg-muted/50 px-4 py-3 transition-colors hover:bg-muted"
                    >
                      <span className="text-2xl font-bold leading-none tabular-nums">{count}</span>
                      {/* Cor e rótulo saem de `QUOTE_STATUS_CONFIG` — nunca daqui. */}
                      <Badge variant={config.variant as any} className="w-fit whitespace-nowrap">
                        {config.label}
                      </Badge>
                    </Link>
                  );
                })}
              </div>
            )}
          </PortalCard>

          {/* ── AGUARDANDO VOCÊ — O TÍTULO DENTRO DO CARD ────────────────────
              ⛔ ERA UM `<h2>` SOLTO acima dos cards, e o dono nomeou:
              *"aguardando você o título fora do card, enquanto outros ficam
              dentro, está estranho"*. "Seus orçamentos" e "Em produção" sempre
              tiveram o título DENTRO do seu card contornado — este era o único
              rótulo flutuando entre dois cards, que é justamente o rolo
              contínuo que a preferência permanente do dono (§10) proíbe.

              Os dois grupos viraram SUBGRUPOS do mesmo card, com
              `PortalSubheading` — a peça que o portal já usa para exatamente
              isso (o nome do pagador e "Notas fiscais" em Cobranças, as faces
              em Medidas, "Ordens de serviço" em Andamento). O agrupamento
              sobrevive, o título entra no card, e a tela fica com três cards em
              vez de dois cards e um rótulo órfão. */}
          <PortalCard
            icon={IconChecklist}
            title="Aguardando você"
            description="Decisões e assinaturas paradas do seu lado."
          >
            {waitingCount === 0 ? (
              <EmptyState
                icon={<IconChecklist className="h-10 w-10" />}
                title="Nada esperando por você"
                description="Nenhuma decisão e nenhuma assinatura estão paradas do seu lado."
                action={
                  canWriteVehicleIdentity ? (
                    // ⛔ O servidor NÃO manda um grupo de "veículos sem
                    // identificação" no resumo — só `preApproval`,
                    // `signatures` e `inProduction`. Quem responde "o que
                    // falta identificar?" é a tela de Veículos, que é onde o
                    // conserto acontece. Apontar para lá é honesto; desenhar
                    // aqui um card que nunca recebe linha não era.
                    <Button variant="outline" asChild>
                      <Link to={routes.customer.portal.veiculos}>
                        Conferir a identificação dos veículos
                      </Link>
                    </Button>
                  ) : undefined
                }
              />
            ) : (
              <div className="space-y-5">
                {preApprovals.length > 0 && (
                  <div className="space-y-2">
                    <PortalSubheading>Orçamentos para sua decisão</PortalSubheading>
                    <p className="text-sm text-muted-foreground">
                      Em negociação: você pode pré-aprovar para seguir, ou recusar com o motivo.
                    </p>
                    {preApprovals.map((budget) => (
                      <PortalRowLink
                        key={budget.id}
                        to={routes.customer.portal.orcamento(budget.id)}
                        title={`Orçamento ${budget.budgetNumber}`}
                        detail={[
                          budget.customer?.fantasyName ?? budget.customer?.corporateName,
                          budget.vehicleCount
                            ? `${budget.vehicleCount} ${budget.vehicleCount === 1 ? "veículo" : "veículos"}`
                            : null,
                          budget.createdAt ? `Enviado em ${formatDate(budget.createdAt)}` : null,
                        ]
                          .filter(Boolean)
                          .join(" · ")}
                        trailing={
                          // `total: null` = a pessoa não tem a seção PRICING. Um
                          // `?? 0` aqui inventaria "R$ 0,00" para o Marketing.
                          budget.total !== null && budget.total !== undefined ? (
                            <span className="text-sm font-semibold tabular-nums">
                              {formatCurrency(budget.total)}
                            </span>
                          ) : null
                        }
                      />
                    ))}
                  </div>
                )}

                {signatures.length > 0 && (
                  <div className="space-y-2">
                    <PortalSubheading>Documentos para assinar</PortalSubheading>
                    {/* ⚠️ O resumo NÃO traz `canSign` nem `blockedReason` — o
                        ⛔ PORTÃO DO PEDIDO DE COMPRA só é conhecido pela rota
                        dedicada de assinaturas, que ainda não existe. Esta lista
                        leva até a tela de Assinaturas, que é onde a pessoa pode
                        consertar; prometer "pronto para assinar" aqui seria
                        afirmar o que o servidor não disse. */}
                    <p className="text-sm text-muted-foreground">
                      Envelopes lançados no seu nome, esperando a sua assinatura.
                    </p>
                    {signatures.map((envelope) => (
                      <PortalRowLink
                        key={envelope.signerId}
                        to={routes.customer.portal.assinaturas}
                        title={
                          envelope.budget?.budgetNumber
                            ? `Orçamento ${envelope.budget.budgetNumber}`
                            : "Documento para assinar"
                        }
                        detail={
                          envelope.deadlineAt
                            ? `Assine até ${formatDate(envelope.deadlineAt)}`
                            : "Aguardando a sua assinatura"
                        }
                        trailing={<Badge variant="pending">Assinar</Badge>}
                      />
                    ))}
                  </div>
                )}
              </div>
            )}
          </PortalCard>

          {/* ── Em produção ──────────────────────────────────────────────
              `available: false` = o acompanhamento não é deste papel (é a seção
              `DELIVERY`), e aí o card não existe — em vez de um "nenhum veículo
              em produção" que soaria como informação e é recorte. */}
          {inProductionGroup?.available !== false && (
          <PortalCard
            icon={IconProgress}
            title="Em produção"
            description="O que está na oficina agora."
          >
            {inProduction.length === 0 ? (
              <EmptyState
                title="Nenhum veículo em produção"
                description="Quando um serviço começar, o andamento aparece aqui."
              />
            ) : (
              <div className="space-y-2">
                {inProduction.map((vehicle) => (
                  <PortalRowLink
                    key={vehicle.taskId}
                    to={routes.customer.portal.veiculo(vehicle.taskId)}
                    title={vehicleLabel(vehicle)}
                    detail={[
                      vehicle.budget?.budgetNumber ? `Orçamento ${vehicle.budget.budgetNumber}` : null,
                      vehicle.startedAt ? `Iniciado em ${formatDate(vehicle.startedAt)}` : null,
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                    // ⚠️ "Em produção" AQUI é contador de presente, não marco da
                    // escada: o `where` do servidor é `IN_PRODUCTION` ou
                    // "começou e não terminou". Não há monotonia a preservar em
                    // "quantos estão na fábrica hoje", e por isso este bloco não
                    // desenha marco nenhum — quem o desenha é a tela do veículo,
                    // onde a projeção monotônica vive.
                    trailing={
                      vehicle.forecastDate ? (
                        <span className="whitespace-nowrap text-sm text-muted-foreground">
                          Previsão {formatDate(vehicle.forecastDate)}
                        </span>
                      ) : null
                    }
                  />
                ))}
              </div>
            )}
          </PortalCard>
          )}
        </>
      )}
    </div>
  );
}

/**
 * O esqueleto tem a FORMA da tela cheia — três cards, não uma barra genérica.
 *
 * ⚠️ O molde do cinza é `PortalCardSkeleton`, o MESMO de Assinaturas e
 * Cobranças. Esta função desenhava o seu à mão, com outras larguras e outro
 * respiro; era a terceira cópia do mesmo retângulo no portal.
 */
function PainelSkeleton() {
  return (
    <div className="space-y-4">
      <PortalCardSkeleton rows={2} />
      <PortalCardSkeleton rows={2} />
      <PortalCardSkeleton rows={2} />
    </div>
  );
}
