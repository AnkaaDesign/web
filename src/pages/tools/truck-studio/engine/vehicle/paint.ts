/* Automotive car-paint material system.
   ---------------------------------------------------------------------------
   Three finish families, matching how real paint is built (e-coat → basecoat →
   optional mica mid-coat → clearcoat):

     'solid'    pigmented basecoat + clearcoat. metalness 0. No flakes, no
                colour travel — flat colour with one sharp coat reflection.
     'metallic' aluminium FLAKES suspended in a coloured basecoat. This is
                *paint* metallic, NOT bare aluminium: the basecoat stays a
                coloured dielectric (metalness ≤ 0.28) and the metal shows up
                only as sparse pin-point flake glints plus a lightness "flop"
                (bright face-on, darker at grazing angles). Pushing metalness
                toward 1 is the classic mistake that turns paint into chrome —
                three.js kills diffuse as metalness rises
                (material.diffuseColor = diffuse * (1 - metalness)), so the
                pigment disappears. Hence the hard cap.
     'pearl'    mica / interference platelets. The hue TRAVELS with viewing
                angle: a face colour that shifts toward a flop colour as the
                surface turns away. Pearls also sparkle, but ~1/3 as densely as
                a metallic.

   Why not three.js `iridescence` for pearl: it is a Belcour-Barla thin-film
   model applied to the SPECULAR lobe only (BRDF_GGX does
   F = mix(F, material.iridescenceFresnel, material.iridescence)), it never
   tints diffuse, and its thickness range sweeps several interference orders —
   which reads as soap bubble, not as mica. Real interference pigment has an
   engineered narrow thickness and therefore ONE hue transition. We instead
   write the travelled colour straight into `diffuseColor` before
   <lights_physical_fragment>; because three then derives
   material.specularColor = mix(0.04, diffuseColor, metalness), a small
   metalness makes the F0 tint inherit the travel too — one injection, both
   lobes, and it survives environment-only lighting.

   Shader injection points (verified against the vendored r171 meshphysical
   fragment shader, whose main() order is:
     … normal_fragment_maps → clearcoat_normal_fragment_begin →
     clearcoat_normal_fragment_maps → emissivemap_fragment →
     lights_physical_fragment → lights_fragment_begin → lights_fragment_maps →
     lights_fragment_end → aomap_fragment → (clearcoat combine) →
     opaque_fragment … ):

     <clearcoat_normal_fragment_begin>  + orange-peel micro-normal on the COAT
                                          only (the basecoat stays smooth)
     <lights_physical_fragment>       pre: pearl travel + metallic flop written
                                          into diffuseColor; flake glint from
                                          the key light
                                     post: orange peel roughens the coat
     <lights_fragment_end>            + environment-lit flakes, added to
                                          directSpecular so the clearcoat
                                          attenuates them (flakes live UNDER
                                          the coat — this ordering is what
                                          keeps it from reading as sandpaper)
*/
import * as THREE from 'three';
import { clamp01 } from '../core/dom';

/* ---------------- parameter space ----------------
   Everything the UI can touch, normalised 0..1 (or a hex colour). This object
   is the single source of truth, is what localStorage/share links would carry,
   and is applied to every paint material by applyToMaterials(). */
const PAINT_FINISHES = ['solid', 'metallic', 'pearl'] as const;

/** The three finish families; see the module header for what each one models. */
export type PaintFinish = (typeof PAINT_FINISHES)[number];

/**
 * UMA RECEITA DE TINTA — o mesmo conjunto de campos que `paint-lab.html` salva.
 *
 * Este tipo deixou de ser "o que a UI pode mexer" e passou a ser O CONTRATO COM
 * O LABORATÓRIO. O laboratório é onde a tinta é ajustada no olho, contra
 * geometria e luz de verdade; se ele produz um campo que este material não sabe
 * ler, a tinta aprovada lá não é a tinta que sai aqui — e foi exatamente o que
 * acontecia com `pearlMid` e `peelDetail`.
 *
 * Todos os nomes são os DO LABORATÓRIO, deliberadamente. Já houve uma tradução
 * no meio (`flop`, `flakeSize`, `flakeGlint`, `pearlSharp`, `ccGloss`) e ela era
 * uma fonte silenciosa de divergência: cada renomeio é uma chance de o mapa
 * ficar defasado do shader. Uma receita colada do laboratório agora entra em
 * setPaint() sem passar por lugar nenhum que precise ser mantido em dia.
 */
