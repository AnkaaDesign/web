/* DIAGNÓSTICO 2026-08-16 — as três queixas do Estúdio, medidas.
   ===========================================================================
       node tools/studio-bench/bench.mjs --gpu --geometry --checks checks-diag-0816.mjs

   Ele não afirma nada: imprime números. Quem OLHA é `checks-foto-0816.mjs`.

   1. "TEM ALGUNS ITENS FLUTUANDO ABAIXO DAS LÂMPADAS"
      Inventário de toda malha VISÍVEL cuja caixa de mundo é um FIO (uma
      dimensão bem menor que as outras) e que não encosta no chão. Foi ele que
      achou o defeito: onze `ts-lamp-site-lenses` de 0,77 x 0,13 x 0,37 m
      penduradas a y = 9,82 m, de z = −204 a z = +68, sem mastro nenhum embaixo
      — os vidros das luminárias do `distrito-industrial`, que sobreviviam à
      troca para um cenário SEM BLOCO `set`. Conserto em `disposeSet()`
      (scene/set.ts). Depois dele a lista fica só com peças do RIG (retrovisor,
      quebra-sol, maçaneta), que são fios de verdade e estão onde deviam.

   2. "NÃO PARECE TER UM CANTO ALI, O CHÃO PARECE FLUTUAR"
      Perfil vertical de luminância atravessando a junta piso/parede. O que ele
      mostrou: parede 129 → concordância **227** → piso 190, ou seja a curva era
      a coisa mais clara do quadro. Ver a rampa em `scene/cyclorama.ts`.

   3. "A FAIXA REFLETIVA FICA ALARANJADA"
      Quais materiais são fita e com que parâmetros. A cor sai da textura; quem
      estoura é o lóbulo — ver o TETO MACIO em `vehicle/retroreflect.ts`. */
const out = [];
const B = window.__bench;

await B.until(() => {
  const o = document.getElementById('ts-selector');
  return !!o && o.classList.contains('is-open');
}, 30000);
out.push(['seletor atravessado', await B.settleSelector()]);
out.push(['__studio de pé', await B.until(() => !!window.__studio, 300000)]);
const S = window.__studio;
if (!S) return out;
out.push(['implemento carregado', await B.until(() => !!S.trailerRig, 300000)]);

const THREE = S.THREE;
const scene = S.scene;
const camera = S.camera;
const controls = S.controls;
const renderer = S.renderer;

out.push(['entrou no cenário estúdio', await B.enterStudio()]);
await new Promise((r) => setTimeout(r, 3500));

/* ---------------- 1. INVENTÁRIO DE FIOS FLUTUANTES ---------------- */
function chain(o) {
  const parts = [];
  for (let p = o; p; p = p.parent) parts.push(p.name || p.type);
  return parts.reverse().join('/');
}

const box = new THREE.Box3();
const size = new THREE.Vector3();
const center = new THREE.Vector3();
const fios = [];
let vistos = 0;

scene.updateMatrixWorld(true);
scene.traverseVisible((o) => {
  if (!o.isMesh && !o.isInstancedMesh && !o.isPoints && !o.isLine && !o.isSprite) return;
  vistos++;
  try { box.setFromObject(o, true); } catch { return; }
  if (box.isEmpty() || !Number.isFinite(box.min.y)) return;
  box.getSize(size);
  box.getCenter(center);
  const dims = [size.x, size.y, size.z].sort((a, b) => a - b);
  /* Não encosta no chão E é um fio: a assinatura de peça órfã. O limite de
     cima (12 m) tira viga e painel do teto, que são fios legítimos e enormes. */
  if (box.min.y <= 1.5) return;
  if (!(dims[0] < 0.5 && dims[2] > 0.5 && dims[2] < 12)) return;
  fios.push({
    n: chain(o),
    mat: Array.isArray(o.material) ? o.material.map((m) => m?.name).join('+') : (o.material?.name || ''),
    c: [+center.x.toFixed(2), +center.y.toFixed(2), +center.z.toFixed(2)],
    s: [+size.x.toFixed(2), +size.y.toFixed(2), +size.z.toFixed(2)],
  });
});

