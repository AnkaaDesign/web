/* O PARA-LAMA DO 2º EIXO DIRECIONAL — a peça que só o bitruck de fábrica tem.
   ===========================================================================

   > *"no volvo bitruck, em vez de usar o para-lamas da cabine para a segunda
   >  roda, deve usar o da segunda roda do scania mesmo, ficará melhor"* —
   >  Kennedy, 2026-08-23.

   O VM e o VW são bitrucks DERIVADOS: `cut-chassi.cjs` enxerta um 2º eixo
   direcional num 6x2, e o 6x2 nunca teve para-lama ali. O Scania P do acervo é
   bitruck DE FÁBRICA e tem — `t_paralama_0_p0…p7`, um conjunto inteiro com
   aba, suporte e para-barro. `tools/chassis-bake/rip-paralama.cjs` o extrai
   para `models/vehicles/paralama_dir2_v1.glb`, e este arquivo o monta.

   ⚠️ A TENTATIVA ANTERIOR CLONAVA O ARCO DA PRÓPRIA CABINE, e é o que este
   módulo substitui. O arco do 1º direcional do VM são três componentes de
   `cabin_p0` — ou seja, PEDAÇO DA CASCA DA CABINE. Recortado e deslocado
   2 220 mm, ele vira um caco de cabine solto no meio do quadro, e atravessa o
   que estiver lá: medido por `tools/chassis-bake/probe-sobreposicao.cjs`, seis
   sobreposições novas, a maior de 151 × 195 × 95 mm contra a caixa de bateria.
   A peça certa é a que foi desenhada para viver solta.

   O CONTRATO COM O ASSET
   ---------------------------------------------------------------------------
   `paralama_dir2_v1.glb` sai no espaço CRU do glTF (os três rígidos apontam
   para −Z; `orientYaw = π` para todos) com a origem no CENTRO DO EIXO:
   `x = 0` na linha de centro, `y` no centro do pneu, `z` no centro do eixo.
   O `_meta.json` guarda as duas réguas do doador — **diâmetro do pneu** e
   **meia-bitola** —, e é por elas que a peça se ajusta a outro caminhão:

       sy = sz = Ø(alvo) / Ø(doador)              o arco acompanha o pneu
       sx      = faceExterna(alvo) / faceExterna(doador)   e a largura

   Escalar `x` junto com `y`/`z` poria o arco 55 mm para fora do pneu no VM
   (bitola menor) e 27 mm para dentro no VW (bitola maior) — 82 mm de
   espalhamento entre dois caminhões que usam a MESMA peça. Por isso são duas
   escalas, e por isso a régua sai do PNEU MONTADO e não de tabela: quem põe a
   roda é `swapTruckWheels()`, e o diâmetro dela é decisão daquele módulo.

   ⚠️ E A ESCALA NÃO-UNIFORME COMUTA COM O GIRO, que é o que a torna legítima
   aqui: `orientYaw = π` é `diag(−1, 1, −1)`, e uma diagonal comuta com outra.
   Num rígido com outro `orientYaw` isto deixaria de valer, e é por isso que a
   função recusa o que não for `±π` em vez de escrever peça torta.
*/
import * as THREE from 'three';
import type { RigidMount } from './mounting';
import { claimGeometry } from './geometry-share';
import { componentesSoldados } from './truck-wheels';

/** O asset, em `models/vehicles/`. `_v1` desde o primeiro dia — a árvore
 *  servida sai com `Cache-Control: immutable`. */
export const FENDER_ASSET = 'paralama_dir2_v1.glb';

/**
 * As réguas do DOADOR, de `paralama_dir2_v1_meta.json`.
 *
 * Elas vivem aqui e não são lidas do JSON de propósito: são duas constantes de
 * um asset imutável, e uma leitura de rede a mais no caminho de carregamento da
 * cabine custa mais do que vale. O ripper as imprime a cada bake; divergiram,
 * o portão de bancada acusa (o arco deixa de casar com o pneu).
 */
const DOADOR = { pneuDiametro: 0.9922, pneuFora: 1.1930, arcoFora: 1.2414 };

/**
 * ▶▶ O TETO DE LARGURA DO ARCO — a grade lateral.
 *
 * ⚠️ MEDIR A RODA NÃO BASTA, e esta é a terceira régua de x desta peça. A
 * primeira usou a meia-bitola e deu 1 355 mm no VW; a segunda usou a "face
 * externa do pneu" na faixa baixa e deu 1 308 no VM e 1 393 no VW — porque na
 * faixa baixa quem chega mais longe não é o pneu, é o DISCO da roda montada
 * (`wheel_r_0_0_r_disc_*` do `wheel_vm_v1.glb`, com o cubo cromado saliente),
 * a 1 300 mm. Toda régua tirada da roda erra pelo mesmo motivo: a roda é um
 * conjunto e cada rip a monta com uma saliência diferente.
 *
 * A régua que NÃO erra é a peça vizinha. A grade lateral fica em |x|
 * 1 275 (face) e a barra dela ocupa os 32 mm seguintes para dentro: o arco tem
 * de acabar antes de 1 243. Com 8 mm de ar, **1 235** — e é um teto, não um
 * alvo: se um caminhão de bitola estreita chegar, a conta do pneu manda.
 *
 * Ver `FOLGA_LATERAL` em `side-guard.ts`, que é a mesma cadeia pelo outro lado.
 */
const FACE_GRADE = 1.275;
const BARRA_GRADE = 0.032;
const TETO_ARCO = FACE_GRADE - BARRA_GRADE - 0.008;
/** Quanto o arco passa do pneu, quando é o pneu que manda. Medido no doador:
 *  arco 1 241 contra pneu 1 193. */
const FOLGA_PNEU = 0.048;

/** Faixa em z, em torno do eixo, em que se procura para-lama JÁ EXISTENTE. */
const FAIXA_ARCO_Z = 0.30;
/** Quanto acima do topo do pneu o arco de um para-lama chega. */
const ARCO_ACIMA = 0.35;
/** …e quanto abaixo dele a saia ainda conta como para-lama. */
const ARCO_ABAIXO = 0.15;
/** Só peça de FLANCO conta como pneu ou como arco. */
const FLANCO_X = 0.55;
/** Meia-janela em z para colher os vértices do pneu do eixo. */
const PNEU_JANELA_Z = 0.70;

const RODA_RE = /wheel|tire|pneu|rim|aro|VM_WHEEL/i;

/* --------------------------------------------------------------------------
   O ACABAMENTO — preto de CHASSI, e não a tinta da cabine
   -------------------------------------------------------------------------- */

/**
 * *"o para-lamas deve seguir a cor dos outros do chassi, preto, não um preto
 * puro pra não ficar estranho"* — Kennedy, 2026-08-23.
 *
 * A 1ª versão pendurava o para-lama na TINTA: `ts_paralama_pintura` entrava em
 * `chassis[].paintMaterials` e a peça saía da cor da cabine. É o que o Scania
 * faz — lá o para-lama do 2º direcional é pintado —, e no VM e no VW ficou
 * errado por dois motivos: o arco deles não é peça de lataria (o do 1º
 * direcional do VM é cinza-plástico) e, sem cor escolhida, o material trazia o
 * VERDE-ÁGUA de fábrica do rip do Scania para dentro de outro caminhão.
 *
 * ⚠️ E O VALOR NÃO É ARBITRADO. `chassis_mat_0000_Cinza_7` do VM traz
 * baseColor **[0,00545 · 0,00576 · 0,00545]** e rugosidade 0,196, e
 * `chs_base_0_mat_0014_Cinza_68` traz [0,00492 · 0,00519 · 0,00492] — ou seja
 * o preto de chassi deste acervo é um cinza LINEAR de ~0,005 com o verde meio
 * ponto acima do vermelho e do azul. Um preto puro ao lado disso lê como
 * buraco (é a mesma lição do letreiro SCANIA em 0,0014 de
 * `studio-tanque-estepe-letreiro`), então a base aqui é 0,010 — o dobro do
 * chassi, que é o que compensa o para-lama não ter mapa de sujeira por cima.
 */
