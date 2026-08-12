/* REPRO: a cor da lâmpada depende de QUANDO a raiz foi medida.
       node tools/studio-bench/bench.mjs --gpu --geometry --checks checks-luzes-repro.mjs

   HIPÓTESE. `registerVehicleLights()` roda dentro de `setupCommon()`, ou seja
   antes do engate e antes de `setRigPlacement(true)` — e o cabeçalho dele diz, em
   caixa alta, que NADA DE POSIÇÃO pode acontecer ali. A última linha da função
   faz exatamente isso quando o relógio já passou das 18:00:

       if (nivel > 0) { medirRaiz(root, ...); escrever(...); }

   Se for isso, então TROCAR DE CHASSI À NOITE mede as faces da raiz no espaço
   errado (rigGroup na identidade: sem o giro de 180° e sem o recuo de 4 m) e
   todas as lâmpadas decididas POR POSIÇÃO daquela raiz caem em "lado" — âmbar —,
   porque ficam longe das duas faces gravadas. É o relato: a traseira do cavalo
   laranja, e o letreiro do quebra-sol dourado em vez de branco.

   O TESTE. Mede a cor com o caminhão que abriu (caminho de dia, medida certa),
   troca de chassi COM O RELÓGIO ÀS 21:00 e mede de novo. Mesma lâmpada, mesma
   pose: se a cor mudar, a hipótese está provada. */
const out = [];
const B = window.__bench;
const r2 = (v) => Math.round(v * 100) / 100;
const PREF = [/distrito|industrial/i, /volvo/i, /fh.*2021|fh_2021/i, /4x2/i, /vermelh|red/i, /.*/];
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

/* As faces que o shader está USANDO, lidas do uniforme — é o número que decide.
   `getVehicleLights().detalhe` já traz zRel, que sai das mesmas faces. */
function retrato(rotulo) {
  const vl = L.getVehicleLights();
  const rig = S.scene.getObjectByName('RIG');
  const cx = new Map();
  S.scene.traverse((o) => {
    if (!o.isMesh || !o.geometry) return;
    const mm = Array.isArray(o.material) ? o.material : [o.material];
    for (const m of mm) {
      if (!m || !m.name || !vl.nomes.includes(m.name)) continue;
      let c = cx.get(m.name);
      if (!c) { c = new THREE.Box3().makeEmpty(); cx.set(m.name, c); }
      o.geometry.boundingBox = null;
      if (o.isInstancedMesh) o.boundingBox = null;
      const b = new THREE.Box3().makeEmpty();
      b.expandByObject(o);
      if (!b.isEmpty()) c.union(b);
    }
  });
  out.push([`— ${rotulo} —`, `nível ${r2(vl.nivel)} · ${vl.materiais} materiais`]);
  for (const n of vl.nomes) {
    if (!/r_bumper|decals|sunshld|f_light|sideskirt|cabin_mat/i.test(n)) continue;
    const c = cx.get(n);
    out.push([`  ${n}`, `${vl.detalhe[n] || ''}`
      + (c && !c.isEmpty() ? ` · z real ${r2(c.min.z)}…${r2(c.max.z)}` : ' · sem malha')]);
  }
  return vl;
}

/* 1) como está depois do carregamento de DIA (o relógio abre às 17:45). */
L.setHourOfDay(21, { animate: false });
for (let i = 0; i < 16; i++) await B.frame();
const antes = retrato('ANTES — carregado de dia, medido por applyRig');

/* 2) TROCA DE CHASSI com o relógio já às 21:00. */
const escolha = S.choice;
out.push(['escolha corrente', JSON.stringify(escolha)]);
const alvo = { ...escolha, chassisId: escolha.chassisId === '4x2' ? '6x2_t' : '4x2' };
out.push(['trocando para', JSON.stringify(alvo)]);
await S.applyChoice(alvo, { curtain: false });
out.push(['troca concluída', await B.until(() => !!S.trailerRig, 240000)]);
for (let i = 0; i < 24; i++) await B.frame();
const depois = retrato('DEPOIS — trocado às 21:00, sem tocar na luz');

/* 3) e o que um toque na luz faz — se consertar, o defeito é de MOMENTO. */
L.setHourOfDay(20.9, { animate: false });
for (let i = 0; i < 12; i++) await B.frame();
retrato('DEPOIS DE MEXER NA HORA — applyRig remediu');

/* A trava da diferença, em uma linha. */
const corDe = (vl, re) => {
  const n = vl.nomes.find((x) => re.test(x));
  return n ? ((vl.detalhe[n] || '').match(/cor ([0-9a-f]{6})/) || [])[1] : '-';
};
out.push(['traseira do cavalo ANTES', corDe(antes, /r_bumper/i)]);
out.push(['traseira do cavalo DEPOIS DA TROCA', corDe(depois, /r_bumper/i)]);
out.push(['a cor da traseira sobrevive à troca de chassi',
  !!corDe(depois, /r_bumper/i) && corDe(antes, /r_bumper/i) === corDe(depois, /r_bumper/i)]);
out.push(['e ela é VERMELHA (ff1608), não âmbar', corDe(depois, /r_bumper/i) === 'ff1608']);

/* ======= AS TRAVAS DO DEFEITO DE 2026-08-12 (tarde) =======
   Trocar de chassi/cenário à noite fazia `applyRig()` cair na janela em que a
   raiz está entre `setupCommon()` e o `add()` no grupo — SEM PAI. O registro a
   apagava para sempre, e a partir dali: as lâmpadas do cavalo congelavam com as
   faces do espaço LOCAL (traseira laranja, letreiro do teto dourado), o cavalo
   sumia de `getVehicleLightSpans()` e `beams.ts` caía no fallback, que põe o
   FAROL na frente do IMPLEMENTO — na escada da cabine. */
out.push(['— o cavalo sobrevive à troca —', '']);
const raizes = S.scene.getObjectByName('RIG').children;
const cxs2 = raizes.map((r) => new THREE.Box3().setFromObject(r));
const zCav = Math.min(...cxs2.map((c) => c.min.z));
const fb2 = L.getVehicleBeams();
out.push(['  faróis', fb2.detalhe.slice(0, 2).map((d) => d.pos.join(',')).join(' | ')]);
out.push(['  frente do cavalo', Math.round(zCav * 100) / 100]);
/* O farol tem de nascer na FRENTE DO CAVALO, e não a metros dela — que é onde
   ele ia parar quando o fallback elegia o implemento. */
out.push(['o farol nasce na frente do CAVALO (e não no implemento)',
  fb2.detalhe.slice(0, 2).every((d) => Math.abs(d.pos[2] - zCav) < 0.8)]);
out.push(['o farol continua na altura de um farol',
  fb2.detalhe.slice(0, 2).every((d) => d.pos[1] > 0.2 && d.pos[1] < 1.7)]);
const ha2 = L.getLampHalos();
out.push(['  halos depois da troca', ha2.sitios]);
out.push(['os halos sobrevivem à troca', ha2.sitios >= 8]);

L.setHourOfDay(17.75, { animate: false });
return out;
