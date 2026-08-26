/* DIAGNÓSTICO — as 3 malhas que a PRIMEIRA carga não mostra.
   ---------------------------------------------------------------------------
       node tools/studio-bench/bench.mjs --gpu --geometry \
            --checks checks-diag-censo-primeira-carga-0824.mjs

   DE ONDE VEIO. `checks-aceitacao.mjs` reprovou o Portão 1 em 2026-08-24 com
   `alta 211 · média 214 · baixa 214`, e a leitura óbvia — "os níveis baixos
   apagam peça" — está INVERTIDA: quem tem MENOS malhas é o nível ALTO, e nenhum
   botão do perfil acrescenta geometria. Medindo `alta` OUTRA VEZ no fim da
   corrida ela também dá **214**, com os mesmos 5,63 M de triângulos nas quatro
   medições.

   Ou seja o eixo não é o NÍVEL, é a ORDEM: `assentarNivel('alta')` é o primeiro
   da lista e, começando a sessão já em `alta`, não passa cortina nenhuma — ele
   mede a PRIMEIRA CARGA. Os outros dois medem uma cena RECONSTRUÍDA.

   O que este arquivo responde é a única pergunta que sobra, e ela não é sobre o
   portão: **quais são as 3 malhas, e a primeira carga está deixando de mostrar
   alguma coisa que o usuário deveria ver?** Um portão que compara a carga fria
   com a carga quente é fácil de consertar; uma peça que só aparece depois de
   trocar de qualidade seria um defeito de produto. */
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
const scene = S.scene, Q = S.quality;
for (let i = 0; i < 30; i++) await B.frame();

/* O censo do Portão 1, mas guardando NOME e DONO em vez de só contar. */
function censoNomeado() {
  const rig = scene.getObjectByName('RIG');
  const nomes = [];
  rig?.traverse((o) => {
    if (!o.isMesh) return;
    let p = o, v = true;
    while (p && p !== scene) { if (!p.visible) { v = false; break; } p = p.parent; }
    if (!v) return;
    const mat = Array.isArray(o.material) ? o.material.map((m) => m?.name).join('+')
      : (o.material?.name || '');
    nomes.push((o.name || '(sem nome)') + ' [' + mat + ']');
  });
  return nomes;
}

/* E o censo do que está ESCONDIDO, que é a outra metade da resposta: uma malha
   que existe e está invisível tem um dono, e o dono é nomeável. */
function escondidas() {
  const rig = scene.getObjectByName('RIG');
  const nomes = [];
  rig?.traverse((o) => {
    if (!o.isMesh) return;
    let p = o, v = true, culpado = null;
    while (p && p !== scene) { if (!p.visible) { v = false; culpado = p; break; } p = p.parent; }
    if (v) return;
    nomes.push((o.name || '(sem nome)') + ' ← ' + (culpado === o ? 'ela mesma' : (culpado?.name || '(pai sem nome)')));
  });
  return nomes;
}

const antes = censoNomeado();
const antesEsc = escondidas();
out.push(['PRIMEIRA CARGA — malhas visíveis', antes.length]);
out.push(['PRIMEIRA CARGA — malhas escondidas', antesEsc.length]);

async function assentarNivel(l) {
  Q.set(l);
  for (let i = 0; i < 60; i++) await B.frame();
  await B.until(() => !Q.coldPending, 180000);
  for (let i = 0; i < 20; i++) await B.frame();
}

/* Uma volta completa por uma cortina fria e de volta ao mesmo nível: se a
   contagem mudar, quem mudou foi a RECONSTRUÇÃO e não o nível. */
await assentarNivel('media');
await assentarNivel('alta');

const depois = censoNomeado();
const depoisEsc = escondidas();
out.push(['DEPOIS DE UMA CORTINA — malhas visíveis', depois.length]);
out.push(['DEPOIS DE UMA CORTINA — malhas escondidas', depoisEsc.length]);
out.push(['delta de visíveis', depois.length - antes.length]);

const conta = (a) => a.reduce((m, n) => (m[n] = (m[n] || 0) + 1, m), {});
const ca = conta(antes), cd = conta(depois);
const ganhou = [], perdeu = [];
for (const k of new Set([...Object.keys(ca), ...Object.keys(cd)])) {
  const d = (cd[k] || 0) - (ca[k] || 0);
  if (d > 0) ganhou.push(k + (d > 1 ? ' ×' + d : ''));
  if (d < 0) perdeu.push(k + (d < -1 ? ' ×' + (-d) : ''));
}
out.push(['APARECERAM depois da cortina', ganhou.join(' | ') || 'nenhuma']);
out.push(['SUMIRAM depois da cortina', perdeu.join(' | ') || 'nenhuma']);

const cea = conta(antesEsc), ced = conta(depoisEsc);
const escGanhou = [], escPerdeu = [];
for (const k of new Set([...Object.keys(cea), ...Object.keys(ced)])) {
  const d = (ced[k] || 0) - (cea[k] || 0);
  if (d > 0) escGanhou.push(k + (d > 1 ? ' ×' + d : ''));
  if (d < 0) escPerdeu.push(k + (d < -1 ? ' ×' + (-d) : ''));
}
out.push(['DEIXARAM de estar escondidas', escPerdeu.join(' | ') || 'nenhuma']);
out.push(['PASSARAM a estar escondidas', escGanhou.join(' | ') || 'nenhuma']);

out.push(['fusão', JSON.stringify(S.merge?.info?.() ?? null).slice(0, 400)]);

return out;
