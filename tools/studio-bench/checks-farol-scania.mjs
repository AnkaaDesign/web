/* SONDA DO FAROL DO SCANIA — quem desenha o pixel, e quem é candidato a capa.
       node tools/studio-bench/bench.mjs --gpu --geometry --checks checks-farol-scania.mjs

   Medido offline, a capa do farol dos Scania de cabine nova é
   `f_bumper_mat_0005_plastic_glossy` (BLEND, opacidade 0,8) e não `glass_ex`. A
   regra por geometria em `headlight-cover.ts` deveria pegá-la; a foto diz que o
   farol continua apagado. Esta sonda separa as três explicações possíveis:
   a capa não foi ACHADA, foi achada e não CLAREIA, ou quem tapa é outra coisa. */
const out = [];
const B = window.__bench;
const r2 = (v) => Math.round(v * 100) / 100;
const PREF = [/distrito|industrial/i, /scania/i, /scania-s-2016|s-2016/i, /4x2/i, /vermelh|red/i, /.*/];
async function escolher() {
  const ov = document.getElementById('ts-selector');
  const t = [];
  for (let p = 0; p < 12 && ov && !ov.classList.contains('hidden'); p++) {
    const cards = [...ov.querySelectorAll('.ts-card:not(.is-disabled)')];
    if (!cards.length) break;
    const re = PREF[Math.min(p, PREF.length - 1)];
    const a = cards.find((c) => re.test(c.dataset.id || '')) || cards[0];
    t.push(a.dataset.id || '?');
    a.click();
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
  }
  return t.join(' › ');
}
await B.until(() => {
  const o = document.getElementById('ts-selector');
  return !!o && o.classList.contains('is-open');
}, 30000);
out.push(['trilha', await escolher()]);
out.push(['__studio', await B.until(() => !!window.__studio, 480000)]);
const S = window.__studio;
if (!S) return out;
out.push(['implemento', await B.until(() => !!S.trailerRig, 240000)]);
const THREE = S.THREE;
const L = S.lighting;
L.setHourOfDay(20.5, { animate: false });
for (let i = 0; i < 20; i++) await B.frame();

const rig = S.scene.getObjectByName('RIG');
const cxs = rig.children.map((r) => new THREE.Box3().setFromObject(r));
const iCav = cxs.reduce((b, c, i) => (c.min.z < cxs[b].min.z ? i : b), 0);
const cavalo = rig.children[iCav];
const cav = cxs[iCav];

/* A caixa do farol, do próprio módulo. */
const hc = L.getHeadlightCover();
out.push(['capas registradas', hc.capas.map((c) => c.mat + '@' + c.nivel).join(', ') || 'NENHUMA']);
const cxa = hc.capas.length ? hc.capas[0].caixa : null;
out.push(['caixa da capa', cxa ? cxa.join(',') : '—']);
const alvo = cxa ? new THREE.Box3(
  new THREE.Vector3(cxa[0], cxa[1], cxa[2]), new THREE.Vector3(cxa[3], cxa[4], cxa[5])) : null;

/* TODO material transparente do cavalo, com a caixa da malha e o cruzamento. */
out.push(['— TUDO que cruza a caixa do farol —', '']);
const vistos = new Map();
cavalo.traverse((o) => {
  if (!o.isMesh || !o.geometry) return;
  const mm = Array.isArray(o.material) ? o.material : [o.material];
  for (const m of mm) {
    if (!m) continue;
    const cx = new THREE.Box3().makeEmpty();
    cx.expandByObject(o);
    const k = m.name || '?';
    const cruza = alvo && !cx.isEmpty() && cx.intersectsBox(alvo);
    if (!cruza) continue;
    vistos.set(k, `transp ${!!m.transparent} · opac ${r2(m.opacity ?? 1)} · depthWrite ${m.depthWrite}`
      + ` · ordem ${o.renderOrder}`
      + ` · caixa y ${r2(cx.min.y)}…${r2(cx.max.y)} z ${r2(cx.min.z)}…${r2(cx.max.z)}`
      + ` · CRUZA O FAROL: ${cruza ? 'SIM' : 'não'}`
      + ` · injetado ${typeof m.customProgramCacheKey === 'function'
        && /ts-capa/.test(String(m.customProgramCacheKey()))}`);
  }
});
for (const [n, d] of vistos) out.push([`  ${n}`, d]);

/* A PILHA no pixel do farol. */
S.controls.enabled = false;
const eye = [cav.max.x + 1.1, 1.0, cav.min.z - 2.4];
const tgt = [0.6, 0.85, cav.min.z + 0.1];
for (let i = 0; i < 20; i++) {
  S.controls.enabled = false;
  S.camera.position.set(eye[0], eye[1], eye[2]);
  S.camera.lookAt(tgt[0], tgt[1], tgt[2]);
  S.camera.updateMatrixWorld(true);
  S.camera.updateProjectionMatrix();
  L.invalidate(2);
  await B.frame();
}
const rc = new THREE.Raycaster();
const achados = new Map();
for (let gx = -0.9; gx <= 0.9; gx += 0.04) {
  for (let gy = -0.9; gy <= 0.6; gy += 0.04) {
    rc.setFromCamera(new THREE.Vector2(gx, gy), S.camera);
    const hits = rc.intersectObject(S.scene, true);
    for (let i = 0; i < Math.min(hits.length, 4); i++) {
      const h = hits[i];
      const m = Array.isArray(h.object.material) ? h.object.material[0] : h.object.material;
      if (!m || !m.name) continue;
      /* Só o que acerta DENTRO da caixa do farol interessa. */
      if (alvo && !alvo.containsPoint(h.point)) continue;   // só dentro da caixa
      const k = i + ' · ' + m.name;
      const reg = achados.get(k) || { n: 0, k, emi: r2(m.emissiveIntensity ?? 0),
        op: r2(m.opacity ?? 1), tr: !!m.transparent, ordem: h.object.renderOrder };
      reg.n++;
      achados.set(k, reg);
    }
  }
}
out.push(['— pilha DENTRO da caixa do farol —', '']);
[...achados.values()].sort((a, b) => b.n - a.n).slice(0, 14).forEach((r) => out.push([
  `  ${r.k}`, `${r.n} raios · emiInt ${r.emi} · opac ${r.op} · transp ${r.tr} · ordem ${r.ordem}`]));

L.setHourOfDay(17.75, { animate: false });
S.controls.enabled = true;
return out;
