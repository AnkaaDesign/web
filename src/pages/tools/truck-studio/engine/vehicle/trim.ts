/* As CONFIGURAÇÕES de peça: teto, paralamas, caixa de cozinha e Thermo King.
   ---------------------------------------------------------------------------
   Quatro peças que o cliente configura à parte do baú — três que ele escolhe
   PINTAR separadamente, e duas que ele escolhe NÃO TER.

   QUEM PINTA E QUEM SÓ APARECE/SOME (pedido de produto, 2026-08-13):

     Teto          cor própria · sempre no produto
     Paralamas     cor própria · sempre no produto
     Thermo King   cor própria · pode ser removido
     Caixa         SEM cor     · pode ser removida

   A caixa PERDEU a cor, e a remoção é deliberada, não uma simplificação: o
   pedido foi literal ("não precisa ter pintura da caixa de cozinha mais"). A
   maquinaria de casar a chapa dela continua aqui inteira — `BOX_PAINTABLE_RE` e
   o filtro por material em `applyTrim()` — porque é ela que documenta o que foi
   MEDIDO no bake, e porque devolver a cor à caixa um dia é trocar
   `paintable: false` por `true`. O que sai é a OPÇÃO, não o conhecimento.

   NÃO FOI PRECISO MODELAR NADA. A hipótese de partida era abrir o `trailer.glb`
   no Blender para separar as peças; abrindo o chunk JSON do glTF (2 151 malhas,
   5 852 nós, 38 materiais) elas já saem separadas do bake. O que cada uma É, e
   como se acha cada uma — MEDIDO no arquivo, não suposto:

   | Peça        | Como casar        | Por quê                                    |
   |-------------|-------------------|--------------------------------------------|
   | Teto        | NÓ `teto-externo` | o material é `Cor_padrao_branco`, o mesmo   |
   |             |                   | das laterais e da traseira — casar por ele  |
   |             |                   | pintaria o baú inteiro                      |
   | Paralamas   | MATERIAL          | `paralamas` é exclusivo deles (12 malhas).  |
   |             | `paralamas`       | As duas abas de BORRACHA usam `borracha` e  |
   |             |                   | ficam de fora, que é o certo                |
   | Caixa       | NÓ `Caixa-ferr…`  | ver o bloco A CAIXA, abaixo                 |
   | Thermo King | MATERIAL          | vive em `thermoking.glb`, e o meta do       |
   |             | `tk-housing-white`| arquivo diz com todas as letras que a       |
   |             |                   | divisão de malhas É a regra de pintura      |

   CASAR POR MATERIAL ONDE HÁ MATERIAL PRÓPRIO E POR NÓ ONDE NÃO HÁ é a mesma
   conclusão a que `models.trailerPanelMeshes()` chegou, e pelo mesmo motivo que
   a nota de lá registra: casar por GEOMETRIA quebra quando o bake muda de união
   ou de recorte, e casar por nome de nó quebra quando o exportador renumera.
   Cada peça usa o critério que o bake torna estável PARA ELA.

   ---------------------------------------------------------------------------
   A CAIXA — e por que ela é a única com lista de materiais

   `inox-ferragem` é o material da caixa E de toda a ferragem do implemento.
   Medido: 1 559 976 triângulos no implemento inteiro, dos quais 56 148 (3,6 %)
   dentro da caixa. Casar por ele pintaria dobradiça, corrimão e degrau de um
   ponto a outro da carreta. Por isso a caixa casa por NÓ.

   Só que dentro dos 80 nós dela há seis materiais, e eles não são todos chapa:

       56 148 tri   59 malhas   inox-ferragem           ← a FERRAGEM
       45 341 tri    2 malhas   plastico-preto
       30 575 tri   10 malhas   caixa-estrutura-preta   ← o quadro
        2 240 tri    6 malhas   metal-preto
        1 332 tri    1 malha    plastico-cinza-polido   ← a FOLHA
        1 300 tri    2 malhas   metal-claro             ← lábio + forro

   `PAINTABLE` é o filtro, e ele é a POLÍTICA da peça, não um detalhe: pintar a
   caixa pinta a CHAPA dela; o plástico preto e a estrutura preta continuam
   pretos, que é o que acontece numa cabine de pintura de verdade.

   ---------------------------------------------------------------------------
   QUEM É A CHAPA MUDOU EM 2026-08-12, e a versão anterior estava errada nas
   duas pontas.

   Ela dizia `inox-ferragem|metal-claro`, e o comentário aqui registrava a
   limitação com todas as letras: "a parte que este código não sabe fazer é
   separar a chapa da DOBRADIÇA — as duas são `inox-ferragem`". Ou seja, escolher
   uma cor para a caixa pintava as dobradiças, os parafusos e os suportes dela.
   Isso passou de incômodo a contradição quando o pedido de produto (2026-08-12)
   fixou que toda a ferragem do implemento é INOX — ver `splitStainlessHardware()`
   em `models.ts`.

   E o pior: a FOLHA — a face inteira que se vê da caixa, 1 030 × 581 mm — é
   `plastico-cinza-polido` e NÃO estava na lista. Escolher uma cor para a caixa
   deixava justamente a caixa como estava e pintava a ferragem em volta.

   O conserto não precisou do bake, ao contrário do que esta nota previa: os
   dois materiais da chapa são EXCLUSIVOS dela (medido — `plastico-cinza-polido`
   tem 1 malha no implemento inteiro e `metal-claro` tem 2, as três dentro da
   caixa), então casar por nome aqui é tão estável quanto casar por nó lá em
   cima. A ferragem sai da lista e fica inox, como o produto pede.

   ---------------------------------------------------------------------------
   A REGRA QUE GOVERNA TUDO: SEM COR ESCOLHIDA, NADA MUDA

   Uma peça sem cor própria se comporta EXATAMENTE como antes deste arquivo
   existir. Não há "estado padrão do acabamento" a aplicar no boot, e é isso que
   torna esta funcionalidade puramente aditiva:

   · teto e Thermo King JÁ eram pintados junto com o baú (os dois estão em
     `trailerPanelMeshes()`), e continuam sendo — `followsBody: true`;
   · paralamas e caixa NUNCA foram pintados, e continuam como o bake os
     entregou — `followsBody: false`.

   A consequência prática é a ordem de aplicação, e ela é a única sutileza deste
   arquivo: `applyTrim()` roda DEPOIS de `setPaintTarget()`, por assinatura em
   `onPaintTargetApplied()`. Ver `restoreOf()`, que é onde essa ordem vira
   regra. */
