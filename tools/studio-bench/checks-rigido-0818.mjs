/* OS DOIS RÍGIDOS, NO ESTÚDIO DE VERDADE — 2026-08-18.
   ===========================================================================
   `tools/trailer-bench/mountprobe.ts` mede a montagem numa cena própria: dois
   GLB, três números e uma foto. É a bancada certa para PROJETAR a regra, e foi
   ela que fixou `frameTopY`.

   Esta é a outra metade, e ela existe porque a regra sozinha não prova nada
   sobre o APP: entre o `mounts.json` e a imagem na tela estão `loadCab()`,
   `loadTrailer()`, a troca de implemento por tipo de chassi, a fusão por
   material, o congelamento de matrizes e `placeTrailer()`. Cada um deles pode
   estar certo isolado e errado no conjunto.

   Os quatro atos:

     1. BOOT — o que carregou sozinho: implemento, engate, montagem.
     2. VOLVO VM 6x2 RÍGIDO — troca de chassi de verdade, por `applyChoice()`.
        Verifica que o implemento VIROU sobrechassi, que `cabMount` entrou, que
        `coupled` saiu, e mede o conjunto montado.
     3. SCANIA P 8x2 BITRUCK — idem, e com um quadro 1,1 m mais longo, o que
        muda o balanço traseiro e nada mais.
     4. A VOLTA — um cavalo mecânico qualquer. O semirreboque tem de voltar E
        engatar. É o ato que pega o vazamento de estado: sem o desmonte do
        implemento anterior em `loadTrailer()`, aqui apareceriam DOIS na cena.

   ⚠️ RODE COM GEOMETRIA:
       node tools/studio-bench/bench.mjs --gpu --geometry --checks checks-rigido-0818.mjs
   Sem `--geometry` o driver bloqueia `*.glb` e não há caminhão nem carroceria
   para medir — o check sai todo em travessão, sem erro nenhum. */

const out = [];
const B = window.__bench;

const mm = (v) => (v === null || v === undefined ? '—' : `${(v * 1000).toFixed(0)} mm`);
const m = (v) => (v === null || v === undefined ? '—' : `${v.toFixed(3)} m`);

await B.until(() => {
  const o = document.getElementById('ts-selector');
  return !!o && o.classList.contains('is-open');
}, 40000);
await B.settleSelector();
/* ⚠️ `window.__studio` NASCE DEPOIS DO `mountStudio()`, e não no tempo de
   import de `boot.ts`. Capturá-lo no topo do check pega `undefined` e o primeiro
   `S.THREE` derruba a rodada inteira — 20 minutos de boot com `--geometry`
   perdidos numa linha. Só depois das esperas acima ele existe. */
await B.until(() => !!window.__studio, 60000);
const S = window.__studio;
await B.until(() => !!S?.state?.trailer, 240000);
for (let i = 0; i < 20; i++) await B.frame();

/* ---------------------------------------------------------------- medidas */

const THREE = S.THREE;

/* ⚠️ AS CAIXAS SÃO MEDIDAS NO LOCAL DO `RIG`, NÃO EM MUNDO.
   O conjunto inteiro pende de `rigGroup`, que nasce com `yaw = π` — em mundo os
   sinais de x e z estão INVERTIDOS em relação ao eixo do veículo. Uma folga
   calculada como `cabine.min.z − baú.max.z` em mundo saiu **−11 182 mm** no
   sobrechassi e **−17 971 mm** no semirreboque, que é o conjunto aprovado: o
   número não estava medindo folga nenhuma, estava medindo o comprimento do
   conjunto com o sinal trocado. Desfazendo a pose do rig, +Z volta a ser a
   frente e a subtração passa a significar o que o nome diz. */
const paraRig = (() => {
  const rig = S.state.trailerGroup?.parent;
  if (!rig) return null;
  rig.updateWorldMatrix(true, true);
  return new THREE.Matrix4().copy(rig.matrixWorld).invert();
})();

/** Caixa POR VÉRTICE das chapas do baú, no local do rig. `setFromObject()` de
 *  um nó girado é a caixa de uma caixa girada — a regra do resto de `vehicle/`. */
