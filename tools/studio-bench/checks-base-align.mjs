/* SILHUETA INFERIOR das três faces — quinas e meio, fábrica e h2,60.
   ---------------------------------------------------------------------------
   Relato (4 prints, 2026-08-11): a base LATERAL lê mais FUNDA que os frames
   frontal/traseiro — a soleira sintetizada desce ~52-55 mm abaixo da cota onde
   testeira/traseira terminam. Esta sonda levanta os FATOS antes do conserto:

     1. PERFIL POR RAIO (bandas por objeto+material, passo 1 mm em Y, LOCAL do
        rig) da faixa de base: LATERAL na quina dianteira, no MEIO e na quina
        traseira; TESTEIRA na quina e no meio; TRASEIRA na quina e no meio.
        Profundidade relatada em mm RELATIVA à crista da chapa da face.
     2. Sonda de VAZAMENTO da fresta original (−92..−127 rel. piso, atrás do
        trilho): raio horizontal, de baixo (+20%) e de cima (−20%) — quem cada
        raio acerta e a que profundidade da crista.
     3. A/B do HEM: a cunha trilho↔parede sondada com raios rasantes de cima
        (−30%/−50%) COM e SEM os LIVERY_HEM_[LR], para saber se a dobra própria
        do bake (+104..+112) já fecha o traço.
     4. Fotos dos 4 cantos (diant/tras × fábrica/h2,60), mesma moldura dos
        prints do usuário (checks-corner-260).
     5. SILHUETA OBLÍQUA do canto dianteiro (feedback 2, prints oblíquos):
        fan de raios em ψ 25°/40°/55° da normal da lateral, horizontais e
        descendo 15 %, classificando cada acerto em CLARO/escuro pelo albedo
        do material — o pé do elemento CLARO mais baixo de cada face é a
        silhueta que o olho lê. Critério: |Δ| ≤ 12 mm entre LAT e TESTEIRA.
        Mais fotos oblíquas (ψ 40°/60°, de cima) do canto.
     6. REBITES até o último friso: a grade publicada tem de conter a fileira
        k = −1 (centro ≈ +168 mm do pé, acima do trilho) — e um close da
        emenda no pé para o olho.

   Roda:  node tools/studio-bench/bench.mjs --gpu --geometry --checks checks-base-align.mjs
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
const prof = S.trailerRig.profile;
const mm = (v) => Math.round(v * 1000);

const canvas = document.createElement('canvas');
const rr = new THREE.WebGLRenderer({ canvas, antialias: true, preserveDrawingBuffer: true });
rr.setPixelRatio(1);
rr.outputColorSpace = THREE.SRGBColorSpace;
rr.toneMapping = S.renderer.toneMapping;
rr.toneMappingExposure = S.renderer.toneMappingExposure;

function localBoxOf(name) {
  const mesh = S.trailer?.getObjectByName(name);
  if (!mesh) return null;
  const pos = mesh.geometry.getAttribute('position');
  const b = new THREE.Box3();
  const v = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) b.expandByPoint(v.fromBufferAttribute(pos, i));
  return b;
}

/* Perfil por raio em LOCAL do rig (o conjunto gira no engate). */
function profileOf(mk, y0, y1, depthAxis) {
  const root = S.trailer;
  root.updateWorldMatrix(true, true);
  const M = root.matrixWorld;
  const inv = M.clone().invert();
  const ray = new THREE.Raycaster();
  ray.far = 6;
  const steps = [];
  for (let y = y0; y <= y1 + 1e-9; y += 0.001) {
    const { o, d } = mk(y);
    ray.set(o.clone().applyMatrix4(M), d.clone().transformDirection(M));
    const h = ray.intersectObjects([S.trailerGroup ?? S.trailer], true)
      .filter((hh) => hh.object.visible)[0];
    if (!h || h.distance > 2.6) { steps.push(null); continue; }
    const mat = Array.isArray(h.object.material) ? h.object.material[0] : h.object.material;
    const p = h.point.clone().applyMatrix4(inv);
    steps.push({ y, who: `${h.object.name || '(sem nome)'}·${(mat && mat.name) || '?'}`, d: p[depthAxis] });
  }
  const bands = [];
  let cur = null;
  for (const s of steps) {
    if (!s) { cur = null; continue; }
    if (cur && cur.who === s.who) {
      cur.hi = s.y;
      if (s.d < cur.dLo) cur.dLo = s.d;
      if (s.d > cur.dHi) cur.dHi = s.d;
    } else {
      cur = { who: s.who, lo: s.y, hi: s.y, dLo: s.d, dHi: s.d };
      bands.push(cur);
    }
  }
  return bands;
}

