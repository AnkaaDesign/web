/* DIAGNÓSTICO do cenário `estudio` — quanto CADA controle move o quadro.
   ===========================================================================
   `checks-estudio.mjs` fotografa o estúdio numa pose só. Este responde a
   pergunta que abriu a rodada: *"algumas opções de iluminação quase não alteram
   nada"* e *"as cores selecionáveis não refletem no cenário, no piso, só nas
   paredes"*. As duas são afirmações MENSURÁVEIS, e a única forma honesta de
   tratá-las é medir o delta de luminância que cada controle produz.

       node tools/studio-bench/bench.mjs --gpu --geometry --checks checks-estudio-diag.mjs

   Cada linha é um par (controle no mínimo, controle no máximo) medido na MESMA
   pose, em três regiões: PAREDE (alto do quadro), PISO (baixo) e SUJEITO (a
   faixa em que a lataria está). Um controle cujo delta é ~0 numa região não
   alcança aquela região — e é isso que se quer saber. */
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
    const local = cards.find((c) => /scania|volvo|iveco/i.test(c.dataset.id || ''));
    (local || cards[0]).click();
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
  }
  return overlay.classList.contains('hidden');
}

out.push(['seletor atravessado', await settle()]);
out.push(['__studio de pé', await B.until(() => !!window.__studio, 300000)]);
const S = window.__studio;
if (!S) return out;
out.push(['implemento carregado', await B.until(() => !!S.trailerRig, 300000)]);

const THREE = S.THREE;
const scene = S.scene;
const camera = S.camera;
const controls = S.controls;
const renderer = S.renderer;
const L = S.lighting;

out.push(['entrou no cenário estúdio', await B.enterStudio()]);
await new Promise((r) => setTimeout(r, 1600));

/* ---- a pose, fixa para todas as medições ---- */
function pose({ az = 104, el = 9, fill = 1.7, ty = 0.42 } = {}) {
  const rig = scene.getObjectByName('RIG');
  const box = new THREE.Box3().setFromObject(rig);
  const c = box.getCenter(new THREE.Vector3());
  const size = box.getSize(new THREE.Vector3());
  const d = Math.min(controls.maxDistance, size.length() * fill);
  const a = THREE.MathUtils.degToRad(az);
  const e = THREE.MathUtils.degToRad(el);
  const t = new THREE.Vector3(c.x, box.min.y + size.y * ty, c.z);
  camera.position.set(
    t.x + d * Math.cos(e) * Math.sin(a),
    Math.max(0.6, t.y + d * Math.sin(e)),
    t.z + d * Math.cos(e) * Math.cos(a),
  );
  controls.target.set(t.x, t.y, t.z);
  camera.updateProjectionMatrix();
  controls.update();
}

/* ---- leitura de pixels ---- */
function readFrame() {
  const c = renderer.domElement;
  const cv = document.createElement('canvas');
  cv.width = c.width; cv.height = c.height;
  const ctx = cv.getContext('2d');
  ctx.drawImage(c, 0, 0);
  return { ctx, w: c.width, h: c.height };
}

/** Média de luminância e de canais numa faixa horizontal [y0..y1] da altura. */
function band(f, y0, y1) {
  const yA = Math.round(f.h * y0), yB = Math.round(f.h * y1);
  const d = f.ctx.getImageData(0, yA, f.w, Math.max(1, yB - yA)).data;
  let l = 0, r = 0, g = 0, b = 0, n = 0;
  for (let i = 0; i < d.length; i += 4) {
    r += d[i]; g += d[i + 1]; b += d[i + 2];
    l += 0.2126 * d[i] + 0.7152 * d[i + 1] + 0.0722 * d[i + 2];
    n++;
  }
  return { lum: +(l / n).toFixed(1), r: +(r / n).toFixed(1), g: +(g / n).toFixed(1), b: +(b / n).toFixed(1) };
}

/* PAREDE: o alto do quadro, acima do teto do baú. PISO: bem abaixo do chassi.
   SUJEITO: a faixa central, dominada pela lateral do baú.

   O `renderer.render()` EXPLÍCITO antes da leitura é a disciplina de
   scene/capture.ts: o laço do estúdio é dirigido por SUJEIRA (ver o bloco de
   `invalidate` em scene.ts) e o canvas não tem `preserveDrawingBuffer`, então
   ler num quadro em que o laço decidiu não desenhar devolve um buffer vazio.
   Ele também é o que FAZ UM ERRO APARECER: uma rodada inteira desta bancada
   mediu zero em tudo com o console limpo, porque a exceção morria dentro do
   rAF do laço; chamando `render()` aqui, ela sobe pela avaliação da bancada e
   o driver a imprime com pilha. */