export interface PaintParams {
  finish: PaintFinish;
  color: string;
  metalness: number;
  roughness: number;
  /** 0..1 — brilho do verniz; vira clearcoatRoughness */
  gloss: number;

  /* ---- perolizado: a cor VIAJA com o ângulo, face → meio → virada ---- */
  pearlAmount: number;
  /** o tom do MEIO do percurso — o que faltava, e o que separa um perolizado
      de dois tons de um de três */
  pearlMid: string;
  /** a cor no ângulo rasante (o amarelo do Saiph, o rosa do Ruby) */
  pearlFlip: string;
  /** expoente do percurso: alto = a virada só aparece bem de raspão */
  pearlTravel: number;

  /* ---- floco metálico / mica ---- */
  flakeAmount: number;
  flakeColor: string;
  /** células por metro do Voronoi — densidade real, não um 0..1 */
  flakeDensity: number;
  /** quanto cada floco inclina a normal */
  flakeTilt: number;
  /** rugosidade DO floco (baixa = espelhinho) */
  flakeGloss: number;

  /* ---- casca de laranja, no verniz ---- */
  peel: number;
  peelScale: number;
  /** segunda oitava do ruído: pele mais fina sobre a ondulação grande */
  peelDetail: number;

  /* ---- profundidade do verniz e tamanho do floco na tela ---- */
  /** espessura ótica do verniz: desloca os flocos lateralmente com o ângulo,
      que é o que os faz parecer SUSPENSOS sob um filme e não impressos */
  coatThickness: number;
  /** alvo, em pixels, da célula de floco — governa o antialiasing */
  flakePx: number;
}

/** A metade específica do acabamento — o que trocar de acabamento reseta. */
type PaintFinishDefaults = Omit<PaintParams, 'finish' | 'color'>;

/* Pontos de partida por acabamento. São os MESMOS números do `FINISHES` do
   laboratório, expandidos com os campos que lá vêm do preset carregado. Uma
   tinta com receita sobrepõe tudo isto; estes valores são o que uma tinta sem
   curadoria recebe. */
const PAINT_DEFAULTS_BY_FINISH: Record<PaintFinish, PaintFinishDefaults> = {
  solid: {
    metalness: 0.03, roughness: 0.26, gloss: 1.00,
    pearlAmount: 0.00, pearlMid: '#ffffff', pearlFlip: '#ffffff', pearlTravel: 2.10,
    flakeAmount: 0.00, flakeColor: '#ffffff', flakeDensity: 300,
    flakeTilt: 0.38, flakeGloss: 0.07,
    peel: 0.08, peelScale: 46, peelDetail: 0.5,
    coatThickness: 0.012, flakePx: 2.4,
  },
  metallic: {
    metalness: 0.88, roughness: 0.34, gloss: 0.97,
    pearlAmount: 0.12, pearlMid: '#ffffff', pearlFlip: '#ffffff', pearlTravel: 2.60,
    flakeAmount: 0.55, flakeColor: '#ffffff', flakeDensity: 320,
    flakeTilt: 0.40, flakeGloss: 0.06,
    peel: 0.09, peelScale: 46, peelDetail: 0.5,
    coatThickness: 0.013, flakePx: 2.4,
  },
  pearl: {
    metalness: 0.82, roughness: 0.30, gloss: 1.00,
    pearlAmount: 0.85, pearlMid: '#ffffff', pearlFlip: '#ffffff', pearlTravel: 2.10,
    flakeAmount: 0.38, flakeColor: '#fff6e0', flakeDensity: 300,
    flakeTilt: 0.36, flakeGloss: 0.07,
    peel: 0.08, peelScale: 46, peelDetail: 0.5,
    coatThickness: 0.015, flakePx: 2.4,
  },
};

const PAINT_BASE: PaintParams = {
  finish: 'metallic',
  color: '#b9bec6',
  ...PAINT_DEFAULTS_BY_FINISH.metallic,
};

