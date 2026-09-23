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
import { useCallback, useRef, useState } from "react";
import { IconRuler } from "@tabler/icons-react";

import { Button } from "@/components/ui/button";
import { ImplementMeasureForm } from "@/components/production/implement-measure/implement-measure-form";

import type { PortalMeasure } from "@/api-client/portal";
import type { ImplementFace } from "@/constants/implement-faces";
import { usePortalUpdateVehicleIdentity } from "@/api-client/portal";
import { PortalCard } from "../portal-detail";

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

export function VeiculoMedidasCard({
  taskId,
  measures,
  canWrite,
}: {
  taskId: string;
  measures: Medidas | null | undefined;
  canWrite: boolean;
}) {
  const mutation = usePortalUpdateVehicleIdentity();
  const [lado, setLado] = useState<keyof Medidas>("left");
  const [erro, setErro] = useState<string | null>(null);

  // ⛔ SEM NENHUMA FACE, o card não existe para quem só LÊ — "medidas vazias"
  // leria como "medimos e deu zero". Para quem ESCREVE ele existe mesmo vazio:
  // é ali que a medida que falta vai ser desenhada.
  const temAlguma = FACES.some((f) => {
    const m = measures?.[f.chave];
    return !!m && (m.height !== null || (m.sections ?? []).length > 0);
  });
  if (!temAlguma && !canWrite) return null;

  /**
   * OS TRÊS LADOS DE UMA VEZ — e não só o que está aberto.
   *
   * ⛔ ERA `layout` (um lado), e o dono viu o sintoma: mudar o motorista, ir
   * para o sapo e clicar "Espelhar Motorista" trazia o valor ANTIGO, ou copiava
   * na direção errada. A razão está no componente: ele guarda os três lados em
   * estado INTERNO (`sideStates`) e o botão de copiar/espelhar lê o lado
   * VIZINHO de lá. Passando um lado só, os outros dois nunca eram semeados e
   * ficavam no padrão de fábrica (2,00 × 2,00) — era esse padrão que o espelho
   * copiava.
   *
   * `layouts` é a prop que o próprio componente criou para isso ("CRITICAL:
   * Sync state when layouts prop changes"). Com ela, copiar e espelhar passam a
   * ler a medida de verdade.
   */
  const paraLayout = (m: PortalMeasure | null | undefined) => ({
    height: m?.height ?? 0,
    sections: (m?.sections ?? []).map((secao, index) => ({
      width: secao.width ?? 0,
      isDoor: !!secao.isDoor,
      doorHeight: secao.doorHeight ?? null,
      position: typeof secao.position === "number" ? secao.position : index,
    })),
  });
  const layouts = {
    left: paraLayout(measures?.left),
    right: paraLayout(measures?.right),
    back: paraLayout(measures?.back),
  };

  /**
   * O DESENHO GRAVA — e grava SÓ A FACE que mudou.
   *
   * ⚠️ METROS → CENTÍMETROS aqui, porque a rota do portal fala centímetros na
   * borda (a mesma convenção da requisição) e o servidor divide por 100 antes
   * de gravar. As duas conversões se cancelam; uma divisão a mais em qualquer
   * ponto produz um implemento de 7,8 centímetros em vez de um erro.
   *
   * ⚠️ `onChange` do `ImplementMeasureForm` dispara a cada arrasto. Gravar a
   * cada evento seria uma escrita por pixel: o `setTimeout` junta a rajada e
   * manda uma vez, 700 ms depois de a mão parar.
   */
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  /**
   * ⛔ NADA É GRAVADO ANTES DE A PESSOA TOCAR NO DESENHO.
   *
   * `ImplementMeasureForm` EMITE `onChange` AO MONTAR, com o implemento padrão
   * de 2,00 × 2,00 que ele usa por dentro — é o mesmo comportamento que obriga o
   * assistente de requisição a peneirar "medida intocada" antes de enviar. Sem
   * esta trava, abrir a tela de um veículo já gravava uma medida que ninguém
   * mediu: o toast "atualizada com sucesso" aparecia sozinho no carregamento, e
   * um caminhão SEM medida ganhava 2,00 × 2,00 por visita.
   *
   * A prova de intenção é o EVENTO DE ENTRADA — ponteiro ou teclado dentro do
   * desenho. Montagem não produz nenhum dos dois.
   */
  const interagiu = useRef(false);
  const aoMudar = useCallback(
    (side: ImplementFace, dados: { height?: number | null; sections?: unknown }) => {
      if (!canWrite || !interagiu.current) return;
      const chave = LADO_PARA_PAYLOAD[side];
      const emCentimetros = {
        height: Math.round(((dados.height ?? 0) as number) * 100),
        sections: (((dados.sections ?? []) as Array<Record<string, unknown>>) ?? []).map(
          (secao, index) => ({
            width: Math.round(((secao.width as number) ?? 0) * 100),
            isDoor: !!secao.isDoor,
            doorHeight:
              typeof secao.doorHeight === "number" ? Math.round(secao.doorHeight * 100) : null,
            position: typeof secao.position === "number" ? secao.position : index,
          }),
        ),
      };

      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => {
        setErro(null);
        mutation
          .mutateAsync({ taskId, data: { medidas: { [chave]: emCentimetros } } as never })
          .catch(() => setErro("Não foi possível salvar a medida. Tente de novo."));
      }, 700);
    },
    [canWrite, mutation, taskId],
  );

  return (
    <PortalCard
      icon={IconRuler}
      title="Medidas do implemento"
      description={
        canWrite
          ? "Arraste para ajustar. O que você mudar aqui é o que a produção usa."
          : "O que foi informado na requisição."
      }
      actions={
        mutation.isPending ? (
          <span className="text-sm text-muted-foreground">Salvando…</span>
        ) : undefined
      }
    >
      <div className="space-y-3">
        <div className="flex flex-wrap gap-2">
          {FACES.map((f) => (
            <Button
              key={f.chave}
              type="button"
              size="sm"
              variant={f.chave === lado ? "default" : "outline"}
              onClick={() => setLado(f.chave)}
            >
              {f.rotulo}
            </Button>
          ))}
        </div>

        {/* ⛔ SEM `key`, E É O PONTO DA CORREÇÃO. Remontar a cada troca de aba
            jogava fora o `sideStates` inteiro — inclusive o lado que a pessoa
            acabou de ajustar —, e o espelho voltava a copiar o padrão de
            fábrica. Quem sincroniza é a prop `layouts`; a troca de lado é só
            `selectedSide` mudando. */}
        {/* ⚠️ A CAPTURA É NO INVÓLUCRO, e na fase de captura: o desenho tem
            canvas, botões e campos lá dentro, e esperar o evento borbulhar de
            cada um deles seria uma lista para esquecer um. */}
        <div
          onPointerDownCapture={() => {
            interagiu.current = true;
          }}
          onKeyDownCapture={() => {
            interagiu.current = true;
          }}
        >
        <ImplementMeasureForm
          selectedSide={lado}
          layouts={layouts as never}
          onSideChange={setLado}
          onChange={canWrite ? (aoMudar as never) : undefined}
          showPhoto={false}
          disabled={!canWrite}
        />
        </div>

        {erro ? (
          <p className="text-sm text-destructive" role="alert">
            {erro}
          </p>
        ) : null}
      </div>
    </PortalCard>
  );
}

/** A chave que a rota do portal espera para cada lado. */
const LADO_PARA_PAYLOAD: Record<ImplementFace, "esquerda" | "direita" | "traseira"> = {
  left: "esquerda",
  right: "direita",
  back: "traseira",
};