const PRETO_CHASSI = { r: 0.0100, g: 0.0106, b: 0.0100 };
/** A ferragem que segura a aba: mesmo preto, mais fechado e um pouco metálico
 *  — é chapa dobrada, não plástico. */
const PRETO_FERRAGEM = { r: 0.0075, g: 0.0079, b: 0.0075 };

/**
 * Põe o para-lama na régua do chassi. Idempotente e barato: roda uma vez por
 * asset, e o clone divide material com ele.
 */
export function tuneFenderMaterials(asset: THREE.Object3D): string[] {
  const linhas: string[] = [];
  const vistos = new Set<string>();
  asset.traverse((node) => {
    const o = node as THREE.Mesh;
    if (!o.isMesh) return;
    for (const raw of (Array.isArray(o.material) ? o.material : [o.material])) {
      const m = raw as THREE.MeshStandardMaterial;
      if (!m || vistos.has(m.uuid)) continue;
      vistos.add(m.uuid);
      const nome = m.name || '';
      const metal = /metal/.test(nome);
      const alvo = metal ? PRETO_FERRAGEM : PRETO_CHASSI;
      /* ⚠️ O MAPA SAI JUNTO. O `pintura` do Scania carrega o atlas da cabine
         dele; deixá-lo multiplicaria vinco e recado de outro caminhão sobre um
         para-lama. Sem mapa, a peça lê como chapa pintada de preto, que é o
         que ela é. */
      m.map = null;
      m.color.setRGB(alvo.r, alvo.g, alvo.b);
      m.roughness = metal ? 0.42 : 0.55;
      m.metalness = metal ? 0.55 : 0.05;
      /* Alguns materiais do rip vêm com `alphaTest`/transparência de folha —
         num para-lama isso só abre furo. */
      m.transparent = false;
      m.alphaTest = 0;
      m.opacity = 1;
      m.needsUpdate = true;
      linhas.push(`${nome || '(sem nome)'} → preto de chassi`
        + ` ${metal ? '(ferragem)' : ''}`);
    }
  });
  return linhas;
}

/** Um objeto e todos os pais dele estão visíveis? `swapTruckWheels()` apaga a
 *  rodagem original com `visible = false`, e medir nela daria o pneu do rip em
 *  vez do que está na tela. */
function visivel(o: THREE.Object3D, ate: THREE.Object3D): boolean {
  for (let p: THREE.Object3D | null = o; p && p !== ate.parent; p = p.parent) {
    if (!p.visible) return false;
  }
  return true;
}

function ehRoda(o: THREE.Object3D, ate: THREE.Object3D): boolean {
  for (let p: THREE.Object3D | null = o; p && p !== ate.parent; p = p.parent) {
    if (RODA_RE.test(p.name || '')) return true;
  }
  return false;
}

interface Pneu {
  /** Diâmetro medido — a caixa é mais alta que longa num pneu deformado, então
   *  aqui é a ALTURA, que é o que o arco tem de vencer. */
  diametro: number;
  /** Y do contato com o solo. */
  chao: number;
  /**
   * |x| da FACE EXTERNA da banda de rodagem.
   *
   * ⚠️ Era a MEIA-BITOLA (o |x| do meio do pneu), e ela não serve: a varredura
   * apanha pneu, aro, cubo e porca, e o mínimo de |x| entre eles muda de rip
   * para rip. Medido, o arco saía com 1 355 mm de meia-largura no VW — mais
   * largo que o próprio baú (1 335) e 80 mm além do plano da grade. A face
   * EXTERNA é uma medida só, do PNEU, e é a que o arco tem de vestir.
   */
  fora: number;
  vertices: number;
}

/** Mede o pneu que está NA TELA no eixo `alvoZ`, em espaço normalizado. */
function medePneu(cab: THREE.Object3D, N: THREE.Matrix4, alvoZ: number): Pneu | null {
  const cabInv = new THREE.Matrix4().copy(cab.matrixWorld).invert();
  const L2N = new THREE.Matrix4();
  const v = new THREE.Vector3();
  let y0 = Infinity, y1 = -Infinity, n = 0;
  const rodas: THREE.Mesh[] = [];
  cab.traverse((node) => {
    const o = node as THREE.Mesh;
    if (!o.isMesh || !o.geometry?.attributes?.position) return;
    if (!ehRoda(o, cab) || !visivel(o, cab)) return;
    rodas.push(o);
    L2N.copy(N).multiply(cabInv).multiply(o.matrixWorld);
    const pos = o.geometry.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < pos.count; i++) {
      v.fromBufferAttribute(pos, i).applyMatrix4(L2N);
      if (Math.abs(v.z - alvoZ) > PNEU_JANELA_Z) continue;
      if (Math.abs(v.x) < FLANCO_X) continue;
      if (v.y < y0) y0 = v.y; if (v.y > y1) y1 = v.y;
      n++;
    }
  });
  if (n < 200 || !Number.isFinite(y0)) return null;
  const diametro = y1 - y0;

  /* ▶▶ A FACE EXTERNA SAI DA FAIXA BAIXA DO PNEU, e a 1ª versão não fazia isso.
     ------------------------------------------------------------------------
     Medir o |x| máximo sobre TUDO que responde a `RODA_RE` mistura pneu, aro,
     cubo e PORCA — e a porca é a peça mais externa da roda. No VW isso dava
     1 323 mm e o arco saía com 1 376 de meia-largura, mais largo que o próprio
     baú (1 335): a peça deixava de ser para-lama e virava o ponto mais largo do
     caminhão.
     Na faixa BAIXA do pneu (5 % a 35 % do diâmetro acima do contato) só existe
     a banda de rodagem — aro, cubo e porca moram na altura do eixo. É uma
     medida de uma coisa só, e é a que o arco tem de vestir. */
  const yLo = y0 + diametro * 0.05, yHi = y0 + diametro * 0.35;
  let xo = -Infinity, nb = 0;
  for (const o of rodas) {
    L2N.copy(N).multiply(cabInv).multiply(o.matrixWorld);
    const pos = o.geometry.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < pos.count; i++) {
      v.fromBufferAttribute(pos, i).applyMatrix4(L2N);
      if (Math.abs(v.z - alvoZ) > PNEU_JANELA_Z) continue;
      if (v.y < yLo || v.y > yHi) continue;
      const ax = Math.abs(v.x);
      if (ax < FLANCO_X) continue;
      if (ax > xo) xo = ax;
      nb++;
    }
  }
  if (nb < 50 || !Number.isFinite(xo)) return null;
  return { diametro, chao: y0, fora: xo, vertices: n };
}

/** Este eixo JÁ tem para-lama? (o Scania P é bitruck de fábrica e tem.) */
function jaTemArco(cab: THREE.Object3D, N: THREE.Matrix4, alvoZ: number, pneu: Pneu): number {
  const topo = pneu.chao + pneu.diametro;
  const cabInv = new THREE.Matrix4().copy(cab.matrixWorld).invert();
  const L2N = new THREE.Matrix4();
  const v = new THREE.Vector3();
  let n = 0;
  cab.traverse((node) => {
    const o = node as THREE.Mesh;
    if (!o.isMesh || !o.geometry?.attributes?.position) return;
    if (ehRoda(o, cab) || !visivel(o, cab)) return;
    L2N.copy(N).multiply(cabInv).multiply(o.matrixWorld);
    const pos = o.geometry.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < pos.count; i++) {
      v.fromBufferAttribute(pos, i).applyMatrix4(L2N);
      if (Math.abs(v.z - alvoZ) > FAIXA_ARCO_Z) continue;
      if (Math.abs(v.x) < FLANCO_X) continue;
      if (v.y < topo - ARCO_ABAIXO || v.y > topo + ARCO_ACIMA) continue;
      n++;
    }
  });
  return n;
}