/* ---------------- cores derivadas da cor base ----------------
   O floco de alumínio absorve parte do pigmento em que está suspenso, e a cor de
   virada da mica é parente da cor de face — um floco ou uma virada escolhidos
   independentemente da base leem como purpurina ou como duas tintas diferentes.
   Por isso as duas SEGUEM a cor base.

   MAS A DERIVAÇÃO É O PADRÃO, NÃO A LEI. Ela existe para a tinta que ninguém
   mediu: dá um resultado plausível a partir de um hex e nada mais. Uma tinta
   MEDIDA sobrepõe.

   Esta distinção já foi apagada uma vez, em 2026-08-03, e vale registrar por
   quê: os dois sinalizadores de override foram removidos como inalcançáveis,
   com o argumento — correto naquele instante — de que o catálogo de cores só
   nomeava hex e acabamento, então ninguém nunca passava `flakeColor` nem
   `pearlColor`. O que mudou foi o DADO, não o código: a tabela `Paint` tem
   receita por tinta (`previewConfig`), e o `Vermelho Ruby` da Scania pede
   `pearlFlip: #ae0034` sobre uma face `#c01c28`. Nenhuma rotação de matiz sobre
   o hex chega lá — é uma medição, não uma fórmula.

   Os sinalizadores voltaram por isso. Sem eles, `syncDerivedColors()` roda a
   cada troca de cor e apaga a receita logo depois de ela ser aplicada. */
const _tmpA = new THREE.Color(), _tmpB = new THREE.Color();
const WHITE_C = new THREE.Color(0xffffff);

function derivedFlakeColor(hex: string) {
  _tmpA.set(hex).lerp(WHITE_C, 0.62);
  return '#' + _tmpA.getHexString(THREE.SRGBColorSpace);
}

/* flop colour: same family, rotated ~55° and a shade deeper — real flop is
   normally darker than the face colour.
   Near-neutral bases are a special case: rotating the hue of a white or grey is
   meaningless (the hue is arbitrary noise, so white would flop to a random
   green). Real white and silver pearls flop to champagne/gold, so that is what
   a desaturated base gets. */
/* Neutrality is measured as CHROMA (max−min), not HSL saturation: the HSL
   denominator collapses toward white and black, so #eef0f2 — a colour 4/255
   off pure grey — reports s ≈ 0.14 and would be treated as a real hue. */
const PEARL_NEUTRAL_CHROMA = 0.10;
const _rgb = { r: 0, g: 0, b: 0 };
function derivedPearlColor(hex: string) {
  const hsl: THREE.HSL = { h: 0, s: 0, l: 0 };
  _tmpA.set(hex).getHSL(hsl, THREE.SRGBColorSpace);
  _tmpA.getRGB(_rgb, THREE.SRGBColorSpace);
  const chroma = Math.max(_rgb.r, _rgb.g, _rgb.b) - Math.min(_rgb.r, _rgb.g, _rgb.b);
  const neutral = chroma < PEARL_NEUTRAL_CHROMA;
  _tmpB.setHSL(
    neutral ? 0.105 : (hsl.h + 0.155) % 1,                       // champagne
    neutral ? 0.30 : Math.min(1, hsl.s * 0.85 + 0.14),
    Math.max(0.14, Math.min(0.70, hsl.l * 0.80 + 0.04)),
    THREE.SRGBColorSpace
  );
  return '#' + _tmpB.getHexString(THREE.SRGBColorSpace);
}

/* Levantados quando uma RECEITA nomeia a cor; a partir daí a derivação não
   toca mais naquele campo. Voltam a zero quando a receita sai (uma tinta sem
   curadoria depois de uma com curadoria). */
let userFlakeColor = false;
let userPearlColor = false;

function syncDerivedColors() {
  if (!userFlakeColor) params.flakeColor = derivedFlakeColor(params.color);
  if (!userPearlColor) {
    /* A virada derivada, e o MEIO do percurso junto. O laboratório autora os
       dois; derivando, o meio fica na metade do caminho entre face e virada —
       que é o que um perolizado de dois tons era antes deste port. */
    const flip = derivedPearlColor(params.color);
    params.pearlFlip = flip;
    params.pearlMid = '#' + _tmpA.set(params.color)
      .lerp(_tmpB.set(flip), 0.5).getHexString(THREE.SRGBColorSpace);
  }
}

