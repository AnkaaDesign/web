/* ONDE ESTÁ O GARGALO — a bancada de ablação.
   ===========================================================================
       node tools/studio-bench/bench.mjs --gpu --geometry --checks checks-gargalo.mjs

   POR QUE ELA EXISTE, e por que ela não parece com as outras deste diretório.

   Todo levantamento anterior de desempenho do estúdio — `ANALISE-PERF-UX-2026-
   08-12.md`, `OTIMIZACAO-2026-08-13.md`, `OTIMIZACAO-2026-08-14.md` — argumentou
   por CONTAGEM: tantas chamadas, tantos triângulos, tantas ALU por fragmento.
   Contagem prova que uma coisa é GRANDE. Ela não prova que a coisa é o GARGALO,
   e a diferença entre as duas é a diferença entre otimizar e adivinhar.

   O que prova é ABLAÇÃO: tira a parte, remede, e a resposta é a diferença.

   ---------------------------------------------------------------------------
   O MÉTODO, e as três decisões que ele exige

   1. **Fora do laço.** `renderer.setAnimationLoop` está preso ao vsync: numa
      placa que fecha o quadro em 6 ms ele devolve 16,7 ms em toda configuração,
      e nenhuma ablação mediria nada. Aqui `render()` é chamado em laço fechado.

   2. **`gl.finish()` nas duas pontas.** Sem ele o que se mede é o
      ENFILEIRAMENTO de comandos, não a execução — e a diferença entre as duas
      coisas é exatamente a pergunta "CPU ou GPU?".

        PAREDE    = (t_fim − t_ini)/N com finish   → CPU + GPU, o que se sente
        SUBMISSÃO = Σ(tempo dentro de render())/N  → só CPU (JS + comandos GL)

   3. **Repetição INTERCALADA.** Uma primeira versão desta bancada mediu cada
      configuração uma vez e reportou que esconder o cavalo deixava a cena mais
      LENTA — o que é impossível, e denunciava deriva (relógio da placa, coletor
      de lixo, JIT). Toda comparação aqui alterna A/B/A/B e relata a MEDIANA.

   ⚠️ ESTA MÁQUINA NÃO É A MÁQUINA DO PROBLEMA. A placa é uma RX 570 e a CPU um
   Ryzen 7 5700X. O que transfere para um i5 com gráfico integrado é (a) a
   REPARTIÇÃO — qual parte custa quanto —, (b) o custo POR CHAMADA DE DESENHO,
   que escala com o relógio da CPU e nada mais, e (c) a inclinação de ms por
   megapixel, que escala com a vazão da placa. Os três estão relatados
   separadamente por isso. */

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
const R = S.renderer, THREE = S.THREE, gl = R.getContext();
const scene = S.scene, camera = S.camera, Q = S.quality;
Q.set('alta');
for (let i = 0; i < 12; i++) await B.frame();

const med = (a) => { const s = [...a].sort((x, y) => x - y); return s[s.length >> 1]; };
function once(n = 20) {
  for (let i = 0; i < 3; i++) R.render(scene, camera);
  gl.finish();
  const t = performance.now();
  for (let i = 0; i < n; i++) R.render(scene, camera);
  gl.finish();
  return (performance.now() - t) / n;
}
/** Compara base × alternativa, intercalado. */
function ab(liga, desliga, reps = 4) {
  const A = [], C = [];
  for (let i = 0; i < reps; i++) { desliga(); A.push(once()); liga(); C.push(once()); }
  desliga();
  return { base: +med(A).toFixed(2), alt: +med(C).toFixed(2) };
}

out.push(['cena', JSON.stringify(S.choice)]);

/* =====================================================================
   1. CENSO
   ===================================================================== */
