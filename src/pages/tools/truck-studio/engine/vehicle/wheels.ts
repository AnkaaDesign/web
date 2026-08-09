/* A RODAGEM DO IMPLEMENTO — trocada pela roda do Volvo FH16.
   ===========================================================================
   POR QUE A RODA ORIGINAL NÃO SERVE, E QUAL METADE DELA É O PROBLEMA

   Medido no `trailer.glb`: a rodagem são 14 nós reusando a mesma malha —
   `pneu-corpo` com 44 593 vértices, `pneu-lateral` com 2 240 e `aro-rodas` com
   18 948, o que dá ~920 k vértices, quase um quinto do arquivo.

   É O PNEU, e não o aro. Uma primeira versão deste cabeçalho afirmava o
   contrário — que o aro era a mancha, porque `aro-rodas` não declara textura
   nenhuma e a malha nem traz TEXCOORD_0. A afirmação foi feita lendo o
   manifesto, e o render a desmentiu: o aro original renderiza como uma roda de
   aço branca perfeitamente aceitável. O que salta aos olhos é a BORRACHA.

   Medido no mapa de cor-base de `pneu-corpo` (1024², e só 13 KB — o tamanho já
   contava a história), em luminância linear:

       p10 0,012 · p50 0,741 · p90 0,741 · 16,3 % dos pixels abaixo de 0,02

   Ou seja: um histograma de dois valores. Os 16,3 % em preto quase puro SÃO a
   ilha de UV do pneu — uma mancha chapada, sem banda de rodagem, sem desenho de
   flanco; o 0,741 é fundo de UV que ninguém amostra. Contra o `trail70_colspec`
   do FH16, no mesmo teste:

       p10 0,083 · p50 0,157 · p90 0,204 · 0,0 % abaixo de 0,02

   uma distribuição de verdade em torno de 0,16 linear (≈ sRGB 0,44), com
   contraste de banda. É exatamente o relato — "o pneu original está muito
   preto, o do FH16 menos preto, mais real" — e a diferença está no ASSET, não
   na iluminação nem no acabamento.

   O FH16 traz disco, cubo, porcas e pneu como QUATRO peças, cada uma com cor e
   normal próprios. É essa roda que este módulo põe no lugar. O ganho de
   desempenho — 920 k vértices viram 8 cópias de ~5,6 k — é consequência, não
   motivo.

   O CONTRATO COM O ASSET (`models/vehicles/wheel_fh16.glb`)
   ---------------------------------------------------------------------------
   O asset é assado por `tools/wheel-bake/bake_wheel.py` (Blender headless) a
   partir do `volvo_fh16_2012_4x2.glb`, e sai NORMALIZADO — é o que permite a
   este arquivo não saber nada sobre a geometria dele:

     · dois nós: `WHEEL_DUAL` (conjunto traseiro, rodado duplo) e `WHEEL_SINGLE`
       (conjunto dianteiro, roda avulsa);
     · centro do cubo na ORIGEM, eixo de rotação em +X, FACE EXTERNA para +X;
     · diâmetro do pneu exatamente 1,0.

   Assim a escala é o diâmetro medido no implemento, e a orientação sai de um
   `setFromUnitVectors` — nada aqui é constante mágica.

   POR QUE MEDIR EM VEZ DE LER O NOME DO NÓ
   ---------------------------------------------------------------------------
   Os nós do implemento se chamam `pneu-01`…`pneu-12` e `pneu-estepe-01/02`, e
   seria tentador ler a numeração. Mas a mesma pasta já ensinou que nome de nó
   deste bake mente (ver trailer-assembly.ts, "7 casos"), e a numeração não diz
   nem o lado nem o par do rodado duplo. O que este módulo lê são três fatos
   geométricos, todos medidos POR VÉRTICE:

     eixo       = a direção de MENOR extensão da roda. Um pneu é sólido de
                  revolução: 1,072 m nos dois eixos radiais contra 0,343 m no
                  axial. Nas 12 de rodagem isso dá X; nos 2 estepes, que ficam
                  DEITADOS sob o chassi, dá Y — e é só por isso que eles se
                  orientam sozinhos.
     diâmetro   = a média das duas extensões radiais.
     rodado     = duas rodas no mesmo Z e do mesmo lado são um par. Medido:
                  3 eixos em z −4,778 / −3,525 / −2,274, quatro pneus cada, em
                  x ±1,11 e ±0,77 (o par se toca: 2 × 343 mm = 686 contra os
                  680 mm de vão).

   Por vértice, e não por `Box3.setFromObject`: os nós de roda deste bake TÊM
   rotação própria, e a caixa de uma caixa girada é estritamente maior que a
   real — as mesmas medidas saem de 1,072 a 1,522 m de "diâmetro" se lidas
   assim. É a armadilha que trailer-rig.ts documenta no topo.

   AS ORIGINAIS SÃO ESCONDIDAS, NUNCA APAGADAS
   ---------------------------------------------------------------------------
   `runningTyres()` e `groundAndCenter()` em models.ts e `measureTyres()` em
   trailer-rig.ts acham os pneus por MATERIAL (`/pneu|tire/i`) e é deles que
   saem o plano de contato, o vão do bogie e, por consequência, a inclinação do
   engate. Nenhum dos três testa `.visible`. Deixar as malhas vivas e invisíveis
   mantém o engate lendo exatamente a geometria em que foi calibrado — a roda
   nova tem o mesmo diâmetro e o mesmo lugar, mas "mesmo" aqui é ±2 %, e 2 % de
   1,07 m são 21 mm de altura de prato. Esconder também tira as originais do
   passe de sombra e do de cor: malha invisível não é desenhada em nenhum dos
   dois. */
