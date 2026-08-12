/* A CAPA DO FAROL CLAREIA QUANDO O FAROL ACENDE.
   ===========================================================================
   O RELATO: *"tem o feixe de luz, mas nao sai da frontal"*. E ele é preciso: o
   feixe está no lugar certo — medido, a fonte nasce em z −0,82, que é
   exatamente a face dianteira do conjunto, e o cone cai no asfalto à frente —
   mas a LENTE que deveria produzi-lo aparece apagada. A luz sai do nada.

   ===========================================================================
   POR QUE A LENTE FICA ESCURA, E POR QUE SUBIR O NÍVEL NÃO RESOLVE.

   A sonda `checks-quem-desenha.mjs` mediu a pilha de acertos no pixel do farol:

       [0] cabin_mat_0006_glass_ex        opacidade 0,8 · BLEND · cor 0,1
       [1] f_light_chs_mat_0000_lights    emiInt 40 · emissivo branco

   A lâmpada SEMPRE esteve acesa. Ela é o segundo acerto, atrás de uma capa de
   vidro que transmite 20 %. E o nível não resolve porque **o tonemap roda ANTES
   da mistura**: a lâmpada já chega saturada em 1,0 e a capa entrega
   `0,8 × vidro-escuro + 0,2 × 1,0 ≈ 0,25` — cinza escuro para QUALQUER nível.
   Medido subindo de 2,2 para 8 e de 8 para 40 sem diferença visível.

   ===========================================================================
   E POR QUE NÃO SE PODE SIMPLESMENTE CLAREAR A CAPA.

   ⚠️ **`cabin_mat_0006_glass_ex` É UMA MALHA SÓ.** Medido no FH 2021: `cabin_p7`,
   uma primitiva, y 0,53…3,83 — para-brisa, janela lateral E capa de farol no
   mesmo material. Baixar a opacidade dele deixaria o PARA-BRISA transparente nos
   49 chassis, de dia inclusive. Foi por isso que a rodada anterior registrou
   "mexer na capa foi avaliado e rejeitado".

   O que faltava era a granularidade — a mesma lição de `lights.ts`: quando a
   malha é uma só, **a decisão desce para o FRAGMENTO**. A capa clareia apenas
   dentro da CAIXA DO FAROL, que `lights.ts` já mede, e apenas na proporção em que
   o farol está aceso. Consequências:

     · o para-brisa não muda — ele está em y 1,8…3,8 e a caixa do farol vai só até
       y 1,23, então nenhum fragmento dele entra na conta;
     · de DIA nada muda em lugar nenhum, porque o nível é `rig.vehLights`, que é 0
       antes das 18:00. A aparência dos 49 chassis à luz do sol fica intacta;
     · e é fisicamente o que acontece: a capa de um farol aceso lê como clara,
       porque a luz que sai dele domina o pouco que ela reflete.

   ⚠️ NADA DE CRASE NOS BLOCOS DE GLSL — template string de JS. Quarta vez nesta
   base. */
import * as THREE from 'three';

/* ---------------- QUEM É A CAPA: A GEOMETRIA, NÃO O NOME ----------------
   ⚠️ **A REGRA POR NOME (`/glass_ex/i`) ERRAVA EM UM TERÇO DO ACERVO.** Ela veio
   do FH, onde a capa realmente é `cabin_mat_0006_glass_ex`, e a varredura dos 49
   bakes mostrou o preço: dos **24** que declaram farol, **8** têm a capa com outro
   nome — e são justamente os Scania de cabine nova, onde ela se chama
   `f_bumper_mat_0005_plastic_glossy` (`alphaMode: BLEND`, opacidade 0,8) e
   `chassis_mat_0004_plastic_glossy` no S 2024e. Nesses o farol ficava aceso a 40
   de radiância atrás de um plástico que transmite 20 % — o relato *"a lanterna
   frontal tem feixe de luz, mas nao sai da lanterna frontal do cavalo em si, ela
   esta apagada"*.

   Achar por nome nunca ia parar de pé: são cinco convenções de quem ripou. O que
   TODA capa tem em comum é o que ela FAZ — ser translúcida e estar na frente do
   farol —, e as duas coisas são mensuráveis:

     · `alphaMode: BLEND` com opacidade que ainda TAPA. `CAPA_OPACIDADE_MIN`
       exclui as tampas de acrílico de 0,06/0,10 do implemento, que não escondem
       nada e cujo clareamento seria trabalho sem efeito;
     · e a caixa da malha CRUZA a caixa do farol, que `lights.ts` acabou de medir.

   Medido: com esse par de testes a capa é achada em **24 de 24**. E ele não é
   frouxo por acaso — clarear um material a mais é inofensivo, porque o shader já
   restringe o efeito à caixa do farol (`tsDentro`), então um vidro que passe no
   teste e não esteja ali não muda um pixel.

   ⚠️ POR ISSO O REGISTRO MUDOU DE HORA. Antes ele rodava em
   `registerVehicleLights()`, que é chamado de `setupCommon()` — ANTES do engate,
   quando `matrixWorld` ainda é identidade e não existe caixa de farol a cruzar.
   Agora quem chama é `medirRaiz()`, com as matrizes valendo e a caixa na mão. */
