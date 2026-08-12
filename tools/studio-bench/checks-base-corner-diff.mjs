/* DIFF do CANTO TRASEIRO BAIXO — bake cru × runtime (fábrica).
   ---------------------------------------------------------------------------
   Par da sonda crua (scratchpad prod-compare/baseprobe.ts, 2026-08-11): o GLB
   de produção é IDÊNTICO ao local (sha256 59c890bd…), então a diferença é o
   código. No bake cru, a janela dos últimos ~250 mm da lateral (faixa
   −140..−60 rel. pé da pele) vista de baixo-atrás NÃO é vazia: o fan oblíquo
   (ψ25/45, subindo 15/30 %) morre no CHASSI metal-preto a 150..620 mm, na
   lanterna lateral do chassi (@5..20, z +150..250) e no marco/trilho de −84
   para cima. Esta bateria roda os MESMOS raios no app, COM e SEM a soleira
   LIVERY_SILL, e tira a foto do canto baixo do print.

   DATUM: pé da chapa SIDE_L = pé da pele branca do bake (−20 rel. floorY) —
   os números saem direto na unidade da sonda crua. Crista = min.x da chapa
   (2 mm fora da crista do bake pelo remonte).

   Roda: node tools/studio-bench/bench.mjs --gpu --geometry --checks checks-base-corner-diff.mjs
*/
const out = [];
const B = window.__bench;

await B.until(() => {
  const o = document.getElementById('ts-selector');
  return !!o && o.classList.contains('is-open');
}, 30000);

async function settle() {
  const overlay = document.getElementById('ts-selector');
  if (!overlay) return true;
  for (let step = 0; step < 12; step++) {
    if (overlay.classList.contains('hidden')) return true;
    const cards = [...overlay.querySelectorAll('.ts-card:not([disabled])')];
    if (!cards.length) break;
    const local = cards.find((c) => /scania|volvo|iveco/i.test(c.dataset.id || ''));
    (local || cards[0]).click();
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
  }
  return overlay.classList.contains('hidden');
}

out.push(['seletor atravessado', await settle()]);
out.push(['__studio de pé', await B.until(() => !!window.__studio, 480000)]);
const S = window.__studio;
if (!S) return out;
out.push(['implemento carregado', await B.until(() => !!S.trailerRig, 240000)]);
if (!S.trailerRig) return out;
await B.frame(); await B.frame();

const THREE = S.THREE;
const scene = S.scene;
const trailer = S.trailer;
const mm = (v) => Math.round(v * 1000);

const canvas = document.createElement('canvas');
const rr = new THREE.WebGLRenderer({ canvas, antialias: true, preserveDrawingBuffer: true });
rr.setPixelRatio(1);
rr.outputColorSpace = THREE.SRGBColorSpace;
rr.toneMapping = S.renderer.toneMapping;
rr.toneMappingExposure = S.renderer.toneMappingExposure;

function localBox(mesh) {
  const pos = mesh.geometry.getAttribute('position');
  const b = new THREE.Box3();
  const v = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) b.expandByPoint(v.fromBufferAttribute(pos, i));
  return b;
}

const side = trailer.getObjectByName('SIDE_L');
if (!side) { out.push(['SIDE_L', false]); return out; }
const lb = localBox(side);
const foot = lb.min.y;         /* = pé da pele branca do bake (datum da sonda crua) */
const crest = lb.min.x;
const zLo = lb.min.z;          /* borda traseira da chapa */
out.push(['datum: pé da chapa (floorY mm)', mm(foot - S.trailerRig.profile.floorY)]);
out.push(['datum: crista x / zLo', `${crest.toFixed(4)} / ${zLo.toFixed(4)}`]);

trailer.updateWorldMatrix(true, true);
const M = trailer.matrixWorld;
const inv = M.clone().invert();
const ray = new THREE.Raycaster();