/* ══════════════════════════════════════════════════════════════════════════
   O ALCANCE EM Z — o arco é CORTADO POR PLANO, e não recortado por triângulo
   ══════════════════════════════════════════════════════════════════════════

   > *"o para-lamas está com uma parte transparente agora"* · *"para-lamas
   >  encostando na caixa com a tara de peso"* — Kennedy, 2026-08-23.

   As duas frases são a mesma peça, e a primeira é um defeito que EU introduzi.

   A varredura geral mediu, no VM 8x2R, uma mancha de **481 × 293 × 178 mm**
   entre o arco e a caixa de bateria, e no VW **543 × 316 × 162** contra o
   chassi. Não é imprecisão de cota: **não cabe um para-lama de 1 450 mm no vão
   que sobra entre os dois direcionais** — o vão livre à frente do 2º direcional
   do VM é de 526 mm contra 726 de meia-peça.

   ⚠️ A PRIMEIRA TENTATIVA FOI RECORTAR POR TRIÂNGULO, e o resultado está na
   foto do dono: o arco é uma CASCA DE UMA FACE SÓ, e apagar triângulos do meio
   dela abre BURACO — vê-se o outro flanco através do para-lama. Medido, a apara
   tirava 1 271 triângulos na 1ª passada e 1 426 na 2ª, e 730 deles saíam do
   PARA-BARRO (21 % da peça). Trocar uma sobreposição que ninguém vê por um furo
   que todo mundo vê é um mau negócio, e o dono o viu na primeira captura.

   O que uma implementadora faz num para-lama que não cabe é CORTÁ-LO NO
   COMPRIMENTO — um corte reto, que deixa uma borda igual à borda que a peça já
   tem embaixo. É o que este bloco faz: um PLANO em z, medido, e nada mais.
   Casca cortada por plano continua fechada aos olhos; casca furada no meio,
   não.

   ⚠️ E O PISO É O PNEU. Um arco menor que a roda que ele cobre é outro defeito,
   e por isso o corte para em `PISO_COBERTURA` do diâmetro à frente do eixo. Se
   nem assim couber, o que sobra de sobreposição fica REGISTRADO em vez de
   escondido — o portão de varredura o mede.
*/

/** Folga que o corte guarda da peça mais próxima à frente do arco. */
const FOLGA_CORTE = 0.030;
/** Faixa em |x| em que se procura o que está à frente do arco: da longarina
 *  até a face externa dele. Para dentro disso é motor e travessa, e o arco não
 *  chega lá. */
const CORTE_FAIXA_X = [0.45, 1.26];
/** …e a faixa de ALTURA. Do meio do pneu para cima: abaixo disso passa a saia
 *  do para-barro, que é borracha e pode encostar. */
const CORTE_FAIXA_Y = [0.55, 1.35];
/** O PISO: por menos que caiba, o arco cobre o pneu e mais isto, em fração do
 *  diâmetro. Um para-lama menor que a roda é outro defeito. */
const PISO_COBERTURA = 0.58;
/**
 * ▶▶ A COROA DO ARCO DESCE ATÉ CABER SOB A MESA DA LONGARINA.
 *
 * A varredura geral mediu, no VM, **122…125 mm de arco dentro das travessas do
 * sobrechassi** (mancha 628 × 122 × 254 em y 1 210) — o topo do arco passando
 * por cima da mesa e entrando no que está apoiado nela. O corte em z não
 * alcança isso: o cruzamento é no MEIO do arco, não na ponta.
 *
 * ⚠️ E CORTAR A COROA SERIA O ERRO DO §45.2 OUTRA VEZ. O que resolve sem furar
 * a casca é BAIXAR a peça.
 *
 * Aqui a descida é MEDIDA e limitada dos dois lados: ela para quando a coroa
 * fica `FOLGA_MESA` abaixo da mesa, e nunca deixa menos que `FOLGA_PNEU_TOPO`
 * de ar sobre o PNEU.
 *
 * ▶▶ E "SOBRE O PNEU" É POR VÉRTICE, NÃO PELA CAIXA — a 1ª versão errou nisso e
 * o dono o viu de perfil (*"esse paralama do scania bitruck, ele esta muito
 * aberto"*, 2026-08-23; a queixa era do Scania, e a medida acusou o VM junto).
 * ------------------------------------------------------------------------
 * Ela escrevia `podeDescer = coroaExterna − (coroaDoPneu + FOLGA)`. A coroa
 * EXTERNA é o topo da caixa do grupo inteiro — a chapa de fora, mais o suporte
 * que sobe acima dela —, e a face que encosta no pneu está **110 mm abaixo**
 * disso. Com 85 mm de folga pedida, a conta liberava 195 mm de descida onde
 * cabiam 85: no VM medido, o arco terminou **12 mm DENTRO do pneu** na coroa e
 * 91 mm afastado dele na ponta. Um arco que deixa de ser concêntrico com a roda
 * é exatamente o que se lê como "aberto" — a descida fecha o vão de cima e abre
 * o de baixo, e as pernas descem para além da linha do eixo.
 *
 * `quantoPodeDescer()` faz a conta certa: para cada vértice da peça que está
 * ACIMA da linha do eixo e dentro da largura do pneu, quanto ele ainda pode
 * cair antes de chegar a `FOLGA_PNEU_TOPO` do cilindro do pneu. O mínimo disso
 * é o que a peça pode descer. Vértice abaixo da linha do eixo não entra: descer
 * só o afasta. É a mesma correção que `cab-bake-fixes.ts` levou no `t_paralama_0`
 * do próprio Scania, onde a descida de 110 mm virou um encolhimento de 0,90 em
 * torno da linha do eixo.
 */
const FOLGA_MESA = 0.020;
const FOLGA_PNEU_TOPO = 0.085;
/**
 * ▶▶ O AJUSTE FINO POR CAMINHÃO — e ele é do OLHO DO DONO, não de conta.
 *
 * *"abaixe e diminua levemente os para-lamas do VM no bitruck, para ficar menor
 * e mais próximo da roda"* — Kennedy, 2026-08-25.
 *
 * A peça é do Scania e a régua que a dimensiona é o PNEU DO ALVO: no VM o pneu
 * tem 1 056 mm contra 992 do doador, então o arco entra 6,4 % maior que no
 * caminhão em que foi desenhado. Numérico está certo; na tela ficou solto.
 *
 * São três números, e os três precisam andar juntos — mexer só num deles não
 * faz o que se pede:
 *
 *   `escala`     encolhe o arco em torno do eixo (só em y/z: em x quem manda é
 *                a grade, e o arco já acaba 22 mm PARA DENTRO da face do pneu);
 *   `folgaPneu`  quanto o arco tem de guardar do cilindro do pneu. Encolher sem
 *                baixar este número trava a descida em zero — o arco encosta no
 *                envelope antes de descer, e "mais próximo da roda" é
 *                exatamente pedir esse envelope mais apertado;
 *   `desceMais`  o que a peça baixa ALÉM do necessário para caber sob a mesa.
 *                Sem ele a descida para assim que a coroa passa da longarina, e
 *                a queixa é sobre a RODA, não sobre a mesa.
 */
const AJUSTE_FINO: { id: RegExp; escala: number; folgaPneu: number; desceMais: number }[] = [
  { id: /^volvo-vm-2015-/i, escala: 0.96, folgaPneu: 0.050, desceMais: 0.030 },
];
/** Passo de amostragem de vértice num nó grande — o `truck_p4` do VW tem
 *  186 k triângulos e este caminho roda no carregamento da cabine. */