const CAPA_OPACIDADE_MIN = 0.35;
/** O nome continua valendo como atalho: um `glass_ex` é capa mesmo sem cruzar. */
const CAPA_NOME_RE = /glass_ex/i;

/* ---------------- A CAPA QUE JÁ TINHA SIDO FECHADA ----------------
   ⚠️ **`auditTransparency()` EM `models.ts` FORÇA OPACO O QUE NÃO PARECE VIDRO
   PELO NOME**, e a capa do farol dos Scania se chama
   `f_bumper_mat_0005_plastic_glossy`. Medido na bancada, ela chega aqui com
   `transparent false · opacity 1 · depthWrite true` — a auditoria já a fechou, e
   o `renderOrder 20` que ela ainda carrega é a impressão digital de ter sido
   transparente quando `material-setup.ts` a viu.

   A auditoria está CERTA no geral: rips vêm cheios de painel de lataria marcado
   como BLEND, e deixá-los translúcidos foi o que já deixou a cabine embaçada.
   O que faltava é a exceção, e ela não pode ser mais um nome — é a mesma capa que
   este módulo acha por geometria.

   Então a auditoria passa a AVISAR (`notarTransparenciaForcada()`) e este módulo
   reabre só quem cruza a caixa do farol. E reabre de um jeito que não devolve
   defeito nenhum de dia: `transparent` volta a ser true mas a **opacidade fica em
   1** e `depthWrite` continua ligado — fora da caixa do farol o material desenha
   exatamente como opaco, porque o alfa só é rebaixado DENTRO dela, no fragmento.
   O painel dianteiro do Scania continua sólido às 14:00; o que abre é a janela de
   24 cm onde o conjunto óptico está. */
const forcadasOpacas = new WeakSet<THREE.Material>();

/**
 * Avisa que `mat` era transparente e foi fechada pela auditoria.
 *
 * Chamada por `auditTransparency()` em `models.ts`. A dependência é de lá para cá
 * e nunca ao contrário — este módulo não importa `models.ts`, que fecharia um
 * ciclo com `material-setup.ts` → `lights.ts` → aqui.
 */
export function notarTransparenciaForcada(mat: THREE.Material) {
  forcadasOpacas.add(mat);
}

/**
 * Quanto da opacidade sobra dentro da caixa do farol, com o farol a pleno.
 *
 * 0,18 sobre a opacidade autorada de 0,8 dá 0,144 — a capa deixa de ser um filtro
 * e vira um verniz. Não é 0 de propósito: uma capa totalmente transparente perde
 * o reflexo especular que a faz ler como vidro, e o farol passaria a parecer um
 * buraco. Com 0,144 ainda há uma reflexão do céu na superfície e a lente acesa
 * atravessa.
 */
const CAPA_CLAREIA = 0.18;

/**
 * Folga em torno da caixa do farol, em metros.
 *
 * A capa é uma superfície À FRENTE da lâmpada, então a caixa da LÂMPADA não a
 * contém: a lente fica alguns centímetros atrás do vidro. 12 cm cobre a folga de
 * qualquer conjunto óptico do acervo e continua muito abaixo dos 57 cm que
 * separam o topo do farol (y 1,23) da base do para-brisa (y ~1,8).
 */
const FOLGA = 0.12;

const PARS_VERT = /* glsl */`
varying vec3 vTsCapaW;
`;

/* Mesma conta e mesmo ponto de `lights.ts`: `project_vertex` não altera
   `transformed`, e refazer a multiplicação é mais barato que inverter a matriz da
   câmera para voltar de `mvPosition`. */
const MAIN_VERT = /* glsl */`
#include <project_vertex>
{
  vec4 tsCapaP = vec4( transformed, 1.0 );
  #ifdef USE_INSTANCING
    tsCapaP = instanceMatrix * tsCapaP;
  #endif
  vTsCapaW = ( modelMatrix * tsCapaP ).xyz;
}
`;