/* live parameters */
const params: PaintParams = { ...PAINT_BASE };
const getPaintParams = (): PaintParams => ({ ...params });
syncDerivedColors();               // seed flake/flop tints from the base colour

/* Todo material de tinta vivo. Pertencimento ao CONJUNTO, não casamento de
   nome: os nomes de origem variam ("carpaint", "CarPaint_01", …) e um teste por
   substring seria frágil. */
const materials = new Set<THREE.MeshPhysicalMaterial>();

/**
 * Um ajuste de tinta: a receita inteira, toda opcional.
 *
 * `flakeColor` e `pearlFlip` aceitam `null`, e `null` significa "VOLTE A DERIVAR
 * do hex" — não "pinte de nada". É como uma tinta sem receita desfaz o override
 * deixado por uma tinta com receita; sem esse valor a virada medida da anterior
 * grudaria na próxima.
 */
export type PaintPatch =
  Omit<Partial<PaintParams>, 'flakeColor' | 'pearlFlip'> & {
    flakeColor?: string | null;
    pearlFlip?: string | null;
  };

/* ---------------- uniformes compartilhados ----------------
   Todo material de tinta (cabine + baú + parede dianteira) referencia os MESMOS
   objetos de uniform, então uma escrita atualiza todos ao vivo.

   Estes são, um a um, os uniformes de `paint-lab.html`. Não é coincidência: o
   shader abaixo É o do laboratório. Ver o cabeçalho de installPaintShader(). */
const U = {
  uFlakeAmount: { value: 0 },
  uFlakeScale: { value: 300 },
  uFlakeTilt: { value: 0.38 },
  uFlakeGloss: { value: 0.07 },
  uFlakeColor: { value: new THREE.Color(0xffffff) },
  uFlakePx: { value: 2.4 },
  uCoatThickness: { value: 0.013 },
  uPearlAmount: { value: 0 },
  uPearlTravel: { value: 2.1 },
  uPearlMid: { value: new THREE.Color(0xffffff) },
  uPearlFlip: { value: new THREE.Color(0xffffff) },
  uPeel: { value: 0.09 },
  uPeelScale: { value: 46 },
  uPeelDetail: { value: 0.5 },
};
export const _sharedPaint = U;   // alça de ajuste (window.__studio)

/**
 * Chamado pelo rig da cena a cada quadro. HOJE NÃO FAZ NADA, e isso é
 * intencional — a assinatura fica porque `scene/scene.ts` a importa, e essa
 * importação é o que mantém este módulo sendo um SUMIDOURO de dependências (ver
 * o cabeçalho de scene.ts: a luz é injetada aqui, este arquivo nunca importa a
 * cena; inverter essa aresta fecha um ciclo em cima de um módulo que constrói
 * um WebGLRenderer no tempo de import).
 *
 * Por que deixou de fazer algo: a versão anterior deste shader adicionava o
 * brilho do floco À MÃO, a partir da direção da luz-chave publicada aqui, num
 * termo somado depois de <lights_fragment_end>. O modelo do laboratório não
 * precisa disso — ele perturba a NORMAL, a rugosidade e a metalicidade ANTES da
 * iluminação, então o floco cintila sob qualquer luz que a cena tenha, do sol
 * de meio-dia ao poste de sódio, sem ninguém dizer onde a luz está. É menos
 * código e é mais correto.
 */
export function setKeyLight(_dirView: THREE.Vector3, _colorLinear: THREE.Color,
  _boost?: number) { /* ver acima */ }

/* ---------------- parâmetros → material/uniformes ----------------
   UM PARA UM com a receita. Não há mais nenhuma conversão de escala aqui além
   de `gloss → clearcoatRoughness`, que é a mesma fórmula do laboratório
   (glossToCoat). Toda tradução que existia antes — `flakeSize` virando
   frequência, `flakeGlint` virando ganho, `pearlSharp` virando expoente — era
   um lugar a mais para o estúdio divergir do laboratório em silêncio. */
