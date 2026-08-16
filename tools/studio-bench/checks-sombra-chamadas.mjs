/* QUANTAS CHAMADAS O PASSE DE SOMBRA ACRESCENTA — e por que ninguém sabia.
   ===========================================================================
       node tools/studio-bench/bench.mjs --gpu --geometry --checks checks-sombra-chamadas.mjs

   `WebGLRenderer.render()` do three 0.179.1, nesta ordem:

       16471:  shadowMap.render( shadowsArray, scene, camera );
       16477:  if ( this.info.autoReset === true ) this.info.reset();

   O contador é ZERADO DEPOIS do passe de sombra. Logo
   `renderer.info.render.calls` **nunca incluiu as chamadas da sombra** — e é
   esse o número que `getRenderStats()` publica, que o painel de Configurações
   mostra e que todos os documentos de desempenho deste projeto citaram como "~2
   400 chamadas de desenho".

   Com `info.autoReset = false` e um `reset()` manual ANTES do render, o
   contador passa a somar os dois passes. É a única forma de saber o número
   verdadeiro. */

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
const R = S.renderer, gl = R.getContext();
const scene = S.scene, camera = S.camera, Q = S.quality;

R.info.autoReset = false;
function conta(comSombra) {
  R.shadowMap.needsUpdate = !!comSombra;
  R.info.reset();
  R.render(scene, camera);
  return { calls: R.info.render.calls, tris: R.info.render.triangles };
}

for (const nivel of ['alta', 'media', 'baixa']) {
  Q.set(nivel);
  for (let i = 0; i < 12; i++) await B.frame();
  const a = conta(false);
  const b = conta(true);
  out.push([`${nivel}`,
    `passe principal ${a.calls} chamadas / ${(a.tris / 1e6).toFixed(2)} M tri  ·  ` +
    `COM sombra ${b.calls} / ${(b.tris / 1e6).toFixed(2)} M tri  ⇒ ` +
    `a sombra acrescenta +${b.calls - a.calls} chamadas (+${Math.round((b.calls / a.calls - 1) * 100)} %) e +${((b.tris - a.tris) / 1e6).toFixed(2)} M tri`]);
}

/* e quanto isso custa em milissegundos */
const med = (a) => { const s = [...a].sort((x, y) => x - y); return s[s.length >> 1]; };
function ms(comSombra, n = 16) {
  for (let i = 0; i < 3; i++) { R.shadowMap.needsUpdate = comSombra; R.render(scene, camera); }
  gl.finish();
  const t = performance.now();
  for (let i = 0; i < n; i++) { R.shadowMap.needsUpdate = comSombra; R.render(scene, camera); }
  gl.finish();
  return (performance.now() - t) / n;
}
for (const nivel of ['alta', 'media', 'baixa']) {
  Q.set(nivel);
  for (let i = 0; i < 10; i++) await B.frame();
  const a = +med([ms(false), ms(false), ms(false)]).toFixed(2);
  const b = +med([ms(true), ms(true), ms(true)]).toFixed(2);
  out.push([`custo em ms · ${nivel}`,
    `sem reassar ${a} ms · reassando ${b} ms  ⇒ +${(b - a).toFixed(2)} ms (+${Math.round((b / a - 1) * 100)} %)`]);
}

/* ⚠️ NÃO devolver para `true` — ver a nota igual em `checks-aceitacao.mjs`.
   `scene/scene.ts` é o dono de `autoReset = false` desde 2026-08-15. */
R.info.autoReset = false;
Q.set('alta');
out.push(['⚠️ consequência (CONSERTADO em 2026-08-15)',
  'Este achado gerou o conserto: getRenderStats() relatava SÓ o passe principal. '
  + 'Hoje scene.ts desliga `info.autoReset` e zera à mão, então o painel de '
  + 'Configurações mostra a soma — que é o que a máquina de fato submete. '
  + 'Este teste agora serve de REGRESSÃO: se os dois números voltarem a bater, '
  + 'alguém religou o zeramento automático.']);
return out;
