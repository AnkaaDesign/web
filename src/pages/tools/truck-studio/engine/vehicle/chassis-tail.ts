/* O RABO DO QUADRO — o balanço traseiro do rígido segue o comprimento do baú.
   ===========================================================================

   O DEFEITO QUE ISTO CONSERTA
   ---------------------------------------------------------------------------
   O baú do sobrechassi redimensiona; a longarina do caminhão não. Com o
   gancheiro de fábrica (8,510 m de corpo branco) a traseira do baú já cai
   **313 mm atrás** do para-choque no Volvo VM — a carroceria passa da ponta do
   quadro — e **247 mm / 740 mm à frente** dele no VW e no Scania, deixando
   quadro nu à mostra. Alongue o baú e o desencontro cresce sem teto.

   E não existe um comprimento de baú que sirva aos três: o comprimento em que
   o desencontro é zero mede **8,196 m no VM, 8,742 no VW e 9,250 no Scania** —
   1,054 m de espalhamento. Isso é a prova aritmética de que **quem tem de
   seguir a medida é o QUADRO**, e não o contrário.

   POR QUE ESTICAR É LEGÍTIMO AQUI, E NÃO UM TRUQUE
   ---------------------------------------------------------------------------
   Medido nos três rips (`tools/trailer-bench/tailprobe.cjs`), a longarina é
   uma **componente conexa própria** e uma **extrusão com pouquíssimas seções**:
   o maior vão SEM geometria intermediária mede 4 111 mm no VM, 9 206 mm no
   Scania e 2 198 mm no VW. No trecho que interessa não há vértice nenhum — são
   quads longas ligando duas seções distantes, e transladar os vértices de uma
   das pontas é exatamente o que a peça real faz quando é cortada e reemendada.

   E **não há furo nem alívio periódico na alma**: o Scania tem ZERO arestas de
   borda no perfil (sólido fechado) e o VW tem 48 triângulos por lado, que não
   comportam um furo. Se houvesse furo, esticar deformaria a fileira e a
   resposta certa seria ladrilhar; não há, então é esticar.

   Isso vale inclusive para o VW, cujo GLB **não tem nó de chassi** (cabine e
   quadro estão fundidos em `truck_p4`/`truck_p5`, de ponta a ponta). A seleção
   aqui não é por nome de nó nem por malha — é por **Z de vértice contra um
   plano de corte medido** —, então a fusão do rip não atrapalha.

   O PLANO DE CORTE
   ---------------------------------------------------------------------------
   `mounts.json` traz, por caminhão, o bloco `tail` com `cutZ` e as `bays`. Um
   plano só entra ali se **nenhuma peça não-longarina o cruza com vértice a
   menos de 100 mm dele** — ou seja, tudo que o atravessa é prismático e
   acompanha a translação sem artefato. Está medido que nenhuma travessa, berço
   de eixo, tanque, roda, estepe ou parte da cabine cruza qualquer um deles.

   ⚠️ A TRANSLAÇÃO NÃO É SÓ EM Z. A mesa da longarina é uma reta INCLINADA
   (`frameSlope`, −27,6 / −8,8 / −15,9 mm/m), e transladar o rabo só em Z o tira
   dessa reta: no VM, 8,7 mm baixos num alongamento de 314 mm. O deslocamento
   certo é `dy = frameSlope · dz`, e com ele **`frameTopY` e `frameSlope`
   continuam válidos depois do alongamento, sem re-medição** — o que é a razão
   de esta função não precisar avisar ninguém que mexeu no chassi.

   ⚠️ A BASE É PRISTINA, NUNCA A POSE ANTERIOR. Mesma doutrina de `piece.base`
   em `trailer-assembly.ts` e de `placeThermoKing()`: todo `stretchRigidFrame()`
   parte da cópia guardada na primeira chamada e REESCREVE, nunca soma um delta.
   Sem isso, arrastar o controle de comprimento acumularia o erro de cada
   quadro — e este é chamado de dentro de `placeTrailer()`, que roda em todo
   resize.

   ⚠️ O ESPAÇO É O NORMALIZADO DE `mounts.json`, E NÃO O MUNDO. `placeTrailer()`
   chama esta função ANTES de `applyRootPose()`, então a pose da raiz no
   instante da chamada é a anterior — medir em mundo leria o caminhão no lugar
   velho. A conversão sai do próprio manifesto (`orientYaw`, `centerX`,
   `groundY`) e por isso o resultado não depende de onde o caminhão está.
*/
import * as THREE from 'three';
import type { RigidMount } from './mounting';
import { claimGeometry } from './geometry-share';

