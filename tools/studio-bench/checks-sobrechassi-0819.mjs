/* DIAGNÓSTICO DA RODADA DE 2026-08-19 — o sobrechassi contra o semirreboque.
   ===========================================================================
   Oito defeitos fotografados pelo dono; nenhum deles se resolve por leitura de
   código. Esta sonda tira do app de VERDADE, numa rodada só:

     1. a montagem   — caixa do baú, datum, pose aplicada e o que `placeTrailer()`
                       de fato escreveu. É o "a carroceria está 3 m atrás".
     2. o Thermo King — caixa da unidade e de CADA peça dela, para achar as que
                       flutuam.
     3. o CENSO       — malha a malha, nome + material + triângulos + caixa, nos
                       DOIS implementos. É a única forma de comparar "a peça
                       preta do semirreboque" com a que o sobrechassi tem.

   ⚠️ RODE COM GEOMETRIA:
       node tools/studio-bench/bench.mjs --gpu --geometry \
            --checks checks-sobrechassi-0819.mjs > /tmp/diag-0819.txt */

const out = [];
const B = window.__bench;

await B.until(() => {
  const o = document.getElementById('ts-selector');
  return !!o && o.classList.contains('is-open');
}, 40000);
await B.settleSelector();
await B.until(() => !!window.__studio, 60000);
const S = window.__studio;
await B.until(() => !!S?.state?.trailer, 300000);
for (let i = 0; i < 20; i++) await B.frame();

const THREE = S.THREE;
const r4 = (v) => +v.toFixed(4);

/** Visível de verdade: um pai invisível esconde a malha toda. */
function visivel(o) {
  for (let n = o; n; n = n.parent) if (n.visible === false) return false;
  return true;
}

/** Censo POR MALHA no espaço LOCAL de `root` (a raiz do implemento). */
function censo(root) {
  root.updateWorldMatrix(true, true);
  const inv = new THREE.Matrix4().copy(root.matrixWorld).invert();
  const v = new THREE.Vector3();
  const rows = [];
  root.traverse((o) => {
    if (!o.isMesh || !o.geometry?.attributes?.position) return;
    const p = o.geometry.attributes.position;
    const m = new THREE.Matrix4().multiplyMatrices(inv, o.matrixWorld);
    let x0 = Infinity, y0 = Infinity, z0 = Infinity;
    let x1 = -Infinity, y1 = -Infinity, z1 = -Infinity;
    for (let i = 0; i < p.count; i++) {
      v.fromBufferAttribute(p, i).applyMatrix4(m);
      if (v.x < x0) x0 = v.x; if (v.x > x1) x1 = v.x;
      if (v.y < y0) y0 = v.y; if (v.y > y1) y1 = v.y;
      if (v.z < z0) z0 = v.z; if (v.z > z1) z1 = v.z;
    }
    const mats = Array.isArray(o.material) ? o.material : [o.material];
    rows.push({
      n: o.name,
      p: o.parent?.name || '',
      m: mats.map((x) => x?.name || '?').join('+'),
      t: Math.round((o.geometry.index ? o.geometry.index.count : p.count) / 3),
      v: visivel(o) ? 1 : 0,
      b: [x0, y0, z0, x1, y1, z1].map(r4),
    });
  });
  return rows;
}

function caixa(root, filtro) {
  root.updateWorldMatrix(true, true);
  const inv = new THREE.Matrix4().copy(root.matrixWorld).invert();
  const v = new THREE.Vector3();
  const b = new THREE.Box3();
  root.traverse((o) => {
    if (!o.isMesh || !o.geometry?.attributes?.position) return;
    if (filtro && !filtro(o)) return;
    const p = o.geometry.attributes.position;
    const m = new THREE.Matrix4().multiplyMatrices(inv, o.matrixWorld);
    for (let i = 0; i < p.count; i++) b.expandByPoint(v.fromBufferAttribute(p, i).applyMatrix4(m));
  });
  return b.isEmpty() ? null : b;
}

const fb = (b) => (b ? [b.min.x, b.min.y, b.min.z, b.max.x, b.max.y, b.max.z].map(r4) : null);
const branco = (o) => {
  const mats = Array.isArray(o.material) ? o.material : [o.material];
  return mats.some((x) => /cor_padrao_branco|metalbranco/i.test(x?.name || ''));
};

