/* DIAGNÓSTICO — A CONSOLA DA GRADE contra o modelo do dono (scene.glb).
   ===========================================================================
   Mede, no Scania 8x2 e no VW 8x2, onde cada peça da ferragem termina em |x| e
   em y, e tira duas fotos de perto: a do flanco direito e a de trás/baixo, que
   é o ângulo da foto que trouxe a queixa.

   A régua é o arquivo do dono, convertido para a cena (face da grade 1 251):

       BRACO   |x|  805…1 213   (408 mm)
       MAO     |x|  802…1 199   (397 mm)
       GRAMPO  não existe
*/
const out = [];
const B = window.__bench;
const mm = (v) => (v === null || v === undefined || !isFinite(v) ? '—' : `${(v * 1000).toFixed(0)}`);
await B.until(() => { const o = document.getElementById('ts-selector'); return !!o && o.classList.contains('is-open'); }, 40000);
await B.settleSelector();
await B.until(() => !!window.__studio, 60000);
const S = window.__studio;
await B.until(() => !!S?.state?.trailer, 300000);
for (let i = 0; i < 12; i++) await B.frame();
const THREE = S.THREE;

const grade = [];
const infoOrig = console.info.bind(console);
console.info = (...a) => { if (a[0] === '[grade]') grade.push(a.slice(1).join(' ')); infoOrig(...a); };

const acha = (modelo, chassi) => {
  for (const mk of (S.catalog.catalog?.manufacturers || [])) {
    for (const mo of (mk.models || [])) {
      if (mo.id !== modelo) continue;
      for (const c of (mo.chassis || [])) if (c.id === chassi) return { mk, mo, c };
    }
  }
  return null;
};
const v = new THREE.Vector3();

for (const [modelo, chassi] of [['scania-p', '8x2r'], ['vw-constellation', '8x2-tl']]) {
  const a = acha(modelo, chassi);
  grade.length = 0;
  await S.applyChoice({
    envId: S.choice?.envId || 'estudio',
    manufacturerId: a.mk.id, modelId: a.mo.id, chassisId: a.c.id,
    colorId: null, finishId: null, trim: null,
  }, { curtain: false });
  await B.until(() => (S.state.cabDef?.file || '') === a.c.file, 300000);
  await B.until(() => !!S.state.trailer, 300000);
  for (let i = 0; i < 40; i++) await B.frame();
  const rot = `${modelo}/${chassi}`;
  for (const l of grade) if (/ferragem|proteção/.test(l)) out.push([`${rot} [motor]`, l]);

  const t = S.state.trailer;
  t.updateWorldMatrix(true, true);
  const caixas = new Map();
  t.traverse((o) => {
    if (!o.isMesh || !/^(BRACO__|MAO__|GRAMPO__|ESTACAO__|BARRA__|PONTA__)/.test(o.name || '')) return;
    const pos = o.geometry?.attributes?.position;
    if (!pos) return;
    const n = o.isInstancedMesh ? o.count : 1;
    const M = new THREE.Matrix4();
    const ch = (o.name || '').replace(/_[DE](_[FT])?$/, '');
    let s = caixas.get(ch);
    if (!s) { s = { x0: Infinity, x1: -Infinity, y0: Infinity, y1: -Infinity, n: 0 }; caixas.set(ch, s); }
    s.n = n;
    for (let k = 0; k < n; k++) {
      if (o.isInstancedMesh) { o.getMatrixAt(k, M); M.premultiply(o.matrixWorld); } else M.copy(o.matrixWorld);
      for (let i = 0; i < pos.count; i += Math.max(1, Math.floor(pos.count / 300))) {
        v.set(pos.getX(i), pos.getY(i), pos.getZ(i)).applyMatrix4(M);
        if (v.x < 0) continue;
        s.x0 = Math.min(s.x0, v.x); s.x1 = Math.max(s.x1, v.x);
        s.y0 = Math.min(s.y0, v.y); s.y1 = Math.max(s.y1, v.y);
      }
    }
  });
  out.push([`${rot} · peças da grade (flanco D)`, '\n        '
    + [...caixas].sort((p, q) => p[0].localeCompare(q[0]))
      .map(([n, s]) => `${n}: |x| ${mm(s.x0)}…${mm(s.x1)} · y ${mm(s.y0)}…${mm(s.y1)} · ${s.n} inst`).join('\n        ')]);

  /* FOTO 1 — o flanco, de fora. */
  const cab = S.state.cab;
  const bb = new THREE.Box3().setFromObject(cab);
  const c = bb.getCenter(new THREE.Vector3());
  S.camera.position.set(c.x + 7.5, 1.3, c.z + 1.0);
  S.controls.target.set(c.x, 1.0, c.z + 0.2);
  S.controls.update();
  for (let i = 0; i < 10; i++) await B.frame();
  out.push([`foto-suporte-${modelo}-flanco`, S.renderer.domElement.toDataURL('image/png')]);

  /* FOTO 2 — de trás e de baixo, que é o ângulo da queixa. */
  S.camera.position.set(c.x + 5.0, 0.9, c.z - 5.5);
  S.controls.target.set(c.x - 0.2, 1.1, c.z + 0.6);
  S.controls.update();
  for (let i = 0; i < 10; i++) await B.frame();
  out.push([`foto-suporte-${modelo}-tras`, S.renderer.domElement.toDataURL('image/png')]);
}
console.info = infoOrig;
return out;
