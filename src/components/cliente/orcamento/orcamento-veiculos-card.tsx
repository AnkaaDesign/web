// web/src/components/cliente/orcamento/orcamento-veiculos-card.tsx
//
// OS VEÍCULOS — seção `VEHICLE`.
//
// Um orçamento cobre N caminhões, e é por eles que o cliente reconhece o
// documento. Daqui se chega à tela do veículo, que é onde moram a plaqueta, as
// medidas, a arte e a linha do tempo.
//
// ── ⛔ ERA UMA LISTA DE LINKS AO LADO DE UM CARD DE CAMPOS ──────────────────
//
// O dono, com o print na mão: *"faça o card dos veículos parecer mais com o de
// orçamento, e ter a mesma altura, em todos os casos"*. Eram duas peles na mesma
// faixa — a Proposta é uma pilha de `DetailRow` (rótulo à esquerda, valor à
// direita em `font-semibold`, `bg-muted/50 rounded-lg px-4 py-2.5`) e este card
// era uma lista de linhas-link com badge. Mesma faixa, dois componentes.
//
// Agora é a MESMA pilha:
//
//   • COM UM VEÍCULO — o caso mais comum — as linhas de identidade são
//     desenhadas DIRETO no card, sem cabeçalho nenhum e sem acordeão. O card
//     passa a ter de três a oito linhas rótulo/valor, que é a mesma contagem da
//     Proposta ao lado, e o vão de ~400px que o dono viu embaixo dele some.
//     A navegação vira o botão "Abrir veículo" do canto do cabeçalho
//     (`PortalCard.actions`), porque com um caminhão só existe UM destino.
//   • COM VÁRIOS, um bloco por veículo: a linha-link (`PortalRowLink`) com o
//     rótulo que o cliente usa ao telefone — SÉRIE · PLACA —, e sob ela as três
//     linhas de identidade. A linha-link continua sendo `<a>` porque ali o que
//     se oferece é um DESTINO, não um dado a comparar.
//
// ⚠️ A ALTURA IGUAL NÃO É DAQUI. Quem iguala é a faixa (`PortalBand`), que
// agora é `flex items-stretch` com colunas `flex min-w-0 flex-1 flex-col` — a
// mesma regra de `ui/detailpage/detail-page.tsx:343-366`. Este arquivo só deixa
// de ser o card curto da faixa.
//
// ── ⚠️ SÉRIE, PLACA E CHASSI APARECEM SEMPRE ───────────────────────────────
//
// Decisão do dono: *"mostrar série, chassi e placa mesmo que como -"*. Antes o
// card escondia o que não tinha e escrevia "Chassi não informado" em prosa, no
// meio de uma linha de contexto — três formas diferentes de dizer "vazio" na
// mesma tela. Agora as três linhas existem sempre e o vazio é o traço itálico do
// `DetailRow` (`ui/detail-row.tsx:94`), que é o traço da casa inteira.
//
// Por isso também saiu o badge "Falta série, placa": ele dizia, com um alerta
// laranja, exatamente o que os traços agora dizem em três linhas.
//
// ⚠️ A IDENTIDADE É UM GRUPO, NÃO CAMPOS SOLTOS. `vehicle.identity` é
// `undefined` quando o contato não tem a seção `VEHICLE` — e essa é a diferença
// entre "este caminhão não tem placa" e "você não vê placa nenhuma". SEM o
// grupo não se desenha linha vazia nenhuma: o card mostra o que puder (o marco,
// a previsão) e nada mais. Inventar três traços ali transformaria um recorte de
// privilégio num relatório de pendências falso.
//
// ⚠️ ANDAMENTO e PREVISÃO são da seção `DELIVERY`, não da `VEHICLE`: quem vê o
// caminhão não necessariamente vê o prazo. `milestoneLabel` vem pronto do
// servidor e é PROJEÇÃO MONOTÔNICA — um marco atingido não regride, ainda que o
// carimbo de produção seja apagado (O.S. → `PENDING` zera datas, e
// `COMPLETED → PREPARATION` é transição legal). A tela nunca recalcula isso.
//
// ⛔ E NÃO EXISTE `Task.status` aqui. O servidor o RETIRA da resposta de
// propósito: é a coluna que regride, e devolvê-la ao lado de uma escada
// monotônica seria publicar duas verdades. Nem `Task.term`, que é prazo INTERNO
// — o que sai para o cliente é a PREVISÃO.
//
// ⛔ E NÃO HÁ MAIS "N veículos neste orçamento" no cabeçalho. O contador já é
// uma linha da Proposta ("Veículos"), ao lado de Número, Cliente e Validade —
// dizê-lo duas vezes na mesma faixa era o primeiro dos três pedidos do dono.
import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { IconCar, IconChevronRight } from "@tabler/icons-react";