const CORTE_PASSO = 2;

/**
 * QUANTO A PEÇA PODE DESCER antes de chegar a `FOLGA_PNEU_TOPO` do pneu.
 *
 * O pneu é um CILINDRO de raio `R` em torno de (`yc`, `alvoZ`); a folga entra
 * engordando o raio. Um vértice acima da linha do eixo, a `dz` do plano do
 * eixo, esbarra no cilindro engordado quando `y − d − yc` chega a
 * `√(R² − dz²)` — daí `d = (y − yc) − √(R² − dz²)`. Fora da largura do pneu, ou
 * a mais de `R` do plano do eixo, ou abaixo da linha do eixo, o vértice não
 * limita nada: descer só o afasta.
 *
 * ⚠️ POR VÉRTICE, e não pela caixa da peça. Ver o bloco de `FOLGA_MESA`.
 */
function quantoPodeDescer(
  peca: THREE.Object3D, Nmundo: THREE.Matrix4, pneu: Pneu, alvoZ: number,
  folga = FOLGA_PNEU_TOPO,
): number {
  const R = pneu.diametro / 2 + folga;
  const yc = pneu.chao + pneu.diametro / 2;
  const Nl = new THREE.Matrix4();
  const v = new THREE.Vector3();
  let d = Infinity;
  peca.traverse((node) => {
    const m = node as THREE.Mesh;
    if (!m.isMesh || !m.geometry) return;
    const pos = m.geometry.getAttribute('position') as THREE.BufferAttribute | undefined;
    if (!pos) return;
    Nl.copy(Nmundo).multiply(m.matrixWorld);
    const passo = pos.count > 40000 ? CORTE_PASSO : 1;
    for (let i = 0; i < pos.count; i += passo) {
      v.set(pos.getX(i), pos.getY(i), pos.getZ(i)).applyMatrix4(Nl);
      if (v.y <= yc) continue;
      const ax = Math.abs(v.x);
      if (ax < FLANCO_X || ax > pneu.fora) continue;
      const dz = Math.abs(v.z - alvoZ);
      if (dz >= R) continue;
      const podia = (v.y - yc) - Math.sqrt(R * R - dz * dz);
      if (podia < d) d = podia;
    }
  });
  return Number.isFinite(d) ? Math.max(0, d) : 0;
}

/**
 * ONDE O ARCO TEM DE PARAR, à frente do eixo — em z NORMALIZADO.
 *
 * Varre a cabine (menos a roda e menos o próprio arco) na janela em que o arco
 * vive e devolve o z da peça mais próxima ADIANTE do eixo. Por vértice: aqui
 * não se quer saber se algo atravessa, e sim onde começa a primeira coisa que
 * está no caminho.
 */
function frenteLivre(
  cab: THREE.Object3D, peca: THREE.Object3D, N: THREE.Matrix4,
  pneu: Pneu, zPiso: number,
): number {
  const cabInv = new THREE.Matrix4().copy(cab.matrixWorld).invert();
  const L2N = new THREE.Matrix4();
  const v = new THREE.Vector3();
  const yBaixo = pneu.chao + CORTE_FAIXA_Y[0] * pneu.diametro;
  const yAlto = pneu.chao + CORTE_FAIXA_Y[1] * pneu.diametro;
  let z = Infinity;
  cab.traverse((node) => {
    const m = node as THREE.Mesh;
    if (!m.isMesh || !m.geometry || !visivel(m, cab)) return;
    for (let p: THREE.Object3D | null = m; p; p = p.parent) if (p === peca) return;
    if (ehRoda(m, cab)) return;
    const pos = m.geometry.getAttribute('position') as THREE.BufferAttribute | undefined;
    if (!pos) return;
    L2N.copy(N).multiply(cabInv).multiply(m.matrixWorld);
    const passo = pos.count > 40000 ? CORTE_PASSO : 1;
    for (let i = 0; i < pos.count; i += passo) {
      v.set(pos.getX(i), pos.getY(i), pos.getZ(i)).applyMatrix4(L2N);
      /* ⚠️ SÓ ALÉM DO PISO DE COBERTURA. Dentro dele estão o eixo, o feixe e o
         cubo — que é o que o arco existe para cobrir. Procurar obstáculo a
         partir do eixo devolve o próprio eixo, e o corte vira ruído: medido, o
         VW dava "a peça mais próxima adiante está a 1 mm do eixo". */
      if (v.z <= zPiso) continue;
      if (v.y < yBaixo || v.y > yAlto) continue;
      const ax = Math.abs(v.x);
      if (ax < CORTE_FAIXA_X[0] || ax > CORTE_FAIXA_X[1]) continue;
      if (v.z < z) z = v.z;
    }
  });
  return z;
}

/* ⚠️ `cortaEmZ()` FOI DAQUI, e o registro fica porque a tentação volta.
   ---------------------------------------------------------------------------
   Ela cortava o arco por um PLANO em z para ele caber no vão à frente do 2º
   direcional, e era a segunda tentativa (a primeira recortava por TRIÂNGULO e
   abria buraco na casca — ver o bloco acima). As duas erravam o SUJEITO: o que
   não cabia no vão não era o para-lama, era a ferragem que `cut-chassi.cjs`
   deixou lá quando enxertou o eixo. Aparar a peça boa para caber na sobra dá um
   arco com corte reto na frente, e foi o que o dono chamou de "quebrado".

   Quem limpa o vão agora é `clearSecondSteerBay()`, e o arco vem inteiro. */

/* ══════════════════════════════════════════════════════════════════════════
   ▶▶▶ A BAIA DO 2º DIRECIONAL — o que o rip deixou DENTRO do arco
   ══════════════════════════════════════════════════════════════════════════

   > *"precisa pegar novamente o para-lamas do Scania pois no VM bitruck ficou
   >  quebrado, além disso essa peça que está atravessando ele deve ser
   >  removida"* · *"remova essa peça (o conjunto inteiro se tiver múltiplos
   >  componentes) que está tocando ele que fez ele ser cortado"* — Kennedy,
   >  2026-08-25.

   AS DUAS FRASES SÃO A MESMA PEÇA, e a ordem entre elas é o conserto. O VM e o
   VW são bitrucks DERIVADOS: `cut-chassi.cjs` enxerta um 2º eixo direcional
   onde o 6x2 tinha VÃO, e o que morava naquele vão continua lá — no VM, a
   caixa de bateria (`chs_base_0_p13`, 417 × 247 × 424 em |x| 610…1 027) com a
   ferragem dela.

   ⚠️ E ERA ELA QUE QUEBRAVA O ARCO. `frenteLivre()` a encontrava em Zn 211 e
   `cortaEmZ()` aparava o para-lama no piso de cobertura (240) — o corte reto na
   frente do arco que o dono chamou de "quebrado". Aparar a peça boa para caber
   na sobra é o erro de sujeito: quem sobrava era a ferragem. Removida ela, o
   arco vem INTEIRO do doador e o corte deixou de existir.

   A RÉGUA, e ela é a mesma de `rear-bogie.ts`: componente SOLDADO (senão o rip
   entrega tiras, e apagar metade de uma peça é o defeito que se está
   consertando), ÂNCORA na casca do arco e CONTATO para o resto do conjunto,
   com o ENVELOPE do grupo como freio. Medido no VM, isso apaga 94 componentes
   em 45 886 triângulos — dos quais só 8 encostavam na casca; os outros vieram
   por contato, que é justamente o "conjunto inteiro" que o dono pediu. */

