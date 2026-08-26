/* A RODAGEM DOS CHASSIS RÍGIDOS — trocada pela roda do Volvo VM.
   ===========================================================================
   *"troca todas as rodas dos 3 modelos de sobrechassi para usar as rodas desse
   volvo, que são as melhores desenhadas [...] enquanto dos outros são muito mal
   feitas, garanta de posicionar corretamente e redimensionar também"* —
   Kennedy, 2026-08-20.

   Irmão de `wheels.ts`, que faz o mesmo pelo IMPLEMENTO com a roda do FH16.
   A doutrina é a mesma e o asset segue o mesmo contrato; o que muda é o SUJEITO
   e, com ele, a forma de achar as rodas.

   ===========================================================================
   ⚠️ POR QUE AGRUPAR POR VÉRTICE E NÃO POR MALHA

   `swapTrailerWheels()` mede UMA MALHA POR RODA, porque no bake do implemento é
   isso que existe. Nos três rígidos não há uma estrutura só:

     Volvo VM   um nó por peça POR RODA — 7 nós × 6 rodas
     Scania P   um nó por peça por roda, mas com o pneu repartido em 3 materiais
     VW Titan   **TODOS os pneus num nó só** (`wheel_f_0_0_f_tire_p0`, de
                z −2,14 a 5,78) e todos os aros em dois

   Um agrupador que lesse malha acertaria dois e entregaria UMA roda gigante no
   VW. Então o que se lê é VÉRTICE: agrupa-se por (eixo, lado), que é o que uma
   roda é fisicamente, e nenhuma das três estruturas de nó importa.

   ⚠️ E O RODADO DUPLO É UM GRUPO SÓ. Dois pneus do mesmo lado no mesmo eixo são
   um par, e o molde `WHEEL_DUAL` já traz os dois. Agrupar por (eixo, lado) —
   e não por pneu — resolve isso por construção, sem uma banda de tolerância
   entre pneus geminados.

   ===========================================================================
   ⚠️⚠️ QUEM DIZ ONDE ESTÁ O EIXO É O ARO, NUNCA O PNEU

   A primeira versão cortava os eixos por VÃO EM Z sobre os vértices de pneu, e
   isso não pode funcionar: **os pneus de um tandem se tocam em z**. Medido no
   VM — eixos a 1,296 m, pneu de 1,056 m de diâmetro, ou seja as duas rodas
   ocupam z −5,32…−4,26 e −4,02…−2,97 e o vão entre elas é de 240 mm, menor que
   qualquer banda que ainda separe eixo de eixo. O tandem virava UM grupo, com
   "diâmetro" 1,70 m (a média entre a altura real e os 2,35 m de comprimento dos
   dois juntos) e largura de roda avulsa. Sai uma roda de trator.

   O ARO não tem esse problema: ele tem ~0,62 m e dois aros de um tandem ficam a
   630…680 mm um do outro. Então o EIXO sai do aro (`_disc`, o único nome que os
   três rips compartilham) e o pneu é atribuído ao eixo MAIS PRÓXIMO.

   E a atribuição é sempre correta, não por sorte: um vértice de pneu está no
   máximo a um raio (0,53 m) do eixo dele, e o eixo vizinho mais próximo dos
   três caminhões está a 1,254 m — meia distância 0,627 m. 0,53 < 0,627 com
   margem, nos três.

   ===========================================================================
   ⚠️ O ESTEPE NÃO É RODA DE RODAGEM

   O Scania traz um estepe DEITADO sob o chassi, e ele tem material de pneu como
   qualquer outro. Trocá-lo pelo molde o poria de pé no meio do quadro.

   O que o separa não é o nome — é que **uma roda de rodagem toca o chão**. O
   critério é a cota do ponto mais baixo do grupo contra o raio dele: abaixo de
   15 % do diâmetro é rodagem; acima, é peça guardada. Medido, as rodas dos três
   ficam entre 0 e 52 mm do solo (o tandem do Scania flutua 52 mm no próprio
   arquivo) contra o estepe, que fica a mais de 300 mm.

   ===========================================================================
   O CONTRATO COM O ASSET (`models/vehicles/wheel_vm_v1.glb`)

   Assado por `tools/wheel-bake/bake_wheel_vm.py`, e o mesmo do irmão:

     · dois nós: `WHEEL_DUAL` e `WHEEL_SINGLE`;
     · centro do CUBO na origem, eixo em +X, FACE EXTERNA para +X;
     · diâmetro do PNEU exatamente 1,0 — então a escala é o diâmetro medido.

   ⚠️ O ALINHAMENTO É PELA FACE EXTERNA DO PNEU, não pelo centro do grupo. No
   molde o pneu do `WHEEL_SINGLE` termina em x −0,0036 (a calota é que avança
   para fora) e o do `WHEEL_DUAL` em +0,2601. Casar centro com centro deixaria a
   roda nova enterrada ou saltada por essa diferença; casar FACE com FACE não
   depende de onde o cubo caiu dentro do molde. */
import * as THREE from 'three';
import { claimGeometry } from './geometry-share';

/** Nós de roda dos três rígidos. Os três rips herdam o padrão `wheel_<lado>_…`
 *  da mesma fonte, e é a única coisa que eles têm em comum na rodagem. */
const WHEEL_NODE_RE = /^wheel_[fr]_/i;
/** O PNEU dentro deles — por material E por nó, porque o Scania nomeia o
 *  material do pneu de `plastic_hard` e o VW de `trail70_colspec`. */