/**
 * Folga que sobra numa baia quando ela é consumida até o fim.
 *
 * A capacidade medida é o AR entre a peça de trás e a de frente; gastá-la
 * inteira faz as duas se tocarem exatamente, e "exatamente" numa malha de rip é
 * z-fighting. 20 mm é menor que qualquer folga real de montagem e maior que o
 * ruído de medida da sonda (5 mm de passo).
 */
const BAY_MARGIN = 0.02;

/** Abaixo disto o deslocamento não vale a escrita — e vale evitá-la, porque
 *  `placeTrailer()` roda a cada quadro de um arrasto de medida. */
const MIN_SHIFT = 5e-4;

/** O que guardamos por malha na primeira chamada. Só os vértices AFETADOS: o
 *  `truck_p4` do VW tem 392 282 vértices e quase nenhum deles é rabo. */
interface TailBase {
  /** Índices dos vértices atrás do plano de corte mais DIANTEIRO. */
  idx: Int32Array;
  /** As posições LOCAIS pristinas desses vértices, em tripla. */
  base: Float32Array;
}

interface WithTailBase extends THREE.Mesh {
  userData: { tsTailBase?: TailBase } & Record<string, unknown>;
}

/**
 * Quanto cada baia contribui, da traseira para a frente, para um `deltaZ`.
 *
 * `deltaZ < 0` ALONGA: o rabo anda para −Z e a quad da longarina cresce. Não
 * consome baia nenhuma e não tem limite geométrico — o limite dele é legal
 * (balanço traseiro ≤ 60 % dos eixos extremos e ≤ 3,50 m, CONTRAN 882/2021), e
 * quem o aplica é a interface, não este arquivo.
 *
 * `deltaZ > 0` ENCURTA: consome baia por baia, cada uma até `cap − margem`. Ao
 * esgotar, o resto é DEVOLVIDO ao chamador em vez de ser aplicado — deixar uma
 * peça atravessar a vizinha é pior que um para-choque desalinhado, e quem
 * chama tem como dizer isso na tela.
 */
function repartir(bays: { z: number; cap: number }[], deltaZ: number): number[] {
  const t = bays.map(() => 0);
  if (!bays.length) return t;
  if (deltaZ <= 0) { t[0] = deltaZ; return t; }
  let resto = deltaZ;
  for (let i = 0; i < bays.length && resto > 0; i++) {
    const cabe = Math.max(0, bays[i].cap - BAY_MARGIN);
    t[i] = Math.min(resto, cabe);
    resto -= t[i];
  }
  return t;
}

/** O deslocamento em Z de um vértice que está em `z`, dado o reparte. */
function deslocamento(bays: { z: number; cap: number }[], t: number[], z: number): number {
  let d = 0;
  for (let i = 0; i < bays.length; i++) if (z < bays[i].z) d += t[i];
  return d;
}

/** O que uma malha tem de rabo: os índices atrás do corte e a posição LOCAL de
 *  fábrica deles. Memorizado em `userData.tsTailBase` — o conjunto é o mesmo em
 *  toda chamada, e é dele que sai a idempotência de `stretchRigidFrame()`. */
