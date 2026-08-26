/* DIAGNÓSTICO DOS DOIS ACHADOS DA CORRIDA DE ACEITAÇÃO DE 2026-08-15.
   ===========================================================================
       node tools/studio-bench/bench.mjs --gpu --geometry --checks diag/checks-diag-niveis.mjs

   `checks-aceitacao.mjs` devolveu duas coisas que ele não sabe explicar, e um
   portão que aponta o dedo sem dizer para quem é um portão pela metade.

   ┌─ ACHADO 1 — o Portão 1 falhou com DELTA NEGATIVO ────────────────────────┐
   │   alta 235 · média 236 · baixa 236                                       │
   │                                                                          │
   │ A mensagem diz "peça apagada", mas quem tem UMA MALHA A MENOS é o nível  │
   │ ALTO. Ou seja: ou apareceu algo no Médio/Baixo que o Alto não tinha, ou  │
   │ o Alto foi medido cedo demais — ele é o primeiro da fila, e é o único    │
   │ que nunca foi precedido por uma cortina fria.                            │
   │                                                                          │
   │ Contar malhas responde "quantas"; só o NOME responde "qual". Este        │
   │ arquivo tira o conjunto de nomes visíveis em cada nível e faz a          │
   │ diferença simétrica — que é a pergunta que o portão queria fazer.        │
   └──────────────────────────────────────────────────────────────────────────┘

   ┌─ ACHADO 2 — os buffers saíram FORA DE ORDEM ─────────────────────────────┐
   │   alta 1152×720 · média 1267×792 · baixa 1036×648                        │
   │                                                                          │
   │ O Alto desenhou MENOS pixels que o Médio. Com `renderScale` 1,00/0,88/   │
   │ 0,72 sobre a mesma janela isso é impossível por perfil — logo não é o    │
   │ perfil: é o CONTROLADOR de escala andando dentro da faixa. 1152/1440 =   │
   │ 0,80, que é exatamente `BANDS.alta.min`. O Alto foi para o PISO da faixa │
   │ dele durante o aquecimento (compilação de programas, carga) e não subiu  │
   │ de volta dentro do teste.                                                │
   │                                                                          │
   │ Isso contamina o Portão 3: ele compara três níveis medidos em três       │
   │ resoluções que não são as que o perfil declara. E, se o controlador não  │
   │ devolve a escala depois que a máquina assenta, é defeito de PRODUTO —    │
   │ o usuário de máquina boa abriria o estúdio borrado e ficaria assim.      │
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
const R = S.renderer, Q = S.quality, scene = S.scene;

async function assentar(l) {
  Q.set(l);
  for (let i = 0; i < 60; i++) await B.frame();
  await B.until(() => !Q.coldPending, 180000);
  for (let i = 0; i < 20; i++) await B.frame();
}

/** Nomes das malhas VISÍVEIS do RIG — o "qual", não o "quantas". */
function nomes() {
  const rig = scene.getObjectByName('RIG');
  const set = new Set();
  rig?.traverse((o) => {
    if (!o.isMesh) return;
    let p = o, v = true;
    while (p && p !== scene) { if (!p.visible) { v = false; break; } p = p.parent; }
    if (!v) return;
    /* O caminho inteiro, e não só o nome: um bake de CAD repete nomes, e
       "sumiu `parafuso_3`" sem o pai não diz de qual conjunto. */
    const caminho = [];
    for (let q = o; q && q !== rig; q = q.parent) caminho.unshift(q.name || '(anon)');
    set.add(caminho.join('/'));
  });
  return set;
}

