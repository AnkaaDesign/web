// web/src/pages/cliente/veiculos/[taskId].tsx
//
// O VEÍCULO, EM TRÊS BLOCOS.
//
//   1. IDENTIFICAÇÃO — série, placa, chassi e o número do pedido de compra.
//      Editável NO LUGAR para quem tem `WRITE_VEHICLE_IDENTITY`; leitura para os
//      demais. É a metade que o cliente vem consertar: esses dados a Ankaa não
//      tem como saber. ⚠️ O número do pedido tem SUB-PORTÃO próprio
//      (`WRITE_PURCHASE_ORDER`) — o gestor de frota escreve placa e chassi e
//      NÃO o pedido, que é documento fiscal de quem o emite.
//   2. SOBRE ESTE VEÍCULO — de quem ele é, de que orçamento veio e QUANDO FICA
//      PRONTO. A previsão de entrega (`progress.forecastDate`) vinha na resposta
//      e não estava em tela nenhuma do portal, sendo *a* pergunta do cliente.
//   3. ANDAMENTO — a linha do tempo e as ordens de serviço. Projeção MONOTÔNICA
//      vinda do servidor; a tela desenha, não deriva (o porquê está em
//      `veiculo-andamento-card.tsx`).
//
// ── O molde ────────────────────────────────────────────────────────────────
//
// ⛔ NÃO É O `DetailPage`, e não pode ser: o portal é IRMÃO do `AuthProvider` e
// `ui/detailpage/*` chama `usePrivileges()`, `useFieldGate()` e
// `useAttentionField()`, que LANÇAM fora do provider. O que esta tela usa é o
// que PARECE com ele sem tocar em contexto: `PageHeader variant="detail"`,
// `ui/detail-row.tsx` e a faixa de duas colunas de
// `components/cliente/portal-detail.tsx`. Identificação e contexto dividem a
// primeira faixa; o andamento, que tem linha do tempo, tabela e miniaturas,
// fica com a largura inteira.
//
// ⛔ Altura natural na raiz. Quem rola é o `<main>` da `ResponsibleLayout`, e um
// `h-full` aqui colapsaria os cards na altura da janela.
//
// ⚠️ OS TRÊS SÃO GRUPOS RECORTÁVEIS. `veiculo.identity` só existe com a seção
// `VEHICLE`, `veiculo.progress` só com `DELIVERY`. O card da identidade não é
// montado sem a primeira — não há o que ler nem o que escrever —, e o do
// andamento tem um vazio PRÓPRIO para a segunda, porque "nenhum marco" e "você
// não vê marcos" são estados diferentes.
//
// ⛔ E NÃO HÁ `status` NO VEÍCULO. O servidor retira `Task.status` da resposta:
// é a coluna que REGRIDE. O badge ao lado do título usa `milestoneLabel`, que é
// a projeção monotônica — a única verdade sobre "em que pé está".
//
// ⚠️ A guarda de navegação cobre as saídas (voltar e migalha) porque o
// formulário desta tela é o único do portal que se perde digitado: placa e
// chassi são lidos de uma plaqueta suja no pátio, e refazer isso é uma
// caminhada até o veículo. Ela remenda `history.pushState`, então `<Link>`
// dentro dos cards também é interceptado.
import { useCallback } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { IconAlertTriangle, IconCar, IconLock } from "@tabler/icons-react";

import { usePortalVehicle, portalErrorStatus } from "@/api-client/portal";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { Skeleton } from "@/components/ui/skeleton";
import { routes } from "@/constants";
import { useResponsibleAuth } from "@/contexts/responsible-auth-context";
import { PORTAL_CAPABILITY, hasPortalCapability } from "@/utils/portal-capabilities";
import { formatPlate } from "@/utils";

import { PortalBand, PortalBandSkeleton, portalEst } from "@/components/cliente/portal-detail";
import { VeiculoAndamentoCard } from "@/components/cliente/veiculo/veiculo-andamento-card";
import { VeiculoIdentidadeCard } from "@/components/cliente/veiculo/veiculo-identidade-card";
import { VeiculoMedidasCard } from "@/components/cliente/veiculo/veiculo-medidas-card";

/**
 * ⚠️ Espelha a GRADE FINAL — faixa de duas colunas, faixa cheia.
 *
 * ⛔ E NÃO DESENHA MAIS UM CABEÇALHO FALSO. Havia um `Skeleton h-24` no topo
 * fingindo ser o `PageHeader`, e o cabeçalho DE VERDADE não depende da resposta
 * para existir: título de recuo, migalha e o botão Voltar já são conhecidos no
 * primeiro quadro. Com o cinza no lugar dele, o contato ficava sem caminho de
 * volta justamente enquanto esperava — e a tela SALTAVA quando a resposta
 * chegava, porque o cabeçalho real não tem a altura do retângulo que o imitava.
 * A tela irmã (`orcamentos/[id].tsx`) já fazia assim.
 */