import * as THREE from 'three';
import {
  state, onPaintTargetApplied, onTrailerPanelsRebuilt, setPaintTarget,
  adoptProbeMaterial, TRAILER_BOX_NODE_RE,
} from './models';
import { TRAILER_ROOF_MESH } from './trailer-geometry';
import { createPaintInstance } from './paint';
import type { PaintInstance, PaintPatch } from './paint';
import { invalidate } from '../scene/scene';

export type TrimKey = 'roof' | 'fenders' | 'box' | 'thermoking';
export const TRIM_KEYS: TrimKey[] = ['roof', 'fenders', 'box', 'thermoking'];

interface TrimSpec {
  /** Como a peça se chama na tela. */
  label: string;
  /** Casa uma malha da peça. */
  match: (o: THREE.Mesh, mats: (THREE.Material | null)[]) => boolean;
  /**
   * O objeto a ESCONDER, quando esconder não for "as malhas que `match` casou".
   *
   * Existe por causa do Thermo King, e o defeito que ele produziu é instrutivo:
   * `match` o encontra pelo material `tk-housing-white`, que é a CHAPA — mas a
   * unidade tem CINCO malhas (chapa, decalques, logo, corpo e detalhe impresso,
   * ver `thermoking_meta.json`). Esconder só o que casou tirava a carcaça e
   * deixava os decalques e o logo flutuando no ar, colados na testeira.
   *
   * Casar por material é o certo para PINTAR (só a chapa recebe tinta) e o
   * errado para ESCONDER (a peça é o conjunto). São duas perguntas diferentes, e
   * antes disto elas tinham uma resposta só.
   */
  hideRoot?: () => THREE.Object3D | null;
  /**
   * Dentro de uma malha casada, quais materiais recebem tinta. Ausente = todos.
   * Só a caixa precisa — ver o bloco A CAIXA.
   */
  paintMats?: RegExp;
  /** A peça aceita cor própria? `false` = ela só aparece/some. */
  paintable: boolean;
  /** A peça pode ser removida do produto? */
  hideable: boolean;
  /** Sem cor própria, ela segue a cor do baú? Ver a regra acima. */
  followsBody: boolean;
}

