/* SONDA DAS LUZES — 2026-08-12, os seis defeitos relatados com foto.
   ---------------------------------------------------------------------------
       node tools/studio-bench/bench.mjs --gpu --geometry --checks checks-luzes-diag.mjs

   Ela NÃO trava nada — mede. Em metros de mundo: onde cada lâmpada está, de que
   RAIZ ela é, que cor o shader resolve nela, onde cada um dos seis feixes nasce e
   para onde aponta. E depois lê o PIXEL, porque registro não é brilho.

   Escolhe o VOLVO FH das fotos do dono do produto, e não o primeiro card: as
   regras de `lights.ts` dependem dos nomes do bake, e medir outro chassi
   responderia outra pergunta. */
const out = [];
const B = window.__bench;
const r2 = (v) => Math.round(v * 100) / 100;

/* Atravessa o seletor PREFERINDO um alvo por etapa. `settleSelector()` clica
   sempre no primeiro card, o que caiu num Scania R 2009 na primeira rodada. */
const PREF = [/distrito|industrial/i, /volvo/i, /fh.*2021|fh_2021|fh 2021/i, /4x2/i, /.*/];
async function escolher() {
  const ov = document.getElementById('ts-selector');
  if (!ov) return 'sem seletor';
  const trilha = [];
  for (let passo = 0; passo < 12; passo++) {
    if (ov.classList.contains('hidden')) break;
    const cards = [...ov.querySelectorAll('.ts-card:not(.is-disabled)')];
    if (!cards.length) break;
    const re = PREF[Math.min(passo, PREF.length - 1)];
    const alvo = cards.find((c) => re.test(c.dataset.id || '')) || cards[0];
    trilha.push(alvo.dataset.id || '?');
    alvo.click();
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
  }
  return trilha.join(' › ');
}

await B.until(() => {
  const o = document.getElementById('ts-selector');
  return !!o && o.classList.contains('is-open');
}, 30000);
out.push(['trilha do seletor', await escolher()]);
out.push(['__studio de pé', await B.until(() => !!window.__studio, 480000)]);
const S = window.__studio;
if (!S) return out;
out.push(['implemento carregado', await B.until(() => !!S.trailerRig, 240000)]);
const THREE = S.THREE;
const L = S.lighting;

L.setHourOfDay(21, { animate: false });
for (let i = 0; i < 12; i++) await B.frame();

const rig = S.scene.getObjectByName('RIG');
const raizes = rig ? rig.children.slice() : [];
const nomeRaiz = (o) => {
  let a = o;
  while (a && a.parent !== rig) a = a.parent;
  const i = raizes.indexOf(a);
  return i < 0 ? 'fora' : `raiz${i}`;
};
out.push(['— raízes sob o RIG —', '']);
raizes.forEach((r, i) => {
  const c = new THREE.Box3().setFromObject(r);
  out.push([`  raiz${i} ${r.name || '(sem nome)'}`, c.isEmpty() ? 'vazia'
    : `x ${r2(c.min.x)}…${r2(c.max.x)} · y ${r2(c.min.y)}…${r2(c.max.y)} · z ${r2(c.min.z)}…${r2(c.max.z)}`]);
});

const vl = L.getVehicleLights();
out.push(['nível / materiais / raízes', `${r2(vl.nivel)} · ${vl.materiais} · ${(vl.raizes || []).join(' | ')}`]);

/* ---------- cada lâmpada em mundo, agrupada pela RAIZ ---------- */
const porMat = new Map();
S.scene.traverse((o) => {
  if (!o.isMesh || !o.geometry) return;
  const mm = Array.isArray(o.material) ? o.material : [o.material];
  for (const m of mm) {
    if (!m || !m.name || !vl.nomes.includes(m.name)) continue;
    let reg = porMat.get(m.name);
    if (!reg) {
      reg = { cx: new THREE.Box3().makeEmpty(), raiz: nomeRaiz(o), malhas: 0, mat: m };
      porMat.set(m.name, reg);
    }
    o.geometry.boundingBox = null;
    if (o.isInstancedMesh) o.boundingBox = null;
    const c = new THREE.Box3().makeEmpty();
    c.expandByObject(o);
    if (!c.isEmpty()) reg.cx.union(c);
    reg.malhas++;
  }
});
const faces = new Map();
for (const [, v] of porMat) {
  if (v.cx.isEmpty()) continue;
  const f = faces.get(v.raiz) || { z0: Infinity, z1: -Infinity };
  f.z0 = Math.min(f.z0, v.cx.min.z);
  f.z1 = Math.max(f.z1, v.cx.max.z);
  faces.set(v.raiz, f);
}
out.push(['— faces por raiz (extremo das LÂMPADAS) —', '']);
for (const [r, f] of faces) out.push([`  ${r}`, `z ${r2(f.z0)} … ${r2(f.z1)}`]);

