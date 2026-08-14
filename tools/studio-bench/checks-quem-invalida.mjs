/* QUEM MANTÉM O LAÇO ACESO — diagnóstico, não verificação.
   ===========================================================================
       node tools/studio-bench/bench.mjs --gpu --geometry \
            --checks checks-quem-invalida.mjs

   `checks-laco-sob-demanda.mjs` mostrou que a cena PARADA idle a zero, mas que
   depois de parar o giro de apresentação ela continua desenhando ~9 quadros em
   cada 24 voltas do rAF — intermitente, não contínuo. Intermitente descarta o
   damping do OrbitControls (que decairia liso e pararia) e aponta para alguma
   coisa que invalida de tempos em tempos.

   Em vez de adivinhar, este arquivo instrumenta os candidatos um a um. Cada
   termo é lido do estado vivo a cada volta, e no fim sai quantas voltas cada um
   estava ATIVO — o que estiver aceso junto com os quadros é o culpado. */
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
await B.until(() => !!S.trailerRig, 240000);
const L = S.lighting;
const frames = () => S.renderer.info.render.frame;

async function watch(label, n) {
  const start = frames();
  const seen = { controls: 0, seethrough: 0, near: 0, dist: [] };
  let lastNear = S.camera.near;
  for (let i = 0; i < n; i++) {
    await B.frame();
    const st = L.getSeeThrough ? L.getSeeThrough() : null;
    /* Alguém ainda em transição de transparência? `alvos` traz o estado por
       objeto; qualquer `hide` fora de 0 e de 1 é uma dissolução em curso. */
    if (st && Array.isArray(st.alvos)) {
      if (st.alvos.some((a) => a.hide > 0.001 && a.hide < 0.999)) seen.seethrough++;
    }
    if (Math.abs(S.camera.near - lastNear) > 1e-9) { seen.near++; lastNear = S.camera.near; }
    seen.dist.push(Math.round(S.camera.position.distanceTo(S.controls.target) * 1000) / 1000);
  }
  const drawn = frames() - start;
  const moved = new Set(seen.dist).size;
  out.push([label,
    `${drawn} quadros / ${n * 2} rAF · seethrough ativo ${seen.seethrough} · `
    + `near mudou ${seen.near} · distâncias distintas ${moved}`]);
  return drawn;
}

/* 1. repouso de verdade, sem nunca ter girado */
await watch('repouso (nunca girou)', 14);
await watch('repouso (nunca girou) — 2ª leitura', 14);

/* 2. o giro e a parada */
L.setTurntable(true);
await watch('girando', 8);
L.setTurntable(false);
await watch('logo após parar', 14);
await watch('mais tarde', 14);
await watch('bem mais tarde', 20);
await watch('e depois disso', 20);

/* 3. os termos contínuos declarados de wantsFrame(), lidos direto */
out.push(['autoRotate', S.controls.autoRotate]);
out.push(['enableDamping', S.controls.enableDamping]);
out.push(['chuva no rig', L.sceneState ? (L.getRig ? (L.getRig()?.rain ?? '?') : '?') : '?']);
const st = L.getSeeThrough ? L.getSeeThrough() : null;
out.push(['seethrough alvos', st && st.alvos ? st.alvos.length : 'n/d']);
if (st && Array.isArray(st.alvos)) {
  out.push(['seethrough em transição',
    st.alvos.filter((a) => a.hide > 0.001 && a.hide < 0.999).length]);
}
out.push(['controls.update() sozinho diz que mexeu',
  (() => { let n = 0; for (let i = 0; i < 5; i++) if (S.controls.update(0.016)) n++; return n; })()]);

return out;
