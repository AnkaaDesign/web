/* SONDA 2 do relato de 2026-08-11, item 1: "o frame metálico superior da
   TESTEIRA termina antes do que deveria, deixando um espaço onde vai o
   Thermo King".

   A sonda 1 (checks-frente-travas-chapas.mjs) listou as CAIXAS das peças da
   testeira alta e nenhuma delas "termina cedo" — as duas candidatas óbvias
   (`metal-galvanizado-mantido` e a `inox-ferragem` do topo) atravessam o baú
   de ponta a ponta. Ou seja: a peça que falta não está na lista porque ela é
   estreita, ou porque quem termina cedo é um PEDAÇO de uma malha larga.

   Então aqui se mede pelo que a CÂMERA vê: um leque de raios entrando pela
   frente, e para cada (x, y) o primeiro triângulo encontrado na casca da
   testeira. O perfil em x de cada altura diz onde cada peça começa e acaba
   com a precisão do passo do raio, e não da caixa.

   Roda:  node tools/studio-bench/bench.mjs --gpu --geometry \
            --checks checks-frente-frame.mjs
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
const root = S.trailer;
root.updateWorldMatrix(true, true);

/* Os raios são lançados em MUNDO; o conjunto pode estar engatado (girado 180°
   e 12 m adiante), então tudo é convertido pela matriz do implemento — medir
   em mundo aqui mediria o interior do baú. GOTCHA já anotado na rodada do
   snapshot de livery. */
const toWorld = root.matrixWorld.clone();
const toLocal = toWorld.clone().invert();

/* Só o implemento entra no teste — o cavalo tem a cabine bem na linha de tiro. */
const targets = [];
root.traverse((o) => { if (o.isMesh && o.visible) targets.push(o); });
out.push(['malhas alvo', targets.length]);

const ray = new THREE.Raycaster();
ray.firstHitOnly = false;
const org = new THREE.Vector3();
const dir = new THREE.Vector3();
const hitLocal = new THREE.Vector3();

/** O primeiro toque na casca da testeira (z local entre `zLo` e `zHi`). */
function probe(x, y, zLo, zHi) {
  org.set(x, y, 12).applyMatrix4(toWorld);
  dir.set(0, 0, -1).transformDirection(toWorld);
  ray.set(org, dir);
  const hits = ray.intersectObjects(targets, false);
  for (const h of hits) {
    hitLocal.copy(h.point).applyMatrix4(toLocal);
    if (hitLocal.z < zLo || hitLocal.z > zHi) continue;
    const mats = Array.isArray(h.object.material) ? h.object.material : [h.object.material];
    return {
      name: h.object.name || '?',
      mat: mats.map((m) => (m && m.name) || '?').join('+'),
      z: hitLocal.z,
    };
  }
  return null;
}

/** Compacta o perfil em x numa lista de FAIXAS de mesma peça. */
function runsAt(y, zLo, zHi, x0 = -1.35, x1 = 1.35, step = 0.005) {
  const runs = [];
  for (let x = x0; x <= x1 + 1e-9; x += step) {
    const h = probe(x, y, zLo, zHi);
    const key = h ? `${h.mat}|${h.name}` : '(vazio)';
    const last = runs[runs.length - 1];
    if (last && last.key === key) { last.x1 = x; last.zHi = Math.max(last.zHi, h ? h.z : -9); }
    else runs.push({ key, x0: x, x1: x, zHi: h ? h.z : -9, mat: h ? h.mat : '—', name: h ? h.name : '—' });
  }
  return runs;
}

/* A casca da testeira mora entre 7,10 e 7,30 m; o Thermo King começa em 7,233
   e vai até 7,684, então a janela de baixo o exclui e deixa ver o que está
   ATRÁS dele — que é exatamente a pergunta ("o frame chega onde a unidade
   está?"). A janela de cima INCLUI a unidade, para localizá-la. */
for (const [tag, zLo, zHi] of [['casca (7,10..7,24)', 7.10, 7.24]]) {
  for (const y of [4.170, 4.150, 4.130, 4.110, 4.080, 4.050, 4.020, 3.990, 3.965, 3.940]) {
    const runs = runsAt(y, zLo, zHi).filter((r) => r.x1 - r.x0 > 0.004 || r.key !== '(vazio)');
    out.push([`y ${mm(y)} ${tag}`, runs.map((r) =>
      `${mm(r.x0)}..${mm(r.x1)} ${r.key === '(vazio)' ? 'VAZIO' : r.mat.slice(0, 26) + '@' + mm(r.zHi)}`
    ).join('  ·  ')]);
  }
}

/* E o perfil VERTICAL em três colunas: no meio (atrás do TK), na folga entre a
   unidade e a cantoneira, e sobre a cantoneira. */
for (const x of [0, 0.9, 1.02, 1.08, 1.14, 1.20, 1.26]) {
  const col = [];
  let last = null;
  for (let y = 3.90; y <= 4.20 + 1e-9; y += 0.005) {
    const h = probe(x, y, 7.10, 7.24);
    const key = h ? h.mat : '(vazio)';
    if (last && last.key === key) last.y1 = y;
    else { last = { key, y0: y, y1: y }; col.push(last); }
  }
  out.push([`coluna x ${mm(x)}`, col.map((c) =>
    `${mm(c.y0)}..${mm(c.y1)} ${c.key === '(vazio)' ? 'VAZIO' : c.key.slice(0, 26)}`).join('  ·  ')]);
}

/* Onde a unidade realmente cobre, para saber o que é "espaço" de verdade. */
const tk = S.state?.tk;
if (tk) {
  const cols = [];
  for (let x = 0.90; x <= 1.30 + 1e-9; x += 0.01) {
    const h = probe(x, 4.05, 7.20, 7.90);
    cols.push(`${mm(x)}:${h ? h.mat.slice(0, 12) : '—'}`);
  }
  out.push(['y 4050, quem está na frente', cols.join(' ')]);
}

out.push(['perfil', `teto ${mm(prof.roofY)} · piso ${mm(prof.floorY)} · z1 ${mm(prof.z1)}`]);
return out;