const nameOf = (m: THREE.Material | null | undefined) => (m && m.name) || '';
const anyMat = (mats: (THREE.Material | null)[], re: RegExp) =>
  mats.some((m) => re.test(nameOf(m)));

/* `^teto-externo` e não `teto`: existe um `teto-interno` com o MESMO material
   branco, e ele é o forro. Pintá-lo não aparece de lugar nenhum — o teto fechado
   o esconde — e só gastaria uma troca de material. */
const ROOF_NODE_RE = /^teto-externo/i;
/* E O TETO DE VERDADE É O DO CORPO PARAMÉTRICO, quando ele existe.
   ---------------------------------------------------------------------------
   Este é o conserto do defeito mais teimoso deste arquivo, e o relato dele era
   exatamente "o teto não está sendo pintado aqui, mas quando aplico uma pintura
   geral ele é pintado".

   A causa: `TrailerBody.rebuild()` (trailer-geometry.ts) ESCONDE as malhas
   brancas de fábrica — `teto-externo` entre elas — e passa a desenhar o corpo
   inteiro a partir da própria geometria. A cor escolhida aqui era escrita numa
   malha invisível, com `invalidate()` e tudo, e a tela não mudava. A pintura
   geral funcionava porque ela casa por MATERIAL (`trailerPanelMeshes()`) e
   alcança a malha gerada, que é onde o teto de fato está.

   Trocar material não alcança um subconjunto de triângulos, então a saída foi
   dar ao teto uma MALHA. `rebuild()` agora escreve os triângulos de
   `teto-externo` num buffer próprio, `TRAILER_ROOF`, com o mesmo material do
   corpo — invisível de olho nu, e um alvo real para a troca. Esta linha é o que
   liga as duas pontas. */
const ROOF_MESH_RE = new RegExp(`^${TRAILER_ROOF_MESH}$`);
const FENDER_MAT_RE = /^paralamas$/i;
/* Os dois nomes de nó que o bake dá à caixa vêm de `models.ts`, que também
   precisa deles para tirar a ferragem da caixa do inox do implemento
   (`splitTrailerHardware`). Duas cópias de "como se acha a caixa" divergiriam
   no primeiro re-bake, e o sintoma seria uma metade da peça obedecendo ao card
   de acabamentos e a outra não. */
const BOX_NODE_RE = TRAILER_BOX_NODE_RE;
/* A CHAPA da caixa: a folha e as duas peças de fechamento dela. A ferragem
   (`inox-ferragem`) saiu daqui de propósito — ver o bloco A CAIXA. Âncoras
   `^…$` porque a exclusividade medida é DESTES dois nomes. */
const BOX_PAINTABLE_RE = /^plastico-cinza-polido$|^metal-claro$/i;
const TK_MAT_RE = /tk-housing-white/i;

/** Um nó casa a peça se ELE ou algum ancestral casar — as malhas são netas. */
function selfOrAncestor(o: THREE.Object3D, re: RegExp): boolean {
  for (let n: THREE.Object3D | null = o; n; n = n.parent) {
    if (re.test(n.name || '')) return true;
    /* Para no dono do implemento: acima dele estão os grupos da cena, e um nome
       de grupo que por acaso casasse arrastaria o veículo inteiro. */
    if (n === state.trailer) break;
  }
  return false;
}