function reportBands(tag, face, bands, crest, sgn) {
  const { floorY } = prof;
  out.push([`${tag} · ${face}: bandas`, bands.length]);
  for (const b of bands) {
    /* Profundidade rel. crista, positiva para DENTRO. */
    const dA = Math.round((crest - b.dHi) * sgn * -1000) * -1;
    const dB = Math.round((crest - b.dLo) * sgn * -1000) * -1;
    const lo = Math.min(dA, dB), hi = Math.max(dA, dB);
    out.push([`  ${tag} ${face}`, `${b.who} y ${mm(b.lo - floorY)}..${mm(b.hi - floorY)}`
      + ` prof ${lo}..${hi}`]);
  }
}

/* Sonda de vazamento no estilo checks-banda-fix: origem FORA do baú, raio
   para DENTRO; tilt + sobe (quem olha do chão), tilt − desce (quem olha de
   cima). Profundidade positiva = para dentro da crista. */
function leakScan(zLocal, yLoMm, yHiMm, tiltY, crest, sgnOut) {
  const root = S.trailer;
  root.updateWorldMatrix(true, true);
  const M = root.matrixWorld;
  const inv = M.clone().invert();
  const ray = new THREE.Raycaster();
  const dir = new THREE.Vector3(-sgnOut, tiltY, 0).normalize().transformDirection(M);
  const rows = [];
  const { floorY } = prof;
  for (let yMm = yLoMm; yMm <= yHiMm; yMm += 2) {
    const o3 = new THREE.Vector3(crest + sgnOut * 0.25, floorY + yMm / 1000, zLocal)
      .applyMatrix4(M);
    ray.set(o3, dir);
    ray.far = 0.9;
    const h = ray.intersectObjects([S.trailerGroup ?? S.trailer], true)
      .filter((hh) => hh.object.visible)[0];
    if (!h) { rows.push(`${yMm}:(vazio)`); continue; }
    const pl = h.point.clone().applyMatrix4(inv);
    const d = Math.round((pl.x - crest) * -sgnOut * 1000);
    rows.push(`${yMm}:${h.object.name || '?'}@${d}`);
  }
  return rows;
}

function summarize(rows) {
  /* Agrupa em corridas "quem@prof" para o relatório não explodir. */
  const runs = [];
  let cur = null;
  for (const r of rows) {
    const [y, rest] = r.split(/:(.+)/);
    const key = rest.replace(/@-?\d+$/, (m) => `@${Math.round(Number(m.slice(1)) / 5) * 5}`);
    if (cur && cur.key === key) { cur.hi = y; } else { cur = { key, lo: y, hi: y }; runs.push(cur); }
  }
  return runs.map((r) => `${r.lo}..${r.hi}:${r.key}`).join(' | ');
}

function frameOf() {
  const mesh = S.trailer?.getObjectByName('SIDE_L');
  if (!mesh) return null;
  const uv = mesh.geometry.getAttribute('uv1');
  const pos = mesh.geometry.getAttribute('position');
  if (!uv || !pos) return null;
  mesh.updateWorldMatrix(true, false);
  const cornerOf = (u, vv) => {
    let best = Infinity, bi = -1;
    for (let i = 0; i < uv.count; i++) {
      const du = uv.getX(i) - u, dv = uv.getY(i) - vv;
      const d = du * du + dv * dv;
      if (d < best) { best = d; bi = i; }
    }
    return new THREE.Vector3().fromBufferAttribute(pos, bi).applyMatrix4(mesh.matrixWorld);
  };
  const c00 = cornerOf(0, 0), c10 = cornerOf(1, 0), c11 = cornerOf(1, 1), c01 = cornerOf(0, 1);
  const uDir = new THREE.Vector3().subVectors(c10, c00).normalize();
  const vDir = new THREE.Vector3().subVectors(c11, c10).normalize();
  const nDir = new THREE.Vector3().crossVectors(vDir, uDir).normalize();
  return { c01, c11, uDir, vDir, nDir };
}