function caixaBau() {
  const t = S.state.trailer;
  if (!t) return null;
  const b = new THREE.Box3();
  const v = new THREE.Vector3();
  t.updateWorldMatrix(true, true);
  t.traverse((o) => {
    if (!o.isMesh || !o.visible || !o.geometry?.attributes?.position) return;
    const mats = Array.isArray(o.material) ? o.material : [o.material];
    if (!mats.some((x) => /cor_padrao_branco|metalbranco/i.test(x?.name || ''))) return;
    const p = o.geometry.attributes.position;
    for (let i = 0; i < p.count; i++) {
      v.fromBufferAttribute(p, i).applyMatrix4(o.matrixWorld);
      if (paraRig) v.applyMatrix4(paraRig);
      b.expandByPoint(v);
    }
  });
  return b.isEmpty() ? null : b;
}

/** Caixa da CABINE, para medir a folga contra a testeira. Mesmo referencial. */
function caixaCabine() {
  const c = S.state.cab;
  if (!c) return null;
  const b = new THREE.Box3();
  const v = new THREE.Vector3();
  c.updateWorldMatrix(true, true);
  c.traverse((o) => {
    if (!o.isMesh || !o.visible || !o.geometry?.attributes?.position) return;
    const p = o.geometry.attributes.position;
    for (let i = 0; i < p.count; i++) {
      v.fromBufferAttribute(p, i).applyMatrix4(o.matrixWorld);
      if (paraRig) v.applyMatrix4(paraRig);
      b.expandByPoint(v);
    }
  });
  return b.isEmpty() ? null : b;
}

/** Quantas raízes de implemento existem debaixo do grupo. Mais de uma = o
 *  desmonte de `loadTrailer()` falhou, e é o defeito que o ato 4 procura. */
const quantosImplementos = () => (S.state.trailerGroup?.children || []).length;

function retrato() {
  const bau = caixaBau();
  const cab = caixaCabine();
  const impl = S.state.implement;
  const mount = S.state.cabMount;
  return {
    implemento: impl ? `${impl.id} (${impl.kind})` : '—',
    chassi: S.state.cabDef?.file?.split('/').pop() || '—',
    montagem: mount ? mount.id : '—',
    engate: S.state.coupled ? 'engatado' : 'sem engate',
    raizes: quantosImplementos(),
    pisoBau: bau ? bau.min.y : null,
    tetoBau: bau ? bau.max.y : null,
    testeiraZ: bau ? bau.max.z : null,
    traseiraZ: bau ? bau.min.z : null,
    cabTrasZ: cab ? cab.min.z : null,
    cabTopo: cab ? cab.max.y : null,
  };
}

function relatar(rot, r) {
  out.push([`${rot} · implemento`, r.implemento]);
  out.push([`${rot} · chassi`, r.chassi]);
  out.push([`${rot} · montagem`, r.montagem]);
  out.push([`${rot} · engate`, r.engate]);
  out.push([`${rot} · raízes no grupo`, String(r.raizes)]);
  out.push([`${rot} · piso do baú`, m(r.pisoBau)]);
  out.push([`${rot} · teto do baú`, m(r.tetoBau)]);
  if (r.cabTrasZ !== null && r.testeiraZ !== null) {
    out.push([`${rot} · folga cabine→testeira`, mm(r.cabTrasZ - r.testeiraZ)]);
  }
  if (r.cabTopo !== null && r.tetoBau !== null) {
    out.push([`${rot} · teto acima da cabine`, mm(r.tetoBau - r.cabTopo)]);
  }
  if (r.testeiraZ !== null && r.traseiraZ !== null) {
    out.push([`${rot} · comprimento do baú`, m(r.testeiraZ - r.traseiraZ)]);
  }
}

/* ---------------------------------------------------------------- troca */

const alvos = [];
for (const mk of (S.catalog.catalog?.manufacturers || [])) {
  for (const mo of (mk.models || [])) {
    for (const c of (mo.chassis || [])) {
      if (!c.file || c.available === false) continue;
      alvos.push({ mk, mo, c });
    }
  }
}