import type { PortalVehicle } from "@/api-client/portal";
import { portalIdentityOf } from "@/api-client/portal";
import { routes } from "@/constants/routes";
import {
  IMPLEMENT_TYPE_LABELS,
  TRUCK_CATEGORY_LABELS,
  type IMPLEMENT_TYPE,
  type TRUCK_CATEGORY,
} from "@/constants";
import { formatDate } from "@/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DetailRow } from "@/components/ui/detail-row";
import { EmptyState } from "@/components/ui/empty-state";
import {
  PORTAL_PX_BLOCK,
  PORTAL_PX_FIELD,
  PortalCard,
  PortalRowLink,
  PortalRows,
} from "../portal-detail";
import { vehicleChipLabel } from "./vehicle-chips";

/** O implemento e a categoria, já com o rótulo humano da casa. */
function implementoECategoria(vehicle: PortalVehicle): { implemento: string | null; categoria: string | null } {
  const identity = portalIdentityOf(vehicle);
  return {
    implemento: identity?.implementType
      ? (IMPLEMENT_TYPE_LABELS[identity.implementType as IMPLEMENT_TYPE] ?? identity.implementType)
      : null,
    categoria: identity?.category
      ? (TRUCK_CATEGORY_LABELS[identity.category as TRUCK_CATEGORY] ?? identity.category)
      : null,
  };
}

/** O número do pedido do cliente — o dele primeiro, o nosso vínculo depois. */
function pedidoDe(vehicle: PortalVehicle): string | null {
  const identity = portalIdentityOf(vehicle);
  return identity?.customerOrderNumber || identity?.purchaseOrder?.number || null;
}

/**
 * Texto em `tabular-nums`; vazio devolve `undefined` e o `DetailRow` desenha o traço.
 *
 * ⛔ É FUNÇÃO CHAMADA, e NÃO um componente escrito como elemento JSX. Um
 * elemento nunca é `undefined` — nem o que renderiza `undefined` —, e o
 * `value ?? traço` de `ui/detail-row.tsx:94` simplesmente não dispararia: as
 * linhas de Placa e Chassi ficariam EM BRANCO, o contrário exato do pedido.
 * O defeito é invisível no `tsc` e invisível na tela até faltar o dado.
 */
function codigo(value: string | null | undefined): ReactNode {
  return value?.trim() ? <span className="tabular-nums">{value}</span> : undefined;
}

/**
 * AS TRÊS LINHAS DE IDENTIDADE — sempre as três, traço quando vazias.
 *
 * ⚠️ Sem o grupo `identity` não sai linha nenhuma: ver o cabeçalho.
 */
function IdentidadeRows({ vehicle }: { vehicle: PortalVehicle }) {
  const identity = portalIdentityOf(vehicle);
  if (!identity) return null;
  return (
    <>
      <DetailRow label="Série" value={codigo(identity.serialNumber)} />
      <DetailRow label="Placa" value={codigo(identity.plate)} />
      <DetailRow label="Chassi" value={codigo(identity.chassisNumber)} />
    </>
  );
}

/**
 * O QUE UM VEÍCULO SOZINHO MOSTRA — identidade, o que ele é, e o prazo.
 *
 * As condicionais são as mesmas de sempre: implemento e categoria só existem com
 * a seção `VEHICLE`, marco e previsão só com a `DELIVERY`.
 */
function VeiculoUnicoRows({ vehicle }: { vehicle: PortalVehicle }) {
  const { implemento, categoria } = implementoECategoria(vehicle);
  const pedido = pedidoDe(vehicle);
  const previsao = vehicle.progress?.forecastDate ?? null;

  return (
    <PortalRows>
      <IdentidadeRows vehicle={vehicle} />
      {implemento ? <DetailRow label="Implemento" value={implemento} /> : null}
      {categoria ? <DetailRow label="Categoria" value={categoria} /> : null}
      {pedido ? <DetailRow label="Pedido" value={codigo(pedido)} /> : null}
      {vehicle.milestoneLabel ? <DetailRow label="Andamento" value={vehicle.milestoneLabel} /> : null}
      {previsao ? (
        <DetailRow label="Previsão" value={<span className="tabular-nums">{formatDate(previsao)}</span>} />
      ) : null}
      {vehicle.cancelled ? (
        <DetailRow
          label="Situação"
          value={
            <Badge variant="destructive" size="sm" className="font-normal">
              Cancelado
            </Badge>
          }
        />
      ) : null}
    </PortalRows>
  );
}

/**
 * A ALTURA ESTIMADA DESTE CARD — só para o `PortalBand` escolher a coluna.
 *
 * ⚠️ A estimativa nunca vira altura aplicada; ela decide EM QUAL COLUNA o card
 * cai, e errar nela custa um card fora de lugar, nunca um card torto. Ver
 * `portalEst` em `portal-detail.tsx`.
 */