const PARS_FRAG = /* glsl */`
varying vec3 vTsCapaW;
uniform vec3 tsCapaMin;
uniform vec3 tsCapaMax;
uniform float tsCapaNivel;
`;

/* ANTES de `alphatest_fragment` e depois de `color_fragment`: `diffuseColor.a` já
   carrega `opacity` neste ponto, e o corte por alfa ainda não aconteceu — mexer
   depois dele deixaria o teste decidindo com um valor que não é o final.

   `step` em vez de `if`: são três comparações por eixo, sem divergência de
   ramo, e o produto das seis dá 1 só dentro da caixa. */
const MAIN_FRAG = /* glsl */`
#include <alphatest_fragment>
{
  vec3 tsLo = step( tsCapaMin, vTsCapaW );
  vec3 tsHi = step( vTsCapaW, tsCapaMax );
  float tsDentro = tsLo.x * tsLo.y * tsLo.z * tsHi.x * tsHi.y * tsHi.z;
  diffuseColor.a *= mix( 1.0, TS_CAPA_CLAREIA, tsDentro * tsCapaNivel );
}
`;

interface Capa {
  mat: THREE.MeshStandardMaterial;
  uMin: { value: THREE.Vector3 };
  uMax: { value: THREE.Vector3 };
  uNivel: { value: number };
}

const porRaiz = new Map<THREE.Object3D, Capa[]>();
const injetadas = new WeakSet<THREE.Material>();

function injetar(c: Capa) {
  if (injetadas.has(c.mat)) return;
  injetadas.add(c.mat);
  const antesCompile = c.mat.onBeforeCompile;
  const antesChave = c.mat.customProgramCacheKey;
  c.mat.onBeforeCompile = function (shader, renderer) {
    /* ENCADEIA: `material-setup.ts` já trata este material (ele é quem põe
       `renderOrder` 20 e `depthWrite: false` na capa), e sobrescrever o gancho
       apagaria isso sem erro nenhum. */
    if (antesCompile) antesCompile.call(this, shader, renderer);
    shader.uniforms.tsCapaMin = c.uMin;
    shader.uniforms.tsCapaMax = c.uMax;
    shader.uniforms.tsCapaNivel = c.uNivel;
    shader.vertexShader = PARS_VERT + shader.vertexShader
      .replace('#include <project_vertex>', MAIN_VERT);
    shader.fragmentShader = PARS_FRAG + shader.fragmentShader
      .replace('#include <alphatest_fragment>', MAIN_FRAG)
      .replace(/TS_CAPA_CLAREIA/g, CAPA_CLAREIA.toFixed(4));
  };
  c.mat.customProgramCacheKey = function () {
    return 'ts-capa-v1|' + (antesChave ? antesChave.call(this) : '');
  };
  c.mat.needsUpdate = true;
}

const _cxCapa = new THREE.Box3();
const _cxAlvo = new THREE.Box3();

/**
 * Prepara a capa de `root`, dada a caixa do FAROL dele. Idempotente por raiz.
 *
 * Chamada de `medirRaiz()` em `lights.ts`, com as matrizes de mundo já valendo —
 * ver o bloco QUEM É A CAPA para por que não pode ser antes. Sem caixa de farol
 * não há o que revelar e a função não faz nada.
 *
 * @param caixaFarol a caixa do conjunto óptico, em MUNDO.
 * @returns quantos materiais de capa foram achados.
 */
