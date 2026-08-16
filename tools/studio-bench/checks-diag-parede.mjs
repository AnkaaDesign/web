/* AS DUAS PERGUNTAS QUE SOBRARAM DEPOIS DA CORRIDA DE ACEITAÇÃO.
   ===========================================================================
       node tools/studio-bench/bench.mjs --gpu --geometry --checks checks-diag-parede.mjs

   ┌─ 1. QUEM É `FUSAO__borracha-preta__b0` ──────────────────────────────────┐
   │ `checks-diag-niveis.mjs` nomeou a malha que existe no Médio e no Baixo e │
   │ não existe no Alto. É um BALDE da fusão, banda de sombra 0 (diâmetro de  │
   │ mundo < 5 cm). Falta saber POR QUE ele está invisível no Alto — e a      │
   │ resposta importa, porque um balde invisível é um conjunto INTEIRO de     │
   │ peças que não está sendo desenhado.                                      │
   └──────────────────────────────────────────────────────────────────────────┘

   ┌─ 2. A PAREDE DE 36,86 ms CONTRA 3,93 ms DE SUBMISSÃO ────────────────────┐
   │ O handle do estúdio documenta a leitura: *"parede muito maior = limitado │
   │ por CPU FORA do `render()` ou por espera de vsync"*. Se sobrar 33 ms por │
   │ quadro fora do `render()`, então **a fusão e o estrangulamento da sombra │
   │ resolveram o gargalo errado** — e num i5, que é a máquina do pedido,     │
   │ esse tempo é ainda maior.                                                │
   │                                                                          │
   │ ⚠️ Mas a leitura pode ser artefato: `frameTimeEma` só é alimentado entre │
   │ dois quadros DESENHADOS CONSECUTIVOS, e sob o laço sob demanda uma cena  │
   │ parada não gera amostra nenhuma — o valor lido pode ser fóssil da        │
   │ cortina de carga, que de fato custa dezenas de ms. Só há um jeito de     │
   │ saber: medir DURANTE um arrasto, que é quando todo quadro é desenhado, e │
   │ decompor a parede em (render) + (o resto).                               │
   └──────────────────────────────────────────────────────────────────────────┘ */

const out = [];
const B = window.__bench;

await B.until(() => {
  const o = document.getElementById('ts-selector');
  return !!o && o.classList.contains('is-open');
}, 40000);
await B.settleSelector();
await B.until(() => !!(window.__studio?.state?.trailer || window.__studio?.state?.cab), 120000);
for (let i = 0; i < 30; i++) await B.frame();
await B.until(() => !!window.__studio?.renderer, 60000);

const S = window.__studio;
const R = S.renderer, Q = S.quality, scene = S.scene, camera = S.camera;
const med = (a) => { const s = [...a].sort((x, y) => x - y); return s[s.length >> 1]; };

async function assentar(l) {
  Q.set(l);
  for (let i = 0; i < 60; i++) await B.frame();
  await B.until(() => !Q.coldPending, 180000);
  for (let i = 0; i < 20; i++) await B.frame();
}

/* =========================================================================
   1. O BALDE FANTASMA */
function baldes() {
  const linhas = [];
  scene.traverse((o) => {
    if (!o.isMesh || !/^FUSAO__/.test(o.name || '')) return;
    let p = o.parent, paiOculto = null;
    while (p && p !== scene) { if (!p.visible) { paiOculto = p.name || '(anon)'; break; } p = p.parent; }
    const g = o.geometry;
    linhas.push({
      nome: o.name,
      visible: o.visible,
      paiOculto,
      castShadow: o.castShadow,
      tri: g?.index ? g.index.count / 3 : (g?.attributes?.position?.count ?? 0) / 3,
      banda: o.userData?.tsMergeBand,
      diam: o.userData?.tsWorldDiameter,
    });
  });
  return linhas.sort((a, b) => a.nome.localeCompare(b.nome));
}

