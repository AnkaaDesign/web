/* SONDA DA BANDA BAIXA DA LATERAL — quem forma a faixa abaixo da linha?
   ---------------------------------------------------------------------------
   Pergunta do print de 2026-08-11: há uma LINHA horizontal a ~335 mm do pé da
   chapa e a faixa abaixo dela parece componente separado (sem rebite, sem
   remonte). Duas hipóteses em disputa:

     A. a parede branca ali é RECUADA (~63-76 mm) e o slab de 40 mm do
        buildLiveryPanels() a deixa no corpo — a linha é a fronteira
        chapa×corpo;
     B. o trilho inferior/frame da base está sendo MAPEADO PARA BAIXO no
        resize e a linha é o LUGAR onde o topo dele deveria estar.

   Esta sonda mede as duas: varredura por raio (coluna vertical, coordenada
   LOCAL do trailer — o conjunto gira no engate), inventário do trilho
   inferior (y absoluto local em fábrica vs h300 vs h250), histograma da pele
   branca e fotos. NÃO conserta nada.

       node tools/studio-bench/bench.mjs --gpu --geometry --checks checks-banda.mjs
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

function cornerOf(mesh, u, v) {
  const uv = mesh.geometry.getAttribute('uv1');
  const pos = mesh.geometry.getAttribute('position');
  if (!uv || !pos) return null;
  mesh.updateWorldMatrix(true, false);
  let best = Infinity, bi = -1;
  for (let i = 0; i < uv.count; i++) {
    const du = uv.getX(i) - u, dv = uv.getY(i) - v;
    const d = du * du + dv * dv;
    if (d < best) { best = d; bi = i; }
  }
  const p = new THREE.Vector3().fromBufferAttribute(pos, bi).applyMatrix4(mesh.matrixWorld);
  return { p, erroUV: Math.sqrt(best) };
}

const mm = (v) => Math.round(v * 1000);

async function battery(tag) {
  const trailer = S.trailer;
  if (!trailer) { out.push([`${tag}: trailer`, false]); return; }
  trailer.updateWorldMatrix(true, true);
  const toLocal = trailer.matrixWorld.clone().invert();
  const mesh = trailer.getObjectByName('SIDE_L');
  if (!mesh) { out.push([`${tag}: SIDE_L`, false]); return; }
  const lb = localBox(mesh);
  const foot = lb.min.y, crest = lb.min.x;
  out.push([`${tag}: SIDE_L local — pé y, crista x, z`, {
    footY_mm: mm(foot), crestX_mm: mm(crest),
    z_mm: [mm(lb.min.z), mm(lb.max.z)], topY_mm: mm(lb.max.y),
  }]);

  const prof = S.trailerRig.profile;
  out.push([`${tag}: perfil/dims`, {
    floorY_mm: mm(prof.floorY), skirt_mm: mm(prof.skirtHeight),
    pitch_mm: mm(prof.pitch), ribs: prof.ribCount,
    baseH_mm: mm(prof.base.height), dims: S.trailerDims,
  }]);
  const grid = S.models.getPlateGrid ? S.models.getPlateGrid() : null;
  out.push([`${tag}: fileiras de rebite (mm do pé)`,
    grid ? grid.rivetRowsFromBottom.map((v) => Math.round(v * 1000)) : '(sem grade)']);

  /* ---- 1. VARREDURA POR RAIO: coluna vertical no meio do comprimento ---- */
  const scanAt = (zL, label) => {
    const y0 = foot - 0.30, y1 = foot + 0.62, step = 0.005;
    /* Candidatos: só malhas cuja caixa de mundo cruza a janela da varredura —
       sem isso cada raio testa as 2 151 malhas do bake. */
    const wbox = new THREE.Box3();
    for (const cx of [crest - 0.65, crest + 0.45]) {
      for (const cy of [y0 - 0.02, y1 + 0.02]) {
        for (const cz of [zL - 0.06, zL + 0.06]) {
          wbox.expandByPoint(new THREE.Vector3(cx, cy, cz).applyMatrix4(trailer.matrixWorld));
        }
      }
    }
    const cands = [];
    trailer.traverse((o) => {
      if (!o.isMesh || !shown(o)) return;
      const b = new THREE.Box3().setFromObject(o);
      if (b.intersectsBox(wbox)) cands.push(o);
    });
    const ray = new THREE.Raycaster();
    const dir = new THREE.Vector3(1, 0, 0).transformDirection(trailer.matrixWorld);
    const rows = [];
    for (let y = y0; y <= y1; y += step) {
      const o3 = new THREE.Vector3(crest - 0.6, y, zL).applyMatrix4(trailer.matrixWorld);
      ray.set(o3, dir);
      ray.far = 1.3;
      const hit = ray.intersectObjects(cands, false)[0];
      if (!hit) { rows.push({ y, key: '(vazio)', depth: null }); continue; }
      const m = Array.isArray(hit.object.material) ? hit.object.material[0] : hit.object.material;
      const pl = hit.point.clone().applyMatrix4(toLocal);
      rows.push({
        y, key: `${hit.object.name || '(sem nome)'} [${m?.name || '?'}]`,
        depth: (pl.x - crest) * 1000,
      });
    }
    const bands = [];
    for (const r of rows) {
      const last = bands[bands.length - 1];
      if (last && last.key === r.key) {
        last.to = r.y;
        if (r.depth !== null) {
          last.dMin = Math.min(last.dMin ?? r.depth, r.depth);
          last.dMax = Math.max(last.dMax ?? r.depth, r.depth);
        }
      } else {
        bands.push({ key: r.key, from: r.y, to: r.y, dMin: r.depth, dMax: r.depth });
      }
    }
    out.push([`${tag}: varredura ${label} (mm do pé → quem pinta, prof mm da crista)`,
      bands.map((b) => `${mm(b.from - foot)}..${mm(b.to - foot)}: ${b.key}`
        + (b.dMin !== null && b.dMin !== undefined
          ? ` @${Math.round(b.dMin)}..${Math.round(b.dMax)}` : ''))]);
  };
  const zMid = (lb.min.z + lb.max.z) / 2;
  scanAt(zMid, 'z=meio');
  scanAt(zMid - 1.5, 'z=meio-1,5m');

  /* ---- 2. INVENTÁRIO DO TRILHO/FRAME INFERIOR: peças corridas baixas ---- */
  {
    const found = [];
    trailer.traverse((o) => {
      if (!o.isMesh || !shown(o)) return;
      if (/^(SIDE_L|SIDE_R|REAR)$/.test(o.name || '')) return;
      const wb = new THREE.Box3().setFromObject(o);
      if (wb.isEmpty()) return;
      const loc = new THREE.Box3();
      const c = new THREE.Vector3();
      for (let i = 0; i < 8; i++) {
        c.set(i & 1 ? wb.max.x : wb.min.x, i & 2 ? wb.max.y : wb.min.y,
          i & 4 ? wb.max.z : wb.min.z).applyMatrix4(toLocal);
        loc.expandByPoint(c);
      }
      const ySpan = loc.max.y - loc.min.y, zSpan = loc.max.z - loc.min.z;
      if (zSpan < 3.5 || ySpan > 0.8) return;
      if (loc.min.y > foot + 0.6 || loc.max.y < foot - 0.45) return;
      if (loc.min.x > crest + 0.35) return;      // longe do flanco esquerdo
      const m = Array.isArray(o.material) ? o.material[0] : o.material;
      found.push({
        nome: `${o.name || '(sem nome)'} [${m?.name || '?'}]`,
        yLocal_mm: [mm(loc.min.y), mm(loc.max.y)],
        yDoPe_mm: [mm(loc.min.y - foot), mm(loc.max.y - foot)],
        xDaCrista_mm: [mm(loc.min.x - crest), mm(loc.max.x - crest)],
        zSpan_m: +zSpan.toFixed(2),
      });
    });
    found.sort((a, b) => a.yLocal_mm[0] - b.yLocal_mm[0]);
    out.push([`${tag}: peças corridas baixas do flanco esquerdo`, found]);
  }

  /* ---- 3. HISTOGRAMA da pele branca (corpo, SEM a chapa) na banda ------- */
  {
    const BIN = 0.005;
    const outer = new Map();
    const v = new THREE.Vector3();
    trailer.traverse((o) => {
      if (!o.isMesh || !shown(o)) return;
      if (/^(SIDE_L|SIDE_R|REAR)$/.test(o.name || '')) return;
      const mats = Array.isArray(o.material) ? o.material : [o.material];
      if (!mats.some((m) => m && /cor_padrao_branco/i.test(m.name || ''))) return;
      const pos = o.geometry?.getAttribute?.('position');
      if (!pos) return;
      o.updateWorldMatrix(true, false);
      const M = toLocal.clone().multiply(o.matrixWorld);
      for (let i = 0; i < pos.count; i++) {
        v.fromBufferAttribute(pos, i).applyMatrix4(M);
        if (v.y < foot - 0.05 || v.y > foot + 0.62) continue;
        if (v.z < lb.min.z + 0.3 || v.z > lb.max.z - 0.3) continue;
        if (v.x > crest + 0.30) continue;        // só o flanco esquerdo
        const bin = Math.round(v.y / BIN);
        if (!(v.x >= (outer.get(bin) ?? Infinity))) outer.set(bin, v.x);
      }
    });
    const bins = [...outer.entries()].sort((a, b) => a[0] - b[0])
      .map(([bin, x]) => `${mm(bin * BIN - foot)}:${Math.round((x - crest) * 1000)}`);
    out.push([`${tag}: corpo branco — x mais externo por 5 mm (mm do pé : prof mm)`, bins]);
  }

  /* ---- 4. HISTOGRAMA da própria chapa SIDE_L (onde ela TEM pele) -------- */
  {
    const BIN = 0.005;
    const pos = mesh.geometry.getAttribute('position');
    const outer = new Map();
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i), y = pos.getY(i);
      if (y > foot + 0.62) continue;
      const bin = Math.round(y / BIN);
      if (!(x >= (outer.get(bin) ?? Infinity))) outer.set(bin, x);
    }
    const bins = [...outer.entries()].sort((a, b) => a[0] - b[0])
      .map(([bin, x]) => `${mm(bin * BIN - foot)}:${Math.round((x - crest) * 1000)}`);
    out.push([`${tag}: chapa SIDE_L — x mais externo por 5 mm (mm do pé : prof mm)`, bins]);
  }

  /* ---- 5. FOTO da banda, ancorada nos cantos uv1 (imune ao giro) -------- */
  {
    const c00 = cornerOf(mesh, 0, 0);
    const c10 = cornerOf(mesh, 1, 0);
    const c11 = cornerOf(mesh, 1, 1);
    if (c00 && c10 && c11) {
      const uD = new THREE.Vector3().subVectors(c10.p, c00.p);
      const len = uD.length(); uD.normalize();
      const vD = new THREE.Vector3().subVectors(c11.p, c10.p);
      const hgt = vD.length(); vD.normalize();
      const nD = new THREE.Vector3().crossVectors(vD, uD).normalize();
      const w2 = Math.min(len, 6), h2 = 0.80, ppm = 500;
      const coverTop = 0.60;                       // 600 mm acima do pé
      const centre = c00.p.clone().addScaledVector(uD, len / 2)
        .addScaledVector(vD, hgt - coverTop + h2 / 2);
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
      out.push([`${tag}-banda-foto`, cc.toDataURL('image/png')]);
    }
  }
}

await battery('fabrica');

S.measures.setImplementMeasures({ height: 3.0 });
out.push(['h300: resize assentou', await B.until(() => {
  const d = S.trailerDims;
  return !!d && Math.abs(d.height - 3.0) < 0.06;
}, 60000)]);
await B.frame(); await B.frame();
await battery('h300');

S.measures.setImplementMeasures({ height: 2.5 });
out.push(['h250: resize assentou', await B.until(() => {
  const d = S.trailerDims;
  return !!d && Math.abs(d.height - 2.5) < 0.06;
}, 60000)]);
await B.frame(); await B.frame();
await battery('h250');

return out;