function applyToMaterials() {
  const p = params;

  /* Mesma curva do laboratório: gloss 1 → verniz de vitrine, gloss 0 → acetinado.
     O three trava clearcoatRoughness perto de 0.0525 internamente, então o topo
     da faixa já é o mais liso que a engine desenha. */
  const ccRough = 0.02 + 0.42 * (1 - clamp01(p.gloss));

  const col = new THREE.Color(p.color);
  for (const m of materials) {
    m.color.copy(col);
    m.metalness = clamp01(p.metalness);
    m.roughness = clamp01(p.roughness);
    m.clearcoat = 1.0;
    m.clearcoatRoughness = ccRough;
  }

  U.uPearlAmount.value = clamp01(p.pearlAmount);
  U.uPearlMid.value.set(p.pearlMid || '#ffffff');
  U.uPearlFlip.value.set(p.pearlFlip || '#ffffff');
  /* Piso 0.2: o expoente vai para o denominador do percurso e um valor perto de
     zero faz a virada cobrir a peça inteira de uma vez. */
  U.uPearlTravel.value = Math.max(0.2, p.pearlTravel);

  U.uFlakeAmount.value = clamp01(p.flakeAmount);
  U.uFlakeColor.value.set(p.flakeColor || '#ffffff');
  U.uFlakeScale.value = Math.max(1, p.flakeDensity);
  U.uFlakeTilt.value = Math.max(0, p.flakeTilt);
  U.uFlakeGloss.value = clamp01(p.flakeGloss);
  U.uFlakePx.value = Math.max(0.5, p.flakePx);
  U.uCoatThickness.value = Math.max(0, p.coatThickness);

  U.uPeel.value = Math.max(0, p.peel);
  U.uPeelScale.value = Math.max(1, p.peelScale);
  U.uPeelDetail.value = Math.max(0, p.peelDetail);
}

/**
 * O ÚNICO ajustador. Um funil, porque as conversões são acopladas.
 *
 * Aceita uma receita do laboratório inteira. Campos ausentes ficam como estão;
 * `null` em `flakeColor`/`pearlFlip` significa VOLTE A DERIVAR do hex.
 */
export function setPaint(partial?: PaintPatch): PaintParams {
  const p: PaintPatch = partial || {};
  if (p.finish && p.finish !== params.finish) {
    const f: PaintFinish = PAINT_FINISHES.includes(p.finish) ? p.finish : 'metallic';
    Object.assign(params, PAINT_DEFAULTS_BY_FINISH[f], { finish: f });
    syncDerivedColors();
  }

  /* ANTES do laço: syncDerivedColors() lá embaixo só respeita o que já foi
     declarado explícito, e uma receita que chega junto com a cor tem de ganhar
     dela. */
  if (p.flakeColor !== undefined) userFlakeColor = p.flakeColor !== null;
  if (p.pearlFlip !== undefined) userPearlColor = p.pearlFlip !== null;

  for (const [k, v] of Object.entries(p) as [keyof PaintParams, never][]) {
    if (k === 'finish') continue;
    if (v === null || v === undefined) continue;   // "derive", não "pinte de null"
    if (k in params) params[k] = v;
  }
  if (p.color !== undefined) syncDerivedColors();
  if (p.flakeColor === null || p.pearlFlip === null) syncDerivedColors();

  applyToMaterials();
  return getPaintParams();
}

/* ---------------- GLSL ----------------
   ESTE SHADER É O DE `paint-lab.html`, PORTADO SEM ALTERAÇÃO DE MODELO.
   ---------------------------------------------------------------------------
   POR QUE PORTAR EM VEZ DE MAPEAR. O estúdio tinha um shader de tinta próprio, e
   ele era bom — mas era OUTRO. O laboratório é onde a tinta é aprovada, no olho,
   contra geometria e luz; se o estúdio interpreta a mesma receita com outro
   modelo, o que foi aprovado não é o que sai. Os dois divergiam em coisas que
   nenhum ajuste de parâmetro reconcilia: o perolizado de lá tem TRÊS tons
   (face → meio → virada) e o daqui tinha dois, então `pearlMid` não tinha onde
   entrar; o floco de lá é um Voronoi 3D com refração no verniz e antialiasing
   por oitavas, o daqui era ruído com um termo de brilho somado à mão.

   O que o port TROUXE, além da paridade:
   - `uPearlMid` — o tom do meio do percurso;
   - refração na entrada do verniz (`uCoatThickness`): os flocos deslizam sob o
     filme quando a câmera anda, em vez de parecerem impressos na chapa;
   - antialiasing de floco por oitava (`uFlakePx`): aproximar SUBDIVIDE a célula
     em vez de ampliá-la, e longe converge para a média estatística (que é
     rugosidade) em vez de aliasar em cintilância grossa;
   - `uPeelDetail` — segunda oitava da casca de laranja.

   O que o port LEVOU: o termo de brilho pela luz-chave. Ver setKeyLight().

   PONTOS DE INJEÇÃO. `PAINT_SURFACE` entra depois de <normal_fragment_maps>
   porque é ali que `normal`, `roughnessFactor` e `metalnessFactor` já existem e
   a iluminação ainda não rodou — perturbar os três ali é o que faz o floco
   responder a QUALQUER luz da cena. `PAINT_ORANGEPEEL` entra depois de
   <clearcoat_normal_fragment_maps> pelo mesmo motivo, uma camada acima. */
