/* A FAIXA REFLETIVA TRASEIRA — a do Volvo VM, nos três rígidos.
   ===========================================================================
   *"a faixa refletiva da traseira deve ser do volvo, em todos, inclusive do
   Scania"* — Kennedy, 2026-08-22.

   Os três rígidos têm faixa traseira e as três são diferentes. Medido:

     Volvo VM   `chassis_p4`   100 v · 2,124 × 0,099 m · `faixas_refletivas`
                               1024² COM ALFA — atlas 3M de verdade, com
                               microprisma, "APROVADO DENATRAN" e a marca
     Scania P   `chassis_p38`  150 v · 2,389 × 0,109 m · `refletivas` 4096×256,
                               chevron Avery Dennison de passo fino
     VW Titan   `truck_p56`     18 v · 2,568 × 0,115 m · `faixa` 1024×256

   ===========================================================================
   ⚠️ O GANHO NÃO É SÓ DE TEXTURA — as três faixas de rip NÃO RETRORREFLETEM

   `retroreflect.ts` injeta o termo de retrorreflexão por NOME DE MATERIAL:

       FITA_RE = /faixa.?3m|retro.?reflet|reflective.?tape|conspicuity/i

   e **nenhum** dos três nomes casa: `faixas_refletivas`, `refletivas` e
   `faixa.002` passam batido (o `reflet` deles não vem precedido de `retro`).
   Ou seja, hoje a fita do BAÚ acende no farol e a faixa traseira do CAMINHÃO
   não — na mesma foto, a 30 cm de distância. O asset sai do bake batizado
   `Faixa-3M-traseira`, que casa a primeira alternativa, e `setupCommon()` faz
   a injeção ao carregá-lo. É o defeito maior dos dois, e ele é invisível de dia.

   ===========================================================================
   ⚠️ COMO A FAIXA NATIVA É ACHADA — nome NÃO basta

   Por material, os três casam `/reflet|faixa/i`. Mas no Scania esse mesmo
   `/faixa/i` casa também `cabin_mat_0006_faixas112_5`, que é o RÓTULO do tanque
   de ARLA (1 416 v, 75 × 90 mm, no flanco). Nome sozinho pegaria o rótulo.

   Então o nome é só o primeiro peneiro; quem decide é a FORMA e o SÍTIO: uma
   faixa traseira é uma CHAPA LARGA, BAIXA E FINA (≥ 1,5 m de largura, ≤ 0,25 de
   altura, ≤ 0,06 de espessura) e fica na PONTA DE TRÁS do caminhão. Entre as
   candidatas vale a mais traseira. Medido, isso deixa exatamente uma por
   caminhão, e o rótulo do ARLA sai pela largura (75 mm contra 1 500).

   ===========================================================================
   ⚠️ A GEOMETRIA DO CLONE É PRÓPRIA, e não compartilhada com o asset

   Esta peça mora no RABO, e o rabo é escrito: `stretchRigidFrame()` seleciona
   por Z DE VÉRTICE contra o plano de corte e reescreve as posições a cada
   arraste do controle de comprimento. Um clone que dividisse `BufferGeometry`
   com a raiz do asset entregaria essa escrita à geometria compartilhada — e
   `markShared()` não protege, porque ele conta usuários DENTRO da cabine e a
   raiz do asset está fora dela.

   São 100 vértices: clonar a geometria custa nada e fecha a porta. É a mesma
   conclusão de `geometry-share.ts`, chegando pelo outro lado.

   ⚠️ E POR ISSO A MONTAGEM É ANTES DO PRIMEIRO `placeTrailer()`, exatamente
   como `attachRigidRearPlate()`: montada depois, a faixa nasceria no lugar já
   deslocado e levaria o deslocamento OUTRA VEZ na passada seguinte.

   ===========================================================================
   ⚠️⚠️ A FAIXA AFUNDAVA NA BARRA — o conserto da 2ª passada (2026-08-22)

   *"a faixa do scania esta errado"*, e a causa não era textura: era a
   INCLINAÇÃO. As três barras traseiras são levemente rakeadas, e cada uma com
   um ângulo próprio, medido na face:

       Volvo VM   2,9 mm em 99 mm de altura  =  1,62°
       VW Titan   5,2 mm em 114              =  2,61°
       Scania P   ~1 mm em 90                =  0,64°  (quase plana)

   A primeira versão levava a faixa do VM com o rake DELA embutido e a ancorava
   pela borda de baixo. No Scania isso põe o topo da faixa **2,6 mm ATRÁS da
   chapa da barra**, e o renderizador come dois terços dela: sobravam duas
   tirinhas, a de cima e a de baixo, com preto no meio. Foi exatamente o que a
   captura mostrou.

   O conserto tem duas metades, e as duas são necessárias:

     1. **o molde sai VERTICAL do bake** (`bake_faixa_vm.py` mede o rake por
        mínimos quadrados e o zera — 1,623° → 0,0001°);
     2. **o motor mede o rake da faixa NATIVA e o aplica**, assentando a placa
        `MARGEM` à frente do plano dela.

   Assim a faixa acompanha a barra de cada caminhão em vez de impor a do VM, e
   fica com um afastamento UNIFORME de 3 mm — que é o que uma fita colada sobre
   uma barra realmente tem, e é folga de sobra para o z-buffer.

   ⚠️ E A PEÇA É UMA CHAPA SEM ESPESSURA. Medido: a caixa em z tem 2,9 mm e o
   rake sozinho já vale 2,9 mm — ou seja a espessura é ~0. Isso importa aqui
   porque qualquer regra que tente separar "a face da frente" pela espessura
   está separando, na verdade, a metade de baixo da chapa. */