scene.updateMatrixWorld(true);
const rig = scene.getObjectByName('RIG');
const cabG = S.cabGroup;
const _b = new THREE.Box3();
const PISO = 1.3919, SKIRT = 0.15;      // piso do baú (trailer-assembly.ts)
const malhas = [];
rig?.traverse((o) => {
  if (!o.isMesh || o.isInstancedMesh || !o.geometry?.attributes?.position) return;
  let v = true, p = o;
  while (p && p !== scene) { if (!p.visible) { v = false; break; } p = p.parent; }
  if (!v) return;
  _b.setFromObject(o);
  let doCavalo = false; p = o;
  while (p) { if (p === cabG) { doCavalo = true; break; } p = p.parent; }
  malhas.push({
    o, doCavalo, topo: _b.max.y,
    tri: (o.geometry.index ? o.geometry.index.count : o.geometry.attributes.position.count) / 3,
  });
});
malhas.sort((a, b) => a.tri - b.tri);
const baseline = +med([once(), once(), once(), once()]).toFixed(2);
/* ⚠️ `R.info.reset()` À MÃO antes de cada render cujo contador se vai ler.
   `scene/scene.ts` desligou `info.autoReset` em 2026-08-15 (é o que fez o
   contador enxergar o passe de sombra), então o zeramento automático do three
   não acontece mais e um render sem reset SOMA em cima do quadro anterior.
   Sem estas linhas os números deste arquivo crescem a cada medição. */
R.info.reset();
R.render(scene, camera);
const cBase = R.info.render.calls, tBase = R.info.render.triangles;
out.push(['BASE (alta)', `${baseline} ms · ${cBase} chamadas · ${(tBase / 1e6).toFixed(2)} M tri`]);
out.push(['malhas do veículo', `${malhas.length} (${(malhas.reduce((s, m) => s + m.tri, 0) / 1e6).toFixed(2)} M tri)`]);

/* =====================================================================
   2. O VEREDITO — chamada de desenho × triângulo
   Duas ablações de tamanho OPOSTO no mesmo conjunto. A que devolver mais
   milissegundos diz qual recurso é o escasso.
   ===================================================================== */
const meio = malhas.length >> 1;
const peq = malhas.slice(0, meio), gra = malhas.slice(meio);
const triPeq = peq.reduce((s, m) => s + m.tri, 0), triGra = gra.reduce((s, m) => s + m.tri, 0);
const rP = ab(() => peq.forEach((m) => { m.o.visible = false; }), () => peq.forEach((m) => { m.o.visible = true; }));
const rG = ab(() => gra.forEach((m) => { m.o.visible = false; }), () => gra.forEach((m) => { m.o.visible = true; }));
out.push([`esconder as ${meio} malhas MENORES (${(triPeq / 1e6).toFixed(2)} M tri, ${Math.round(triPeq / (triPeq + triGra) * 100)} % dos triângulos)`,
  `${rP.base} → ${rP.alt} ms  (−${(rP.base - rP.alt).toFixed(2)} ms)`]);
out.push([`esconder as ${malhas.length - meio} malhas MAIORES (${(triGra / 1e6).toFixed(2)} M tri, ${Math.round(triGra / (triPeq + triGra) * 100)} % dos triângulos)`,
  `${rG.base} → ${rG.alt} ms  (−${(rG.base - rG.alt).toFixed(2)} ms)`]);
out.push(['★ VEREDITO',
  (rP.base - rP.alt) >= (rG.base - rG.alt) * 0.8
    ? `POR CHAMADA. Tirar 5 % dos triângulos devolveu tanto quanto tirar 95 % — ${((rP.base - rP.alt) / meio * 1000).toFixed(1)} µs por chamada pequena contra ${((rG.base - rG.alt) / (malhas.length - meio) * 1000).toFixed(1)} µs por chamada grande.`
    : `por triângulo`]);

/* =====================================================================
   3. QUANTO O ACERVO REPETE — o número que diz se dá para instanciar
   O chunk JSON do .glb compara ACESSORES e responde "2 157 únicas". Aqui as
   posições já estão DESCOMPRIMIDAS, e a assinatura é da forma, não do acessor.
   ===================================================================== */