const SPECS: Record<TrimKey, TrimSpec> = {
  roof: {
    label: 'Teto',
    /* As DUAS formas do teto — a malha gerada quando há corpo paramétrico e o
       nó de fábrica quando não há. Nunca as duas ao mesmo tempo: onde o
       paramétrico existe, `teto-externo` está escondido e `applyTrim()` nem o
       enxerga (ver `visibleInScene`). */
    match: (o) => ROOF_MESH_RE.test(o.name)
      || ROOF_NODE_RE.test(o.name) || selfOrAncestor(o, ROOF_NODE_RE),
    paintable: true,
    hideable: false,
    followsBody: true,
  },
  fenders: {
    label: 'Paralamas',
    match: (_o, mats) => anyMat(mats, FENDER_MAT_RE),
    paintable: true,
    hideable: false,
    followsBody: false,
  },
  box: {
    label: 'Caixa de cozinha',
    match: (o) => selfOrAncestor(o, BOX_NODE_RE),
    /* Continua declarada e não é mais alcançada — ver o bloco do cabeçalho
       sobre a caixa ter perdido a cor. É a memória de qual material é chapa. */
    paintMats: BOX_PAINTABLE_RE,
    paintable: false,
    hideable: true,
    followsBody: false,
  },
  thermoking: {
    label: 'Thermo King',
    match: (_o, mats) => anyMat(mats, TK_MAT_RE),
    /* A unidade INTEIRA, e não só a chapa que `match` casou — ver `hideRoot`. */
    hideRoot: () => state.tk,
    paintable: true,
    hideable: true,
    followsBody: true,
  },
};

/** O que o usuário escolheu para uma peça. `color: null` = sem cor própria. */
export interface TrimPiece {
  color: string | null;
  /** A receita da tinta — acabamento, floco, pérola. Segue a do veículo por padrão. */
  recipe: PaintPatch | null;
  visible: boolean;
}

export type TrimChoice = Partial<Record<TrimKey, Partial<TrimPiece>>>;

const pieces: Record<TrimKey, TrimPiece> = {
  roof: { color: null, recipe: null, visible: true },
  fenders: { color: null, recipe: null, visible: true },
  box: { color: null, recipe: null, visible: true },
  thermoking: { color: null, recipe: null, visible: true },
};

/* Uma demão POR PEÇA, criada só quando a peça ganha cor. Uma peça que ninguém
   pintou não instancia material nenhum — e é por isso que o custo desta
   funcionalidade, para quem não a usa, é zero. */
const paints = new Map<TrimKey, PaintInstance>();
const materials = new Map<TrimKey, THREE.MeshPhysicalMaterial>();

/**
 * O ACABAMENTO DE UMA PEÇA É SÓLIDO, sempre — e isto é regra de produto.
 *
 * `PaintInstance` nasce com a receita padrão do veículo, que é METÁLICA
 * (`PAINT_BASE.finish = 'metallic'` em ./paint.ts): 88 % de metalicidade,
 * 55 % de floco e um resto de pérola. Faz sentido para a cabine — é o que a
 * montadora entrega — e não faz nenhum aqui: teto, paralama e carcaça de
 * Thermo King são pintados em cabine com esmalte liso, e a peça saía cintilando
 * ao lado de um baú fosco. O relato foi direto: *"o seletor de cores faz com que
 * sejam cores perolizadas / metálicas, mas devem ser sempre sólidas"*.
 *
 * Aplicado na CRIAÇÃO da demão e repetido a cada `set()`. Na criação porque
 * `makeMaterial()` já escreve os parâmetros correntes no material, e um primeiro
 * quadro metálico apareceria antes de a cor chegar; a cada `set()` porque
 * `PaintInstance.set()` só reaplica o preset quando o acabamento MUDA, então
 * repetir é barato e é o que impede uma receita futura de deixar a peça
 * metálica sem ninguém pedir.
 */
const SOLID: PaintPatch = { finish: 'solid' };

function paintOf(key: TrimKey): THREE.MeshPhysicalMaterial {
  let mat = materials.get(key);
  if (!mat) {
    const inst = createPaintInstance();
    inst.set(SOLID);
    paints.set(key, inst);
    mat = inst.makeMaterial();
    mat.name = `carpaint-${key}`;
    /* A SONDA, e sem ela a peça sai LAVADA. Esta demão nasce no primeiro clique
       que pede a cor — muito depois de `refreshVehicleReflection()` ter passado
       pelo veículo —, então ela não tem `envMap` próprio e cai no HDRI cru do
       céu. Com tinta escura isso é a diferença entre preto e cinza; ver o bloco
       de `probeTex` em models.ts, onde o mesmo defeito foi medido no baú. */
    adoptProbeMaterial(mat);
    materials.set(key, mat);
  }
  return mat;
}

