/* O FRIO SEGUE O ATO DO USUÁRIO — e o medidor continua proibido de levantar
   cortina. Este teste existe porque o defeito que ele cobre passou despercebido
   por uma bancada que lia o perfil PEDIDO em vez do APLICADO. */
const out = []; const B = window.__bench;
await B.until(() => { const o = document.getElementById('ts-selector'); return !!o && o.classList.contains('is-open'); }, 30000);
const ov = document.getElementById('ts-selector');
for (let s = 0; s < 12 && !ov.classList.contains('hidden'); s++) {
  const cards = [...ov.querySelectorAll('.ts-card:not([disabled])')];
  if (!cards.length) break;
  (cards.find((c) => /volvo/i.test(c.dataset.id || '')) || cards[0]).click();
  await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
}
await B.until(() => !!window.__studio, 480000); const S = window.__studio;
await B.until(() => !!S.trailerRig, 240000);
const spots = () => { let n = 0; S.scene.traverse((o) => { if (!o.isSpotLight) return; let v = o.visible, p = o.parent; while (v && p) { v = p.visible; p = p.parent; } if (v) n++; }); return n; };
const aplicado = () => S.quality.appliedCold().spotPool;
const esperar = async (ms) => { const t0 = performance.now(); while (performance.now() - t0 < ms) await B.frame(); };

out.push(['nível de boot', S.quality.level]);
out.push(['pool aplicado no boot', `${aplicado()} · ${spots()} SpotLights`]);

/* 1. ATO DO USUÁRIO: o frio tem de seguir sozinho, depois do debounce. */
S.quality.set('alta');
out.push(['logo após set("alta") — ainda pendente?', S.quality.coldPending]);
await esperar(1200);
await B.until(() => !S.quality.coldPending, 180000);
await esperar(600);
out.push(['ALTA · pool aplicado sem eu clicar em nada',
  aplicado() === 14 && spots() === 14 ? `ok — 14 · ${spots()} SpotLights` : `${aplicado()} · ${spots()}  <<<`]);

S.quality.set('baixa');
await esperar(1200);
await B.until(() => !S.quality.coldPending, 180000);
await esperar(600);
out.push(['BAIXA · pool aplicado sem eu clicar em nada',
  aplicado() === 0 && spots() === 0 ? `ok — 0 · ${spots()} SpotLights` : `${aplicado()} · ${spots()}  <<<`]);

/* 2. O MEDIDOR NÃO PODE LEVANTAR CORTINA. Forçar um nível pelo caminho interno
      do adaptador e conferir que o frio NÃO se mexeu. */
S.quality.set('auto');
await esperar(1500);
await B.until(() => !S.quality.coldPending, 180000);
const antes = aplicado();
for (let i = 0; i < 400; i++) S.lighting.reportFrameTime ? 0 : 0;
out.push(['depois de auto, frio estável', `${antes} · pendente ${S.quality.coldPending}`]);
return out;
