/* O CENÁRIO PROJETA SOMBRA E MOLHA NA CHUVA — verificação de regressão.
   ---------------------------------------------------------------------------
       node tools/studio-bench/bench.mjs --gpu --geometry --checks checks-set-sombra-chuva.mjs

   Dois defeitos independentes, um por seção, cada um com a medida que o pegou:

   1. SOMBRA. `setupShadows()` ligava `castShadow` por um raio de 60 m em torno
      da ORIGEM — centro errado (a caixa é centrada no conjunto) e instrumento
      errado (o three já poda por frustum a cada passe). E a caixa de ±24 m
      jamais alcançou uma construção: a mais próxima está a 39 m do foco.
      Provado na bancada com um cubo de controle no lugar do caminhão — ele
      projetava, o galpão ao lado não.
   2. CHUVA. `bindMaterials()` só registrava para molhagem os materiais que o
      manifesto nomeia, e o do Distrito nomeia 12, todos de chão. As 21 famílias
      de construção e vegetação ficavam secas sob chuva forte.

   A terceira trava é o CONTRAPESO da primeira: perto, a caixa tem de voltar aos
   ±24 m de fábrica, senão o conserto teria trocado a sombra do cenário pela
   densidade de contato do produto. */
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

const env = S.catalog.getEnvironment('distrito-industrial');
if (env) await S.environment.applyEnvironment(env);
out.push(['set na cena', await B.until(() => !!S.scene.getObjectByName('ts-set'), 180000)]);
await B.frame(); await B.frame();

const THREE = S.THREE;
const scene = S.scene;
const set = scene.getObjectByName('ts-set');
if (!set) return out;
const r2 = (v) => Math.round(v * 100) / 100;
const toURL = (blob) => new Promise((r) => {
  const fr = new FileReader();
  fr.onload = () => r(fr.result);
  fr.readAsDataURL(blob);
});

let key = null;
scene.traverse((o) => { if (o.isDirectionalLight && o.castShadow && !key) key = o; });
if (!key) return out;

/* ---------- 1. a bandeira de sombra ---------- */
scene.updateMatrixWorld(true);
const box = new THREE.Box3();
let verticais = 0, verticaisProjetam = 0, chaoProjeta = 0, chaoRecebe = 0, chao = 0;
set.traverse((o) => {
  if ((!o.isMesh && !o.isInstancedMesh) || !o.geometry) return;
  box.setFromObject(o);
  if (box.isEmpty() || !isFinite(box.min.y)) return;
  const alt = box.max.y - box.min.y;
  if (alt >= 1.5) { verticais++; if (o.castShadow) verticaisProjetam++; }
  else if (alt < 0.35) { chao++; if (o.castShadow) chaoProjeta++; if (o.receiveShadow) chaoRecebe++; }
});
out.push(['malhas verticais (>1,5 m) no set', verticais]);
out.push(['  destas, projetam', verticaisProjetam]);
out.push(['TODA geometria vertical projeta', verticais > 0 && verticaisProjetam === verticais]);
out.push(['malhas rasas (<0,35 m)', chao]);
out.push(['  que projetam (deve ser 0 — laje não faz sombra)', chaoProjeta]);
out.push(['nenhuma malha rasa projeta', chaoProjeta === 0]);
out.push(['toda malha rasa recebe', chao > 0 && chaoRecebe === chao]);

/* ---------- 2. o passo da caixa segue a câmera ---------- */
S.controls.enabled = false;
const alvo = key.target.position.clone();
async function pose(nome, eye, tgt, semFoto) {
  S.camera.position.set(eye[0], eye[1], eye[2]);
  S.camera.lookAt(tgt[0], tgt[1], tgt[2]);
  S.camera.updateMatrixWorld(true);
  S.camera.updateProjectionMatrix();
  S.lighting.invalidate(8);
  for (let i = 0; i < 6; i++) await B.frame();
  if (semFoto) return;
  const res = await B.captureViewport({ quality: 'low', background: 'cena' });
  out.push([nome, await toURL(res.blob)]);
}

const perto = [[alvo.x + 9, 5, alvo.z + 9], [alvo.x, 1.5, alvo.z]];
const longe = [[alvo.x + 60, 26, alvo.z + 52], [alvo.x + 20, 2, alvo.z - 26]];

await pose('n/a', perto[0], perto[1], true);
const meiaPerto = key.shadow.camera.right;
const biasPerto = key.shadow.normalBias;
await pose('n/a', longe[0], longe[1], true);
const meiaLonge = key.shadow.camera.right;
const biasLonge = key.shadow.normalBias;
out.push(['meia-caixa perto / longe (m)', `${meiaPerto} / ${meiaLonge}`]);
out.push(['normalBias perto / longe', `${r2(biasPerto)} / ${r2(biasLonge)}`]);
out.push(['perto volta aos ±24 m de fábrica', meiaPerto === 24]);
out.push(['longe abre a caixa', meiaLonge > meiaPerto]);
out.push(['o bias acompanha a caixa', biasLonge > biasPerto]);
out.push(['a luz recua junto (m)',
  r2(key.position.distanceTo(key.target.position))]);

/* ---------- 3. as fotos ---------- */
S.lighting.applyPreset('ensolarado', { animate: false });
await pose('s1_sol_longe', longe[0], longe[1]);
await pose('s2_sol_perto', perto[0], perto[1]);

/* ---------- 4. a chuva, medida pelo que ela MEXE ---------- */
function retrato() {
  const mapa = new Map();
  set.traverse((o) => {
    if (!o.isMesh && !o.isInstancedMesh) return;
    for (const m of (Array.isArray(o.material) ? o.material : [o.material])) {
      if (!m || !m.isMeshStandardMaterial || mapa.has(m)) continue;
      mapa.set(m, { nome: m.name || '?', cor: m.color.getHex(), rug: m.roughness });
    }
  });
  return mapa;
}
S.lighting.applyPreset('ensolarado', { animate: false });
for (let i = 0; i < 3; i++) await B.frame();
const seco = retrato();
S.lighting.applyPreset('chuvoso', { animate: false });
for (let i = 0; i < 3; i++) await B.frame();
const molhado = retrato();

const parado = [];
let mexeu = 0;
for (const [m, a] of seco) {
  const b = molhado.get(m);
  if (!b) continue;
  if (a.cor !== b.cor || Math.abs(a.rug - b.rug) > 1e-4) mexeu++;
  else parado.push(a.nome);
}
out.push(['materiais do set', seco.size]);
out.push(['  reagem à chuva', mexeu]);
out.push(['  ficam secos', parado.length ? parado.join(', ') : 'nenhum']);
out.push(['TODO material do set reage à chuva', parado.length === 0]);

await pose('c1_chuva_longe', longe[0], longe[1]);
await pose('c2_chuva_perto', perto[0], perto[1]);

S.controls.enabled = true;
return out;