import * as THREE from 'three';

/** Malhas de roda do implemento, por MATERIAL — nome de nó não é confiável. */
const TRAILER_TYRE_RE = /^pneu-(corpo|lateral)$/i;
const TRAILER_RIM_RE = /^aro-rodas$/i;
/** O pneu DENTRO do asset: é por ele que a peça é alinhada, não pelo cubo. */
const ASSET_TYRE_RE = /^pneu-fh16$/i;

/** Nós do asset. */
const DUAL = 'WHEEL_DUAL';
const SINGLE = 'WHEEL_SINGLE';

/** Duas rodas dentro desta distância em Z são o mesmo eixo. O passo entre eixos
 *  medido é 1,25 m e o desalinhamento dentro de um eixo não passa de 4 mm. */
const AXLE_BAND = 0.10;

interface Wheel {
  mesh: THREE.Mesh;
  min: THREE.Vector3;
  max: THREE.Vector3;
  centre: THREE.Vector3;
  /** 0 = x, 1 = y, 2 = z — a direção de MENOR extensão. */
  axis: 0 | 1 | 2;
  diameter: number;
}

const AXES = ['x', 'y', 'z'] as const;

/** Caixa em MUNDO, medida vértice a vértice. Ver a nota do cabeçalho. */
function worldBox(mesh: THREE.Mesh): { min: THREE.Vector3; max: THREE.Vector3 } | null {
  const pos = mesh.geometry?.getAttribute('position') as THREE.BufferAttribute | undefined;
  if (!pos) return null;
  const min = new THREE.Vector3(Infinity, Infinity, Infinity);
  const max = new THREE.Vector3(-Infinity, -Infinity, -Infinity);
  const v = new THREE.Vector3();
  const m = mesh.matrixWorld;
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i).applyMatrix4(m);
    min.min(v);
    max.max(v);
  }
  return Number.isFinite(min.x) ? { min, max } : null;
}

function measure(mesh: THREE.Mesh): Wheel | null {
  const b = worldBox(mesh);
  if (!b) return null;
  const d = [b.max.x - b.min.x, b.max.y - b.min.y, b.max.z - b.min.z];
  let axis: 0 | 1 | 2 = 0;
  for (let k = 1; k < 3; k++) if (d[k] < d[axis]) axis = k as 0 | 1 | 2;
  const radial = [0, 1, 2].filter((k) => k !== axis);
  return {
    mesh,
    min: b.min,
    max: b.max,
    centre: b.min.clone().add(b.max).multiplyScalar(0.5),
    axis,
    diameter: (d[radial[0]] + d[radial[1]]) / 2,
  };
}

const materialsOf = (o: THREE.Mesh) =>
  (Array.isArray(o.material) ? o.material : [o.material]).filter(Boolean) as THREE.Material[];

const hasMaterial = (o: THREE.Mesh, re: RegExp) =>
  materialsOf(o).some((m) => re.test(m.name || ''));

/**
 * Troca a rodagem do implemento pela roda do FH16.
 *
 * `asset` é a raiz já carregada de `wheel_fh16.glb`, já passada por
 * `setupCommon()`. Devolve quantos conjuntos foram colocados; 0 significa que
 * nada foi tocado e a roda original continua visível — a degradação é sempre
 * "fica como estava", nunca "fica sem roda".
 */