const PAINT_COMMON = /* glsl */`
varying vec3 vPaintWPos;
uniform float uFlakeAmount; uniform float uFlakeScale; uniform float uFlakeTilt;
uniform float uFlakeGloss;  uniform vec3  uFlakeColor;
uniform float uFlakePx;     uniform float uCoatThickness;
uniform float uPearlAmount; uniform float uPearlTravel;
uniform vec3  uPearlMid;    uniform vec3  uPearlFlip;
uniform float uPeel;        uniform float uPeelScale;  uniform float uPeelDetail;

// Hashes do Dave Hoskins: sem sin(), estáveis entre drivers, e baratos o
// bastante para oito chamadas por pixel na busca do Voronoi.
float pHash13(vec3 q){
  q = fract(q * 0.1031);
  q += dot(q, q.zyx + 31.32);
  return fract((q.x + q.y) * q.z);
}
vec3 pHash33(vec3 q){
  q = fract(q * vec3(0.1031, 0.1030, 0.0973));
  q += dot(q, q.yxz + 33.33);
  return fract((q.xxy + q.yxx) * q.zyx);
}
float pNoise(vec3 x){
  vec3 i = floor(x); vec3 f = fract(x); f = f*f*(3.0-2.0*f);
  float n000=pHash13(i);                     float n100=pHash13(i+vec3(1.0,0.0,0.0));
  float n010=pHash13(i+vec3(0.0,1.0,0.0));   float n110=pHash13(i+vec3(1.0,1.0,0.0));
  float n001=pHash13(i+vec3(0.0,0.0,1.0));   float n101=pHash13(i+vec3(1.0,0.0,1.0));
  float n011=pHash13(i+vec3(0.0,1.0,1.0));   float n111=pHash13(i+vec3(1.0,1.0,1.0));
  float nx00=mix(n000,n100,f.x); float nx10=mix(n010,n110,f.x);
  float nx01=mix(n001,n101,f.x); float nx11=mix(n011,n111,f.x);
  return mix( mix(nx00,nx10,f.y), mix(nx01,nx11,f.y), f.z );
}
float pPeelHeight(vec3 p){ return pNoise(p) + uPeelDetail*0.45*pNoise(p*3.17 + 21.7); }

// Voronoi 3D que preenche o espaço. Todo ponto da superfície cai em exatamente
// uma célula, então os flocos ladrilham a tinta com fronteiras duras e
// irregulares como as de verdade. As sementes só são jitteradas dentro de
// +/-0.36 do centro da célula, o que torna a busca de oito células EXATA: a de
// 27 também estaria certa e custaria o triplo de hash em células que nunca ganham.
// Devolve xyz = o eixo aleatório da célula, w = o sorteio 0..1 dela.
vec4 pFlakeCell(vec3 x, float scale){
  vec3 p   = x*scale;
  vec3 ip  = floor(p);
  vec3 fp  = p - ip;
  vec3 dir = step(vec3(0.5), fp)*2.0 - 1.0;
  float md = 1e9;
  vec3  mc = ip;
  for(int a=0;a<2;a++){
    for(int b=0;b<2;b++){
      for(int c=0;c<2;c++){
        vec3 o    = vec3(float(a),float(b),float(c)) * dir;
        vec3 cid  = ip + o;
        vec3 seed = o + 0.5 + ( pHash33(cid) - 0.5 )*0.72;
        vec3 dl   = seed - fp;
        float d   = dot(dl,dl);
        if(d < md){ md = d; mc = cid; }
      }
    }
  }
  vec3 axis = normalize( pHash33(mc + 17.13)*2.0 - 1.0 + vec3(1e-4,2e-4,3e-4) );
  return vec4(axis, pHash13(mc + 41.7));
}
`;