function memoDoRabo(
  mesh: WithTailBase, L2N: THREE.Matrix4, corteFrente: number,
  v: THREE.Vector3, caixa: THREE.Box3,
): { idx: Int32Array; base: Float32Array } {
  const vazio = { idx: new Int32Array(0), base: new Float32Array(0) };
  /* Peneira barata: se a caixa inteira da malha está à frente do corte, ela
     não tem rabo nenhum e nem se olha vértice a vértice. */
  const geo = mesh.geometry as THREE.BufferGeometry;
  if (!geo.boundingBox) geo.computeBoundingBox();
  if (geo.boundingBox) {
    caixa.copy(geo.boundingBox).applyMatrix4(L2N);
    if (caixa.min.z >= corteFrente) { mesh.userData.tsTailBase = vazio; return vazio; }
  }
  const pos = geo.getAttribute('position') as THREE.BufferAttribute | undefined;
  if (!pos) { mesh.userData.tsTailBase = vazio; return vazio; }
  const alvos: number[] = [];
  for (let i = 0; i < pos.count; i++) {
    v.set(pos.getX(i), pos.getY(i), pos.getZ(i)).applyMatrix4(L2N);
    if (v.z < corteFrente) alvos.push(i);
  }
  const idx = Int32Array.from(alvos);
  const base = new Float32Array(idx.length * 3);
  for (let k = 0; k < idx.length; k++) {
    const i = idx[k];
    base[k * 3] = pos.getX(i); base[k * 3 + 1] = pos.getY(i); base[k * 3 + 2] = pos.getZ(i);
  }
  const memo = { idx, base };
  mesh.userData.tsTailBase = memo;
  return memo;
}

/**
 * ▶▶▶ QUEM É RABO SE DECIDE COM O CAMINHÃO NA POSE DE FÁBRICA.
 *
 * > *"a roda foi esticada, garanta de corrigir isso"* — Kennedy, 2026-08-25.
 *
 * ⚠️ ISTO É UM CONTRATO DE ORDEM, e sem ele o esticamento do rabo pega peça que
 * não é dele. `stereotype`: a memória de rabo é preenchida na PRIMEIRA chamada
 * de `stretchRigidFrame()`, que acontece dentro de `placeTrailer()` — ou seja
 * DEPOIS de `shiftRearBogie()`. Quem o conjunto traseiro levou para trás
 * atravessa o plano de corte no caminho e passa a ser lido como rabo.
 *
 * Medido no VM 8x2, com o conjunto recuando 1 520 mm e o corte em Zn −6 558:
 *
 *     step_0_p0/p1/p2   6 677 de 6 677 vértices   o estepe INTEIRO
 *     wheel_r_…_disc    2 891 de 36 043           uma FATIA da roda do tandem
 *
 * O estepe levava o passo do conjunto E o do rabo (−1 488) e ia parar atrás da
 * carroceria; a roda, com só uma fatia dela atrás do corte, era RASGADA — a
 * salsicha preta da foto do dono.
 *
 * A memória é dos ÍNDICES, não das posições, então tirá-la antes não muda o que
 * o rabo faz com o quadro: `chassis_p3`, as lanternas e a faixa continuam sendo
 * rabo, porque elas não andam. Muda só o que o conjunto traseiro moveu — e essa
 * peça já está na cota final, posta por quem sabe onde ela vai.
 *
 * @returns quantas malhas ficaram com rabo.
 */
export function primeTailBase(cab: THREE.Object3D, m: RigidMount): number {
  const tail = m.tail;
  if (!tail || !tail.bays.length) return 0;
  const corteFrente = tail.bays[tail.bays.length - 1].z;
  cab.updateWorldMatrix(true, true);
  const cabInv = new THREE.Matrix4().copy(cab.matrixWorld).invert();
  const N = new THREE.Matrix4().makeRotationY(m.orientYaw)
    .multiply(new THREE.Matrix4().makeTranslation(-m.centerX, -m.groundY, 0));
  const L2N = new THREE.Matrix4();
  const v = new THREE.Vector3();
  const caixa = new THREE.Box3();
  let comRabo = 0;
  cab.traverse((o) => {
    const mesh = o as WithTailBase;
    if (!mesh.isMesh || !mesh.geometry || mesh.userData.tsTailBase) return;
    L2N.copy(N).multiply(cabInv).multiply(mesh.matrixWorld);
    if (memoDoRabo(mesh, L2N, corteFrente, v, caixa).idx.length) comRabo++;
  });
  return comRabo;
}