/**
 * ▶▶ A SEMENTE É "ENCOSTA NA CASCA DO ARCO", medida em VOXEL.
 *
 * *"alguns saíram, mas ainda tem elementos tocando aquele para-lamas"* —
 * Kennedy, 2026-08-25.
 *
 * ⚠️ AS DUAS RÉGUAS ANTERIORES ERRARAM POR SEREM JANELAS, e as duas estão
 * medidas:
 *
 *   · "tudo o que cabe na baia" → **86 peças**, das quais 63 eram o estrado do
 *     estribo (`chs_base_0_p6`, 63 ripas de 4 × 2 × 21 em Zn 551…664);
 *   · "o que está no alcance em z do arco, no flanco" → 22 peças, e deixou
 *     passar **a caixa de bateria** (`chs_base_0_p13`, 417 × 247 × 424 em
 *     |x| 610…1027), que mora ABAIXO da linha do eixo e para DENTRO do piso de
 *     |x| — e que é o que sobrou tocando o arco na foto.
 *
 * Uma janela sempre erra: o arco não é uma caixa, é uma CASCA curva. Então a
 * pergunta passa a ser feita contra a casca de verdade — os vértices do arco
 * viram uma grade de células de `BAIA_CELULA`, e é semente quem põe vértice
 * dentro dela. Isso é, ao pé da letra, "a peça que está tocando ele".
 */
const BAIA_CELULA = 0.030;
/** Quantos vértices dentro da casca fazem uma semente. 8 recusa o vértice
 *  solto que só raspa a borda e aceita qualquer peça que de fato entra. */
const BAIA_TOCA_MIN = 8;
/** Componente maior que isto não é ferragem: é estrutura, e estrutura fica.
 *  A caixa de bateria dá 424 mm; a longarina, metros. */
const BAIA_PECA_MAX = 0.60;
/**
 * Teto de peças POR FLANCO — e ele é o freio SECUNDÁRIO.
 *
 * ⚠️ 40 REPROVOU UM CONJUNTO SÃO: medido no VM, o flanco x+ devolveu **69
 * peças num envelope de 596 × 371 × 231 mm** — um palmo de ferragem partido em
 * 69 componentes pelo rip, e não um vazamento. Quem prova que a régua não
 * vazou é o ENVELOPE (`BAIA_GRUPO_MAX`), não a contagem: 231 mm em z não
 * alcançam nada. A contagem fica só como rede contra o caso patológico.
 */
const BAIA_TETO = 150;
/**
 * ▶▶ …E A UNIDADE É O CONJUNTO, não o componente.
 *
 * *"remova essa peça (o conjunto inteiro se tiver múltiplos componentes) que
 * está tocando ele"* — Kennedy, 2026-08-25.
 *
 * Semeia quem encosta na casca e propaga por contato para trazer o resto do
 * conjunto — o braço que segue para a frente sai junto; o estrado do estribo
 * não, porque está a 159 mm do mais próximo e o contato é de 60.
 */
const BAIA_CONTATO = 0.06;
/**
 * …e a SEMENTE tem de ser ferragem, não adesivo.
 *
 * ⚠️ Sem este piso o VW perdia **21 chapas de `truck_p49` com 1 mm** de
 * espessura em |x| 1 130 — decalque, não peça. Uma peça que "toca o para-lama"
 * e tem um milímetro está PINTADA nele, e apagá-la é tirar arte do caminhão.
 */
const BAIA_SEMENTE_ESPESSURA = 0.006;
/** O envelope máximo do conjunto, por flanco. Medido no VM, o conjunto do
 *  flanco x− fecha em 430 × 518 × 430 (a caixa de bateria com a ferragem);
 *  isto dá folga e ainda recusa meio chassi. */
const BAIA_GRUPO_MAX = new THREE.Vector3(0.75, 0.85, 0.95);
/** Até onde se procura por peça que ficou órfã do que saiu. */
const ORFA_ALCANCE = 0.35;
/**
 * Uma peça está sozinha quando nada sobra a menos disto dela — **5 mm**.
 *
 * ⚠️ 20 mm SALVAVA A SOBRA: a plaqueta `chs_base_0_p18`, uma chapa de espessura
 * ZERO de 0 × 86 × 145 em Zn 428…574, ficou a **18 mm** do que restou da caixa
 * de bateria e por isso entrava no aglomerado dela. 5 mm é a régua que o rip
 * suporta: medido à frente do arco do VM, das **761** peças da região exatamente
 * UMA tem vão maior que isso — ela. Todo o resto encosta de verdade.
 */
const ORFA_TOCA = 0.005;
/** …e só peça MIÚDA vira órfã: uma peça grande sozinha é peça, não sobra. */
const ORFA_MAX = 0.30;

/**
 * Apaga a ferragem do rip que mora dentro do arco do 2º direcional.
 *
 * ⚠️ ESCREVE ÍNDICE, e por isso roda DEPOIS de `markShared()`: apagar face num
 * molde compartilhado levaria o buraco para as malhas irmãs. Ver
 * `geometry-share.ts`.
 */