out.push(['— cada lâmpada —', '']);
for (const [nome, v] of [...porMat].sort((a, b) => a[1].cx.min.z - b[1].cx.min.z)) {
  const f = faces.get(v.raiz) || { z0: 0, z1: 1 };
  const zc = (v.cx.min.z + v.cx.max.z) / 2;
  out.push([`  ${nome}`,
    `${v.raiz} · malhas ${v.malhas}`
    + ` · x ${r2(v.cx.min.x)}…${r2(v.cx.max.x)} · y ${r2(v.cx.min.y)}…${r2(v.cx.max.y)}`
    + ` · z ${r2(v.cx.min.z)}…${r2(v.cx.max.z)}`
    + ` · dF ${r2(Math.abs(zc - f.z0))} · dT ${r2(Math.abs(zc - f.z1))}`
    + ` · ${vl.detalhe[nome] || ''}`]);
}

/* ---------- quem parece lâmpada e NÃO entrou ---------- */
out.push(['— candidatos NÃO registrados —', '']);
const fora = new Map();
const PARECE = /light|lamp|farol|faror|lantern|led|sinal|posic|position|pisca|blink|marker|drl/i;
S.scene.traverse((o) => {
  if (!o.isMesh) return;
  const r = nomeRaiz(o);
  if (r === 'fora') return;
  const mm = Array.isArray(o.material) ? o.material : [o.material];
  for (const m of mm) {
    if (!m || !m.name || vl.nomes.includes(m.name) || fora.has(m.name)) continue;
    const emi = m.emissive ? (m.emissive.r + m.emissive.g + m.emissive.b) : 0;
    if (!PARECE.test(m.name) && !(emi > 0.01)) continue;
    fora.set(m.name, `${r} · emissivo ${r2(emi)} · transp ${!!m.transparent}`
      + ` · opac ${r2(m.opacity ?? 1)} · emiMap ${!!m.emissiveMap} · malha ${o.name || '?'}`);
  }
});
for (const [n, d] of fora) out.push([`  ${n}`, d]);

/* ---------- os seis feixes ---------- */
out.push(['— feixes —', '']);
const fb = L.getVehicleBeams();
out.push(['reservados/criados/acesos', `${fb.reservados}/${fb.criados}/${fb.acesos}`]);
fb.detalhe.forEach((d, i) => out.push([`  feixe ${i}`,
  `cor ${d.cor} · I ${d.intensidade} · pos ${d.pos.join(',')} · alvo ${d.alvo.join(',')}`]));

const cxs = raizes.map((r) => new THREE.Box3().setFromObject(r));
const impIdx = cxs.reduce((best, c, i) => (c.max.z > cxs[best].max.z ? i : best), 0);
out.push(['implemento (maior z)', `raiz${impIdx} · parede dianteira z ${r2(cxs[impIdx].min.z)}`]);
if (fb.detalhe[4]) {
  out.push(['feixe 4 nasce em z / a parede está em z',
    `${fb.detalhe[4].pos[2]} / ${r2(cxs[impIdx].min.z)}`
    + ` ⇒ ${r2(cxs[impIdx].min.z - fb.detalhe[4].pos[2])} m à frente (negativo = DENTRO do baú)`]);
}

/* ---------- capa ---------- */
out.push(['— capa do farol —', '']);
const hc = L.getHeadlightCover();
out.push(['capas achadas', String(hc.capas.length)]);
hc.capas.forEach((c) => out.push([`  ${c.raiz} · ${c.mat}`,
  `nível ${c.nivel} · caixa ${c.caixa.join(',')}`]));

/* ---------- halo ---------- */
out.push(['— halo —', '']);
const ha = L.getLampHalos ? L.getLampHalos() : null;
out.push(['exposto no handle', !!ha]);
if (ha) {
  out.push(['sítios / desenhados / na cena',
    `${ha.sitios} / ${ha.desenhados} / ${ha.naCena}`]);
  out.push(['nível · pico · escala', `${ha.nivel} · ${ha.pico} · ${ha.escala}`]);
}