const porNivel = {};
for (const l of ['alta', 'media', 'baixa']) {
  await assentar(l);
  porNivel[l] = baldes();
  out.push([`baldes · ${l}`, `${porNivel[l].length} baldes · ${porNivel[l].filter((b) => !b.visible || b.paiOculto).length} invisíveis`]);
}
const chave = (b) => b.nome;
const todos = new Set([...Object.values(porNivel).flat().map(chave)]);
for (const nome of todos) {
  const linha = ['alta', 'media', 'baixa'].map((l) => {
    const b = porNivel[l].find((x) => chave(x) === nome);
    if (!b) return `${l}:AUSENTE`;
    return `${l}:${b.visible ? 'v' : 'OCULTO'}${b.paiOculto ? `(pai ${b.paiOculto})` : ''}`;
  });
  const divergiu = new Set(linha.map((s) => s.split(':')[1])).size > 1;
  if (divergiu) out.push([`★ DIVERGE · ${nome}`, linha.join(' · ')]);
}
const b0 = porNivel.media.find((b) => /borracha-preta__b0/.test(b.nome));
if (b0) out.push(['★ o balde em questão', JSON.stringify(b0)]);

/* =========================================================================
   2. A PAREDE, DECOMPOSTA, DURANTE UM ARRASTO DE VERDADE

   Instrumenta o próprio `requestAnimationFrame`: entre o início de um quadro e
   o do seguinte está TUDO — os ganchos, o teste de corredor, a evasão, o passo
   da caixa de sombra, o `render()` e o que o navegador fizer no meio. Medir a
   diferença entre isso e o `render()` isolado é medir exatamente "o resto". */
await assentar('alta');
const alvo = S.controls.target.clone();

async function arrastar(n = 120) {
  const paredes = [], renders = [];
  let tPrev = 0;
  const r0 = camera.position.distanceTo(alvo);
  for (let i = 0; i < n; i++) {
    const a = i * 0.012;
    camera.position.set(alvo.x + Math.cos(a) * r0, camera.position.y, alvo.z + Math.sin(a) * r0);
    camera.lookAt(alvo);
    S.lighting.invalidate?.(1);
    await new Promise((res) => requestAnimationFrame((t) => {
      if (tPrev) paredes.push(t - tPrev);
      tPrev = t;
      res();
    }));
    /* O `render()` isolado, na mesma pose, logo depois do quadro do laço: é a
       parte que a fusão e a sombra atacaram. */
    const t0 = performance.now();
    R.render(scene, camera);
    renders.push(performance.now() - t0);
  }
  paredes.shift();   // o primeiro carrega o custo de entrar no arrasto
  return { parede: +med(paredes).toFixed(2), render: +med(renders).toFixed(2) };
}

for (const l of ['alta', 'media', 'baixa']) {
  await assentar(l);
  const a = await arrastar();
  out.push([`★ arrasto · ${l}`,
    `parede ${a.parede} ms/quadro · render ${a.render} ms · `
    + `FORA do render ${(a.parede - a.render).toFixed(2)} ms · `
    + `${(1000 / a.parede).toFixed(1)} fps`]);
}
out.push(['medidor do engine, DEPOIS do arrasto',
  `parede ${Q.frameTimeEma?.toFixed?.(2)} ms · submissão ${Q.submitTimeEma?.toFixed?.(2)} ms`]);

/* ⚠️ Um `requestAnimationFrame` num headless SEM composição de tela pode não
   ter vsync nenhum, ou ter um relógio de 60 Hz artificial. Se a parede vier
   colada em 16,67 ms, o teto é o vsync e não há 33 ms de CPU escondidos — a
   leitura de 36,86 ms era fóssil da cortina, como o cabeçalho previu. */
out.push(['leitura', 'parede ≈ 16,7 ms ⇒ vsync, não CPU. Parede >> render ⇒ CPU fora do render(), e aí é ELA o gargalo do i5.']);

return out;
