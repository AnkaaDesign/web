/* Os ACABAMENTOS: teto, paralamas, caixa de ferramentas e Thermo King.
   ---------------------------------------------------------------------------
   Quatro peças que o cliente escolhe pintar SEPARADAMENTE do baú — e, no caso da
   caixa e do Thermo King, escolhe não ter.

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

       56 148 tri   59 malhas   inox-ferragem           ← a chapa
       45 341 tri    2 malhas   plastico-preto
       30 575 tri   10 malhas   caixa-estrutura-preta
        2 240 tri    6 malhas   metal-preto
        1 332 tri    1 malha    plastico-cinza-polido
        1 300 tri    2 malhas   metal-claro             ← a chapa

   `PAINTABLE` é o filtro, e ele é a POLÍTICA da peça, não um detalhe: pintar a
   caixa pinta a CHAPA dela; o plástico preto, a estrutura preta e o cinza
   polido continuam pretos e cinzas, que é o que acontece numa cabine de pintura
   de verdade. A parte que este código não sabe fazer é separar a chapa da
   DOBRADIÇA — as duas são `inox-ferragem` e o bake não as distingue. Se um dia
   isso incomodar, o conserto é no bake (dar nome próprio à ferragem), não aqui:
   qualquer tentativa de separá-las por geometria seria exatamente o tipo de
   heurística que o resto deste diretório evita.

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
   `onPaintTargetApplied()`. Quem segue o corpo e não tem cor própria é deixado
   EM PAZ — o material certo já foi escrito por quem é dono dele. Ver
   `restoreOf()`. */
import * as THREE from 'three';
import {
  state, onPaintTargetApplied, onTrailerPanelsRebuilt, setPaintTarget,
} from './models';
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
  paintable?: RegExp;
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
const FENDER_MAT_RE = /^paralamas$/i;
/* Os dois nomes de nó que o bake dá à caixa. O `#Caixa-Ferrmantas-modelo-1padrao`
   é o nó-pai e os `Caixa-ferrmantas-modelo1_pNN` são as 79 peças; o
   `caixa-plastico-ferramentas` é a bandeja interna. */
const BOX_NODE_RE = /caixa-ferrmantas|caixa-plastico-ferramentas/i;
const BOX_PAINTABLE_RE = /inox-ferragem|metal-claro/i;
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
    match: (o) => ROOF_NODE_RE.test(o.name) || selfOrAncestor(o, ROOF_NODE_RE),
    hideable: false,
    followsBody: true,
  },
  fenders: {
    label: 'Paralamas',
    match: (_o, mats) => anyMat(mats, FENDER_MAT_RE),
    hideable: false,
    followsBody: false,
  },
  box: {
    label: 'Caixa de ferramentas',
    match: (o) => selfOrAncestor(o, BOX_NODE_RE),
    paintable: BOX_PAINTABLE_RE,
    hideable: true,
    followsBody: false,
  },
  thermoking: {
    label: 'Thermo King',
    match: (_o, mats) => anyMat(mats, TK_MAT_RE),
    /* A unidade INTEIRA, e não só a chapa que `match` casou — ver `hideRoot`. */
    hideRoot: () => state.tk,
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

function paintOf(key: TrimKey): THREE.MeshPhysicalMaterial {
  let mat = materials.get(key);
  if (!mat) {
    const inst = createPaintInstance();
    paints.set(key, inst);
    mat = inst.makeMaterial();
    mat.name = `carpaint-${key}`;
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
    + ' ESCONDIDAS — o baú paramétrico assumiu e desenha o branco numa malha'
    + ' única gerada (trailer-geometry.ts, TrailerBody.rebuild →'
    + ' `originals.visible = false`). A cor está aplicada e não aparece.'
    + ' Conserto: grupos de geometria no corpo paramétrico. Ver applyTrim().',
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
 * `null` significa "não mexa" — e é a resposta certa para teto e Thermo King:
 * `setPaintTarget()` acabou de rodar e já escreveu neles o material correto
 * (a tinta do baú, ou o branco de fábrica). Devolver um material lembrado aqui
 * seria devolver um valor VELHO por cima de um recém-calculado, e o defeito
 * apareceria só depois de alternar "pintar o implemento" com o teto colorido.
 *
 * Para paralamas e caixa a resposta é o material do bake, guardado em
 * `trimOrigMat` — uma chave PRÓPRIA, deliberadamente diferente do `origMat` que
 * `setPaintTarget()` usa. Se as duas fossem a mesma, o laço de restauração de lá
 * ("toda malha com origMat volta ao original") desfaria a pintura do paralama
 * toda vez que alguém desligasse "pintar o implemento".
 */
function restoreOf(key: TrimKey, mesh: THREE.Mesh): THREE.Material | THREE.Material[] | null {
  if (SPECS[key].followsBody) return null;
  return (mesh.userData.trimOrigMat as THREE.Material | THREE.Material[] | undefined) ?? null;
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
    const wantPaint = !!piece.color;

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
        if (spec.paintable && !anyMat(mats, spec.paintable)) continue;
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
      if (inst) inst.set({ ...(piece.recipe || {}), color: piece.color as string });
      /* PINTOU ALGUMA COISA QUE ESTÁ NA TELA?
         ---------------------------------------------------------------
         Esta pergunta existe por causa do TETO, e o defeito que ele expôs é o
         mais traiçoeiro deste arquivo: `teto-externo` casa, recebe o material
         de tinta, `invalidate()` roda — e a tela não muda. A cor é aplicada
         numa malha INVISÍVEL.

         A causa está em `trailer-geometry.ts`: quando o baú paramétrico assume
         (qualquer edição de medida ou de porta), `TrailerBody.rebuild()`
         termina com `for (const m of this.originals) m.visible = false` e passa
         a desenhar UMA malha só, gerada, no lugar de todas as brancas de
         fábrica — e `collect()` recolhe como "original" toda malha cujo
         material case `WHITE_RE`, o que inclui o teto (`Cor_padrao_branco`).
         O teto que se vê deixa de ser um nó e passa a ser um punhado de
         triângulos dentro do corpo gerado.

         Trocar material não alcança um subconjunto de triângulos: o conserto
         de verdade é dar ao corpo paramétrico um SEGUNDO grupo de geometria
         (`addGroup`) com os triângulos de teto e um array de materiais — e isso
         tem de sobreviver a cada `rebuild()` e conviver com o
         `setPaintTarget()`, que hoje escreve um material único na malha.

         Enquanto isso não existe, o mínimo é NÃO MENTIR: um controle que
         aceita a cor e não muda nada é pior do que um que se recusa e diz por
         quê. */
      if (meshes.length && !meshes.some((m) => visibleInScene(m))) {
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
    piece.color = (p && p.color) || null;
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
    if (!p.color && p.visible) continue;
    out[key] = { ...(p.color ? { color: p.color } : {}), ...(p.visible ? {} : { visible: false }) };
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