function forma(g) {
  const p = g.attributes.position, a = p.array;
  let sx = 0, sy = 0, sz = 0;
  const passo = Math.max(1, Math.floor(a.length / 3 / 64)) * 3;
  for (let i = 0; i < a.length; i += passo) { sx += a[i]; sy += a[i + 1]; sz += a[i + 2]; }
  if (!g.boundingBox) g.computeBoundingBox();
  const bb = g.boundingBox, r = (x) => Math.round(x * 1e5);
  return `${p.count}|${g.index ? g.index.count : 0}|${r(sx)}|${r(sy)}|${r(sz)}|` +
    `${r(bb.max.x - bb.min.x)}|${r(bb.max.y - bb.min.y)}|${r(bb.max.z - bb.min.z)}`;
}
const formas = new Map();
for (const m of malhas) { const k = forma(m.o.geometry); formas.set(k, (formas.get(k) || 0) + 1); }
const repetidas = [...formas.values()].filter((n) => n > 1);
const emRepeticao = repetidas.reduce((s, n) => s + n, 0);
out.push(['formas do veículo',
  `${malhas.length} malhas → ${formas.size} formas ÚNICAS · ${emRepeticao} (${Math.round(emRepeticao / malhas.length * 100)} %) repetem alguma forma`]);
out.push(['  as mais repetidas', [...formas.values()].sort((a, b) => b - a).slice(0, 6).map((n) => `${n}×`).join(' · ')]);

/* =====================================================================
   4. A FUSÃO POR MATERIAL — o experimento decisivo
   Mesmos triângulos, mesmos materiais, mesma imagem. Só menos chamadas.
   ===================================================================== */
function fundir(lista, nome) {
  const grupos = new Map();
  for (const { o } of lista) {
    const k = o.material.uuid;
    if (!grupos.has(k)) grupos.set(k, { mat: o.material, itens: [] });
    grupos.get(k).itens.push(o);
  }
  const g = new THREE.Group(); g.name = nome;
  const nm = new THREE.Matrix3(), v = new THREE.Vector3();
  for (const { mat, itens } of grupos.values()) {
    let nv = 0, ni = 0;
    for (const o of itens) {
      nv += o.geometry.attributes.position.count;
      ni += o.geometry.index ? o.geometry.index.count : o.geometry.attributes.position.count;
    }
    const pos = new Float32Array(nv * 3), nor = new Float32Array(nv * 3), uv = new Float32Array(nv * 2);
    const idx = nv > 65535 ? new Uint32Array(ni) : new Uint16Array(ni);
    let vo = 0, io = 0;
    for (const o of itens) {
      const geo = o.geometry, p = geo.attributes.position, n = geo.attributes.normal, u = geo.attributes.uv;
      const M = o.matrixWorld; nm.getNormalMatrix(M);
      for (let i = 0; i < p.count; i++) {
        v.fromBufferAttribute(p, i).applyMatrix4(M);
        pos[(vo + i) * 3] = v.x; pos[(vo + i) * 3 + 1] = v.y; pos[(vo + i) * 3 + 2] = v.z;
        if (n) { v.fromBufferAttribute(n, i).applyMatrix3(nm).normalize(); nor[(vo + i) * 3] = v.x; nor[(vo + i) * 3 + 1] = v.y; nor[(vo + i) * 3 + 2] = v.z; }
        if (u) { uv[(vo + i) * 2] = u.getX(i); uv[(vo + i) * 2 + 1] = u.getY(i); }
      }
      if (geo.index) { const a = geo.index.array; for (let i = 0; i < a.length; i++) idx[io + i] = vo + a[i]; io += a.length; }
      else { for (let i = 0; i < p.count; i++) idx[io + i] = vo + i; io += p.count; }
      vo += p.count;
    }
    const bg = new THREE.BufferGeometry();
    bg.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    bg.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
    bg.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
    bg.setIndex(new THREE.BufferAttribute(idx, 1));
    const m = new THREE.Mesh(bg, mat);
    m.castShadow = true; m.receiveShadow = true;
    g.add(m);
  }
  return g;
}

/* Três faixas, da mais segura para a menos. A faixa A é a que
   `trailer-assembly.ts` documenta NUNCA transformar ("malhas cuja caixa inteira
   fica abaixo do piso são puladas sem serem tocadas"). */