export function registerHeadlightCover(
  root: THREE.Object3D | null | undefined,
  caixaFarol: THREE.Box3 | null,
) {
  if (!root || porRaiz.has(root)) return 0;
  if (!caixaFarol || caixaFarol.isEmpty()) return 0;
  /* A folga é a mesma que a capa usa para clarear: a lente fica alguns
     centímetros ATRÁS do vidro, então a caixa da lâmpada não o contém. */
  _cxAlvo.copy(caixaFarol).expandByScalar(FOLGA);
  const lista: Capa[] = [];
  const vistos = new Set<THREE.Material>();
  const candidatos = new Map<THREE.Material, boolean>();
  /** Translúcida agora, ou translúcida no bake antes da auditoria. */
  const podeSerCapa = (mat: THREE.MeshStandardMaterial) =>
    (mat.transparent && (mat.opacity ?? 1) >= CAPA_OPACIDADE_MIN)
    || forcadasOpacas.has(mat);
  root.traverse((o) => {
    const mesh = o as THREE.Mesh;
    if (!mesh.isMesh || !mesh.geometry) return;
    const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    let transp = false;
    for (const m of mats) {
      const mat = m as THREE.MeshStandardMaterial;
      if (!mat) continue;
      if (CAPA_NOME_RE.test(mat.name || '')) { candidatos.set(mat, true); continue; }
      if (podeSerCapa(mat)) transp = true;
    }
    if (!transp) return;
    /* A caixa desta MALHA, e não a do material: um material de vidro que serve o
       para-brisa E a capa do farol tem de entrar (é o caso do FH), e um que só
       serve a janela traseira não. Basta uma malha cruzar. */
    _cxCapa.makeEmpty();
    _cxCapa.expandByObject(mesh);
    if (_cxCapa.isEmpty() || !_cxCapa.intersectsBox(_cxAlvo)) return;
    for (const m of mats) {
      const mat = m as THREE.MeshStandardMaterial;
      if (!mat || !podeSerCapa(mat)) continue;
      candidatos.set(mat, true);
      if (forcadasOpacas.has(mat)) {
        /* REABRE — ver o bloco A CAPA QUE JÁ TINHA SIDO FECHADA. Opacidade fica
           em 1 e `depthWrite` fica ligado de propósito: fora da caixa do farol
           isto desenha idêntico a um opaco, e é o fragmento que abre a janela. */
        mat.transparent = true;
        mat.opacity = 1;
        mat.depthWrite = true;
        mat.needsUpdate = true;
        /* Depois do passe opaco, senão a lente que ela revela ainda não foi
           desenhada e não há o que misturar. */
        mesh.renderOrder = Math.max(mesh.renderOrder, 20);
      }
    }
  });
  for (const mat of candidatos.keys()) {
    const m = mat as THREE.MeshStandardMaterial;
    if (vistos.has(m)) continue;
    vistos.add(m);
    const c: Capa = {
      mat: m,
      /* Nasce numa caixa VAZIA (min > max), então o teste dá 0 em todo
         fragmento até `setHeadlightCoverBox()` medir. Um material injetado e
         não configurado tem de ser um no-op, não um vidro apagado. */
      uMin: { value: new THREE.Vector3(1, 1, 1) },
      uMax: { value: new THREE.Vector3(-1, -1, -1) },
      uNivel: { value: 0 },
    };
    injetar(c);
    lista.push(c);
  }
  if (lista.length) porRaiz.set(root, lista);
  return lista.length;
}

const _min = new THREE.Vector3();
const _max = new THREE.Vector3();

/**
 * Diz onde o farol de `root` está, para a capa saber onde clarear.
 *
 * Chamada por `lights.ts` a cada medida — inclusive depois de um resize, porque
 * quem mede a caixa é ele. `null` desliga (raiz sem farol).
 */
export function setHeadlightCoverBox(root: THREE.Object3D, caixa: THREE.Box3 | null) {
  const lista = porRaiz.get(root);
  if (!lista) return;
  if (!caixa || caixa.isEmpty()) {
    for (const c of lista) { c.uMin.value.set(1, 1, 1); c.uMax.value.set(-1, -1, -1); }
    return;
  }
  _min.copy(caixa.min).addScalar(-FOLGA);
  _max.copy(caixa.max).addScalar(FOLGA);
  for (const c of lista) { c.uMin.value.copy(_min); c.uMax.value.copy(_max); }
}

/** O nível, 0..1 — o mesmo `rig.vehLights` que acende a lâmpada. */
export function setHeadlightCoverLevel(n: number) {
  const v = THREE.MathUtils.clamp(n, 0, 1);
  for (const [raiz, lista] of porRaiz) {
    if (!raiz.parent) { porRaiz.delete(raiz); continue; }
    for (const c of lista) c.uNivel.value = v;
  }
}

/** Para o console e para a bancada. */
export function getHeadlightCover() {
  const out: { raiz: string; mat: string; nivel: number; caixa: number[] }[] = [];
  for (const [raiz, lista] of porRaiz) {
    if (!raiz.parent) continue;
    for (const c of lista) {
      out.push({
        raiz: raiz.name || '(sem nome)',
        mat: c.mat.name || '(sem nome)',
        nivel: Math.round(c.uNivel.value * 100) / 100,
        caixa: [c.uMin.value.x, c.uMin.value.y, c.uMin.value.z,
          c.uMax.value.x, c.uMax.value.y, c.uMax.value.z]
          .map((v) => Math.round(v * 100) / 100),
      });
    }
  }
  return { capas: out, clareia: CAPA_CLAREIA };
}
