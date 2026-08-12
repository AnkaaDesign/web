/* CURADORIA DO CANTEIRO CENTRAL — o que pode e o que não pode ficar nele.
   ---------------------------------------------------------------------------
       node tools/studio-bench/bench.mjs --gpu --geometry --checks checks-canteiro.mjs

   O pedido do dono do produto, nas palavras dele: tirar do CANTEIRO CENTRAL
   *"as árvores que têm a raiz exposta e estão flutuando"*, *"todas as mini
   árvores e os arbustos"* e *"as árvores com o tronco esbranquiçado"* — e
   *"nos canteiros ao redor manter como está"*.

   As quatro descrições são VISUAIS e o acervo não ajuda: `PLANT_BARK` é UM
   material só para as dez espécies, então nem nome nem material as separam. O
   que separa é medida, e esta bancada imprime as medidas ao lado do veredito
   para que a curadoria possa ser conferida em vez de acreditada:

     · a FICHA de cada espécie — altura, espalhamento da raiz abaixo da linha de
       chão do modelo, luminância e saturação do tronco lidas do atlas;
     · o VEREDITO por espécie, e onde cada uma foi de fato plantada;
     · as TRAVAS: nenhuma instância vetada dentro de um canteiro, e a grama com
       a mesma população de antes;
     · e as FOTOS, que são a única prova que interessa para um pedido de gosto.

   A trava não sabe os nomes das espécies deste set de propósito. Ela pergunta
   ao módulo quem foi vetado e confere que ninguém vetado está no canteiro —
   assim ela continua valendo quando o acervo do cenário mudar. */
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
const set = S.scene.getObjectByName('ts-set');
if (!set) return out;
S.scene.updateMatrixWorld(true);
S.lighting.applyPreset('ensolarado', { animate: false });
const toURL = (blob) => new Promise((r) => {
  const fr = new FileReader();
  fr.onload = () => r(fr.result);
  fr.readAsDataURL(blob);
});

/* ---------- as faixas, lidas como `scenery.ts` as lê ---------- */
const box = new THREE.Box3();
const faixas = [];
set.traverse((o) => {
  if (!o.isMesh || o.isInstancedMesh || !o.geometry) return;
  const n = o.name || '';
  const canteiro = /^median|^rb_island/i.test(n);
  if (!canteiro && !/^turf_/i.test(n)) return;
  box.setFromObject(o);
  if (box.isEmpty()) return;
  faixas.push({ n, canteiro, x0: box.min.x, x1: box.max.x, z0: box.min.z, z1: box.max.z });
});
const canteiros = faixas.filter((f) => f.canteiro);
out.push(['canteiros', canteiros.map((f) => f.n).join(', ') || 'nenhum']);
out.push(['há canteiro', canteiros.length > 0]);

/* ---------- as espécies, agrupadas como o módulo agrupa ---------- */
const grupos = new Map();
set.traverse((o) => {
  if (!o.isInstancedMesh || !o.geometry) return;
  const mat = Array.isArray(o.material) ? o.material[0] : o.material;
  if (!/^PLANT_/.test(mat?.name || '')) return;
  const p = o.parent;
  let chave = o;
  if (p && p.isGroup && p.children.length >= 2 && p.children.length <= 4
    && p.children.every((c) => c.isInstancedMesh)) chave = p;
  if (!grupos.has(chave)) grupos.set(chave, { nome: chave.name || o.name, malhas: [] });
  grupos.get(chave).malhas.push(o);
});
out.push(['espécies do acervo', grupos.size]);

/* ---------- as mesmas medidas do módulo, refeitas AQUI ----------
   Refeitas e não importadas de propósito: uma trava que chama a própria função
   que ela verifica só prova que a função é consistente consigo mesma. */