function retratoMontagem(rot) {
  const st = S.state;
  const t = st.trailer;
  const mount = st.cabMount;
  out.push([`${rot}·implemento`, st.implement ? `${st.implement.id} (${st.implement.kind})` : '—']);
  out.push([`${rot}·chassi`, st.cabDef?.file || '—']);
  out.push([`${rot}·montagem`, mount ? JSON.stringify({
    id: mount.id, frameTopY: mount.frameTopY, cabRearZ: mount.cabRearZ,
    frameEndZ: mount.frameEndZ, orientYaw: r4(mount.orientYaw), groundY: mount.groundY,
  }) : '—']);
  out.push([`${rot}·engate`, st.coupled ? 'engatado' : 'sem engate']);
  out.push([`${rot}·state.trailerBox`, st.trailerBox ? JSON.stringify(fb(st.trailerBox)) : '—']);
  out.push([`${rot}·state.trailerBase`, st.trailerBase ? JSON.stringify({
    pos: [r4(st.trailerBase.pos.x), r4(st.trailerBase.pos.y), r4(st.trailerBase.pos.z)],
    frontZ: r4(st.trailerBase.frontZ),
  }) : '—']);
  out.push([`${rot}·trailerMountDatum`, String(st.trailerMountDatum)]);
  if (t) {
    out.push([`${rot}·trailer.position`, JSON.stringify([r4(t.position.x), r4(t.position.y), r4(t.position.z)])]);
    out.push([`${rot}·trailer.rotation`, JSON.stringify([r4(t.rotation.x), r4(t.rotation.y), r4(t.rotation.z)])]);
    out.push([`${rot}·caixa branca LOCAL do baú`, JSON.stringify(fb(caixa(t, branco)))]);
    /* No espaço do trailerGroup — o mesmo em que `placeTrailer()` escreve. */
    const g = st.trailerGroup;
    if (g) out.push([`${rot}·caixa branca no grupo`, JSON.stringify(fb(caixa(g, branco)))]);
    out.push([`${rot}·raízes no grupo`, String((st.trailerGroup?.children || []).length)]);
  }
  if (st.cab && st.trailerGroup) {
    const rig = st.trailerGroup.parent;
    rig?.updateWorldMatrix(true, true);
    const inv = rig ? new THREE.Matrix4().copy(rig.matrixWorld).invert() : new THREE.Matrix4();
    const v = new THREE.Vector3();
    const bc = new THREE.Box3(); const bt = new THREE.Box3();
    st.cab.updateWorldMatrix(true, true);
    st.cab.traverse((o) => {
      if (!o.isMesh || !visivel(o) || !o.geometry?.attributes?.position) return;
      const p = o.geometry.attributes.position;
      for (let i = 0; i < p.count; i++) {
        bc.expandByPoint(v.fromBufferAttribute(p, i).applyMatrix4(o.matrixWorld).applyMatrix4(inv));
      }
    });
    st.trailer.updateWorldMatrix(true, true);
    st.trailer.traverse((o) => {
      if (!o.isMesh || !visivel(o) || !branco(o) || !o.geometry?.attributes?.position) return;
      const p = o.geometry.attributes.position;
      for (let i = 0; i < p.count; i++) {
        bt.expandByPoint(v.fromBufferAttribute(p, i).applyMatrix4(o.matrixWorld).applyMatrix4(inv));
      }
    });
    out.push([`${rot}·cab no rig`, JSON.stringify(fb(bc))]);
    out.push([`${rot}·baú no rig`, JSON.stringify(fb(bt))]);
    if (!bc.isEmpty() && !bt.isEmpty()) {
      out.push([`${rot}·frente do baú (rig z)`, r4(bt.max.z)]);
    }
  }
  const tk = S.state.tk;
  out.push([`${rot}·tk`, tk ? JSON.stringify({
    pos: [r4(tk.position.x), r4(tk.position.y), r4(tk.position.z)],
    scale: r4(tk.scale.x),
    caixa: fb(caixa(S.state.trailer, (o) => { for (let n = o; n; n = n.parent) if (n === tk) return true; return false; })),
  }) : '—']);
}

async function foto(nome) {
  const r = await B.captureViewport({ quality: 'low' });
  const blob = r?.blob;
  if (!blob) return;
  const url = await new Promise((res) => {
    const fr = new FileReader();
    fr.onload = () => res(String(fr.result));
    fr.onerror = () => res('');
    fr.readAsDataURL(blob);
  });
  if (url) out.push([nome, url]);
}

/* ---------------------------------------------------------------- ato 1 */
out.push(['—— ATO 1 ——', 'boot']);
retratoMontagem('boot');
out.push(['CENSO-boot', JSON.stringify({
  implemento: S.state.implement?.id,
  malhas: censo(S.state.trailer),
})]);

/* ---------------------------------------------------------------- ato 2 */
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
  await B.until(() => (S.state.cabDef?.file || '') === a.c.file, 300000);
  await B.until(() => !!S.state.trailer, 300000);
  for (let i = 0; i < 16; i++) await B.frame();
  return true;
}
const achar = (f) => alvos.find((a) => a.c.file.endsWith(f));

out.push(['—— ATO 2 ——', 'Volvo VM 6x2 rígido']);
const vm = achar('volvo_vm_2015_6x2r.glb');
if (!vm) out.push(['★', 'VM fora do catálogo']);
else {
  out.push(['VM·carregou', String(await trocarPara(vm))]);
  retratoMontagem('VM');
  out.push(['CENSO-sobrechassi', JSON.stringify({
    implemento: S.state.implement?.id,
    malhas: censo(S.state.trailer),
  })]);
  if (S.state.tk) out.push(['CENSO-tk', JSON.stringify({ malhas: censo(S.state.tk) })]);
  await foto('foto-vm');
}

/* ---------------------------------------------------------------- ato 3 */
out.push(['—— ATO 3 ——', 'de volta ao cavalo (semirreboque)']);
const cavalo = alvos.find((a) => !a.mo.rigid && a.c.file.includes('trucks/'));
if (!cavalo) out.push(['★', 'nenhum cavalo no catálogo']);
else {
  out.push(['volta·para', cavalo.c.file]);
  out.push(['volta·carregou', String(await trocarPara(cavalo))]);
  retratoMontagem('volta');
  out.push(['CENSO-semirreboque', JSON.stringify({
    implemento: S.state.implement?.id,
    malhas: censo(S.state.trailer),
  })]);
  if (S.state.tk) out.push(['CENSO-tk-grande', JSON.stringify({ malhas: censo(S.state.tk) })]);
  await foto('foto-volta');
}

return out;