import * as THREE from 'three';

/** O nó que este módulo cria. */
const RAIZ = 'TS_FAIXA_TRASEIRA';
/** O nó do asset. */
const MOLDE = 'FAIXA_TRASEIRA';

/** O primeiro peneiro, por nome de material. Ver o bloco acima. */
const NATIVA_RE = /reflet|faixa/i;
/** Uma faixa traseira tem pelo menos isto de largura… */
const LARG_MIN = 1.50;
/** …e no máximo isto. */
const LARG_MAX = 3.20;
/** Altura máxima de uma faixa. */
const ALT_MAX = 0.25;
/** Espessura máxima. */
const ESP_MAX = 0.060;
/** Afastamento da faixa em relação ao plano da barra. 3 mm é o que uma fita
 *  colada tem de relevo e é folga de sobra para o z-buffer a esta distância. */
const MARGEM = 0.003;
/** Rake acima disto não é barra de caminhão — é outra peça. Medido, o maior
 *  dos três é 2,61°. */
const RAKE_MAX = Math.tan(8 * Math.PI / 180);

const materialsOf = (o: THREE.Mesh) =>
  (Array.isArray(o.material) ? o.material : [o.material]).filter(Boolean) as THREE.Material[];

/** A caixa do molde no espaço LOCAL dele — o contrato manda largura 1 e o
 *  datum no centro/baixo/atrás. */
function caixaMolde(mold: THREE.Object3D): THREE.Box3 {
  const b = new THREE.Box3();
  const v = new THREE.Vector3();
  const inv = new THREE.Matrix4().copy(mold.matrixWorld).invert();
  const m = new THREE.Matrix4();
  mold.traverse((node) => {
    const o = node as THREE.Mesh;
    const pos = o.isMesh ? o.geometry?.getAttribute('position') as THREE.BufferAttribute : null;
    if (!pos) return;
    m.multiplyMatrices(inv, o.matrixWorld);
    for (let i = 0; i < pos.count; i++) b.expandByPoint(v.fromBufferAttribute(pos, i).applyMatrix4(m));
  });
  return b;
}

/**
 * Troca a faixa refletiva traseira do caminhão pela do VM.
 *
 * `asset` é a raiz já carregada de `faixa_refletiva_vm_v1.glb`, já passada por
 * `setupCommon()` — que é quem faz a injeção de retrorreflexão. A raiz NÃO é
 * descartada no caminho feliz: o clone divide o MATERIAL (e a textura de 1024²)
 * com ela, e um `disposeTree()` levaria a textura junto.
 *
 * Devolve as linhas do relatório; vazio significa que nada foi tocado e a faixa
 * original continua lá — a degradação é sempre "fica como estava".
 */