function shoot(tag, end) {
  const f = frameOf();
  if (!f) return;
  const { c01, c11, uDir, vDir, nDir } = f;
  const dir = end === 'tras'
    ? new THREE.Vector3().subVectors(nDir, uDir).normalize()
    : new THREE.Vector3().addVectors(nDir, uDir).normalize();
  const anchor = end === 'tras' ? c01 : c11;
  const along = end === 'tras' ? 0.25 : -0.25;
  const w = 2.0, h = 1.3, ppm = 640;
  const centre = anchor.clone().addScaledVector(uDir, along).addScaledVector(vDir, 0.22);
  const wPx = Math.round(w * ppm), hPx = Math.round(h * ppm);
  rr.setSize(wPx, hPx, false);
  const cam = new THREE.OrthographicCamera(-w / 2, w / 2, h / 2, -h / 2, 0.05, 12);
  cam.position.copy(centre).addScaledVector(dir, 5);
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
  out.push([`${tag}-canto-${end}`, cc.toDataURL('image/png')]);
}

async function battery(tag) {
  await B.frame(); await B.frame();
  const d = S.trailerDims;
  out.push([`${tag}: dims efetivas`, `h ${mm(d.height)} · c ${mm(d.length)}`]);
  const { floorY, z1 } = prof;
  const zRear = z1 - d.length;
  const zMid = z1 - d.length / 2;
  const y0 = floorY - 0.26, y1 = floorY + 0.16;

  const lbL = localBoxOf('SIDE_L');
  const lbR2 = localBoxOf('REAR');
  if (!lbL || !lbR2) { out.push([`${tag}: chapas SIDE_L/REAR`, false]); return; }
  const crestL = lbL.min.x;               /* lado ESQUERDO: fora é −x */
  const crestRear = lbR2.min.z;
  out.push([`${tag}: pé da chapa SIDE_L (mm rel. piso)`, mm(lbL.min.y - floorY)]);

  /* 1. Silhueta da LATERAL esquerda: quina dianteira, meio, quina traseira. */
  for (const [nome, z] of [['LAT-diant', z1 - 0.35], ['LAT-meio', zMid], ['LAT-tras', zRear + 0.35]]) {
    reportBands(tag, nome, profileOf((y) => ({
      o: new THREE.Vector3(-2.4, y, z), d: new THREE.Vector3(1, 0, 0),
    }), y0, y1, 'x'), crestL, -1);
  }
  /* TESTEIRA: quina e meio (frente é z1; fora é +z). */
  for (const [nome, x] of [['TEST-quina', -1.12], ['TEST-meio', 0]]) {
    reportBands(tag, nome, profileOf((y) => ({
      o: new THREE.Vector3(x, y, z1 + 2.4), d: new THREE.Vector3(0, 0, -1),
    }), y0, y1, 'z'), z1, 1);
  }
  /* TRASEIRA: quina e meio (fora é −z; crista = chapa REAR). */
  for (const [nome, x] of [['TRAS-quina', -1.28], ['TRAS-meio', 0]]) {
    reportBands(tag, nome, profileOf((y) => ({
      o: new THREE.Vector3(x, y, zRear - 2.4), d: new THREE.Vector3(0, 0, 1),
    }), y0, y1, 'z'), crestRear, -1);
  }

  /* 2. Fresta original (−92..−127 rel. piso): vazamento por 3 inclinações. */
  for (const [nome, tilt] of [['horiz', 0], ['de baixo +20%', 0.2], ['de cima −20%', -0.2]]) {
    const rows = leakScan(zMid, -150, -80, tilt, crestL, -1);
    out.push([`${tag}: fresta ${nome}`, summarize(rows)]);
  }

  /* 3. Cunha do topo do trilho, COM e SEM hem — e o A/B do que o bake tem
     sozinho: perfil horizontal do topo do trilho SEM hem, e a fresta SEM a
     soleira (o vão cru que ela tem de cobrir). */
  const hems = ['LIVERY_HEM_L', 'LIVERY_HEM_R']
    .map((n) => S.trailer?.getObjectByName(n)).filter(Boolean);
  out.push([`${tag}: hems presentes`, hems.length]);
  for (const [nome, tilt] of [['horiz', 0], ['−30%', -0.3], ['−50%', -0.5]]) {
    out.push([`${tag}: cunha COM hem ${nome}`,
      summarize(leakScan(zMid, 88, 135, tilt, crestL, -1))]);
  }
  for (const h of hems) h.visible = false;
  await B.frame();
  for (const [nome, tilt] of [['horiz', 0], ['−30%', -0.3], ['−50%', -0.5]]) {
    out.push([`${tag}: cunha SEM hem ${nome}`,
      summarize(leakScan(zMid, 88, 135, tilt, crestL, -1))]);
  }
  for (const h of hems) h.visible = true;
  await B.frame();

  const sills = ['LIVERY_SILL_L', 'LIVERY_SILL_R']
    .map((n) => S.trailer?.getObjectByName(n)).filter(Boolean);
  for (const s of sills) s.visible = false;
  await B.frame();
  for (const [nome, tilt] of [['horiz', 0], ['de baixo +20%', 0.2]]) {
    out.push([`${tag}: fresta SEM soleira ${nome}`,
      summarize(leakScan(zMid, -150, -80, tilt, crestL, -1))]);
  }
  for (const s of sills) s.visible = true;
  await B.frame();

  /* 5. Silhueta OBLÍQUA do canto dianteiro. Raios em LOCAL do rig; o pé
     aparente de cada face é o menor y de um acerto CLARO perto da pele. */
  const lightOf = (hit) => {
    const m = Array.isArray(hit.object.material) ? hit.object.material[0] : hit.object.material;
    const name = (m && m.name) || '';
    if (/preto|borracha|plastico|vidro/i.test(name)) return false;
    const c = m && m.color;
    const lum = c ? c.r * 0.3 + c.g * 0.59 + c.b * 0.11 : 0;
    return lum > 0.22 || /branco|galvanizado|inox|arremate/i.test(name);
  };
  {
    const root = S.trailer;
    root.updateWorldMatrix(true, true);
    const M4 = root.matrixWorld;
    const inv = M4.clone().invert();
    const ray = new THREE.Raycaster();
    ray.far = 2.2;
    const zF = lbL.max.z;
    for (const [tName, tilt] of [['horiz', 0], ['de cima −15%', 0.15]]) {
      for (const deg of [25, 40, 55]) {
        const th = (deg * Math.PI) / 180;
        const D = new THREE.Vector3(Math.cos(th), -tilt, -Math.sin(th)).normalize();
        const dW = D.clone().transformDirection(M4);
        let loLat = Infinity, loTest = Infinity;
        let whoLat = '', whoTest = '';
        for (let yMm = -170; yMm <= -80; yMm += 2) {
          const y = floorY + yMm / 1000;
          for (const off of [0.03, 0.10, 0.20, 0.35]) {
            for (const aim of [
              new THREE.Vector3(crestL, y, zF - off),
              new THREE.Vector3(crestL + off, y, zF),
            ]) {
              const o = aim.clone().addScaledVector(D, -0.8).applyMatrix4(M4);
              ray.set(o, dW);
              const h = ray.intersectObjects([S.trailerGroup ?? S.trailer], true)
                .filter((hh) => hh.object.visible)[0];
              if (!h || !lightOf(h)) continue;
              const p = h.point.clone().applyMatrix4(inv);
              if (p.x - crestL < 0.12 && p.z < zF - 0.015) {
                if (p.y < loLat) { loLat = p.y; whoLat = h.object.name || '?'; }
              } else if (p.z > zF - 0.015 && p.x - crestL < 0.60) {
                if (p.y < loTest) { loTest = p.y; whoTest = h.object.name || '?'; }
              }
            }
          }
        }
        const okBoth = isFinite(loLat) && isFinite(loTest);
        const dMm = okBoth ? (loLat - loTest) * 1000 : null;
        out.push([`${tag}: oblíqua ψ${deg}° ${tName} — pé claro LAT `
          + `${isFinite(loLat) ? mm(loLat - floorY) : '—'} (${whoLat}) · TEST `
          + `${isFinite(loTest) ? mm(loTest - floorY) : '—'} (${whoTest})`,
        okBoth && Math.abs(dMm) <= 12 ? true : (dMm === null ? false : Math.round(dMm))]);
      }
    }
  }

  /* 6. Rebites até o último friso: fileira k=−1 na grade publicada. */
  {
    const grid = S.models && S.models.getPlateGrid ? S.models.getPlateGrid() : null;
    if (!grid || !grid.rivetRowsFromBottom.length) {
      out.push([`${tag}: grade de rebites publicada`, false]);
    } else {
      const lo = Math.min(...grid.rivetRowsFromBottom);
      out.push([`${tag}: fileira k=−1 no último friso (m do pé, esperado ~0,168)`,
        lo > 0.14 && lo < 0.19 ? true : lo]);
      out.push([`${tag}: fileiras de rebite`, grid.rivetRowsFromBottom.length]);
    }
  }

  /* 4. Fotos dos cantos + oblíquas + close da emenda no pé. */
  shoot(tag, 'diant');
  shoot(tag, 'tras');
  shootOblique(tag, 40);
  shootOblique(tag, 60);
  shootSeamFoot(tag);
}

