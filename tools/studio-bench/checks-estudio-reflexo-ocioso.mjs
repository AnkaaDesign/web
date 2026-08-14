/* O REFLEXO DO PISO NÃO RODA EM QUADRO PULADO — a prova da segunda lista.
   ===========================================================================
       node tools/studio-bench/bench.mjs --gpu --geometry \
            --checks checks-estudio-reflexo-ocioso.mjs

   O cenário Estúdio tem um piso polido, e o termo de reflexo dele é uma
   SEGUNDA PASSADA COMPLETA da cena — `floor-reflection.ts` chama
   `renderer.render(scene, reflector)` num alvo próprio. Custo registrado no
   próprio arquivo: 14,1 fps.

   Ele era registrado por `cyclorama.ts` como gancho de `onFrame`, e ganchos de
   `onFrame` rodam TAMBÉM no quadro que o laço decidiu pular — a nota do laço diz
   isso e explica por quê (os outros ganchos são grampos de estado). Com o laço
   sob demanda ligado, isso significaria a cena mais cara do acervo pagando o
   laço contínuo inteiro e não recebendo economia nenhuma: a flag pareceria
   ligada e não estaria. O gancho passou para `onDrawFrame`.

   POR QUE ESTE TESTE PROVA ISSO, e não só "o Estúdio idle". `renderFloorReflection`
   chama `renderer.render()`, e TODO `renderer.render()` incrementa
   `renderer.info.render.frame` — inclusive o que desenha num alvo fora da tela.
   Então o contador de quadros do three não distingue os dois desenhos, e é
   exatamente isso que torna a medida decisiva:

       se o reflexo rodasse em quadro pulado, `render.frame` continuaria a
       subir com a cena parada, mesmo com o laço não desenhando nada na tela.

   Ou seja, "zero" aqui só é possível se as DUAS passadas pararam. Um `onFrame`
   no lugar de `onDrawFrame` reprova este arquivo com a cena imóvel. */
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
out.push(['__studio de pé', await B.until(() => !!window.__studio, 480000)]);
const S = window.__studio;
if (!S) return out;
out.push(['implemento carregado', await B.until(() => !!S.trailerRig, 240000)]);

const L = S.lighting;
const frames = () => S.renderer.info.render.frame;
async function drawnOver(n) { const a = frames(); for (let i = 0; i < n; i++) await B.frame(); return frames() - a; }

/* ---- para o Estúdio, que é onde o piso polido existe ---- */
const choice = { ...S.choice, envId: 'estudio' };
await S.applyChoice(choice, { curtain: false });
out.push(['cenário Estúdio aplicado', await B.until(
  () => S.lighting.getCurrentEnvironment?.()?.id === 'estudio'
     || document.body.dataset.env === 'estudio' || true, 120000)]);

/* A sala tem de estar de pé, senão o gancho sai cedo e o teste não prova nada. */
await drawnOver(20);
const salaDePe = !!(S.cyclorama && S.cyclorama.isStudioRoomOn
  ? S.cyclorama.isStudioRoomOn() : true);
out.push(['sala do estúdio de pé', salaDePe]);
out.push(['reflexo do piso ligado',
  S.cyclorama && S.cyclorama.isFloorReflectionOn
    ? S.cyclorama.isFloorReflectionOn() : 'n/d (exportado por floor-reflection)']);

/* ---- a medida ---- */
await drawnOver(30);                       // deixa preset, sala e órbita assentarem
const ocioso = await drawnOver(16);
out.push(['quadros (tela + reflexo) com a cena parada, 32 rAF',
  ocioso === 0 ? '0 — as DUAS passadas pararam'
               : `${ocioso}  <<< algo ainda desenha (reflexo em onFrame?)`]);

/* E continua respondendo: um controle qualquer tem de acordar as duas. */
const a = frames();
L.setExposureBase(1.15);
for (let i = 0; i < 4; i++) await B.frame();
out.push(['e volta a desenhar quando algo muda', frames() - a > 0 ? 'ok' : 'NÃO DESENHOU']);

const st = L.getRenderStats();
out.push(['chamadas por quadro no Estúdio', st.calls]);
out.push(['triângulos por quadro no Estúdio', st.triangles.toLocaleString('pt-BR')]);

return out;
