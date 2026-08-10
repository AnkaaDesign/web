/* A ARTE do painel — a grade 3×3 que substitui a foto esticada.
   ---------------------------------------------------------------------------
   O QUE MUDA, e por que isso É o pedido

   O painel do editor era uma FOTO: `panels/lateral.png` (168 kB) e
   `panels/traseira.png` (540 kB), esticadas sobre a janela. Elas mostram a
   ferragem certa e NÃO redimensionam — um baú de 8,40 m e um de 15,40 m recebem
   a mesma imagem, então a fita 3M, a cantoneira e a ferragem esticam junto. São
   peças de dimensão FIXA desenhadas com dimensão variável, e era o "esticando
   uma imagem como é atualmente" do relatório.

   No lugar entram 17 SVGs recortados da prancha técnica do cliente por
   `tools/livery-svg/slice.mjs`, mais um manifesto `layout.json` que diz onde
   cada um vai e — o que importa — O QUE CADA UM NÃO PODE DEFORMAR.

   ---------------------------------------------------------------------------
   A GRADE, EM UMA FIGURA

       ┌─────────┬───────────────────┬─────────┐
       │ canto   │  banda de TOPO    │ canto   │  altura FIXA, presa ao TETO
       ├─────────┼───────────────────┼─────────┤
       │ montante│  JANELA DE ARTE   │ montante│
       ├─────────┼───────────────────┼─────────┤
       │ canto   │  banda de BASE    │ canto   │  altura FIXA, presa ao PISO
       └─────────┴───────────────────┴─────────┘
        largura                        largura
        FIXA                           FIXA

   É a doutrina que a geometria 3D já usa: `trailer-assembly.ts` classifica cada
   casca em `roof` / `floor` / `stretch` / `follow` porque peça pequena não
   estica, TRANSLADA. Isto é a mesma regra no plano da textura.

   AS BANDAS DAS LATERAIS LADRILHAM em vez de esticar, e é o ponto mais
   importante: a fita 3M mora dentro delas, com passo medido de 327,27 u
   (1,1584 m). Esticar a banda esticaria a fita — o defeito que estamos
   consertando. A traseira e a testeira NÃO ladrilham: lá a banda é uma peça
   desenhada de ponta a ponta (o trilho do marco, o perfil sob as folhas), e
   ladrilhar desenharia a peça duas vezes num painel de 2,6 m.

   ---------------------------------------------------------------------------
   POR QUE ISTO PODE SEGUIR A MEDIDA E A FOTO NÃO PODIA

   Não é o formato do arquivo: é a SEPARAÇÃO. A foto é uma imagem só, então
   qualquer mudança de tamanho é uma transformação afim sobre tudo que ela
   contém. A grade tem 17 peças com regras diferentes, e "acompanhar o tamanho"
   passa a ser reposicionar 17 retângulos — cada um mantendo o que nele é fixo.
   Ser vetor é o que torna isso barato (nítido em qualquer resolução, alguns kB),
   mas quem resolve o problema é a decomposição.

   ---------------------------------------------------------------------------
   FALHAR AQUI NÃO PODE QUEBRAR NADA

   Sem `layout.json`, sem os SVGs ou com um deles corrompido, o painel continua
   como antes — a foto e os placeholders. Nada aqui lança e nada aqui é esperado
   por um caminho de boot. */
import { VEHICLES_DIR } from '../core/paths';
import { assetUrl } from '../catalog/catalog';

/** Onde a peça é desenhada em relação à arte do cliente. */
export type ArtPlane = 'back' | 'front';

/**
 * Uma célula da grade.
 *
 * `w`/`h` nulos significam "acompanhe a medida do painel" — é assim que uma
 * banda horizontal declara que sua LARGURA é elástica e sua ALTURA não.
 */
export interface ArtPiece {
  id: string;
  plane: ArtPlane;
  file: string;
  x: number;
  y: number;
  w: number | null;
  h: number | null;
  /** Presa a uma ponta (largura fixa) ou elástica. */
  anchorX?: 'start' | 'end' | 'stretch';
  /** Presa ao teto ou ao piso (altura fixa) ou elástica. */
  anchorY?: 'roof' | 'floor' | 'stretch';
  /** Largura de UM ladrilho, em metros. Ausente/0 = a peça estica. */
  tile?: number;
  /** Preenchido depois do download. Sem isto a peça não é desenhada. */
  markup?: string;
}

export interface ArtFace {
  /** O que a prancha desenha, em metros. Só para conferência e diagnóstico. */
  designLength: number;
  designHeight: number;
  /** Ponta presa da repetição — espelha `anchor` de livery-layers.ts. */
  anchor: 'start' | 'end';
  pieces: ArtPiece[];
}