export function clearSecondSteerBay(
  cab: THREE.Object3D, mount: RigidMount,
): string[] {
  const steer = mount.axles.steerZ || [];
  if (steer.length < 2) return [];
  const arco = cab.getObjectByName(NOME);
  if (!arco) return [];
  cab.updateWorldMatrix(true, true);
  const N = new THREE.Matrix4().makeRotationY(mount.orientYaw)
    .multiply(new THREE.Matrix4().makeTranslation(-mount.centerX, -mount.groundY, 0));
  const cabInv = new THREE.Matrix4().copy(cab.matrixWorld).invert();
  const v = new THREE.Vector3();

  /* 1 · A CASCA DO ARCO em células de `BAIA_CELULA`. Só vértice de FACE VIVA:
        `cortaEmZ()` não existe mais, mas um asset pode trazer vértice órfão e
        um órfão não é superfície. */
  const ocupa = new Set<number>();
  const cxArco = new THREE.Box3();
  const G = 1 << 20;
  const chave = (x: number, y: number, z: number) =>
    (Math.round(x / BAIA_CELULA) * 2048 + Math.round(y / BAIA_CELULA)) * 2048
      + Math.round(z / BAIA_CELULA) + G;
  arco.traverse((node) => {
    const m = node as THREE.Mesh;
    if (!m.isMesh || !m.geometry) return;
    const pos = m.geometry.getAttribute('position') as THREE.BufferAttribute | undefined;
    const idx = m.geometry.getIndex();
    if (!pos) return;
    const M = new THREE.Matrix4().copy(N).multiply(cabInv).multiply(m.matrixWorld);
    const usa = (i: number) => {
      v.set(pos.getX(i), pos.getY(i), pos.getZ(i)).applyMatrix4(M);
      cxArco.expandByPoint(v);
      ocupa.add(chave(v.x, v.y, v.z));
    };
    if (idx) for (let q = 0; q < idx.count; q++) usa(idx.getX(q));
    else for (let i = 0; i < pos.count; i++) usa(i);
  });
  if (!ocupa.size) return [`⚠ ${mount.id}: o arco não tem superfície medível`];
  const reg = cxArco.clone().expandByScalar(0.05);
  /* ▶▶ …E UMA REGIÃO MAIOR, SÓ PARA A VARREDURA DE ÓRFÃ.
     ------------------------------------------------------------------------
     *"ficou uma placa de um componente que foi removido flutuando entre as 2
     primeiras rodas do bitruck"* — Kennedy, 2026-08-25.

     A plaqueta da caixa de bateria mora em Zn **390** e a região da corrente
     acaba em 373: 17 mm fora. A caixa saiu, ela ficou, e uma plaqueta sozinha
     no ar é o que a foto mostra.

     ⚠️ ABRIR A REGIÃO DA CORRENTE FOI TENTADO E DERRUBADO NA MEDIDA: com 350 mm
     o flanco x+ passou de 13 para **559 peças, envelope 786 × 596 × 817** —
     estourou o teto e o lado inteiro deixou de ser limpo. Região de corrente é
     freio, não conveniência.

     O que a plaqueta pede não é corrente, é ÓRFÃ: ela não entra por encostar no
     arco, entra por ter ficado sem nada em volta depois que o vizinho saiu. E
     isso se pergunta DEPOIS, sobre o resultado. */
  const regOrfa = cxArco.clone().expandByScalar(ORFA_ALCANCE);

  /* 2 · OS CANDIDATOS — componente SOLDADO do rip, miúdo e de um flanco só. */
  type Cand = { malha: THREE.Mesh; raiz: number; caixa: THREE.Box3; pai: Int32Array;
    semente: boolean; lado: number };
  const cands: Cand[] = [];
  /* Tudo o que existe na região maior, sem filtro nenhum — é contra esta lista
     que se pergunta "sobrou alguém do lado dela?". */
  const todos: { malha: THREE.Mesh; raiz: number; caixa: THREE.Box3; pai: Int32Array }[] = [];
  cab.traverse((node) => {
    const m = node as THREE.Mesh;
    if (!m.isMesh || !m.visible || !m.geometry) return;
    for (let p: THREE.Object3D | null = m; p; p = p.parent) {
      if (p === arco || /^(VM_WHEEL|TS_)/.test(p.name || '')) return;
    }
    if (RODA_RE.test(m.name || '')) return;
    const pos = m.geometry.getAttribute('position') as THREE.BufferAttribute | undefined;
    const idx = m.geometry.getIndex();
    if (!pos || !idx || pos.count > 260000) return;
    if (!m.geometry.boundingBox) m.geometry.computeBoundingBox();
    const L2N = new THREE.Matrix4().copy(N).multiply(cabInv).multiply(m.matrixWorld);
    const bb = m.geometry.boundingBox as THREE.Box3;
    const cx = new THREE.Box3();
    for (let k = 0; k < 8; k++) {
      cx.expandByPoint(v.set(k & 1 ? bb.max.x : bb.min.x, k & 2 ? bb.max.y : bb.min.y,
        k & 4 ? bb.max.z : bb.min.z).applyMatrix4(L2N));
    }
    if (!cx.intersectsBox(regOrfa)) return;
    const px = new Float32Array(pos.count * 3);
    for (let i = 0; i < pos.count; i++) {
      v.set(pos.getX(i), pos.getY(i), pos.getZ(i)).applyMatrix4(L2N);
      px[i * 3] = v.x; px[i * 3 + 1] = v.y; px[i * 3 + 2] = v.z;
    }
    const pai = componentesSoldados(px, idx, pos.count);
    const info = new Map<number, { caixa: THREE.Box3; toca: number }>();
    for (let q = 0; q < idx.count; q++) {
      const i = idx.getX(q), r = pai[i];
      let e = info.get(r);
      if (!e) { e = { caixa: new THREE.Box3(), toca: 0 }; info.set(r, e); }
      e.caixa.expandByPoint(v.set(px[i * 3], px[i * 3 + 1], px[i * 3 + 2]));
      if (ocupa.has(chave(px[i * 3], px[i * 3 + 1], px[i * 3 + 2]))) e.toca++;
    }
    for (const [r, e] of info) {
      const b = e.caixa;
      if (b.intersectsBox(regOrfa)) todos.push({ malha: m, raiz: r, caixa: b, pai });
      if (!b.intersectsBox(reg)) continue;
      /* ⚠️ NUNCA UMA PEÇA QUE CRUZA A LINHA DE CENTRO: travessa e longarina se
         parecem com ferragem quando só se olha o tamanho de um lado. */
      if (b.min.x * b.max.x <= 0) continue;
      const d = b.getSize(new THREE.Vector3());
      if (Math.max(d.x, d.y, d.z) > BAIA_PECA_MAX) continue;
      const semente = e.toca >= BAIA_TOCA_MIN
        && Math.min(d.x, d.y, d.z) >= BAIA_SEMENTE_ESPESSURA;
      cands.push({ malha: m, raiz: r, caixa: b, pai, semente, lado: b.min.x >= 0 ? 1 : -1 });
    }
  });

  /* 3 · O CONJUNTO, por flanco: semente + contato, com teto de contagem E de
        envelope. Por flanco porque os dois lados não se tocam e um teto comum
        esconderia um vazamento de um lado só. */
  const escolhidos = new Map<THREE.Mesh, { raizes: Set<number>; pai: Int32Array; quem: string[] }>();
  let total = 0;
  const avisos: string[] = [];
  let sementes = 0;
  for (const lado of [1, -1]) {
    const meus = cands.filter((c) => c.lado === lado);
    const dentro = new Set<Cand>(meus.filter((c) => c.semente));
    sementes += dentro.size;
    if (!dentro.size) continue;
    let fronteira = [...dentro].map((c) => c.caixa);
    while (fronteira.length && dentro.size <= BAIA_TETO) {
      const nova: THREE.Box3[] = [];
      for (const c of meus) {
        if (dentro.has(c)) continue;
        const inflada = c.caixa.clone().expandByScalar(BAIA_CONTATO);
        if (!fronteira.some((f) => f.intersectsBox(inflada))) continue;
        dentro.add(c); nova.push(c.caixa);
      }
      fronteira = nova;
    }
    const env = new THREE.Box3();
    for (const c of dentro) env.union(c.caixa);
    const d = env.getSize(new THREE.Vector3());
    if (dentro.size > BAIA_TETO || d.x > BAIA_GRUPO_MAX.x
      || d.y > BAIA_GRUPO_MAX.y || d.z > BAIA_GRUPO_MAX.z) {
      /* ▶ FECHA POR FALTA: meio conjunto apagado é pior que ele inteiro no
         lugar, porque some sem deixar rastro na tela. */
      avisos.push(`flanco x${lado > 0 ? '+' : '−'}: ${dentro.size} peça(s),`
        + ` envelope ${(d.x * 1000).toFixed(0)}×${(d.y * 1000).toFixed(0)}×${(d.z * 1000).toFixed(0)}`
        + ` — passou do teto, NADA apagado deste lado`);
      continue;
    }
    for (const c of dentro) {
      let e = escolhidos.get(c.malha);
      if (!e) { e = { raizes: new Set(), pai: c.pai, quem: [] }; escolhidos.set(c.malha, e); }
      if (e.raizes.has(c.raiz)) continue;
      e.raizes.add(c.raiz);
      const dd = c.caixa.getSize(new THREE.Vector3());
      e.quem.push(`${(dd.x * 1000).toFixed(0)}×${(dd.y * 1000).toFixed(0)}×${(dd.z * 1000).toFixed(0)}`);
      total++;
    }
  }
  /* ▶▶ A VARREDURA DE ÓRFÃ. Quem sobrou sem nada em volta sai junto: era peça
     de quem saiu. Pergunta feita sobre o RESULTADO, e não sobre a régua — por
     isso não tem como vazar: uma peça só é órfã se tudo o que estava a menos de
     `ORFA_TOCA` dela também foi embora. */
  let orfas = 0;
  if (total) {
    const saiu = (c: { malha: THREE.Mesh; raiz: number }) =>
      escolhidos.get(c.malha)?.raizes.has(c.raiz) ?? false;
    const fica = todos.filter((c) => !saiu(c));
    /* ▶ POR AGLOMERADO, E NÃO POR PEÇA — e este foi o furo da primeira versão.
       ------------------------------------------------------------------------
       Perguntar "sobrou alguém a menos de `ORFA_TOCA` dela?" salva DUAS sobras
       que se tocam: cada uma responde "sim, a outra". Medido no VM: a plaqueta
       `chs_base_0_p18` em Zn 454…515, |x| 1 040, ficou no ar exatamente assim.

       A pergunta certa é sobre o CONJUNTO de sobras: junta-se o que se toca e
       pergunta-se do aglomerado inteiro. Um aglomerado pequeno que não encosta
       em nada é sobra; um que encosta na longarina (que está em `todos`, porque
       a caixa dela cruza a região) não é. */
    const pai2 = fica.map((_, i) => i);
    const raizC = (i: number): number => { while (pai2[i] !== i) { pai2[i] = pai2[pai2[i]]; i = pai2[i]; } return i; };
    for (let i = 0; i < fica.length; i++) {
      const bi = fica[i].caixa.clone().expandByScalar(ORFA_TOCA);
      for (let j = i + 1; j < fica.length; j++) {
        if (!bi.intersectsBox(fica[j].caixa)) continue;
        const a2 = raizC(i), b2 = raizC(j);
        if (a2 !== b2) pai2[b2] = a2;
      }
    }
    const grupos = new Map<number, number[]>();
    for (let i = 0; i < fica.length; i++) {
      const r = raizC(i);
      const g = grupos.get(r);
      if (g) g.push(i); else grupos.set(r, [i]);
    }
    for (const membros of grupos.values()) {
      const env = new THREE.Box3();
      for (const i of membros) env.union(fica[i].caixa);
      const d = env.getSize(new THREE.Vector3());
      if (Math.max(d.x, d.y, d.z) > ORFA_MAX) continue;      // grande: é peça, não sobra
      if (!regOrfa.containsBox(env)) continue;               // sai da região: não se julga
      for (const i of membros) {
        const c = fica[i];
        let e = escolhidos.get(c.malha);
        if (!e) { e = { raizes: new Set(), pai: c.pai, quem: [] }; escolhidos.set(c.malha, e); }
        if (e.raizes.has(c.raiz)) continue;
        const dd = c.caixa.getSize(new THREE.Vector3());
        e.raizes.add(c.raiz);
        e.quem.push(`órfã ${(dd.x * 1000).toFixed(0)}×${(dd.y * 1000).toFixed(0)}×${(dd.z * 1000).toFixed(0)}`);
        total++; orfas++;
      }
    }
  }
  if (!total) {
    return [`${mount.id}: baia do 2º direcional limpa — nada do rip toca o arco`
      + (avisos.length ? ` · ${avisos.join(' · ')}` : '')];
  }

  /* 4 · O APAGAMENTO — no ÍNDICE, e depois de `markShared()`. */
  const relato: string[] = [];
  let tri = 0;
  for (const [malha, e] of escolhidos) {
    const geo = claimGeometry(malha);
    const gidx = geo.getIndex();
    if (!gidx) continue;
    const fica: number[] = [];
    let foram = 0;
    for (let q = 0; q < gidx.count; q += 3) {
      if (e.raizes.has(e.pai[gidx.getX(q)])) { foram++; continue; }
      fica.push(gidx.getX(q), gidx.getX(q + 1), gidx.getX(q + 2));
    }
    if (!foram) continue;
    const Arr = geo.getAttribute('position').count > 65535 ? Uint32Array : Uint16Array;
    geo.setIndex(new THREE.BufferAttribute(new Arr(fica), 1));
    geo.computeBoundingBox();
    geo.computeBoundingSphere();
    tri += foram;
    relato.push(`${malha.name}: ${e.raizes.size} [${e.quem.slice(0, 6).join(' ')}]`);
  }
  return [`${mount.id}: baia do 2º direcional — ${total} peça(s) do rip apagadas`
    + ` (${sementes} encostavam na casca, ${orfas} ficaram órfãs, o resto veio por`
    + ` contato; ${tri} triângulos)`
    + ` · arco x ${(cxArco.min.x * 1000).toFixed(0)}…${(cxArco.max.x * 1000).toFixed(0)},`
    + ` y ${(cxArco.min.y * 1000).toFixed(0)}…${(cxArco.max.y * 1000).toFixed(0)},`
    + ` Zn ${(cxArco.min.z * 1000).toFixed(0)}…${(cxArco.max.z * 1000).toFixed(0)}`
    + ` · ${relato.join(' · ')}`
    + (avisos.length ? ` · ${avisos.join(' · ')}` : '')];
}