function firstHit(oLocal, dLocal, far) {
  ray.set(oLocal.clone().applyMatrix4(M), dLocal.clone().transformDirection(M));
  ray.far = far;
  return ray.intersectObjects([S.trailerGroup ?? trailer], true)
    .filter((hh) => hh.object.visible)[0] || null;
}

function summarize(rows) {
  const runs = [];
  let cur = null;
  for (const r of rows) {
    const [y, rest] = r.split(/:(.+)/);
    const key = rest.replace(/@-?\d+$/, (m) => `@${Math.round(Number(m.slice(1)) / 5) * 5}`);
    if (cur && cur.key === key) { cur.hi = y; } else { cur = { key, lo: y, hi: y }; runs.push(cur); }
  }
  return runs.map((r) => `${r.lo}..${r.hi}:${r.key}`).join(' | ');
}

function battery(tag) {
  /* Fatias horizontais na janela do canto. */
  for (const off of [0.02, 0.05, 0.10, 0.15, 0.20, 0.25]) {
    const z = zLo + off;
    const rows = [];
    const dir = new THREE.Vector3(1, 0, 0);
    for (let yMm = -140; yMm <= -60; yMm += 2) {
      const o3 = new THREE.Vector3(crest - 0.25, foot + yMm / 1000, z);
      const h = firstHit(o3, dir, 0.9);
      if (!h) { rows.push(`${yMm}:(vazio)`); continue; }
      const pl = h.point.clone().applyMatrix4(inv);
      const d = Math.round((pl.x - crest) * 1000);
      const m = Array.isArray(h.object.material) ? h.object.material[0] : h.object.material;
      rows.push(`${yMm}:${(m && m.name) || h.object.name}@${d}`);
    }
    out.push([`${tag} horiz z=+${Math.round(off * 1000)}mm`, summarize(rows)]);
  }
  /* Fan oblíquo baixo (viewer atrás-esquerda-abaixo), alvos por profundidade. */
  for (const [nome, psi, tilt] of [
    ['ψ25 sobe15', 25, 0.15], ['ψ25 sobe30', 25, 0.30],
    ['ψ45 sobe15', 45, 0.15], ['ψ45 sobe30', 45, 0.30],
  ]) {
    const th = (psi * Math.PI) / 180;
    const dir = new THREE.Vector3(Math.cos(th), tilt, Math.sin(th)).normalize();
    const rows = [];
    for (let yMm = -140; yMm <= -60; yMm += 4) {
      const hits = [];
      for (const off of [0.02, 0.08, 0.15, 0.22]) {
        const target = new THREE.Vector3(crest, foot + yMm / 1000, zLo + off);
        const o = target.clone().addScaledVector(dir, -0.9);
        const h = firstHit(o, dir, 1.8);
        if (!h) { hits.push(`${Math.round(off * 1000)}:VAZIO`); continue; }
        const pl = h.point.clone().applyMatrix4(inv);
        const d = Math.round((pl.x - crest) * 1000);
        const m = Array.isArray(h.object.material) ? h.object.material[0] : h.object.material;
        hits.push(`${Math.round(off * 1000)}:${(m && m.name) || h.object.name}@${d}`);
      }
      rows.push(`${yMm}[${hits.join(' ')}]`);
    }
    const runs = [];
    let cur = null;
    for (const r of rows) {
      const m2 = /^(-?\d+)\[(.*)\]$/.exec(r);
      if (cur && cur.key === m2[2]) cur.hi = m2[1];
      else { cur = { key: m2[2], lo: m2[1], hi: m2[1] }; runs.push(cur); }
    }
    out.push([`${tag} fan ${nome}`, runs.map((r2) => `${r2.lo}..${r2.hi}[${r2.key}]`).join(' | ')]);
  }
}

