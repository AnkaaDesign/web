/* ONDE ESTÁ O TEMPO QUE NÃO É `render()`.
   ===========================================================================
       node tools/studio-bench/bench.mjs --gpu --geometry --checks checks-parede.mjs

   O relato do dono, depois da fusão por material: *"no alto no meu PC ainda cai
   às vezes para menos de 60 fps, e não deveria — meu PC roda GTA e Cyberpunk"*,
   *"não sinto fluida a movimentação da câmera"*.

   E há uma leitura antiga que nunca foi atribuída a ninguém:

       parede 36,86 ms  ·  submissão 3,93 ms

   ⚠️ **A MEDIÇÃO DE ONTEM TINHA UM BURACO, E ELE É GRANDE.** O `4,18 ms` que a
   `checks-fusao.mjs` reporta mede `renderer.render(scene, camera)` chamado À MÃO,
   num laço fechado. Só que o laço de verdade faz MAIS que isso antes de chegar
   lá — e o `submitTimeEma` do engine tem o mesmo buraco, porque ele cronometra
   apenas o `renderer.render()` da linha final:

     · `controls.update(dt)` e as guardas de câmera
     · `updateLighting(dt)` e TODOS os `frameHooks` (clima, teto, ciclorama,
       giro, LOD, as travas de posição)
     · `applyAvoidance()`, `tuneShadowSpan()`, `updateSeeThrough()`
     · **os `drawHooks` — e é aí que mora o REFLEXO DO PISO, que renderiza a
       cena INTEIRA uma segunda vez**

   Nada disso entra nos 4,18 ms. Este arquivo mede o quadro do jeito que o
   usuário o sente: de `requestAnimationFrame` a `requestAnimationFrame`, com a
   câmera se movendo, e reparte a diferença por ABLAÇÃO — que é o método que
   achou o gargalo original e o único que separa "isto é GRANDE" de "isto é o
   GARGALO". */

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
  for (let i = 0; i < 40; i++) await B.frame();
  await B.until(() => !Q.coldPending, 180000);
  for (let i = 0; i < 20; i++) await B.frame();
}
await assentar('alta');

out.push(['cena', JSON.stringify(S.choice)]);
out.push(['buffer', `${R.domElement.width}×${R.domElement.height}`]);

/* ---------------------------------------------------------------------------
   O CRONÔMETRO. `renderer.render` é embrulhado para separar, DENTRO do mesmo
   quadro, o que é desenho do que não é. ⚠️ Ele é chamado MAIS DE UMA VEZ por
   quadro quando o reflexo do piso está ligado (a passada do reflexo vem de um
   `drawHook`, antes da principal) — então contamos chamadas E tempo, e a
   diferença entre elas é justamente o achado. */
const orig = R.render.bind(R);
let msRender = 0, nRender = 0;
R.render = function (...a) {
  const t = performance.now();
  orig(...a);
  msRender += performance.now() - t;
  nRender++;
};

/** Um arrasto de verdade: a câmera anda todo quadro, então o laço sob demanda
 *  desenha todo quadro e nada é pulado. É o regime que o dono relata. */
async function arrastar(n = 46) {
  const alvo = S.controls.target.clone();
  const r0 = camera.position.distanceTo(alvo);
  const paredes = [], renders = [], chamadas = [];
  let tPrev = 0;
  for (let i = 0; i < n; i++) {
    const a = i * 0.010;
    camera.position.set(alvo.x + Math.cos(a) * r0, camera.position.y, alvo.z + Math.sin(a) * r0);
    camera.lookAt(alvo);
    S.lighting.invalidate?.(1);
    msRender = 0; nRender = 0;
    await new Promise((res) => requestAnimationFrame((t) => {
      if (tPrev) { paredes.push(t - tPrev); renders.push(msRender); chamadas.push(nRender); }
      tPrev = t;
      res();
    }));
  }
  /* Os 12 primeiros saem: entrar num arrasto paga compilação de programa,
     realocação e a primeira reassadura de sombra. */
  const corta = (v) => v.slice(8);
  const p = med(corta(paredes)), r = med(corta(renders));
  return {
    parede: +p.toFixed(2),
    render: +r.toFixed(2),
    fora: +(p - r).toFixed(2),
    chamadasRender: med(corta(chamadas)),
    fps: +(1000 / p).toFixed(1),
  };
}

/* ---------------------------------------------------------------------------
   A ABLAÇÃO. Cada linha desliga UMA coisa e remede. Intercalado com a base para
   não confundir deriva térmica com ganho — a primeira versão da bancada do
   GARGALO mediu cada configuração uma vez e concluiu que esconder o cavalo
   deixava a cena mais lenta, o que é impossível. */
