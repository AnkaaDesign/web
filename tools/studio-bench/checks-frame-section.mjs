/* SEÇÃO DO FRAME INFERIOR — a altura do perfil, estação a estação.
   ---------------------------------------------------------------------------
   Hipótese do usuário: "o frame metálico está AUMENTANDO conforme aumento a
   altura; só os montantes verticais deviam". Então mede-se a SEÇÃO (altura
   visível do perfil, borda a borda) do trilho/frame inferior:

     · LATERAL (as duas), em 5 estações ao longo do comprimento;
     · TESTEIRA (3 estações em x);
     · TRASEIRA (3 estações em x, na parede corrente — ela anda com o
       comprimento);

   em fábrica, h220 e h300. Se alguma seção mudar de altura entre medidas, é
   a peça que engorda; se nenhuma mudar, o perfil é rígido como manda o 3D.

   Raios no referencial do RIG (o conjunto gira no engate), passo 4 mm.

   Roda:  node tools/studio-bench/bench.mjs --gpu --geometry --checks checks-frame-section.mjs
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
      .filter((h) => h.object.visible);
    const h = hits[0];
    let label = '(vazio)';
    if (h) {
      const mat = Array.isArray(h.object.material) ? h.object.material[0] : h.object.material;
      label = `${mat?.name || h.object.name || '?'}`;
      if (h.distance > 2.35) label += ' (fundo)';
    }
    rows.push({ y, label });
  }
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
  const d = S.trailerDims;
  const zBack = z1 - (d ? d.length : prof.z1 - prof.z0);
  const y0 = floorY - 0.30, y1 = floorY + 0.30, st = 0.004;
  const fmt = (runs) => runs
    .filter((r) => !/vazio|fundo/.test(r.label))
    .map((r) => `${mm(r.from - floorY)}..${mm(r.to - floorY)} `
      + `${r.label.replace(/^(metal-|Cor_padrao_|lanterna-|vidro-)/, '').slice(0, 22)}`
      + ` [${mm(r.to - r.from)}]`)
    .join(' | ');

  /* LATERAL: 5 estações do comprimento corrente. */
  const stations = [z1 - 0.35, z1 - 3, (z1 + zBack) / 2, zBack + 3, zBack + 0.35];
  for (const sx of [-1, 1]) {
    for (let i = 0; i < stations.length; i++) {
      const runs = bands((y) => ({
        o: new THREE.Vector3(sx * 2.2, y, stations[i]),
        d: new THREE.Vector3(-sx, 0, 0),
      }), y0, y1, st);
      out.push([`${tag} LAT${sx > 0 ? 'R' : 'L'} z=${mm(stations[i])}`, fmt(runs)]);
    }
  }
  /* TESTEIRA. */
  for (const px of [-1.12, 0.6, 1.12]) {
    const runs = bands((y) => ({
      o: new THREE.Vector3(px, y, z1 + 2.2),
      d: new THREE.Vector3(0, 0, -1),
    }), y0, y1, st);
    out.push([`${tag} TEST x=${px}`, fmt(runs)]);
  }
  /* TRASEIRA — a parede corrente. */
  for (const px of [-1.12, 0.6, 1.12]) {
    const runs = bands((y) => ({
      o: new THREE.Vector3(px, y, zBack - 2.2),
      d: new THREE.Vector3(0, 0, 1),
    }), y0, y1, st);
    out.push([`${tag} TRAS x=${px}`, fmt(runs)]);
  }
}

battery('fabrica');

for (const h of [2.2, 3.0]) {
  S.measures.setImplementMeasures({ height: h });
  const ok = await B.until(() => {
    const d = S.trailerDims;
    return !!d && Math.abs(d.height - h) < 0.06;
  }, 60000);
  out.push([`h${Math.round(h * 100)}: resize assentou`, ok]);
  await B.frame(); await B.frame();
  battery(`h${Math.round(h * 100)}`);
}

return out;
