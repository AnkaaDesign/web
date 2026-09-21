// web/src/components/cliente/orcamento/orcamento-servicos-card.tsx
//
// OS SERVIÇOS — seção `SERVICES`.
//
// A relação numerada do que foi contratado, com a observação de cada linha e,
// para quem também tem `PRICING`, o valor ao lado.
//
// ⛔ ERA UM `<ul class="divide-y">` COM UMA `<li>` DE FLEX POR LINHA. Dado
// tabular desenhado à mão: cabeçalho nenhum, alinhamento de moeda por
// `shrink-0`, e a coluna de valor aparecendo e sumindo sem que nada diga o que
// aquele número é. `components/cliente/portal-table.tsx` já existe, é seguro
// fora do `AuthProvider` (roda sobre `ui/table`, como o `DataTable`) e desenha
// cabeçalho, vazio e esqueleto. Agora é ele.
//
// ⚠️ O PREÇO DE CADA LINHA É OUTRA SEÇÃO, E OUTRO OBJETO. `budget.services[]`
// NÃO tem `amount` — o projetor do servidor o omite de propósito, porque a lista
// e o preço são seções diferentes e há um papel real entre as duas: o Marketing
// do cliente aprova a arte e o escopo sem ver quanto custa. Copiar `amount` para
// dentro de `services` apagaria `PRICING` na prática.
//
// O valor vive em `budget.pricing.items[]`, com o MESMO `id` — quem tem as duas
// seções cruza por ele (`portalServiceAmount`). Quem não tem `PRICING` não vê a
// coluna: ela não vira uma fileira de traços, ela não existe.
//
// ⚠️ E O TOTAL MORA AQUI, no rodapé da tabela, e não num bloco de valores lá em
// cima. Conferir uma conta é ler as parcelas e a soma na mesma vista; subtotal e
// total a três cards de distância das linhas que os produzem era um convite a
// não conferir.
import { IconChecklist } from "@tabler/icons-react";

import type { PortalBudget, PortalBudgetService } from "@/api-client/portal";
import { portalServiceAmount } from "@/api-client/portal";
import { EmptyState } from "@/components/ui/empty-state";
import { DetailRow } from "@/components/ui/detail-row";
import { formatCurrency } from "@/utils";
import { PortalCard, PortalRows } from "../portal-detail";
import { PortalTable, type PortalTableColumn } from "../portal-table";

export function OrcamentoServicosCard({ budget }: { budget: PortalBudget }) {
  const list = budget.services ?? [];
  const pricing = budget.pricing;
  const canSeePricing = !!pricing;

  // ⛔ SEM LINHA E SEM NOTÍCIA, SEM CARD. O sistema não desenha seção vazia
  // (`ui/detailpage/detail-section.tsx:56-58`) e o portal desenhava a carcaça.
  // A EXCEÇÃO é a requisição recém-aberta: ali o vazio é a resposta à pergunta
  // que trouxe o contato ("e aí, saiu o orçamento?"), e calá-la o deixaria
  // achando que a tela quebrou.
  if (list.length === 0 && budget.status !== "REQUESTED") return null;

  // A numeração é a ORDEM EM QUE O SERVIDOR MANDOU, e não `service.position`:
  // a posição é do lançamento e pode ter buraco (linha apagada), e um "1, 2, 4"
  // numa proposta parece item faltando.
  const ordem = new Map(list.map((service, index) => [service.id, index + 1]));

  const columns: Array<PortalTableColumn<PortalBudgetService>> = [
    {
      id: "posicao",
      header: "#",
      className: "w-10 tabular-nums text-muted-foreground",
      headerClassName: "w-10",
      cell: (service) => ordem.get(service.id),
    },
    {
      id: "descricao",
      header: "Serviço",
      cell: (service) => (
        <div className="min-w-0 space-y-0.5">
          <p className="text-sm font-medium text-foreground">{service.description}</p>
          {service.observation ? (
            <p className="whitespace-pre-wrap text-sm text-muted-foreground">{service.observation}</p>
          ) : null}
        </div>
      ),
    },
    ...(canSeePricing
      ? [
          {
            id: "valor",
            header: "Valor",
            align: "right" as const,
            className: "whitespace-nowrap tabular-nums",
            cell: (service: PortalBudgetService) => {
              const amount = portalServiceAmount(budget, service.id);
              return amount === null ? (
                <span className="italic text-muted-foreground">—</span>
              ) : (
                formatCurrency(amount)
              );
            },
          },
        ]
      : []),
  ];

  return (
    <PortalCard icon={IconChecklist} title="Serviços">
      {list.length === 0 ? (
        <EmptyState
          className="py-8"
          icon={<IconChecklist className="h-8 w-8" />}
          title="Nenhum serviço lançado"
          description="A requisição foi recebida. O comercial da Ankaa ainda vai montar a lista de serviços e o preço."
        />
      ) : (
        <div className="space-y-3">
          <PortalTable columns={columns} rows={list} getRowId={(service) => service.id} />

          {/* ⚠️ O RODAPÉ NÃO É LINHA DA TABELA. Subtotal e total são do
              DOCUMENTO, não do serviço — pô-los como mais uma `<tr>` os deixaria
              alinhados sob a coluna "Serviço", como se fossem itens. Em
              `DetailRow` eles lêem como o que são: dois pares rótulo/valor. */}
          {pricing &&
          (typeof pricing.subtotal === "number" || typeof pricing.total === "number") ? (
            <PortalRows>
              {typeof pricing.subtotal === "number" ? (
                <DetailRow
                  label="Subtotal"
                  value={<span className="tabular-nums">{formatCurrency(pricing.subtotal)}</span>}
                />
              ) : null}
              {typeof pricing.total === "number" ? (
                <DetailRow
                  label="Total"
                  value={<span className="text-base tabular-nums">{formatCurrency(pricing.total)}</span>}
                />
              ) : null}
            </PortalRows>
          ) : null}
        </div>
      )}
    </PortalCard>
  );
}