function DetalheSkeleton() {
  return (
    <div className="space-y-4">
      <PortalBandSkeleton>
        <Skeleton className="h-72 w-full rounded-xl" />
        <Skeleton className="h-48 w-full rounded-xl" />
      </PortalBandSkeleton>
      <Skeleton className="h-80 w-full rounded-xl" />
    </div>
  );
}

export function ClientePortalVeiculoDetalhePage() {
  const { taskId } = useParams<{ taskId: string }>();
  const navigate = useNavigate();
  const { responsible } = useResponsibleAuth();

  const { data: response, isLoading, error, refetch, isFetching } = usePortalVehicle(taskId);
  const veiculo = response?.data;

  // DOIS PORTÕES, E O "E" ENTRE ELES É A REGRA.
  //
  // `hasPortalCapability` é o recorte de INTERFACE (some o botão que a pessoa
  // não usaria) e a seção `VEHICLE` é o que o SERVIDOR entregou sobre ESTE
  // veículo. Exigir os dois nunca oferece um botão que volta 403 — e nunca
  // oferece um formulário sem campo nenhum para preencher.
  const canWrite =
    hasPortalCapability(responsible?.roles, PORTAL_CAPABILITY.WRITE_VEHICLE_IDENTITY) &&
    !!veiculo?.identity;

  // ⛔ O SUB-PORTÃO DO NÚMERO DO PEDIDO — capacidade DIFERENTE, papel diferente.
  //
  // `WRITE_VEHICLE_IDENTITY` é do gestor de frota, que sabe placa e chassi;
  // `WRITE_PURCHASE_ORDER` é do Compras, que emite documento fiscal. Os dois
  // portões são de fato dois, e a API cobra o segundo com 403 mesmo para quem
  // passou pelo primeiro. Exigir também `canWrite` não é redundância: sem a
  // seção `VEHICLE` não há formulário nenhum onde pendurar o campo.
  const canWriteOrder =
    canWrite && hasPortalCapability(responsible?.roles, PORTAL_CAPABILITY.WRITE_PURCHASE_ORDER);

  // ⛔ A GUARDA DE NAVEGAÇÃO SAIU COM O FORMULÁRIO.
  //
  // Ela existia porque placa e chassi ficavam em rascunho até alguém apertar
  // `Salvar`, e sair da tela no meio custava uma caminhada de volta ao veículo
  // no pátio. Agora cada linha se grava no próprio duplo clique
  // (`PortalInlineField`): não há rascunho, então não há o que proteger — e
  // somem juntos o `useUnsavedChangesGuard`, o `UnsavedChangesDialog`, o
  // `guardedNavigate` e o estado `dirty` que subia do card até aqui.
  const onSaved = useCallback(() => {
    void refetch();
  }, [refetch]);

  // ── O CABEÇALHO, IGUAL NOS TRÊS ESTADOS ──────────────────────────────────
  //
  // ⛔ ELE SÓ EXISTIA NO ESTADO CHEIO. Carregando, um retângulo cinza ocupava o
  // lugar dele; com erro, a tela era um card solto no meio do nada — sem
  // migalha, sem Voltar, sem título. A tela irmã (`orcamentos/[id].tsx`) já
  // montava o cabeçalho nos três, e é o que a casa faz: o caminho de volta não
  // depende de a resposta ter chegado.
  //
  // Título, badge e subtítulo são DERIVADOS quando há veículo, e caem no rótulo
  // genérico quando não há — nunca inventam identificação.
  const identity = veiculo?.identity;
  const titulo = identity?.plate
    ? formatPlate(identity.plate)
    : identity?.serialNumber
      ? `Série ${identity.serialNumber}`
      : veiculo?.name || "Veículo";

  // O estado do veículo é o MARCO, nunca `Task.status` — ver o cabeçalho.
  const marco = veiculo ? (veiculo.cancelled ? "Cancelado" : veiculo.milestoneLabel) : null;

  const header = (
    <PageHeader
      variant="detail"
      title={titulo}
      icon={IconCar}
      status={
        marco
          ? { label: marco, variant: veiculo?.cancelled ? "destructive" : "secondary" }
          : undefined
      }
      breadcrumbs={[
        { label: "Início", href: routes.customer.portal.root },
        { label: "Veículos", href: routes.customer.portal.veiculos },
        { label: titulo },
      ]}
    />
  );

  if (isLoading) {
    return (
      <div className="space-y-4">
        {header}
        <DetalheSkeleton />
      </div>
    );
  }

  if (error || !veiculo) {
    const status = portalErrorStatus(error);
    const naoEncontrado = status === 404 || status === 403;

    return (
      <div className="space-y-4">
        {header}
        <Card>
          <CardContent>
          <EmptyState
            icon={
              naoEncontrado ? (
                <IconLock className="h-8 w-8" />
              ) : (
                <IconAlertTriangle className="h-8 w-8" />
              )
            }
            title={
              naoEncontrado
                ? "Este veículo não está disponível para você"
                : "Não foi possível carregar o veículo"
            }
            description={
              naoEncontrado
                ? "Ele pode pertencer a outra empresa ou ter saído da sua lista."
                : "Tente novamente em instantes."
            }
            action={
              <div className="flex flex-wrap justify-center gap-2">
                {/* Só faz sentido reoferecer a tentativa quando o erro é
                    transitório: num 403 ou num 404 o botão devolveria a mesma
                    resposta, e oferecê-lo sugere que insistir resolve. */}
                {!naoEncontrado && (
                  <Button variant="outline" onClick={() => void refetch()} disabled={isFetching}>
                    Tentar de novo
                  </Button>
                )}
                <Button onClick={() => navigate(routes.customer.portal.veiculos)}>
                  Voltar para os veículos
                </Button>
              </div>
            }
          />
          </CardContent>
        </Card>
      </div>
    );
  }

  // ⚠️ A faixa precisa saber ANTES se o card de contexto existe: um componente
  // que devolve `null` no render já ocupou a célula, e a coluna vizinha ficaria
  // vazia com a outra empilhada. A guarda de lá é a defensiva; esta compõe a
  // grade.
  return (
    <div className="space-y-4">
      {header}

      {/* ── A FAIXA DE DUAS COLUNAS: O VEÍCULO | O ANDAMENTO ────────────────
          Decisão do dono, com o print na mão: eram três caixas empilhadas
          (identificação, contexto ao lado, andamento inteiro embaixo) e o
          andamento — que é o que o cliente vem ver — começava abaixo da dobra.
          Agora são duas metades: à esquerda o que o veículo É e o que dele se
          corrige; à direita, em que pé ele está.

          ⚠️ AS DUAS TÊM A MESMA ALTURA. É a regra do `DetailPage` que
          `PortalBand` copia — faixa `items-stretch`, cada card com `grow`. A
          estimativa aqui só escolheria a coluna se houvesse mais de dois
          cards; com exatamente dois, ela mantém a ordem de leitura. */}
      <PortalBand
        items={[
          identity
            ? {
                node: (
                  <VeiculoIdentidadeCard
                    veiculo={veiculo}
                    canWrite={canWrite}
                    canWriteOrder={canWriteOrder}
                    onSaved={onSaved}
                  />
                ),
                // Série, placa, chassi, pedido e plaqueta, mais o subgrupo de
                // contexto que era um card à parte.
                est: portalEst({ rows: 9, blocks: 1 }),
              }
            : {
                // Sem a seção `VEHICLE` não há identidade a mostrar — e dizer
                // isso é diferente de desenhar quatro linhas "não informado",
                // que acusariam a frota de uma pendência que não existe.
                node: (
                  <Card>
                    <CardContent>
                      <EmptyState
                        icon={<IconLock className="h-8 w-8" />}
                        title="A identificação não faz parte do seu acesso"
                        description="Série, placa e chassi ficam com quem cuida da frota na sua empresa. Fale com o contato responsável pelo pedido."
                        className="py-8"
                      />
                    </CardContent>
                  </Card>
                ),
                est: portalEst({ extra: 160 }),
              },
          {
            node: (
              <VeiculoAndamentoCard progress={veiculo.progress} cancelled={veiculo.cancelled} />
            ),
            est: portalEst({
              extra:
                // Cinco marcos, mais uma linha por O.S. e outra pelo controle
                // de qualidade quando a produção fecha.
                5 * 44 + (veiculo.progress?.steps?.length ?? 0) * 40 + 40,
            }),
          },
        ]}
      />

      {/* AS MEDIDAS, embaixo da faixa e de largura inteira.
          É a ordem do trabalho do cliente: ele identifica o implemento, acompanha
          o andamento, e confere o que mediu. O card some sozinho quando nenhuma
          face foi informada — e some inteiro sem a seção `VEHICLE`, porque
          medida é dado de veículo e segue o mesmo recorte da identidade. */}
      {identity && (
        <VeiculoMedidasCard
          taskId={veiculo.id}
          measures={identity.measures}
          canWrite={canWrite}
        />
      )}
    </div>
  );
}

export default ClientePortalVeiculoDetalhePage;