async function measure() {
  for (let i = 0; i < 8; i++) await B.frame();
  renderer.render(scene, camera);
  const f = readFrame();
  return {
    parede: band(f, 0.06, 0.16),
    sujeito: band(f, 0.38, 0.48),
    piso: band(f, 0.70, 0.86),
  };
}

const delta = (a, b, k) => +(b[k].lum - a[k].lum).toFixed(1);

/** Roda um controle de A a B e devolve o delta por região.
    A espera é o debounce de 380 ms de refreshEnvironment() mais a assadura do
    PMREM: sem ela, um controle que entra na chave do IBL (a temperatura) seria
    medido com a textura anterior. */
async function sweep(label, setA, setB) {
  L.setStudioParams(setA, { animate: false });
  await new Promise((r) => setTimeout(r, 700));
  const a = await measure();
  L.setStudioParams(setB, { animate: false });
  await new Promise((r) => setTimeout(r, 700));
  const b = await measure();
  out.push([label, {
    parede: [a.parede.lum, b.parede.lum, delta(a, b, 'parede')],
    sujeito: [a.sujeito.lum, b.sujeito.lum, delta(a, b, 'sujeito')],
    piso: [a.piso.lum, b.piso.lum, delta(a, b, 'piso')],
  }]);
  return { a, b };
}

pose();
await B.frame();

/* ---------------- 1. O FUNDO ----------------
   Uma foto por pastilha, mais os três números. É a queixa literal: se `piso`
   não se mexer entre `preto` e `branco`, a cor não chega ao chão. */
const BD = ['preto', 'cinza-escuro', 'cinza-claro', 'branco'];
const bdRows = {};
const envSeen = {};
for (const id of BD) {
  L.setStudioParams({ backdrop: id }, { animate: false });
  /* 1400 ms: o crossfade do rig (800) mais o debounce de refreshEnvironment
     (380) mais a assadura do PMREM. Medir antes disso fotografa a sala nova
     iluminada pelo IBL antigo. */
  await new Promise((r) => setTimeout(r, 1400));
  const m = await measure();
  bdRows[id] = { parede: m.parede.lum, sujeito: m.sujeito.lum, piso: m.piso.lum };
  /* O IBL TEM DE TROCAR JUNTO. Se o uuid repetir entre dois fundos, o ambiente
     ficou preso — que era exatamente o defeito do `RoomEnvironment` fixo. */
  envSeen[id] = scene.environment ? scene.environment.uuid.slice(0, 8) : null;
  renderer.render(scene, camera);
  out.push(['fundo ' + id, renderer.domElement.toDataURL('image/png')]);
}
out.push(['FUNDO · luminância [parede, sujeito, piso]', bdRows]);
out.push(['FUNDO · o IBL trocou com a pastilha?', {
  ids: envSeen,
  distintos: new Set(Object.values(envSeen)).size,
}]);

/* Volta ao padrão para o resto das medições. */
L.setStudioParams({ backdrop: 'cinza-escuro' }, { animate: false });
await new Promise((r) => setTimeout(r, 900));

/* ---------------- 2. OS TRÊS MULTIPLICADORES E A TEMPERATURA ---------------- */
await sweep('PREENCHIMENTO 0 → 5', { fill: 0 }, { fill: 5 });
L.setStudioParams({ fill: 1 }, { animate: false });

await sweep('RECORTE 0 → 5', { rim: 0 }, { rim: 5 });
L.setStudioParams({ rim: 1 }, { animate: false });

const soft = await sweep('DIFUSÃO DA SOMBRA 0,15 → 6', { softness: 0.15 }, { softness: 6 });
L.setStudioParams({ softness: 1 }, { animate: false });

/* A difusão só pode aparecer NA SOMBRA. As médias de faixa a diluem, então
   aqui vai a prova direta: o valor de `key.shadow.radius` que o three recebeu, e
   o tipo de mapa de sombra — porque `radius` é IGNORADO em PCFSoftShadowMap. */
const keyLight = scene.children.find((o) => o.isDirectionalLight && o.castShadow);
out.push(['mapa de sombra', {
  tipo: renderer.shadowMap.type,
  PCF: THREE.PCFShadowMap, PCF_SOFT: THREE.PCFSoftShadowMap, VSM: THREE.VSMShadowMap,
  radius: keyLight ? keyLight.shadow.radius : null,
  blurSamples: keyLight ? keyLight.shadow.blurSamples : null,
}]);

/* Um par de fotos rasantes, que é onde a sombra de contato aparece. */
pose({ az: 96, el: 2.6, fill: 1.3, ty: 0.28 });
for (const s of [0.15, 6]) {
  L.setStudioParams({ softness: s }, { animate: false });
  for (let i = 0; i < 8; i++) await B.frame();
  renderer.render(scene, camera);
  out.push(['sombra · difusão ' + s, renderer.domElement.toDataURL('image/png')]);
}
L.setStudioParams({ softness: 1 }, { animate: false });
pose();