/**
 * Estica (ou encurta) o balanço traseiro do quadro.
 *
 * @param cab     a raiz do `.glb` do caminhão
 * @param m       a entrada de `mounts.json`, já validada
 * @param deltaZ  quanto a traseira do cacho tem de andar, em metros e no
 *                espaço normalizado. NEGATIVO alonga (o rabo vai para −Z).
 * @returns o deslocamento REALMENTE aplicado — igual a `deltaZ` quando coube,
 *          menor quando o encurtamento esgotou as baias. `0` quando este
 *          caminhão não tem rabo medido.
 *
 * IDEMPOTENTE: chamar duas vezes com o mesmo `deltaZ` deixa o mesmo resultado,
 * e chamar com `0` devolve o quadro de fábrica.
 */
export function stretchRigidFrame(
  cab: THREE.Object3D, m: RigidMount, deltaZ: number,
): number {
  const tail = m.tail;
  if (!tail) return 0;

  const t = repartir(tail.bays, deltaZ);
  const aplicado = t.reduce((s, v) => s + v, 0);

  /* O plano mais DIANTEIRO decide quem é rabo. Ele não depende de `deltaZ`, e
     é por isso que a base pristina pode ser tirada uma vez só: o conjunto de
     vértices afetados é o mesmo em toda chamada. */
  const corteFrente = tail.bays[tail.bays.length - 1].z;

  cab.updateWorldMatrix(true, true);
  const cabInv = new THREE.Matrix4().copy(cab.matrixWorld).invert();

  /* N(p) = R_y(yaw) · (p − o) leva do espaço da RAIZ para o normalizado. */
  const N = new THREE.Matrix4().makeRotationY(m.orientYaw)
    .multiply(new THREE.Matrix4().makeTranslation(-m.centerX, -m.groundY, 0));

  const L2N = new THREE.Matrix4();
  const N2L = new THREE.Matrix4();
  const v = new THREE.Vector3();
  const caixa = new THREE.Box3();
  let malhas = 0; let vertices = 0;

  cab.traverse((o) => {
    const mesh = o as WithTailBase;
    if (!mesh.isMesh || !mesh.geometry) return;

    L2N.copy(N).multiply(cabInv).multiply(mesh.matrixWorld);
    N2L.copy(L2N).invert();

    const memo = mesh.userData.tsTailBase
      ?? memoDoRabo(mesh, L2N, corteFrente, v, caixa);
    if (!memo.idx.length) return;

    /* ⚠️ POSSE ANTES DE ESCREVER. Os rips de caminhão compartilham
       `BufferGeometry` entre malhas (139 nós para 125 malhas no VM, 256 para
       219 no Scania); escrever no molde deforma os irmãos. Ver
       `geometry-share.ts`, e note que `markShared(cab)` tem de ter rodado em
       `loadCab()` — sem ele `claimGeometry()` devolve o molde. */
    const geo = claimGeometry(mesh);
    const pos = geo.getAttribute('position') as THREE.BufferAttribute | undefined;
    if (!pos) return;
    /* A matriz mudou de dono junto com a geometria? Não — `claimGeometry` só
       troca o buffer, e a pose do nó continua a mesma, então `L2N` vale. */

    for (let k = 0; k < memo.idx.length; k++) {
      v.set(memo.base[k * 3], memo.base[k * 3 + 1], memo.base[k * 3 + 2]).applyMatrix4(L2N);
      /* O DESLOCAMENTO SAI DO Z PRISTINO, e é isso que torna a função
         idempotente: reavaliar contra o z já deslocado faria a peça atravessar
         o plano e mudar de regra na segunda chamada. */
      const dz = deslocamento(tail.bays, t, v.z);
      if (dz !== 0) { v.z += dz; v.y += m.frameSlope * dz; }
      v.applyMatrix4(N2L);
      pos.setXYZ(memo.idx[k], v.x, v.y, v.z);
    }
    pos.needsUpdate = true;
    /* ⚠️ O TRÊS NÃO INVALIDA ESTES CACHES quando se reescrevem vértices. Sem
       recomputá-los o rabo é descartado pelo frustum e o halo da lanterna fica
       medido no lugar velho. */
    geo.computeBoundingBox();
    geo.computeBoundingSphere();
    malhas++; vertices += memo.idx.length;
  });

  if (malhas) {
    console.info('[quadro]', m.id, '— balanço traseiro',
      aplicado >= 0 ? 'encurtado' : 'alongado', (Math.abs(aplicado) * 1000).toFixed(0), 'mm ·',
      malhas, 'malhas ·', vertices, 'vértices ·',
      'ponta do quadro', ((tail.railEndZ + aplicado) * 1000).toFixed(0), 'mm');
  }
  return aplicado;
}