const TYRE_RE = /tire|pneu/i;
/** O ARO. É ele que localiza o eixo — ver o bloco do cabeçalho. Os três rips
 *  usam `_disc` no nome do nó; nenhum outro nome é comum aos três. */
const RIM_RE = /_disc|_rim|aro/i;
/** O pneu DENTRO do molde: é por ele que a peça é alinhada. */
const ASSET_TYRE_RE = /^pneu-vm$/i;

const DUAL = 'WHEEL_DUAL';
const SINGLE = 'WHEEL_SINGLE';

/** Vértices de ARO a menos disto em z são o mesmo eixo. O aro tem ~0,62 m e o
 *  menor vão entre aros de um tandem, medido nos três, é 0,63 m. */
const AXLE_BAND = 0.35;
/** Um vértice de pneu além disto do eixo mais próximo não é daquele eixo. Um
 *  pneu tem 0,53 m de raio; 0,80 m dá margem e ainda fica abaixo da meia
 *  distância entre eixos (0,627 m no par mais apertado)… */
const TYRE_REACH = 0.80;
/** Acima desta fração do diâmetro do próprio grupo, a roda não toca o chão e
 *  portanto é estepe. Ver o bloco do cabeçalho. */
const GROUND_FRAC = 0.15;
/** Largura acima desta fração do diâmetro = rodado DUPLO. Medido: avulso 0,26…
 *  0,31 de diâmetro, duplo 0,58…0,62. 0,45 fica no meio do vazio. */
const DUAL_FRAC = 0.45;

interface Grupo {
  min: THREE.Vector3;
  max: THREE.Vector3;
  n: number;
}

const materialsOf = (o: THREE.Mesh) =>
  (Array.isArray(o.material) ? o.material : [o.material]).filter(Boolean) as THREE.Material[];

const chain = (o: THREE.Object3D, root: THREE.Object3D) => {
  const parts: string[] = [];
  for (let k: THREE.Object3D | null = o; k && k !== root; k = k.parent) if (k.name) parts.push(k.name);
  return parts.join('/');
};

/** Até onde o PNEU do molde avança para fora do cubo, em diâmetros.
 *
 *  É por este número que a roda nova é alinhada: casar CENTRO com CENTRO
 *  deixaria a peça enterrada ou saltada pela diferença entre onde o cubo caiu
 *  dentro do molde e onde ele cai no caminhão. Ver o bloco do cabeçalho. */
function outreach(mold: THREE.Object3D): number | null {
  let out = -Infinity;
  mold.traverse((node) => {
    const o = node as THREE.Mesh;
    if (!o.isMesh) return;
    if (!materialsOf(o).some((m) => ASSET_TYRE_RE.test(m.name || ''))) return;
    if (!o.geometry.boundingBox) o.geometry.computeBoundingBox();
    const bb = o.geometry.boundingBox;
    if (bb) out = Math.max(out, bb.max.x);
  });
  return Number.isFinite(out) ? out : null;
}

/**
 * O ACABAMENTO DA RODA, no asset e uma vez só.
 *
 * *"os parafusos não estão metálicos como deveriam, nem a parte central, e os
 * pneus estão brilhando muito"* — Kennedy, sobre a dianteira do VM.
 *
 * O rip entrega, medido no `.glb`:
 *
 *   porcas  `white_crome`   metalicidade **0**      rugosidade 0,153
 *   cubo    `front_hub_01`  metalicidade **0**      rugosidade 0,167
 *   pneu    `goodyear_…`    metalicidade 0          rugosidade **0,133**
 *
 * Os dois primeiros são cromados pelo NOME e plástico pelo NÚMERO — e é o
 * número que o renderizador lê. O terceiro é borracha com rugosidade de verniz:
 * 0,133 devolve o céu inteiro num lóbulo apertado, que é o brilho da foto.
 *
 * A referência de aço da frota é `steel_clean` do próprio VM (metalicidade
 * 0,85 / rugosidade 0,20), que é o aro e é o que já lê certo.
 *
 * ===========================================================================
 * ⚠️⚠️ E O `envMapIntensity` DA BORRACHA NÃO SE TOCA — este erro já foi
 * cometido nesta base, e a frase do dono foi a mesma das duas vezes.
 *
 * A primeira versão desta função baixava o ambiente do pneu para 0,30, copiando
 * o que `TRAILER_RUBBER_RE` faz no implemento. O relato veio de volta como
 * *"a roda está muito preta, deve ser levemente acinzentada"* — e em 2026-08-11
 * a MESMA frase já tinha aparecido sobre a roda do FH16: *"o pneu continua
 * muito preto, enquanto o do Volvo é levemente acinzentado"*. O bloco de
 * `FH16_WHEEL_RE` em `models.ts` registra a conclusão daquele dia por extenso:
 *
 *   os dois pneus são O MESMO ASSET e a MESMA textura; o que mudava era o
 *   ambiente, 1,35 no cavalo contra 0,30 no implemento. Num dielétrico o
 *   ambiente é quase toda a luz que ele recebe, então 4,5× menos ambiente é a
 *   diferença entre borracha e SILHUETA PRETA.
 *
 * A regra da borracha do implemento é um remendo para material que MENTE sobre
 * si (uma borracha declarada espelho); aplicá-la a material certo só estraga.
 * O ambiente fica em 1,35, como `setupCommon()` deixa.
 *
 * MEDIDO nas duas texturas, em luminância linear (o mesmo teste do cabeçalho de
 * `bake_wheel.py`): `goodyear_fuelmaxlhs_diffuse` p50 0,0299 contra
 * `trail70_colspec` p50 0,0212 — ou seja a borracha do VM é MAIS CLARA que a do
 * FH16. Ela não é preta por textura; era preta por falta de ambiente.
 *
 * O que sobra do pedido original — *"os pneus estão brilhando muito"* — é a
 * RUGOSIDADE (0,198 no rasto e 0,133 no flanco, com verniz de 0,18 por cima):
 * lóbulo apertado devolvendo o céu inteiro. 0,60 sem verniz dá o brilho largo e
 * fosco de borracha, e com o ambiente inteiro ele continua acinzentado.
 */
