// web/src/components/cliente/veiculo/veiculo-resumo-card.tsx
//
// O CONTEXTO DO VEÍCULO — de quem ele é, de que orçamento veio, e QUANDO FICA
// PRONTO.
//
// ⛔ A PREVISÃO DE ENTREGA NÃO ESTAVA EM TELA NENHUMA DO PORTAL, e ela é *a*
// pergunta do cliente. `progress.forecastDate` vem na resposta desde sempre (o
// comentário de `veiculo/types.ts` já dizia que era a pergunta nº 1 e que o DTO
// antigo não declarava o campo); a linha do tempo desenha os MARCOS, que contam
// o passado, e ninguém contava o futuro.
//
// ⚠️ É `forecastDate`, NUNCA `Task.term`. O prazo interno está na lista do §9 do
// que não vai para o cliente — o que sai é a previsão que o servidor projetou.
//
// ⛔ E NÃO HÁ `status` NO VEÍCULO. `Task.status` é a coluna que REGRIDE e o
// servidor a retira da resposta; quem responde "em que pé está" é
// `milestoneLabel`, que fica no cabeçalho da página.
//
// O card inteiro some quando não há uma linha sequer: sem a seção `VEHICLE` não
// há cliente, sem `DELIVERY` não há datas, e um cartão de cinco traços não
// informa nada que o silêncio não informe melhor.
import { Link } from "react-router-dom";
import { IconInfoCircle } from "@tabler/icons-react";

import type { PortalVehicleDetail } from "@/api-client/portal";
import { DetailRow } from "@/components/ui/detail-row";
import { QuoteStatusBadge } from "@/components/production/task/quote/quote-status-badge";
import { routes } from "@/constants/routes";
import { formatDate } from "@/utils";
import { PortalCard, PortalRows } from "../portal-detail";

export function VeiculoResumoCard({ veiculo }: { veiculo: PortalVehicleDetail }) {
  const cliente = veiculo.identity?.customer?.name ?? null;
  const budget = veiculo.budget;
  const progress = veiculo.progress;

  const entrada = progress?.entryDate ?? null;
  const previsao = progress?.forecastDate ?? null;
  const concluido = progress?.finishedAt ?? null;

  if (!cliente && !budget && !entrada && !previsao && !concluido) return null;

  return (
    <PortalCard icon={IconInfoCircle} title="Sobre este veículo">
      <PortalRows>
        {cliente ? <DetailRow label="Cliente" value={cliente} /> : null}

        {budget ? (
          <DetailRow
            label="Orçamento"
            value={
              <span className="flex flex-wrap items-center justify-end gap-2">
                {/* ⚠️ `<Link>` é seguro mesmo com o formulário sujo: a guarda
                    desta tela remenda `history.pushState`, então ela intercepta
                    `navigate()` e `<Link>` do mesmo jeito. Ver
                    `hooks/common/use-unsaved-changes-guard.ts`. */}
                <Link
                  to={routes.customer.portal.orcamento(budget.id)}
                  className="tabular-nums underline-offset-4 hover:underline"
                >
                  {budget.budgetNumber ? `nº ${budget.budgetNumber}` : "abrir"}
                </Link>
                <QuoteStatusBadge status={budget.status} size="sm" />
              </span>
            }
          />
        ) : null}

        {entrada ? (
          <DetailRow label="Entrada" value={<span className="tabular-nums">{formatDate(entrada)}</span>} />
        ) : null}
        {previsao ? (
          <DetailRow
            label="Previsão de entrega"
            value={<span className="tabular-nums">{formatDate(previsao)}</span>}
          />
        ) : null}
        {concluido ? (
          <DetailRow
            label="Concluído em"
            value={<span className="tabular-nums">{formatDate(concluido)}</span>}
          />
        ) : null}
      </PortalRows>
    </PortalCard>
  );
}
