/* CANTO DIANTEIRO — as faixas metálicas da base: LATERAL × TESTEIRA.
   ---------------------------------------------------------------------------
   Relato (prints 2026-08-11): no encontro da lateral com a testeira, o trilho
   galvanizado + fita refletiva + soleira da LATERAL não batem em altura com os
   da TESTEIRA — degrau visível. E o usuário observa que "o frame inferior está
   indo para baixo; a linha preta é onde ele deveria estar".

   Esta sonda responde com MEDIDA, não com hipótese:

     1. Em fábrica e em 2-3 alturas, o y (referencial do RIG, imune ao giro do
        engate) do topo/pé de cada peça metálica da base, separada por face
        (tira LATERAL perto do canto × tira da TESTEIRA).
     2. O despejo das REGRAS de mapeamento (`part.y`/`part.z` do
        TrailerAssembly) de toda peça que mora no canto — é a regra divergente
        que se procura.
     3. Fotos ortográficas do canto (diagonal 45°) em cada altura.

   Roda:  node tools/studio-bench/bench.mjs --gpu --geometry --checks checks-corner.mjs
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

/* ------------------------------------------------------------------------ */
/* 2. AS REGRAS DO ASSEMBLY, para toda peça que mora no canto dianteiro em
   faixa de base. As caixas de `part` estão no referencial de CARGA (mesmo das
   refs floorY/z1), então dá para comparar direto — isto não muda com resize. */
{
  const asm = S.trailerRig.assembly;
  const { floorY, z1 } = prof;
  const rows = [];
  for (const piece of asm.pieces ?? []) {
    const mats = Array.isArray(piece.mesh.material) ? piece.mesh.material : [piece.mesh.material];
    const mat = mats.map((m) => (m && m.name) || '?').join('+');
    for (const p of piece.parts) {
      /* Faixa de base (perto do piso) e perto do canto dianteiro. */
      if (p.min.y > floorY + 0.45 || p.max.y < floorY - 0.45) continue;
      const nearFront = p.max.z > z1 - 1.2;
      if (!nearFront) continue;
      const onFace = p.max.z > z1 - 0.15;                  // mora na testeira
      const onSide = Math.abs((p.min.x + p.max.x) / 2) > 1.10; // lataria lateral
      if (!onFace && !onSide) continue;
      rows.push(`${onFace ? 'TEST' : 'LAT '} y=${p.y}/z=${p.z}`
        + `${p.below ? ' below' : ''}${p.rigidZ ? ' rigidZ' : ''}`
        + `${p.repeated ? ' rep' : ''}${p.latch ? ' latch' : ''}`
        + ` ${mat} [x ${mm(p.min.x)}..${mm(p.max.x)}`
        + ` y ${mm(p.min.y)}..${mm(p.max.y)} z ${mm(p.min.z)}..${mm(p.max.z)}]`);
    }
  }
  rows.sort();
  out.push(['regras do canto (assembly)', rows.length]);
  for (const r of rows.slice(0, 70)) out.push(['  parte', r]);
  const reps = [];
  for (const r of asm.repeats ?? []) {
    if (Math.abs(r.first.z - z1) > 1.4 && r.axis !== 'z') continue;
    reps.push(`${r.mesh.name} eixo=${r.axis} passo=${mm(r.pitch)} y=${r.y}/z=${r.z}`
      + ` first(${mm(r.first.x)},${mm(r.first.y)},${mm(r.first.z)})`);
  }
  for (const r of reps) out.push(['  repeat', r]);
}

/* ------------------------------------------------------------------------ */
/* 1. A MEDIDA. Vértices levados ao referencial do RIG (inversa da raiz do
   implemento) — o conjunto gira no engate, y de mundo mentiria se houvesse
   qualquer inclinação. Duas tiras na faixa de base:
     LATERAL:  |x| ≥ 1,15 · z ∈ [z1−1,2 ; z1−0,15]
     TESTEIRA: z ≥ z1−0,12 · |x| ≤ 1,45                                     */