export function tuneVmWheelMaterials(asset: THREE.Object3D): string[] {
  const feitos: string[] = [];
  const vistos = new Set<THREE.Material>();
  asset.traverse((node) => {
    const o = node as THREE.Mesh;
    if (!o.isMesh) return;
    for (const raw of materialsOf(o)) {
      if (vistos.has(raw)) continue;
      vistos.add(raw);
      const m = raw as THREE.MeshPhysicalMaterial;
      const nome = m.name || '';
      if (/^pneu-vm/.test(nome)) {
        m.roughness = 0.60;
        m.metalness = 0;
        if (typeof m.clearcoat === 'number') m.clearcoat = 0;
        /* ⚠️ `envMapIntensity` NÃO É TOCADO — ver o bloco acima. */
      } else if (/^roda-porcas-vm$/.test(nome)) {
        m.roughness = 0.22;
        m.metalness = 0.90;
      } else if (/^roda-cubo-vm/.test(nome)) {
        m.roughness = 0.28;
        m.metalness = 0.85;
      } else if (/^roda-disco-vm$/.test(nome)) {
        /* O aro já vem em 0,85/0,20 e é a referência — não se mexe. */
        continue;
      } else {
        continue;
      }
      m.needsUpdate = true;
      feitos.push(`${nome} → m ${m.metalness.toFixed(2)} / r ${m.roughness.toFixed(2)}`);
    }
  });
  return feitos;
}

export interface SwapRodagem {
  /** Quantos conjuntos foram colocados. 0 = nada foi tocado. */
  postas: number;
  /**
   * O diâmetro da roda de DIREÇÃO deste caminhão, em metros — 0 se nenhuma foi
   * trocada.
   *
   * Sai daqui porque é aqui que ele é medido, e quem precisa dele é o ESTEPE:
   * `swapSpareWheel()` roda depois, com a rodagem original já invisível, e não
   * teria mais como medir. É a resposta a *"troque o estepe do scania para usar
   * uma roda / pneu da própria lateral"* — "da própria lateral" é literalmente
   * este número.
   */
  direcao: number;
}

const RODAGEM_NADA: SwapRodagem = { postas: 0, direcao: 0 };

/**
 * Troca a rodagem de um chassi rígido pela roda do VM.
 *
 * `asset` é a raiz já carregada de `wheel_vm.glb`, já passada por
 * `setupCommon()` e por `tuneVmWheelMaterials()`. `postas` 0 significa que nada
 * foi tocado e a rodagem original continua visível — a degradação é sempre
 * "fica como estava".
 */