const s2l = (c) => { const x = c / 255; return x <= 0.04045 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4; };
const LADO = 128;
const atlasCache = new Map();
function lerAtlas(tex) {
  const img = tex?.image;
  if (!img) return null;
  if (atlasCache.has(img)) return atlasCache.get(img);
  let d = null;
  try {
    const cv = document.createElement('canvas');
    cv.width = LADO; cv.height = LADO;
    const ctx = cv.getContext('2d', { willReadFrequently: true });
    ctx.drawImage(img, 0, 0, LADO, LADO);
    d = ctx.getImageData(0, 0, LADO, LADO);
  } catch { d = null; }
  atlasCache.set(img, d);
  return d;
}

const bb = new THREE.Box3(), uni = new THREE.Box3();
const m4 = new THREE.Matrix4();
const _p = new THREE.Vector3(), _q = new THREE.Quaternion(), _s = new THREE.Vector3();
const fichas = [];
for (const g of grupos.values()) {
  uni.makeEmpty();
  let casca = null;
  for (const im of g.malhas) {
    if (!im.geometry.boundingBox) im.geometry.computeBoundingBox();
    bb.copy(im.geometry.boundingBox);
    uni.union(bb);
    const mat = Array.isArray(im.material) ? im.material[0] : im.material;
    if (/BARK/i.test(mat?.name || '')) casca = im;
  }
  const altura = uni.max.y - uni.min.y;

  /* raiz: raio máximo da casca abaixo de y = 0 local */
  let raizR = 0;
  if (casca) {
    const pos = casca.geometry.getAttribute('position');
    for (let i = 0; i < pos.count; i++) {
      if (pos.getY(i) >= 0) continue;
      raizR = Math.max(raizR, Math.hypot(pos.getX(i), pos.getZ(i)));
    }
  }

  /* albedo do tronco, ponderado por área */
  let lum = null, sat = null;
  if (casca) {
    const mat = Array.isArray(casca.material) ? casca.material[0] : casca.material;
    const atlas = lerAtlas(mat?.map);
    const pos = casca.geometry.getAttribute('position');
    const uv = casca.geometry.getAttribute('uv');
    const idx = casca.geometry.index;
    if (atlas && pos && uv) {
      let minY = Infinity, maxY = -Infinity;
      for (let i = 0; i < pos.count; i++) {
        const y = pos.getY(i);
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
      const lo = minY + (maxY - minY) * 0.10, hi = minY + (maxY - minY) * 0.45;
      const tris = (idx ? idx.count : pos.count) / 3;
      let area = 0, sl = 0, sr = 0, sg = 0, sb = 0;
      for (let t = 0; t < tris; t++) {
        const a = idx ? idx.getX(t * 3) : t * 3;
        const b = idx ? idx.getX(t * 3 + 1) : t * 3 + 1;
        const c = idx ? idx.getX(t * 3 + 2) : t * 3 + 2;
        const ay = pos.getY(a), by = pos.getY(b), cy = pos.getY(c);
        const yc = (ay + by + cy) / 3;
        if (yc < lo || yc > hi) continue;
        const e1 = [pos.getX(b) - pos.getX(a), by - ay, pos.getZ(b) - pos.getZ(a)];
        const e2 = [pos.getX(c) - pos.getX(a), cy - ay, pos.getZ(c) - pos.getZ(a)];
        const nx = e1[1] * e2[2] - e1[2] * e2[1];
        const ny = e1[2] * e2[0] - e1[0] * e2[2];
        const nz = e1[0] * e2[1] - e1[1] * e2[0];
        const A = Math.hypot(nx, ny, nz) / 2;
        if (A < 1e-9 || Math.abs(ny) > Math.hypot(nx, nz)) continue;
        const u = (uv.getX(a) + uv.getX(b) + uv.getX(c)) / 3;
        const v = (uv.getY(a) + uv.getY(b) + uv.getY(c)) / 3;
        const px = Math.min(LADO - 1, Math.max(0, Math.floor((((u % 1) + 1) % 1) * LADO)));
        const py = Math.min(LADO - 1, Math.max(0, Math.floor((((v % 1) + 1) % 1) * LADO)));
        const o = (py * LADO + px) * 4;
        const r = atlas.data[o], g2 = atlas.data[o + 1], b2 = atlas.data[o + 2];
        area += A; sr += r * A; sg += g2 * A; sb += b2 * A;
        sl += (0.2126 * s2l(r) + 0.7152 * s2l(g2) + 0.0722 * s2l(b2)) * A;
      }
      if (area) {
        const R = sr / area, G = sg / area, Bl = sb / area;
        const mx = Math.max(R, G, Bl), mn = Math.min(R, G, Bl);
        lum = sl / area; sat = mx > 0 ? (mx - mn) / mx : 0;
      }
    }
  }

  /* Os mesmos cortes de `scenery.ts`. */
  const veto = altura < 4 ? 'porte de arbusto'
    : altura > 11 ? 'porte grande demais'
      : raizR > altura * 0.10 ? 'raiz aparente'
        : (lum !== null && lum >= 0.12 && sat <= 0.14) ? 'casca esbranquiçada'
          : null;

  /* Onde ela foi plantada de fato. */
  const im0 = g.malhas[0];
  let noCanteiro = 0, naGrama = 0, fora = 0;
  const noCanteiroPos = [];
  for (let i = 0; i < im0.count; i++) {
    im0.getMatrixAt(i, m4);
    m4.decompose(_p, _q, _s);
    const w = _p.clone().applyMatrix4(im0.matrixWorld);
    const f = faixas.find((k) => w.x >= k.x0 && w.x <= k.x1 && w.z >= k.z0 && w.z <= k.z1);
    if (!f) fora++;
    else if (f.canteiro) { noCanteiro++; noCanteiroPos.push(w); }
    else naGrama++;
  }
  fichas.push({ nome: g.nome, altura, raizR, lum, sat, veto, grupo: g,
    plantadas: im0.count, noCanteiro, naGrama, fora, noCanteiroPos });
}

fichas.sort((a, b) => a.altura - b.altura);
for (const f of fichas) {
  const cor = f.lum === null ? 'sem pixels'
    : `lum ${f.lum.toFixed(3)} sat ${f.sat.toFixed(2)}`;
  out.push([`ficha ${f.nome}`,
    `alt ${f.altura.toFixed(2)} m · raiz ${f.raizR.toFixed(2)} (${(f.raizR / f.altura).toFixed(3)}×h) `
    + `· ${cor} ⇒ ${f.veto || 'APROVADA no canteiro'} `
    + `· plantadas ${f.plantadas} = ${f.noCanteiro} canteiro + ${f.naGrama} grama + ${f.fora} fora`]);
}

/* ---------- as travas ---------- */
const aprovadas = fichas.filter((f) => !f.veto);
out.push(['alguma espécie aprovada no canteiro', aprovadas.length > 0]);

const intrusos = fichas.filter((f) => f.veto && f.noCanteiro > 0);
out.push(['nenhuma espécie vetada no canteiro',
  intrusos.length === 0 || `INTRUSO: ${intrusos.map((f) => `${f.nome} ×${f.noCanteiro} (${f.veto})`).join(', ')}`]);

/* Todo mundo que está no canteiro está aprovado — o mesmo do avesso, para pegar
   uma espécie que o veto deixou passar por engano de sinal. */
const noCanteiroTotal = fichas.reduce((s, f) => s + f.noCanteiro, 0);
const aprovadasNoCanteiro = aprovadas.reduce((s, f) => s + f.noCanteiro, 0);
out.push(['todo tronco do canteiro é de espécie aprovada',
  noCanteiroTotal === aprovadasNoCanteiro || `${noCanteiroTotal - aprovadasNoCanteiro} de espécie vetada`]);
out.push(['o canteiro não ficou pelado', noCanteiroTotal >= 10 || `só ${noCanteiroTotal}`]);

/* A GRAMA CONTINUA POVOADA — o pedido foi mexer só no canteiro. Se a grama
   perdesse população, o veto teria vazado para fora do canteiro. */
const naGramaTotal = fichas.reduce((s, f) => s + f.naGrama, 0);
const especiesNaGrama = fichas.filter((f) => f.naGrama > 0).length;
out.push(['espécies na grama', `${especiesNaGrama} espécies · ${naGramaTotal} plantas`]);
out.push(['a grama manteve arbusto', fichas.some((f) => f.altura < 4 && f.naGrama > 0)]);
out.push(['a grama manteve árvore grande', fichas.some((f) => f.altura > 11 && f.naGrama > 0)]);
out.push(['a grama manteve as vetadas que já eram dela',
  fichas.filter((f) => f.veto && f.naGrama > 0).length > 0]);

/* NADA FORA DE FAIXA — a trava que `checks-cenario.mjs` já tinha, repetida aqui
   porque o veto mexe no destino e é exatamente por aí que uma planta escaparia
   para o asfalto. */
const foraTotal = fichas.reduce((s, f) => s + f.fora, 0);
out.push(['nenhuma planta fora de faixa', foraTotal === 0 || `${foraTotal} fora`]);

/* ALAMEDA SEM EMPILHAMENTO: dois troncos do canteiro a menos de 4 m um do
   outro são o defeito fotografado (as espécies dividiam as mesmas estações). */
const todosNoCanteiro = [];
for (const f of fichas) {
  const im0 = f.grupo.malhas[0];
  for (let i = 0; i < im0.count; i++) {
    im0.getMatrixAt(i, m4);
    m4.decompose(_p, _q, _s);
    const w = _p.clone().applyMatrix4(im0.matrixWorld);
    if (canteiros.some((k) => w.x >= k.x0 && w.x <= k.x1 && w.z >= k.z0 && w.z <= k.z1)) {
      todosNoCanteiro.push(w);
    }
  }
}
let minDist = Infinity;
for (let i = 0; i < todosNoCanteiro.length; i++) {
  for (let j = i + 1; j < todosNoCanteiro.length; j++) {
    minDist = Math.min(minDist, todosNoCanteiro[i].distanceTo(todosNoCanteiro[j]));
  }
}
out.push(['menor vão entre troncos do canteiro',
  `${Number.isFinite(minDist) ? minDist.toFixed(1) : '—'} m`]);
out.push(['troncos do canteiro não se empilham',
  !Number.isFinite(minDist) || minDist >= 4 || `${minDist.toFixed(1)} m`]);

/* ---------- as fotos ---------- */
S.controls.enabled = false;
const orbit = { min: S.controls.minDistance, max: S.controls.maxDistance };
S.controls.minDistance = 0;
S.controls.maxDistance = Infinity;

/* ⚠️ SOLTAR O FOCO DO VEÍCULO, ou a mira não é a que se pediu.
   `setVehicleFocus()` instala um frameHook que prende `controls.target` a
   `FOCUS_PAN_F · r` do centro do rig (scene.ts). Ele roda DEPOIS do `lookAt()`
   do check e o `controls.update()` do laço reaponta a câmera para o alvo
   preso — então a lente ficava exatamente onde se pediu (a conferência de pose
   passava) e olhava para o CAMINHÃO. Medido: mira pedida em z −8,3 saía em
   z +6,3, e a foto do pé da árvore virou uma foto do baú. A pose passou a
   conferir a MIRA junto com a lente, que é o que teria pegado isto na hora. */
S.lighting.setVehicleFocus(null);
/* E a caixa do INTERIOR do set, pelo mesmo motivo e num hook diferente: ela
   prende lente e mira dentro dos ~58 m do pátio, e o canteiro tem 294 m. */
S.lighting.setInteriorBounds(null);

const veic = new THREE.Box3().setFromObject(S.trailerGroup || S.cabGroup).getCenter(new THREE.Vector3());
const cam = S.camera;
async function foto(tag, eye, alvo, fov) {
  for (let i = 0; i < 24; i++) {
    S.controls.target.copy(alvo);
    cam.position.copy(eye);
    cam.up.set(0, 1, 0);
    cam.fov = fov;
    cam.updateProjectionMatrix();
    cam.lookAt(alvo);
    cam.updateMatrixWorld(true);
    S.lighting.invalidate(2);
    await B.frame();
  }
  const res = await B.captureViewport({ quality: 'low', background: 'cena' });
  out.push([tag, await toURL(res.blob)]);
  const dLente = cam.position.distanceTo(eye);
  const dMira = S.controls.target.distanceTo(alvo);
  out.push([`  ${tag} pose`, dLente < 0.02 && dMira < 0.02 ? 'ok'
    : `ESCAPOU · lente ${Math.round(dLente * 1000)} mm · mira ${Math.round(dMira * 1000)} mm`]);
}

const xC = (canteiros[0].x0 + canteiros[0].x1) / 2;
/* 1 · de trás do conjunto, a alameda correndo ao lado — o enquadramento das
   fotos do pedido. */
await foto('c1-alameda-de-tras',
  new THREE.Vector3(veic.x + 4.5, 6.5, veic.z - 26),
  new THREE.Vector3(xC, 3, veic.z + 40), 42);
/* 2 · da frente, o outro lado. */
await foto('c2-alameda-de-frente',
  new THREE.Vector3(veic.x + 5, 6, veic.z + 46),
  new THREE.Vector3(xC, 3, veic.z - 20), 42);
/* 3 · o pé de uma árvore do canteiro: a prova de que não há raiz de aranha nem
   arbusto ali.

   ⚠️ A MIRA TEM DE CABER NA CAIXA INTERNA DO SET. `setInteriorBox()` (scene.ts)
   prende `camera.position` E `controls.target` dentro dela num frameHook, e o
   canteiro tem 294 m de comprimento contra uns 58 m de caixa — mirar na árvore
   mais distante fez a lente escapar 58 m e fotografar outra coisa. Então a
   escolha é a árvore mais longe do conjunto DENTRO de um raio que a caixa
   aceita; e a lente fica entre ela e o conjunto, olhando para longe dele, que é
   o que impede o atravessar de dissolver justamente o pé em exame. */
const alvoPe = (aprovadas[0]?.noCanteiroPos || [])
  .filter((w) => Math.abs(w.z - veic.z) < 22 && Math.abs(w.x - veic.x) < 22)
  .sort((a, b) => b.distanceTo(veic) - a.distanceTo(veic))[0];
out.push(['veículo e alvo do pé',
  `veic ${veic.x.toFixed(1)}/${veic.z.toFixed(1)} · pé ${alvoPe ? `${alvoPe.x.toFixed(1)}/${alvoPe.z.toFixed(1)}` : '—'}`]);
if (alvoPe) {
  /* A lente entre o conjunto e a árvore, olhando PARA LONGE dele — assim o
     veículo fica atrás da câmera e não há o que dissolver nem o que tapar. E
     deslocada de lado o bastante para o baú não entrar pela borda do quadro. */
  const dir = veic.clone().sub(alvoPe).setY(0).normalize();
  const lado = new THREE.Vector3(-dir.z, 0, dir.x).multiplyScalar(0.7);
  await foto('c3-pe-no-canteiro',
    alvoPe.clone().add(dir.add(lado).normalize().multiplyScalar(13)).setY(3.4),
    alvoPe.clone().setY(2.2), 44);
}
/* 4 · uma faixa de grama, que tinha de ficar como estava. */
const grama = faixas.filter((f) => !f.canteiro)
  .sort((a, b) => (b.x1 - b.x0) * (b.z1 - b.z0) - (a.x1 - a.x0) * (a.z1 - a.z0))[0];
if (grama) {
  const gx = (grama.x0 + grama.x1) / 2, gz = (grama.z0 + grama.z1) / 2;
  await foto('c4-grama-intacta',
    new THREE.Vector3(gx + (veic.x - gx) * 0.15, 7, gz - 55),
    new THREE.Vector3(gx, 3, gz + 20), 45);
}

S.controls.minDistance = orbit.min;
S.controls.maxDistance = orbit.max;
S.controls.enabled = true;
return out;