function scan() {
  const root = S.trailer;
  root.updateWorldMatrix(true, true);
  const inv = root.matrixWorld.clone().invert();
  const { floorY, z1 } = prof;
  const v = new THREE.Vector3();
  const rows = new Map();   // chave mesh|mat → {side:{...}, front:{...}}
  const im = new THREE.Matrix4();
  const m4 = new THREE.Matrix4();
  const mi = new THREE.Matrix4();

  root.traverse((o) => {
    if (!o.isMesh || !o.visible) return;
    const mats = Array.isArray(o.material) ? o.material : [o.material];
    const mat = mats.map((m) => (m && m.name) || '?').join('+');
    const interesting = /galvanizado|3M|inox|arremate|estrutura|plastico-preto/i.test(mat)
      || /SILL|HEM|RIVET|TRAILER_BODY/i.test(o.name);
    if (!interesting) return;
    const pos = o.geometry && o.geometry.getAttribute('position');
    if (!pos || pos.count > 500000) return;
    m4.multiplyMatrices(inv, o.matrixWorld);
    const nInst = o.isInstancedMesh ? o.count : 1;
    const key = `${o.name || '(sem nome)'} · ${mat}`;
    for (let k = 0; k < nInst; k++) {
      mi.copy(m4);
      if (o.isInstancedMesh) { o.getMatrixAt(k, im); mi.multiply(im); }
      for (let i = 0; i < pos.count; i++) {
        v.fromBufferAttribute(pos, i).applyMatrix4(mi);
        if (v.y < floorY - 0.45 || v.y > floorY + 0.45) continue;
        let face = null;
        if (v.z >= z1 - 0.12 && Math.abs(v.x) <= 1.45) face = 'front';
        else if (Math.abs(v.x) >= 1.15 && v.z >= z1 - 1.2 && v.z <= z1 - 0.15) face = 'side';
        if (!face) continue;
        let r = rows.get(key);
        if (!r) { r = {}; rows.set(key, r); }
        let a = r[face];
        if (!a) { a = { lo: Infinity, hi: -Infinity, n: 0 }; r[face] = a; }
        if (v.y < a.lo) a.lo = v.y;
        if (v.y > a.hi) a.hi = v.y;
        a.n++;
      }
    }
  });
  return rows;
}

/** Resumo de uma varredura: linhas legíveis + topo do trilho por face. */
function report(tag, rows) {
  const { floorY } = prof;
  const fmt = (a) => (a ? `${mm(a.lo - floorY)}..${mm(a.hi - floorY)}` : '—');
  const keys = [...rows.keys()].sort();
  for (const k of keys) {
    const r = rows.get(k);
    out.push([`${tag} · ${k}`, `LAT ${fmt(r.side)} · TEST ${fmt(r.front)} (mm rel. piso)`]);
  }
  /* O TRILHO: metal-galvanizado-*, ABAIXO do meio da faixa (o topo do trilho
     fica ~130 mm acima do piso; a cantoneira é 'roof' e não entra na banda). */
  let sideTop = -Infinity, frontTop = -Infinity;
  for (const k of keys) {
    if (!/galvanizado/i.test(k)) continue;
    const r = rows.get(k);
    if (r.side && r.side.hi < floorY + 0.30 && r.side.hi > sideTop) sideTop = r.side.hi;
    if (r.front && r.front.hi < floorY + 0.30 && r.front.hi > frontTop) frontTop = r.front.hi;
  }
  const have = isFinite(sideTop) && isFinite(frontTop);
  const step = have ? (sideTop - frontTop) * 1000 : null;
  out.push([`${tag}: topo do trilho — LAT ${have ? mm(sideTop - floorY) : '—'} mm · `
    + `TEST ${have ? mm(frontTop - floorY) : '—'} mm rel. piso`,
  step === null ? '(faixa não achada nas duas faces)'
    : Math.abs(step) <= 2 ? true : `degrau ${step.toFixed(1)} mm`]);
  return { sideTop, frontTop };
}