export function swapTruckWheels(cab: THREE.Object3D, asset: THREE.Object3D): SwapRodagem {
  cab.updateWorldMatrix(true, true);
  asset.updateWorldMatrix(true, true);

  const dual = asset.getObjectByName(DUAL);
  const single = asset.getObjectByName(SINGLE);
  if (!dual || !single) {
    console.warn('[rodas-truck] wheel_vm.glb sem', DUAL, 'ou', SINGLE,
      '— a rodagem original fica.');
    return RODAGEM_NADA;
  }

  const outDual = outreach(dual);
  const outSingle = outreach(single);
  if (outDual === null || outSingle === null) {
    console.warn('[rodas-truck] nenhum material', ASSET_TYRE_RE, 'no asset — a rodagem original fica.');
    return RODAGEM_NADA;
  }

  /* --- 1. junta os VÉRTICES de pneu por (eixo, lado) --- */
  const doomed: THREE.Mesh[] = [];
  const pontos: { x: number; y: number; z: number }[] = [];
  const aros: { z: number }[] = [];
  const v = new THREE.Vector3();
  cab.traverse((node) => {
    const o = node as THREE.Mesh;
    if (!o.isMesh || !o.geometry?.attributes?.position) return;
    const rotulo = chain(o, cab) + '|' + materialsOf(o).map((m) => m.name || '').join('+');
    if (!WHEEL_NODE_RE.test(chain(o, cab).split('/').pop() || '')
      && !WHEEL_NODE_RE.test(o.name)) return;
    doomed.push(o);
    const ehPneu = TYRE_RE.test(rotulo);
    const ehAro = !ehPneu && RIM_RE.test(rotulo);
    if (!ehPneu && !ehAro) return;
    const pos = o.geometry.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < pos.count; i++) {
      v.fromBufferAttribute(pos, i).applyMatrix4(o.matrixWorld);
      if (ehPneu) pontos.push({ x: v.x, y: v.y, z: v.z });
      else aros.push({ z: v.z });
    }
  });
  if (!pontos.length) {
    console.warn('[rodas-truck] nenhum vértice de pneu sob', WHEEL_NODE_RE, '— nada a trocar.');
    return RODAGEM_NADA;
  }

  /* Eixos PELO ARO: passe ordenado em z, cortando onde o vão passa de
     AXLE_BAND. Ver o bloco do cabeçalho — sobre pneu isto não funciona. */
  const zsAro = aros.map((p) => p.z).sort((a, b) => a - b);
  if (!zsAro.length) {
    console.warn('[rodas-truck] nenhum vértice de aro sob', RIM_RE,
      '— sem referência de eixo, a rodagem original fica.');
    return RODAGEM_NADA;
  }
  const centrosZ: number[] = [];
  {
    let ini = 0;
    for (let i = 1; i <= zsAro.length; i++) {
      if (i === zsAro.length || zsAro[i] - zsAro[i - 1] > AXLE_BAND) {
        centrosZ.push((zsAro[ini] + zsAro[i - 1]) / 2);
        ini = i;
      }
    }
  }
  const eixoDe = (z: number) => {
    let melhor = 0, d = Infinity;
    for (let k = 0; k < centrosZ.length; k++) {
      const dk = Math.abs(z - centrosZ[k]);
      if (dk < d) { d = dk; melhor = k; }
    }
    return d <= TYRE_REACH ? melhor : -1;
  };

  const grupos = new Map<string, Grupo>();
  for (const p of pontos) {
    const eixo = eixoDe(p.z);
    if (eixo < 0) continue;                 // pneu longe de qualquer aro: estepe
    const chave = `${eixo}|${p.x >= 0 ? 'D' : 'E'}`;
    let g = grupos.get(chave);
    if (!g) {
      g = { min: new THREE.Vector3(Infinity, Infinity, Infinity),
        max: new THREE.Vector3(-Infinity, -Infinity, -Infinity), n: 0 };
      grupos.set(chave, g);
    }
    g.min.min(v.set(p.x, p.y, p.z));
    g.max.max(v);
    g.n++;
  }

  /* --- 2. O CHÃO É UM SÓ ---
     ⚠️ Os eixos de um rip NÃO CONCORDAM sobre onde é o chão. Medido:

       VW Titan   dianteiro em y +0,0776 · traseiros em −0,0036 e +0,0133
       Scania P   dianteiros em −0,060  · traseiros em −0,009

     ou seja o pneu dianteiro do VW paira **81 mm** acima do plano que os
     traseiros definem, e no Scania são os traseiros que flutuam 52 mm. Foi o
     relato *"a roda da frente do truck não está tocando o chão"* — e o defeito
     é do arquivo, não da troca: a roda velha já flutuava.

     Assentar cada roda no PRÓPRIO mínimo perpetuaria isso. O chão do veículo é
     um plano só, e é o mais baixo dos contatos — o mesmo critério de `groundY`
     em `mounts.json`, que é o que põe o caminhão no piso do cenário. Cada roda
     mantém o SEU diâmetro (0,992 na direção e 1,018 na tração, medidos) e toca
     esse plano. */
  const chao = Math.min(...[...grupos.values()].map((g) => g.min.y));

  /* --- 3. coloca um conjunto por grupo --- */
  const toLocal = new THREE.Matrix4().copy(cab.matrixWorld).invert();
  const fromX = new THREE.Vector3(1, 0, 0);
  const dir = new THREE.Vector3();
  const q = new THREE.Quaternion();
  const at = new THREE.Vector3();
  const world = new THREE.Matrix4();
  const built: THREE.Object3D[] = [];
  const relatos: string[] = [];
  let placed = 0;
  /* O MENOR dos avulsos, e não o primeiro: num bitruck há dois eixos
     direcionais e nada garante que o rip os tenha modelado com o mesmo
     diâmetro. O estepe de um caminhão é uma roda só, e a menor é a que cabe no
     berço de todos. */
  let direcao = 0;

  for (const [chave, g] of [...grupos.entries()].sort()) {
    const largura = g.max.x - g.min.x;
    const diametro = ((g.max.y - g.min.y) + (g.max.z - g.min.z)) / 2;
    /* ⚠️ ESTEPE FORA — ver o bloco do cabeçalho. Também sai qualquer grupo raso
       demais para ser roda: um punhado de vértices soltos de um suporte de roda
       dá caixa minúscula e viraria uma roda de brinquedo. */
    if (g.min.y > diametro * GROUND_FRAC) {
      relatos.push(`${chave}: estepe (fundo a ${(g.min.y * 1000).toFixed(0)} mm do solo) — fica`);
      continue;
    }
    if (diametro < 0.3 || g.n < 200) {
      relatos.push(`${chave}: grupo pequeno demais (Ø ${diametro.toFixed(3)}, ${g.n} vért.) — fica`);
      continue;
    }
    const duplo = largura > diametro * DUAL_FRAC;
    if (!duplo) direcao = direcao ? Math.min(direcao, diametro) : diametro;
    const mold = duplo ? dual : single;
    const reach = duplo ? outDual : outSingle;
    const sign = chave.endsWith('D') ? 1 : -1;

    dir.set(sign, 0, 0);
    q.setFromUnitVectors(fromX, dir);
    /* ⚠️ A COTA VERTICAL SAI DO CONTATO COM O CHÃO, e não do centro da caixa.
       -------------------------------------------------------------------
       O molde é um sólido de revolução perfeito e o pneu do rip não é: medido,
       a caixa dele é mais ALTA que LONGA (o desenho da banda e a deformação do
       contato), e `diametro` é a MÉDIA das duas. Centrando o molde no meio da
       caixa, o raio novo fica menor que a metade da altura antiga e a roda
       nasce ACIMA do chão — foi o relato *"a roda da frente do truck não está
       tocando o chão"*.

       O que tem de coincidir é o ponto de contato, não o centro: assentar em
       `min.y + raio` preserva exatamente onde a roda original toca o solo, e é
       ele que define a altura do caminhão inteiro. A sobra vai para o topo, que
       é onde ninguém mede nada. */
    at.set(0, chao + diametro / 2, (g.min.z + g.max.z) / 2);
    at.x = (sign > 0 ? g.max.x : g.min.x) - sign * reach * diametro;

    const unit = mold.clone(true);
    unit.name = `VM_WHEEL_${duplo ? 'DUAL' : 'SINGLE'}_${chave}`;
    world.compose(at, q, new THREE.Vector3(diametro, diametro, diametro));
    unit.matrixAutoUpdate = false;
    unit.matrix.multiplyMatrices(toLocal, world);
    built.push(unit);
    relatos.push(`${chave}: ${duplo ? 'duplo' : 'avulso'} Ø ${diametro.toFixed(3)} m`
      + ` (alto ${(g.max.y - g.min.y).toFixed(3)} × longo ${(g.max.z - g.min.z).toFixed(3)})`
      + ` · largura ${largura.toFixed(3)} · z ${at.z.toFixed(3)}`
      + (Math.abs(g.min.y - chao) > 0.005
        ? ` · ⤓ descia ${((g.min.y - chao) * 1000).toFixed(0)} mm para tocar o chão` : ''));
    placed++;
  }

  if (!placed) {
    console.warn('[rodas-truck] nenhum grupo virou roda —', relatos.join(' · '));
    return RODAGEM_NADA;
  }
  for (const u of built) cab.add(u);
  /* Só depois de tudo colocado: uma exceção no meio do laço acima deixaria o
     caminhão sem roda nenhuma em vez de com a roda velha. */
  for (const o of doomed) o.visible = false;

  console.info('[rodas-truck] roda do VM em', placed, 'conjuntos ·',
    doomed.length, 'malhas originais ocultas ·', relatos.join(' · '));
  return { postas: placed, direcao };
}

