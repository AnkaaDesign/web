/* SONDA FINA DO RASGO a ~175 mm do pé da chapa (segunda rodada).
   ---------------------------------------------------------------------------
   A rodada 1 (checks-banda.mjs) mediu: pele SIDE_L contínua 180..620 mm e
   140..170 mm, RASGO a ~175 mm atravessado até galvanizado a 66 mm; trilho
   inferior NÃO se move no resize (−145..190 constante); só a peça _0_11
   [inox-ferragem, 68 mm atrás] se move. Esta rodada responde:

     1. bordas exatas do rasgo (varredura de 1 mm, 130..230 mm);
     2. o bake ORIGINAL (malhas brancas ESCONDIDAS) tem pele/dobra ali?
        (raio horizontal E inclinado ±20°, que pega dobra horizontal);
     3. a sopa SIDE_L: cobertura em y dos triângulos VOLTADOS PARA O LADO
        (|nx|>0,5) — vãos exatos entre 100 e 320 mm;
     4. o corpo paramétrico remanescente: triângulos no flanco (x<crista+0,3)
        cruzando 160..200 mm — profundidade e normal (a dobra que ficou fora
        do slab, se existir);
     5. foto de perto (0..300 mm) para o olho.

       node tools/studio-bench/bench.mjs --gpu --geometry --checks checks-banda2.mjs
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
const mm = (v) => Math.round(v * 1000);

const canvas = document.createElement('canvas');
const rr = new THREE.WebGLRenderer({ canvas, antialias: true, preserveDrawingBuffer: true });
rr.setPixelRatio(1);
rr.outputColorSpace = THREE.SRGBColorSpace;
rr.toneMapping = S.renderer.toneMapping;
rr.toneMappingExposure = S.renderer.toneMappingExposure;

function shown(o) {
  for (let p = o; p; p = p.parent) if (p.visible === false) return false;
  return true;
}
function localBox(mesh) {
  const pos = mesh.geometry.getAttribute('position');
  const b = new THREE.Box3();
  const v = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) b.expandByPoint(v.fromBufferAttribute(pos, i));
  return b;
}

const trailer = S.trailer;
trailer.updateWorldMatrix(true, true);
const toLocal = trailer.matrixWorld.clone().invert();
const mesh = trailer.getObjectByName('SIDE_L');
const lb = localBox(mesh);
const foot = lb.min.y, crest = lb.min.x;
const zMid = (lb.min.z + lb.max.z) / 2;

/* ---- 1+2. VARREDURA FINA, visível E bake original escondido ------------- */
function fineScan(targets, label, tiltY) {
  const ray = new THREE.Raycaster();
  const dirL = new THREE.Vector3(1, tiltY, 0).normalize();
  const dir = dirL.clone().transformDirection(trailer.matrixWorld);
  const rows = [];
  for (let yMm = 128; yMm <= 232; yMm += 1) {
    const y = foot + yMm / 1000;
    /* Puxa a origem para trás o bastante para o tilt não mudar a altura de
       chegada de forma relevante (0,25 m fora × tan(11°) ≈ 49 mm — reporta o
       y DO PONTO DE IMPACTO, não o do lançamento). */
    const o3 = new THREE.Vector3(crest - 0.25, y, zMid).applyMatrix4(trailer.matrixWorld);
    ray.set(o3, dir);
    ray.far = 0.8;
    const hit = ray.intersectObjects(targets, false)[0];
    if (!hit) { rows.push({ yMm, key: '(vazio)', d: null, yHit: null }); continue; }
    const m = Array.isArray(hit.object.material) ? hit.object.material[0] : hit.object.material;
    const pl = hit.point.clone().applyMatrix4(toLocal);
    rows.push({
      yMm, key: `${hit.object.name || '(sem nome)'} [${m?.name || '?'}]`,
      d: Math.round((pl.x - crest) * 1000), yHit: mm(pl.y - foot),
    });
  }
  const bands = [];
  for (const r of rows) {
    const last = bands[bands.length - 1];
    if (last && last.key === r.key) {
      last.to = r.yMm;
      if (r.d !== null) {
        last.dMin = Math.min(last.dMin ?? r.d, r.d);
        last.dMax = Math.max(last.dMax ?? r.d, r.d);
        last.yHit1 = r.yHit;
      }
    } else {
      bands.push({ key: r.key, from: r.yMm, to: r.yMm, dMin: r.d, dMax: r.d, yHit0: r.yHit, yHit1: r.yHit });
    }
  }
  out.push([label, bands.map((b) => `${b.from}..${b.to}: ${b.key}`
    + (b.dMin !== null && b.dMin !== undefined ? ` @${b.dMin}..${b.dMax}`
      + (b.yHit0 !== null && Math.abs(b.yHit0 - b.from) > 2 ? ` (yImpacto ${b.yHit0}..${b.yHit1})` : '') : ''))]);
}