/** A cor VIVA de cada peça, copiada. A interface lê daqui e não guarda cópia. */
export const getTrim = (): Record<TrimKey, TrimPiece> => ({
  roof: { ...pieces.roof },
  fenders: { ...pieces.fenders },
  box: { ...pieces.box },
  thermoking: { ...pieces.thermoking },
});

export const trimLabel = (key: TrimKey) => SPECS[key].label;
export const trimHideable = (key: TrimKey) => SPECS[key].hideable;
/** A peça aceita cor própria? A caixa de cozinha não aceita mais. */
export const trimPaintable = (key: TrimKey) => SPECS[key].paintable;
/** As peças que a interface oferece para PINTAR, na ordem em que ela as mostra. */
export const TRIM_PAINT_KEYS: TrimKey[] = TRIM_KEYS.filter((k) => SPECS[k].paintable);
/** As peças que a interface oferece para REMOVER do produto. */
export const TRIM_HIDE_KEYS: TrimKey[] = TRIM_KEYS.filter((k) => SPECS[k].hideable);
/** Sem cor própria, a peça segue o baú? A interface diz uma frase para cada
 *  caso — "Como o baú" contra "Original" —, e as duas são a verdade. */
export const trimFollowsBody = (key: TrimKey) => SPECS[key].followsBody;

/** Visível de verdade: a malha e toda a cadeia de pais até o implemento. */
function visibleInScene(o: THREE.Object3D): boolean {
  for (let n: THREE.Object3D | null = o; n; n = n.parent) {
    if (!n.visible) return false;
    if (n === state.trailer) break;
  }
  return true;
}

/* Um aviso por peça e por sessão. O estado não muda entre dois cliques, e
   repetir a mesma linha a cada recomposição afogaria o console durante uma
   edição de medidas — que é justamente quando ele acontece. */
const warned = new Set<TrimKey>();
function warnHidden(key: TrimKey) {
  if (warned.has(key)) return;
  warned.add(key);
  console.warn(
    `[trim] "${SPECS[key].label}" recebeu cor, mas todas as malhas dela estão`
    + ' ESCONDIDAS — provavelmente o corpo paramétrico as absorveu'
    + ' (trailer-geometry.ts, TrailerBody.rebuild → `originals.visible = false`).'
    + ' A cor está aplicada e não aparece.'
    + ' Conserto: dar à peça uma malha própria no corpo paramétrico, como o teto'
    + ` tem (${TRAILER_ROOF_MESH}). Ver applyTrim().`,
  );
}

/** As malhas de uma peça, agora. Varre `state.trailer` — o Thermo King é filho
 *  dele (`trailerRoot.add(tk)`), então uma varredura alcança as quatro. */
function meshesOf(key: TrimKey): THREE.Mesh[] {
  const root = state.trailer;
  if (!root) return [];
  const spec = SPECS[key];
  const out: THREE.Mesh[] = [];
  root.traverse((node) => {
    const o = node as THREE.Mesh;
    if (!o.isMesh) return;
    const mats = Array.isArray(o.material) ? o.material : [o.material];
    if (spec.match(o, mats)) out.push(o);
  });
  return out;
}

/**
 * O material a devolver quando a peça PERDE a cor própria.
 *
 * `trimOrigMat` é uma chave PRÓPRIA, deliberadamente diferente do `origMat` que
 * `setPaintTarget()` usa. Se as duas fossem a mesma, o laço de restauração de lá
 * ("toda malha com origMat volta ao original") desfaria a pintura do paralama
 * toda vez que alguém desligasse "pintar o implemento".
 *
 * `null` = não mexa: ninguém pintou esta malha, então o material que está nela é
 * o que quem é dono dele acabou de escrever.
 *
 * ---------------------------------------------------------------------------
 * QUEM SEGUE O CORPO PRECISA DE UMA RESPOSTA, e a versão anterior devolvia
 * `null` para teto e Thermo King por raciocinar que `setPaintTarget()` já teria
 * escrito o material certo neles. Ele escreve — mas só no ramo `'both'`. Com a
 * pintura do implemento DESLIGADA, que é o padrão, o ramo `'cab'` só restaura
 * malhas que tenham `origMat`, e uma peça que nunca passou por `'both'` não tem.
 *
 * O resultado era uma cor que não saía: escolher azul para o Thermo King e
 * depois voltar para "Como o baú" deixava o Thermo King azul, sem nada na tela
 * dizendo por quê. Medido no caminho `cab` puro, que é onde a maioria das
 * sessões vive.
 *
 * A resposta certa é explícita e depende do alvo da tinta AGORA:
 *
 *   'both'  a tinta do baú — `state.trailerPaintMat`, o mesmo material que
 *           `setPaintTarget()` acabou de pôr em todas as chapas;
 *   'cab'   o material de fábrica, que é `origMat` quando ele existe (a peça já
 *           passou por 'both' alguma vez) e `trimOrigMat` quando não.
 */