/* ===========================================================================
   O ESTEPE DO SCANIA P — a roda guardada, trocada pela mesma roda da rodagem
   ===========================================================================
   *"troque o estepe do scania para usar uma roda / pneu da propria lateral,
   pois o estepe esta muito diferente"* — Kennedy, 2026-08-22.

   ⚠️ ISTO NÃO É UM CASO DE `swapTruckWheels()`, e não é por descuido. Aquela
   função exclui o estepe DE PROPÓSITO (`GROUND_FRAC`: uma roda de rodagem toca
   o chão, uma peça guardada não), e teria de excluí-lo de qualquer jeito —
   procura sob `^wheel_[fr]_` e o estepe do Scania não mora ali. Ele está dentro
   de `chassis_*`, deitado sob o quadro, com o material de COURO DO INTERIOR.

   Foi justamente a troca da rodagem que criou a queixa: com as seis rodas
   virando alumínio de 10 furos do VM, o estepe ficou sendo a única roda de aço
   chapado preto do caminhão. *"da própria lateral"* é o pedido inteiro — a
   mesma peça, no mesmo diâmetro que `swapTruckWheels()` mediu na direção.

   ===========================================================================
   ⚠️⚠️ POR QUE O RECORTE É POR COMPONENTE CONEXO, E NÃO POR MALHA

   Esconder o estepe não é `visible = false`. Medido no `scania_p_6x2r.glb`, ele
   está repartido em QUATRO malhas e três delas atravessam o caminhão inteiro:

     `chassis_p23`   14 628 faces — o PNEU, e é a malha inteira
     `chassis_p18`   50 418 de 80 719 — o disco do aro
     `chassis_p15`   16 042 de 54 409 — o resto do aro
     `chassis_p22`    2 774 de 51 439 — o anel do aro

   Esconder `chassis_p18` levaria junto meio chassi. E uma CAIXA também não
   serve: o BERÇO que segura o estepe cruza o miolo do aro, e some com ele.

   O que separa um do outro é a topologia. O estepe é um sólido de revolução em
   torno de um eixo, e o berço é uma peça que ENTRA e SAI do cilindro dele.
   Então o critério é: **cai fora o componente conexo que cabe INTEIRO no
   cilindro do estepe**. O berço tem vértice do lado de fora e sobrevive por
   construção; o aro não tem nenhum e morre inteiro.

   Medido com 20 mm de folga, esse critério pega 7 706 componentes e 83 862
   faces — exatamente as quatro malhas acima, e NADA além delas. O berço
   (`chassis_p12`) não aparece na lista, que é o resultado certo.

   ⚠️ E É POR ISSO QUE ESTA FUNÇÃO RODA DEPOIS DE `markShared()`. Ela ESCREVE
   índice dentro da malha do caminhão, e os rips de rígido dividem
   `BufferGeometry` entre malhas (256 nós para 219 malhas no Scania). Sem a
   marca, `claimGeometry()` devolveria o MOLDE e o recorte vazaria para as
   irmãs — o defeito de 3,92 mm que `geometry-share.ts` documenta ter sido pego
   num portão. É a única peça desta troca que precisa dessa ordem, e é a razão
   de ela não morar dentro de `attachVmWheels()`.

   ===========================================================================
   ⚠️ A FACE BONITA FICA PARA BAIXO

   O estepe deitado só é visto de UM ângulo: de baixo, ou de um três-quartos
   rasante. A face de cima está sob o berço e sob o quadro, e ninguém a alcança.
   Então o molde entra com a FACE EXTERNA — a que tem calota, cubo e porcas —
   voltada para o CHÃO. É o que faz o estepe ler como "a roda da própria
   lateral", que foi o pedido; virá-lo poria o lado cego para quem olha. */

/** O material que o rip deu ao PNEU do estepe do Scania — couro de interior,
 *  e é ele o achador. Nome INTEIRO e ancorado: `leather_fine_c` solto casa
 *  também três malhas de banco, e a caixa dos quatro juntos vira o caminhão. */
