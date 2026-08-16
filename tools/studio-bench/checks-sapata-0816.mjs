/* A SAPATA NAS DUAS VISTAS, EM ESPAÇO DE MUNDO — a trava do relato.
   ===========================================================================
       DISPLAY= STUDIO_BENCH_GPU_ARGS='--use-gl=angle --use-angle=gles-egl --enable-gpu --ignore-gpu-blocklist' \
         node tools/studio-bench/bench.mjs --gpu --geometry --checks checks-sapata-0816.mjs

   Relato de 2026-08-16: *"a sapata [aparece] somente quando não está somente o
   implemento, e deveria mostrar principalmente quando está somente o
   implemento"*. Ou seja: com o CONJUNTO em cena (patola recolhida) a chapa
   aparece, e com SÓ O IMPLEMENTO (patola descida) ela some.

   Este arquivo mede, nas duas vistas: a altura de MUNDO da face de baixo da
   chapa, a altura de MUNDO do piso do cenário, e fotografa o pé nas duas. */

const out = [];
const B = window.__bench;

await B.until(() => {
  const o = document.getElementById('ts-selector');
  return !!o && o.classList.contains('is-open');
}, 40000);
await B.settleSelector();
await B.until(() => !!window.__studio?.state?.trailer, 180000);
for (let i = 0; i < 30; i++) await B.frame();

const S = window.__studio;
const THREE = S.THREE;
const raiz = S.state.trailer;
const grupo = raiz.getObjectByName('PATOLA');
if (!grupo) { out.push(['⚠️ ABORTADO', 'grupo PATOLA ausente']); return out; }

out.push(['entrou no Estúdio', await B.enterStudio()]);
for (let i = 0; i < 25; i++) await B.frame();

const sapata = grupo.children.find((o) => /SAPATA/.test(o.name || ''));
out.push(['a sapata existe', !!sapata]);
if (!sapata) return out;

/* ---- O QUE O BAKE JÁ TINHA, para os números do cabeçalho de landing-gear.ts
   serem reproduzíveis: o tubo medido bem acima do pé, e a FLANGE de fábrica
   (os vértices que avançam além da secção do tubo). ---- */
{
  const perna = grupo.children.find((o) => o !== sapata
    && new THREE.Box3().setFromObject(o).getCenter(new THREE.Vector3()).x > 0);
  const pos = perna?.geometry?.getAttribute('position');
  if (pos) {
    perna.updateWorldMatrix(true, false);
    const m = new THREE.Matrix4().multiplyMatrices(
      raiz.matrixWorld.clone().invert(), perna.matrixWorld);
    const v = new THREE.Vector3();
    let y0 = Infinity;
    for (let i = 0; i < pos.count; i++) y0 = Math.min(y0, v.fromBufferAttribute(pos, i).applyMatrix4(m).y);
    let tx0 = Infinity, tx1 = -Infinity, tz0 = Infinity, tz1 = -Infinity;
    for (let i = 0; i < pos.count; i++) {
      v.fromBufferAttribute(pos, i).applyMatrix4(m);
      if (v.y - y0 < 0.40 || v.y - y0 > 0.60) continue;
      tx0 = Math.min(tx0, v.x); tx1 = Math.max(tx1, v.x);
      tz0 = Math.min(tz0, v.z); tz1 = Math.max(tz1, v.z);
    }
    let fy1 = -Infinity, fx = 0, fn = 0;
    for (let i = 0; i < pos.count; i++) {
      v.fromBufferAttribute(pos, i).applyMatrix4(m);
      if (v.x >= tx0 - 0.002 && v.x <= tx1 + 0.002
        && v.z >= tz0 - 0.002 && v.z <= tz1 + 0.002) continue;
      fn++;
      fy1 = Math.max(fy1, v.y);
      fx = Math.max(fx, Math.max(tx0 - v.x, v.x - tx1));
    }
    out.push(['bake · TUBO a 400–600 mm do pé, em mm',
      `${((tx1 - tx0) * 1000).toFixed(0)} × ${((tz1 - tz0) * 1000).toFixed(0)}`]);
    out.push(['bake · FLANGE de fábrica', fn
      ? `${(fx * 1000).toFixed(0)} mm além do tubo · ${((fy1 - y0) * 1000).toFixed(1)} mm de espessura`
      : 'NENHUMA']);
  }
}

/* Caixa de MUNDO da chapa, por vértice. */
function caixaMundoSapata() {
  raiz.updateWorldMatrix(true, true);
  sapata.updateWorldMatrix(true, false);
  const pos = sapata.geometry.getAttribute('position');
  const v = new THREE.Vector3();
  const b = new THREE.Box3();
  for (let i = 0; i < pos.count; i++) b.expandByPoint(v.fromBufferAttribute(pos, i).applyMatrix4(sapata.matrixWorld));
  return b;
}
/* E onde os PNEUS tocam, em mundo — o piso que interessa. */
function contatoMundo() {
  raiz.updateWorldMatrix(true, true);
  const v = new THREE.Vector3();
  let y = Infinity;
  raiz.traverse((no) => {
    const o = no;
    if (!o.isMesh || !/pneu/i.test(o.name || '')) return;
    const pos = o.geometry?.getAttribute('position');
    if (!pos) return;
    o.updateWorldMatrix(true, false);
    for (let i = 0; i < pos.count; i++) {
      v.fromBufferAttribute(pos, i).applyMatrix4(o.matrixWorld);
      if (v.y < y) y = v.y;
    }
  });
  return y;
}

const R = S.renderer, cena = S.scene;
const ar = R.domElement.width / R.domElement.height;
function foto(alvoMundo, olhoMundo, meiaA) {
  const cam = new THREE.OrthographicCamera(-meiaA * ar, meiaA * ar, meiaA, -meiaA, 0.01, 80);
  cam.position.copy(olhoMundo);
  cam.up.set(0, 1, 0);
  cam.lookAt(alvoMundo);
  cam.updateMatrixWorld(true);
  R.render(cena, cam);
  return R.domElement.toDataURL('image/png');
}

for (const vista of ['both', 'trailer']) {
  S.models.setVehicleView(vista);
  for (let i = 0; i < 10; i++) await B.frame();
  const b = caixaMundoSapata();
  const chao = contatoMundo();
  const c = b.getCenter(new THREE.Vector3());
  out.push([`${vista} · sapata y (mundo)`,
    `${b.min.y.toFixed(4)} … ${b.max.y.toFixed(4)}`]);
  out.push([`${vista} · contato dos pneus (mundo)`, +chao.toFixed(4)]);
  out.push([`${vista} · a chapa está acima do piso, em mm`,
    +((b.min.y - chao) * 1000).toFixed(1)]);
  out.push([`${vista} · a chapa está VISÍVEL (nada a esconde)`,
    !!(sapata.visible && grupo.visible && raiz.visible)]);
  /* Vista de 3/4 de baixo, que é a do relato. */
  const olho = c.clone().add(new THREE.Vector3(3.2, 1.1, 3.2));
  out.push([`sapata-${vista}-34`, foto(c, olho, 0.30)]);
  out.push([`sapata-${vista}-perfil`,
    foto(c, c.clone().add(new THREE.Vector3(8, 0.6, 0)), 0.30)]);
}

return out;