function restoreOf(key: TrimKey, mesh: THREE.Mesh): THREE.Material | THREE.Material[] | null {
  const factory = (mesh.userData.trimOrigMat
    ?? mesh.userData.origMat) as THREE.Material | THREE.Material[] | undefined;
  if (SPECS[key].followsBody && state.paintTarget === 'both') {
    return state.trailerPaintMat ?? factory ?? null;
  }
  return factory ?? null;
}

/**
 * Escreve o estado das quatro peças na cena.
 *
 * Idempotente e barato: sem cor e sem peça escondida, é uma varredura e nenhuma
 * escrita. Roda no fim de `setPaintTarget()` e a cada reconstrução das chapas.
 */
export function applyTrim() {
  if (!state.trailer) return;

  for (const key of TRIM_KEYS) {
    const spec = SPECS[key];
    const piece = pieces[key];
    const meshes = meshesOf(key);
    /* `spec.paintable` entra na conta e não só no desenho da interface: uma
       escolha GRAVADA antes de a caixa perder a cor ainda traz o hex dela, e
       sem esta guarda ela voltaria pintada num app que não oferece mais como
       despintar. Ver `normalizeChoice()` — a gravação não filtra, o motor sim. */
    const wantPaint = spec.paintable && !!piece.color;

    /* A VISIBILIDADE PRIMEIRO, e ela é da PEÇA, não das malhas pintáveis dela.
       Quando há `hideRoot`, esconde-se o conjunto num nó só — é o que faz o
       Thermo King sumir inteiro, com decalques e logo, em vez de deixar as
       outras quatro malhas no ar. Uma peça escondida ainda assim recebe tinta
       abaixo: esconder e reexibir não pode perder a cor escolhida, e quem a
       carrega é o material. */
    if (spec.hideable) {
      const root = spec.hideRoot?.();
      if (root) root.visible = piece.visible;
      else for (const mesh of meshes) mesh.visible = piece.visible;
    }

    for (const mesh of meshes) {
      if (wantPaint) {
        const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
        /* O filtro de material é por MALHA, não por peça: dentro da caixa
           convivem chapa e plástico preto, e só a chapa é pintada. */
        if (spec.paintMats && !anyMat(mats, spec.paintMats)) continue;
        if (!mesh.userData.trimOrigMat) mesh.userData.trimOrigMat = mesh.material;
        mesh.material = paintOf(key);
      } else {
        const back = restoreOf(key, mesh);
        if (back) {
          mesh.material = back;
          delete mesh.userData.trimOrigMat;
        }
      }
    }

    /* A receita entra DEPOIS de o material existir. `color` é o que decide se a
       demão existe; o resto da receita é opcional e segue a do veículo quando
       ninguém a informa. */
    if (wantPaint) {
      const inst = paints.get(key);
      if (inst) inst.set({ ...SOLID, ...(piece.recipe || {}), color: piece.color as string });
      /* PINTOU ALGUMA COISA QUE ESTÁ NA TELA?
         ---------------------------------------------------------------
         Esta pergunta nasceu do TETO, e o defeito que ela denunciava está
         CONSERTADO — `TRAILER_ROOF` existe justamente para isso (ver
         `ROOF_MESH_RE`). Ela fica porque a classe de defeito não é do teto: é
         de qualquer peça cujas malhas o corpo paramétrico venha a absorver num
         re-bake. Uma cor aceita que não muda um pixel é a pior falha possível
         aqui, e um aviso por peça e por sessão é barato.

         A peça ESCONDIDA de propósito não conta: quem tirou o Thermo King do
         produto não quer ler que a cor dele não aparece. */
      if (piece.visible && meshes.length && !meshes.some((m) => visibleInScene(m))) {
        warnHidden(key);
      }
    }
  }

  invalidate();
}