/* ---------- PIXEL + PILHA nas três poses das fotos ---------- */
S.controls.enabled = false;
const cxa = L.getSeeThrough().alvoCaixa;
const cxm = cxa ? (cxa[0] + cxa[3]) / 2 : 0;
function pose(eye, tgt) {
  S.camera.position.set(eye[0], eye[1], eye[2]);
  S.camera.lookAt(tgt[0], tgt[1], tgt[2]);
  S.camera.updateMatrixWorld(true);
  S.camera.updateProjectionMatrix();
  L.invalidate(6);
}
const toURL = (b) => new Promise((r) => {
  const fr = new FileReader(); fr.onload = () => r(fr.result); fr.readAsDataURL(b);
});

/* O que o shader faria: a mesma conta de MAIN_FRAG, no ponto do acerto. */
const P0 = 0.45, P1 = 0.85;
const ss = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
function corNoPonto(nomeMat, z) {
  const v = porMat.get(nomeMat);
  if (!v) return '-';
  const f = faces.get(v.raiz) || { z0: 0, z1: 1 };
  const fixa = /\(fixa\)/.test(vl.detalhe[nomeMat] || '');
  if (fixa) return 'fixa ' + (vl.detalhe[nomeMat].match(/cor ([0-9a-f]{6})/) || [])[1];
  const sF = ss(P0, P1, Math.abs(z - f.z0)), sT = ss(P0, P1, Math.abs(z - f.z1));
  return `frente ${r2(1 - sF)} · tras ${r2(1 - sT)} · lado ${r2(sF * sT)}`;
}

async function sonda(nome, eye, tgt, gx0, gx1, gy0, gy1) {
  pose(eye, tgt);
  for (let i = 0; i < 22; i++) await B.frame();
  const res = await B.captureViewport({ quality: 'low', background: 'cena' });
  out.push([nome, await toURL(res.blob)]);
  const rc = new THREE.Raycaster();
  const achados = new Map();
  for (let gx = gx0; gx <= gx1; gx += 0.03) {
    for (let gy = gy0; gy <= gy1; gy += 0.03) {
      rc.setFromCamera(new THREE.Vector2(gx, gy), S.camera);
      const hits = rc.intersectObject(S.scene, true);
      for (let i = 0; i < Math.min(hits.length, 3); i++) {
        const h = hits[i];
        const m = Array.isArray(h.object.material) ? h.object.material[0] : h.object.material;
        if (!m || !m.name) continue;
        const eh = vl.nomes.includes(m.name);
        if (!eh && i > 0) continue;
        const k = i + ' · ' + m.name;
        const reg = achados.get(k) || { n: 0, k, z0: Infinity, z1: -Infinity, lamp: eh,
          emi: r2(m.emissiveIntensity ?? 0), op: r2(m.opacity ?? 1) };
        reg.n++;
        reg.z0 = Math.min(reg.z0, h.point.z); reg.z1 = Math.max(reg.z1, h.point.z);
        achados.set(k, reg);
      }
    }
  }
  [...achados.values()].sort((a, b) => b.n - a.n).slice(0, 12).forEach((r) => {
    const nm = r.k.split(' · ')[1];
    out.push([`  ${r.k}`, `${r.n} raios · emiInt ${r.emi} · opac ${r.op}`
      + ` · z do acerto ${r2(r.z0)}…${r2(r.z1)}`
      + (r.lamp ? ` · shader: ${corNoPonto(nm, (r.z0 + r.z1) / 2)}` : '')]);
  });
}

if (cxa) {
  /* 1) A FRENTE — a foto 1 do relato. */
  await sonda('f1_frente_do_cavalo', [cxm + 2.2, 1.2, cxa[2] - 4.5], [cxm, 1.0, cxa[2]],
    -0.7, 0.7, -0.7, 0.3);
  /* 2) A LATERAL do cavalo — a foto 2. */
  await sonda('f2_lateral_do_cavalo', [cxm + 6.5, 1.6, cxa[2] + 2.0], [cxm, 1.4, cxa[2] + 2.6],
    -0.8, 0.8, -0.6, 0.4);
  /* 3) A TRASEIRA do cavalo — as fotos 4 e 5. Onde o implemento começa. */
  await sonda('f4_traseira_do_cavalo', [cxm + 3.6, 1.4, cxs[impIdx].min.z + 1.0],
    [cxm - 0.8, 1.0, cxs[impIdx].min.z + 4.2], -0.8, 0.8, -0.7, 0.4);
  /* 4) A QUINA DO RUFO do implemento — a foto 3. */
  await sonda('f3_rufo_do_implemento', [cxm + 5.0, 5.2, cxs[impIdx].min.z + 3.0],
    [cxm, 4.0, cxs[impIdx].min.z + 6.0], -0.8, 0.8, -0.6, 0.5);
}

L.setHourOfDay(17.75, { animate: false });
S.controls.enabled = true;
return out;
