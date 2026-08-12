/* VALIDAÇÃO DO CONSERTO DO RASGO em rows[0] (sliceRibbed, trailer-geometry).
   ---------------------------------------------------------------------------
   O defeito medido (checks-banda/checks-banda2, 2026-08-11): a pele
   paramétrica tinha um rasgo horizontal de 1-2 mm a 175 mm do pé da chapa
   (= rows[0], fronteira saia→ladrilho), atravessado pelo raio horizontal até
   o galvanizado da longarina a 66 mm e vazando para raios que sobem de baixo
   — a "linha preta" dos prints. O conserto recorta (em vez de descartar) os
   triângulos que cruzam rows[0]/rows[R].

   Critério de VAZAMENTO: qualquer raio da faixa 130..232 mm (horizontal) ou
   da janela equivalente (inclinado −20%, o ângulo de quem olha do chão) que
   acerte mais fundo que 20 mm da crista, ou nada. Verificado em BRANCO e
   PINTADO, em FÁBRICA e h300.

       node tools/studio-bench/bench.mjs --gpu --geometry --checks checks-banda-fix.mjs
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

function battery(tag, foto) {
  const trailer = S.trailer;
  trailer.updateWorldMatrix(true, true);
  const toLocal = trailer.matrixWorld.clone().invert();
  const mesh = trailer.getObjectByName('SIDE_L');
  if (!mesh) { out.push([`${tag}: SIDE_L`, false]); return; }
  const lb = localBox(mesh);
  const foot = lb.min.y, crest = lb.min.x;
  const zMid = (lb.min.z + lb.max.z) / 2;

  const visiveis = [];
  trailer.traverse((o) => { if (o.isMesh && shown(o)) visiveis.push(o); });

  const scan = (tiltY) => {
    const ray = new THREE.Raycaster();
    const dir = new THREE.Vector3(1, tiltY, 0).normalize()
      .transformDirection(trailer.matrixWorld);
    const leaks = [];
    let matSample = null;
    for (let yMm = 130; yMm <= 232; yMm += 1) {
      const o3 = new THREE.Vector3(crest - 0.25, foot + yMm / 1000, zMid)
        .applyMatrix4(trailer.matrixWorld);
      ray.set(o3, dir);
      ray.far = 0.8;
      const hit = ray.intersectObjects(visiveis, false)[0];
      if (!hit) { leaks.push(`${yMm}:(vazio)`); continue; }
      const pl = hit.point.clone().applyMatrix4(toLocal);
      const d = Math.round((pl.x - crest) * 1000);
      const m = Array.isArray(hit.object.material) ? hit.object.material[0] : hit.object.material;
      if (d > 20) leaks.push(`${yMm}:${hit.object.name}@${d}`);
      if (hit.object.name === 'SIDE_L') matSample = m?.name || '?';
    }
    return { leaks, matSample };
  };
  const h = scan(0);
  const t = scan(-0.2);
  out.push([`${tag}: sem vazamento no raio horizontal (130..232 mm)`,
    h.leaks.length === 0 ? true : h.leaks]);
  out.push([`${tag}: sem vazamento no raio de baixo (−20%)`,
    t.leaks.length === 0 ? true : t.leaks]);
  out.push([`${tag}: material da chapa no ponto`, h.matSample]);

  /* Cobertura da pele lateral por triângulo, 100..320 mm: nenhum vão. */
  {
    const pos = mesh.geometry.getAttribute('position');
    const nor = mesh.geometry.getAttribute('normal');
    const idx = mesh.geometry.index ? mesh.geometry.index.array : null;
    const tris = Math.floor((idx ? idx.length : pos.count) / 3);
    const y0 = foot + 0.10, y1 = foot + 0.32;
    const N = Math.round((y1 - y0) * 1000);
    const cov = new Uint8Array(N + 1);
    for (let k = 0; k < tris; k++) {
      const i0 = idx ? idx[k * 3] : k * 3, i1 = idx ? idx[k * 3 + 1] : k * 3 + 1,
        i2 = idx ? idx[k * 3 + 2] : k * 3 + 2;
      const nx = (nor.getX(i0) + nor.getX(i1) + nor.getX(i2)) / 3;
      if (Math.abs(nx) < 0.5) continue;
      const zs = [pos.getZ(i0), pos.getZ(i1), pos.getZ(i2)];
      if (Math.min(...zs) > zMid + 0.5 || Math.max(...zs) < zMid - 0.5) continue;
      const ys = [pos.getY(i0), pos.getY(i1), pos.getY(i2)];
      const a = Math.max(0, Math.ceil((Math.min(...ys) - y0) * 1000));
      const b = Math.min(N, Math.floor((Math.max(...ys) - y0) * 1000));
      for (let q = a; q <= b; q++) cov[q] = 1;
    }
    const gaps = [];
    let g0 = null;
    for (let q = 0; q <= N; q++) {
      if (!cov[q]) { if (g0 === null) g0 = q; }
      else if (g0 !== null) { gaps.push([g0 + 100, q - 1 + 100]); g0 = null; }
    }
    if (g0 !== null) gaps.push([g0 + 100, N + 100]);
    out.push([`${tag}: pele lateral sem vão (100..320 mm)`, gaps.length === 0 ? true : gaps]);
  }

  if (foto) {
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
    out.push([`${tag}-close`, cc.toDataURL('image/png')]);
  }
}

battery('fabrica-branco', true);

S.models.setPaintTarget('both');
await B.frame(); await B.frame();
battery('fabrica-pintado', true);

S.models.setPaintTarget('cab');
await B.frame();

S.measures.setImplementMeasures({ height: 3.0 });
out.push(['h300: resize assentou', await B.until(() => {
  const d = S.trailerDims;
  return !!d && Math.abs(d.height - 3.0) < 0.06;
}, 60000)]);
await B.frame(); await B.frame();
battery('h300-branco', false);

S.models.setPaintTarget('both');
await B.frame(); await B.frame();
battery('h300-pintado', true);

return out;