const faixaA = malhas.filter((m) => !m.doCavalo && m.topo < PISO - SKIRT);
const faixas = [
  ['A · sob o piso (chassi, rodagem, para-lamas, parafusaria)', faixaA],
  ['A+B+C · tudo (o teto teórico)', malhas],
];
for (const [nome, lista] of faixas) {
  if (!lista.length) continue;
  const t0 = performance.now();
  const g = fundir(lista, 'FUNDIDO');
  const msF = Math.round(performance.now() - t0);
  scene.add(g); g.visible = false;
  const liga = () => { lista.forEach((m) => { m.o.visible = false; }); g.visible = true; };
  const desliga = () => { lista.forEach((m) => { m.o.visible = true; }); g.visible = false; };
  const r = ab(liga, desliga, 4);
  liga(); R.info.reset(); R.render(scene, camera);   /* reset à mão — ver §1 */
  const c = R.info.render.calls, t = R.info.render.triangles;
  /* e o passe de sombra, que é a SEGUNDA varredura de tudo isto */
  function comSombra(n = 8) {
    R.shadowMap.needsUpdate = true; R.render(scene, camera); gl.finish();
    const t0b = performance.now();
    for (let i = 0; i < n; i++) { R.shadowMap.needsUpdate = true; R.render(scene, camera); }
    gl.finish();
    return (performance.now() - t0b) / n;
  }
  const shLig = +med([comSombra(), comSombra()]).toFixed(2);
  desliga();
  const shDes = +med([comSombra(), comSombra()]).toFixed(2);
  scene.remove(g);
  g.traverse((o) => o.geometry?.dispose?.());
  out.push([`★ ${nome}`,
    `${lista.length} malhas → ${g.children.length} · quadro ${r.base} → ${r.alt} ms (${(r.base / r.alt).toFixed(1)}×) · ` +
    `chamadas ${cBase} → ${c} · triângulos ${(tBase / 1e6).toFixed(2)} → ${(t / 1e6).toFixed(2)} M · ` +
    `com sombra reassada ${shDes} → ${shLig} ms · construção ${msF} ms`]);
}

/* =====================================================================
   5. O PASSE DE SOMBRA — quantas chamadas ele acrescenta, e quem o suja
   ===================================================================== */
/* Os dois resets à mão são o que torna esta subtração honesta — ver §1. Sem
   eles `comSombraCalls` viria somado ao quadro anterior e a "diferença" seria
   o quadro INTEIRO, não o passe de sombra. */
R.info.reset();
R.render(scene, camera);
const semSombra = R.info.render.calls;
R.shadowMap.needsUpdate = true;
R.info.reset();
R.render(scene, camera);
const comSombraCalls = R.info.render.calls;
out.push(['passe de sombra: chamadas acrescentadas',
  `${semSombra} → ${comSombraCalls} (+${comSombraCalls - semSombra}, ${Math.round((comSombraCalls / semSombra - 1) * 100)} %)`]);

const sm = R.shadowMap;
let valor = sm.needsUpdate, coletando = false;
const culpados = new Map();
Object.defineProperty(sm, 'needsUpdate', {
  configurable: true,
  get() { return valor; },
  set(v) {
    if (v && !valor && coletando) {
      const p = (new Error().stack || '').split('\n').slice(1, 5)
        .map((l) => l.trim().replace(/^at\s+/, '').replace(/\(?https?:\/\/[^)]*?\/([^/)]+)\)?/, '$1'))
        .filter((l) => l && !l.includes('checks-')).join('  ←  ');
      culpados.set(p, (culpados.get(p) || 0) + 1);
    }
    valor = v;
  },
});
for (const nivel of ['alta', 'media']) {
  Q.set(nivel);
  for (let i = 0; i < 12; i++) await B.frame();
  culpados.clear(); coletando = true;
  const alvo = S.controls.target.clone();
  for (let i = 0; i < 90; i++) {
    const a = i * 0.02, r0 = camera.position.distanceTo(alvo);
    camera.position.set(alvo.x + Math.cos(a) * r0, camera.position.y, alvo.z + Math.sin(a) * r0);
    camera.lookAt(alvo);
    S.lighting.invalidate?.(1);
    await new Promise((r) => requestAnimationFrame(() => r()));
  }
  coletando = false;
  const c = [...culpados.entries()].sort((a, b) => b[1] - a[1]);
  const total = c.reduce((s, [, n]) => s + n, 0);
  out.push([`★ ${nivel}: sombra sujada em 90 quadros de ARRASTO`, `${total} vezes (${Math.round(total / 90 * 100)} % dos quadros)`]);
  for (const [p, n] of c.slice(0, 2)) out.push([`   ${n}×`, p.slice(0, 200)]);
}
delete sm.needsUpdate; sm.needsUpdate = false;
Q.set('alta');
for (let i = 0; i < 10; i++) await B.frame();