/* Foto do canto traseiro visto de baixo-atrás, moldura da sonda crua. */
function shootLow(tag, deg) {
  const uDir = new THREE.Vector3(0, 0, 1).transformDirection(M);
  const vDir = new THREE.Vector3(0, -1, 0).transformDirection(M);
  const nDir = new THREE.Vector3(-1, 0, 0).transformDirection(M);
  const c01 = new THREE.Vector3(crest, foot, zLo).applyMatrix4(M);
  const th = (deg * Math.PI) / 180;
  const vOut = new THREE.Vector3()
    .addScaledVector(nDir, Math.cos(th))
    .addScaledVector(uDir, -Math.sin(th))
    .addScaledVector(vDir, 0.15)
    .normalize();
  const centre = c01.clone().addScaledVector(uDir, 0.20).addScaledVector(vDir, 0.10);
  const w = 1.6, h = 0.8, ppm = 640;
  const wPx = Math.round(w * ppm), hPx = Math.round(h * ppm);
  rr.setSize(wPx, hPx, false);
  const cam = new THREE.OrthographicCamera(-w / 2, w / 2, h / 2, -h / 2, 0.05, 12);
  cam.position.copy(centre).addScaledVector(vOut, 5);
  cam.up.copy(vDir).negate();
  cam.lookAt(centre);
  cam.updateProjectionMatrix();
  cam.updateMatrixWorld(true);
  const lamp = new THREE.DirectionalLight(0xffffff, 2.5);
  lamp.position.copy(cam.position);
  lamp.target.position.copy(centre);
  const amb = new THREE.AmbientLight(0xffffff, 1.5);
  scene.add(lamp, lamp.target, amb);
  rr.render(scene, cam);
  scene.remove(lamp, lamp.target, amb);
  const cc = document.createElement('canvas');
  cc.width = wPx; cc.height = hPx;
  cc.getContext('2d').drawImage(canvas, 0, 0);
  out.push([tag, cc.toDataURL('image/png')]);
}

battery('COM-soleira');
shootLow('app-tras-baixo', 40);
shootLow('app-tras-baixo-60', 60);

/* Foto do MEIO da base, ortogonal — par da raw-meio da sonda crua. */
{
  const uDir = new THREE.Vector3(0, 0, 1).transformDirection(M);
  const vDir = new THREE.Vector3(0, -1, 0).transformDirection(M);
  const nDir = new THREE.Vector3(-1, 0, 0).transformDirection(M);
  const zMid = (lb.min.z + lb.max.z) / 2;
  const centre = new THREE.Vector3(crest, foot, zMid).applyMatrix4(M)
    .addScaledVector(vDir, 0.15);
  const w = 2.5, h = 0.9, ppm = 640;
  const wPx = Math.round(w * ppm), hPx = Math.round(h * ppm);
  rr.setSize(wPx, hPx, false);
  const cam = new THREE.OrthographicCamera(-w / 2, w / 2, h / 2, -h / 2, 0.05, 12);
  cam.position.copy(centre).addScaledVector(nDir, 5);
  cam.up.copy(vDir).negate();
  cam.lookAt(centre);
  cam.updateProjectionMatrix();
  cam.updateMatrixWorld(true);
  const lamp = new THREE.DirectionalLight(0xffffff, 2.5);
  lamp.position.copy(cam.position);
  lamp.target.position.copy(centre);
  const amb = new THREE.AmbientLight(0xffffff, 1.5);
  scene.add(lamp, lamp.target, amb);
  rr.render(scene, cam);
  scene.remove(lamp, lamp.target, amb);
  const cc = document.createElement('canvas');
  cc.width = wPx; cc.height = hPx;
  cc.getContext('2d').drawImage(canvas, 0, 0);
  out.push(['app-meio', cc.toDataURL('image/png')]);
}

const sills = ['LIVERY_SILL_L', 'LIVERY_SILL_R']
  .map((n) => trailer.getObjectByName(n)).filter(Boolean);
out.push(['soleiras presentes', sills.length]);
for (const s of sills) s.visible = false;
await B.frame();
battery('SEM-soleira');
shootLow('app-tras-baixo-SEM', 40);
for (const s of sills) s.visible = true;
await B.frame();

return out;