/** O nó que este módulo pendura, para poder ser idempotente. */
const NOME = 'TS_PARALAMA_DIR2';

/**
 * Monta o para-lama do 2º eixo direcional, quando há um e ele está nu.
 *
 * @param asset a raiz já carregada de `paralama_dir2_v1.glb`
 * @returns linhas para o console — vazio quando não havia o que fazer
 *
 * IDEMPOTENTE: remove a montagem anterior antes de refazer. `loadCab()` roda
 * uma vez por caminhão, mas a bancada troca de chassi em laço e um segundo
 * para-lama sobre o primeiro é z-fighting.
 */
export function attachSecondSteerFender(
  cab: THREE.Object3D, mount: RigidMount, asset: THREE.Object3D,
): string[] {
  const velho = cab.getObjectByName(NOME);
  if (velho) velho.removeFromParent();

  const steer = mount.axles.steerZ || [];
  if (steer.length < 2) return [];
  /* A escala não-uniforme só comuta com o giro se ele for de meia-volta —
     ver o bloco do cabeçalho. */
  if (Math.abs(Math.abs(mount.orientYaw) - Math.PI) > 1e-6) {
    return [`⚠ ${mount.id}: orientYaw ${mount.orientYaw.toFixed(3)} não é ±π —`
      + ' a escala do para-lama não é válida nesse referencial.'];
  }

  cab.updateWorldMatrix(true, true);
  const N = new THREE.Matrix4().makeRotationY(mount.orientYaw)
    .multiply(new THREE.Matrix4().makeTranslation(-mount.centerX, -mount.groundY, 0));

  /* ⚠️ O EIXO NOVO É O DE MENOR z, e não `steerZ[1]`. O manifesto lista os
     direcionais na ordem em que o bake os mediu, e nada obriga essa ordem a ser
     a de frente para trás. O 2º direcional de um bitruck é, por definição, o
     que está atrás. */
  const alvoZ = Math.min(...steer);
  const pneu = medePneu(cab, N, alvoZ);
  if (!pneu) {
    return [`⚠ ${mount.id}: nenhum pneu visível em Zn ${(alvoZ * 1000).toFixed(0)} —`
      + ' o para-lama não seria colocável.'];
  }
  const jaTem = jaTemArco(cab, N, alvoZ, pneu);
  if (jaTem > 200) {
    return [`${mount.id}: o 2º direcional já tem para-lama (${jaTem} vértices na faixa`
      + ` do arco) — nada a acrescentar.`];
  }

  /* ▶ O AJUSTE FINO DESTE CAMINHÃO — ver `AJUSTE_FINO`. */
  const fino = AJUSTE_FINO.find((f) => f.id.test(mount.id)) ?? null;
  const sy = (pneu.diametro / DOADOR.pneuDiametro) * (fino ? fino.escala : 1);
  /* ⚠️ O MENOR ENTRE COBRIR O PNEU E CABER NA GRADE — ver `TETO_ARCO`. Hoje
     quem manda nos três é o teto; a conta do pneu fica para o caminhão de
     bitola estreita que ainda não existe no catálogo. */
  const sxPneu = (pneu.fora + FOLGA_PNEU) / DOADOR.arcoFora;
  const sxTeto = TETO_ARCO / DOADOR.arcoFora;
  const sx = Math.min(sxPneu, sxTeto);

  /* ⚠️ `N⁻¹` VAI NO PONTO, NUNCA NA PEÇA — e a 1ª versão errou exatamente isso.
     ------------------------------------------------------------------------
     Ela escrevia `matrix = N⁻¹ · T(pose) · S`, o que aplica `N⁻¹` também aos
     VÉRTICES do asset. `N` é `R_y(π) · T(…)`, então `N⁻¹` carrega meia-volta —
     e o asset JÁ está no espaço cru do glTF, o mesmo da cabine que o recebe. O
     resultado é o para-lama ESPELHADO em z: o para-barro, que é peça de
     traseira, nascia na frente da roda, e a ponta do arco entrava na caixa de
     bateria e na grade. *"o para-lamas do bitruck do VW e Volvo estão ao
     contrário, além de estarem tocando outros itens do chassi"* — Kennedy.

     O que precisa mudar de referencial é só a COTA: o eixo é conhecido em
     normalizado e a peça é pendurada no local da cabine. Levado o PONTO por
     `N⁻¹` e composta a matriz sem rotação, o asset entra no lugar certo e na
     orientação em que foi assado. */
  const Ninv = new THREE.Matrix4().copy(N).invert();
  const onde = new THREE.Vector3(0, pneu.chao + pneu.diametro / 2, alvoZ)
    .applyMatrix4(Ninv);

  const peca = asset.clone(true);
  peca.name = NOME;
  peca.matrixAutoUpdate = false;
  peca.matrix.compose(onde, new THREE.Quaternion(),
    new THREE.Vector3(sx, sy, sy));
  cab.add(peca);
  cab.updateWorldMatrix(true, true);

  /* ▶ A COROA DESCE ATÉ CABER SOB A MESA — ver `FOLGA_MESA`. */
  const Nmundo = new THREE.Matrix4().copy(N)
    .multiply(new THREE.Matrix4().copy(cab.matrixWorld).invert());
  const alturaCoroa = () => {
    const bb = new THREE.Box3().setFromObject(peca);
    const cs = [];
    for (const x of [bb.min.x, bb.max.x]) for (const y of [bb.min.y, bb.max.y]) {
      for (const z of [bb.min.z, bb.max.z]) cs.push(new THREE.Vector3(x, y, z).applyMatrix4(Nmundo));
    }
    return Math.max(...cs.map((p) => p.y));
  };
  const coroa0 = alturaCoroa();
  const tetoMesa = mount.frameTopY - FOLGA_MESA;
  const podeDescer = quantoPodeDescer(peca, Nmundo, pneu, alvoZ,
    fino ? fino.folgaPneu : FOLGA_PNEU_TOPO);
  const descida = Math.min(
    Math.max(0, coroa0 - tetoMesa) + (fino ? fino.desceMais : 0), podeDescer);
  if (descida > 0.001) {
    peca.matrix.compose(new THREE.Vector3(onde.x, onde.y - descida, onde.z),
      new THREE.Quaternion(), new THREE.Vector3(sx, sy, sy));
    peca.updateWorldMatrix(true, true);
  }

  /* ▶ E AGORA O ARCO É CORTADO NO COMPRIMENTO — ver o bloco de `frenteLivre()`.
     O vão livre à frente do eixo é medido no caminhão que está na tela; o corte
     nunca deixa o arco menor que o pneu que ele cobre. */
  /* ⚠️ `N` LEVA DO LOCAL DA CABINE AO NORMALIZADO, e a caixa de `peca` está em
     MUNDO. Quem faz mundo → normalizado é `N · cab.matrixWorld⁻¹`, e é o mesmo
     par que `medePneu()` compõe. Usar `N` cru aqui punha o arco em Zn −2 566
     num caminhão em que ele acaba em −13. É a terceira vez que esta inversa
     erra nesta frente; ver §43.8. */
  const N2 = new THREE.Matrix4().copy(N)
    .multiply(new THREE.Matrix4().copy(cab.matrixWorld).invert());
  const zPiso = alvoZ + PISO_COBERTURA * pneu.diametro;
  const zLivre = frenteLivre(cab, peca, N, pneu, zPiso);
  peca.updateWorldMatrix(true, true);
  const bbP = new THREE.Box3().setFromObject(peca);
  const csP = [];
  for (const x of [bbP.min.x, bbP.max.x]) for (const y of [bbP.min.y, bbP.max.y]) {
    for (const z of [bbP.min.z, bbP.max.z]) csP.push(new THREE.Vector3(x, y, z).applyMatrix4(N2));
  }
  const zPeca = Math.max(...csP.map((p) => p.z));
  let relatoCorte = `coroa em ${(coroa0 * 1000).toFixed(0)} → `
    + `${(alturaCoroa() * 1000).toFixed(0)} mm (mesa ${(mount.frameTopY * 1000).toFixed(0)},`
    + ` desceu ${(descida * 1000).toFixed(0)}, podia ${(podeDescer * 1000).toFixed(0)}) · `
    + `arco vai a Zn ${(zPeca * 1000).toFixed(0)} à frente;`
    + ` a peça mais próxima adiante está em ${Number.isFinite(zLivre) ? (zLivre * 1000).toFixed(0) : '—'}`
    + ` · piso de cobertura ${(zPiso * 1000).toFixed(0)}`;
  /* ▶▶ E O CORTE FICOU PARA TRÁS — ver `clearSecondSteerBay()`.
     ------------------------------------------------------------------------
     > *"precisa pegar novamente o para-lamas do Scania pois no VM bitruck
     >  ficou quebrado"* — Kennedy, 2026-08-25.

     ⚠️ O CORTE ERA O DEFEITO, e não o conserto. Ele existia para o arco não
     entrar no que estava à frente dele; só que o que estava à frente era
     FERRAGEM QUE O RIP DEIXOU NO VÃO onde `cut-chassi.cjs` enxertou o 2º
     direcional — três peças miúdas em Zn 184…383, |x| 823…1117. Aparar o
     para-lama para caber nelas deixava o arco com um corte reto na frente, que
     é o que o dono viu.

     A ordem certa é a inversa: quem sai é a ferragem, e o arco vem INTEIRO do
     doador. `clearSecondSteerBay()` faz isso — e roda DEPOIS de `markShared()`,
     que é por que o corte não podia simplesmente ser movido para cá.

     O número continua sendo MEDIDO e RELATADO: se um dia sobrar obstáculo de
     verdade à frente do arco, ele aparece no console em vez de virar um corte
     silencioso. */
  if (Number.isFinite(zLivre) && zLivre - FOLGA_CORTE < zPeca - 0.005) {
    relatoCorte += ` → NÃO cortado (o arco vem inteiro; quem sai da frente é a`
      + ` ferragem do rip — ver clearSecondSteerBay)`;
  } else {
    relatoCorte += ' → nada a cortar';
  }

  return [relatoCorte,
    `${mount.id}: para-lama do 2º direcional em Zn ${(alvoZ * 1000).toFixed(0)} mm ·`
    + ` pneu Ø ${(pneu.diametro * 1000).toFixed(0)} mm (doador`
    + ` ${(DOADOR.pneuDiametro * 1000).toFixed(0)}) · face externa`
    + ` ${(pneu.fora * 1000).toFixed(0)} mm (doador`
    + ` ${(DOADOR.pneuFora * 1000).toFixed(0)}) · arco vai a`
    + ` ${(DOADOR.arcoFora * sx * 1000).toFixed(0)} mm`
    + (sxTeto < sxPneu ? ' (limitado pela grade)' : ' (limitado pelo pneu)')
    + ` · escala ${sx.toFixed(3)} × ${sy.toFixed(3)}`
    + (fino ? ` (ajuste fino: encolhe ${fino.escala}, folga do pneu`
      + ` ${(fino.folgaPneu * 1000).toFixed(0)}, desce +${(fino.desceMais * 1000).toFixed(0)})` : '')
    + ` · ${pneu.vertices} vértices de pneu medidos`];
}
