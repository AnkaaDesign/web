// web/src/components/cliente/orcamento/orcamento-andamento-card.tsx
//
// O ANDAMENTO DENTRO DO ORÇAMENTO — a seção que faltava na tela.
//
// ⛔ O DONO RECLAMOU DA AUSÊNCIA: *"nem as ordens de serviço"*. E o dado NUNCA
// faltou — `GET /cliente/me/orcamentos/:id` já devolve `vehicles[].progress`
// completo (escada monotônica, O.S. de produção, fotos de entrada e saída)
// sempre que o recorte inclui `DELIVERY`. O que faltava era esta tela desenhar:
// o componente que sabe fazê-lo (`veiculo/veiculo-andamento-card.tsx`) era
// usado só em `pages/cliente/veiculos/[taskId].tsx`.
//
// ── Por que um cartão com SELETOR, e não N cartões ──────────────────────────
//
// O andamento é o único bloco desta tela que é MESMO por veículo: a arte três
// caminhões partilham (por isso o card de Layout agrupa), mas o caminhão que
// entrou ontem e o que saiu semana passada estão em pontos diferentes da
// escada. Empilhar quinze linhas do tempo abertas faria da tela um rolo, e é
// justamente o que o §10 proíbe. Então: um cartão, um seletor de caminhão, uma
// escada por vez — com o caminhão MENOS adiantado aberto por padrão, que é o
// que decide a entrega da coleta inteira.
//
// ⚠️ `progress` é `undefined` sem a seção `DELIVERY`, e aí não há cartão
// nenhum: dizer "você não vê o andamento" faz sentido na tela DO VEÍCULO (onde
// a pessoa foi procurar exatamente isso) e não aqui, onde seria mais um card de
// recusa no meio de um documento que ela vê por inteiro.
//
// ⚠️ E `steps: []` é o NORMAL. Só há O.S. para tarefa de tipo `PRODUCTION` não
// cancelada; enquanto o caminhão não entra na fila, a escada existe e a lista de
// ordens não. Quem trata isso é `VeiculoAndamentoConteudo`, sem carcaça.
import { useState } from "react";
import { IconTimelineEvent } from "@tabler/icons-react";

import type { PortalVehicle } from "@/api-client/portal";
import { VeiculoAndamentoConteudo } from "@/components/cliente/veiculo/veiculo-andamento-card";
import { cn } from "@/lib/utils";
import { PortalCard } from "../portal-detail";
import { vehicleChipLabel } from "./vehicle-chips";

export function OrcamentoAndamentoCard({ vehicles }: { vehicles: PortalVehicle[] | undefined }) {
  const comProgresso = (vehicles ?? []).filter((vehicle) => !!vehicle.progress);
  // ⚠️ O PADRÃO É O PRIMEIRO DA RESPOSTA, e a resposta vem na ordem do
  // orçamento. Escolher "o menos adiantado" aqui seria a tela derivando ordem
  // de uma escada que o servidor já projetou — o recálculo que o componente
  // irmão existe para não fazer.
  const [selecionado, setSelecionado] = useState<string | null>(null);

  if (comProgresso.length === 0) return null;

  const atual =
    comProgresso.find((vehicle) => vehicle.id === selecionado) ?? comProgresso[0];
  const varios = comProgresso.length > 1;

  return (
    <PortalCard
      icon={IconTimelineEvent}
      title="Andamento"
      description={
        varios
          ? "Escolha o veículo para ver a linha do tempo e as ordens de serviço dele."
          : atual.milestoneLabel || undefined
      }
    >
      <div className="space-y-4">
        {varios ? (
          <div className="flex flex-wrap gap-1.5" role="group" aria-label="Veículos do orçamento">
            {comProgresso.map((vehicle) => {
              const ativo = vehicle.id === atual.id;
              return (
                <button
                  key={vehicle.id}
                  type="button"
                  aria-pressed={ativo}
                  onClick={() => setSelecionado(vehicle.id)}
                  className={cn(
                    "max-w-[14rem] truncate rounded-md border px-2.5 py-1 text-sm tabular-nums transition-colors",
                    ativo
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-border text-muted-foreground hover:bg-muted/50 hover:text-foreground",
                  )}
                  title={vehicleChipLabel(vehicle)}
                >
                  {vehicleChipLabel(vehicle)}
                </button>
              );
            })}
          </div>
        ) : null}

        {varios && atual.milestoneLabel ? (
          <p className="text-sm text-muted-foreground">{atual.milestoneLabel}</p>
        ) : null}

        {/* ⚠️ `key` no veículo: trocar de caminhão é trocar de assunto, e sem
            ela o React reaproveitaria a árvore anterior — o que faz a escada
            velha piscar por um quadro sob o rótulo novo. */}
        <VeiculoAndamentoConteudo
          key={atual.id}
          progress={atual.progress}
          cancelled={atual.cancelled}
        />
      </div>
    </PortalCard>
  );
}