export function estOrcamentoVeiculos(vehicles: PortalVehicle[] | undefined): number {
  const list = vehicles ?? [];
  if (list.length === 0) return PORTAL_PX_BLOCK * 2;

  if (list.length === 1) {
    const vehicle = list[0];
    const { implemento, categoria } = implementoECategoria(vehicle);
    const linhas =
      (portalIdentityOf(vehicle) ? 3 : 0) +
      (implemento ? 1 : 0) +
      (categoria ? 1 : 0) +
      (pedidoDe(vehicle) ? 1 : 0) +
      (vehicle.milestoneLabel ? 1 : 0) +
      (vehicle.progress?.forecastDate ? 1 : 0) +
      (vehicle.cancelled ? 1 : 0);
    return Math.max(1, linhas) * PORTAL_PX_FIELD;
  }

  // Um bloco por veículo: a linha-link (duas linhas de texto) e as três de
  // identidade, mais o respiro entre blocos.
  return list.reduce(
    (total, vehicle) =>
      total + PORTAL_PX_BLOCK + (portalIdentityOf(vehicle) ? 3 * PORTAL_PX_FIELD : 0) + 16,
    0,
  );
}

export function OrcamentoVeiculosCard({
  vehicles,
  /** Só o estado `REQUESTED` ganha vazio; ver abaixo. */
  status,
}: {
  vehicles: PortalVehicle[] | undefined;
  status?: string;
}) {
  const list = vehicles ?? [];

  // ⛔ SEM CAMINHÃO E SEM NOTÍCIA, SEM CARD — o sistema não desenha seção vazia.
  // A EXCEÇÃO é a requisição recém-aberta: ali "ainda não foram cadastrados" é
  // a resposta honesta, e calá-la deixaria a tela parecendo incompleta.
  if (list.length === 0 && status !== "REQUESTED") return null;

  if (list.length === 0) {
    return (
      <PortalCard icon={IconCar} title="Veículos">
        <EmptyState
          className="py-8"
          icon={<IconCar className="h-8 w-8" />}
          title="Nenhum veículo ainda"
          description="A requisição foi aberta e os veículos ainda não foram cadastrados."
        />
      </PortalCard>
    );
  }

  // ── UM SÓ: as linhas direto no card, e o destino no cabeçalho ─────────────
  if (list.length === 1) {
    const vehicle = list[0];
    return (
      <PortalCard
        icon={IconCar}
        title="Veículos"
        actions={
          <Button variant="outline" size="sm" asChild>
            <Link to={routes.customer.portal.veiculo(vehicle.id)} className="gap-1">
              Abrir veículo
              <IconChevronRight className="h-4 w-4" aria-hidden />
            </Link>
          </Button>
        }
      >
        <VeiculoUnicoRows vehicle={vehicle} />
      </PortalCard>
    );
  }

  // ── VÁRIOS: um bloco por veículo ──────────────────────────────────────────
  return (
    <PortalCard icon={IconCar} title="Veículos">
      <div className="space-y-4">
        {list.map((vehicle) => {
          const { implemento, categoria } = implementoECategoria(vehicle);
          const pedido = pedidoDe(vehicle);
          const previsao = vehicle.progress?.forecastDate ?? null;
          // A linha de contexto do bloco: o que o caminhão É e o número que o
          // cliente mesmo emitiu. Série, placa e chassi estão nas linhas de
          // baixo — aqui elas só repetiriam.
          const contexto = [implemento, categoria, pedido ? `Pedido ${pedido}` : null].filter(
            (part): part is string => !!part,
          );

          return (
            <div key={vehicle.id} className="space-y-2">
              <PortalRowLink
                to={routes.customer.portal.veiculo(vehicle.id)}
                title={<span className="tabular-nums">{vehicleChipLabel(vehicle)}</span>}
                detail={contexto.length ? contexto.join(" · ") : undefined}
                trailing={
                  <>
                    {vehicle.cancelled ? (
                      <Badge variant="destructive" size="sm" className="font-normal">
                        Cancelado
                      </Badge>
                    ) : null}
                    {/* O marco e a previsão à direita, um sobre o outro.
                        Escondidos no celular pelo motivo de sempre: em 390px a
                        placa vem primeiro. */}
                    {vehicle.milestoneLabel || previsao ? (
                      <span className="hidden text-right sm:block">
                        {vehicle.milestoneLabel ? (
                          <span className="block whitespace-nowrap text-sm text-muted-foreground">
                            {vehicle.milestoneLabel}
                          </span>
                        ) : null}
                        {previsao ? (
                          <span className="block whitespace-nowrap text-sm tabular-nums text-muted-foreground">
                            Previsão {formatDate(previsao)}
                          </span>
                        ) : null}
                      </span>
                    ) : null}
                  </>
                }
              />
              <IdentidadeRows vehicle={vehicle} />
            </div>
          );
        })}
      </div>
    </PortalCard>
  );
}
