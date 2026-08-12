/* SONDA 3 do item 1 — a FORMA do frame da testeira, sem a unidade na frente.
   ===========================================================================
   A sonda 2 já disse ONDE está o vão: o galvanizado da testeira é uma tira
   CHEIA de y 4095..4170 mais uma banda de y 3965..4095 que só existe em
   |x| 1045..1240. O Thermo King vai de |x| 0..998, então sobra uma faixa
   branca de 47 mm entre a unidade e a banda — é o "espaço" do relato.

   Falta saber o que fazer com ela, e para isso é preciso VER a peça: se a
   banda é uma tira reta (prismática) em 1045..1150, ela estica ao longo do
   próprio eixo sem deformar nada, que é a correção barata e exata.

   Roda:  node tools/studio-bench/bench.mjs --gpu --geometry \
            --checks checks-frente-forma.mjs
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
const mm = (v) => Math.round(v * 1000);
const root = S.trailer;
root.updateWorldMatrix(true, true);
const toLocal = root.matrixWorld.clone().invert();

/* ------- 1. a malha do galvanizado da testeira, e a seção dela em x ------ */
let frame = null;
root.traverse((node) => {
  const o = node;
  if (!o.isMesh || !o.visible || !o.geometry?.attributes?.position) return;
  const mats = Array.isArray(o.material) ? o.material : [o.material];
  if (!mats.some((m) => /metal-galvanizado-mantido/i.test((m && m.name) || ''))) return;
  const pos = o.geometry.attributes.position;
  const m4 = new THREE.Matrix4().multiplyMatrices(toLocal, o.matrixWorld);
  const v = new THREE.Vector3();
  let zHi = -Infinity, yHi = -Infinity, n = 0;
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i).applyMatrix4(m4);
    if (v.z > 7.0 && v.y > 3.9) { n++; if (v.z > zHi) zHi = v.z; if (v.y > yHi) yHi = v.y; }
  }
  if (n > 0 && (!frame || n > frame.n)) frame = { mesh: o, n, zHi, yHi, m4 };
});
if (!frame) { out.push(['frame achado', false]); return out; }
out.push(['frame', `${frame.mesh.name.slice(0, 40)} · ${frame.n} vértices na testeira`
  + ` · z máx ${mm(frame.zHi)} · y máx ${mm(frame.yHi)}`]);

/* A seção da peça numa fatia de x: os pares (y, z) dos vértices dela. Se a
   banda é prismática, fatias vizinhas dão a MESMA lista. */
function sectionAt(x, half = 0.004) {
  const pos = frame.mesh.geometry.attributes.position;
  const v = new THREE.Vector3();
  const pts = [];
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i).applyMatrix4(frame.m4);
    if (v.z < 7.0 || v.y < 3.90) continue;
    if (Math.abs(v.x - x) > half) continue;
    pts.push(`${mm(v.y)}/${mm(v.z)}`);
  }
  return [...new Set(pts)].sort();
}
for (const x of [1.05, 1.07, 1.09, 1.11, 1.13, 1.15, 1.18, 1.21, 1.24]) {
  const s = sectionAt(x);
  out.push([`seção x ${mm(x)}`, `${s.length} pts · ${s.join(' ')}`]);
}

/* Onde exatamente a banda de baixo termina, por vértice. */
{
  const pos = frame.mesh.geometry.attributes.position;
  const v = new THREE.Vector3();
  let inner = Infinity, innerLow = Infinity;
  const xs = new Set();
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i).applyMatrix4(frame.m4);
    if (v.z < 7.0 || v.y < 3.90) continue;
    if (v.y < 4.093) { innerLow = Math.min(innerLow, Math.abs(v.x)); xs.add(mm(Math.abs(v.x))); }
    inner = Math.min(inner, Math.abs(v.x));
  }
  out.push(['|x| mínimo do frame', mm(inner)]);
  out.push(['|x| mínimo abaixo de y 4093', mm(innerLow)]);
  out.push(['|x| distintos da banda baixa', [...xs].sort((a, b) => a - b).slice(0, 40).join(' ')]);
}

/* ------- 2. o retrato: a testeira de frente, com e sem a unidade -------- */
const cam = S.camera;
const tk = S.state?.tk;
const box = new THREE.Box3().setFromObject(root);
const ctr = box.getCenter(new THREE.Vector3());

async function shot(tag, hideTk) {
  if (tk) tk.visible = !hideTk;
  /* Câmera na frente do baú, olhando para trás, enquadrando o alto da testeira. */
  const front = new THREE.Vector3(0, 4.05, 7.22).applyMatrix4(root.matrixWorld);
  const fwd = new THREE.Vector3(0, 0, 1).transformDirection(root.matrixWorld);
  cam.position.copy(front).addScaledVector(fwd, 6.0);
  cam.up.set(0, 1, 0);
  cam.lookAt(front);
  cam.fov = 22;
  cam.updateProjectionMatrix();
  if (S.controls) { S.controls.target.copy(front); S.controls.enabled = false; }
  S.lighting.invalidateShadows?.();
  await B.frame(); await B.frame(); await B.frame();
  const url = S.renderer.domElement.toDataURL('image/png');
  out.push([tag, url]);
}
await shot('frente-com-tk', false);
await shot('frente-sem-tk', true);
if (tk) tk.visible = true;

return out;
