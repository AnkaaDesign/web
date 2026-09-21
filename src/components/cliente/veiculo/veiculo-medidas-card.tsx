// web/src/components/cliente/veiculo/veiculo-medidas-card.tsx
//
// AS MEDIDAS DO IMPLEMENTO, DE VOLTA PARA QUEM AS INFORMOU.
//
// ⛔ O DADO QUE ENTRAVA E NÃO VOLTAVA. O cliente desenha as três faces no
// assistente de requisição — é o passo mais trabalhoso dele, o único em que ele
// mede um caminhão de verdade com uma trena — e o servidor as devolve em
// `identity.measures`. Nenhuma tela do portal as desenhava. Quem quisesse
// conferir o que informou não tinha onde: restava confiar na memória ou ligar
// para o comercial e pedir que ele lesse do outro lado.
//
// ── DUAS ARMADILHAS DE UNIDADE, E ELAS SÃO OPOSTAS ─────────────────────────
//
// ⚠️ O SERVIDOR ENTREGA METROS. É decisão explícita do projetor
// (`portal-projection.service.ts:818`): a conversão é da BORDA, e converter lá
// faria o portal ter unidade diferente do resto do sistema para o mesmo campo.
//
// ⚠️ O FORMULÁRIO FALA CENTÍMETROS. `portalMedidaLadoSchema` valida cm e
// `medidaParaPrisma()` divide por 100 ao gravar.
//
// ⇒ Esta tela é LEITURA, então ela mostra METROS e escreve "m" ao lado de cada
// número. Não converte nada: um "2,40 m" aqui e um "240" no formulário são o
// mesmo comprimento, e o sufixo é o que impede que pareçam dois. Mostrar 240
// sem unidade — ou 2,40 sem o "m" — é como se fabrica um implemento errado.
//
// ⚠️ A CHAVE DA TRASEIRA É `back`, NUNCA `rear`. Está assim no servidor e no
// cliente tipado; inventar `rear` não dá erro de compilação, dá uma face vazia.
import { IconRuler } from "@tabler/icons-react";

import type { PortalMeasure, PortalMeasureSection } from "@/api-client/portal";
import { DetailRow } from "@/components/ui/detail-row";
import { PortalCard, PortalDash, PortalRows, PortalSubheading } from "../portal-detail";
import { PortalTable } from "../portal-table";

/**
 * Metros com vírgula e sufixo, sempre.
 *
 * Duas casas fixas de propósito: `6.2` e `6.20` são o mesmo número e leituras
 * diferentes numa coluna — a segunda alinha com as vizinhas, a primeira não.
 */
function metros(valor: number | null | undefined): string | null {
  if (valor === null || valor === undefined || Number.isNaN(valor)) return null;
  return `${valor.toFixed(2).replace(".", ",")} m`;
}

const FACES: Array<{ chave: keyof Medidas; rotulo: string }> = [
  // A ordem é a do formulário, e a do caminhão visto de trás para a frente:
  // o motorista à esquerda, o sapo à direita, a traseira por último.
  { chave: "left", rotulo: "Lado do motorista" },
  { chave: "right", rotulo: "Lado do sapo" },
  { chave: "back", rotulo: "Traseira" },
];

interface Medidas {
  left: PortalMeasure | null;
  right: PortalMeasure | null;
  back: PortalMeasure | null;
}

function Face({ rotulo, medida }: { rotulo: string; medida: PortalMeasure }) {
  const total = medida.sections.reduce((soma, s) => soma + (s.width ?? 0), 0);

  return (
    <div className="space-y-2">
      <PortalSubheading>{rotulo}</PortalSubheading>
      <PortalRows>
        <DetailRow label="Altura" value={metros(medida.height) ?? <PortalDash />} />
        {/* O comprimento total é SOMA, não um campo — o formulário o mostra
            calculado e quem confere procura por ele aqui pelo mesmo motivo. */}
        <DetailRow
          label="Comprimento total"
          value={medida.sections.length ? (metros(total) ?? <PortalDash />) : <PortalDash />}
        />
      </PortalRows>

      {medida.sections.length > 0 && (
        <PortalTable<PortalMeasureSection>
          columns={[
            {
              id: "posicao",
              header: "#",
              cell: (s) => <span className="tabular-nums">{s.position + 1}</span>,
              className: "w-10",
            },
            {
              id: "largura",
              header: "Largura",
              align: "right",
              cell: (s) => <span className="tabular-nums">{metros(s.width) ?? "—"}</span>,
            },
            {
              id: "tipo",
              header: "Seção",
              // "Porta" e "—" em vez de "Sim/Não": a coluna responde "o que é
              // esta seção", e um "Não" não descreve nada.
              cell: (s) =>
                s.isDoor ? (
                  <span className="font-medium text-foreground">Porta</span>
                ) : (
                  <span className="text-muted-foreground">Fechada</span>
                ),
            },
            {
              id: "altura-porta",
              header: "Altura da porta",
              align: "right",
              cell: (s) =>
                s.isDoor ? (
                  <span className="tabular-nums">{metros(s.doorHeight) ?? "—"}</span>
                ) : (
                  <span className="text-muted-foreground">—</span>
                ),
            },
          ]}
          rows={[...medida.sections].sort((a, b) => a.position - b.position)}
          getRowId={(s) => `${rotulo}-${s.position}`}
        />
      )}
    </div>
  );
}

export function VeiculoMedidasCard({ measures }: { measures: Medidas | null | undefined }) {
  // Sem NENHUMA face medida, o card não existe. É a regra da casa
  // (`ui/detailpage/detail-section.tsx:56`): seção sem conteúdo não vira
  // carcaça. E aqui o vazio seria enganoso de um jeito específico — "medidas
  // vazias" leria como "medimos e deu zero", quando o certo é "ainda não foram
  // informadas", que é assunto do assistente de requisição, não desta tela.
  const faces = FACES.map((f) => ({ ...f, medida: measures?.[f.chave] ?? null })).filter(
    (f): f is { chave: keyof Medidas; rotulo: string; medida: PortalMeasure } =>
      !!f.medida && (f.medida.height !== null || f.medida.sections.length > 0),
  );
  if (!faces.length) return null;

  return (
    <PortalCard
      icon={IconRuler}
      title="Medidas do implemento"
      description="O que foi informado na requisição, face a face."
    >
      <div className="space-y-5">
        {faces.map((f) => (
          <Face key={f.chave} rotulo={f.rotulo} medida={f.medida} />
        ))}
      </div>
    </PortalCard>
  );
}