async function trocarPara(a) {
  const ok = await S.applyChoice({
    envId: S.choice?.envId || 'estudio',
    manufacturerId: a.mk.id, modelId: a.mo.id, chassisId: a.c.id,
    colorId: null, finishId: null, trim: null,
  }, { curtain: false });
  if (!ok) return false;
  const chegou = await B.until(() => (S.state.cabDef?.file || '') === a.c.file, 240000);
  await B.until(() => !!S.state.trailer, 240000);
  for (let i = 0; i < 16; i++) await B.frame();
  return chegou;
}

const acharChassi = (file) => alvos.find((a) => a.c.file.endsWith(file));

/** `captureViewport()` devolve `{ blob, width, height }` — despejar isso no
 *  relatório imprime `{"blob":{}}` e nenhuma imagem chega ao disco. O driver só
 *  grava o que for `data:image/...`, então a conversão é aqui. */
async function foto() {
  const r = await B.captureViewport({ quality: 'low' });
  const blob = r?.blob;
  if (!blob) return '(sem captura)';
  return await new Promise((res) => {
    const fr = new FileReader();
    fr.onload = () => res(String(fr.result));
    fr.onerror = () => res('(falha ao ler o blob)');
    fr.readAsDataURL(blob);
  });
}

/* ===================== ATO 1 — O BOOT ================================== */
out.push(['—— ATO 1 ——', 'o que carregou sozinho']);
relatar('boot', retrato());

/* ===================== ATO 2 — VOLVO VM ================================ */
out.push(['—— ATO 2 ——', 'Volvo VM 6x2 rígido']);
const vm = acharChassi('volvo_vm_2015_6x2r.glb');
if (!vm) {
  out.push(['★', 'o VM não está no catálogo — ato 2 pulado']);
} else {
  out.push(['carregou', String(await trocarPara(vm))]);
  const r = retrato();
  relatar('VM', r);
  out.push(['★ VM · virou sobrechassi', String(/sobrechassi/.test(r.implemento))]);
  out.push(['★ VM · montagem reconhecida', String(r.montagem !== '—')]);
  out.push(['★ VM · sem engate', String(r.engate === 'sem engate')]);
  out.push(['★ VM · uma raiz só', String(r.raizes === 1)]);
  out.push(['foto-vm-lateral', await foto()]);
}

/* ===================== ATO 3 — SCANIA P ================================ */
out.push(['—— ATO 3 ——', 'Scania P 8x2 bitruck']);
const p = acharChassi('scania_p_8x2r.glb');
if (!p) {
  out.push(['★', 'o P não está no catálogo — ato 3 pulado']);
} else {
  out.push(['carregou', String(await trocarPara(p))]);
  const r = retrato();
  relatar('P', r);
  out.push(['★ P · virou sobrechassi', String(/sobrechassi/.test(r.implemento))]);
  out.push(['★ P · montagem reconhecida', String(r.montagem !== '—')]);
  out.push(['★ P · uma raiz só', String(r.raizes === 1)]);
  out.push(['foto-p-lateral', await foto()]);
}

/* ===================== ATO 4 — A VOLTA ================================= */
out.push(['—— ATO 4 ——', 'de volta ao cavalo mecânico']);
const cavalo = alvos.find((a) => !a.mo.rigid && a.c.file.includes('trucks/'));
if (!cavalo) {
  out.push(['★', 'nenhum cavalo no catálogo — ato 4 pulado']);
} else {
  out.push(['voltando para', cavalo.c.file.split('/').pop()]);
  out.push(['carregou', String(await trocarPara(cavalo))]);
  const r = retrato();
  relatar('volta', r);
  out.push(['★ volta · virou semirreboque', String(/semirreboque/.test(r.implemento))]);
  out.push(['★ volta · engatou', String(r.engate === 'engatado')]);
  out.push(['★ volta · uma raiz só', String(r.raizes === 1)]);
  out.push(['foto-volta', await foto()]);
}

return out;