const PAINT_SURFACE = /* glsl */`
vec3  pV       = normalize( vViewPosition );
vec3  pSmoothN = normal;

// ---------------- perolizado: face -> meio -> virada ----------------
float pNdV = clamp( dot( pSmoothN, pV ), 0.0, 1.0 );
float pT   = pow( 1.0 - pNdV, max( uPearlTravel, 0.2 ) );
vec3  pPC  = ( pT < 0.5 ) ? mix( diffuseColor.rgb, uPearlMid, pT*2.0 )
                          : mix( uPearlMid, uPearlFlip, (pT-0.5)*2.0 );
diffuseColor.rgb = mix( diffuseColor.rgb, pPC, uPearlAmount );

// ---------------- floco metálico / mica ----------------
if( uFlakeAmount > 0.001 ){
  // A camada de floco fica SOB o verniz, então o raio de visão refrata na
  // entrada e cai num ponto deslocado lateralmente. Amostrar nesse deslocamento
  // é o que faz o floco parecer suspenso sob um filme transparente em vez de
  // impresso na superfície: ele desliza quando a câmera anda.
  vec3  Vw  = normalize( cameraPosition - vPaintWPos );
  float vn  = max( dot( pSmoothN, Vw ), 0.12 );
  vec3  fPos = vPaintWPos - ( Vw - pSmoothN*dot(Vw,pSmoothN) ) * ( uCoatThickness / vn );

  // Limita a pegada do floco NA TELA. Um mapa de floco mipmapado ganha isso de
  // graça; proceduralmente escolhemos a oitava cujas células caem perto de
  // uFlakePx pixels e cruzamos para a próxima, então aproximar SUBDIVIDE em vez
  // de ampliar uma célula até virar mancha.
  float wpx   = max( length( fwidth( fPos ) ), 1e-6 );
  float ideal = 1.0 / ( wpx * uFlakePx );
  float lod   = clamp( log2( max( ideal/uFlakeScale, 1e-4 ) ), 0.0, 6.0 );
  float l0    = floor( lod );
  float fr    = lod - l0;
  float sA    = uFlakeScale * exp2( l0 );
  float sB    = sA * 2.0;

  float px = wpx * sA;
  float aa = 1.0 / ( 1.0 + px*px*1.2 );

  vec4  cA = pFlakeCell( fPos, sA );
  vec4  cB = pFlakeCell( fPos, sB );
  float thr = uFlakeAmount * 0.85;
  float mA = step( cA.w, thr ) * aa * (1.0 - fr);
  float mB = step( cB.w, thr ) * aa * fr;

  float jA = 0.45 + 1.1*pHash13( cA.xyz*7.3 + 5.1 );
  float jB = 0.45 + 1.1*pHash13( cB.xyz*7.3 + 5.1 );
  vec3  nA = normalize( pSmoothN + cA.xyz * uFlakeTilt * jA );
  vec3  nB = normalize( pSmoothN + cB.xyz * uFlakeTilt * jB );

  normal = normalize( mix( normal, nA, mA ) );
  normal = normalize( mix( normal, nB, mB ) );

  float m   = mA + mB;
  float cov = uFlakeAmount * 0.85;

  // resolvido: as células são grandes o bastante para amostrar uma por vez
  roughnessFactor  = mix( roughnessFactor, uFlakeGloss, m );
  metalnessFactor  = mix( metalnessFactor, 1.0, m );
  // Varia a força do tom por floco. Sem isso, flocos vizinhos de cor idêntica
  // fundem num borrão só em vez de lerem como grão.
  float tint = mA*(0.40 + 0.60*pHash13( cA.xyz*3.1 + 91.7 ))
             + mB*(0.40 + 0.60*pHash13( cB.xyz*3.1 + 91.7 ));
  diffuseColor.rgb = mix( diffuseColor.rgb, uFlakeColor, tint*0.85 );

  // Não resolvido: quando a célula fica abaixo de um pixel, uma amostra por
  // pixel de um step binário alias em grumos grossos que parecem flocos
  // gigantes. Baixar o peso só reduz o contraste deles. Convergimos para a
  // média estatística — variância de normal sub-pixel É rugosidade, que é no
  // que um mapa mipmapado se resolve sozinho.
  float sub = 1.0 - aa;
  roughnessFactor  = mix( roughnessFactor, mix(roughnessFactor,uFlakeGloss,cov) + 0.20*cov, sub );
  metalnessFactor  = mix( metalnessFactor, mix(metalnessFactor,1.0,cov), sub );
  diffuseColor.rgb = mix( diffuseColor.rgb, mix(diffuseColor.rgb,uFlakeColor,cov*0.70), sub );
  roughnessFactor  = clamp( roughnessFactor, 0.02, 1.0 );
}
`;

