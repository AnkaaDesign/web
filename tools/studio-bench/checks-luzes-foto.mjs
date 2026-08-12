/* FOTOS DAS LUZES nas poses do relato de 2026-08-12.
       node tools/studio-bench/bench.mjs --gpu --geometry --checks checks-luzes-foto.mjs

   A sonda irmã (`checks-luzes-diag.mjs`) dá os números; esta dá o que o olho vê.

   ⚠️ A POSE TEM DE SER REESCRITA A CADA QUADRO. `controls.enabled = false` não
   basta: o laço do estúdio re-dirige a câmera (damping do OrbitControls e o
   reenquadramento do rig), e uma primeira rodada devolveu SEIS fotos na pose de
   abertura — pareciam certas e não eram. Aqui a pose é reafirmada dentro do laço
   de quadros e a posição EFETIVA sai no relatório para conferência. */
const out = [];
const B = window.__bench;
const r2 = (v) => Math.round(v * 100) / 100;
/* O SCANIA S das fotos de 2026-08-12 (tarde): é nele que a capa do farol não se
   chama `glass_ex`, e é ele que o dono do produto fotografou. */
const PREF = [/distrito|industrial/i, /scania/i, /scania-s-2016|s-2016|s_2016/i, /4x2/i, /vermelh|laranja|red/i, /.*/];
async function escolher() {
  const ov = document.getElementById('ts-selector');
  const trilha = [];
  for (let p = 0; p < 12 && ov && !ov.classList.contains('hidden'); p++) {
    const cards = [...ov.querySelectorAll('.ts-card:not(.is-disabled)')];
    if (!cards.length) break;
    const re = PREF[Math.min(p, PREF.length - 1)];
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
out.push(['trilha', await escolher()]);
out.push(['__studio', await B.until(() => !!window.__studio, 480000)]);
const S = window.__studio;
if (!S) return out;
out.push(['implemento', await B.until(() => !!S.trailerRig, 240000)]);
const L = S.lighting;

L.setHourOfDay(20.5, { animate: false });
for (let i = 0; i < 20; i++) await B.frame();
S.controls.enabled = false;

const toURL = (b) => new Promise((r) => {
  const fr = new FileReader(); fr.onload = () => r(fr.result); fr.readAsDataURL(b);
});
function fixar(eye, tgt) {
  if (S.controls) {
    S.controls.enabled = false;
    if (S.controls.target) S.controls.target.set(tgt[0], tgt[1], tgt[2]);
  }
  S.camera.position.set(eye[0], eye[1], eye[2]);
  S.camera.up.set(0, 1, 0);
  S.camera.lookAt(tgt[0], tgt[1], tgt[2]);
  S.camera.updateMatrixWorld(true);
  S.camera.updateProjectionMatrix();
  L.invalidate(2);
}
async function foto(nome, eye, tgt) {
  for (let i = 0; i < 26; i++) { fixar(eye, tgt); await B.frame(); }
  fixar(eye, tgt);
  const res = await B.captureViewport({ quality: 'low', background: 'cena' });
  const p = S.camera.position;
  out.push([nome, await toURL(res.blob)]);
  out.push([`  pose efetiva de ${nome}`,
    `${r2(p.x)},${r2(p.y)},${r2(p.z)} (pedida ${eye.map(r2).join(',')})`]);
}

/* As medidas vêm da cena, não de números cravados: o cavalo é a raiz de menor z. */
const THREE = S.THREE;
const rig = S.scene.getObjectByName('RIG');
const cx = rig.children.map((r) => new THREE.Box3().setFromObject(r));
const iCav = cx.reduce((b, c, i) => (c.min.z < cx[b].min.z ? i : b), 0);
const iImp = cx.reduce((b, c, i) => (c.max.z > cx[b].max.z ? i : b), 0);
const cav = cx[iCav], imp = cx[iImp];
out.push(['cavalo', `z ${r2(cav.min.z)}…${r2(cav.max.z)} · x ${r2(cav.min.x)}…${r2(cav.max.x)}`]);
{
  const vl = L.getVehicleLights();
  out.push(['— números —', `${vl.materiais} materiais · nível ${r2(vl.nivel)}`]);
  for (const [n, d] of Object.entries(vl.detalhe || {})) out.push([`  ${n}`, d]);
  const hc = L.getHeadlightCover();
  out.push(['capas achadas', String(hc.capas.length)]);
  hc.capas.forEach((c) => out.push([`  capa ${c.mat}`, `nível ${c.nivel} · caixa ${c.caixa.join(',')}`]));
  const ha = L.getLampHalos ? L.getLampHalos() : null;
  if (ha) out.push(['halos', `${ha.sitios} sítios · desenhados ${ha.desenhados} · pico ${ha.pico}`]);
  const fb = L.getVehicleBeams();
  fb.detalhe.forEach((d, i) => out.push([`  feixe ${i}`,
    `cor ${d.cor} · I ${d.intensidade} · pos ${d.pos.join(',')} · alvo ${d.alvo.join(',')}`]));
}
out.push(['implemento', `z ${r2(imp.min.z)}…${r2(imp.max.z)}`]);

/* 1 — a frente de três-quartos, com a poça no asfalto. */
await foto('r1_frente', [cav.max.x + 6.0, 2.6, cav.min.z - 8.0], [0, 1.4, cav.min.z + 1.5]);
/* 1b — o conjunto óptico de perto: "não indica na própria lanterna". */
await foto('r1b_farol', [cav.max.x + 1.1, 1.0, cav.min.z - 2.4], [0.6, 0.85, cav.min.z + 0.1]);
/* 2 — a lateral do cavalo, onde ficam as lanternas de posição da saia. */
await foto('r2_lateral', [cav.max.x + 5.0, 1.4, cav.min.z + 2.6], [0, 1.0, cav.min.z + 2.6]);
/* 3 — a quina dianteira do rufo do implemento. */
await foto('r3_rufo', [imp.max.x + 4.0, 6.0, imp.min.z + 1.5], [0, 4.0, imp.min.z + 5.0]);
/* 4 — a traseira do cavalo, de trás e de baixo, por FORA da largura do baú. */
await foto('r4_traseira_cavalo', [cav.max.x + 2.6, 1.1, cav.max.z + 3.2],
  [0, 0.85, cav.max.z - 0.4]);
/* 5 — o feixe da traseira do cavalo batendo no que está atrás dele. */
await foto('r5_feixe', [cav.max.x + 4.5, 1.6, cav.max.z + 1.0], [0, 1.0, cav.max.z + 0.2]);
/* 6 — de longe e de trás, onde a poça no chão aparece. */
await foto('r6_poca', [cav.max.x + 7.0, 3.0, cav.max.z + 7.0], [0, 0.6, cav.max.z + 0.5]);
/* 7 — a cauda do comboio, o vermelho que já está certo, para comparar. */
await foto('r7_cauda', [imp.max.x + 3.0, 2.0, imp.max.z + 6.0], [0, 1.4, imp.max.z - 0.5]);

L.setHourOfDay(17.75, { animate: false });
S.controls.enabled = true;
return out;