export type ArtLayout = Record<string, ArtFace>;

const MANIFEST = 'panels/layout.json';

let layout: ArtLayout | null = null;
let started = false;

/** A grade carregada, ou `null` enquanto não houver. */
export const getLiveryArt = (): ArtLayout | null => layout;

/** Há arte utilizável para esta face? É o que decide se a foto sai de cena. */
export const hasLiveryArt = (face: string): boolean =>
  !!layout?.[face]?.pieces.some((p) => !!p.markup);

const listeners: (() => void)[] = [];
/** Avisa que a grade mudou — quem desenha o painel recompõe. */
export function onLiveryArtReady(cb: () => void) {
  listeners.push(cb);
  return () => { const i = listeners.indexOf(cb); if (i >= 0) listeners.splice(i, 1); };
}

/* Uma resposta que não é SVG é quase sempre o `index.html` de um 404 mascarado
   por SPA — e registrá-la faria o compositor tentar desenhar uma página inteira
   como se fosse uma faixa refletiva. O teste é de CONTEÚDO e não de
   `content-type` justamente porque é o servidor que mente no cabeçalho aí. */
const looksLikeSvg = (s: string) => /^\s*(?:<\?xml|<svg|<!--)/.test(s) && s.includes('<svg');

/**
 * Baixa o manifesto e as peças. Idempotente, sem `await` para quem chama.
 *
 * O manifesto vem primeiro porque é ele que diz QUAIS arquivos existem — uma
 * lista cravada aqui seria uma segunda fonte de verdade, e ela ficaria errada
 * no dia em que o recortador emitisse uma peça a mais.
 *
 * As peças descem em PARALELO e a composição é avisada UMA vez, no fim: avisar
 * a cada uma recomporia os três painéis 17 vezes durante o boot, e uma grade
 * meio carregada desenha um painel com buracos.
 */
export function loadLiveryArt() {
  if (started) return;
  started = true;

  /* `assetUrl()` e não o caminho cru — mesma regra (e mesmo motivo) do
     PANEL_IMAGE em ./livery.ts: a árvore do estúdio é servida pela API sob
     `STUDIO_BASE`, e `VEHICLES_DIR + …` resolveria contra a origem do WEB, que
     não tem os arquivos. O sintoma seria um 404 mudo. */
  fetch(assetUrl(VEHICLES_DIR + MANIFEST))
    .then((r) => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json(); })
    .then(async (raw: unknown) => {
      const doc = raw as { schema?: string; faces?: ArtLayout };
      if (!doc || typeof doc !== 'object' || !doc.faces) throw new Error('manifesto sem faces');
      /* A versão do schema é conferida, e a divergência é FATAL em vez de
         tolerada: um manifesto de outra versão tem outros nomes de âncora, e
         desenhá-lo "do jeito que der" produziria um painel plausível e errado —
         o pior modo de falha possível para uma ferramenta de conferência. */
      if (doc.schema && doc.schema !== 'truck-studio/livery-art@1') {
        throw new Error(`schema desconhecido: ${doc.schema}`);
      }
      const faces = doc.faces;
      const jobs: Promise<void>[] = [];
      for (const face of Object.values(faces)) {
        for (const piece of face.pieces) {
          jobs.push(
            fetch(assetUrl(VEHICLES_DIR + 'panels/' + piece.file))
              .then((r) => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.text(); })
              .then((markup) => {
                if (!looksLikeSvg(markup)) throw new Error('resposta não é SVG');
                piece.markup = markup;
              })
              .catch((e: unknown) => {
                /* Uma peça que falta deixa um buraco naquela célula e não
                   derruba as outras dezesseis — o painel fica incompleto e
                   visivelmente incompleto, que é melhor do que ausente. */
                console.info(`[livery] peça "${piece.id}" indisponível (${piece.file})`,
                  e instanceof Error ? e.message : e);
              }),
          );
        }
      }
      await Promise.all(jobs);
      layout = faces;
      for (const cb of listeners) cb();
      const total = Object.values(faces).reduce((n, f) => n + f.pieces.length, 0);
      const got = Object.values(faces)
        .reduce((n, f) => n + f.pieces.filter((p) => p.markup).length, 0);
      console.info(`[livery] arte do painel: ${got}/${total} peças em`
        + ` ${Object.keys(faces).length} faces.`);
    })
    .catch((e: unknown) => {
      /* `info` e não `warn`: a ausência da grade é um estado previsto e
         utilizável — o painel volta a ser a foto. Mas precisa aparecer, senão
         "por que o painel ainda estica?" não tem resposta em lugar nenhum. */
      console.info('[livery] layout.json indisponível — o painel segue na foto.',
        e instanceof Error ? e.message : e);
    });
}