/**
 * A BASE PRISTINA QUE O RABO GUARDA para uma malha — e a permissão de reescrevê-la.
 *
 * ⚠️ ELA EXISTE PORQUE HÁ DOIS DONOS DA MESMA MALHA, e a primeira vez que isso
 * aconteceu custou uma rodada inteira de investigação.
 *
 * `stretchRigidFrame()` reescreve, a CADA chamada, todo vértice atrás do plano
 * de corte mais dianteiro — **inclusive quando o deslocamento é zero**, porque o
 * laço escreve `base → mundo → base` sem `if`. Isso é o que a torna idempotente,
 * e é também o que apaga qualquer outra reforma feita nos MESMOS vértices.
 *
 * Foi exatamente o que aconteceu com a aba do para-barro: `trimFlapsForGuard()`
 * a encolhia para 1 104 mm de meia-largura (o console dizia isso, corretamente)
 * e a passada SEGUINTE de `placeTrailer()` a devolvia para 1 230, da base
 * pristina daqui. Três pedidos de *"diminua a placa SCANIA"* morreram nesse
 * laço, e a medida no app mostrava a peça intacta enquanto o log dizia que ela
 * tinha encolhido — o pior par possível.
 *
 * A regra que sai disto: **quem reformar uma peça que o rabo cobre tem de
 * reformar a base do rabo junto.** Não é composição de transformações no tempo
 * (isso acumularia); é um dono escrevendo no snapshot do outro, uma vez, com o
 * mesmo mapa que ele acabou de aplicar aos vértices vivos.
 *
 * `idx` são os índices de vértice afetados e `base` as posições LOCAIS pristinas
 * deles, na mesma ordem. `null` quando a malha ainda não foi vista pelo rabo ou
 * quando ela não tem vértice nenhum atrás do corte.
 */
export function tailBaseFor(mesh: THREE.Mesh): { idx: Int32Array; base: Float32Array } | null {
  const memo = (mesh as WithTailBase).userData?.tsTailBase;
  return memo && memo.idx.length ? memo : null;
}

/**
 * O `deltaZ` que alinha a traseira do cacho com a traseira do baú.
 *
 * `recuo` é quanto o cacho fica À FRENTE da chapa traseira, em metros. O padrão
 * é ZERO — face traseira do para-choque COPLANAR com a chapa —, que é o que a
 * foto de referência de um baú sobre chassi mostra e o que a prática de
 * implementador faz: o para-choque é quem toma o impacto, então recuá-lo
 * deixaria a porta exposta. Com recuo zero ele ainda fica 64 mm à frente dos
 * batentes de borracha do baú, que são a extremidade real — ou seja **336 mm
 * dentro** do limite de 400 mm da CONTRAN 805/1995 (a distância máxima entre o
 * dispositivo de proteção e a extremidade traseira do veículo).
 */
export function tailDeltaFor(m: RigidMount, bodyRearZ: number, recuo = 0): number {
  if (!m.tail) return 0;
  return (bodyRearZ + recuo) - m.tail.tailEndZ;
}

/** Se o deslocamento é grande o bastante para valer a escrita. */
export function tailShiftWorth(deltaZ: number): boolean {
  return Math.abs(deltaZ) >= MIN_SHIFT;
}