/** VRAM de textura alcançável pelos materiais da cena. */
function vram() {
  const vistas = new Set();
  let mb = 0;
  scene.traverse((o) => {
    const ms = o.material ? (Array.isArray(o.material) ? o.material : [o.material]) : [];
    for (const m of ms) for (const k of Object.keys(m)) {
      const t = m[k];
      if (!t?.isTexture || !t.image || vistas.has(t.uuid)) continue;
      vistas.add(t.uuid);
      const w = t.image.width || 0, h = t.image.height || 0;
      if (!w || !h) continue;
      /* ⚠️ Comprimida NÃO custa 4 bytes por texel. Uma CompressedTexture de
         BC7/UASTC é 1 byte por texel; tratá-la como RGBA8 inflaria o número em
         4× e faria o degrau KTX2 parecer que não fez nada. */
      const bpp = t.isCompressedTexture ? 1 : 4;
      mb += w * h * bpp * 1.3333 / 1048576;
    }
  });
  return { n: vistas.size, mb: Math.round(mb) };
}

const dados = {};
for (const l of ['alta', 'media', 'baixa']) {
  await assentar(l);
  const p = Q.profile();
  dados[l] = {
    nomes: nomes(),
    escalaPerfil: p.renderScale,
    escalaViva: Q.renderScale,
    faixa: Q.scaleBand(l),
    buf: `${R.domElement.width}×${R.domElement.height}`,
    chao: Q.appliedCold().groundVariant || '(original)',
    vram: vram(),
  };
  out.push([`${l}`,
    `${dados[l].nomes.size} malhas · escala perfil ${dados[l].escalaPerfil} · `
    + `escala VIVA ${dados[l].escalaViva} · faixa ${dados[l].faixa.min}–${dados[l].faixa.max} · `
    + `buffer ${dados[l].buf} · chão ${dados[l].chao} · `
    + `VRAM ${dados[l].vram.mb} MB em ${dados[l].vram.n} texturas`]);
}

/* ---------------------------------------------------------------------------
   ACHADO 1 — QUAL malha, pelo nome */
const dif = (a, b) => [...a].filter((x) => !b.has(x));
for (const [x, y] of [['media', 'alta'], ['baixa', 'alta'], ['baixa', 'media']]) {
  const so = dif(dados[x].nomes, dados[y].nomes);
  const falta = dif(dados[y].nomes, dados[x].nomes);
  out.push([`★ ${x} × ${y}`,
    (so.length || falta.length)
      ? `só em ${x}: ${so.length ? so.join(' · ') : '—'}  ||  só em ${y}: ${falta.length ? falta.join(' · ') : '—'}`
      : 'conjuntos IDÊNTICOS']);
}

/* ---------------------------------------------------------------------------
   ACHADO 2 — o controlador devolve a escala? */
out.push(['★ escala: perfil × viva',
  ['alta', 'media', 'baixa'].map((l) =>
    `${l} ${dados[l].escalaPerfil}→${dados[l].escalaViva}${dados[l].escalaPerfil !== dados[l].escalaViva ? ' ⚠️' : ''}`
  ).join(' · ')]);

/* E a prova do pudim: volta ao Alto, deixa a máquina MOSTRAR que dá conta, e
   vê se a escala sobe sozinha. Se não subir, o usuário de máquina boa fica com
   a resolução que o pior instante da carga escolheu — para sempre. */
await assentar('alta');
const antes = Q.renderScale;
for (let i = 0; i < 900; i++) await B.frame();   // ~15 s de cena assentada
const depois = Q.renderScale;
out.push(['★ o controlador devolve a escala depois de 15 s parados?',
  `${antes} → ${depois} — ${depois >= antes ? (depois > antes ? 'SIM, subiu' : 'NÃO SUBIU') : 'DESCEU'}`
  + (depois < 1 ? `  ⚠️ o nível Alto declara renderScale 1,00 e está desenhando a ${depois}` : '')]);
out.push(['medidor', `parede ${Q.frameTimeEma?.toFixed?.(2)} ms · submissão ${Q.submitTimeEma?.toFixed?.(2)} ms`]);
out.push(['stats', JSON.stringify(S.getRenderStats())]);

return out;