const visiveis = [];
trailer.traverse((o) => { if (o.isMesh && shown(o)) visiveis.push(o); });
const ocultosBrancos = [];
trailer.traverse((o) => {
  if (!o.isMesh || shown(o)) return;
  const mats = Array.isArray(o.material) ? o.material : [o.material];
  if (mats.some((m) => m && /cor_padrao_branco/i.test(m.name || ''))) ocultosBrancos.push(o);
});
out.push(['malhas brancas escondidas (bake original)', ocultosBrancos.length]);

fineScan(visiveis, 'VISÍVEL, raio horizontal (mm do pé: quem, prof mm)', 0);
fineScan(visiveis, 'VISÍVEL, raio inclinado −20% (pega dobra horizontal por baixo)', -0.2);
fineScan(visiveis, 'VISÍVEL, raio inclinado +20% (por cima)', 0.2);
if (ocultosBrancos.length) {
  fineScan(ocultosBrancos, 'BAKE ORIGINAL branco escondido, horizontal', 0);
  fineScan(ocultosBrancos, 'BAKE ORIGINAL branco escondido, −20%', -0.2);
  fineScan(ocultosBrancos, 'BAKE ORIGINAL branco escondido, +20%', 0.2);
}

/* ---- 3. COBERTURA em y dos triângulos laterais da sopa SIDE_L ----------- */
{
  const pos = mesh.geometry.getAttribute('position');
  const nor = mesh.geometry.getAttribute('normal');
  const idx = mesh.geometry.index ? mesh.geometry.index.array : null;
  const tris = Math.floor((idx ? idx.length : pos.count) / 3);
  const y0 = foot + 0.10, y1 = foot + 0.32;
  const N = Math.round((y1 - y0) * 1000);
  const cov = new Uint8Array(N + 1);
  for (let t = 0; t < tris; t++) {
    const i0 = idx ? idx[t * 3] : t * 3, i1 = idx ? idx[t * 3 + 1] : t * 3 + 1,
      i2 = idx ? idx[t * 3 + 2] : t * 3 + 2;
    const nx = (nor.getX(i0) + nor.getX(i1) + nor.getX(i2)) / 3;
    if (Math.abs(nx) < 0.5) continue;                 // só a pele que olha o lado
    const zs = [pos.getZ(i0), pos.getZ(i1), pos.getZ(i2)];
    if (Math.min(...zs) > zMid + 0.5 || Math.max(...zs) < zMid - 0.5) continue;
    const ys = [pos.getY(i0), pos.getY(i1), pos.getY(i2)];
    const a = Math.max(0, Math.ceil((Math.min(...ys) - y0) * 1000));
    const b = Math.min(N, Math.floor((Math.max(...ys) - y0) * 1000));
    for (let k = a; k <= b; k++) cov[k] = 1;
  }
  const gaps = [];
  let g0 = null;
  for (let k = 0; k <= N; k++) {
    if (!cov[k]) { if (g0 === null) g0 = k; }
    else if (g0 !== null) { gaps.push([g0 + 100, k - 1 + 100]); g0 = null; }
  }
  if (g0 !== null) gaps.push([g0 + 100, N + 100]);
  out.push(['SIDE_L: vãos de cobertura da pele lateral, 100..320 mm do pé (mm)', gaps]);
}