/* Foto oblíqua do canto dianteiro: viewer na frente-esquerda, de cima. */
function shootOblique(tag, deg) {
  const f = frameOf();
  if (!f) return;
  const { c11, uDir, vDir, nDir } = f;
  const th = (deg * Math.PI) / 180;
  const vOut = new THREE.Vector3()
    .addScaledVector(nDir, Math.cos(th))
    .addScaledVector(uDir, Math.sin(th))
    .addScaledVector(vDir, -0.15)
    .normalize();
  const w = 1.6, h = 0.7, ppm = 640;
  const centre = c11.clone().addScaledVector(vDir, 0.08).addScaledVector(uDir, -0.15);
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
  out.push([`${tag}-obliqua-${deg}`, cc.toDataURL('image/png')]);
}

/* Close ortogonal da emenda do meio no PÉ da chapa — o rebite do último
   friso (k=−1) tem de aparecer logo acima do trilho. */
function shootSeamFoot(tag) {
  const f = frameOf();
  const grid = S.models && S.models.getPlateGrid ? S.models.getPlateGrid() : null;
  if (!f || !grid || !grid.seamsFromFront.length) return;
  const { c11, uDir, vDir, nDir } = f;
  const seam = grid.seamsFromFront[Math.floor(grid.seamsFromFront.length / 2)];
  const w = 0.5, h = 0.42, ppm = 1200;
  const centre = c11.clone().addScaledVector(uDir, -seam).addScaledVector(vDir, -0.16);
  const wPx = Math.round(w * ppm), hPx = Math.round(h * ppm);
  rr.setSize(wPx, hPx, false);
  const cam = new THREE.OrthographicCamera(-w / 2, w / 2, h / 2, -h / 2, 0.05, 12);
  cam.position.copy(centre).addScaledVector(nDir, 4);
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
  out.push([`${tag}-emenda-pe`, cc.toDataURL('image/png')]);
}

await battery('fabrica');
{
  const h = 2.60;
  S.measures.setImplementMeasures({ height: h });
  const snapped = S.trailerRig.snapHeight(h);
  const ok = await B.until(() => {
    const d = S.trailerDims;
    return !!d && Math.abs(d.height - snapped) < 0.002;
  }, 60000);
  out.push([`h260: resize assentou (snap ${mm(snapped)})`, ok]);
  await battery('h260');
}

return out;