/* Quem quiser GRAVAR uma mudança de acabamento. O assinante é `studio.ts`, que
   é o dono da escolha persistida — este arquivo não fala com o localStorage, do
   mesmo jeito que não fala com o catálogo.

   POR QUE UM OUVINTE E NÃO UMA CHAMADA DIRETA: `studio.ts` importa `ui/*` e
   `vehicle/*`; uma chamada daqui para lá fecharia um ciclo sobre o módulo que
   monta o estúdio inteiro. É o mesmo desenho de `onTrailerPanelsRebuilt()` e
   `onMeasuresChanged()`, e pelo mesmo motivo. */
type TrimListener = () => void;
const trimListeners: TrimListener[] = [];
export function onTrimChanged(cb: TrimListener) {
  trimListeners.push(cb);
  return () => {
    const i = trimListeners.indexOf(cb);
    if (i >= 0) trimListeners.splice(i, 1);
  };
}

/**
 * Muda uma peça. Campos ausentes ficam como estão.
 *
 * `color: null` devolve a peça ao que ela era — a cor do baú (teto, Thermo King)
 * ou o material de fábrica (paralamas, caixa).
 */
export function setTrim(key: TrimKey, patch: Partial<TrimPiece>): TrimPiece {
  const piece = pieces[key];
  if (patch.color !== undefined) piece.color = patch.color || null;
  if (patch.recipe !== undefined) piece.recipe = patch.recipe;
  if (patch.visible !== undefined) piece.visible = !!patch.visible;

  /* PASSA POR setPaintTarget(), e não direto por applyTrim(). Parece um desvio e
     não é: tirar a cor de uma peça que SEGUE O CORPO exige recalcular qual
     material ela deveria ter — e quem sabe isso é o dono do alvo da tinta, não
     este arquivo. `setPaintTarget()` reaplica o estado atual (restaura os
     originais, repinta conforme 'cab'/'both') e chama applyTrim() no fim.
     É a mesma razão de `restoreOf()` devolver `null` para essas duas peças. */
  setPaintTarget(state.paintTarget === 'both' ? 'both' : 'cab');
  for (const cb of trimListeners) cb();
  return { ...piece };
}

/**
 * Muda SÓ O TOM de uma peça que já está pintada — o caminho do arrasto.
 *
 * Existe porque o card de configurações passou a ter um seletor de cor de
 * verdade (2026-08-13, a pedido: as pastilhas pré-definidas saíram), e um
 * seletor de cor emite `input` a cada pixel que o dedo anda dentro dele. Cada
 * um desses eventos, por `setTrim()`, custa um `setPaintTarget()` inteiro:
 * varrer as ~2 150 malhas do implemento, restaurar materiais, reconstruir o
 * overlay da testeira e reaplicar as quatro peças. Trinta vezes por segundo.
 *
 * Quando a peça JÁ TEM cor, nada disso é necessário — o material dela existe,
 * está na malha certa, e a única coisa que muda é um uniforme. Então este
 * caminho escreve na demão e pede um quadro, e mais nada.
 *
 * Devolve `false` quando não pôde ser barato (a peça não tem cor ainda, ou não
 * pinta), e aí quem chama passa por `setTrim()`. NÃO avisa os ouvintes: gravar
 * a escolha a cada quadro de um arrasto encheria o localStorage de estados
 * intermediários que ninguém escolheu — quem arrasta comita no fim.
 */
export function setTrimColorLive(key: TrimKey, hex: string): boolean {
  const piece = pieces[key];
  if (!SPECS[key].paintable || !piece.color) return false;
  const inst = paints.get(key);
  if (!inst) return false;
  piece.color = hex;
  inst.set({ ...SOLID, ...(piece.recipe || {}), color: hex });
  invalidate();
  return true;
}