/* ------------------------------------------------------------------------ */
/* 3. A FOTO do canto dianteiro-inferior, diagonal 45°, ancorada nos uv1 da
   chapa SIDE_L (imune ao giro): canto (1,1) = pé da chapa na ponta dianteira. */
function cornerOf(mesh, u, vv) {
  const uv = mesh.geometry.getAttribute('uv1');
  const pos = mesh.geometry.getAttribute('position');
  if (!uv || !pos) return null;
  mesh.updateWorldMatrix(true, false);
  let best = Infinity, bi = -1;
  for (let i = 0; i < uv.count; i++) {
    const du = uv.getX(i) - u, dv = uv.getY(i) - vv;
    const d = du * du + dv * dv;
    if (d < best) { best = d; bi = i; }
  }
  const p = new THREE.Vector3().fromBufferAttribute(pos, bi).applyMatrix4(mesh.matrixWorld);
  return { p };
}

function shootCorner(tag) {
  const mesh = S.trailer?.getObjectByName('SIDE_L');
  if (!mesh) { out.push([`${tag}-foto`, '(sem SIDE_L)']); return; }
  const c00 = cornerOf(mesh, 0, 0), c10 = cornerOf(mesh, 1, 0), c11 = cornerOf(mesh, 1, 1);
  if (!c00 || !c10 || !c11) return;
  const uDir = new THREE.Vector3().subVectors(c10.p, c00.p).normalize(); // traseira→dianteira
  const vDir = new THREE.Vector3().subVectors(c11.p, c10.p).normalize(); // desce
  const nDir = new THREE.Vector3().crossVectors(vDir, uDir).normalize(); // para FORA da lateral
  const up = vDir.clone().negate();

  const shots = [
    ['diag', new THREE.Vector3().addVectors(nDir, uDir).normalize()],
    ['lado', nDir.clone()],
  ];
  for (const [ang, dir] of shots) {
    const w = 2.0, h = 1.3, ppm = 640;
    /* Centro: no pé da chapa, meio metro para dentro a partir da ponta, e
       220 mm abaixo do pé (a região do trilho/fita/soleira). */
    const centre = c11.p.clone().addScaledVector(uDir, -0.25).addScaledVector(vDir, 0.22);
    const wPx = Math.round(w * ppm), hPx = Math.round(h * ppm);
    rr.setSize(wPx, hPx, false);
    const cam = new THREE.OrthographicCamera(-w / 2, w / 2, h / 2, -h / 2, 0.05, 12);
    cam.position.copy(centre).addScaledVector(dir, 5);
    cam.up.copy(up);
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
    out.push([`${tag}-canto-${ang}`, cc.toDataURL('image/png')]);
  }
}

/* ------------------------------------------------------------- a bateria */
async function battery(tag) {
  await B.frame(); await B.frame();
  const rows = scan();
  const tops = report(tag, rows);
  shootCorner(tag);
  return tops;
}

const base = S.trailerRig.base.height;
out.push(['altura de fábrica (mm)', mm(base)]);
await battery('fabrica');

for (const h of [2.2, 3.0]) {
  S.measures.setImplementMeasures({ height: h });
  const ok = await B.until(() => {
    const d = S.trailerDims;
    return !!d && Math.abs(d.height - h) < 0.06;
  }, 60000);
  out.push([`h${Math.round(h * 100)}: resize assentou`, ok]);
  await battery(`h${Math.round(h * 100)}`);
}

/* De volta à fábrica — o mapeamento parte sempre da base, não pode acumular. */
S.measures.setImplementMeasures({ height: base });
await B.until(() => {
  const d = S.trailerDims;
  return !!d && Math.abs(d.height - base) < 0.06;
}, 60000);
await battery('volta-fabrica');

return out;