/* ---- 4. O que o corpo paramétrico AINDA TEM no flanco em 150..210 mm ---- */
{
  const found = [];
  trailer.traverse((o) => {
    if (!o.isMesh || !shown(o)) return;
    if (/^(SIDE_L|SIDE_R|REAR)$/.test(o.name || '')) return;
    const mats = Array.isArray(o.material) ? o.material : [o.material];
    if (!mats.some((m) => m && /cor_padrao_branco/i.test(m.name || ''))) return;
    const pos = o.geometry?.getAttribute?.('position');
    const nor = o.geometry?.getAttribute?.('normal');
    if (!pos) return;
    o.updateWorldMatrix(true, false);
    const M = toLocal.clone().multiply(o.matrixWorld);
    const idx = o.geometry.index ? o.geometry.index.array : null;
    const tris = Math.floor((idx ? idx.length : pos.count) / 3);
    const v = new THREE.Vector3();
    let n = 0;
    const sample = [];
    for (let t = 0; t < tris; t++) {
      const i0 = idx ? idx[t * 3] : t * 3, i1 = idx ? idx[t * 3 + 1] : t * 3 + 1,
        i2 = idx ? idx[t * 3 + 2] : t * 3 + 2;
      let yLo = Infinity, yHi = -Infinity, xLo = Infinity, xHi = -Infinity,
        zLo = Infinity, zHi = -Infinity;
      for (const i of [i0, i1, i2]) {
        v.fromBufferAttribute(pos, i).applyMatrix4(M);
        yLo = Math.min(yLo, v.y); yHi = Math.max(yHi, v.y);
        xLo = Math.min(xLo, v.x); xHi = Math.max(xHi, v.x);
        zLo = Math.min(zLo, v.z); zHi = Math.max(zHi, v.z);
      }
      if (yHi < foot + 0.15 || yLo > foot + 0.21) continue;
      if (xLo > crest + 0.30) continue;
      if (zHi < zMid - 2 || zLo > zMid + 2) continue;
      n++;
      if (sample.length < 6) {
        sample.push({
          y_mm: [mm(yLo - foot), mm(yHi - foot)],
          x_mm: [Math.round((xLo - crest) * 1000), Math.round((xHi - crest) * 1000)],
          ny: nor ? +((nor.getY(i0) + nor.getY(i1) + nor.getY(i2)) / 3).toFixed(2) : null,
        });
      }
    }
    if (n) found.push({ nome: o.name || '(sem nome)', tris: n, amostra: sample });
  });
  out.push(['corpo branco visível: triângulos no flanco em 150..210 mm', found.length ? found : '(nenhum)']);
}

/* ---- 5. Foto de perto: 0..300 mm, meio do baú --------------------------- */
{
  const uv = mesh.geometry.getAttribute('uv1');
  const pos = mesh.geometry.getAttribute('position');
  mesh.updateWorldMatrix(true, false);
  const corner = (u, vv) => {
    let best = Infinity, bi = -1;
    for (let i = 0; i < uv.count; i++) {
      const du = uv.getX(i) - u, dv = uv.getY(i) - vv;
      const d = du * du + dv * dv;
      if (d < best) { best = d; bi = i; }
    }
    return new THREE.Vector3().fromBufferAttribute(pos, bi).applyMatrix4(mesh.matrixWorld);
  };
  const c00 = corner(0, 0), c10 = corner(1, 0), c11 = corner(1, 1);
  const uD = new THREE.Vector3().subVectors(c10, c00);
  const len = uD.length(); uD.normalize();
  const vD = new THREE.Vector3().subVectors(c11, c10);
  const hgt = vD.length(); vD.normalize();
  const nD = new THREE.Vector3().crossVectors(vD, uD).normalize();
  const w2 = 1.6, h2 = 0.34, ppm = 1600;
  const centre = c00.clone().addScaledVector(uD, len / 2)
    .addScaledVector(vD, hgt - 0.31 + h2 / 2);
  const wPx = Math.round(w2 * ppm), hPx = Math.round(h2 * ppm);
  rr.setSize(wPx, hPx, false);
  const cam = new THREE.OrthographicCamera(-w2 / 2, w2 / 2, h2 / 2, -h2 / 2, 0.05, 9);
  cam.position.copy(centre).addScaledVector(nD, 4);
  cam.up.copy(vD).negate();
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
  out.push(['rasgo-close', cc.toDataURL('image/png')]);
}

return out;