/* =====================================================================
   6. A GPU — tempo real e inclinação de preenchimento
   ===================================================================== */
const tq = gl.getExtension('EXT_disjoint_timer_query_webgl2');
async function gpuMs(n = 6) {
  if (!tq) return null;
  const am = [];
  for (let k = 0; k < n; k++) {
    const q = gl.createQuery();
    gl.beginQuery(tq.TIME_ELAPSED_EXT, q);
    R.render(scene, camera);
    gl.endQuery(tq.TIME_ELAPSED_EXT);
    gl.flush();
    for (let w = 0; w < 300; w++) {
      await new Promise((r) => setTimeout(r, 2));
      if (gl.getQueryParameter(q, gl.QUERY_RESULT_AVAILABLE)) break;
    }
    if (!gl.getParameter(tq.GPU_DISJOINT_EXT) && gl.getQueryParameter(q, gl.QUERY_RESULT_AVAILABLE))
      am.push(gl.getQueryParameter(q, gl.QUERY_RESULT) / 1e6);
    gl.deleteQuery(q);
  }
  return am.length ? +med(am).toFixed(2) : null;
}
out.push(['EXT_disjoint_timer_query_webgl2', tq ? 'disponível' : 'INDISPONÍVEL — a seção 6 não mede nada']);
for (const nivel of ['alta', 'media', 'baixa']) {
  Q.set(nivel);
  for (let i = 0; i < 8; i++) await B.frame();
  out.push([`GPU · ${nivel}`, `${await gpuMs()} ms · buffer ${gl.drawingBufferWidth}×${gl.drawingBufferHeight}`]);
}
Q.set('alta');
for (let i = 0; i < 8; i++) await B.frame();
const sz = new THREE.Vector2(); R.getSize(sz);
const pts = [];
for (const f of [0.5, 1, 2, 3]) {
  R.setSize(Math.round(sz.x * f), Math.round(sz.y * f), false);
  pts.push({ mpx: (sz.x * f * sz.y * f) / 1e6, ms: await gpuMs(5) });
}
R.setSize(sz.x, sz.y, false);
const p0 = pts[0], p1 = pts[pts.length - 1];
const slope = (p1.ms - p0.ms) / (p1.mpx - p0.mpx);
out.push(['GPU: inclinação de preenchimento', `${slope.toFixed(2)} ms por megapixel`]);
out.push(['GPU: parte FIXA (vértices, estado)', `${(p0.ms - slope * p0.mpx).toFixed(2)} ms`]);
out.push(['GPU: pontos', pts.map((p) => `${p.mpx.toFixed(2)} Mpx=${p.ms} ms`).join(' · ')]);

/* =====================================================================
   7. MEMÓRIA — o segundo gargalo, e o que decide se a integrada roda
   ===================================================================== */
const vistas = new Set();
const porLado = new Map();
let totalMb = 0;
scene.traverse((o) => {
  const ms = o.material ? (Array.isArray(o.material) ? o.material : [o.material]) : [];
  for (const m of ms) for (const k of Object.keys(m)) {
    const t = m[k];
    if (!t?.isTexture || !t.image || vistas.has(t.uuid)) continue;
    vistas.add(t.uuid);
    const w = t.image.width || 0, h = t.image.height || 0;
    if (!w || !h) continue;
    const mb = w * h * 4 * 1.3333 / 1048576;
    totalMb += mb;
    const k2 = String(Math.max(w, h));
    const e = porLado.get(k2) || { n: 0, mb: 0 };
    e.n++; e.mb += mb; porLado.set(k2, e);
  }
});
out.push(['VRAM de textura por lado',
  [...porLado.entries()].sort((a, b) => b[1].mb - a[1].mb).slice(0, 6)
    .map(([k, v]) => `${k}px: ${v.n}× = ${v.mb.toFixed(0)} MB`).join(' · ')]);
out.push(['VRAM de textura, total', `${totalMb.toFixed(0)} MB em ${vistas.size} texturas`]);
out.push(['renderer.info', `${R.info.memory.geometries} geometrias · ${R.info.memory.textures} texturas · ${R.info.programs?.length} programas`]);

return out;