export function swapRearTape(cab: THREE.Object3D, asset: THREE.Object3D): string[] {
  const mold = asset.getObjectByName(MOLDE);
  if (!mold) return [`⚠ faixa_refletiva_vm_v1.glb sem ${MOLDE} — a faixa original fica.`];
  cab.updateWorldMatrix(true, true);
  asset.updateWorldMatrix(true, true);

  const mb = caixaMolde(mold);
  const larg = mb.max.x - mb.min.x;
  if (Math.abs(larg - 1) > 0.01 || Math.abs(mb.min.y) > 0.005 || Math.abs(mb.max.z) > 0.005
    || Math.abs(mb.min.x + mb.max.x) > 0.01) {
    return [`⚠ ${MOLDE} fora do contrato — x[${mb.min.x.toFixed(3)},${mb.max.x.toFixed(3)}]`
      + ` y[${mb.min.y.toFixed(3)},${mb.max.y.toFixed(3)}]`
      + ` z[${mb.min.z.toFixed(3)},${mb.max.z.toFixed(3)}]. A faixa original fica.`];
  }

  /* --- 1. a faixa NATIVA: nome, depois forma, depois sítio --- */
  const toLocal = new THREE.Matrix4().copy(cab.matrixWorld).invert();
  const L2C = new THREE.Matrix4();
  const v = new THREE.Vector3();
  const candidatas: { o: THREE.Mesh; b: THREE.Box3; mat: string }[] = [];
  const recusadas: string[] = [];
  cab.traverse((node) => {
    const o = node as THREE.Mesh;
    if (!o.isMesh || !o.visible) return;
    const mat = materialsOf(o).find((m) => NATIVA_RE.test(m.name || ''));
    if (!mat) return;
    const pos = o.geometry?.getAttribute('position') as THREE.BufferAttribute | undefined;
    if (!pos) return;
    const b = new THREE.Box3();
    L2C.multiplyMatrices(toLocal, o.matrixWorld);
    for (let i = 0; i < pos.count; i++) b.expandByPoint(v.fromBufferAttribute(pos, i).applyMatrix4(L2C));
    const d = b.getSize(new THREE.Vector3());
    if (d.x >= LARG_MIN && d.x <= LARG_MAX && d.y <= ALT_MAX && d.z <= ESP_MAX) {
      candidatas.push({ o, b, mat: mat.name || '?' });
    } else {
      recusadas.push(`${o.name}[${mat.name}] ${d.x.toFixed(3)}×${d.y.toFixed(3)}×${d.z.toFixed(3)}`);
    }
  });
  if (!candidatas.length) {
    return [`⚠ nenhuma chapa larga e fina sob ${NATIVA_RE} — nada a trocar.`
      + (recusadas.length ? ` Recusadas pela forma: ${recusadas.join(' · ')}` : '')];
  }
  /* A MAIS TRASEIRA. No rip dos três a traseira é +z (os três têm `orientYaw`
     π em `mounts.json`), então "mais traseira" é o maior z. */
  candidatas.sort((a, b) => b.b.max.z - a.b.max.z);
  const nativa = candidatas[0];
  const d = nativa.b.getSize(new THREE.Vector3());

  /* --- 1b. O RAKE DA BARRA, por mínimos quadrados de z contra a altura ---
     Sobre TODOS os vértices da nativa: ela é uma chapa sem espessura, então a
     reta ajustada É o plano da barra. Ver o bloco do cabeçalho. */
  let rake = 0;
  let zNaBase = nativa.b.max.z;
  {
    const pos = nativa.o.geometry.getAttribute('position') as THREE.BufferAttribute;
    L2C.multiplyMatrices(toLocal, nativa.o.matrixWorld);
    let n = 0, sy = 0, sz = 0, syy = 0, syz = 0;
    for (let i = 0; i < pos.count; i++) {
      v.fromBufferAttribute(pos, i).applyMatrix4(L2C);
      n++; sy += v.y; sz += v.z; syy += v.y * v.y; syz += v.y * v.z;
    }
    const den = n * syy - sy * sy;
    if (n >= 4 && Math.abs(den) > 1e-12) {
      const m = (n * syz - sy * sz) / den;
      if (Math.abs(m) <= RAKE_MAX) {
        rake = m;
        /* z do plano na altura da BASE da faixa — é ali que o molde ancora. */
        zNaBase = (sz - m * sy) / n + m * nativa.b.min.y;
      }
    }
  }

  /* --- 2. a faixa do VM no sítio dela --- */
  const unit = mold.clone(true);
  unit.name = RAIZ;
  /* ⚠️ GEOMETRIA PRÓPRIA — ver o bloco do cabeçalho. */
  unit.traverse((node) => {
    const o = node as THREE.Mesh;
    if (o.isMesh && o.geometry) o.geometry = o.geometry.clone();
  });
  const at = new THREE.Vector3(
    (nativa.b.min.x + nativa.b.max.x) / 2,
    nativa.b.min.y,
    zNaBase + MARGEM,
  );
  /* O molde sai vertical do bake; quem inclina é o rake medido AQUI, em torno
     do eixo lateral. `atan` e não o próprio coeficiente: o ângulo é pequeno,
     mas a diferença é o que separa "encosta" de "afunda". */
  const q = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), Math.atan(rake));
  unit.matrixAutoUpdate = false;
  unit.matrix.compose(at, q, new THREE.Vector3(d.x, d.x, d.x));
  cab.add(unit);
  nativa.o.visible = false;

  const alt = d.x * (mb.max.y - mb.min.y);
  return [`faixa do VM em ${nativa.o.name}[${nativa.mat}]`
    + ` · largura ${d.x.toFixed(3)} m · altura ${alt.toFixed(3)} (a nativa tinha ${d.y.toFixed(3)})`
    + ` · centro x ${at.x.toFixed(3)} · base y ${at.y.toFixed(3)} · face z ${at.z.toFixed(3)}`
    + ` · rake da barra ${(Math.atan(rake) * 180 / Math.PI).toFixed(2)}°`
    + ` · afastamento ${(MARGEM * 1000).toFixed(0)} mm`
    + (candidatas.length > 1
      ? ` · ${candidatas.length - 1} outra(s) candidata(s) mais dianteira(s), intocadas` : '')
    + (recusadas.length ? ` · fora pela forma: ${recusadas.join(' · ')}` : '')];
}
