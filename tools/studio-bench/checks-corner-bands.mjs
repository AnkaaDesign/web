/* CANTO DIANTEIRO, POR RAIO — as FAIXAS VISÍVEIS da base, face a face.
   ---------------------------------------------------------------------------
   A sonda de vértices (checks-corner.mjs) mediu caixas; peça extrudada só tem
   vértice nas pontas e caixa não diz o que o OLHO vê. Aqui a pergunta é a do
   print do usuário: descendo pela parede junto ao canto dianteiro, QUEM pinta
   cada fileira de altura — na LATERAL e na TESTEIRA — e onde ficam as bordas
   das faixas em cada medida.

   Raios construídos no referencial do RIG (o conjunto gira no engate) e
   levados a mundo pela matriz da raiz.

   Roda:  node tools/studio-bench/bench.mjs --gpu --geometry --checks checks-corner-bands.mjs
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
const prof = S.trailerRig.profile;
const mm = (v) => Math.round(v * 1000);
out.push(['datums (mm)', `floorY ${mm(prof.floorY)} · z0 ${mm(prof.z0)} · z1 ${mm(prof.z1)}`]);

/** Varre uma vertical por raio e devolve as FAIXAS contíguas de material.
 *  `mk(y)` devolve {o, d} no referencial do RIG. */
function bands(mk, y0, y1, step) {
  const root = S.trailer;
  root.updateWorldMatrix(true, true);
  const M = root.matrixWorld;
  const ray = new THREE.Raycaster();
  ray.far = 6;
  const rows = [];
  for (let y = y0; y <= y1 + 1e-9; y += step) {
    const { o, d } = mk(y);
    const ow = o.clone().applyMatrix4(M);
    const dw = d.clone().transformDirection(M);
    ray.set(ow, dw);
    const hits = ray.intersectObjects([S.trailerGroup ?? S.trailer], true)
      .filter((h) => h.object.visible && h.object.name !== 'PISO_SOMBRA');
    const h = hits[0];
    let label = '(vazio)';
    let depth = null;
    if (h) {
      const mat = Array.isArray(h.object.material) ? h.object.material[0] : h.object.material;
      label = `${mat?.name || h.object.name || '?'}`;
      /* Profundidade: distância do plano de partida, para separar "pele" de
         "fundo lá atrás" (o vão preto é um acerto muito atrás ou nada). */
      depth = h.distance;
      if (depth > 2.35) label += ' (fundo)';
    }
    rows.push({ y, label, depth });
  }
  /* Comprime em faixas contíguas. */
  const runs = [];
  for (const r of rows) {
    const last = runs[runs.length - 1];
    if (last && last.label === r.label) { last.to = r.y; continue; }
    runs.push({ label: r.label, from: r.y, to: r.y });
  }
  return runs;
}

function battery(tag) {
  const { floorY, z1 } = prof;
  const y0 = floorY - 0.30, y1 = floorY + 0.30, st = 0.004;

  /* LATERAL esquerda (x negativo? mede as duas), 350 mm atrás da testeira. */
  for (const sx of [-1, 1]) {
    const runs = bands((y) => ({
      o: new THREE.Vector3(sx * 2.2, y, z1 - 0.35),
      d: new THREE.Vector3(-sx, 0, 0),
    }), y0, y1, st);
    out.push([`${tag} LAT${sx > 0 ? 'R' : 'L'}`, runs.map((r) =>
      `${mm(r.from - floorY)}..${mm(r.to - floorY)} ${r.label}`).join(' | ')]);
  }
  /* TESTEIRA, 120 mm para dentro do canto (|x| = 1,12) e no meio (x = 0,6 —
     fora do pino/registros). */
  for (const px of [-1.12, 1.12, 0.6]) {
    const runs = bands((y) => ({
      o: new THREE.Vector3(px, y, z1 + 2.2),
      d: new THREE.Vector3(0, 0, -1),
    }), y0, y1, st);
    out.push([`${tag} TEST x=${px}`, runs.map((r) =>
      `${mm(r.from - floorY)}..${mm(r.to - floorY)} ${r.label}`).join(' | ')]);
  }
}

battery('fabrica');

for (const patch of [{ height: 2.2 }, { height: 3.0 }, { length: 16.5 }]) {
  const key = patch.height ? `h${Math.round(patch.height * 100)}` : `L${Math.round(patch.length * 100)}`;
  S.measures.setImplementMeasures(patch);
  const ok = await B.until(() => {
    const d = S.trailerDims;
    if (!d) return false;
    return patch.height ? Math.abs(d.height - patch.height) < 0.06
      : Math.abs(d.length - patch.length) < 0.06;
  }, 60000);
  out.push([`${key}: resize assentou`, ok]);
  await B.frame(); await B.frame();
  battery(key);
}

return out;