const temp = await sweep('TEMPERATURA 2200 K → 9000 K', { temp: 2200 }, { temp: 9000 });
out.push(['TEMPERATURA · R−B no sujeito', {
  '2200K': +(temp.a.sujeito.r - temp.a.sujeito.b).toFixed(1),
  '9000K': +(temp.b.sujeito.r - temp.b.sujeito.b).toFixed(1),
}]);
out.push(['TEMPERATURA · R−B no piso', {
  '2200K': +(temp.a.piso.r - temp.a.piso.b).toFixed(1),
  '9000K': +(temp.b.piso.r - temp.b.piso.b).toFixed(1),
}]);
/* AS FOTOS DA TEMPERATURA. Os números acima provam que a cena esquenta; o que
   só a foto responde é se as LUMINÁRIAS esquentam junto — um estúdio a 2800 K
   com os painéis do teto brancos é a denúncia mais direta que a cena tem. */
for (const k of [2800, 8500]) {
  L.setStudioParams({ temp: k }, { animate: false });
  await new Promise((r) => setTimeout(r, 900));
  for (let i = 0; i < 6; i++) await B.frame();
  renderer.render(scene, camera);
  out.push(['temperatura ' + k + 'K', renderer.domElement.toDataURL('image/png')]);
}
L.setStudioParams({ temp: 6500 }, { animate: false });
await new Promise((r) => setTimeout(r, 900));

/* ---- A SONDA SEGUE O FUNDO? ----
   O cavalo e o implemento amostram um cubemap capturado da cena (scene/probe.ts).
   Se ele não for recapturado numa troca de fundo, a lataria continua espelhando
   a sala anterior — a metade da queixa que o IBL não cobre. O `envMap` é o
   mesmo objeto para todos os materiais, então basta ler um. */
function probeId() {
  let id = null;
  window.__studio.trailerGroup?.traverse((o) => {
    if (id || !o.isMesh) return;
    const m = Array.isArray(o.material) ? o.material[0] : o.material;
    if (m?.envMap) id = m.envMap.uuid.slice(0, 8);
  });
  return id;
}
{
  L.setStudioParams({ backdrop: 'cinza-escuro' }, { animate: false });
  await new Promise((r) => setTimeout(r, 2200));
  const before = probeId();
  L.setStudioParams({ backdrop: 'branco' }, { animate: false });
  /* 2,2 s: o crossfade de 0,8 s mais os 900 ms de debounce da recaptura mais a
     captura em si (seis faces + PMREM). */
  await new Promise((r) => setTimeout(r, 2600));
  const after = probeId();
  out.push(['SONDA · recapturada na troca de fundo', {
    antes: before, depois: after, trocou: !!before && before !== after,
  }]);
  L.setStudioParams({ backdrop: 'cinza-escuro' }, { animate: false });
  await new Promise((r) => setTimeout(r, 900));
}

/* ---------------- 3. A CHAVE ---------------- */
L.scene?.invalidate?.();
{
  L.setLightParams({ brightness: 0.15 });
  const a = await measure();
  L.setLightParams({ brightness: 6 });
  const b = await measure();
  out.push(['INTENSIDADE 15 % → 600 %', {
    parede: [a.parede.lum, b.parede.lum, delta(a, b, 'parede')],
    sujeito: [a.sujeito.lum, b.sujeito.lum, delta(a, b, 'sujeito')],
    piso: [a.piso.lum, b.piso.lum, delta(a, b, 'piso')],
  }]);
  L.setLightParams({ brightness: 1 });
}

/* ---------------- 4. DE ONDE VEM A LUZ ----------------
   Quanto do quadro é o `scene.environment` (o RoomEnvironment fixo) e quanto é
   o rig? Se apagar o ambiente quase não mudar nada, os controles do rig mandam;
   se mudar tudo, é o ambiente — que NENHUM controle do estúdio alcança. */
{
  const before = scene.environmentIntensity;
  const a = await measure();
  scene.environmentIntensity = 0;
  L.invalidate?.(2);
  const b = await measure();
  scene.environmentIntensity = before;
  L.invalidate?.(2);
  out.push(['AMBIENTE (scene.environment) desligado', {
    intensidade: before,
    parede: [a.parede.lum, b.parede.lum, delta(a, b, 'parede')],
    sujeito: [a.sujeito.lum, b.sujeito.lum, delta(a, b, 'sujeito')],
    piso: [a.piso.lum, b.piso.lum, delta(a, b, 'piso')],
  }]);
}

document.getElementById('loading')?.classList.add('hide');
document.getElementById('ts-selector')?.classList.add('hidden');
return out;