out.push(['malhas visíveis', vistos]);
out.push(['FIOS FLUTUANTES (' + fios.length + ')', fios.slice(0, 40)]);

/* A caixa do RIG separa "fio do caminhão" de "fio da sala": tudo que cair
   dentro dela é peça do veículo e não interessa a esta busca. */
const rig = scene.getObjectByName('RIG');
if (rig) {
  const rb = new THREE.Box3().setFromObject(rig);
  out.push(['caixa do RIG', {
    min: rb.min.toArray().map((v) => +v.toFixed(2)),
    max: rb.max.toArray().map((v) => +v.toFixed(2)),
  }]);
}

/* ---------------- 2. O PERFIL DA JUNTA ---------------- */
const pose0 = S.lighting.getCameraPose();
out.push(['pose ao entrar', pose0]);

const t = controls.target;
const dist = Math.min(controls.maxDistance, 42);
{
  const a = THREE.MathUtils.degToRad(pose0.azimuthDeg);
  const e = THREE.MathUtils.degToRad(7);
  t.y = 2.4;
  camera.position.set(
    t.x + Math.sin(a) * Math.cos(e) * dist,
    t.y + Math.sin(e) * dist,
    t.z + Math.cos(a) * Math.cos(e) * dist,
  );
  camera.lookAt(t);
  camera.updateMatrixWorld(true);
  controls.update();
}
out.push(['pose medida', S.lighting.getCameraPose()]);

/* ⚠️ SÍNCRONO, E ISSO É REQUISITO. `preserveDrawingBuffer` é falso, então um
   `await` entre o desenho e a leitura devolve o buffer LIMPO — e o sintoma é
   uma coluna inteira com o valor da cor de fundo (36), que parece uma medição e
   não é. Mesma armadilha registrada no gravador (scene/record.ts). */
const gl = renderer.getContext();
const W = renderer.domElement.width, H = renderer.domElement.height;
const px = new Uint8Array(W * H * 4);
renderer.render(scene, camera);
gl.readPixels(0, 0, W, H, gl.RGBA, gl.UNSIGNED_BYTE, px);
const at = (x, y) => { const i = ((H - 1 - y) * W + x) * 4; return [px[i], px[i + 1], px[i + 2]]; };
const lum = (c) => +(0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]).toFixed(1);

const cols = [];
for (const fx of [0.08, 0.85]) {
  const x = Math.round(W * fx);
  const col = [];
  /* Só a faixa em que a junta cai, de cima para baixo, de 3 em 3 pixels. */
  for (let y = Math.round(H * 0.22); y < Math.round(H * 0.55); y += 3) col.push(lum(at(x, y)));
  cols.push({ x, de: Math.round(H * 0.22), passo: 3, col });
}
out.push(['perfil vertical da junta (luminância)', cols]);
out.push(['viewport', { W, H }]);

/* ---------------- 3. A FITA ---------------- */
const fitas = [];
scene.traverse((o) => {
  if (!o.isMesh && !o.isInstancedMesh) return;
  const ms = Array.isArray(o.material) ? o.material : [o.material];
  for (const m of ms) {
    if (!m || !/faixa.?3m|retro/i.test(m.name || '')) continue;
    if (fitas.some((f) => f.mat === m.name)) continue;
    fitas.push({
      mat: m.name,
      cor: '#' + m.color.getHexString(),
      mapa: !!m.map,
      rough: m.roughness, metal: m.metalness,
      envInt: m.envMapIntensity,
    });
  }
});
out.push(['materiais de fita', fitas]);
out.push(['retrorreflexão', S.models && S.models.getRetroreflective
  ? S.models.getRetroreflective() : 'sem alça']);

return out;