export function swapTrailerWheels(trailer: THREE.Object3D, asset: THREE.Object3D): number {
  trailer.updateWorldMatrix(true, true);
  asset.updateWorldMatrix(true, true);

  /* --- 1. o asset: os dois moldes e a extensão do pneu dentro deles --- */
  const dual = asset.getObjectByName(DUAL);
  const single = asset.getObjectByName(SINGLE);
  if (!dual || !single) {
    console.warn('[rodas] wheel_fh16.glb sem', DUAL, 'ou', SINGLE,
      '— a rodagem original fica.');
    return 0;
  }

  /** Até onde o PNEU do molde avança para fora do cubo, em unidades de diâmetro.
   *  É o número que alinha a face externa da roda nova com a da original. */
  const outreach = (mold: THREE.Object3D): number | null => {
    let out = -Infinity;
    mold.traverse((node) => {
      const o = node as THREE.Mesh;
      if (!o.isMesh || !hasMaterial(o, ASSET_TYRE_RE)) return;
      if (!o.geometry.boundingBox) o.geometry.computeBoundingBox();
      const bb = o.geometry.boundingBox;
      if (bb) out = Math.max(out, bb.max.x);
    });
    return Number.isFinite(out) ? out : null;
  };
  const outDual = outreach(dual);
  const outSingle = outreach(single);
  if (outDual === null || outSingle === null) {
    console.warn('[rodas] nenhum material', ASSET_TYRE_RE, 'no asset —',
      'sem referência de alinhamento, a rodagem original fica.');
    return 0;
  }

  /* --- 2. o implemento: mede as rodas e junta os pares --- */
  const tyres: Wheel[] = [];
  const doomed: THREE.Mesh[] = [];
  trailer.traverse((node) => {
    const o = node as THREE.Mesh;
    if (!o.isMesh) return;
    const isTyre = hasMaterial(o, TRAILER_TYRE_RE);
    if (!isTyre && !hasMaterial(o, TRAILER_RIM_RE)) return;
    doomed.push(o);
    /* Só o CORPO do pneu vira medida: o flanco (`pneu-lateral`) e o aro são
       cascas menores sobre a mesma roda e entrariam como rodas fantasma. */
    if (isTyre && hasMaterial(o, /^pneu-corpo$/i)) {
      const w = measure(o);
      if (w) tyres.push(w);
    }
  });
  if (!tyres.length) {
    console.warn('[rodas] nenhum `pneu-corpo` no implemento — nada a trocar.');
    return 0;
  }

  /* Par de rodado duplo = mesmo eixo (Z a menos de AXLE_BAND) e mesmo lado. */
  const groups: Wheel[][] = [];
  for (const w of tyres) {
    const side = Math.sign(w.centre.x) || 1;
    const hit = groups.find((g) =>
      g[0].axis === w.axis
      && Math.abs(g[0].centre.z - w.centre.z) < AXLE_BAND
      && (Math.sign(g[0].centre.x) || 1) === side);
    if (hit) hit.push(w);
    else groups.push([w]);
  }

  /* --- 3. coloca um conjunto por grupo --- */
  const toLocal = new THREE.Matrix4().copy(trailer.matrixWorld).invert();
  const fromX = new THREE.Vector3(1, 0, 0);
  const dir = new THREE.Vector3();
  const q = new THREE.Quaternion();
  const at = new THREE.Vector3();
  const world = new THREE.Matrix4();
  const built: THREE.Object3D[] = [];
  let placed = 0;

  for (const g of groups) {
    const axis = g[0].axis;
    const key = AXES[axis];
    const mold = g.length >= 2 ? dual : single;
    const reach = g.length >= 2 ? outDual : outSingle;

    /* Caixa do grupo inteiro: num rodado duplo a face externa é a do pneu de
       fora, e é ela que tem de coincidir. */
    const min = g[0].min.clone();
    const max = g[0].max.clone();
    for (const w of g) { min.min(w.min); max.max(w.max); }
    const diameter = g.reduce((s, w) => s + w.diameter, 0) / g.length;

    /* Para onde a face externa olha. Em X é o lado do veículo; nos estepes, que
       ficam deitados, é para BAIXO — é a face que se vê de fora, e a de cima
       encosta no chassi. */
    const sign = axis === 0 ? (Math.sign((min[key] + max[key]) / 2) || 1) : -1;
    dir.set(0, 0, 0);
    dir[key] = sign;
    q.setFromUnitVectors(fromX, dir);

    /* Centro do conjunto nos dois eixos RADIAIS, e no axial o cubo recuado da
       face externa pelo avanço do pneu do molde. */
    at.copy(min).add(max).multiplyScalar(0.5);
    at[key] = (sign > 0 ? max[key] : min[key]) - sign * reach * diameter;

    const unit = mold.clone(true);
    unit.name = `FH16_WHEEL_${g.length >= 2 ? 'DUAL' : 'SINGLE'}_${placed}`;
    world.compose(at, q, new THREE.Vector3(diameter, diameter, diameter));
    unit.matrixAutoUpdate = false;
    unit.matrix.multiplyMatrices(toLocal, world);
    built.push(unit);
    placed++;
  }

  if (!placed) return 0;
  for (const u of built) trailer.add(u);
  /* Só depois de tudo colocado: uma exceção no meio do laço acima deixaria o
     implemento sem roda nenhuma em vez de com a roda velha. */
  for (const o of doomed) o.visible = false;

  const sizes = groups.map((g) => g.length);
  console.info('[rodas] FH16 em', placed, 'conjuntos',
    `(${sizes.filter((n) => n >= 2).length} duplos + ${sizes.filter((n) => n < 2).length} avulsos)`,
    '· Ø', (groups[0].reduce((s, w) => s + w.diameter, 0) / groups[0].length).toFixed(3), 'm',
    '·', doomed.length, 'malhas originais ocultas');
  return placed;
}