export const SPARE_TYRE_RE = /^chassis_mat_0015_leather_fine_c_14$/;

/** A família que tem esse estepe. O achador acima é o material, e ele bastaria
 *  — mas sem esta porta os outros 48 caminhões do acervo levariam um aviso de
 *  "não há estepe a trocar" a cada carga, e um aviso que grita sempre deixa de
 *  ser lido. Mesma chave de `cab-bake-fixes.ts`: o ARQUIVO, não o id. */
export const SPARE_SWAP_RE = /scania_p_[468]x[24]r\.glb$/i;

/** Folga do cilindro. 20 mm cobre a ponta da válvula e a quantização do Draco
 *  sem alcançar o berço, que passa a mais de 40 mm do fundo do aro. */
const SPARE_TOL = 0.020;
/** Uma roda guardada tem entre isto de diâmetro. Fora daqui não é estepe. */
const SPARE_D = [0.60, 1.60];
/** …e entre isto de espessura. */
const SPARE_W = [0.15, 0.60];

/**
 * Aresta a aresta: os triângulos que compartilham vértice são a mesma peça.
 *
 * ⚠️ EXPORTADA, e para o mesmo tipo de trabalho: `truck-tanks.ts` precisa da
 * MESMA topologia para achar o BERÇO do ARLA dentro de `chassis_p15`, que é
 * uma malha de caminhão inteiro. Dois union-find no mesmo motor seriam duas
 * chances de divergir.
 *
 * ⚠️ E ELA NÃO SOLDA POR POSIÇÃO. `tools/chassis-bake/glb-surgery.cjs` solda
 * numa grade antes de unir, e por isso a MESMA chapa que aqui sai em 90
 * fragmentos lá sai num componente de 452 faces: o rip parte o vértice em toda
 * quina viva (normal por canto). Quem usar isto para SELECIONAR peça tem de
 * sobreviver a essa fragmentação — o estepe sobrevive porque o critério dele é
 * "não sobra vértice fora do cilindro", e o berço do ARLA porque o dele é
 * "passa do teto de flanco". Um critério do tipo "a peça inteira cabe na
 * região" seria falso aqui, e é a armadilha que este parágrafo existe para
 * marcar.
 */
/** A grade da solda — 0,5 mm, a MESMA de `tools/chassis-bake/glb-surgery.cjs`.
 *  Duas grades diferentes dariam duas listas de peças diferentes para a mesma
 *  malha, e o motor e a cirurgia deixariam de falar do mesmo caminhão. */
export const SOLDA = 5e-4;

/**
 * ▶▶▶ …E A MESMA CONTA, SOLDANDO VÉRTICE POR POSIÇÃO.
 *
 * *"ficou dois conjuntos de peças separadas … garanta que não irá mover
 * novamente componentes que são um conjunto separadamente"* — Kennedy,
 * 2026-08-25.
 *
 * O parágrafo acima marcava a armadilha; esta função é a saída dela. Quem
 * precisa SELECIONAR uma peça inteira ("o berço do estepe", "o conjunto que
 * anda") não pode usar a conta crua: o rip parte o vértice em toda quina viva e
 * uma chapa sai em dezenas de tiras, das quais um filtro qualquer aceita umas e
 * recusa outras — que é, literalmente, mover metade de uma peça.
 *
 * ⚠️ E A DIFERENÇA É POR ARQUIVO, o que faz dela uma armadilha silenciosa. O
 * `scania_p_8x2r.glb` é o RIP; `_6x2r`, `_4x2r` e `_6x4r` saem dele por
 * `cut-scania.cjs`, que reescreve a malha e passa por Draco — **e o Draco
 * deduplica vértice**. Medido na vizinhança do estepe:
 *
 *     toco (4x2, recorte)    464 componentes crus →  20 soldados
 *     bitruck (8x2, rip)   1 279 componentes crus →  52 soldados
 *
 * Ou seja: o mesmo código, com a mesma régua, via UM tirante no toco e TRINTA E
 * DUAS tiras de tirante no bitruck. O conjunto andava inteiro num e partido no
 * outro, e a foto acusava só o bitruck.
 *
 * `px` são as posições JÁ NO ESPAÇO EM QUE SE QUER MEDIR (x,y,z por vértice) —
 * soldar em espaço local seria soldar numa grade que a escala do nó estica.
 */