/**
 * Aplica a escolha inteira de uma vez — o caminho da HIDRATAÇÃO.
 *
 * NÃO avisa os ouvintes, e isso é deliberado: quem chama é quem acabou de LER a
 * escolha gravada, e um aviso aqui a mandaria de volta ao disco no mesmo tick —
 * uma gravação que só pode escrever o que acabou de ler, e que no caminho
 * passaria por `normalizeChoice()` mais uma vez sem necessidade.
 */
export function setTrimChoice(choice: TrimChoice | null | undefined) {
  for (const key of TRIM_KEYS) {
    const p = choice?.[key];
    const piece = pieces[key];
    /* A cor de uma peça que não pinta mais é DESCARTADA na hidratação, e não só
       ignorada em `applyTrim()`: sem isto ela voltaria ao disco na primeira
       gravação e sobreviveria a mudança de produto para sempre. */
    piece.color = (SPECS[key].paintable && p && p.color) || null;
    piece.recipe = (p && p.recipe) || null;
    /* Ausente = visível. Uma escolha gravada antes de a peça poder ser escondida
       não pode fazê-la sumir. */
    piece.visible = p?.visible !== false;
  }
  setPaintTarget(state.paintTarget === 'both' ? 'both' : 'cab');
}

/**
 * A forma GRAVADA de um acabamento: só hex e booleano.
 *
 * DELIBERADAMENTE MAIS POBRE que `TrimPiece`, e o que fica de fora é `recipe` —
 * a receita completa da tinta (acabamento, floco, pérola, casca de laranja).
 * Ela é um objeto de ~20 campos por peça, e gravá-la multiplicaria por quatro o
 * tamanho da escolha para descrever um ajuste que a interface nem oferece: o
 * card de acabamentos escolhe uma COR da paleta, e a receita dela vem do
 * catálogo. Quando existir um ajuste fino por peça, é aqui que ele entra — e aí
 * a chave da escolha sobe de versão.
 *
 * O tipo é estruturalmente o `TrimChoiceRaw` de `catalog/catalog.ts`, e é assim
 * de propósito: os dois módulos não se importam (o catálogo não pode depender de
 * `vehicle/*`), então o contrato entre eles é a FORMA. Um campo novo aqui que
 * não exista lá é descartado em silêncio pela lista branca de `normalizeTrim()`.
 */
export type TrimSaved = Record<string, { color?: string; visible?: boolean }>;

/**
 * O que vale a pena GRAVAR: só as peças que fogem do padrão.
 *
 * `undefined` quando nada foge — é o que mantém o `Choice` gravado idêntico ao
 * de antes desta funcionalidade para quem não a usa, e o que faz `sameRig()` não
 * ver diferença onde não há.
 */
export function trimChoice(): TrimSaved | undefined {
  const out: TrimSaved = {};
  let any = false;
  for (const key of TRIM_KEYS) {
    const p = pieces[key];
    /* A cor de uma peça que não pinta mais não é gravada — mesmo par de
       `setTrimChoice()`. Sem isto, um `Choice` antigo com a caixa colorida
       sobreviveria a cada gravação e `sameRig()` continuaria vendo diferença
       onde o produto não tem mais nenhuma. */
    const color = trimPaintable(key) ? p.color : null;
    if (!color && p.visible) continue;
    out[key] = { ...(color ? { color } : {}), ...(p.visible ? {} : { visible: false }) };
    any = true;
  }
  return any ? out : undefined;
}

/* ---------------- as duas assinaturas ----------------
   Depois do alvo da tinta (obrigatório — ver o cabeçalho de
   `onPaintTargetApplied`) e depois de as chapas serem recortadas de novo.

   A SEGUNDA NÃO É REDUNDANTE: recortar um vão de porta REESCREVE o corpo branco
   inteiro (ver `setTrailerDoors`), e o teto sai desse mesmo corpo. Sem esta
   assinatura, editar uma porta com o teto pintado devolveria um teto branco — e
   o relato seria "a cor do teto some quando mexo nas medidas", que é a última
   coisa que alguém ligaria a um recorte de porta. */
onPaintTargetApplied(applyTrim);
onTrailerPanelsRebuilt(() => applyTrim());