const linhas = [];
async function ablacao(nome, desliga, religa) {
  const antes = await arrastar();
  try { desliga(); } catch (e) { linhas.push([nome, 'não aplicável: ' + e.message]); return; }
  for (let i = 0; i < 10; i++) await B.frame();
  const dep = await arrastar();
  try { religa(); } catch { /* melhor deixar ligado que deixar quebrado */ }
  for (let i = 0; i < 10; i++) await B.frame();
  linhas.push([nome, { antes, depois: dep, ganho: +(antes.parede - dep.parede).toFixed(2) }]);
}

const base = await arrastar();
out.push(['★ BASE (alta, arrastando)',
  `parede ${base.parede} ms (${base.fps} fps) · render ${base.render} ms em ${base.chamadasRender} chamada(s) de render · `
  + `FORA do render ${base.fora} ms`]);
out.push(['★ leitura',
  base.fora > base.render
    ? `⚠️ O TEMPO FORA DO RENDER É MAIOR QUE O RENDER (${base.fora} contra ${base.render} ms). `
      + 'A GPU não é o gargalo; o laço em JS é.'
    : 'o render domina o quadro — o gargalo está no desenho']);
if (base.chamadasRender > 1) {
  out.push(['⚠️ mais de um render por quadro',
    `${base.chamadasRender} chamadas — a passada extra é o reflexo do piso (drawHook). `
    + 'Ela NÃO entra no `submitTimeEma` do engine nem entrava na medição da fusão.']);
}

/* 1. O REFLEXO DO PISO — a segunda varredura da cena inteira. */
await ablacao('reflexo do piso desligado',
  () => S.cyclorama.setFloorReflection(false),
  () => S.cyclorama.setFloorReflection(true));

/* 2. O TESTE DE CORREDOR — `quality.ts` o chama de "o maior custo fixo de CPU
      do laço", e ele roda sobre ~650 objetos INCLUSIVE em quadro pulado. */
await ablacao('atravessar (seethrough) desligado',
  () => S.lighting.clearSeeThrough(),
  () => { /* volta na próxima troca de cenário; medido só o custo */ });

/* 3. A VEGETAÇÃO — alphaTest sem early-Z, a categoria mais cara numa integrada,
      e paga duas vezes por causa do passe de sombra. */
await ablacao('vegetação escondida',
  () => {
    const g = [];
    scene.traverse((o) => { if (o.isInstancedMesh && /leaf|tree|folha|arv/i.test(o.name || o.material?.name || '')) g.push(o); });
    window.__veg = g; g.forEach((o) => { o.visible = false; });
    if (!g.length) throw new Error('nenhuma malha de folhagem encontrada pelo nome');
  },
  () => { (window.__veg || []).forEach((o) => { o.visible = true; }); });

/* 4. O PASSE DE SOMBRA INTEIRO — para saber quanto dele sobra depois da fusão. */
await ablacao('sombra desligada',
  () => { R.shadowMap.enabled = false; },
  () => { R.shadowMap.enabled = true; R.shadowMap.needsUpdate = true; });

/* 5. O VEÍCULO INTEIRO — quanto do quadro ainda é o caminhão, pós-fusão. */
await ablacao('veículo escondido',
  () => { const r = scene.getObjectByName('RIG'); if (!r) throw new Error('sem RIG'); r.visible = false; },
  () => { const r = scene.getObjectByName('RIG'); if (r) r.visible = true; });

/* 6. O CENÁRIO — o complemento do anterior. */
await ablacao('cenário escondido',
  () => {
    const s = scene.getObjectByName('SET') || scene.getObjectByName('CENARIO');
    if (!s) throw new Error('sem nó SET/CENARIO');
    window.__set = s; s.visible = false;
  },
  () => { if (window.__set) window.__set.visible = true; });

for (const [nome, v] of linhas) {
  out.push([`ablação · ${nome}`, typeof v === 'string' ? v
    : `parede ${v.antes.parede} → ${v.depois.parede} ms  (${v.ganho >= 0 ? '−' : '+'}${Math.abs(v.ganho)} ms) · `
      + `render ${v.antes.render} → ${v.depois.render} ms · fora ${v.antes.fora} → ${v.depois.fora} ms`]);
}

R.render = orig;
const fim = await arrastar();
out.push(['confere: base repetida no fim', `${fim.parede} ms contra ${base.parede} ms na abertura`]);
out.push(['medidor do engine', `parede ${Q.frameTimeEma?.toFixed?.(2)} ms · submissão ${Q.submitTimeEma?.toFixed?.(2)} ms`]);
out.push(['stats', JSON.stringify(S.getRenderStats())]);

return out;
