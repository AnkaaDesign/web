/* INVENTÁRIO do cenário e das lanternas do conjunto — mapa para reposicionar.
   ---------------------------------------------------------------------------
       node tools/studio-bench/bench.mjs --gpu --geometry --checks checks-inventario.mjs

   Não verifica nada: LEVANTA. Antes de mover uma árvore é preciso saber onde
   estão os canteiros, onde termina o pátio, quais malhas são poste e quais são
   vegetação — e o manifesto não diz (o `scatter` e o `roadside` dele estão
   vazios; tudo isso mora dentro do set.glb). */
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
    const local = cards.find((c) => /volvo/i.test(c.dataset.id || ''));
    (local || cards[0]).click();
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
  }
  return overlay.classList.contains('hidden');
}

await settle();
await B.until(() => !!window.__studio, 480000);
const S = window.__studio;
if (!S) return out;
await B.until(() => !!S.trailerRig, 240000);

const env = S.catalog.getEnvironment('distrito-industrial');
if (env) await S.environment.applyEnvironment(env);
await B.until(() => !!S.scene.getObjectByName('ts-set'), 180000);
await B.frame(); await B.frame();

const THREE = S.THREE;
const scene = S.scene;
const set = scene.getObjectByName('ts-set');
const r1 = (v) => Math.round(v * 10) / 10;
scene.updateMatrixWorld(true);

/* ---------- todas as malhas do set, por material ---------- */
const box = new THREE.Box3();
const size = new THREE.Vector3();
const ctr = new THREE.Vector3();
const porMat = new Map();
const linhas = [];
set.traverse((o) => {
  if ((!o.isMesh && !o.isInstancedMesh) || !o.geometry) return;
  box.setFromObject(o);
  if (box.isEmpty() || !isFinite(box.min.y)) return;
  box.getSize(size); box.getCenter(ctr);
  const mat = (Array.isArray(o.material) ? o.material[0] : o.material);
  const mn = (mat && mat.name) || '?';
  let g = porMat.get(mn);
  if (!g) { g = { n: 0, inst: o.isInstancedMesh ? o.count : 0 }; porMat.set(mn, g); }
  g.n++;
  linhas.push({
    nome: o.name || o.type, mat: mn, inst: o.isInstancedMesh ? o.count : 1,
    c: [r1(ctr.x), r1(ctr.y), r1(ctr.z)],
    s: [r1(size.x), r1(size.y), r1(size.z)],
    y: [r1(box.min.y), r1(box.max.y)],
  });
});
out.push(['=== MATERIAIS DO SET (malhas por material) ===',
  [...porMat.entries()].map(([k, v]) => `${k}:${v.n}${v.inst ? `(inst ${v.inst})` : ''}`).join(' · ')]);

/* ---------- vegetação e postes, um a um ---------- */
const veg = linhas.filter((l) => /^PLANT_/.test(l.mat));
out.push(['=== VEGETAÇÃO ===', veg.length]);
veg.sort((a, b) => a.c[2] - b.c[2]).forEach((l, i) => out.push([
  `  v${String(i).padStart(2, '0')} ${l.nome}`,
  `${l.mat} c=${l.c.join(',')} tam=${l.s.join('×')} y=${l.y.join('..')}`]));

/* Poste: alto e fino, seja lá qual for o material. */
const postes = linhas.filter((l) => l.s[1] > 4 && Math.max(l.s[0], l.s[2]) < 4
  && !/^PLANT_/.test(l.mat));
out.push(['=== CANDIDATOS A POSTE (alto e fino) ===', postes.length]);
postes.sort((a, b) => a.c[2] - b.c[2]).forEach((l, i) => out.push([
  `  p${String(i).padStart(2, '0')} ${l.nome}`,
  `${l.mat} c=${l.c.join(',')} tam=${l.s.join('×')} y=${l.y.join('..')}`]));

/* ---------- o chão: onde estão canteiros, pátio e rua ---------- */
const chao = linhas.filter((l) => l.s[1] < 0.6 && (l.s[0] > 3 || l.s[2] > 3));
out.push(['=== SUPERFÍCIES DE CHÃO ===', chao.length]);
chao.sort((a, b) => (b.s[0] * b.s[2]) - (a.s[0] * a.s[2])).slice(0, 24).forEach((l, i) => out.push([
  `  g${String(i).padStart(2, '0')} ${l.nome}`,
  `${l.mat} c=${l.c.join(',')} tam=${l.s.join('×')} y=${l.y.join('..')}`]));

/* ---------- construções, para saber onde NÃO pode haver árvore ---------- */
const pred = linhas.filter((l) => l.s[1] >= 2.5 && Math.max(l.s[0], l.s[2]) >= 4);
out.push(['=== CONSTRUÇÕES (h≥2,5 m e ≥4 m de planta) ===', pred.length]);
pred.sort((a, b) => Math.hypot(a.c[0], a.c[2]) - Math.hypot(b.c[0], b.c[2])).slice(0, 20)
  .forEach((l, i) => out.push([
    `  b${String(i).padStart(2, '0')} ${l.nome}`,
    `${l.mat} c=${l.c.join(',')} tam=${l.s.join('×')}`]));

/* ---------- as lanternas do caminhão ---------- */
const rig = scene.getObjectByName('RIG');
const luzes = new Map();
if (rig) {
  rig.traverse((o) => {
    if (!o.isMesh && !o.isInstancedMesh) return;
    for (const m of (Array.isArray(o.material) ? o.material : [o.material])) {
      if (!m || luzes.has(m.name)) continue;
      if (!/lanterna|farol|lamp|light|led|pisca|luz|vidro|seta|farol/i.test(m.name || '')) continue;
      luzes.set(m.name, {
        tipo: m.type,
        emissive: m.emissive ? m.emissive.getHexString() : '—',
        emissiveIntensity: m.emissiveIntensity,
        temMapaEmissivo: !!m.emissiveMap,
        cor: m.color ? m.color.getHexString() : '—',
        transparente: m.transparent, opacidade: m.opacity,
      });
    }
  });
}
out.push(['=== MATERIAIS DE LANTERNA NO RIG ===', luzes.size]);
[...luzes.entries()].forEach(([k, v]) => out.push([`  ${k}`, JSON.stringify(v)]));

/* ---------- luzes reais (Object3D) já existentes no rig ---------- */
let nLuz = 0;
if (rig) rig.traverse((o) => { if (o.isLight) nLuz++; });
out.push(['objetos de luz dentro do RIG', nLuz]);

return out;
