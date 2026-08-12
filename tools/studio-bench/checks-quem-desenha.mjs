/* QUEM DESENHA O PIXEL — a pergunta que eu vinha respondendo por dedução.
   ---------------------------------------------------------------------------
       node tools/studio-bench/bench.mjs --gpu --geometry --checks checks-quem-desenha.mjs

   Três rodadas de conserto do farol falharam porque eu supus que a superfície
   visível do farol era `f_light_chs_mat_0000_lights` — o material que TEM "light"
   no nome. A sonda anterior encontrou esse material num raycast, mas com uma pose
   solta, e ele NÃO apareceu entre os 22 materiais mais atingidos da frente do
   cavalo. Ou seja: provavelmente a lente que se vê é de outro material, e todo o
   trabalho de nível e de cor estava sendo aplicado numa peça escondida atrás dela.

   Então: reproduz EXATAMENTE as poses das fotos `n7` (frente) e `n8` (traseira do
   implemento) e varre o retângulo onde a lâmpada aparece NA FOTO, reportando o
   PRIMEIRO acerto de cada raio. O primeiro acerto é o que a tela mostra.

   As frações do quadro saem da leitura das fotos, e são fração e não pixel para
   não depender do tamanho do viewport da bancada. */
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

out.push(['seletor atravessado', await settle()]);
out.push(['__studio de pé', await B.until(() => !!window.__studio, 480000)]);
const S = window.__studio;
if (!S) return out;
out.push(['implemento carregado', await B.until(() => !!S.trailerRig, 240000)]);
const THREE = S.THREE;
const L = S.lighting;
const r2 = (v) => Math.round(v * 100) / 100;
const r3 = (v) => Math.round(v * 1000) / 1000;

L.setHourOfDay(21, { animate: false });
for (let i = 0; i < 6; i++) await B.frame();

const cxa = L.getSeeThrough().alvoCaixa;
out.push(['caixa do conjunto', cxa ? cxa.map(r2).join(' ') : 'nenhuma']);
if (!cxa) return out;
const cxm = (cxa[0] + cxa[3]) / 2;

S.controls.enabled = false;
async function pose(eye, tgt) {
  S.camera.position.set(eye[0], eye[1], eye[2]);
  S.camera.lookAt(tgt[0], tgt[1], tgt[2]);
  S.camera.updateMatrixWorld(true);
  S.camera.updateProjectionMatrix();
  L.invalidate(6);
  for (let i = 0; i < 14; i++) await B.frame();
}

const rc = new THREE.Raycaster();
const canvas = document.createElement('canvas');
const ctx = canvas.getContext('2d', { willReadFrequently: true });

/** O albedo no UV do acerto, para saber com que cor a peça vai brilhar. */
function amostrar(tex, u, v) {
  const img = tex && tex.image;
  if (!img || !img.width) return null;
  const W = Math.min(512, img.width), H = Math.min(512, img.height);
  canvas.width = W; canvas.height = H;
  try { ctx.drawImage(img, 0, 0, W, H); } catch (_) { return null; }
  const x = Math.min(W - 1, Math.max(0, Math.round(((u % 1) + 1) % 1 * (W - 1))));
  const y = Math.min(H - 1, Math.max(0, Math.round((1 - ((v % 1) + 1) % 1) * (H - 1))));
  const d = ctx.getImageData(x, y, 1, 1).data;
  return [d[0], d[1], d[2]];
}

/**
 * Varre um retângulo do QUADRO (frações 0..1, origem no canto superior esquerdo)
 * e reporta o PRIMEIRO material atingido por cada raio.
 */
function varrer(rotulo, fx0, fy0, fx1, fy1, passos) {
  const conta = new Map();
  for (let i = 0; i <= passos; i++) {
    for (let j = 0; j <= passos; j++) {
      const fx = fx0 + (fx1 - fx0) * i / passos;
      const fy = fy0 + (fy1 - fy0) * j / passos;
      rc.setFromCamera(new THREE.Vector2(fx * 2 - 1, 1 - fy * 2), S.camera);
      const hits = rc.intersectObject(S.scene, true);
      if (!hits.length) continue;
      /* A PILHA, e não só o primeiro: a lâmpada mora ATRÁS da capa. Uma capa é
         reconhecida por ser transparente e quase invisível — é o mesmo corte que
         `lights.ts` usa para não acendê-la. */
      for (let k = 0; k < Math.min(hits.length, 4); k++) {
        const h = hits[k];
        const m = Array.isArray(h.object.material) ? h.object.material[0] : h.object.material;
        if (!m) continue;
        const nome = `[${k}] ${m.name || '(sem nome)'} @ ${h.object.name || '?'}`;
        const reg = conta.get(nome) || { n: 0, mat: m, uv: h.uv ? h.uv.clone() : null };
        reg.n++;
        if (!reg.uv && h.uv) reg.uv = h.uv.clone();
        conta.set(nome, reg);
      }
    }
  }
  out.push([`— ${rotulo} —`, `${(passos + 1) ** 2} raios`]);
  const lista = [...conta.entries()].sort((a, b) => b[1].n - a[1].n).slice(0, 16);
  for (const [nome, reg] of lista) {
    const m = reg.mat;
    const px = reg.uv ? amostrar(m.emissiveMap || m.map, reg.uv.x, reg.uv.y) : null;
    out.push([`  ${nome}`,
      `${reg.n} raios · emiInt ${r2(m.emissiveIntensity || 0)}`
      + ` · emissivo ${m.emissive ? m.emissive.getHexString() : '-'}`
      + ` · mapaEmi ${m.emissiveMap ? 'sim' : 'não'}`
      + ` · albedo@uv ${px ? px.join(',') : '?'}`
      + ` · opacidade ${r2(m.opacity ?? 1)}${m.transparent ? ' BLEND' : ''}`]);
  }
}

/* ---------- A FRENTE DO CAVALO, pose idêntica à foto n7 ---------- */
await pose([cxm + 3.2, 2.2, cxa[2] - 7.0], [cxm, 1.7, cxa[2] + 1.0]);
/* Os dois conjuntos de farol, lidos da foto n7 (1920x1200):
   esquerdo x 1150..1250 / y 880..1060 ; direito x 1715..1800 / y 870..1050. */
varrer('farol ESQUERDO', 1150 / 1920, 880 / 1200, 1250 / 1920, 1060 / 1200, 12);
varrer('farol DIREITO', 1715 / 1920, 870 / 1200, 1800 / 1920, 1050 / 1200, 12);
/* E a faixa de LED alta da cabine, que na foto acende (o GLOBETROTTER). */
varrer('faixa alta da cabine', 1230 / 1920, 240 / 1200, 1600 / 1920, 300 / 1200, 8);

/* ---------- A TRASEIRA DO IMPLEMENTO, pose idêntica à foto n8 ---------- */
await pose([cxm + 1.4, 1.4, cxa[5] + 4.2], [cxm + 0.4, 1.15, cxa[5]]);
/* O conjunto da esquerda na foto n8: x 860..1100 / y 970..1060. */
varrer('lanterna traseira', 860 / 1920, 970 / 1200, 1100 / 1920, 1060 / 1200, 12);

S.controls.enabled = true;
return out;