const PAINT_ORANGEPEEL = /* glsl */`
#ifdef CLEARCOAT
if( uPeel > 0.001 ){
  float opPx = length( fwidth( vPaintWPos ) ) * uPeelScale;
  float opAA = 1.0 / (1.0 + opPx*opPx*2.0);
  vec3  Pp   = vPaintWPos * uPeelScale;
  float e    = 0.30;
  float h0   = pPeelHeight(Pp);
  vec3  g    = vec3( pPeelHeight(Pp+vec3(e,0.0,0.0)) - h0,
                     pPeelHeight(Pp+vec3(0.0,e,0.0)) - h0,
                     pPeelHeight(Pp+vec3(0.0,0.0,e)) - h0 ) / e;
  g = g - clearcoatNormal * dot( g, clearcoatNormal );
  clearcoatNormal = normalize( clearcoatNormal - g * uPeel * opAA );
}
#endif
`;

function installPaintShader(m: THREE.MeshPhysicalMaterial) {
  m.onBeforeCompile = (shader: THREE.WebGLProgramParametersWithUniforms) => {
    Object.assign(shader.uniforms, U);
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vPaintWPos;')
      .replace('#include <begin_vertex>',
        '#include <begin_vertex>\n  vPaintWPos = ( modelMatrix * vec4( transformed, 1.0 ) ).xyz;');
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\n' + PAINT_COMMON)
      .replace('#include <normal_fragment_maps>',
        '#include <normal_fragment_maps>\n' + PAINT_SURFACE)
      .replace('#include <clearcoat_normal_fragment_maps>',
        '#include <clearcoat_normal_fragment_maps>\n' + PAINT_ORANGEPEEL);
  };
  /* Sobe a cada mudança no GLSL injetado: um programa em cache com a versão
     anterior continuaria rodando. v5 = o port do laboratório. */
  m.customProgramCacheKey = () => 'truckstudio-paint-v5';
}

/* `_srcColor` is accepted and deliberately ignored: newly created paint
   materials are re-driven from the CURRENT params by the setPaint({}) that
   follows, so the imported colour would only ever be overwritten. Callers
   still pass it because they read it off the source material. */
export function makePaintMaterial(_srcColor?: THREE.Color, srcMap?: THREE.Texture | null) {
  const m = new THREE.MeshPhysicalMaterial({
    name: 'carpaint',
    color: new THREE.Color(params.color),
    map: srcMap || null,
    metalness: 0.1,
    roughness: 0.34,
    clearcoat: 1.0,
    clearcoatRoughness: 0.05,
    /* rip geometry has arbitrary winding — a FrontSide paint material culls
       inward-wound faces and reads as see-through (verified root cause) */
    side: THREE.DoubleSide,
  });
  m.envMapIntensity = 1.3;
  if (m.map) m.map.colorSpace = THREE.SRGBColorSpace;
  installPaintShader(m);
  materials.add(m);
  applyToMaterials();
  return m;
}

/* Called when a cab is swapped out and its materials disposed. */
export function forgetPaintMaterial(m: THREE.Material) {
  materials.delete(m as THREE.MeshPhysicalMaterial);
}
/* Registry membership, not a name match — source material names vary
   ("carpaint", "CarPaint_01", …) and a substring test would be fragile. */
export function isPaintMaterial(m: THREE.Material) {
  return materials.has(m as THREE.MeshPhysicalMaterial);
}