export function componentesSoldados(
  px: Float32Array, idx: THREE.BufferAttribute, nVert: number, grade = SOLDA,
): Int32Array {
  let x0 = Infinity, y0 = Infinity, z0 = Infinity;
  let x1 = -Infinity, y1 = -Infinity, z1 = -Infinity;
  for (let v = 0; v < nVert; v++) {
    const x = px[v * 3], y = px[v * 3 + 1], z = px[v * 3 + 2];
    if (x < x0) x0 = x; if (x > x1) x1 = x;
    if (y < y0) y0 = y; if (y > y1) y1 = y;
    if (z < z0) z0 = z; if (z > z1) z1 = z;
  }
  /* A chave é NUMÉRICA (um `Map` de strings sobre centenas de milhares de
     vértices custa centenas de MB), e por isso a grade tem de caber em
     `Number.MAX_SAFE_INTEGER`. Uma malha absurdamente grande afrouxa a grade em
     vez de colidir em silêncio — colisão de chave solda peças que não se
     tocam, que é o defeito oposto e pior. */
  let g = grade, nx = 0, ny = 0, nz = 0;
  for (;;) {
    nx = Math.floor((x1 - x0) / g) + 2;
    ny = Math.floor((y1 - y0) / g) + 2;
    nz = Math.floor((z1 - z0) / g) + 2;
    if (nx * ny * nz <= Number.MAX_SAFE_INTEGER) break;
    g *= 2;
  }
  const celula = new Map<number, number>();
  const rep = new Int32Array(nVert);
  for (let v = 0; v < nVert; v++) {
    const ix = Math.round((px[v * 3] - x0) / g);
    const iy = Math.round((px[v * 3 + 1] - y0) / g);
    const iz = Math.round((px[v * 3 + 2] - z0) / g);
    const k = (ix * ny + iy) * nz + iz;
    const r = celula.get(k);
    if (r === undefined) { celula.set(k, v); rep[v] = v; } else rep[v] = r;
  }
  const pai = new Int32Array(rep);
  const acha = (i: number): number => {
    let r = i;
    while (pai[r] !== r) r = pai[r];
    while (pai[i] !== r) { const n = pai[i]; pai[i] = r; i = n; }
    return r;
  };
  const une = (a: number, b: number) => {
    const ra = acha(a), rb = acha(b);
    if (ra !== rb) pai[ra] = rb;
  };
  for (let q = 0; q < idx.count; q += 3) {
    une(rep[idx.getX(q)], rep[idx.getX(q + 1)]);
    une(rep[idx.getX(q + 1)], rep[idx.getX(q + 2)]);
  }
  const saida = new Int32Array(nVert);
  for (let v = 0; v < nVert; v++) saida[v] = acha(rep[v]);
  return saida;
}

export function componentes(idx: THREE.BufferAttribute, nVert: number): Int32Array {
  const pai = new Int32Array(nVert);
  for (let i = 0; i < nVert; i++) pai[i] = i;
  const acha = (i: number): number => {
    let r = i;
    while (pai[r] !== r) r = pai[r];
    while (pai[i] !== r) { const n = pai[i]; pai[i] = r; i = n; }
    return r;
  };
  const une = (a: number, b: number) => {
    const ra = acha(a), rb = acha(b);
    if (ra !== rb) pai[ra] = rb;
  };
  for (let q = 0; q < idx.count; q += 3) {
    une(idx.getX(q), idx.getX(q + 1));
    une(idx.getX(q + 1), idx.getX(q + 2));
  }
  for (let i = 0; i < nVert; i++) pai[i] = acha(i);
  return pai;
}

/**
 * Troca o estepe deitado de um chassi rígido pela roda avulsa do VM.
 *
 * `asset` é a mesma raiz de `wheel_vm_v1.glb` que `swapTruckWheels()` usou —
 * ela NÃO é descartada no caminho feliz, porque o clone compartilha geometria
 * e material com ela. `diametro` é o da roda de direção (`SwapRodagem.direcao`);
 * 0 manda usar o diâmetro do próprio estepe.
 *
 * Devolve as linhas do relatório. Vazio significa que nada foi tocado e o
 * estepe original continua lá — a degradação é sempre "fica como estava".
 */
export function swapSpareWheel(
  cab: THREE.Object3D, asset: THREE.Object3D, diametro: number,
): string[] {
  const single = asset.getObjectByName(SINGLE);
  const reach = single ? outreach(single) : null;
  if (!single || reach === null) {
    return [`⚠ wheel_vm_v1.glb sem ${SINGLE} utilizável — o estepe original fica.`];
  }
  cab.updateWorldMatrix(true, true);

  /* --- 1. onde ele está, pelo material do PNEU --- */
  const toLocal = new THREE.Matrix4().copy(cab.matrixWorld).invert();
  const L2C = new THREE.Matrix4();
  const v = new THREE.Vector3();
  const caixa = new THREE.Box3();
  let nPneu = 0;
  cab.traverse((node) => {
    const o = node as THREE.Mesh;
    if (!o.isMesh) return;
    if (!materialsOf(o).some((m) => SPARE_TYRE_RE.test(m.name || ''))) return;
    const pos = o.geometry?.getAttribute('position') as THREE.BufferAttribute | undefined;
    if (!pos) return;
    L2C.multiplyMatrices(toLocal, o.matrixWorld);
    for (let i = 0; i < pos.count; i++) {
      caixa.expandByPoint(v.fromBufferAttribute(pos, i).applyMatrix4(L2C));
      nPneu++;
    }
  });
  if (caixa.isEmpty()) {
    return [`⚠ nenhuma malha com material ${SPARE_TYRE_RE} — não há estepe a trocar.`];
  }

  /* O EIXO É O LADO MAIS CURTO DA CAIXA. Um pneu é um sólido de revolução: os
     dois eixos radiais dão o diâmetro e o terceiro dá a largura, que numa roda
     de caminhão é sempre a menor das três. Isso vale com a roda deitada (o caso
     do Scania) e valeria de pé, sem tabela de orientação. */
  const dim = caixa.getSize(new THREE.Vector3());
  const centro = caixa.getCenter(new THREE.Vector3());
  const k = dim.x <= dim.y && dim.x <= dim.z ? 0 : (dim.y <= dim.z ? 1 : 2);
  const eixo = new THREE.Vector3(k === 0 ? 1 : 0, k === 1 ? 1 : 0, k === 2 ? 1 : 0);
  const meia = dim.getComponent(k) / 2;
  const raio = Math.max(...[0, 1, 2].filter((j) => j !== k).map((j) => dim.getComponent(j))) / 2;
  if (2 * raio < SPARE_D[0] || 2 * raio > SPARE_D[1]
    || 2 * meia < SPARE_W[0] || 2 * meia > SPARE_W[1]) {
    return [`⚠ a peça com ${SPARE_TYRE_RE} mede Ø ${(2 * raio).toFixed(3)} × `
      + `${(2 * meia).toFixed(3)} m — não é um estepe. Fica como está.`];
  }

  /* --- 2. o RECORTE, por componente conexo dentro do cilindro --- */
  const dentro = (p: THREE.Vector3) => {
    const d = p.clone().sub(centro);
    const a = d.dot(eixo);
    if (Math.abs(a) > meia + SPARE_TOL) return false;
    return d.addScaledVector(eixo, -a).lengthSq() <= (raio + SPARE_TOL) ** 2;
  };
  const aabb = new THREE.Box3(
    centro.clone().addScalar(-(raio + SPARE_TOL)),
    centro.clone().addScalar(raio + SPARE_TOL));
  const alvos: THREE.Mesh[] = [];
  cab.traverse((node) => {
    const o = node as THREE.Mesh;
    if (!o.isMesh || !o.visible || !o.geometry) return;
    if (!o.geometry.boundingBox) o.geometry.computeBoundingBox();
    const bb = o.geometry.boundingBox;
    if (!bb) return;
    const mundo = bb.clone().applyMatrix4(L2C.multiplyMatrices(toLocal, o.matrixWorld));
    if (mundo.intersectsBox(aabb)) alvos.push(o);
  });

  let ocultas = 0, recortadas = 0, triangulos = 0;
  for (const o of alvos) {
    const pos = o.geometry.getAttribute('position') as THREE.BufferAttribute | undefined;
    const idx = o.geometry.getIndex();
    if (!pos || !idx) continue;
    L2C.multiplyMatrices(toLocal, o.matrixWorld);
    const cabe = new Uint8Array(pos.count);
    let algum = false;
    for (let i = 0; i < pos.count; i++) {
      const ok = dentro(v.fromBufferAttribute(pos, i).applyMatrix4(L2C));
      cabe[i] = ok ? 1 : 0;
      if (ok) algum = true;
    }
    if (!algum) continue;
    const pai = componentes(idx, pos.count);
    /* Um componente morre só se NENHUM vértice dele saiu do cilindro. */
    const vivo = new Uint8Array(pos.count);      // por RAIZ de componente
    for (let i = 0; i < pos.count; i++) if (!cabe[i]) vivo[pai[i]] = 1;
    let morrem = 0, ficam = 0;
    const nTri = idx.count / 3;
    for (let q = 0; q < nTri; q++) {
      if (vivo[pai[idx.getX(q * 3)]]) ficam++; else morrem++;
    }
    if (!morrem) continue;
    if (!ficam) {
      /* A malha INTEIRA é o estepe (o pneu do Scania é assim): esconder custa
         zero e não encosta em geometria compartilhada. */
      o.visible = false;
      ocultas++;
      triangulos += morrem;
      continue;
    }
    const geo = claimGeometry(o);
    const gidx = geo.getIndex();
    if (!gidx) continue;
    const Arr = pos.count > 65535 ? Uint32Array : Uint16Array;
    const novo = new Arr(ficam * 3);
    let w = 0;
    for (let q = 0; q < nTri; q++) {
      const a = gidx.getX(q * 3);
      if (!vivo[pai[a]]) continue;
      novo[w++] = a;
      novo[w++] = gidx.getX(q * 3 + 1);
      novo[w++] = gidx.getX(q * 3 + 2);
    }
    geo.setIndex(new THREE.BufferAttribute(novo, 1));
    geo.computeBoundingBox();
    geo.computeBoundingSphere();
    recortadas++;
    triangulos += morrem;
  }
  if (!triangulos) {
    return [`⚠ o cilindro do estepe não isolou nenhuma peça — nada foi tocado.`];
  }

  /* --- 3. a roda nova, deitada e com a face bonita para baixo --- */
  const d = diametro > 0 ? diametro : 2 * raio;
  /* A face EXTERNA aponta para BAIXO — ver o bloco do cabeçalho. Com a roda de
     pé (nenhum rígido do acervo a guarda assim, mas o critério não custa) o
     "para baixo" não existe e o que resta é apontar para FORA do caminhão. */
  const fora = new THREE.Vector3();
  if (Math.abs(eixo.y) > 0.5) fora.set(0, -1, 0);
  else fora.copy(eixo).multiplyScalar(Math.sign(centro.dot(eixo)) || 1);
  const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(1, 0, 0), fora);
  /* Casa FACE COM FACE, e não centro com centro: no molde o pneu do avulso
     termina 3,6 mm ANTES do plano do cubo (a calota é que avança), e alinhar
     centros deslocaria a roda por essa sobra. Mesma regra de `swapTruckWheels()`. */
  const at = centro.clone().addScaledVector(fora, meia - reach * d);
  const unit = single.clone(true);
  unit.name = 'VM_WHEEL_SPARE';
  unit.matrixAutoUpdate = false;
  unit.matrix.compose(at, q, new THREE.Vector3(d, d, d));
  cab.add(unit);

  return [`estepe trocado · Ø ${d.toFixed(3)} m`
    + (diametro > 0 ? ' (o da direção)' : ' (o do próprio estepe — direção não medida)')
    + ` · eixo ${'xyz'[k]} · centro (${centro.x.toFixed(3)}, ${centro.y.toFixed(3)},`
    + ` ${centro.z.toFixed(3)}) · original Ø ${(2 * raio).toFixed(3)} × ${(2 * meia).toFixed(3)}`
    + ` · ${triangulos} triângulos fora em ${ocultas} malha(s) oculta(s)`
    + ` e ${recortadas} recortada(s) · ${nPneu} vértices de pneu acharam a peça`];
}
